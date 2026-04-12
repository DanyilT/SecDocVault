import { useCallback, useMemo } from 'react';

import {
  IncomingShareDecision,
  IncomingShareDecisionStore,
  saveIncomingShareDecisionStore,
} from '../../storage/localVault';

type UseIncomingShareDecisionsParams = {
  currentShareDecisionOwnerKey: string;
  incomingShareDecisionStore: IncomingShareDecisionStore;
  setIncomingShareDecisionStore: React.Dispatch<React.SetStateAction<IncomingShareDecisionStore>>;
  setUploadStatus: (value: string) => void;
  onDeclineSuccess?: () => void;
};

export function useIncomingShareDecisions({
  currentShareDecisionOwnerKey,
  incomingShareDecisionStore,
  setIncomingShareDecisionStore,
  setUploadStatus,
  onDeclineSuccess,
}: UseIncomingShareDecisionsParams) {
  const incomingShareDecisionsForCurrentUser = useMemo(
    () => incomingShareDecisionStore[currentShareDecisionOwnerKey] ?? {},
    [currentShareDecisionOwnerKey, incomingShareDecisionStore],
  );

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
    [currentShareDecisionOwnerKey, setIncomingShareDecisionStore],
  );

  const handleAcceptIncomingShare = useCallback(
    (docId: string) => {
      persistIncomingShareDecision(docId, 'accepted');
      setUploadStatus('Incoming shared document accepted.');
    },
    [persistIncomingShareDecision, setUploadStatus],
  );

  const handleDeclineIncomingShare = useCallback(
    (docId: string) => {
      persistIncomingShareDecision(docId, 'declined');
      setUploadStatus('Incoming shared document declined.');
      onDeclineSuccess?.();
    },
    [persistIncomingShareDecision, setUploadStatus, onDeclineSuccess],
  );

  return {
    incomingShareDecisionsForCurrentUser,
    handleAcceptIncomingShare,
    handleDeclineIncomingShare,
  };
}
