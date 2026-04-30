/**
 * services/censor/ocr.ts
 *
 * ML Kit wrapper + JPEG/PNG header parser.
 *
 * - Lazy-loads @react-native-ml-kit/text-recognition so unit tests never need
 *   to mock the native module (mock ./ocr instead).
 * - Parses JPEG/PNG binary headers to obtain true source-pixel dimensions,
 *   which ML Kit uses for bounding boxes, instead of the decoded-bitmap dims
 *   that Image.getSize() may return on Android.
 * - Handles EXIF orientation 5-8 (swap width/height for 90°/270° rotations).
 * - Always resolves; never rejects.
 */

import { Image } from 'react-native';
import RNFS from 'react-native-fs';

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

export type OcrBox = { x: number; y: number; width: number; height: number };
export type OcrWord = { text: string; box: OcrBox };
export type OcrLine = { text: string; box: OcrBox; words: OcrWord[] };
export type OcrBlock = { text: string; box: OcrBox; lines: OcrLine[] };
export type OcrResult = {
  imageWidth: number;
  imageHeight: number;
  lines: OcrLine[];
  blocks: OcrBlock[];
  debug?: {
    moduleAvailable: boolean;
    rawTextLength: number;
    rawText?: string;
    error?: string;
  };
};

// ---------------------------------------------------------------------------
// ML Kit lazy-loader
// ---------------------------------------------------------------------------

let _mlKit: { recognize: (uri: string) => Promise<unknown> } | null | undefined;

function loadMlKit(): { recognize: (uri: string) => Promise<unknown> } | null {
  if (_mlKit !== undefined) {
    return _mlKit;
  }
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const mod = require('@react-native-ml-kit/text-recognition');
    const candidate = mod?.default ?? mod;
    if (candidate && typeof candidate.recognize === 'function') {
      _mlKit = candidate as { recognize: (uri: string) => Promise<unknown> };
      return _mlKit;
    }
  } catch {
    /* not installed (e.g. tests) */
  }
  _mlKit = null;
  return null;
}

// ---------------------------------------------------------------------------
// Base64 → Uint8Array (no Buffer / atob — unreliable in RN)
// ---------------------------------------------------------------------------

const B64_CHARS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
const B64_TABLE: Record<string, number> = {};
for (let i = 0; i < B64_CHARS.length; i++) {
  B64_TABLE[B64_CHARS[i]] = i;
}

function base64ToBytes(b64: string): Uint8Array {
  const s = b64.replace(/[^A-Za-z0-9+/]/g, '');
  const len = (s.length * 3) >> 2;
  const out = new Uint8Array(len);
  let idx = 0;
  for (let i = 0; i < s.length; i += 4) {
    const c0 = B64_TABLE[s[i]] ?? 0;
    const c1 = B64_TABLE[s[i + 1]] ?? 0;
    const c2 = B64_TABLE[s[i + 2]] ?? 0;
    const c3 = B64_TABLE[s[i + 3]] ?? 0;
    const triplet = (c0 << 18) | (c1 << 12) | (c2 << 6) | c3;
    if (idx < len) {
      out[idx++] = (triplet >> 16) & 0xff;
    }
    if (idx < len) {
      out[idx++] = (triplet >> 8) & 0xff;
    }
    if (idx < len) {
      out[idx++] = triplet & 0xff;
    }
  }
  return out;
}

// ---------------------------------------------------------------------------
// Helper: 16-bit big-endian read
// ---------------------------------------------------------------------------
function readU16BE(bytes: Uint8Array, offset: number): number {
  return ((bytes[offset] ?? 0) << 8) | (bytes[offset + 1] ?? 0);
}

// ---------------------------------------------------------------------------
// Helper: 32-bit big-endian read
// ---------------------------------------------------------------------------
function readU32BE(bytes: Uint8Array, offset: number): number {
  return (
    (((bytes[offset] ?? 0) << 24) |
      ((bytes[offset + 1] ?? 0) << 16) |
      ((bytes[offset + 2] ?? 0) << 8) |
      (bytes[offset + 3] ?? 0)) >>>
    0
  );
}

