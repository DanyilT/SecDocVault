import React from 'react';
import { Image, Modal, PanResponder, Pressable, ScrollView, Text, View } from 'react-native';
import Clipboard from '@react-native-clipboard/clipboard';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
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

import { useAuth } from '../context/AuthContext';
import { useDocumentVaultContext } from '../context/DocumentVaultContext';
import { Header, PrimaryButton } from '../components/ui';
import {
  decryptDocumentPayload,
  deleteDocumentFromFirebase,
  exportDocumentToDevice,
  removeLocalDocumentCopy,
  saveDocumentOffline,
  saveDocumentToFirebase,
  updateDocumentRecoveryPreference,
} from '../services/documentVault';
import { getVaultPreferences } from '../storage/localVault';
import { styles } from '../theme/styles';
import type { VaultDocument } from '../types/vault';
import type { VaultStackParamList } from '../navigation/types';

type Props = NativeStackScreenProps<VaultStackParamList, 'Preview'>;

export function PreviewScreen({ route, navigation }: Props) {
  const { docId } = route.params;
  const { user, isGuest } = useAuth();
  const { documents, setDocuments, handleDeclineIncomingShare } = useDocumentVaultContext();

  const doc = documents.find(d => d.id === docId);

  const [previewFileOrder, setPreviewFileOrder] = React.useState(0);
  const [previewImageUri, setPreviewImageUri] = React.useState<string | null>(null);
  const [previewStatus, setPreviewStatus] = React.useState('');
  const [isDecrypting, setIsDecrypting] = React.useState(false);
  const [isCurrentFileDecrypted, setIsCurrentFileDecrypted] = React.useState(false);
  const [isSavingOffline, setIsSavingOffline] = React.useState(false);
  const [showFullImage, setShowFullImage] = React.useState(false);
  const [integrityCopied, setIntegrityCopied] = React.useState(false);
  const [showIntegrityInfo, setShowIntegrityInfo] = React.useState(false);
  const [keyBackupEnabled, setKeyBackupEnabled] = React.useState(false);
  const copyResetTimerRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);

  React.useEffect(() => {
    void getVaultPreferences().then(prefs => setKeyBackupEnabled(prefs.keyBackupEnabled));
  }, []);

  React.useEffect(() => {
    return () => {
      if (copyResetTimerRef.current) clearTimeout(copyResetTimerRef.current);
    };
  }, []);

  React.useEffect(() => {
    setIntegrityCopied(false);
    setPreviewImageUri(null);
    setIsCurrentFileDecrypted(false);
    setPreviewStatus('');
  }, [previewFileOrder]);

  if (!doc) {
    return (
      <View style={{ flex: 1 }}>
        <Header title="Preview" showBack onBack={() => navigation.goBack()} />
        <View style={styles.pageBody}>
          <Text style={styles.subtitle}>Document not found.</Text>
        </View>
      </View>
    );
  }

  const currentUserId = user?.uid ?? null;
  const isOwner = Boolean(currentUserId) && doc.owner === currentUserId;
  const hasLocalCopy = Boolean(doc.references?.some(ref => ref.source === 'local'));
  const hasFirebaseCopy = Boolean(doc.references?.some(ref => ref.source === 'firebase'));
  const canShareDocument = !isGuest && isOwner && hasFirebaseCopy;

  const files = (() => {
    const byOrder = new Map<number, NonNullable<VaultDocument['references']>[number]>();
    const references = [...(doc.references ?? [])].sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
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
    files[selectedIndex]?.integrityTag ?? files[selectedIndex]?.fileHash ?? doc.hash;

  const panResponder = PanResponder.create({
    onMoveShouldSetPanResponder: (_, g) => Math.abs(g.dx) > 10,
    onPanResponderRelease: (_, g) => {
      if (files.length <= 1 || Math.abs(g.dx) < 40) return;
      if (g.dx < 0 && selectedIndex < files.length - 1) {
        setPreviewFileOrder(files[selectedIndex + 1].order);
        return;
      }
      if (g.dx > 0 && selectedIndex > 0) {
        setPreviewFileOrder(files[selectedIndex - 1].order);
      }
    },
  });

  const handleDecrypt = async () => {
    setIsDecrypting(true);
    setPreviewStatus('Decrypting...');
    try {
      const result = await decryptDocumentPayload(doc, previewFileOrder);
      if (result.mimeType?.startsWith('image/')) {
        setPreviewImageUri(`data:${result.mimeType};base64,${result.base64}`);
      }
      setIsCurrentFileDecrypted(true);
      setPreviewStatus('');
    } catch (err) {
      setPreviewStatus(err instanceof Error ? err.message : 'Decryption failed.');
      setIsCurrentFileDecrypted(false);
    } finally {
      setIsDecrypting(false);
    }
  };

  const handleExport = async () => {
    setPreviewStatus('Exporting...');
    try {
      await exportDocumentToDevice(doc, previewFileOrder);
      setPreviewStatus('Exported successfully.');
    } catch (err) {
      setPreviewStatus(err instanceof Error ? err.message : 'Export failed.');
    }
  };

  const handleSaveOffline = async () => {
    setIsSavingOffline(true);
    try {
      const updated = await saveDocumentOffline(doc);
      setDocuments(prev => prev.map(d => (d.id === updated.id ? updated : d)));
    } catch (err) {
      setPreviewStatus(err instanceof Error ? err.message : 'Failed to save offline.');
    } finally {
      setIsSavingOffline(false);
    }
  };

  const handleDeleteLocal = async () => {
    try {
      const updated = await removeLocalDocumentCopy(doc);
      setDocuments(prev => prev.map(d => (d.id === updated.id ? updated : d)));
    } catch (err) {
      setPreviewStatus(err instanceof Error ? err.message : 'Failed to delete local copy.');
    }
  };

  const handleSaveToFirebase = async () => {
    if (!currentUserId) return;
    try {
      const updated = await saveDocumentToFirebase(doc, currentUserId);
      setDocuments(prev => prev.map(d => (d.id === updated.id ? updated : d)));
    } catch (err) {
      setPreviewStatus(err instanceof Error ? err.message : 'Failed to save to cloud.');
    }
  };

  const handleDeleteFromFirebase = async () => {
    try {
      await deleteDocumentFromFirebase(doc);
      navigation.goBack();
    } catch (err) {
      setPreviewStatus(err instanceof Error ? err.message : 'Failed to delete from cloud.');
    }
  };

  const handleToggleRecovery = async (nextValue: boolean) => {
    try {
      const updated = await updateDocumentRecoveryPreference(doc, nextValue);
      setDocuments(prev => prev.map(d => (d.id === updated.id ? updated : d)));
    } catch (err) {
      setPreviewStatus(err instanceof Error ? err.message : 'Failed to update recovery setting.');
    }
  };

  return (
    <View style={{ flex: 1 }}>
      <Header title={doc.name} showBack onBack={() => navigation.goBack()} />
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={[styles.scrollContainer, { paddingBottom: 28 }]}
        keyboardShouldPersistTaps="handled"
      >

      <Pressable
        {...panResponder.panHandlers}
        onPress={() => {
          if (previewImageUri) {
            setShowFullImage(true);
            return;
          }
          if (!isCurrentFileDecrypted && !isDecrypting) {
            void handleDecrypt();
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
                onPress={() => setPreviewFileOrder(file.order)}
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
          if (!selectedFileIntegrity) return;
          Clipboard.setString(selectedFileIntegrity);
          setIntegrityCopied(true);
          if (copyResetTimerRef.current) clearTimeout(copyResetTimerRef.current);
          copyResetTimerRef.current = setTimeout(() => setIntegrityCopied(false), 1000);
        }}
      >
        <Text style={styles.hashBlock}>{integrityCopied ? 'Copied!' : selectedFileIntegrity}</Text>
      </Pressable>

      {doc.description ? (
        <Text style={styles.previewText}>Description: {doc.description}</Text>
      ) : null}
      <Text style={styles.previewText}>Stored Size: {doc.size}</Text>
      <Text style={styles.previewText}>Added: {doc.uploadedAt}</Text>
      <Text style={styles.previewText}>
        Recovery: {doc.recoverable ? 'Enabled' : 'Disabled'}
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
          <PrimaryButton label="Export" icon={ArrowDownTrayIcon} onPress={() => void handleExport()} />
        </View>
        {canShareDocument ? (
          <View style={styles.previewActionButton}>
            <PrimaryButton
              label="Share"
              icon={ShareIcon}
              onPress={() => navigation.navigate('Share', { docId: doc.id })}
              disabled={isGuest || !hasFirebaseCopy}
            />
          </View>
        ) : null}
        <View style={styles.previewActionButton}>
          <PrimaryButton
            label={isSavingOffline ? 'Saving...' : hasLocalCopy ? 'Delete Offline' : 'Save Offline'}
            icon={hasLocalCopy ? MinusCircleIcon : CloudArrowDownIcon}
            variant={hasLocalCopy ? 'danger' : 'default'}
            disabled={isSavingOffline}
            onPress={() =>
              hasLocalCopy ? void handleDeleteLocal() : void handleSaveOffline()
            }
          />
        </View>
        <View style={styles.previewActionButton}>
          {isOwner ? (
            <PrimaryButton
              label={hasFirebaseCopy ? 'Delete from Cloud' : 'Save to Cloud'}
              icon={hasFirebaseCopy ? TrashIcon : CloudArrowUpIcon}
              variant={hasFirebaseCopy ? 'danger' : 'outline'}
              onPress={() =>
                hasFirebaseCopy ? void handleDeleteFromFirebase() : void handleSaveToFirebase()
              }
            />
          ) : hasFirebaseCopy ? (
            <PrimaryButton
              label="Decline Share"
              icon={MinusCircleIcon}
              variant="danger"
              onPress={() => handleDeclineIncomingShare(doc.id)}
            />
          ) : null}
        </View>
        {isOwner ? (
          <View style={styles.previewActionButton}>
            <PrimaryButton
              label={
                doc.recoverable
                  ? 'Disable Key Backup for this Doc'
                  : 'Enable Key Backup for this Doc'
              }
              icon={KeyIcon}
              disabled={!hasFirebaseCopy}
              onPress={() => void handleToggleRecovery(!doc.recoverable)}
            />
          </View>
        ) : null}
      </View>
      </ScrollView>
    </View>
  );
}
