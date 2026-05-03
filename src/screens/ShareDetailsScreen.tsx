import React, { useState } from 'react';
import { ScrollView, Text, View } from 'react-native';

import { PrimaryButton, SecondaryButton } from '../components/ui';
import { styles } from '../theme/styles';
import type { VaultDocument, VaultSharedKeyGrant } from '../types/vault';

type Props = {
  selectedDoc: VaultDocument;
  shareTarget: string;
  allowDownload: boolean;
  expiresInDays: string;
  onOpenShareOptions: () => void;
  onRevokeShareForRecipient: (recipient: string) => void;
};

export function ShareDetailsScreen({
  selectedDoc,
  onOpenShareOptions,
  onRevokeShareForRecipient,
}: Props) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [status, setStatus] = useState('');

  const activeGrants = ((selectedDoc.sharedKeyGrants ?? []) as VaultSharedKeyGrant[]).filter(
    g => !g.revokedAt,
  );

  const handleRevokeForRecipient = async (recipientEmail: string) => {
    setIsSubmitting(true);
    setStatus(`Revoking access for ${recipientEmail}...`);
    try {
      onRevokeShareForRecipient(recipientEmail);
      setStatus('Shared key revoked.');
    } catch (err) {
      setStatus(err instanceof Error ? err.message : 'Failed to revoke shared key.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <View style={{ flex: 1 }}>
      <ScrollView contentContainerStyle={styles.scrollContainer}>
        <Text style={styles.subtitle}>
          View who this document is shared with and manage the current sharing settings.
        </Text>

        <View style={styles.card}>
          <Text style={styles.sectionLabel}>Current Share Settings</Text>
          <PrimaryButton label="Open Sharing Options" onPress={onOpenShareOptions} />
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
                onPress={() => void handleRevokeForRecipient(grant.recipientEmail ?? grant.recipientUid)}
                disabled={isSubmitting}
              />
            </View>
          ))}
        </View>

        {status ? <Text style={styles.backupStatus}>{status}</Text> : null}
      </ScrollView>
    </View>
  );
}
