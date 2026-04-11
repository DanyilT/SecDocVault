import React from 'react';
import { ScrollView, Text, View } from 'react-native';

import { PrimaryButton, SecondaryButton } from '../components/ui';
import { styles } from '../theme/styles';
import type { VaultDocument, VaultSharedKeyGrant } from '../types/vault';

export function ShareDetailsScreen({
  selectedDoc,
  shareTarget,
  allowDownload,
  expiresInDays,
  onOpenShareOptions,
  onRevokeShareForRecipient,
}: {
  selectedDoc: VaultDocument;
  shareTarget: string;
  allowDownload: boolean;
  expiresInDays: string;
  onOpenShareOptions: () => void;
  onRevokeShareForRecipient: (recipientEmail: string) => void;
}) {
  const activeGrants = ((selectedDoc.sharedKeyGrants ?? []) as VaultSharedKeyGrant[]).filter(grant => !grant.revokedAt);

  return (
    <ScrollView contentContainerStyle={styles.scrollContainer}>
      <Text style={styles.pageTitle}>Share Details</Text>
      <Text style={styles.subtitle}>
        View who this document is shared with and manage the current sharing settings.
      </Text>

      <View style={styles.card}>
        <Text style={styles.sectionLabel}>Current Share Settings</Text>
        <Text style={styles.cardMeta}>Recipient: {shareTarget || 'Not set'}</Text>
        <Text style={styles.cardMeta}>Allow download: {allowDownload ? 'Yes' : 'No'}</Text>
        <Text style={styles.cardMeta}>Time to live: {expiresInDays || '30'} days</Text>
        <PrimaryButton label="Open Sharing Options" onPress={onOpenShareOptions} />
      </View>

      <View style={styles.card}>
        <Text style={styles.sectionLabel}>Shared With</Text>
        {activeGrants.length === 0 ? <Text style={styles.subtitle}>No active share keys.</Text> : null}
        {activeGrants.map(grant => (
          <View key={`${grant.recipientUid}-${grant.recipientEmail ?? ''}`} style={{ gap: 6 }}>
            <Text style={styles.cardTitle}>{grant.recipientEmail ?? grant.recipientUid}</Text>
            <Text style={styles.cardMeta}>Allow download: {grant.allowExport ? 'Yes' : 'No'}</Text>
            <Text style={styles.cardMeta}>Shared date: {grant.createdAt}</Text>
            <Text style={styles.cardMeta}>Expired date: {grant.expiresAt.toString()}</Text>
            <Text style={styles.cardMeta}>Sharing key: Active access grant</Text>
            <SecondaryButton
              label="Retrieve Access"
              onPress={() => {
                if (!grant.recipientEmail) {
                  return;
                }

                onRevokeShareForRecipient(grant.recipientEmail);
              }}
            />
            {!grant.recipientEmail ? (
              <Text style={styles.subtitle}>Recipient email is required to retrieve access.</Text>
            ) : null}
          </View>
        ))}
      </View>
    </ScrollView>
  );
}
