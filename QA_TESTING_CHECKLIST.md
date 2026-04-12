# SecDocVault QA Testing Checklist

Use this checklist to validate basic usage, edge cases, and failure scenarios across Android/iOS, guest mode, Firebase-authenticated flows, and offline/online behavior.

**Legend**
- **P0** = must pass before release
- **P1** = important regression coverage
- **P2** = nice-to-have / exploratory

---

## 1) Install, Build, and First Launch

| ID       | Area    | Scenario                                   | Platform / Env | Preconditions               | Steps                                      | Expected Result                       | Priority | Status | Notes |
|----------|---------|--------------------------------------------|----------------|-----------------------------|--------------------------------------------|---------------------------------------|----------|--------|-------|
| SETUP-01 | Install | Fresh install succeeds                     | Android / iOS  | Clean device or simulator   | Install app and open it                    | App launches without crash            | P0       | [x]    |       |
| SETUP-02 | Build   | Debug build starts successfully            | Android / iOS  | Repo dependencies installed | Run app from IDE / CLI                     | App bundles and launches              | P0       | [x]    |       |
| SETUP-03 | Build   | App relaunch after kill                    | Android / iOS  | App already opened once     | Force close app, reopen                    | App restores to correct initial state | P0       | [x]    |       |
| SETUP-04 | Launch  | First launch on clean device               | Android / iOS  | No previous app data        | Open app for first time                    | Intro/auth flow appears correctly     | P0       | [x]    |       |
| SETUP-05 | Launch  | App survives device rotation during launch | Android        | Rotation enabled            | Open app and rotate during startup         | No crash; UI remains usable           | P2       | [x]    |       |
| SETUP-06 | Launch  | Low-memory relaunch                        | Android / iOS  | App backgrounded            | Open other apps to pressure memory, return | App resumes correctly                 | P2       | [x]    |       |

---

## 2) Authentication, Login, Register, and Unlock

| ID      | Area | Scenario                                   | Platform / Env         | Preconditions                               | Steps                                 | Expected Result                                          | Priority | Status | Notes |
|---------|------|--------------------------------------------|------------------------|---------------------------------------------|---------------------------------------|----------------------------------------------------------|----------|--------|-------|
| AUTH-01 | Auth | Open login screen successfully             | Android / iOS          | App opened                                  | Navigate to auth screen               | Login/register UI renders correctly                      | P0       | [x]    |       |
| AUTH-02 | Auth | Valid registration succeeds                | Firebase-authenticated | Email/password enabled                      | Register with valid credentials       | Account created and session started                      | P0       | [x]    |       |
| AUTH-03 | Auth | Valid login succeeds                       | Firebase-authenticated | Account exists                              | Log in with valid credentials         | User enters vault successfully                           | P0       | [x]    |       |
| AUTH-04 | Auth | Invalid email format rejected              | Firebase-authenticated | None                                        | Enter malformed email                 | Inline validation or backend error shown                 | P1       | [x]    |       |
| AUTH-05 | Auth | Wrong password rejected                    | Firebase-authenticated | Existing account                            | Enter valid email + wrong password    | Login fails with safe error message                      | P0       | [x]    |       |
| AUTH-06 | Auth | Empty credentials blocked                  | Firebase-authenticated | None                                        | Submit empty login/register fields    | Action is prevented or validation shown                  | P1       | [x]    |       |
| AUTH-07 | Auth | Duplicate registration handled             | Firebase-authenticated | Account exists                              | Register same email again             | Clear duplicate-account error shown                      | P1       | [x]    |       |
| AUTH-08 | Auth | Logout clears session                      | Firebase-authenticated | User logged in                              | Log out from settings or auth control | Session ends and app returns to auth flow                | P0       | [x]    |       |
| AUTH-09 | Auth | Unlock saved session with passkey          | Passkey enabled        | Saved passkey exists                        | Reopen app and unlock with passkey    | App unlocks without exposing secret material             | P0       | [x]    |       |
| AUTH-10 | Auth | Wrong passkey rejected                     | Passkey enabled        | Saved passkey exists                        | Enter incorrect passkey               | Unlock fails safely; no crash                            | P0       | [x]    |       |
| AUTH-11 | Auth | Biometric unlock succeeds                  | Biometric enabled      | Device biometrics enrolled                  | Trigger biometric unlock              | Access granted after successful biometric auth           | P0       | [x]    |       |
| AUTH-12 | Auth | Biometric cancel/fail handled              | Biometric enabled      | Device biometrics enrolled                  | Cancel or fail biometric prompt       | User remains locked; app stays stable                    | P0       | [x]    |       |
| AUTH-13 | Auth | Biometric unavailable fallback             | Biometric enabled      | No enrolled biometrics / unsupported device | Try biometric entry                   | Fallback or error message shown cleanly                  | P1       | [x]    |       |
| AUTH-14 | Auth | App restart preserves auth state correctly | Firebase / guest       | User has session or saved local state       | Kill app, reopen                      | Expected auth state is restored or re-prompted correctly | P0       | [x]    |       |

