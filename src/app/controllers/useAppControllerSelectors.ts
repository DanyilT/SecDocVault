/**
 * app/controllers/useAppControllerSelectors.ts
 *
 * Small memoized selectors used by the controller to compute derived state
 * (counts, filtered lists) from the canonical documents array. These helpers
 * remain pure and easy to test.
 */

import { useMemo } from 'react';

import { VaultDocument } from '../../types/vault';

type AppUserLike = {
  uid?: string | null;
  email?: string | null;
};

export function useCurrentUserIdentifiers(user: AppUserLike | null | undefined) {
  /**
   * useCurrentUserIdentifiers
   *
   * Returns a memoized array of identifiers for the current user (uid and
   * email) filtered to non-empty strings.
   *
   * @param user - user-like object with optional uid and email
   * @returns string[] of available identifiers
   */
  return useMemo(
    () => [user?.uid?.trim(), user?.email?.trim()].filter((value): value is string => Boolean(value)),
    [user?.email, user?.uid],
  );
}

export function useCurrentShareDecisionOwnerKey(user: AppUserLike | null | undefined) {
  /**
   * useCurrentShareDecisionOwnerKey
   *
   * Compute a string key suitable for ownership/decision matching. Falls back
   * to 'anonymous' when no identifier is available.
   *
   * @param user - user-like object with optional uid and email
   * @returns string owner key
   */
  return useMemo(
    () => user?.uid?.trim() || user?.email?.trim() || 'anonymous',
    [user?.email, user?.uid],
  );
}

export function useRecoverableDocsCount(documents: VaultDocument[]) {
  /**
   * useRecoverableDocsCount
   *
   * Count documents marked as recoverable (recoverable !== false).
   *
   * @param documents - list of VaultDocument
   * @returns number of recoverable documents
   */
  return useMemo(
    () => documents.filter(item => item.recoverable !== false).length,
    [documents],
  );
}

export function useBackedUpDocs(documents: VaultDocument[]) {
  /**
   * useBackedUpDocs
   *
   * Return a list of documents that are marked recoverable with a flag
   * indicating whether they have a cloud (firebase) reference.
   *
   * @param documents - list of VaultDocument
   * @returns Array<{id: string; name: string; canRecover: boolean}>
   */
  return useMemo(
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
}

export function useNotBackedUpDocs(documents: VaultDocument[]) {
  /**
   * useNotBackedUpDocs
   *
   * Return documents that are explicitly not recoverable and annotate whether
   * they could be recovered if they had a cloud copy.
   *
   * @param documents - list of VaultDocument
   * @returns Array<{id: string; name: string; canRecover: boolean}>
   */
  return useMemo(
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
}
