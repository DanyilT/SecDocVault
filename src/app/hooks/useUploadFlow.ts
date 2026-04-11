import AsyncStorage from '@react-native-async-storage/async-storage';

import { UploadableDocumentDraft, UploadProgressEvent } from '../../services/documentVault';
import { VaultDocument } from '../../types/vault.ts';

type UseUploadFlowParams = {
  uploadDiscardWarningPrefKey: string;
  uploadCanUseCloud: boolean;
  recoverableByDefault: boolean;
  saveOfflineByDefault: boolean;
  maxFilesPerDocument: number;
  isUploading: boolean;
  pendingUploadDraft: UploadableDocumentDraft | null;
  pendingUploadName: string;
  pendingUploadDescription: string;
  pendingUploadRecoverable: boolean;
  pendingUploadToCloud: boolean;
  pendingUploadAlsoSaveLocal: boolean;
  documents: VaultDocument[];
  userUid?: string;
  setIsUploading: (value: boolean) => void;
  setUploadStatus: (value: string) => void;
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
  setDocuments: React.Dispatch<React.SetStateAction<VaultDocument[]>>;
  setScreen: (screen: 'main' | 'upload') => void;
  skipUploadDiscardWarning: boolean;
  dontShowUploadDiscardWarningAgain: boolean;
  getLocalDocuments: () => Promise<VaultDocument[]>;
  saveLocalDocuments: (documents: VaultDocument[]) => Promise<void>;
  scanDocumentForUpload: () => Promise<UploadableDocumentDraft['files'][number]>;
  pickDocumentForUpload: () => Promise<UploadableDocumentDraft['files'][number]>;
  documentSaveLocal: (
    ownerId: string,
    draft: UploadableDocumentDraft,
    options: {recoverable: boolean},
  ) => Promise<{document: VaultDocument; timings?: {totalMs: number}}>;
  uploadDocumentToFirebase: (
    ownerId: string,
    draft: UploadableDocumentDraft,
    options: {
      alsoSaveLocal: boolean;
      recoverable: boolean;
      onProgress?: (event: UploadProgressEvent) => void;
    },
  ) => Promise<{document: VaultDocument; timings?: {totalMs: number}}>;
};

