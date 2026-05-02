import React, { useEffect, useMemo, useState } from 'react';
import { ScrollView, Switch, Text, TextInput, View } from 'react-native';

import { PrimaryButton } from '../components/ui';
import { styles } from '../theme/styles';
import type { AuthProtection } from '../types/vault';

type DocEntry = { id: string; name: string; canRecover: boolean };

type Props = {
  accountLabel: string;
  sessionMode: 'guest' | 'cloud';
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
  backedUpDocs: DocEntry[];
  notBackedUpDocs: DocEntry[];
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
};

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
  onSetKeyBackupEnabled: _onSetKeyBackupEnabled,
  onOpenRecoverKeys,
  onOpenDocumentRecovery,
  onUpdateUnlockMethod,
  onChangeGuestPassword,
  onResetPassword,
  onSetPendingNewEmail,
  onRequestEmailChange,
  onDeleteAccountAndData,
  onUpgradeToCloud,
}: Props) {
  const [pin, setPin] = useState('');
  const [confirmPin, setConfirmPin] = useState('');
  const [usePasskey, setUsePasskey] = useState(preferredProtection === 'passkey');
  const [useBiometricWithPin, setUseBiometricWithPin] = useState(pinBiometricEnabled);
  const [cloudPasskeyPassword, setCloudPasskeyPassword] = useState('');

  const [guestCurrentPassword, setGuestCurrentPassword] = useState('');
  const [guestNewPassword, setGuestNewPassword] = useState('');
  const [guestConfirmPassword, setGuestConfirmPassword] = useState('');

  const [deletePassword, setDeletePassword] = useState('');
  const [keyBackupStatus, setKeyBackupStatus] = useState('');

  useEffect(() => {
    setUsePasskey(preferredProtection === 'passkey');
    setUseBiometricWithPin(pinBiometricEnabled);
  }, [pinBiometricEnabled, preferredProtection]);

  useEffect(() => {
    if (!usePasskey) setCloudPasskeyPassword('');
  }, [usePasskey]);

  useEffect(() => {
    if (!isGuest) {
      setGuestCurrentPassword('');
      setGuestNewPassword('');
      setGuestConfirmPassword('');
    }
  }, [isGuest]);

  const pinError = useMemo(() => {
    if (usePasskey) return '';
    if (pin.length > 0 && pin.length < 4) return 'PIN must be at least 4 digits.';
    if (confirmPin.length > 0 && pin !== confirmPin) return 'PIN entries do not match.';
    return '';
  }, [confirmPin, pin, usePasskey]);

  const requiresCloudPasskeyPassword = !isGuest && usePasskey && !hasSavedPasskey;
  const canSaveUnlock =
    (usePasskey && (!requiresCloudPasskeyPassword || cloudPasskeyPassword.trim().length > 0)) ||
    (pin.length >= 4 && confirmPin.length >= 4 && pin === confirmPin);

  const isGuestNewPasswordValid =
    guestNewPassword.length >= 8 &&
    /[a-zA-Z]/.test(guestNewPassword) &&
    /[0-9]/.test(guestNewPassword) &&
    /[^a-zA-Z0-9]/.test(guestNewPassword);

  const guestPasswordError = useMemo(() => {
    if (!isGuest) return '';
    if (guestNewPassword.length > 0) {
      const missing: string[] = [];
      if (guestNewPassword.length < 8) missing.push('at least 8 characters');
      if (!/[a-zA-Z]/.test(guestNewPassword)) missing.push('a letter');
      if (!/[0-9]/.test(guestNewPassword)) missing.push('a number');
      if (!/[^a-zA-Z0-9]/.test(guestNewPassword)) missing.push('a special character (e.g. !, @, #)');
      if (missing.length > 0) return `Password needs: ${missing.join(', ')}.`;
    }
    if (
      guestConfirmPassword.length > 0 &&
      guestNewPassword.length > 0 &&
      guestNewPassword !== guestConfirmPassword
    )
      return 'New guest passwords do not match.';
    return '';
  }, [guestConfirmPassword, guestNewPassword, isGuest]);

  const canChangeGuestPassword =
    isGuest &&
    guestCurrentPassword.trim().length > 0 &&
    isGuestNewPasswordValid &&
    guestNewPassword === guestConfirmPassword &&
    !guestPasswordError;

  const handleUpdateUnlockMethod = async () => {
    await onUpdateUnlockMethod({
      method: usePasskey ? 'passkey' : 'pin',
      pin: usePasskey ? undefined : pin,
      pinBiometricEnabled: usePasskey ? undefined : useBiometricWithPin,
      firebasePassword: usePasskey ? cloudPasskeyPassword : undefined,
    });
    setPin('');
    setConfirmPin('');
  };

  const handleChangeGuestPassword = async () => {
    const success = await onChangeGuestPassword(guestCurrentPassword, guestNewPassword);
    if (success) {
      setGuestCurrentPassword('');
      setGuestNewPassword('');
      setGuestConfirmPassword('');
    }
  };

  const handleSetRecoverableByDefault = (value: boolean) => {
    onSetRecoverableByDefault(value);
    setKeyBackupStatus(value ? 'Key recovery enabled for new documents.' : 'Key recovery for new documents disabled.');
  };

  return (
    <View style={{ flex: 1 }}>
      <ScrollView contentContainerStyle={styles.scrollContainer}>
        <Text style={styles.subtitle}>Manage your account, privacy, and unlock method.</Text>

        <View style={styles.card}>
          <Text style={styles.sectionLabel}>Manage Account</Text>
          <Text style={styles.cardMeta}>Account: {accountLabel}</Text>
          <Text style={styles.cardMeta}>Session: {sessionMode ?? 'Not signed in'}</Text>
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
                Upgrade to a Firebase account to enable cloud sync, sharing, and key backup.
              </Text>
              <Text style={styles.subtitle}>
                Guest passwords stay on this device. Use the current password to change it locally.
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
              {authError ? <Text style={styles.errorText}>{authError}</Text> : null}
              <PrimaryButton
                label={isSubmitting ? 'Please wait...' : 'Change Password'}
                onPress={() => void handleChangeGuestPassword()}
                disabled={isSubmitting || !canChangeGuestPassword}
              />
            </>
          ) : (
            <>
              <PrimaryButton
                label="Reset Password"
                onPress={() => void onResetPassword()}
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
                onPress={() => void onRequestEmailChange()}
                disabled={isSubmitting || pendingNewEmail.trim().length < 5}
              />
              <Text style={styles.subtitle}>
                Your email changes only after you open the confirmation link sent to the new address.
              </Text>
            </>
          )}

          {!isGuest && !hasSavedPasskey ? (
            <>
              <TextInput
                autoCapitalize="none"
                placeholder="Enter password to confirm deletion"
                placeholderTextColor="#6b7280"
                style={styles.input}
                value={deletePassword}
                onChangeText={setDeletePassword}
                secureTextEntry
                autoCorrect={false}
                autoComplete="off"
                textContentType="password"
                editable={!isSubmitting}
              />
              <Text style={styles.subtitle}>
                Your account password is required to confirm deletion.
              </Text>
            </>
          ) : null}
          {authError ? <Text style={styles.errorText}>{authError}</Text> : null}
          <PrimaryButton
            label={isGuest ? 'Delete Local Data' : 'Delete Account & All Data'}
            onPress={onDeleteAccountAndData}
            variant="danger"
            disabled={isSubmitting || (!isGuest && !hasSavedPasskey && deletePassword.trim().length === 0)}
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
            <Text style={styles.switchLabel}>Save new documents offline by default</Text>
            <Switch
              value={saveOfflineByDefault}
              onValueChange={onSetSaveOfflineByDefault}
            />
          </View>
        </View>

        <View style={styles.card}>
          <Text style={styles.sectionLabel}>Key Backup</Text>
          <View style={styles.switchRow}>
            <Text style={styles.switchLabel}>Enable key recovery for new documents by default</Text>
            <Switch
              value={recoverableByDefault}
              onValueChange={handleSetRecoverableByDefault}
              disabled={isGuest}
            />
          </View>
          {isGuest ? (
            <Text style={styles.warningText}>
              To use key recovery, upgrade from guest mode to a cloud (Firebase) account.
            </Text>
          ) : null}

          {!isGuest ? (
            <Text style={styles.subtitle}>
              Key recovery uses the passphrase you set when creating your account.
            </Text>
          ) : null}

          {keyBackupStatus ? <Text style={styles.backupStatus}>{keyBackupStatus}</Text> : null}

          <PrimaryButton
            label="Recover Keys"
            onPress={onOpenRecoverKeys}
            disabled={isGuest || isSubmitting}
          />
          <PrimaryButton
            label="Manage Document Recovery"
            onPress={onOpenDocumentRecovery}
            disabled={isGuest || isSubmitting}
          />

          <Text style={styles.subtitle}>
            Recoverable documents: {backedUpDocs.length} /{' '}
            {backedUpDocs.length + notBackedUpDocs.length}
          </Text>
        </View>

        <View style={styles.card}>
          <Text style={styles.sectionLabel}>Unlock Method</Text>
          <Text style={styles.cardMeta}>Current: {usePasskey ? 'Passkey' : 'PIN'}</Text>
          <View style={styles.switchRow}>
            <Text style={styles.switchLabel}>Use Passkey</Text>
            <Switch
              value={usePasskey}
              onValueChange={value => {
                setUsePasskey(value);
                if (value) { setPin(''); setConfirmPin(''); }
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
                onChangeText={value => setConfirmPin(value.replace(/[^0-9]/g, ''))}
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
                secureTextEntry
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
            <Text style={styles.cardMeta}>Saved passkey found on this device.</Text>
          ) : null}
          {pinError ? <Text style={styles.errorText}>{pinError}</Text> : null}
          <PrimaryButton
            label={isSubmitting ? 'Please wait...' : 'Save Unlock Method'}
            disabled={isSubmitting || !canSaveUnlock || Boolean(pinError)}
            onPress={() => void handleUpdateUnlockMethod()}
          />
        </View>

        <View style={styles.card}>
          <Text style={styles.sectionLabel}>Privacy</Text>
          <Text style={styles.subtitle}>
            Guest mode keeps vault data only on this device and does not sync to Firebase.
          </Text>
          <Text style={styles.subtitle}>
            Firebase sharing and cloud backup remain disabled while guest mode is active.
          </Text>
        </View>

        {accountStatus ? (
          <View style={styles.statusBox}>
            <Text style={styles.statusText}>{accountStatus}</Text>
          </View>
        ) : null}
      </ScrollView>
    </View>
  );
}
