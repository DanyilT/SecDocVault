/**
 * screens/KeyRecoveryScreen.tsx
 *
 * Screen used to restore key backups from a recovery passphrase. This is a
 * thin presentation layer that accepts a passphrase and delegates the
 * restoration work to `onRestoreKeys` provided by the caller.
 */

import React, { useState } from 'react';
import { Text, TextInput, View } from 'react-native';

import { PrimaryButton } from '../components/ui';
import { styles } from '../theme/styles';

/**
 * KeyRecoveryScreen
 *
 * Presentation screen that accepts a recovery passphrase and triggers the
 * provided `onRestoreKeys` callback to perform key restoration.
 *
 * @param {object} props - Component props
 * @param {boolean} props.isGuest - Whether the current session is a guest session
 * @param {boolean} props.isSubmitting - Whether a restore is in progress
 * @param {string} props.status - Optional status message to show below the action
 * @param {(passphrase: string) => Promise<void>} props.onRestoreKeys - Callback to restore keys using the passphrase
 * @returns {JSX.Element} Rendered key recovery screen
 */
export function KeyRecoveryScreen({
  isGuest,
  isSubmitting,
  status,
  onRestoreKeys,
}: {
  isGuest: boolean;
  isSubmitting: boolean;
  status: string;
  onRestoreKeys: (passphrase: string) => Promise<void>;
}) {
  const [passphrase, setPassphrase] = useState('');

  return (
    <View style={styles.pageBody}>
      <Text style={styles.pageTitle}>Recover Keys</Text>
      <TextInput
        value={passphrase}
        onChangeText={setPassphrase}
        style={styles.input}
        placeholder="Recovery passphrase"
        placeholderTextColor="#6b7280"
        autoCapitalize="none"
      />
      <PrimaryButton
        label={isSubmitting ? 'Recovering...' : 'Confirm Key Recovery'}
        onPress={() => {
          void onRestoreKeys(passphrase.trim());
        }}
        disabled={isGuest || isSubmitting || passphrase.trim().length < 6}
      />
      {status ? <Text style={styles.backupStatus}>{status}</Text> : null}
    </View>
  );
}
