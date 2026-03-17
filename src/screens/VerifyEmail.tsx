import React from 'react';
import { View, Text, TouchableOpacity, ActivityIndicator, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import styles from '../design/Styles.tsx';
import { useAuth } from '../context/AuthContext';

const VerifyEmail: React.FC = () => {
  const { reloadUser } = useAuth();
  const [loading, setLoading] = React.useState(false);

  const handleCheckVerification = async () => {
    setLoading(true);
    try {
      await reloadUser();
      // Navigator in App.tsx redirects to Main if emailVerified is true
    } catch (error: any) {
      Alert.alert('Error', error?.message ?? String(error));
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.loginContainer}>
        <Text style={styles.title}>Verify Your Email</Text>
        <Text style={styles.inputFieldDescription}>
          A verification email has been sent to your address. Please verify your email, then tap the button below. Ensure to check your spam folder if you don't see it.
        </Text>
        <TouchableOpacity
          style={[styles.buttonPrimary, { marginTop: 20 }]}
          onPress={handleCheckVerification}
          disabled={loading}
        >
          {loading ? (<ActivityIndicator color="#fff" />) : 
          (<Text style={styles.buttonPrimaryText}>I've Verified My Email</Text>)
          }
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
};

export default VerifyEmail;
