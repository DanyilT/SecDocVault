/**
 * screens/UploadConfirmScreen.tsx
 *
 * Confirmation and progress screen shown during document encryption/upload.
 * Presents progress updates and final status. Keeps UI-focused logic only –
 * progress reporting is provided by the `useUploadFlow` hook.
 */

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

import { MusicalNoteIcon, PauseIcon, PlayIcon, XMarkIcon } from 'react-native-heroicons/solid';
import Pdf from 'react-native-pdf';
import Video from 'react-native-video';

import { PrimaryButton, SecondaryButton } from '../components/ui';
import { toSizeLabel, UploadableDocument } from '../services/documentVault';
import { getFileCategory, getFileIcon } from '../utils/fileType';
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
  onBrowseFileNewFile: () => void;
  onConfirmUpload: () => Promise<void>;
  keyBackupEnabled: boolean;
  onRequestEnableKeyBackup: () => void;
};

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

/**
 * AudioThumbnailPlayer
 *
 * Minimal play/pause control for an audio file, used in place of a visual
 * thumbnail since audio has no video track to render.
 *
 * @param {object} props - Component props
 * @param {string} props.uri - Local URI of the audio file
 * @returns {JSX.Element} Rendered audio player
 */
function AudioThumbnailPlayer({ uri }: { uri: string }) {
  const [isPlaying, setIsPlaying] = React.useState(false);

  return (
    <View style={{ width: '100%', height: '100%', alignItems: 'center', justifyContent: 'center', gap: 12 }}>
      <Video
        source={{ uri }}
        paused={!isPlaying}
        style={{ width: 0, height: 0 }}
        onEnd={() => setIsPlaying(false)}
        onError={() => undefined}
      />
      <MusicalNoteIcon color="#93c5fd" size={48} />
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={isPlaying ? 'Pause audio' : 'Play audio'}
        onPress={() => setIsPlaying(prev => !prev)}
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          gap: 8,
          paddingHorizontal: 16,
          paddingVertical: 8,
          borderRadius: 999,
          backgroundColor: '#1e293b',
        }}
      >
        {isPlaying ? <PauseIcon color="#93c5fd" size={20} /> : <PlayIcon color="#93c5fd" size={20} />}
        <Text style={{ color: '#93c5fd', fontWeight: '700' }}>{isPlaying ? 'Pause' : 'Play'}</Text>
      </Pressable>
    </View>
  );
}

/**
 * FileThumbnail
 *
 * Renders an image preview for image files, a paged PDF preview for PDF
 * files, a native video player for video files, a play/pause control for
 * audio files (only at `preview` size, to avoid mounting many native
 * player views in the small drag-and-drop tile strip), or a type icon for
 * any other file category (Office, text) since those cannot be decoded as
 * an `<Image>` source.
 *
 * @param {object} props - Component props
 * @param {UploadableDocument} props.file - File to render a thumbnail for
 * @param {'cover'|'contain'} [props.resizeMode] - Image resize mode
 * @param {'preview'|'tile'} [props.variant] - Rendering size context
 * @returns {JSX.Element} Rendered thumbnail
 */
function FileThumbnail({
  file,
  resizeMode = 'cover',
  variant = 'preview',
}: {
  file: UploadableDocument;
  resizeMode?: 'cover' | 'contain';
  variant?: 'preview' | 'tile';
}) {
  const category = getFileCategory(file.type);

  if (category === 'image') {
    return (
      <Image
        source={{ uri: file.uri }}
        style={{ width: '100%', height: '100%' }}
        resizeMode={resizeMode}
      />
    );
  }

  if (category === 'pdf' && variant === 'preview') {
    return (
      <Pdf
        source={{ uri: file.uri }}
        style={{ width: '100%', height: '100%' }}
        onError={() => undefined}
      />
    );
  }

  if (category === 'video' && variant === 'preview') {
    return (
      <Video
        source={{ uri: file.uri }}
        style={{ width: '100%', height: '100%' }}
        controls
        resizeMode={resizeMode}
        onError={() => undefined}
      />
    );
  }

  if (category === 'audio' && variant === 'preview') {
    return <AudioThumbnailPlayer uri={file.uri} />;
  }

  const Icon = getFileIcon(file.type);
  return (
    <View
      style={{
        width: '100%',
        height: '100%',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 6,
      }}
    >
      <Icon size={resizeMode === 'contain' ? 64 : 28} color="#93c5fd" />
    </View>
  );
}

/**
 * UploadTile
 *
 * Small draggable tile representing an image/file in the upload queue. Supports
 * reorder mode with a shaking animation and drag interactions. The component
 * exposes selection, removal and drag lifecycle handlers.
 *
 * @param {object} props - Component props
 * @param {UploadableDocument} props.file - File to render
 * @param {number} props.index - Index in the files array
 * @param {number} props.total - Total number of files
 * @param {boolean} props.selected - Whether this tile is selected
 * @param {boolean} props.isReorderMode - Whether reorder mode is active
 * @param {boolean} props.isDragSource - Whether this tile is the current drag source
 * @param {() => void} props.onSelect - Select this tile
 * @param {() => void} props.onRemove - Remove this file
 * @param {() => void} props.onDragStart - Called when drag starts
 * @param {() => void} props.onDragEnd - Called when drag ends
 * @param {(from: number, to: number) => void} props.onReorder - Called to reorder files
 * @returns {JSX.Element} Draggable upload tile
 */
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
        <FileThumbnail file={file} resizeMode="cover" variant="tile" />
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

