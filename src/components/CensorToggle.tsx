/**
 * components/CensorToggle.tsx
 *
 * Header pill toggle for the censor feature.
 * - Shows "Censor: Off" / "Censor: On" label with an eye icon.
 * - Shows a spinner + "scanning…" text while OCR is running.
 * - Fully accessible: accessibilityRole="switch" with checked state.
 */

import React from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { EyeIcon, EyeSlashIcon } from 'react-native-heroicons/solid';

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

export type CensorToggleProps = {
  value: boolean;
  loading?: boolean;
  disabled?: boolean;
  onChange: (next: boolean) => void;
};

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function CensorToggle({
  value,
  loading = false,
  disabled = false,
  onChange,
}: CensorToggleProps) {
  const isDisabled = disabled || loading;

  return (
    <Pressable
      accessibilityRole="switch"
      accessibilityLabel="Toggle sensitive info censoring"
      accessibilityState={{ checked: value, disabled: isDisabled }}
      disabled={isDisabled}
      onPress={() => onChange(!value)}
      style={[
        styles.pill,
        value && styles.pillActive,
        isDisabled && styles.pillDisabled,
      ]}
    >
      <View style={styles.inner}>
        {loading ? (
          <ActivityIndicator
            size="small"
            color={value ? '#0f172a' : '#93c5fd'}
          />
        ) : value ? (
          <EyeSlashIcon size={16} color="#0f172a" />
        ) : (
          <EyeIcon size={16} color="#93c5fd" />
        )}
        <Text style={[styles.label, value && styles.labelActive]}>
          {loading ? 'scanning…' : value ? 'Censor: On' : 'Censor: Off'}
        </Text>
      </View>
    </Pressable>
  );
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const styles = StyleSheet.create({
  pill: {
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#334155',
    backgroundColor: '#1e293b',
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  pillActive: {
    backgroundColor: '#93c5fd',
    borderColor: '#93c5fd',
  },
  pillDisabled: {
    opacity: 0.5,
  },
  inner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  label: {
    color: '#93c5fd',
    fontSize: 13,
    fontWeight: '600',
  },
  labelActive: {
    color: '#0f172a',
  },
});

