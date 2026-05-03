/**
 * context/AuthContext.tsx
 *
 * React context exposing the current authenticated user, session mode and
 * helper actions. This centralizes auth state for hooks and components in
 * the app and ensures tests can wrap components with a simple provider.
 */

import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { getApp } from '@react-native-firebase/app';
import {
  FirebaseAuthTypes,
  createUserWithEmailAndPassword,
  getAuth,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signOut as firebaseSignOut,
} from '@react-native-firebase/auth';
import * as Keychain from 'react-native-keychain';

import { FIREBASE_AUTH_EMAIL_LINK_URL } from '../firebase/project';
import { AuthProtection, AuthSessionMode } from '../types/vault';
import { clearDocumentKeychainEntries, deleteDocumentFromFirebase, deleteUserShareProfile, listVaultDocumentsFromFirebase } from '../services/documentVault';
import { clearKeyBackupData, deleteKeyBackupFromFirebase } from '../services/keyBackup';
import { clearLocalVaultData, getLocalDocuments } from '../storage/localVault';

/** Keychain service used to persist Firebase credentials for passkey unlock. */
const PASSKEY_SERVICE = 'secdocvault.passkey.firebase';
/** Keychain service used to persist guest passkey credentials. */
const GUEST_PASSKEY_SERVICE = 'secdocvault.passkey.guest';
/** Keychain service used to persist local PIN unlock secret. */
const PIN_UNLOCK_SERVICE = 'secdocvault.pin.unlock';
/** Keychain service used as a biometric gate credential. */
const BIOMETRIC_GATE_SERVICE = 'secdocvault.biometric.gate';
/** AsyncStorage key containing persisted auth mode + selected protection. */
const AUTH_PREFS_KEY = 'secdocvault.auth.preferences';
/** AsyncStorage key containing pending email-link registration payload. */
const PENDING_EMAIL_LINK_REGISTRATION_KEY = 'secdocvault.auth.pendingEmailLinkRegistration';
/** AsyncStorage key containing guest account metadata. */
const GUEST_ACCOUNT_META_KEY = 'secdocvault.guest.account.meta';
/** Keychain service used to persist guest login password. */
const GUEST_ACCOUNT_SERVICE = 'secdocvault.guest.account.credentials';

type ModularAuthApi = {
  reload: (user: FirebaseAuthTypes.User) => Promise<void>;
  sendEmailVerification: (
    user: FirebaseAuthTypes.User,
    actionCodeSettings?: FirebaseAuthTypes.ActionCodeSettings,
  ) => Promise<void>;
  sendPasswordResetEmail: (
    auth: ReturnType<typeof getAuth>,
    email: string,
    actionCodeSettings?: FirebaseAuthTypes.ActionCodeSettings,
  ) => Promise<void>;
  sendSignInLinkToEmail: (
    auth: ReturnType<typeof getAuth>,
    email: string,
    actionCodeSettings?: FirebaseAuthTypes.ActionCodeSettings,
  ) => Promise<void>;
  isSignInWithEmailLink: (
    auth: ReturnType<typeof getAuth>,
    emailLink: string,
  ) => Promise<boolean>;
  verifyBeforeUpdateEmail: (
    user: FirebaseAuthTypes.User,
    newEmail: string,
    actionCodeSettings?: FirebaseAuthTypes.ActionCodeSettings,
  ) => Promise<void>;
  deleteUser: (user: FirebaseAuthTypes.User) => Promise<void>;
};

let modularAuthApiPromise: Promise<ModularAuthApi | null> | null = null;

async function getModularAuthApi(): Promise<ModularAuthApi | null> {
  if (!modularAuthApiPromise) {
    modularAuthApiPromise = import('@react-native-firebase/auth/lib/modular/index')
      .then(mod => ({
        reload: mod.reload,
        sendEmailVerification: mod.sendEmailVerification,
        sendPasswordResetEmail: mod.sendPasswordResetEmail,
        sendSignInLinkToEmail: mod.sendSignInLinkToEmail,
        isSignInWithEmailLink: mod.isSignInWithEmailLink,
        verifyBeforeUpdateEmail: mod.verifyBeforeUpdateEmail,
        deleteUser: mod.deleteUser,
      }))
      .catch(() => null);
  }

  return modularAuthApiPromise;
}

type PendingEmailLinkRegistration = {
  email: string;
  password?: string;
  protection?: AuthProtection;
  requestToken?: string;
  verifiedToken?: string;
  emailVerificationLink?: string;
};

/**
 * Persisted auth preferences that define both session mode and unlock protection.
 */
type SavedAuthPrefs = {
  mode: AuthSessionMode;
  protection: AuthProtection;
  pinBiometricEnabled?: boolean;
};

type GuestAccountMeta = {
  createdAt: string;
  updatedAt: string;
};

/**
 * Public contract exposed through AuthContext.
 */
