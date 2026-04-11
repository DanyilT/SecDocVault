import { Buffer } from 'buffer';

import { VaultDocumentReference } from '../../types/vault';
import { UploadableDocument } from './types';

export function normalizeDocumentKeyB64(value: string | null | undefined) {
  const input = value?.trim();
  if (!input) {
    return null;
  }

  if (/^[A-Fa-f0-9]{64}$/.test(input)) {
    return Buffer.from(input, 'hex').toString('base64');
  }

  const base64Like = /^[A-Za-z0-9+/]+={0,2}$/.test(input) && input.length % 4 === 0;
  if (base64Like) {
    const bytes = Buffer.from(input, 'base64');
    if (bytes.length === 32) {
      return bytes.toString('base64');
    }
  }

  const utf8Bytes = Buffer.from(input, 'utf8');
  if (utf8Bytes.length === 32) {
    return utf8Bytes.toString('base64');
  }

  return null;
}

export function toHashLabel(hashHex?: string) {
  if (!hashHex) {
    return 'AES-GCM tag unavailable';
  }
  return `AES-GCM ${hashHex.slice(0, 16)}...`;
}

export function resolveIntegrityTag(reference?: VaultDocumentReference) {
  return reference?.integrityTag ?? reference?.fileHash;
}

export function sortReferencesByOrder(references: VaultDocumentReference[] = []) {
  return [...references].sort((a, b) => {
    const left = a.order ?? 0;
    const right = b.order ?? 0;
    return left - right;
  });
}

export function normalizeReferenceOrder(references: VaultDocumentReference[] = []) {
  return sortReferencesByOrder(references).map((reference, index) => ({
    ...reference,
    order: reference.order ?? index,
  }));
}

/**
 * Formats bytes into a compact human-readable size string.
 *
 * @param sizeInBytes - Byte count.
 * @returns `B`, `KB`, or `MB` string with one decimal place where applicable.
 */
export function toSizeLabel(sizeInBytes: number): string {
  if (sizeInBytes < 1024) {
    return `${sizeInBytes} B`;
  }
  if (sizeInBytes < 1024 * 1024) {
    return `${(sizeInBytes / 1024).toFixed(1)} KB`;
  }
  return `${(sizeInBytes / (1024 * 1024)).toFixed(1)} MB`;
}

/**
 * Creates a deterministic display hash from basic file metadata.
 *
 * Note: This is a lightweight pseudo-hash for UI display and is not equivalent
 * to a cryptographic SHA-256 over file contents.
 *
 * @param files - List of document files.
 * @returns A hash-like label prefixed with `SHA-256`.
 */
export function toPseudoHash(files: UploadableDocument[]): string {
  const raw = files
    .map((file, index) => `${index}:${file.name}:${file.size}:${file.type}`)
    .join('|');
  let hash = 0;
  for (let i = 0; i < raw.length; i += 1) {
    hash = (hash << 5) - hash + raw.charCodeAt(i);
    hash |= 0;
  }
  return `SHA-256 ${Math.abs(hash).toString(16).padStart(12, '0')}...`;
}
