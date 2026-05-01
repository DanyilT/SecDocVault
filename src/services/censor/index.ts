/**
 * services/censor/index.ts
 *
 * Barrel re-export for the censor service.
 */

export { detectSensitiveSpans } from './detectors';
export type { SensitiveCategory, Span } from './detectors';

export { censorImage } from './censorImage';
export type { CensorBox, CensorResult } from './censorImage';

export { recognizeText } from './ocr';
export type { OcrBox, OcrLine, OcrResult, OcrWord, OcrBlock } from './ocr';

