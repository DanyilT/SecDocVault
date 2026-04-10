import 'react-native-get-random-values';
import {ImagePickerResponse, launchCamera, launchImageLibrary} from 'react-native-image-picker';
import '@react-native-firebase/firestore';
import '@react-native-firebase/storage';
import {getApp} from '@react-native-firebase/app';
import {
  collection,
  collectionGroup,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  getFirestore,
  query,
  setDoc,
  where,
} from '@react-native-firebase/firestore/lib/modular';
import {serverTimestamp} from '@react-native-firebase/firestore/lib/modular/FieldValue';
import {
  deleteObject,
  getDownloadURL,
  getStorage,
  ref as storageRef,
  uploadString,
} from '@react-native-firebase/storage/lib/modular';
import * as Keychain from 'react-native-keychain';
import RNFS from 'react-native-fs';
import {Platform} from 'react-native';
import {Buffer} from 'buffer';

import {
  getOrCreateSharingKeyPair,
  decryptBase64Payload,
  encryptBase64Payload,
  getRecoveryPassphrase,
  getOrCreateKdfMaterial,
  randomWordArray,
  toBase64,
  unwrapDocumentKeyFromShareEnvelope,
  unwrapDocumentKey,
  wrapDocumentKeyForRecipient,
  wrapDocumentKey,
} from './documentCrypto';
import {encodeBase64} from './base64';
import {getAuth} from '@react-native-firebase/auth';
import {VaultDocument, VaultDocumentReference} from '../types/vault';

type ShareGrantRecord = {
  recipientUid: string;
  recipientEmail?: string;
  recipientPublicKey?: string;
  allowExport: boolean;
  wrappedKeyCipher: string;
  keyWrapAlgorithm?: string;
  wrappedKeyIv?: string;
  senderEphemeralPublicKey?: string;
  createdAt: string;
  expiresAt?: string | Date | { toDate?: () => Date; seconds?: number; nanoseconds?: number };
  revokedAt?: string | null;
};

/**
 * Normalized document object used by the upload pipeline.
 */
export type UploadableDocument = {
  /** Local file URI returned by image picker/camera. */
  uri: string;
  /** User-visible file name. */
  name: string;
  /** Optional user description for the document. */
  description?: string;
  /** File size in bytes. */
  size: number;
  /** MIME type (e.g. image/jpeg). */
  type: string;
};

export type UploadableDocumentDraft = {
  /** User-visible document title. */
  name: string;
  /** Optional user description for the document. */
  description?: string;
  /** One or more files attached to this document. */
  files: UploadableDocument[];
};

/**
 * Result returned to UI after upload completes.
 */
type VaultUploadResult = {
  document: VaultDocument;
  timings?: {
    totalMs: number;
    byFile: Array<{
      index: number;
      readMs: number;
      encryptMs: number;
      uploadMs: number;
      localSaveMs: number;
      totalMs: number;
    }>;
  };
};

export type UploadProgressEvent = {
  fileIndex: number;
  fileName: string;
  stage: 'read' | 'encrypt' | 'upload' | 'localSave' | 'done';
  status: 'start' | 'progress' | 'end';
  progress?: number;
  elapsedMs?: number;
};

/** Keychain service to store doc's key `${prefix}.${docId}` */
const DOC_KEY_SERVICE_PREFIX = 'secdocvault.docKey'

function normalizeDocumentKeyB64(value: string | null | undefined) {
  const input = value?.trim();
  if (!input) {
    return null;
  }

  if (/^[A-Fa-f0-9]{64}$/.test(input)) {
    return Buffer.from(input, 'hex').toString('base64');
  }

  const base64Like = /^[A-Za-z0-9+/]+={0,2}$/.test(input) && input.length % 4 === 0;
  if (base64Like) {
    const bytes = Buffer.from(input, 'base64');
    if (bytes.length === 32) {
      return bytes.toString('base64');
    }
  }

  const utf8Bytes = Buffer.from(input, 'utf8');
  if (utf8Bytes.length === 32) {
    return utf8Bytes.toString('base64');
  }

  return null;
}

/** Firebase Storage path prefix for uploaded encrypted payloads. */
const STORAGE_PATH_PREFIX = 'vault';
const USERS_COLLECTION_PATH = 'vaultUsers';
const DOC_SHARES_SUBCOLLECTION = 'sharedUsers';
const DEFAULT_SHARE_EXPIRY_DAYS = 30;
export const MAX_FILES_PER_DOCUMENT = 10;
const LARGE_FILE_THRESHOLD_BYTES = 5 * 1024 * 1024;
const MAX_UPLOAD_FILE_BYTES = 10 * 1024 * 1024;
const MAX_CLOUD_DOCUMENTS_PER_USER = 10;
const READ_CHUNK_BYTES = 256 * 1024;
const DEFAULT_CONCURRENCY_LIMIT = 2;

/**
 * Reads a local file into a Base64 string using RNFS (React Native File System).
 *
 * @param uri - Local file URI with or without `file://` prefix.
 * @returns Base64-encoded file bytes.
 * @private
 */
async function readFileAsBase64(uri: string) {
  const fileUri = uri.startsWith('file://') ? uri.slice(7) : uri;
  return RNFS.readFile(fileUri, 'base64');
}

function normalizeLocalFilePath(uri: string) {
  return uri.startsWith('file://') ? uri.slice(7) : uri;
}

type QuickCryptoRuntime = {
  randomBytes: (size: number) => Buffer;
  createCipheriv: (algorithm: string, key: Buffer, iv: Buffer) => {
    update: (input: Buffer) => Buffer;
    final: () => Buffer;
    getAuthTag: () => Buffer;
  };
};

function getQuickCryptoRuntime(): QuickCryptoRuntime | null {
  try {
    const moduleValue = require('react-native-quick-crypto');
    return (moduleValue.default ?? moduleValue) as QuickCryptoRuntime;
  } catch {
    return null;
  }
}

type EncryptedPayloadResult = {
  payload: string;
  encrypted: {
    cipher: string;
    iv: string;
    authTag?: string;
    key: string;
    algorithm: string;
    version: number;
  };
  readMs: number;
  encryptMs: number;
};

function emitProgress(
  callback: ((event: UploadProgressEvent) => void) | undefined,
  event: UploadProgressEvent,
) {
  if (callback) {
    callback(event);
  }
}

async function encryptLargeFileWithoutBase64First(
  filePath: string,
  fileKeyB64: string,
  onProgress?: (event: UploadProgressEvent) => void,
  progressMeta?: {index: number; name: string},
): Promise<EncryptedPayloadResult> {
  const runtime = getQuickCryptoRuntime();
  if (!runtime) {
    const fallbackReadStart = Date.now();
    const fileBase64 = await RNFS.readFile(filePath, 'base64');
    const fallbackReadMs = Date.now() - fallbackReadStart;
    const fallbackEncryptStart = Date.now();
    const encrypted = await encryptBase64Payload(fileBase64, fileKeyB64);
    const fallbackEncryptMs = Date.now() - fallbackEncryptStart;
    return {
      payload: JSON.stringify({
        version: encrypted.version,
        algorithm: encrypted.algorithm,
        iv: encrypted.iv,
        cipher: encrypted.cipher,
        authTag: encrypted.authTag,
      }),
      encrypted,
      readMs: fallbackReadMs,
      encryptMs: fallbackEncryptMs,
    };
  }

  const readStart = Date.now();
  const stat = await RNFS.stat(filePath);
  const totalSize = Number(stat.size || 0);
  const keyBytes = Buffer.from(fileKeyB64, 'base64');
  const ivBytes = runtime.randomBytes(12);
  const cipher = runtime.createCipheriv('aes-256-gcm', keyBytes, ivBytes);
  const encryptedChunks: Buffer[] = [];

  let position = 0;
  while (position < totalSize) {
    const length = Math.min(READ_CHUNK_BYTES, totalSize - position);
    const chunkBase64 = await RNFS.read(filePath, length, position, 'base64');
    position += length;
    const chunkBytes = Buffer.from(chunkBase64, 'base64');
    const encryptedChunk = cipher.update(chunkBytes);
    if (encryptedChunk.length > 0) {
      encryptedChunks.push(encryptedChunk);
    }

    if (progressMeta && totalSize > 0) {
      emitProgress(onProgress, {
        fileIndex: progressMeta.index,
        fileName: progressMeta.name,
        stage: 'read',
        status: 'progress',
        progress: Math.min(position / totalSize, 1),
      });
    }
  }
  const readMs = Date.now() - readStart;

  const encryptStart = Date.now();
  const finalChunk = cipher.final();
  if (finalChunk.length > 0) {
    encryptedChunks.push(finalChunk);
  }
  const authTag = cipher.getAuthTag();
  const encryptedBuffer = Buffer.concat(encryptedChunks);
  const encryptMs = Date.now() - encryptStart;

  const encrypted = {
    cipher: encodeBase64(encryptedBuffer),
    iv: encodeBase64(ivBytes),
    authTag: encodeBase64(authTag),
    key: fileKeyB64,
    algorithm: 'AES-256-GCM',
    version: 2,
  };

  return {
    payload: JSON.stringify({
      version: encrypted.version,
      algorithm: encrypted.algorithm,
      iv: encrypted.iv,
      cipher: encrypted.cipher,
      authTag: encrypted.authTag,
    }),
    encrypted,
    readMs,
    encryptMs,
  };
}

