import React, { forwardRef, useImperativeHandle } from 'react';
import TestRenderer, { act } from 'react-test-renderer';

import { usePreviewFlow } from '../../../src/app/hooks';
import { VaultDocument } from '../../../src/types/vault';

function makeDoc(overrides: Partial<VaultDocument> = {}): VaultDocument {
  return {
    id: 'doc-1',
    name: 'Doc',
    hash: 'h',
    size: '1KB',
    uploadedAt: '2026-01-01T00:00:00.000Z',
    references: [{source: 'firebase', name: 'a.jpg', size: 1, type: 'image/jpeg', order: 0}],
    ...overrides,
  };
}

type HarnessRef = {
  openPreview: (doc: VaultDocument) => void;
  handleDecryptPreview: () => Promise<void>;
  handleExportDocument: () => Promise<void>;
  getState: () => {
    previewStatus: string;
    previewImageUri: string | null;
    previewFileOrder: number;
    isCurrentFileDecrypted: boolean;
  };
};

const Harness = forwardRef<HarnessRef, {params: Parameters<typeof usePreviewFlow>[0]}>(({params}, ref) => {
  const api = usePreviewFlow(params);

  useImperativeHandle(ref, () => ({
    openPreview: api.openPreview,
    handleDecryptPreview: api.handleDecryptPreview,
    handleExportDocument: api.handleExportDocument,
    getState: () => ({
      previewStatus: api.previewStatus,
      previewImageUri: api.previewImageUri,
      previewFileOrder: api.previewFileOrder,
      isCurrentFileDecrypted: api.isCurrentFileDecrypted,
    }),
  }));

  return null;
});

describe('usePreviewFlow', () => {
  it('opens preview by preparing document and routing to preview screen', () => {
    const setSelectedDoc = jest.fn();
    const setScreen = jest.fn();
    const ref = React.createRef<HarnessRef>();

    act(() => {
      TestRenderer.create(
        <Harness
          ref={ref}
          params={{
            selectedDoc: null,
            setSelectedDoc,
            setScreen,
            hasInternetAccess: async () => true,
            decryptDocumentPayload: jest.fn(async () => ({
              fileOrder: 0,
              fileName: 'a.jpg',
              mimeType: 'image/jpeg',
              base64: 'ZmFrZQ==',
            })),
            exportDocumentToDevice: jest.fn(async () => '/tmp/a.jpg'),
            canCurrentUserExportDocument: jest.fn(() => true),
          }}
        />,
      );
    });

    act(() => {
      ref.current?.openPreview(makeDoc());
    });

    expect(setSelectedDoc).toHaveBeenCalledWith(expect.objectContaining({id: 'doc-1'}));
    expect(setScreen).toHaveBeenCalledWith('preview');
  });

  it('blocks decrypt when no local copy and offline', async () => {
    const ref = React.createRef<HarnessRef>();

    act(() => {
      TestRenderer.create(
        <Harness
          ref={ref}
          params={{
            selectedDoc: makeDoc({references: [{source: 'firebase', name: 'a.jpg', size: 1, type: 'image/jpeg'}]}),
            setSelectedDoc: jest.fn(),
            setScreen: jest.fn(),
            hasInternetAccess: async () => false,
            decryptDocumentPayload: jest.fn(async () => ({
              fileOrder: 0,
              fileName: 'a.jpg',
              mimeType: 'image/jpeg',
              base64: 'ZmFrZQ==',
            })),
            exportDocumentToDevice: jest.fn(async () => '/tmp/a.jpg'),
            canCurrentUserExportDocument: jest.fn(() => true),
          }}
        />,
      );
    });

    await act(async () => {
      await ref.current?.handleDecryptPreview();
    });

    expect(ref.current?.getState().previewStatus).toBe('no internet access');
  });

  it('decrypts image previews and marks current file decrypted', async () => {
    const ref = React.createRef<HarnessRef>();

    act(() => {
      TestRenderer.create(
        <Harness
          ref={ref}
          params={{
            selectedDoc: makeDoc({references: [{source: 'local', name: 'a.jpg', size: 1, type: 'image/jpeg'}]}),
            setSelectedDoc: jest.fn(),
            setScreen: jest.fn(),
            hasInternetAccess: async () => true,
            decryptDocumentPayload: jest.fn(async () => ({
              fileOrder: 0,
              fileName: 'a.jpg',
              mimeType: 'image/jpeg',
              base64: 'ZmFrZQ==',
            })),
            exportDocumentToDevice: jest.fn(async () => '/tmp/a.jpg'),
            canCurrentUserExportDocument: jest.fn(() => true),
          }}
        />,
      );
    });

    await act(async () => {
      await ref.current?.handleDecryptPreview();
    });

    expect(ref.current?.getState().previewStatus).toContain('decrypted for preview');
    expect(ref.current?.getState().previewImageUri).toContain('data:image/jpeg;base64,');
    expect(ref.current?.getState().isCurrentFileDecrypted).toBe(true);
  });

  it('blocks export when document owner disallows export', async () => {
    const ref = React.createRef<HarnessRef>();

    act(() => {
      TestRenderer.create(
        <Harness
          ref={ref}
          params={{
            selectedDoc: makeDoc(),
            setSelectedDoc: jest.fn(),
            setScreen: jest.fn(),
            hasInternetAccess: async () => true,
            decryptDocumentPayload: jest.fn(async () => ({
              fileOrder: 0,
              fileName: 'a.jpg',
              mimeType: 'image/jpeg',
              base64: 'ZmFrZQ==',
            })),
            exportDocumentToDevice: jest.fn(async () => '/tmp/a.jpg'),
            canCurrentUserExportDocument: jest.fn(() => false),
          }}
        />,
      );
    });

    await act(async () => {
      await ref.current?.handleExportDocument();
    });

    expect(ref.current?.getState().previewStatus).toBe('Export is disabled by the document owner for this shared access.');
  });
});
