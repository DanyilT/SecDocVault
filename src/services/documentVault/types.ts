import { VaultDocument } from '../../types/vault';

/**
 * Normalized document object used by the upload pipeline.
 */
export type UploadableDocument = {
  /** Local file URI returned by image picker/camera. */
  uri: string;
  /** User-visible file name. */
  name: string;
  /** Optional user description for the document. */
  description?: string;
  /** File size in bytes. */
  size: number;
  /** MIME type (e.g. image/jpeg). */
  type: string;
};

export type UploadableDocumentDraft = {
  /** User-visible document title. */
  name: string;
  /** Optional user description for the document. */
  description?: string;
  /** One or more files attached to this document. */
  files: UploadableDocument[];
};

/**
 * Result returned to UI after upload completes.
 */
export type VaultUploadResult = {
  document: VaultDocument;
  timings?: {
    totalMs: number;
    byFile: Array<{
      index: number;
      readMs: number;
      encryptMs: number;
      uploadMs: number;
      localSaveMs: number;
      totalMs: number;
    }>;
  };
};

export type UploadProgressEvent = {
  fileIndex: number;
  fileName: string;
  stage: 'read' | 'encrypt' | 'upload' | 'localSave' | 'done';
  status: 'start' | 'progress' | 'end';
  progress?: number;
  elapsedMs?: number;
};
