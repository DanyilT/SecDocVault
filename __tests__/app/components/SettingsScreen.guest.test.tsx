import React from 'react';
import ReactTestRenderer, { act } from 'react-test-renderer';

jest.mock('../../../src/services/documentVault', () => ({}));
jest.mock('../../../src/services/keyBackup', () => ({}));

import { SettingsScreen } from '../../../src/screens';

const baseProps = {
  accountLabel: 'Guest session',
  sessionMode: 'guest' as const,
  isGuest: true,
  authError: null as string | null,
  preferredProtection: 'passkey' as const,
  pinBiometricEnabled: false,
  hasSavedPasskey: false,
  isSubmitting: false,
  accountStatus: '',
  pendingNewEmail: '',
  saveOfflineByDefault: false,
  recoverableByDefault: false,
  keyBackupEnabled: false,
  backedUpDocs: [],
  notBackedUpDocs: [],
  onSetSaveOfflineByDefault: jest.fn(),
  onSetRecoverableByDefault: jest.fn(),
  onSetKeyBackupEnabled: jest.fn(),
  onResetBackupPassphrase: jest.fn(async () => undefined),
  onToggleDocBackup: jest.fn(async () => undefined),
  onOpenRecoverKeys: jest.fn(),
  onOpenDocumentRecovery: jest.fn(),
  onUpdateUnlockMethod: jest.fn(async () => undefined),
  onChangeGuestPassword: jest.fn(async () => true),
  onResetPassword: jest.fn(async () => undefined),
  onSetPendingNewEmail: jest.fn(),
  onRequestEmailChange: jest.fn(async () => undefined),
  onDeleteAccountAndData: jest.fn(),
  onUpgradeToCloud: jest.fn(),
};

describe('SettingsScreen guest branch', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('shows guest password change fields and hides cloud reset flow', () => {
    let renderer: ReactTestRenderer.ReactTestRenderer;
    act(() => {
      renderer = ReactTestRenderer.create(<SettingsScreen {...baseProps} />);
    });

    expect(renderer!.root.findByProps({placeholder: 'Current guest password'})).toBeTruthy();
    expect(renderer!.root.findByProps({placeholder: 'New guest password'})).toBeTruthy();
    expect(renderer!.root.findByProps({placeholder: 'Confirm new guest password'})).toBeTruthy();
    expect(renderer!.root.findByProps({children: 'Change Password'})).toBeTruthy();
    expect(() => renderer!.root.findByProps({children: 'Reset Password'})).toThrow();
    expect(() => renderer!.root.findByProps({placeholder: 'New email address'})).toThrow();
    expect(renderer!.root.findByProps({children: 'Upgrade to Cloud Account'})).toBeTruthy();
    expect(renderer!.root.findByProps({children: 'To use key recovery, upgrade from guest mode to a cloud (Firebase) account.'})).toBeTruthy();
  });
});
