import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Animated,
  AppState,
  AppStateStatus,
  Alert,
  BackHandler,
  Linking,
  Pressable,
  StatusBar,
  Text,
  useColorScheme,
  View,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Clipboard from '@react-native-clipboard/clipboard';
import { EllipsisHorizontalCircleIcon, PencilSquareIcon } from 'react-native-heroicons/solid';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';

import { Header } from './src/components/ui';
import { AuthProvider, useAuth } from './src/context/AuthContext';
import { FIREBASE_PROJECT_ID } from './src/firebase/project';
import {
  AuthScreen,
  BackupScreen,
  CompleteAuthScreen,
  DocumentRecoveryScreen,
  IntroHeroScreen,
  KeyBackupScreen,
  KeyRecoveryScreen,
  MainScreen,
  PreviewScreen,
  ShareDetailsScreen,
  SettingsScreen,
  ShareScreen,
  UploadConfirmScreen,
  UnlockScreen,
} from './src/screens';
import {
  canCurrentUserExportDocument,
  createDocumentShareGrant,
  deleteDocumentFromFirebase,
  decryptDocumentPayload,
  documentSaveLocal,
  ensureCurrentUserSharePublicKey,
  enforceExpiredShareRevocations,
  exportDocumentToDevice,
  MAX_FILES_PER_DOCUMENT,
  listVaultDocumentsFromFirebase,
  listVaultDocumentsSharedWithUser,
  removeFirebaseReferences,
  removeLocalDocumentCopy,
  revokeDocumentShareGrant,
  saveDocumentToFirebase,
  saveDocumentOffline,
  updateDocumentRecoveryPreference,
  pickDocumentForUpload,
  scanDocumentForUpload,
  UploadableDocumentDraft,
  uploadDocumentToFirebase,
} from './src/services/documentUpload';
import {
  autoSyncKeysIfEnabled,
  backupKeysToFirebase,
  deleteKeyBackupFromFirebase,
  downloadKeyBackupFile,
  downloadPassphraseFile,
  ensureRecoveryPassphrase,
  getRecoveryPassphraseForSettings,
  generateRecoveryPassphrase,
  resetRecoveryPassphraseForSettings,
  restoreKeysFromFirebase,
  setAutoKeySyncEnabled,
} from './src/services/keyBackup';
import { hasInternetAccess } from './src/services/connectivity';
import {
  getIncomingShareDecisionStore,
  getLocalDocuments,
  IncomingShareDecision,
  IncomingShareDecisionStore,
  getVaultPreferences,
  saveLocalDocuments,
  saveIncomingShareDecisionStore,
  saveVaultPreferences,
} from './src/storage/localVault';
import { styles } from './src/theme/styles';
import { AuthMode, AuthProtection, VaultDocument } from './src/types/vault';

const RECOVERY_SUB_SCREENS = ['recoverkeys', 'recoverydocs'] as const;
type AppScreen =
  | 'main'
  | 'upload'
  | 'preview'
  | 'share'
  | 'backup'
  | 'settings'
  | 'keybackup'
  | 'recoverkeys'
  | 'recoverydocs'
  | 'sharedetails';

function App(): React.JSX.Element {
  const isDarkMode = useColorScheme() === 'dark';

  return (
    <SafeAreaProvider>
      <StatusBar barStyle={isDarkMode ? 'light-content' : 'dark-content'} />
      <SafeAreaView style={styles.appShell}>
        <AuthProvider>
          <AppContent />
        </AuthProvider>
      </SafeAreaView>
    </SafeAreaProvider>
  );
}