// ---------------------------------------------------------------------------
// Helper: 16-bit read respecting byte order (LE or BE)
// ---------------------------------------------------------------------------
function readU16(bytes: Uint8Array, offset: number, littleEndian: boolean): number {
  if (littleEndian) {
    return ((bytes[offset + 1] ?? 0) << 8) | (bytes[offset] ?? 0);
  }
  return readU16BE(bytes, offset);
}

// ---------------------------------------------------------------------------
// Helper: 32-bit read respecting byte order
// ---------------------------------------------------------------------------
function readU32(bytes: Uint8Array, offset: number, littleEndian: boolean): number {
  if (littleEndian) {
    return (
      (((bytes[offset + 3] ?? 0) << 24) |
        ((bytes[offset + 2] ?? 0) << 16) |
        ((bytes[offset + 1] ?? 0) << 8) |
        (bytes[offset] ?? 0)) >>>
      0
    );
  }
  return readU32BE(bytes, offset);
}

// ---------------------------------------------------------------------------
// readPixelDimensionsFromFile
// ---------------------------------------------------------------------------

/**
 * Parse the JPEG or PNG binary header to get true source-pixel dimensions.
 *
 * Returns { width: 0, height: 0 } on any failure so the caller can fall back
 * to Image.getSize().
 *
 * EXIF orientation 5-8 (90°/270° rotations) → swap width & height so the
 * returned values match the visually-displayed orientation.
 */
