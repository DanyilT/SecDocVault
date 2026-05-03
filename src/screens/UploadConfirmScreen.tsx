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

import { PrimaryButton, SecondaryButton } from '../components/ui';
import { toSizeLabel, UploadableDocument } from '../services/documentVault';
import { styles } from '../theme/styles';

type Props = {
  isUploading: boolean;
  uploadStatus: string;
  files: UploadableDocument[];
  selectedFileIndex: number;
  documentName: string;
  documentDescription: string;
  recoverable: boolean;
  uploadToCloud: boolean;
  saveLocalCopy: boolean;
  canToggleCloudUpload: boolean;
  canToggleSaveLocal: boolean;
  setSelectedFileIndex: (value: number) => void;
  setDocumentName: (value: string) => void;
  setDocumentDescription: (value: string) => void;
  setRecoverable: (value: boolean) => void;
  setUploadToCloud: (value: boolean) => void;
  setSaveLocalCopy: (value: boolean) => void;
  onRemoveFile: (index: number) => void;
  onReorderFiles: (fromIndex: number, toIndex: number) => void;
  onPickNewFile: () => void;
  onScanNewFile: () => void;
  onConfirmUpload: () => Promise<void>;
  keyBackupEnabled: boolean;
  onRequestEnableKeyBackup: () => void;
};

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

export function UploadConfirmScreen({
  isUploading,
  uploadStatus,
  files,
  selectedFileIndex,
  documentName,
  documentDescription,
  recoverable,
  uploadToCloud,
  saveLocalCopy,
  canToggleCloudUpload,
  canToggleSaveLocal: _canToggleSaveLocal,
  setSelectedFileIndex,
  setDocumentName,
  setDocumentDescription,
  setRecoverable,
  setUploadToCloud,
  setSaveLocalCopy,
  onRemoveFile,
  onReorderFiles,
  onPickNewFile,
  onScanNewFile,
  onConfirmUpload,
  keyBackupEnabled,
  onRequestEnableKeyBackup,
}: Props) {
  const [showFullPreview, setShowFullPreview] = React.useState(false);
  const [keyboardHeight, setKeyboardHeight] = React.useState(0);
  const [isReorderMode, setIsReorderMode] = React.useState(false);
  const [dragSourceIndex, setDragSourceIndex] = React.useState<number | null>(null);
  const scrollRef = React.useRef<ScrollView | null>(null);

  React.useEffect(() => {
    const showEvent = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const hideEvent = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';
    const showSub = Keyboard.addListener(showEvent, event => setKeyboardHeight(event.endCoordinates.height));
    const hideSub = Keyboard.addListener(hideEvent, () => setKeyboardHeight(0));
    return () => { showSub.remove(); hideSub.remove(); };
  }, []);

  const selectedFile = files[selectedFileIndex] ?? files[0];

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
                onRemove={() => onRemoveFile(index)}
                onDragStart={() => {
                  setIsReorderMode(true);
                  setDragSourceIndex(index);
                }}
                onDragEnd={() => {
                  setIsReorderMode(false);
                  setDragSourceIndex(null);
                }}
                onReorder={onReorderFiles}
              />
            ))}

            <Pressable
              onPress={onPickNewFile}
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
              onValueChange={value => {
                if (value && !keyBackupEnabled) {
                  onRequestEnableKeyBackup();
                  return;
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
              disabled={!canToggleCloudUpload}
            />
          </View>
          {!canToggleCloudUpload ? (
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
          <SecondaryButton label="Add from Gallery" onPress={onPickNewFile} />
          <SecondaryButton label="Scan to Add" onPress={onScanNewFile} />
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
          onPress={() => void onConfirmUpload()}
        />
      </ScrollView>
    </View>
  );
}
