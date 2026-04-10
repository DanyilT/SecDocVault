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

import { Header, PrimaryButton, SegmentButton } from '../components/ui';
import { GuestLoginNotice } from '../components/GuestLoginNotice.tsx';
import { styles } from '../theme/styles';
import { AuthMode } from '../types/vault';

export function AuthScreen({
  accessMode,
  authMode,
  email,
  password,
  confirmPassword,
  canSubmitAuth,
  isSubmitting,
  authError,
  authNotice,
  emailVerifiedForRegistration,
  verificationCooldown,
  verificationLinkInput,
  setAccessMode,
  setAuthMode,
  setEmail,
  setPassword,
  setConfirmPassword,
  setVerificationLinkInput,
  onResendVerificationEmail,
  onVerifyEmailLinkManually,
  onResetPassword,
  handleAuth,
  onBackToHero,
}: {
  accessMode: 'login' | 'guest';
  authMode: AuthMode;
  email: string;
  password: string;
  confirmPassword: string;
  canSubmitAuth: boolean;
  isSubmitting: boolean;
  authError: string | null;
  authNotice: string | null;
  emailVerifiedForRegistration: boolean;
  verificationCooldown: number;
  verificationLinkInput: string;
  setAccessMode: (mode: 'login' | 'guest') => void;
  setAuthMode: (mode: AuthMode) => void;
  setEmail: (value: string) => void;
  setPassword: (value: string) => void;
  setConfirmPassword: (value: string) => void;
  setVerificationLinkInput: (value: string) => void;
  onResendVerificationEmail: () => Promise<void>;
  onVerifyEmailLinkManually: () => Promise<void>;
  onResetPassword: () => Promise<void>;
  handleAuth: () => Promise<void>;
  onBackToHero: () => void;
}) {
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const passwordInputRef = useRef<TextInput | null>(null);
  const verificationPanelOpacity = useRef(new Animated.Value(0)).current;
  const statusHintOpacity = useRef(new Animated.Value(0)).current;
  const footerShift = useRef(new Animated.Value(0)).current;
  const formTransition = useRef(new Animated.Value(1)).current;
  const [isKeyboardVisible, setIsKeyboardVisible] = useState(false);

  const isRegisterLogin = authMode === 'register' && accessMode === 'login';
  const isVerificationPending = isRegisterLogin && !emailVerifiedForRegistration && verificationCooldown > 0;
  const hasTypedPassword = password.trim().length > 0;
  const isPasswordTooShort = hasTypedPassword && password.trim().length < 6;
  const isPasswordMismatch =
    authMode === 'register' &&
    confirmPassword.trim().length > 0 &&
    password.trim().length >= 6 &&
    password !== confirmPassword;

  const passwordWarning = useMemo(() => {
    if (isPasswordTooShort) {
      return 'Password must be at least 6 characters.';
    }

    if (isPasswordMismatch) {
      return 'Passwords do not match.';
    }

    return '';
  }, [isPasswordMismatch, isPasswordTooShort]);

  const verificationButtonLabel =
    verificationCooldown > 0 ? `Resend in ${verificationCooldown}s` : 'Send Verification Email';

  useEffect(() => {
    Animated.timing(verificationPanelOpacity, {
      toValue: isRegisterLogin && !emailVerifiedForRegistration ? 1 : 0,
      duration: 220,
      useNativeDriver: true,
    }).start();
  }, [emailVerifiedForRegistration, isRegisterLogin, verificationPanelOpacity]);

  useEffect(() => {
    Animated.timing(statusHintOpacity, {
      toValue: isVerificationPending || emailVerifiedForRegistration ? 1 : 0,
      duration: 200,
      useNativeDriver: true,
    }).start();
  }, [emailVerifiedForRegistration, isVerificationPending, statusHintOpacity]);

  useEffect(() => {
    const showSub = Keyboard.addListener('keyboardDidShow', () => setIsKeyboardVisible(true));
    const hideSub = Keyboard.addListener('keyboardDidHide', () => setIsKeyboardVisible(false));
    return () => {
      showSub.remove();
      hideSub.remove();
    };
  }, []);

  useEffect(() => {
    formTransition.setValue(0.92);
    Animated.timing(formTransition, {
      toValue: 1,
      duration: 200,
      useNativeDriver: true,
    }).start();
  }, [accessMode, authMode, formTransition]);

  useEffect(() => {
    Animated.timing(footerShift, {
      toValue: isKeyboardVisible ? -6 : 0,
      duration: 180,
      useNativeDriver: true,
    }).start();
  }, [footerShift, isKeyboardVisible]);

  const emailBorderColor = isRegisterLogin
    ? emailVerifiedForRegistration
      ? '#22c55e'
      : isVerificationPending
      ? '#f59e0b'
      : '#374151'
    : '#374151';

  const showPasswordErrorBorder = hasTypedPassword && (isPasswordTooShort || isPasswordMismatch);
  const showConfirmErrorBorder =
    authMode === 'register' && confirmPassword.trim().length > 0 && (isPasswordTooShort || isPasswordMismatch);
  const showForgotPasswordLink =
    accessMode === 'login' &&
    authMode === 'login' &&
    hasTypedPassword &&
    Boolean(authError && authError.toLowerCase().includes('invalid email or password'));

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 16 : 0}
    >
      <Header
        title={authMode === 'login' ? 'Welcome Back' : 'Create Your Account'}
        showBack
        onBack={onBackToHero}
      />

      <ScrollView
        contentContainerStyle={[styles.scrollContainer, { paddingBottom: 20 }]}
        keyboardShouldPersistTaps="handled"
      >
        <Animated.View
          style={{
            opacity: formTransition,
            transform: [
              {
                translateY: formTransition.interpolate({
                  inputRange: [0.92, 1],
                  outputRange: [6, 0],
                }),
              },
            ],
          }}
        >
        <View style={[styles.segmentRow, { marginBottom: 10 }]}>
          <SegmentButton
            label={authMode.charAt(0).toUpperCase() + authMode.slice(1)}
            isActive={accessMode === 'login'}
            onPress={() => setAccessMode('login')}
          />
          <SegmentButton
            label={
              authMode.charAt(0).toUpperCase() + authMode.slice(1) + ' as Guest'
            }
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
              <View
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  borderWidth: 1,
                  borderColor: emailBorderColor,
                  borderRadius: 12,
                  backgroundColor: '#111827',
                  paddingHorizontal: 12,
                }}
              >
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
                    if (!isRegisterLogin) {
                      passwordInputRef.current?.focus();
                      return;
                    }

                    if (emailVerifiedForRegistration) {
                      passwordInputRef.current?.focus();
                      return;
                    }

                    if (verificationCooldown <= 0 && email.trim().length > 4) {
                      void onResendVerificationEmail();
                    }
                  }}
                />

                {isRegisterLogin ? (
                  emailVerifiedForRegistration ? (
                    <Text style={{ color: '#22c55e', fontWeight: '700' }}>✓ Verified</Text>
                  ) : (
                    <Pressable
                      onPress={() => {
                        if (verificationCooldown > 0 || email.trim().length < 5) {
                          return;
                        }
                        void onResendVerificationEmail();
                      }}
                    >
                      <Text style={styles.secondaryButtonText}>{verificationButtonLabel}</Text>
                    </Pressable>
                  )
                ) : null}
              </View>

              {isRegisterLogin ? (
                <>
                  <Animated.View
                    pointerEvents={isVerificationPending || emailVerifiedForRegistration ? 'auto' : 'none'}
                    style={{
                      opacity: statusHintOpacity,
                      transform: [
                        {
                          translateY: statusHintOpacity.interpolate({
                            inputRange: [0, 1],
                            outputRange: [-4, 0],
                          }),
                        },
                      ],
                    }}
                  >
                    {isVerificationPending ? (
                      <Text style={[styles.warningText, { marginTop: 2 }]}>Verification link sent. Check inbox and spam folder.</Text>
                    ) : null}
                    {emailVerifiedForRegistration ? (
                      <Text style={[styles.subtitle, { color: '#22c55e', marginBottom: 0 }]}>Email verified. You can now create your account.</Text>
                    ) : null}
                  </Animated.View>

                  <Animated.View
                    pointerEvents={!emailVerifiedForRegistration ? 'auto' : 'none'}
                    style={{
                      opacity: verificationPanelOpacity,
                      maxHeight: emailVerifiedForRegistration ? 0 : 72,
                      overflow: 'hidden',
                      transform: [
                        {
                          translateY: verificationPanelOpacity.interpolate({
                            inputRange: [0, 1],
                            outputRange: [-8, 0],
                          }),
                        },
                      ],
                    }}
                  >
                    <View
                      style={{
                        flexDirection: 'row',
                        alignItems: 'center',
                        borderWidth: 1,
                        borderColor: '#374151',
                        borderRadius: 12,
                        backgroundColor: '#111827',
                        paddingHorizontal: 12,
                      }}
                    >
                      <TextInput
                        autoCapitalize="none"
                        placeholder="Paste verification link here"
                        placeholderTextColor="#6b7280"
                        style={[styles.input, { flex: 1, borderWidth: 0, paddingHorizontal: 0 }]}
                        value={verificationLinkInput}
                        onChangeText={setVerificationLinkInput}
                        returnKeyType="done"
                        onSubmitEditing={() => {
                          if (verificationLinkInput.trim().length > 0) {
                            void onVerifyEmailLinkManually();
                          }
                        }}
                      />
                      <Pressable
                        onPress={() => {
                          if (verificationLinkInput.trim().length === 0 || isSubmitting) {
                            return;
                          }
                          void onVerifyEmailLinkManually();
                        }}
                      >
                        <Text style={styles.secondaryButtonText}>Verify Link</Text>
                      </Pressable>
                    </View>
                  </Animated.View>
                </>
              ) : null}
            </View>
          ) : null}

          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              borderWidth: 1,
              borderColor: showPasswordErrorBorder ? '#ef4444' : '#374151',
              borderRadius: 12,
              backgroundColor: '#111827',
              paddingHorizontal: 12,
            }}
          >
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
            <Pressable onPress={() => setShowPassword(prev => !prev)}>
              <Text style={styles.secondaryButtonText}>{showPassword ? 'Hide' : 'Show'}</Text>
            </Pressable>
          </View>

          {showForgotPasswordLink ? (
            <Pressable
              onPress={() => {
                void onResetPassword();
              }}
              disabled={isSubmitting}
              style={{ alignSelf: 'flex-start', marginTop: 4 }}
            >
              <Text style={{ color: '#60a5fa', fontSize: 13, fontWeight: '600' }}>
                Forgot password? Reset password
              </Text>
            </Pressable>
          ) : null}

          {authMode === 'register' ? (
            <View
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                borderWidth: 1,
                borderColor: showConfirmErrorBorder ? '#ef4444' : '#374151',
                borderRadius: 12,
                backgroundColor: '#111827',
                paddingHorizontal: 12,
              }}
            >
              <TextInput
                autoCapitalize="none"
                secureTextEntry={!showConfirmPassword}
                placeholder={
                  accessMode === 'guest'
                    ? 'Confirm Guest Password'
                    : 'Confirm Password'
                }
                placeholderTextColor="#6b7280"
                style={[styles.input, { flex: 1, borderWidth: 0, paddingHorizontal: 0 }]}
                value={confirmPassword}
                onChangeText={setConfirmPassword}
              />
              <Pressable onPress={() => setShowConfirmPassword(prev => !prev)}>
                <Text style={styles.secondaryButtonText}>{showConfirmPassword ? 'Hide' : 'Show'}</Text>
              </Pressable>
            </View>
          ) : null}

          {passwordWarning ? <Text style={styles.errorText}>{passwordWarning}</Text> : null}
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
            onPress={handleAuth}
          />
        </View>

        <Animated.View style={[styles.footerView, { marginTop: 14, transform: [{ translateY: footerShift }] }]}>
          <View style={styles.footerActions}>
            <SegmentButton
              label={
                authMode === 'login'
                  ? 'Need an account? Register'
                  : 'Back to Login'
              }
              isActive={false}
              onPress={() =>
                setAuthMode(authMode === 'login' ? 'register' : 'login')
              }
            />
          </View>
        </Animated.View>
        </Animated.View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