type AuthContextValue = {
  user: FirebaseAuthTypes.User | null;
  sessionMode: AuthSessionMode | null;
  preferredProtection: AuthProtection | null;
  pinBiometricEnabled: boolean;
  isAuthenticated: boolean;
  isGuest: boolean;
  isInitializing: boolean;
  isSubmitting: boolean;
  hasSavedPasskey: boolean;
  authError: string | null;
  signIn: (email: string, password: string) => Promise<boolean>;
  signUp: (email: string, password: string) => Promise<boolean>;
  resendVerificationEmail: (email: string) => Promise<boolean>;
  completeEmailLinkRegistration: (emailLink: string, expectedEmail: string) => Promise<boolean>;
  clearPendingEmailLinkVerification: () => Promise<void>;
  sendPasswordResetEmail: (email: string) => Promise<boolean>;
  requestEmailChange: (newEmail: string) => Promise<boolean>;
  deleteAccountAndData: (password?: string) => Promise<boolean>;
  hasGuestAccount: () => Promise<boolean>;
  registerGuestAccount: (password: string, overwriteExisting?: boolean) => Promise<boolean>;
  loginGuestAccount: (password: string) => Promise<boolean>;
  changeGuestPassword: (currentPassword: string, nextPassword: string) => Promise<boolean>;
  continueAsGuest: () => Promise<boolean>;
  unlockWithSavedPasskey: () => Promise<boolean>;
  unlockWithPin: (pin: string) => Promise<boolean>;
  unlockWithBiometric: () => Promise<boolean>;
  updateUnlockMethod: (
    protection: AuthProtection,
    options?: {
      pin?: string;
      pinBiometricEnabled?: boolean;
      firebaseEmail?: string;
      firebasePassword?: string;
    },
  ) => Promise<boolean>;
  resetPasskey: () => Promise<boolean>;
  signOut: () => Promise<void>;
  clearError: () => void;
};

/**
 * React context for auth state and auth actions.
 * Undefined by default to force usage inside AuthProvider.
 */
const AuthContext = createContext<AuthContextValue | undefined>(undefined);

/**
 * Maps Firebase auth errors into user-friendly messages.
 *
 * @param error - Unknown error payload thrown by auth APIs.
 * @returns Human-readable error message suitable for UI.
 */
function mapAuthError(error: unknown): string {
  if (typeof error === 'object' && error && 'code' in error) {
    const code = String((error as { code: string }).code);
    if (code.includes('auth/invalid-email')) {
      return 'Please enter a valid email address.';
    }
    if (code.includes('auth/invalid-credential') || code.includes('auth/wrong-password')) {
      return 'Invalid email or password.';
    }
    if (code.includes('auth/user-not-found')) {
      return 'No account found for this email.';
    }
    if (code.includes('auth/email-already-in-use')) {
      return 'An account with this email already exists.';
    }
    if (code.includes('auth/weak-password')) {
      return 'Use a stronger password (at least 6 characters).';
    }
    if (code.includes('auth/requires-recent-login')) {
      return 'Please sign in again before deleting your account.';
    }
    if (code.includes('auth/missing-android-pkg-name')) {
      return 'Email-link configuration is missing Android package name.';
    }
    if (code.includes('auth/invalid-continue-uri')) {
      return 'Email-link configuration has an invalid continue URL.';
    }
    if (code.includes('auth/unauthorized-continue-uri')) {
      return 'Email-link continue URL is not authorized in Firebase settings.';
    }
    if (code.includes('auth/argument-error')) {
      return 'Email-link request is invalid. Check auth link configuration.';
    }
    if (code.includes('auth/user-not-found')) {
      return 'No account found for this email.';
    }

    if (typeof error === 'object' && error && 'message' in error) {
      return String((error as { message: string }).message);
    }
  }

  return 'Authentication failed.';
}

/**
 * Provides authentication state and operations for Firebase and guest sessions.
 * Supports passkey and biometric-based unlock methods via Keychain.
 *
 * @param children - Descendant tree that consumes auth context.
 */
