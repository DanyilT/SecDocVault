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

export function GuestLoginNotice(){
  return (
    <Text style={styles.guestNote}>
      Guest login is anonymous and local-only.
      Nothing is saved to Firebase.
      <Text style={styles.bold}> Nothing are gonna be stored on our servers.</Text>
    </Text>
  );
}
