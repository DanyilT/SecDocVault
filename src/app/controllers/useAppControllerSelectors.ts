import { useMemo } from 'react';

import { VaultDocument } from '../../types/vault';

type AppUserLike = {
  uid?: string | null;
  email?: string | null;
};

export function useCurrentUserIdentifiers(user: AppUserLike | null | undefined) {
  return useMemo(
    () => [user?.uid?.trim(), user?.email?.trim()].filter((value): value is string => Boolean(value)),
    [user?.email, user?.uid],
  );
}

export function useCurrentShareDecisionOwnerKey(user: AppUserLike | null | undefined) {
  return useMemo(
    () => user?.uid?.trim() || user?.email?.trim() || 'anonymous',
    [user?.email, user?.uid],
  );
}

export function useRecoverableDocsCount(documents: VaultDocument[]) {
  return useMemo(
    () => documents.filter(item => item.recoverable !== false).length,
    [documents],
  );
}

export function useBackedUpDocs(documents: VaultDocument[]) {
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
