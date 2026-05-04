/**
 * Tests for app/hooks/useEditMetadataFlow.ts
 */

import React, { forwardRef, useImperativeHandle } from 'react';
import TestRenderer, { act } from 'react-test-renderer';

import { useEditMetadataFlow } from '../../../src/app/hooks';
import { VaultDocument } from '../../../src/types/vault';

function makeDoc(overrides: Partial<VaultDocument> = {}): VaultDocument {
  return {
    id: 'doc-1',
    name: 'Original',
    description: 'Original description',
    hash: 'h',
    size: '1 KB',
    uploadedAt: '2026-01-01',
    owner: 'me',
    references: [
      { source: 'firebase', name: 'a.jpg', size: 1, type: 'image/jpeg', order: 0 },
    ],
    ...overrides,
  };
}

type HarnessRef = {
  open: () => void;
  close: () => void;
  setName: (v: string) => void;
  setDescription: (v: string) => void;
  save: () => Promise<void>;
  getState: () => ReturnType<typeof useEditMetadataFlow>['editMetadataState'];
};

const Harness = forwardRef<HarnessRef, { params: Parameters<typeof useEditMetadataFlow>[0] }>(
  ({ params }, ref) => {
    const api = useEditMetadataFlow(params);
    useImperativeHandle(ref, () => ({
      open: api.openEditMetadata,
      close: api.closeEditMetadata,
      setName: api.setEditMetadataName,
      setDescription: api.setEditMetadataDescription,
      save: api.saveEditMetadata,
      getState: () => api.editMetadataState,
    }));
    return null;
  },
);

