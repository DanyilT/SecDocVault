/**
 * app/components/AppOverlays.tsx
 *
 * Overlay UI elements like toasts, modals and setup dialogs that sit above the
 * main router. Kept in a single file so overlay presentation can be reused by
 * multiple screens without duplicating modal markup.
 */

import React from 'react';
import { Pressable, Text, View } from 'react-native';

import { EditMetadataModal } from './EditMetadataModal';
import { overlayStyles } from '../../theme/styleComponents/overlayStyles.ts';
import { styles } from '../../theme/styles.ts';

type AppOverlaysProps = {
  showUploadDiscardWarning: boolean;
  dontShowUploadDiscardWarningAgain: boolean;
  onToggleDontShowUploadDiscardWarningAgain: () => void;
  onCloseUploadDiscardWarning: () => void;
  onConfirmDiscardUploadDraft: () => Promise<void>;
  showEditMetadataModal?: boolean;
  editMetadataNameInput?: string;
  editMetadataDescriptionInput?: string;
  isEditMetadataSubmitting?: boolean;
  editMetadataError?: string | null;
  onEditMetadataNameChange?: (value: string) => void;
  onEditMetadataDescriptionChange?: (value: string) => void;
  onCancelEditMetadata?: () => void;
  onSaveEditMetadata?: () => void;
};

/**
 * AppOverlays
 *
 * Renders top-level overlays used by the application shell:
 * - Upload discard confirmation modal
 *
 * This component is presentational and fully controlled by props. All side
 * effects (copying passphrases, confirming setup, toggling preferences) are
 * delegated to the callback props supplied by the caller.
 *
 * @param props - controlled props described by `AppOverlaysProps`
 */
export function AppOverlays({
  showUploadDiscardWarning,
  dontShowUploadDiscardWarningAgain,
  onToggleDontShowUploadDiscardWarningAgain,
  onCloseUploadDiscardWarning,
  onConfirmDiscardUploadDraft,
  showEditMetadataModal = false,
  editMetadataNameInput = '',
  editMetadataDescriptionInput = '',
  isEditMetadataSubmitting = false,
  editMetadataError = null,
  onEditMetadataNameChange,
  onEditMetadataDescriptionChange,
  onCancelEditMetadata,
  onSaveEditMetadata,
}: AppOverlaysProps) {
  return (
    <>
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
                  onConfirmDiscardUploadDraft().catch(() => {});
                }}
                style={[styles.primaryButton, overlayStyles.actionButtonNoTopMargin]}
              >
                <Text style={[styles.primaryButtonText, overlayStyles.actionButtonLabel]}>Discard</Text>
              </Pressable>
            </View>
          </View>
        </View>
      ) : null}

      <EditMetadataModal
        visible={showEditMetadataModal}
        nameInput={editMetadataNameInput}
        descriptionInput={editMetadataDescriptionInput}
        isSubmitting={isEditMetadataSubmitting}
        errorMessage={editMetadataError}
        onChangeName={onEditMetadataNameChange ?? (() => undefined)}
        onChangeDescription={onEditMetadataDescriptionChange ?? (() => undefined)}
        onCancel={onCancelEditMetadata ?? (() => undefined)}
        onSave={onSaveEditMetadata ?? (() => undefined)}
      />
    </>
  );
}
