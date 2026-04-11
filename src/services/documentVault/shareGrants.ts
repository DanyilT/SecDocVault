export type ShareGrantRecord = {
  recipientUid: string;
  recipientEmail?: string;
  recipientPublicKey?: string;
  allowExport: boolean;
  wrappedKeyCipher: string;
  keyWrapAlgorithm?: string;
  wrappedKeyIv?: string;
  senderEphemeralPublicKey?: string;
  createdAt: string;
  expiresAt?: string | Date | { toDate?: () => Date; seconds?: number; nanoseconds?: number };
  revokedAt?: string | null;
};

export function toDateFromUnknown(value: ShareGrantRecord['expiresAt']): Date | null {
  if (!value) {
    return null;
  }

  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? null : value;
  }

  if (typeof value === 'object' && typeof value.toDate === 'function') {
    const asDate = value.toDate();
    return Number.isNaN(asDate.getTime()) ? null : asDate;
  }

  if (typeof value === 'object' && typeof value.seconds === 'number') {
    const millis = value.seconds * 1000 + Math.floor((value.nanoseconds ?? 0) / 1_000_000);
    const asDate = new Date(millis);
    return Number.isNaN(asDate.getTime()) ? null : asDate;
  }

  const asDate = new Date(String(value));
  return Number.isNaN(asDate.getTime()) ? null : asDate;
}

export function computeShareExpiryDate(days: number, fallbackDays = 30) {
  const normalizedDays = Math.max(1, Math.min(365, Math.floor(days || fallbackDays)));
  const date = new Date();
  date.setDate(date.getDate() + normalizedDays);
  return date;
}

export function normalizeSharedKeyGrants(grants: ShareGrantRecord[] = [], fallbackDays = 30) {
  return grants.filter(Boolean).map(grant => ({
    ...grant,
    recipientUid: grant.recipientUid,
    recipientEmail: grant.recipientEmail?.trim().toLowerCase(),
    recipientPublicKey: grant.recipientPublicKey,
    allowExport: Boolean(grant.allowExport),
    keyWrapAlgorithm: grant.keyWrapAlgorithm ?? 'RSA-OAEP-SHA256',
    wrappedKeyIv: grant.wrappedKeyIv ?? '',
    senderEphemeralPublicKey: grant.senderEphemeralPublicKey ?? '',
    expiresAt: (toDateFromUnknown(grant.expiresAt) ?? computeShareExpiryDate(fallbackDays)).toISOString(),
    revokedAt: grant.revokedAt ?? null,
  }));
}

export function isShareGrantActive(grant: ShareGrantRecord, now = new Date()) {
  if (grant.revokedAt && String(grant.revokedAt).trim().length > 0) {
    return false;
  }

  if (!grant.expiresAt) {
    return false;
  }

  const expiresAt = toDateFromUnknown(grant.expiresAt);
  if (!expiresAt) {
    return false;
  }

  return expiresAt.getTime() > now.getTime();
}