async function encryptFileToPayload(
  file: UploadableDocument,
  fileKeyB64: string,
  onProgress?: (event: UploadProgressEvent) => void,
  progressMeta?: {index: number; name: string},
): Promise<EncryptedPayloadResult> {
  const filePath = normalizeLocalFilePath(file.uri);
  if (file.size >= LARGE_FILE_THRESHOLD_BYTES) {
    return encryptLargeFileWithoutBase64First(filePath, fileKeyB64, onProgress, progressMeta);
  }

  const readStart = Date.now();
  const fileBase64 = await RNFS.readFile(filePath, 'base64');
  const readMs = Date.now() - readStart;

  const encryptStart = Date.now();
  const encrypted = await encryptBase64Payload(fileBase64, fileKeyB64);
  const encryptMs = Date.now() - encryptStart;

  return {
    payload: JSON.stringify({
      version: encrypted.version,
      algorithm: encrypted.algorithm,
      iv: encrypted.iv,
      cipher: encrypted.cipher,
      authTag: encrypted.authTag,
    }),
    encrypted,
    readMs,
    encryptMs,
  };
}

/**
 * Uploads encrypted payload text to Firebase Storage.
 *
 * @param userId - Owner uid.
 * @param docId - Firestore document id.
 * @param payload - JSON payload containing encrypted file data.
 * @param fileName - Original file name used to compose storage path.
 * @returns Final storage path of uploaded encrypted file.
 * @private
 */
async function uploadEncryptedPayload(userId: string, docId: string, payload: string, fileName: string) {
  const storagePath = `${STORAGE_PATH_PREFIX}/${userId}/${docId}/${fileName}.enc`;
  const app = getApp();
  const storageInstance = getStorage(app);
  const reference = storageRef(storageInstance, storagePath);
  await uploadString(reference, payload, 'raw', {
    contentType: 'application/json',
  });
  return storagePath;
}

/**
 * Save encrypted payload text local on the device
 *
 * @param docId - Document id.
 * @param payload - JSON payload containing encrypted file data.
 * @param fileName - Original file name used to compose storage path.
 * @returns Final storage path of saved encrypted file.
 * @private
 */
async function saveEncryptedPayloadLocal(docId: string, payload: string, fileName: string) {
  const vaultDir = `${RNFS.DocumentDirectoryPath}/vault`;
  const docDir = `${vaultDir}/${docId}`;
  await RNFS.mkdir(docDir);
  const localPath = `${docDir}/${fileName}.enc.json`;
  await RNFS.writeFile(localPath, payload, 'utf8');
  return localPath;
}

function toHashLabel(hashHex?: string) {
  if (!hashHex) {
    return 'AES-GCM tag unavailable';
  }
  return `AES-GCM ${hashHex.slice(0, 16)}...`;
}

function resolveIntegrityTag(reference?: VaultDocumentReference) {
  return reference?.integrityTag ?? reference?.fileHash;
}

function sortReferencesByOrder(references: VaultDocumentReference[] = []) {
  return [...references].sort((a, b) => {
    const left = a.order ?? 0;
    const right = b.order ?? 0;
    return left - right;
  });
}

function normalizeReferenceOrder(references: VaultDocumentReference[] = []) {
  return sortReferencesByOrder(references).map((reference, index) => ({
    ...reference,
    order: reference.order ?? index,
  }));
}

function toDateFromUnknown(value: ShareGrantRecord['expiresAt']): Date | null {
  if (!value) {
    return null;
  }

  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? null : value;
  }

  if (typeof value === 'object' && typeof value.toDate === 'function') {
    const asDate = value.toDate();
    return Number.isNaN(asDate.getTime()) ? null : asDate;
  }

  if (typeof value === 'object' && typeof value.seconds === 'number') {
    const millis = value.seconds * 1000 + Math.floor((value.nanoseconds ?? 0) / 1_000_000);
    const asDate = new Date(millis);
    return Number.isNaN(asDate.getTime()) ? null : asDate;
  }

  const asDate = new Date(String(value));
  return Number.isNaN(asDate.getTime()) ? null : asDate;
}

function normalizeSharedKeyGrants(grants: ShareGrantRecord[] = []) {
  return grants.filter(Boolean).map(grant => ({
    ...grant,
    recipientUid: grant.recipientUid,
    recipientEmail: grant.recipientEmail?.trim().toLowerCase(),
    recipientPublicKey: grant.recipientPublicKey,
    allowExport: Boolean(grant.allowExport),
    keyWrapAlgorithm: grant.keyWrapAlgorithm ?? 'RSA-OAEP-SHA256',
    wrappedKeyIv: grant.wrappedKeyIv ?? '',
    senderEphemeralPublicKey: grant.senderEphemeralPublicKey ?? '',
    expiresAt: (toDateFromUnknown(grant.expiresAt) ?? computeShareExpiryDate(DEFAULT_SHARE_EXPIRY_DAYS)).toISOString(),
    revokedAt: grant.revokedAt ?? null,
  }));
}

function isShareGrantActive(grant: ShareGrantRecord, now = new Date()) {
  if (grant.revokedAt && String(grant.revokedAt).trim().length > 0) {
    return false;
  }

  if (!grant.expiresAt) {
    return false;
  }

  const expiresAt = toDateFromUnknown(grant.expiresAt);
  if (!expiresAt) {
    return false;
  }

  return expiresAt.getTime() > now.getTime();
}

function computeShareExpiryDate(days: number) {
  const normalizedDays = Math.max(1, Math.min(365, Math.floor(days || DEFAULT_SHARE_EXPIRY_DAYS)));
  const date = new Date();
  date.setDate(date.getDate() + normalizedDays);
  return date;
}

function findActiveShareGrantForCurrentUser(doc: VaultDocument) {
  const auth = getAuth(getApp());
  const currentUser = auth.currentUser;
  if (!currentUser) {
    return null;
  }

  const uid = currentUser.uid;
  const email = currentUser.email?.trim().toLowerCase() ?? '';
  return ((doc.sharedKeyGrants ?? []) as ShareGrantRecord[]).find(
    grant =>
      isShareGrantActive(grant) &&
      (grant.recipientUid === uid || (Boolean(email) && grant.recipientEmail?.trim().toLowerCase() === email)),
  );
}

async function getDocShareGrant(docId: string, recipientUid: string) {
  const app = getApp();
  const db = getFirestore(app);
  const snapshot = await getDoc(doc(db, STORAGE_PATH_PREFIX, docId, DOC_SHARES_SUBCOLLECTION, recipientUid));
  if (!snapshot.exists()) {
    return null;
  }

  return normalizeSharedKeyGrants([snapshot.data() as ShareGrantRecord])[0] ?? null;
}

async function listDocShareGrants(docId: string) {
  const app = getApp();
  const db = getFirestore(app);
  const snapshot = await getDocs(collection(db, STORAGE_PATH_PREFIX, docId, DOC_SHARES_SUBCOLLECTION));
  const grants = snapshot.docs.map((item: any) => item.data() as ShareGrantRecord);
  return normalizeSharedKeyGrants(grants);
}

async function syncDocumentShareIndex(docId: string) {
  const app = getApp();
  const db = getFirestore(app);
  const allGrants = await listDocShareGrants(docId);
  const activeGrants = allGrants.filter(grant => isShareGrantActive(grant));
  const sharedWith = Array.from(
    new Set(activeGrants.flatMap(grant => [grant.recipientUid, grant.recipientEmail ?? '']).filter(Boolean)),
  );

  await setDoc(
    doc(db, STORAGE_PATH_PREFIX, docId),
    {
      sharedWith,
      updatedAt: new Date().toISOString(),
    },
    {merge: true},
  );

  return activeGrants;
}

export async function ensureCurrentUserSharePublicKey(userId: string, email?: string | null) {
  const {publicKey} = await getOrCreateSharingKeyPair(userId);
  const app = getApp();
  const db = getFirestore(app);
  await setDoc(
    doc(db, USERS_COLLECTION_PATH, userId),
    {
      uid: userId,
      emailLower: email?.trim().toLowerCase() ?? null,
      sharePublicKey: publicKey,
      updatedAt: new Date().toISOString(),
    },
    {merge: true},
  );

  return publicKey;
}

