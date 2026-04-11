import AsyncStorage from '@react-native-async-storage/async-storage';
import { getApp } from '@react-native-firebase/app';
import {
  doc,
  deleteDoc,
  getDoc,
  getFirestore,
  setDoc,
} from '@react-native-firebase/firestore/lib/modular';
import { serverTimestamp } from '@react-native-firebase/firestore/lib/modular/FieldValue';
import * as Keychain from 'react-native-keychain';
import RNFS from 'react-native-fs';
import { Platform } from 'react-native';

import {
  getRecoveryPassphrase,
  getOrCreateKdfMaterial,
  randomWordArray,
  setRecoveryPassphrase,
  toBase64,
  unwrapDocumentKey,
  wrapDocumentKey,
} from './crypto/documentCrypto.ts';
import { VaultDocument, VaultEncryptedKeyEnvelope } from '../types/vault';
import { normalizeDocumentKeyB64 } from './documentVault/formatters.ts';

const KEY_BACKUP_COLLECTION = 'vaultKeyBackups';
const DOC_KEY_SERVICE_PREFIX = 'secdocvault.docKey';
const AUTO_SYNC_KEYS_ENABLED = 'secdocvault.keys.autoSync.enabled';
const AUTO_SYNC_KEYS_PASSPHRASE = 'secdocvault.keys.autoSync.passphrase';

type SerializedBackupEntry = {
  docId: string;
  name: string;
  wrappedKey: VaultEncryptedKeyEnvelope;
  uploadedAt: string;
};

type SerializedKeyBackup = {
  owner: string;
  recoverySalt: string;
  keyCount: number;
  items: SerializedBackupEntry[];
  createdAtIso: string;
};

export type KeyBackupResult = {
  backupId: string;
  passphrase: string;
  backedUpCount: number;
};

export function generateRecoveryPassphrase(): string {
  const cryptoApi = (globalThis as { crypto?: { getRandomValues: (arr: Uint8Array) => Uint8Array } }).crypto;
  if (!cryptoApi?.getRandomValues) {
    throw new Error('Secure random source is unavailable.');
  }

  const bytes = new Uint8Array(20); // 160 bits of entropy
  cryptoApi.getRandomValues(bytes);
  const hex = Array.from(bytes, value => value.toString(16).padStart(2, '0')).join('');

  return hex.match(/.{1,8}/g)?.join('-') ?? hex;
}

async function resolveDocumentKeyForBackup(docMeta: VaultDocument): Promise<string | null> {
  const direct = await Keychain.getGenericPassword({
    service: `${DOC_KEY_SERVICE_PREFIX}.${docMeta.id}`,
  });

  if (direct) {
    return normalizeDocumentKeyB64(direct.password);
  }

  if (!docMeta.encryptedDocKey) {
    return null;
  }

  try {
    if (docMeta.encryptedDocKey.wrapMode !== 'recovery') {
      const { passphrase } = await getOrCreateKdfMaterial();
      const unwrapped = await unwrapDocumentKey(
        docMeta.encryptedDocKey.cipher,
        docMeta.encryptedDocKey.iv,
        passphrase,
        docMeta.encryptedDocKey.salt,
        docMeta.encryptedDocKey.algorithm,
        docMeta.encryptedDocKey.iterations,
        docMeta.encryptedDocKey.authTag,
      );
      return normalizeDocumentKeyB64(unwrapped);
    }
  } catch {
    // Try recovery-passphrase fallback for recovery-wrapped documents.
  }

  const recoveryPassphrase = await getRecoveryPassphrase();
  if (!recoveryPassphrase) {
    return null;
  }

  const unwrapped = await unwrapDocumentKey(
    docMeta.encryptedDocKey.cipher,
    docMeta.encryptedDocKey.iv,
    recoveryPassphrase,
    docMeta.encryptedDocKey.salt,
    docMeta.encryptedDocKey.algorithm,
    docMeta.encryptedDocKey.iterations,
    docMeta.encryptedDocKey.authTag,
  );
  return normalizeDocumentKeyB64(unwrapped);
}