export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<FirebaseAuthTypes.User | null>(null);
  const [sessionMode, setSessionMode] = useState<AuthSessionMode | null>(null);
  const [preferredProtection, setPreferredProtection] =
    useState<AuthProtection | null>(null);
  const [pinBiometricEnabled, setPinBiometricEnabled] = useState(false);
  const [isInitializing, setIsInitializing] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [hasSavedPasskey, setHasSavedPasskey] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);
  const firebaseAuth = getAuth(getApp());

  const readGuestAccountMeta = useCallback(async (): Promise<GuestAccountMeta | null> => {
    const raw = await AsyncStorage.getItem(GUEST_ACCOUNT_META_KEY);
    if (!raw) {
      return null;
    }

    try {
      const parsed = JSON.parse(raw) as GuestAccountMeta;
      if (!parsed.createdAt || !parsed.updatedAt) {
        return null;
      }
      return parsed;
    } catch {
      return null;
    }
  }, []);

  const hasGuestAccount = useCallback(async () => {
    const meta = await readGuestAccountMeta();
    if (!meta) {
      return false;
    }

    const credentials = await Keychain.getGenericPassword({
      service: GUEST_ACCOUNT_SERVICE,
    }).catch(() => false);
    return Boolean(credentials);
  }, [readGuestAccountMeta]);

  const saveGuestAccountPassword = async (password: string, existingMeta?: GuestAccountMeta | null) => {
    const now = new Date().toISOString();
    await Keychain.setGenericPassword('guest', password, {
      service: GUEST_ACCOUNT_SERVICE,
      accessible: Keychain.ACCESSIBLE.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
    });
    await AsyncStorage.setItem(
      GUEST_ACCOUNT_META_KEY,
      JSON.stringify({
        createdAt: existingMeta?.createdAt ?? now,
        updatedAt: now,
      } satisfies GuestAccountMeta),
    );
  };

  const clearGuestAccount = async () => {
    await Promise.allSettled([
      AsyncStorage.removeItem(GUEST_ACCOUNT_META_KEY),
      Keychain.resetGenericPassword({service: GUEST_ACCOUNT_SERVICE}),
    ]);
  };

  const reloadUser = async (userToReload: FirebaseAuthTypes.User) => {
    try {
      const modular = await getModularAuthApi();
      if (modular) {
        await modular.reload(userToReload);
        return;
      }

      await userToReload.reload();
    } catch (error) {
      if (typeof error === 'object' && error && 'code' in error) {
        const code = String((error as { code: string }).code);
        if (code.includes('auth/no-current-user')) {
          return;
        }
      }
      throw error;
    }
  };

  const sendResetEmail = async (
    targetEmail: string,
    actionCodeSettings?: FirebaseAuthTypes.ActionCodeSettings,
  ) => {
    const modular = await getModularAuthApi();
    if (modular) {
      await modular.sendPasswordResetEmail(firebaseAuth, targetEmail, actionCodeSettings);
      return;
    }

    await firebaseAuth.sendPasswordResetEmail(targetEmail, actionCodeSettings);
  };

  const sendSignInEmailLink = async (
    targetEmail: string,
    actionCodeSettings: FirebaseAuthTypes.ActionCodeSettings,
  ) => {
    try {
      const modular = await getModularAuthApi();
      if (modular) {
        await modular.sendSignInLinkToEmail(firebaseAuth, targetEmail, actionCodeSettings);
        return;
      }

      await firebaseAuth.sendSignInLinkToEmail(targetEmail, actionCodeSettings);
      return;
    } catch {
      const fallbackSettings: FirebaseAuthTypes.ActionCodeSettings = {
        handleCodeInApp: true,
        url: actionCodeSettings.url,
      };

      const modular = await getModularAuthApi();
      if (modular) {
        await modular.sendSignInLinkToEmail(firebaseAuth, targetEmail, fallbackSettings);
        return;
      }

      await firebaseAuth.sendSignInLinkToEmail(targetEmail, fallbackSettings);
    }
  };

  const checkIsSignInWithEmailLink = async (emailLink: string) => {
    const modular = await getModularAuthApi();
    if (modular) {
      return modular.isSignInWithEmailLink(firebaseAuth, emailLink);
    }

    return firebaseAuth.isSignInWithEmailLink(emailLink);
  };

  const sendVerifyBeforeUpdateEmail = async (
    targetUser: FirebaseAuthTypes.User,
    newEmail: string,
    actionCodeSettings?: FirebaseAuthTypes.ActionCodeSettings,
  ) => {
    const modular = await getModularAuthApi();
    if (modular) {
      await modular.verifyBeforeUpdateEmail(targetUser, newEmail, actionCodeSettings);
      return;
    }

    await targetUser.verifyBeforeUpdateEmail(newEmail, actionCodeSettings);
  };

  /**
   * Persists current auth mode and protection selection.
   *
   * @param prefs - Preferences to store.
   */
  const savePrefs = async (prefs: SavedAuthPrefs) => {
    await AsyncStorage.setItem(AUTH_PREFS_KEY, JSON.stringify(prefs));
  };

  /**
   * Reads and validates persisted auth preferences.
   *
   * @returns Parsed preferences, or null when missing/invalid.
   */
  const readPrefs = async (): Promise<SavedAuthPrefs | null> => {
    const raw = await AsyncStorage.getItem(AUTH_PREFS_KEY);
    if (!raw) return null;

    try {
      const parsed = JSON.parse(raw) as SavedAuthPrefs;
      if (!parsed.mode || !parsed.protection) {
        return null;
      }
      return parsed;
    } catch {
      return null;
    }
  };

  const getEmailLinkActionCodeSettings = (requestToken?: string): FirebaseAuthTypes.ActionCodeSettings => ({
    handleCodeInApp: true,
    // Use Firebase Hosting as the canonical email-link continue URL.
    url: requestToken
      ? `${FIREBASE_AUTH_EMAIL_LINK_URL}?regToken=${encodeURIComponent(requestToken)}`
      : FIREBASE_AUTH_EMAIL_LINK_URL,
    android: {
      packageName: 'com.secdocvault',
      installApp: true,
      minimumVersion: '1',
    },
    iOS: {
      bundleId: 'com.secdocvault',
    },
  });

  const savePendingEmailLinkRegistration = async (value: PendingEmailLinkRegistration) => {
    await AsyncStorage.setItem(PENDING_EMAIL_LINK_REGISTRATION_KEY, JSON.stringify(value));
  };

  const readPendingEmailLinkRegistration = async (): Promise<PendingEmailLinkRegistration | null> => {
    const raw = await AsyncStorage.getItem(PENDING_EMAIL_LINK_REGISTRATION_KEY);
    if (!raw) {
      return null;
    }

    try {
      const parsed = JSON.parse(raw) as PendingEmailLinkRegistration;
      if (!parsed.email) {
        return null;
      }
      return parsed;
    } catch {
      return null;
    }
  };

  const clearPendingEmailLinkVerification = async () => {
    await AsyncStorage.removeItem(PENDING_EMAIL_LINK_REGISTRATION_KEY);
  };

  /**
   * Extracts a parameter from a Firebase email link.
   * Handles both direct parameters and nested parameters in continueUrl.
   *
   * @param emailLink - The Firebase email link from the verification email.
   * @param paramName - The parameter name to extract (e.g., 'regToken', 'oobCode').
   * @returns The parameter value, or null if not found.
   */
  const extractParameterFromEmailLink = (emailLink: string, paramName: string): string | null => {
    if (!emailLink?.trim() || !paramName?.trim()) {
      return null;
    }

    const safeDecode = (value: string) => {
      try {
        return decodeURIComponent(value.replace(/\+/g, '%20'));
      } catch {
        return value;
      }
    };

    const readParamViaRegex = (input: string, key: string) => {
      const escaped = key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const match = input.match(new RegExp(`[?&]${escaped}=([^&#]+)`));
      return match ? safeDecode(match[1]) : null;
    };

    // Try to extract parameter directly from the link
    let paramValue = readParamViaRegex(emailLink, paramName);
    if (paramValue) {
      return paramValue;
    }

    // Try to extract from continueUrl if nested
    const continueUrl = readParamViaRegex(emailLink, 'continueUrl');
    if (continueUrl) {
      const decodedContinue = safeDecode(continueUrl);
      paramValue = readParamViaRegex(decodedContinue, paramName);
      if (paramValue) {
        return paramValue;
      }
    }

    return null;
  };

  const extractRegistrationTokenFromEmailLink = (emailLink: string): string | null => {
    return extractParameterFromEmailLink(emailLink, 'regToken');
  };

  /**
   * Ensures user biometric approval exists for the current device session.
   * If the gate does not exist yet, it creates a gated credential and then prompts.
   *
   * @returns Truthy credential object/boolean when approved, otherwise false.
   */
  const requireBiometricApproval = async () => {
    const existingGate = await Keychain.getGenericPassword({
      service: BIOMETRIC_GATE_SERVICE,
      authenticationPrompt: {
        title: 'Unlock SecDocVault',
        subtitle: 'Biometric approval required',
      },
    }).catch(() => false);

    if (existingGate) return true;

    await Keychain.setGenericPassword('vault-user', 'biometric-approved', {
      service: BIOMETRIC_GATE_SERVICE,
      accessControl: Keychain.ACCESS_CONTROL.BIOMETRY_ANY,
      accessible: Keychain.ACCESSIBLE.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
    });

    return Keychain.getGenericPassword({
      service: BIOMETRIC_GATE_SERVICE,
      authenticationPrompt: {
        title: 'Unlock SecDocVault',
        subtitle: 'Biometric approval required',
      },
    });
  };

  /**
   * Stores Firebase credentials for future passkey unlock.
   *
   * @param email - Account email to store as username.
   * @param password - Account password to store in keychain.
   */
  const saveFirebasePasskey = async (email: string, password: string) => {
    await Keychain.setGenericPassword(email, password, {
      service: PASSKEY_SERVICE,
      accessControl: Keychain.ACCESS_CONTROL.USER_PRESENCE,
      accessible: Keychain.ACCESSIBLE.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
    });
  };

  /**
   * Stores a guest passkey marker credential for local guest unlock.
   */
  const saveGuestPasskey = async () => {
    await Keychain.setGenericPassword('guest', 'local-only', {
      service: GUEST_PASSKEY_SERVICE,
      accessControl: Keychain.ACCESS_CONTROL.USER_PRESENCE,
      accessible: Keychain.ACCESSIBLE.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
    });
  };

  /**
   * Removes all passkey credentials and clears persisted auth preferences.
   */
  const resetStoredPasskeys = async () => {
    await Promise.allSettled([
      Keychain.resetGenericPassword({ service: PASSKEY_SERVICE }),
      Keychain.resetGenericPassword({ service: GUEST_PASSKEY_SERVICE }),
    ]);
    await AsyncStorage.removeItem(AUTH_PREFS_KEY);
    setHasSavedPasskey(false);
    setPreferredProtection(null);
  };

  useEffect(() => {
    // Keeps Firebase user state in sync with native auth state.
    const unsubscribe = onAuthStateChanged(firebaseAuth, nextUser => {
      setUser(nextUser);
      if (nextUser) {
        setSessionMode('cloud');
      }
    });

    // Boot sequence restores guest biometric sessions and persisted prefs.
    const boot = async () => {
      const prefs = await readPrefs();
      if (prefs?.mode === 'guest' && prefs.protection === 'biometric') {
        const biometricApproved = await requireBiometricApproval().catch(
          () => false,
        );
        if (biometricApproved) {
          setSessionMode('guest');
        }
      }
      setPreferredProtection(prefs?.protection ?? null);
      setPinBiometricEnabled(Boolean(prefs?.pinBiometricEnabled));
      setHasSavedPasskey(Boolean(prefs && prefs.protection === 'passkey'));
      const guestExists = await hasGuestAccount();
      if (!guestExists) {
        await clearGuestAccount();
      }
      setIsInitializing(false);
    };

    void boot();

    return unsubscribe;
  }, [firebaseAuth, hasGuestAccount]);

  /**
   * Signs in a Firebase user with optional biometric/passkey setup.
   *
   * @param email - Firebase account email.
   * @param password - Firebase account password.
   * @returns True on successful sign-in, otherwise false.
   */
  const signIn = async (
    email: string,
    password: string,
  ) => {
    setIsSubmitting(true);
    setAuthError(null);
    try {
      const credential = await signInWithEmailAndPassword(firebaseAuth, email.trim(), password);
      await reloadUser(credential.user);
      setSessionMode('cloud');
      return true;
    } catch (error) {
      setAuthError(mapAuthError(error));
      return false;
    } finally {
      setIsSubmitting(false);
    }
  };

  /**
   * Creates a Firebase account with optional biometric/passkey setup.
   *
   * @param email - New account email.
   * @param password - New account password.
   * @returns True on successful sign-up, otherwise false.
   */
  const signUp = async (
    email: string,
    password: string,
  ) => {
    setIsSubmitting(true);
    setAuthError(null);
    try {
      const normalizedEmail = email.trim().toLowerCase();
      const pending = await readPendingEmailLinkRegistration();
      if (
        !pending?.email ||
        pending.email.trim().toLowerCase() !== normalizedEmail ||
        !pending.requestToken ||
        pending.verifiedToken !== pending.requestToken
      ) {
        setAuthError('Verify your email first using the Send Verification Email button.');
        return false;
      }

      const credential = await createUserWithEmailAndPassword(firebaseAuth, normalizedEmail, password);

      // Send ONE verification email to mark the email as verified in Firebase.
      // User already verified ownership via the sign-in link they clicked earlier,
      // so this email just needs to be clicked once more to mark email as verified.
      try {
        const modular = await getModularAuthApi();
        if (modular) {
          await modular.sendEmailVerification(credential.user);
        } else {
          await credential.user.sendEmailVerification();
        }
      } catch {
        // Email verification send is not critical - account is already created
        // User can verify email later from account settings if needed
      }

      await reloadUser(credential.user);
      await AsyncStorage.removeItem(PENDING_EMAIL_LINK_REGISTRATION_KEY);
      setSessionMode('cloud');
      return true;
    } catch (error) {
      setAuthError(mapAuthError(error));
      return false;
    } finally {
      setIsSubmitting(false);
    }
  };

  const resendVerificationEmail = async (email: string) => {
    setIsSubmitting(true);
    setAuthError(null);
    try {
      const normalizedEmail = email.trim().toLowerCase();
      if (!normalizedEmail) {
        setAuthError('Enter your email address first.');
        return false;
      }

      const requestToken = `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;

      const previous = await readPendingEmailLinkRegistration();
      await savePendingEmailLinkRegistration({
        email: normalizedEmail,
        password: previous?.password,
        protection: previous?.protection ?? 'passkey',
        requestToken,
        verifiedToken: undefined,
      });

      // Send sign-in link for frontend verification only.
      // When user creates account, Firebase will auto-verify the email since
      // the user already verified ownership by clicking this link.
      await sendSignInEmailLink(normalizedEmail, getEmailLinkActionCodeSettings(requestToken));
      setAuthError(null);
      return true;
    } catch (error) {
      setAuthError(mapAuthError(error));
      return false;
    } finally {
      setIsSubmitting(false);
    }
  };

  const completeEmailLinkRegistration = async (emailLink: string, expectedEmail: string) => {
    setIsSubmitting(true);
    setAuthError(null);
    try {
      const pending = await readPendingEmailLinkRegistration();
      if (!pending?.email) {
        setAuthError('No pending registration found. Start registration first.');
        return false;
      }

      const normalizedExpectedEmail =
        expectedEmail.trim().toLowerCase() || pending.email.trim().toLowerCase();

      if (pending.email.trim().toLowerCase() !== normalizedExpectedEmail) {
        setAuthError('This verification link belongs to a different email. Send a new link for the current email.');
        return false;
      }

      if (!emailLink.trim()) {
        setAuthError('Open the verification link from your email.');
        return false;
      }

      const expectedToken = pending.requestToken;
      const actualToken = extractRegistrationTokenFromEmailLink(emailLink);
      if (!expectedToken || !actualToken || expectedToken !== actualToken) {
        setAuthError('This verification link does not match your current email request. Send a new verification email and use the latest link.');
        return false;
      }

      const isLink = await checkIsSignInWithEmailLink(emailLink.trim());
      if (!isLink) {
        setAuthError('This is not a valid sign-in verification link.');
        return false;
      }

      await savePendingEmailLinkRegistration({
        ...pending,
        requestToken: expectedToken,
        verifiedToken: expectedToken,
        emailVerificationLink: emailLink.trim(),
      });

      setAuthError(null);
      return true;
    } catch (error) {
      setAuthError(mapAuthError(error));
      return false;
    } finally {
      setIsSubmitting(false);
    }
  };

  const sendPasswordResetEmail = async (email: string) => {
    setIsSubmitting(true);
    setAuthError(null);
    try {
      await sendResetEmail(email.trim());
      setAuthError(null);
      return true;
    } catch (error) {
      setAuthError(mapAuthError(error));
      return false;
    } finally {
      setIsSubmitting(false);
    }
  };

  const requestEmailChange = async (newEmail: string) => {
    setIsSubmitting(true);
    setAuthError(null);
    try {
      if (!user) {
        setAuthError('You must be signed in to change email.');
        return false;
      }

      const normalizedEmail = newEmail.trim();
      if (!normalizedEmail) {
        setAuthError('Enter a new email address first.');
        return false;
      }

      if (user.email && user.email.toLowerCase() === normalizedEmail.toLowerCase()) {
        setAuthError('New email must be different from current email.');
        return false;
      }

      await sendVerifyBeforeUpdateEmail(user, normalizedEmail, getEmailLinkActionCodeSettings());
      return true;
    } catch (error) {
      setAuthError(mapAuthError(error));
      return false;
    } finally {
      setIsSubmitting(false);
    }
  };

  /**
   * Registers or replaces the local guest account password.
   *
   * @param password - New guest password.
   * @param overwriteExisting - Whether to erase an existing guest vault before creating a new guest account.
   * @returns True when the guest account was created.
   */
  const registerGuestAccount = async (password: string, overwriteExisting = false) => {
    setIsSubmitting(true);
    setAuthError(null);
    try {
      const normalizedPassword = password.trim();
      if (normalizedPassword.length < 6) {
        setAuthError('Guest password must be at least 6 characters.');
        return false;
      }

      const existingMeta = await readGuestAccountMeta();
      const exists = await hasGuestAccount();
      if (exists && !overwriteExisting) {
        setAuthError('A guest account already exists on this device.');
        return false;
      }

      if (exists && overwriteExisting) {
        const localDocs = await getLocalDocuments();
        if (localDocs.length > 0) {
          await clearDocumentKeychainEntries(localDocs.map(item => item.id));
        }
        await clearLocalVaultData();
        await clearKeyBackupData();
        await Promise.allSettled([
          Keychain.resetGenericPassword({service: PASSKEY_SERVICE}),
          Keychain.resetGenericPassword({service: GUEST_PASSKEY_SERVICE}),
          Keychain.resetGenericPassword({service: PIN_UNLOCK_SERVICE}),
          Keychain.resetGenericPassword({service: BIOMETRIC_GATE_SERVICE}),
        ]);
      }

      await saveGuestAccountPassword(normalizedPassword, existingMeta);
      setSessionMode('guest');
      setUser(null);
      return true;
    } catch {
      setAuthError('Unable to create guest account on this device.');
      return false;
    } finally {
      setIsSubmitting(false);
    }
  };

  const loginGuestAccount = async (password: string) => {
    setIsSubmitting(true);
    setAuthError(null);
    try {
      const normalizedPassword = password.trim();
      if (!normalizedPassword) {
        setAuthError('Enter your guest password.');
        return false;
      }

      const credentials = await Keychain.getGenericPassword({
        service: GUEST_ACCOUNT_SERVICE,
      });
      if (!credentials) {
        setAuthError('No guest account found on this device. Register first.');
        return false;
      }

      if (credentials.password !== normalizedPassword) {
        setAuthError('Incorrect guest password.');
        return false;
      }

      setSessionMode('guest');
      setUser(null);
      return true;
    } catch {
      setAuthError('Unable to start guest mode with this password.');
      return false;
    } finally {
      setIsSubmitting(false);
    }
  };

  const continueAsGuest = async () => {
    setAuthError('Use guest login with your guest password, or register a new guest account.');
    return false;
  };

  /**
   * Changes the stored guest password after verifying the current password.
   *
   * @param currentPassword - Existing guest password.
   * @param nextPassword - New guest password to save.
   * @returns True when the password was updated.
   */
  const changeGuestPassword = async (currentPassword: string, nextPassword: string) => {
    setIsSubmitting(true);
    setAuthError(null);
    try {
      const normalizedCurrentPassword = currentPassword.trim();
      const normalizedNextPassword = nextPassword.trim();

      if (!normalizedCurrentPassword) {
        setAuthError('Enter your current guest password.');
        return false;
      }

      if (normalizedNextPassword.length < 6) {
        setAuthError('New guest password must be at least 6 characters.');
        return false;
      }

      const credentials = await Keychain.getGenericPassword({
        service: GUEST_ACCOUNT_SERVICE,
      });

      if (!credentials) {
        setAuthError('No guest account found on this device. Register first.');
        return false;
      }

      if (credentials.password !== normalizedCurrentPassword) {
        setAuthError('Incorrect current guest password.');
        return false;
      }

      const existingMeta = await readGuestAccountMeta();
      await saveGuestAccountPassword(normalizedNextPassword, existingMeta);
      return true;
    } catch {
      setAuthError('Unable to change guest password.');
      return false;
    } finally {
      setIsSubmitting(false);
    }
  };

  const deleteAccountAndData = async (password?: string) => {
    setIsSubmitting(true);
    setAuthError(null);
    try {
      const ownerId = user?.uid;
      if (!ownerId && sessionMode !== 'guest') {
        setAuthError('No active account found to delete.');
        return false;
      }

      // Firebase requires recent authentication before account deletion.
      // Try re-auth from stored passkey credentials, then fall back to provided password.
      if (user?.email) {
        const stored = await Keychain.getGenericPassword({
          service: PASSKEY_SERVICE,
          authenticationPrompt: {
            title: 'Confirm account deletion',
            subtitle: 'Authenticate to delete your account',
          },
        });
        if (stored) {
          await signInWithEmailAndPassword(firebaseAuth, stored.username, stored.password);
        } else if (password) {
          await signInWithEmailAndPassword(firebaseAuth, user.email, password);
        }
      }

      const localDocs = await getLocalDocuments(ownerId);
      const remoteDocs = ownerId ? await listVaultDocumentsFromFirebase(ownerId) : [];
      const documentIds = Array.from(new Set([...localDocs, ...remoteDocs].map(docItem => docItem.id)));

      if (documentIds.length > 0) {
        await clearDocumentKeychainEntries(documentIds);
      }

      if (ownerId) {
        await Promise.allSettled(remoteDocs.map(docItem => deleteDocumentFromFirebase(docItem)));
        await deleteKeyBackupFromFirebase(ownerId).catch(() => undefined);
        await deleteUserShareProfile(ownerId).catch(() => undefined);
      }

      await clearLocalVaultData(ownerId);
      await clearKeyBackupData();
      await resetStoredPasskeys();
      await clearGuestAccount();

      if (user) {
        const modularApi = await getModularAuthApi();
        if (modularApi?.deleteUser) {
          await modularApi.deleteUser(user);
        } else {
          await (user as any).delete();
        }
      }

      await firebaseSignOut(firebaseAuth).catch(() => undefined);
      setSessionMode(null);
      setUser(null);
      setPreferredProtection(null);
      setHasSavedPasskey(false);
      return true;
    } catch (error) {
      setAuthError(mapAuthError(error));
      return false;
    } finally {
      setIsSubmitting(false);
    }
  };

  /**
   * Unlocks and restores a Firebase session using stored passkey credentials.
   *
   * @returns True on successful Firebase re-authentication.
   */
  const unlockFirebasePasskey = async (shouldReauthenticate: boolean) => {
    const credentials = await Keychain.getGenericPassword({
      service: PASSKEY_SERVICE,
      authenticationPrompt: {
        title: 'Unlock with saved passkey',
        subtitle: 'SecDocVault',
      },
    });

    if (!credentials) return false;

    if (!shouldReauthenticate) {
      setSessionMode('cloud');
      return true;
    }

    await signInWithEmailAndPassword(
      firebaseAuth,
      credentials.username,
      credentials.password,
    );
    setSessionMode('cloud');
    return true;
  };

  /**
   * Unlocks a local guest session using stored guest passkey credentials.
   *
   * @returns True when guest passkey is available and approved.
   */
  const unlockGuestPasskey = async () => {
    const credentials = await Keychain.getGenericPassword({
      service: GUEST_PASSKEY_SERVICE,
      authenticationPrompt: {
        title: 'Unlock local-only guest vault',
        subtitle: 'SecDocVault',
      },
    });

    if (!credentials) return false;

    setSessionMode('guest');
    return true;
  };

  const unlockWithPin = async (pin: string) => {
    setIsSubmitting(true);
    setAuthError(null);
    try {
      const credentials = await Keychain.getGenericPassword({
        service: PIN_UNLOCK_SERVICE,
      });

      if (!credentials || credentials.password !== pin) {
        setAuthError('PIN unlock failed. Check your PIN and try again.');
        return false;
      }

      return true;
    } catch {
      setAuthError('PIN unlock failed. Check your PIN and try again.');
      return false;
    } finally {
      setIsSubmitting(false);
    }
  };

  /**
   * Restores session using saved passkey according to persisted mode/preferences.
   *
   * @returns True when unlock succeeds, otherwise false with `authError` set.
   */
  const unlockWithSavedPasskey = async () => {
    setIsSubmitting(true);
    setAuthError(null);
    try {
      const prefs = await readPrefs();
      if (!prefs || prefs.protection !== 'passkey') {
        setAuthError('No saved passkey session found.');
        return false;
      }

      if (prefs.mode === 'cloud') {
        return await unlockFirebasePasskey(!user);
      }

      return await unlockGuestPasskey();
    } catch {
      setAuthError('Passkey unlock failed. Please sign in manually.');
      return false;
    } finally {
      setIsSubmitting(false);
    }
  };

  /**
   * Performs biometric gate verification for an already known session.
   *
   * @returns True when biometric approval succeeds.
   */
  const unlockWithBiometric = async () => {
    setIsSubmitting(true);
    setAuthError(null);
    try {
      const approved = await requireBiometricApproval();
      if (!approved) {
        setAuthError('Biometric unlock failed.');
        return false;
      }
      return true;
    } catch {
      setAuthError('Biometric unlock failed.');
      return false;
    } finally {
      setIsSubmitting(false);
    }
  };

  /**
   * Updates the active unlock method and synchronizes stored credentials.
   *
   * @param protection - New protection mode to apply.
   * @param options - Optional unlock payload for PIN or Firebase passkey setup.
   * @returns True if update completed successfully.
   */
  const updateUnlockMethod = async (
    protection: AuthProtection,
    options?: {
      pin?: string;
      pinBiometricEnabled?: boolean;
      firebaseEmail?: string;
      firebasePassword?: string;
    },
  ) => {
    setIsSubmitting(true);
    setAuthError(null);
    try {
      const mode = sessionMode ?? (user ? 'cloud' : 'guest');
      const nextProtection = protection === 'biometric' ? 'pin' : protection;

      if (nextProtection === 'none') {
        await Promise.allSettled([
          Keychain.resetGenericPassword({ service: PASSKEY_SERVICE }),
          Keychain.resetGenericPassword({ service: GUEST_PASSKEY_SERVICE }),
          Keychain.resetGenericPassword({ service: PIN_UNLOCK_SERVICE }),
        ]);
        await savePrefs({ mode, protection: 'none', pinBiometricEnabled: false });
        setPreferredProtection('none');
        setPinBiometricEnabled(false);
        setHasSavedPasskey(false);
        return true;
      }

      if (nextProtection === 'pin') {
        const pin = options?.pin?.trim();
        if (!pin || pin.length < 4) {
          setAuthError('PIN must be at least 4 digits.');
          return false;
        }

        if (options?.pinBiometricEnabled) {
          const approved = await requireBiometricApproval();
          if (!approved) {
            setAuthError('Biometric setup failed. Try again or continue without biometric.');
            return false;
          }
        }

        await Keychain.setGenericPassword('pin-user', pin, {
          service: PIN_UNLOCK_SERVICE,
          accessible: Keychain.ACCESSIBLE.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
        });
        await Promise.allSettled([
          Keychain.resetGenericPassword({ service: PASSKEY_SERVICE }),
          Keychain.resetGenericPassword({ service: GUEST_PASSKEY_SERVICE }),
        ]);
        await savePrefs({
          mode,
          protection: 'pin',
          pinBiometricEnabled: Boolean(options?.pinBiometricEnabled),
        });
        setPreferredProtection('pin');
        setPinBiometricEnabled(Boolean(options?.pinBiometricEnabled));
        setHasSavedPasskey(false);
        return true;
      }

      if (mode === 'guest') {
        await saveGuestPasskey();
      } else {
        const email = options?.firebaseEmail?.trim() ?? user?.email?.trim();
        const password = options?.firebasePassword;
        if (!email || !password) {
          setAuthError('Passkey setup requires your login credentials. Please sign in again.');
          return false;
        }

        // Verify credentials before persisting passkey unlock secrets.
        await signInWithEmailAndPassword(firebaseAuth, email, password);
        await saveFirebasePasskey(email, password);
      }

      await Keychain.resetGenericPassword({ service: PIN_UNLOCK_SERVICE });
      await savePrefs({ mode, protection: 'passkey', pinBiometricEnabled: false });
      setPreferredProtection('passkey');
      setPinBiometricEnabled(false);
      setHasSavedPasskey(true);
      return true;
    } catch (error) {
      setAuthError(mapAuthError(error));
      return false;
    } finally {
      setIsSubmitting(false);
    }
  };

  /**
   * Clears saved passkey credentials and related persisted preferences.
   *
   * @returns True if passkey reset succeeded.
   */
  const resetPasskey = async () => {
    setIsSubmitting(true);
    setAuthError(null);
    try {
      await resetStoredPasskeys();
      return true;
    } catch {
      setAuthError('Unable to reset passkey.');
      return false;
    } finally {
      setIsSubmitting(false);
    }
  };

  /**
   * Signs out Firebase user (if present) and resets in-memory session state.
   */
  const signOut = async () => {
    setAuthError(null);
    if (firebaseAuth.currentUser) {
      await firebaseSignOut(firebaseAuth);
    }
    setSessionMode(null);
    setUser(null);
  };

  /** Clears any currently shown authentication error. */
  const clearError = () => setAuthError(null);

  const value: AuthContextValue = {
    user,
    sessionMode,
    preferredProtection,
    isAuthenticated: Boolean(user) || sessionMode === 'guest',
    isGuest: sessionMode === 'guest',
    isInitializing,
    isSubmitting,
    pinBiometricEnabled,
    hasSavedPasskey,
    authError,
    signIn,
    signUp,
    resendVerificationEmail,
    completeEmailLinkRegistration,
    clearPendingEmailLinkVerification,
    sendPasswordResetEmail,
    requestEmailChange,
    deleteAccountAndData,
    hasGuestAccount,
    registerGuestAccount,
    loginGuestAccount,
    changeGuestPassword,
    continueAsGuest,
    unlockWithSavedPasskey,
    unlockWithPin,
    unlockWithBiometric,
    updateUnlockMethod,
    resetPasskey,
    signOut,
    clearError,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

/**
 * Hook for consuming AuthContext.
 *
 * @throws Error when called outside `AuthProvider`.
 * @returns Auth context value.
 */
export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return context;
}
