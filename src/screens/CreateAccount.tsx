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

type Props = NativeStackScreenProps<RootStackParamList, 'CreateAccount'>;

const CreateAccount: React.FC<Props> = ({ navigation }) => {
  const [username, setUsername] = React.useState('');
  const [email, setEmail] = React.useState('');
  const [password, setPassword] = React.useState('');
  const [confirmPassword, setConfirmPassword] = React.useState('');
  const [passphrase, setPassphrase] = React.useState('');

  const handleCreateAccount = () => {
    if (!username || !email || !password || !confirmPassword || !passphrase) {
      Alert.alert('Error', 'All fields are required.');
      return;
    } else if (password !== confirmPassword) {
      Alert.alert('Error', 'Passwords do not match.');
      return;
    }
    // proceed with account creation
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
        >
          <Text style={styles.buttonPrimaryText}>Create Account</Text>
        </TouchableOpacity>

        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Text style={styles.buttonLink}>Back to Login</Text>
        </TouchableOpacity>

      </View>
    </SafeAreaView>
  );
};

export default CreateAccount;