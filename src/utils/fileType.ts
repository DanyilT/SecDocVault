/**
 * utils/fileType.ts
 *
 * Centralizes MIME-type-based classification used across the upload and
 * preview flows so file-type checks (image vs. PDF vs. office vs. text)
 * live in one place instead of scattered `mimeType.startsWith(...)` checks.
 */

import {
  DocumentIcon,
  DocumentTextIcon,
  FilmIcon,
  MusicalNoteIcon,
  PhotoIcon,
  PresentationChartBarIcon,
  TableCellsIcon,
} from 'react-native-heroicons/solid';

export type FileCategory = 'image' | 'pdf' | 'office' | 'text' | 'audio' | 'video' | 'unknown';

export type FileIconComponent = typeof DocumentIcon;

/**
 * Classifies a MIME type into a broad category used to decide how a file
 * can be previewed and which icon represents it.
 *
 * @param mimeType - MIME type string (e.g. `image/jpeg`, `application/pdf`).
 * @returns The matched {@link FileCategory}, or `'unknown'` if unrecognized.
 */
export function getFileCategory(mimeType: string | null | undefined): FileCategory {
  const type = mimeType ?? '';
  if (type.startsWith('image/')) return 'image';
  if (type === 'application/pdf') return 'pdf';
  if (type.startsWith('text/')) return 'text';
  if (type.includes('wordprocessingml') || type === 'application/msword') return 'office';
  if (type.includes('spreadsheetml') || type === 'application/vnd.ms-excel') return 'office';
  if (type.includes('presentationml') || type.includes('powerpoint')) return 'office';
  if (type.startsWith('audio/')) return 'audio';
  if (type.startsWith('video/')) return 'video';
  return 'unknown';
}

/**
 * Returns the heroicons component that best represents a given MIME type.
 *
 * @param mimeType - MIME type string.
 * @returns A heroicons solid icon component.
 */
export function getFileIcon(mimeType: string | null | undefined): FileIconComponent {
  const type = mimeType ?? '';
  const category = getFileCategory(type);
  switch (category) {
    case 'image':
      return PhotoIcon;
    case 'pdf':
      return DocumentTextIcon;
    case 'office':
      if (type.includes('sheet') || type.includes('excel')) return TableCellsIcon;
      if (type.includes('presentation') || type.includes('powerpoint')) return PresentationChartBarIcon;
      return DocumentTextIcon;
    case 'text':
      return DocumentTextIcon;
    case 'audio':
      return MusicalNoteIcon;
    case 'video':
      return FilmIcon;
    default:
      return DocumentIcon;
  }
}

/**
 * Whether the app can render an in-app preview for this MIME type. Office
 * documents fall back to export/open-externally instead of an in-app viewer.
 *
 * @param mimeType - MIME type string.
 * @returns true if the app can render a preview for this MIME type.
 */
export function canPreviewInApp(mimeType: string | null | undefined): boolean {
  const category = getFileCategory(mimeType);
  return (
    category === 'image' ||
    category === 'pdf' ||
    category === 'text' ||
    category === 'audio' ||
    category === 'video'
  );
}