async function getRecipientShareProfileByEmail(recipientEmail: string) {
  const normalizedEmail = recipientEmail.trim().toLowerCase();
  if (!normalizedEmail || !normalizedEmail.includes('@')) {
    throw new Error('Enter a valid recipient email.');
  }

  const app = getApp();
  const db = getFirestore(app);
  const snapshot = await getDocs(
    query(collection(db, USERS_COLLECTION_PATH), where('emailLower', '==', normalizedEmail)),
  );
  if (snapshot.empty) {
    throw new Error('Recipient key not found. Ask the recipient to sign in first so their public key is published.');
  }

  const first = snapshot.docs[0];
  const data = first.data() as {sharePublicKey?: string; emailLower?: string};
  if (!data.sharePublicKey) {
    throw new Error('Recipient has no sharing public key yet.');
  }

  return {
    uid: first.id,
    emailLower: data.emailLower ?? normalizedEmail,
    sharePublicKey: data.sharePublicKey,
  };
}

export async function clearDocumentKeychainEntries(documentIds: string[]): Promise<void> {
  await Promise.allSettled(
    documentIds.map(async docId => {
      await Keychain.resetGenericPassword({service: `${DOC_KEY_SERVICE_PREFIX}.${docId}`});
    }),
  );
}

export function canCurrentUserExportDocument(doc: VaultDocument) {
  const auth = getAuth(getApp());
  const currentUser = auth.currentUser;
  if (!currentUser) {
    return true;
  }

  if (doc.owner === currentUser.uid) {
    return true;
  }

  const grant = findActiveShareGrantForCurrentUser(doc);
  if (!grant) {
    return true;
  }

  return grant.allowExport;
}

async function rotateDocumentKeyAfterShareChange(docMeta: VaultDocument) {
  const ownerUid = docMeta.owner;
  if (!ownerUid) {
    return docMeta;
  }

  const oldDocumentKey = await resolveDocumentKey(docMeta);
  const nextDocumentKey = toBase64(randomWordArray(32));
  const firebaseRefs = sortReferencesByOrder(docMeta.references).filter(
    item => item.source === 'firebase' && Boolean(item.storagePath),
  );
  const app = getApp();
  const db = getFirestore(app);
  const storageInstance = getStorage(app);

  const nextReferences = [...(docMeta.references ?? [])];
  for (const sourceReference of firebaseRefs) {
    if (!sourceReference.storagePath) {
      continue;
    }

    const encryptedPayloadRaw = await readEncryptedPayload(sourceReference);
    const payload = JSON.parse(encryptedPayloadRaw) as {
      iv: string;
      cipher: string;
      algorithm?: string;
      version?: number;
      authTag?: string;
    };
    const base64Content = await decryptBase64Payload(
      payload.cipher,
      payload.iv,
      oldDocumentKey,
      payload.algorithm ?? 'AES-256-CBC',
      payload.authTag,
    );
    const encrypted = await encryptBase64Payload(base64Content, nextDocumentKey);
    const updatedPayload = JSON.stringify({
      version: encrypted.version,
      algorithm: encrypted.algorithm,
      iv: encrypted.iv,
      cipher: encrypted.cipher,
      authTag: encrypted.authTag,
    });

    await uploadString(storageRef(storageInstance, sourceReference.storagePath), updatedPayload, 'raw', {
      contentType: 'application/json',
    });

    const referenceIndex = nextReferences.findIndex(
      item => item.source === 'firebase' && item.storagePath === sourceReference.storagePath,
    );
    if (referenceIndex >= 0) {
      nextReferences[referenceIndex] = {
        ...nextReferences[referenceIndex],
        fileHash: encrypted.authTag,
        integrityTag: encrypted.authTag,
      };
    }
  }

  const activeGrants = await syncDocumentShareIndex(docMeta.id);
  await Promise.all(
    activeGrants.map(async grant => {
      if (!grant.recipientPublicKey) {
        return;
      }

      const wrapped = await wrapDocumentKeyForRecipient(nextDocumentKey, grant.recipientPublicKey);
      await setDoc(
        doc(db, STORAGE_PATH_PREFIX, docMeta.id, DOC_SHARES_SUBCOLLECTION, grant.recipientUid),
        {
          wrappedKeyCipher: wrapped.wrappedKeyCipher,
          keyWrapAlgorithm: wrapped.keyWrapAlgorithm,
          updatedAt: new Date().toISOString(),
        },
        {merge: true},
      );
    }),
  );

  const nextEncryptedDocKey = await (async () => {
    if (docMeta.encryptedDocKey?.wrapMode === 'recovery') {
      const recoveryPassphrase = await getRecoveryPassphrase();
      if (recoveryPassphrase) {
        return wrapDocumentKey(nextDocumentKey, recoveryPassphrase, undefined, {
          wrapMode: 'recovery',
        });
      }
    }

    const {passphrase, salt} = await getOrCreateKdfMaterial();
    return wrapDocumentKey(nextDocumentKey, passphrase, salt, {wrapMode: 'device'});
  })();

  await Keychain.setGenericPassword(docMeta.id, nextDocumentKey, {
    service: `${DOC_KEY_SERVICE_PREFIX}.${docMeta.id}`,
    accessible: Keychain.ACCESSIBLE.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
  });

  await setDoc(
    doc(db, STORAGE_PATH_PREFIX, docMeta.id),
    {
      references: normalizeReferenceOrder(nextReferences),
      encryptedDocKey: nextEncryptedDocKey,
      updatedAt: new Date().toISOString(),
    },
    {merge: true},
  );

  return {
    ...docMeta,
    references: normalizeReferenceOrder(nextReferences),
    encryptedDocKey: nextEncryptedDocKey,
  };
}

export async function createDocumentShareGrant(
  docMeta: VaultDocument,
  ownerUid: string,
  recipientEmail: string,
  allowExport: boolean,
  expiresInDays = DEFAULT_SHARE_EXPIRY_DAYS,
) {
  if (!ownerUid || docMeta.owner !== ownerUid) {
    throw new Error('Only the document owner can create share keys.');
  }

  const recipientProfile = await getRecipientShareProfileByEmail(recipientEmail);
  if (recipientProfile.uid === ownerUid) {
    throw new Error('You cannot share a document with yourself.');
  }

  const documentKey = await resolveDocumentKey(docMeta);
  const wrapped = await wrapDocumentKeyForRecipient(documentKey, recipientProfile.sharePublicKey);
  const nowIso = new Date().toISOString();
  const nextGrant: ShareGrantRecord = {
    recipientUid: recipientProfile.uid,
    recipientEmail: recipientProfile.emailLower,
    recipientPublicKey: recipientProfile.sharePublicKey,
    allowExport,
    wrappedKeyCipher: wrapped.wrappedKeyCipher,
    keyWrapAlgorithm: wrapped.keyWrapAlgorithm,
    wrappedKeyIv: '',
    senderEphemeralPublicKey: '',
    createdAt: nowIso,
    expiresAt: computeShareExpiryDate(expiresInDays),
  };

  const app = getApp();
  const db = getFirestore(app);
  await setDoc(
    doc(db, STORAGE_PATH_PREFIX, docMeta.id, DOC_SHARES_SUBCOLLECTION, recipientProfile.uid),
    nextGrant,
    {merge: true},
  );
  const activeGrants = await syncDocumentShareIndex(docMeta.id);

  return {
    ...docMeta,
    sharedWith: Array.from(
      new Set(activeGrants.flatMap(grant => [grant.recipientUid, grant.recipientEmail ?? '']).filter(Boolean)),
    ),
    sharedKeyGrants: activeGrants,
  };
}

export async function revokeDocumentShareGrant(docMeta: VaultDocument, ownerUid: string, recipientEmail: string) {
  if (!ownerUid || docMeta.owner !== ownerUid) {
    throw new Error('Only the document owner can revoke share keys.');
  }

  const normalizedEmail = recipientEmail.trim().toLowerCase();
  if (!normalizedEmail) {
    throw new Error('Provide recipient email to revoke sharing.');
  }

  const recipientProfile = await getRecipientShareProfileByEmail(normalizedEmail);
  const existingGrant = await getDocShareGrant(docMeta.id, recipientProfile.uid);
  if (!existingGrant || !isShareGrantActive(existingGrant)) {
    throw new Error('No active share key found for this recipient.');
  }

  const nowIso = new Date().toISOString();
  const app = getApp();
  const db = getFirestore(app);
  await setDoc(
    doc(db, STORAGE_PATH_PREFIX, docMeta.id, DOC_SHARES_SUBCOLLECTION, recipientProfile.uid),
    {
      revokedAt: nowIso,
      updatedAt: nowIso,
    },
    {merge: true},
  );

  const rotatedDoc = await rotateDocumentKeyAfterShareChange(docMeta);
  const activeGrants = await syncDocumentShareIndex(docMeta.id);

  return {
    ...rotatedDoc,
    sharedWith: Array.from(
      new Set(activeGrants.flatMap(grant => [grant.recipientUid, grant.recipientEmail ?? '']).filter(Boolean)),
    ),
    sharedKeyGrants: activeGrants,
  };
}