export async function backupKeysToFirebase(
  ownerId: string,
  documents: VaultDocument[],
  passphrase: string,
): Promise<KeyBackupResult> {
  if (!ownerId) {
    throw new Error('Missing account identifier for key backup.');
  }

  if (!passphrase.trim()) {
    throw new Error('Recovery passphrase is required.');
  }

  await setRecoveryPassphrase(passphrase.trim());

  const recoverySalt = toBase64(randomWordArray(16));
  const items: SerializedBackupEntry[] = [];

  for (const item of documents) {
    if (item.recoverable === false) {
      continue;
    }

    const resolvedKey = await resolveDocumentKeyForBackup(item);
    if (!resolvedKey) {
      continue;
    }

    items.push({
      docId: item.id,
      name: item.name,
      wrappedKey: await wrapDocumentKey(resolvedKey, passphrase, recoverySalt, {wrapMode: 'recovery'}),
      uploadedAt: new Date().toISOString(),
    });
  }

  if (items.length === 0) {
    throw new Error('No document keys found to backup. Open/decrypt docs first if needed.');
  }

  const app = getApp();
  const db = getFirestore(app);
  const backupRef = doc(db, KEY_BACKUP_COLLECTION, ownerId);

  const payload: SerializedKeyBackup = {
    owner: ownerId,
    recoverySalt,
    keyCount: items.length,
    items,
    createdAtIso: new Date().toISOString(),
  };

  await setDoc(backupRef, {
    ...payload,
    updatedAt: serverTimestamp(),
  });

  return {
    backupId: ownerId,
    passphrase,
    backedUpCount: items.length,
  };
}

export async function restoreKeysFromFirebase(ownerId: string, passphrase: string): Promise<number> {
  if (!ownerId) {
    throw new Error('Missing account identifier for key restore.');
  }

  if (!passphrase.trim()) {
    throw new Error('Recovery passphrase is required.');
  }

  await setRecoveryPassphrase(passphrase.trim());

  const app = getApp();
  const db = getFirestore(app);
  const backupRef = doc(db, KEY_BACKUP_COLLECTION, ownerId);
  const snapshot = await getDoc(backupRef);

  if (!snapshot.exists()) {
    throw new Error('No key backup found for this account.');
  }

  const payload = snapshot.data() as SerializedKeyBackup;
  const recoverySalt = payload.recoverySalt;
  const items = Array.isArray(payload.items) ? payload.items : [];

  if (!recoverySalt || items.length === 0) {
    throw new Error('Backup payload is empty or invalid.');
  }

  let restoredCount = 0;
  for (const entry of items) {
    const wrapped = entry.wrappedKey;
    const wrapSalt = wrapped.salt ?? recoverySalt;
    if (!wrapSalt) {
      continue;
    }

    const unwrapped = await unwrapDocumentKey(
      wrapped.cipher,
      wrapped.iv,
      passphrase,
      wrapSalt,
      wrapped.algorithm,
      wrapped.iterations,
      wrapped.authTag,
    );

    const normalizedKey = normalizeDocumentKeyB64(unwrapped);
    if (!normalizedKey) {
      continue;
    }

    await Keychain.setGenericPassword(entry.docId, normalizedKey, {
      service: `${DOC_KEY_SERVICE_PREFIX}.${entry.docId}`,
      accessible: Keychain.ACCESSIBLE.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
    });
    restoredCount += 1;
  }

  if (restoredCount === 0) {
    throw new Error('No keys were restored. Check your recovery passphrase.');
  }

  return restoredCount;
}

export async function setAutoKeySyncEnabled(enabled: boolean): Promise<void> {
  await AsyncStorage.setItem(AUTO_SYNC_KEYS_ENABLED, enabled ? '1' : '0');
}

