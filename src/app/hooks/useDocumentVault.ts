import { useCallback } from 'react';

import { VaultDocument } from '../../types/vault.ts';

export function mergeDocumentReferences(
  left: VaultDocument['references'] = [],
  right: VaultDocument['references'] = [],
) {
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
}

export function mergeVaultDocuments(
  firebaseDocs: VaultDocument[],
  sharedDocs: VaultDocument[],
  localDocs: VaultDocument[],
) {
  const localById = new Map(localDocs.map(item => [item.id, item]));
  const mergedDocs = new Map<string, VaultDocument>();

  const upsertDocument = (doc: VaultDocument) => {
    const existing = mergedDocs.get(doc.id);
    if (!existing) {
      mergedDocs.set(doc.id, doc);
      return;
    }

    const references = mergeDocumentReferences(existing.references, doc.references);
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

    const references = mergeDocumentReferences(doc.references, localRefs);
    return {
      ...doc,
      references,
      offlineAvailable: true,
    };
  };

  [...firebaseDocs, ...sharedDocs, ...localDocs].forEach(doc => {
    upsertDocument(mergeWithLocalCopy(doc));
  });

  return [...mergedDocs.values()].sort((a, b) => b.uploadedAt.localeCompare(a.uploadedAt));
}

type UseDocumentVaultParams = {
  isAuthenticated: boolean;
  isInitializing: boolean;
  isGuest: boolean;
  backupCloud: boolean;
  userUid?: string;
  currentUserIdentifiers: string[];
  setDocuments: React.Dispatch<React.SetStateAction<VaultDocument[]>>;
  setSelectedDoc: (doc: VaultDocument | null) => void;
  setHasUnlockedThisLaunch: (value: boolean) => void;
  setUploadStatus: (value: string) => void;
  getLocalDocuments: () => Promise<VaultDocument[]>;
  listVaultDocumentsFromFirebase: (uid: string) => Promise<VaultDocument[]>;
  listVaultDocumentsSharedWithUser: (identifiers: string[]) => Promise<VaultDocument[]>;
  enforceExpiredShareRevocations: (doc: VaultDocument, ownerUid: string) => Promise<VaultDocument>;
};

export function useDocumentVault({
  isAuthenticated,
  isInitializing,
  isGuest,
  backupCloud,
  userUid,
  currentUserIdentifiers,
  setDocuments,
  setSelectedDoc,
  setHasUnlockedThisLaunch,
  setUploadStatus,
  getLocalDocuments,
  listVaultDocumentsFromFirebase,
  listVaultDocumentsSharedWithUser,
  enforceExpiredShareRevocations,
}: UseDocumentVaultParams) {
  const reloadDocuments = useCallback(async () => {
    const isPermissionDeniedError = (error: unknown) =>
      typeof error === 'object' &&
      error !== null &&
      'code' in error &&
      String((error as {code?: unknown}).code).includes('permission-denied');

    try {
      if (!isAuthenticated && !isInitializing) {
        setHasUnlockedThisLaunch(false);
        const localDocs = await getLocalDocuments();
        if (localDocs.length === 0) {
          setDocuments([]);
          setSelectedDoc(null);
        } else {
          setDocuments(localDocs);
          setSelectedDoc(localDocs[0] ?? null);
        }
        return;
      }

      if (isInitializing) {
        return;
      }

      if (isGuest || !backupCloud || !userUid) {
        const localDocs = await getLocalDocuments();
        setDocuments(localDocs);
        setSelectedDoc(localDocs[0] ?? null);
        return;
      }

      const [firebaseDocs, sharedDocs, localDocs] = await Promise.all([
        listVaultDocumentsFromFirebase(userUid),
        currentUserIdentifiers.length > 0
          ? listVaultDocumentsSharedWithUser(currentUserIdentifiers)
          : Promise.resolve([]),
        getLocalDocuments(),
      ]);

      let mergedList = mergeVaultDocuments(firebaseDocs, sharedDocs, localDocs);
      const ownerDocs = mergedList.filter(item => item.owner === userUid);
      const enforcedOwnerDocs = await Promise.all(
        ownerDocs.map(item => enforceExpiredShareRevocations(item, userUid)),
      );
      const ownerById = new Map(enforcedOwnerDocs.map(item => [item.id, item]));
      mergedList = mergedList.map(item => ownerById.get(item.id) ?? item);

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
  }, [
    backupCloud,
    currentUserIdentifiers,
    enforceExpiredShareRevocations,
    getLocalDocuments,
    isAuthenticated,
    isGuest,
    isInitializing,
    listVaultDocumentsFromFirebase,
    listVaultDocumentsSharedWithUser,
    setDocuments,
    setHasUnlockedThisLaunch,
    setSelectedDoc,
    setUploadStatus,
    userUid,
  ]);

  return {
    reloadDocuments,
  };
}