---

## 3) Guest Mode

| ID       | Area  | Scenario                                       | Platform / Env | Preconditions                        | Steps                                 | Expected Result                                      | Priority | Status | Notes |
|----------|-------|------------------------------------------------|----------------|--------------------------------------|---------------------------------------|------------------------------------------------------|----------|--------|-------|
| GUEST-01 | Guest | Enter guest local-only mode                    | Android / iOS  | App opened                           | Choose guest mode                     | User enters local-only vault                         | P0       | [ ]    |       |
| GUEST-02 | Guest | Guest mode does not call Firebase auth         | Any            | Network available                    | Enter guest mode and inspect behavior | No Firebase login is required                        | P0       | [ ]    |       |
| GUEST-03 | Guest | Guest mode persists local vault after relaunch | Same device    | Guest data exists                    | Add item, kill app, reopen            | Local data is still available if designed to persist | P1       | [ ]    |       |
| GUEST-04 | Guest | Guest mode isolate from authenticated vault    | Same device    | Both guest and Firebase flows tested | Switch between modes                  | Data remains separated correctly                     | P0       | [ ]    |       |
| GUEST-05 | Guest | Guest mode upload/share restrictions enforced  | Guest mode     | None                                 | Try upload/share actions              | Firebase-only actions are blocked or disabled        | P0       | [ ]    |       |
| GUEST-06 | Guest | Guest mode sign-out/exit flow works            | Guest mode     | User is inside app                   | Exit guest mode                       | Returns to auth or initial flow correctly            | P1       | [ ]    |       |

---

## 4) Vault Home / Document List

| ID       | Area  | Scenario                                    | Platform / Env | Preconditions                  | Steps               | Expected Result                                        | Priority | Status | Notes |
|----------|-------|---------------------------------------------|----------------|--------------------------------|---------------------|--------------------------------------------------------|----------|--------|-------|
| VAULT-01 | Vault | Vault list renders with no documents        | Any            | Empty vault                    | Open main screen    | Empty state is shown clearly                           | P0       | [x]    |       |
| VAULT-02 | Vault | Vault list renders with documents           | Any            | Existing documents             | Open main screen    | Documents are displayed correctly                      | P0       | [x]    |       |
| VAULT-03 | Vault | Very long file names display safely         | Any            | Document with long name        | Open list           | Text truncates or wraps without layout break           | P1       | [ ]    |       |
| VAULT-04 | Vault | Special characters in names handled         | Any            | Document with symbols/unicode  | Open list           | Items render without corruption                        | P1       | [ ]    |       |
| VAULT-05 | Vault | Duplicate document names visible distinctly | Any            | Two docs same name             | Open list           | Items remain distinguishable by metadata if applicable | P1       | [ ]    |       |
| VAULT-06 | Vault | Large list scrolls correctly                | Any            | Many documents present         | Scroll list up/down | Smooth scrolling; no missing rows                      | P1       | [x]    |       |
| VAULT-07 | Vault | Pull-to-refresh or refresh action works     | If supported   | Network / local data available | Trigger refresh     | List updates without duplicate entries                 | P2       | [ ]    |       |
| VAULT-08 | Vault | Open item from list navigates correctly     | Any            | At least one document exists   | Tap a document      | Correct document screen opens                          | P0       | [x]    |       |

---

## 5) Scan, Pick, Upload, and Document Confirmation

