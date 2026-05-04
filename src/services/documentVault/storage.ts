/**
 * services/documentVault/storage.ts
 *
 * High-level storage helpers for saving and retrieving encrypted document
 * payloads from local filesystem and Firebase Storage. These functions wrap
 * platform-specific APIs and offer a consistent Promise-based API for the
 * rest of the application.
 */

import { getApp } from '@react-native-firebase/app';
import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  getFirestore,
  query,
  serverTimestamp,
  where,
  setDoc,
} from '@react-native-firebase/firestore';
import {
  deleteObject,
  getDownloadURL,
  getStorage,
  ref as storageRef,
  uploadString,
} from '@react-native-firebase/storage';
import * as Keychain from 'react-native-keychain';
import RNFS from 'react-native-fs';
import {Platform} from 'react-native';

import {
  decryptBase64Payload,
  getOrCreateKdfMaterial,
  getRecoveryPassphrase,
  MissingKdfPassphraseError,
  unwrapDocumentKey,
  unwrapDocumentKeyFromShareEnvelope,
  wrapDocumentKey,
} from '../crypto/documentCrypto.ts';
import { getAuth } from '@react-native-firebase/auth';
import { VaultDocument, VaultDocumentReference } from '../../types/vault';
import {
  normalizeDocumentKeyB64,
  normalizeReferenceOrder,
  resolveIntegrityTag,
  sortReferencesByOrder,
} from './formatters';
import { isShareGrantActive, ShareGrantRecord } from './shareGrants';
import { normalizeDescription, normalizeDocumentName } from './normalizers';

const STORAGE_PATH_PREFIX = 'vault';
const DOC_SHARES_SUBCOLLECTION = 'sharedUsers';
const DOC_KEY_SERVICE_PREFIX = 'secdocvault.docKey';

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

async function getDocShareGrant(docId: string, recipientUid: string, recipientEmail?: string | null) {
  const app = getApp();
  const db = getFirestore(app);
  const snapshot = await getDoc(doc(db, STORAGE_PATH_PREFIX, docId, DOC_SHARES_SUBCOLLECTION, recipientUid));
  if (!snapshot.exists()) {
    if (!recipientEmail?.trim()) {
      return null;
    }

    const emailSnapshot = await getDocs(
      query(
        collection(db, STORAGE_PATH_PREFIX, docId, DOC_SHARES_SUBCOLLECTION),
        where('recipientEmail', '==', recipientEmail.trim().toLowerCase()),
      ),
    );
    const match = emailSnapshot.docs[0];
    return match ? (match.data() as ShareGrantRecord) : null;
  }
  return snapshot.data() as ShareGrantRecord;
}

async function resolveDocumentKey(docMeta: VaultDocument) {
  const keychainEntry = await Keychain.getGenericPassword({
    service: `${DOC_KEY_SERVICE_PREFIX}.${docMeta.id}`,
  });
  if (keychainEntry) {
    const normalized = normalizeDocumentKeyB64(keychainEntry.password);
    if (normalized) {
      return normalized;
    }
  }

  const auth = getAuth(getApp());
  const currentUid = auth.currentUser?.uid;
  const currentEmail = auth.currentUser?.email?.trim().toLowerCase();
  const inlineGrant = findActiveShareGrantForCurrentUser(docMeta) as ShareGrantRecord | null;
  const sharedGrant = (inlineGrant ?? (currentUid ? await getDocShareGrant(docMeta.id, currentUid, currentEmail) : null)) as
    | ShareGrantRecord
    | null;
  if (sharedGrant && currentUid) {
    if (!isShareGrantActive(sharedGrant)) {
      throw new Error('Your shared access has expired or was revoked.');
    }

    return unwrapDocumentKeyFromShareEnvelope(currentUid, {
      wrappedKeyCipher: sharedGrant.wrappedKeyCipher,
      keyWrapAlgorithm: sharedGrant.keyWrapAlgorithm ?? 'RSA-OAEP-SHA256',
    });
  }

  if (!docMeta.encryptedDocKey) {
    throw new Error('Missing encrypted key metadata for this document.');
  }

  const algorithm = docMeta.encryptedDocKey.algorithm ?? 'AES-256-CBC';
  const iterations = docMeta.encryptedDocKey.iterations ?? 100000;

  if (docMeta.encryptedDocKey.wrapMode !== 'recovery') {
    try {
      const {passphrase} = await getOrCreateKdfMaterial();
      return await unwrapDocumentKey(
        docMeta.encryptedDocKey.cipher,
        docMeta.encryptedDocKey.iv,
        passphrase,
        docMeta.encryptedDocKey.salt,
        algorithm,
        iterations,
        docMeta.encryptedDocKey.authTag,
      );
    } catch (err) {
      if (err instanceof MissingKdfPassphraseError) {
        throw err;
      }
      // Fallback to recovery passphrase for cross-device restore.
    }
  }

  const recoveryPassphrase = await getRecoveryPassphrase();
  if (!recoveryPassphrase) {
    throw new Error('Missing recovery passphrase. Restore keys from backup on this device first.');
  }

  const unwrapped = await unwrapDocumentKey(
    docMeta.encryptedDocKey.cipher,
    docMeta.encryptedDocKey.iv,
    recoveryPassphrase,
    docMeta.encryptedDocKey.salt,
    algorithm,
    iterations,
    docMeta.encryptedDocKey.authTag,
  );
  const normalized = normalizeDocumentKeyB64(unwrapped);
  if (!normalized) {
    throw new Error('Recovered key has invalid format. Re-run key recovery with a valid backup passphrase.');
  }
  return normalized;
}

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

