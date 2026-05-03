import React from 'react';
import { Alert, Modal, PanResponder, Platform, Pressable, ScrollView, Text, View } from 'react-native';
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
  DocumentArrowDownIcon,
} from 'react-native-heroicons/solid';
import { captureRef } from 'react-native-view-shot';
import RNFS from 'react-native-fs';

import { PrimaryButton } from '../components/ui';
import { CensoredImageView } from '../components/CensoredImageView';
import { CensorToggle } from '../components/CensorToggle';
import { censorImage, CensorResult } from '../services/censor';
import { styles } from '../theme/styles';
import type { VaultDocument } from '../types/vault';

type Props = {
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
  onToggleRecovery: (doc: VaultDocument, enabled: boolean) => Promise<void>;
  onDeclineIncomingShare: (docId: string) => void;
};

export function PreviewScreen({
  selectedDoc,
  previewFileOrder,
  previewImageUri,
  previewStatus,
  isDecrypting,
  isCurrentFileDecrypted,
  isGuest: _isGuest,
  canShareDocument,
  canSaveOfflineDocument: _canSaveOfflineDocument,
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
}: Props) {
  const [isSavingOffline, setIsSavingOffline] = React.useState(false);
  const [showFullImage, setShowFullImage] = React.useState(false);
  const [integrityCopied, setIntegrityCopied] = React.useState(false);
  const [showIntegrityInfo, setShowIntegrityInfo] = React.useState(false);
  const copyResetTimerRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);

  const [censorEnabled, setCensorEnabled] = React.useState(false);
  const [censorLoading, setCensorLoading] = React.useState(false);
  const [censorResult, setCensorResult] = React.useState<CensorResult | null>(null);
  const [isSavingCensored, setIsSavingCensored] = React.useState(false);
  const [censorSaveStatus, setCensorSaveStatus] = React.useState<string | null>(null);

  const censoredImageRef = React.useRef<View>(null);

  React.useEffect(() => {
    return () => {
      if (copyResetTimerRef.current) clearTimeout(copyResetTimerRef.current);
    };
  }, []);

  React.useEffect(() => {
    setIntegrityCopied(false);
  }, [previewFileOrder]);

  React.useEffect(() => {
    if (!censorEnabled || !previewImageUri) {
      setCensorResult(null);
      return;
    }
    let cancelled = false;
    setCensorLoading(true);
    censorImage(previewImageUri)
      .then(r => { if (!cancelled) setCensorResult(r); })
      .finally(() => { if (!cancelled) setCensorLoading(false); });
    return () => { cancelled = true; };
  }, [censorEnabled, previewImageUri]);

  React.useEffect(() => {
    setCensorEnabled(false);
    setCensorResult(null);
    setCensorSaveStatus(null);
  }, [previewImageUri]);

  const saveCensoredVersion = React.useCallback(async () => {
    if (!censoredImageRef.current || !censorResult) return;
    setIsSavingCensored(true);
    setCensorSaveStatus(null);
    try {
      const base64 = await captureRef(censoredImageRef, { format: 'png', quality: 1, result: 'base64' });
      const targetDir = Platform.OS === 'android' ? RNFS.DownloadDirectoryPath : RNFS.DocumentDirectoryPath;
      const safeName = (selectedDoc.name ?? 'document').replace(/[^a-z0-9_\-. ]/gi, '_');
      const outputPath = `${targetDir}/${Date.now()}-censored-${safeName}.png`;
      await RNFS.writeFile(outputPath, base64, 'base64');
      setCensorSaveStatus(`Censored image saved to:\n${outputPath}`);
    } catch (err) {
      setCensorSaveStatus(`Failed to save: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setIsSavingCensored(false);
    }
  }, [censorResult, selectedDoc.name]);

  const isOwner = Boolean(currentUserId) && selectedDoc.owner === currentUserId;

  const files = (() => {
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
      .sort((l, r) => l[0] - r[0])
      .map(([order, reference]) => ({ order, ...reference }));
  })();

  const selectedIndex = Math.max(0, files.findIndex(item => item.order === previewFileOrder));
  const selectedFileIntegrity =
    files[selectedIndex]?.integrityTag ?? files[selectedIndex]?.fileHash ?? selectedDoc.hash;

  const panResponder = PanResponder.create({
    onMoveShouldSetPanResponder: (_, g) => Math.abs(g.dx) > 10,
    onPanResponderRelease: (_, g) => {
      if (files.length <= 1 || Math.abs(g.dx) < 40) return;
      if (g.dx < 0 && selectedIndex < files.length - 1) {
        onSelectFile(files[selectedIndex + 1].order);
        return;
      }
      if (g.dx > 0 && selectedIndex > 0) {
        onSelectFile(files[selectedIndex - 1].order);
      }
    },
  });

  const handleSaveOffline = async () => {
    setIsSavingOffline(true);
    try {
      await onSaveOffline(selectedDoc);
    } finally {
      setIsSavingOffline(false);
    }
  };

  const handleDeleteLocal = async () => {
    if (!hasFirebaseCopy) {
      const confirmed = await new Promise<boolean>(resolve =>
        Alert.alert(
          'Delete document permanently?',
          `"${selectedDoc.name}" has no cloud copy. Deleting the offline copy will permanently remove this document and it cannot be recovered.`,
          [
            { text: 'Cancel', style: 'cancel', onPress: () => resolve(false) },
            { text: 'Delete Permanently', style: 'destructive', onPress: () => resolve(true) },
          ],
        ),
      );
      if (!confirmed) return;
    }
    await onDeleteLocal(selectedDoc);
  };

  const handleDeleteFromFirebase = async () => {
    if (!hasLocalCopy) {
      const confirmed = await new Promise<boolean>(resolve =>
        Alert.alert(
          'Delete document permanently?',
          `"${selectedDoc.name}" has no offline copy. Deleting the cloud copy will permanently remove this document and it cannot be recovered.`,
          [
            { text: 'Cancel', style: 'cancel', onPress: () => resolve(false) },
            { text: 'Delete Permanently', style: 'destructive', onPress: () => resolve(true) },
          ],
        ),
      );
      if (!confirmed) return;
    }
    await onDeleteFromFirebase(selectedDoc);
  };

  return (
    <View style={{ flex: 1 }}>
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={[styles.scrollContainer, { paddingBottom: 28 }]}
        keyboardShouldPersistTaps="handled"
      >

      {previewImageUri ? (
        <View style={{ alignSelf: 'flex-start', marginBottom: 8 }}>
          <CensorToggle
            value={censorEnabled}
            loading={censorLoading}
            onChange={setCensorEnabled}
          />
        </View>
      ) : null}

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
          <CensoredImageView
            ref={censoredImageRef}
            uri={previewImageUri}
            censor={censorEnabled ? censorResult : null}
            resizeMode="contain"
            style={[styles.previewImage, { borderWidth: 0, borderRadius: 0, height: '100%' }]}
          />
        ) : (
          <View style={{ width: '100%', height: '100%', padding: 16, justifyContent: 'space-between' }}>
            <View style={{ gap: 6 }}>
              <View style={{ height: 6, width: '76%', backgroundColor: '#1e293b', borderRadius: 4 }} />
              <View style={{ height: 6, width: '58%', backgroundColor: '#1e293b', borderRadius: 4 }} />
              <View style={{ height: 6, width: '84%', backgroundColor: '#1e293b', borderRadius: 4 }} />
            </View>
            <View style={{ alignItems: 'center' }}>
              <Text style={{ color: '#64748b', fontSize: 52 }}># # #</Text>
              <Text style={{ color: '#93c5fd', fontSize: 18, fontWeight: '800', marginTop: 6 }}>
                Decrypt
              </Text>
              <Text style={{ color: '#94a3b8', marginTop: 4 }}>
                {isDecrypting ? 'Decrypting document...' : 'Tap to decrypt this document'}
              </Text>
            </View>
            <View style={{ gap: 6 }}>
              <View style={{ height: 6, width: '70%', backgroundColor: '#1e293b', borderRadius: 4 }} />
              <View style={{ height: 6, width: '64%', backgroundColor: '#1e293b', borderRadius: 4 }} />
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
                <Text style={{ color: '#bfdbfe', fontWeight: '800' }}>#{file.order}</Text>
                <Text style={{ color: '#94a3b8', fontSize: 11, marginTop: 4 }} numberOfLines={1}>
                  {file.type}
                </Text>
              </Pressable>
            );
          })}
        </ScrollView>
      ) : null}

      {files.length > 0 ? (
        <Text style={styles.previewText}>
          File {selectedIndex + 1} of {files.length} (index {files[selectedIndex]?.order ?? 0})
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
            <View style={{ width: '100%', height: '100%' }}>
              <CensoredImageView
                uri={previewImageUri}
                censor={censorEnabled ? censorResult : null}
                resizeMode="contain"
              />
            </View>
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
          if (!selectedFileIntegrity) return;
          Clipboard.setString(selectedFileIntegrity);
          setIntegrityCopied(true);
          if (copyResetTimerRef.current) clearTimeout(copyResetTimerRef.current);
          copyResetTimerRef.current = setTimeout(() => setIntegrityCopied(false), 1000);
        }}
      >
        <Text style={styles.hashBlock}>{integrityCopied ? 'Copied!' : selectedFileIntegrity}</Text>
      </Pressable>

      {selectedDoc.description ? (
        <Text style={styles.previewText}>Description: {selectedDoc.description}</Text>
      ) : null}
      <Text style={styles.previewText}>Stored Size: {selectedDoc.size}</Text>
      <Text style={styles.previewText}>Added: {selectedDoc.uploadedAt}</Text>
      <Text style={styles.previewText}>
        Recovery: {selectedDoc.recoverable ? 'Enabled' : 'Disabled'}
      </Text>
      {!keyBackupEnabled ? (
        <Text style={styles.previewText}>Key backup is currently off in settings.</Text>
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

      {previewStatus ? <Text style={styles.backupStatus}>{previewStatus}</Text> : null}

      <View style={styles.previewActionsWrap}>
        <View style={styles.previewActionButton}>
          <PrimaryButton label="Export" icon={ArrowDownTrayIcon} onPress={() => void onExport()} />
        </View>
        {canShareDocument ? (
          <View style={styles.previewActionButton}>
            <PrimaryButton
              label="Share"
              icon={ShareIcon}
              onPress={() => onShare(selectedDoc)}
              disabled={!hasFirebaseCopy}
            />
          </View>
        ) : null}
        <View style={styles.previewActionButton}>
          <PrimaryButton
            label={isSavingOffline ? 'Saving...' : hasLocalCopy ? 'Delete Offline' : 'Save Offline'}
            icon={hasLocalCopy ? MinusCircleIcon : CloudArrowDownIcon}
            variant={hasLocalCopy ? 'danger' : 'default'}
            disabled={isSavingOffline}
            onPress={() => hasLocalCopy ? void handleDeleteLocal() : void handleSaveOffline()}
          />
        </View>
        {censorEnabled && censorResult && !censorLoading ? (
          <View style={styles.previewActionButton}>
            <PrimaryButton
              label={isSavingCensored ? 'Saving…' : 'Save Censored Version'}
              icon={DocumentArrowDownIcon}
              variant="outline"
              disabled={isSavingCensored}
              onPress={() => void saveCensoredVersion()}
            />
          </View>
        ) : null}
        <View style={styles.previewActionButton}>
          {isOwner ? (
            <PrimaryButton
              label={hasFirebaseCopy ? 'Delete from Cloud' : 'Save to Cloud'}
              icon={hasFirebaseCopy ? TrashIcon : CloudArrowUpIcon}
              variant={hasFirebaseCopy ? 'danger' : 'outline'}
              onPress={() =>
                hasFirebaseCopy ? void handleDeleteFromFirebase() : void onSaveToFirebase(selectedDoc)
              }
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
              onPress={() => void onToggleRecovery(selectedDoc, !selectedDoc.recoverable)}
            />
          </View>
        ) : null}
      </View>

      {censorSaveStatus ? (
        <Text style={[styles.backupStatus, { marginTop: 8 }]}>{censorSaveStatus}</Text>
      ) : null}
      </ScrollView>
    </View>
  );
}
