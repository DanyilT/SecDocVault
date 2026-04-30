import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from 'react';

import { useAuth } from './AuthContext';
import { VaultDocument } from '../types/vault';
import {
  getIncomingShareDecisionStore,
  getLocalDocuments,
  IncomingShareDecision,
  IncomingShareDecisionStore,
  saveIncomingShareDecisionStore,
  saveLocalDocuments,
} from '../storage/localVault';
import {
  enforceExpiredShareRevocations,
  listVaultDocumentsFromFirebase,
  listVaultDocumentsSharedWithUser,
} from '../services/documentVault';
import { mergeVaultDocuments } from '../app/hooks/useDocumentVault';

type DocumentVaultContextValue = {
  documents: VaultDocument[];
  setDocuments: React.Dispatch<React.SetStateAction<VaultDocument[]>>;
  isLoadingDocuments: boolean;
  loadDocuments: () => Promise<void>;
  incomingShareDecisions: Record<string, IncomingShareDecision>;
  handleAcceptIncomingShare: (docId: string) => void;
  handleDeclineIncomingShare: (docId: string) => void;
};

const DocumentVaultContext = createContext<DocumentVaultContextValue | undefined>(undefined);

export function DocumentVaultProvider({ children }: { children: React.ReactNode }) {
  const { user, isAuthenticated, isInitializing, isGuest } = useAuth();
  const userUid = user?.uid;
  const userEmail = user?.email ?? null;

  const [documents, setDocuments] = useState<VaultDocument[]>([]);
  const [isLoadingDocuments, setIsLoadingDocuments] = useState(false);
  const [shareDecisionStore, setShareDecisionStore] = useState<IncomingShareDecisionStore>({});
  const hasLoadedRef = useRef(false);
  const prevUserUidRef = useRef<string | undefined>(undefined);

  useEffect(() => {
    void getIncomingShareDecisionStore().then(setShareDecisionStore);
  }, []);

  // Reset vault state when the signed-in user changes. This runs before the
  // persist effect (defined below) so hasLoadedRef is false by the time the
  // persist effect checks it, preventing stale documents from being written
  // into the incoming user's scoped storage key.
  useEffect(() => {
    if (prevUserUidRef.current === userUid) return;
    prevUserUidRef.current = userUid;
    hasLoadedRef.current = false;
    setDocuments([]);
  }, [userUid]);

  // Persist documents to local storage whenever they change (after first load).
  useEffect(() => {
    if (!hasLoadedRef.current) return;
    void saveLocalDocuments(documents, userUid);
  }, [documents, userUid]);

  const loadDocuments = useCallback(async () => {
    setIsLoadingDocuments(true);
    try {
      if (isInitializing) return;

      if (!isAuthenticated) {
        const local = await getLocalDocuments();
        setDocuments(local);
        hasLoadedRef.current = true;
        return;
      }

      if (isGuest || !userUid) {
        const local = await getLocalDocuments();
        setDocuments(local);
        hasLoadedRef.current = true;
        return;
      }

      const identifiers = [userUid, ...(userEmail ? [userEmail] : [])];

      const [firebaseDocs, sharedDocs, localDocs] = await Promise.all([
        listVaultDocumentsFromFirebase(userUid),
        listVaultDocumentsSharedWithUser(identifiers),
        getLocalDocuments(userUid),
      ]);

      let merged = mergeVaultDocuments(firebaseDocs, sharedDocs, localDocs);

      const ownerDocs = merged.filter(d => d.owner === userUid);
      const enforced = await Promise.all(
        ownerDocs.map(d => enforceExpiredShareRevocations(d, userUid)),
      );
      const enforcedById = new Map(enforced.map(d => [d.id, d]));
      merged = merged.map(d => enforcedById.get(d.id) ?? d);

      setDocuments(merged);
      hasLoadedRef.current = true;
    } catch {
      const local = await getLocalDocuments(userUid);
      setDocuments(local);
      hasLoadedRef.current = true;
    } finally {
      setIsLoadingDocuments(false);
    }
  }, [isAuthenticated, isInitializing, isGuest, userUid, userEmail]);

  useEffect(() => {
    void loadDocuments();
  }, [loadDocuments]);

  const currentUserKey = userUid ?? 'guest';
  const incomingShareDecisions = shareDecisionStore[currentUserKey] ?? {};

  const handleAcceptIncomingShare = useCallback(
    (docId: string) => {
      setShareDecisionStore(prev => {
        const next: IncomingShareDecisionStore = {
          ...prev,
          [currentUserKey]: { ...(prev[currentUserKey] ?? {}), [docId]: 'accepted' },
        };
        void saveIncomingShareDecisionStore(next);
        return next;
      });
    },
    [currentUserKey],
  );

  const handleDeclineIncomingShare = useCallback(
    (docId: string) => {
      setShareDecisionStore(prev => {
        const next: IncomingShareDecisionStore = {
          ...prev,
          [currentUserKey]: { ...(prev[currentUserKey] ?? {}), [docId]: 'declined' },
        };
        void saveIncomingShareDecisionStore(next);
        return next;
      });
    },
    [currentUserKey],
  );

  return (
    <DocumentVaultContext.Provider
      value={{
        documents,
        setDocuments,
        isLoadingDocuments,
        loadDocuments,
        incomingShareDecisions,
        handleAcceptIncomingShare,
        handleDeclineIncomingShare,
      }}>
      {children}
    </DocumentVaultContext.Provider>
  );
}

export function useDocumentVaultContext() {
  const ctx = useContext(DocumentVaultContext);
  if (!ctx) throw new Error('useDocumentVaultContext must be used within DocumentVaultProvider');
  return ctx;
}
