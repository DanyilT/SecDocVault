import EncryptedStorage from 'react-native-encrypted-storage';

const PASSPHRASE_KEY = 'sec_doc_vault_passphrase';

// Stores passphrase with constant access key
export async function savePassphrase(passphrase: string) : Promise<void> {
  await EncryptedStorage.setItem(PASSPHRASE_KEY, passphrase);
}
// Stores document encryption key with a docId as access key
export async function saveEncKey(docId: string, encKey: string): Promise<void> {
  await EncryptedStorage.setItem(docId, encKey);
}

// Retrieves encKey for the given docId
export async function getEncKey(docId: string): Promise<string | null> {
  return EncryptedStorage.getItem(docId);
}
// Retrieves passphrase with constant access key
export async function getPassphrase(): Promise<string | null> {
  return EncryptedStorage.getItem(PASSPHRASE_KEY);
}

// Removes the record for the given docId
export async function removeEncKey(docId: string): Promise<void> {
  await EncryptedStorage.removeItem(docId);
}
