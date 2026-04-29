/**
 * screens/SettingsScreen.tsx
 *
 * Application settings UI. Exposes preferences for key backup, passphrase
 * generation, offline defaults, and account sign-in status. Keeps presentational
 * logic in the screen while delegating actions to hooks and controller APIs.
 */

import React, { useEffect, useMemo, useState } from 'react';
import { Pressable, ScrollView, Switch, Text, TextInput, View } from 'react-native';

import { PrimaryButton } from '../components/ui';
import { styles } from '../theme/styles';
import { AuthProtection, AuthSessionMode } from '../types/vault';

/**
 * SettingsScreen
 *
 * Application settings UI. Exposes preferences for key backup, passphrase
 * generation, offline defaults, and account sign-in status. Keeps
 * presentational logic in the screen while delegating actions to hooks and
 * controller APIs.
 *
 * @param {object} props - Component props
 * @param {string} props.accountLabel - Human friendly account label
 * @param {AuthSessionMode | null} props.sessionMode - Current session mode
 * @param {boolean} props.isGuest - Whether the current session is guest
 * @param {string|null} props.authError - Optional auth error message
 * @param {AuthProtection | null} props.preferredProtection - Preferred unlock method
 * @param {boolean} props.pinBiometricEnabled - Whether biometric with PIN is enabled
 * @param {boolean} props.hasSavedPasskey - Whether a passkey is saved on device
 * @param {boolean} props.isSubmitting - Whether an operation is in progress
 * @param {string} props.accountStatus - Informational account status message
 * @param {string} props.pendingNewEmail - Pending new email input value
 * @param {boolean} props.saveOfflineByDefault - Preference for saving offline by default
 * @param {boolean} props.recoverableByDefault - Whether new documents are recoverable by default
 * @param {boolean} props.keyBackupEnabled - Whether key backup is enabled
 * @param {Array<{id: string; name: string}>} props.backedUpDocs - Documents included in recovery
 * @param {Array<{id: string; name: string}>} props.notBackedUpDocs - Documents excluded from recovery
 * @param {(value: boolean) => void} props.onSetSaveOfflineByDefault - Setter for saveOfflineByDefault
 * @param {(value: boolean) => void} props.onSetRecoverableByDefault - Setter for recoverableByDefault
 * @param {(value: boolean) => void} props.onSetKeyBackupEnabled - Setter for keyBackupEnabled
 * @param {() => void} props.onOpenRecoverKeys - Open key recovery screen
 * @param {() => void} props.onOpenDocumentRecovery - Open document recovery management
 * @param {(payload: { method: 'pin' | 'passkey'; pin?: string; pinBiometricEnabled?: boolean; firebasePassword?: string; }) => Promise<void>} props.onUpdateUnlockMethod - Update unlock method
 * @param {(currentPassword: string, nextPassword: string) => Promise<boolean>} props.onChangeGuestPassword - Change guest password
 * @param {() => Promise<void>} props.onResetPassword - Reset account password
 * @param {(value: string) => void} props.onSetPendingNewEmail - Setter for pendingNewEmail
 * @param {() => Promise<void>} props.onRequestEmailChange - Request email change
 * @param {() => void} props.onDeleteAccountAndData - Delete account and all data
 * @param {() => void} props.onUpgradeToCloud - Upgrade guest account to cloud
 * @returns {JSX.Element} Rendered settings screen
 */
