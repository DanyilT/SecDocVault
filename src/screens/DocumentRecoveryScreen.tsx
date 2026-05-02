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
