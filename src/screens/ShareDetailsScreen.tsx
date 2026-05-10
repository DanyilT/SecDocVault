/**
 * screens/ShareDetailsScreen.tsx
 *
 * Presents details about an active share for a document: current settings,
 * active grants, and actions to manage/revoke access. This is a
 * presentational screen and delegates state changes to the provided handlers.
 */

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

/**
 * ShareDetailsScreen
 *
 * Presentational screen showing current share settings and active grants for
 * a document. Actions are forwarded to handlers supplied via props.
 *
 * @param {object} props - Component props
 * @param {VaultDocument} props.selectedDoc - Document being viewed
 * @param {() => void} props.onOpenShareOptions - Open share options modal
 * @param {(recipientEmail: string) => void} props.onRevokeShareForRecipient - Revoke share access for a recipient
 * @returns {JSX.Element} Rendered share details screen
 */
export function ShareDetailsScreen({
  selectedDoc,
  onOpenShareOptions,
  onRevokeShareForRecipient,
}: Props) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [status, setStatus] = useState('');

  const activeGrants = (
    (selectedDoc.sharedKeyGrants ?? []) as VaultSharedKeyGrant[]
  ).filter(g => !g.revokedAt);

  const handleRevokeForRecipient = async (recipientEmail: string) => {
    setIsSubmitting(true);
    setStatus(`Revoking access for ${recipientEmail}...`);
    try {
      onRevokeShareForRecipient(recipientEmail);
      setStatus('Shared key revoked.');
    } catch (err) {
      setStatus(
        err instanceof Error ? err.message : 'Failed to revoke shared key.',
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <View style={{ flex: 1 }}>
      <ScrollView contentContainerStyle={styles.scrollContainer}>
        <Text style={styles.subtitle}>
          View who this document is shared with and manage the current sharing
          settings.
        </Text>

        <View style={styles.card}>
          <Text style={styles.sectionLabel}>Active Grants</Text>
          {activeGrants.length === 0 ? (
            <Text style={styles.subtitle}>
              No active shares for this document.
            </Text>
          ) : null}
          {activeGrants.map(grant => (
            <View
              key={`${grant.recipientUid}-${grant.createdAt}`}
              style={{ gap: 6 }}
            >
              <Text style={styles.cardMeta}>
                {grant.recipientEmail ?? grant.recipientUid}
              </Text>
              <Text style={styles.cardMeta}>
                Allow download: {grant.allowExport ? 'Yes' : 'No'}
              </Text>
              <Text style={styles.cardMeta}>
                Shared date: {grant.createdAt}
              </Text>
              <Text style={styles.cardMeta}>
                Expires date: {new Date(grant.expiresAt).toLocaleDateString()}
              </Text>
              <Text style={styles.cardMeta}>
                Sharing key: Active access grant
              </Text>
              <SecondaryButton
                label={isSubmitting ? 'Revoking...' : 'Revoke'}
                onPress={() =>
                  void handleRevokeForRecipient(
                    grant.recipientEmail ?? grant.recipientUid,
                  )
                }
                disabled={isSubmitting}
              />
              {!grant.recipientEmail ? (
                <Text style={styles.subtitle}>
                  Recipient email is required to retrieve access.
                </Text>
              ) : null}
            </View>
          ))}
        </View>

        {status ? <Text style={styles.backupStatus}>{status}</Text> : null}
      </ScrollView>
    </View>
  );
}
