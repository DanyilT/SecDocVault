import React from 'react';

import {
  DocumentRecoveryScreen,
  KeyRecoveryScreen,
  MainScreen,
  PreviewScreen,
  SettingsScreen,
  ShareDetailsScreen,
  ShareScreen,
  UploadConfirmScreen,
} from '../../screens';
import { VaultDocument } from '../../types/vault';
import { AppScreen } from '../navigation/constants';

type VaultRouterProps = {
  screen: AppScreen;
  userUid?: string;
  userEmail?: string;
  isGuest: boolean;
  isUploading: boolean;
  uploadStatus: string;
  documents: VaultDocument[];
  incomingShareDecisionsForCurrentUser: Record<string, 'accepted' | 'declined'>;
  openPreview: (doc: VaultDocument) => void;
  openShare: (doc: VaultDocument) => void;
  onScanAndUpload: () => void;
  onPickAndUpload: () => void;
  onReloadDocuments: () => Promise<void>;
  onSaveOffline: (doc: VaultDocument) => Promise<void>;
  onSaveToFirebase: (doc: VaultDocument) => Promise<void>;
  onDeleteLocal: (doc: VaultDocument) => Promise<void>;
  onDeleteFromFirebase: (doc: VaultDocument) => Promise<void>;
  onExportFromMain: (doc: VaultDocument) => Promise<void>;
  onToggleRecovery: (doc: VaultDocument, enabled: boolean) => Promise<void>;
  onAcceptIncomingShare: (docId: string) => void;
  onDeclineIncomingShare: (docId: string) => void;

  authError: string | null;
  preferredProtection: any;
  pinBiometricEnabled: boolean;
  hasSavedPasskey: boolean;
  isSubmitting: boolean;
  accountStatus: string;
  pendingNewEmail: string;
  saveOfflineByDefault: boolean;
  recoverableByDefault: boolean;
  keyBackupEnabled: boolean;
  recoveryPassphraseForSettings: string | null;
  backedUpDocs: Array<{id: string; name: string; canRecover: boolean}>;
  notBackedUpDocs: Array<{id: string; name: string; canRecover: boolean}>;
  onSetSaveOfflineByDefault: (value: boolean) => void;
  onSetRecoverableByDefault: (value: boolean) => void;
  onSetKeyBackupEnabled: (value: boolean) => void;
  onCopyRecoveryPassphrase: (passphrase: string) => Promise<void>;
  onResetBackupPassphrase: () => Promise<void>;
  onOpenRecoverKeys: () => void;
  onOpenDocumentRecovery: () => void;
  onUpdateUnlockMethod: (payload: any) => Promise<void>;
  onChangeGuestPassword: (currentPassword: string, nextPassword: string) => Promise<boolean>;
  onResetPassword: () => Promise<void>;
  onSetPendingNewEmail: (value: string) => void;
  onRequestEmailChange: () => Promise<void>;
  onDeleteAccountAndData: () => void;
  onUpgradeToCloud: () => void;

  selectedDoc: VaultDocument | null;
  previewFileOrder: number;
  previewImageUri: string | null;
  previewStatus: string;
  isPreviewDecrypting: boolean;
  isCurrentFileDecrypted: boolean;
  onDecryptPreview: () => Promise<void>;
  onExportPreview: () => Promise<void>;
  onSelectPreviewFile: (order: number) => void;

  pendingUploadDraft: {files: any[]} | null;
  pendingUploadPreviewIndex: number;
  pendingUploadName: string;
  pendingUploadDescription: string;
  pendingUploadRecoverable: boolean;
  pendingUploadToCloud: boolean;
  pendingUploadAlsoSaveLocal: boolean;
  uploadCanUseCloud: boolean;
  setPendingUploadPreviewIndex: (value: number) => void;
  setPendingUploadName: (value: string) => void;
  setPendingUploadDescription: (value: string) => void;
  setPendingUploadRecoverable: (value: boolean) => void;
  setPendingUploadToCloud: (value: boolean) => void;
  setPendingUploadAlsoSaveLocal: (value: boolean) => void;
  onRemoveUploadFile: (index: number) => void;
  onReorderUploadFiles: (fromIndex: number, toIndex: number) => void;
  onConfirmUpload: () => Promise<void>;
  onRequestEnableKeyBackup: () => void;

  shareTarget: string;
  allowDownload: boolean;
  shareStatus: string;
  isShareSubmitting: boolean;
  shareExpiryDays: string;
  setShareTarget: (value: string) => void;
  setAllowDownload: (value: boolean) => void;
  setShareExpiryDays: (value: string) => void;
  onCreateShare: () => Promise<void>;
  onRevokeShare: () => Promise<void>;
  onOpenShareOptions: () => void;
  onRevokeShareForRecipient: (recipient: string) => void;

  keyBackupStatus: string;
  onRestoreKeys: (passphrase: string) => Promise<void>;

  onToggleDocBackupFromSettings: (docId: string, enabled: boolean) => Promise<void>;
};

