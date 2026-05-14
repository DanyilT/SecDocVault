/**
 * Tests for services/documentVault/storage.ts
 */

jest.mock('@react-native-firebase/app', () => ({ getApp: jest.fn(() => ({})) }));

jest.mock('@react-native-firebase/firestore', () => ({
  getFirestore: jest.fn(),
  collection: jest.fn(),
  doc: jest.fn(() => ({ id: 'mock-doc-id' })),
  query: jest.fn(),
  where: jest.fn(),
  getDocs: jest.fn(),
  getDoc: jest.fn(),
  setDoc: jest.fn(),
  deleteDoc: jest.fn(),
  serverTimestamp: jest.fn(() => 'mock-timestamp'),
}));

jest.mock('@react-native-firebase/storage', () => ({
  getStorage: jest.fn(),
  ref: jest.fn(() => 'mock-storage-ref'),
  uploadString: jest.fn(),
  deleteObject: jest.fn(),
  getDownloadURL: jest.fn(),
}));

jest.mock('@react-native-firebase/auth', () => ({
  getAuth: jest.fn(() => ({ currentUser: { uid: 'current-user', email: 'me@example.com' } })),
}));

jest.mock('react-native-fs', () => ({
  readFile: jest.fn(async () => 'payload-json'),
  writeFile: jest.fn(async () => undefined),
  exists: jest.fn(async () => true),
  mkdir: jest.fn(async () => undefined),
  unlink: jest.fn(async () => undefined),
  DocumentDirectoryPath: '/tmp',
  DownloadDirectoryPath: '/tmp',
}));

jest.mock('react-native-keychain', () => ({
  getGenericPassword: jest.fn(),
  setGenericPassword: jest.fn(async () => true),
  resetGenericPassword: jest.fn(async () => true),
}));

jest.mock('../../../../src/services/crypto/documentCrypto', () => ({
  ...jest.requireActual('../../../../src/services/crypto/documentCrypto'),
  decryptBase64Payload: jest.fn(),
  getOrCreateKdfMaterial: jest.fn(),
  getRecoveryPassphrase: jest.fn(),
  unwrapDocumentKey: jest.fn(),
  unwrapDocumentKeyFromShareEnvelope: jest.fn(),
  wrapDocumentKey: jest.fn(),
  MissingKdfPassphraseError: class MissingKdfPassphraseError extends Error {},
}));

import RNFS from 'react-native-fs';
import { getDocs, getDoc, setDoc, deleteDoc } from '@react-native-firebase/firestore';
import { deleteObject, getDownloadURL } from '@react-native-firebase/storage';
import * as Keychain from 'react-native-keychain';

import {
  saveDocumentOffline,
  saveDocumentToFirebase,
  updateDocumentMetadata,
  updateDocumentRecoveryPreference,
  removeLocalDocumentCopy,
  deleteDocumentFromFirebase,
  removeFirebaseReferences,
  decryptDocumentPayload,
  hasLocalEncryptedCopy,
  exportDocumentToDevice,
} from '../../../../src/services/documentVault';

import { getAuth } from '@react-native-firebase/auth';

// crypto helpers are mocked above as needed