| ID        | Area   | Scenario                                    | Platform / Env         | Preconditions              | Steps                                 | Expected Result                                     | Priority | Status | Notes |
|-----------|--------|---------------------------------------------|------------------------|----------------------------|---------------------------------------|-----------------------------------------------------|----------|--------|-------|
| UPLOAD-01 | Upload | Scan from camera succeeds                   | Camera capable device  | Camera permission granted  | Start scan and capture document       | Capture completes and confirmation appears          | P0       | [x]    |       |
| UPLOAD-02 | Upload | Pick image from library succeeds            | Android / iOS          | Library permission granted | Choose image from library             | Selected image proceeds to confirmation/upload flow | P0       | [x]    |       |
| UPLOAD-03 | Upload | Cancel camera scan                          | Camera capable device  | Camera permission granted  | Open scanner then cancel              | Returns cleanly to previous screen                  | P1       | [x]    |       |
| UPLOAD-04 | Upload | Cancel library picker                       | Android / iOS          | Library permission granted | Open picker then cancel               | Returns cleanly with no partial state               | P1       | [x]    |       |
| UPLOAD-05 | Upload | Deny camera permission                      | Camera capable device  | Permission not granted     | Attempt scan                          | Permission denial handled gracefully                | P0       | [ ]    |       |
| UPLOAD-06 | Upload | Deny photo library permission               | Android / iOS          | Permission not granted     | Attempt pick                          | Permission denial handled gracefully                | P0       | [ ]    |       |
| UPLOAD-07 | Upload | Upload confirms with metadata               | Firebase-authenticated | Selected document ready    | Review confirmation and upload        | Hash/size metadata shown and saved                  | P0       | [x]    |       |
| UPLOAD-08 | Upload | Cancel at confirmation screen               | Firebase-authenticated | Document selected          | Cancel from upload confirm screen     | No upload occurs; returns safely                    | P0       | [x]    |       |
| UPLOAD-09 | Upload | Upload succeeds over slow network           | Firebase-authenticated | Slow but working network   | Upload a document                     | Progress/state remains stable; upload completes     | P1       | [x]    |       |
| UPLOAD-10 | Upload | Upload fails due to offline state           | Firebase-authenticated | Device offline             | Try upload                            | Friendly error shown; no corrupted entry            | P0       | [x]    |       |
| UPLOAD-11 | Upload | App interrupted during upload               | Firebase-authenticated | Upload in progress         | Background app / lock device / return | Upload state recovers or fails safely               | P1       | [x]    |       |
| UPLOAD-12 | Upload | Duplicate upload behavior defined           | Firebase-authenticated | Same file already uploaded | Upload same file again                | Duplicate handling is consistent and documented     | P2       | [ ]    |       |
| UPLOAD-13 | Upload | Unsupported file or corrupted image handled | Any                    | Bad input available        | Attempt to upload invalid media       | Validation or readable error shown                  | P1       | [ ]    |       |

---

## 6) Preview Screen

| ID         | Area    | Scenario                               | Platform / Env | Preconditions                 | Steps                 | Expected Result                                              | Priority | Status | Notes |
|------------|---------|----------------------------------------|----------------|-------------------------------|-----------------------|--------------------------------------------------------------|----------|--------|-------|
| PREVIEW-01 | Preview | Preview opens for valid document       | Any            | Document exists               | Open preview          | Correct content is shown                                     | P0       | [x]    |       |
| PREVIEW-02 | Preview | Zoom / pan behavior works if supported | Touch device   | Image/PDF content             | Interact with preview | Gestures behave as expected                                  | P2       | [ ]    |       |
| PREVIEW-03 | Preview | Back navigation returns correctly      | Any            | Preview open                  | Tap back              | Returns to previous screen without losing state unexpectedly | P0       | [x]    |       |
| PREVIEW-04 | Preview | Preview on small screen fits layout    | Small phone    | Document exists               | Open preview          | UI remains readable and usable                               | P1       | [ ]    |       |
| PREVIEW-05 | Preview | Preview error state for missing file   | Any            | Broken/missing item reference | Open preview          | User sees safe error or fallback screen                      | P0       | [ ]    |       |

---

## 7) Share Flow

