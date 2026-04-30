import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Animated,
  Easing,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import * as Keychain from 'react-native-keychain';
import {
  FaceSmileIcon,
  FingerPrintIcon,
  LockClosedIcon,
  LockOpenIcon,
} from 'react-native-heroicons/solid';

import { useAuth } from '../context/AuthContext';
import { useVaultLock } from '../context/VaultLockContext';
import { styles } from '../theme/styles';
import type { AuthStackParamList } from '../navigation/types';

type Props = NativeStackScreenProps<AuthStackParamList, 'Unlock'>;

export function UnlockScreen({ navigation }: Props) {
  const {
    preferredProtection,
    pinBiometricEnabled,
    isSubmitting,
    authError,
    unlockWithSavedPasskey,
    unlockWithPin,
    unlockWithBiometric,
    clearError,
  } = useAuth();
  const { unlockVault, isCompletingAuthSetup } = useVaultLock();

  const [supportedBiometryType, setSupportedBiometryType] = useState<string | null>(null);
  const [pin, setPin] = useState('');
  const lockOpacity = useRef(new Animated.Value(0)).current;
  const didAutoUnlockRef = useRef(false);

  useEffect(() => {
    lockOpacity.setValue(0);
    Animated.timing(lockOpacity, {
      toValue: 1,
      duration: 360,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();
  }, [lockOpacity]);

  useEffect(() => {
    void Keychain.getSupportedBiometryType()
      .then(type => setSupportedBiometryType(type ?? null))
      .catch(() => setSupportedBiometryType(null));
  }, []);

  const canUnlock = !isSubmitting && preferredProtection !== 'none';

  const handlePasskeyOrBiometricUnlock = async () => {
    clearError();
    const ok =
      preferredProtection === 'passkey'
        ? await unlockWithSavedPasskey()
        : await unlockWithBiometric();
    if (ok) {
      unlockVault();
      if (isCompletingAuthSetup) {
        navigation.replace('CompleteAuthSetup');
      }
    }
  };

  const handlePinUnlock = async (enteredPin: string) => {
    clearError();
    const ok = await unlockWithPin(enteredPin);
    if (ok) {
      unlockVault();
      if (isCompletingAuthSetup) {
        navigation.replace('CompleteAuthSetup');
      }
    }
  };

  // Auto-trigger biometric shortcut for PIN+biometric users.
  useEffect(() => {
    if (
      preferredProtection !== 'pin' ||
      !pinBiometricEnabled ||
      pin.trim().length > 0 ||
      !canUnlock ||
      didAutoUnlockRef.current
    ) {
      return;
    }
    didAutoUnlockRef.current = true;
    const timer = setTimeout(() => {
      void handlePasskeyOrBiometricUnlock();
    }, 220);
    return () => clearTimeout(timer);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [canUnlock, pin, pinBiometricEnabled, preferredProtection]);

  const biometryKind = useMemo(() => {
    const normalized = supportedBiometryType?.toLowerCase() ?? '';
    return normalized.includes('face') ? 'face' : 'fingerprint';
  }, [supportedBiometryType]);

  const hasPinInput = pin.trim().length > 0;
  const isBiometricShortcut = preferredProtection === 'pin' && pinBiometricEnabled && !hasPinInput;
  const isPinAction = preferredProtection === 'pin' && hasPinInput;
  const isPinTooShort = preferredProtection === 'pin' && !isBiometricShortcut && pin.trim().length < 4;
  const isButtonDisabled = !canUnlock || isPinTooShort;

  const UnlockIcon = isBiometricShortcut
    ? biometryKind === 'face'
      ? FaceSmileIcon
      : FingerPrintIcon
    : isButtonDisabled
    ? LockClosedIcon
    : LockOpenIcon;

  const unlockButtonText = isSubmitting
    ? 'Please wait...'
    : preferredProtection === 'passkey'
    ? 'Unlock with Passkey'
    : isPinAction
    ? 'Unlock with PIN'
    : isBiometricShortcut
    ? biometryKind === 'face'
      ? 'Unlock with Face ID'
      : 'Unlock with Fingerprint'
    : 'Unlock with PIN';

  const handleUnlockPress = () => {
    if (preferredProtection === 'pin' && !isBiometricShortcut) {
      void handlePinUnlock(pin);
    } else {
      void handlePasskeyOrBiometricUnlock();
    }
  };

  const handleGoToAuth = () => {
    clearError();
    navigation.navigate('Auth', { accessMode: 'login' });
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 16 : 0}>
      <ScrollView
        contentContainerStyle={[styles.scrollContainer, { flexGrow: 1 }]}
        keyboardShouldPersistTaps="handled">
        <View style={{ flex: 1 }}>
          <View style={styles.introHero}>
            <Animated.View style={[styles.logoPlaceholder, { opacity: lockOpacity }]}>
              <LockClosedIcon size={30} color="#93c5fd" />
            </Animated.View>
            <Text style={styles.brand}>Unlock Vault</Text>
            <Text style={styles.previewTagline}>
              Unlock SecDocVault before accessing your documents.
            </Text>
          </View>

          <View style={{ marginTop: 'auto', paddingTop: 18, paddingBottom: 44, gap: 10 }}>
            <View>
              {authError ? <Text style={styles.errorText}>{authError}</Text> : null}
              {preferredProtection === 'none' ? (
                <Text style={styles.cardMeta}>
                  Unlock is disabled for this account. Use Login / Register below.
                </Text>
              ) : null}
            </View>

            {preferredProtection === 'pin' ? (
              <TextInput
                keyboardType="number-pad"
                returnKeyType="go"
                onSubmitEditing={handleUnlockPress}
                placeholder="Enter PIN"
                placeholderTextColor="#6b7280"
                style={styles.input}
                value={pin}
                secureTextEntry
                onChangeText={v => setPin(v.replace(/[^0-9]/g, ''))}
                editable={!isSubmitting}
                maxLength={12}
              />
            ) : null}

            <Pressable
              disabled={isButtonDisabled}
              onPress={handleUnlockPress}
              style={[
                styles.primaryButton,
                isButtonDisabled && styles.primaryButtonDisabled,
                { marginTop: 0, minHeight: 52, alignItems: 'center', justifyContent: 'center' },
              ]}>
              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
                <UnlockIcon size={20} color="#ffffff" />
                <Text style={styles.primaryButtonText}>{unlockButtonText}</Text>
              </View>
            </Pressable>

            <Pressable
              disabled={isSubmitting}
              onPress={handleGoToAuth}
              style={{ borderRadius: 12, paddingVertical: 12, alignItems: 'center', backgroundColor: '#334155' }}>
              <Text style={styles.primaryButtonText}>
                {isSubmitting ? 'Please wait...' : 'Use Login / Register'}
              </Text>
            </Pressable>
          </View>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
