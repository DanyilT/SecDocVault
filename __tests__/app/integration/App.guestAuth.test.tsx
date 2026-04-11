import React from 'react';
import ReactTestRenderer, { act } from 'react-test-renderer';
import { Alert } from 'react-native';

import App from '../../../App';

function MockFragmentProvider({children}: {children: React.ReactNode}) {
  const ReactLocal = require('react');
  return ReactLocal.createElement(ReactLocal.Fragment, null, children);
}

function MockAction(_props: {testID: string; onPress: () => void; children?: React.ReactNode}) {
  return null;
}

function MockIntroHeroScreen({onGuest}: {onGuest: () => void}) {
  const ReactLocal = require('react');
  return ReactLocal.createElement(MockAction, {testID: 'go-guest', onPress: onGuest});
}

function MockAuthScreen({setAuthMode, setPassword, setConfirmPassword, handleAuth}: any) {
  const ReactLocal = require('react');
  return ReactLocal.createElement(
    ReactLocal.Fragment,
    null,
    ReactLocal.createElement(
      MockAction,
      {
        testID: 'set-guest-register',
        onPress: () => {
          setAuthMode('register');
        },
      },
    ),
    ReactLocal.createElement(
      MockAction,
      {
        testID: 'set-guest-password',
        onPress: () => {
          setPassword('guest123');
          setConfirmPassword('guest123');
        },
      },
    ),
    ReactLocal.createElement(
      MockAction,
      {testID: 'submit-auth', onPress: handleAuth},
    ),
  );
}

function MockEmptyScreen() {
  return null;
}

jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem: jest.fn(async () => null),
  setItem: jest.fn(async () => undefined),
  removeItem: jest.fn(async () => undefined),
}));

jest.mock('@react-native-clipboard/clipboard', () => ({
  setString: jest.fn(),
}));

jest.mock('react-native-safe-area-context', () => ({
  __esModule: true,
  SafeAreaProvider: MockFragmentProvider,
  SafeAreaView: MockFragmentProvider,
}));

jest.mock('../../../src/firebase/project', () => ({
  FIREBASE_PROJECT_ID: 'test-project',
}));

jest.mock('../../../src/storage/localVault', () => ({
  getIncomingShareDecisionStore: jest.fn(async () => ({})),
  getLocalDocuments: jest.fn(async () => []),
  getVaultPreferences: jest.fn(async () => ({
    saveOfflineByDefault: false,
    autoSyncKeys: false,
    keyBackupEnabled: false,
    recoverableByDefault: false,
  })),
  saveLocalDocuments: jest.fn(async () => undefined),
  saveIncomingShareDecisionStore: jest.fn(async () => undefined),
  saveVaultPreferences: jest.fn(async () => undefined),
}));

jest.mock('../../../src/services/documentUpload', () => ({
  canCurrentUserExportDocument: jest.fn(() => true),
  createDocumentShareGrant: jest.fn(async (doc: unknown) => doc),
  deleteDocumentFromFirebase: jest.fn(async () => undefined),
  decryptDocumentPayload: jest.fn(async () => ({
    mimeType: 'image/png',
    base64: 'ZmFrZQ==',
    fileOrder: 0,
    fileName: 'mock.png',
  })),
  documentSaveLocal: jest.fn(async () => ({document: {id: '1', references: []}})),
  ensureCurrentUserSharePublicKey: jest.fn(async () => undefined),
  enforceExpiredShareRevocations: jest.fn(async (doc: unknown) => doc),
  exportDocumentToDevice: jest.fn(async () => '/tmp/mock.png'),
  MAX_FILES_PER_DOCUMENT: 10,
  listVaultDocumentsFromFirebase: jest.fn(async () => []),
  listVaultDocumentsSharedWithUser: jest.fn(async () => []),
  removeFirebaseReferences: jest.fn(() => null),
  removeLocalDocumentCopy: jest.fn(async (doc: any) => ({...doc, references: []})),
  revokeDocumentShareGrant: jest.fn(async (doc: unknown) => doc),
  saveDocumentOffline: jest.fn(async (doc: unknown) => doc),
  updateDocumentRecoveryPreference: jest.fn(async (doc: unknown) => doc),
  pickDocumentForUpload: jest.fn(async () => {
    throw new Error('mock');
  }),
  scanDocumentForUpload: jest.fn(async () => {
    throw new Error('mock');
  }),
  uploadDocumentToFirebase: jest.fn(async () => ({document: {id: '1', references: []}})),
}));

