import React, { useMemo, useState } from 'react';
import { Pressable, ScrollView, Switch, Text, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';

import { useAuth } from '../context/AuthContext';
import { useDocumentVaultContext } from '../context/DocumentVaultContext';
import { Header } from '../components/ui';
import { updateDocumentRecoveryPreference } from '../services/documentVault';
import { backupKeysToFirebase, getRecoveryPassphraseForSettings } from '../services/keyBackup';
import { getVaultPreferences } from '../storage/localVault';
import { styles } from '../theme/styles';
import type { VaultStackParamList } from '../navigation/types';

type Props = NativeStackScreenProps<VaultStackParamList, 'RecoveryDocs'>;

export function DocumentRecoveryScreen({ navigation }: Props) {
  const { user } = useAuth();
  const { documents, setDocuments } = useDocumentVaultContext();
  const [keyBackupEnabled, setKeyBackupEnabled] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [disabledHintDocId, setDisabledHintDocId] = useState<string | null>(null);
  const [backupStatus, setBackupStatus] = useState('');

  // Load the keyBackupEnabled preference once on mount.
  React.useEffect(() => {
    void getVaultPreferences().then(prefs => setKeyBackupEnabled(prefs.keyBackupEnabled));
  }, []);

  const { backedUpDocs, notBackedUpDocs } = useMemo(() => {
    const backed: Array<{ id: string; name: string; canRecover: boolean }> = [];
    const notBacked: Array<{ id: string; name: string; canRecover: boolean }> = [];
    for (const doc of documents) {
      const hasCloud = doc.references?.some(r => r.source === 'firebase') ?? false;
      const entry = { id: doc.id, name: doc.name, canRecover: hasCloud };
      if (doc.recoverable) backed.push(entry);
      else notBacked.push(entry);
    }
    return { backedUpDocs: backed, notBackedUpDocs: notBacked };
  }, [documents]);

  const handleToggle = async (docId: string, enabled: boolean) => {
    const doc = documents.find(d => d.id === docId);
    if (!doc) return;
    setIsSubmitting(true);
    setBackupStatus('');
    try {
      const updated = await updateDocumentRecoveryPreference(doc, enabled);
      const nextDocuments = documents.map(d => (d.id === docId ? updated : d));
      setDocuments(nextDocuments);

      if (enabled && user?.uid) {
        const passphrase = await getRecoveryPassphraseForSettings();
        if (passphrase) {
          try {
            const result = await backupKeysToFirebase(user.uid, nextDocuments, passphrase);
            setBackupStatus(`Key backup updated (${result.backedUpCount} key(s) saved).`);
          } catch (syncErr) {
            setBackupStatus(syncErr instanceof Error ? syncErr.message : 'Backup sync failed.');
          }
        } else {
          setBackupStatus('No recovery passphrase set. Use "Backup Keys" in Settings to create a backup.');
        }
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const renderRow = (item: { id: string; name: string; canRecover: boolean }, value: boolean) => {
    const disabled = isSubmitting || !keyBackupEnabled || !item.canRecover;
    return (
      <View key={`${value ? 'on' : 'off'}-${item.id}`}>
        <Pressable
          onPress={() => { if (!item.canRecover) setDisabledHintDocId(item.id); }}
          style={styles.switchRow}>
          <Text style={styles.switchLabel}>{item.name}</Text>
          <Switch
            value={value}
            onValueChange={next => { setDisabledHintDocId(null); void handleToggle(item.id, next); }}
            disabled={disabled}
          />
        </Pressable>
        {!item.canRecover && disabledHintDocId === item.id ? (
          <Text style={styles.settingsNote}>
            This document cannot be recovered because it is not saved to cloud.
          </Text>
        ) : null}
      </View>
    );
  };

  return (
    <View style={{ flex: 1 }}>
      <Header title="Document Recovery" showBack onBack={() => navigation.goBack()} />
      <ScrollView contentContainerStyle={styles.scrollContainer}>
      <Text style={styles.subtitle}>Choose which documents are included in key recovery.</Text>
      {!keyBackupEnabled ? (
        <Text style={styles.warningText}>Key backup is off. Turn it on in Settings to use recovery.</Text>
      ) : null}
      {backupStatus ? <Text style={styles.backupStatus}>{backupStatus}</Text> : null}

      <View style={styles.card}>
        <Text style={styles.sectionLabel}>Recoverable Documents</Text>
        {backedUpDocs.length === 0 ? <Text style={styles.subtitle}>None</Text> : null}
        {backedUpDocs.map(item => renderRow(item, true))}
      </View>

      <View style={styles.card}>
        <Text style={styles.sectionLabel}>Not Recoverable</Text>
        {notBackedUpDocs.length === 0 ? <Text style={styles.subtitle}>None</Text> : null}
        {notBackedUpDocs.map(item => renderRow(item, false))}
      </View>
      </ScrollView>
    </View>
  );
}
