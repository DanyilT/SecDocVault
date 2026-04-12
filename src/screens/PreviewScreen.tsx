/**
 * screens/PreviewScreen.tsx
 *
 * Document preview UI. Displays decrypted previews for images and offers
 * export actions for non-image file types. Delegates decryption and export
 * logic to controller hooks so the screen remains presentational.
 */

import React from 'react';
import { Image, Modal, PanResponder, Pressable, ScrollView, Text, View } from 'react-native';
import Clipboard from '@react-native-clipboard/clipboard';
import {
  ArrowDownTrayIcon,
  CloudArrowDownIcon,
  CloudArrowUpIcon,
  InformationCircleIcon,
  KeyIcon,
  MinusCircleIcon,
  ShareIcon,
  TrashIcon,
} from 'react-native-heroicons/solid';

import { PrimaryButton } from '../components/ui';
import { styles } from '../theme/styles';
import { VaultDocument } from '../types/vault';

/**
 * PreviewScreen
 *
 * Presentational screen that displays a decrypted preview of a selected
 * document (images or placeholders for other types) and exposes export and
 * storage actions. Decryption and persistence are delegated to provided
 * callbacks.
 *
 * @param {object} props - Component props
 * @param {VaultDocument} props.selectedDoc - Currently selected document to preview
 * @param {number} props.previewFileOrder - Order/index of the file within the document references
 * @param {string|null} props.previewImageUri - Local URI for the decrypted image preview
 * @param {string} props.previewStatus - Optional status message for preview actions
 * @param {boolean} props.isDecrypting - Whether a decrypt operation is underway
 * @param {boolean} props.isCurrentFileDecrypted - Whether the current file is decrypted
 * @param {boolean} props.isGuest - Whether the session is a guest session
 * @param {boolean} props.canShareDocument - Whether sharing is allowed for this document
 * @param {boolean} props.canSaveOfflineDocument - Whether offline save is allowed
 * @param {boolean} props.hasLocalCopy - Whether a local copy exists
 * @param {boolean} props.hasFirebaseCopy - Whether a cloud copy exists
 * @param {boolean} props.keyBackupEnabled - Whether key backup is enabled globally
 * @param {string|null} props.currentUserId - Current user's id
 * @param {() => Promise<void>} props.onDecrypt - Trigger decryption for current file
 * @param {() => Promise<void>} props.onExport - Export the current file
 * @param {(order: number) => void} props.onSelectFile - Select a different file in the document
 * @param {(doc: VaultDocument) => void} props.onShare - Open the share flow for the document
 * @param {(doc: VaultDocument) => Promise<void>} props.onSaveOffline - Save document offline
 * @param {(doc: VaultDocument) => Promise<void>} props.onSaveToFirebase - Save document to cloud
 * @param {(doc: VaultDocument) => Promise<void>} props.onDeleteLocal - Delete local copy
 * @param {(doc: VaultDocument) => Promise<void>} props.onDeleteFromFirebase - Delete cloud copy
 * @param {(doc: VaultDocument, nextValue: boolean) => Promise<void>} props.onToggleRecovery - Toggle key backup for this document
 * @param {(docId: string) => void} props.onDeclineIncomingShare - Decline an incoming share request
 * @returns {JSX.Element} Rendered preview screen
 */
