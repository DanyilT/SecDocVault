/**
 * services/censor/detectors.ts
 *
 * Pure-JS sensitive-information detectors. No native dependencies.
 * Finds spans of sensitive text (emails, phones, credit cards, IBANs, SSNs,
 * tax IDs, passports, dates, API keys, addresses, and sensitive keywords)
 * using battle-tested regexes with OCR-tolerance built in.
 */

export type SensitiveCategory =
  | 'email'
  | 'phone'
  | 'creditCard'
  | 'iban'
  | 'ssn'
  | 'taxId'
  | 'passport'
  | 'date'
  | 'apiKey'
  | 'address'
  | 'keyword';

export type Span = {
  start: number;
  end: number;
  category: SensitiveCategory;
  text: string;
};

// ---------------------------------------------------------------------------
// Luhn validator (mod-10, length >= 13)
// ---------------------------------------------------------------------------
function luhn(raw: string): boolean {
  const digits = raw.replace(/\D/g, '');
  if (digits.length < 13) {
    return false;
  }
  let sum = 0;
  let alt = false;
  for (let i = digits.length - 1; i >= 0; i--) {
    let n = parseInt(digits[i], 10);
    if (alt) {
      n *= 2;
      if (n > 9) {
        n -= 9;
      }
    }
    sum += n;
    alt = !alt;
  }
  return sum % 10 === 0;
}

// ---------------------------------------------------------------------------
// Keyword list
// ---------------------------------------------------------------------------
const KEYWORDS = [
  'passport',
  'паспорт',
  'ІПН',
  'іпн',
  'инн',
  'снилс',
  'ssn',
  'iban',
  'cvv',
  'cvc',
  'birth',
  'dob',
  'password',
  'пароль',
  'секрет',
  'secret',
];

const escapedKeywords = KEYWORDS.map(k => k.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|');
const keywordPattern = new RegExp(
  `(?<![\\p{L}\\p{N}])(?:${escapedKeywords})(?![\\p{L}\\p{N}])`,
  'giu',
);

// ---------------------------------------------------------------------------
// Detector table
// ---------------------------------------------------------------------------
type Detector = {
  category: SensitiveCategory;
  pattern: RegExp;
  validate?: (m: string) => boolean;
};

const DETECTORS: Detector[] = [
  {
    category: 'email',
    // Tolerant of OCR misreads: @ → (, [, {, ＠, (at), [at], -at-.
    // Also handles artemsa223(gmail.com (bare bracket used as @).
    pattern:
      /(?<![A-Za-z0-9._%+-])[A-Za-z0-9._%+-]{1,64}[(\[{]{0,2}\s*(?:@|\uFF20|\(at\)|\[at\]|-at-|[(\[{])\s*[)\]}]{0,2}[A-Za-z0-9.-]{1,253}\s*\.\s*[A-Za-z]{2,24}(?![A-Za-z0-9.-])/giu,
  },
  {
    category: 'phone',
    pattern:
      /(?:\+?\d{1,3}[\s.-]?)?(?:\(?\d{2,4}\)?[\s.-]?)?\d{2,4}[\s.-]?\d{2,4}[\s.-]?\d{0,4}/g,
    validate: (m: string) => {
      const digits = m.replace(/\D/g, '');
      return digits.length >= 9 && digits.length <= 15;
    },
  },
  {
    category: 'creditCard',
    pattern: /\b(?:\d[ -]*?){13,19}\b/g,
    validate: luhn,
  },
  {
    category: 'iban',
    pattern: /\b[A-Z]{2}\d{2}[A-Z0-9]{10,30}\b/g,
  },
  {
    category: 'ssn',
    pattern: /\b\d{3}-\d{2}-\d{4}\b/g,
  },
  {
    category: 'taxId',
    // Ukrainian ІПН: exactly 10 digits not surrounded by other digits
    pattern: /(?<!\d)\d{10}(?!\d)/g,
  },
  {
    category: 'passport',
    // Latin-script passports (e.g. AB1234567)
    pattern: /\b[A-Z]{1,2}\d{6,9}\b/g,
  },
  {
    category: 'passport',
    // Cyrillic Ukrainian passports (e.g. АА 123456)
    pattern: /\b[А-ЯЁІЇЄҐ]{2}\s?\d{6}\b/gu,
  },
  {
    category: 'date',
    pattern: /\b\d{1,2}[./-]\d{1,2}[./-]\d{2,4}\b/g,
  },
  {
    category: 'apiKey',
    pattern: /\b(?:sk|pk|AKIA|ghp|gho|ghu|ghs|xox[baprs])[_-]?[A-Za-z0-9]{16,}\b/g,
  },
  {
    category: 'address',
    pattern:
      /\b(?:вул(?:иця)?\.?|street|st\.|ave\.|avenue|просп(?:ект)?\.?)\s+[^\n,]{2,40}/giu,
  },
  {
    category: 'keyword',
    pattern: keywordPattern,
  },
];

// ---------------------------------------------------------------------------
// mergeSpans — sort by start, then merge overlapping / adjacent spans
// ---------------------------------------------------------------------------
function mergeSpans(spans: Span[]): Span[] {
  if (spans.length === 0) {
    return [];
  }
  const sorted = [...spans].sort((a, b) => a.start - b.start || a.end - b.end);
  const merged: Span[] = [{ ...sorted[0] }];

  for (let i = 1; i < sorted.length; i++) {
    const last = merged[merged.length - 1];
    const cur = sorted[i];
    if (cur.start <= last.end) {
      // Overlapping — extend the previous span; earliest category wins.
      last.end = Math.max(last.end, cur.end);
      last.text = last.text; // keep first span's text
    } else {
      merged.push({ ...cur });
    }
  }
  return merged;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Detect spans of sensitive information inside `text`.
 *
 * Returns sorted, non-overlapping spans.
 */
export function detectSensitiveSpans(text: string): Span[] {
  if (!text) {
    return [];
  }

  const collected: Span[] = [];

  for (const detector of DETECTORS) {
    // Always reset lastIndex before iterating (guard against reuse)
    detector.pattern.lastIndex = 0;

    let match: RegExpExecArray | null;
    while ((match = detector.pattern.exec(text)) !== null) {
      // Guard against zero-length matches causing infinite loop
      if (match[0].length === 0) {
        detector.pattern.lastIndex += 1;
        continue;
      }

      const raw = match[0];

      if (detector.validate && !detector.validate(raw)) {
        continue;
      }

      collected.push({
        start: match.index,
        end: match.index + raw.length,
        category: detector.category,
        text: raw,
      });
    }
  }

  return mergeSpans(collected);
}

