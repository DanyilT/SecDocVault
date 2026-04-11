import React from 'react';
import { Pressable, Text, View } from 'react-native';

import { overlayStyles } from '../../theme/styleComponents/overlayStyles.ts';
import { styles } from '../../theme/styles.ts';

type AppOverlaysProps = {
  showKeyBackupSetupModal: boolean;
  recoveryPassphraseForSettings: string | null;
  onCopyPassphrase: (passphrase: string) => Promise<void>;
  onCancelKeyBackupSetup: () => void;
  onConfirmKeyBackupSetup: () => Promise<void>;
  showUploadDiscardWarning: boolean;
  dontShowUploadDiscardWarningAgain: boolean;
  onToggleDontShowUploadDiscardWarningAgain: () => void;
  onCloseUploadDiscardWarning: () => void;
  onConfirmDiscardUploadDraft: () => Promise<void>;
};

export function AppOverlays({
  showKeyBackupSetupModal,
  recoveryPassphraseForSettings,
  onCopyPassphrase,
  onCancelKeyBackupSetup,
  onConfirmKeyBackupSetup,
  showUploadDiscardWarning,
  dontShowUploadDiscardWarningAgain,
  onToggleDontShowUploadDiscardWarningAgain,
  onCloseUploadDiscardWarning,
  onConfirmDiscardUploadDraft,
}: AppOverlaysProps) {
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
            <Pressable
              onPress={() => {
                if (recoveryPassphraseForSettings) {
                  void onCopyPassphrase(recoveryPassphraseForSettings);
                }
              }}
            >
              <Text style={styles.cardMeta}>
                Passphrase: {recoveryPassphraseForSettings ?? 'Will be generated now'}
              </Text>
              {recoveryPassphraseForSettings ? (
                <Text style={styles.settingsNote}>Tap passphrase to copy.</Text>
              ) : null}
            </Pressable>

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
