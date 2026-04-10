import AsyncStorage from '@react-native-async-storage/async-storage';
import RNFS from 'react-native-fs';

import { VaultDocument } from '../types/vault';

const LOCAL_DOCS_KEY = 'secdocvault.local.documents';
const VAULT_PREFS_KEY = 'secdocvault.local.preferences';
const INCOMING_SHARE_DECISIONS_KEY = 'secdocvault.local.incomingShareDecisions';

export type IncomingShareDecision = 'accepted' | 'declined';
export type IncomingShareDecisionStore = Record<string, Record<string, IncomingShareDecision>>;

export type VaultPreferences = {
  saveOfflineByDefault: boolean;
  autoSyncKeys: boolean;
  keyBackupEnabled: boolean;
  recoverableByDefault: boolean;
};

const DEFAULT_PREFERENCES: VaultPreferences = {
  saveOfflineByDefault: false,
  autoSyncKeys: false,
  keyBackupEnabled: false,
  recoverableByDefault: false,
};

export async function getLocalDocuments(): Promise<VaultDocument[]> {
  const raw = await AsyncStorage.getItem(LOCAL_DOCS_KEY);
  if (!raw) {
    return [];
  }

  try {
    const parsed = JSON.parse(raw) as VaultDocument[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export async function saveLocalDocuments(documents: VaultDocument[]): Promise<void> {
  await AsyncStorage.setItem(LOCAL_DOCS_KEY, JSON.stringify(documents));
}

export async function seedLocalDocuments(documents: VaultDocument[]): Promise<VaultDocument[]> {
  const existing = await getLocalDocuments();
  if (existing.length > 0) {
    return existing;
  }

  await saveLocalDocuments(documents);
  return documents;
}

export async function getVaultPreferences(): Promise<VaultPreferences> {
  const raw = await AsyncStorage.getItem(VAULT_PREFS_KEY);
  if (!raw) {
    return DEFAULT_PREFERENCES;
  }

  try {
    const parsed = JSON.parse(raw) as Partial<VaultPreferences>;
    return {
      saveOfflineByDefault: Boolean(parsed.saveOfflineByDefault),
      autoSyncKeys: Boolean(parsed.autoSyncKeys),
      keyBackupEnabled: Boolean(parsed.keyBackupEnabled),
      recoverableByDefault: Boolean(parsed.recoverableByDefault),
    };
  } catch {
    return DEFAULT_PREFERENCES;
  }
}

export async function saveVaultPreferences(preferences: VaultPreferences): Promise<void> {
  await AsyncStorage.setItem(VAULT_PREFS_KEY, JSON.stringify(preferences));
}

export async function getIncomingShareDecisionStore(): Promise<IncomingShareDecisionStore> {
  const raw = await AsyncStorage.getItem(INCOMING_SHARE_DECISIONS_KEY);
  if (!raw) {
    return {};
  }

  try {
    const parsed = JSON.parse(raw) as IncomingShareDecisionStore;
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
}

export async function saveIncomingShareDecisionStore(store: IncomingShareDecisionStore): Promise<void> {
  await AsyncStorage.setItem(INCOMING_SHARE_DECISIONS_KEY, JSON.stringify(store));
}

export async function clearLocalVaultData(): Promise<void> {
  await Promise.allSettled([
    AsyncStorage.removeItem(LOCAL_DOCS_KEY),
    AsyncStorage.removeItem(VAULT_PREFS_KEY),
    AsyncStorage.removeItem(INCOMING_SHARE_DECISIONS_KEY),
    RNFS.exists(`${RNFS.DocumentDirectoryPath}/vault`).then(async exists => {
      if (exists) {
        await RNFS.unlink(`${RNFS.DocumentDirectoryPath}/vault`);
      }
    }),
  ]);
}

