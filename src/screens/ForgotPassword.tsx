import React from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import styles from '../design/Styles.tsx';
import { RootStackParamList } from '../nav/App';

type Props = NativeStackScreenProps<RootStackParamList, 'ForgotPassword'>;

const ForgotPassword: React.FC<Props> = ({ navigation }) => {
  const [email, setEmail] = React.useState('');

  const handleLogin = () => {
    if (!email) {
      Alert.alert('Error', 'Email is required.');
      return;
    }
    // send reset link to email
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.loginContainer}>
        <Text style={styles.title}>Forgot Password</Text>
        <Text style={styles.inputFieldDescription}>Password reset link will be sent to your email.</Text>

        <TextInput
          style={styles.input}
          placeholder="Email"
          keyboardType="email-address"
          autoCapitalize="none"
          value={email}
          onChangeText={setEmail}
        />

        <TouchableOpacity style={styles.buttonPrimary} onPress={handleLogin}>
          <Text style={styles.buttonPrimaryText}>Reset Password</Text>
        </TouchableOpacity>

        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Text style={styles.buttonLink}>Back to Login</Text>
        </TouchableOpacity>

      </View>
    </SafeAreaView>
  );
};

export default ForgotPassword;