/**
 * app/hooks/useDocumentActionsFlow.ts
 *
 * Implements operations that act on an existing document (save offline,
 * upload to firebase, delete local copy, delete from firebase). These are
 * thin wrappers around `services/documentVault` functions to isolate side
 * effects for testing.
 */

import type { Dispatch, SetStateAction } from 'react';
import { Alert } from 'react-native';

import { VaultDocument } from '../../types/vault';

type UseDocumentActionsFlowParams = {
  isGuest: boolean;
  userUid?: string;
  setDocuments: Dispatch<SetStateAction<VaultDocument[]>>;
  setSelectedDoc: Dispatch<SetStateAction<VaultDocument | null>>;
  setUploadStatus: (value: string) => void;
  setScreen: (screen: 'main') => void;
  hasInternetAccess: () => Promise<boolean>;
  saveDocumentOffline: (doc: VaultDocument) => Promise<VaultDocument>;
  saveDocumentToFirebase: (doc: VaultDocument, uid: string) => Promise<VaultDocument>;
  removeLocalDocumentCopy: (doc: VaultDocument) => Promise<VaultDocument>;
  deleteDocumentFromFirebase: (doc: VaultDocument) => Promise<void>;
  removeFirebaseReferences: (doc: VaultDocument) => VaultDocument | null;
};

export function useDocumentActionsFlow({
  isGuest,
  userUid,
  setDocuments,
  setSelectedDoc,
  setUploadStatus,
  setScreen,
  hasInternetAccess,
  saveDocumentOffline,
  saveDocumentToFirebase,
  removeLocalDocumentCopy,
  deleteDocumentFromFirebase,
  removeFirebaseReferences,
}: UseDocumentActionsFlowParams) {
  const updateDocument = (targetId: string, updater: (doc: VaultDocument) => VaultDocument | null) => {
    setDocuments(prev =>
      prev
        .map(item => (item.id === targetId ? updater(item) : item))
        .filter((item): item is VaultDocument => Boolean(item)),
    );

    setSelectedDoc(prev => {
      if (!prev || prev.id !== targetId) {
        return prev;
      }

      return updater(prev);
    });
  };

  const confirmFullDocumentDelete = (docMeta: VaultDocument, sourceLabel: 'offline' | 'cloud') =>
    new Promise<boolean>(resolve => {
      Alert.alert(
        'Delete document permanently?',
        `${docMeta.name} has no other copies. Deleting the ${sourceLabel} copy will permanently delete this document and it cannot be recovered.`,
        [
          {
            text: 'Cancel',
            style: 'cancel',
            onPress: () => resolve(false),
          },
          {
            text: 'Delete Permanently',
            style: 'destructive',
            onPress: () => resolve(true),
          },
        ],
      );
    });

  const handleSaveOffline = async (docMeta: VaultDocument) => {
    try {
      setUploadStatus(`Saving ${docMeta.name} for offline decrypt...`);
      const updated = await saveDocumentOffline(docMeta);
      updateDocument(docMeta.id, () => updated);
      setUploadStatus(`${docMeta.name} is now available offline.`);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to save offline copy.';
      setUploadStatus(message);
    }
  };

  const handleSaveToFirebase = async (docMeta: VaultDocument) => {
    if (isGuest) {
      setUploadStatus('Cloud save is unavailable in guest mode.');
      return;
    }

    if (!userUid) {
      setUploadStatus('Sign in before saving to Cloud (Firebase).');
      return;
    }

    if (docMeta.owner && docMeta.owner !== userUid && docMeta.owner !== 'guest-local') {
      setUploadStatus('Only owner documents or local guest documents can be saved to your Cloud (Firebase) vault.');
      return;
    }

    if (!(await hasInternetAccess())) {
      setUploadStatus('no internet access');
      return;
    }

    try {
      setUploadStatus(`Saving ${docMeta.name} to Cloud (Firebase)...`);
      const updated = await saveDocumentToFirebase(docMeta, userUid);
      updateDocument(docMeta.id, () => updated);
      setUploadStatus(`${docMeta.name} is now saved in Cloud (Firebase).`);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to save to Cloud (Firebase).';
      setUploadStatus(message);
    }
  };

  const handleDeleteLocal = async (docMeta: VaultDocument) => {
    const hasFirebaseCopy = Boolean(docMeta.references?.some(reference => reference.source === 'firebase'));
    if (!hasFirebaseCopy) {
      const confirmed = await confirmFullDocumentDelete(docMeta, 'offline');
      if (!confirmed) {
        return;
      }
    }

    try {
      setUploadStatus(`Deleting local copy for ${docMeta.name}...`);
      const updated = await removeLocalDocumentCopy(docMeta);
      const hasRefs = (updated.references?.length ?? 0) > 0;
      updateDocument(docMeta.id, () => (hasRefs ? updated : null));
      if (hasRefs) {
        setUploadStatus(`${docMeta.name} local copy deleted.`);
        return;
      }

      setUploadStatus(`${docMeta.name} deleted permanently.`);
      setScreen('main');
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to delete local copy.';
      setUploadStatus(message);
    }
  };

  const handleDeleteFromFirebase = async (docMeta: VaultDocument) => {
    if (isGuest) {
      setUploadStatus('Cloud (Firebase) delete is unavailable in guest mode.');
      return;
    }

    const hasLocalCopy = Boolean(docMeta.references?.some(reference => reference.source === 'local'));
    if (!hasLocalCopy) {
      const confirmed = await confirmFullDocumentDelete(docMeta, 'cloud');
      if (!confirmed) {
        return;
      }
    }

    try {
      setUploadStatus(`Deleting ${docMeta.name} from Cloud (Firebase)...`);
      await deleteDocumentFromFirebase(docMeta);
      const localOnly = removeFirebaseReferences(docMeta);
      updateDocument(docMeta.id, () => localOnly);
      if (localOnly) {
        setUploadStatus(`${docMeta.name} deleted from Cloud (Firebase). Local encrypted copy remains.`);
        return;
      }

      setUploadStatus(`${docMeta.name} deleted permanently.`);
      setScreen('main');
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to delete from Cloud (Firebase).';
      setUploadStatus(message);
    }
  };

  return {
    handleSaveOffline,
    handleSaveToFirebase,
    handleDeleteLocal,
    handleDeleteFromFirebase,
  };
}
