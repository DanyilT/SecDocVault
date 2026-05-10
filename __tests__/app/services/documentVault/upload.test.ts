import {
  pickDocumentForUpload,
  scanDocumentForUpload,
  uploadDocumentToFirebase,
  documentSaveLocal,
} from '../../../../src/services/documentVault/upload';

import { launchImageLibrary, launchCamera } from 'react-native-image-picker';
import { getDocs, setDoc } from '@react-native-firebase/firestore';
import { uploadString } from '@react-native-firebase/storage';
import RNFS from 'react-native-fs';
import * as Keychain from 'react-native-keychain';
import { getOrCreateKdfMaterial, wrapDocumentKey, encryptBase64Payload } from '../../../../src/services/crypto/documentCrypto';

jest.mock('react-native-image-picker', () => ({
  launchImageLibrary: jest.fn(),
  launchCamera: jest.fn(),
}));

jest.mock('@react-native-firebase/app', () => ({
  getApp: jest.fn(() => ({})),
}));

jest.mock('@react-native-firebase/firestore', () => ({
  getFirestore: jest.fn(),
  collection: jest.fn(),
  doc: jest.fn(() => ({ id: 'mock-doc-id' })),
  query: jest.fn(),
  where: jest.fn(),
  getDocs: jest.fn(),
  setDoc: jest.fn(),
  serverTimestamp: jest.fn(() => 'mock-timestamp'),
}));

jest.mock('@react-native-firebase/storage', () => ({
  getStorage: jest.fn(),
  ref: jest.fn(() => 'mock-storage-ref'),
  uploadString: jest.fn(),
  deleteObject: jest.fn(),
}));

jest.mock('react-native-keychain', () => ({
  setGenericPassword: jest.fn().mockResolvedValue(true),
  resetGenericPassword: jest.fn().mockResolvedValue(true),
  ACCESSIBLE: { WHEN_UNLOCKED_THIS_DEVICE_ONLY: 'mock-accessible' },
}));

jest.mock('react-native-fs', () => ({
  readFile: jest.fn(),
  mkdir: jest.fn(),
  writeFile: jest.fn(),
  stat: jest.fn(() => ({ size: 100 })),
  read: jest.fn(),
  exists: jest.fn(),
  unlink: jest.fn(),
  DocumentDirectoryPath: '/mock/path',
}));

jest.mock('react-native-get-random-values', () => ({}));

jest.mock('../../../../src/services/crypto/documentCrypto', () => ({
  ...jest.requireActual('../../../../src/services/crypto/documentCrypto'),
  getOrCreateKdfMaterial: jest.fn(),
  getRecoveryPassphrase: jest.fn(),
  wrapDocumentKey: jest.fn(),
  encryptBase64Payload: jest.fn(),
  toBase64: jest.fn(() => 'mock-base64-key'),
  randomWordArray: jest.fn(() => []),
  MissingKdfPassphraseError: class MissingKdfPassphraseError extends Error {},
}));

