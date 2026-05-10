/**
 * screens/SettingsScreen.tsx
 *
 * Application settings UI. Exposes preferences for key backup, passphrase
 * generation, offline defaults, and account sign-in status. Keeps presentational
 * logic in the screen while delegating actions to hooks and controller APIs.
 */

import React, { useEffect, useMemo, useState } from 'react';
import { Alert, Pressable, ScrollView, Switch, Text, TextInput, View } from 'react-native';
import Clipboard from '@react-native-clipboard/clipboard';
import {
  ArrowPathRoundedSquareIcon, CloudArrowUpIcon,
  EyeIcon,
  EyeSlashIcon,
} from 'react-native-heroicons/solid';

import { PrimaryButton } from '../components/ui';
import { styles } from '../theme/styles';
import type { AuthProtection } from '../types/vault';
import {
  buildPassphraseChangeHandler,
  buildPassphraseGenerateHandler,
} from '../services/crypto/passphraseHandlers.ts';

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
  recoveryPassphrase?: string | null;
  backedUpDocs: DocEntry[];
  notBackedUpDocs: DocEntry[];
  onSetSaveOfflineByDefault: (value: boolean) => void;
  onSetRecoverableByDefault: (value: boolean) => void;
  onSetKeyBackupEnabled: (value: boolean) => void;
  onSetRecoveryPassphrase?: (passphrase: string) => Promise<void>;
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
 * @param {string|null} props.recoveryPassphrase - Current recovery passphrase if configured
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
  recoveryPassphrase,
  backedUpDocs,
  notBackedUpDocs,
  onSetSaveOfflineByDefault,
  onSetRecoverableByDefault,
  onSetKeyBackupEnabled,
  onSetRecoveryPassphrase,
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
  const [showRecoveryPassphrase, setShowRecoveryPassphrase] = useState(false);
  const [passphraseActionFeedback, setPassphraseActionFeedback] = useState('');
  const [newPassphrase, setNewPassphrase] = useState('');
  const [showNewPassphrase, setShowNewPassphrase] = useState(true);
  const [newPassphraseError, setNewPassphraseError] = useState('');
  const [showPassphraseEditor, setShowPassphraseEditor] = useState(false);

  const [currentDisplayedPassphrase, setCurrentDisplayedPassphrase] = useState<string | null>(recoveryPassphrase ?? null);

  useEffect(() => {
    setCurrentDisplayedPassphrase(recoveryPassphrase ?? null);
  }, [recoveryPassphrase]);

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
  const hasFirebaseRecoveryKeys = useMemo(
    () => backedUpDocs.some(item => item.canRecover),
    [backedUpDocs],
  );

  const handleNewPassphraseChange = buildPassphraseChangeHandler({
    setPassphrase: setNewPassphrase,
    setError: setNewPassphraseError,
  });

  const handleSubmitPassphrase = () => {
    if (!onSetRecoveryPassphrase || !newPassphrase.trim() || newPassphraseError) {
      return;
    }

    const isUpdating = Boolean(recoveryPassphrase);
    Alert.alert(
      isUpdating ? 'Update passphrase?' : 'Set passphrase?',
      isUpdating
        ? 'Updating passphrase deactivates the previous passphrase and deletes existing cloud key backups.'
        : 'This passphrase will be required to recover your keys later. Save it securely.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: isUpdating ? 'Update' : 'Set',
          style: isUpdating ? 'destructive' : 'default',
          onPress: async () => {
            try {
              const submittedPassphrase = newPassphrase.trim();
              await onSetRecoveryPassphrase(submittedPassphrase);
              // First-time setup: now persist enabled
              if (!recoveryPassphrase) onSetKeyBackupEnabled(true);
              setCurrentDisplayedPassphrase(submittedPassphrase); // Update local state immediately
              setNewPassphrase('');
              setNewPassphraseError('');
              setShowRecoveryPassphrase(false);
              setShowPassphraseEditor(false);
              setPassphraseActionFeedback('Saved');
              setKeyBackupStatus(
                !recoveryPassphrase
                  ? 'Recovery passphrase set. Key backup enabled.'
                  : 'Recovery passphrase updated.',
              );
              setTimeout(() => setPassphraseActionFeedback(''), 2000);
            } catch {
              setKeyBackupStatus('Failed to save recovery passphrase. Try again.');
            }
          },
        },
      ],
    );
  };

  const handleToggleRecoveryPassphrase = () => {
    if (!currentDisplayedPassphrase) {
      return;
    }

    if (showRecoveryPassphrase) {
      setShowRecoveryPassphrase(false);
      return;
    }

    setShowRecoveryPassphrase(true);
  };

  const handleSetKeyBackupEnabledWithGuard = (enabled: boolean) => {
    if (!enabled) {
      onSetKeyBackupEnabled(false);
      setShowPassphraseEditor(false);
      setNewPassphrase('');
      setNewPassphraseError('');
      setShowRecoveryPassphrase(false);
      return;
    }

    // Enabling path
    if (recoveryPassphrase || currentDisplayedPassphrase) {
      onSetKeyBackupEnabled(true);
      setShowPassphraseEditor(false);
      setKeyBackupStatus('Key backup enabled.');
      return;
    }

    // First-time enable: require passphrase confirmation before persisting
    setShowPassphraseEditor(true);
    setKeyBackupStatus('Set recovery passphrase to enable key backup.');
  };

  const inKeyBackupSetupFlow = keyBackupEnabled || (showPassphraseEditor && !recoveryPassphrase);

  useEffect(() => {
    if (!keyBackupEnabled) {
      setShowPassphraseEditor(false);
      setNewPassphrase('');
      setNewPassphraseError('');
      setShowRecoveryPassphrase(false);
      return;
    }

    if (!recoveryPassphrase && !currentDisplayedPassphrase) {
      setShowPassphraseEditor(true);
    }
  }, [keyBackupEnabled, recoveryPassphrase, currentDisplayedPassphrase]);

  useEffect(() => {
    if (!showRecoveryPassphrase || !currentDisplayedPassphrase) {
      return;
    }
    Clipboard.setString(currentDisplayedPassphrase);
  }, [currentDisplayedPassphrase, showRecoveryPassphrase]);

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
                  handleChangeGuestPassword().catch(() => {});
                }}
                disabled={isSubmitting || !canChangeGuestPassword}
              />
            </>
          ) : (
            <>
              <PrimaryButton
                label="Reset Password"
                onPress={() => {
                  onResetPassword().catch(() => {});
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
                  onRequestEmailChange().catch(() => {});
                }}
                disabled={isSubmitting || pendingNewEmail.trim().length < 5}
              />
              <Text style={styles.subtitle}>
                Your email changes only after you open the confirmation link
                sent to the new address.
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
            disabled={
              isSubmitting ||
              (!isGuest &&
                !hasSavedPasskey &&
                deletePassword.trim().length === 0)
            }
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
          {isGuest ? (
            <Text style={styles.warningText}>
              To use key backup, upgrade from guest mode to a cloud (Firebase)
              account.
            </Text>
          ) : null}

          {!isGuest ? (
            <>
              <View style={styles.switchRow}>
                <Text style={styles.switchLabel}>Enable key backup</Text>
                <Switch
                  value={inKeyBackupSetupFlow}
                  onValueChange={handleSetKeyBackupEnabledWithGuard}
                  disabled={isSubmitting}
                />
              </View>

              {inKeyBackupSetupFlow ? (
                <>
                  {keyBackupEnabled ? (
                    <View style={styles.switchRow}>
                      <Text style={styles.switchLabel}>
                        Enable key recovery for new documents by default
                      </Text>
                      <Switch
                        value={recoverableByDefault}
                        onValueChange={handleSetRecoverableByDefault}
                        disabled={isGuest}
                      />
                    </View>
                  ) : null}

                  {showPassphraseEditor ? (
                    <>
                      <Text
                        style={[
                          styles.subtitle,
                          { marginTop: 12, marginBottom: 8 },
                        ]}
                      >
                        {currentDisplayedPassphrase
                          ? 'Updating a passphrase deactivates the previous passphrase and deletes existing cloud key backups.'
                          : 'Set Recovery Passphrase'}
                      </Text>

                      <View
                        style={{
                          flexDirection: 'row',
                          alignItems: 'center',
                          borderWidth: 1,
                          borderColor: '#374151',
                          borderRadius: 12,
                          backgroundColor: '#111827',
                          paddingHorizontal: 12,
                          marginBottom: 8,
                        }}
                      >
                        <TextInput
                          autoCapitalize="none"
                          placeholder="New passphrase (5 words separated by hyphens)"
                          placeholderTextColor="#6b7280"
                          style={[
                            styles.input,
                            { flex: 1, borderWidth: 0, paddingHorizontal: 0 },
                          ]}
                          value={newPassphrase}
                          onChangeText={handleNewPassphraseChange}
                          secureTextEntry={!showNewPassphrase}
                          editable={!isSubmitting}
                          returnKeyType={'send'}
                          onSubmitEditing={handleSubmitPassphrase}
                        />
                        <Pressable
                          onPress={() => setShowNewPassphrase(p => !p)}
                        >
                          {showNewPassphrase ? (
                            <EyeSlashIcon size={21} color="#60a5fa" />
                          ) : (
                            <EyeIcon size={21} color="#60a5fa" />
                          )}
                        </Pressable>
                      </View>

                      {newPassphraseError ? (
                        <Text style={styles.errorText}>
                          {newPassphraseError}
                        </Text>
                      ) : null}

                      <View
                        style={{
                          flexDirection: 'row',
                          gap: 8,
                          marginRight: 8,
                          justifyContent: 'flex-end',
                        }}
                      >
                        {passphraseActionFeedback ? (
                          <Text
                            style={{
                              color: '#60a5fa',
                              fontWeight: '600',
                              fontSize: 12,
                              marginRight: 8,
                              alignSelf: 'center',
                            }}
                          >
                            {passphraseActionFeedback}
                          </Text>
                        ) : null}
                        <Pressable
                          onPress={buildPassphraseGenerateHandler({
                            setPassphrase: setNewPassphrase,
                            setError: setNewPassphraseError,
                            setActionFeedback: setPassphraseActionFeedback,
                          })}
                        >
                          <ArrowPathRoundedSquareIcon
                            size={21}
                            color="#60a5fa"
                          />
                        </Pressable>
                        {newPassphrase ? (
                          <Pressable
                            onPress={handleSubmitPassphrase}
                            disabled={
                              isSubmitting ||
                              !newPassphrase.trim() ||
                              Boolean(newPassphraseError)
                            }
                          >
                            {isSubmitting ? (
                              <Text style={styles.buttonText}>'Saving...'</Text>
                            ) : !isSubmitting &&
                              newPassphrase.trim() &&
                              !newPassphraseError ? (
                              <CloudArrowUpIcon size={21} color="#60a5fa" />
                            ) : null}
                          </Pressable>
                        ) : null}
                      </View>
                    </>
                  ) : (
                    <PrimaryButton
                      label="Update passphrase"
                      onPress={() => setShowPassphraseEditor(true)}
                      disabled={isSubmitting}
                    />
                  )}
                </>
              ) : null}
            </>
          ) : null}

          {!isGuest && keyBackupEnabled && currentDisplayedPassphrase ? (
            <>
              <Text style={styles.cardMeta}>Recovery passphrase</Text>
              <Pressable
                onPress={handleToggleRecoveryPassphrase}
                style={{
                  borderWidth: 1,
                  borderStyle: 'dashed',
                  borderColor: '#475569',
                  borderRadius: 10,
                  backgroundColor: '#0f172a',
                  padding: 12,
                  marginTop: 4,
                }}
              >
                {currentDisplayedPassphrase ? (
                  showRecoveryPassphrase ? (
                    <Text
                      style={[
                        styles.cardMeta,
                        {
                          color: '#cbd5e1',
                          fontWeight: '600',
                        },
                      ]}
                    >
                      {currentDisplayedPassphrase}
                    </Text>
                  ) : (
                    <Text
                      style={[
                        styles.cardMeta,
                        {
                          color: '#cbd5e1',
                          fontWeight: '600',
                        },
                      ]}
                    >
                      Tap to reveal and copy
                    </Text>
                  )
                ) : (
                  <Text style={styles.cardMeta}>Not configured</Text>
                )}
              </Pressable>
            </>
          ) : null}

          {!isGuest ? (
            <Text style={styles.subtitle}>
              Key recovery uses a recovery passphrase to backup and restore your
              document keys across devices.
            </Text>
          ) : null}

          {keyBackupStatus ? (
            <Text style={styles.backupStatus}>{keyBackupStatus}</Text>
          ) : null}

          <PrimaryButton
            label="Recover Keys"
            onPress={onOpenRecoverKeys}
            disabled={isGuest || isSubmitting || !hasFirebaseRecoveryKeys}
          />
          {!isGuest && !hasFirebaseRecoveryKeys ? (
            <Text style={styles.subtitle}>
              No Firebase recovery keys found yet. Upload recoverable documents
              to cloud first.
            </Text>
          ) : null}
          {keyBackupEnabled ? (
            <PrimaryButton
              label="Manage Document Recovery"
              onPress={onOpenDocumentRecovery}
              disabled={isGuest || isSubmitting}
            />
          ) : null}

          <Text style={styles.subtitle}>
            Recoverable documents: {backedUpDocs.length} /{' '}
            {backedUpDocs.length + notBackedUpDocs.length}
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
                secureTextEntry
                autoCorrect={false}
                autoComplete="off"
                textContentType="password"
                editable={!isSubmitting}
              />
              <Text style={styles.subtitle}>
                Enter your current password once to register passkey unlock on
                this device.
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
              handleUpdateUnlockMethod().catch(() => {});
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
            Firebase sharing and cloud backup remain disabled while guest mode
            is active.
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
