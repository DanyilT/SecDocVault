/**
 * app/components/AppOverlays.tsx
 *
 * Overlay UI elements like toasts, modals and setup dialogs that sit above the
 * main router. Kept in a single file so overlay presentation can be reused by
 * multiple screens without duplicating modal markup.
 */

import React, { useState } from 'react';
import { Pressable, Text, TextInput, View } from 'react-native';

import { overlayStyles } from '../../theme/styleComponents/overlayStyles.ts';
import { styles } from '../../theme/styles.ts';

type AppOverlaysProps = {
  showKeyBackupSetupModal: boolean;
  onCancelKeyBackupSetup: () => void;
  onConfirmKeyBackupSetup: () => Promise<void>;
  showUploadDiscardWarning: boolean;
  dontShowUploadDiscardWarningAgain: boolean;
  onToggleDontShowUploadDiscardWarningAgain: () => void;
  onCloseUploadDiscardWarning: () => void;
  onConfirmDiscardUploadDraft: () => Promise<void>;
  showVaultPassphrasePrompt: boolean;
  vaultPassphrasePromptInput: string;
  vaultPassphrasePromptAttemptsLeft: number;
  isVaultPassphrasePromptSubmitting: boolean;
  vaultPassphrasePromptError: string | null;
  onVaultPassphraseInputChange: (value: string) => void;
  onVaultPassphraseSubmit: (passphrase: string) => Promise<void>;
  onVaultPassphrasePromptDismiss: () => void;
};

/**
 * AppOverlays
 *
 * Renders top-level overlays used by the application shell:
 * - Key backup setup modal (prompt and passphrase reveal/copy)
 * - Upload discard confirmation modal
 *
 * This component is presentational and fully controlled by props. All side
 * effects (copying passphrases, confirming setup, toggling preferences) are
 * delegated to the callback props supplied by the caller.
 *
 * @param props - controlled props described by `AppOverlaysProps`
 */
