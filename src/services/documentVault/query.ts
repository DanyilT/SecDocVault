import { getApp } from '@react-native-firebase/app';
import {
  collection,
  collectionGroup,
  doc,
  getDoc,
  getDocs,
  getFirestore,
  query,
  where,
} from '@react-native-firebase/firestore';

import { VaultDocument } from '../../types/vault';
import { normalizeReferenceOrder, resolveIntegrityTag, toHashLabel, toSizeLabel } from './formatters';
import { isShareGrantActive, normalizeSharedKeyGrants, ShareGrantRecord } from './shareGrants';

const STORAGE_PATH_PREFIX = 'vault';
const DOC_SHARES_SUBCOLLECTION = 'sharedUsers';

/**
 * Fetches metadata for a document from the vault by its ID.
 *
 * @param docId - The document ID.
 * @returns Document metadata including ID, name, hash, size, and upload date.
 */
export async function getDocumentMetadataFromVault(docId: string) {
  const app = getApp();
  const db = getFirestore(app);
  const snapshot = await getDoc(doc(db, STORAGE_PATH_PREFIX, docId));
  if (!snapshot.exists()) {
    return null;
  }

  const data = snapshot.data() as Partial<VaultDocument>;
  return {
    ...data,
    id: snapshot.id,
    name: data.name ?? 'Document',
    description: data.description ?? '',
    hash: data.hash ?? toHashLabel(resolveIntegrityTag((data.references ?? [])[0])),
    size: data.size ?? 'Unknown',
    uploadedAt: data.uploadedAt ?? new Date().toISOString().slice(0, 10),
    sharedKeyGrants: normalizeSharedKeyGrants((data.sharedKeyGrants ?? []) as unknown as ShareGrantRecord[]) as any,
    references: normalizeReferenceOrder(data.references ?? []),
  } as VaultDocument;
}

export async function listVaultDocumentsFromFirebase(ownerId: string): Promise<VaultDocument[]> {
  const app = getApp();
  const db = getFirestore(app);
  const vaultQuery = query(collection(db, STORAGE_PATH_PREFIX), where('owner', '==', ownerId));
  let snapshot;

  try {
    snapshot = await getDocs(vaultQuery);
  } catch (error) {
    if (typeof error === 'object' && error && 'code' in error) {
      const code = String((error as {code: string}).code);
      if (code.includes('permission-denied')) {
        return [];
      }
    }

    if (typeof error === 'object' && error !== null && 'message' in error) {
      const msg = String((error as {message: string}).message);
      if (msg.includes('FAILED_PRECONDITION') && msg.includes('index')) {
        console.warn('Firestore index required for vault owner query:', msg);
        return [];
      }
    }

    throw error;
  }

  const docs: VaultDocument[] = [];
  snapshot.forEach((item: any) => {
    const data = item.data() as Partial<VaultDocument>;
    const normalizedReferences = normalizeReferenceOrder(data.references ?? []);
    const firstRef = normalizedReferences[0];
    const normalizedSize =
      typeof data.size === 'string'
        ? data.size
        : firstRef?.size
          ? toSizeLabel(firstRef.size)
          : 'Unknown';

    docs.push({
      id: item.id,
      name: data.name ?? 'Document',
      description: data.description ?? '',
      hash: data.hash ?? toHashLabel(resolveIntegrityTag(firstRef)),
      size: normalizedSize,
      uploadedAt: data.uploadedAt ?? new Date().toISOString().slice(0, 10),
      owner: data.owner,
      sharedWith: data.sharedWith ?? [],
      sharedKeyGrants: normalizeSharedKeyGrants((data.sharedKeyGrants ?? []) as unknown as ShareGrantRecord[]) as any,
      references: normalizedReferences,
      encryptedDocKey: data.encryptedDocKey,
      saveMode: data.saveMode ?? 'firebase',
      recoverable: Boolean(data.recoverable),
      offlineAvailable:
        Boolean(data.offlineAvailable) ||
        Boolean(normalizedReferences.some(reference => reference.source === 'local')),
    });
  });

  return docs.sort((a, b) => b.uploadedAt.localeCompare(a.uploadedAt));
}

