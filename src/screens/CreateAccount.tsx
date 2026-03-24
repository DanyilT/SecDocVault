import React from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import styles from '../design/Styles.tsx';
import { RootStackParamList } from '../nav/App';
import { createAccount } from '../firebase/auth';

type Props = NativeStackScreenProps<RootStackParamList, 'CreateAccount'>;

const CreateAccount: React.FC<Props> = ({ navigation }) => {
  const [username, setUsername] = React.useState('');
  const [email, setEmail] = React.useState('');
  const [password, setPassword] = React.useState('');
  const [confirmPassword, setConfirmPassword] = React.useState('');
  const [passphrase, setPassphrase] = React.useState('');
  const [loading, setLoading] = React.useState(false);

  const handleCreateAccount = async () => {
    if (!username || !email || !password || !confirmPassword || !passphrase) {
      Alert.alert('Error', 'All fields are required.');
      return;
    }
    if (!/\S+@\S+\.\S+/.test(email)) {
      Alert.alert('Error', 'Please enter a valid email address.');
      return;
    }
    if (password.length < 8) {
      Alert.alert('Error', 'Password must be at least 8 characters.');
      return;
    }
    if (password !== confirmPassword) {
      Alert.alert('Error', 'Passwords do not match.');
      return;
    }

    setLoading(true);
    try { //TODO: ensure no user with same username exists
      await createAccount(username, email, password);
      // AuthContext will detect user and redirect to Main
    } catch (error: any) {
      Alert.alert('Specified email is already in use');
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.loginContainer}>
        <Text style={styles.title}>Create Account</Text>

        <TextInput
          style={styles.input}
          placeholder="Username"
          autoCapitalize="none"
          value={username}
          onChangeText={setUsername}
        />

        <TextInput
          style={styles.input}
          placeholder="Email"
          keyboardType="email-address"
          autoCapitalize="none"
          value={email}
          onChangeText={setEmail}
        />

        <TextInput
          style={styles.input}
          placeholder="Password"
          secureTextEntry
          autoCapitalize="none"
          value={password}
          onChangeText={setPassword}
        />

        <TextInput
          style={styles.input}
          placeholder="Confirm Password"
          secureTextEntry
          autoCapitalize="none"
          value={confirmPassword}
          onChangeText={setConfirmPassword}
        />

        <Text style={styles.inputFieldDescription}>
          Passphrase is used to backup encryption keys. Make sure to remember it, as it cannot be recovered.
        </Text>

        <TextInput
          style={styles.input}
          placeholder="Passphrase"
          autoCapitalize="none"
          value={passphrase}
          onChangeText={setPassphrase}
        />

        <TouchableOpacity 
          style={styles.buttonPrimary} 
          onPress={handleCreateAccount}
          disabled={loading}
        >
          {loading ? (<ActivityIndicator color="#fff" />) : 
          (<Text style={styles.buttonPrimaryText}>Create Account</Text>)}
        </TouchableOpacity>

        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Text style={styles.buttonLink}>Back to Login</Text>
        </TouchableOpacity>

      </View>
    </SafeAreaView>
  );
};

export default CreateAccount;