export function SettingsScreen({
  accountLabel,
  sessionMode,
  isGuest,
  authError,
  preferredProtection,
  pinBiometricEnabled,
  hasSavedPasskey,
  isSubmitting,
  accountStatus,
  pendingNewEmail,
  saveOfflineByDefault,
  recoverableByDefault,
  keyBackupEnabled,
  backedUpDocs,
  notBackedUpDocs,
  onSetSaveOfflineByDefault,
  onSetRecoverableByDefault,
  onSetKeyBackupEnabled,
  onOpenRecoverKeys,
  onOpenDocumentRecovery,
  onUpdateUnlockMethod,
  onChangeGuestPassword,
  onResetPassword,
  onSetPendingNewEmail,
  onRequestEmailChange,
  onDeleteAccountAndData,
  onUpgradeToCloud,
}: {
  accountLabel: string;
  sessionMode: AuthSessionMode | null;
  isGuest: boolean;
  authError: string | null;
  preferredProtection: AuthProtection | null;
  pinBiometricEnabled: boolean;
  hasSavedPasskey: boolean;
  isSubmitting: boolean;
  accountStatus: string;
  pendingNewEmail: string;
  saveOfflineByDefault: boolean;
  recoverableByDefault: boolean;
  keyBackupEnabled: boolean;
  backedUpDocs: Array<{id: string; name: string}>;
  notBackedUpDocs: Array<{id: string; name: string}>;
  onSetSaveOfflineByDefault: (value: boolean) => void;
  onSetRecoverableByDefault: (value: boolean) => void;
  onSetKeyBackupEnabled: (value: boolean) => void;
  onOpenRecoverKeys: () => void;
  onOpenDocumentRecovery: () => void;
  onUpdateUnlockMethod: (payload: {
    method: 'pin' | 'passkey';
    pin?: string;
    pinBiometricEnabled?: boolean;
    firebasePassword?: string;
  }) => Promise<void>;
  onChangeGuestPassword: (currentPassword: string, nextPassword: string) => Promise<boolean>;
  onResetPassword: () => Promise<void>;
  onSetPendingNewEmail: (value: string) => void;
  onRequestEmailChange: () => Promise<void>;
  onDeleteAccountAndData: () => void;
  onUpgradeToCloud: () => void;
}) {
  const [pin, setPin] = useState('');
  const [confirmPin, setConfirmPin] = useState('');
  const [guestCurrentPassword, setGuestCurrentPassword] = useState('');
  const [guestNewPassword, setGuestNewPassword] = useState('');
  const [guestConfirmPassword, setGuestConfirmPassword] = useState('');
  const [cloudPasskeyPassword, setCloudPasskeyPassword] = useState('');
  const [usePasskey, setUsePasskey] = useState(preferredProtection === 'passkey');
  const [useBiometricWithPin, setUseBiometricWithPin] = useState(pinBiometricEnabled);
  useEffect(() => {
    setUsePasskey(preferredProtection === 'passkey');
    setUseBiometricWithPin(pinBiometricEnabled);
  }, [pinBiometricEnabled, preferredProtection]);

  useEffect(() => {
    if (!isGuest) {
      return;
    }

    setGuestCurrentPassword('');
    setGuestNewPassword('');
    setGuestConfirmPassword('');
  }, [isGuest]);

  useEffect(() => {
    if (!usePasskey) {
      setCloudPasskeyPassword('');
    }
  }, [usePasskey]);

  const pinError = useMemo(() => {
    if (usePasskey) {
      return '';
    }
    if (pin.length > 0 && pin.length < 4) {
      return 'PIN must be at least 4 digits.';
    }
    if (confirmPin.length > 0 && pin !== confirmPin) {
      return 'PIN entries do not match.';
    }
    return '';
  }, [confirmPin, pin, usePasskey]);

  const requiresCloudPasskeyPassword = !isGuest && usePasskey && !hasSavedPasskey;
  const canSaveUnlock =
    (usePasskey && (!requiresCloudPasskeyPassword || cloudPasskeyPassword.trim().length > 0)) ||
    (pin.length >= 4 && confirmPin.length >= 4 && pin === confirmPin);
  const guestPasswordError = useMemo(() => {
    if (!isGuest) {
      return '';
    }

    if (guestNewPassword.length > 0 && guestNewPassword.length < 6) {
      return 'New guest password must be at least 6 characters.';
    }

    if (
      guestConfirmPassword.length > 0 &&
      guestNewPassword.length > 0 &&
      guestNewPassword !== guestConfirmPassword
    ) {
      return 'New guest passwords do not match.';
    }

    return '';
  }, [guestConfirmPassword, guestNewPassword, isGuest]);

  const canChangeGuestPassword =
    isGuest &&
    guestCurrentPassword.trim().length > 0 &&
    guestNewPassword.trim().length >= 6 &&
    guestNewPassword === guestConfirmPassword &&
    !guestPasswordError;

  return (
    <ScrollView contentContainerStyle={styles.scrollContainer}>
      <Text style={styles.pageTitle}>Settings</Text>
      <Text style={styles.subtitle}>
        Manage your account, privacy, and unlock method.
      </Text>

      <View style={styles.card}>
        <Text style={styles.sectionLabel}>Manage Account</Text>
        <Text style={styles.cardMeta}>Account: {accountLabel}</Text>
        <Text style={styles.cardMeta}>
          Session: {sessionMode ?? 'Not signed in'}
        </Text>
        <Text style={styles.cardMeta}>
          {isGuest ? 'Guest mode is local-only' : 'Cloud account active'}
        </Text>
        {isGuest ? (
          <>
            <PrimaryButton
              label="Upgrade to Cloud Account"
              onPress={onUpgradeToCloud}
              disabled={isSubmitting}
            />
            <Text style={styles.subtitle}>
              Upgrade to a Firebase account to enable cloud sync, sharing, and
              key backup.
            </Text>
            <Text style={styles.subtitle}>
              Guest passwords stay on this device. Use the current password to
              change it locally.
            </Text>
            <TextInput
              autoCapitalize="none"
              placeholder="Current guest password"
              placeholderTextColor="#6b7280"
              style={styles.input}
              value={guestCurrentPassword}
              onChangeText={setGuestCurrentPassword}
              secureTextEntry
              editable={!isSubmitting}
            />
            <TextInput
              autoCapitalize="none"
              placeholder="New guest password"
              placeholderTextColor="#6b7280"
              style={styles.input}
              value={guestNewPassword}
              onChangeText={setGuestNewPassword}
              secureTextEntry
              editable={!isSubmitting}
            />
            <TextInput
              autoCapitalize="none"
              placeholder="Confirm new guest password"
              placeholderTextColor="#6b7280"
              style={styles.input}
              value={guestConfirmPassword}
              onChangeText={setGuestConfirmPassword}
              secureTextEntry
              editable={!isSubmitting}
            />
            {guestPasswordError ? (
              <Text style={styles.errorText}>{guestPasswordError}</Text>
            ) : null}
            {authError ? (
              <Text style={styles.errorText}>{authError}</Text>
            ) : null}
            <PrimaryButton
              label={isSubmitting ? 'Please wait...' : 'Change Password'}
              onPress={() => {
                void (async () => {
                  const success = await onChangeGuestPassword(
                    guestCurrentPassword,
                    guestNewPassword,
                  );
                  if (success) {
                    setGuestCurrentPassword('');
                    setGuestNewPassword('');
                    setGuestConfirmPassword('');
                  }
                })();
              }}
              disabled={isSubmitting || !canChangeGuestPassword}
            />
          </>
        ) : (
          <>
            <PrimaryButton
              label="Reset Password"
              onPress={() => {
                onResetPassword();
              }}
              disabled={isSubmitting}
            />
            <TextInput
              autoCapitalize="none"
              keyboardType="email-address"
              placeholder="New email address"
              placeholderTextColor="#6b7280"
              style={styles.input}
              value={pendingNewEmail}
              onChangeText={onSetPendingNewEmail}
              editable={!isSubmitting}
            />
            <PrimaryButton
              label="Send Email Change Confirmation"
              onPress={() => {
                onRequestEmailChange();
              }}
              disabled={isSubmitting || pendingNewEmail.trim().length < 5}
            />
            <Text style={styles.subtitle}>
              Your email changes only after you open the confirmation link sent
              to the new address.
            </Text>
          </>
        )}
        <PrimaryButton
          label={isGuest ? 'Delete Local Data' : 'Delete Account & All Data'}
          onPress={() => {
            onDeleteAccountAndData();
          }}
          variant="danger"
          disabled={isSubmitting}
        />
        <Text style={styles.warningText}>
          {isGuest
            ? 'This will erase documents, offline copies, and saved device data from this app.'
            : 'This will remove Firebase documents, backups, local vault data, and the account itself.'}
        </Text>
      </View>

      <View style={styles.card}>
        <Text style={styles.sectionLabel}>Offline Vault</Text>
        <View style={styles.switchRow}>
          <Text style={styles.switchLabel}>
            Save new documents offline by default
          </Text>
          <Switch
            value={saveOfflineByDefault}
            onValueChange={onSetSaveOfflineByDefault}
          />
        </View>
      </View>

      <View style={styles.card}>
        <Text style={styles.sectionLabel}>Key Backup</Text>
        <View style={styles.switchRow}>
          <Text style={styles.switchLabel}>Enable key backup</Text>
          <Switch
            value={keyBackupEnabled}
            onValueChange={onSetKeyBackupEnabled}
            disabled={isGuest}
          />
        </View>
        <View style={styles.switchRow}>
          <Text style={styles.switchLabel}>Enable key recovery for new documents by default</Text>
          <Switch
            value={recoverableByDefault}
            onValueChange={onSetRecoverableByDefault}
            disabled={isGuest || !keyBackupEnabled}
          />
        </View>
        <Text style={styles.subtitle}>
          Key backup is {keyBackupEnabled ? 'enabled' : 'disabled'}. Auto-sync to Firebase backup is on while key backup is enabled.
        </Text>
        {isGuest ? (
          <Text style={styles.warningText}>
            To use key backup, upgrade from guest mode to a cloud (Firebase)
            account.
          </Text>
        ) : null}

        <PrimaryButton
          label="Recover Keys"
          onPress={onOpenRecoverKeys}
          disabled={isGuest || !keyBackupEnabled || isSubmitting}
        />
        <PrimaryButton
          label="Manage Document Recovery"
          onPress={onOpenDocumentRecovery}
          disabled={isGuest || !keyBackupEnabled || isSubmitting}
        />

        <Text style={styles.subtitle}>
          Recoverable documents: {backedUpDocs.length} / {backedUpDocs.length + notBackedUpDocs.length}
        </Text>
      </View>

      <View style={styles.card}>
        <Text style={styles.sectionLabel}>Unlock Method</Text>
        <Text style={styles.cardMeta}>
          Current: {usePasskey ? 'Passkey' : 'PIN'}
        </Text>
        <View style={styles.switchRow}>
          <Text style={styles.switchLabel}>Use Passkey</Text>
          <Switch
            value={usePasskey}
            onValueChange={value => {
              setUsePasskey(value);
              if (value) {
                setPin('');
                setConfirmPin('');
              }
            }}
            disabled={isSubmitting}
          />
        </View>

        {!usePasskey ? (
          <>
            <TextInput
              keyboardType="number-pad"
              placeholder="Set new PIN"
              placeholderTextColor="#6b7280"
              style={styles.input}
              value={pin}
              onChangeText={value => setPin(value.replace(/[^0-9]/g, ''))}
              secureTextEntry
              editable={!isSubmitting}
              maxLength={12}
            />
            <TextInput
              keyboardType="number-pad"
              placeholder="Confirm new PIN"
              placeholderTextColor="#6b7280"
              style={styles.input}
              value={confirmPin}
              onChangeText={value =>
                setConfirmPin(value.replace(/[^0-9]/g, ''))
              }
              secureTextEntry
              editable={!isSubmitting}
              maxLength={12}
            />
            <View style={styles.switchRow}>
              <Text style={styles.switchLabel}>Use biometric with PIN</Text>
              <Switch
                value={useBiometricWithPin}
                onValueChange={setUseBiometricWithPin}
                disabled={isSubmitting}
              />
            </View>
          </>
        ) : !isGuest && !hasSavedPasskey ? (
          <>
            <TextInput
              autoCapitalize="none"
              placeholder="Current account password"
              placeholderTextColor="#6b7280"
              style={styles.input}
              value={cloudPasskeyPassword}
              onChangeText={setCloudPasskeyPassword}
              secureTextEntry={true}
              autoCorrect={false}
              autoComplete="off"
              textContentType="password"
              editable={!isSubmitting}
            />
            <Text style={styles.subtitle}>
              Enter your current password once to register passkey unlock on this device.
            </Text>
          </>
        ) : null}

        <Text style={styles.subtitle}>
          {usePasskey
            ? 'Passkey mode uses a saved secure credential for unlock.'
            : useBiometricWithPin
            ? 'PIN unlock is enabled with biometric shortcut.'
            : 'PIN unlock is enabled without biometric shortcut.'}
        </Text>

        {hasSavedPasskey ? (
          <Text style={styles.cardMeta}>
            Saved passkey found on this device.
          </Text>
        ) : null}
        {pinError ? <Text style={styles.errorText}>{pinError}</Text> : null}
        <PrimaryButton
          label={isSubmitting ? 'Please wait...' : 'Save Unlock Method'}
          disabled={isSubmitting || !canSaveUnlock || Boolean(pinError)}
          onPress={() => {
            void onUpdateUnlockMethod(
              usePasskey
                ? {
                    method: 'passkey',
                    firebasePassword: cloudPasskeyPassword,
                  }
                : {
                    method: 'pin',
                    pin,
                    pinBiometricEnabled: useBiometricWithPin,
                  },
            );
          }}
        />
      </View>

      <View style={styles.card}>
        <Text style={styles.sectionLabel}>Privacy</Text>
        <Text style={styles.subtitle}>
          Guest mode keeps vault data only on this device and does not sync to
          Firebase.
        </Text>
        <Text style={styles.subtitle}>
          Firebase sharing and cloud backup remain disabled while guest mode is
          active.
        </Text>
      </View>

      {accountStatus ? (
        <View style={styles.statusBox}>
          <Text style={styles.statusText}>{accountStatus}</Text>
        </View>
      ) : null}
    </ScrollView>
  );
}
