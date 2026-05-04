/**
 * app/components/EditMetadataModal.tsx
 *
 * Modal for editing the editable metadata fields of a document — currently
 * the display name and the optional description. Designed as a controlled
 * presentational component so all state and persistence concerns live in
 * the calling controller/hook.
 */

import React from 'react';
import { Pressable, Text, TextInput, View } from 'react-native';

import { overlayStyles } from '../../theme/styleComponents/overlayStyles';
import { styles } from '../../theme/styles';

export type EditMetadataModalProps = {
  visible: boolean;
  nameInput: string;
  descriptionInput: string;
  isSubmitting: boolean;
  errorMessage?: string | null;
  onChangeName: (value: string) => void;
  onChangeDescription: (value: string) => void;
  onCancel: () => void;
  onSave: () => void;
};

/**
 * EditMetadataModal
 *
 * Controlled modal for editing a document's `name` and `description`. Save
 * is disabled while submitting or when the trimmed name is empty so a user
 * cannot accidentally clear the document name to a placeholder.
 *
 * @param props - controlled props described by `EditMetadataModalProps`
 * @returns JSX.Element rendering the modal when `visible` is true, otherwise null
 */
export function EditMetadataModal({
  visible,
  nameInput,
  descriptionInput,
  isSubmitting,
  errorMessage,
  onChangeName,
  onChangeDescription,
  onCancel,
  onSave,
}: EditMetadataModalProps) {
  if (!visible) {
    return null;
  }

  const trimmedName = nameInput.trim();
  const canSave = !isSubmitting && trimmedName.length > 0;

  return (
    <View style={overlayStyles.backdrop}>
      <View style={[styles.card, overlayStyles.keyBackupCard]}>
        <Text style={styles.sectionLabel}>Edit document metadata</Text>
        <Text style={styles.subtitle}>
          Update the document name and description. Other fields like file contents and integrity tags are
          not editable.
        </Text>

        <Text style={styles.sectionLabel}>Document Name</Text>
        <TextInput
          autoCapitalize="sentences"
          placeholder="Enter document name"
          placeholderTextColor="#6b7280"
          style={styles.input}
          value={nameInput}
          onChangeText={onChangeName}
          editable={!isSubmitting}
        />

        <Text style={styles.sectionLabel}>Description (optional)</Text>
        <TextInput
          autoCapitalize="sentences"
          placeholder="Add description"
          placeholderTextColor="#6b7280"
          style={[styles.input, { minHeight: 86, textAlignVertical: 'top' }]}
          multiline
          value={descriptionInput}
          onChangeText={onChangeDescription}
          editable={!isSubmitting}
        />

        {errorMessage ? (
          <Text style={styles.errorText}>{errorMessage}</Text>
        ) : null}

        <View style={styles.cardActions}>
          <Pressable
            onPress={onCancel}
            disabled={isSubmitting}
            style={[styles.secondaryButton, overlayStyles.actionButton]}
            accessibilityRole="button"
            accessibilityLabel="Cancel edit metadata"
          >
            <Text style={[styles.secondaryButtonText, overlayStyles.actionButtonLabel]}>Cancel</Text>
          </Pressable>
          <Pressable
            onPress={onSave}
            disabled={!canSave}
            style={[styles.primaryButton, overlayStyles.actionButtonNoTopMargin, { opacity: canSave ? 1 : 0.5 }]}
            accessibilityRole="button"
            accessibilityLabel="Save edited metadata"
          >
            <Text style={[styles.primaryButtonText, overlayStyles.actionButtonLabel]}>
              {isSubmitting ? 'Saving...' : 'Save'}
            </Text>
          </Pressable>
        </View>
      </View>
    </View>
  );
}
