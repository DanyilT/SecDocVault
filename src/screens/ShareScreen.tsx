/**
 * screens/ShareScreen.tsx
 *
 * Presentational share UI used when creating a share grant. Shows recipient
 * input, expiry, download permission toggles and submit buttons. The screen
 * is intentionally stateless and driven by props from the `useShareFlow`
 * hook and controllers.
 */

import React from 'react';
import { Switch, Text, TextInput, View } from 'react-native';

import { PrimaryButton } from '../components/ui';
import { styles } from '../theme/styles';
import type { VaultDocument } from '../types/vault';

/**
 * ShareScreen
 *
 * Stateless UI for creating or revoking a sharing key for a document. Shows
 * recipient input, download permission toggle and expiry. Actions are driven
 * by the provided handlers.
 *
 * @param {object} props - Component props
 * @param {VaultDocument} props.selectedDoc - Document to share
 * @param {boolean} props.isGuest - Whether the session is guest (sharing disabled)
 * @param {boolean} props.canManageShares - Whether the current user can manage shares
 * @param {string} props.shareTarget - Recipient identifier (email)
 * @param {boolean} props.allowDownload - Whether the recipient is allowed to download files
 * @param {string} props.shareStatus - Optional status message
 * @param {boolean} props.isSubmitting - Whether a sharing request is in flight
 * @param {boolean} props.isSharedWithTarget - Whether a share already exists for the target
 * @param {string} props.expiresInDays - TTL in days for the generated share key
 * @param {(value: string) => void} props.setShareTarget - Setter for shareTarget
 * @param {(value: boolean) => void} props.setAllowDownload - Setter for allowDownload
 * @param {(value: string) => void} props.setExpiresInDays - Setter for expiresInDays
 * @param {() => void} props.onCreateShare - Create or update share key
 * @param {() => void} props.onRevokeShare - Revoke the share key
 * @returns {JSX.Element} Rendered share screen
 */
export function ShareScreen({
  selectedDoc,
  isGuest,
  canManageShares,
  shareTarget,
  allowDownload,
  shareStatus,
  isSubmitting,
  isSharedWithTarget,
  expiresInDays,
  setShareTarget,
  setAllowDownload,
  setExpiresInDays,
  onCreateShare,
  onRevokeShare,
}: {
  selectedDoc: VaultDocument;
  isGuest: boolean;
  canManageShares: boolean;
  shareTarget: string;
  allowDownload: boolean;
  shareStatus: string;
  isSubmitting: boolean;
  isSharedWithTarget: boolean;
  expiresInDays: string;
  setShareTarget: (value: string) => void;
  setAllowDownload: (value: boolean) => void;
  setExpiresInDays: (value: string) => void;
  onCreateShare: () => void;
  onRevokeShare: () => void;
}) {
  const isActionBlocked = isGuest || !canManageShares;

  return (
    <View style={styles.pageBody}>
      <Text style={styles.pageTitle}>Share {selectedDoc.name}</Text>
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
        editable={!isActionBlocked && !isSubmitting}
      />
      <View style={styles.switchRow}>
        <Text style={styles.switchLabel}>Allow file download</Text>
        <Switch value={allowDownload} onValueChange={setAllowDownload} disabled={isActionBlocked || isSubmitting} />
      </View>
      <TextInput
        keyboardType="number-pad"
        placeholder="Access duration in days (default 30)"
        placeholderTextColor="#6b7280"
        style={styles.input}
        value={expiresInDays}
        onChangeText={setExpiresInDays}
        editable={!isActionBlocked && !isSubmitting}
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
        disabled={isActionBlocked || isSubmitting || !shareTarget.includes('@')}
        onPress={onCreateShare}
      />
      {!isActionBlocked && isSharedWithTarget ? (
        <PrimaryButton
          label={isSubmitting ? 'Revoking Share Key...' : 'Revoke Shared Key'}
          variant="danger"
          disabled={isSubmitting}
          onPress={onRevokeShare}
        />
      ) : null}
      {shareStatus ? <Text style={styles.backupStatus}>{shareStatus}</Text> : null}
    </View>
  );
}
