/**
 * Tests for storage/localVault.ts
 */

import AsyncStorage from '@react-native-async-storage/async-storage';

import {
  getLocalDocuments,
  saveLocalDocuments,
  seedLocalDocuments,
  getVaultPreferences,
  saveVaultPreferences,
  getIncomingShareDecisionStore,
  saveIncomingShareDecisionStore,
} from '../../../src/storage/localVault';

import type { VaultDocument } from '../../../src/types/vault';
import type { VaultPreferences } from '../../../src/storage/localVault';

const mockDoc = (id: string): VaultDocument => ({
  id,
  name: `Doc ${id}`,
  hash: 'hash',
  size: '1 KB',
  uploadedAt: '2026-01-01',
  sharedWith: [],
  sharedKeyGrants: [],
  references: [],
  saveMode: 'firebase',
  recoverable: false,
  offlineAvailable: false,
});

beforeEach(() => {
  jest.clearAllMocks();
});

describe('getLocalDocuments', () => {
  test('returns empty array when nothing stored', async () => {
    (AsyncStorage.getItem as jest.Mock).mockResolvedValueOnce(null);
    const result = await getLocalDocuments();
    expect(result).toEqual([]);
  });

  test('returns parsed documents', async () => {
    const docs = [mockDoc('1'), mockDoc('2')];
    (AsyncStorage.getItem as jest.Mock).mockResolvedValueOnce(JSON.stringify(docs));
    const result = await getLocalDocuments();
    expect(result).toHaveLength(2);
    expect(result[0].id).toBe('1');
  });

  test('returns empty array on JSON parse error', async () => {
    (AsyncStorage.getItem as jest.Mock).mockResolvedValueOnce('invalid json{');
    const result = await getLocalDocuments();
    expect(result).toEqual([]);
  });

  test('returns empty array when parsed value is not array', async () => {
    (AsyncStorage.getItem as jest.Mock).mockResolvedValueOnce(JSON.stringify({ foo: 'bar' }));
    const result = await getLocalDocuments();
    expect(result).toEqual([]);
  });

  test('uses uid-scoped key when uid provided', async () => {
    (AsyncStorage.getItem as jest.Mock).mockResolvedValueOnce(null);
    await getLocalDocuments('user123');
    expect(AsyncStorage.getItem).toHaveBeenCalledWith(
      expect.stringContaining('user123'),
    );
  });
});

describe('saveLocalDocuments', () => {
  test('serializes documents to AsyncStorage', async () => {
    const docs = [mockDoc('a')];
    await saveLocalDocuments(docs);
    expect(AsyncStorage.setItem).toHaveBeenCalledWith(
      expect.any(String),
      JSON.stringify(docs),
    );
  });

  test('uses uid-scoped key when uid provided', async () => {
    await saveLocalDocuments([mockDoc('a')], 'user42');
    expect(AsyncStorage.setItem).toHaveBeenCalledWith(
      expect.stringContaining('user42'),
      expect.any(String),
    );
  });
});

describe('seedLocalDocuments', () => {
  test('returns existing docs without overwriting when non-empty', async () => {
    const existing = [mockDoc('existing')];
    (AsyncStorage.getItem as jest.Mock).mockResolvedValueOnce(JSON.stringify(existing));
    const newDocs = [mockDoc('new')];
    const result = await seedLocalDocuments(newDocs);
    expect(result[0].id).toBe('existing');
    expect(AsyncStorage.setItem).not.toHaveBeenCalled();
  });

  test('writes and returns provided docs when storage is empty', async () => {
    (AsyncStorage.getItem as jest.Mock).mockResolvedValueOnce(null);
    const newDocs = [mockDoc('fresh')];
    const result = await seedLocalDocuments(newDocs);
    expect(result[0].id).toBe('fresh');
    expect(AsyncStorage.setItem).toHaveBeenCalledWith(
      expect.any(String),
      JSON.stringify(newDocs),
    );
  });
});

describe('getVaultPreferences', () => {
  test('returns defaults when nothing stored', async () => {
    (AsyncStorage.getItem as jest.Mock).mockResolvedValueOnce(null);
    const prefs = await getVaultPreferences();
    expect(prefs.saveOfflineByDefault).toBe(false);
    expect(prefs.autoSyncKeys).toBe(false);
    expect(prefs.keyBackupEnabled).toBe(false);
    expect(prefs.recoverableByDefault).toBe(false);
  });

  test('parses stored preferences', async () => {
    const stored: Partial<VaultPreferences> = {
      saveOfflineByDefault: true,
      autoSyncKeys: true,
      keyBackupEnabled: true,
      recoverableByDefault: true,
    };
    (AsyncStorage.getItem as jest.Mock).mockResolvedValueOnce(JSON.stringify(stored));
    const prefs = await getVaultPreferences();
    expect(prefs.saveOfflineByDefault).toBe(true);
    expect(prefs.autoSyncKeys).toBe(true);
  });

  test('returns defaults when stored JSON is invalid', async () => {
    (AsyncStorage.getItem as jest.Mock).mockResolvedValueOnce('bad{json');
    const prefs = await getVaultPreferences();
    expect(prefs.saveOfflineByDefault).toBe(false);
  });
});

describe('saveVaultPreferences', () => {
  test('serializes preferences to AsyncStorage', async () => {
    const prefs: VaultPreferences = {
      saveOfflineByDefault: true,
      autoSyncKeys: false,
      keyBackupEnabled: true,
      recoverableByDefault: false,
    };
    await saveVaultPreferences(prefs);
    expect(AsyncStorage.setItem).toHaveBeenCalledWith(
      expect.any(String),
      JSON.stringify(prefs),
    );
  });
});

describe('getIncomingShareDecisionStore', () => {
  test('returns empty object when nothing stored', async () => {
    (AsyncStorage.getItem as jest.Mock).mockResolvedValueOnce(null);
    const result = await getIncomingShareDecisionStore();
    expect(result).toEqual({});
  });

  test('parses stored decision store', async () => {
    const store = { user1: { doc1: 'accepted' as const } };
    (AsyncStorage.getItem as jest.Mock).mockResolvedValueOnce(JSON.stringify(store));
    const result = await getIncomingShareDecisionStore();
    expect(result.user1.doc1).toBe('accepted');
  });

  test('returns empty object on JSON parse error', async () => {
    (AsyncStorage.getItem as jest.Mock).mockResolvedValueOnce('{{bad');
    const result = await getIncomingShareDecisionStore();
    expect(result).toEqual({});
  });

  test('returns empty object when stored value is not an object', async () => {
    (AsyncStorage.getItem as jest.Mock).mockResolvedValueOnce(JSON.stringify('string'));
    const result = await getIncomingShareDecisionStore();
    expect(result).toEqual({});
  });
});

describe('saveIncomingShareDecisionStore', () => {
  test('serializes store to AsyncStorage', async () => {
    const store = { uid1: { docA: 'declined' as const } };
    await saveIncomingShareDecisionStore(store);
    expect(AsyncStorage.setItem).toHaveBeenCalledWith(
      expect.any(String),
      JSON.stringify(store),
    );
  });
});

