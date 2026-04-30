import React from 'react';
import {
  Animated,
  Image,
  Keyboard,
  Modal,
  PanResponder,
  Platform,
  Pressable,
  ScrollView,
  Switch,
  Text,
  TextInput,
  View,
} from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';

import { useAuth } from '../context/AuthContext';
import { useDocumentVaultContext } from '../context/DocumentVaultContext';
import { PrimaryButton, SecondaryButton } from '../components/ui';
import {
  documentSaveLocal,
  pickDocumentForUpload,
  scanDocumentForUpload,
  toSizeLabel,
  uploadDocumentToFirebase,
  UploadableDocument,
  UploadableDocumentDraft,
} from '../services/documentVault';
import { ensureRecoveryPassphrase } from '../services/keyBackup';
import { getVaultPreferences, saveVaultPreferences } from '../storage/localVault';
import { styles } from '../theme/styles';
import type { VaultStackParamList } from '../navigation/types';

type Props = NativeStackScreenProps<VaultStackParamList, 'Upload'>;

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function UploadTile({
  file,
  index,
  total,
  selected,
  isReorderMode,
  isDragSource,
  onSelect,
  onRemove,
  onDragStart,
  onDragEnd,
  onReorder,
}: {
  file: UploadableDocument;
  index: number;
  total: number;
  selected: boolean;
  isReorderMode: boolean;
  isDragSource: boolean;
  onSelect: () => void;
  onRemove: () => void;
  onDragStart: () => void;
  onDragEnd: () => void;
  onReorder: (from: number, to: number) => void;
}) {
  const drag = React.useRef(new Animated.ValueXY({ x: 0, y: 0 })).current;
  const shake = React.useRef(new Animated.Value(0)).current;
  const shakeLoopRef = React.useRef<Animated.CompositeAnimation | null>(null);
  const [isDragging, setIsDragging] = React.useState(false);

  const startShake = React.useCallback(() => {
    if (shakeLoopRef.current) return;
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(shake, { toValue: -1, duration: 50, useNativeDriver: true }),
        Animated.timing(shake, { toValue: 1, duration: 90, useNativeDriver: true }),
        Animated.timing(shake, { toValue: 0, duration: 50, useNativeDriver: true }),
      ]),
    );
    shakeLoopRef.current = loop;
    loop.start();
  }, [shake]);

  const stopShake = React.useCallback(() => {
    shakeLoopRef.current?.stop();
    shakeLoopRef.current = null;
    Animated.timing(shake, { toValue: 0, duration: 80, useNativeDriver: true }).start();
  }, [shake]);

  const panResponder = React.useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => false,
        onMoveShouldSetPanResponder: (_, gesture) =>
          isReorderMode &&
          Math.abs(gesture.dx) > 4 &&
          Math.abs(gesture.dx) > Math.abs(gesture.dy) + 2,
        onPanResponderGrant: () => {
          setIsDragging(true);
          startShake();
          onDragStart();
        },
        onPanResponderMove: (_, gesture) => {
          drag.setValue({ x: gesture.dx, y: gesture.dy });
        },
        onPanResponderRelease: (_, gesture) => {
          setIsDragging(false);
          drag.setValue({ x: 0, y: 0 });
          stopShake();
          onDragEnd();
          const shift = Math.round(gesture.dx / 72);
          if (shift === 0) return;
          const target = clamp(index + shift, 0, total - 1);
          if (target !== index) onReorder(index, target);
        },
        onPanResponderTerminate: () => {
          setIsDragging(false);
          drag.setValue({ x: 0, y: 0 });
          stopShake();
          onDragEnd();
        },
        onPanResponderTerminationRequest: () => false,
        onShouldBlockNativeResponder: () => isReorderMode || isDragging,
      }),
    [drag, index, isDragging, isReorderMode, onDragEnd, onDragStart, onReorder, startShake, stopShake, total],
  );

  React.useEffect(() => {
    return () => { shakeLoopRef.current?.stop(); };
  }, []);

  const shakeRotate = shake.interpolate({
    inputRange: [-1, 0, 1],
    outputRange: ['-2deg', '0deg', '2deg'],
  });

  return (
    <Animated.View
      {...panResponder.panHandlers}
      style={{
        width: 78,
        height: 78,
        borderRadius: 12,
        borderWidth: selected ? 2 : 1,
        borderColor: selected ? '#60a5fa' : '#334155',
        overflow: 'hidden',
        backgroundColor: '#0f172a',
        transform: [{ translateX: drag.x }, { translateY: drag.y }, { rotate: shakeRotate }],
        opacity: isDragSource && !isDragging ? 0.55 : isDragging ? 0.9 : 1,
        zIndex: isDragging ? 10 : 1,
      }}
    >
      <Pressable
        {...panResponder.panHandlers}
        delayLongPress={160}
        onLongPress={() => { startShake(); onDragStart(); }}
        onPressOut={() => { if (!isDragging) { stopShake(); onDragEnd(); } }}
        onPress={onSelect}
        style={{ flex: 1 }}
      >
        <Image source={{ uri: file.uri }} style={{ width: '100%', height: '100%' }} resizeMode="cover" />
      </Pressable>
      <Pressable
        onPress={onRemove}
        style={{
          position: 'absolute',
          top: 4,
          right: 4,
          width: 20,
          height: 20,
          borderRadius: 10,
          backgroundColor: 'rgba(15,23,42,0.88)',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <Text style={{ color: '#f8fafc', fontSize: 12, fontWeight: '800' }}>x</Text>
      </Pressable>
      <View
        style={{
          position: 'absolute',
          left: 4,
          bottom: 4,
          paddingHorizontal: 6,
          paddingVertical: 2,
          borderRadius: 6,
          backgroundColor: 'rgba(15,23,42,0.88)',
        }}
      >
        <Text style={{ color: '#bfdbfe', fontSize: 11, fontWeight: '700' }}>#{index}</Text>
      </View>
    </Animated.View>
  );
}

export function UploadConfirmScreen({ route, navigation }: Props) {
  const { draft, saveOfflineByDefault, recoverableByDefault, canUseCloud } = route.params;
  const { user, isGuest } = useAuth();
  const { setDocuments } = useDocumentVaultContext();

  const [files, setFiles] = React.useState<UploadableDocument[]>(draft.files);
  const [documentName, setDocumentName] = React.useState(draft.name);
  const [documentDescription, setDocumentDescription] = React.useState(draft.description ?? '');
  const [recoverable, setRecoverable] = React.useState(recoverableByDefault);
  const [uploadToCloud, setUploadToCloud] = React.useState(canUseCloud);
  const [saveLocalCopy, setSaveLocalCopy] = React.useState(saveOfflineByDefault || !canUseCloud);
  const [keyBackupEnabled, setKeyBackupEnabled] = React.useState(false);
  const [isUploading, setIsUploading] = React.useState(false);
  const [uploadStatus, setUploadStatus] = React.useState('');
  const [selectedFileIndex, setSelectedFileIndex] = React.useState(0);
  const [showFullPreview, setShowFullPreview] = React.useState(false);
  const [keyboardHeight, setKeyboardHeight] = React.useState(0);
  const [isReorderMode, setIsReorderMode] = React.useState(false);
  const [dragSourceIndex, setDragSourceIndex] = React.useState<number | null>(null);
  const scrollRef = React.useRef<ScrollView | null>(null);

  React.useEffect(() => {
    void getVaultPreferences().then(prefs => setKeyBackupEnabled(prefs.keyBackupEnabled));
  }, []);

  React.useEffect(() => {
    const showEvent = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const hideEvent = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';
    const showSub = Keyboard.addListener(showEvent, event => setKeyboardHeight(event.endCoordinates.height));
    const hideSub = Keyboard.addListener(hideEvent, () => setKeyboardHeight(0));
    return () => { showSub.remove(); hideSub.remove(); };
  }, []);

  const selectedFile = files[selectedFileIndex] ?? files[0];
  const ownerId = isGuest ? 'guest-local' : (user?.uid ?? 'guest-local');

  const handlePickNewFile = async () => {
    try {
      const picked = await pickDocumentForUpload();
      setFiles(prev => [...prev, picked]);
    } catch {
      // user cancelled
    }
  };

  const handleScanNewFile = async () => {
    try {
      const scanned = await scanDocumentForUpload();
      setFiles(prev => [...prev, scanned]);
    } catch {
      // user cancelled
    }
  };

  const handleRemoveFile = (index: number) => {
    setFiles(prev => {
      const next = prev.filter((_, i) => i !== index);
      setSelectedFileIndex(idx => Math.min(idx, Math.max(0, next.length - 1)));
      return next;
    });
  };

  const handleReorderFiles = (fromIndex: number, toIndex: number) => {
    setFiles(prev => {
      const next = [...prev];
      const [moved] = next.splice(fromIndex, 1);
      next.splice(toIndex, 0, moved);
      return next;
    });
  };

  const handleConfirmUpload = async () => {
    if (files.length === 0 || documentName.trim() === '') return;
    setIsUploading(true);
    setUploadStatus('Preparing upload...');
    try {
      const uploadDraft: UploadableDocumentDraft = {
        name: documentName.trim(),
        description: documentDescription.trim() || undefined,
        files,
      };

      let result;
      if (uploadToCloud && canUseCloud && !isGuest) {
        result = await uploadDocumentToFirebase(ownerId, uploadDraft, {
          alsoSaveLocal: saveLocalCopy,
          recoverable,
          onProgress: event => {
            if (event.stage === 'upload' && event.status === 'start') {
              setUploadStatus(`Uploading file ${event.fileIndex + 1} of ${files.length}...`);
            }
          },
        });
      } else {
        result = await documentSaveLocal(ownerId, uploadDraft, { recoverable });
      }

      setDocuments(prev => [...prev, result.document]);
      setUploadStatus('Upload complete!');
      navigation.navigate('Main');
    } catch (err) {
      setUploadStatus(err instanceof Error ? err.message : 'Upload failed.');
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <View style={{ flex: 1 }}>
      <ScrollView
        ref={scrollRef}
        style={{ flex: 1 }}
        contentContainerStyle={[styles.scrollContainer, { paddingBottom: keyboardHeight + 24 }]}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        scrollEnabled={!isReorderMode}
      >
        <Text style={styles.pageTitle}>Confirm Upload</Text>
        <Text style={styles.subtitle}>
          Arrange files in order, remove unwanted ones, then upload as one document.
        </Text>
        {isReorderMode ? (
          <Text style={[styles.previewLabel, { marginBottom: 0 }]}>
            Reorder mode active - drag left or right, then release to place.
          </Text>
        ) : (
          <Text style={[styles.subtitle, { marginBottom: 0 }]}>
            Hold an image and drag horizontally to reorder.
          </Text>
        )}

        <View style={styles.card}>
          <Text style={styles.sectionLabel}>Document Files ({files.length})</Text>

          {selectedFile ? (
            <Pressable
              onPress={() => setShowFullPreview(true)}
              style={{
                width: '100%',
                aspectRatio: 1,
                borderRadius: 14,
                overflow: 'hidden',
                borderWidth: 1,
                borderColor: '#334155',
                backgroundColor: '#0f172a',
              }}
            >
              <Image
                source={{ uri: selectedFile.uri }}
                style={{ width: '100%', height: '100%' }}
                resizeMode="cover"
              />
            </Pressable>
          ) : null}

          <Modal
            visible={showFullPreview}
            transparent
            animationType="fade"
            onRequestClose={() => setShowFullPreview(false)}
          >
            <Pressable
              onPress={() => setShowFullPreview(false)}
              style={{
                flex: 1,
                backgroundColor: 'rgba(2,6,23,0.95)',
                alignItems: 'center',
                justifyContent: 'center',
                padding: 16,
              }}
            >
              {selectedFile ? (
                <Image
                  source={{ uri: selectedFile.uri }}
                  resizeMode="contain"
                  style={{ width: '100%', height: '100%' }}
                />
              ) : null}
            </Pressable>
          </Modal>

          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            directionalLockEnabled
            nestedScrollEnabled
            scrollEnabled={!isReorderMode}
            contentContainerStyle={{ gap: 10 }}
          >
            {files.map((file, index) => (
              <UploadTile
                key={`${file.uri}-${index}`}
                file={file}
                index={index}
                total={files.length}
                selected={index === selectedFileIndex}
                isReorderMode={isReorderMode}
                isDragSource={isReorderMode && dragSourceIndex === index}
                onSelect={() => setSelectedFileIndex(index)}
                onRemove={() => handleRemoveFile(index)}
                onDragStart={() => {
                  setIsReorderMode(true);
                  setDragSourceIndex(index);
                }}
                onDragEnd={() => {
                  setIsReorderMode(false);
                  setDragSourceIndex(null);
                }}
                onReorder={handleReorderFiles}
              />
            ))}

            <Pressable
              onPress={() => void handlePickNewFile()}
              style={{
                width: 78,
                height: 78,
                borderRadius: 12,
                borderWidth: 1,
                borderStyle: 'dashed',
                borderColor: '#475569',
                alignItems: 'center',
                justifyContent: 'center',
                backgroundColor: '#0f172a',
                gap: 2,
              }}
            >
              <Text style={{ color: '#93c5fd', fontSize: 24, fontWeight: '700' }}>+</Text>
              <Text style={{ color: '#94a3b8', fontSize: 11 }}>Add</Text>
            </Pressable>
          </ScrollView>

          {selectedFile ? (
            <>
              <Text style={styles.cardMeta}>File: {selectedFile.name}</Text>
              <Text style={styles.cardMeta}>Size: {toSizeLabel(selectedFile.size)}</Text>
              <Text style={styles.cardMeta}>Type: {selectedFile.type}</Text>
              <Text style={styles.cardMeta}>Index: {selectedFileIndex}</Text>
            </>
          ) : null}
        </View>

        <View style={styles.fieldGroup}>
          <Text style={styles.sectionLabel}>Document Name</Text>
          <TextInput
            autoCapitalize="sentences"
            placeholder="Enter document name"
            placeholderTextColor="#6b7280"
            style={styles.input}
            value={documentName}
            onChangeText={setDocumentName}
          />

          <Text style={styles.sectionLabel}>Description (optional)</Text>
          <TextInput
            autoCapitalize="sentences"
            placeholder="Add description"
            placeholderTextColor="#6b7280"
            style={[styles.input, { minHeight: 86, textAlignVertical: 'top' }]}
            multiline
            value={documentDescription}
            onChangeText={setDocumentDescription}
          />

          <View style={styles.switchRow}>
            <View style={{ flex: 1, gap: 2 }}>
              <Text style={styles.switchLabel}>Enable key recovery for this document</Text>
              <Text style={[styles.subtitle, { marginBottom: 0 }]}>
                If enabled, this doc key can be restored on other devices using your recovery
                passphrase.
              </Text>
            </View>
            <Switch
              value={recoverable}
              onValueChange={async value => {
                if (value && !keyBackupEnabled) {
                  try {
                    await ensureRecoveryPassphrase();
                    const prefs = await getVaultPreferences();
                    await saveVaultPreferences({ ...prefs, keyBackupEnabled: true });
                    setKeyBackupEnabled(true);
                  } catch {
                    return;
                  }
                }
                setRecoverable(value);
              }}
            />
          </View>

          <View style={styles.switchRow}>
            <View style={{ flex: 1, gap: 2 }}>
              <Text style={styles.switchLabel}>Upload to cloud (Firebase Storage)</Text>
              <Text style={[styles.subtitle, { marginBottom: 0 }]}>
                Upload encrypted files to your private cloud vault.
              </Text>
            </View>
            <Switch
              value={uploadToCloud}
              onValueChange={setUploadToCloud}
              disabled={!canUseCloud || isGuest}
            />
          </View>
          {(!canUseCloud || isGuest) ? (
            <Text style={[styles.subtitle, { marginBottom: 0 }]}>
              Cloud upload unavailable for this session. Local save remains enabled.
            </Text>
          ) : null}

          <View style={styles.switchRow}>
            <View style={{ flex: 1, gap: 2 }}>
              <Text style={styles.switchLabel}>Save local encrypted copy (offline access)</Text>
              <Text style={[styles.subtitle, { marginBottom: 0 }]}>
                Keep an encrypted local copy so this document is available offline.
              </Text>
            </View>
            <Switch value={saveLocalCopy} onValueChange={setSaveLocalCopy} />
          </View>
          {!uploadToCloud && !saveLocalCopy ? (
            <Text style={[styles.subtitle, { marginBottom: 0 }]}>
              Enable at least one destination: local save or cloud upload.
            </Text>
          ) : null}
        </View>

        <View style={styles.cardActions}>
          <SecondaryButton label="Add from Gallery" onPress={() => void handlePickNewFile()} />
          <SecondaryButton label="Scan to Add" onPress={() => void handleScanNewFile()} />
        </View>

        {uploadStatus ? <Text style={styles.backupStatus}>{uploadStatus}</Text> : null}

        <PrimaryButton
          label={isUploading ? 'Uploading...' : 'Confirm & Upload'}
          disabled={
            isUploading ||
            documentName.trim().length === 0 ||
            files.length === 0 ||
            (!uploadToCloud && !saveLocalCopy)
          }
          onPress={() => void handleConfirmUpload()}
        />
      </ScrollView>
    </View>
  );
}
