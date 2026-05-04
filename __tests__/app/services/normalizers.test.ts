/**
 * Tests for services/documentVault/normalizers.ts
 */

import {
  normalizeDescription,
  normalizeDocumentName,
} from '../../../src/services/documentVault/normalizers';

describe('normalizeDescription', () => {
  test('returns empty string for undefined', () => {
    expect(normalizeDescription(undefined)).toBe('');
  });

  test('returns empty string for empty string', () => {
    expect(normalizeDescription('')).toBe('');
  });

  test('trims whitespace', () => {
    expect(normalizeDescription('  hello  ')).toBe('hello');
  });

  test('returns value as-is when no whitespace', () => {
    expect(normalizeDescription('description')).toBe('description');
  });
});

describe('normalizeDocumentName', () => {
  test('returns "Document" for undefined', () => {
    expect(normalizeDocumentName(undefined)).toBe('Document');
  });

  test('returns "Document" for empty string', () => {
    expect(normalizeDocumentName('')).toBe('Document');
  });

  test('returns "Document" for whitespace-only', () => {
    expect(normalizeDocumentName('   ')).toBe('Document');
  });

  test('trims and returns the provided name', () => {
    expect(normalizeDocumentName('  My Doc  ')).toBe('My Doc');
  });

  test('returns name unchanged when already trimmed', () => {
    expect(normalizeDocumentName('Passport')).toBe('Passport');
  });
});