jest.mock('../../../src/services/keyBackup', () => ({
  autoSyncKeysIfEnabled: jest.fn(async () => false),
  backupKeysToFirebase: jest.fn(async () => ({passphrase: 'p', backedUpCount: 0})),
  downloadKeyBackupFile: jest.fn(async () => '/tmp/backup.json'),
  downloadPassphraseFile: jest.fn(async () => '/tmp/passphrase.txt'),
  ensureRecoveryPassphrase: jest.fn(async () => 'passphrase'),
  getRecoveryPassphraseForSettings: jest.fn(async () => null),
  generateRecoveryPassphrase: jest.fn(() => 'passphrase'),
  resetRecoveryPassphraseForSettings: jest.fn(async () => 'passphrase'),
  restoreKeysFromFirebase: jest.fn(async () => 0),
  setAutoKeySyncEnabled: jest.fn(async () => undefined),
}));

const mockAuth = {
  user: null,
  isAuthenticated: false,
  isGuest: false,
  isInitializing: false,
  isSubmitting: false,
  hasSavedPasskey: false,
  pinBiometricEnabled: false,
  preferredProtection: 'passkey' as const,
  authError: null as string | null,
  signIn: jest.fn(async () => true),
  signUp: jest.fn(async () => true),
  resendVerificationEmail: jest.fn(async () => true),
  completeEmailLinkRegistration: jest.fn(async () => true),
  sendPasswordResetEmail: jest.fn(async () => true),
  requestEmailChange: jest.fn(async () => true),
  deleteAccountAndData: jest.fn(async () => true),
  hasGuestAccount: jest.fn(async () => true),
  registerGuestAccount: jest.fn(async () => true),
  loginGuestAccount: jest.fn(async () => true),
  changeGuestPassword: jest.fn(async () => true),
  continueAsGuest: jest.fn(async () => true),
  unlockWithSavedPasskey: jest.fn(async () => true),
  unlockWithPin: jest.fn(async () => true),
  unlockWithBiometric: jest.fn(async () => true),
  updateUnlockMethod: jest.fn(async () => true),
  signOut: jest.fn(async () => undefined),
  clearError: jest.fn(),
};

function mockUseAuth() {
  return mockAuth;
}

jest.mock('../../../src/context/AuthContext', () => ({
  __esModule: true,
  AuthProvider: MockFragmentProvider,
  useAuth: mockUseAuth,
}));

jest.mock('../../../src/screens', () => {
  return {
    __esModule: true,
    IntroHeroScreen: MockIntroHeroScreen,
    AuthScreen: MockAuthScreen,
    UnlockScreen: MockEmptyScreen,
    CompleteAuthScreen: MockEmptyScreen,
    BackupScreen: MockEmptyScreen,
    KeyBackupScreen: MockEmptyScreen,
    MainScreen: MockEmptyScreen,
    PreviewScreen: MockEmptyScreen,
    SettingsScreen: MockEmptyScreen,
    ShareScreen: MockEmptyScreen,
    UploadConfirmScreen: MockEmptyScreen,
  };
});

describe('guest register overwrite confirmation', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  const renderAndOpenGuestAuth = async () => {
    let renderer: ReactTestRenderer.ReactTestRenderer;
    await act(async () => {
      renderer = ReactTestRenderer.create(<App />);
    });

    const instance = renderer!;
    await act(async () => {
      instance.root.findByProps({testID: 'go-guest'}).props.onPress();
    });

    await act(async () => {
      instance.root.findByProps({testID: 'set-guest-register'}).props.onPress();
      instance.root.findByProps({testID: 'set-guest-password'}).props.onPress();
    });

    return instance;
  };

  test('confirms overwrite and calls guest register with overwrite=true', async () => {
    const alertSpy = jest.spyOn(Alert, 'alert').mockImplementation(() => undefined);
    const renderer = await renderAndOpenGuestAuth();

    await act(async () => {
      renderer.root.findByProps({testID: 'submit-auth'}).props.onPress();
    });

    expect(alertSpy).toHaveBeenCalled();
    const buttons = alertSpy.mock.calls[0][2] ?? [];
    const confirmButton = buttons.find(button => button.text === 'Erase & Create New');

    expect(confirmButton).toBeDefined();

    await act(async () => {
      confirmButton?.onPress?.();
    });

    expect(mockAuth.registerGuestAccount).toHaveBeenCalledWith('guest123', true);

    alertSpy.mockRestore();
  });

  test('cancels overwrite and does not call guest register', async () => {
    const alertSpy = jest.spyOn(Alert, 'alert').mockImplementation(() => undefined);
    const renderer = await renderAndOpenGuestAuth();

    await act(async () => {
      renderer.root.findByProps({testID: 'submit-auth'}).props.onPress();
    });

    const buttons = alertSpy.mock.calls[0][2] ?? [];
    const cancelButton = buttons.find(button => button.text === 'Cancel');

    await act(async () => {
      cancelButton?.onPress?.();
    });

    expect(mockAuth.registerGuestAccount).not.toHaveBeenCalled();

    alertSpy.mockRestore();
  });
});
