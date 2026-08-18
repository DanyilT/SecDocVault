/**
 * __tests__/app/services/documentVault/index.test.ts
 */
describe('documentVault service barrel exports', () => {
  it('should export toPseudoHash formatter', () => {
    const exports = require('../../../../src/services/documentVault/index');
    expect(exports.toPseudoHash).toBeDefined();
  });
  it('should export toSizeLabel formatter', () => {
    const exports = require('../../../../src/services/documentVault/index');
    expect(exports.toSizeLabel).toBeDefined();
  });
  it('should export MAX_FILES_PER_DOCUMENT constant', () => {
    const exports = require('../../../../src/services/documentVault/index');
    expect(exports.MAX_FILES_PER_DOCUMENT).toBeDefined();
  });
  it('should export MAX_UPLOAD_FILE_BYTES constant', () => {
    const exports = require('../../../../src/services/documentVault/index');
    expect(exports.MAX_UPLOAD_FILE_BYTES).toBeDefined();
  });
  describe('upload exports', () => {
    it('should export documentSaveLocal', () => {
      expect(require('../../../../src/services/documentVault/index').documentSaveLocal).toBeDefined();
    });
    it('should export pickDocumentForUpload', () => {
      expect(require('../../../../src/services/documentVault/index').pickDocumentForUpload).toBeDefined();
    });
    it('should export pickFileForUpload', () => {
      expect(require('../../../../src/services/documentVault/index').pickFileForUpload).toBeDefined();
    });
    it('should export scanDocumentForUpload', () => {
      expect(require('../../../../src/services/documentVault/index').scanDocumentForUpload).toBeDefined();
    });
    it('should export uploadDocumentToFirebase', () => {
      expect(require('../../../../src/services/documentVault/index').uploadDocumentToFirebase).toBeDefined();
    });
  });
  describe('sharing exports', () => {
    it('should export canCurrentUserExportDocument', () => {
      expect(require('../../../../src/services/documentVault/index').canCurrentUserExportDocument).toBeDefined();
    });
    it('should export clearDocumentKeychainEntries', () => {
      expect(require('../../../../src/services/documentVault/index').clearDocumentKeychainEntries).toBeDefined();
    });
    it('should export createDocumentShareGrant', () => {
      expect(require('../../../../src/services/documentVault/index').createDocumentShareGrant).toBeDefined();
    });
    it('should export deleteUserShareProfile', () => {
      expect(require('../../../../src/services/documentVault/index').deleteUserShareProfile).toBeDefined();
    });
    it('should export enforceExpiredShareRevocations', () => {
      expect(require('../../../../src/services/documentVault/index').enforceExpiredShareRevocations).toBeDefined();
    });
    it('should export ensureCurrentUserSharePublicKey', () => {
      expect(require('../../../../src/services/documentVault/index').ensureCurrentUserSharePublicKey).toBeDefined();
    });
    it('should export revokeDocumentShareGrant', () => {
      expect(require('../../../../src/services/documentVault/index').revokeDocumentShareGrant).toBeDefined();
    });
  });
  describe('storage exports', () => {
    it('should export decryptDocumentPayload', () => {
      expect(require('../../../../src/services/documentVault/index').decryptDocumentPayload).toBeDefined();
    });
    it('should export deleteDocumentFromFirebase', () => {
      expect(require('../../../../src/services/documentVault/index').deleteDocumentFromFirebase).toBeDefined();
    });
    it('should export exportDocumentToDevice', () => {
      expect(require('../../../../src/services/documentVault/index').exportDocumentToDevice).toBeDefined();
    });
    it('should export getFirebaseReference', () => {
      expect(require('../../../../src/services/documentVault/index').getFirebaseReference).toBeDefined();
    });
    it('should export getLocalReference', () => {
      expect(require('../../../../src/services/documentVault/index').getLocalReference).toBeDefined();
    });
    it('should export hasLocalEncryptedCopy', () => {
      expect(require('../../../../src/services/documentVault/index').hasLocalEncryptedCopy).toBeDefined();
    });
    it('should export removeFirebaseReferences', () => {
      expect(require('../../../../src/services/documentVault/index').removeFirebaseReferences).toBeDefined();
    });
    it('should export removeLocalDocumentCopy', () => {
      expect(require('../../../../src/services/documentVault/index').removeLocalDocumentCopy).toBeDefined();
    });
    it('should export saveDocumentOffline', () => {
      expect(require('../../../../src/services/documentVault/index').saveDocumentOffline).toBeDefined();
    });
    it('should export saveDocumentToFirebase', () => {
      expect(require('../../../../src/services/documentVault/index').saveDocumentToFirebase).toBeDefined();
    });
    it('should export updateDocumentMetadata', () => {
      expect(require('../../../../src/services/documentVault/index').updateDocumentMetadata).toBeDefined();
    });
    it('should export updateDocumentRecoveryPreference', () => {
      expect(require('../../../../src/services/documentVault/index').updateDocumentRecoveryPreference).toBeDefined();
    });
  });
  describe('query exports', () => {
    it('should export getDocumentMetadataFromVault', () => {
      expect(require('../../../../src/services/documentVault/index').getDocumentMetadataFromVault).toBeDefined();
    });
    it('should export listVaultDocumentsFromFirebase', () => {
      expect(require('../../../../src/services/documentVault/index').listVaultDocumentsFromFirebase).toBeDefined();
    });
    it('should export listVaultDocumentsSharedWithUser', () => {
      expect(require('../../../../src/services/documentVault/index').listVaultDocumentsSharedWithUser).toBeDefined();
    });
  });
  it('should have all required runtime exports', () => {
    const exports = require('../../../../src/services/documentVault/index');
    const requiredExports = ['toPseudoHash', 'toSizeLabel', 'MAX_FILES_PER_DOCUMENT', 'MAX_UPLOAD_FILE_BYTES', 'documentSaveLocal', 'pickDocumentForUpload', 'pickFileForUpload', 'scanDocumentForUpload', 'uploadDocumentToFirebase', 'canCurrentUserExportDocument', 'clearDocumentKeychainEntries', 'createDocumentShareGrant', 'deleteUserShareProfile', 'enforceExpiredShareRevocations', 'ensureCurrentUserSharePublicKey', 'revokeDocumentShareGrant', 'decryptDocumentPayload', 'deleteDocumentFromFirebase', 'exportDocumentToDevice', 'getFirebaseReference', 'getLocalReference', 'hasLocalEncryptedCopy', 'removeFirebaseReferences', 'removeLocalDocumentCopy', 'saveDocumentOffline', 'saveDocumentToFirebase', 'updateDocumentMetadata', 'updateDocumentRecoveryPreference', 'getDocumentMetadataFromVault', 'listVaultDocumentsFromFirebase', 'listVaultDocumentsSharedWithUser'];
    requiredExports.forEach(exportName => {
      expect(exports).toHaveProperty(exportName);
    });
  });
});
