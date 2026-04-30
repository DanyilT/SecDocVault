import React, { useState } from 'react';
import { ScrollView, Text, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';

import { useAuth } from '../context/AuthContext';
import { useDocumentVaultContext } from '../context/DocumentVaultContext';
import { Header, PrimaryButton, SecondaryButton } from '../components/ui';
import { revokeDocumentShareGrant } from '../services/documentVault';
import { styles } from '../theme/styles';
import type { VaultSharedKeyGrant } from '../types/vault';
import type { VaultStackParamList } from '../navigation/types';

type Props = NativeStackScreenProps<VaultStackParamList, 'ShareDetails'>;

export function ShareDetailsScreen({ route, navigation }: Props) {
  const { docId } = route.params;
  const { user, isGuest } = useAuth();
  const { documents, setDocuments } = useDocumentVaultContext();

  const doc = documents.find(d => d.id === docId);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [status, setStatus] = useState('');

  if (!doc) {
    return (
      <View style={{ flex: 1 }}>
        <Header title="Share Details" showBack onBack={() => navigation.goBack()} />
        <View style={styles.pageBody}>
          <Text style={styles.subtitle}>Document not found.</Text>
        </View>
      </View>
    );
  }

  const userUid = user?.uid ?? null;
  const activeGrants = ((doc.sharedKeyGrants ?? []) as VaultSharedKeyGrant[]).filter(
    g => !g.revokedAt,
  );

  const handleRevokeForRecipient = async (recipientEmail: string) => {
    if (!userUid || isGuest) return;
    setIsSubmitting(true);
    setStatus(`Revoking access for ${recipientEmail}...`);
    try {
      const updated = await revokeDocumentShareGrant(doc, userUid, recipientEmail);
      setDocuments(prev => prev.map(d => (d.id === updated.id ? updated : d)));
      setStatus('Shared key revoked.');
    } catch (err) {
      setStatus(err instanceof Error ? err.message : 'Failed to revoke shared key.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <View style={{ flex: 1 }}>
      <Header title="Share Details" showBack onBack={() => navigation.goBack()} />
      <ScrollView contentContainerStyle={styles.scrollContainer}>
      <Text style={styles.subtitle}>
        View who this document is shared with and manage the current sharing settings.
      </Text>

      <View style={styles.card}>
        <Text style={styles.sectionLabel}>Current Share Settings</Text>
        <PrimaryButton
          label="Open Sharing Options"
          onPress={() => navigation.navigate('Share', { docId })}
        />
      </View>

      <View style={styles.card}>
        <Text style={styles.sectionLabel}>Active Grants</Text>
        {activeGrants.length === 0 ? (
          <Text style={styles.subtitle}>No active shares for this document.</Text>
        ) : null}
        {activeGrants.map(grant => (
          <View key={`${grant.recipientUid}-${grant.createdAt}`} style={styles.docRow}>
            <Text style={styles.cardMeta}>
              {grant.recipientEmail ?? grant.recipientUid}
            </Text>
            <Text style={styles.cardMeta}>
              Expires: {new Date(grant.expiresAt).toLocaleDateString()}
            </Text>
            <SecondaryButton
              label={isSubmitting ? 'Revoking...' : 'Revoke'}
              onPress={() =>
                void handleRevokeForRecipient(grant.recipientEmail ?? grant.recipientUid)
              }
              disabled={isSubmitting || isGuest}
            />
          </View>
        ))}
      </View>

      {status ? <Text style={styles.backupStatus}>{status}</Text> : null}
      </ScrollView>
    </View>
  );
}
