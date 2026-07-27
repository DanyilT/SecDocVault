/**
 * app/hooks/usePreviewFlow.ts
 *
 * Implements preview-related logic: choosing a file within a document to
 * decrypt, preparing temporary URIs for display and orchestrating document
 * export/decrypt operations. This hook is intentionally thin and delegates
 * crypto/storage operations to service functions.
 */

import { useRef, useState } from 'react';
import { Buffer } from 'buffer';
import RNFS from 'react-native-fs';

import { MissingKdfPassphraseError } from '../../services/crypto/documentCrypto';
import { canPreviewInApp, getFileCategory } from '../../utils/fileType';
import { VaultDocument } from '../../types/vault';

type PreviewCacheEntry = {
  previewImageUri: string | null;
  previewPdfPath: string | null;
  previewText: string | null;
  previewStatus: string;
};

type UsePreviewFlowParams = {
  selectedDoc: VaultDocument | null;
  setSelectedDoc: (doc: VaultDocument | null) => void;
  setScreen: (screen: 'preview') => void;
  hasInternetAccess: () => Promise<boolean>;
  decryptDocumentPayload: (doc: VaultDocument, fileOrder: number) => Promise<{
    fileOrder: number;
    fileName: string;
    mimeType: string;
    base64: string;
  }>;
  exportDocumentToDevice: (doc: VaultDocument, fileOrder: number) => Promise<string>;
  canCurrentUserExportDocument: (doc: VaultDocument) => boolean;
  onMissingPassphrase?: () => void;
};

export function usePreviewFlow({
  selectedDoc,
  setSelectedDoc,
  setScreen,
  hasInternetAccess,
  decryptDocumentPayload,
  exportDocumentToDevice,
  canCurrentUserExportDocument,
  onMissingPassphrase,
}: UsePreviewFlowParams) {
  const [previewImageUri, setPreviewImageUri] = useState<string | null>(null);
  const [previewPdfPath, setPreviewPdfPath] = useState<string | null>(null);
  const [previewText, setPreviewText] = useState<string | null>(null);
  const [previewStatus, setPreviewStatus] = useState('');
  const [previewFileOrder, setPreviewFileOrder] = useState(0);
  const [isPreviewDecrypting, setIsPreviewDecrypting] = useState(false);
  const previewDecryptCacheRef = useRef(new Map<string, PreviewCacheEntry>());

  const clearPreviewOutputs = () => {
    setPreviewImageUri(null);
    setPreviewPdfPath(null);
    setPreviewText(null);
  };

  const preparePreviewForDocument = (doc: VaultDocument) => {
    previewDecryptCacheRef.current.clear();
    setSelectedDoc(doc);
    setPreviewFileOrder(0);
    clearPreviewOutputs();
    setPreviewStatus('');
    setIsPreviewDecrypting(false);
  };

  const openPreview = (doc: VaultDocument) => {
    preparePreviewForDocument(doc);
    setScreen('preview');
  };

  const applyCacheEntry = (entry: PreviewCacheEntry) => {
    setPreviewImageUri(entry.previewImageUri);
    setPreviewPdfPath(entry.previewPdfPath);
    setPreviewText(entry.previewText);
    setPreviewStatus(entry.previewStatus);
  };

  const handleSelectPreviewFile = (order: number) => {
    setPreviewFileOrder(order);
    setIsPreviewDecrypting(false);
    const cachedPreview = previewDecryptCacheRef.current.get(`${selectedDoc?.id ?? ''}:${order}`);
    if (cachedPreview) {
      applyCacheEntry(cachedPreview);
      return;
    }

    clearPreviewOutputs();
    setPreviewStatus('');
  };

  const handleDecryptPreview = async () => {
    if (!selectedDoc) {
      setPreviewStatus('No document selected.');
      return;
    }

    const hasLocalReference = Boolean(selectedDoc.references?.some(reference => reference.source === 'local'));
    if (!hasLocalReference && !(await hasInternetAccess())) {
      setPreviewStatus('no internet access');
      return;
    }

    const cacheKey = `${selectedDoc.id}:${previewFileOrder}`;
    const cachedPreview = previewDecryptCacheRef.current.get(cacheKey);
    if (cachedPreview) {
      applyCacheEntry(cachedPreview);
      return;
    }

    try {
      setIsPreviewDecrypting(true);
      setPreviewStatus('');
      const decrypted = await decryptDocumentPayload(selectedDoc, previewFileOrder);
      const category = getFileCategory(decrypted.mimeType);

      let cacheEntry: PreviewCacheEntry;

      if (!canPreviewInApp(decrypted.mimeType)) {
        cacheEntry = {
          previewImageUri: null,
          previewPdfPath: null,
          previewText: null,
          previewStatus: `Decrypted ${decrypted.fileName}. Use export to save it out of app.`,
        };
      } else if (category === 'image') {
        cacheEntry = {
          previewImageUri: `data:${decrypted.mimeType};base64,${decrypted.base64}`,
          previewPdfPath: null,
          previewText: null,
          previewStatus: `File #${decrypted.fileOrder} decrypted for preview.`,
        };
      } else if (category === 'pdf') {
        const tmpPath = `${RNFS.CachesDirectoryPath}/preview-${Date.now()}.pdf`;
        await RNFS.writeFile(tmpPath, decrypted.base64, 'base64');
        cacheEntry = {
          previewImageUri: null,
          previewPdfPath: `file://${tmpPath}`,
          previewText: null,
          previewStatus: `File #${decrypted.fileOrder} decrypted for preview.`,
        };
      } else {
        cacheEntry = {
          previewImageUri: null,
          previewPdfPath: null,
          previewText: Buffer.from(decrypted.base64, 'base64').toString('utf8'),
          previewStatus: `File #${decrypted.fileOrder} decrypted for preview.`,
        };
      }

      applyCacheEntry(cacheEntry);
      previewDecryptCacheRef.current.set(cacheKey, cacheEntry);
    } catch (error) {
      if (error instanceof MissingKdfPassphraseError) {
        onMissingPassphrase?.();
      } else {
        const message = error instanceof Error ? error.message : 'Failed to decrypt document.';
        setPreviewStatus(message);
      }
    } finally {
      setIsPreviewDecrypting(false);
    }
  };

  const handleExportDocument = async () => {
    if (!selectedDoc) {
      setPreviewStatus('No document selected.');
      return;
    }

    if (!canCurrentUserExportDocument(selectedDoc)) {
      setPreviewStatus('Export is disabled by the document owner for this shared access.');
      return;
    }

    try {
      setPreviewStatus('Exporting document...');
      const path = await exportDocumentToDevice(selectedDoc, previewFileOrder);
      setPreviewStatus(`Document exported to ${path}`);
    } catch (error) {
      if (error instanceof MissingKdfPassphraseError) {
        onMissingPassphrase?.();
      } else {
        const message = error instanceof Error ? error.message : 'Export failed.';
        setPreviewStatus(message);
      }
    }
  };

  const isCurrentFileDecrypted = selectedDoc
    ? previewDecryptCacheRef.current.has(`${selectedDoc.id}:${previewFileOrder}`)
    : false;

  return {
    previewImageUri,
    previewPdfPath,
    previewText,
    previewStatus,
    previewFileOrder,
    isPreviewDecrypting,
    isCurrentFileDecrypted,
    setPreviewFileOrder,
    preparePreviewForDocument,
    openPreview,
    handleSelectPreviewFile,
    handleDecryptPreview,
    handleExportDocument,
  };
}