export function PreviewScreen({
  selectedDoc,
  previewFileOrder,
  previewImageUri,
  previewStatus,
  isDecrypting,
  isCurrentFileDecrypted,
  isGuest,
  canShareDocument,
  canSaveOfflineDocument,
  hasLocalCopy,
  hasFirebaseCopy,
  keyBackupEnabled,
  currentUserId,
  onDecrypt,
  onExport,
  onSelectFile,
  onShare,
  onSaveOffline,
  onSaveToFirebase,
  onDeleteLocal,
  onDeleteFromFirebase,
  onToggleRecovery,
  onDeclineIncomingShare,
}: {
  selectedDoc: VaultDocument;
  previewFileOrder: number;
  previewImageUri: string | null;
  previewStatus: string;
  isDecrypting: boolean;
  isCurrentFileDecrypted: boolean;
  isGuest: boolean;
  canShareDocument: boolean;
  canSaveOfflineDocument: boolean;
  hasLocalCopy: boolean;
  hasFirebaseCopy: boolean;
  keyBackupEnabled: boolean;
  currentUserId: string | null;
  onDecrypt: () => Promise<void>;
  onExport: () => Promise<void>;
  onSelectFile: (order: number) => void;
  onShare: (doc: VaultDocument) => void;
  onSaveOffline: (doc: VaultDocument) => Promise<void>;
  onSaveToFirebase: (doc: VaultDocument) => Promise<void>;
  onDeleteLocal: (doc: VaultDocument) => Promise<void>;
  onDeleteFromFirebase: (doc: VaultDocument) => Promise<void>;
  onToggleRecovery: (doc: VaultDocument, nextValue: boolean) => Promise<void>;
  onDeclineIncomingShare: (docId: string) => void;
}) {
  const [showFullImage, setShowFullImage] = React.useState(false);
  const [integrityCopied, setIntegrityCopied] = React.useState(false);
  const [isSavingOffline, setIsSavingOffline] = React.useState(false);
  const [showIntegrityInfo, setShowIntegrityInfo] = React.useState(false);
  const copyResetTimerRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);

  React.useEffect(() => {
    return () => {
      if (copyResetTimerRef.current) {
        clearTimeout(copyResetTimerRef.current);
      }
    };
  }, []);

  React.useEffect(() => {
    setIntegrityCopied(false);
  }, [selectedDoc.id, previewFileOrder]);
  const files = React.useMemo(() => {
    const byOrder = new Map<number, NonNullable<VaultDocument['references']>[number]>();
    const references = [...(selectedDoc.references ?? [])].sort((a, b) => (a.order ?? 0) - (b.order ?? 0));

    references.forEach((reference, index) => {
      const order = reference.order ?? index;
      const existing = byOrder.get(order);
      if (!existing || (existing.source === 'firebase' && reference.source === 'local')) {
        byOrder.set(order, reference);
      }
    });

    return Array.from(byOrder.entries())
      .sort((left, right) => left[0] - right[0])
      .map(([order, reference]) => ({order, ...reference}));
  }, [selectedDoc.references]);

  const selectedIndex = Math.max(
    0,
    files.findIndex(item => item.order === previewFileOrder),
  );
  const selectedFileIntegrity = files[selectedIndex]?.integrityTag ?? files[selectedIndex]?.fileHash ?? selectedDoc.hash;

  const isOwner = Boolean(currentUserId) && selectedDoc.owner === currentUserId;

  const panResponder = React.useMemo(
    () =>
      PanResponder.create({
        onMoveShouldSetPanResponder: (_, gestureState) => Math.abs(gestureState.dx) > 10,
        onPanResponderRelease: (_, gestureState) => {
          if (files.length <= 1 || Math.abs(gestureState.dx) < 40) {
            return;
          }

          if (gestureState.dx < 0 && selectedIndex < files.length - 1) {
            onSelectFile(files[selectedIndex + 1].order);
            return;
          }

          if (gestureState.dx > 0 && selectedIndex > 0) {
            onSelectFile(files[selectedIndex - 1].order);
          }
        },
      }),
    [files, onSelectFile, selectedIndex],
  );

  return (
    <ScrollView
      style={{ flex: 1 }}
      contentContainerStyle={[styles.scrollContainer, { paddingBottom: 28 }]}
      keyboardShouldPersistTaps="handled"
    >
      <Text style={styles.pageTitle}>{selectedDoc.name}</Text>

      <Pressable
        {...panResponder.panHandlers}
        onPress={() => {
          if (previewImageUri) {
            setShowFullImage(true);
            return;
          }

          if (!isCurrentFileDecrypted && !isDecrypting) {
            void onDecrypt();
          }
        }}
        style={{
          borderWidth: 1,
          borderColor: '#334155',
          borderRadius: 14,
          backgroundColor: '#0f172a',
          width: '100%',
          aspectRatio: 1 / 1.414,
          overflow: 'hidden',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        {previewImageUri ? (
          <Image
            source={{ uri: previewImageUri }}
            style={[
              styles.previewImage,
              { borderWidth: 0, borderRadius: 0, height: '100%' },
            ]}
          />
        ) : (
          <View
            style={{
              width: '100%',
              height: '100%',
              padding: 16,
              justifyContent: 'space-between',
            }}
          >
            <View style={{ gap: 6 }}>
              <View
                style={{
                  height: 6,
                  width: '76%',
                  backgroundColor: '#1e293b',
                  borderRadius: 4,
                }}
              />
              <View
                style={{
                  height: 6,
                  width: '58%',
                  backgroundColor: '#1e293b',
                  borderRadius: 4,
                }}
              />
              <View
                style={{
                  height: 6,
                  width: '84%',
                  backgroundColor: '#1e293b',
                  borderRadius: 4,
                }}
              />
            </View>

            <View style={{ alignItems: 'center' }}>
              <Text style={{ color: '#64748b', fontSize: 52 }}># # #</Text>
              <Text
                style={{
                  color: '#93c5fd',
                  fontSize: 18,
                  fontWeight: '800',
                  marginTop: 6,
                }}
              >
                Decrypt
              </Text>
              <Text style={{ color: '#94a3b8', marginTop: 4 }}>
                {isDecrypting
                  ? 'Decripting document...'
                  : 'Tap to decrypt this document'}
              </Text>
            </View>

            <View style={{ gap: 6 }}>
              <View
                style={{
                  height: 6,
                  width: '70%',
                  backgroundColor: '#1e293b',
                  borderRadius: 4,
                }}
              />
              <View
                style={{
                  height: 6,
                  width: '64%',
                  backgroundColor: '#1e293b',
                  borderRadius: 4,
                }}
              />
            </View>
          </View>
        )}
      </Pressable>

      {files.length > 1 ? (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ gap: 10, marginTop: 10 }}
        >
          {files.map((file, index) => {
            const isSelected = index === selectedIndex;
            return (
              <Pressable
                key={`${file.order}-${file.name}-${index}`}
                onPress={() => onSelectFile(file.order)}
                style={{
                  width: 72,
                  height: 72,
                  borderRadius: 10,
                  borderWidth: isSelected ? 2 : 1,
                  borderColor: isSelected ? '#60a5fa' : '#334155',
                  overflow: 'hidden',
                  alignItems: 'center',
                  justifyContent: 'center',
                  backgroundColor: '#0f172a',
                }}
              >
                <Text style={{ color: '#bfdbfe', fontWeight: '800' }}>
                  #{file.order}
                </Text>
                <Text
                  style={{ color: '#94a3b8', fontSize: 11, marginTop: 4 }}
                  numberOfLines={1}
                >
                  {file.type}
                </Text>
              </Pressable>
            );
          })}
        </ScrollView>
      ) : null}

      {files.length > 0 ? (
        <Text style={styles.previewText}>
          File {selectedIndex + 1} of {files.length} (index{' '}
          {files[selectedIndex]?.order ?? 0})
        </Text>
      ) : null}

      <Modal
        visible={showFullImage}
        transparent
        animationType="fade"
        onRequestClose={() => setShowFullImage(false)}
      >
        <Pressable
          onPress={() => setShowFullImage(false)}
          style={{
            flex: 1,
            backgroundColor: 'rgba(2,6,23,0.95)',
            alignItems: 'center',
            justifyContent: 'center',
            padding: 16,
          }}
        >
          {previewImageUri ? (
            <Image
              source={{ uri: previewImageUri }}
              resizeMode="contain"
              style={{ width: '100%', height: '100%' }}
            />
          ) : null}
        </Pressable>
      </Modal>

      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
        <Text style={styles.previewLabel}>Integrity Tag (AES-GCM)</Text>
        <Pressable
          onPress={() => setShowIntegrityInfo(prev => !prev)}
          hitSlop={8}
          accessibilityRole="button"
          accessibilityLabel="Toggle integrity tag info"
        >
          <InformationCircleIcon color="#93c5fd" size={18} />
        </Pressable>
      </View>
      {showIntegrityInfo ? (
        <Text style={styles.previewText}>
          This tag is verified during decrypt to detect tampering.
        </Text>
      ) : null}
      <Pressable
        onPress={() => {
          if (!selectedFileIntegrity) {
            return;
          }

          Clipboard.setString(selectedFileIntegrity);
          setIntegrityCopied(true);
          if (copyResetTimerRef.current) {
            clearTimeout(copyResetTimerRef.current);
          }
          copyResetTimerRef.current = setTimeout(() => {
            setIntegrityCopied(false);
          }, 1000);
        }}
      >
        <Text style={styles.hashBlock}>
          {integrityCopied ? 'Copied!' : selectedFileIntegrity}
        </Text>
      </Pressable>
      {selectedDoc.description ? (
        <Text style={styles.previewText}>
          Description: {selectedDoc.description}
        </Text>
      ) : null}
      <Text style={styles.previewText}>Stored Size: {selectedDoc.size}</Text>
      <Text style={styles.previewText}>Added: {selectedDoc.uploadedAt}</Text>
      <Text style={styles.previewText}>
        Recovery: {selectedDoc.recoverable ? 'Enabled' : 'Disabled'}
      </Text>
      {!keyBackupEnabled ? (
        <Text style={styles.previewText}>
          Key backup is currently off in settings.
        </Text>
      ) : null}
      <Text style={styles.previewText}>
        Offline: {hasLocalCopy ? 'Saved locally' : 'Not saved'}
      </Text>
      <Text style={styles.previewText}>
        Cloud: {hasFirebaseCopy ? 'Saved in Firebase' : 'Not in cloud'}
      </Text>
      {!hasFirebaseCopy ? (
        <Text style={styles.previewText}>
          Recovery requires a cloud-saved copy of this document.
        </Text>
      ) : null}

      {previewStatus ? (
        <Text style={styles.backupStatus}>{previewStatus}</Text>
      ) : null}

      <View style={styles.previewActionsWrap}>
        <View style={styles.previewActionButton}>
          <PrimaryButton
            label="Export"
            icon={ArrowDownTrayIcon}
            onPress={() => {
              void onExport();
            }}
          />
        </View>
        {canShareDocument ? (
          <View style={styles.previewActionButton}>
            <PrimaryButton
              label="Share"
              icon={ShareIcon}
              onPress={() => onShare(selectedDoc)}
              disabled={isGuest || !hasFirebaseCopy}
            />
          </View>
        ) : null}
        {canSaveOfflineDocument ? (
          <View style={styles.previewActionButton}>
            <PrimaryButton
              label={
                isSavingOffline
                  ? 'Saving...'
                  : hasLocalCopy
                  ? 'Delete Offline'
                  : 'Save Offline'
              }
              icon={hasLocalCopy ? MinusCircleIcon : CloudArrowDownIcon}
              variant={hasLocalCopy ? 'danger' : 'default'}
              disabled={isSavingOffline}
              onPress={() => {
                if (hasLocalCopy) {
                  void onDeleteLocal(selectedDoc);
                  return;
                }

                void (async () => {
                  setIsSavingOffline(true);
                  try {
                    await onSaveOffline(selectedDoc);
                  } finally {
                    setIsSavingOffline(false);
                  }
                })();
              }}
            />
          </View>
        ) : null}
        <View style={styles.previewActionButton}>
          {isOwner ? (
            <PrimaryButton
              label={hasFirebaseCopy ? 'Delete from Cloud' : 'Save to Cloud'}
              icon={hasFirebaseCopy ? TrashIcon : CloudArrowUpIcon}
              variant={hasFirebaseCopy ? 'danger' : 'outline'}
              onPress={() => {
                if (hasFirebaseCopy) {
                  void onDeleteFromFirebase(selectedDoc);
                  return;
                }

                void onSaveToFirebase(selectedDoc);
              }}
            />
          ) : hasFirebaseCopy ? (
            <PrimaryButton
              label="Decline Share"
              icon={MinusCircleIcon}
              variant="danger"
              onPress={() => onDeclineIncomingShare(selectedDoc.id)}
            />
          ) : null}
        </View>
        {isOwner ? (
          <View style={styles.previewActionButton}>
            <PrimaryButton
              label={
                selectedDoc.recoverable
                  ? 'Disable Key Backup for this Doc'
                  : 'Enable Key Backup for this Doc'
              }
              icon={KeyIcon}
              disabled={!hasFirebaseCopy}
              onPress={() => {
                void onToggleRecovery(selectedDoc, !selectedDoc.recoverable);
              }}
            />
          </View>
        ) : null}
      </View>
    </ScrollView>
  );
}
