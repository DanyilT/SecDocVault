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
    previewVideoPath: string | null;
    previewAudioPath: string | null;
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
      previewVideoPath: api.previewVideoPath,
      previewAudioPath: api.previewAudioPath,
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

   it('handles decrypt of unsupported (office) files', async () => {
     const ref = React.createRef<HarnessRef>();

     act(() => {
       TestRenderer.create(
         <Harness
           ref={ref}
           params={{
             selectedDoc: makeDoc({references: [{source: 'local', name: 'doc.docx', size: 1, type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'}]}),
             setSelectedDoc: jest.fn(),
             setScreen: jest.fn(),
             hasInternetAccess: async () => true,
             decryptDocumentPayload: jest.fn(async () => ({
               fileOrder: 0,
               fileName: 'doc.docx',
               mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
               base64: 'ZmFrZQ==',
             })),
             exportDocumentToDevice: jest.fn(async () => '/tmp/doc.docx'),
             canCurrentUserExportDocument: jest.fn(() => true),
           }}
         />,
       );
     });

     await act(async () => {
       await ref.current?.handleDecryptPreview();
     });

     expect(ref.current?.getState().previewStatus).toContain('Use export to save it out of app');
     expect(ref.current?.getState().previewImageUri).toBeNull();
   });

   it('decrypts PDF files to a local temp file path for preview', async () => {
     const ref = React.createRef<HarnessRef>();
     const RNFS = require('react-native-fs');

     act(() => {
       TestRenderer.create(
         <Harness
           ref={ref}
           params={{
             selectedDoc: makeDoc({references: [{source: 'local', name: 'doc.pdf', size: 1, type: 'application/pdf'}]}),
             setSelectedDoc: jest.fn(),
             setScreen: jest.fn(),
             hasInternetAccess: async () => true,
             decryptDocumentPayload: jest.fn(async () => ({
               fileOrder: 0,
               fileName: 'doc.pdf',
               mimeType: 'application/pdf',
               base64: 'ZmFrZQ==',
             })),
             exportDocumentToDevice: jest.fn(async () => '/tmp/doc.pdf'),
             canCurrentUserExportDocument: jest.fn(() => true),
           }}
         />,
       );
     });

     await act(async () => {
       await ref.current?.handleDecryptPreview();
     });

     expect(RNFS.writeFile).toHaveBeenCalledWith(expect.stringContaining('preview-'), 'ZmFrZQ==', 'base64');
     expect(ref.current?.getState().previewStatus).toContain('decrypted for preview');
   });

   it('decrypts video files to a local temp file path for preview', async () => {
     const ref = React.createRef<HarnessRef>();
     const RNFS = require('react-native-fs');

     act(() => {
       TestRenderer.create(
         <Harness
           ref={ref}
           params={{
             selectedDoc: makeDoc({references: [{source: 'local', name: 'clip.mp4', size: 1, type: 'video/mp4'}]}),
             setSelectedDoc: jest.fn(),
             setScreen: jest.fn(),
             hasInternetAccess: async () => true,
             decryptDocumentPayload: jest.fn(async () => ({
               fileOrder: 0,
               fileName: 'clip.mp4',
               mimeType: 'video/mp4',
               base64: 'ZmFrZQ==',
             })),
             exportDocumentToDevice: jest.fn(async () => '/tmp/clip.mp4'),
             canCurrentUserExportDocument: jest.fn(() => true),
           }}
         />,
       );
     });

     await act(async () => {
       await ref.current?.handleDecryptPreview();
     });

     expect(RNFS.writeFile).toHaveBeenCalledWith(expect.stringContaining('preview-'), 'ZmFrZQ==', 'base64');
     expect(RNFS.writeFile).toHaveBeenCalledWith(expect.stringContaining('.mp4'), 'ZmFrZQ==', 'base64');
     expect(ref.current?.getState().previewStatus).toContain('decrypted for preview');
     expect(ref.current?.getState().previewVideoPath).toContain('.mp4');
   });

   it('decrypts audio files to a local temp file path for preview', async () => {
     const ref = React.createRef<HarnessRef>();
     const RNFS = require('react-native-fs');

     act(() => {
       TestRenderer.create(
         <Harness
           ref={ref}
           params={{
             selectedDoc: makeDoc({references: [{source: 'local', name: 'song.mp3', size: 1, type: 'audio/mpeg'}]}),
             setSelectedDoc: jest.fn(),
             setScreen: jest.fn(),
             hasInternetAccess: async () => true,
             decryptDocumentPayload: jest.fn(async () => ({
               fileOrder: 0,
               fileName: 'song.mp3',
               mimeType: 'audio/mpeg',
               base64: 'ZmFrZQ==',
             })),
             exportDocumentToDevice: jest.fn(async () => '/tmp/song.mp3'),
             canCurrentUserExportDocument: jest.fn(() => true),
           }}
         />,
       );
     });

     await act(async () => {
       await ref.current?.handleDecryptPreview();
     });

     expect(RNFS.writeFile).toHaveBeenCalledWith(expect.stringContaining('preview-'), 'ZmFrZQ==', 'base64');
     expect(RNFS.writeFile).toHaveBeenCalledWith(expect.stringContaining('.mp3'), 'ZmFrZQ==', 'base64');
     expect(ref.current?.getState().previewStatus).toContain('decrypted for preview');
     expect(ref.current?.getState().previewAudioPath).toContain('.mp3');
   });

   it('caches decrypted preview and returns cached value on select', async () => {
     const ref = React.createRef<HarnessRef>();
     const decryptFn = jest.fn(async () => ({
       fileOrder: 0,
       fileName: 'a.jpg',
       mimeType: 'image/jpeg',
       base64: 'ZmFrZQ==',
     }));

     act(() => {
       TestRenderer.create(
         <Harness
           ref={ref}
           params={{
             selectedDoc: makeDoc({references: [{source: 'local', name: 'a.jpg', size: 1, type: 'image/jpeg'}]}),
             setSelectedDoc: jest.fn(),
             setScreen: jest.fn(),
             hasInternetAccess: async () => true,
             decryptDocumentPayload: decryptFn,
             exportDocumentToDevice: jest.fn(async () => '/tmp/a.jpg'),
             canCurrentUserExportDocument: jest.fn(() => true),
           }}
         />,
       );
     });

     // First decrypt
     await act(async () => {
       await ref.current?.handleDecryptPreview();
     });

     expect(decryptFn).toHaveBeenCalledTimes(1);

     // Re-decrypt same file should use cache
     await act(async () => {
       await ref.current?.handleDecryptPreview();
     });

     expect(decryptFn).toHaveBeenCalledTimes(1);
   });

   it('handles successful export', async () => {
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
             exportDocumentToDevice: jest.fn(async () => '/storage/emulated/0/Download/a.jpg'),
             canCurrentUserExportDocument: jest.fn(() => true),
           }}
         />,
       );
     });

     await act(async () => {
       await ref.current?.handleExportDocument();
     });

     expect(ref.current?.getState().previewStatus).toContain('Document exported to');
   });

   it('handles export error', async () => {
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
             exportDocumentToDevice: jest.fn(async () => {
               throw new Error('Export failed');
             }),
             canCurrentUserExportDocument: jest.fn(() => true),
           }}
         />,
       );
     });

     await act(async () => {
       await ref.current?.handleExportDocument();
     });

     expect(ref.current?.getState().previewStatus).toBe('Export failed');
   });

   it('handles decrypt error', async () => {
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
             decryptDocumentPayload: jest.fn(async () => {
               throw new Error('Decryption failed');
             }),
             exportDocumentToDevice: jest.fn(async () => '/tmp/a.jpg'),
             canCurrentUserExportDocument: jest.fn(() => true),
           }}
         />,
       );
     });

     await act(async () => {
       await ref.current?.handleDecryptPreview();
     });

     expect(ref.current?.getState().previewStatus).toBe('Decryption failed');
   });

   it('calls onMissingPassphrase when decryption fails with MissingKdfPassphraseError', async () => {
     const { MissingKdfPassphraseError } = require('../../../src/services/crypto/documentCrypto');
     const ref = React.createRef<HarnessRef>();
     const onMissingPassphrase = jest.fn();

     act(() => {
       TestRenderer.create(
         <Harness
           ref={ref}
           params={{
             selectedDoc: makeDoc(),
             setSelectedDoc: jest.fn(),
             setScreen: jest.fn(),
             hasInternetAccess: async () => true,
             decryptDocumentPayload: jest.fn(async () => {
               throw new MissingKdfPassphraseError('No passphrase');
             }),
             exportDocumentToDevice: jest.fn(async () => '/tmp/a.jpg'),
             canCurrentUserExportDocument: jest.fn(() => true),
             onMissingPassphrase,
           }}
         />,
       );
     });

     await act(async () => {
       await ref.current?.handleDecryptPreview();
     });

     expect(onMissingPassphrase).toHaveBeenCalled();
   });

   it('calls onMissingPassphrase when export fails with MissingKdfPassphraseError', async () => {
     const { MissingKdfPassphraseError } = require('../../../src/services/crypto/documentCrypto');
     const ref = React.createRef<HarnessRef>();
     const onMissingPassphrase = jest.fn();

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
             exportDocumentToDevice: jest.fn(async () => {
               throw new MissingKdfPassphraseError('No passphrase');
             }),
             canCurrentUserExportDocument: jest.fn(() => true),
             onMissingPassphrase,
           }}
         />,
       );
     });

     await act(async () => {
       await ref.current?.handleExportDocument();
     });

     expect(onMissingPassphrase).toHaveBeenCalled();
   });
});
