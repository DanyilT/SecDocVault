# SecDocVault

> SecDocVault is a React Native secure document vault prototype. It demonstrates
end-to-end encrypted file storage with options for local-only guest mode,
cloud-backed mode using Firebase (Auth / Firestore / Storage), document
sharing, and key backup/recovery flows.

**This README contains:**
- A short feature list
- Simple (non-technical) explanations of how each feature works
- A deeper technical explanation for developers
- How to get started (run / build / Firebase setup)
- Tests & coverage
- Copyright & attribution

---

## Table of contents
1. [Features](#features)
2. [How it works](#how-it-works) (plain English)
3. [How it works](#how-it-works-technical-details) (technical details)
   - [Project structure / key files](#project-structure--key-files)
4. [Feature reference — service-level](#feature-reference--service-level-detailed) (detailed)
5. [Getting started](#getting-started)
   - [Firebase setup](#firebase-setup)
6. [Tests and test coverage](#testing)
7. [Copyright & attribution](#copyright--attribution)

---

## Features

**Core features:**
- Local guest vault (encrypted local-only storage)
- Cloud vault (Firebase Authentication + Storage + Firestore)
- Scan or pick images / documents and upload
- Per-document encryption (each document has its own AES key)
- Offline caching / save-for-offline
- Document preview & export
- Document sharing with wrapped key grants
- Key backup & recovery (recoverable passphrase + cloud backup)
- Multiple protection modes: passkey, PIN, biometric

## How it works

**Uploading**
- User choose to scan with the camera or pick an existing file.
- The app encrypts the file on your device before it leaves the phone.
- If user upload to the cloud, the encrypted file is stored in Firebase Storage
  and the document metadata (name, size, owner, references) is stored in
  Firestore. A wrapped version of the document key is stored with metadata so
  only authorized users can decrypt later.

**Encrypting / Decrypting**
- When a document is added, a random document key is generated for that
  document. Each file within a document is encrypted with that key and a
  per-file IV. The raw document key may be stored in the device keychain for
  convenience (device-local), and a wrapped (encrypted) envelope of the key is
  stored in Firestore so other devices or recipients can unwrap it if they
  have appropriate credentials.
- Decryption happens on-device: the wrapped key is unwrapped using the
  device's KDF material or recovery passphrase and the files are decrypted in
  memory for preview or export.

**Saving (local & cloud)**
- Local (guest/local mode): encrypted payloads and metadata are written to the
  device filesystem. Nothing is uploaded.
- Cloud (Firebase): encrypted payloads are uploaded to Firebase Storage and a
  Firestore document stores metadata including references to the storage
  objects, wrapped key envelope and flags such as `offlineAvailable`/`saveMode`.

**Sharing**
- Sharing creates a share grant which contains a wrapped shared key of the
  document key for the recipient, plus metadata such as expiry and
  permissions (e.g., allow export). The share grant lets another authenticated
  user unwrap the document key and decrypt the file locally.

**Key backup & recovery**
- The app supports creating a recoverable backup of key material. A
  random passphrase is generated and/or you can back up KDF material to
  Firestore (encrypted). This allows re-wrapping and recovering document keys
  on a new device when the owner provides the passphrase.

**Authentication**
- Guest mode: no Firebase auth, all data stays local on device.
- Cloud mode: Firebase Authentication (email/password, email link flows, etc.)
  provides the user's identity. The app also supports local protections
  (passkey, PIN, biometric) to unlock the vault even when logged in.

## How it works (technical details)

> This section is intended for developers and reviewers who want a deeper look
into how the app is implemented.

**High-level architecture**
- UI: React Native screens are in `src/screens/` and app controller logic lives
  in `src/app/controllers`.
- Services: Vault and key backup logic sits under `src/services/` (notably
  `documentVault/` and `keyBackup.ts`). These modules wrap Firebase and
  filesystem primitives and implement encryption logic.
- Storage: encrypted file blobs stored in Firebase Storage; metadata in
  Firestore. Local encrypted copies are stored using `react-native-fs`.
- Crypto: Per-document keys, wrapping/unwrapping, PBKDF2-based KDF and
  AES-based file encryption are implemented in `src/services/documentVault/crypto`.

**Upload flow (detailed)**
1. User picks or scans files (adapters: `pickDocumentForUpload`,
   `scanDocumentForUpload`).
2. A random per-document key is generated. For each file, an IV is generated
   _(Note: same key used for each file in the same document)_.
3. File bytes are read from disk (RNFS) and encrypted on-device. The code
   supports streaming/chunked reads for large files.
4. Encrypted payloads are uploaded to Firebase Storage. The app emits
   per-file progress events to the UI (`UploadProgressEvent`).
5. A wrapped key envelope is created by deriving a wrapping key (PBKDF2-like
   KDF) and storing the wrapped envelope in the Firestore document alongside
   other metadata.
6. Firestore document contains: file references (storage paths), hashed
   metadata (digest), human-friendly size and date strings, owner UID,
   `encryptedDocKey` envelope and flags such as `offlineAvailable`/`saveMode`.

**Encryption details**
- Files are encrypted on-device before upload. The implementation uses a
  crypto runtime (attempts to use `react-native-quick-crypto` where available)
  or a fallback. Encryption produces per-file IVs and (when applicable)
  authentication tags. The envelope stored in Firestore contains the wrapped
  key and KDF parameters necessary for unwrapping on another device.

**Sharing details**
- When creating a share, the app ensures the recipient has a public key (or
  generates/requests one). The document key is re-wrapped for the recipient
  and a `VaultSharedKeyGrant` entry is appended to Firestore. Share grants
  include allowExport and expiry metadata and can be revoked.

**Key backup details**
- The key backup flow generates KDF material and a human-friendly
  passphrase. Backup metadata can be stored in Firestore (per-owner doc in a
  `vaultKeyBackups` collection). Functions such as `downloadKeyBackupFile` and
  `deleteKeyBackupFromFirebase` exist in `src/services/keyBackup.ts`.

**Auth & session protection**
- Auth context is centralized in `src/context/AuthContext.tsx`. It bridges
  Firebase auth state and local protection state (PIN/biometric/passkey)
  and exposes helper actions to the rest of the app. The app supports
  unlocking the vault via device protection methods while still using
  Firebase identity for cloud features.

**Project caveats & limits**
- Maximum file size limits and per-document file limits are enforced in the
  upload service (`MAX_FILES_PER_DOCUMENT`, `MAX_UPLOAD_FILE_BYTES`).
- Large files are read and encrypted in chunks to avoid excessive memory
  pressure. The code contains constants such as `LARGE_FILE_THRESHOLD_BYTES`.

### Project structure / key files
- `App.tsx` - app shell and top-level wiring (auth provider, router)
- `src/context/AuthContext.tsx` - authentication & session protection
- `src/screens/*` - UI screens (MainScreen, PreviewScreen, ShareScreen, etc.)
- `src/services/documentVault/` - upload, storage, sharing, query helpers
- `src/services/keyBackup.ts` - key backup and recovery utilities
- `src/storage/localVault.ts` - local vault persistence helpers
- `src/firebase/project.ts` - central Firebase project constants

---

## Feature reference — service-level (detailed)

> This section maps user-facing features to the service modules that implement
them and describes the exact responsibilities, key entry points, and
important constants you should know when working on each feature.

1) **Uploading (scan / pick / upload)**
- Non-technical: Users scan with the camera or pick files from the library;
  the app encrypts files on-device and either saves them locally or uploads
  the encrypted blobs to Firebase Storage.
- Developer notes:
  - Files: `src/services/documentVault/upload.ts`, `src/services/documentVault/types.ts`
  - Key functions: `pickDocumentForUpload`, `scanDocumentForUpload`,
    `uploadDocumentToFirebase`, `documentSaveLocal`.
  - Constants: `MAX_FILES_PER_DOCUMENT`, `MAX_UPLOAD_FILE_BYTES`,
    `LARGE_FILE_THRESHOLD_BYTES`, `DEFAULT_CONCURRENCY_LIMIT`.
  - Flow: create document draft -> generate doc key -> read file(s) via RNFS
    (chunked if large) -> encrypt via `documentCrypto.encryptBase64Payload`
    -> upload to Storage -> persist Firestore metadata.
  - Progress/events: `UploadProgressEvent` emitted during read/encrypt/upload.

2) **Encrypting / Decrypting**
- Non-technical: Files are encrypted before leaving the device. Keys are
  wrapped and stored so authorized devices can decrypt later.
- Developer notes:
  - Files: `src/services/crypto/documentCrypto.ts` and `src/services/documentVault/upload.ts`.
  - Key functions: `encryptBase64Payload`, `decryptBase64Payload`,
    `wrapDocumentKey`, `unwrapDocumentKey`.
  - Algorithms: AES-256-GCM for new envelopes; legacy AES-CBC support for
    compatibility. PBKDF2-SHA256 used for deriving wrapping keys.
  - Important: encryption happens on-device; never log or transmit raw keys.

3) **Saving (local vs cloud)**
- Non-technical: Users can keep encrypted copies only on the device (guest)
  or store encrypted blobs in Firebase for cross-device access.
- Developer notes:
  - Files: `src/services/documentVault/upload.ts`, `src/storage/localVault.ts`, `src/services/documentVault/storage.ts`.
  - Key functions: `documentSaveLocal`, `saveDocumentOffline` (service-level),
    Firestore writes in `saveDocumentToFirebase`/`uploadDocumentToFirebase`.
  - Metadata: Firestore documents include `references` (storage paths),
    `encryptedDocKey`, `owner`, `fileCount`, `saveMode`, `offlineAvailable`.

4) **Sharing**
- Non-technical: Sharing issues a recipient-specific wrapped key grant so a
  recipient can decrypt files without the sender exposing raw keys.
- Developer notes:
  - Files: `src/services/documentVault/sharing.ts`, `src/services/documentVault/shareGrants.ts`.
  - Key functions: `createDocumentShareGrant`, `revokeDocumentShareGrant`,
    `ensureCurrentUserSharePublicKey`.
  - Crypto: Uses RSA-OAEP-SHA256 to wrap document keys for recipients
    (`documentCrypto.wrapDocumentKeyForRecipient`). Public keys are stored in
    AsyncStorage; private keys in Keychain.
  - Firestore: Share grants are stored as entries on document metadata so
    queries such as `listVaultDocumentsSharedWithUser` can surface incoming shares.

5) **Key backup & recovery**
- Non-technical: Users can back up a recoverable envelope of their document
  keys to Firestore protected by a passphrase. On a new device they provide the
  passphrase to restore keys.
- Developer notes:
  - Files: `src/services/keyBackup.ts` and `src/services/crypto/documentCrypto.ts`.
  - Key functions: `backupKeysToFirebase`, `restoreKeysFromFirebase`,
    `downloadPassphraseFile` (not using), `downloadKeyBackupFile` (not using), `ensureRecoveryPassphrase`.
  - Flow: collect per-document keys (Keychain or unwrap from device wrap) →
    re-wrap with recovery passphrase → persist `vaultKeyBackups/<ownerId>`.
  - Important helpers: `resolveDocumentKeyForBackup` tries Keychain -> device
    KDF unwrap -> recovery-passphrase unwrap.

6) **Authentication & session protection**
- Non-technical: App supports guest local-only mode and Firebase-based cloud
  sessions. Additionally, uses local device protections (passkey/PIN/biometric)
  to gate access to the vault UI.
- Developer notes:
  - Files: `src/context/AuthContext.tsx`, `src/firebase/project.ts`.
  - Firebase: `@react-native-firebase/auth` used for cloud sign-in flows;
    `FIREBASE_AUTH_EMAIL_LINK_URL` configured for hosting-based email links.
  - Local protections: Keychain stores KDF/passphrase material and per-doc
    convenience keys; UI flows call into AuthContext hooks for unlock flows.

7) **Preview & export**
- Non-technical: User can preview decrypted document files and export them
  to device storage if allowed.
- Developer notes:
  - Files: `src/screens/PreviewScreen.tsx`, `src/services/documentVault/storage.ts`, `src/services/documentVault/upload.ts` (decrypt helpers are exported).
  - Key functions: `decryptDocumentPayload`, `exportDocumentToDevice`.
  - Permissions: `canCurrentUserExportDocument` guards export based on share/grants.

8) **Offline & local vault**
- Non-technical: Guest mode keeps everything local; cloud mode can cache
  encrypted payloads for offline decrypt.
- Developer notes:
  - Files: `src/storage/localVault.ts`, `src/services/documentVault/storage.ts`.
  - Functions: `hasLocalEncryptedCopy`, `removeLocalDocumentCopy`,
    `getLocalDocuments`, `saveLocalDocuments`.

9) **Progress, events & errors**
- Non-technical: Uploads and long-running operations surface progress and
  status messages to the UI. Errors are surfaced to the user and logged.