export function useUploadFlow({
  uploadDiscardWarningPrefKey,
  uploadCanUseCloud,
  recoverableByDefault,
  saveOfflineByDefault,
  maxFilesPerDocument,
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
}: UseUploadFlowParams) {
  const appendUploadedDocument = (nextDoc: VaultDocument) => {
    setDocuments(prev => [nextDoc, ...prev]);
  };

  const clearPendingUploadDraft = () => {
    setPendingUploadDraft(null);
    setPendingUploadName('Document');
    setPendingUploadDescription('');
    setPendingUploadRecoverable(uploadCanUseCloud ? recoverableByDefault : false);
    setPendingUploadToCloud(uploadCanUseCloud);
    setPendingUploadAlsoSaveLocal(uploadCanUseCloud ? saveOfflineByDefault : true);
      setPendingUploadPreviewIndex(0);
  };

  const handleLeaveUploadScreen = () => {
    if (!pendingUploadDraft) {
      setScreen('main');
      return;
    }

    if (skipUploadDiscardWarning) {
      clearPendingUploadDraft();
      setScreen('main');
      return;
    }

    setDontShowUploadDiscardWarningAgain(false);
    setShowUploadDiscardWarning(true);
  };

  const confirmDiscardUploadDraft = async () => {
    if (dontShowUploadDiscardWarningAgain) {
      await AsyncStorage.setItem(uploadDiscardWarningPrefKey, '1');
      setSkipUploadDiscardWarning(true);
    }

    setShowUploadDiscardWarning(false);
    clearPendingUploadDraft();
    setScreen('main');
  };

  const selectUploadDocument = async (source: 'scan' | 'pick', appendToDraft = false) => {
    if (isUploading) {
      return;
    }

    if (appendToDraft && pendingUploadDraft && pendingUploadDraft.files.length >= maxFilesPerDocument) {
      setUploadStatus(`A document can contain at most ${maxFilesPerDocument} files.`);
      return;
    }

    setUploadStatus(source === 'scan' ? 'Opening camera...' : 'Opening file picker...');

    try {
      const document = source === 'scan' ? await scanDocumentForUpload() : await pickDocumentForUpload();
      setPendingUploadDraft(prev => {
        if (appendToDraft && prev) {
          return {
            ...prev,
            files: [...prev.files, document],
          };
        }

        return {
          name: 'Document',
          description: '',
          files: [document],
        };
      });

      if (appendToDraft && pendingUploadDraft) {
        setPendingUploadPreviewIndex(pendingUploadDraft.files.length);
      } else {
        setPendingUploadPreviewIndex(0);
        setPendingUploadName('Document');
        setPendingUploadDescription('');
        setPendingUploadRecoverable(uploadCanUseCloud ? recoverableByDefault : false);
        setPendingUploadToCloud(uploadCanUseCloud);
        setPendingUploadAlsoSaveLocal(uploadCanUseCloud ? saveOfflineByDefault : true);
      }

      setScreen('upload');
      setUploadStatus('Review your document details before uploading.');
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Selection failed.';
      setUploadStatus(message);
    }
  };

  const commitUploadDocument = async (draftDocument: UploadableDocumentDraft) => {
    if (isUploading) {
      return;
    }

    if (draftDocument.files.length === 0) {
      setUploadStatus('Add at least one file before uploading.');
      return;
    }

    if (draftDocument.files.length > maxFilesPerDocument) {
      setUploadStatus(`A document can contain at most ${maxFilesPerDocument} files.`);
      return;
    }

    setIsUploading(true);

    try {
      const document: UploadableDocumentDraft = {
        ...draftDocument,
        name: pendingUploadName.trim() || 'Document',
        description: pendingUploadDescription.trim(),
      };

      const shouldUploadToCloud = uploadCanUseCloud && pendingUploadToCloud;
      const shouldSaveLocal = pendingUploadAlsoSaveLocal || !shouldUploadToCloud;
      if (!shouldUploadToCloud && !shouldSaveLocal) {
        setUploadStatus('Enable at least one destination: local save or cloud upload.');
        return;
      }

      if (shouldUploadToCloud) {
        const tooLargeFile = document.files.find(file => file.size > 10 * 1024 * 1024);
        if (tooLargeFile) {
          setUploadStatus(`File ${tooLargeFile.name} is larger than 10 MB. Reduce size and retry.`);
          return;
        }

        const cloudOwnedCount = documents.filter(
          item => item.owner === userUid && item.references?.some(reference => reference.source === 'firebase'),
        ).length;
        if (cloudOwnedCount >= 10) {
          setUploadStatus('Cloud upload limit reached: maximum 10 documents per user.');
          return;
        }
      }

      const ownerId = userUid ?? 'guest-local';

      setUploadStatus(
        !shouldUploadToCloud
          ? `Encrypting ${document.files.length} file(s) for ${document.name}...`
          : `Uploading ${document.files.length} file(s) for ${document.name}...`,
      );

      const result = !shouldUploadToCloud
        ? await documentSaveLocal(ownerId, document, {
            recoverable: pendingUploadRecoverable,
          })
        : await (async () => {
            let lastProgressUpdate = 0;
            return uploadDocumentToFirebase(ownerId, document, {
              alsoSaveLocal: shouldSaveLocal,
              recoverable: pendingUploadRecoverable,
              onProgress: event => {
                const stageLabel: Record<string, string> = {
                  read: 'Reading',
                  encrypt: 'Encrypting',
                  upload: 'Uploading',
                  localSave: 'Saving local copy',
                  done: 'Done',
                };
                const fileTag = `${event.fileIndex + 1}/${document.files.length}`;
                if (event.status === 'progress' && typeof event.progress === 'number') {
                  const now = Date.now();
                  if (now - lastProgressUpdate < 150) {
                    return;
                  }
                  lastProgressUpdate = now;
                  setUploadStatus(`${stageLabel[event.stage]} file ${fileTag}: ${Math.round(event.progress * 100)}%`);
                  return;
                }
                if (event.status === 'start') {
                  setUploadStatus(`${stageLabel[event.stage]} file ${fileTag}...`);
                  return;
                }
                if (event.stage === 'done' && event.status === 'end') {
                  setUploadStatus(`Completed file ${fileTag}.`);
                }
              },
            });
          })();

      appendUploadedDocument(result.document);
      if (result.document.saveMode === 'local' || result.document.offlineAvailable) {
        const persistedLocal = await getLocalDocuments();
        await saveLocalDocuments([result.document, ...persistedLocal]);
        setUploadStatus(
          result.document.saveMode === 'local'
            ? `${document.name} encrypted and saved locally (${document.files.length} file(s)).`
            : `${document.name} uploaded and cached for offline decrypt (${document.files.length} file(s)).`,
        );
      } else if (result.timings) {
        setUploadStatus(
          `${document.name} uploaded to Firebase Storage (${document.files.length} file(s)) in ${(result.timings.totalMs / 1000).toFixed(1)}s.`,
        );
      } else {
        setUploadStatus(`${document.name} uploaded to Firebase Storage (${document.files.length} file(s)).`);
      }

      clearPendingUploadDraft();
      setScreen('main');
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Upload failed.';
      setUploadStatus(message);
    } finally {
      setIsUploading(false);
    }
  };

  const handleScanAndUpload = () => {
    void selectUploadDocument('scan', false);
  };

  const handlePickAndUpload = () => {
    void selectUploadDocument('pick', false);
  };

  const handleRemoveUploadFile = (index: number) => {
    setPendingUploadDraft(prev => {
      if (!prev) {
        return prev;
      }

      const nextFiles = prev.files.filter((_, fileIndex) => fileIndex !== index);
      if (nextFiles.length === 0) {
        setPendingUploadPreviewIndex(0);
        setUploadStatus('Upload draft cleared.');
        setScreen('main');
        return null;
      }

      setPendingUploadPreviewIndex(current => Math.max(0, Math.min(current, nextFiles.length - 1)));
      return {
        ...prev,
        files: nextFiles,
      };
    });
  };

  const handleReorderUploadFiles = (fromIndex: number, toIndex: number) => {
    setPendingUploadDraft(prev => {
      if (!prev || fromIndex === toIndex || fromIndex < 0 || toIndex < 0 || toIndex >= prev.files.length) {
        return prev;
      }

      const nextFiles = [...prev.files];
      const [moved] = nextFiles.splice(fromIndex, 1);
      nextFiles.splice(toIndex, 0, moved);
      setPendingUploadPreviewIndex(toIndex);

      return {
        ...prev,
        files: nextFiles,
      };
    });
  };

  return {
    clearPendingUploadDraft,
    handleLeaveUploadScreen,
    confirmDiscardUploadDraft,
    selectUploadDocument,
    commitUploadDocument,
    handleScanAndUpload,
    handlePickAndUpload,
    handleRemoveUploadFile,
    handleReorderUploadFiles,
  };
}
