import React from 'react';

import {
  useDocumentActionsFlow,
  usePreviewFlow,
  useShareFlow,
  useUploadFlow,
} from '../hooks';
import { AppScreen } from '../navigation/constants';
import {
  canCurrentUserExportDocument,
  createDocumentShareGrant,
  deleteDocumentFromFirebase,
  decryptDocumentPayload,
  documentSaveLocal,
  exportDocumentToDevice,
  MAX_FILES_PER_DOCUMENT,
  pickDocumentForUpload,
  removeFirebaseReferences,
  removeLocalDocumentCopy,
  revokeDocumentShareGrant,
  saveDocumentOffline,
  saveDocumentToFirebase,
  scanDocumentForUpload,
  uploadDocumentToFirebase,
  UploadableDocumentDraft,
} from '../../services/documentVault';
import { hasInternetAccess } from '../../services/connectivity';
import { getLocalDocuments, saveLocalDocuments } from '../../storage/localVault';
import { VaultDocument } from '../../types/vault';

type UseVaultFeatureFlowsParams = {
  uploadDiscardWarningPrefKey: string;
  isGuest: boolean;
  userUid?: string;
  screen: AppScreen;
  shareOriginScreen: 'main' | 'preview';
  setShareOriginScreen: (screen: 'main' | 'preview') => void;
  uploadCanUseCloud: boolean;
  recoverableByDefault: boolean;
  saveOfflineByDefault: boolean;
  isUploading: boolean;
  pendingUploadDraft: UploadableDocumentDraft | null;
  pendingUploadName: string;
  pendingUploadDescription: string;
  pendingUploadRecoverable: boolean;
  pendingUploadToCloud: boolean;
  pendingUploadAlsoSaveLocal: boolean;
  documents: VaultDocument[];
  selectedDoc: VaultDocument | null;
  skipUploadDiscardWarning: boolean;
  dontShowUploadDiscardWarningAgain: boolean;
  setDocuments: React.Dispatch<React.SetStateAction<VaultDocument[]>>;
  setSelectedDoc: React.Dispatch<React.SetStateAction<VaultDocument | null>>;
  setScreen: (screen: AppScreen) => void;
  setUploadStatus: (value: string) => void;
  setBackupStatus: (value: string) => void;
  setAccountStatus: (value: string) => void;
  setIsUploading: (value: boolean) => void;
  setPendingUploadDraft: React.Dispatch<React.SetStateAction<UploadableDocumentDraft | null>>;
  setPendingUploadName: (value: string) => void;
  setPendingUploadDescription: (value: string) => void;
  setPendingUploadRecoverable: (value: boolean) => void;
  setPendingUploadToCloud: (value: boolean) => void;
  setPendingUploadAlsoSaveLocal: (value: boolean) => void;
  setPendingUploadPreviewIndex: (value: number | ((value: number) => number)) => void;
  setShowUploadDiscardWarning: (value: boolean) => void;
  setDontShowUploadDiscardWarningAgain: (value: boolean | ((value: boolean) => boolean)) => void;
  setSkipUploadDiscardWarning: (value: boolean) => void;
  handleToggleDocumentRecovery: (docMeta: VaultDocument, enabled: boolean) => Promise<void>;
};