export async function enforceExpiredShareRevocations(docMeta: VaultDocument, ownerUid: string) {
  if (!ownerUid || docMeta.owner !== ownerUid) {
    return docMeta;
  }

  const now = new Date();
  const nowIso = now.toISOString();
  const existingGrants = await listDocShareGrants(docMeta.id);
  const expiredActive = existingGrants.filter(grant => !grant.revokedAt && !isShareGrantActive(grant, now));
  if (expiredActive.length === 0) {
    const active = existingGrants.filter(grant => isShareGrantActive(grant, now));
    return {
      ...docMeta,
      sharedWith: Array.from(
        new Set(active.flatMap(grant => [grant.recipientUid, grant.recipientEmail ?? '']).filter(Boolean)),
      ),
      sharedKeyGrants: active,
    };
  }

  const app = getApp();
  const db = getFirestore(app);
  await Promise.all(
    expiredActive.map(grant =>
      setDoc(
        doc(db, STORAGE_PATH_PREFIX, docMeta.id, DOC_SHARES_SUBCOLLECTION, grant.recipientUid),
        {
          revokedAt: nowIso,
          updatedAt: nowIso,
        },
        {merge: true},
      ),
    ),
  );

  const rotated = await rotateDocumentKeyAfterShareChange(docMeta);
  const activeAfterRotation = await syncDocumentShareIndex(docMeta.id);
  return {
    ...rotated,
    sharedWith: Array.from(
      new Set(activeAfterRotation.flatMap(grant => [grant.recipientUid, grant.recipientEmail ?? '']).filter(Boolean)),
    ),
    sharedKeyGrants: activeAfterRotation,
  };
}

/**
 * Resolves the document key for a given vault document.
 *
 * - First checks Keychain for a directly stored key.
 * - If not found, unwraps the key using the document's encryptedDocKey metadata.
 *
 * @param doc - The vault document metadata.
 * @returns The resolved document key.
 * @private
 */
async function resolveDocumentKey(doc: VaultDocument) {
  const keychainEntry = await Keychain.getGenericPassword({
    service: `${DOC_KEY_SERVICE_PREFIX}.${doc.id}`,
  });
  if (keychainEntry) {
    const normalized = normalizeDocumentKeyB64(keychainEntry.password);
    if (normalized) {
      return normalized;
    }
  }

  const auth = getAuth(getApp());
  const currentUid = auth.currentUser?.uid;
  const inlineGrant = findActiveShareGrantForCurrentUser(doc) as ShareGrantRecord | null;
  const sharedGrant = (inlineGrant ?? (currentUid ? await getDocShareGrant(doc.id, currentUid) : null)) as ShareGrantRecord | null;
  if (sharedGrant && currentUid) {
    if (!isShareGrantActive(sharedGrant)) {
      throw new Error('Your shared access has expired or was revoked.');
    }

    return unwrapDocumentKeyFromShareEnvelope(currentUid, {
      wrappedKeyCipher: sharedGrant.wrappedKeyCipher,
      keyWrapAlgorithm: sharedGrant.keyWrapAlgorithm ?? 'RSA-OAEP-SHA256',
    });
  }

  if (!doc.encryptedDocKey) {
    throw new Error('Missing encrypted key metadata for this document.');
  }

  const algorithm = doc.encryptedDocKey.algorithm ?? 'AES-256-CBC';
  const iterations = doc.encryptedDocKey.iterations ?? 100000;

  if (doc.encryptedDocKey.wrapMode !== 'recovery') {
    try {
      const {passphrase} = await getOrCreateKdfMaterial();
      return await unwrapDocumentKey(
        doc.encryptedDocKey.cipher,
        doc.encryptedDocKey.iv,
        passphrase,
        doc.encryptedDocKey.salt,
        algorithm,
        iterations,
        doc.encryptedDocKey.authTag,
      );
    } catch {
      // Fallback to recovery passphrase for cross-device restore.
    }
  }

  const recoveryPassphrase = await getRecoveryPassphrase();
  if (!recoveryPassphrase) {
    throw new Error('Missing recovery passphrase. Restore keys from backup on this device first.');
  }

    const unwrapped = await unwrapDocumentKey(
    doc.encryptedDocKey.cipher,
    doc.encryptedDocKey.iv,
    recoveryPassphrase,
    doc.encryptedDocKey.salt,
    algorithm,
    iterations,
    doc.encryptedDocKey.authTag,
  );
    const normalized = normalizeDocumentKeyB64(unwrapped);
    if (!normalized) {
      throw new Error('Recovered key has invalid format. Re-run key recovery with a valid backup passphrase.');
    }
    return normalized;
}

/**
 * Reads the encrypted payload referenced by a VaultDocumentReference.
 *
 * - For local references, reads directly from the file system.
 * - For remote references, fetches the payload from Firebase Storage using the download URL.
 *
 * @param reference - The document reference containing encryption metadata.
 * @returns The raw encrypted payload as a string.
 * @private
 */
async function readEncryptedPayload(reference: VaultDocumentReference) {
  if (reference.source === 'local' && reference.localPath) {
    return RNFS.readFile(reference.localPath, 'utf8');
  }

  if (!reference.storagePath) {
    throw new Error('Missing storage path for encrypted payload.');
  }

  const app = getApp();
  const storageInstance = getStorage(app);
  const referencePath = storageRef(storageInstance, reference.storagePath);
  const downloadUrl = await getDownloadURL(referencePath);
  const response = await fetch(downloadUrl);
  return response.text();
}

/**
 * Normalizes file to internal `UploadableDocument`.
 *
 * @param result - Raw result from image picker or camera launch.
 * @returns Upload-ready document metadata.
 * @throws {Error} If no image URI is present.
 * @private
 */
function normalizeSelectedDocumentForUpload(result: ImagePickerResponse): UploadableDocument {
  const asset = result.assets?.[0];
  const uri = asset?.uri;
  if (!uri) {
    throw new Error('No file selected. / No scanned image returned.');
  }

  return {
    uri,
    name: `doc-${Date.now()}.${
      // define the file's extension
      asset.fileName?.split('.').pop() ??
      uri.split('?')[0].split('.').pop() ??
      asset.type?.split('/').pop() ??
      'idk'
    }`,
    size: asset.fileSize ?? 0,
    type: asset.type ?? 'image/jpeg',
  };
}

/**
 * Launches image library and returns a normalized upload document.
 *
 * @returns Selected image metadata.
 * @throws {Error} If selection is canceled or asset is missing.
 */
export async function pickDocumentForUpload(): Promise<UploadableDocument> {
  const result = await launchImageLibrary({
    mediaType: 'photo',
    quality: 0.9,
  });

  if (result.didCancel) {
    throw new Error('Selection was cancelled.');
  }

  return normalizeSelectedDocumentForUpload(result);
}

/**
 * Launches device camera and returns a normalized upload document.
 *
 * @returns Captured image metadata.
 * @throws {Error} If user cancels capture.
 */
export async function scanDocumentForUpload(): Promise<UploadableDocument> {
  const result = await launchCamera({
    mediaType: 'photo',
    cameraType: 'back',
    quality: 0.9,
  });

  if (result.didCancel) {
    throw new Error('Scan was cancelled.');
  }

  return normalizeSelectedDocumentForUpload(result);
}

/**
 * Encrypts a document and uploads it to Firebase Storage + Firestore.
 *
 * Flow:
 * 1) Generate random per-document AES key and file IV.
 * 2) Read local file as Base64 and encrypt with AES-CBC.
 * 3) Upload encrypted payload to Storage.
 * 4) Store raw doc key in Keychain (device-local convenience).
 * 5) Derive wrapping key via PBKDF2 and wrap doc key.
 * 6) Persist metadata and wrapped key envelope in Firestore.
 *
 * @param userId - Current authenticated user id.
 * @param document - Upload target document.
 * @returns Minimal upload result for immediate UI rendering.
 */
