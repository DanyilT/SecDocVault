import { useRef, useState } from 'react';

import { VaultDocument } from '../../types/vault';

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
};

export function usePreviewFlow({
  selectedDoc,
  setSelectedDoc,
  setScreen,
  hasInternetAccess,
  decryptDocumentPayload,
  exportDocumentToDevice,
  canCurrentUserExportDocument,
}: UsePreviewFlowParams) {
  const [previewImageUri, setPreviewImageUri] = useState<string | null>(null);
  const [previewStatus, setPreviewStatus] = useState('');
  const [previewFileOrder, setPreviewFileOrder] = useState(0);
  const [isPreviewDecrypting, setIsPreviewDecrypting] = useState(false);
  const previewDecryptCacheRef = useRef(
    new Map<string, {previewImageUri: string | null; previewStatus: string}>(),
  );

  const preparePreviewForDocument = (doc: VaultDocument) => {
    previewDecryptCacheRef.current.clear();
    setSelectedDoc(doc);
    setPreviewFileOrder(0);
    setPreviewImageUri(null);
    setPreviewStatus('');
    setIsPreviewDecrypting(false);
  };

  const openPreview = (doc: VaultDocument) => {
    preparePreviewForDocument(doc);
    setScreen('preview');
  };

  const handleSelectPreviewFile = (order: number) => {
    setPreviewFileOrder(order);
    setIsPreviewDecrypting(false);
    const cachedPreview = previewDecryptCacheRef.current.get(`${selectedDoc?.id ?? ''}:${order}`);
    if (cachedPreview) {
      setPreviewImageUri(cachedPreview.previewImageUri);
      setPreviewStatus(cachedPreview.previewStatus);
      return;
    }

    setPreviewImageUri(null);
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
      setPreviewImageUri(cachedPreview.previewImageUri);
      setPreviewStatus(cachedPreview.previewStatus);
      return;
    }

    try {
      setIsPreviewDecrypting(true);
      setPreviewStatus('');
      const decrypted = await decryptDocumentPayload(selectedDoc, previewFileOrder);
      const nextStatus = decrypted.mimeType.startsWith('image/')
        ? `File #${decrypted.fileOrder} decrypted for preview.`
        : `Decrypted ${decrypted.fileName}. Use export to save it out of app.`;

      if (decrypted.mimeType.startsWith('image/')) {
        const imageUri = `data:${decrypted.mimeType};base64,${decrypted.base64}`;
        setPreviewImageUri(imageUri);
        setPreviewStatus(nextStatus);
        previewDecryptCacheRef.current.set(cacheKey, {
          previewImageUri: imageUri,
          previewStatus: nextStatus,
        });
      } else {
        setPreviewImageUri(null);
        setPreviewStatus(nextStatus);
        previewDecryptCacheRef.current.set(cacheKey, {
          previewImageUri: null,
          previewStatus: nextStatus,
        });
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to decrypt document.';
      setPreviewStatus(message);
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
      const message = error instanceof Error ? error.message : 'Export failed.';
      setPreviewStatus(message);
    }
  };

  const isCurrentFileDecrypted = selectedDoc
    ? previewDecryptCacheRef.current.has(`${selectedDoc.id}:${previewFileOrder}`)
    : false;

  return {
    previewImageUri,
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
