import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Alert, Animated, Pressable, RefreshControl, ScrollView, Text, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import {
  ArrowDownTrayIcon,
  ChevronUpIcon,
  CloudArrowDownIcon,
  CloudArrowUpIcon,
  KeyIcon,
  MinusCircleIcon,
  ShareIcon,
  TrashIcon,
} from 'react-native-heroicons/solid';

import { useAuth } from '../context/AuthContext';
import { useDocumentVaultContext } from '../context/DocumentVaultContext';
import { Header, SecondaryButton, SegmentButton } from '../components/ui';
import {
  deleteDocumentFromFirebase,
  exportDocumentToDevice,
  pickDocumentForUpload,
  removeFirebaseReferences,
  removeLocalDocumentCopy,
  saveDocumentOffline,
  saveDocumentToFirebase,
  scanDocumentForUpload,
  updateDocumentRecoveryPreference,
} from '../services/documentVault';
import type { UploadableDocumentDraft } from '../services/documentVault';
import { getVaultPreferences } from '../storage/localVault';
import { styles } from '../theme/styles';
import type { VaultDocument } from '../types/vault';
import type { VaultStackParamList } from '../navigation/types';

type Props = NativeStackScreenProps<VaultStackParamList, 'Main'>;
type DocumentViewMode = 'owned' | 'sharedWithMe' | 'sharedByMe';

function normalizeRecipientIdentifier(value: string | null | undefined): string {
  return value?.trim().toLowerCase() ?? '';
}

