import 'react-native-get-random-values';
import { ImagePickerResponse, launchCamera, launchImageLibrary } from 'react-native-image-picker';
import { Buffer } from 'buffer';
import { getApp } from '@react-native-firebase/app';
import {
  collection,
  doc,
  getDocs,
  getFirestore,
  query,
  setDoc,
  where,
} from '@react-native-firebase/firestore/lib/modular';
import { serverTimestamp } from '@react-native-firebase/firestore/lib/modular/FieldValue';
import { deleteObject, getStorage, ref as storageRef, uploadString } from '@react-native-firebase/storage/lib/modular';
import * as Keychain from 'react-native-keychain';
import RNFS from 'react-native-fs';

import {
  encryptBase64Payload,
  getOrCreateKdfMaterial,
  getRecoveryPassphrase,
  randomWordArray,
  toBase64,
  wrapDocumentKey,
} from '../crypto/documentCrypto.ts';
import { encodeBase64 } from '../crypto/base64.ts';
import { VaultDocumentReference } from '../../types/vault';
import { normalizeReferenceOrder, toHashLabel, toPseudoHash, toSizeLabel } from './formatters';
import { normalizeDescription, normalizeDocumentName } from './normalizers';
import { UploadableDocument, UploadableDocumentDraft, UploadProgressEvent, VaultUploadResult } from './types';

const STORAGE_PATH_PREFIX = 'vault';
const DOC_KEY_SERVICE_PREFIX = 'secdocvault.docKey';
const LARGE_FILE_THRESHOLD_BYTES = 5 * 1024 * 1024;
const MAX_UPLOAD_FILE_BYTES = 10 * 1024 * 1024;
const MAX_CLOUD_DOCUMENTS_PER_USER = 10;
const READ_CHUNK_BYTES = 256 * 1024;
const DEFAULT_CONCURRENCY_LIMIT = 2;
export const MAX_FILES_PER_DOCUMENT = 10;

type QuickCryptoRuntime = {
  randomBytes: (size: number) => Buffer;
  createCipheriv: (algorithm: string, key: Buffer, iv: Buffer) => {
    update: (input: Buffer) => Buffer;
    final: () => Buffer;
    getAuthTag: () => Buffer;
  };
};

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

function getQuickCryptoRuntime(): QuickCryptoRuntime | null {
  try {
    const moduleValue = require('react-native-quick-crypto');
    return (moduleValue.default ?? moduleValue) as QuickCryptoRuntime;
  } catch {
    return null;
  }
}

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
 * @param options
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

    const encryptedPayloadResult = await encryptFileToPayload(file, documentKey, options?.onProgress, {
      index,
      name: file.name,
    });

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
    await Promise.allSettled(
      savedLocalPaths.map(path => RNFS.exists(path).then(exists => (exists ? RNFS.unlink(path) : undefined))),
    );
    await Keychain.resetGenericPassword({service: `${DOC_KEY_SERVICE_PREFIX}.${docId}`}).catch(() => undefined);

    throw error;
  }
}

/**
 * Saves an encrypted document payload locally on the device.
 *
 * @param ownerId - Document owner ID.
 * @param document - Uploadable document metadata.
 * @param options
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
