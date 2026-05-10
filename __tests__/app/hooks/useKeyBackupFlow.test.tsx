import React from 'react';
import { useKeyBackupFlow } from '../../../src/app/hooks/useKeyBackupFlow';
import { create, act } from 'react-test-renderer';
import { generateRecoveryPassphrase, sanitizeRecoveryPassphrase, validateRecoveryPassphrase } from '../../../src/services/crypto/documentCrypto';

jest.mock('../../../src/services/crypto/documentCrypto', () => ({
  generateRecoveryPassphrase: jest.fn(() => 'mock-pass-phrase-generated-123'),
  sanitizeRecoveryPassphrase: jest.fn((v) => v.replace(/\s+/g, '-')),
  validateRecoveryPassphrase: jest.fn((v) => v.split('-').length === 5),
}));

describe('useKeyBackupFlow', () => {
  const defaultParams = {
    isGuest: false,
    userUid: 'user-123',
    documents: [],
    saveOfflineByDefault: false,
    recoverableByDefault: false,
    keyBackupEnabled: false,
    recoveryPassphraseForSettings: null,
    setKeyBackupEnabled: jest.fn(),
    setAutoSyncKeys: jest.fn(),
    setRecoveryPassphraseForSettings: jest.fn(),
    setDocuments: jest.fn(),
    setSelectedDoc: jest.fn(),
    setUploadStatus: jest.fn(),
    setAccountStatus: jest.fn(),
    saveVaultPreferences: jest.fn(),
    setAutoKeySyncEnabled: jest.fn(),
    persistRecoveryPassphraseLocalOnly: jest.fn(),
    ensureRecoveryPassphrase: jest.fn(),
    backupKeysToFirebase: jest.fn(),
    updateDocumentRecoveryPreference: jest.fn(),
    restoreKeysFromFirebase: jest.fn(),
  };

  let hookInstance: any;
  function TestComponent({ params }: { params: any }) {
    hookInstance = useKeyBackupFlow(params);
    return null;
  }

  beforeEach(() => {
    jest.clearAllMocks();
    hookInstance = undefined;
  });

  it('initializes with default states', () => {
    act(() => {
      create(<TestComponent params={defaultParams} />);
    });
    expect(hookInstance.displayPassphrase).toBeNull();
    expect(hookInstance.keyBackupStatus).toBe('');
    expect(hookInstance.customPassphrase).toBe('');
  });

  it('handleGeneratePassphrase generates a new passphrase', () => {
    act(() => {
      create(<TestComponent params={defaultParams} />);
    });
    act(() => {
      hookInstance.handleGeneratePassphrase();
    });
    expect(generateRecoveryPassphrase).toHaveBeenCalled();
    expect(hookInstance.customPassphrase).toBe('mock-pass-phrase-generated-123');
    expect(hookInstance.keyBackupStatus).toBe('Random passphrase generated.');
  });

  it('handlePassphraseChange sanitizes and validates input', () => {
    act(() => {
      create(<TestComponent params={defaultParams} />);
    });
    act(() => {
      hookInstance.handlePassphraseChange('apple banana cherry date elderberry');
    });
    expect(sanitizeRecoveryPassphrase).toHaveBeenCalledWith('apple banana cherry date elderberry');
    expect(hookInstance.customPassphrase).toBe('apple-banana-cherry-date-elderberry');
    expect(hookInstance.passphraseValidationError).toBe('');
  });

  it('handlePassphraseChange sets error if invalid', () => {
    (validateRecoveryPassphrase as jest.Mock).mockReturnValueOnce(false);
    act(() => {
      create(<TestComponent params={defaultParams} />);
    });
    act(() => {
      hookInstance.handlePassphraseChange('short');
    });
    expect(hookInstance.passphraseValidationError).toBe('Passphrase can only contain lowercase letters, numbers, and hyphens.');
  });

  it('handleSetKeyBackupEnabled updates preferences when disabling', async () => {
    act(() => {
      create(<TestComponent params={defaultParams} />);
    });
    await act(async () => {
      await hookInstance.handleSetKeyBackupEnabled(false);
    });
    expect(defaultParams.setKeyBackupEnabled).toHaveBeenCalledWith(false);
    expect(defaultParams.saveVaultPreferences).toHaveBeenCalledWith(expect.objectContaining({
      keyBackupEnabled: false,
    }));
  });

  it('handleBackupKeys handles guest mode', async () => {
    act(() => {
      create(<TestComponent params={{ ...defaultParams, isGuest: true }} />);
    });
    await act(async () => {
      await hookInstance.handleBackupKeys();
    });
    expect(hookInstance.keyBackupStatus).toBe('Key backup is not available in guest mode.');
  });

  it('handleBackupKeys handles no recoverable documents', async () => {
    act(() => {
      create(<TestComponent params={defaultParams} />);
    });
    await act(async () => {
      await hookInstance.handleBackupKeys();
    });
    expect(hookInstance.keyBackupStatus).toBe('No recoverable documents found. Enable recovery per document during upload.');
  });

  it('handleBackupKeys successfully backs up keys', async () => {
    const params = {
      ...defaultParams,
      documents: [{ id: 'doc-1', name: 'Doc 1', recoverable: true }],
      ensureRecoveryPassphrase: jest.fn().mockResolvedValue('valid-passphrase'),
      backupKeysToFirebase: jest.fn().mockResolvedValue({ backedUpCount: 1 }),
    };
    act(() => {
      create(<TestComponent params={params} />);
    });
    await act(async () => {
      await hookInstance.handleBackupKeys();
    });
    expect(params.backupKeysToFirebase).toHaveBeenCalled();
    expect(hookInstance.keyBackupStatus).toContain('Key backup created successfully');
  });

  it('handleRestoreKeys restores keys successfully', async () => {
    const params = {
      ...defaultParams,
      restoreKeysFromFirebase: jest.fn().mockResolvedValue(5),
    };
    act(() => {
      create(<TestComponent params={params} />);
    });
    await act(async () => {
      await hookInstance.handleRestoreKeys('some-passphrase');
    });
    expect(params.restoreKeysFromFirebase).toHaveBeenCalledWith('user-123', 'some-passphrase');
    expect(hookInstance.keyBackupStatus).toBe('Restore complete: 5 keys restored to this device.');
  });

  it('handleToggleDocumentRecovery updates doc preference', async () => {
    const doc = { id: 'doc-1', name: 'Doc 1', recoverable: false };
    const params = {
      ...defaultParams,
      keyBackupEnabled: true,
      updateDocumentRecoveryPreference: jest.fn().mockResolvedValue({ ...doc, recoverable: true }),
    };
    act(() => {
      create(<TestComponent params={params} />);
    });
    await act(async () => {
      await hookInstance.handleToggleDocumentRecovery(doc as any, true);
    });
    expect(params.updateDocumentRecoveryPreference).toHaveBeenCalledWith(doc, true);
    expect(params.setUploadStatus).toHaveBeenCalledWith('Doc 1 added to key backup.');
  });
});
