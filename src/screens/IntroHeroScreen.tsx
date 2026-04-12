/**
 * screens/IntroHeroScreen.tsx
 *
 * Simple landing/intro hero shown before authentication. This presentation
 * component contains CTA buttons to start login or guest flows and a brief
 * product blurb. Keep this component purely presentational.
 */

import React from 'react';
import { ScrollView, Text, View } from 'react-native';

import { SegmentButton } from '../components/ui';
import { GuestLoginNotice } from '../components/GuestLoginNotice.tsx';
import { styles } from '../theme/styles';

/**
 * IntroHeroScreen
 *
 * Presentation-only landing screen shown before authentication. Exposes
 * callbacks for starting login or guest flows.
 *
 * @param {object} props - Component props
 * @param {() => void} props.onLogin - Callback invoked when the Login CTA is pressed
 * @param {() => void} props.onGuest - Callback invoked when the Guest CTA is pressed
 * @returns {JSX.Element} Rendered intro hero screen
 */
export function IntroHeroScreen({
  onLogin,
  onGuest,
}: {
  onLogin: () => void;
  onGuest: () => void;
}) {
  return (
    <ScrollView contentContainerStyle={styles.scrollContainer}>
      <View style={styles.introHero}>
        <View style={styles.logoPlaceholder}>
          <Text style={styles.logoPlaceholderText}>Logo</Text>
        </View>
        <Text style={styles.brand}>SecDocVault</Text>
        <Text style={styles.previewTagline}>
          Secure document vault intro hero
        </Text>
      </View>

      <View style={styles.heroCard}>
        <Text style={styles.heroTitle}>
          Protect documents with local privacy first.
        </Text>
        <Text style={styles.subtitle}>
          Keep vault files secure, preview the app, and continue to
          authentication when ready.
        </Text>
        <View style={styles.actionRow}>
          <SegmentButton label="Login" isActive onPress={onLogin} />
          <SegmentButton label="Guest" isActive onPress={onGuest} />
        </View>
        <GuestLoginNotice />
      </View>

      <View style={styles.footerView}>
        <Text style={styles.footerCopy}>
          © SecDocVault | TU Dublin third year project. Created by Dany, Illia,
          Artem.
        </Text>
      </View>
    </ScrollView>
  );
}
