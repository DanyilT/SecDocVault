/**
 * components/ui.tsx
 *
 * Small shared UI primitives (Header, PrimaryButton, SecondaryButton,
 * SegmentButton) used across the app. These are intentionally un-opinionated
 * wrappers around React Native primitives so snapshots and tests can import
 * them consistently.
 */

import React from 'react';
import { Pressable, StyleProp, Text, View, ViewStyle } from 'react-native';

import { styles } from '../theme/styles';

/**
 * Renders the top header bar with optional left and right actions.
 *
 * @param props \- Header component props.
 * @param props.title \- Title displayed in the center of the header.
 * @param props.showBack \- Whether the back action is enabled.
 * @param props.onBack \- Callback invoked when the back action is pressed.
 * @param props.rightLabel \- Optional label for the right action.
 * @param props.onRightPress \- Optional callback for the right action press.
 * @returns Header UI element.
 */
export function Header({
  title,
  showBack,
  onBack,
  rightLabel,
  rightIcon: RightIcon,
  rightDanger,
  onRightPress,
}: {
  title: string;
  showBack?: boolean;
  onBack?: () => void;
  rightLabel?: string;
  rightIcon?: React.ComponentType<{size?: number; color?: string}>;
  rightDanger?: boolean;
  onRightPress?: () => void;
}) {
  const rightIconColor = rightDanger ? '#ef4444' : '#60a5fa';

  return (
    <View style={styles.header}>
      <Pressable disabled={!showBack} onPress={onBack}>
        <Text style={[styles.headerLink, !showBack && styles.headerLinkMuted]}>Back</Text>
      </Pressable>
      <Text style={styles.headerTitle}>{title}</Text>
      {rightLabel && onRightPress ? (
        <Pressable onPress={onRightPress}>
          <Text style={[styles.headerLink, rightDanger && styles.headerLinkDanger]}>{rightLabel}</Text>
        </Pressable>
      ) : RightIcon && onRightPress ? (
        <Pressable onPress={onRightPress} style={{ width: 56, alignItems: 'flex-end' }}>
          <RightIcon size={22} color={rightIconColor} />
        </Pressable>
      ) : (
        <View style={styles.headerSpacer} />
      )}
    </View>
  );
}

/**
 * Renders a selectable segment button with active state styling.
 *
 * @param props - Segment button props.
 * @param props.label - Button text.
 * @param props.isActive - Whether the button is currently active.
 * @param props.onPress - Callback invoked when the button is pressed.
 * @returns Segment button UI element.
 */
export function SegmentButton({
  label,
  isActive,
  onPress,
}: {
  label: string;
  isActive: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable style={[styles.segmentButton, isActive && styles.segmentButtonActive]} onPress={onPress}>
      <Text style={[styles.segmentText, isActive && styles.segmentTextActive]}>{label}</Text>
    </Pressable>
  );
}

/**
 * Renders a primary action button.
 *
 * @param props - Primary button props.
 * @param props.label - Button text.
 * @param props.onPress - Callback invoked when the button is pressed.
 * @param props.disabled - Whether the button is disabled.
 * @returns Primary button UI element.
 */
export function PrimaryButton({
  label,
  onPress,
  disabled,
  variant,
  icon: Icon,
  containerStyle,
}: {
  label: string;
  onPress: () => void;
  disabled?: boolean;
  variant?: 'default' | 'danger' | 'outline';
  icon?: React.ComponentType<{size?: number; color?: string}>;
  containerStyle?: StyleProp<ViewStyle>;
}) {
  const iconColor = variant === 'danger' ? '#fecaca' : variant === 'outline' ? '#93c5fd' : '#dbeafe';

  return (
    <Pressable
      style={[
        styles.primaryButton,
        containerStyle,
        variant === 'outline' && styles.primaryButtonOutline,
        variant === 'danger' && styles.primaryButtonDanger,
        disabled && styles.primaryButtonDisabled,
      ]}
      disabled={disabled}
      onPress={onPress}>
      <View style={styles.primaryButtonContent}>
        {Icon ? <Icon size={16} color={iconColor} /> : null}
        <Text style={[styles.primaryButtonText, variant === 'outline' && styles.primaryButtonTextOutline]}>{label}</Text>
      </View>
    </Pressable>
  );
}

/**
 * Renders a secondary action button.
 *
 * @param props - Secondary button props.
 * @param props.label - Button text.
 * @param props.onPress - Callback invoked when the button is pressed.
 * @returns Secondary button UI element.
 */
export function SecondaryButton({label, onPress}: {label: string; onPress: () => void}) {
  return (
    <Pressable style={styles.secondaryButton} onPress={onPress}>
      <Text style={styles.secondaryButtonText}>{label}</Text>
    </Pressable>
  );
}
