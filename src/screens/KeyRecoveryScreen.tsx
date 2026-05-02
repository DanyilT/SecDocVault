import React, { useState } from 'react';
import { Text, TextInput, View } from 'react-native';

import { PrimaryButton } from '../components/ui';
import { styles } from '../theme/styles';

type Props = {
  isGuest: boolean;
  isSubmitting: boolean;
  status: string;
  onRestoreKeys: (passphrase: string) => Promise<void>;
};

export function KeyRecoveryScreen({ isGuest, isSubmitting, status, onRestoreKeys }: Props) {
  const [passphrase, setPassphrase] = useState('');

  return (
    <View style={{ flex: 1 }}>
      <View style={styles.pageBody}>
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
          onPress={() => void onRestoreKeys(passphrase.trim())}
          disabled={isGuest || isSubmitting || passphrase.trim().length < 6}
        />
        {status ? <Text style={styles.backupStatus}>{status}</Text> : null}
      </View>
    </View>
  );
}
