# SecDocVault

![GitHub release (latest)](https://img.shields.io/github/v/release/danyilt/secdocvault?style=for-the-badge&color=green)
![GitHub tag (latest)](https://img.shields.io/github/v/tag/danyilt/secdocvault?style=for-the-badge)

> SecDocVault is a React Native secure document vault prototype. It demonstrates
end-to-end encrypted file storage with options for local-only guest mode,
cloud-backed mode using Firebase (Auth / Firestore / Storage), document
sharing, and key backup/recovery flows.

> [!TIP]  
> [Project Thesis](https://docs.google.com/document/d/e/2PACX-1vSjvWeF0B4D-PlKXaR7L-09Uw69qxxYfDX5KZZsyWaQcrxzzdwgtgvCEFFWe7Nitk8dF517WG3DiQ4Q/pub) [[pdf]](Project%20Thesis%20%E2%80%94%20Secure%20Documents%20Vault%20Mobile%20Application.pdf)  
> [Presentation (Demo) Link](https://docs.google.com/presentation/d/e/2PACX-1vRv1Sf6hlji7lMislYrcWzvqsWngoUy7O2NZvuFUvIqOPd_qAqp26TQQ4FXlvwmhtqxyTpQrLkp3nD9/pub)
> ```html
> <iframe src="https://docs.google.com/presentation/d/e/2PACX-1vRv1Sf6hlji7lMislYrcWzvqsWngoUy7O2NZvuFUvIqOPd_qAqp26TQQ4FXlvwmhtqxyTpQrLkp3nD9/pubembed" frameborder="0" width="960" height="569" allowfullscreen="true" mozallowfullscreen="true" webkitallowfullscreen="true"></iframe>
> ```

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
- Local guest vault (encrypted local-only storage, upgradeable to a cloud account)
- Cloud vault (Firebase Authentication + Storage + Firestore) with email-link verification
- Scan or pick images / documents and upload (multiple files per document)
- Per-document encryption (each document has its own AES-256 key; each file its own IV)
- Offline caching / save-for-offline
- Document preview & export, editable metadata, AES-GCM integrity tag
- Document sharing with per-recipient RSA-wrapped key grants, expiry (TTL) and revocation
- Automatic document-key rotation and re-encryption when a share is revoked or expires
- Key backup & recovery (5-part recovery passphrase + encrypted cloud backup)
- Censor mode — on-device OCR (ML Kit) plus regex detectors to redact sensitive fields before export/share
- Multiple unlock methods: passkey, PIN, biometric, or none

## How it works

**Uploading**
- User chooses to scan with the camera or picks an existing file.
- The app encrypts the file on your device before it leaves the phone.
- If user uploads to the cloud, encrypted file is stored in Firebase Storage
  and document metadata (name, size, owner, references) is stored in
  Firestore. An encrypted version of the document key is stored with metadata so
  only authorized user can decrypt it, and the document key can be restored with passphrase.

**Encrypting / Decrypting**
- When a document is added, a random 32-byte document key is generated for that
  document. Each file within a document is encrypted with that same key and its
  own per-file IV. The raw (cleartext) document key is stored in the device
  Keychain for fast local decryption, and a wrapped (encrypted) copy of the key
  is stored in Firestore so other devices or recipients can decrypt it if they
  have the appropriate credentials.
- Decryption happens on-device. The document key is resolved in this order:
  1. the raw key held in the Keychain;
  2. for a recipient, the share grant unwrapped with their RSA private key;
  3. the Firestore key envelope unwrapped with the device KDF passphrase;
  4. failing that, the envelope unwrapped with the recovery passphrase.

**Saving (local & cloud)**
- Local (guest/local mode): encrypted payloads and metadata are written to the
  device filesystem. Nothing is uploaded to cloud.
- Cloud (Firebase): encrypted payloads are uploaded to Firebase Storage and a
  Firestore document stores metadata including references to the storage
  objects, encrypted key and flags such as `offlineAvailable`/`saveMode`.

**Sharing**
- Sharing creates a share grant which contains a wrapped shared key of the
  document key for the recipient, plus metadata such as expiry and
  permissions (e.g., allow export). The share grant lets another authenticated
  user unwrap the document key and decrypt the file locally.

**Key backup & recovery**
- The app supports creation of a recoverable backup of key material protected by
  the user's recovery passphrase. The passphrase is either generated (20 random
  bytes rendered as five hyphen-separated 8-character hexadecimal groups, ~160
  bits of entropy) or supplied by the user, and is normalised to lowercase with
  spaces converted to hyphens. Only documents the user has marked as recoverable
  are included. Each document key is re-wrapped under the passphrase and the
  resulting envelopes are stored in Firestore, allowing document keys to be
  recovered on a new device when the owner provides the passphrase.

**Authentication**
- Guest mode: no Firebase auth, all data stays local on device. A guest account
  is created from a password alone (minimum 6 characters) and can later be
  upgraded to a cloud account from Settings. Registering a new guest account
  while one already exists erases the existing local vault first.
- Cloud mode: Firebase Authentication (email/password) provides the user's
  identity. Registration requires email verification via a single-use Firebase
  email link, served from Firebase Hosting, which either deep-links back into
  the app or can be pasted into the registration form.
- The app also supports local unlock methods (passkey, PIN, biometric, or none)
  to gate the vault without re-authenticating on every launch.

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
  AES-based file encryption are implemented in `src/services/crypto/documentCrypto.ts`.
- Censor: on-device OCR and sensitive-span detection live in `src/services/censor/`.

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
- Files are encrypted on device before upload. The implementation requires the
  native `react-native-quick-crypto` runtime; if that module is unavailable the
  crypto helpers throw rather than silently degrading to a weaker path.
  `crypto-js` is retained only for Base64/word-array conversion and for decrypting
  legacy AES-256-CBC payloads.
- New payloads use **AES-256-GCM** with a random 12-byte IV per file and a
  16-byte authentication tag (`version: 2`). AES-GCM is an authenticated
  encryption mode, so a tampered ciphertext fails to decrypt rather than
  returning garbage. Older documents encrypted with the legacy AES-256-CBC
  path have no authentication tag and are decrypt-only.
- The per-file authentication tag is also persisted on the reference as
  `integrityTag` (and the legacy `fileHash` field) and surfaced in the UI.
- Key wrapping uses **PBKDF2-SHA256, 100,000 iterations**, a 16-byte random salt
  and a 32-byte derived key, with the wrapped key sealed under AES-256-GCM. The
  envelope stored in Firestore records `cipher`, `iv`, `authTag`, `salt`,
  `iterations`, `algorithm`, `kdf` and `wrapMode` (`device` or `recovery`).
- Files at or above `LARGE_FILE_THRESHOLD_BYTES` are read and encrypted in
  256 KB chunks through a streaming GCM cipher to bound memory use.

**Sharing details**
- Sharing is by recipient email. The app looks the recipient up in the
  `vaultUsers` collection by `emailLower`; if no profile or no published
  `sharePublicKey` exists the share is refused, so the recipient must have
  signed in at least once. The document key is then wrapped for that recipient
  with **RSA-2048 / OAEP-SHA256** and written to the
  `vault/{docId}/sharedUsers/{recipientUid}` subcollection. Each grant records
  `allowExport`, `createdAt`, `expiresAt` (default 30 days, clamped to 1–365)
  and `revokedAt`.
- The parent document keeps a `sharedWith` array of active recipient uids and
  emails purely as a query index; the authoritative grant lives in the
  subcollection. Collection-group indexes on `sharedUsers.recipientUid` and
  `sharedUsers.recipientEmail` back the "Shared with me" queries.
- **Revocation rotates the key.** `revokeDocumentShareGrant` (and
  `enforceExpiredShareRevocations` for lapsed grants) marks the grant revoked
  and then calls `rotateDocumentKeyAfterShareChange`, which generates a new
  document key, re-encrypts and re-uploads every file, re-wraps the new key for
  the remaining active recipients, and rewrites the owner's key envelope. This
  means a revoked recipient who cached the old key cannot use it against
  refreshed ciphertext.

**Key backup details**
- The key backup flow requires the user to create a recovery passphrase at
  account creation or later in Settings. Enabling recovery writes an initial,
  empty backup document (`initRecoveryBackupOnFirebase`) so other devices can
  detect that recovery is configured.
- `backupKeysToFirebase` walks the user's documents, skips any marked
  `recoverable === false`, resolves each document key (Keychain → device-KDF
  unwrap → recovery unwrap), re-wraps each key under the recovery passphrase
  with a shared random salt, and writes `vaultKeyBackups/{ownerId}`.
  `restoreKeysFromFirebase` reverses this and repopulates the Keychain.
- An optional auto-sync setting re-runs the backup after document changes.
- Key entry points in `src/services/keyBackup.ts`: `backupKeysToFirebase`,
  `restoreKeysFromFirebase`, `initRecoveryBackupOnFirebase`,
  `checkIfKeyBackupExistsInFirebase`, `deleteKeyBackupFromFirebase`,
  `restoreDocumentKeysFromPassphrase`, `ensureRecoveryPassphrase`,
  `autoSyncKeysIfEnabled`.

**Auth & session protection**
- Auth context is centralized in `src/context/AuthContext.tsx`. It bridges
  Firebase auth state and local protection state (PIN/biometric/passkey)
  and exposes helper actions to the rest of the app. The app supports
  unlocking the vault via device protection methods while still using
  Firebase identity for cloud features.

**Project caveats & limits**

Enforced in `src/services/documentVault/upload.ts`:

| Constant                       | Value  | Meaning                                                    |
|--------------------------------|--------|------------------------------------------------------------|
| `MAX_FILES_PER_DOCUMENT`       | 10     | Files allowed in one document                              |
| `MAX_UPLOAD_FILE_BYTES`        | 10 MB  | Per-file upload ceiling (also enforced in `storage.rules`) |
| `MAX_CLOUD_DOCUMENTS_PER_USER` | 10     | Cloud documents per account                                |
| `LARGE_FILE_THRESHOLD_BYTES`   | 5 MB   | Above this, chunked streaming encryption is used           |
| `READ_CHUNK_BYTES`             | 256 KB | Chunk size for streaming reads                             |
| `DEFAULT_CONCURRENCY_LIMIT`    | 2      | Files encrypted/uploaded in parallel                       |

- The per-file size limit is enforced on the cloud upload path;
  `documentSaveLocal` does not apply it.
- A failed cloud upload rolls back: uploaded Storage objects are deleted, local
  copies unlinked and the Keychain entry for the document key reset.

**Firestore / Storage data model**
- `vault/{docId}` — document metadata: `name`, `description`, `hash`, `size`,
  `owner`, `references[]`, `fileCount`, `encryptedDocKey`, `saveMode`,
  `offlineAvailable`, `recoverable`, `sharedWith[]`, `createdAt`.
- `vault/{docId}/sharedUsers/{recipientUid}` — per-recipient share grants.
- `vaultUsers/{uid}` — `uid`, `emailLower`, `sharePublicKey` (used for recipient
  lookup during sharing).
- `vaultKeyBackups/{ownerId}` — recovery-passphrase-wrapped document keys.
- Storage: `vault/{ownerUid}/{docId}/{fileName}.enc`, uploaded as
  `application/json` containing `{version, algorithm, iv, cipher, authTag}`.
- Local: `{DocumentDirectoryPath}/vault/{docId}/{fileName}.enc.json`.

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
  - Crypto: Uses RSA-2048 with OAEP-SHA256 padding to wrap document keys for
    recipients (`documentCrypto.wrapDocumentKeyForRecipient`). The key pair is
    created on demand by `getOrCreateSharingKeyPair`; the private key is stored
    in the Keychain, the public key in AsyncStorage and published to
    `vaultUsers/{uid}.sharePublicKey`.
  - Firestore: share grants live in the `vault/{docId}/sharedUsers` subcollection;
    the `sharedWith` array on the parent document is a denormalised index so
    `listVaultDocumentsSharedWithUser` can surface incoming shares via
    collection-group queries.
  - Revocation and expiry rotate the document key and re-encrypt all files
    (`rotateDocumentKeyAfterShareChange`).

5) **Key backup & recovery**
- Non-technical: Users can back up a recoverable envelope of their document
  keys to Firestore protected by a passphrase. On a new device they provide the
  passphrase to restore keys.
- Developer notes:
  - Files: `src/services/keyBackup.ts` and `src/services/crypto/documentCrypto.ts`.
  - Key functions: `backupKeysToFirebase`, `restoreKeysFromFirebase`,
    `initRecoveryBackupOnFirebase`, `checkIfKeyBackupExistsInFirebase`,
    `deleteKeyBackupFromFirebase`, `restoreDocumentKeysFromPassphrase`,
    `ensureRecoveryPassphrase`, `autoSyncKeysIfEnabled`.
  - Flow: collect per-document keys (Keychain or unwrap from device wrap) →
    re-wrap with recovery passphrase → persist `vaultKeyBackups/<ownerId>`.
  - Documents flagged `recoverable === false` are excluded from the backup.
  - Important helpers: `resolveDocumentKeyForBackup` tries Keychain -> device
    KDF unwrap -> recovery-passphrase unwrap.
  - Passphrase helpers: `generateRecoveryPassphrase` (5 hyphen-separated
    8-character hex groups), `sanitizeRecoveryPassphrase` (lowercase, spaces to
    hyphens), `validateRecoveryPassphrase` (exactly 5 non-empty lowercase
    alphanumeric groups).

10) **Censor mode (redaction)**
- Non-technical: Before exporting or sharing, the user can redact sensitive
  fields on a document image so it can be shared safely.
- Developer notes:
  - Files: `src/services/censor/` (`ocr.ts`, `detectors.ts`, `censorImage.ts`),
    UI in `src/components/CensoredImageView.tsx` and `CensorToggle.tsx`.
  - OCR: `@react-native-ml-kit/text-recognition`, lazy-loaded so unit tests do
    not require the native module.
  - Detection: pure-JS regex detectors covering `email`, `phone`, `creditCard`
    (Luhn-validated), `iban`, `ssn`, `taxId`, `passport`, `date`, `apiKey`,
    `address` and `keyword`, with OCR-tolerant patterns.
  - Detected spans are mapped back to OCR word boxes and drawn as opaque
    redaction boxes over the decrypted image.

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
- Node.js 20+ (includes npm)
- Android Studio + SDK to run Android, Xcode for iOS
- Java Development Kit (JDK) 21 (JDK 17+ also works)
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

**Android prerequisite checks (especially on macOS)**
```bash
node -v
npm -v
java -version
export JAVA_HOME=$(/usr/libexec/java_home -v 21)
$JAVA_HOME/bin/java -version
```

If you get:
- `Unable to locate a Java Runtime` → install a JDK first, then re-run the checks above.
- `command not found: npm` → install Node.js (which includes npm), restart your shell, and verify with `npm -v`.

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

[SecDocVault](https://github.com/DanyilT/SecDocVault)

Copyright © 2026 [Danyil Tymchuk](https://github.com/DanyilT), [Illia Stefanovskyi](https://github.com/IlliaStefanovskyi), [Artem Surzhenko](https://github.com/artemsa223)

License: This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.