export async function uploadDocumentToFirebase(
  userId: string,
  document: UploadableDocumentDraft,
  options?: {
    alsoSaveLocal?: boolean;
    recoverable?: boolean;
    concurrencyLimit?: number;
    onProgress?: (event: UploadProgressEvent) => void;
  },
): Promise<VaultUploadResult> {
  if (document.files.length === 0) {
    throw new Error('No files selected for upload.');
  }

  if (document.files.length > MAX_FILES_PER_DOCUMENT) {
    throw new Error(`A document can contain at most ${MAX_FILES_PER_DOCUMENT} files.`);
  }

  const oversizedFile = document.files.find(file => file.size > MAX_UPLOAD_FILE_BYTES);
  if (oversizedFile) {
    throw new Error(`File ${oversizedFile.name} exceeds the 10 MB upload limit.`);
  }

  const uploadStart = Date.now();

  const app = getApp();
  const db = getFirestore(app);

  const ownedDocsSnapshot = await getDocs(query(collection(db, STORAGE_PATH_PREFIX), where('owner', '==', userId)));
  if (ownedDocsSnapshot.size >= MAX_CLOUD_DOCUMENTS_PER_USER) {
    throw new Error('Cloud upload limit reached: maximum 10 documents per user.');
  }

  const docRef = doc(collection(db, STORAGE_PATH_PREFIX));
  const docId = docRef.id;

  const documentKey = toBase64(randomWordArray(32));
  const byFileTimings: Array<{
    index: number;
    readMs: number;
    encryptMs: number;
    uploadMs: number;
    localSaveMs: number;
    totalMs: number;
  }> = new Array(document.files.length);
  const firebaseRefsByIndex: Array<VaultDocumentReference | undefined> = new Array(document.files.length);
  const localRefsByIndex: Array<VaultDocumentReference | undefined> = new Array(document.files.length);
  const uploadedStoragePaths: string[] = [];
  const savedLocalPaths: string[] = [];

  const concurrencyLimit = Math.max(
    1,
    Math.min(options?.concurrencyLimit ?? DEFAULT_CONCURRENCY_LIMIT, document.files.length),
  );

  let nextIndex = 0;
  const takeNextIndex = () => {
    if (nextIndex >= document.files.length) {
      return null;
    }
    const value = nextIndex;
    nextIndex += 1;
    return value;
  };

  const processFileAtIndex = async (index: number) => {
    const file = document.files[index];
    const fileStart = Date.now();

    emitProgress(options?.onProgress, {
      fileIndex: index,
      fileName: file.name,
      stage: 'read',
      status: 'start',
    });

    const encryptedPayloadResult = await encryptFileToPayload(
      file,
      documentKey,
      options?.onProgress,
      {index, name: file.name},
    );

    emitProgress(options?.onProgress, {
      fileIndex: index,
      fileName: file.name,
      stage: 'read',
      status: 'end',
      elapsedMs: encryptedPayloadResult.readMs,
    });

    emitProgress(options?.onProgress, {
      fileIndex: index,
      fileName: file.name,
      stage: 'encrypt',
      status: 'end',
      elapsedMs: encryptedPayloadResult.encryptMs,
    });

    emitProgress(options?.onProgress, {
      fileIndex: index,
      fileName: file.name,
      stage: 'upload',
      status: 'start',
    });
    const uploadStartMs = Date.now();
    const storagePath = await uploadEncryptedPayload(userId, docId, encryptedPayloadResult.payload, file.name);
    uploadedStoragePaths.push(storagePath);
    const uploadMs = Date.now() - uploadStartMs;
    emitProgress(options?.onProgress, {
      fileIndex: index,
      fileName: file.name,
      stage: 'upload',
      status: 'end',
      elapsedMs: uploadMs,
    });

    const fileHash = encryptedPayloadResult.encrypted.authTag;
    firebaseRefsByIndex[index] = {
      name: file.name,
      size: file.size,
      type: file.type,
      source: 'firebase',
      storagePath,
      order: index,
      fileHash,
      integrityTag: fileHash,
    };

    let localSaveMs = 0;
    if (options?.alsoSaveLocal) {
      emitProgress(options?.onProgress, {
        fileIndex: index,
        fileName: file.name,
        stage: 'localSave',
        status: 'start',
      });
      const localSaveStart = Date.now();
      const localPath = await saveEncryptedPayloadLocal(docId, encryptedPayloadResult.payload, file.name);
      savedLocalPaths.push(localPath);
      localSaveMs = Date.now() - localSaveStart;
      emitProgress(options?.onProgress, {
        fileIndex: index,
        fileName: file.name,
        stage: 'localSave',
        status: 'end',
        elapsedMs: localSaveMs,
      });
      localRefsByIndex[index] = {
        name: file.name,
        size: file.size,
        type: file.type,
        source: 'local',
        localPath,
        order: index,
        fileHash,
        integrityTag: fileHash,
      };
    }

    byFileTimings[index] = {
      index,
      readMs: encryptedPayloadResult.readMs,
      encryptMs: encryptedPayloadResult.encryptMs,
      uploadMs,
      localSaveMs,
      totalMs: Date.now() - fileStart,
    };

    emitProgress(options?.onProgress, {
      fileIndex: index,
      fileName: file.name,
      stage: 'done',
      status: 'end',
      elapsedMs: byFileTimings[index].totalMs,
    });
  };

  try {
    const workers = Array.from({length: concurrencyLimit}, async () => {
      while (true) {
        const index = takeNextIndex();
        if (index === null) {
          break;
        }
        await processFileAtIndex(index);
      }
    });

    await Promise.all(workers);

    const references: VaultDocumentReference[] = [];
    for (let index = 0; index < document.files.length; index += 1) {
      const firebaseRef = firebaseRefsByIndex[index];
      if (firebaseRef) {
        references.push(firebaseRef);
      }
      const localRef = localRefsByIndex[index];
      if (localRef) {
        references.push(localRef);
      }
    }

    await Keychain.setGenericPassword(docId, documentKey, {
      service: `${DOC_KEY_SERVICE_PREFIX}.${docId}`,
      accessible: Keychain.ACCESSIBLE.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
    });

    const recoveryPassphrase = await getRecoveryPassphrase();
    const shouldUseRecoveryWrap = Boolean(options?.recoverable && recoveryPassphrase);

    if (options?.recoverable && !recoveryPassphrase) {
      throw new Error('Recovery is enabled for this document, but no recovery passphrase is configured.');
    }

    const wrappedDocKey = shouldUseRecoveryWrap
      ? await wrapDocumentKey(documentKey, recoveryPassphrase!, undefined, {wrapMode: 'recovery'})
      : await (async () => {
          const {passphrase, salt} = await getOrCreateKdfMaterial();
          return wrapDocumentKey(documentKey, passphrase, salt, {wrapMode: 'device'});
        })();

    const normalizedReferences = normalizeReferenceOrder(references);
    const firebaseReferences = normalizedReferences.filter(item => item.source === 'firebase');
    const totalSize = document.files.reduce((sum, item) => sum + item.size, 0);
    const firstHash = normalizedReferences.find(item => item.source === 'firebase' || item.source === 'local')?.fileHash;
    const documentName = normalizeDocumentName(document.name);
    const documentDescription = normalizeDescription(document.description);

    await setDoc(docRef, {
      name: documentName,
      description: documentDescription,
      hash: toHashLabel(firstHash),
      size: toSizeLabel(totalSize),
      uploadedAt: new Date().toISOString().slice(0, 10),
      owner: userId,
      sharedWith: [],
      sharedKeyGrants: [],
      references: firebaseReferences,
      fileCount: document.files.length,
      encryptedDocKey: wrappedDocKey,
      createdAt: serverTimestamp(),
      saveMode: 'firebase',
      offlineAvailable: options?.alsoSaveLocal ?? false,
      recoverable: shouldUseRecoveryWrap,
    });

    return {
      document: {
        id: docId,
        name: documentName,
        description: documentDescription,
        hash: toHashLabel(firstHash),
        size: toSizeLabel(totalSize),
        uploadedAt: new Date().toISOString().slice(0, 10),
        owner: userId,
        sharedWith: [],
        sharedKeyGrants: [],
        references: normalizedReferences,
        encryptedDocKey: wrappedDocKey,
        saveMode: 'firebase',
        offlineAvailable: options?.alsoSaveLocal ?? false,
        recoverable: shouldUseRecoveryWrap,
      },
      timings: {
        totalMs: Date.now() - uploadStart,
        byFile: byFileTimings,
      },
    };
  } catch (error) {
    const app = getApp();
    const storageInstance = getStorage(app);

    await Promise.allSettled(uploadedStoragePaths.map(path => deleteObject(storageRef(storageInstance, path))));
    await Promise.allSettled(savedLocalPaths.map(path => RNFS.exists(path).then(exists => (exists ? RNFS.unlink(path) : undefined))));
    await Keychain.resetGenericPassword({service: `${DOC_KEY_SERVICE_PREFIX}.${docId}`}).catch(() => undefined);

    throw error;
  }
}

