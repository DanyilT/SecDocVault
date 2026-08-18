/**
 * __tests__/app/hooks/index.test.ts
 *
 * Unit tests for hooks barrel exports.
 */

describe('hooks barrel exports', () => {
  it('should export useAppConfig', () => {
    const exports = require('../../../src/app/hooks/index');
    expect(exports.useAppConfig).toBeDefined();
  });

  it('should export useAppRouting', () => {
    const exports = require('../../../src/app/hooks/index');
    expect(exports.useAppRouting).toBeDefined();
  });

  it('should export useAuthGateFlow', () => {
    const exports = require('../../../src/app/hooks/index');
    expect(exports.useAuthGateFlow).toBeDefined();
  });

  it('should export useAuthLinkingFlow', () => {
    const exports = require('../../../src/app/hooks/index');
    expect(exports.useAuthLinkingFlow).toBeDefined();
  });

  it('should export useDocumentActionsFlow', () => {
    const exports = require('../../../src/app/hooks/index');
    expect(exports.useDocumentActionsFlow).toBeDefined();
  });

  it('should export useDocumentVault', () => {
    const exports = require('../../../src/app/hooks/index');
    expect(exports.useDocumentVault).toBeDefined();
  });

  it('should export useEditMetadataFlow', () => {
    const exports = require('../../../src/app/hooks/index');
    expect(exports.useEditMetadataFlow).toBeDefined();
  });

  it('should export useKeyBackupFlow', () => {
    const exports = require('../../../src/app/hooks/index');
    expect(exports.useKeyBackupFlow).toBeDefined();
  });

  it('should export usePreviewFlow', () => {
    const exports = require('../../../src/app/hooks/index');
    expect(exports.usePreviewFlow).toBeDefined();
  });

  it('should export useShareFlow', () => {
    const exports = require('../../../src/app/hooks/index');
    expect(exports.useShareFlow).toBeDefined();
  });

  it('should export useUploadFlow', () => {
    const exports = require('../../../src/app/hooks/index');
    expect(exports.useUploadFlow).toBeDefined();
  });

  it('should have all required exports', () => {
    const exports = require('../../../src/app/hooks/index');

    const requiredExports = [
      'useAppConfig',
      'useAppRouting',
      'useAuthGateFlow',
      'useAuthLinkingFlow',
      'useDocumentActionsFlow',
      'useDocumentVault',
      'useEditMetadataFlow',
      'useKeyBackupFlow',
      'usePreviewFlow',
      'useShareFlow',
      'useUploadFlow',
    ];

    requiredExports.forEach(exportName => {
      expect(exports).toHaveProperty(exportName);
    });
  });

  it('should have correct number of exports', () => {
    const exports = require('../../../src/app/hooks/index');
    const exportNames = Object.keys(exports);

    // Should have 11 hooks exported
    expect(exportNames.length).toBe(11);
  });

  it('should not have duplicate exports', () => {
    const exports = require('../../../src/app/hooks/index');
    const exportNames = Object.keys(exports);
    const uniqueExports = new Set(exportNames);

    expect(exportNames.length).toBe(uniqueExports.size);
  });

  it('all exports should be functions', () => {
    const exports = require('../../../src/app/hooks/index');

    Object.values(exports).forEach(exported => {
      expect(typeof exported).toBe('function');
    });
  });
});