| ID       | Area  | Scenario                               | Platform / Env         | Preconditions         | Steps                                     | Expected Result                             | Priority | Status | Notes |
|----------|-------|----------------------------------------|------------------------|-----------------------|-------------------------------------------|---------------------------------------------|----------|--------|-------|
| SHARE-01 | Share | Open share screen for a valid document | Firebase-authenticated | Document exists       | Navigate to share screen                  | Share UI loads correctly                    | P0       | [x]    |       |
| SHARE-02 | Share | Create or issue share key              | Firebase-authenticated | Share enabled         | Start share flow                          | Link/token is created successfully          | P0       | [x]    |       |
| SHARE-05 | Share | Share flow blocked in guest mode       | Guest mode             | None                  | Attempt share                             | Action is unavailable or blocked clearly    | P0       | [x]    |       |
| SHARE-06 | Share | Invalid or expired token handled       | Firebase-authenticated | Expired/bad link      | Open invalid share link                   | Safe error state shown                      | P0       | [x]    |       |
| SHARE-07 | Share | Revoked share link no longer works     | Firebase-authenticated | Existing share exists | Revoke link then reopen                   | Link access is denied                       | P1       | [x]    |       |
| SHARE-08 | Share | Network loss during share creation     | Firebase-authenticated | Online then offline   | Start share flow and disconnect           | Error surfaced, no partial share corruption | P1       | [x]    |       |

---

## 8) Backup, Recovery, and Key Recovery

| ID        | Area     | Scenario                               | Platform / Env         | Preconditions               | Steps                         | Expected Result                               | Priority | Status | Notes |
|-----------|----------|----------------------------------------|------------------------|-----------------------------|-------------------------------|-----------------------------------------------|----------|--------|-------|
| BACKUP-01 | Backup   | Open backup screen successfully        | Any                    | User inside app             | Navigate to backup screen     | Backup UI is visible and correct              | P1       | [x]    |       |
| BACKUP-02 | Backup   | Create backup entry / job              | Firebase-authenticated | Backup enabled              | Start backup process          | Backup metadata/state saved                   | P1       | [x]    |       |
| BACKUP-03 | Backup   | Backup survives app restart            | Firebase-authenticated | Backup created              | Restart app                   | Backup state is restored or tracked correctly | P1       | [x]    |       |
| BACKUP-04 | Backup   | Backup fails gracefully offline        | Firebase-authenticated | Offline                     | Start backup                  | Clear offline error shown                     | P1       | [x]    |       |
| BACKUP-05 | Recovery | Open key recovery screen               | Any                    | Recovery path available     | Navigate to key recovery      | Recovery UI loads correctly                   | P0       | [x]    |       |
| BACKUP-06 | Recovery | Valid recovery input succeeds          | Any                    | Valid recovery data exists  | Submit recovery input         | Vault/session recovery proceeds               | P0       | [x]    |       |
| BACKUP-07 | Recovery | Invalid recovery input rejected        | Any                    | None                        | Submit bad recovery info      | Clear error, no state corruption              | P0       | [x]    |       |
| BACKUP-08 | Recovery | Open document recovery screen          | Any                    | Recovery route available    | Navigate to document recovery | Recovery UI renders correctly                 | P1       | [x]    |       |
| BACKUP-09 | Recovery | Restore missing document from backup   | Any                    | Backup artifact exists      | Run restore                   | Document appears back in vault                | P1       | [x]    |       |
| BACKUP-10 | Recovery | Partial recovery / conflict resolution | Any                    | Conflicting or partial data | Attempt recovery              | App handles conflict safely and predictably   | P2       | [x]    |       |

---

## 9) Settings and App State

| ID       | Area     | Scenario                                   | Platform / Env         | Preconditions                     | Steps                                    | Expected Result                               | Priority | Status | Notes |
|----------|----------|--------------------------------------------|------------------------|-----------------------------------|------------------------------------------|-----------------------------------------------|----------|--------|-------|
| STATE-01 | Settings | Settings screen opens correctly            | Any                    | User inside app                   | Navigate to settings                     | Settings page loads with correct options      | P1       | [x]    |       |
| STATE-02 | Settings | Toggle security mode if supported          | Any                    | Feature available                 | Change passkey/biometric/security option | Setting persists and behaves correctly        | P1       | [x]    |       |
| STATE-03 | State    | Sign out clears sensitive data             | Firebase-authenticated | Logged in                         | Sign out and return to auth screen       | Session data is cleared properly              | P0       | [ ]    |       |
| STATE-04 | State    | App background/foreground cycle            | Android / iOS          | App open                          | Background app, wait, foreground it      | No crash; state remains valid                 | P0       | [x]    |       |
| STATE-05 | State    | Screen transitions do not leak stale state | Any                    | Navigate through multiple screens | Move between auth, vault, preview, share | Previous state does not bleed into new screen | P1       | [x]    |       |
| STATE-06 | State    | Deep return from child screens works       | Any                    | Opened nested screen              | Use back/close controls repeatedly       | User returns to correct parent route          | P0       | [x]    |       |