export function VaultRouter(props: VaultRouterProps) {
  const {
    screen,
    isGuest,
    userUid,
    userEmail,
    selectedDoc,
    pendingUploadDraft,
  } = props;

  return (
    <>
      {screen === 'main' ? (
        <MainScreen
          documents={props.documents}
          incomingShareDecisions={props.incomingShareDecisionsForCurrentUser}
          currentUserId={userUid ?? null}
          currentUserEmail={userEmail ?? null}
          isGuest={isGuest}
          isUploading={props.isUploading}
          uploadStatus={props.uploadStatus}
          openPreview={props.openPreview}
          openShare={props.openShare}
          onScanAndUpload={props.onScanAndUpload}
          onPickAndUpload={props.onPickAndUpload}
          onReloadDocuments={props.onReloadDocuments}
          onSaveOffline={doc => {
            void props.onSaveOffline(doc);
          }}
          onSaveToFirebase={doc => {
            void props.onSaveToFirebase(doc);
          }}
          onDeleteLocal={doc => {
            void props.onDeleteLocal(doc);
          }}
          onDeleteFromFirebase={doc => {
            void props.onDeleteFromFirebase(doc);
          }}
          onExport={props.onExportFromMain}
          onToggleRecovery={props.onToggleRecovery}
          onAcceptIncomingShare={props.onAcceptIncomingShare}
          onDeclineIncomingShare={props.onDeclineIncomingShare}
        />
      ) : null}

      {screen === 'settings' ? (
        <SettingsScreen
          accountLabel={userEmail ?? (isGuest ? 'Guest session' : 'Unknown account')}
          sessionMode={isGuest ? 'guest' : 'cloud'}
          isGuest={isGuest}
          authError={props.authError}
          preferredProtection={props.preferredProtection}
          pinBiometricEnabled={props.pinBiometricEnabled}
          hasSavedPasskey={props.hasSavedPasskey}
          isSubmitting={props.isSubmitting}
          accountStatus={props.accountStatus}
          pendingNewEmail={props.pendingNewEmail}
          saveOfflineByDefault={props.saveOfflineByDefault}
          recoverableByDefault={props.recoverableByDefault}
          keyBackupEnabled={props.keyBackupEnabled}
          recoveryPassphrase={props.recoveryPassphraseForSettings}
          backedUpDocs={props.backedUpDocs}
          notBackedUpDocs={props.notBackedUpDocs}
          onSetSaveOfflineByDefault={props.onSetSaveOfflineByDefault}
          onSetRecoverableByDefault={props.onSetRecoverableByDefault}
          onSetKeyBackupEnabled={props.onSetKeyBackupEnabled}
          onCopyRecoveryPassphrase={props.onCopyRecoveryPassphrase}
          onResetBackupPassphrase={props.onResetBackupPassphrase}
          onOpenRecoverKeys={props.onOpenRecoverKeys}
          onOpenDocumentRecovery={props.onOpenDocumentRecovery}
          onUpdateUnlockMethod={props.onUpdateUnlockMethod}
          onChangeGuestPassword={props.onChangeGuestPassword}
          onResetPassword={props.onResetPassword}
          onSetPendingNewEmail={props.onSetPendingNewEmail}
          onRequestEmailChange={props.onRequestEmailChange}
          onDeleteAccountAndData={props.onDeleteAccountAndData}
          onUpgradeToCloud={props.onUpgradeToCloud}
        />
      ) : null}

      {screen === 'preview' && selectedDoc ? (
        <PreviewScreen
          selectedDoc={selectedDoc}
          previewFileOrder={props.previewFileOrder}
          previewImageUri={props.previewImageUri}
          previewStatus={props.previewStatus}
          isDecrypting={props.isPreviewDecrypting}
          isCurrentFileDecrypted={props.isCurrentFileDecrypted}
          isGuest={isGuest}
          canShareDocument={Boolean(!isGuest && userUid && selectedDoc.owner === userUid)}
          canSaveOfflineDocument={Boolean(isGuest || !selectedDoc.owner || (userUid && selectedDoc.owner === userUid))}
          hasLocalCopy={Boolean(selectedDoc.references?.some(ref => ref.source === 'local'))}
          hasFirebaseCopy={Boolean(selectedDoc.references?.some(ref => ref.source === 'firebase'))}
          keyBackupEnabled={props.keyBackupEnabled}
          onDecrypt={props.onDecryptPreview}
          onExport={props.onExportPreview}
          onSelectFile={props.onSelectPreviewFile}
          onShare={props.openShare}
          onSaveOffline={props.onSaveOffline}
          onSaveToFirebase={props.onSaveToFirebase}
          onDeleteLocal={props.onDeleteLocal}
          onDeleteFromFirebase={props.onDeleteFromFirebase}
          onToggleRecovery={props.onToggleRecovery}
        />
      ) : null}

      {screen === 'upload' && pendingUploadDraft ? (
        <UploadConfirmScreen
          isUploading={props.isUploading}
          uploadStatus={props.uploadStatus}
          files={pendingUploadDraft.files}
          selectedFileIndex={props.pendingUploadPreviewIndex}
          documentName={props.pendingUploadName}
          documentDescription={props.pendingUploadDescription}
          recoverable={props.pendingUploadRecoverable}
          uploadToCloud={props.pendingUploadToCloud}
          saveLocalCopy={props.pendingUploadAlsoSaveLocal}
          canToggleCloudUpload={props.uploadCanUseCloud}
          canToggleSaveLocal={true}
          setSelectedFileIndex={props.setPendingUploadPreviewIndex}
          setDocumentName={props.setPendingUploadName}
          setDocumentDescription={props.setPendingUploadDescription}
          setRecoverable={props.setPendingUploadRecoverable}
          setUploadToCloud={props.setPendingUploadToCloud}
          setSaveLocalCopy={props.setPendingUploadAlsoSaveLocal}
          onRemoveFile={props.onRemoveUploadFile}
          onReorderFiles={props.onReorderUploadFiles}
          onPickNewFile={props.onPickAndUpload}
          onScanNewFile={props.onScanAndUpload}
          onConfirmUpload={props.onConfirmUpload}
          keyBackupEnabled={props.keyBackupEnabled}
          onRequestEnableKeyBackup={props.onRequestEnableKeyBackup}
        />
      ) : null}

      {screen === 'share' && selectedDoc ? (
        <ShareScreen
          selectedDoc={selectedDoc}
          isGuest={isGuest}
          canManageShares={Boolean(
            userUid && selectedDoc.owner === userUid && Boolean(selectedDoc.references?.some(reference => reference.source === 'firebase')),
          )}
          shareTarget={props.shareTarget}
          allowDownload={props.allowDownload}
          shareStatus={props.shareStatus}
          isSubmitting={props.isShareSubmitting}
          isSharedWithTarget={Boolean(
            props.shareTarget.trim() &&
              (selectedDoc.sharedWith ?? []).some(item => item.toLowerCase() === props.shareTarget.trim().toLowerCase()),
          )}
          expiresInDays={props.shareExpiryDays}
          setShareTarget={props.setShareTarget}
          setAllowDownload={props.setAllowDownload}
          setExpiresInDays={props.setShareExpiryDays}
          onCreateShare={props.onCreateShare}
          onRevokeShare={props.onRevokeShare}
        />
      ) : null}

      {screen === 'sharedetails' && selectedDoc ? (
        <ShareDetailsScreen
          selectedDoc={selectedDoc}
          shareTarget={props.shareTarget}
          allowDownload={props.allowDownload}
          expiresInDays={props.shareExpiryDays}
          onOpenShareOptions={props.onOpenShareOptions}
          onRevokeShareForRecipient={props.onRevokeShareForRecipient}
        />
      ) : null}

      {screen === 'recoverkeys' ? (
        <KeyRecoveryScreen
          isGuest={isGuest}
          isSubmitting={props.isSubmitting}
          status={props.keyBackupStatus}
          onRestoreKeys={props.onRestoreKeys}
        />
      ) : null}

      {screen === 'recoverydocs' ? (
        <DocumentRecoveryScreen
          isSubmitting={props.isSubmitting}
          keyBackupEnabled={props.keyBackupEnabled}
          backedUpDocs={props.backedUpDocs}
          notBackedUpDocs={props.notBackedUpDocs}
          onToggleDocBackup={props.onToggleDocBackupFromSettings}
        />
      ) : null}
    </>
  );
}