export function useVaultFeatureFlows({
  uploadDiscardWarningPrefKey,
  isGuest,
  userUid,
  screen,
  shareOriginScreen,
  setShareOriginScreen,
  uploadCanUseCloud,
  recoverableByDefault,
  saveOfflineByDefault,
  isUploading,
  pendingUploadDraft,
  pendingUploadName,
  pendingUploadDescription,
  pendingUploadRecoverable,
  pendingUploadToCloud,
  pendingUploadAlsoSaveLocal,
  documents,
  selectedDoc,
  skipUploadDiscardWarning,
  dontShowUploadDiscardWarningAgain,
  setDocuments,
  setSelectedDoc,
  setScreen,
  setUploadStatus,
  setBackupStatus,
  setAccountStatus,
  setIsUploading,
  setPendingUploadDraft,
  setPendingUploadName,
  setPendingUploadDescription,
  setPendingUploadRecoverable,
  setPendingUploadToCloud,
  setPendingUploadAlsoSaveLocal,
  setPendingUploadPreviewIndex,
  setShowUploadDiscardWarning,
  setDontShowUploadDiscardWarningAgain,
  setSkipUploadDiscardWarning,
  handleToggleDocumentRecovery,
}: UseVaultFeatureFlowsParams) {
  const {
    previewImageUri,
    previewStatus,
    previewFileOrder,
    isPreviewDecrypting,
    isCurrentFileDecrypted,
    preparePreviewForDocument,
    openPreview,
    handleSelectPreviewFile,
    handleDecryptPreview,
    handleExportDocument,
  } = usePreviewFlow({
    selectedDoc,
    setSelectedDoc,
    setScreen: () => setScreen('preview'),
    hasInternetAccess,
    decryptDocumentPayload,
    exportDocumentToDevice,
    canCurrentUserExportDocument,
  });

  const {
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
  } = useShareFlow({
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
  });

  const handleToggleDocBackupFromSettings = async (docId: string, enabled: boolean) => {
    const target = documents.find(item => item.id === docId);
    if (!target) {
      setAccountStatus('Document not found. Reload and try again.');
      return;
    }

    await handleToggleDocumentRecovery(target, enabled);
  };

  const {
    handleLeaveUploadScreen,
    confirmDiscardUploadDraft,
    commitUploadDocument,
    handleScanAndUpload,
    handlePickAndUpload,
    handleRemoveUploadFile,
    handleReorderUploadFiles,
  } = useUploadFlow({
    uploadDiscardWarningPrefKey,
    uploadCanUseCloud,
    recoverableByDefault,
    saveOfflineByDefault,
    maxFilesPerDocument: MAX_FILES_PER_DOCUMENT,
    isUploading,
    pendingUploadDraft,
    pendingUploadName,
    pendingUploadDescription,
    pendingUploadRecoverable,
    pendingUploadToCloud,
    pendingUploadAlsoSaveLocal,
    documents,
    userUid,
    setIsUploading,
    setUploadStatus,
    setPendingUploadDraft,
    setPendingUploadName,
    setPendingUploadDescription,
    setPendingUploadRecoverable,
    setPendingUploadToCloud,
    setPendingUploadAlsoSaveLocal,
    setPendingUploadPreviewIndex,
    setShowUploadDiscardWarning,
    setDontShowUploadDiscardWarningAgain,
    setSkipUploadDiscardWarning,
    setDocuments,
    setScreen,
    skipUploadDiscardWarning,
    dontShowUploadDiscardWarningAgain,
    getLocalDocuments,
    saveLocalDocuments,
    scanDocumentForUpload,
    pickDocumentForUpload,
    documentSaveLocal,
    uploadDocumentToFirebase,
  });

  const {
    handleSaveOffline,
    handleSaveToFirebase,
    handleDeleteLocal,
    handleDeleteFromFirebase,
  } = useDocumentActionsFlow({
    isGuest,
    userUid,
    setDocuments,
    setSelectedDoc,
    setUploadStatus,
    setScreen: () => setScreen('main'),
    hasInternetAccess,
    saveDocumentOffline,
    saveDocumentToFirebase,
    removeLocalDocumentCopy,
    deleteDocumentFromFirebase,
    removeFirebaseReferences,
  });

  return {
    previewImageUri,
    previewStatus,
    previewFileOrder,
    isPreviewDecrypting,
    isCurrentFileDecrypted,
    preparePreviewForDocument,
    openPreview,
    handleSelectPreviewFile,
    handleDecryptPreview,
    handleExportDocument,
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
    handleToggleDocBackupFromSettings,
    handleLeaveUploadScreen,
    confirmDiscardUploadDraft,
    commitUploadDocument,
    handleScanAndUpload,
    handlePickAndUpload,
    handleRemoveUploadFile,
    handleReorderUploadFiles,
    handleSaveOffline,
    handleSaveToFirebase,
    handleDeleteLocal,
    handleDeleteFromFirebase,
  };
}
