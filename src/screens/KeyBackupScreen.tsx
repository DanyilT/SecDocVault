import React, { useState } from 'react';
import { Text, TextInput, View } from 'react-native';

import { PrimaryButton, SecondaryButton } from '../components/ui';
import { styles } from '../theme/styles';

export function KeyBackupScreen({
  isGuest,
  isSubmitting,
  onBackupKeys,
  onRestoreKeys,
  backupStatus,
  recoverableDocsCount,
  totalDocsCount,
  displayPassphrase,
  onClearPassphrase,
  onCopyPassphrase,
  onDownloadPassphrase,
  onDownloadBackupFile,
}: {
  isGuest: boolean;
  isSubmitting: boolean;
  onBackupKeys: () => Promise<void>;
  onRestoreKeys: (passphrase: string) => Promise<void>;
  backupStatus: string;
  recoverableDocsCount: number;
  totalDocsCount: number;
  displayPassphrase: string | null;
  onClearPassphrase: () => void;
  onCopyPassphrase: (passphrase: string) => Promise<void>;
  onDownloadPassphrase: (passphrase: string) => Promise<void>;
  onDownloadBackupFile: (passphrase: string) => Promise<void>;
}) {
  const [restorePassphrase, setRestorePassphrase] = useState('');

  return (
    <View style={styles.pageBody}>
      <Text style={styles.pageTitle}>Backup & Restore Keys</Text>
      <Text style={styles.subtitle}>
        Create a Firebase backup of encrypted document keys and keep your recovery passphrase offline.
      </Text>

      <View style={[styles.section, styles.passphraseSection]}>
        <Text style={styles.sectionTitle}>Create Key Backup</Text>
        <Text style={styles.sectionDescription}>
          {isGuest
            ? 'Guest mode does not support Firebase key backup.'
            : 'Generates a random passphrase and backs up only documents marked as recoverable.'}
        </Text>
        {!isGuest ? (
          <Text style={styles.subtitle}>
            Recoverable documents: {recoverableDocsCount} / {totalDocsCount}
          </Text>
        ) : null}
        <PrimaryButton
          label={isSubmitting ? 'Backing up...' : 'Backup Keys to Firebase'}
          onPress={() => {
            onBackupKeys();
          }}
          disabled={isGuest || isSubmitting || recoverableDocsCount === 0}
        />
      </View>

      {displayPassphrase ? (
        <View style={styles.passphraseBox}>
          <Text style={styles.passphraseLabel}>Recovery Passphrase</Text>
          <Text style={styles.passphraseText}>{displayPassphrase}</Text>
          <View style={styles.passphraseBtnRow}>
            <SecondaryButton
              label="Copy"
              onPress={() => {
                onCopyPassphrase(displayPassphrase);
              }}
            />
            <SecondaryButton
              label="Download Phrase"
              onPress={() => {
                onDownloadPassphrase(displayPassphrase);
              }}
            />
          </View>
          <View style={styles.passphraseBtnRow}>
            <SecondaryButton
              label="Download Backup JSON"
              onPress={() => {
                onDownloadBackupFile(displayPassphrase);
              }}
            />
            <SecondaryButton label="Hide" onPress={onClearPassphrase} />
          </View>
        </View>
      ) : null}

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Restore Keys</Text>
        <Text style={styles.sectionDescription}>
          Enter your recovery passphrase to restore encrypted document keys to this device.
        </Text>
        <TextInput
          value={restorePassphrase}
          onChangeText={setRestorePassphrase}
          style={styles.textInput}
          placeholder="passphrase"
          placeholderTextColor="#6b7280"
          autoCapitalize="none"
        />
        <PrimaryButton
          label={isSubmitting ? 'Restoring...' : 'Restore Keys from Firebase'}
          onPress={() => {
            onRestoreKeys(restorePassphrase.trim());
          }}
          disabled={isGuest || isSubmitting || restorePassphrase.trim().length < 6}
        />
      </View>

      {backupStatus ? (
        <View style={styles.statusBox}>
          <Text style={styles.statusText}>{backupStatus}</Text>
        </View>
      ) : null}
    </View>
  );
}

