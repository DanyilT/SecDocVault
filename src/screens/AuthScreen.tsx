import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Animated,
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';

import { useAuth } from '../context/AuthContext';
import { useVaultLock } from '../context/VaultLockContext';
import { GuestLoginNotice } from '../components/GuestLoginNotice.tsx';
import { Header, PrimaryButton, SegmentButton } from '../components/ui';
import { initUserKdfPassphrase } from '../services/crypto/documentCrypto';
import { styles } from '../theme/styles';
import type { AuthMode } from '../types/vault';
import { isVerificationCallbackUrl, resolveVerificationLink } from '../app/navigation/urlVerification';
import { useAuthLinkingFlow } from '../app/hooks/useAuthLinkingFlow';
import type { AuthStackParamList } from '../navigation/types';

type Props = NativeStackScreenProps<AuthStackParamList, 'Auth'>;

export function AuthScreen({ route, navigation }: Props) {
  const { accessMode: initialAccessMode } = route.params;

  const {
    isSubmitting,
    authError,
    preferredProtection,
    clearError,
    signIn,
    signUp,
    resendVerificationEmail,
    completeEmailLinkRegistration,
    sendPasswordResetEmail,
    registerGuestAccount,
    loginGuestAccount,
  } = useAuth();
  const { startAuthSetup, unlockVault } = useVaultLock();

  // Form state — all managed locally now.
  const [accessMode, setAccessMode] = useState<'login' | 'guest'>(initialAccessMode);
  const [authMode, setAuthMode] = useState<AuthMode>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [vaultPassphrase, setVaultPassphrase] = useState('');
  const [confirmVaultPassphrase, setConfirmVaultPassphrase] = useState('');
  const [emailVerifiedForRegistration, setEmailVerifiedForRegistration] = useState(false);
  const [verificationLinkInput, setVerificationLinkInput] = useState('');
  const [verificationCooldown, setVerificationCooldown] = useState(0);
  const [verificationEmailSent, setVerificationEmailSent] = useState(false);
  const [authNotice, setAuthNotice] = useState<string | null>(null);

  // UI animation refs.
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [showVaultPassphrase, setShowVaultPassphrase] = useState(false);
  const [showConfirmVaultPassphrase, setShowConfirmVaultPassphrase] = useState(false);
  const passwordInputRef = useRef<TextInput | null>(null);
  const footerShift = useRef(new Animated.Value(0)).current;
  const formTransition = useRef(new Animated.Value(1)).current;
  const [isKeyboardVisible, setIsKeyboardVisible] = useState(false);

  // Cooldown timer.
  useEffect(() => {
    if (verificationCooldown <= 0) return;
    const timer = setInterval(() => {
      setVerificationCooldown(prev => Math.max(0, prev - 1));
    }, 1000);
    return () => clearInterval(timer);
  }, [verificationCooldown]);

  // Deep-link email verification.
  useAuthLinkingFlow({
    accessMode,
    authMode,
    email,
    isVerificationCallbackUrl,
    resolveVerificationLink,
    completeEmailLinkRegistration,
    setEmailVerifiedForRegistration,
    setAccountStatus: msg => setAuthNotice(msg),
    setAuthNotice,
  });

  // ── Derived state ──────────────────────────────────────────────
  const isRegisterLogin = authMode === 'register' && accessMode === 'login';
  const isVerificationPending = isRegisterLogin && !emailVerifiedForRegistration && verificationCooldown > 0;
  const hasTypedPassword = password.trim().length > 0;
  const isPasswordValid =
    password.trim().length >= 8 &&
    /[a-zA-Z]/.test(password) &&
    /[0-9]/.test(password) &&
    /[^a-zA-Z0-9]/.test(password);
  const isPasswordMismatch =
    authMode === 'register' &&
    confirmPassword.trim().length > 0 &&
    isPasswordValid &&
    password !== confirmPassword;

  const passwordWarning = useMemo(() => {
    if (!hasTypedPassword || authMode !== 'register') return '';
    const pwd = password.trim();
    const missing: string[] = [];
    if (pwd.length < 8) missing.push('at least 8 characters');
    if (!/[a-zA-Z]/.test(pwd)) missing.push('a letter');
    if (!/[0-9]/.test(pwd)) missing.push('a number');
    if (!/[^a-zA-Z0-9]/.test(pwd)) missing.push('a special character (e.g. !, @, #)');
    if (missing.length > 0) return `Password needs: ${missing.join(', ')}.`;
    if (isPasswordMismatch) return 'Passwords do not match.';
    return '';
  }, [authMode, hasTypedPassword, isPasswordMismatch, password]);

  const hasTypedVaultPassphrase = vaultPassphrase.trim().length > 0;
  const isVaultPassphraseTooShort = hasTypedVaultPassphrase && vaultPassphrase.trim().length < 8;
  const isVaultPassphraseMismatch =
    authMode === 'register' &&
    confirmVaultPassphrase.trim().length > 0 &&
    vaultPassphrase.trim().length >= 8 &&
    vaultPassphrase !== confirmVaultPassphrase;

  const vaultPassphraseWarning = useMemo(() => {
    if (isVaultPassphraseTooShort) return 'Vault passphrase must be at least 8 characters.';
    if (isVaultPassphraseMismatch) return 'Vault passphrases do not match.';
    return '';
  }, [isVaultPassphraseMismatch, isVaultPassphraseTooShort]);

  const canSubmitAuth = useMemo(() => {
    if (isSubmitting) return false;
    if (accessMode === 'guest') {
      if (authMode === 'register') {
        return (
          isPasswordValid &&
          password === confirmPassword &&
          vaultPassphrase.trim().length >= 8 &&
          vaultPassphrase === confirmVaultPassphrase
        );
      }
      return password.trim().length > 0;
    }
    if (authMode === 'login') {
      return email.trim().length > 4 && password.trim().length > 0;
    }
    // register + login
    return (
      email.trim().length > 4 &&
      emailVerifiedForRegistration &&
      isPasswordValid &&
      password === confirmPassword &&
      vaultPassphrase.trim().length >= 8 &&
      vaultPassphrase === confirmVaultPassphrase
    );
  }, [
    accessMode,
    authMode,
    confirmPassword,
    confirmVaultPassphrase,
    email,
    emailVerifiedForRegistration,
    isPasswordValid,
    isSubmitting,
    password,
    vaultPassphrase,
  ]);

  // ── Auth handlers ──────────────────────────────────────────────
  const handleAuth = async () => {
    clearError();
    setAuthNotice(null);

    if (accessMode === 'guest') {
      if (authMode === 'register') {
        await initUserKdfPassphrase(vaultPassphrase.trim());
        const ok = await registerGuestAccount(password.trim());
        if (ok) {
          startAuthSetup();
          navigation.navigate('CompleteAuthSetup');
        }
      } else {
        const ok = await loginGuestAccount(password.trim());
        if (ok) {
          if (!preferredProtection) {
            startAuthSetup();
            navigation.navigate('CompleteAuthSetup');
          } else {
            unlockVault();
          }
        }
      }
      return;
    }

    if (authMode === 'login') {
      const ok = await signIn(email.trim(), password);
      if (ok) {
        if (!preferredProtection) {
          startAuthSetup();
          navigation.navigate('CompleteAuthSetup');
        } else {
          unlockVault();
        }
      }
    } else {
      await initUserKdfPassphrase(vaultPassphrase.trim());
      const ok = await signUp(email.trim(), password);
      if (ok) {
        startAuthSetup();
        navigation.navigate('CompleteAuthSetup');
      }
    }
  };

  const handleResendVerificationEmail = async () => {
    clearError();
    const ok = await resendVerificationEmail(email.trim());
    if (ok) {
      setVerificationCooldown(60);
      setVerificationEmailSent(true);
      setAuthNotice('Verification email sent. Check your inbox and spam folder.');
    }
  };

  const handleVerifyEmailLinkManually = async () => {
    clearError();
    const ok = await completeEmailLinkRegistration(verificationLinkInput.trim(), email.trim());
    if (ok) {
      setEmailVerifiedForRegistration(true);
      setAuthNotice('Email verified. You can now create your account.');
    }
  };

  const handleResetPassword = async () => {
    clearError();
    const ok = await sendPasswordResetEmail(email.trim());
    if (ok) setAuthNotice('Password reset email sent. Check your inbox.');
  };

  // ── Animations ─────────────────────────────────────────────────
  useEffect(() => {
    const show = Keyboard.addListener('keyboardDidShow', () => setIsKeyboardVisible(true));
    const hide = Keyboard.addListener('keyboardDidHide', () => setIsKeyboardVisible(false));
    return () => { show.remove(); hide.remove(); };
  }, []);

  useEffect(() => {
    formTransition.setValue(0.92);
    Animated.timing(formTransition, { toValue: 1, duration: 200, useNativeDriver: true }).start();
  }, [accessMode, authMode, formTransition]);

  useEffect(() => {
    Animated.timing(footerShift, {
      toValue: isKeyboardVisible ? -6 : 0,
      duration: 180,
      useNativeDriver: true,
    }).start();
  }, [footerShift, isKeyboardVisible]);

  // ── Derived UI ─────────────────────────────────────────────────
  const emailBorderColor = isRegisterLogin
    ? emailVerifiedForRegistration
      ? '#22c55e'
      : isVerificationPending
      ? '#f59e0b'
      : '#374151'
    : '#374151';

  const showPasswordErrorBorder =
    authMode === 'register' && hasTypedPassword && (!isPasswordValid || isPasswordMismatch);
  const showConfirmErrorBorder =
    authMode === 'register' && confirmPassword.trim().length > 0 && isPasswordMismatch;
  const showForgotPasswordLink =
    accessMode === 'login' &&
    authMode === 'login' &&
    hasTypedPassword &&
    Boolean(authError && authError.toLowerCase().includes('invalid email or password'));

  // ── Render ─────────────────────────────────────────────────────
  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 16 : 0}>
      <Header
        title={authMode === 'login' ? 'Welcome Back' : 'Create Your Account'}
        showBack
        onBack={() => { clearError(); navigation.goBack(); }}
      />

      <ScrollView
        contentContainerStyle={[styles.scrollContainer, { paddingBottom: 20 }]}
        keyboardShouldPersistTaps="handled">
        <Animated.View
          style={{
            opacity: formTransition,
            transform: [{ translateY: formTransition.interpolate({ inputRange: [0.92, 1], outputRange: [6, 0] }) }],
          }}>

          <View style={[styles.segmentRow, { marginBottom: 10 }]}>
            <SegmentButton
              label={authMode.charAt(0).toUpperCase() + authMode.slice(1)}
              isActive={accessMode === 'login'}
              onPress={() => setAccessMode('login')}
            />
            <SegmentButton
              label={authMode.charAt(0).toUpperCase() + authMode.slice(1) + ' as Guest'}
              isActive={accessMode === 'guest'}
              onPress={() => setAccessMode('guest')}
            />
          </View>

          {accessMode === 'guest' ? (
            <View style={{ marginBottom: 10 }}>
              <GuestLoginNotice />
              <Text style={[styles.subtitle, { marginTop: 8, marginBottom: 0 }]}>
                {authMode === 'register'
                  ? 'Create a local guest account on this device. Registering again can erase the previous guest vault.'
                  : 'Sign in to your local guest account with the same password used at registration.'}
              </Text>
            </View>
          ) : null}

          {isRegisterLogin ? (
            <Text style={[styles.subtitle, { marginBottom: 12 }]}>
              Verify your email first. You can open the email link on this phone, or paste the link below if opened on another device.
            </Text>
          ) : null}

          <View style={[styles.fieldGroup, { marginTop: 8 }]}>
            {accessMode === 'login' ? (
              <View style={[styles.fieldGroup, { marginBottom: 8 }]}>
                <View style={{ flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderColor: emailBorderColor, borderRadius: 12, backgroundColor: '#111827', paddingHorizontal: 12 }}>
                  <TextInput
                    autoCapitalize="none"
                    keyboardType="email-address"
                    placeholder="Email"
                    placeholderTextColor="#6b7280"
                    style={[styles.input, { flex: 1, borderWidth: 0, paddingHorizontal: 0 }]}
                    value={email}
                    onChangeText={setEmail}
                    returnKeyType={isRegisterLogin && emailVerifiedForRegistration ? 'next' : 'send'}
                    onSubmitEditing={() => {
                      if (!isRegisterLogin) { passwordInputRef.current?.focus(); return; }
                      if (emailVerifiedForRegistration) { passwordInputRef.current?.focus(); return; }
                      if (verificationCooldown <= 0 && email.trim().length > 4) {
                        void handleResendVerificationEmail();
                      }
                    }}
                  />
                  {isRegisterLogin && emailVerifiedForRegistration ? (
                    <Text style={{ color: '#22c55e', fontWeight: '700' }}>✓ Verified</Text>
                  ) : null}
                </View>

                {isRegisterLogin ? (
                  <>
                    {isVerificationPending ? (
                      <Text style={[styles.warningText, { marginTop: 2 }]}>Verification link sent. Check inbox and spam folder.</Text>
                    ) : null}
                    {emailVerifiedForRegistration ? (
                      <Text style={[styles.subtitle, { color: '#22c55e', marginBottom: 0 }]}>Email verified. You can now create your account.</Text>
                    ) : null}
                    {!emailVerifiedForRegistration ? (
                      <>
                        <PrimaryButton
                          label={verificationCooldown > 0 ? `Resend in ${verificationCooldown}s` : 'Send Verification Email'}
                          onPress={() => void handleResendVerificationEmail()}
                          disabled={verificationCooldown > 0 || email.trim().length < 5 || isSubmitting}
                        />
                        {verificationEmailSent ? (
                          <>
                            <TextInput
                              autoCapitalize="none"
                              placeholder="Paste verification link here"
                              placeholderTextColor="#6b7280"
                              style={styles.input}
                              value={verificationLinkInput}
                              onChangeText={setVerificationLinkInput}
                              returnKeyType="done"
                              onSubmitEditing={() => { if (verificationLinkInput.trim().length > 0) void handleVerifyEmailLinkManually(); }}
                            />
                            <PrimaryButton
                              label="Verify Link"
                              onPress={() => void handleVerifyEmailLinkManually()}
                              disabled={verificationLinkInput.trim().length === 0 || isSubmitting}
                            />
                          </>
                        ) : null}
                      </>
                    ) : null}
                  </>
                ) : null}
              </View>
            ) : null}

            <View style={{ flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderColor: showPasswordErrorBorder ? '#ef4444' : '#374151', borderRadius: 12, backgroundColor: '#111827', paddingHorizontal: 12 }}>
              <TextInput
                ref={passwordInputRef}
                autoCapitalize="none"
                secureTextEntry={!showPassword}
                placeholder={accessMode === 'guest' ? 'Guest Password' : 'Password'}
                placeholderTextColor="#6b7280"
                style={[styles.input, { flex: 1, borderWidth: 0, paddingHorizontal: 0 }]}
                value={password}
                onChangeText={setPassword}
              />
              <Pressable onPress={() => setShowPassword(p => !p)}>
                <Text style={styles.secondaryButtonText}>{showPassword ? 'Hide' : 'Show'}</Text>
              </Pressable>
            </View>

            {showForgotPasswordLink ? (
              <Pressable onPress={() => void handleResetPassword()} disabled={isSubmitting} style={{ alignSelf: 'flex-start', marginTop: 4 }}>
                <Text style={{ color: '#60a5fa', fontSize: 13, fontWeight: '600' }}>Forgot password? Reset password</Text>
              </Pressable>
            ) : null}

            {authMode === 'register' ? (
              <View style={{ flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderColor: showConfirmErrorBorder ? '#ef4444' : '#374151', borderRadius: 12, backgroundColor: '#111827', paddingHorizontal: 12 }}>
                <TextInput
                  autoCapitalize="none"
                  secureTextEntry={!showConfirmPassword}
                  placeholder={accessMode === 'guest' ? 'Confirm Guest Password' : 'Confirm Password'}
                  placeholderTextColor="#6b7280"
                  style={[styles.input, { flex: 1, borderWidth: 0, paddingHorizontal: 0 }]}
                  value={confirmPassword}
                  onChangeText={setConfirmPassword}
                />
                <Pressable onPress={() => setShowConfirmPassword(p => !p)}>
                  <Text style={styles.secondaryButtonText}>{showConfirmPassword ? 'Hide' : 'Show'}</Text>
                </Pressable>
              </View>
            ) : null}

            {passwordWarning ? <Text style={styles.errorText}>{passwordWarning}</Text> : null}

            {authMode === 'register' ? (
              <>
                <Text style={[styles.subtitle, { marginTop: 12, marginBottom: 4 }]}>
                  Passphrase is used to backup encryption keys. Make sure to remember it, as it cannot be recovered.
                </Text>
                <View style={{ flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderColor: isVaultPassphraseTooShort ? '#ef4444' : '#374151', borderRadius: 12, backgroundColor: '#111827', paddingHorizontal: 12 }}>
                  <TextInput
                    autoCapitalize="none"
                    secureTextEntry={!showVaultPassphrase}
                    placeholder="Vault Passphrase (min 8 chars)"
                    placeholderTextColor="#6b7280"
                    style={[styles.input, { flex: 1, borderWidth: 0, paddingHorizontal: 0 }]}
                    value={vaultPassphrase}
                    onChangeText={setVaultPassphrase}
                  />
                  <Pressable onPress={() => setShowVaultPassphrase(p => !p)}>
                    <Text style={styles.secondaryButtonText}>{showVaultPassphrase ? 'Hide' : 'Show'}</Text>
                  </Pressable>
                </View>
                <View style={{ flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderColor: isVaultPassphraseMismatch ? '#ef4444' : '#374151', borderRadius: 12, backgroundColor: '#111827', paddingHorizontal: 12 }}>
                  <TextInput
                    autoCapitalize="none"
                    secureTextEntry={!showConfirmVaultPassphrase}
                    placeholder="Confirm Vault Passphrase"
                    placeholderTextColor="#6b7280"
                    style={[styles.input, { flex: 1, borderWidth: 0, paddingHorizontal: 0 }]}
                    value={confirmVaultPassphrase}
                    onChangeText={setConfirmVaultPassphrase}
                  />
                  <Pressable onPress={() => setShowConfirmVaultPassphrase(p => !p)}>
                    <Text style={styles.secondaryButtonText}>{showConfirmVaultPassphrase ? 'Hide' : 'Show'}</Text>
                  </Pressable>
                </View>
                {vaultPassphraseWarning ? <Text style={styles.errorText}>{vaultPassphraseWarning}</Text> : null}
              </>
            ) : null}
          </View>

          {authError ? <Text style={styles.errorText}>{authError}</Text> : null}
          {authNotice ? <Text style={[styles.subtitle, { color: '#fbbf24' }]}>{authNotice}</Text> : null}

          <View style={{ marginTop: 12 }}>
            <PrimaryButton
              label={
                isSubmitting
                  ? 'Please wait...'
                  : accessMode === 'guest'
                  ? authMode === 'register'
                    ? 'Create Guest Account'
                    : 'Login as Guest'
                  : authMode === 'login'
                  ? 'Sign In'
                  : 'Create Account'
              }
              disabled={isSubmitting || !canSubmitAuth}
              onPress={() => void handleAuth()}
            />
          </View>

          <Animated.View style={[styles.footerView, { marginTop: 14, transform: [{ translateY: footerShift }] }]}>
            <View style={styles.footerActions}>
              <SegmentButton
                label={authMode === 'login' ? 'Need an account? Register' : 'Back to Login'}
                isActive={false}
                onPress={() => setAuthMode(authMode === 'login' ? 'register' : 'login')}
              />
            </View>
          </Animated.View>
        </Animated.View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
