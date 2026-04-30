import React, { useState } from 'react';
import { Switch, Text, TextInput, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';

import { useAuth } from '../context/AuthContext';
import { useDocumentVaultContext } from '../context/DocumentVaultContext';
import { Header, PrimaryButton } from '../components/ui';
import {
  createDocumentShareGrant,
  revokeDocumentShareGrant,
} from '../services/documentVault';
import { styles } from '../theme/styles';
import type { VaultStackParamList } from '../navigation/types';

type Props = NativeStackScreenProps<VaultStackParamList, 'Share'>;

export function ShareScreen({ route, navigation }: Props) {
  const { docId } = route.params;
  const { user, isGuest } = useAuth();
  const { documents, setDocuments } = useDocumentVaultContext();

  const doc = documents.find(d => d.id === docId);

  const [shareTarget, setShareTarget] = useState('');
  const [allowDownload, setAllowDownload] = useState(true);
  const [expiresInDays, setExpiresInDays] = useState('30');
  const [shareStatus, setShareStatus] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!doc) {
    return (
      <View style={{ flex: 1 }}>
        <Header title="Share Document" showBack onBack={() => navigation.goBack()} />
        <View style={styles.pageBody}>
          <Text style={styles.subtitle}>Document not found.</Text>
        </View>
      </View>
    );
  }

  const userUid = user?.uid ?? null;
  const canManageShares = !isGuest && Boolean(userUid) && doc.owner === userUid;
  const activeGrants = (doc.sharedKeyGrants ?? []).filter(g => !g.revokedAt);
  const isSharedWithTarget = activeGrants.some(
    g => g.recipientEmail?.toLowerCase() === shareTarget.trim().toLowerCase(),
  );

  const handleCreateShare = async () => {
    if (!userUid || !shareTarget.trim()) return;
    setIsSubmitting(true);
    setShareStatus(`Creating share key for ${shareTarget.trim()}...`);
    try {
      const days = parseInt(expiresInDays.trim(), 10);
      const updated = await createDocumentShareGrant(
        doc,
        userUid,
        shareTarget.trim(),
        allowDownload,
        Number.isNaN(days) ? 30 : days,
      );
      setDocuments(prev => prev.map(d => (d.id === updated.id ? updated : d)));
      setShareStatus('Share key created/updated successfully.');
    } catch (err) {
      setShareStatus(err instanceof Error ? err.message : 'Failed to create share key.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleRevokeShare = async () => {
    if (!userUid || !shareTarget.trim()) return;
    setIsSubmitting(true);
    setShareStatus(`Revoking shared key for ${shareTarget.trim()}...`);
    try {
      const updated = await revokeDocumentShareGrant(doc, userUid, shareTarget.trim());
      setDocuments(prev => prev.map(d => (d.id === updated.id ? updated : d)));
      setShareStatus('Shared key revoked and document key rotated.');
    } catch (err) {
      setShareStatus(err instanceof Error ? err.message : 'Failed to revoke shared key.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <View style={{ flex: 1 }}>
      <Header
        title={`Share ${doc.name}`}
        showBack
        onBack={() => navigation.goBack()}
      />
      <View style={styles.pageBody}>
      <Text style={styles.subtitle}>
        {isGuest
          ? 'Guest mode is local-only. Sharing is disabled to avoid cloud exposure.'
          : !canManageShares
          ? 'Only the owner of this document can create or revoke share keys.'
          : 'Generate secure access for another user.'}
      </Text>
      <TextInput
        autoCapitalize="none"
        keyboardType="email-address"
        placeholder="Recipient email"
        placeholderTextColor="#6b7280"
        style={styles.input}
        value={shareTarget}
        onChangeText={setShareTarget}
        editable={canManageShares && !isSubmitting}
      />
      <View style={styles.switchRow}>
        <Text style={styles.switchLabel}>Allow file download</Text>
        <Switch
          value={allowDownload}
          onValueChange={setAllowDownload}
          disabled={!canManageShares || isSubmitting}
        />
      </View>
      <TextInput
        keyboardType="number-pad"
        placeholder="Access duration in days (default 30)"
        placeholderTextColor="#6b7280"
        style={styles.input}
        value={expiresInDays}
        onChangeText={setExpiresInDays}
        editable={canManageShares && !isSubmitting}
      />
      <PrimaryButton
        label={
          isGuest
            ? 'Sharing Disabled in Guest Mode'
            : !canManageShares
            ? 'Owner Access Required'
            : isSubmitting
            ? 'Creating Share Key...'
            : isSharedWithTarget
            ? 'Update Share Key'
            : 'Create Share Key'
        }
        disabled={!canManageShares || isSubmitting || !shareTarget.includes('@')}
        onPress={() => void handleCreateShare()}
      />
      {canManageShares && isSharedWithTarget ? (
        <PrimaryButton
          label={isSubmitting ? 'Revoking Share Key...' : 'Revoke Shared Key'}
          variant="danger"
          disabled={isSubmitting}
          onPress={() => void handleRevokeShare()}
        />
      ) : null}
      {shareStatus ? <Text style={styles.backupStatus}>{shareStatus}</Text> : null}
      </View>
    </View>
  );
}
