import React, { useEffect, useMemo, useState } from 'react';
import { ScrollView, Switch, Text, TextInput, View } from 'react-native';
import * as Keychain from 'react-native-keychain';

import { Header, PrimaryButton, SegmentButton } from '../components/ui';
import { styles } from '../theme/styles';
import { AuthProtection } from '../types/vault';

export function CompleteAuthScreen({
  isSubmitting,
  authError,
  onComplete,
}: {
  isSubmitting: boolean;
  authError: string | null;
  onComplete: (payload: { method: AuthProtection; pin?: string; useBiometricForPin: boolean }) => Promise<void>;
}) {
  const [method, setMethod] = useState<AuthProtection>('pin');
  const [pin, setPin] = useState('');
  const [confirmPin, setConfirmPin] = useState('');
  const [canUseBiometric, setCanUseBiometric] = useState(false);
  const [useBiometricForPin, setUseBiometricForPin] = useState(false);

  useEffect(() => {
    void Keychain.getSupportedBiometryType()
      .then(type => {
        const supported = Boolean(type);
        setCanUseBiometric(supported);
        if (!supported) {
          setUseBiometricForPin(false);
        }
      })
      .catch(() => {
        setCanUseBiometric(false);
        setUseBiometricForPin(false);
      });
  }, []);

  const pinError = useMemo(() => {
    if (method !== 'pin') {
      return '';
    }
    if (pin.length > 0 && pin.length < 4) {
      return 'PIN must be at least 4 digits.';
    }
    if (confirmPin.length > 0 && pin !== confirmPin) {
      return 'PIN entries do not match.';
    }
    return '';
  }, [confirmPin, method, pin]);

  const canContinue =
    method !== 'pin' ||
    (pin.length >= 4 && confirmPin.length >= 4 && pin === confirmPin);

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
              onChangeText={value => setPin(value.replace(/[^0-9]/g, ''))}
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
              onChangeText={value => setConfirmPin(value.replace(/[^0-9]/g, ''))}
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
          onPress={() => {
            void onComplete({
              method,
              pin: method === 'pin' ? pin : undefined,
              useBiometricForPin: method === 'pin' ? useBiometricForPin : false,
            });
          }}
        />
      </ScrollView>
    </View>
  );
}
