import { randomBytes, createCipheriv, createDecipheriv, pbkdf2Sync } from 'react-native-quick-crypto';
import { Buffer } from '@craftzdog/react-native-buffer';

export type EncryptedImage = {
  fileName: string;
  iv: string;
  ciphertext: string;
};

// Generates a random 256 bit AES key as a hex string
export function generateAesKey(): string {
  return (randomBytes(32) as Buffer).toString('hex');
}

// Encrypts a base64-encoded image with the given hex key using AES-256-CBC
// Generates a fresh random 128-bit IV per image
export function encryptImage(base64Data: string, keyHex: string,): 
{ iv: string; ciphertext: string } {
  const key = Buffer.from(keyHex, 'hex');
  const iv = randomBytes(16) as Buffer;
  const data = Buffer.from(base64Data, 'base64');

  const cipher = createCipheriv('aes-256-cbc', key, iv);
  const encrypted = Buffer.concat([
    cipher.update(data) as Buffer,
    cipher.final() as Buffer,
  ]);

  return {
    iv: iv.toString('hex'),
    ciphertext: encrypted.toString('base64'),
  };
}

// Decrypts an AES-256-CBC encrypted image and returns base64 image data
export function decryptImage(ciphertext: string, ivHex: string, keyHex: string): string {
  const key = Buffer.from(keyHex, 'hex');
  const iv = Buffer.from(ivHex, 'hex');

  const decipher = createDecipheriv('aes-256-cbc', key, iv);
  const decrypted = Buffer.concat([
    decipher.update(Buffer.from(ciphertext, 'base64')) as Buffer,
    decipher.final() as Buffer,
  ]);

  return decrypted.toString('base64');
}

// Derives a 256 bit AES key from a passphrase using PBKDF2-SHA256
export function deriveKey(passphrase: string, keySalt: Buffer): Buffer {
  return pbkdf2Sync(passphrase, keySalt, 100000, 32, 'sha256') as Buffer;
}

// Encrypts a hex AES key with a passphrase-derived wrapping key (AES-256-CBC)
// A single random salt is used for both PBKDF2 and as the AES IV
export function encryptAesKey(keyHex: string, passphrase: string): 
{ encryptedKey: string; keySalt: string } {
  const salt = randomBytes(16) as Buffer;
  const wrappingKey = deriveKey(passphrase, salt);

  const cipher = createCipheriv('aes-256-cbc', wrappingKey, salt);
  const encrypted = Buffer.concat([
    cipher.update(Buffer.from(keyHex, 'utf8')) as Buffer,
    cipher.final() as Buffer,
  ]);

  return {
    encryptedKey: encrypted.toString('hex'),
    keySalt: salt.toString('hex'),
  };
}

// Decrypt a documment AES key using the passphrase and stored salt
export function decryptAesKey(
  encryptedKey: string,
  passphrase: string,
  saltHex: string,
): string {
  const salt = Buffer.from(saltHex, 'hex');
  const wrappingKey = deriveKey(passphrase, salt);
  const decipher = createDecipheriv('aes-256-cbc', wrappingKey, salt);

  const decrypted = Buffer.concat([
    decipher.update(Buffer.from(encryptedKey, 'hex')) as Buffer,
    decipher.final() as Buffer,
  ]);
  
  return decrypted.toString('utf8');
}