/**
 * UploadConfirmScreen
 *
 * UI shown during the upload confirmation step. Allows arranging files,
 * entering document metadata, toggling recovery/upload destinations and
 * finally confirming the upload. Progress and persistence are handled by
 * the provided handlers.
 *
 * @param {object} props - Component props
 * @param {boolean} props.isUploading - Whether an upload is in progress
 * @param {string} props.uploadStatus - Optional status message for uploads
 * @param {UploadableDocument[]} props.files - Files queued for upload
 * @param {number} props.selectedFileIndex - Currently previewed file index
 * @param {string} props.documentName - Document name field value
 * @param {string} props.documentDescription - Document description value
 * @param {boolean} props.recoverable - Whether the document is recoverable (key backup)
 * @param {boolean} props.uploadToCloud - Whether to upload to cloud
 * @param {boolean} props.saveLocalCopy - Whether to save a local encrypted copy
 * @param {boolean} props.canToggleCloudUpload - Whether cloud upload can be toggled
 * @param {boolean} props.canToggleSaveLocal - Whether local save can be toggled
 * @param {(index: number) => void} props.setSelectedFileIndex - Setter for selected file index
 * @param {(value: string) => void} props.setDocumentName - Setter for document name
 * @param {(value: string) => void} props.setDocumentDescription - Setter for description
 * @param {(value: boolean) => void} props.setRecoverable - Setter for recoverable flag
 * @param {(value: boolean) => void} props.setUploadToCloud - Setter for uploadToCloud
 * @param {(value: boolean) => void} props.setSaveLocalCopy - Setter for saveLocalCopy
 * @param {boolean} props.keyBackupEnabled - Whether key backup is enabled globally
 * @param {(index: number) => void} props.onRemoveFile - Remove a file from the queue
 * @param {(fromIndex: number, toIndex: number) => void} props.onReorderFiles - Reorder files
 * @param {() => void} props.onPickNewFile - Pick a new file from gallery
 * @param {() => void} props.onScanNewFile - Scan a new file
 * @param {() => void} props.onBrowseFileNewFile - Browse for a new file (PDF, Office, text) via the document picker
 * @param {() => Promise<void>} props.onConfirmUpload - Confirm and start upload
 * @param {() => void} props.onRequestEnableKeyBackup - Request enabling key backup (when needed)
 * @returns {JSX.Element} Rendered upload confirmation screen
 */
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
  onBrowseFileNewFile,
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
  const canAddMoreFiles = files.every(file => getFileCategory(file.type) === 'image');
  const selectedFileCategory = selectedFile ? getFileCategory(selectedFile.type) : null;
  const isSelectedFilePlayableMedia = selectedFileCategory === 'video' || selectedFileCategory === 'audio';
  const previewTileStyle = {
    width: '100%' as const,
    aspectRatio: 1,
    borderRadius: 14,
    overflow: 'hidden' as const,
    borderWidth: 1,
    borderColor: '#334155',
    backgroundColor: '#0f172a',
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

          {selectedFile && isSelectedFilePlayableMedia ? (
            // Video/audio already expose their own playback controls inline, so this
            // isn't wrapped in the expand-to-modal Pressable below - that would mount a
            // second player on top of this one and double up playback.
            <View style={previewTileStyle}>
              <FileThumbnail file={selectedFile} resizeMode="cover" />
            </View>
          ) : selectedFile ? (
            <Pressable onPress={() => setShowFullPreview(true)} style={previewTileStyle}>
              <FileThumbnail file={selectedFile} resizeMode="cover" />
            </Pressable>
          ) : null}

          <Modal
            visible={showFullPreview}
            transparent
            animationType="fade"
            onRequestClose={() => setShowFullPreview(false)}
          >
            <View style={{ flex: 1, backgroundColor: 'rgba(2,6,23,0.95)' }}>
              <Pressable
                onPress={() => setShowFullPreview(false)}
                accessibilityRole="button"
                accessibilityLabel="Close preview"
                style={{
                  position: 'absolute',
                  top: 16,
                  right: 16,
                  zIndex: 10,
                  width: 40,
                  height: 40,
                  borderRadius: 20,
                  alignItems: 'center',
                  justifyContent: 'center',
                  backgroundColor: 'rgba(15,23,42,0.88)',
                }}
              >
                <XMarkIcon color="#f8fafc" size={22} />
              </Pressable>
              <View
                style={{
                  flex: 1,
                  alignItems: 'center',
                  justifyContent: 'center',
                  padding: 16,
                }}
              >
                {selectedFile ? (
                  <FileThumbnail file={selectedFile} resizeMode="contain" />
                ) : null}
              </View>
            </View>
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

            {canAddMoreFiles ? (
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
            ) : null}
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
              disabled={!keyBackupEnabled}
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

        {canAddMoreFiles ? (
          <View style={styles.cardActions}>
            <SecondaryButton label="Add from Gallery" onPress={onPickNewFile} />
            <SecondaryButton label="Scan to Add" onPress={onScanNewFile} />
            <SecondaryButton label="Browse Files" onPress={onBrowseFileNewFile} />
          </View>
        ) : (
          <Text style={[styles.subtitle, { marginBottom: 0 }]}>
            This document contains a non-image file and cannot include additional files.
          </Text>
        )}

        {uploadStatus ? <Text style={styles.backupStatus}>{uploadStatus}</Text> : null}

        <PrimaryButton
          label={isUploading ? 'Uploading...' : 'Confirm & Upload'}
          disabled={
            isUploading ||
            documentName.trim().length === 0 ||
            files.length === 0 ||
            (!uploadToCloud && !saveLocalCopy)
          }
          onPress={() => {
            onConfirmUpload();
          }}
        />
      </ScrollView>
    </View>
  );
}