describe('documentVault/storage helpers', () => {
  beforeEach(() => {
    jest.resetAllMocks();
    (getAuth as jest.Mock).mockReturnValue({ currentUser: { uid: 'current-user', email: 'me@example.com' } });
    (getDocs as jest.Mock).mockResolvedValue({ docs: [], forEach: (_cb: (item: any) => void) => undefined });
    (getDoc as jest.Mock).mockResolvedValue({ exists: () => false });
    (RNFS.readFile as jest.Mock).mockResolvedValue(JSON.stringify({ iv: 'iv', cipher: 'cipher' }));
    (getDownloadURL as jest.Mock).mockResolvedValue('https://example.com/payload');
    (globalThis as any).fetch = jest.fn(async () => ({
      text: async () => JSON.stringify({ iv: 'iv', cipher: 'cipher', authTag: 'tag' }),
    }));
    // short-circuit resolveDocumentKey before share-grant lookups for targeted tests
    (Keychain.getGenericPassword as jest.Mock).mockResolvedValue({
      username: 'doc-id',
      password: 'AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA=',
    });
  });

  test('saveDocumentOffline throws when no firebase references', async () => {
    const docMeta: any = { id: 'd1', references: [{ source: 'local', localPath: '/tmp/a.enc' }] };
    await expect(saveDocumentOffline(docMeta)).rejects.toThrow('No document payload found to save offline.');
  });

  test('saveDocumentOffline saves remote references to local and writes to Firestore when owner present', async () => {
    (getDocs as jest.Mock).mockResolvedValueOnce({ docs: [] });
    const payloadJson = JSON.stringify({ iv: 'iv', cipher: 'cipher', authTag: 'tag' });
    (RNFS.readFile as jest.Mock).mockResolvedValueOnce(payloadJson);

    const docMeta: any = {
      id: 'doc-1',
      owner: 'owner-1',
      references: [{ name: 'f', size: 10, type: 'text/plain', source: 'firebase', storagePath: 'vault/x' }],
    };

    const result = await saveDocumentOffline(docMeta);
    expect(RNFS.writeFile).toHaveBeenCalled();
    // should set offlineAvailable on Firestore because owner present
    expect(setDoc).toHaveBeenCalled();
    expect(result.offlineAvailable).toBe(true);
  });

  test('saveDocumentToFirebase throws when no local references', async () => {
    const docMeta: any = { id: 'd1', references: [{ source: 'firebase', storagePath: 'p' }] };
    await expect(saveDocumentToFirebase(docMeta, 'owner')).rejects.toThrow('No local encrypted payload found to upload to Firebase.');
  });

  test('saveDocumentToFirebase throws when encryptedDocKey missing', async () => {
    const docMeta: any = {
      id: 'd2',
      references: [{ source: 'local', localPath: '/tmp/x.enc', name: 'x' }],
    };
    await expect(saveDocumentToFirebase(docMeta, 'owner')).rejects.toThrow('Missing encrypted document key.');
  });

  test('saveDocumentToFirebase uploads and writes metadata', async () => {
    (getDocs as jest.Mock).mockResolvedValueOnce({ docs: [] });
    const docMeta: any = {
      id: 'd3',
      references: [{ source: 'local', localPath: '/tmp/x.enc', name: 'x', size: 10, type: 'text/plain' }],
      encryptedDocKey: { cipher: 'c', iv: 'i' },
      name: 'Doc',
      description: 'Desc',
    };

    (RNFS.readFile as jest.Mock).mockResolvedValueOnce('payload');
    (require('@react-native-firebase/storage').uploadString as jest.Mock).mockResolvedValueOnce(undefined);

    const res = await saveDocumentToFirebase(docMeta, 'ownerX');
    expect(setDoc).toHaveBeenCalled();
    expect((res.references || []).some((r: any) => r.source === 'firebase')).toBe(true);
  });

  test('updateDocumentMetadata writes to Firestore when owner and has firebase ref', async () => {
    // ensure current user matches owner
    (getAuth as jest.Mock).mockReturnValueOnce({ currentUser: { uid: 'owner-123' } });
    const docMeta: any = {
      id: 'm1',
      owner: 'owner-123',
      references: [{ source: 'firebase', storagePath: 's' }],
      name: 'old',
      description: 'old',
    };

    const updated = await updateDocumentMetadata(docMeta, { name: 'new', description: 'desc' });
    expect(setDoc).toHaveBeenCalled();
    expect(updated.name).toBe('new');
    expect(updated.description).toBe('desc');
  });

  test('updateDocumentRecoveryPreference throws when recoverable true but no recovery passphrase', async () => {
    const crypto = jest.requireMock('../../../../src/services/crypto/documentCrypto');
    (crypto.getRecoveryPassphrase as jest.Mock).mockResolvedValueOnce(null);

    const docMeta: any = {
      id: 'r1',
      references: [{ source: 'firebase', storagePath: 's' }],
      owner: 'owner-123',
      encryptedDocKey: { cipher: 'c', iv: 'i' },
    };

    await expect(updateDocumentRecoveryPreference(docMeta, true)).rejects.toThrow('Key backup is not set up yet');
  });

  test('updateDocumentRecoveryPreference uses device wrap when recoverable false', async () => {
    const crypto = jest.requireMock('../../../../src/services/crypto/documentCrypto');
    (crypto.getOrCreateKdfMaterial as jest.Mock).mockResolvedValueOnce({ passphrase: 'p', salt: 's' });
    (crypto.wrapDocumentKey as jest.Mock).mockResolvedValueOnce('wrapped');

    const docMeta: any = {
      id: 'r2',
      references: [{ source: 'firebase', storagePath: 's' }],
      owner: 'owner-123',
      encryptedDocKey: { cipher: 'c', iv: 'i' },
    };

    const res = await updateDocumentRecoveryPreference(docMeta, false);
    expect(crypto.wrapDocumentKey).toHaveBeenCalled();
    expect(res.recoverable).toBe(false);
  });

  test('removeLocalDocumentCopy unlinks local files and updates firestore when owner', async () => {
    (RNFS.exists as jest.Mock).mockResolvedValue(true);
    const docMeta: any = {
      id: 'rem1',
      owner: 'current-user',
      references: [
        { source: 'local', localPath: '/tmp/a', name: 'a', order: 0 },
        { source: 'firebase', storagePath: 's', name: 'b', order: 1 },
      ],
    };

    const res = await removeLocalDocumentCopy(docMeta);
    expect(RNFS.unlink).toHaveBeenCalledWith('/tmp/a');
    expect(setDoc).toHaveBeenCalled();
    expect(res.offlineAvailable).toBe(false);
  });

  test('deleteDocumentFromFirebase deletes storage objects and subcollection docs and main doc', async () => {
    (getDocs as jest.Mock).mockResolvedValueOnce({ docs: [{ ref: 'sub-ref-1' }] });
    const docMeta: any = {
      id: 'del1',
      references: [{ source: 'firebase', storagePath: 's1' }],
    };

    await deleteDocumentFromFirebase(docMeta);
    expect(deleteObject).toHaveBeenCalled();
    expect(deleteDoc).toHaveBeenCalled();
  });

  test('removeFirebaseReferences returns null when nothing left', () => {
    const docMeta: any = { id: 'n1', references: [{ source: 'firebase', storagePath: 's' }] };
    const res = removeFirebaseReferences(docMeta);
    expect(res).toBeNull();
  });

  test('removeFirebaseReferences keeps local refs', () => {
    const docMeta: any = { id: 'n2', references: [{ source: 'local', localPath: '/tmp/x' }, { source: 'firebase', storagePath: 's' }] };
    const res = removeFirebaseReferences(docMeta as any);
    expect(res).not.toBeNull();
    expect(res?.saveMode).toBe('local');
  });

  test('decryptDocumentPayload throws when no references', async () => {
    const docMeta: any = { id: 'e1', references: [] };
    await expect(decryptDocumentPayload(docMeta)).rejects.toThrow('No encrypted payload references found.');
  });

  test('decryptDocumentPayload throws when remote reference missing storagePath', async () => {
    const docMeta: any = {
      id: 'e2',
      references: [{ source: 'firebase', name: 'f1' }],
    };
    await expect(decryptDocumentPayload(docMeta)).rejects.toThrow('Missing storage path for encrypted payload.');
  });

  test('saveDocumentOffline returns original when firebase refs already have matching local copies', async () => {
    const docMeta: any = {
      id: 'doc-dupe',
      references: [
        { source: 'firebase', storagePath: 'vault/a', name: 'a', size: 10, type: 'text/plain', order: 0 },
        { source: 'local', localPath: '/tmp/a.enc', name: 'a', size: 10, type: 'text/plain', order: 0 },
      ],
    };

    const result = await saveDocumentOffline(docMeta);
    expect(RNFS.writeFile).not.toHaveBeenCalled();
    expect(result).toEqual(docMeta);
  });

  test('saveDocumentToFirebase returns original document when firebase copy already exists', async () => {
    const docMeta: any = {
      id: 'already-fb',
      encryptedDocKey: { cipher: 'c', iv: 'i' },
      references: [
        { source: 'local', localPath: '/tmp/x.enc', name: 'x' },
        { source: 'firebase', storagePath: 'vault/path', name: 'x' },
      ],
    };

    const result = await saveDocumentToFirebase(docMeta, 'owner');
    expect(result).toBe(docMeta);
  });

  test('saveDocumentToFirebase cleans uploaded objects on metadata write failure', async () => {
    const docMeta: any = {
      id: 'cleanup-fb',
      encryptedDocKey: { cipher: 'c', iv: 'i' },
      references: [{ source: 'local', localPath: '/tmp/x.enc', name: 'x', size: 10, type: 'text/plain' }],
      name: 'Doc',
      description: 'Desc',
    };

    (RNFS.readFile as jest.Mock).mockResolvedValueOnce('payload');
    (require('@react-native-firebase/storage').uploadString as jest.Mock).mockResolvedValueOnce(undefined);
    (setDoc as jest.Mock).mockRejectedValueOnce(new Error('setDoc failed'));

    await expect(saveDocumentToFirebase(docMeta, 'owner')).rejects.toThrow('setDoc failed');
    expect(deleteObject).toHaveBeenCalled();
  });

  test('removeLocalDocumentCopy ignores malformed local entries missing localPath', async () => {
    const docMeta: any = {
      id: 'rem2',
      owner: 'current-user',
      references: [
        { source: 'local', name: 'bad-no-path', order: 0 },
        { source: 'firebase', storagePath: 's', name: 'b', order: 1 },
      ],
    };

    const res = await removeLocalDocumentCopy(docMeta);
    expect(RNFS.unlink).not.toHaveBeenCalled();
    expect((res.references || []).every((item: any) => item.source !== 'local')).toBe(true);
  });

  test('deleteDocumentFromFirebase handles refs without storagePath and still deletes main doc', async () => {
    (getDocs as jest.Mock).mockRejectedValueOnce(new Error('subcollection read failed'));
    const docMeta: any = {
      id: 'del2',
      references: [{ source: 'firebase', storagePath: undefined }],
    };

    await expect(deleteDocumentFromFirebase(docMeta)).resolves.toBeUndefined();
    expect(deleteObject).not.toHaveBeenCalled();
    expect(deleteDoc).toHaveBeenCalled();
  });

  test('decryptDocumentPayload throws when encrypted key metadata is missing', async () => {
    (getAuth as jest.Mock).mockReturnValueOnce({ currentUser: null });
    (Keychain.getGenericPassword as jest.Mock).mockResolvedValueOnce(false);
    (RNFS.readFile as jest.Mock).mockReset().mockResolvedValueOnce(JSON.stringify({ iv: 'iv', cipher: 'cipher' }));

    const docMeta: any = {
      id: 'missing-key-meta',
      references: [{ source: 'local', localPath: '/tmp/payload.json', type: 'text/plain', name: 'f.txt' }],
    };

    await expect(decryptDocumentPayload(docMeta)).rejects.toThrow('Missing encrypted key metadata for this document.');
  });

  test('decryptDocumentPayload throws when recovery passphrase is missing', async () => {
    const crypto = jest.requireMock('../../../../src/services/crypto/documentCrypto');
    (getAuth as jest.Mock).mockReturnValueOnce({ currentUser: null });
    (Keychain.getGenericPassword as jest.Mock).mockResolvedValueOnce(false);
    (crypto.getRecoveryPassphrase as jest.Mock).mockResolvedValueOnce(null);
    (RNFS.readFile as jest.Mock).mockReset().mockResolvedValueOnce(JSON.stringify({ iv: 'iv', cipher: 'cipher' }));

    const docMeta: any = {
      id: 'missing-recovery-pass',
      encryptedDocKey: { cipher: 'c', iv: 'i', salt: 's', wrapMode: 'recovery' },
      references: [{ source: 'local', localPath: '/tmp/payload.json', type: 'text/plain', name: 'f.txt' }],
    };
    await expect(decryptDocumentPayload(docMeta)).rejects.toThrow('Missing recovery passphrase.');
  });

  test('decryptDocumentPayload throws on invalid recovered key format', async () => {
    const crypto = jest.requireMock('../../../../src/services/crypto/documentCrypto');
    (getAuth as jest.Mock).mockReturnValueOnce({ currentUser: null });
    (Keychain.getGenericPassword as jest.Mock).mockResolvedValueOnce(false);
    (crypto.getRecoveryPassphrase as jest.Mock).mockResolvedValueOnce('recovery-pass');
    (crypto.unwrapDocumentKey as jest.Mock).mockResolvedValueOnce('invalid-key');
    (RNFS.readFile as jest.Mock).mockReset().mockResolvedValueOnce(JSON.stringify({ iv: 'iv', cipher: 'cipher' }));

    const docMeta: any = {
      id: 'invalid-recovered-key',
      encryptedDocKey: { cipher: 'c', iv: 'i', salt: 's', wrapMode: 'recovery' },
      references: [{ source: 'local', localPath: '/tmp/payload.json', type: 'text/plain', name: 'f.txt' }],
    };
    await expect(decryptDocumentPayload(docMeta)).rejects.toThrow('Recovered key has invalid format.');
  });

  test('decryptDocumentPayload succeeds and returns integrity metadata', async () => {
    const crypto = jest.requireMock('../../../../src/services/crypto/documentCrypto');
    (getAuth as jest.Mock).mockReturnValueOnce({ currentUser: null });
    (Keychain.getGenericPassword as jest.Mock).mockResolvedValueOnce({ password: 'AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA=' });
    (crypto.decryptBase64Payload as jest.Mock).mockResolvedValueOnce('plain-b64');

    const docMeta: any = {
      id: 'ok-decrypt',
      references: [
        {
          source: 'local',
          localPath: '/tmp/payload.json',
          type: 'text/plain',
          name: 'f.txt',
          order: 0,
          integrityTag: 'tag-1',
        },
      ],
    };
    (RNFS.readFile as jest.Mock).mockResolvedValueOnce(
      JSON.stringify({ iv: 'iv', cipher: 'cipher', algorithm: 'AES-256-CBC', authTag: 'tag-1' }),
    );

    const result = await decryptDocumentPayload(docMeta, 0);
    expect(result.base64).toBe('plain-b64');
    expect(result.fileHash).toBe('tag-1');
  });

  test('decryptDocumentPayload resolves key from inline active share grant', async () => {
    const crypto = jest.requireMock('../../../../src/services/crypto/documentCrypto');
    (getAuth as jest.Mock).mockReturnValue({
      currentUser: { uid: 'shared-user', email: 'shared@example.com' },
    });
    (Keychain.getGenericPassword as jest.Mock).mockResolvedValueOnce(false);
    (crypto.unwrapDocumentKeyFromShareEnvelope as jest.Mock).mockResolvedValueOnce('AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA=');
    (crypto.decryptBase64Payload as jest.Mock).mockResolvedValueOnce('plain-b64');

    const docMeta: any = {
      id: 'inline-grant-doc',
      sharedKeyGrants: [
        {
          recipientUid: 'shared-user',
          recipientEmail: 'shared@example.com',
          allowExport: true,
          wrappedKeyCipher: 'wrapped-inline',
          keyWrapAlgorithm: 'RSA-OAEP-SHA256',
          createdAt: new Date().toISOString(),
          expiresAt: new Date(Date.now() + 60_000).toISOString(),
        },
      ],
      references: [{ source: 'local', localPath: '/tmp/payload.json', type: 'text/plain', name: 'f.txt' }],
    };

    const result = await decryptDocumentPayload(docMeta);
    expect(crypto.unwrapDocumentKeyFromShareEnvelope).toHaveBeenCalled();
    expect(result.base64).toBe('plain-b64');
  });

  test('decryptDocumentPayload resolves key from grant fetched by recipient email when direct uid grant is missing', async () => {
    const crypto = jest.requireMock('../../../../src/services/crypto/documentCrypto');
    (getAuth as jest.Mock).mockReturnValueOnce({
      currentUser: { uid: 'shared-user', email: 'shared@example.com' },
    });
    (Keychain.getGenericPassword as jest.Mock).mockResolvedValueOnce(false);
    // First getDoc call from getDocShareGrant returns no uid-specific grant
    (getDoc as jest.Mock).mockResolvedValueOnce({ exists: () => false });
    // Fallback email query returns matching grant document
    (getDocs as jest.Mock).mockResolvedValueOnce({
      docs: [
        {
          data: () => ({
            recipientUid: 'shared-user',
            recipientEmail: 'shared@example.com',
            allowExport: true,
            wrappedKeyCipher: 'wrapped-email',
            keyWrapAlgorithm: 'RSA-OAEP-SHA256',
            createdAt: new Date().toISOString(),
            expiresAt: new Date(Date.now() + 60_000).toISOString(),
          }),
        },
      ],
    });
    (crypto.unwrapDocumentKeyFromShareEnvelope as jest.Mock).mockResolvedValueOnce('AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA=');
    (crypto.decryptBase64Payload as jest.Mock).mockResolvedValueOnce('plain-b64');

    const docMeta: any = {
      id: 'email-grant-doc',
      sharedKeyGrants: [],
      references: [{ source: 'local', localPath: '/tmp/payload.json', type: 'text/plain', name: 'f.txt' }],
    };

    const result = await decryptDocumentPayload(docMeta);
    expect(crypto.unwrapDocumentKeyFromShareEnvelope).toHaveBeenCalled();
    expect(result.base64).toBe('plain-b64');
  });

  test('decryptDocumentPayload throws when fetched share grant is inactive', async () => {
    (getAuth as jest.Mock).mockReturnValueOnce({
      currentUser: { uid: 'shared-user', email: undefined },
    });
    (Keychain.getGenericPassword as jest.Mock).mockResolvedValueOnce(false);
    (getDoc as jest.Mock).mockResolvedValueOnce({
      exists: () => true,
      data: () => ({
        recipientUid: 'shared-user',
        allowExport: true,
        wrappedKeyCipher: 'wrapped-old',
        keyWrapAlgorithm: 'RSA-OAEP-SHA256',
        createdAt: new Date(Date.now() - 120_000).toISOString(),
        expiresAt: new Date(Date.now() - 60_000).toISOString(),
      }),
    });

    const docMeta: any = {
      id: 'inactive-grant-doc',
      sharedKeyGrants: [],
      references: [{ source: 'local', localPath: '/tmp/payload.json', type: 'text/plain', name: 'f.txt' }],
    };

    await expect(decryptDocumentPayload(docMeta)).rejects.toThrow('Your shared access has expired or was revoked.');
  });

  test('decryptDocumentPayload throws missing encrypted key metadata when no uid/email grant exists', async () => {
    (getAuth as jest.Mock).mockReturnValueOnce({
      currentUser: { uid: 'shared-user', email: undefined },
    });
    (Keychain.getGenericPassword as jest.Mock).mockResolvedValueOnce(false);
    (getDoc as jest.Mock).mockResolvedValueOnce({ exists: () => false });

    const docMeta: any = {
      id: 'missing-meta-via-no-email',
      sharedKeyGrants: [],
      references: [{ source: 'local', localPath: '/tmp/payload.json', type: 'text/plain', name: 'f.txt' }],
    };

    await expect(decryptDocumentPayload(docMeta)).rejects.toThrow('Missing encrypted key metadata for this document.');
  });

  test('hasLocalEncryptedCopy reflects local reference presence', () => {
    expect(hasLocalEncryptedCopy({ id: 'x', references: [] } as any)).toBe(false);
    expect(
      hasLocalEncryptedCopy({ id: 'x', references: [{ source: 'local', localPath: '/tmp/p' }] } as any),
    ).toBe(true);
  });

  test('exportDocumentToDevice writes decrypted payload to file', async () => {
    const crypto = jest.requireMock('../../../../src/services/crypto/documentCrypto');
    (getAuth as jest.Mock).mockReturnValueOnce({ currentUser: null });
    (Keychain.getGenericPassword as jest.Mock).mockResolvedValueOnce({ password: 'AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA=' });
    (crypto.decryptBase64Payload as jest.Mock).mockResolvedValueOnce('plain-b64');

    const docMeta: any = {
      id: 'exp-1',
      references: [
        { source: 'local', localPath: '/tmp/payload.json', type: 'text/plain', name: 'f.txt', order: 0 },
      ],
    };
    (RNFS.readFile as jest.Mock).mockResolvedValueOnce(JSON.stringify({ iv: 'iv', cipher: 'cipher' }));

    const outputPath = await exportDocumentToDevice(docMeta, 0);
    expect(RNFS.writeFile).toHaveBeenCalledWith(expect.any(String), 'plain-b64', 'base64');
    expect(outputPath).toContain('f.txt');
  });

  test('updateDocumentRecoveryPreference writes firebase metadata for recoverable=true', async () => {
    const crypto = jest.requireMock('../../../../src/services/crypto/documentCrypto');
    (getAuth as jest.Mock).mockReturnValueOnce({ currentUser: null });
    (crypto.getRecoveryPassphrase as jest.Mock).mockResolvedValueOnce('recovery-pass');
    (crypto.wrapDocumentKey as jest.Mock).mockResolvedValueOnce('wrapped-recovery');

    const docMeta: any = {
      id: 'r3',
      references: [{ source: 'firebase', storagePath: 's' }],
      owner: 'owner-123',
      encryptedDocKey: { cipher: 'c', iv: 'i' },
    };

    const res = await updateDocumentRecoveryPreference(docMeta, true);
    expect(setDoc).toHaveBeenCalled();
    expect(res.recoverable).toBe(true);
  });
});
