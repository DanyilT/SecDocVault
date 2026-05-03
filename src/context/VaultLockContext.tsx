import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { AppState, AppStateStatus } from 'react-native';

import { useAuth } from './AuthContext';

type VaultLockContextValue = {
  isVaultLocked: boolean;
  hasUnlockedThisLaunch: boolean;
  isCompletingAuthSetup: boolean;
  lockVault: () => void;
  unlockVault: () => void;
  startAuthSetup: () => void;
  finishAuthSetup: () => void;
  setIsPickingFile: (value: boolean) => void;
};

const VaultLockContext = createContext<VaultLockContextValue | undefined>(undefined);

export function VaultLockProvider({ children }: { children: React.ReactNode }) {
  const { isAuthenticated } = useAuth();
  const [hasUnlockedThisLaunch, setHasUnlockedThisLaunch] = useState(false);
  const [isCompletingAuthSetup, setIsCompletingAuthSetup] = useState(false);
  const isPickingFileRef = useRef(false);

  // Derived synchronously so isVaultLocked is always consistent with isAuthenticated
  // in the same render — prevents the flash where isAuthenticated=true but
  // isVaultLocked=false that caused AuthStack to briefly mount VaultStack and remount.
  const isVaultLocked = isAuthenticated && !hasUnlockedThisLaunch;

  useEffect(() => {
    if (!isAuthenticated) {
      setHasUnlockedThisLaunch(false);
      setIsCompletingAuthSetup(false);
    }
  }, [isAuthenticated]);

  useEffect(() => {
    let currentState = AppState.currentState;
    const subscription = AppState.addEventListener('change', (nextState: AppStateStatus) => {
      const isGoingToBackground = currentState === 'active' && nextState !== 'active';
      currentState = nextState;

      if (isGoingToBackground && isAuthenticated && hasUnlockedThisLaunch && !isPickingFileRef.current) {
        setHasUnlockedThisLaunch(false);
      }
    });

    return () => subscription.remove();
  }, [isAuthenticated, hasUnlockedThisLaunch]);

  const lockVault = useCallback(() => {
    setHasUnlockedThisLaunch(false);
  }, []);

  const unlockVault = useCallback(() => {
    setHasUnlockedThisLaunch(true);
  }, []);

  const startAuthSetup = useCallback(() => {
    setIsCompletingAuthSetup(true);
  }, []);

  const finishAuthSetup = useCallback(() => {
    setIsCompletingAuthSetup(false);
    setHasUnlockedThisLaunch(true);
  }, []);

  const setIsPickingFile = useCallback((value: boolean) => {
    isPickingFileRef.current = value;
  }, []);

  return (
    <VaultLockContext.Provider
      value={{
        isVaultLocked,
        hasUnlockedThisLaunch,
        isCompletingAuthSetup,
        lockVault,
        unlockVault,
        startAuthSetup,
        finishAuthSetup,
        setIsPickingFile,
      }}>
      {children}
    </VaultLockContext.Provider>
  );
}

export function useVaultLock() {
  const ctx = useContext(VaultLockContext);
  if (!ctx) throw new Error('useVaultLock must be used within VaultLockProvider');
  return ctx;
}
