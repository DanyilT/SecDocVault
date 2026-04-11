import React, { useEffect, useRef } from 'react';

import { autoSyncKeysIfEnabled } from '../../services/keyBackup';
import { saveLocalDocuments } from '../../storage/localVault';
import { VaultDocument } from '../../types/vault';

type UseDocumentLifecycleEffectsParams = {
  isInitializing: boolean;
  isAuthenticated: boolean;
  isGuest: boolean;
  userUid?: string;
  documents: VaultDocument[];
  selectedDoc: VaultDocument | null;
  autoSyncKeys: boolean;
  hasUnlockedThisLaunch: boolean;
  reloadDocuments: () => Promise<void>;
  setSelectedDoc: React.Dispatch<React.SetStateAction<VaultDocument | null>>;
  setKeyBackupStatus: (value: string) => void;
  setIsVaultLocked: (value: boolean) => void;
};

export function useDocumentLifecycleEffects({
  isInitializing,
  isAuthenticated,
  isGuest,
  userUid,
  documents,
  selectedDoc,
  autoSyncKeys,
  hasUnlockedThisLaunch,
  reloadDocuments,
  setSelectedDoc,
  setKeyBackupStatus,
  setIsVaultLocked,
}: UseDocumentLifecycleEffectsParams) {
  const hasLoadedInitialDocuments = useRef(false);

  useEffect(() => {
    if (!isInitializing) {
      hasLoadedInitialDocuments.current = true;
    }
  }, [isInitializing]);

  useEffect(() => {
    void reloadDocuments();
  }, [reloadDocuments]);

  useEffect(() => {
    if (hasLoadedInitialDocuments.current) {
      void saveLocalDocuments(documents);
    }
  }, [documents]);

  useEffect(() => {
    if (!selectedDoc) {
      setSelectedDoc(documents[0] ?? null);
      return;
    }

    const stillExists = documents.some(item => item.id === selectedDoc.id);
    if (!stillExists) {
      setSelectedDoc(documents[0] ?? null);
    }
  }, [documents, selectedDoc, setSelectedDoc]);

  useEffect(() => {
    if (!autoSyncKeys || !isAuthenticated || isGuest || !userUid || documents.length === 0) {
      return;
    }

    void autoSyncKeysIfEnabled(userUid, documents)
      .then(synced => {
        if (synced) {
          setKeyBackupStatus('Auto-sync complete: encrypted keys updated in Firebase backup.');
        }
      })
      .catch(error => {
        const message = error instanceof Error ? error.message : 'Auto-sync failed.';
        setKeyBackupStatus(`Auto-sync error: ${message}`);
      });
  }, [autoSyncKeys, documents, isAuthenticated, isGuest, setKeyBackupStatus, userUid]);

  useEffect(() => {
    if (!isAuthenticated) {
      setIsVaultLocked(false);
      return;
    }

    if (!hasUnlockedThisLaunch) {
      setIsVaultLocked(true);
    }
  }, [hasUnlockedThisLaunch, isAuthenticated, setIsVaultLocked]);
}