describe('Document Vault Upload Services', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('pickDocumentForUpload', () => {
    it('throws error if selection is cancelled', async () => {
      (launchImageLibrary as jest.Mock).mockResolvedValueOnce({ didCancel: true });
      await expect(pickDocumentForUpload()).rejects.toThrow('Selection was cancelled.');
    });

    it('returns normalized document when image selected', async () => {
      (launchImageLibrary as jest.Mock).mockResolvedValueOnce({
        assets: [{ uri: 'file://path/to/image.jpg', fileName: 'image.jpg', fileSize: 1024, type: 'image/jpeg' }],
      });
      const result = await pickDocumentForUpload();
      expect(result.uri).toBe('file://path/to/image.jpg');
      expect(result.size).toBe(1024);
      expect(result.type).toBe('image/jpeg');
      expect(result.name).toMatch(/^doc-\d+\.jpg$/);
    });
  });

  describe('scanDocumentForUpload', () => {
    it('throws error if scan is cancelled', async () => {
      (launchCamera as jest.Mock).mockResolvedValueOnce({ didCancel: true });
      await expect(scanDocumentForUpload()).rejects.toThrow('Scan was cancelled.');
    });

    it('returns normalized document when image scanned', async () => {
      (launchCamera as jest.Mock).mockResolvedValueOnce({
        assets: [{ uri: 'file://path/to/scan.png', fileName: 'scan.png', fileSize: 2048, type: 'image/png' }],
      });
      const result = await scanDocumentForUpload();
      expect(result.uri).toBe('file://path/to/scan.png');
      expect(result.size).toBe(2048);
      expect(result.type).toBe('image/png');
    });
  });

  describe('uploadDocumentToFirebase', () => {
    const mockUser = 'user-123';
    const mockDraft = {
      name: 'Test Doc',
      description: 'Test Desc',
      files: [
        { name: 'file1.txt', uri: 'file://path/1', size: 100, type: 'text/plain' },
      ],
    };

    beforeEach(() => {
      (getDocs as jest.Mock).mockResolvedValue({ size: 0 }); // under limit
      (getOrCreateKdfMaterial as jest.Mock).mockResolvedValue({ passphrase: 'kdf', salt: 'salt' });
      (wrapDocumentKey as jest.Mock).mockResolvedValue('wrapped-key-env');
      (RNFS.readFile as jest.Mock).mockResolvedValue('file-base64');
      (encryptBase64Payload as jest.Mock).mockResolvedValue({
        version: 1,
        algorithm: 'AES-256-GCM',
        iv: 'iv',
        cipher: 'cipher',
        authTag: 'tag',
        key: 'key',
      });
      (RNFS.stat as jest.Mock).mockResolvedValue({ size: 100 });
    });

    it('throws if no files selected', async () => {
      await expect(uploadDocumentToFirebase(mockUser, { ...mockDraft, files: [] }))
        .rejects.toThrow('No files selected for upload.');
    });

    it('throws if file is too large', async () => {
      const hugeFile = { ...mockDraft.files[0], size: 15 * 1024 * 1024 };
      await expect(uploadDocumentToFirebase(mockUser, { ...mockDraft, files: [hugeFile] }))
        .rejects.toThrow(/exceeds the 10 MB upload limit/);
    });

    it('throws if cloud limit reached', async () => {
      (getDocs as jest.Mock).mockResolvedValueOnce({ size: 10 });
      await expect(uploadDocumentToFirebase(mockUser, mockDraft))
        .rejects.toThrow('Cloud upload limit reached: maximum 10 documents per user.');
    });

    it('successfully uploads and stores metadata', async () => {
      const result = await uploadDocumentToFirebase(mockUser, mockDraft);
      
      expect(uploadString).toHaveBeenCalled();
      expect(setDoc).toHaveBeenCalled();
      expect(Keychain.setGenericPassword).toHaveBeenCalledWith(
        'mock-doc-id',
        'mock-base64-key',
        expect.any(Object)
      );

      expect(result.document.id).toBe('mock-doc-id');
      expect(result.document.encryptedDocKey).toBe('wrapped-key-env');
      expect(result.document.saveMode).toBe('firebase');
      expect(result.document.references.length).toBe(1);
      expect(result.document.references[0].storagePath).toContain('vault/user-123/mock-doc-id/file1.txt.enc');
    });

    it('also saves local if option is passed', async () => {
      await uploadDocumentToFirebase(mockUser, mockDraft, { alsoSaveLocal: true });
      expect(RNFS.writeFile).toHaveBeenCalled();
      expect(RNFS.mkdir).toHaveBeenCalled();
    });

    it('cleans up on failure', async () => {
      (uploadString as jest.Mock).mockRejectedValueOnce(new Error('Upload failed'));
      await expect(uploadDocumentToFirebase(mockUser, mockDraft)).rejects.toThrow('Upload failed');
      expect(Keychain.resetGenericPassword).toHaveBeenCalled();
    });
  });

  describe('documentSaveLocal', () => {
    const mockUser = 'user-123';
    const mockDraft = {
      name: 'Local Doc',
      description: 'Local Desc',
      files: [
        { name: 'local.txt', uri: 'file://local/1', size: 50, type: 'text/plain' },
      ],
    };

    beforeEach(() => {
      (getOrCreateKdfMaterial as jest.Mock).mockResolvedValue({ passphrase: 'kdf', salt: 'salt' });
      (wrapDocumentKey as jest.Mock).mockResolvedValue('wrapped-key-env');
      (RNFS.readFile as jest.Mock).mockResolvedValue('file-base64');
      (encryptBase64Payload as jest.Mock).mockResolvedValue({
        version: 1,
        algorithm: 'AES-256-GCM',
        iv: 'iv',
        cipher: 'cipher',
        authTag: 'tag',
        key: 'key',
      });
    });

    it('throws if no files', async () => {
      await expect(documentSaveLocal(mockUser, { ...mockDraft, files: [] }))
        .rejects.toThrow('No files selected for local save.');
    });

    it('saves files locally and returns metadata', async () => {
      const result = await documentSaveLocal(mockUser, mockDraft);
      expect(RNFS.writeFile).toHaveBeenCalled();
      expect(Keychain.setGenericPassword).toHaveBeenCalled();
      expect(result.document.saveMode).toBe('local');
      expect(result.document.offlineAvailable).toBe(true);
      expect(result.document.references[0].source).toBe('local');
    });
  });
});
