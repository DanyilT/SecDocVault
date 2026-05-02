import React from 'react';
import { ScrollView, Text, View } from 'react-native';

import { GuestLoginNotice } from '../components/GuestLoginNotice.tsx';
import { SegmentButton } from '../components/ui';
import { styles } from '../theme/styles';

type Props = {
  onLogin: () => void;
  onGuest: () => void;
};

export function IntroHeroScreen({ onLogin, onGuest }: Props) {
  return (
    <ScrollView contentContainerStyle={styles.scrollContainer}>
      <View style={styles.introHero}>
        <View style={styles.logoPlaceholder}>
          <Text style={styles.logoPlaceholderText}>Logo</Text>
        </View>
        <Text style={styles.brand}>SecDocVault</Text>
        <Text style={styles.previewTagline}>Secure document vault intro hero</Text>
      </View>

      <View style={styles.heroCard}>
        <Text style={styles.heroTitle}>Protect documents with local privacy first.</Text>
        <Text style={styles.subtitle}>
          Keep vault files secure, preview the app, and continue to authentication when ready.
        </Text>
        <View style={styles.actionRow}>
          <SegmentButton label="Login" isActive onPress={onLogin} />
          <SegmentButton label="Guest" isActive onPress={onGuest} />
        </View>
        <GuestLoginNotice />
      </View>

      <View style={styles.footerView}>
        <Text style={styles.footerCopy}>
          © SecDocVault | TU Dublin third year project. Created by Dany, Illia, Artem.
        </Text>
      </View>
    </ScrollView>
  );
}
