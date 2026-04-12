/**
 * app/controllers/useIncomingShareDecisions.ts
 *
 * Manages temporary decisions for incoming share invitations. This hook
 * keeps an in-memory store mapping document IDs to `accepted` or `declined` so
 * the UI can reflect the user's choice immediately while network operations
 * complete in the background.
 */

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

/**
 * useIncomingShareDecisions
 *
 * Manage temporary decisions for incoming share invitations. Provides an
 * in-memory view and handlers to accept/decline shares while persisting the
 * decision to local storage for future sessions.
 *
 * @param params - parameters and setters used for persisting decisions and updating UI status
 * @returns an object containing the current decisions map and accept/decline handlers
 */
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

  /**
   * persistIncomingShareDecision
   *
   * Persist a single incoming share decision to the shared local store and
   * update the in-memory store via `setIncomingShareDecisionStore`.
   *
   * @param docId - document identifier
   * @param decision - 'accepted' or 'declined'
   */
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

  /**
   * handleAcceptIncomingShare
   *
   * Mark an incoming share as accepted and update a user-facing status
   * message.
   *
   * @param docId - document identifier
   */
  const handleAcceptIncomingShare = useCallback(
    (docId: string) => {
      persistIncomingShareDecision(docId, 'accepted');
      setUploadStatus('Incoming shared document accepted.');
    },
    [persistIncomingShareDecision, setUploadStatus],
  );

  /**
   * handleDeclineIncomingShare
   *
   * Mark an incoming share as declined, update status, and optionally run
   * the `onDeclineSuccess` callback for additional cleanup.
   *
   * @param docId - document identifier
   */
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