export async function listVaultDocumentsSharedWithUser(recipientIdentifiers: string[]): Promise<VaultDocument[]> {
  const normalizedIdentifiers = recipientIdentifiers.map(item => item.trim()).filter(Boolean);
  if (normalizedIdentifiers.length === 0) {
    return [];
  }

  const app = getApp();
  const db = getFirestore(app);
  const now = new Date();
  const uidIdentifiers = normalizedIdentifiers.filter(item => !item.includes('@'));
  const emailIdentifiers = normalizedIdentifiers.filter(item => item.includes('@')).map(item => item.toLowerCase());
  const grantDocs: Array<{
    docId: string;
    grant: ShareGrantRecord;
  }> = [];

  const isIndexError = (error: unknown) =>
    typeof error === 'object' &&
    error !== null &&
    'message' in error &&
    String((error as {message: string}).message).includes('FAILED_PRECONDITION') &&
    String((error as {message: string}).message).includes('index');

  const isPermissionDeniedError = (error: unknown) =>
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    String((error as {code: unknown}).code).includes('permission-denied');

  const toVaultDocument = (
    snapshot: any,
    fallbackSharedWith: string[] = [],
    fallbackGrants: ShareGrantRecord[] = [],
  ): VaultDocument => {
    const data = snapshot.data() as Partial<VaultDocument>;
    const normalizedReferences = normalizeReferenceOrder(data.references ?? []);
    const firstRef = normalizedReferences[0];
    const normalizedSize =
      typeof data.size === 'string'
        ? data.size
        : firstRef?.size
          ? toSizeLabel(firstRef.size)
          : 'Unknown';

    return {
      id: snapshot.id,
      name: data.name ?? 'Document',
      description: data.description ?? '',
      hash: data.hash ?? toHashLabel(resolveIntegrityTag(firstRef)),
      size: normalizedSize,
      uploadedAt: data.uploadedAt ?? new Date().toISOString().slice(0, 10),
      owner: data.owner,
      sharedWith: Array.from(new Set([...(data.sharedWith ?? []), ...fallbackSharedWith].filter(Boolean))),
      sharedKeyGrants: normalizeSharedKeyGrants([
        ...((data.sharedKeyGrants ?? []) as unknown as ShareGrantRecord[]),
        ...fallbackGrants,
      ]) as any,
      references: normalizedReferences,
      encryptedDocKey: data.encryptedDocKey,
      saveMode: data.saveMode ?? 'firebase',
      recoverable: Boolean(data.recoverable),
      offlineAvailable:
        Boolean(data.offlineAvailable) ||
        Boolean(normalizedReferences.some(reference => reference.source === 'local')),
    };
  };

  const mergeDocuments = (left: VaultDocument, right: VaultDocument): VaultDocument => {
    const references = normalizeReferenceOrder([...(left.references ?? []), ...(right.references ?? [])]);
    const sharedWith = Array.from(new Set([...(left.sharedWith ?? []), ...(right.sharedWith ?? [])].filter(Boolean)));
    const sharedKeyGrants = Array.from(
      new Map(
        [...((left.sharedKeyGrants ?? []) as ShareGrantRecord[]), ...((right.sharedKeyGrants ?? []) as ShareGrantRecord[])].map(grant => [
          `${grant.recipientUid}|${grant.recipientEmail ?? ''}|${grant.createdAt}|${String(grant.expiresAt)}`,
          grant,
        ]),
      ).values(),
    ) as any;

    return {
      ...left,
      ...right,
      references,
      sharedWith,
      sharedKeyGrants,
      offlineAvailable:
        Boolean(left.offlineAvailable || right.offlineAvailable) ||
        references.some(reference => reference.source === 'local'),
    };
  };

  const loadGrantMatches = async (fieldName: 'recipientUid' | 'recipientEmail', values: string[]) => {
    let denied = false;

    await Promise.all(
      values.map(async value => {
        let snapshot;
        try {
          // Use UID or email directly for searching in the sharedUsers subcollection via collectionGroup
          const normalizedVal = fieldName === 'recipientEmail' ? value.toLowerCase() : value;
          snapshot = await getDocs(query(collectionGroup(db, DOC_SHARES_SUBCOLLECTION), where(fieldName, '==', normalizedVal)));
        } catch (error) {
          if (isPermissionDeniedError(error)) {
            denied = true;
            return;
          }

          if (isIndexError(error)) {
            console.warn(`Firestore index required for collection group '${DOC_SHARES_SUBCOLLECTION}':`, (error as Error).message);
            denied = true;
            return;
          }

          throw error;
        }

        snapshot.forEach((item: any) => {
          const grant = normalizeSharedKeyGrants([item.data() as ShareGrantRecord])[0];
          const docId = item.ref.parent.parent?.id;
          if (!grant || !docId || !isShareGrantActive(grant, now)) {
            return;
          }

          grantDocs.push({docId, grant});
        });
      }),
    );

    return !denied;
  };

  const uidQueryAllowed = await loadGrantMatches('recipientUid', uidIdentifiers);
  const emailQueryAllowed = await loadGrantMatches('recipientEmail', emailIdentifiers);

  const fallbackDocsById = new Map<string, VaultDocument>();
  await Promise.all(
    [...uidIdentifiers, ...emailIdentifiers].map(async identifier => {
      let snapshot;
      try {
        snapshot = await getDocs(query(collection(db, STORAGE_PATH_PREFIX), where('sharedWith', 'array-contains', identifier)));
      } catch (error) {
        if (isPermissionDeniedError(error)) {
          return;
        }

        if (isIndexError(error)) {
          console.warn('Firestore index required for sharedWith array-contains query:', (error as Error).message);
          return;
        }

        throw error;
      }

      snapshot.forEach((item: any) => {
        const mapped = toVaultDocument(item, [identifier]);
        const existing = fallbackDocsById.get(mapped.id);
        fallbackDocsById.set(mapped.id, existing ? mergeDocuments(existing, mapped) : mapped);
      });
    }),
  );

  if (!uidQueryAllowed && !emailQueryAllowed && fallbackDocsById.size === 0) {
    return [];
  }

  const dedupedByDocId = new Map<string, ShareGrantRecord>();
  grantDocs.forEach(item => {
    const existing = dedupedByDocId.get(item.docId);
    if (!existing || new Date(existing.createdAt).getTime() < new Date(item.grant.createdAt).getTime()) {
      dedupedByDocId.set(item.docId, item.grant);
    }
  });

  const docsFromGrants = await Promise.all(
    [...dedupedByDocId.entries()].map(async ([docId, grant]) => {
      let snapshot;
      try {
        snapshot = await getDoc(doc(db, STORAGE_PATH_PREFIX, docId));
      } catch (error) {
        if (isPermissionDeniedError(error)) {
          return null;
        }

        throw error;
      }

      if (!snapshot.exists()) {
        return null;
      }

      return toVaultDocument(snapshot, [grant.recipientUid, grant.recipientEmail ?? ''].filter(Boolean), [grant]);
    }),
  );

  const combinedById = new Map<string, VaultDocument>(fallbackDocsById);
  docsFromGrants.forEach(item => {
    if (!item) {
      return;
    }

    const existing = combinedById.get(item.id);
    combinedById.set(item.id, existing ? mergeDocuments(existing, item) : item);
  });

  return [...combinedById.values()].sort((a, b) => b.uploadedAt.localeCompare(a.uploadedAt));
}
