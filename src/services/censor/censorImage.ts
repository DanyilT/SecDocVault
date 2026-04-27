/**
 * services/censor/censorImage.ts
 *
 * Orchestrator: runs OCR, detects sensitive spans in each line / multi-line
 * block, maps each span back to the union of word bounding boxes, and returns
 * deduped CensorBox coordinates in source-pixel space.
 */

import { detectSensitiveSpans, SensitiveCategory } from './detectors';
import { OcrLine, recognizeText } from './ocr';

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

export type CensorBox = {
  x: number;
  y: number;
  width: number;
  height: number;
  category: SensitiveCategory;
};

export type CensorResult = {
  imageWidth: number;
  imageHeight: number;
  boxes: CensorBox[];
  debug?: {
    moduleAvailable?: boolean;
    error?: string;
  };
};

// ---------------------------------------------------------------------------
// Helper: union the bounding boxes of words that overlap a given char range
// ---------------------------------------------------------------------------

/**
 * Given a single OCR line, a span's [start, end) relative to the line's text,
 * return the union of the word boxes that cover that span.
 *
 * Words are separated by a single space when joined, so the cursor advances by
 * word.text.length + 1 after each word.
 *
 * Returns null if no boxes are found (fall back to line.box).
 */
function unionWordBoxes(
  line: OcrLine,
  spanStart: number,
  spanEnd: number,
): { x: number; y: number; width: number; height: number } | null {
  if (line.words.length === 0) {
    return null;
  }

  let cursor = 0;
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  let found = false;

  for (const word of line.words) {
    const wordStart = cursor;
    const wordEnd = cursor + word.text.length;

    // Overlap check: span overlaps word when spanStart < wordEnd && spanEnd > wordStart
    if (spanStart < wordEnd && spanEnd > wordStart) {
      const box = word.box;
      if (box.width > 0 && box.height > 0) {
        minX = Math.min(minX, box.x);
        minY = Math.min(minY, box.y);
        maxX = Math.max(maxX, box.x + box.width);
        maxY = Math.max(maxY, box.y + box.height);
        found = true;
      }
    }

    // Advance cursor: word + 1-char separator (space)
    cursor = wordEnd + 1;
    if (cursor > spanEnd) {
      break;
    }
  }

  if (!found) {
    return null;
  }
  return { x: minX, y: minY, width: maxX - minX, height: maxY - minY };
}

// ---------------------------------------------------------------------------
// processGroup — scan one group (single-line or multi-line block)
// ---------------------------------------------------------------------------

function processGroup(
  lines: OcrLine[],
  separator: string,
): Array<{ box: { x: number; y: number; width: number; height: number }; category: SensitiveCategory }> {
  const text = lines.map(l => l.text).join(separator);
  const spans = detectSensitiveSpans(text);
  if (spans.length === 0) {
    return [];
  }

  const results: Array<{
    box: { x: number; y: number; width: number; height: number };
    category: SensitiveCategory;
  }> = [];

  for (const span of spans) {
    let lineCursor = 0;

    // Track the union of all boxes collected for this span across lines
    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;
    let anyBoxFound = false;

    for (let li = 0; li < lines.length; li++) {
      const line = lines[li];
      const lineStart = lineCursor;
      const lineEnd = lineCursor + line.text.length;
      const sepLen = li < lines.length - 1 ? separator.length : 0;

      // Compute overlap of span with this line (in group-level coordinates)
      const overlapStart = Math.max(span.start, lineStart);
      const overlapEnd = Math.min(span.end, lineEnd);

      if (overlapStart < overlapEnd) {
        // Convert to line-local char indices
        const localStart = overlapStart - lineStart;
        const localEnd = overlapEnd - lineStart;

        const wordUnion = unionWordBoxes(line, localStart, localEnd);
        const box =
          wordUnion ??
          (line.box.width > 0 && line.box.height > 0 ? line.box : null);

        if (box) {
          minX = Math.min(minX, box.x);
          minY = Math.min(minY, box.y);
          maxX = Math.max(maxX, box.x + box.width);
          maxY = Math.max(maxY, box.y + box.height);
          anyBoxFound = true;
        }
      }

      lineCursor = lineEnd + sepLen;
      if (lineCursor > span.end) {
        break;
      }
    }

    if (anyBoxFound) {
      results.push({
        box: { x: minX, y: minY, width: maxX - minX, height: maxY - minY },
        category: span.category,
      });
    }
  }

  return results;
}

// ---------------------------------------------------------------------------
// censorImage — public entry point
// ---------------------------------------------------------------------------

/**
 * Run OCR over the image at `imageUri`, detect sensitive information, and
 * return pixel-space bounding boxes for each detected sensitive region.
 *
 * Always resolves. On failure returns `{ boxes: [], debug: { error } }`.
 */
export async function censorImage(imageUri: string): Promise<CensorResult> {
  try {
    const ocrResult = await recognizeText(imageUri);

    const rawBoxes: Array<{
      box: { x: number; y: number; width: number; height: number };
      category: SensitiveCategory;
    }> = [];

    // --- Pass 1: per standalone line -----------------------------------------
    for (const line of ocrResult.lines) {
      const found = processGroup([line], '');
      rawBoxes.push(...found);
    }

    // --- Pass 2: per multi-line block -----------------------------------------
    for (const block of ocrResult.blocks) {
      if (block.lines.length <= 1) {
        // Single-line blocks already covered by pass 1
        continue;
      }
      const found = processGroup(block.lines, '\n');
      rawBoxes.push(...found);
    }

    // --- Dedup by rounded coords key -----------------------------------------
    const seen = new Set<string>();
    const boxes: CensorBox[] = [];

    for (const { box, category } of rawBoxes) {
      const { x, y, width: w, height: h } = box;
      if (w <= 0 || h <= 0) {
        continue;
      }
      const key = `${Math.round(x)}:${Math.round(y)}:${Math.round(w)}:${Math.round(h)}`;
      if (!seen.has(key)) {
        seen.add(key);
        boxes.push({ x, y, width: w, height: h, category });
      }
    }

    return {
      imageWidth: ocrResult.imageWidth,
      imageHeight: ocrResult.imageHeight,
      boxes,
      debug: {
        moduleAvailable: ocrResult.debug?.moduleAvailable,
        error: ocrResult.debug?.error,
      },
    };
  } catch (err) {
    return {
      imageWidth: 0,
      imageHeight: 0,
      boxes: [],
      debug: { error: String(err) },
    };
  }
}

