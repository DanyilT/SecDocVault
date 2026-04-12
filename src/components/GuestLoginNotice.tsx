/**
 * components/GuestLoginNotice.tsx
 *
 * Small informational component shown in guest login contexts. Kept in a
 * separate file to keep `AuthScreen` compact and to allow focused tests.
 */

import { StyleSheet, Text } from 'react-native';

const styles = StyleSheet.create({
  guestNote: {
    color: '#dbeafe',
    backgroundColor: '#10203a',
    borderWidth: 1,
    borderColor: '#1d4ed8',
    borderRadius: 12,
    padding: 12,
  },
  bold: {
    fontWeight: 'bold',
  }
});

/**
 * GuestLoginNotice
 *
 * Render a short informational notice shown on guest login flows explaining
 * that guest mode is local-only and does not sync to Firebase.
 *
 * @returns {JSX.Element} Small Text component with guest notice
 */
export function GuestLoginNotice() {
  return (
    <Text style={styles.guestNote}>
      Guest login is anonymous and local-only.
      Nothing is saved to Firebase.
      <Text style={styles.bold}> Nothing are gonna be stored on our servers.</Text>
    </Text>
  );
}
