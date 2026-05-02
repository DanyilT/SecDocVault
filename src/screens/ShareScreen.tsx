import React from 'react';
import { Switch, Text, TextInput, View } from 'react-native';

import { PrimaryButton } from '../components/ui';
import { styles } from '../theme/styles';
import type { VaultDocument } from '../types/vault';

type Props = {
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
  onCreateShare: () => Promise<void>;
  onRevokeShare: () => Promise<void>;
};

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
}: Props) {
  return (
    <View style={{ flex: 1 }}>
      <View style={styles.pageBody}>
        <Text style={styles.subtitle}>
          {isGuest
            ? 'Guest mode is local-only. Sharing is disabled to avoid cloud exposure.'
            : !canManageShares
            ? 'Only the owner of this document can create or revoke share keys.'
            : `Generate secure access for another user. Sharing: ${selectedDoc.name}`}
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
          onPress={() => void onCreateShare()}
        />
        {canManageShares && isSharedWithTarget ? (
          <PrimaryButton
            label={isSubmitting ? 'Revoking Share Key...' : 'Revoke Shared Key'}
            variant="danger"
            disabled={isSubmitting}
            onPress={() => void onRevokeShare()}
          />
        ) : null}
        {shareStatus ? <Text style={styles.backupStatus}>{shareStatus}</Text> : null}
      </View>
    </View>
  );
}
