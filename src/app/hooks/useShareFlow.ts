/**
 * app/hooks/useShareFlow.ts
 *
 * Implements the share dialog flows including permission selection, email
 * validation, wrapping keys for recipients and creating share records via the
 * documentVault service. Keeps UI state (status messages, dialogs) localized
 * to the hook and testable.
 */

import { useState } from 'react';

import { VaultDocument } from '../../types/vault.ts';

type UseShareFlowParams = {
  isGuest: boolean;
  userUid?: string;
  screen: 'main' | 'preview' | 'share' | 'sharedetails' | string;
  shareOriginScreen: 'main' | 'preview';
  setShareOriginScreen: (screen: 'main' | 'preview') => void;
  selectedDoc: VaultDocument | null;
  setSelectedDoc: (doc: VaultDocument | null) => void;
  setDocuments: React.Dispatch<React.SetStateAction<VaultDocument[]>>;
  setScreen: (screen: 'share' | 'main' | 'preview' | 'sharedetails') => void;
  setUploadStatus: (value: string) => void;
  setBackupStatus: (value: string) => void;
  createDocumentShareGrant: (
    document: VaultDocument,
    ownerUid: string,
    recipientEmail: string,
    allowExport: boolean,
    expiresInDays: number,
  ) => Promise<VaultDocument>;
  revokeDocumentShareGrant: (
    document: VaultDocument,
    ownerUid: string,
    recipientEmail: string,
  ) => Promise<VaultDocument>;
};

export function useShareFlow({
  isGuest,
  userUid,
  screen,
  shareOriginScreen,
  setShareOriginScreen,
  selectedDoc,
  setSelectedDoc,
  setDocuments,
  setScreen,
  setUploadStatus,
  setBackupStatus,
  createDocumentShareGrant,
  revokeDocumentShareGrant,
}: UseShareFlowParams) {
  const [shareTarget, setShareTarget] = useState('');
  const [allowDownload, setAllowDownload] = useState(true);
  const [shareExpiryDays, setShareExpiryDays] = useState('30');
  const [shareStatus, setShareStatus] = useState('');
  const [isShareSubmitting, setIsShareSubmitting] = useState(false);

  const openShare = (doc: VaultDocument) => {
    if (isGuest) {
      setBackupStatus('Sharing is disabled in guest mode.');
      return;
    }

    const hasCloudCopy = Boolean(doc.references?.some(reference => reference.source === 'firebase'));
    if (!hasCloudCopy) {
      setUploadStatus('Document must be saved to cloud before sharing.');
      return;
    }

    if (!userUid || doc.owner !== userUid) {
      setUploadStatus('Only the document owner can create or revoke share keys.');
      return;
    }

    setShareOriginScreen(screen === 'preview' ? 'preview' : 'main');
    setSelectedDoc(doc);
    setShareTarget('');
    setAllowDownload(true);
    setShareExpiryDays('30');
    setShareStatus('');
    setIsShareSubmitting(false);
    setScreen('share');
  };

  const handleRevokeShareForRecipient = async (recipientEmail: string) => {
    if (!selectedDoc || !userUid) {
      setShareStatus('Select a document and sign in before revoking share.');
      return;
    }

    if (selectedDoc.owner !== userUid) {
      setShareStatus('Only the document owner can revoke share keys.');
      return;
    }

    const normalizedRecipientEmail = recipientEmail.trim();
    if (!normalizedRecipientEmail) {
      setShareStatus('Enter recipient email before revoking a share key.');
      return;
    }

    try {
      setIsShareSubmitting(true);
      setShareStatus(`Revoking shared key for ${normalizedRecipientEmail}...`);
      const updated = await revokeDocumentShareGrant(selectedDoc, userUid, normalizedRecipientEmail);
      setDocuments(prev => prev.map(item => (item.id === updated.id ? updated : item)));
      setSelectedDoc(updated);
      setShareStatus('Shared key revoked and document key rotated.');
      setUploadStatus('Shared key revoked and document key rotated.');
      setScreen(shareOriginScreen);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to revoke shared key.';
      setShareStatus(message);
      setUploadStatus(message);
    } finally {
      setIsShareSubmitting(false);
    }
  };

  const handleCreateShare = async () => {
    if (!selectedDoc || !userUid) {
      setShareStatus('Select a document and sign in before sharing.');
      return;
    }

    if (selectedDoc.owner !== userUid) {
      setShareStatus('Only the document owner can create share keys.');
      return;
    }

    if (!shareTarget.trim()) {
      setShareStatus('Enter recipient email before creating a share key.');
      return;
    }

    try {
      setIsShareSubmitting(true);
      setShareStatus(`Creating share key for ${shareTarget.trim()}...`);
      const expiryDays = Number.parseInt(shareExpiryDays.trim(), 10);
      const updated = await createDocumentShareGrant(
        selectedDoc,
        userUid,
        shareTarget.trim(),
        allowDownload,
        Number.isNaN(expiryDays) ? 30 : expiryDays,
      );

      setDocuments(prev => prev.map(item => (item.id === updated.id ? updated : item)));
      setSelectedDoc(updated);
      setShareStatus('Share key created/updated successfully.');
      setUploadStatus('Share key created/updated successfully.');
      setScreen(shareOriginScreen);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to create share key.';
      setShareStatus(message);
      setUploadStatus(message);
    } finally {
      setIsShareSubmitting(false);
    }
  };

  const handleRevokeShare = async () => {
    await handleRevokeShareForRecipient(shareTarget);
  };

  return {
    shareTarget,
    allowDownload,
    shareExpiryDays,
    shareStatus,
    isShareSubmitting,
    setShareTarget,
    setAllowDownload,
    setShareExpiryDays,
    openShare,
    handleCreateShare,
    handleRevokeShare,
    handleRevokeShareForRecipient,
  };
}
