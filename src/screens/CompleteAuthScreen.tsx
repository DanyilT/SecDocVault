import React, { useEffect, useMemo, useState } from 'react';
import { Pressable, ScrollView, Switch, Text, TextInput, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import * as Keychain from 'react-native-keychain';

import { useAuth } from '../context/AuthContext';
import { useVaultLock } from '../context/VaultLockContext';
import { Header, PrimaryButton, SegmentButton } from '../components/ui';
import { hasKdfPassphrase, restoreKdfPassphrase, setRecoveryPassphrase } from '../services/crypto/documentCrypto';
import { styles } from '../theme/styles';
import type { AuthProtection } from '../types/vault';
import type { AuthStackParamList } from '../navigation/types';

type Props = NativeStackScreenProps<AuthStackParamList, 'CompleteAuthSetup'>;

export function CompleteAuthScreen(_props: Props) {
  const { isSubmitting, authError, updateUnlockMethod, clearError } = useAuth();
  const { finishAuthSetup } = useVaultLock();

  const [method, setMethod] = useState<AuthProtection>('pin');
  const [pin, setPin] = useState('');
  const [confirmPin, setConfirmPin] = useState('');
  const [canUseBiometric, setCanUseBiometric] = useState(false);
  const [useBiometricForPin, setUseBiometricForPin] = useState(false);

  const [passphraseNeeded, setPassphraseNeeded] = useState(false);
  const [passphraseReady, setPassphraseReady] = useState(false);
  const [loginPassphrase, setLoginPassphrase] = useState('');
  const [showLoginPassphrase, setShowLoginPassphrase] = useState(false);
  const [passphraseError, setPassphraseError] = useState('');
  const [isSettingPassphrase, setIsSettingPassphrase] = useState(false);

  useEffect(() => {
    void hasKdfPassphrase().then(has => {
      setPassphraseNeeded(!has);
      setPassphraseReady(true);
    });
  }, []);

  useEffect(() => {
    void Keychain.getSupportedBiometryType()
      .then(type => {
        const supported = Boolean(type);
        setCanUseBiometric(supported);
        if (!supported) setUseBiometricForPin(false);
      })
      .catch(() => {
        setCanUseBiometric(false);
        setUseBiometricForPin(false);
      });
  }, []);

  const handlePassphraseSetup = async () => {
    const normalized = loginPassphrase.trim();
    if (normalized.length < 8) {
      setPassphraseError('Passphrase must be at least 8 characters.');
      return;
    }
    setIsSettingPassphrase(true);
    setPassphraseError('');
    try {
      await restoreKdfPassphrase(normalized);
      await setRecoveryPassphrase(normalized);
      setPassphraseNeeded(false);
    } catch (err) {
      setPassphraseError(err instanceof Error ? err.message : 'Failed to restore passphrase.');
    } finally {
      setIsSettingPassphrase(false);
    }
  };

  const pinError = useMemo(() => {
    if (method !== 'pin') return '';
    if (pin.length > 0 && pin.length < 4) return 'PIN must be at least 4 digits.';
    if (confirmPin.length > 0 && pin !== confirmPin) return 'PIN entries do not match.';
    return '';
  }, [confirmPin, method, pin]);

  const canContinue =
    method !== 'pin' || (pin.length >= 4 && confirmPin.length >= 4 && pin === confirmPin);

  const handleComplete = async () => {
    clearError();
    const ok = await updateUnlockMethod(method, {
      pin: method === 'pin' ? pin : undefined,
      pinBiometricEnabled: method === 'pin' ? useBiometricForPin : false,
    });
    if (ok) finishAuthSetup();
  };

  if (passphraseReady && passphraseNeeded) {
    return (
      <View style={styles.container}>
        <Header title="Enter Vault Passphrase" />
        <ScrollView contentContainerStyle={styles.scrollContainer}>
          <Text style={styles.subtitle}>
            Enter the passphrase you set when you created your account. It is used to protect your encrypted document keys.
          </Text>
          <View style={styles.card}>
            <Text style={styles.sectionLabel}>Vault Passphrase</Text>
            <View style={{ flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderColor: '#374151', borderRadius: 12, backgroundColor: '#111827', paddingHorizontal: 12 }}>
              <TextInput
                autoCapitalize="none"
                secureTextEntry={!showLoginPassphrase}
                placeholder="Vault passphrase"
                placeholderTextColor="#6b7280"
                style={[styles.input, { flex: 1, borderWidth: 0, paddingHorizontal: 0 }]}
                value={loginPassphrase}
                onChangeText={text => { setLoginPassphrase(text); setPassphraseError(''); }}
                editable={!isSettingPassphrase}
              />
              <Pressable onPress={() => setShowLoginPassphrase(p => !p)}>
                <Text style={styles.secondaryButtonText}>{showLoginPassphrase ? 'Hide' : 'Show'}</Text>
              </Pressable>
            </View>
            {passphraseError ? <Text style={styles.errorText}>{passphraseError}</Text> : null}
          </View>
          <PrimaryButton
            label={isSettingPassphrase ? 'Please wait...' : 'Continue'}
            disabled={isSettingPassphrase || loginPassphrase.trim().length < 8}
            onPress={() => void handlePassphraseSetup()}
          />
          <Pressable
            disabled={isSettingPassphrase}
            onPress={() => setPassphraseNeeded(false)}
            style={{ borderRadius: 12, paddingVertical: 12, alignItems: 'center', backgroundColor: '#334155', marginTop: 4 }}>
            <Text style={styles.primaryButtonText}>Skip for now</Text>
          </Pressable>
        </ScrollView>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Header title="Set Unlock Method" />
      <ScrollView contentContainerStyle={styles.scrollContainer}>
        <Text style={styles.subtitle}>
          Choose how SecDocVault should unlock after this login.
        </Text>

        <View style={styles.card}>
          <Text style={styles.sectionLabel}>Unlock Method</Text>
          <View style={styles.segmentRow}>
            <SegmentButton label="PIN" isActive={method === 'pin'} onPress={() => setMethod('pin')} />
            <SegmentButton label="Passkey" isActive={method === 'passkey'} onPress={() => setMethod('passkey')} />
            <SegmentButton label="None" isActive={method === 'none'} onPress={() => setMethod('none')} />
          </View>
          <Text style={styles.subtitle}>
            {method === 'pin'
              ? 'PIN unlock is local to this device and does not re-authenticate your account.'
              : method === 'passkey'
              ? 'Passkey unlock re-authenticates this account from a saved credential.'
              : 'No unlock method is saved. After lock, you must sign in again.'}
          </Text>
        </View>

        {method === 'pin' ? (
          <View style={styles.card}>
            <Text style={styles.sectionLabel}>Create PIN</Text>
            <TextInput
              keyboardType="number-pad"
              placeholder="Enter PIN"
              placeholderTextColor="#6b7280"
              style={styles.input}
              value={pin}
              onChangeText={v => setPin(v.replace(/[^0-9]/g, ''))}
              secureTextEntry
              editable={!isSubmitting}
              maxLength={12}
            />
            <TextInput
              keyboardType="number-pad"
              placeholder="Confirm PIN"
              placeholderTextColor="#6b7280"
              style={styles.input}
              value={confirmPin}
              onChangeText={v => setConfirmPin(v.replace(/[^0-9]/g, ''))}
              secureTextEntry
              editable={!isSubmitting}
              maxLength={12}
            />
            {canUseBiometric ? (
              <View style={styles.switchRow}>
                <Text style={styles.switchLabel}>Enable biometric unlock with this PIN</Text>
                <Switch
                  value={useBiometricForPin}
                  onValueChange={setUseBiometricForPin}
                  disabled={isSubmitting}
                />
              </View>
            ) : null}
            {pinError ? <Text style={styles.errorText}>{pinError}</Text> : null}
          </View>
        ) : null}

        {authError ? <Text style={styles.errorText}>{authError}</Text> : null}

        <PrimaryButton
          label={isSubmitting ? 'Please wait...' : 'Complete Setup'}
          disabled={isSubmitting || !canContinue || Boolean(pinError)}
          onPress={() => void handleComplete()}
        />
      </ScrollView>
    </View>
  );
}