function AppContent() {
  const UPLOAD_DISCARD_WARNING_PREF_KEY = 'secdocvault.upload.skipDiscardWarning';
  const COMPLETE_AUTH_PENDING_KEY = 'secdocvault.auth.complete.pending';
  const {
    user,
    isAuthenticated,
    isGuest,
    isInitializing,
    isSubmitting,
    hasSavedPasskey,
    pinBiometricEnabled,
    preferredProtection,
    authError,
    signIn,
    signUp,
    resendVerificationEmail,
    completeEmailLinkRegistration,
    sendPasswordResetEmail,
    requestEmailChange,
    deleteAccountAndData,
    hasGuestAccount,
    registerGuestAccount,
    loginGuestAccount,
    changeGuestPassword,
    unlockWithSavedPasskey,
    unlockWithPin,
    unlockWithBiometric,
    updateUnlockMethod,
    signOut,
    clearError,
  } = useAuth();
  const [screen, setScreen] = useState<AppScreen>('main');
  const [authGateStage, setAuthGateStage] = useState<'hero' | 'auth' | 'unlock'>('hero');
  const [authReturnStage, setAuthReturnStage] = useState<'hero' | 'unlock'>('hero');
  const [authMode, setAuthMode] = useState<AuthMode>('login');
  const [accessMode, setAccessMode] = useState<'login' | 'guest'>('login');
  const [showCompleteAuthSetup, setShowCompleteAuthSetup] = useState(false);
  const [isCompletingAuthFlow, setIsCompletingAuthFlow] = useState(false);
  const [authCredentialSnapshot, setAuthCredentialSnapshot] = useState<{ email: string; password: string } | null>(null);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [emailVerifiedForRegistration, setEmailVerifiedForRegistration] = useState(false);
  const [verificationLinkInput, setVerificationLinkInput] = useState('');
  const [verificationCooldown, setVerificationCooldown] = useState(0);
  const [documents, setDocuments] = useState<VaultDocument[]>([]);
  const [incomingShareDecisionStore, setIncomingShareDecisionStore] = useState<IncomingShareDecisionStore>({});
  const [selectedDoc, setSelectedDoc] = useState<VaultDocument | null>(null);
  const [shareTarget, setShareTarget] = useState('');
  const [allowDownload, setAllowDownload] = useState(true);
  const [shareExpiryDays, setShareExpiryDays] = useState('30');
  const [shareStatus, setShareStatus] = useState('');
  const [isShareSubmitting, setIsShareSubmitting] = useState(false);
  const [shareOriginScreen, setShareOriginScreen] = useState<'main' | 'preview'>('main');
  const [backupCloud, setBackupCloud] = useState(true);
  const [backupLocal, setBackupLocal] = useState(false);
  const [backupStatus, setBackupStatus] = useState('No backup running');
  const [isUploading, setIsUploading] = useState(false);
  const [uploadStatus, setUploadStatus] = useState('');
  const [pendingUploadDraft, setPendingUploadDraft] = useState<UploadableDocumentDraft | null>(null);
  const [pendingUploadName, setPendingUploadName] = useState('Document');
  const [pendingUploadDescription, setPendingUploadDescription] = useState('');
  const [pendingUploadRecoverable, setPendingUploadRecoverable] = useState(false);
  const [pendingUploadToCloud, setPendingUploadToCloud] = useState(false);
  const [pendingUploadAlsoSaveLocal, setPendingUploadAlsoSaveLocal] = useState(false);
  const [pendingUploadPreviewIndex, setPendingUploadPreviewIndex] = useState(0);
  const [showUploadDiscardWarning, setShowUploadDiscardWarning] = useState(false);
  const [dontShowUploadDiscardWarningAgain, setDontShowUploadDiscardWarningAgain] = useState(false);
  const [skipUploadDiscardWarning, setSkipUploadDiscardWarning] = useState(false);
  const [previewImageUri, setPreviewImageUri] = useState<string | null>(null);
  const [previewStatus, setPreviewStatus] = useState('');
  const [previewFileOrder, setPreviewFileOrder] = useState(0);
  const [isPreviewDecrypting, setIsPreviewDecrypting] = useState(false);
  const previewDecryptCacheRef = useRef(new Map<string, {previewImageUri: string | null; previewStatus: string}>());
  const [isVaultLocked, setIsVaultLocked] = useState(true);
  const [hasUnlockedThisLaunch, setHasUnlockedThisLaunch] = useState(false);
  const [isTransitioningToAuth, setIsTransitioningToAuth] = useState(false);
  const [displayPassphrase, setDisplayPassphrase] = useState<string | null>(null);
  const [keyBackupStatus, setKeyBackupStatus] = useState('');
  const [accountStatus, setAccountStatus] = useState('');
  const [pendingNewEmail, setPendingNewEmail] = useState('');
  const [authNotice, setAuthNotice] = useState<string | null>(null);
  const [saveOfflineByDefault, setSaveOfflineByDefault] = useState(false);
  const [recoverableByDefault, setRecoverableByDefault] = useState(false);
  const [autoSyncKeys, setAutoSyncKeys] = useState(false);
  const [keyBackupEnabled, setKeyBackupEnabled] = useState(false);
  const [recoveryPassphraseForSettings, setRecoveryPassphraseForSettings] = useState<string | null>(null);
  const [guestAccountExists, setGuestAccountExists] = useState(false);
  const [showKeyBackupSetupModal, setShowKeyBackupSetupModal] = useState(false);
  const pendingEnableKeyBackupActionRef = useRef<(() => void) | null>(null);
  const keyBackupEnabledRef = useRef(false);
  const keyBackupSetupModalOpenRef = useRef(false);
  const transitionOpacity = useRef(new Animated.Value(1)).current;
  const transitionTranslateY = useRef(new Animated.Value(0)).current;
  const didHandlePendingCompleteAuthRef = useRef(false);
  const isLockTransitioningRef = useRef(false);
  const hasLoadedInitialDocuments = useRef(false);

  useEffect(() => {
    if (isInitializing) {
      return;
    }

    hasLoadedInitialDocuments.current = true;
  }, [isInitializing]);

  const currentUserIdentifiers = useMemo(
    () => [user?.uid?.trim(), user?.email?.trim()].filter((value): value is string => Boolean(value)),
    [user?.email, user?.uid],
  );

  const currentShareDecisionOwnerKey = useMemo(
    () => user?.uid?.trim() || user?.email?.trim() || 'anonymous',
    [user?.email, user?.uid],
  );

  const incomingShareDecisionsForCurrentUser = useMemo(
    () => incomingShareDecisionStore[currentShareDecisionOwnerKey] ?? {},
    [currentShareDecisionOwnerKey, incomingShareDecisionStore],
  );

  const uploadCanUseCloud = !isGuest && backupCloud && Boolean(user?.uid);

  const shouldRequireUnlock = isAuthenticated;

  const enterLockScreen = useCallback(() => {
    if (isLockTransitioningRef.current || isVaultLocked || isTransitioningToAuth || isCompletingAuthFlow) {
      return;
    }

    isLockTransitioningRef.current = true;
    Animated.timing(transitionOpacity, {
      toValue: 0,
      duration: 170,
      useNativeDriver: true,
    }).start(() => {
      setIsVaultLocked(true);
      isLockTransitioningRef.current = false;
    });
  }, [isCompletingAuthFlow, isTransitioningToAuth, isVaultLocked, transitionOpacity]);

  const resolveVerificationLink = (incomingUrl: string) => {
    try {
      const isAppDeepLink = incomingUrl.startsWith('secdocvault://auth/email-link');

      if (!isAppDeepLink) {
        return incomingUrl;
      }

      const queryString = incomingUrl.split('?')[1] ?? '';
      const encodedLink = queryString
        .split('&')
        .map(item => item.split('='))
        .find(([key]) => decodeURIComponent(key) === 'link')?.[1];

      if (!encodedLink) {
        return '';
      }

      return decodeURIComponent(encodedLink);
    } catch {
      return incomingUrl;
    }
  };

  const isVerificationCallbackUrl = (incomingUrl: string) => {
    if (!incomingUrl.trim()) {
      return false;
    }

    if (incomingUrl.startsWith('secdocvault://auth/email-link')) {
      return true;
    }

    return incomingUrl.includes('/auth/email-link') || incomingUrl.includes('oobCode=');
  };

  const forceReloginFromLockRef = useRef<() => void>(() => undefined);
  forceReloginFromLockRef.current = () => {
    if (isTransitioningToAuth) {
      return;
    }

    void (async () => {
      setIsTransitioningToAuth(true);
      try {
        await signOut();
        await AsyncStorage.removeItem(COMPLETE_AUTH_PENDING_KEY);
        setIsCompletingAuthFlow(false);
        resetAuthForm();
        setShowCompleteAuthSetup(false);
        setAuthCredentialSnapshot(null);
        setHasUnlockedThisLaunch(false);
        setIsVaultLocked(false);
        setAuthGateStage('auth');
      } finally {
        setIsTransitioningToAuth(false);
      }
    })();
  };

  useEffect(() => {
    transitionOpacity.setValue(0.92);
    transitionTranslateY.setValue(6);
    Animated.parallel([
      Animated.timing(transitionOpacity, {
        toValue: 1,
        duration: 180,
        useNativeDriver: true,
      }),
      Animated.timing(transitionTranslateY, {
        toValue: 0,
        duration: 220,
        useNativeDriver: true,
      }),
    ]).start();
  }, [
    accessMode,
    authGateStage,
    authMode,
    screen,
    isAuthenticated,
    isVaultLocked,
    transitionOpacity,
    transitionTranslateY,
  ]);

  useEffect(() => {
    void (async () => {
      const preferences = await getVaultPreferences();
      const incomingShareDecisions = await getIncomingShareDecisionStore();
      const derivedAutoSync = preferences.keyBackupEnabled;
      setIncomingShareDecisionStore(incomingShareDecisions);
      setSaveOfflineByDefault(preferences.saveOfflineByDefault);
      setRecoverableByDefault(preferences.recoverableByDefault);
      setAutoSyncKeys(derivedAutoSync);
      setKeyBackupEnabled(preferences.keyBackupEnabled);
      await setAutoKeySyncEnabled(derivedAutoSync);
      const recoveryPassphrase = await getRecoveryPassphraseForSettings();
      setRecoveryPassphraseForSettings(recoveryPassphrase);

      const skipDiscardWarning = await AsyncStorage.getItem(UPLOAD_DISCARD_WARNING_PREF_KEY);
      setSkipUploadDiscardWarning(skipDiscardWarning === '1');

      const guestExists = await hasGuestAccount();
      setGuestAccountExists(guestExists);
    })();
  }, [hasGuestAccount]);

  useEffect(() => {
    if (authGateStage !== 'auth' || accessMode !== 'guest') {
      return;
    }

    void (async () => {
      const guestExists = await hasGuestAccount();
      setGuestAccountExists(guestExists);
    })();
  }, [accessMode, authGateStage, hasGuestAccount]);

  useEffect(() => {
    if (!isAuthenticated || isGuest || !user?.uid) {
      return;
    }

    void ensureCurrentUserSharePublicKey(user.uid, user.email)
      .catch(error => {
        const message = error instanceof Error ? error.message : 'Failed to publish sharing public key.';
        setUploadStatus(message);
      });
  }, [isAuthenticated, isGuest, user?.email, user?.uid]);

  useEffect(() => {
    keyBackupEnabledRef.current = keyBackupEnabled;
  }, [keyBackupEnabled]);

  useEffect(() => {
    keyBackupSetupModalOpenRef.current = showKeyBackupSetupModal;
  }, [showKeyBackupSetupModal]);

  const reloadDocuments = useCallback(async () => {
    const isPermissionDeniedError = (error: unknown) =>
      typeof error === 'object' &&
      error !== null &&
      'code' in error &&
      String((error as {code?: unknown}).code).includes('permission-denied');

    const syncDocuments = async () => {
      try {
        // If not authenticated and not initializing, load local documents but don't sync from cloud
        if (!isAuthenticated && !isInitializing) {
          setHasUnlockedThisLaunch(false);
          const localDocs = await getLocalDocuments();
          // Only set to empty if there are genuinely no local documents
          if (localDocs.length === 0) {
            setDocuments([]);
            setSelectedDoc(null);
          } else {
            setDocuments(localDocs);
            setSelectedDoc(localDocs[0] ?? null);
          }
          return;
        }

        // Skip syncing if we're still initializing auth
        if (isInitializing) {
          return;
        }

        if (isGuest || !backupCloud || !user?.uid) {
          const localDocs = await getLocalDocuments();
          setDocuments(localDocs);
          setSelectedDoc(localDocs[0] ?? null);
          return;
        }

        const [firebaseDocs, sharedDocs, localDocs] = await Promise.all([
          listVaultDocumentsFromFirebase(user.uid),
          currentUserIdentifiers.length > 0
            ? listVaultDocumentsSharedWithUser(currentUserIdentifiers)
            : Promise.resolve([]),
          getLocalDocuments(),
        ]);
        const localById = new Map(localDocs.map(item => [item.id, item]));
        const mergedDocs = new Map<string, VaultDocument>();

        const mergeReferences = (left: VaultDocument['references'] = [], right: VaultDocument['references'] = []) => {
          const seen = new Set<string>();

          return [...left, ...right].filter(reference => {
            const key = [
              reference.source,
              reference.order ?? '',
              reference.name,
              reference.storagePath ?? '',
              reference.localPath ?? '',
            ].join('|');

            if (seen.has(key)) {
              return false;
            }

            seen.add(key);
            return true;
          });
        };

        const upsertDocument = (doc: VaultDocument) => {
          const existing = mergedDocs.get(doc.id);
          if (!existing) {
            mergedDocs.set(doc.id, doc);
            return;
          }

          const references = mergeReferences(existing.references, doc.references);
          const mergedSharedWith = Array.from(
            new Set([...(existing.sharedWith ?? []), ...(doc.sharedWith ?? [])].filter(Boolean)),
          );
          const mergedSharedKeyGrants = Array.from(
            new Map(
              [
                ...(existing.sharedKeyGrants ?? []),
                ...(doc.sharedKeyGrants ?? []),
              ].map(grant => [
                `${grant.recipientUid}|${grant.recipientEmail ?? ''}|${grant.createdAt}|${grant.expiresAt.toString()}`,
                grant,
              ]),
            ).values(),
          );

          mergedDocs.set(doc.id, {
            ...existing,
            references,
            sharedWith: mergedSharedWith,
            sharedKeyGrants: mergedSharedKeyGrants,
            encryptedDocKey: existing.encryptedDocKey ?? doc.encryptedDocKey,
            saveMode: existing.saveMode ?? doc.saveMode,
            recoverable: existing.recoverable ?? doc.recoverable,
            offlineAvailable:
              Boolean(existing.offlineAvailable || doc.offlineAvailable) ||
              references.some(reference => reference.source === 'local'),
          });
        };

        const mergeWithLocalCopy = (doc: VaultDocument) => {
          const localCopy = localById.get(doc.id);
          const localRefs = localCopy?.references?.filter(ref => ref.source === 'local') ?? [];
          if (localRefs.length === 0) {
            return doc;
          }

          const references = mergeReferences(doc.references, localRefs);
          return {
            ...doc,
            references,
            offlineAvailable: true,
          };
        };

        [...firebaseDocs, ...sharedDocs, ...localDocs].forEach(doc => {
          upsertDocument(mergeWithLocalCopy(doc));
        });

        let mergedList = [...mergedDocs.values()].sort((a, b) => b.uploadedAt.localeCompare(a.uploadedAt));
        if (user?.uid) {
          const ownerDocs = mergedList.filter(item => item.owner === user.uid);
          const enforcedOwnerDocs = await Promise.all(
            ownerDocs.map(item => enforceExpiredShareRevocations(item, user.uid!)),
          );
          const ownerById = new Map(enforcedOwnerDocs.map(item => [item.id, item]));
          mergedList = mergedList.map(item => ownerById.get(item.id) ?? item);
        }

        setDocuments(mergedList);
        setSelectedDoc(mergedList[0] ?? null);
      } catch (error) {
        const localDocs = await getLocalDocuments();
        setDocuments(localDocs);
        setSelectedDoc(localDocs[0] ?? null);

        if (!isPermissionDeniedError(error)) {
          const message = error instanceof Error ? error.message : 'Failed to sync cloud documents.';
          setUploadStatus(`Cloud sync unavailable: ${message}`);
        }
      }
    };

    await syncDocuments();
  }, [backupCloud, currentUserIdentifiers, isAuthenticated, isGuest, isInitializing, user?.uid]);

  useEffect(() => {
    void reloadDocuments();
  }, [reloadDocuments]);

  useEffect(() => {
    // Don't save until we've finished initial document loading
    if (!hasLoadedInitialDocuments.current) {
      return;
    }

    void saveLocalDocuments(documents);
  }, [documents]);

  useEffect(() => {
    if (verificationCooldown <= 0) {
      return;
    }

    const interval = setInterval(() => {
      setVerificationCooldown(prev => (prev > 0 ? prev - 1 : 0));
    }, 1000);

    return () => clearInterval(interval);
  }, [verificationCooldown]);

  useEffect(() => {
    if (accessMode !== 'login') {
      return;
    }

    const handlePotentialVerificationLink = async (url: string) => {
      if (!isVerificationCallbackUrl(url)) {
        return;
      }

      const verificationLink = resolveVerificationLink(url);
      if (!verificationLink) {
        return;
      }

      const success = await completeEmailLinkRegistration(verificationLink, email);
      if (!success) {
        return;
      }

      setEmailVerifiedForRegistration(true);
      setAccountStatus('Email verified. Continue by setting your password and tapping Create Account.');
      setAuthNotice(null);
    };

    void (async () => {
      const initialUrl = await Linking.getInitialURL();
      if (initialUrl) {
        void handlePotentialVerificationLink(initialUrl);
      }
    })();

    const subscription = Linking.addEventListener('url', event => {
      void handlePotentialVerificationLink(event.url);
    });

    return () => {
      subscription.remove();
    };
  }, [accessMode, authMode, completeEmailLinkRegistration, email]);

  useEffect(() => {
    if (!selectedDoc) {
      setSelectedDoc(documents[0] ?? null);
      return;
    }

    const stillExists = documents.some(item => item.id === selectedDoc.id);
    if (!stillExists) {
      setSelectedDoc(documents[0] ?? null);
    }
  }, [documents, selectedDoc]);

  useEffect(() => {
    if (!autoSyncKeys || !isAuthenticated || isGuest || !user?.uid || documents.length === 0) {
      return;
    }

    void autoSyncKeysIfEnabled(user.uid, documents)
      .then(synced => {
        if (synced) {
          setKeyBackupStatus('Auto-sync complete: encrypted keys updated in Firebase backup.');
        }
      })
      .catch(error => {
        const message = error instanceof Error ? error.message : 'Auto-sync failed.';
        setKeyBackupStatus(`Auto-sync error: ${message}`);
      });
  }, [autoSyncKeys, documents, isAuthenticated, isGuest, user?.uid]);

  useEffect(() => {
    if (!isAuthenticated) {
      setIsVaultLocked(false);
      return;
    }

    if (!hasUnlockedThisLaunch) {
      setIsVaultLocked(true);
    }
  }, [hasUnlockedThisLaunch, isAuthenticated]);

  useEffect(() => {
    let currentState = AppState.currentState;

    const subscription = AppState.addEventListener('change', (nextState: AppStateStatus) => {
      const isGoingToBackground = currentState === 'active' && nextState !== 'active';
      currentState = nextState;

      if (isGoingToBackground && isAuthenticated && shouldRequireUnlock) {
        if (preferredProtection === 'none' && !isCompletingAuthFlow) {
          forceReloginFromLockRef.current();
          return;
        }
        enterLockScreen();
      }
    });

    return () => {
      subscription.remove();
    };
  }, [enterLockScreen, isAuthenticated, isCompletingAuthFlow, preferredProtection, shouldRequireUnlock]);

  useEffect(() => {
    const subscription = BackHandler.addEventListener('hardwareBackPress', () => {
      if (isAuthenticated) {
        if (isVaultLocked) {
          return false;
        }

        if (screen === 'main') {
          if (preferredProtection === 'none' && !isCompletingAuthFlow) {
            forceReloginFromLockRef.current();
            return true;
          }
          enterLockScreen();
          return true;
        }

        if (screen === 'upload') {
          if (!pendingUploadDraft) {
            setScreen('main');
            return true;
          }

          if (skipUploadDiscardWarning) {
            setPendingUploadDraft(null);
            setPendingUploadName('Document');
            setPendingUploadDescription('');
            setPendingUploadRecoverable(uploadCanUseCloud ? recoverableByDefault : false);
            setPendingUploadToCloud(false);
            setPendingUploadAlsoSaveLocal(true);
            setPendingUploadPreviewIndex(0);
            setScreen('main');
            return true;
          }

          setDontShowUploadDiscardWarningAgain(false);
          setShowUploadDiscardWarning(true);
          return true;
        }

        if (screen === 'sharedetails') {
          setScreen('share');
          return true;
        }

        if (screen === 'share') {
          setScreen(shareOriginScreen);
          return true;
        }

        if (RECOVERY_SUB_SCREENS.includes(screen as (typeof RECOVERY_SUB_SCREENS)[number])) {
          setScreen('settings');
          return true;
        }

        setScreen('main');
        return true;
      }

      if (authGateStage === 'auth') {
        setAuthGateStage(authReturnStage);
        return true;
      }

      return false;
    });

    return () => {
      subscription.remove();
    };
  }, [
    authGateStage,
    authReturnStage,
    dontShowUploadDiscardWarningAgain,
    enterLockScreen,
    recoverableByDefault,
    isAuthenticated,
    isCompletingAuthFlow,
    isVaultLocked,
    pendingUploadDraft,
    preferredProtection,
    screen,
    shareOriginScreen,
    skipUploadDiscardWarning,
    uploadCanUseCloud,
  ]);

  const canSubmitAuth = useMemo(
    () => {
      if (accessMode === 'guest') {
        const hasPassword = password.trim().length > 5;
        return authMode === 'register' ? hasPassword && password === confirmPassword : hasPassword;
      }

      const hasEmail = email.trim().length > 4;
      const hasPassword = password.trim().length > 5;
      return authMode === 'register'
        ? hasEmail && hasPassword && password === confirmPassword && emailVerifiedForRegistration
        : hasEmail && hasPassword;
    },
    [accessMode, authMode, confirmPassword, email, emailVerifiedForRegistration, password],
  );

  const totalDocsCount = documents.length;
  const recoverableDocsCount = useMemo(
    () => documents.filter(item => item.recoverable !== false).length,
    [documents],
  );

  const resetAuthForm = () => {
    setAuthMode('login');
    setAccessMode('login');
    setEmail('');
    setPassword('');
    setConfirmPassword('');
    setEmailVerifiedForRegistration(false);
    setVerificationLinkInput('');
    setVerificationCooldown(0);
    setAuthNotice(null);
    clearError();
  };

  useEffect(() => {
    if (!isAuthenticated || !isVaultLocked || preferredProtection !== 'none' || isCompletingAuthFlow) {
      return;
    }
    forceReloginFromLockRef.current();
  }, [isAuthenticated, isCompletingAuthFlow, isVaultLocked, preferredProtection]);

  const requestGuestOverwriteConfirmation = () =>
    new Promise<boolean>(resolve => {
      Alert.alert(
        'Replace existing guest account?',
        'A guest account already exists on this device. Creating a new guest account will erase the previous guest vault data from this device.',
        [
          {
            text: 'Cancel',
            style: 'cancel',
            onPress: () => resolve(false),
          },
          {
            text: 'Erase & Create New',
            style: 'destructive',
            onPress: () => resolve(true),
          },
        ],
      );
    });

  const handleAuth = async () => {
    if (!canSubmitAuth) {
      return;
    }

    setIsCompletingAuthFlow(true);

    if (accessMode === 'login' && (user || isGuest)) {
      await signOut();
    }

    const isSuccess =
      accessMode === 'guest'
        ? authMode === 'register'
          ? await (async () => {
              if (guestAccountExists) {
                const confirm = await requestGuestOverwriteConfirmation();
                if (!confirm) {
                  return false;
                }
              }

              const created = await registerGuestAccount(password, guestAccountExists);
              if (created) {
                setGuestAccountExists(true);
              }
              return created;
            })()
          : await loginGuestAccount(password)
        : authMode === 'login'
          ? await signIn(email, password)
          : await signUp(email, password);

    if (!isSuccess) {
      setIsCompletingAuthFlow(false);
      return;
    }

    setAuthCredentialSnapshot({
      email: email.trim(),
      password,
    });
    setShowCompleteAuthSetup(true);
    setHasUnlockedThisLaunch(true);
    setIsVaultLocked(false);

    // Persist this flag after UI transition state is set to avoid a one-frame main/auth bounce.
    void AsyncStorage.setItem(COMPLETE_AUTH_PENDING_KEY, '1');
  };

  const handlePasskeyUnlock = async () => {
    if (isTransitioningToAuth) {
      return;
    }

    const success = await unlockWithSavedPasskey();
    if (success) {
      setHasUnlockedThisLaunch(true);
      setIsVaultLocked(false);
    }
  };

  const handleBiometricUnlock = async () => {
    if (isTransitioningToAuth) {
      return;
    }

    const success = await unlockWithBiometric();
    if (success) {
      setHasUnlockedThisLaunch(true);
      setIsVaultLocked(false);
    }
  };

  const handlePinUnlock = async (pin: string) => {
    if (isTransitioningToAuth) {
      return;
    }

    const success = await unlockWithPin(pin);
    if (success) {
      setHasUnlockedThisLaunch(true);
      setIsVaultLocked(false);
    }
  };

  const handleCompleteAuthSetup = async ({
    method,
    pin,
    useBiometricForPin,
  }: {
    method: AuthProtection;
    pin?: string;
    useBiometricForPin: boolean;
  }) => {
    const success = await updateUnlockMethod(method, {
      pin,
      pinBiometricEnabled: useBiometricForPin,
      firebaseEmail: authCredentialSnapshot?.email,
      firebasePassword: authCredentialSnapshot?.password,
    });

    if (!success) {
      return;
    }

    await AsyncStorage.removeItem(COMPLETE_AUTH_PENDING_KEY);

    setShowCompleteAuthSetup(false);
    setIsCompletingAuthFlow(false);
    resetAuthForm();
    setAuthCredentialSnapshot(null);
    setScreen('main');
    setHasUnlockedThisLaunch(true);
    setIsVaultLocked(false);
  };

  const canUseUnlockButton =
    preferredProtection === 'passkey' ||
    preferredProtection === 'pin' ||
    preferredProtection === 'biometric';
  const shouldShowCompleteAuthSetup = isAuthenticated && (showCompleteAuthSetup || isCompletingAuthFlow);

  const goToAuthForm = () => {
    setAuthReturnStage('unlock');
    setAccessMode('login');
    setAuthGateStage('auth');
    clearError();
  };

  const switchAuthMode = (mode: AuthMode) => {
    setAuthMode(mode);
    setEmailVerifiedForRegistration(false);
    setVerificationLinkInput('');
    setVerificationCooldown(0);
    setAuthNotice(null);
    clearError();
  };

  const goToAuth = (mode: 'login' | 'guest') => {
    setAuthReturnStage('hero');
    setAccessMode(mode);
    setEmailVerifiedForRegistration(false);
    setVerificationLinkInput('');
    setVerificationCooldown(0);
    setAuthNotice(null);
    setAuthGateStage('auth');
    clearError();
  };

  const returnFromAuth = () => {
    setAuthGateStage(authReturnStage);
    clearError();
  };

  const handleGoToAuthFromLocked = () => {
    if (isTransitioningToAuth) {
      return;
    }

    void (async () => {
      setIsTransitioningToAuth(true);
      setAuthReturnStage('unlock');
      clearError();

      try {
        await signOut();
        await AsyncStorage.removeItem(COMPLETE_AUTH_PENDING_KEY);
        setIsCompletingAuthFlow(false);
        resetAuthForm();
        setShowCompleteAuthSetup(false);
        setAuthCredentialSnapshot(null);
        setHasUnlockedThisLaunch(false);
        setAuthGateStage('auth');
      } finally {
        setIsTransitioningToAuth(false);
      }
    })();
  };

  const handleUpgradeGuestToCloud = () => {
    if (!isGuest) {
      return;
    }

    void (async () => {
      await signOut();
      setScreen('main');
      setAuthReturnStage('hero');
      setAccessMode('login');
      setAuthMode('register');
      setAuthNotice('Upgrade to cloud by creating or signing in to a Firebase account.');
      setHasUnlockedThisLaunch(false);
      setIsVaultLocked(false);
      setAuthGateStage('auth');
    })();
  };

  useEffect(() => {
    if (isInitializing || didHandlePendingCompleteAuthRef.current) {
      return;
    }

    didHandlePendingCompleteAuthRef.current = true;

    void (async () => {
      const pending = await AsyncStorage.getItem(COMPLETE_AUTH_PENDING_KEY);
      if (pending !== '1') {
        return;
      }

      await AsyncStorage.removeItem(COMPLETE_AUTH_PENDING_KEY);
      setShowCompleteAuthSetup(false);
      setAuthCredentialSnapshot(null);
      setIsCompletingAuthFlow(false);

      if (isAuthenticated) {
        await updateUnlockMethod('none');
      }
    })();
  }, [isAuthenticated, isInitializing, updateUnlockMethod]);

  const updateEmail = (value: string) => {

    setEmail(value);
    setEmailVerifiedForRegistration(false);
    setVerificationLinkInput('');
    setAuthNotice(null);
    clearError();
  };

  const updatePassword = (value: string) => {
    setPassword(value);
    setAuthNotice(null);
    clearError();
  };

  const updateConfirmPassword = (value: string) => {
    setConfirmPassword(value);
    setAuthNotice(null);
    clearError();
  };

  const openPreview = (doc: VaultDocument) => {
    previewDecryptCacheRef.current.clear();
    setSelectedDoc(doc);
    setPreviewFileOrder(0);
    setPreviewImageUri(null);
    setPreviewStatus('');
    setIsPreviewDecrypting(false);
    setScreen('preview');
  };

  const openShare = (doc: VaultDocument) => {
    if (isGuest) {
      setBackupStatus('Sharing is disabled in guest mode.');
      return;
    }

    const hasCloudCopy = Boolean(doc.references?.some(reference => reference.source === 'firebase'));
    if (!hasCloudCopy) {
      setUploadStatus('Document must be saved to cloud before sharing.');
      return;
    }

    if (!user?.uid || doc.owner !== user.uid) {
      setUploadStatus('Only the document owner can create or revoke share keys.');
      return;
    }

    setShareOriginScreen(screen === 'preview' ? 'preview' : 'main');
    setSelectedDoc(doc);
    setShareTarget('');
    setAllowDownload(true);
    setShareExpiryDays('30');
    setShareStatus('');
    setIsShareSubmitting(false);
    setScreen('share');
  };

  const persistIncomingShareDecision = useCallback(
    (docId: string, decision: IncomingShareDecision) => {
      setIncomingShareDecisionStore(prev => {
        const nextForCurrentUser = {
          ...(prev[currentShareDecisionOwnerKey] ?? {}),
          [docId]: decision,
        };
        const nextStore = {
          ...prev,
          [currentShareDecisionOwnerKey]: nextForCurrentUser,
        };

        void saveIncomingShareDecisionStore(nextStore);
        return nextStore;
      });
    },
    [currentShareDecisionOwnerKey],
  );

  const handleAcceptIncomingShare = useCallback(
    (docId: string) => {
      persistIncomingShareDecision(docId, 'accepted');
      setUploadStatus('Incoming shared document accepted.');
    },
    [persistIncomingShareDecision],
  );

  const handleDeclineIncomingShare = useCallback(
    (docId: string) => {
      persistIncomingShareDecision(docId, 'declined');
      setUploadStatus('Incoming shared document declined.');
    },
    [persistIncomingShareDecision],
  );

  const handleRevokeShareForRecipient = async (recipientEmail: string) => {
    if (!selectedDoc || !user?.uid) {
      setShareStatus('Select a document and sign in before revoking share.');
      return;
    }

    if (selectedDoc.owner !== user.uid) {
      setShareStatus('Only the document owner can revoke share keys.');
      return;
    }

    const normalizedRecipientEmail = recipientEmail.trim();
    if (!normalizedRecipientEmail) {
      setShareStatus('Enter recipient email before revoking a share key.');
      return;
    }

    try {
      setIsShareSubmitting(true);
      setShareStatus(`Revoking shared key for ${normalizedRecipientEmail}...`);
      const updated = await revokeDocumentShareGrant(selectedDoc, user.uid, normalizedRecipientEmail);
      setDocuments(prev => prev.map(item => (item.id === updated.id ? updated : item)));
      setSelectedDoc(updated);
      setShareStatus('Shared key revoked and document key rotated.');
      setUploadStatus('Shared key revoked and document key rotated.');
      setScreen(shareOriginScreen);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to revoke shared key.';
      setShareStatus(message);
      setUploadStatus(message);
    } finally {
      setIsShareSubmitting(false);
    }
  };

  const handleCreateShare = async () => {
    if (!selectedDoc || !user?.uid) {
      setShareStatus('Select a document and sign in before sharing.');
      return;
    }

    if (selectedDoc.owner !== user.uid) {
      setShareStatus('Only the document owner can create share keys.');
      return;
    }

    if (!shareTarget.trim()) {
      setShareStatus('Enter recipient email before creating a share key.');
      return;
    }

    try {
      setIsShareSubmitting(true);
      setShareStatus(`Creating share key for ${shareTarget.trim()}...`);
      const expiryDays = Number.parseInt(shareExpiryDays.trim(), 10);
      const updated = await createDocumentShareGrant(
        selectedDoc,
        user.uid,
        shareTarget.trim(),
        allowDownload,
        Number.isNaN(expiryDays) ? 30 : expiryDays,
      );

      setDocuments(prev => prev.map(item => (item.id === updated.id ? updated : item)));
      setSelectedDoc(updated);
      setShareStatus('Share key created/updated successfully.');
      setUploadStatus('Share key created/updated successfully.');
      setScreen(shareOriginScreen);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to create share key.';
      setShareStatus(message);
      setUploadStatus(message);
    } finally {
      setIsShareSubmitting(false);
    }
  };

  const handleRevokeShare = async () => {
    await handleRevokeShareForRecipient(shareTarget);
  };

  const requestKeyBackupSetup = (onEnabled: () => void) => {
    if (keyBackupSetupModalOpenRef.current) {
      return;
    }

    pendingEnableKeyBackupActionRef.current = onEnabled;
    keyBackupSetupModalOpenRef.current = true;
    setShowKeyBackupSetupModal(true);
  };

  const confirmKeyBackupSetup = async () => {
    try {
      const passphrase = await ensureRecoveryPassphrase();
      setRecoveryPassphraseForSettings(passphrase);
      setKeyBackupEnabled(true);
      keyBackupEnabledRef.current = true;
      setAutoSyncKeys(true);
      await setAutoKeySyncEnabled(true);
      await saveVaultPreferences({
        saveOfflineByDefault,
        recoverableByDefault,
        autoSyncKeys: true,
        keyBackupEnabled: true,
      });
      keyBackupSetupModalOpenRef.current = false;
      setShowKeyBackupSetupModal(false);
      const pendingAction = pendingEnableKeyBackupActionRef.current;
      pendingEnableKeyBackupActionRef.current = null;
      pendingAction?.();
      setUploadStatus('Key backup enabled. You can now enable recovery per document.');
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to set up key backup.';
      setUploadStatus(message);
    }
  };

  const cancelKeyBackupSetup = () => {
    keyBackupSetupModalOpenRef.current = false;
    setShowKeyBackupSetupModal(false);
    pendingEnableKeyBackupActionRef.current = null;
  };

  const handleToggleDocumentRecovery = async (docMeta: VaultDocument, enabled: boolean) => {
    if (enabled && !keyBackupEnabledRef.current) {
      requestKeyBackupSetup(() => {
        void handleToggleDocumentRecovery(docMeta, true);
      });
      return;
    }

    try {
      const updated = await updateDocumentRecoveryPreference(docMeta, enabled);
      const nextDocuments = documents.map(item => (item.id === updated.id ? updated : item));
      setDocuments(nextDocuments);
      setSelectedDoc(prev => (prev?.id === updated.id ? updated : prev));
      setUploadStatus(enabled ? `${docMeta.name} added to key backup.` : `${docMeta.name} removed from key backup.`);

      if (!isGuest && user?.uid && keyBackupEnabledRef.current) {
        const recoverableCloudDocs = nextDocuments.filter(item => {
          const hasCloudCopy = Boolean(item.references?.some(reference => reference.source === 'firebase'));
          return item.recoverable !== false && hasCloudCopy;
        });

        if (recoverableCloudDocs.length === 0) {
          setKeyBackupStatus('No cloud documents are marked recoverable yet.');
          return;
        }

        try {
          setKeyBackupStatus('Syncing key backup to Firebase...');
          const passphrase = await ensureRecoveryPassphrase();
          setRecoveryPassphraseForSettings(passphrase);
          const result = await backupKeysToFirebase(user.uid, nextDocuments, passphrase);
          setKeyBackupStatus(`Key backup synced (${result.backedUpCount} keys).`);
        } catch (syncError) {
          const syncMessage = syncError instanceof Error ? syncError.message : 'Failed to sync key backup.';
          setKeyBackupStatus(`Backup sync failed: ${syncMessage}`);
        }
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to update document backup setting.';
      setUploadStatus(message);
      setPreviewStatus(message);
    }
  };

  const handleSetKeyBackupEnabled = async (enabled: boolean) => {
    try {
      let nextPassphrase = recoveryPassphraseForSettings;
      if (enabled) {
        nextPassphrase = await ensureRecoveryPassphrase();
      }

      setKeyBackupEnabled(enabled);
      setAutoSyncKeys(enabled);
      setRecoveryPassphraseForSettings(nextPassphrase);
      await setAutoKeySyncEnabled(enabled);
      await saveVaultPreferences({
        saveOfflineByDefault,
        recoverableByDefault,
        autoSyncKeys: enabled,
        keyBackupEnabled: enabled,
      });
      setAccountStatus(enabled ? 'Key backup enabled.' : 'Key backup disabled.');
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to update key backup setting.';
      setAccountStatus(message);
    }
  };

  const handleResetBackupPassphrase = async () => {
    const confirmed = await new Promise<boolean>(resolve => {
      Alert.alert(
        'Generate new recovery passphrase?',
        'This will permanently remove your current cloud key backup (vaultKeyBackups). You must create a new key backup after generating the passphrase.',
        [
          {
            text: 'Cancel',
            style: 'cancel',
            onPress: () => resolve(false),
          },
          {
            text: 'Generate New',
            style: 'destructive',
            onPress: () => resolve(true),
          },
        ],
      );
    });

    if (!confirmed) {
      return;
    }

    try {
      if (isGuest || !user?.uid) {
        setAccountStatus('Sign in with a cloud account to reset and sync key backups.');
        return;
      }

      await deleteKeyBackupFromFirebase(user.uid);
      const passphrase = await resetRecoveryPassphraseForSettings();
      setRecoveryPassphraseForSettings(passphrase);

      const recoverableCloudDocs = documents.filter(item => {
        const hasCloudCopy = Boolean(item.references?.some(reference => reference.source === 'firebase'));
        return item.recoverable !== false && hasCloudCopy;
      });

      if (recoverableCloudDocs.length === 0) {
        setKeyBackupStatus('Passphrase reset. No recoverable cloud documents found, so no new backup was created.');
        setAccountStatus('Backup passphrase reset and previous cloud key backup deleted.');
        return;
      }

      setKeyBackupStatus('Generating new cloud key backup...');
      const result = await backupKeysToFirebase(user.uid, recoverableCloudDocs, passphrase);
      setKeyBackupStatus(`New cloud key backup created (${result.backedUpCount} keys).`);
      setAccountStatus('Backup passphrase reset, old backup deleted, and new cloud key backup created.');
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to reset backup passphrase.';
      setAccountStatus(message);
    }
  };

  const backedUpDocs = useMemo(
    () =>
      documents
        .filter(item => item.recoverable !== false)
        .map(item => ({
          id: item.id,
          name: item.name,
          canRecover: Boolean(item.references?.some(reference => reference.source === 'firebase')),
        })),
    [documents],
  );
  const notBackedUpDocs = useMemo(
    () =>
      documents
        .filter(item => item.recoverable === false)
        .map(item => ({
          id: item.id,
          name: item.name,
          canRecover: Boolean(item.references?.some(reference => reference.source === 'firebase')),
        })),
    [documents],
  );

  const handleToggleDocBackupFromSettings = async (docId: string, enabled: boolean) => {
    const target = documents.find(item => item.id === docId);
    if (!target) {
      setAccountStatus('Document not found. Reload and try again.');
      return;
    }

    await handleToggleDocumentRecovery(target, enabled);
  };

  const appendUploadedDocument = (nextDoc: VaultDocument) => {
    setDocuments(prev => [nextDoc, ...prev]);
  };

  const clearPendingUploadDraft = () => {
    setPendingUploadDraft(null);
    setPendingUploadName('Document');
    setPendingUploadDescription('');
    setPendingUploadRecoverable(uploadCanUseCloud ? recoverableByDefault : false);
    setPendingUploadToCloud(uploadCanUseCloud);
    setPendingUploadAlsoSaveLocal(uploadCanUseCloud ? saveOfflineByDefault : true);
    setPendingUploadPreviewIndex(0);
  };

  const handleLeaveUploadScreen = () => {
    if (!pendingUploadDraft) {
      setScreen('main');
      return;
    }

    if (skipUploadDiscardWarning) {
      clearPendingUploadDraft();
      setScreen('main');
      return;
    }

    setDontShowUploadDiscardWarningAgain(false);
    setShowUploadDiscardWarning(true);
  };

  const confirmDiscardUploadDraft = async () => {
    if (dontShowUploadDiscardWarningAgain) {
      await AsyncStorage.setItem(UPLOAD_DISCARD_WARNING_PREF_KEY, '1');
      setSkipUploadDiscardWarning(true);
    }

    setShowUploadDiscardWarning(false);
    clearPendingUploadDraft();
    setScreen('main');
  };

  const selectUploadDocument = async (source: 'scan' | 'pick', appendToDraft = false) => {
    if (isUploading) {
      return;
    }

    if (appendToDraft && pendingUploadDraft && pendingUploadDraft.files.length >= MAX_FILES_PER_DOCUMENT) {
      setUploadStatus(`A document can contain at most ${MAX_FILES_PER_DOCUMENT} files.`);
      return;
    }

    setUploadStatus(source === 'scan' ? 'Opening camera...' : 'Opening file picker...');
    // suppressLockWhileSelectingRef.current = true;

    try {
      const document = source === 'scan' ? await scanDocumentForUpload() : await pickDocumentForUpload();
      setPendingUploadDraft(prev => {
        if (appendToDraft && prev) {
          return {
            ...prev,
            files: [...prev.files, document],
          };
        }

        return {
          name: 'Document',
          description: '',
          files: [document],
        };
      });

      if (appendToDraft && pendingUploadDraft) {
        setPendingUploadPreviewIndex(pendingUploadDraft.files.length);
      } else {
        setPendingUploadPreviewIndex(0);
        setPendingUploadName('Document');
        setPendingUploadDescription('');
        setPendingUploadRecoverable(uploadCanUseCloud ? recoverableByDefault : false);
        setPendingUploadToCloud(uploadCanUseCloud);
        setPendingUploadAlsoSaveLocal(uploadCanUseCloud ? saveOfflineByDefault : true);
      }

      setScreen('upload');
      setUploadStatus('Review your document details before uploading.');
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Selection failed.';
      setUploadStatus(message);
    } finally {
      // suppressLockWhileSelectingRef.current = false;
    }
  };

  const commitUploadDocument = async (draftDocument: UploadableDocumentDraft) => {
    if (isUploading) {
      return;
    }

    if (draftDocument.files.length === 0) {
      setUploadStatus('Add at least one file before uploading.');
      return;
    }

    if (draftDocument.files.length > MAX_FILES_PER_DOCUMENT) {
      setUploadStatus(`A document can contain at most ${MAX_FILES_PER_DOCUMENT} files.`);
      return;
    }

    setIsUploading(true);

    try {
      const document: UploadableDocumentDraft = {
        ...draftDocument,
        name: pendingUploadName.trim() || 'Document',
        description: pendingUploadDescription.trim(),
      };

      const shouldUploadToCloud = uploadCanUseCloud && pendingUploadToCloud;
      const shouldSaveLocal = pendingUploadAlsoSaveLocal || !shouldUploadToCloud;
      if (!shouldUploadToCloud && !shouldSaveLocal) {
        setUploadStatus('Enable at least one destination: local save or cloud upload.');
        return;
      }

      if (shouldUploadToCloud) {
        const tooLargeFile = document.files.find(file => file.size > 10 * 1024 * 1024);
        if (tooLargeFile) {
          setUploadStatus(`File ${tooLargeFile.name} is larger than 10 MB. Reduce size and retry.`);
          return;
        }

        const cloudOwnedCount = documents.filter(
          item => item.owner === user?.uid && item.references?.some(reference => reference.source === 'firebase'),
        ).length;
        if (cloudOwnedCount >= 10) {
          setUploadStatus('Cloud upload limit reached: maximum 10 documents per user.');
          return;
        }
      }

      const ownerId = user?.uid ?? 'guest-local';

      setUploadStatus(
        !shouldUploadToCloud
          ? `Encrypting ${document.files.length} file(s) for ${document.name}...`
          : `Uploading ${document.files.length} file(s) for ${document.name}...`,
      );

      const result = !shouldUploadToCloud
        ? await documentSaveLocal(ownerId, document, {
            recoverable: pendingUploadRecoverable,
          })
        : await (async () => {
            let lastProgressUpdate = 0;
            return uploadDocumentToFirebase(ownerId, document, {
              alsoSaveLocal: shouldSaveLocal,
              recoverable: pendingUploadRecoverable,
              onProgress: event => {
                const stageLabel: Record<string, string> = {
                  read: 'Reading',
                  encrypt: 'Encrypting',
                  upload: 'Uploading',
                  localSave: 'Saving local copy',
                  done: 'Done',
                };
                const fileTag = `${event.fileIndex + 1}/${document.files.length}`;
                if (event.status === 'progress' && typeof event.progress === 'number') {
                  const now = Date.now();
                  if (now - lastProgressUpdate < 150) {
                    return;
                  }
                  lastProgressUpdate = now;
                  setUploadStatus(`${stageLabel[event.stage]} file ${fileTag}: ${Math.round(event.progress * 100)}%`);
                  return;
                }
                if (event.status === 'start') {
                  setUploadStatus(`${stageLabel[event.stage]} file ${fileTag}...`);
                  return;
                }
                if (event.stage === 'done' && event.status === 'end') {
                  setUploadStatus(`Completed file ${fileTag}.`);
                }
              },
            });
          })();

      appendUploadedDocument(result.document);
      if (result.document.saveMode === 'local' || result.document.offlineAvailable) {
        const persistedLocal = await getLocalDocuments();
        await saveLocalDocuments([result.document, ...persistedLocal]);
        setUploadStatus(
          result.document.saveMode === 'local'
            ? `${document.name} encrypted and saved locally (${document.files.length} file(s)).`
            : `${document.name} uploaded and cached for offline decrypt (${document.files.length} file(s)).`,
        );
      } else {
        if (result.timings) {
          setUploadStatus(
            `${document.name} uploaded to Firebase Storage (${document.files.length} file(s)) in ${(result.timings.totalMs / 1000).toFixed(1)}s.`,
          );
        } else {
          setUploadStatus(`${document.name} uploaded to Firebase Storage (${document.files.length} file(s)).`);
        }
      }

      clearPendingUploadDraft();
      setScreen('main');
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Upload failed.';
      setUploadStatus(message);
    } finally {
      setIsUploading(false);
    }
  };

  const handleScanAndUpload = () => {
    void selectUploadDocument('scan', screen === 'upload');
  };

  const handlePickAndUpload = () => {
    void selectUploadDocument('pick', screen === 'upload');
  };

  const handleRemoveUploadFile = (index: number) => {
    setPendingUploadDraft(prev => {
      if (!prev) {
        return prev;
      }

      const nextFiles = prev.files.filter((_, fileIndex) => fileIndex !== index);
      if (nextFiles.length === 0) {
        setPendingUploadPreviewIndex(0);
        setUploadStatus('Upload draft cleared.');
        setScreen('main');
        return null;
      }

      setPendingUploadPreviewIndex(current => Math.max(0, Math.min(current, nextFiles.length - 1)));
      return {
        ...prev,
        files: nextFiles,
      };
    });
  };

  const handleReorderUploadFiles = (fromIndex: number, toIndex: number) => {
    setPendingUploadDraft(prev => {
      if (!prev || fromIndex === toIndex || fromIndex < 0 || toIndex < 0 || toIndex >= prev.files.length) {
        return prev;
      }

      const nextFiles = [...prev.files];
      const [moved] = nextFiles.splice(fromIndex, 1);
      nextFiles.splice(toIndex, 0, moved);
      setPendingUploadPreviewIndex(toIndex);

      return {
        ...prev,
        files: nextFiles,
      };
    });
  };

  const updateDocument = (targetId: string, updater: (doc: VaultDocument) => VaultDocument | null) => {
    setDocuments(prev =>
      prev
        .map(item => (item.id === targetId ? updater(item) : item))
        .filter((item): item is VaultDocument => Boolean(item)),
    );

    setSelectedDoc(prev => {
      if (!prev || prev.id !== targetId) {
        return prev;
      }

      return updater(prev);
    });
  };

  const handleSaveOffline = async (docMeta: VaultDocument) => {
    try {
      setUploadStatus(`Saving ${docMeta.name} for offline decrypt...`);
      const updated = await saveDocumentOffline(docMeta);
      updateDocument(docMeta.id, () => updated);
      setUploadStatus(`${docMeta.name} is now available offline.`);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to save offline copy.';
      setUploadStatus(message);
    }
  };

  const handleSaveToFirebase = async (docMeta: VaultDocument) => {
    if (isGuest) {
      setUploadStatus('Cloud save is unavailable in guest mode.');
      return;
    }

    if (!user?.uid) {
      setUploadStatus('Sign in before saving to Firebase.');
      return;
    }

    if (docMeta.owner && docMeta.owner !== user.uid && docMeta.owner !== 'guest-local') {
      setUploadStatus('Only owner documents or local guest documents can be saved to your Firebase vault.');
      return;
    }

    if (!(await hasInternetAccess())) {
      setUploadStatus('no internet access');
      return;
    }

    try {
      setUploadStatus(`Saving ${docMeta.name} to Firebase...`);
      const updated = await saveDocumentToFirebase(docMeta, user.uid);
      updateDocument(docMeta.id, () => updated);
      setUploadStatus(`${docMeta.name} is now saved in Firebase.`);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to save to Firebase.';
      setUploadStatus(message);
    }
  };

  const confirmFullDocumentDelete = (docMeta: VaultDocument, sourceLabel: 'offline' | 'Firebase') =>
    new Promise<boolean>(resolve => {
      Alert.alert(
        'Delete document permanently?',
        `${docMeta.name} has no other copies. Deleting the ${sourceLabel} copy will permanently delete this document and it cannot be recovered.`,
        [
          {
            text: 'Cancel',
            style: 'cancel',
            onPress: () => resolve(false),
          },
          {
            text: 'Delete Permanently',
            style: 'destructive',
            onPress: () => resolve(true),
          },
        ],
      );
    });

  const handleDeleteLocal = async (docMeta: VaultDocument) => {
    const hasFirebaseCopy = Boolean(docMeta.references?.some(reference => reference.source === 'firebase'));
    if (!hasFirebaseCopy) {
      const confirmed = await confirmFullDocumentDelete(docMeta, 'offline');
      if (!confirmed) {
        return;
      }
    }

    try {
      setUploadStatus(`Deleting local copy for ${docMeta.name}...`);
      const updated = await removeLocalDocumentCopy(docMeta);
      const hasRefs = (updated.references?.length ?? 0) > 0;
      updateDocument(docMeta.id, () => (hasRefs ? updated : null));
      if (hasRefs) {
        setUploadStatus(`${docMeta.name} local copy deleted.`);
        return;
      }

      setUploadStatus(`${docMeta.name} deleted permanently.`);
      setScreen('main');
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to delete local copy.';
      setUploadStatus(message);
    }
  };

  const handleDeleteFromFirebase = async (docMeta: VaultDocument) => {
    if (isGuest) {
      setUploadStatus('Firebase delete is unavailable in guest mode.');
      return;
    }

    const hasLocalCopy = Boolean(docMeta.references?.some(reference => reference.source === 'local'));
    if (!hasLocalCopy) {
      const confirmed = await confirmFullDocumentDelete(docMeta, 'Firebase');
      if (!confirmed) {
        return;
      }
    }

    try {
      setUploadStatus(`Deleting ${docMeta.name} from Firebase...`);
      await deleteDocumentFromFirebase(docMeta);
      const localOnly = removeFirebaseReferences(docMeta);
      updateDocument(docMeta.id, () => localOnly);
      if (localOnly) {
        setUploadStatus(`${docMeta.name} deleted from Firebase. Local encrypted copy remains.`);
        return;
      }

      setUploadStatus(`${docMeta.name} deleted permanently.`);
      setScreen('main');
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to delete from Firebase.';
      setUploadStatus(message);
    }
  };

  const handleDecryptPreview = async () => {
    if (!selectedDoc) {
      setPreviewStatus('No document selected.');
      return;
    }

    const hasLocalReference = Boolean(selectedDoc.references?.some(reference => reference.source === 'local'));
    if (!hasLocalReference && !(await hasInternetAccess())) {
      setPreviewStatus('no internet access');
      return;
    }

    const cacheKey = `${selectedDoc.id}:${previewFileOrder}`;
    const cachedPreview = previewDecryptCacheRef.current.get(cacheKey);
    if (cachedPreview) {
      setPreviewImageUri(cachedPreview.previewImageUri);
      setPreviewStatus(cachedPreview.previewStatus);
      return;
    }

    try {
      setIsPreviewDecrypting(true);
      setPreviewStatus('');
      const decrypted = await decryptDocumentPayload(selectedDoc, previewFileOrder);
      const nextStatus = decrypted.mimeType.startsWith('image/')
        ? `File #${decrypted.fileOrder} decrypted for preview.`
        : `Decrypted ${decrypted.fileName}. Use export to save it out of app.`;

      if (decrypted.mimeType.startsWith('image/')) {
        const imageUri = `data:${decrypted.mimeType};base64,${decrypted.base64}`;
        setPreviewImageUri(imageUri);
        setPreviewStatus(nextStatus);
        previewDecryptCacheRef.current.set(cacheKey, {
          previewImageUri: imageUri,
          previewStatus: nextStatus,
        });
      } else {
        setPreviewImageUri(null);
        setPreviewStatus(nextStatus);
        previewDecryptCacheRef.current.set(cacheKey, {
          previewImageUri: null,
          previewStatus: nextStatus,
        });
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to decrypt document.';
      setPreviewStatus(message);
    } finally {
      setIsPreviewDecrypting(false);
    }
  };

  const handleExportDocument = async () => {
    if (!selectedDoc) {
      setPreviewStatus('No document selected.');
      return;
    }

    if (!canCurrentUserExportDocument(selectedDoc)) {
      setPreviewStatus('Export is disabled by the document owner for this shared access.');
      return;
    }

    try {
      setPreviewStatus('Exporting document...');
      const path = await exportDocumentToDevice(selectedDoc, previewFileOrder);
      setPreviewStatus(`Document exported to ${path}`);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Export failed.';
      setPreviewStatus(message);
    }
  };

  const runBackup = () => {
    const targets = [backupCloud && !isGuest ? 'Cloud Vault' : '', backupLocal ? 'Local Encrypted File' : '']
      .filter(Boolean)
      .join(' + ');
    setBackupStatus(targets ? `Backup queued to ${targets}` : 'Select at least one backup target');
  };

  const handleBackupKeys = async () => {
    if (isGuest) {
      setKeyBackupStatus('Key backup is not available in guest mode.');
      return;
    }

    if (!user?.uid) {
      setKeyBackupStatus('You must be logged in to backup keys.');
      return;
    }

    if (recoverableDocsCount === 0) {
      setKeyBackupStatus('No recoverable documents found. Enable recovery per document during upload.');
      return;
    }

    try {
      setKeyBackupStatus('Generating passphrase and backing up keys...');
      const passphrase = generateRecoveryPassphrase();
      const result = await backupKeysToFirebase(user.uid, documents, passphrase);
      setDisplayPassphrase(result.passphrase);
      setKeyBackupStatus(
        `Key backup created successfully (${result.backedUpCount} keys). Save your passphrase in a secure location.`,
      );
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to backup keys.';
      setKeyBackupStatus(`Error: ${message}`);
    }
  };

  const handleRestoreKeys = async (passphrase: string) => {
    if (isGuest || !user?.uid) {
      setKeyBackupStatus('You must be logged in to restore keys from Firebase.');
      return;
    }

    if (!passphrase.trim()) {
      setKeyBackupStatus('Please provide the recovery passphrase.');
      return;
    }

    try {
      setKeyBackupStatus('Restoring keys from Firebase backup...');
      const restored = await restoreKeysFromFirebase(user.uid, passphrase.trim());
      setKeyBackupStatus(`Restore complete: ${restored} keys restored to this device.`);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to restore keys.';
      setKeyBackupStatus(`Error: ${message}`);
    }
  };

  const handleCopyPassphrase = async (passphrase: string) => {
    try {
      Clipboard.setString(passphrase);
      setKeyBackupStatus('Passphrase copied.');
    } catch (error) {
      console.warn('Failed to copy passphrase:', error);
    }
  };

  const handleDownloadPassphrase = async (passphrase: string) => {
    try {
      if (!user?.uid) {
        setKeyBackupStatus('You must be logged in to download the passphrase file.');
        return;
      }
      const path = await downloadPassphraseFile(passphrase, user.uid);
      setKeyBackupStatus(`Passphrase file saved to ${path}`);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to download passphrase.';
      setKeyBackupStatus(`Error: ${message}`);
    }
  };

  const handleDownloadBackupFile = async (passphrase: string) => {
    try {
      if (!user?.uid) {
        setKeyBackupStatus('You must be logged in to download backup JSON.');
        return;
      }
      const path = await downloadKeyBackupFile(user.uid, passphrase);
      setKeyBackupStatus(`Encrypted key backup saved to ${path}`);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to download backup file.';
      setKeyBackupStatus(`Error: ${message}`);
    }
  };

  const handleResendVerificationEmail = async () => {
    if (verificationCooldown > 0) {
      return;
    }

    const success = await resendVerificationEmail(email);
    if (success) {
      setVerificationCooldown(60);
      setAuthNotice(null);
    }
  };

  const handleManualVerificationLink = async () => {
    const trimmedLink = verificationLinkInput.trim();
    if (!trimmedLink) {
      setAuthNotice('Paste the verification link from your email first.');
      return;
    }

    const resolved = resolveVerificationLink(trimmedLink);
    const success = await completeEmailLinkRegistration(resolved, email);
    if (!success) {
      return;
    }

    setEmailVerifiedForRegistration(true);
    setAccountStatus('Email verified. Continue by setting your password and tapping Create Account.');
    setAuthNotice(null);
  };

  const handleResetPassword = async () => {
    const targetEmail = user?.email ?? email.trim();
    if (!targetEmail) {
      setAccountStatus('Enter your email address first.');
      setAuthNotice('Enter your email address first.');
      return;
    }

    const success = await sendPasswordResetEmail(targetEmail);
    if (success) {
      setAccountStatus('Password reset email sent. Check your inbox.');
      setAuthNotice('Password reset email sent. Check your inbox.');
      return;
    }

    setAccountStatus('Unable to send password reset email. Try again after re-login.');
    setAuthNotice('Unable to send password reset email.');
  };

  const handleChangeGuestPassword = async (currentPassword: string, nextPassword: string) => {
    const success = await changeGuestPassword(currentPassword, nextPassword);
    if (success) {
      setAccountStatus('Guest password updated.');
    }
    return success;
  };

  const handleRequestEmailChange = async () => {
    const nextEmail = pendingNewEmail.trim();
    if (!nextEmail) {
      setAccountStatus('Enter the new email address first.');
      return;
    }

    const success = await requestEmailChange(nextEmail);
    if (success) {
      setAccountStatus('Confirmation link sent to your new email. Open it to complete the email change.');
      setPendingNewEmail('');
      return;
    }

    setAccountStatus('Unable to start email change. You may need to sign in again.');
  };

  const handleDeleteAccountAndData = () => {
    Alert.alert(
      isGuest ? 'Delete local data?' : 'Delete account and all data?',
      isGuest
        ? 'This will remove all local vault documents and app data from this device.'
        : 'This will permanently remove your Firebase account, cloud documents, key backups, and local vault data. This cannot be undone.',
      [
        {text: 'Cancel', style: 'cancel'},
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => {
            void (async () => {
              const success = await deleteAccountAndData();
              if (success) {
                setAccountStatus(isGuest ? 'Local vault data deleted.' : 'Account and all data deleted.');
                void signOut();
                void AsyncStorage.removeItem(COMPLETE_AUTH_PENDING_KEY);
                resetAuthForm();
                setIsVaultLocked(false);
                setHasUnlockedThisLaunch(false);
                setScreen('main');
                setAuthGateStage('hero');
              }
            })();
          },
        },
      ],
    );
  };

  if (isInitializing) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#60a5fa" />
        <Text style={styles.subtitle}>Connecting to Firebase project {FIREBASE_PROJECT_ID}...</Text>
      </View>
    );
  }

  if (shouldShowCompleteAuthSetup) {
    return (
      <Animated.View style={{ flex: 1, opacity: transitionOpacity, transform: [{ translateY: transitionTranslateY }] }}>
        <CompleteAuthScreen
          isSubmitting={isSubmitting}
          authError={authError}
          onComplete={handleCompleteAuthSetup}
        />
      </Animated.View>
    );
  }

  if (!isAuthenticated) {
    if (authGateStage === 'unlock') {
      return (
        <Animated.View style={{ flex: 1, opacity: transitionOpacity, transform: [{ translateY: transitionTranslateY }] }}>
          <UnlockScreen
          preferredProtection={preferredProtection}
          pinBiometricEnabled={pinBiometricEnabled}
          canUnlock={canUseUnlockButton}
          isSubmitting={isSubmitting}
          authError={authError}
          onUnlock={
            preferredProtection === 'pin' && pinBiometricEnabled
              ? handleBiometricUnlock
              : preferredProtection === 'biometric'
              ? handleBiometricUnlock
              : handlePasskeyUnlock
          }
          onUnlockWithPin={handlePinUnlock}
          onGoToAuth={goToAuthForm}
        />
        </Animated.View>
      );
    }

    if (authGateStage === 'hero') {
      return (
        <Animated.View style={{ flex: 1, opacity: transitionOpacity, transform: [{ translateY: transitionTranslateY }] }}>
          <IntroHeroScreen
          onLogin={() => goToAuth('login')}
          onGuest={() => goToAuth('guest')}
        />
        </Animated.View>
      );
    }

    return (
      <Animated.View style={{ flex: 1, opacity: transitionOpacity, transform: [{ translateY: transitionTranslateY }] }}>
        <AuthScreen
        authMode={authMode}
        email={email}
        password={password}
        confirmPassword={confirmPassword}
        canSubmitAuth={canSubmitAuth}
        isSubmitting={isSubmitting}
        authError={authError}
        authNotice={authNotice}
        emailVerifiedForRegistration={emailVerifiedForRegistration}
        verificationCooldown={verificationCooldown}
        verificationLinkInput={verificationLinkInput}
        accessMode={accessMode}
        setAccessMode={setAccessMode}
        setAuthMode={switchAuthMode}
        setEmail={updateEmail}
        setPassword={updatePassword}
        setConfirmPassword={updateConfirmPassword}
        setVerificationLinkInput={setVerificationLinkInput}
        onResendVerificationEmail={handleResendVerificationEmail}
        onVerifyEmailLinkManually={handleManualVerificationLink}
        onResetPassword={handleResetPassword}
        handleAuth={handleAuth}
        onBackToHero={returnFromAuth}
      />
      </Animated.View>
    );
  }

  if (isVaultLocked) {
    return (
      <Animated.View style={{ flex: 1, opacity: transitionOpacity, transform: [{ translateY: transitionTranslateY }] }}>
        <UnlockScreen
        preferredProtection={preferredProtection}
        pinBiometricEnabled={pinBiometricEnabled}
        canUnlock={canUseUnlockButton}
        isSubmitting={isSubmitting || isTransitioningToAuth}
        authError={authError}
        onUnlock={
          preferredProtection === 'pin' && pinBiometricEnabled
            ? handleBiometricUnlock
            : preferredProtection === 'biometric'
            ? handleBiometricUnlock
            : handlePasskeyUnlock
        }
        onUnlockWithPin={handlePinUnlock}
        onGoToAuth={handleGoToAuthFromLocked}
      />
      </Animated.View>
    );
  }

  return (
    <Animated.View style={[styles.container, { opacity: transitionOpacity, transform: [{ translateY: transitionTranslateY }] }]}>
      <Header
        title={
          {
            main: 'Documents',
            settings: 'Settings',
            recoverkeys: 'Recover Keys',
            recoverydocs: 'Document Recovery',
            sharedetails: 'Share Details',
            preview: 'Preview Document',
            upload: 'Upload Document',
            share: 'Share Document',
            keybackup: 'Backup & Restore Keys',
            backup: 'Backup Files',
          }[screen]
        }
        showBack={screen !== 'main'}
        onBack={() => {
          if (screen === 'upload') {
            handleLeaveUploadScreen();
            return;
          }

          if (screen === 'sharedetails') {
            setScreen('share');
            return;
          }

          if (RECOVERY_SUB_SCREENS.includes(screen as (typeof RECOVERY_SUB_SCREENS)[number])) {
            setScreen('settings');
            return;
          }

          if (screen === 'share') {
            setScreen(shareOriginScreen);
            return;
          }

          setScreen('main');
        }}
        rightLabel={screen === 'main' ? 'Settings' : screen === 'settings' ? 'Logout' : undefined}
        rightIcon={screen === 'preview' ? PencilSquareIcon : screen === 'share' ? EllipsisHorizontalCircleIcon : undefined}
        rightDanger={screen === 'settings'}
        onRightPress={() => {
          if (screen === 'preview') {
            Alert.alert('Edit document metadata', 'Doc metadata editing are not implemented yet.');
            return;
          }

          if (screen === 'share') {
            setScreen('sharedetails');
            return;
          }

          if (screen === 'main') {
            setScreen('settings');
            return;
          }

          if (screen !== 'settings') {
            return;
          }

          void signOut();
          void AsyncStorage.removeItem(COMPLETE_AUTH_PENDING_KEY);
          resetAuthForm();
          setIsVaultLocked(false);
          setHasUnlockedThisLaunch(false);
          setScreen('main');
          setAuthGateStage('hero');
        }}
      />

      {screen === 'main' ? (
        <MainScreen
          documents={documents}
          incomingShareDecisions={incomingShareDecisionsForCurrentUser}
          currentUserId={user?.uid ?? null}
          currentUserEmail={user?.email ?? null}
          isGuest={isGuest}
          isUploading={isUploading}
          uploadStatus={uploadStatus}
          openPreview={openPreview}
          openShare={openShare}
          onScanAndUpload={handleScanAndUpload}
          onPickAndUpload={handlePickAndUpload}
          onReloadDocuments={reloadDocuments}
          onSaveOffline={doc => {
            void handleSaveOffline(doc);
          }}
          onSaveToFirebase={doc => {
            void handleSaveToFirebase(doc);
          }}
          onDeleteLocal={doc => {
            void handleDeleteLocal(doc);
          }}
          onDeleteFromFirebase={doc => {
            void handleDeleteFromFirebase(doc);
          }}
          onExport={async (doc) => {
            setSelectedDoc(doc);
            setPreviewFileOrder(0);
            setPreviewImageUri(null);
            setPreviewStatus('');
            await handleExportDocument();
          }}
          onToggleRecovery={handleToggleDocumentRecovery}
          onAcceptIncomingShare={handleAcceptIncomingShare}
          onDeclineIncomingShare={handleDeclineIncomingShare}
        />
      ) : null}

      {screen === 'settings' ? (
        <SettingsScreen
          accountLabel={user?.email ?? (isGuest ? 'Guest session' : 'Unknown account')}
          sessionMode={isGuest ? 'guest' : 'firebase'}
          isGuest={isGuest}
          authError={authError}
          preferredProtection={preferredProtection}
          pinBiometricEnabled={pinBiometricEnabled}
          hasSavedPasskey={hasSavedPasskey}
          isSubmitting={isSubmitting}
          accountStatus={accountStatus}
          pendingNewEmail={pendingNewEmail}
          saveOfflineByDefault={saveOfflineByDefault}
          recoverableByDefault={recoverableByDefault}
          keyBackupEnabled={keyBackupEnabled}
          recoveryPassphrase={recoveryPassphraseForSettings}
          backedUpDocs={backedUpDocs}
          notBackedUpDocs={notBackedUpDocs}
          onSetSaveOfflineByDefault={value => {
            setSaveOfflineByDefault(value);
            void saveVaultPreferences({
              saveOfflineByDefault: value,
              recoverableByDefault,
              autoSyncKeys: keyBackupEnabled,
              keyBackupEnabled,
            });
          }}
          onSetRecoverableByDefault={value => {
            setRecoverableByDefault(value);
            void saveVaultPreferences({
              saveOfflineByDefault,
              recoverableByDefault: value,
              autoSyncKeys: keyBackupEnabled,
              keyBackupEnabled,
            });
          }}
          onSetKeyBackupEnabled={value => {
            void handleSetKeyBackupEnabled(value);
          }}
          onCopyRecoveryPassphrase={handleCopyPassphrase}
          onResetBackupPassphrase={async () => {
            await handleResetBackupPassphrase();
          }}
          onOpenRecoverKeys={() => {
            setKeyBackupStatus('');
            setScreen('recoverkeys');
          }}
          onOpenDocumentRecovery={() => {
            setScreen('recoverydocs');
          }}
          onUpdateUnlockMethod={async payload => {
            const success = await updateUnlockMethod(payload.method, {
              pin: payload.pin,
              pinBiometricEnabled: payload.pinBiometricEnabled,
              firebaseEmail: user?.email ?? undefined,
              firebasePassword: undefined,
            });

            if (success) {
              setAccountStatus('Unlock method updated.');
              return;
            }

            if (payload.method === 'passkey' && !isGuest) {
              setAccountStatus('Passkey setup requires re-login to store credentials securely.');
              return;
            }

            setAccountStatus('Unable to update unlock method.');
          }}
          onChangeGuestPassword={async (currentPassword, nextPassword) => {
            return handleChangeGuestPassword(currentPassword, nextPassword);
          }}
          onResetPassword={async () => {
            await handleResetPassword();
          }}
          onSetPendingNewEmail={setPendingNewEmail}
          onRequestEmailChange={async () => {
            await handleRequestEmailChange();
          }}
          onDeleteAccountAndData={handleDeleteAccountAndData}
          onUpgradeToCloud={handleUpgradeGuestToCloud}
        />
      ) : null}

      {screen === 'preview' && selectedDoc ? (
        <PreviewScreen
          selectedDoc={selectedDoc}
          previewFileOrder={previewFileOrder}
          previewImageUri={previewImageUri}
          previewStatus={previewStatus}
          isDecrypting={isPreviewDecrypting}
          isCurrentFileDecrypted={previewDecryptCacheRef.current.has(`${selectedDoc.id}:${previewFileOrder}`)}
          isGuest={isGuest}
          canShareDocument={Boolean(
            !isGuest && user?.uid && selectedDoc.owner === user.uid,
          )}
          canSaveOfflineDocument={Boolean(
            isGuest ||
              !selectedDoc.owner ||
              (user?.uid && selectedDoc.owner === user.uid),
          )}
          hasLocalCopy={Boolean(selectedDoc.references?.some(ref => ref.source === 'local'))}
          hasFirebaseCopy={Boolean(selectedDoc.references?.some(ref => ref.source === 'firebase'))}
          keyBackupEnabled={keyBackupEnabled}
          onDecrypt={handleDecryptPreview}
          onExport={handleExportDocument}
          onSelectFile={order => {
            setPreviewFileOrder(order);
            setIsPreviewDecrypting(false);
            const cachedPreview = previewDecryptCacheRef.current.get(`${selectedDoc.id}:${order}`);
            if (cachedPreview) {
              setPreviewImageUri(cachedPreview.previewImageUri);
              setPreviewStatus(cachedPreview.previewStatus);
              return;
            }

            setPreviewImageUri(null);
            setPreviewStatus('');
          }}
          onShare={openShare}
          onSaveOffline={handleSaveOffline}
          onSaveToFirebase={handleSaveToFirebase}
          onDeleteLocal={handleDeleteLocal}
          onDeleteFromFirebase={handleDeleteFromFirebase}
          onToggleRecovery={handleToggleDocumentRecovery}
        />
      ) : null}

      {screen === 'upload' && pendingUploadDraft ? (
        <UploadConfirmScreen
          isUploading={isUploading}
          uploadStatus={uploadStatus}
          files={pendingUploadDraft.files}
          selectedFileIndex={pendingUploadPreviewIndex}
          documentName={pendingUploadName}
          documentDescription={pendingUploadDescription}
          recoverable={pendingUploadRecoverable}
          uploadToCloud={pendingUploadToCloud}
          saveLocalCopy={pendingUploadAlsoSaveLocal}
          canToggleCloudUpload={uploadCanUseCloud}
          canToggleSaveLocal={true}
          setSelectedFileIndex={setPendingUploadPreviewIndex}
          setDocumentName={setPendingUploadName}
          setDocumentDescription={setPendingUploadDescription}
          setRecoverable={setPendingUploadRecoverable}
          setUploadToCloud={(value: boolean) => {
            if (!uploadCanUseCloud) {
              setPendingUploadToCloud(false);
              setPendingUploadAlsoSaveLocal(true);
              return;
            }

            setPendingUploadToCloud(value);
            if (!value && !pendingUploadAlsoSaveLocal) {
              setPendingUploadAlsoSaveLocal(true);
            }
          }}
          setSaveLocalCopy={value => {
            if (!value && !pendingUploadToCloud) {
              if (uploadCanUseCloud) {
                setPendingUploadToCloud(true);
                setPendingUploadAlsoSaveLocal(false);
              }
              return;
            }
            setPendingUploadAlsoSaveLocal(value);
          }}
          onRemoveFile={handleRemoveUploadFile}
          onReorderFiles={handleReorderUploadFiles}
          onPickNewFile={handlePickAndUpload}
          onScanNewFile={handleScanAndUpload}
          onConfirmUpload={async () => {
            await commitUploadDocument(pendingUploadDraft);
          }}
          keyBackupEnabled={keyBackupEnabled}
          onRequestEnableKeyBackup={() => {
            requestKeyBackupSetup(() => {
              setPendingUploadRecoverable(true);
            });
          }}
        />
      ) : null}

      {screen === 'share' && selectedDoc ? (
        <ShareScreen
          selectedDoc={selectedDoc}
          isGuest={isGuest}
          canManageShares={Boolean(
            user?.uid &&
              selectedDoc.owner === user.uid &&
              Boolean(selectedDoc.references?.some(reference => reference.source === 'firebase')),
          )}
          shareTarget={shareTarget}
          allowDownload={allowDownload}
          shareStatus={shareStatus}
          isSubmitting={isShareSubmitting}
          isSharedWithTarget={Boolean(
            shareTarget.trim() &&
              (selectedDoc.sharedWith ?? []).some(item => item.toLowerCase() === shareTarget.trim().toLowerCase()),
          )}
          expiresInDays={shareExpiryDays}
          setShareTarget={setShareTarget}
          setAllowDownload={setAllowDownload}
          setExpiresInDays={setShareExpiryDays}
          onCreateShare={() => {
            void handleCreateShare();
          }}
          onRevokeShare={() => {
            void handleRevokeShare();
          }}
        />
      ) : null}

      {screen === 'sharedetails' && selectedDoc ? (
        <ShareDetailsScreen
          selectedDoc={selectedDoc}
          shareTarget={shareTarget}
          allowDownload={allowDownload}
          expiresInDays={shareExpiryDays}
          onOpenShareOptions={() => setScreen('share')}
          onRevokeShareForRecipient={recipient => {
            setShareTarget(recipient);
            void handleRevokeShareForRecipient(recipient);
          }}
        />
      ) : null}

      {screen === 'backup' ? (
        <BackupScreen
          isGuest={isGuest}
          backupCloud={backupCloud}
          backupLocal={backupLocal}
          backupStatus={backupStatus}
          setBackupCloud={setBackupCloud}
          setBackupLocal={setBackupLocal}
          runBackup={runBackup}
          onOpenKeyBackup={() => setScreen('keybackup')}
        />
      ) : null}

      {screen === 'keybackup' ? (
        <KeyBackupScreen
          isGuest={isGuest}
          isSubmitting={isSubmitting}
          onBackupKeys={handleBackupKeys}
          onRestoreKeys={handleRestoreKeys}
          backupStatus={keyBackupStatus}
          recoverableDocsCount={recoverableDocsCount}
          totalDocsCount={totalDocsCount}
          displayPassphrase={displayPassphrase}
          onClearPassphrase={() => setDisplayPassphrase(null)}
          onCopyPassphrase={handleCopyPassphrase}
          onDownloadPassphrase={handleDownloadPassphrase}
          onDownloadBackupFile={handleDownloadBackupFile}
        />
      ) : null}

      {screen === 'recoverkeys' ? (
        <KeyRecoveryScreen
          isGuest={isGuest}
          isSubmitting={isSubmitting}
          status={keyBackupStatus}
          onRestoreKeys={handleRestoreKeys}
        />
      ) : null}

      {screen === 'recoverydocs' ? (
        <DocumentRecoveryScreen
          isSubmitting={isSubmitting}
          keyBackupEnabled={keyBackupEnabled}
          backedUpDocs={backedUpDocs}
          notBackedUpDocs={notBackedUpDocs}
          onToggleDocBackup={handleToggleDocBackupFromSettings}
        />
      ) : null}

      {showKeyBackupSetupModal ? (
        <View
          style={{
            position: 'absolute',
            top: 0,
            right: 0,
            bottom: 0,
            left: 0,
            backgroundColor: 'rgba(3,7,18,0.65)',
            alignItems: 'center',
            justifyContent: 'center',
            padding: 20,
          }}
        >
          <View style={[styles.card, {width: '100%', maxWidth: 360, gap: 12}]}>
            <Text style={styles.sectionLabel}>Set up key backup first</Text>
            <Text style={styles.subtitle}>
              Enabling recovery for a document needs key backup to be configured. This will generate (or reuse)
              your recovery passphrase.
            </Text>
            <Pressable
              onPress={() => {
                if (recoveryPassphraseForSettings) {
                  void handleCopyPassphrase(recoveryPassphraseForSettings);
                }
              }}
            >
              <Text style={styles.cardMeta}>
                Passphrase: {recoveryPassphraseForSettings ?? 'Will be generated now'}
              </Text>
              {recoveryPassphraseForSettings ? (
                <Text style={styles.settingsNote}>Tap passphrase to copy.</Text>
              ) : null}
            </Pressable>

            <View style={styles.cardActions}>
              <Pressable
                onPress={cancelKeyBackupSetup}
                style={[
                  styles.secondaryButton,
                  {flex: 1, alignItems: 'center', justifyContent: 'center', minHeight: 44},
                ]}
              >
                <Text style={[styles.secondaryButtonText, {textAlign: 'center', width: '100%'}]}>Cancel</Text>
              </Pressable>
              <Pressable
                onPress={() => {
                  void confirmKeyBackupSetup();
                }}
                style={[
                  styles.primaryButton,
                  {flex: 1, alignItems: 'center', justifyContent: 'center', minHeight: 44, marginTop: 0},
                ]}
              >
                <Text style={[styles.primaryButtonText, {textAlign: 'center', width: '100%'}]}>Set Up</Text>
              </Pressable>
            </View>
          </View>
        </View>
      ) : null}

      {showUploadDiscardWarning ? (
        <View
          style={{
            position: 'absolute',
            top: 0,
            right: 0,
            bottom: 0,
            left: 0,
            backgroundColor: 'rgba(3,7,18,0.65)',
            alignItems: 'center',
            justifyContent: 'center',
            padding: 20,
          }}
        >
          <View style={[styles.card, { width: '100%', maxWidth: 340, gap: 12 }]}>
            <Text style={styles.sectionLabel}>Discard this upload?</Text>
            <Text style={styles.subtitle}>
              Your current upload details will not be saved if you leave this screen.
            </Text>

            <Pressable
              onPress={() => setDontShowUploadDiscardWarningAgain(prev => !prev)}
              style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 2 }}
            >
              <View
                style={{
                  width: 20,
                  height: 20,
                  borderRadius: 4,
                  borderWidth: 1,
                  borderColor: '#60a5fa',
                  alignItems: 'center',
                  justifyContent: 'center',
                  backgroundColor: dontShowUploadDiscardWarningAgain ? '#2563eb' : 'transparent',
                }}
              >
                {dontShowUploadDiscardWarningAgain ? (
                  <Text style={{ color: '#fff', fontSize: 12, fontWeight: '800' }}>✓</Text>
                ) : null}
              </View>
              <Text style={{ color: '#d1d5db', fontSize: 14, lineHeight: 18, flexShrink: 1 }}>
                Do not show this again
              </Text>
            </Pressable>

            <View style={styles.cardActions}>
              <Pressable
                onPress={() => {
                  setShowUploadDiscardWarning(false);
                }}
                style={[
                  styles.secondaryButton,
                  { flex: 1, alignItems: 'center', justifyContent: 'center', minHeight: 44 },
                ]}
              >
                <Text style={[styles.secondaryButtonText, { textAlign: 'center', width: '100%' }]}>Keep Editing</Text>
              </Pressable>
              <Pressable
                onPress={() => {
                  void confirmDiscardUploadDraft();
                }}
                style={[
                  styles.primaryButton,
                  { flex: 1, alignItems: 'center', justifyContent: 'center', minHeight: 44, marginTop: 0 },
                ]}
              >
                <Text style={[styles.primaryButtonText, { textAlign: 'center', width: '100%' }]}>Discard</Text>
              </Pressable>
            </View>
          </View>
        </View>
      ) : null}
    </Animated.View>
  );
}

export default App;