export function MainScreen({ navigation }: Props) {
  const { user, isGuest } = useAuth();
  const {
    documents,
    setDocuments,
    isLoadingDocuments,
    loadDocuments,
    incomingShareDecisions,
    handleAcceptIncomingShare,
    handleDeclineIncomingShare,
  } = useDocumentVaultContext();

  const currentUserId = user?.uid ?? null;
  const currentUserEmail = user?.email ?? null;

  const scrollRef = useRef<ScrollView | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [showScrollTop, setShowScrollTop] = useState(false);
  const [expandedDocId, setExpandedDocId] = useState<string | null>(null);
  const [documentView, setDocumentView] = useState<DocumentViewMode>('owned');
  const [sharedWithMeView, setSharedWithMeView] = useState<'accepted' | 'incoming'>('accepted');
  const [uploadStatus, setUploadStatus] = useState('');
  const [isUploading, setIsUploading] = useState(false);
  const [vaultPrefs, setVaultPrefs] = useState({
    saveOfflineByDefault: false,
    recoverableByDefault: false,
  });
  const actionReveal = useRef(new Animated.Value(0)).current;

  useFocusEffect(
    React.useCallback(() => {
      void getVaultPreferences().then(prefs => {
        setVaultPrefs({
          saveOfflineByDefault: prefs.saveOfflineByDefault,
          recoverableByDefault: prefs.recoverableByDefault,
        });
      });
    }, []),
  );

  useEffect(() => {
    Animated.timing(actionReveal, {
      toValue: expandedDocId ? 1 : 0,
      duration: 180,
      useNativeDriver: true,
    }).start();
  }, [actionReveal, expandedDocId]);

  useEffect(() => {
    if (documentView !== 'sharedWithMe') {
      setSharedWithMeView('accepted');
    }
  }, [documentView]);

  useEffect(() => {
    if (isGuest) return;
    if (documentView === 'sharedWithMe' || documentView === 'sharedByMe') {
      void loadDocuments();
    }
  }, [documentView, isGuest, loadDocuments]);

  const normalizedUserId = currentUserId?.trim() ?? '';
  const normalizedUserEmail = normalizeRecipientIdentifier(currentUserEmail);

  const ownedDocuments = useMemo(
    () =>
      documents.filter(doc => {
        const hasLocalCopy = Boolean(doc.references?.some(ref => ref.source === 'local'));
        const hasFirebaseCopy = Boolean(doc.references?.some(ref => ref.source === 'firebase'));
        const isLocalOnlyDoc = doc.saveMode === 'local' || (hasLocalCopy && !hasFirebaseCopy);

        if (isGuest) {
          return doc.owner === 'guest-local' || doc.saveMode === 'local' || !doc.owner;
        }

        return normalizedUserId ? doc.owner === normalizedUserId || isLocalOnlyDoc : isLocalOnlyDoc;
      }),
    [documents, isGuest, normalizedUserId],
  );

  const sharedWithMeDocuments = useMemo(() => {
    if (isGuest) return [];

    const recipientKeys = new Set(
      [normalizedUserId, normalizedUserEmail]
        .map(item => normalizeRecipientIdentifier(item))
        .filter(Boolean),
    );
    if (recipientKeys.size === 0) return [];

    return documents.filter(doc => {
      if (normalizedUserId && doc.owner === normalizedUserId) return false;

      const hasFirebaseCopy = Boolean(doc.references?.some(ref => ref.source === 'firebase'));

      const sharedWithMatch = (doc.sharedWith ?? []).some(item =>
        recipientKeys.has(normalizeRecipientIdentifier(item)),
      );
      if (sharedWithMatch) return true;

      const grantsMatch = (doc.sharedKeyGrants ?? []).some(
        grant =>
          recipientKeys.has(normalizeRecipientIdentifier(grant.recipientUid)) ||
          recipientKeys.has(normalizeRecipientIdentifier(grant.recipientEmail)),
      );
      if (grantsMatch) return true;

      return Boolean(normalizedUserId && doc.owner && hasFirebaseCopy);
    });
  }, [documents, isGuest, normalizedUserEmail, normalizedUserId]);

  const acceptedSharedWithMeDocuments = useMemo(
    () => sharedWithMeDocuments.filter(doc => incomingShareDecisions[doc.id] === 'accepted'),
    [incomingShareDecisions, sharedWithMeDocuments],
  );

  const incomingSharedWithMeDocuments = useMemo(
    () =>
      sharedWithMeDocuments.filter(doc => {
        const decision = incomingShareDecisions[doc.id];
        const hasFirebaseCopy = Boolean(doc.references?.some(ref => ref.source === 'firebase'));
        if (!hasFirebaseCopy) return false;
        return decision !== 'accepted' && decision !== 'declined';
      }),
    [incomingShareDecisions, sharedWithMeDocuments],
  );

  const sharedByMeDocuments = useMemo(() => {
    if (isGuest || !normalizedUserId) return [];
    return documents.filter(
      doc => doc.owner === normalizedUserId && (doc.sharedWith?.length ?? 0) > 0,
    );
  }, [documents, isGuest, normalizedUserId]);

  const visibleDocuments =
    documentView === 'owned'
      ? ownedDocuments
      : documentView === 'sharedWithMe'
        ? sharedWithMeView === 'accepted'
          ? acceptedSharedWithMeDocuments
          : []
        : sharedByMeDocuments;

  const handleRefresh = async () => {
    setIsRefreshing(true);
    try {
      await loadDocuments();
    } finally {
      setIsRefreshing(false);
    }
  };

  const navigateToUpload = (draft: UploadableDocumentDraft) => {
    navigation.navigate('Upload', {
      draft,
      saveOfflineByDefault: vaultPrefs.saveOfflineByDefault,
      recoverableByDefault: vaultPrefs.recoverableByDefault,
      canUseCloud: !isGuest,
    });
  };

  const handlePickAndUpload = async () => {
    setIsUploading(true);
    setUploadStatus('Picking document...');
    try {
      const picked = await pickDocumentForUpload();
      setUploadStatus('');
      navigateToUpload({ name: picked.name, files: [picked] });
    } catch (err) {
      setUploadStatus(err instanceof Error ? err.message : 'Failed to pick document.');
    } finally {
      setIsUploading(false);
    }
  };

  const handleScanAndUpload = async () => {
    setIsUploading(true);
    setUploadStatus('Opening camera...');
    try {
      const scanned = await scanDocumentForUpload();
      setUploadStatus('');
      navigateToUpload({ name: scanned.name, files: [scanned] });
    } catch (err) {
      setUploadStatus(err instanceof Error ? err.message : 'Failed to scan document.');
    } finally {
      setIsUploading(false);
    }
  };

  const handleSaveOffline = async (doc: VaultDocument) => {
    try {
      const updated = await saveDocumentOffline(doc);
      setDocuments(prev => prev.map(d => (d.id === updated.id ? updated : d)));
    } catch (err) {
      setUploadStatus(err instanceof Error ? err.message : 'Failed to save offline.');
    }
  };

  const handleSaveToFirebase = async (doc: VaultDocument) => {
    if (!currentUserId) return;
    try {
      const updated = await saveDocumentToFirebase(doc, currentUserId);
      setDocuments(prev => prev.map(d => (d.id === updated.id ? updated : d)));
    } catch (err) {
      setUploadStatus(err instanceof Error ? err.message : 'Failed to save to cloud.');
    }
  };

  const handleDeleteLocal = async (doc: VaultDocument) => {
    const hasFirebaseCopy = Boolean(doc.references?.some(ref => ref.source === 'firebase'));
    if (!hasFirebaseCopy) {
      const confirmed = await new Promise<boolean>(resolve =>
        Alert.alert(
          'Delete document permanently?',
          `"${doc.name}" has no cloud copy. Deleting the offline copy will permanently remove this document and it cannot be recovered.`,
          [
            { text: 'Cancel', style: 'cancel', onPress: () => resolve(false) },
            { text: 'Delete Permanently', style: 'destructive', onPress: () => resolve(true) },
          ],
        ),
      );
      if (!confirmed) return;
    }
    try {
      const updated = await removeLocalDocumentCopy(doc);
      const hasRefs = (updated.references?.length ?? 0) > 0;
      setDocuments(prev =>
        hasRefs
          ? prev.map(d => (d.id === updated.id ? updated : d))
          : prev.filter(d => d.id !== updated.id),
      );
    } catch (err) {
      setUploadStatus(err instanceof Error ? err.message : 'Failed to delete local copy.');
    }
  };

  const handleDeleteFromFirebase = async (doc: VaultDocument) => {
    const hasLocalCopy = Boolean(doc.references?.some(ref => ref.source === 'local'));
    if (!hasLocalCopy) {
      const confirmed = await new Promise<boolean>(resolve =>
        Alert.alert(
          'Delete document permanently?',
          `"${doc.name}" has no offline copy. Deleting the cloud copy will permanently remove this document and it cannot be recovered.`,
          [
            { text: 'Cancel', style: 'cancel', onPress: () => resolve(false) },
            { text: 'Delete Permanently', style: 'destructive', onPress: () => resolve(true) },
          ],
        ),
      );
      if (!confirmed) return;
    }
    try {
      await deleteDocumentFromFirebase(doc);
      const localOnly = removeFirebaseReferences(doc);
      setDocuments(prev =>
        localOnly
          ? prev.map(d => (d.id === doc.id ? localOnly : d))
          : prev.filter(d => d.id !== doc.id),
      );
    } catch (err) {
      setUploadStatus(err instanceof Error ? err.message : 'Failed to delete from cloud.');
    }
  };

  const handleExport = async (doc: VaultDocument) => {
    try {
      await exportDocumentToDevice(doc);
    } catch (err) {
      setUploadStatus(err instanceof Error ? err.message : 'Failed to export document.');
    }
  };

  const handleToggleRecovery = async (doc: VaultDocument, nextValue: boolean) => {
    try {
      const updated = await updateDocumentRecoveryPreference(doc, nextValue);
      setDocuments(prev => prev.map(d => (d.id === updated.id ? updated : d)));
    } catch (err) {
      setUploadStatus(err instanceof Error ? err.message : 'Failed to update recovery setting.');
    }
  };

  const scrollToTop = () => {
    scrollRef.current?.scrollTo({ y: 0, animated: true });
  };

  const renderSharedWithMeBanner = (showEmptyStateCopy: boolean) => (
    <View style={styles.card}>
      <Text style={styles.cardTitle}>Shared with me</Text>
      <Text style={styles.subtitle}>
        {sharedWithMeView === 'incoming'
          ? showEmptyStateCopy
            ? 'No incoming sharing requests right now.'
            : 'Review incoming sharing requests and accept or decline each one.'
          : showEmptyStateCopy
            ? 'No accepted shared documents yet. Switch to Sharing incomes to review requests.'
            : 'These are documents you accepted from incoming sharing requests.'}
      </Text>
    </View>
  );

  const renderSharedByMeBanner = (showEmptyStateCopy: boolean) => (
    <View style={styles.card}>
      <Text style={styles.cardTitle}>Shared by me</Text>
      <Text style={styles.subtitle}>
        {showEmptyStateCopy
          ? 'You have not shared any documents yet. Open My Files, then long-press a document and choose Share to send it to someone.'
          : 'These are documents you have shared with other people.'}
      </Text>
      <SecondaryButton label="Go to My Files" onPress={() => setDocumentView('owned')} />
    </View>
  );

  return (
    <View style={{ flex: 1 }}>
      <Header
        title="Documents"
        rightLabel="Settings"
        onRightPress={() => navigation.navigate('Settings')}
      />
      <ScrollView
        ref={scrollRef}
        contentContainerStyle={[styles.scrollContainer, { paddingBottom: 96 }]}
        keyboardShouldPersistTaps="handled"
        refreshControl={
          <RefreshControl
            refreshing={isRefreshing || isLoadingDocuments}
            onRefresh={() => void handleRefresh()}
            tintColor="#93c5fd"
          />
        }
        scrollEventThrottle={16}
        onScroll={event => {
          setShowScrollTop(event.nativeEvent.contentOffset.y > 240);
        }}
      >
        {documentView === 'owned' && ownedDocuments.length === 0 ? (
          <View style={styles.heroCard}>
            <Text style={{ fontSize: 36 }}>📄</Text>
            <Text style={styles.heroTitle}>No documents yet</Text>
            <Text style={styles.subtitle}>
              Your documents will appear here. Upload one by clicking Upload New Document.
            </Text>
          </View>
        ) : null}

        {documentView === 'sharedWithMe' ? (
          <View style={styles.segmentRow}>
            <SegmentButton
              label="Shared with me"
              isActive={sharedWithMeView === 'accepted'}
              onPress={() => setSharedWithMeView('accepted')}
            />
            <SegmentButton
              label={`Sharing incomes${
                incomingSharedWithMeDocuments.length > 0
                  ? ` (${incomingSharedWithMeDocuments.length})`
                  : ''
              }`}
              isActive={sharedWithMeView === 'incoming'}
              onPress={() => setSharedWithMeView('incoming')}
            />
          </View>
        ) : null}

        {documentView === 'sharedWithMe'
          ? renderSharedWithMeBanner(
              sharedWithMeView === 'accepted'
                ? acceptedSharedWithMeDocuments.length === 0
                : incomingSharedWithMeDocuments.length === 0,
            )
          : null}

        {documentView === 'sharedByMe'
          ? renderSharedByMeBanner(sharedByMeDocuments.length === 0)
          : null}

        {documentView === 'owned' ? (
          <View
            style={{
              flexDirection: 'row',
              justifyContent: 'space-between',
              alignItems: 'center',
              gap: 10,
            }}
          >
            <View style={{ flexDirection: 'row', gap: 10, flex: 1, flexWrap: 'wrap' }}>
              <SecondaryButton
                label={isUploading ? 'Uploading...' : 'Upload New Document'}
                onPress={() => void handlePickAndUpload()}
              />
              <SecondaryButton
                label={isUploading ? 'Uploading...' : 'Scan & Upload'}
                onPress={() => void handleScanAndUpload()}
              />
            </View>
          </View>
        ) : null}

        {uploadStatus ? <Text style={styles.backupStatus}>{uploadStatus}</Text> : null}

        {documentView === 'sharedWithMe' && sharedWithMeView === 'incoming'
          ? incomingSharedWithMeDocuments.map(doc => {
              const sender = doc.owner || 'Unknown sender';
              return (
                <View key={`incoming-${doc.id}`} style={styles.card}>
                  <Text style={styles.cardTitle}>{doc.name}</Text>
                  <Text style={styles.cardMeta}>From: {sender}</Text>
                  <Text style={styles.cardMeta}>Size: {doc.size}</Text>
                  <Text style={styles.cardMeta}>Shared: {doc.uploadedAt}</Text>
                  <Text style={styles.subtitle}>
                    Accept to add this document to your Shared with me list.
                  </Text>
                  <View style={{ flexDirection: 'row', gap: 10 }}>
                    <SecondaryButton
                      label="Accept"
                      onPress={() => handleAcceptIncomingShare(doc.id)}
                    />
                    <SecondaryButton
                      label="Decline"
                      onPress={() => handleDeclineIncomingShare(doc.id)}
                    />
                  </View>
                </View>
              );
            })
          : null}

        {visibleDocuments.map(doc => {
          const hasLocal = Boolean(doc.references?.some(ref => ref.source === 'local'));
          const hasFirebase = Boolean(doc.references?.some(ref => ref.source === 'firebase'));
          const isOwner = Boolean(normalizedUserId) && doc.owner === normalizedUserId;
          const canShareDoc = !isGuest && Boolean(normalizedUserId) && isOwner && hasFirebase;
          const canManageOfflineCopy = !(documentView === 'sharedWithMe' && !isOwner);
          const showActions = expandedDocId === doc.id;

          return (
            <Pressable
              key={doc.id}
              style={styles.card}
              onPress={() => navigation.navigate('Preview', { docId: doc.id })}
              onLongPress={() => {
                setExpandedDocId(prev => (prev === doc.id ? null : doc.id));
              }}
            >
              <Text style={styles.cardTitle}>{doc.name}</Text>
              <Text style={styles.cardMeta}>{doc.hash}</Text>
              {doc.description ? (
                <Text style={styles.cardMeta}>Description: {doc.description}</Text>
              ) : null}
              <Text style={styles.cardMeta}>Size: {doc.size}</Text>
              <Text style={styles.cardMeta}>Uploaded: {doc.uploadedAt}</Text>
              <Text style={styles.cardMeta}>
                Offline: {hasLocal ? 'Saved locally' : 'Not saved'}
              </Text>
              <Text style={[styles.subtitle, { marginBottom: 0 }]}>
                Tap to preview. Long press to show actions.
              </Text>

              {showActions ? (
                <Animated.View
                  style={{
                    opacity: actionReveal,
                    transform: [
                      {
                        translateY: actionReveal.interpolate({
                          inputRange: [0, 1],
                          outputRange: [6, 0],
                        }),
                      },
                    ],
                  }}
                >
                  {(() => {
                    const renderCompactAction = ({
                      label,
                      icon: Icon,
                      onPress,
                      tone = 'default',
                    }: {
                      label: string;
                      icon: React.ComponentType<{ size?: number; color?: string }>;
                      onPress: () => void;
                      tone?: 'default' | 'danger';
                    }) => (
                      <Pressable
                        onPress={onPress}
                        style={({ pressed }) => ({
                          flex: 1,
                          marginTop: 0,
                          paddingVertical: 3,
                          paddingHorizontal: 2,
                          opacity: pressed ? 0.72 : 1,
                        })}
                      >
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                          <Icon size={14} color={tone === 'danger' ? '#fca5a5' : '#93c5fd'} />
                          <Text
                            style={{
                              color: tone === 'danger' ? '#fecaca' : '#bfdbfe',
                              fontWeight: '700',
                              fontSize: 12,
                            }}
                          >
                            {label}
                          </Text>
                        </View>
                      </Pressable>
                    );

                    return (
                      <>
                        <View style={styles.cardActions}>
                          {renderCompactAction({
                            label: 'Export',
                            icon: ArrowDownTrayIcon,
                            onPress: () => void handleExport(doc),
                          })}
                          {canShareDoc ? (
                            renderCompactAction({
                              label: 'Share',
                              icon: ShareIcon,
                              onPress: () => navigation.navigate('Share', { docId: doc.id }),
                            })
                          ) : !isOwner && hasFirebase ? (
                            renderCompactAction({
                              label: 'Decline Share',
                              icon: MinusCircleIcon,
                              tone: 'danger',
                              onPress: () => handleDeclineIncomingShare(doc.id),
                            })
                          ) : (
                            <View style={{ flex: 1 }} />
                          )}
                        </View>
                        <View style={styles.cardActions}>
                          {canManageOfflineCopy ? (
                            renderCompactAction({
                              label: hasLocal ? 'Delete Offline' : 'Save Offline',
                              icon: hasLocal ? MinusCircleIcon : CloudArrowDownIcon,
                              tone: hasLocal ? 'danger' : 'default',
                              onPress: () =>
                                hasLocal
                                  ? void handleDeleteLocal(doc)
                                  : void handleSaveOffline(doc),
                            })
                          ) : (
                            <View style={{ flex: 1 }} />
                          )}
                          {isOwner ? (
                            renderCompactAction({
                              label: hasFirebase ? 'Delete from Cloud' : 'Save to Cloud',
                              icon: hasFirebase ? TrashIcon : CloudArrowUpIcon,
                              tone: hasFirebase ? 'danger' : 'default',
                              onPress: () =>
                                hasFirebase
                                  ? void handleDeleteFromFirebase(doc)
                                  : void handleSaveToFirebase(doc),
                            })
                          ) : (
                            <View style={{ flex: 1 }} />
                          )}
                        </View>
                        {isOwner && hasFirebase ? (
                          <View style={styles.cardActions}>
                            {renderCompactAction({
                              label: doc.recoverable
                                ? 'Disable Key Backup'
                                : 'Enable Key Backup',
                              icon: KeyIcon,
                              onPress: () => void handleToggleRecovery(doc, !doc.recoverable),
                            })}
                          </View>
                        ) : null}
                      </>
                    );
                  })()}
                </Animated.View>
              ) : null}
            </Pressable>
          );
        })}
      </ScrollView>

      {!isGuest ? (
        <View
          style={{
            borderTopWidth: 1,
            borderTopColor: '#1f2937',
            paddingHorizontal: 16,
            paddingTop: 12,
            paddingBottom: 14,
            gap: 10,
          }}
        >
          <View style={styles.segmentRow}>
            <SegmentButton
              label="My Files"
              isActive={documentView === 'owned'}
              onPress={() => setDocumentView('owned')}
            />
            <SegmentButton
              label="Shared with me"
              isActive={documentView === 'sharedWithMe'}
              onPress={() => setDocumentView('sharedWithMe')}
            />
            <SegmentButton
              label="Shared by me"
              isActive={documentView === 'sharedByMe'}
              onPress={() => setDocumentView('sharedByMe')}
            />
          </View>
        </View>
      ) : null}

      {showScrollTop ? (
        <Pressable
          onPress={scrollToTop}
          style={{
            position: 'absolute',
            right: 16,
            bottom: 88,
            width: 44,
            height: 44,
            borderRadius: 22,
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: '#2563eb',
            elevation: 4,
          }}
        >
          <ChevronUpIcon />
        </Pressable>
      ) : null}
    </View>
  );
}
