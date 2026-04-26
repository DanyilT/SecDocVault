/**
 * app/hooks/useUploadFlow.ts
 *
 * Orchestrates document upload UI flows: selecting files, encrypting payloads,
 * uploading to storage, and creating document metadata records. Keeps UI state
 * and progress reporting in one place while delegating actual upload/crypto to
 * the `documentVault` service layer.
 */

import React from 'react';
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
  isPickingFileRef: { current: boolean };
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
  isPickingFileRef,
  getLocalDocuments,
  saveLocalDocuments,
  scanDocumentForUpload,
  pickDocumentForUpload,
  documentSaveLocal,
  uploadDocumentToFirebase,
}: UseUploadFlowParams) {
  /**
   * isFirebaseModuleUnavailableError
   *
   * Heuristic detector for native Firebase module availability errors. Used to
   * decide whether to attempt a local fallback when cloud upload fails due to
   * missing native modules.
   *
   * @param error - Error to inspect
   * @returns true when the error appears to indicate missing Firebase native modules
   */
  const isFirebaseModuleUnavailableError = (error: unknown): boolean => {
    if (!error) return false;
    const message = error instanceof Error ? error.message : String(error);
    const normalized = message.toLowerCase();
    // Match: Firestore or Storage module not found, native module issues, or failures
    const isFirestore =
      normalized.includes('firestore') &&
      (normalized.includes('module could not be found') ||
        normalized.includes('native module') ||
        normalized.includes('has not been installed') ||
        normalized.includes("firebase.app('[default]').firestore") ||
        normalized.includes('getfirestore') ||
        normalized.includes('cannot read') ||
        normalized.includes('is not a function'));

    const isStorage =
      normalized.includes('storage') &&
      (normalized.includes('module could not be found') ||
        normalized.includes('native module') ||
        normalized.includes('has not been installed') ||
        normalized.includes("firebase.app('[default]').storage") ||
        normalized.includes('cannot read') ||
        normalized.includes('is not a function'));

    return isFirestore || isStorage;
  };

  /**
   * appendUploadedDocument
   *
   * Prepend an uploaded document to the in-memory documents list.
   *
   * @param nextDoc - Newly created/uploaded document to add
   */
  const appendUploadedDocument = (nextDoc: VaultDocument) => {
    setDocuments(prev => [nextDoc, ...prev]);
  };

  /**
   * clearPendingUploadDraft
   *
   * Reset the pending upload draft and metadata fields to their defaults.
   * This is called after a successful upload or when the user discards the draft.
   *
   * @returns {void}
   */
  const clearPendingUploadDraft = () => {
    setPendingUploadDraft(null);
    setPendingUploadName('Document');
    setPendingUploadDescription('');
    setPendingUploadRecoverable(uploadCanUseCloud ? recoverableByDefault : false);
    setPendingUploadToCloud(uploadCanUseCloud);
    setPendingUploadAlsoSaveLocal(uploadCanUseCloud ? saveOfflineByDefault : true);
      setPendingUploadPreviewIndex(0);
  };

  /**
   * handleLeaveUploadScreen
   *
   * Navigate away from the upload screen. If a draft exists, show a discard
   * confirmation unless the user has previously disabled the warning.
   *
   * @returns {void}
   */
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

  /**
   * confirmDiscardUploadDraft
   *
   * Permanently discard the current pending upload draft and optionally persist
   * the user's preference to skip the discard warning in the future.
   *
   * @returns {Promise<void>}
   */
  const confirmDiscardUploadDraft = async () => {
    if (dontShowUploadDiscardWarningAgain) {
      await AsyncStorage.setItem(uploadDiscardWarningPrefKey, '1');
      setSkipUploadDiscardWarning(true);
    }

    setShowUploadDiscardWarning(false);
    clearPendingUploadDraft();
    setScreen('main');
  };


  /**
   * selectUploadDocument
   *
   * Open the camera or file picker and set the selected file(s) into the
   * pending upload draft. Optionally append to an existing draft.
   *
   * @param {'scan'|'pick'} source - Source of the document (camera scan or file picker)
   * @param {boolean} [appendToDraft=false] - Whether to append the selected file to the existing draft
   * @returns {Promise<void>}
   */
  const selectUploadDocument = async (
    source: 'scan' | 'pick',
    appendToDraft: boolean = false,
  ): Promise<void> => {
    if (isUploading) {
      return;
    }

    if (
      appendToDraft &&
      pendingUploadDraft &&
      pendingUploadDraft.files.length >= maxFilesPerDocument
    ) {
      setUploadStatus(
        `A document can contain at most ${maxFilesPerDocument} files.`,
      );
      return;
    }

    setUploadStatus(
      source === 'scan' ? 'Opening camera...' : 'Opening file picker...',
    );

    try {
      isPickingFileRef.current = true;
      const document =
        source === 'scan'
          ? await scanDocumentForUpload()
          : await pickDocumentForUpload();
      isPickingFileRef.current = false;
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
        setPendingUploadRecoverable(
          uploadCanUseCloud ? recoverableByDefault : false,
        );
        setPendingUploadToCloud(uploadCanUseCloud);
        setPendingUploadAlsoSaveLocal(
          uploadCanUseCloud ? saveOfflineByDefault : true,
        );
      }

      setScreen('upload');
      setUploadStatus('Review your document details before uploading.');
    } catch (error) {
      isPickingFileRef.current = false;
      const message =
        error instanceof Error ? error.message : 'Selection failed.';
      setUploadStatus(message);
    }
  };

  /**
   * commitUploadDocument
   *
   * Validate and commit the pending upload draft: encrypt files, optionally
   * upload to cloud, save local copies, and update UI status and document
   * lists. Handles fallback to local save when Firebase modules are missing.
   *
   * @param {UploadableDocumentDraft} draftDocument - The draft to commit
   * @returns {Promise<void>}
   */
  const commitUploadDocument = async (
    draftDocument: UploadableDocumentDraft,
  ): Promise<void> => {
    if (isUploading) {
      return;
    }

    if (draftDocument.files.length === 0) {
      setUploadStatus('Add at least one file before uploading.');
      return;
    }

    if (draftDocument.files.length > maxFilesPerDocument) {
      setUploadStatus(
        `A document can contain at most ${maxFilesPerDocument} files.`,
      );
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
      const shouldSaveLocal =
        pendingUploadAlsoSaveLocal || !shouldUploadToCloud;
      if (!shouldUploadToCloud && !shouldSaveLocal) {
        setUploadStatus(
          'Enable at least one destination: local save or cloud upload.',
        );
        setIsUploading(false);
        return;
      }

      if (shouldUploadToCloud) {
        const tooLargeFile = document.files.find(
          file => file.size > 10 * 1024 * 1024,
        );
        if (tooLargeFile) {
          setUploadStatus(
            `File ${tooLargeFile.name} is larger than 10 MB. Reduce size and retry.`,
          );
          setIsUploading(false);
          return;
        }

        const cloudOwnedCount = documents.filter(
          item =>
            item.owner === userUid &&
            item.references?.some(reference => reference.source === 'firebase'),
        ).length;
        if (cloudOwnedCount >= 10) {
          setUploadStatus(
            'Cloud upload limit reached: maximum 10 documents per user.',
          );
          setIsUploading(false);
          return;
        }
      }

      const ownerId = userUid ?? 'guest-local';

      setUploadStatus(
        !shouldUploadToCloud
          ? `Encrypting ${document.files.length} file(s) for ${document.name}...`
          : `Uploading ${document.files.length} file(s) for ${document.name}...`,
      );

      let result: { document: VaultDocument; timings?: { totalMs: number } };
      if (!shouldUploadToCloud) {
        result = await documentSaveLocal(ownerId, document, {
          recoverable: pendingUploadRecoverable,
        });
      } else {
        try {
          result = await (async () => {
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
                const fileTag = `${event.fileIndex + 1}/${
                  document.files.length
                }`;
                if (
                  event.status === 'progress' &&
                  typeof event.progress === 'number'
                ) {
                  const now = Date.now();
                  if (now - lastProgressUpdate < 150) {
                    return;
                  }
                  lastProgressUpdate = now;
                  setUploadStatus(
                    `${stageLabel[event.stage]} file ${fileTag}: ${Math.round(
                      event.progress * 100,
                    )}%`,
                  );
                  return;
                }
                if (event.status === 'start') {
                  setUploadStatus(
                    `${stageLabel[event.stage]} file ${fileTag}...`,
                  );
                  return;
                }
                if (event.stage === 'done' && event.status === 'end') {
                  setUploadStatus(`Completed file ${fileTag}.`);
                }
              },
            });
          })();
        } catch (error) {
          const errorMessage =
            error instanceof Error ? error.message : String(error);
          console.warn('[Upload] Cloud upload failed:', errorMessage);

          if (!isFirebaseModuleUnavailableError(error)) {
            console.error(
              '[Upload] Not a Firebase module error, rethrowing:',
              errorMessage,
            );
            throw error;
          }

          console.warn(
            '[Upload] Firebase module unavailable, attempting local fallback',
          );

          if (!shouldSaveLocal) {
            throw new Error(
              'Cloud upload is unavailable because Firebase native modules are missing. Enable local save or rebuild the app with @react-native-firebase/storage and @react-native-firebase/firestore linked.',
            );
          }

          setUploadStatus(
            'Cloud upload unavailable. Saving encrypted files locally instead...',
          );
          result = await documentSaveLocal(ownerId, document, {
            recoverable: pendingUploadRecoverable,
          });
        }
      }

      appendUploadedDocument(result.document);
      if (
        result.document.saveMode === 'local' ||
        result.document.offlineAvailable
      ) {
        const persistedLocal = await getLocalDocuments();
        await saveLocalDocuments([result.document, ...persistedLocal]);
        setUploadStatus(
          result.document.saveMode === 'local'
            ? `${document.name} encrypted and saved locally (${document.files.length} file(s)).`
            : `${document.name} uploaded and cached for offline decrypt (${document.files.length} file(s)).`,
        );
      } else if (result.timings) {
        setUploadStatus(
          `${document.name} uploaded to Firebase Storage (${
            document.files.length
          } file(s)) in ${(result.timings.totalMs / 1000).toFixed(1)}s.`,
        );
      } else {
        setUploadStatus(
          `${document.name} uploaded to Firebase Storage (${document.files.length} file(s)).`,
        );
      }

      clearPendingUploadDraft();
      setScreen('main');
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      console.error('[Upload]commitUploadDocument outer catch:', errorMessage);
      setUploadStatus(errorMessage);
    } finally {
      setIsUploading(false);
    }
  };

  /**
   * handleScanAndUpload
   *
   * Helper to start a new scan-and-upload flow.
   *
   * @returns {void}
   */

  const handleScanAndUpload = () => {
    void selectUploadDocument('scan', false);
  };

  /**
   * handlePickAndUpload
   *
   * Helper to start a new file-pick-and-upload flow.
   *
   * @returns {void}
   */

  const handlePickAndUpload = () => {
    void selectUploadDocument('pick', false);
  };

  /**
   * handleAddScanToUpload
   *
   * Append a scanned file to the current pending upload draft.
   *
   * @returns {void}
   */

  const handleAddScanToUpload = () => {
    void selectUploadDocument('scan', true);
  };

  /**
   * handleAddPickToUpload
   *
   * Append a picked file to the current pending upload draft.
   *
   * @returns {void}
   */

  const handleAddPickToUpload = () => {
    void selectUploadDocument('pick', true);
  };

  /**
   * handleRemoveUploadFile
   *
   * Remove a file from the pending upload draft. If no files remain the draft
   * is cleared and the UI returns to the main screen.
   *
   * @param index - Index of the file to remove
   */
  const handleRemoveUploadFile = (index: number) => {
    setPendingUploadDraft(prev => {
      if (!prev) {
        return prev;
      }

      const nextFiles = prev.files.filter(
        (_, fileIndex) => fileIndex !== index,
      );
      if (nextFiles.length === 0) {
        setPendingUploadPreviewIndex(0);
        setUploadStatus('Upload draft cleared.');
        setScreen('main');
        return null;
      }

      setPendingUploadPreviewIndex(current =>
        Math.max(0, Math.min(current, nextFiles.length - 1)),
      );
      return {
        ...prev,
        files: nextFiles,
      };
    });
  };

  /**
   * handleReorderUploadFiles
   *
   * Reorder files within the pending upload draft.
   *
   * @param fromIndex - Source index
   * @param toIndex - Destination index
   */
  const handleReorderUploadFiles = (fromIndex: number, toIndex: number) => {
    setPendingUploadDraft(prev => {
      if (
        !prev ||
        fromIndex === toIndex ||
        fromIndex < 0 ||
        toIndex < 0 ||
        toIndex >= prev.files.length
      ) {
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
    handleAddScanToUpload,
    handleAddPickToUpload,
    handleRemoveUploadFile,
    handleReorderUploadFiles,
  };
}