- Developer notes:
  - Types: `UploadProgressEvent` (in `documentVault/types.ts`) used by
    `uploadDocumentToFirebase` to report stages: `read`, `encrypt`, `upload`, `wrap`.
  - Retries & concurrency: `upload.ts` controls concurrency; implement retry
    logic around Storage upload failures if needed.

**Where to change behavior**
- Upload pipeline: edit `src/services/documentVault/upload.ts`.
- Low-level crypto: edit `src/services/crypto/documentCrypto.ts` (careful,
  breaking changes impact envelopes and compatibility).
- Backups: edit `src/services/keyBackup.ts`.

---

## Getting started

**Prerequisites**
- Node.js (recommended 18, 20 or 22)
- Yarn or npm
- Android Studio + SDK to run Android, Xcode for iOS
- For Firebase features: a Firebase project and platform config files

**Install dependencies**
```bash
npm install
```

Run packager
```bash
npm start
```

**Run on Android / iOS**
```bash
npm run android
npm run ios
```

**Notes**
- The project uses React Native Firebase modules (@react-native-firebase/*).
- To use crypto acceleration, install and configure
  `react-native-quick-crypto` on your native projects.

### Firebase setup

This app is configured to use a Firebase project with id:

`docvault-third-year-project`

**Key setup steps**
1. Create or open the Firebase console project `docvault-third-year-project`.
2. Enable Authentication methods (Email/Password, Email link).
3. Ensure `storage.rules`, `firestore.rules` and `firestore.indexes.json` configured.
4. Download Android config and put it at `android/app/google-services.json`.
5. Download iOS config and add it to `ios/SecDocVault/GoogleService-Info.plist`
   and your Xcode target resources.

**Hosting (email link verification)**
- Hosting is configured in `firebase.json` and expected to publish to the
  hosting site `docvault-third-year-project` (see `firebase.json`). The app
  uses an email-link continue URL such as:

  `https://docvault-third-year-project.web.app/auth/email-link`

**Deploy hosting**
```bash
# install firebase tools (if not already installed)
npm install -g firebase-tools

# login and select project
firebase login
firebase use docvault-third-year-project

# deploy hosting
firebase deploy --only hosting
```

**Common Firebase commands**
```bash
# Deploy Firestore rules and indexes
firebase deploy --only firestore:rules,firestore:indexes

# Deploy storage rules
firebase deploy --only storage

# Deploy entire project (hosting + firestore + storage)
firebase deploy
```

## Testing

**Run tests with Jest (project already includes a test suite under `__tests__`):**
```bash
npm test -- --watch=false
```

**Generate coverage report**
```bash
# run jest with coverage
npm test -- --coverage --watch=false

# results will be in coverage/ directory
```

**Notes about tests**
- The project contains many unit and integration-style tests under `__tests__`.
- Services that require Firebase or filesystem are frequently mocked in tests
  so tests can run in CI without actual cloud access.

**Test coverage**
- Coverage depends on which tests you run. Running `--coverage` will produce
  an HTML report in `coverage/` and a summary in the terminal.

---

## Copyright & attribution

SecDocVault

Copyright © 2026 [Danyil Tymchuk](https://github.com/DanyilT), [Illia Stefanovskyi](https://github.com/IlliaStefanovskyi), [Artem Surzhenko](https://github.com/artemsa223)

License: This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.
