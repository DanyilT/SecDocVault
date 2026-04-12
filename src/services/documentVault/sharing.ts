/**
 * services/documentVault/sharing.ts
 *
 * Helpers for sharing documents: building share payloads and preparing
 * share-specific metadata. These functions are consumed by UI flows that
 * present share dialogs and by server-side API callers.
 *
 * Exports:
 * - Functions to create and validate sharing payloads and transform document
 *   records into a shareable representation.
 */

import { getApp } from '@react-native-firebase/app';
import {
  collection,
  doc,
  getDoc,
  getDocs,
  getFirestore,
  query,
  setDoc,
  where,
} from '@react-native-firebase/firestore';
import {
  getDownloadURL,
  getStorage,
  ref as storageRef,
  uploadString,
} from '@react-native-firebase/storage';
import * as Keychain from 'react-native-keychain';
import RNFS from 'react-native-fs';

import {
  decryptBase64Payload,
  encryptBase64Payload,
  getOrCreateKdfMaterial,
  getOrCreateSharingKeyPair,
  getRecoveryPassphrase,
  randomWordArray,
  toBase64,
  unwrapDocumentKey,
  unwrapDocumentKeyFromShareEnvelope,
  wrapDocumentKey,
  wrapDocumentKeyForRecipient,
} from '../crypto/documentCrypto.ts';
import { getAuth } from '@react-native-firebase/auth';
import { VaultDocument, VaultDocumentReference } from '../../types/vault';
import { normalizeDocumentKeyB64, normalizeReferenceOrder, sortReferencesByOrder } from './formatters';
import {
  computeShareExpiryDate,
  isShareGrantActive,
  normalizeSharedKeyGrants,
  ShareGrantRecord,
} from './shareGrants';

const STORAGE_PATH_PREFIX = 'vault';
const USERS_COLLECTION_PATH = 'vaultUsers';
const DOC_SHARES_SUBCOLLECTION = 'sharedUsers';
const DEFAULT_SHARE_EXPIRY_DAYS = 30;
/** Keychain service to store doc's key `${prefix}.${docId}` */
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
  const sharedGrant = (inlineGrant ?? (currentUid ? await getDocShareGrant(doc.id, currentUid) : null)) as
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
    { merge: true },
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
  const snapshot = await getDocs(query(collection(db, USERS_COLLECTION_PATH), where('emailLower', '==', normalizedEmail)));
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
    expiresAt: computeShareExpiryDate(expiresInDays).toISOString(),
  };

  const app = getApp();
  const db = getFirestore(app);
  await setDoc(doc(db, STORAGE_PATH_PREFIX, docMeta.id, DOC_SHARES_SUBCOLLECTION, recipientProfile.uid), nextGrant, {
    merge: true,
  });
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
