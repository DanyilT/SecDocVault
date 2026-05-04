/**
 * Tests for services/documentVault/formatters.ts
 */

import { Buffer } from 'buffer';

import {
  normalizeDocumentKeyB64,
  toHashLabel,
  resolveIntegrityTag,
  sortReferencesByOrder,
  normalizeReferenceOrder,
  toSizeLabel,
  toPseudoHash,
} from '../../../src/services/documentVault/formatters';

describe('normalizeDocumentKeyB64', () => {
  test('returns null for null input', () => {
    expect(normalizeDocumentKeyB64(null)).toBeNull();
  });

  test('returns null for undefined input', () => {
    expect(normalizeDocumentKeyB64(undefined)).toBeNull();
  });

  test('returns null for empty string', () => {
    expect(normalizeDocumentKeyB64('')).toBeNull();
  });

  test('returns null for whitespace-only string', () => {
    expect(normalizeDocumentKeyB64('   ')).toBeNull();
  });

  test('converts 64-char hex string to base64', () => {
    const hexKey = 'a'.repeat(64);
    const result = normalizeDocumentKeyB64(hexKey);
    expect(result).toBe(Buffer.from(hexKey, 'hex').toString('base64'));
  });

  test('accepts valid 32-byte base64 string', () => {
    const key32Bytes = Buffer.alloc(32).fill(0xab);
    const b64 = key32Bytes.toString('base64');
    const result = normalizeDocumentKeyB64(b64);
    expect(result).toBe(b64);
  });

  test('converts 32-byte UTF-8 string to base64', () => {
    const utf8Key = 'a'.repeat(32);
    const result = normalizeDocumentKeyB64(utf8Key);
    expect(result).toBe(Buffer.from(utf8Key, 'utf8').toString('base64'));
  });

  test('returns null for base64 that is not 32 bytes', () => {
    // 8 bytes = 11 chars base64 – not 32 bytes
    const shortB64 = Buffer.alloc(8).toString('base64');
    expect(normalizeDocumentKeyB64(shortB64)).toBeNull();
  });
});

describe('toHashLabel', () => {
  test('returns unavailable label for undefined', () => {
    expect(toHashLabel(undefined)).toBe('AES-GCM tag unavailable');
  });

  test('returns unavailable label for empty string', () => {
    expect(toHashLabel('')).toBe('AES-GCM tag unavailable');
  });

  test('truncates hash to first 16 chars with prefix', () => {
    const hash = 'abcdef1234567890deadbeef';
    expect(toHashLabel(hash)).toBe('AES-GCM abcdef1234567890...');
  });

  test('handles short hash strings', () => {
    expect(toHashLabel('abc')).toBe('AES-GCM abc...');
  });
});

describe('resolveIntegrityTag', () => {
  test('returns undefined for undefined reference', () => {
    expect(resolveIntegrityTag(undefined)).toBeUndefined();
  });

  test('returns integrityTag when present', () => {
    expect(resolveIntegrityTag({ integrityTag: 'tag123' } as any)).toBe('tag123');
  });

  test('falls back to fileHash when integrityTag absent', () => {
    expect(resolveIntegrityTag({ fileHash: 'hash456' } as any)).toBe('hash456');
  });

  test('returns undefined when neither field present', () => {
    expect(resolveIntegrityTag({} as any)).toBeUndefined();
  });
});

describe('sortReferencesByOrder', () => {
  test('returns empty array for empty input', () => {
    expect(sortReferencesByOrder([])).toEqual([]);
  });

  test('sorts by order ascending', () => {
    const refs = [
      { order: 2, source: 'firebase' },
      { order: 0, source: 'local' },
      { order: 1, source: 'firebase' },
    ] as any[];
    const result = sortReferencesByOrder(refs);
    expect(result.map(r => r.order)).toEqual([0, 1, 2]);
  });

  test('treats missing order as 0', () => {
    const refs = [
      { source: 'firebase' },
      { order: 1, source: 'local' },
    ] as any[];
    const result = sortReferencesByOrder(refs);
    expect(result[0].order).toBeUndefined();
    expect(result[1].order).toBe(1);
  });

  test('does not mutate the original array', () => {
    const refs = [{ order: 2 }, { order: 1 }] as any[];
    sortReferencesByOrder(refs);
    expect(refs[0].order).toBe(2);
  });
});

describe('normalizeReferenceOrder', () => {
  test('returns empty array for empty input', () => {
    expect(normalizeReferenceOrder([])).toEqual([]);
  });

  test('assigns sequential order when missing', () => {
    const refs = [{ source: 'firebase' }, { source: 'local' }] as any[];
    const result = normalizeReferenceOrder(refs);
    expect(result[0].order).toBe(0);
    expect(result[1].order).toBe(1);
  });

  test('preserves existing order values', () => {
    const refs = [{ source: 'firebase', order: 5 }, { source: 'local', order: 3 }] as any[];
    const result = normalizeReferenceOrder(refs);
    expect(result[0].order).toBe(3);
    expect(result[1].order).toBe(5);
  });
});

describe('toSizeLabel', () => {
  test('formats bytes', () => {
    expect(toSizeLabel(512)).toBe('512 B');
  });

  test('formats kilobytes', () => {
    expect(toSizeLabel(1024)).toBe('1.0 KB');
    expect(toSizeLabel(2048)).toBe('2.0 KB');
    expect(toSizeLabel(1536)).toBe('1.5 KB');
  });

  test('formats megabytes', () => {
    expect(toSizeLabel(1024 * 1024)).toBe('1.0 MB');
    expect(toSizeLabel(1024 * 1024 * 2.5)).toBe('2.5 MB');
  });

  test('returns B for values below 1024', () => {
    expect(toSizeLabel(0)).toBe('0 B');
    expect(toSizeLabel(1023)).toBe('1023 B');
  });
});

describe('toPseudoHash', () => {
  test('returns a SHA-256 prefixed label', () => {
    const files = [{ name: 'doc.pdf', size: 1024, type: 'application/pdf' }] as any[];
    const result = toPseudoHash(files);
    expect(result).toMatch(/^SHA-256 [0-9a-f]{12}\.\.\./);
  });

  test('produces different hashes for different file sets', () => {
    const files1 = [{ name: 'a.pdf', size: 100, type: 'application/pdf' }] as any[];
    const files2 = [{ name: 'b.pdf', size: 200, type: 'application/pdf' }] as any[];
    expect(toPseudoHash(files1)).not.toBe(toPseudoHash(files2));
  });

  test('produces same hash for same files', () => {
    const files = [{ name: 'doc.pdf', size: 1024, type: 'application/pdf' }] as any[];
    expect(toPseudoHash(files)).toBe(toPseudoHash(files));
  });

  test('handles empty file list', () => {
    const result = toPseudoHash([]);
    expect(result).toMatch(/^SHA-256 /);
  });
});
