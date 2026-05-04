/**
 * app/hooks/useEditMetadataFlow.ts
 *
 * Encapsulates the small amount of state and logic needed to edit a vault
 * document's metadata (name and description). The hook exposes a controlled
 * modal API that can be wired into `useAppController` and `AppOverlays`.
 */

import { useCallback, useState } from 'react';

import { VaultDocument } from '../../types/vault';

type UpdateDocumentMetadataFn = (
  doc: VaultDocument,
  updates: { name?: string; description?: string },
) => Promise<VaultDocument>;

export type UseEditMetadataFlowParams = {
  selectedDoc: VaultDocument | null;
  documents: VaultDocument[];
  setDocuments: (docs: VaultDocument[]) => void;
  setSelectedDoc: (doc: VaultDocument | null) => void;
  updateDocumentMetadata: UpdateDocumentMetadataFn;
  /** Optional status setter so the rest of the app can show a confirmation toast. */
  setStatusMessage?: (message: string) => void;
};

export type EditMetadataModalState = {
  visible: boolean;
  nameInput: string;
  descriptionInput: string;
  isSubmitting: boolean;
  errorMessage: string | null;
};

/**
 * useEditMetadataFlow
 *
 * Manages the controlled state of the edit-metadata modal and the save
 * lifecycle (loading flag, error message, list/selection updates on success).
 *
 * @param params - Document state, setters and the persistence function.
 * @returns Modal props and event handlers consumable by the UI layer.
 */
export function useEditMetadataFlow({
  selectedDoc,
  documents,
  setDocuments,
  setSelectedDoc,
  updateDocumentMetadata,
  setStatusMessage,
}: UseEditMetadataFlowParams) {
  const [state, setState] = useState<EditMetadataModalState>({
    visible: false,
    nameInput: '',
    descriptionInput: '',
    isSubmitting: false,
    errorMessage: null,
  });

  const open = useCallback(() => {
    if (!selectedDoc) {
      return;
    }
    setState({
      visible: true,
      nameInput: selectedDoc.name ?? '',
      descriptionInput: selectedDoc.description ?? '',
      isSubmitting: false,
      errorMessage: null,
    });
  }, [selectedDoc]);

  const close = useCallback(() => {
    setState(prev => (prev.isSubmitting ? prev : { ...prev, visible: false, errorMessage: null }));
  }, []);

  const setNameInput = useCallback((value: string) => {
    setState(prev => ({ ...prev, nameInput: value }));
  }, []);

  const setDescriptionInput = useCallback((value: string) => {
    setState(prev => ({ ...prev, descriptionInput: value }));
  }, []);

  const save = useCallback(async () => {
    if (!selectedDoc) {
      return;
    }
    if (state.nameInput.trim().length === 0) {
      setState(prev => ({ ...prev, errorMessage: 'Document name cannot be empty.' }));
      return;
    }

    setState(prev => ({ ...prev, isSubmitting: true, errorMessage: null }));
    try {
      const updated = await updateDocumentMetadata(selectedDoc, {
        name: state.nameInput,
        description: state.descriptionInput,
      });

      setDocuments(documents.map(item => (item.id === updated.id ? updated : item)));
      if (selectedDoc.id === updated.id) {
        setSelectedDoc(updated);
      }
      setStatusMessage?.(`Updated metadata for ${updated.name}.`);
      setState({
        visible: false,
        nameInput: '',
        descriptionInput: '',
        isSubmitting: false,
        errorMessage: null,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to update document metadata.';
      setState(prev => ({ ...prev, isSubmitting: false, errorMessage: message }));
    }
  }, [
    selectedDoc,
    state.nameInput,
    state.descriptionInput,
    updateDocumentMetadata,
    documents,
    setDocuments,
    setSelectedDoc,
    setStatusMessage,
  ]);

  return {
    editMetadataState: state,
    openEditMetadata: open,
    closeEditMetadata: close,
    setEditMetadataName: setNameInput,
    setEditMetadataDescription: setDescriptionInput,
    saveEditMetadata: save,
  };
}
