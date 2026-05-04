/**
 * Tests for services/documentVault/shareGrants.ts
 */

import {
  toDateFromUnknown,
  computeShareExpiryDate,
  normalizeSharedKeyGrants,
  isShareGrantActive,
  ShareGrantRecord,
} from '../../../src/services/documentVault/shareGrants';

describe('toDateFromUnknown', () => {
  test('returns null for undefined', () => {
    expect(toDateFromUnknown(undefined)).toBeNull();
  });

  test('returns null for null', () => {
    expect(toDateFromUnknown(null as any)).toBeNull();
  });

  test('returns Date instance as-is when valid', () => {
    const d = new Date('2026-01-01');
    const result = toDateFromUnknown(d);
    expect(result).toEqual(d);
  });

  test('returns null for an invalid Date object', () => {
    const bad = new Date('invalid');
    expect(toDateFromUnknown(bad)).toBeNull();
  });

  test('calls toDate() method if present', () => {
    const d = new Date('2026-06-01');
    const obj = { toDate: () => d };
    expect(toDateFromUnknown(obj)).toEqual(d);
  });

  test('returns null if toDate() returns invalid date', () => {
    const obj = { toDate: () => new Date('invalid') };
    expect(toDateFromUnknown(obj)).toBeNull();
  });

  test('handles Firestore Timestamp-like object with seconds', () => {
    const ts = { seconds: 1700000000, nanoseconds: 0 };
    const result = toDateFromUnknown(ts);
    expect(result).toBeInstanceOf(Date);
    expect(result!.getTime()).toBe(1700000000 * 1000);
  });

  test('handles Firestore Timestamp nanoseconds contribution', () => {
    const ts = { seconds: 1700000000, nanoseconds: 500_000_000 };
    const result = toDateFromUnknown(ts);
    expect(result!.getTime()).toBe(1700000000 * 1000 + 500);
  });

  test('parses ISO string', () => {
    const iso = '2026-03-15T10:00:00.000Z';
    const result = toDateFromUnknown(iso);
    expect(result).toBeInstanceOf(Date);
    expect(result!.toISOString()).toBe(iso);
  });

  test('returns null for unparseable string', () => {
    expect(toDateFromUnknown('not-a-date')).toBeNull();
  });
});

describe('computeShareExpiryDate', () => {
  test('adds given days to today', () => {
    const now = new Date();
    const result = computeShareExpiryDate(10);
    const diff = result.getTime() - now.getTime();
    expect(diff).toBeGreaterThanOrEqual(9 * 24 * 3600 * 1000);
    expect(diff).toBeLessThanOrEqual(11 * 24 * 3600 * 1000);
  });

  test('clamps minimum to 1 day', () => {
    const result = computeShareExpiryDate(0);
    const now = new Date();
    expect(result.getTime()).toBeGreaterThan(now.getTime());
  });

  test('clamps maximum to 365 days', () => {
    const result = computeShareExpiryDate(999);
    const now = new Date();
    const diff = Math.round((result.getTime() - now.getTime()) / (24 * 3600 * 1000));
    expect(diff).toBeLessThanOrEqual(365);
  });

  test('uses fallbackDays when days is 0 with explicit fallback', () => {
    const result = computeShareExpiryDate(0, 7);
    const now = new Date();
    const diff = (result.getTime() - now.getTime()) / (24 * 3600 * 1000);
    expect(Math.round(diff)).toBe(7);
  });
});

describe('normalizeSharedKeyGrants', () => {
  const baseGrant: ShareGrantRecord = {
    recipientUid: 'uid123',
    recipientEmail: '  USER@Example.COM  ',
    allowExport: false,
    wrappedKeyCipher: 'cipher',
    createdAt: '2026-01-01T00:00:00.000Z',
    expiresAt: '2027-01-01T00:00:00.000Z',
  };

  test('returns empty array for empty input', () => {
    expect(normalizeSharedKeyGrants([])).toEqual([]);
  });

  test('lowercases and trims recipientEmail', () => {
    const result = normalizeSharedKeyGrants([baseGrant]);
    expect(result[0].recipientEmail).toBe('user@example.com');
  });

  test('coerces allowExport to boolean', () => {
    const result = normalizeSharedKeyGrants([{ ...baseGrant, allowExport: 1 as any }]);
    expect(result[0].allowExport).toBe(true);
  });

  test('defaults keyWrapAlgorithm to RSA-OAEP-SHA256', () => {
    const result = normalizeSharedKeyGrants([{ ...baseGrant, keyWrapAlgorithm: undefined }]);
    expect(result[0].keyWrapAlgorithm).toBe('RSA-OAEP-SHA256');
  });

  test('preserves explicit keyWrapAlgorithm', () => {
    const result = normalizeSharedKeyGrants([{ ...baseGrant, keyWrapAlgorithm: 'AES-256-GCM' }]);
    expect(result[0].keyWrapAlgorithm).toBe('AES-256-GCM');
  });

  test('sets revokedAt to null when missing', () => {
    const result = normalizeSharedKeyGrants([baseGrant]);
    expect(result[0].revokedAt).toBeNull();
  });

  test('converts expiresAt to ISO string', () => {
    const result = normalizeSharedKeyGrants([baseGrant]);
    expect(typeof result[0].expiresAt).toBe('string');
    expect(() => new Date(result[0].expiresAt as string)).not.toThrow();
  });

  test('filters out null/falsy grants', () => {
    const result = normalizeSharedKeyGrants([null as any, baseGrant]);
    expect(result).toHaveLength(1);
  });
});

describe('isShareGrantActive', () => {
  const future = new Date(Date.now() + 1000 * 60 * 60 * 24 * 7).toISOString();
  const past = new Date(Date.now() - 1000).toISOString();

  const activeGrant: ShareGrantRecord = {
    recipientUid: 'uid1',
    allowExport: false,
    wrappedKeyCipher: 'c',
    createdAt: '2026-01-01T00:00:00.000Z',
    expiresAt: future,
  };

  test('returns true for active non-revoked grant', () => {
    expect(isShareGrantActive(activeGrant)).toBe(true);
  });

  test('returns false for revoked grant', () => {
    expect(isShareGrantActive({ ...activeGrant, revokedAt: '2026-01-02T00:00:00.000Z' })).toBe(false);
  });

  test('returns false for expired grant', () => {
    expect(isShareGrantActive({ ...activeGrant, expiresAt: past })).toBe(false);
  });

  test('returns false when expiresAt is missing', () => {
    expect(isShareGrantActive({ ...activeGrant, expiresAt: undefined })).toBe(false);
  });

  test('uses provided now parameter', () => {
    const distantFuture = new Date(Date.now() + 1000 * 60 * 60 * 24 * 365 * 10).toISOString();
    const grant = { ...activeGrant, expiresAt: distantFuture };
    const wayFutureNow = new Date(Date.now() + 1000 * 60 * 60 * 24 * 365 * 20);
    expect(isShareGrantActive(grant, wayFutureNow)).toBe(false);
  });

  test('returns false when revokedAt is empty string', () => {
    expect(isShareGrantActive({ ...activeGrant, revokedAt: '   ' })).toBe(true);
  });
});

