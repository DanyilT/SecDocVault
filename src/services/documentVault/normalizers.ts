/**
 * services/documentVault/normalizers.ts
 *
 * Small input validation and normalization helpers for document metadata —
 * e.g. document names and descriptions. These keep UI layer code concise and
 * ensure consistent defaults across the app.
 */

export function normalizeDescription(value?: string) {
  return value?.trim() ?? '';
}

export function normalizeDocumentName(value?: string) {
  const normalized = value?.trim();
  return normalized && normalized.length > 0 ? normalized : 'Document';
}