---

## 10) Offline, Connectivity, and Sync Edge Cases

| ID     | Area    | Scenario                      | Platform / Env         | Preconditions        | Steps                                     | Expected Result                                    | Priority | Status | Notes |
|--------|---------|-------------------------------|------------------------|----------------------|-------------------------------------------|----------------------------------------------------|----------|--------|-------|
| NET-01 | Network | Start app offline             | Any                    | Device airplane mode | Launch app offline                        | App shows appropriate offline behavior             | P0       | [ ]    |       |
| NET-02 | Network | Log in after reconnect        | Firebase-authenticated | Start offline        | Reconnect and retry login                 | Login succeeds once network returns                | P1       | [ ]    |       |
| NET-03 | Network | Upload after reconnect        | Firebase-authenticated | Offline then online  | Queue/retry upload after network returns  | Upload completes or retry path is clear            | P1       | [ ]    |       |
| NET-04 | Network | Connectivity drops mid-action | Any                    | Action in progress   | Lose network during upload/share/recovery | Action fails safely with useful error              | P0       | [ ]    |       |
| NET-05 | Network | Slow network timeout handling | Any                    | Very slow connection | Perform auth/upload/share action          | App stays responsive and reports timeout if needed | P1       | [ ]    |       |
| NET-06 | Network | Switch Wi-Fi to cellular      | Any                    | Network available    | Change connection type mid-session        | App remains functional                             | P2       | [ ]    |       |

---

## 11) Device, OS, and Permission Differences

| ID      | Area        | Scenario                                       | Platform / Env        | Preconditions                | Steps                           | Expected Result                            | Priority | Status | Notes |
|---------|-------------|------------------------------------------------|-----------------------|------------------------------|---------------------------------|--------------------------------------------|----------|--------|-------|
| DEV-01  | Platform    | Android flow works end-to-end                  | Android               | Device/emulator              | Run smoke flow on Android       | No Android-specific regressions            | P0       | [x]    |       |
| DEV-02  | Platform    | iOS flow works end-to-end                      | iOS                   | Device/simulator             | Run smoke flow on iOS           | No iOS-specific regressions                | P0       | [x]    |       |
| DEV-03  | Platform    | Simulator/emulator without camera              | Android/iOS simulator | Camera unavailable           | Try scan flow                   | Camera limitation handled gracefully       | P1       | [x]    |       |
| DEV-04  | Platform    | Physical device camera scan                    | Physical device       | Camera permission granted    | Scan document                   | Capture works on real hardware             | P0       | [x]    |       |
| DEV-05  | Platform    | Tablet or large screen layout                  | Tablet                | Tablet device/simulator      | Open core screens               | Layout adapts without clipping             | P2       | [x]    |       |
| DEV-06  | Platform    | Dark mode appearance                           | Android / iOS         | System dark mode enabled     | Open app                        | Colors and contrast remain usable          | P2       | [x]    |       |
| PERM-01 | Permissions | Camera permission request flow                 | Camera device         | Permission not yet granted   | Start scan                      | Permission dialog shown and handled        | P0       | [ ]    |       |
| PERM-02 | Permissions | Library permission request flow                | Android / iOS         | Permission not yet granted   | Start image picker              | Permission dialog shown and handled        | P0       | [ ]    |       |
| PERM-03 | Permissions | Denied permission can be retried from settings | Android / iOS         | Permission denied previously | Open app settings and re-enable | Feature works after permission is restored | P1       | [ ]    |       |
| PERM-04 | Permissions | Biometric unavailable on device                | Any                   | No biometrics enrolled       | Try biometric mode              | App explains limitation clearly            | P1       | [x]    |       |

---

## 12) Error Handling, Data Integrity, and Security / Privacy