export async function readPixelDimensionsFromFile(
  fileUri: string,
): Promise<{ width: number; height: number }> {
  const fallback = { width: 0, height: 0 };
  try {
    const path = fileUri.replace(/^file:\/\//, '');
    // Read first 64 KiB — enough for JPEG SOF + APP1 EXIF block
    const b64 = await RNFS.read(path, 65536, 0, 'base64');
    const bytes = base64ToBytes(b64);

    // -----------------------------------------------------------------------
    // PNG: 8-byte signature + IHDR chunk
    // Signature: 89 50 4E 47 0D 0A 1A 0A
    // IHDR layout: [length 4B][type "IHDR"][width 4B][height 4B]...
    //              offset 0       4          8          12
    // -----------------------------------------------------------------------
    if (
      bytes[0] === 0x89 &&
      bytes[1] === 0x50 &&
      bytes[2] === 0x4e &&
      bytes[3] === 0x47 &&
      bytes[4] === 0x0d &&
      bytes[5] === 0x0a &&
      bytes[6] === 0x1a &&
      bytes[7] === 0x0a
    ) {
      const width = readU32BE(bytes, 16);
      const height = readU32BE(bytes, 20);
      if (width > 0 && height > 0) {
        return { width, height };
      }
      return fallback;
    }

    // -----------------------------------------------------------------------
    // JPEG: FF D8 SOI
    // -----------------------------------------------------------------------
    if (bytes[0] !== 0xff || bytes[1] !== 0xd8) {
      return fallback;
    }

    let sofWidth = 0;
    let sofHeight = 0;
    let exifOrientation = 1; // default: normal
    let i = 2; // start after SOI

    while (i < bytes.length - 3) {
      if (bytes[i] !== 0xff) {
        // Lost sync — bail
        break;
      }
      const marker = bytes[i + 1] ?? 0;
      // Skip any extra 0xFF padding bytes
      if (marker === 0xff) {
        i += 1;
        continue;
      }

      // Markers with no length field: SOI(0xD8), EOI(0xD9), standalone 0xFF
      if (marker === 0xd8 || marker === 0xd9) {
        i += 2;
        continue;
      }

      const segLen = readU16BE(bytes, i + 2); // includes the 2 length bytes
      const segStart = i + 2; // points at length bytes
      const segDataStart = segStart + 2; // actual data begins here

      // SOF markers: 0xC0..0xCF, except DHT(0xC4), JPG(0xC8), DAC(0xCC)
      if (
        marker >= 0xc0 &&
        marker <= 0xcf &&
        marker !== 0xc4 &&
        marker !== 0xc8 &&
        marker !== 0xcc
      ) {
        // SOF: [precision 1B][height 2B][width 2B]
        sofHeight = readU16BE(bytes, segDataStart + 1);
        sofWidth = readU16BE(bytes, segDataStart + 3);
      }

      // APP1 (0xE1) — may be EXIF
      if (marker === 0xe1 && segLen >= 8) {
        // "Exif\0\0" ASCII check at segDataStart
        if (
          bytes[segDataStart] === 0x45 &&
          bytes[segDataStart + 1] === 0x78 &&
          bytes[segDataStart + 2] === 0x69 &&
          bytes[segDataStart + 3] === 0x66 &&
          bytes[segDataStart + 4] === 0x00 &&
          bytes[segDataStart + 5] === 0x00
        ) {
          const tiffBase = segDataStart + 6;
          // Byte order: "II" = little-endian, "MM" = big-endian
          const isLE =
            bytes[tiffBase] === 0x49 && bytes[tiffBase + 1] === 0x49;
          // 2-byte TIFF magic (0x002A) + 4-byte IFD offset
          const ifdOffset = readU32(bytes, tiffBase + 4, isLE);
          const ifdAbs = tiffBase + ifdOffset;

          if (ifdAbs + 2 < bytes.length) {
            const entryCount = readU16(bytes, ifdAbs, isLE);
            for (let e = 0; e < entryCount; e++) {
              const entryAbs = ifdAbs + 2 + e * 12;
              if (entryAbs + 12 > bytes.length) {
                break;
              }
              const tag = readU16(bytes, entryAbs, isLE);
              if (tag === 0x0112) {
                // Orientation tag
                exifOrientation = readU16(bytes, entryAbs + 8, isLE);
                break;
              }
            }
          }
        }
      }

      i = segStart + segLen; // advance to next segment
    }

    if (sofWidth > 0 && sofHeight > 0) {
      // EXIF orientations 5-8 mean 90°/270° rotation → swap dims
      if (exifOrientation >= 5 && exifOrientation <= 8) {
        return { width: sofHeight, height: sofWidth };
      }
      return { width: sofWidth, height: sofHeight };
    }

    return fallback;
  } catch {
    return fallback;
  }
}

// ---------------------------------------------------------------------------
// ensureFileUri — materialise data: URIs to a temp file for ML Kit
// ---------------------------------------------------------------------------

async function ensureFileUri(imageUri: string): Promise<string> {
  if (!imageUri.startsWith('data:')) {
    return imageUri;
  }
  // data:[<mediatype>][;base64],<data>
  const commaIdx = imageUri.indexOf(',');
  const header = imageUri.slice(5, commaIdx); // after "data:"
  const base64 = imageUri.slice(commaIdx + 1);
  const ext = header.includes('png') ? 'png' : 'jpg';
  const tmpPath = `${RNFS.CachesDirectoryPath}/censor-${Date.now()}.${ext}`;
  await RNFS.writeFile(tmpPath, base64, 'base64');
  return `file://${tmpPath}`;
}

// ---------------------------------------------------------------------------
// frameToBox helper
// ---------------------------------------------------------------------------

function frameToBox(frame: {
  left?: number;
  top?: number;
  width?: number;
  height?: number;
  origin?: { x?: number; y?: number };
  size?: { width?: number; height?: number };
}): OcrBox {
  // ML Kit Android uses { left, top, width, height }; iOS may use origin/size
  const x = frame.left ?? frame.origin?.x ?? 0;
  const y = frame.top ?? frame.origin?.y ?? 0;
  const width = frame.width ?? frame.size?.width ?? 0;
  const height = frame.height ?? frame.size?.height ?? 0;
  return { x, y, width, height };
}

// ---------------------------------------------------------------------------
// recognizeText — main public function
// ---------------------------------------------------------------------------

/**
 * Run on-device OCR over `imageUri` (file:// or data: URI).
 *
 * Always resolves. On failure returns empty lines/blocks with debug.error set.
 */
export async function recognizeText(imageUri: string): Promise<OcrResult> {
  const mlKit = loadMlKit();

  // No module available — return empty result but still report image dims
  if (!mlKit) {
    const dims = await new Promise<{ width: number; height: number }>(resolve => {
      Image.getSize(
        imageUri,
        (w, h) => resolve({ width: w, height: h }),
        () => resolve({ width: 0, height: 0 }),
      );
    });
    return {
      imageWidth: dims.width,
      imageHeight: dims.height,
      lines: [],
      blocks: [],
      debug: { moduleAvailable: false, rawTextLength: 0 },
    };
  }

  let fileUri = imageUri;
  let writeError: string | undefined;

  try {
    fileUri = await ensureFileUri(imageUri);
  } catch (err) {
    writeError = String(err);
  }

  try {
    // Run all three concurrently
    const [imageSizeDims, pixelDims, rawResult] = await Promise.all([
      new Promise<{ width: number; height: number }>(resolve => {
        Image.getSize(
          fileUri,
          (w, h) => resolve({ width: w, height: h }),
          () => resolve({ width: 0, height: 0 }),
        );
      }),
      readPixelDimensionsFromFile(fileUri),
      mlKit.recognize(fileUri),
    ]);

    // Build typed OCR tree
    const raw = rawResult as {
      blocks?: Array<{
        text?: string;
        frame?: object;
        lines?: Array<{
          text?: string;
          frame?: object;
          elements?: Array<{ text?: string; frame?: object }>;
        }>;
      }>;
      text?: string;
    };

    const blocks: OcrBlock[] = (raw.blocks ?? []).map(rawBlock => {
      const blockLines: OcrLine[] = (rawBlock.lines ?? []).map(rawLine => {
        const words: OcrWord[] = (rawLine.elements ?? []).map(el => ({
          text: el.text ?? '',
          box: frameToBox(el.frame as Parameters<typeof frameToBox>[0] ?? {}),
        }));
        return {
          text: rawLine.text ?? '',
          box: frameToBox(rawLine.frame as Parameters<typeof frameToBox>[0] ?? {}),
          words,
        };
      });
      return {
        text: rawBlock.text ?? '',
        box: frameToBox(rawBlock.frame as Parameters<typeof frameToBox>[0] ?? {}),
        lines: blockLines,
      };
    });

    // Flatten all lines for top-level lines array
    const lines: OcrLine[] = blocks.flatMap(b => b.lines);

    // Determine best image dimensions:
    // Priority: (1) true pixel dims from header → (2) Image.getSize → (3) max-extent of OCR boxes
    let imageWidth = pixelDims.width || imageSizeDims.width;
    let imageHeight = pixelDims.height || imageSizeDims.height;

    if (imageWidth === 0 || imageHeight === 0) {
      // Last-ditch: compute from box extents
      for (const line of lines) {
        imageWidth = Math.max(imageWidth, line.box.x + line.box.width);
        imageHeight = Math.max(imageHeight, line.box.y + line.box.height);
      }
    }

    const rawText = raw.text ?? lines.map(l => l.text).join('\n');

    return {
      imageWidth,
      imageHeight,
      lines,
      blocks,
      debug: {
        moduleAvailable: true,
        rawTextLength: rawText.length,
        rawText,
        error: writeError,
      },
    };
  } catch (err) {
    return {
      imageWidth: 0,
      imageHeight: 0,
      lines: [],
      blocks: [],
      debug: {
        moduleAvailable: true,
        rawTextLength: 0,
        error: String(err),
      },
    };
  }
}

