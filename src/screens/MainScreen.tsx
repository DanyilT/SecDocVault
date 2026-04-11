import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Animated, Pressable, RefreshControl, ScrollView, Text, View } from 'react-native';
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

import { SecondaryButton, SegmentButton } from '../components/ui';
import { styles } from '../theme/styles';
import { VaultDocument } from '../types/vault';

type DocumentViewMode = 'owned' | 'sharedWithMe' | 'sharedByMe';

function normalizeRecipientIdentifier(value: string | null | undefined): string {
  return value?.trim().toLowerCase() ?? '';
}

export function MainScreen({
  documents,
  incomingShareDecisions,
  currentUserId,
  currentUserEmail,
  isGuest,
  isUploading,
  uploadStatus,
  openPreview,
  openShare,
  onScanAndUpload,
  onPickAndUpload,
  onReloadDocuments,
  onSaveOffline,
  onSaveToFirebase,
  onDeleteLocal,
  onDeleteFromFirebase,
  onExport,
  onToggleRecovery,
  onAcceptIncomingShare,
  onDeclineIncomingShare,
}: {
  documents: VaultDocument[];
  incomingShareDecisions: Record<string, 'accepted' | 'declined'>;
  currentUserId: string | null;
  currentUserEmail: string | null;
  isGuest: boolean;
  isUploading: boolean;
  uploadStatus: string;
  openPreview: (doc: VaultDocument) => void;
  openShare: (doc: VaultDocument) => void;
  onScanAndUpload: () => void;
  onPickAndUpload: () => void;
  onReloadDocuments: () => Promise<void>;
  onSaveOffline: (doc: VaultDocument) => void;
  onSaveToFirebase: (doc: VaultDocument) => void;
  onDeleteLocal: (doc: VaultDocument) => void;
  onDeleteFromFirebase: (doc: VaultDocument) => void;
  onExport?: (doc: VaultDocument) => Promise<void>;
  onToggleRecovery?: (doc: VaultDocument, nextValue: boolean) => Promise<void>;
  onAcceptIncomingShare: (docId: string) => void;
  onDeclineIncomingShare: (docId: string) => void;
}) {
  const scrollRef = useRef<ScrollView | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [showScrollTop, setShowScrollTop] = useState(false);
  const [expandedDocId, setExpandedDocId] = useState<string | null>(null);
  const [documentView, setDocumentView] = useState<DocumentViewMode>('owned');
  const [sharedWithMeView, setSharedWithMeView] = useState<'accepted' | 'incoming'>('accepted');
  const actionReveal = useRef(new Animated.Value(0)).current;

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
    if (isGuest) {
      return [];
    }

    const recipientKeys = new Set(
      [normalizedUserId, normalizedUserEmail]
        .map(item => normalizeRecipientIdentifier(item))
        .filter(Boolean),
    );
    if (recipientKeys.size === 0) {
      return [];
    }

    return documents.filter(doc => {
      if (normalizedUserId && doc.owner === normalizedUserId) {
        return false;
      }

      const sharedWithMatch = (doc.sharedWith ?? []).some(item =>
        recipientKeys.has(normalizeRecipientIdentifier(item)),
      );
      if (sharedWithMatch) {
        return true;
      }

      return (doc.sharedKeyGrants ?? []).some(grant =>
        recipientKeys.has(normalizeRecipientIdentifier(grant.recipientUid)) ||
        recipientKeys.has(normalizeRecipientIdentifier(grant.recipientEmail)),
      );
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
        // return decision !== 'accepted' && decision !== 'declined';
        return decision !== 'accepted';
      }),
    [incomingShareDecisions, sharedWithMeDocuments],
  );

  const sharedByMeDocuments = useMemo(() => {
    if (isGuest || !normalizedUserId) {
      return [];
    }

    return documents.filter(doc => doc.owner === normalizedUserId && (doc.sharedWith?.length ?? 0) > 0);
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
      await onReloadDocuments();
    } finally {
      setIsRefreshing(false);
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
      <ScrollView
        ref={scrollRef}
        contentContainerStyle={[styles.scrollContainer, { paddingBottom: 96 }]}
        keyboardShouldPersistTaps="handled"
        refreshControl={
          <RefreshControl
            refreshing={isRefreshing}
            onRefresh={handleRefresh}
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
              Your documents will appear here. Upload one by clicking Upload New
              Document.
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
            <View
              style={{
                flexDirection: 'row',
                gap: 10,
                flex: 1,
                flexWrap: 'wrap',
              }}
            >
              <>
                <SecondaryButton
                  label={isUploading ? 'Uploading...' : 'Upload New Document'}
                  onPress={onPickAndUpload}
                />
                <SecondaryButton
                  label={isUploading ? 'Uploading...' : 'Scan & Upload'}
                  onPress={onScanAndUpload}
                />
              </>
            </View>
          </View>
        ) : null}

        {uploadStatus ? (
          <Text style={styles.backupStatus}>{uploadStatus}</Text>
        ) : null}

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
                      onPress={() => onAcceptIncomingShare(doc.id)}
                    />
                    <SecondaryButton
                      label="Decline"
                      onPress={() => onDeclineIncomingShare(doc.id)}
                    />
                  </View>
                </View>
              );
            })
          : null}

        {visibleDocuments.map(doc => {
          const hasLocal = Boolean(
            doc.references?.some(ref => ref.source === 'local'),
          );
          const hasFirebase = Boolean(
            doc.references?.some(ref => ref.source === 'firebase'),
          );
          const canShareDoc =
            !isGuest &&
            Boolean(normalizedUserId) &&
            doc.owner === normalizedUserId &&
            hasFirebase;
          const canManageOfflineCopy = !(
            documentView === 'sharedWithMe' && doc.owner !== normalizedUserId
          );
          const showActions = expandedDocId === doc.id;

          return (
            <Pressable
              key={doc.id}
              style={styles.card}
              onPress={() => openPreview(doc)}
              onLongPress={() => {
                setExpandedDocId(prev => (prev === doc.id ? null : doc.id));
              }}
            >
              <Text style={styles.cardTitle}>{doc.name}</Text>
              <Text style={styles.cardMeta}>{doc.hash}</Text>
              {doc.description ? (
                <Text style={styles.cardMeta}>
                  Description: {doc.description}
                </Text>
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
                      icon: React.ComponentType<{
                        size?: number;
                        color?: string;
                      }>;
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
                        <View
                          style={{
                            flexDirection: 'row',
                            alignItems: 'center',
                            gap: 6,
                          }}
                        >
                          <Icon
                            size={14}
                            color={tone === 'danger' ? '#fca5a5' : '#93c5fd'}
                          />
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
                            onPress: () => {
                              if (onExport) {
                                void onExport(doc);
                              }
                            },
                          })}
                          {canShareDoc ? (
                            renderCompactAction({
                              label: 'Share',
                              icon: ShareIcon,
                              onPress: () => openShare(doc),
                            })
                          ) : (
                            <View style={{ flex: 1 }} />
                          )}
                        </View>
                        <View style={styles.cardActions}>
                          {canManageOfflineCopy ? (
                            renderCompactAction({
                              label: hasLocal
                                ? 'Delete Offline'
                                : 'Save Offline',
                              icon: hasLocal
                                ? MinusCircleIcon
                                : CloudArrowDownIcon,
                              tone: hasLocal ? 'danger' : 'default',
                              onPress: () => {
                                if (hasLocal) {
                                  onDeleteLocal(doc);
                                  return;
                                }

                                onSaveOffline(doc);
                              },
                            })
                          ) : (
                            <View style={{ flex: 1 }} />
                          )}
                          {renderCompactAction({
                            label: hasFirebase
                              ? 'Delete from Cloud'
                              : 'Save to Cloud',
                            icon: hasFirebase ? TrashIcon : CloudArrowUpIcon,
                            tone: hasFirebase ? 'danger' : 'default',
                            onPress: () => {
                              if (hasFirebase) {
                                onDeleteFromFirebase(doc);
                                return;
                              }

                              onSaveToFirebase(doc);
                            },
                          })}
                        </View>
                        {hasFirebase ? (
                          <View style={styles.cardActions}>
                            {renderCompactAction({
                              label: doc.recoverable
                                ? 'Disable Key Backup'
                                : 'Enable Key Backup',
                              icon: KeyIcon,
                              onPress: () => {
                                if (onToggleRecovery) {
                                  void onToggleRecovery(doc, !doc.recoverable);
                                }
                              },
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
