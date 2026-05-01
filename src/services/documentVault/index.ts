/**
 * services/documentVault/index.ts
 *
 * Central exports for document vault related utilities. This file re-exports
 * commonly used functions so consumers can import from the `documentVault`
 * module path instead of individual files.
 */

export type { UploadableDocument, UploadableDocumentDraft, UploadProgressEvent } from './types';
export { toPseudoHash, toSizeLabel } from './formatters';

export { MAX_FILES_PER_DOCUMENT } from './upload';

export {
  documentSaveLocal,
  pickDocumentForUpload,
  scanDocumentForUpload,
  uploadDocumentToFirebase,
} from './upload';

export {
  canCurrentUserExportDocument,
  clearDocumentKeychainEntries,
  createDocumentShareGrant,
  deleteUserShareProfile,
  enforceExpiredShareRevocations,
  ensureCurrentUserSharePublicKey,
  revokeDocumentShareGrant,
} from './sharing';

export {
  decryptDocumentPayload,
  deleteDocumentFromFirebase,
  exportDocumentToDevice,
  getFirebaseReference,
  getLocalReference,
  hasLocalEncryptedCopy,
  removeFirebaseReferences,
  removeLocalDocumentCopy,
  saveDocumentOffline,
  saveDocumentToFirebase,
  updateDocumentRecoveryPreference,
} from './storage';

export {
  getDocumentMetadataFromVault,
  listVaultDocumentsFromFirebase,
  listVaultDocumentsSharedWithUser,
} from './query';
