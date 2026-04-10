import React, { useState } from 'react';
import { Pressable, ScrollView, Switch, Text, View } from 'react-native';

import { styles } from '../theme/styles';

export function DocumentRecoveryScreen({
  isSubmitting,
  keyBackupEnabled,
  backedUpDocs,
  notBackedUpDocs,
  onToggleDocBackup,
}: {
  isSubmitting: boolean;
  keyBackupEnabled: boolean;
  backedUpDocs: Array<{id: string; name: string; canRecover: boolean}>;
  notBackedUpDocs: Array<{id: string; name: string; canRecover: boolean}>;
  onToggleDocBackup: (docId: string, enabled: boolean) => Promise<void>;
}) {
  const [disabledHintDocId, setDisabledHintDocId] = useState<string | null>(null);

  return (
    <ScrollView contentContainerStyle={styles.scrollContainer}>
      <Text style={styles.pageTitle}>Document Recovery</Text>
      <Text style={styles.subtitle}>
        Choose which documents are included in key recovery.
      </Text>
      {!keyBackupEnabled ? (
        <Text style={styles.warningText}>
          Key backup is off. Turn it on in Settings to use recovery.
        </Text>
      ) : null}

      <View style={styles.card}>
        <Text style={styles.sectionLabel}>Recoverable Documents</Text>
        {backedUpDocs.length === 0 ? <Text style={styles.subtitle}>None</Text> : null}
        {backedUpDocs.map(item => {
          const isDisabled = isSubmitting || !keyBackupEnabled || !item.canRecover;
          return (
            <View key={`enabled-${item.id}`}>
              <Pressable
                onPress={() => {
                  if (!item.canRecover) {
                    setDisabledHintDocId(item.id);
                  }
                }}
                style={styles.switchRow}
              >
                <Text style={styles.switchLabel}>{item.name}</Text>
                <Switch
                  value
                  onValueChange={value => {
                    setDisabledHintDocId(null);
                    void onToggleDocBackup(item.id, value);
                  }}
                  disabled={isDisabled}
                />
              </Pressable>
              {!item.canRecover && disabledHintDocId === item.id ? (
                <Text style={styles.settingsNote}>
                  This document cannot be recovered because it is not saved to cloud.
                </Text>
              ) : null}
            </View>
          );
        })}
      </View>

      <View style={styles.card}>
        <Text style={styles.sectionLabel}>Not Recoverable</Text>
        {notBackedUpDocs.length === 0 ? <Text style={styles.subtitle}>None</Text> : null}
        {notBackedUpDocs.map(item => {
          const isDisabled = isSubmitting || !keyBackupEnabled || !item.canRecover;
          return (
            <View key={`disabled-${item.id}`}>
              <Pressable
                onPress={() => {
                  if (!item.canRecover) {
                    setDisabledHintDocId(item.id);
                  }
                }}
                style={styles.switchRow}
              >
                <Text style={styles.switchLabel}>{item.name}</Text>
                <Switch
                  value={false}
                  onValueChange={value => {
                    setDisabledHintDocId(null);
                    void onToggleDocBackup(item.id, value);
                  }}
                  disabled={isDisabled}
                />
              </Pressable>
              {!item.canRecover && disabledHintDocId === item.id ? (
                <Text style={styles.settingsNote}>
                  This document cannot be recovered because it is not saved to cloud.
                </Text>
              ) : null}
            </View>
          );
        })}
      </View>
    </ScrollView>
  );
}


