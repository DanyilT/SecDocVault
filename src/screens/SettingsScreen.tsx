import React, { useEffect, useMemo, useState } from 'react';
import { Pressable, ScrollView, Switch, Text, TextInput, View } from 'react-native';

import { PrimaryButton } from '../components/ui';
import { styles } from '../theme/styles';
import { AuthProtection, AuthSessionMode } from '../types/vault';

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
  recoveryPassphrase,
  backedUpDocs,
  notBackedUpDocs,
  onSetSaveOfflineByDefault,
  onSetRecoverableByDefault,
  onSetKeyBackupEnabled,
  onCopyRecoveryPassphrase,
  onResetBackupPassphrase,
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
  recoveryPassphrase: string | null;
  backedUpDocs: Array<{id: string; name: string}>;
  notBackedUpDocs: Array<{id: string; name: string}>;
  onSetSaveOfflineByDefault: (value: boolean) => void;
  onSetRecoverableByDefault: (value: boolean) => void;
  onSetKeyBackupEnabled: (value: boolean) => void;
  onCopyRecoveryPassphrase: (passphrase: string) => Promise<void>;
  onResetBackupPassphrase: () => Promise<void>;
  onOpenRecoverKeys: () => void;
  onOpenDocumentRecovery: () => void;
  onUpdateUnlockMethod: (payload: {
    method: 'pin' | 'passkey';
    pin?: string;
    pinBiometricEnabled?: boolean;
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
  const [usePasskey, setUsePasskey] = useState(preferredProtection === 'passkey');
  const [useBiometricWithPin, setUseBiometricWithPin] = useState(pinBiometricEnabled);
  const [showRecoveryPassphrase, setShowRecoveryPassphrase] = useState(false);

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

  const canSaveUnlock = usePasskey || (pin.length >= 4 && confirmPin.length >= 4 && pin === confirmPin);
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
          {isGuest ? 'Guest mode is local-only' : 'Firebase account active'}
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

        <Text style={styles.cardMeta}>Recovery passphrase</Text>
        <Pressable
          onPress={() => {
            if (!recoveryPassphrase) {
              return;
            }
            setShowRecoveryPassphrase(true);
            void onCopyRecoveryPassphrase(recoveryPassphrase);
          }}
          style={styles.hashBlock}
        >
          <Text style={styles.cardMeta}>
            {recoveryPassphrase
              ? showRecoveryPassphrase
                ? recoveryPassphrase
                : 'Tap to reveal and copy'
              : 'Not configured'}
          </Text>
        </Pressable>

        <PrimaryButton
          label="Generate New Passphrase"
          variant="outline"
          onPress={() => {
            void onResetBackupPassphrase();
            setShowRecoveryPassphrase(false);
          }}
          disabled={isGuest || !keyBackupEnabled || isSubmitting}
        />
        <Text style={styles.subtitle}>
          Generating a new passphrase deactivates the previous passphrase and deletes existing cloud key backups.
        </Text>

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
                ? { method: 'passkey' }
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
