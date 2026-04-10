import React from 'react';
import { Switch, Text, View } from 'react-native';

import { PrimaryButton, SecondaryButton } from '../components/ui';
import { styles } from '../theme/styles';

export function BackupScreen({
  isGuest,
  backupCloud,
  backupLocal,
  backupStatus,
  setBackupCloud,
  setBackupLocal,
  runBackup,
  onOpenKeyBackup,
}: {
  isGuest: boolean;
  backupCloud: boolean;
  backupLocal: boolean;
  backupStatus: string;
  setBackupCloud: (value: boolean) => void;
  setBackupLocal: (value: boolean) => void;
  runBackup: () => void;
  onOpenKeyBackup?: () => void;
}) {
  return (
    <View style={styles.pageBody}>
      <Text style={styles.pageTitle}>Backup Files</Text>
      <Text style={styles.subtitle}>
        {isGuest
          ? 'Guest mode keeps data on-device only. Cloud backup is disabled.'
          : 'Choose backup destinations for encrypted vault data.'}
      </Text>
      <View style={styles.switchRow}>
        <Text style={styles.switchLabel}>Cloud backup (Firebase Storage)</Text>
        <Switch value={backupCloud} onValueChange={setBackupCloud} disabled={isGuest} />
      </View>
      <View style={styles.switchRow}>
        <Text style={styles.switchLabel}>Local encrypted export</Text>
        <Switch value={backupLocal} onValueChange={setBackupLocal} />
      </View>
      <PrimaryButton label="Run Backup" onPress={runBackup} />
      <SecondaryButton label="Backup & Restore Keys" onPress={onOpenKeyBackup ?? (() => undefined)} />
      <Text style={styles.backupStatus}>{backupStatus}</Text>
    </View>
  );
}