| ID     | Area     | Scenario                                         | Platform / Env            | Preconditions                    | Steps                             | Expected Result                                    | Priority | Status | Notes |
|--------|----------|--------------------------------------------------|---------------------------|----------------------------------|-----------------------------------|----------------------------------------------------|----------|--------|-------|
| ERR-01 | Errors   | Generic backend error displayed safely           | Firebase-authenticated    | Simulated backend failure        | Trigger auth/upload/share failure | User sees non-sensitive error                      | P0       | [x]    |       |
| ERR-02 | Errors   | Broken document reference handled                | Any                       | Missing local/remote file        | Open item or preview              | App does not crash; clear fallback shown           | P0       | [x]    |       |
| ERR-03 | Errors   | Corrupted local cache/state handled              | Any                       | Corrupted local data             | Launch app                        | App recovers or resets safely                      | P0       | [x]    |       |
| ERR-04 | Errors   | Duplicate navigation / double tap protection     | Any                       | Active button available          | Tap actions rapidly               | No duplicate uploads or multiple sessions          | P1       | [x]    |       |
| ERR-05 | Security | Sensitive data not shown in guest mode           | Guest mode                | Some vault data exists elsewhere | Inspect guest screens             | Firebase/private data remains hidden               | P0       | [x]    |       |
| SEC-01 | Security | Locked session remains protected in background   | Passkey/biometric enabled | App locked                       | Background app then return        | User is re-authenticated as required               | P0       | [x]    |       |
| SEC-02 | Security | Screen contents are not exposed after app switch | Sensitive session         | App contains vault data          | Open app switcher                 | Sensitive content should not be obviously exposed  | P1       | [x]    |       |
| SEC-03 | Security | Logout removes access to protected data          | Firebase-authenticated    | Logged in                        | Log out and inspect state         | Protected actions/data are inaccessible            | P0       | [x]    |       |
| SEC-04 | Security | No secret leakage in error messages or logs      | Any                       | Force an auth/upload error       | Inspect UI/logs if available      | Errors do not reveal tokens, passwords, or secrets | P0       | [x]    |       |
| SEC-05 | Security | Deep links / invalid routes handled safely       | Any                       | Invalid URL or route             | Open malformed link/route         | App rejects or ignores invalid navigation safely   | P1       | [x]    |       |

---

## 13) Regression Smoke Test

Run these first before deeper testing.

| ID       | Area  | Scenario                     | Platform / Env         | Preconditions                    | Steps                                | Expected Result                        | Priority | Status | Notes |
|----------|-------|------------------------------|------------------------|----------------------------------|--------------------------------------|----------------------------------------|----------|--------|-------|
| SMOKE-01 | Smoke | App launches                 | Android / iOS          | Fresh or existing install        | Open app                             | App starts successfully                | P0       | [x]    |       |
| SMOKE-02 | Smoke | Auth or guest entry works    | Android / iOS          | None                             | Enter the main app via auth or guest | Main screen opens                      | P0       | [x]    |       |
| SMOKE-03 | Smoke | View vault list              | Any                    | At least one item or empty vault | Open vault                           | Vault displays correctly               | P0       | [x]    |       |
| SMOKE-04 | Smoke | Open preview                 | Any                    | Document exists                  | Tap document and open preview        | Preview loads correctly                | P0       | [x]    |       |
| SMOKE-05 | Smoke | Scan or pick a document      | Firebase-authenticated | Permission granted               | Add a document                       | Document proceeds through confirmation | P0       | [x]    |       |
| SMOKE-06 | Smoke | Upload completes             | Firebase-authenticated | Network available                | Finish upload                        | Item appears in vault                  | P0       | [x]    |       |
| SMOKE-07 | Smoke | Share or backup screen opens | Relevant mode          | Feature enabled                  | Open share/backup flow               | Screen loads without crash             | P1       | [x]    |       |
| SMOKE-08 | Smoke | Sign out and relaunch        | Firebase-authenticated | Logged in                        | Sign out, close app, reopen          | Returns to correct auth state          | P0       | [x]    |       |

---

## Notes

- Mark each row as passed/failed in the **Status** column.
- Add screenshots, device model, OS version, and build number in **Notes** when something fails.
- Re-run **P0** items after any auth, storage, routing, or permissions change.
