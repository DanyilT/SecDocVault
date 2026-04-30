import React, { useState } from 'react';
import { Text, TextInput, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';

import { useAuth } from '../context/AuthContext';
import { useDocumentVaultContext } from '../context/DocumentVaultContext';
import { Header, PrimaryButton } from '../components/ui';
import { restoreKeysFromFirebase } from '../services/keyBackup';
import { styles } from '../theme/styles';
import type { VaultStackParamList } from '../navigation/types';

type Props = NativeStackScreenProps<VaultStackParamList, 'RecoverKeys'>;

export function KeyRecoveryScreen({ navigation }: Props) {
  const { user, isGuest } = useAuth();
  const { loadDocuments } = useDocumentVaultContext();
  const [passphrase, setPassphrase] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [status, setStatus] = useState('');

  const handleRestoreKeys = async (phrase: string) => {
    if (!user?.uid) return;
    setIsSubmitting(true);
    setStatus('');
    try {
      const count = await restoreKeysFromFirebase(user.uid, phrase);
      setStatus(`Restored keys for ${count} document(s).`);
      await loadDocuments();
    } catch (err) {
      setStatus(err instanceof Error ? err.message : 'Key recovery failed.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <View style={{ flex: 1 }}>
      <Header title="Recover Keys" showBack onBack={() => navigation.goBack()} />
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
          onPress={() => void handleRestoreKeys(passphrase.trim())}
          disabled={isGuest || isSubmitting || passphrase.trim().length < 6}
        />
        {status ? <Text style={styles.backupStatus}>{status}</Text> : null}
      </View>
    </View>
  );
}