export function AppOverlays({
  showKeyBackupSetupModal,
  onCancelKeyBackupSetup,
  onConfirmKeyBackupSetup,
  showUploadDiscardWarning,
  dontShowUploadDiscardWarningAgain,
  onToggleDontShowUploadDiscardWarningAgain,
  onCloseUploadDiscardWarning,
  onConfirmDiscardUploadDraft,
  showVaultPassphrasePrompt,
  vaultPassphrasePromptInput,
  vaultPassphrasePromptAttemptsLeft,
  isVaultPassphrasePromptSubmitting,
  vaultPassphrasePromptError,
  onVaultPassphraseInputChange,
  onVaultPassphraseSubmit,
  onVaultPassphrasePromptDismiss,
}: AppOverlaysProps) {
  const [showPassphrase, setShowPassphrase] = useState(false);

  return (
    <>
      {showKeyBackupSetupModal ? (
        <View style={overlayStyles.backdrop}>
          <View style={[styles.card, overlayStyles.keyBackupCard]}>
            <Text style={styles.sectionLabel}>Set up key backup first</Text>
            <Text style={styles.subtitle}>
              Enabling recovery for a document needs key backup to be configured. This will generate (or reuse)
              your recovery passphrase.
            </Text>

            <View style={styles.cardActions}>
              <Pressable
                onPress={onCancelKeyBackupSetup}
                style={[styles.secondaryButton, overlayStyles.actionButton]}
              >
                <Text style={[styles.secondaryButtonText, overlayStyles.actionButtonLabel]}>Cancel</Text>
              </Pressable>
              <Pressable
                onPress={() => {
                  void onConfirmKeyBackupSetup();
                }}
                style={[styles.primaryButton, overlayStyles.actionButtonNoTopMargin]}
              >
                <Text style={[styles.primaryButtonText, overlayStyles.actionButtonLabel]}>Set Up</Text>
              </Pressable>
            </View>
          </View>
        </View>
      ) : null}

      {showVaultPassphrasePrompt ? (
        <View style={overlayStyles.backdrop}>
          <View style={[styles.card, overlayStyles.keyBackupCard]}>
            <Text style={styles.sectionLabel}>Enter Your Vault Passphrase</Text>
            <Text style={styles.subtitle}>
              Your vault passphrase is needed to unlock your documents. You set this during account creation.
            </Text>

            {vaultPassphrasePromptError ? (
              <Text style={styles.errorText}>{vaultPassphrasePromptError}</Text>
            ) : null}

            {vaultPassphrasePromptAttemptsLeft < 3 ? (
              <Text style={styles.subtitle}>
                {vaultPassphrasePromptAttemptsLeft} attempt{vaultPassphrasePromptAttemptsLeft !== 1 ? 's' : ''} remaining.
              </Text>
            ) : null}

            <View style={{flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderColor: '#374151', borderRadius: 12, backgroundColor: '#111827', paddingHorizontal: 12}}>
              <TextInput
                style={[styles.input, {flex: 1, borderWidth: 0, paddingHorizontal: 0}]}
                placeholder="Vault passphrase"
                placeholderTextColor="#6b7280"
                secureTextEntry={!showPassphrase}
                value={vaultPassphrasePromptInput}
                onChangeText={onVaultPassphraseInputChange}
                autoCapitalize="none"
                autoCorrect={false}
                editable={!isVaultPassphrasePromptSubmitting}
              />
              <Pressable onPress={() => setShowPassphrase(prev => !prev)}>
                <Text style={styles.secondaryButtonText}>{showPassphrase ? 'Hide' : 'Show'}</Text>
              </Pressable>
            </View>

            <View style={styles.cardActions}>
              <Pressable
                onPress={onVaultPassphrasePromptDismiss}
                style={[styles.secondaryButton, overlayStyles.actionButton]}
                disabled={isVaultPassphrasePromptSubmitting}
              >
                <Text style={[styles.secondaryButtonText, overlayStyles.actionButtonLabel]}>Dismiss</Text>
              </Pressable>
              <Pressable
                onPress={() => { void onVaultPassphraseSubmit(vaultPassphrasePromptInput); }}
                style={[styles.primaryButton, overlayStyles.actionButtonNoTopMargin]}
                disabled={isVaultPassphrasePromptSubmitting || !vaultPassphrasePromptInput.trim()}
              >
                <Text style={[styles.primaryButtonText, overlayStyles.actionButtonLabel]}>
                  {isVaultPassphrasePromptSubmitting ? 'Unlocking...' : 'Unlock'}
                </Text>
              </Pressable>
            </View>
          </View>
        </View>
      ) : null}

      {showUploadDiscardWarning ? (
        <View style={overlayStyles.backdrop}>
          <View style={[styles.card, overlayStyles.discardCard]}>
            <Text style={styles.sectionLabel}>Discard this upload?</Text>
            <Text style={styles.subtitle}>
              Your current upload details will not be saved if you leave this screen.
            </Text>

            <Pressable
              onPress={onToggleDontShowUploadDiscardWarningAgain}
              style={overlayStyles.discardWarningRow}
            >
              <View
                style={[
                  overlayStyles.discardWarningCheckbox,
                  dontShowUploadDiscardWarningAgain ? overlayStyles.discardWarningCheckboxChecked : null,
                ]}
              >
                {dontShowUploadDiscardWarningAgain ? (
                  <Text style={overlayStyles.discardWarningCheckboxText}>OK</Text>
                ) : null}
              </View>
              <Text style={overlayStyles.discardWarningLabel}>Do not show this again</Text>
            </Pressable>

            <View style={styles.cardActions}>
              <Pressable
                onPress={onCloseUploadDiscardWarning}
                style={[styles.secondaryButton, overlayStyles.actionButton]}
              >
                <Text style={[styles.secondaryButtonText, overlayStyles.actionButtonLabel]}>Keep Editing</Text>
              </Pressable>
              <Pressable
                onPress={() => {
                  void onConfirmDiscardUploadDraft();
                }}
                style={[styles.primaryButton, overlayStyles.actionButtonNoTopMargin]}
              >
                <Text style={[styles.primaryButtonText, overlayStyles.actionButtonLabel]}>Discard</Text>
              </Pressable>
            </View>
          </View>
        </View>
      ) : null}
    </>
  );
}
