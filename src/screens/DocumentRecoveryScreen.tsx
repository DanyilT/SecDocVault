/**
 * screens/DocumentRecoveryScreen.tsx
 *
 * Screen to view and toggle which documents are included in the cloud key
 * recovery backup. Presents two lists (recoverable and not recoverable) and
 * delegates the actual persistence to the provided `onToggleDocBackup` handler.
 */

import React, { useState } from 'react';
import { Pressable, ScrollView, Switch, Text, View } from 'react-native';

import { styles } from '../theme/styles';

type DocEntry = { id: string; name: string; canRecover: boolean };

type Props = {
  isSubmitting: boolean;
  keyBackupEnabled: boolean;
  backedUpDocs: DocEntry[];
  notBackedUpDocs: DocEntry[];
  onToggleDocBackup: (docId: string, enabled: boolean) => Promise<void>;
};

/**
 * DocumentRecoveryScreen
 *
 * Shows lists of documents that are included or excluded from key backup
 * (recoverable vs not recoverable) and allows toggling per-document backup
 * eligibility. Persistence is delegated to the provided `onToggleDocBackup`
 * handler.
 *
 * @param {object} props - Component props
 * @param {boolean} props.isSubmitting - Whether a toggle action is in progress
 * @param {boolean} props.keyBackupEnabled - Whether key backup is enabled globally
 * @param {Array<{id: string; name: string; canRecover: boolean}>} props.backedUpDocs - Documents currently marked recoverable
 * @param {Array<{id: string; name: string; canRecover: boolean}>} props.notBackedUpDocs - Documents currently not recoverable
 * @param {(docId: string, enabled: boolean) => Promise<void>} props.onToggleDocBackup - Toggle handler for per-document backup
 * @returns {JSX.Element} Rendered document recovery screen
 */
export function DocumentRecoveryScreen({
  isSubmitting,
  keyBackupEnabled,
  backedUpDocs,
  notBackedUpDocs,
  onToggleDocBackup,
}: Props) {
  const [disabledHintDocId, setDisabledHintDocId] = useState<string | null>(null);

  const renderRow = (item: DocEntry, value: boolean) => {
    const disabled = isSubmitting || !keyBackupEnabled || !item.canRecover;
    return (
      <View key={`${value ? 'on' : 'off'}-${item.id}`}>
        <Pressable
          onPress={() => { if (!item.canRecover) setDisabledHintDocId(item.id); }}
          style={styles.switchRow}>
          <Text style={styles.switchLabel}>{item.name}</Text>
          <Switch
            value={value}
            onValueChange={next => { setDisabledHintDocId(null); void onToggleDocBackup(item.id, next); }}
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
      <ScrollView contentContainerStyle={styles.scrollContainer}>
        <Text style={styles.subtitle}>Choose which documents are included in key recovery.</Text>
        {!keyBackupEnabled ? (
          <Text style={styles.warningText}>Key backup is off. Turn it on in Settings to use recovery.</Text>
        ) : null}

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
