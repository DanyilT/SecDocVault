import React, { useState } from 'react';
import { Text, TextInput, View } from 'react-native';

import { PrimaryButton } from '../components/ui';
import { styles } from '../theme/styles';
import { buildPassphraseChangeHandler } from '../services/crypto/passphraseHandlers.ts';

type Props = {
  isGuest: boolean;
  isSubmitting: boolean;
  status: string;
  onRestoreKeys: (passphrase: string) => Promise<void>;
  onSkipForNow?: () => void;
};

export function KeyRecoveryScreen({ isGuest, isSubmitting, status, onRestoreKeys, onSkipForNow }: Props) {
  const [passphrase, setPassphrase] = useState('');
  const [passphraseError, setPassphraseError] = useState('');

  const handlePassphraseChange = (value: string) => {
    buildPassphraseChangeHandler({ setPassphrase, setError: setPassphraseError })(value);
  };

  return (
    <View style={{ flex: 1 }}>
      <View style={styles.pageBody}>
        <Text style={styles.subtitle}>
          If your recovery passphrase is saved in Firebase, you can recover keys
          by using your recovery passphrase
          {onSkipForNow ? 'or skip for now.' : '.'}
        </Text>
        {onSkipForNow ? (
          <Text style={styles.subtitle}>
            You can always return to this screen from: {'\n'}
            <Text style={{ fontWeight: 'bold' }}>
              Settings → Key Backup → Recover Keys
            </Text>
          </Text>
        ) : null}
        <TextInput
          value={passphrase}
          onChangeText={handlePassphraseChange}
          style={styles.input}
          placeholder="Recovery passphrase (5 words separated by hyphens)"
          placeholderTextColor="#6b7280"
          autoCapitalize="none"
          editable={!isSubmitting}
          returnKeyType={'send'}
          onSubmitEditing={isGuest || isSubmitting || !passphrase.trim() || Boolean(passphraseError) ? undefined : onRestoreKeys.bind(null, passphrase.trim())}
        />
        {passphraseError ? (
          <Text style={styles.errorText}>{passphraseError}</Text>
        ) : null}
        <PrimaryButton
          label={isSubmitting ? 'Recovering...' : 'Confirm Key Recovery'}
          onPress={() => {
            onRestoreKeys(passphrase.trim()).then(() => {
              onSkipForNow?.();
            }).catch(() => {});
          }}
          disabled={
            isGuest ||
            isSubmitting ||
            !passphrase.trim() ||
            Boolean(passphraseError)
          }
        />
        {onSkipForNow ? (
          <PrimaryButton
            label="Skip for now"
            variant="outline"
            onPress={onSkipForNow}
            disabled={isSubmitting}
          />
        ) : null}
        {status ? <Text style={styles.backupStatus}>{status}</Text> : null}
      </View>
    </View>
  );
}