export async function getAutoKeySyncEnabled(): Promise<boolean> {
  const value = await AsyncStorage.getItem(AUTO_SYNC_KEYS_ENABLED);
  return value === '1';
}

export async function getRecoveryPassphraseForSettings(): Promise<string | null> {
  return getRecoveryPassphrase();
}

export async function ensureRecoveryPassphrase(): Promise<string> {
  const existing = await getRecoveryPassphrase();
  if (existing) {
    return existing;
  }

  const generated = generateRecoveryPassphrase();
  await setRecoveryPassphrase(generated);
  return generated;
}

export async function resetRecoveryPassphraseForSettings(): Promise<string> {
  const generated = generateRecoveryPassphrase();
  await setRecoveryPassphrase(generated);
  return generated;
}

async function getOrCreateAutoSyncPassphrase(): Promise<string> {
  const existing = await Keychain.getGenericPassword({ service: AUTO_SYNC_KEYS_PASSPHRASE });
  if (existing) {
    return existing.password;
  }

  const generated = generateRecoveryPassphrase();
  await Keychain.setGenericPassword('autosync', generated, {
    service: AUTO_SYNC_KEYS_PASSPHRASE,
    accessible: Keychain.ACCESSIBLE.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
  });

  return generated;
}

export async function autoSyncKeysIfEnabled(ownerId: string, documents: VaultDocument[]): Promise<boolean> {
  const enabled = await getAutoKeySyncEnabled();
  if (!enabled || !ownerId || documents.length === 0) {
    return false;
  }

  const autoSyncPassphrase = await getOrCreateAutoSyncPassphrase();
  await backupKeysToFirebase(ownerId, documents, autoSyncPassphrase);
  return true;
}

export async function downloadPassphraseFile(passphrase: string, backupId: string): Promise<string> {
  const safeBackupId = backupId.replace(/[^a-zA-Z0-9-_]/g, '_');
  const outputDir = Platform.OS === 'android' ? RNFS.DownloadDirectoryPath : RNFS.DocumentDirectoryPath;
  const outputPath = `${outputDir}/secdocvault-passphrase-${safeBackupId}.txt`;
  const content = [
    'SecDocVault Recovery Passphrase',
    `Backup ID: ${backupId}`,
    `Generated: ${new Date().toISOString()}`,
    '',
    passphrase,
    '',
    'Store this passphrase securely. Anyone with this passphrase can restore your document keys.',
  ].join('\n');

  await RNFS.writeFile(outputPath, content, 'utf8');
  return outputPath;
}

export async function downloadKeyBackupFile(ownerId: string, _passphrase?: string): Promise<string> {
  const app = getApp();
  const db = getFirestore(app);
  const backupRef = doc(db, KEY_BACKUP_COLLECTION, ownerId);
  const snapshot = await getDoc(backupRef);

  if (!snapshot.exists()) {
    throw new Error('No key backup found to download.');
  }

  const data = snapshot.data();
  const outputDir = Platform.OS === 'android' ? RNFS.DownloadDirectoryPath : RNFS.DocumentDirectoryPath;
  const outputPath = `${outputDir}/secdocvault-keys-backup-${ownerId}.json`;
  await RNFS.writeFile(outputPath, JSON.stringify(data, null, 2), 'utf8');
  return outputPath;
}

export async function deleteKeyBackupFromFirebase(ownerId: string): Promise<void> {
  const app = getApp();
  const db = getFirestore(app);
  await deleteDoc(doc(db, KEY_BACKUP_COLLECTION, ownerId));
}

export async function clearKeyBackupData(): Promise<void> {
  await Promise.allSettled([
    AsyncStorage.removeItem(AUTO_SYNC_KEYS_ENABLED),
    Keychain.resetGenericPassword({service: AUTO_SYNC_KEYS_PASSPHRASE}),
  ]);
}
