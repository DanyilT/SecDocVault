import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';

import { useAuth } from './AuthContext';

type VaultLockContextValue = {
  isVaultLocked: boolean;
  hasUnlockedThisLaunch: boolean;
  isCompletingAuthSetup: boolean;
  lockVault: () => void;
  unlockVault: () => void;
  startAuthSetup: () => void;
  finishAuthSetup: () => void;
};

const VaultLockContext = createContext<VaultLockContextValue | undefined>(undefined);

export function VaultLockProvider({ children }: { children: React.ReactNode }) {
  const { isAuthenticated } = useAuth();
  const [hasUnlockedThisLaunch, setHasUnlockedThisLaunch] = useState(false);
  const [isCompletingAuthSetup, setIsCompletingAuthSetup] = useState(false);

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
