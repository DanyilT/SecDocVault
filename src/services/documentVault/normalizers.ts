export function normalizeDescription(value?: string) {
  return value?.trim() ?? '';
}

export function normalizeDocumentName(value?: string) {
  const normalized = value?.trim();
  return normalized && normalized.length > 0 ? normalized : 'Document';
}