/**
 * Formats bytes into a compact human-readable size string.
 *
 * @param sizeInBytes - Byte count.
 * @returns `B`, `KB`, or `MB` string with one decimal place where applicable.
 */
export function toSizeLabel(sizeInBytes: number): string {
  if (sizeInBytes < 1024) {
    return `${sizeInBytes} B`;
  }
  if (sizeInBytes < 1024 * 1024) {
    return `${(sizeInBytes / 1024).toFixed(1)} KB`;
  }
  return `${(sizeInBytes / (1024 * 1024)).toFixed(1)} MB`;
}

/**
 * Creates a deterministic display hash from basic file metadata.
 *
 * Note: This is a lightweight pseudo-hash for UI display and is not equivalent
 * to a cryptographic SHA-256 over file contents.
 *
 * @param document - Document metadata.
 * @returns A hash-like label prefixed with `SHA-256`.
 */
export function toPseudoHash(files: UploadableDocument[]): string {
  const raw = files
    .map((file, index) => `${index}:${file.name}:${file.size}:${file.type}`)
    .join('|');
  let hash = 0;
  for (let i = 0; i < raw.length; i += 1) {
    hash = (hash << 5) - hash + raw.charCodeAt(i);
    hash |= 0;
  }
  return `SHA-256 ${Math.abs(hash).toString(16).padStart(12, '0')}...`;
}

/**
 * Saves an encrypted document payload locally on the device.
 *
 * @param ownerId - Document owner ID.
 * @param document - Uploadable document metadata.
 * @returns Metadata of the saved document including ID, name, and local path.
 */
export async function documentSaveLocal(
  ownerId: string,
  document: UploadableDocumentDraft,
  options?: {
    recoverable?: boolean;
  },
): Promise<VaultUploadResult> {
  if (document.files.length === 0) {
    throw new Error('No files selected for local save.');
  }

  if (document.files.length > MAX_FILES_PER_DOCUMENT) {
    throw new Error(`A document can contain at most ${MAX_FILES_PER_DOCUMENT} files.`);
  }

  const docId = `${Date.now()}-${Math.random().toString(16).slice(2, 8)}`;
  const references: VaultDocumentReference[] = [];
  let documentKey: string | null = null;

  for (let index = 0; index < document.files.length; index += 1) {
    const file = document.files[index];
    const fileBase64 = await readFileAsBase64(file.uri);
    const encrypted = await encryptBase64Payload(fileBase64, documentKey ?? undefined);
    documentKey = documentKey ?? encrypted.key;
    const encryptedPayload = JSON.stringify({
      version: encrypted.version,
      algorithm: encrypted.algorithm,
      iv: encrypted.iv,
      cipher: encrypted.cipher,
      authTag: encrypted.authTag,
    });
    const localPath = await saveEncryptedPayloadLocal(docId, encryptedPayload, file.name);
    const fileHash = encrypted.authTag;

    references.push({
      name: file.name,
      size: file.size,
      type: file.type,
      source: 'local',
      localPath,
      order: index,
      fileHash,
      integrityTag: fileHash,
    });
  }

  if (!documentKey) {
    throw new Error('Failed to generate document key.');
  }

  await Keychain.setGenericPassword(docId, documentKey, {
    service: `${DOC_KEY_SERVICE_PREFIX}.${docId}`,
    accessible: Keychain.ACCESSIBLE.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
  });

  const recoveryPassphrase = await getRecoveryPassphrase();
  const shouldUseRecoveryWrap = Boolean(options?.recoverable && recoveryPassphrase);

  if (options?.recoverable && !recoveryPassphrase) {
    throw new Error('Recovery is enabled for this document, but no recovery passphrase is configured.');
  }

  const wrappedDocKey = shouldUseRecoveryWrap
    ? await wrapDocumentKey(documentKey, recoveryPassphrase!, undefined, {wrapMode: 'recovery'})
    : await (async () => {
        const {passphrase, salt} = await getOrCreateKdfMaterial();
        return wrapDocumentKey(documentKey, passphrase, salt, {wrapMode: 'device'});
      })();
  const normalizedReferences = normalizeReferenceOrder(references);
  const totalSize = document.files.reduce((sum, item) => sum + item.size, 0);
  const documentName = normalizeDocumentName(document.name);
  const documentDescription = normalizeDescription(document.description);
  const firstHash = normalizedReferences[0]?.fileHash;

  return {
    document: {
      id: docId,
      name: documentName,
      description: documentDescription,
      hash: firstHash ? toHashLabel(firstHash) : toPseudoHash(document.files),
      size: toSizeLabel(totalSize),
      uploadedAt: new Date().toISOString().slice(0, 10),
      owner: ownerId,
      sharedWith: [],
      sharedKeyGrants: [],
      references: normalizedReferences,
      encryptedDocKey: wrappedDocKey,
      saveMode: 'local',
      offlineAvailable: true,
      recoverable: shouldUseRecoveryWrap,
    },
  };
}

export function getLocalReference(doc: VaultDocument, fileOrder = 0) {
  return sortReferencesByOrder(doc.references).find(
    item => item.source === 'local' && item.localPath && (item.order ?? 0) === fileOrder,
  );
}

export function getFirebaseReference(doc: VaultDocument, fileOrder = 0) {
  return sortReferencesByOrder(doc.references).find(
    item => item.source === 'firebase' && item.storagePath && (item.order ?? 0) === fileOrder,
  );
}

export function hasLocalEncryptedCopy(doc: VaultDocument) {
  return Boolean(getLocalReference(doc));
}

export async function saveDocumentOffline(docMeta: VaultDocument): Promise<VaultDocument> {
  const firebaseReferences = sortReferencesByOrder(docMeta.references).filter(
    item => item.source === 'firebase' && item.storagePath,
  );
  if (firebaseReferences.length === 0) {
    throw new Error('No document payload found to save offline.');
  }

  const existingLocalOrders = new Set(
    (docMeta.references ?? [])
      .filter(item => item.source === 'local')
      .map((item, index) => item.order ?? index),
  );

  const localCopies: VaultDocumentReference[] = [];
  for (let index = 0; index < firebaseReferences.length; index += 1) {
    const sourceReference = firebaseReferences[index];
    const order = sourceReference.order ?? index;
    if (existingLocalOrders.has(order)) {
      continue;
    }

    const payload = await readEncryptedPayload(sourceReference);
    const localPath = await saveEncryptedPayloadLocal(docMeta.id, payload, sourceReference.name);
    localCopies.push({
      name: sourceReference.name,
      size: sourceReference.size,
      type: sourceReference.type,
      source: 'local',
      localPath,
      order,
      fileHash: sourceReference.fileHash,
      integrityTag: sourceReference.integrityTag ?? sourceReference.fileHash,
    });
  }

  if (localCopies.length === 0 && hasLocalEncryptedCopy(docMeta)) {
    return docMeta;
  }

  const nextReferences = normalizeReferenceOrder([...(docMeta.references ?? []), ...localCopies]);

  const hasFirebaseRef = nextReferences.some(item => item.source === 'firebase');
  const nextDoc: VaultDocument = {
    ...docMeta,
    references: nextReferences,
    saveMode: hasFirebaseRef ? 'firebase' : 'local',
    offlineAvailable: true,
  };

  if (docMeta.owner && hasFirebaseRef) {
    const app = getApp();
    const db = getFirestore(app);
    await setDoc(
      doc(db, STORAGE_PATH_PREFIX, docMeta.id),
      {
        offlineAvailable: true,
      },
      {merge: true},
    );
  }

  return nextDoc;
}

