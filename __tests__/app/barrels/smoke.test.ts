describe('barrel smoke imports', () => {
  test('loads app controller barrel', () => {
    const controllerBarrel = require('../../../src/app/controllers');
    expect(typeof controllerBarrel.useAppController).toBe('function');
  });

  test('loads app hooks barrel', () => {
    const hooksBarrel = require('../../../src/app/hooks');
    expect(typeof hooksBarrel.useAuthGateFlow).toBe('function');
    expect(typeof hooksBarrel.useUploadFlow).toBe('function');
  });

  test('loads screens barrel', () => {
    const screensBarrel = require('../../../src/screens');
    expect(typeof screensBarrel.AuthScreen).toBe('function');
    expect(typeof screensBarrel.UploadConfirmScreen).toBe('function');
    expect(typeof screensBarrel.ShareScreen).toBe('function');
  });

  test('loads documentVault service barrel', () => {
    const vaultBarrel = require('../../../src/services/documentVault');
    expect(typeof vaultBarrel.listVaultDocumentsFromFirebase).toBe('function');
    expect(typeof vaultBarrel.saveDocumentToFirebase).toBe('function');
  });

  test('loads censor service barrel', () => {
    const censorBarrel = require('../../../src/services/censor');
    expect(typeof censorBarrel.detectSensitiveSpans).toBe('function');
    expect(typeof censorBarrel.censorImage).toBe('function');
    expect(typeof censorBarrel.recognizeText).toBe('function');
  });
});
