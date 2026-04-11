import React, { useCallback, useEffect, useRef } from 'react';
import { Animated, AppState, AppStateStatus, BackHandler } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

import { AppScreen } from '../navigation/constants';
import { AuthGateStage, getBackTargetScreen } from '../navigation/routingReducer';
import { AuthProtection } from '../../types/vault';
import { UploadableDocumentDraft } from '../../services/documentUpload';

type UseVaultLockLifecycleParams = {
  completeAuthPendingKey: string;
  isInitializing: boolean;
  transitionOpacity: Animated.Value;
  authGateStage: AuthGateStage;
  screen: AppScreen;
  shareOriginScreen: 'main' | 'preview';
  isAuthenticated: boolean;
  isVaultLocked: boolean;
  isCompletingAuthFlow: boolean;
  isTransitioningToAuth: boolean;
  shouldRequireUnlock: boolean;
  preferredProtection: AuthProtection | null;
  pendingUploadDraft: UploadableDocumentDraft | null;
  recoverableByDefault: boolean;
  uploadCanUseCloud: boolean;
  skipUploadDiscardWarning: boolean;
  setIsVaultLocked: (value: boolean) => void;
  setIsTransitioningToAuth: (value: boolean) => void;
  setIsCompletingAuthFlow: (value: boolean) => void;
  setShowCompleteAuthSetup: (value: boolean) => void;
  setAuthCredentialSnapshot: (value: { email: string; password: string } | null) => void;
  setHasUnlockedThisLaunch: (value: boolean) => void;
  setScreen: (screen: AppScreen) => void;
  setPendingUploadDraft: React.Dispatch<React.SetStateAction<UploadableDocumentDraft | null>>;
  setPendingUploadName: (value: string) => void;
  setPendingUploadDescription: (value: string) => void;
  setPendingUploadRecoverable: (value: boolean) => void;
  setPendingUploadToCloud: (value: boolean) => void;
  setPendingUploadAlsoSaveLocal: (value: boolean) => void;
  setPendingUploadPreviewIndex: (value: number) => void;
  setDontShowUploadDiscardWarningAgain: (value: boolean) => void;
  setShowUploadDiscardWarning: (value: boolean) => void;
  returnFromAuthGate: () => void;
  routeToAuth: (stage: 'unlock') => void;
  resetAuthForm: () => void;
  signOut: () => Promise<void>;
  updateUnlockMethod: (method: AuthProtection) => Promise<boolean>;
};

export function useVaultLockLifecycle({
  completeAuthPendingKey,
  isInitializing,
  transitionOpacity,
  authGateStage,
  screen,
  shareOriginScreen,
  isAuthenticated,
  isVaultLocked,
  isCompletingAuthFlow,
  isTransitioningToAuth,
  shouldRequireUnlock,
  preferredProtection,
  pendingUploadDraft,
  recoverableByDefault,
  uploadCanUseCloud,
  skipUploadDiscardWarning,
  setIsVaultLocked,
  setIsTransitioningToAuth,
  setIsCompletingAuthFlow,
  setShowCompleteAuthSetup,
  setAuthCredentialSnapshot,
  setHasUnlockedThisLaunch,
  setScreen,
  setPendingUploadDraft,
  setPendingUploadName,
  setPendingUploadDescription,
  setPendingUploadRecoverable,
  setPendingUploadToCloud,
  setPendingUploadAlsoSaveLocal,
  setPendingUploadPreviewIndex,
  setDontShowUploadDiscardWarningAgain,
  setShowUploadDiscardWarning,
  returnFromAuthGate,
  routeToAuth,
  resetAuthForm,
  signOut,
  updateUnlockMethod,
}: UseVaultLockLifecycleParams) {
  const didHandlePendingCompleteAuthRef = useRef(false);
  const isLockTransitioningRef = useRef(false);

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
  }, [isCompletingAuthFlow, isTransitioningToAuth, isVaultLocked, setIsVaultLocked, transitionOpacity]);

  const forceReloginFromLockRef = useRef<() => void>(() => undefined);
  forceReloginFromLockRef.current = () => {
    if (isTransitioningToAuth) {
      return;
    }

    void (async () => {
      setIsTransitioningToAuth(true);
      try {
        await signOut();
        await AsyncStorage.removeItem(completeAuthPendingKey);
        setIsCompletingAuthFlow(false);
        resetAuthForm();
        setShowCompleteAuthSetup(false);
        setAuthCredentialSnapshot(null);
        setHasUnlockedThisLaunch(false);
        setIsVaultLocked(false);
        routeToAuth('unlock');
      } finally {
        setIsTransitioningToAuth(false);
      }
    })();
  };

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

        setScreen(getBackTargetScreen(screen, shareOriginScreen));
        return true;
      }

      if (authGateStage === 'auth') {
        returnFromAuthGate();
        return true;
      }

      return false;
    });

    return () => {
      subscription.remove();
    };
  }, [
    authGateStage,
    enterLockScreen,
    recoverableByDefault,
    isAuthenticated,
    isCompletingAuthFlow,
    isVaultLocked,
    pendingUploadDraft,
    preferredProtection,
    returnFromAuthGate,
    screen,
    setScreen,
    shareOriginScreen,
    skipUploadDiscardWarning,
    uploadCanUseCloud,
    setPendingUploadDraft,
    setPendingUploadName,
    setPendingUploadDescription,
    setPendingUploadRecoverable,
    setPendingUploadToCloud,
    setPendingUploadAlsoSaveLocal,
    setPendingUploadPreviewIndex,
    setDontShowUploadDiscardWarningAgain,
    setShowUploadDiscardWarning,
  ]);

  useEffect(() => {
    if (!isAuthenticated || !isVaultLocked || preferredProtection !== 'none' || isCompletingAuthFlow) {
      return;
    }
    forceReloginFromLockRef.current();
  }, [isAuthenticated, isCompletingAuthFlow, isVaultLocked, preferredProtection]);

  useEffect(() => {
    if (isInitializing || didHandlePendingCompleteAuthRef.current) {
      return;
    }

    didHandlePendingCompleteAuthRef.current = true;

    void (async () => {
      const pending = await AsyncStorage.getItem(completeAuthPendingKey);
      if (pending !== '1') {
        return;
      }

      await AsyncStorage.removeItem(completeAuthPendingKey);
      setShowCompleteAuthSetup(false);
      setAuthCredentialSnapshot(null);
      setIsCompletingAuthFlow(false);

      if (isAuthenticated) {
        await updateUnlockMethod('none');
      }
    })();
  }, [
    completeAuthPendingKey,
    isAuthenticated,
    isInitializing,
    setAuthCredentialSnapshot,
    setIsCompletingAuthFlow,
    setShowCompleteAuthSetup,
    updateUnlockMethod,
  ]);
}