export async function saveDocumentToFirebase(docMeta: VaultDocument, ownerId: string): Promise<VaultDocument> {
  const localReferences = sortReferencesByOrder(docMeta.references).filter(
    item => item.source === 'local' && item.localPath,
  );

  if (localReferences.length === 0) {
    throw new Error('No local encrypted payload found to upload to Firebase.');
  }

  if (!docMeta.encryptedDocKey) {
    throw new Error('Missing encrypted document key. Recreate or re-encrypt this document before uploading to Firebase.');
  }

  const hasFirebaseRef = (docMeta.references ?? []).some(item => item.source === 'firebase' && item.storagePath);
  if (hasFirebaseRef) {
    return docMeta;
  }

  const uploadedStoragePaths: string[] = [];

  try {
    const firebaseCopies: VaultDocumentReference[] = [];
    for (let index = 0; index < localReferences.length; index += 1) {
      const localReference = localReferences[index];
      const payload = await readEncryptedPayload(localReference);
      const storagePath = await uploadEncryptedPayload(ownerId, docMeta.id, payload, localReference.name);
      uploadedStoragePaths.push(storagePath);

      firebaseCopies.push({
        name: localReference.name,
        size: localReference.size,
        type: localReference.type,
        source: 'firebase',
        storagePath,
        order: localReference.order ?? index,
        fileHash: localReference.fileHash,
        integrityTag: localReference.integrityTag ?? localReference.fileHash,
      });
    }

    const nextReferences = normalizeReferenceOrder([...(docMeta.references ?? []), ...firebaseCopies]);
    const firebaseReferences = nextReferences.filter(item => item.source === 'firebase');

    const app = getApp();
    const db = getFirestore(app);
    await setDoc(
      doc(db, STORAGE_PATH_PREFIX, docMeta.id),
      {
        name: normalizeDocumentName(docMeta.name),
        description: normalizeDescription(docMeta.description),
        hash: docMeta.hash,
        size: docMeta.size,
        uploadedAt: docMeta.uploadedAt ?? new Date().toISOString().slice(0, 10),
        owner: ownerId,
        sharedWith: docMeta.sharedWith ?? [],
        sharedKeyGrants: docMeta.sharedKeyGrants ?? [],
        references: firebaseReferences,
        fileCount: firebaseReferences.length,
        encryptedDocKey: docMeta.encryptedDocKey,
        saveMode: 'firebase',
        offlineAvailable: nextReferences.some(item => item.source === 'local'),
        recoverable: Boolean(docMeta.recoverable),
        updatedAt: new Date().toISOString(),
        createdAt: serverTimestamp(),
      },
      {merge: true},
    );

    return {
      ...docMeta,
      owner: ownerId,
      references: nextReferences,
      saveMode: 'firebase',
      offlineAvailable: nextReferences.some(item => item.source === 'local'),
    };
  } catch (error) {
    const app = getApp();
    const storageInstance = getStorage(app);
    await Promise.allSettled(
      uploadedStoragePaths.map(path => deleteObject(storageRef(storageInstance, path))),
    );
    throw error;
  }
}

export async function updateDocumentRecoveryPreference(
  docMeta: VaultDocument,
  recoverable: boolean,
): Promise<VaultDocument> {
  const resolvedKey = await resolveDocumentKey(docMeta);
  const wrappedDocKey = recoverable
    ? await (async () => {
        const recoveryPassphrase = await getRecoveryPassphrase();
        if (!recoveryPassphrase) {
          throw new Error('Key backup is not set up yet. Configure recovery passphrase first.');
        }
        return wrapDocumentKey(resolvedKey, recoveryPassphrase, undefined, {wrapMode: 'recovery'});
      })()
    : await (async () => {
        const {passphrase, salt} = await getOrCreateKdfMaterial();
        return wrapDocumentKey(resolvedKey, passphrase, salt, {wrapMode: 'device'});
      })();

  const hasFirebaseRef = (docMeta.references ?? []).some(item => item.source === 'firebase');
  if (docMeta.owner && hasFirebaseRef) {
    const app = getApp();
    const db = getFirestore(app);
    await setDoc(
      doc(db, STORAGE_PATH_PREFIX, docMeta.id),
      {
        encryptedDocKey: wrappedDocKey,
        recoverable,
        updatedAt: new Date().toISOString(),
      },
      {merge: true},
    );
  }

  return {
    ...docMeta,
    encryptedDocKey: wrappedDocKey,
    recoverable,
  };
}

export async function removeLocalDocumentCopy(docMeta: VaultDocument): Promise<VaultDocument> {
  const localRefs = (docMeta.references ?? []).filter(item => item.source === 'local' && item.localPath);
  const remoteRefs = (docMeta.references ?? []).filter(item => item.source !== 'local');

  for (const reference of localRefs) {
    if (!reference.localPath) {
      continue;
    }

    const exists = await RNFS.exists(reference.localPath);
    if (exists) {
      await RNFS.unlink(reference.localPath);
    }
  }

  const hasFirebaseRef = remoteRefs.some(item => item.source === 'firebase');
  const nextDoc: VaultDocument = {
    ...docMeta,
    references: normalizeReferenceOrder(remoteRefs),
    saveMode: hasFirebaseRef ? 'firebase' : 'local',
    offlineAvailable: false,
  };

  if (docMeta.owner && hasFirebaseRef) {
    const app = getApp();
    const db = getFirestore(app);
    await setDoc(
      doc(db, STORAGE_PATH_PREFIX, docMeta.id),
      {
        offlineAvailable: false,
      },
      {merge: true},
    );
  }

  return nextDoc;
}

export async function deleteDocumentFromFirebase(docMeta: VaultDocument): Promise<void> {
  const firebaseRefs = (docMeta.references ?? []).filter(item => item.source === 'firebase' && item.storagePath);

  if (firebaseRefs.length > 0) {
    const app = getApp();
    const storageInstance = getStorage(app);
    await Promise.allSettled(
      firebaseRefs.map(async item => {
        if (!item.storagePath) {
          return;
        }
        await deleteObject(storageRef(storageInstance, item.storagePath));
      }),
    );
  }

  const app = getApp();
  const db = getFirestore(app);
  await deleteDoc(doc(db, STORAGE_PATH_PREFIX, docMeta.id));
}

export function removeFirebaseReferences(docMeta: VaultDocument): VaultDocument | null {
  const nextReferences = normalizeReferenceOrder((docMeta.references ?? []).filter(item => item.source !== 'firebase'));
  if (nextReferences.length === 0) {
    return null;
  }

  return {
    ...docMeta,
    references: nextReferences,
    saveMode: 'local',
    offlineAvailable: nextReferences.some(item => item.source === 'local'),
  };
}

/**
 * Retrieves and decrypts a document's payload from the vault.
 *
 * @param doc - The document metadata including references to encrypted payload.
 * @returns Decrypted file data, MIME type, and original file name.
 */
export async function decryptDocumentPayload(doc: VaultDocument, fileOrder = 0) {
  const localReference = getLocalReference(doc, fileOrder);
  const remoteReference = getFirebaseReference(doc, fileOrder);
  const reference =
    localReference ??
    remoteReference ??
    sortReferencesByOrder(doc.references).find(item => (item.order ?? 0) === fileOrder) ??
    sortReferencesByOrder(doc.references)[0];

  if (!reference) {
    throw new Error('No encrypted payload references found.');
  }

  const payload = await readEncryptedPayload(reference);
  const parsed = JSON.parse(payload) as {
    iv: string;
    cipher: string;
    algorithm?: string;
    version?: number;
    authTag?: string;
  };
  const key = await resolveDocumentKey(doc);
  const base64 = await decryptBase64Payload(
    parsed.cipher,
    parsed.iv,
    key,
    parsed.algorithm ?? 'AES-256-CBC',
    parsed.authTag,
  );

  return {
    base64,
    mimeType: reference.type,
    fileName: reference.name,
    fileHash: resolveIntegrityTag(reference),
    fileOrder: reference.order ?? fileOrder,
  };
}

/**
 * Exports a document by decrypting it and saving to the device's file system.
 *
 * @param doc - The document metadata including references to encrypted payload.
 * @returns The file path where the document was saved on the device.
 */
export async function exportDocumentToDevice(doc: VaultDocument, fileOrder = 0) {
  const decrypted = await decryptDocumentPayload(doc, fileOrder);
  const targetDir = Platform.OS === 'android' ? RNFS.DownloadDirectoryPath : RNFS.DocumentDirectoryPath;
  const outputPath = `${targetDir}/${Date.now()}-${decrypted.fileName}`;
  await RNFS.writeFile(outputPath, decrypted.base64, 'base64');
  return outputPath;
}

/**
 * Fetches metadata for a document from the vault by its ID.
 *
 * @param docId - The document ID.
 * @returns Document metadata including ID, name, hash, size, and upload date.
 */
export async function getDocumentMetadataFromVault(docId: string) {
  const app = getApp();
  const db = getFirestore(app);
  const snapshot = await getDoc(doc(db, STORAGE_PATH_PREFIX, docId));
  if (!snapshot.exists()) {
    return null;
  }

  const data = snapshot.data() as Partial<VaultDocument>;
  return {
    ...data,
    id: snapshot.id,
    name: data.name ?? 'Document',
    description: data.description ?? '',
    hash: data.hash ?? toHashLabel(resolveIntegrityTag((data.references ?? [])[0])),
    size: data.size ?? 'Unknown',
    uploadedAt: data.uploadedAt ?? new Date().toISOString().slice(0, 10),
    sharedKeyGrants: normalizeSharedKeyGrants((data.sharedKeyGrants ?? []) as unknown as ShareGrantRecord[]) as any,
    references: normalizeReferenceOrder(data.references ?? []),
  } as VaultDocument;
}