async function saveEncryptedPayloadLocal(docId: string, payload: string, fileName: string) {
  const vaultDir = `${RNFS.DocumentDirectoryPath}/vault`;
  const docDir = `${vaultDir}/${docId}`;
  await RNFS.mkdir(docDir);
  const localPath = `${docDir}/${fileName}.enc.json`;
  await RNFS.writeFile(localPath, payload, 'utf8');
  return localPath;
}

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

export function getLocalReference(docMeta: VaultDocument, fileOrder = 0) {
  return sortReferencesByOrder(docMeta.references).find(
    item => item.source === 'local' && item.localPath && (item.order ?? 0) === fileOrder,
  );
}

export function getFirebaseReference(docMeta: VaultDocument, fileOrder = 0) {
  return sortReferencesByOrder(docMeta.references).find(
    item => item.source === 'firebase' && item.storagePath && (item.order ?? 0) === fileOrder,
  );
}

export function hasLocalEncryptedCopy(docMeta: VaultDocument) {
  return Boolean(getLocalReference(docMeta));
}

export async function saveDocumentOffline(docMeta: VaultDocument): Promise<VaultDocument> {
  const firebaseReferences = sortReferencesByOrder(docMeta.references).filter(
    item => item.source === 'firebase' && item.storagePath,
  );
  if (firebaseReferences.length === 0) {
    throw new Error('No document payload found to save offline.');
  }

  const existingLocalOrders = new Set(
    (docMeta.references ?? []).filter(item => item.source === 'local').map((item, index) => item.order ?? index),
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
    await setDoc(doc(db, STORAGE_PATH_PREFIX, docMeta.id), {offlineAvailable: true}, {merge: true});
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
    await Promise.allSettled(uploadedStoragePaths.map(path => deleteObject(storageRef(storageInstance, path))));
    throw error;
  }
}

/**
 * Updates the editable metadata fields (name, description) of a document.
 *
 * Applies the same normalization rules used during upload so values stay
 * consistent across the app. Only writes to Firestore when the current user
 * is the owner and the document has a cloud copy; otherwise the change is
 * applied locally only.
 *
 * @param docMeta - The document whose metadata should be updated.
 * @param updates - Partial set of editable fields to apply.
 * @returns The updated document with normalized fields applied.
 */
export async function updateDocumentMetadata(
  docMeta: VaultDocument,
  updates: { name?: string; description?: string },
): Promise<VaultDocument> {
  const nextName = normalizeDocumentName(updates.name ?? docMeta.name);
  const nextDescription = normalizeDescription(updates.description ?? docMeta.description);

  const hasFirebaseRef = (docMeta.references ?? []).some(item => item.source === 'firebase');
  const currentUid = getAuth(getApp()).currentUser?.uid;
  const isOwner = Boolean(docMeta.owner) && docMeta.owner === currentUid;

  if (isOwner && hasFirebaseRef) {
    const app = getApp();
    const db = getFirestore(app);
    await setDoc(
      doc(db, STORAGE_PATH_PREFIX, docMeta.id),
      {
        name: nextName,
        description: nextDescription,
        updatedAt: new Date().toISOString(),
      },
      {merge: true},
    );
  }

  return {
    ...docMeta,
    name: nextName,
    description: nextDescription,
  };
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

  const currentUid = getAuth(getApp()).currentUser?.uid;
  if (docMeta.owner && docMeta.owner === currentUid && hasFirebaseRef) {
    const app = getApp();
    const db = getFirestore(app);
    await setDoc(doc(db, STORAGE_PATH_PREFIX, docMeta.id), {offlineAvailable: false}, {merge: true});
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

  try {
    const sharedUsersSnapshot = await getDocs(collection(db, STORAGE_PATH_PREFIX, docMeta.id, DOC_SHARES_SUBCOLLECTION));
    await Promise.allSettled(
      sharedUsersSnapshot.docs.map((sharedUserDoc: { ref: any }) =>
        deleteDoc(sharedUserDoc.ref),
      ),
    );
  } catch {
    // Subcollection cleanup is best-effort; Firestore cascades deletion server-side.
  }

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
 * @param docMeta - The document metadata including references to encrypted payload.
 * @param fileOrder
 * @returns Decrypted file data, MIME type, and original file name.
 */
export async function decryptDocumentPayload(docMeta: VaultDocument, fileOrder = 0) {
  const localReference = getLocalReference(docMeta, fileOrder);
  const remoteReference = getFirebaseReference(docMeta, fileOrder);
  const reference =
    localReference ??
    remoteReference ??
    sortReferencesByOrder(docMeta.references).find(item => (item.order ?? 0) === fileOrder) ??
    sortReferencesByOrder(docMeta.references)[0];

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
  const key = await resolveDocumentKey(docMeta);
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
 * @param docMeta - The document metadata including references to encrypted payload.
 * @param fileOrder
 * @returns The file path where the document was saved on the device.
 */
export async function exportDocumentToDevice(docMeta: VaultDocument, fileOrder = 0) {
  const decrypted = await decryptDocumentPayload(docMeta, fileOrder);
  const targetDir = Platform.OS === 'android' ? RNFS.DownloadDirectoryPath : RNFS.DocumentDirectoryPath;
  const outputPath = `${targetDir}/${Date.now()}-${decrypted.fileName}`;
  await RNFS.writeFile(outputPath, decrypted.base64, 'base64');
  return outputPath;
}