describe('useEditMetadataFlow', () => {
  it('starts with the modal hidden and empty inputs', () => {
    const ref = React.createRef<HarnessRef>();

    act(() => {
      TestRenderer.create(
        <Harness
          ref={ref}
          params={{
            selectedDoc: null,
            documents: [],
            setDocuments: jest.fn(),
            setSelectedDoc: jest.fn(),
            updateDocumentMetadata: jest.fn(),
          }}
        />,
      );
    });

    expect(ref.current!.getState()).toEqual({
      visible: false,
      nameInput: '',
      descriptionInput: '',
      isSubmitting: false,
      errorMessage: null,
    });
  });

  it('opens the modal with the selected document prefilled', () => {
    const ref = React.createRef<HarnessRef>();
    const doc = makeDoc({ name: 'Hello', description: 'World' });

    act(() => {
      TestRenderer.create(
        <Harness
          ref={ref}
          params={{
            selectedDoc: doc,
            documents: [doc],
            setDocuments: jest.fn(),
            setSelectedDoc: jest.fn(),
            updateDocumentMetadata: jest.fn(),
          }}
        />,
      );
    });

    act(() => {
      ref.current!.open();
    });

    const state = ref.current!.getState();
    expect(state.visible).toBe(true);
    expect(state.nameInput).toBe('Hello');
    expect(state.descriptionInput).toBe('World');
    expect(state.errorMessage).toBeNull();
  });

  it('does nothing when open is called with no selected document', () => {
    const ref = React.createRef<HarnessRef>();

    act(() => {
      TestRenderer.create(
        <Harness
          ref={ref}
          params={{
            selectedDoc: null,
            documents: [],
            setDocuments: jest.fn(),
            setSelectedDoc: jest.fn(),
            updateDocumentMetadata: jest.fn(),
          }}
        />,
      );
    });

    act(() => {
      ref.current!.open();
    });

    expect(ref.current!.getState().visible).toBe(false);
  });

  it('updates the name and description through the setters', () => {
    const ref = React.createRef<HarnessRef>();
    const doc = makeDoc();

    act(() => {
      TestRenderer.create(
        <Harness
          ref={ref}
          params={{
            selectedDoc: doc,
            documents: [doc],
            setDocuments: jest.fn(),
            setSelectedDoc: jest.fn(),
            updateDocumentMetadata: jest.fn(),
          }}
        />,
      );
    });

    act(() => {
      ref.current!.open();
    });
    act(() => {
      ref.current!.setName('Updated Name');
      ref.current!.setDescription('Updated Description');
    });

    const state = ref.current!.getState();
    expect(state.nameInput).toBe('Updated Name');
    expect(state.descriptionInput).toBe('Updated Description');
  });

  it('closes the modal when close is called', () => {
    const ref = React.createRef<HarnessRef>();
    const doc = makeDoc();

    act(() => {
      TestRenderer.create(
        <Harness
          ref={ref}
          params={{
            selectedDoc: doc,
            documents: [doc],
            setDocuments: jest.fn(),
            setSelectedDoc: jest.fn(),
            updateDocumentMetadata: jest.fn(),
          }}
        />,
      );
    });

    act(() => {
      ref.current!.open();
    });
    expect(ref.current!.getState().visible).toBe(true);

    act(() => {
      ref.current!.close();
    });
    expect(ref.current!.getState().visible).toBe(false);
  });

  it('saves successfully — calls the service, updates documents and selectedDoc, closes the modal', async () => {
    const ref = React.createRef<HarnessRef>();
    const doc = makeDoc();
    const updatedDoc: VaultDocument = { ...doc, name: 'Renamed', description: 'New desc' };

    const setDocuments = jest.fn();
    const setSelectedDoc = jest.fn();
    const updateDocumentMetadata = jest.fn(async () => updatedDoc);
    const setStatusMessage = jest.fn();

    act(() => {
      TestRenderer.create(
        <Harness
          ref={ref}
          params={{
            selectedDoc: doc,
            documents: [doc],
            setDocuments,
            setSelectedDoc,
            updateDocumentMetadata,
            setStatusMessage,
          }}
        />,
      );
    });

    act(() => {
      ref.current!.open();
    });
    act(() => {
      ref.current!.setName('Renamed');
      ref.current!.setDescription('New desc');
    });

    await act(async () => {
      await ref.current!.save();
    });

    expect(updateDocumentMetadata).toHaveBeenCalledWith(doc, {
      name: 'Renamed',
      description: 'New desc',
    });
    expect(setDocuments).toHaveBeenCalledWith([updatedDoc]);
    expect(setSelectedDoc).toHaveBeenCalledWith(updatedDoc);
    expect(setStatusMessage).toHaveBeenCalledWith('Updated metadata for Renamed.');
    expect(ref.current!.getState().visible).toBe(false);
  });

  it('does not save when the name input is empty and surfaces a validation error', async () => {
    const ref = React.createRef<HarnessRef>();
    const doc = makeDoc();
    const updateDocumentMetadata = jest.fn();

    act(() => {
      TestRenderer.create(
        <Harness
          ref={ref}
          params={{
            selectedDoc: doc,
            documents: [doc],
            setDocuments: jest.fn(),
            setSelectedDoc: jest.fn(),
            updateDocumentMetadata,
          }}
        />,
      );
    });

    act(() => {
      ref.current!.open();
    });
    act(() => {
      ref.current!.setName('   ');
    });
    await act(async () => {
      await ref.current!.save();
    });

    expect(updateDocumentMetadata).not.toHaveBeenCalled();
    expect(ref.current!.getState().errorMessage).toBe('Document name cannot be empty.');
    expect(ref.current!.getState().visible).toBe(true);
  });

  it('shows an error message and keeps the modal open when the service call fails', async () => {
    const ref = React.createRef<HarnessRef>();
    const doc = makeDoc();
    const updateDocumentMetadata = jest.fn(async () => {
      throw new Error('Network down');
    });

    act(() => {
      TestRenderer.create(
        <Harness
          ref={ref}
          params={{
            selectedDoc: doc,
            documents: [doc],
            setDocuments: jest.fn(),
            setSelectedDoc: jest.fn(),
            updateDocumentMetadata,
          }}
        />,
      );
    });

    act(() => {
      ref.current!.open();
    });
    await act(async () => {
      await ref.current!.save();
    });

    const state = ref.current!.getState();
    expect(state.visible).toBe(true);
    expect(state.isSubmitting).toBe(false);
    expect(state.errorMessage).toBe('Network down');
  });

  it('preserves other documents when applying the saved update to the documents list', async () => {
    const ref = React.createRef<HarnessRef>();
    const doc = makeDoc({ id: 'doc-1' });
    const otherDoc = makeDoc({ id: 'doc-2', name: 'Other' });
    const updatedDoc: VaultDocument = { ...doc, name: 'Renamed' };
    const setDocuments = jest.fn();

    act(() => {
      TestRenderer.create(
        <Harness
          ref={ref}
          params={{
            selectedDoc: doc,
            documents: [doc, otherDoc],
            setDocuments,
            setSelectedDoc: jest.fn(),
            updateDocumentMetadata: jest.fn(async () => updatedDoc),
          }}
        />,
      );
    });

    act(() => {
      ref.current!.open();
    });
    await act(async () => {
      await ref.current!.save();
    });

    expect(setDocuments).toHaveBeenCalledWith([updatedDoc, otherDoc]);
  });
});