export async function listVaultDocumentsFromFirebase(ownerId: string): Promise<VaultDocument[]> {
  const app = getApp();
  const db = getFirestore(app);
  const vaultQuery = query(collection(db, STORAGE_PATH_PREFIX), where('owner', '==', ownerId));
  let snapshot;

  try {
    snapshot = await getDocs(vaultQuery);
  } catch (error) {
    if (typeof error === 'object' && error && 'code' in error) {
      const code = String((error as {code: string}).code);
      if (code.includes('permission-denied')) {
        return [];
      }
    }

    throw error;
  }

  const docs: VaultDocument[] = [];
  snapshot.forEach((item: any) => {
    const data = item.data() as Partial<VaultDocument>;
    const normalizedReferences = normalizeReferenceOrder(data.references ?? []);
    const firstRef = normalizedReferences[0];
    const normalizedSize =
      typeof data.size === 'string'
        ? data.size
        : firstRef?.size
          ? toSizeLabel(firstRef.size)
          : 'Unknown';

    docs.push({
      id: item.id,
      name: data.name ?? 'Document',
      description: data.description ?? '',
      hash: data.hash ?? toHashLabel(resolveIntegrityTag(firstRef)),
      size: normalizedSize,
      uploadedAt: data.uploadedAt ?? new Date().toISOString().slice(0, 10),
      owner: data.owner,
      sharedWith: data.sharedWith ?? [],
      sharedKeyGrants: normalizeSharedKeyGrants((data.sharedKeyGrants ?? []) as unknown as ShareGrantRecord[]) as any,
      references: normalizedReferences,
      encryptedDocKey: data.encryptedDocKey,
      saveMode: data.saveMode ?? 'firebase',
      recoverable: Boolean(data.recoverable),
      offlineAvailable:
        Boolean(data.offlineAvailable) ||
        Boolean(normalizedReferences.some(reference => reference.source === 'local')),
    });
  });

  return docs.sort((a, b) => b.uploadedAt.localeCompare(a.uploadedAt));
}

export async function listVaultDocumentsSharedWithUser(recipientIdentifiers: string[]): Promise<VaultDocument[]> {
  const normalizedIdentifiers = recipientIdentifiers
    .map(item => item.trim())
    .filter(Boolean);
  if (normalizedIdentifiers.length === 0) {
    return [];
  }

  const app = getApp();
  const db = getFirestore(app);
  const now = new Date();
  const uidIdentifiers = normalizedIdentifiers
    .filter(item => !item.includes('@'));
  const emailIdentifiers = normalizedIdentifiers
    .filter(item => item.includes('@'))
    .map(item => item.toLowerCase());
  const grantDocs: Array<{
    docId: string;
    grant: ShareGrantRecord;
  }> = [];

  const isPermissionDeniedError = (error: unknown) =>
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    String((error as {code: unknown}).code).includes('permission-denied');

  const toVaultDocument = (
    snapshot: any,
    fallbackSharedWith: string[] = [],
    fallbackGrants: ShareGrantRecord[] = [],
  ): VaultDocument => {
    const data = snapshot.data() as Partial<VaultDocument>;
    const normalizedReferences = normalizeReferenceOrder(data.references ?? []);
    const firstRef = normalizedReferences[0];
    const normalizedSize =
      typeof data.size === 'string'
        ? data.size
        : firstRef?.size
          ? toSizeLabel(firstRef.size)
          : 'Unknown';

    return {
      id: snapshot.id,
      name: data.name ?? 'Document',
      description: data.description ?? '',
      hash: data.hash ?? toHashLabel(resolveIntegrityTag(firstRef)),
      size: normalizedSize,
      uploadedAt: data.uploadedAt ?? new Date().toISOString().slice(0, 10),
      owner: data.owner,
      sharedWith: Array.from(
        new Set([...(data.sharedWith ?? []), ...fallbackSharedWith].filter(Boolean)),
      ),
      sharedKeyGrants: normalizeSharedKeyGrants([
        ...((data.sharedKeyGrants ?? []) as unknown as ShareGrantRecord[]),
        ...fallbackGrants,
      ]) as any,
      references: normalizedReferences,
      encryptedDocKey: data.encryptedDocKey,
      saveMode: data.saveMode ?? 'firebase',
      recoverable: Boolean(data.recoverable),
      offlineAvailable:
        Boolean(data.offlineAvailable) ||
        Boolean(normalizedReferences.some(reference => reference.source === 'local')),
    };
  };

  const mergeDocuments = (left: VaultDocument, right: VaultDocument): VaultDocument => {
    const references = normalizeReferenceOrder([...(left.references ?? []), ...(right.references ?? [])]);
    const sharedWith = Array.from(new Set([...(left.sharedWith ?? []), ...(right.sharedWith ?? [])].filter(Boolean)));
    const sharedKeyGrants = Array.from(
      new Map(
        [...((left.sharedKeyGrants ?? []) as ShareGrantRecord[]), ...((right.sharedKeyGrants ?? []) as ShareGrantRecord[])].map(grant => [
          `${grant.recipientUid}|${grant.recipientEmail ?? ''}|${grant.createdAt}|${String(grant.expiresAt)}`,
          grant,
        ]),
      ).values(),
    ) as any;

    return {
      ...left,
      ...right,
      references,
      sharedWith,
      sharedKeyGrants,
      offlineAvailable:
        Boolean(left.offlineAvailable || right.offlineAvailable) ||
        references.some(reference => reference.source === 'local'),
    };
  };

  const loadGrantMatches = async (fieldName: 'recipientUid' | 'recipientEmail', values: string[]) => {
    let denied = false;

    await Promise.all(
      values.map(async value => {
        let snapshot;
        try {
          snapshot = await getDocs(
            query(collectionGroup(db, DOC_SHARES_SUBCOLLECTION), where(fieldName, '==', value)),
          );
        } catch (error) {
          if (isPermissionDeniedError(error)) {
            denied = true;
            return;
          }

          throw error;
        }

        snapshot.forEach((item: any) => {
          const grant = normalizeSharedKeyGrants([item.data() as ShareGrantRecord])[0];
          const docId = item.ref.parent.parent?.id;
          if (!grant || !docId || !isShareGrantActive(grant, now)) {
            return;
          }

          grantDocs.push({docId, grant});
        });
      }),
    );

    return !denied;
  };

  const uidQueryAllowed = await loadGrantMatches('recipientUid', uidIdentifiers);
  const emailQueryAllowed = await loadGrantMatches('recipientEmail', emailIdentifiers);

  const fallbackDocsById = new Map<string, VaultDocument>();
  await Promise.all(
    [...uidIdentifiers, ...emailIdentifiers].map(async identifier => {
      let snapshot;
      try {
        snapshot = await getDocs(
          query(collection(db, STORAGE_PATH_PREFIX), where('sharedWith', 'array-contains', identifier)),
        );
      } catch (error) {
        if (isPermissionDeniedError(error)) {
          return;
        }

        throw error;
      }

      snapshot.forEach((item: any) => {
        const mapped = toVaultDocument(item, [identifier]);
        const existing = fallbackDocsById.get(mapped.id);
        fallbackDocsById.set(mapped.id, existing ? mergeDocuments(existing, mapped) : mapped);
      });
    }),
  );

  if (!uidQueryAllowed && !emailQueryAllowed && fallbackDocsById.size === 0) {
    return [];
  }

  const dedupedByDocId = new Map<string, ShareGrantRecord>();
  grantDocs.forEach(item => {
    const existing = dedupedByDocId.get(item.docId);
    if (!existing || new Date(existing.createdAt).getTime() < new Date(item.grant.createdAt).getTime()) {
      dedupedByDocId.set(item.docId, item.grant);
    }
  });

  const docsFromGrants = await Promise.all(
    [...dedupedByDocId.entries()].map(async ([docId, grant]) => {
      let snapshot;
      try {
        snapshot = await getDoc(doc(db, STORAGE_PATH_PREFIX, docId));
      } catch (error) {
        if (isPermissionDeniedError(error)) {
          return null;
        }

        throw error;
      }

      if (!snapshot.exists()) {
        return null;
      }

      return toVaultDocument(snapshot, [grant.recipientUid, grant.recipientEmail ?? ''].filter(Boolean), [grant]);
    }),
  );

  const combinedById = new Map<string, VaultDocument>(fallbackDocsById);
  docsFromGrants.forEach(item => {
    if (!item) {
      return;
    }

    const existing = combinedById.get(item.id);
    combinedById.set(item.id, existing ? mergeDocuments(existing, item) : item);
  });

  return [...combinedById.values()].sort((a, b) => b.uploadedAt.localeCompare(a.uploadedAt));
}

function normalizeDescription(value?: string) {
  return value?.trim() ?? '';
}

function normalizeDocumentName(value?: string) {
  const normalized = value?.trim();
  return normalized && normalized.length > 0 ? normalized : 'Document';
}
