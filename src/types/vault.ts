/**
 * types/vault.ts
 *
 * Central TypeScript types used across the application representing vault
 * documents, reference records and encryption envelopes. Exported types are
 * intentionally minimal and used by both UI and service layers.
 */

export type AuthMode = 'login' | 'register';

export type AuthSessionMode = 'cloud' | 'guest';

export type AuthProtection = 'passkey' | 'pin' | 'none' | 'biometric';

export type VaultEncryptedKeyEnvelope = {
  cipher: string;
  iv: string;
  authTag?: string;
  salt: string;
  iterations: number;
  algorithm: string;
  kdf: string;
  wrapMode?: 'device' | 'recovery';
};

export type VaultSharedKeyGrant = {
  recipientUid: string;
  recipientEmail?: string;
  recipientPublicKey?: string;
  allowExport: boolean;
  wrappedKeyCipher: string;
  keyWrapAlgorithm: string;
  wrappedKeyIv?: string;
  senderEphemeralPublicKey?: string;
  createdAt: string;
  expiresAt: string | Date;
  revokedAt?: string | null;
};

export type VaultDocumentReference = {
  name: string;
  size: number;
  type: string;
  /** AES-GCM auth tag for encrypted payload integrity verification. */
  fileHash?: string;
  /** Preferred field name for AES-GCM integrity tag (base64). */
  integrityTag?: string;
  /** Zero-based display order for files within a single document. */
  order?: number;
  source: 'firebase' | 'local';
  storagePath?: string;
  localPath?: string;
};

export type VaultDocument = {
  id: string;
  name: string;
  description?: string;
  hash: string;
  size: string;
  uploadedAt: string;
  owner?: string;
  sharedWith?: string[];
  sharedKeyGrants?: VaultSharedKeyGrant[];
  references?: VaultDocumentReference[];
  encryptedDocKey?: VaultEncryptedKeyEnvelope;
  saveMode?: 'firebase' | 'local';
  offlineAvailable?: boolean;
  recoverable?: boolean;
  keyBackupSyncedAt?: string;
};
