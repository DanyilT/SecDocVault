import { ActivityIndicator, StatusBar, useColorScheme, View } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import Login from '../screens/Login';
import CreateAccount from '../screens/CreateAccount';
import ForgotPassword from '../screens/ForgotPassword';
import Main from '../screens/Main';
import VerifyEmail from '../screens/VerifyEmail';
import { AuthProvider, useAuth } from '../context/AuthContext';

export type RootStackParamList = {
  Login: undefined;
  CreateAccount: undefined;
  ForgotPassword: undefined;
  VerifyEmail: undefined;
  Main: undefined;
};

const Stack = createNativeStackNavigator<RootStackParamList>();

function Navigator() {
  const { user, loading } = useAuth();
  const isDarkMode = useColorScheme() === 'dark';

  if (loading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator size="large" />
      </View>
    );
  }

  return (
    <NavigationContainer>
      <StatusBar barStyle={isDarkMode ? 'light-content' : 'dark-content'} />
      <Stack.Navigator screenOptions={{ headerShown: false }}>
        {user && user.emailVerified ? (
          <Stack.Screen name="Main" component={Main} />
        ) : user ? (
          <Stack.Screen name="VerifyEmail" component={VerifyEmail} />
        ) : (
          <>
            <Stack.Screen name="Login" component={Login} />
            <Stack.Screen name="CreateAccount" component={CreateAccount} />
            <Stack.Screen name="ForgotPassword" component={ForgotPassword} />
          </>
        )}
      </Stack.Navigator>
    </NavigationContainer>
  );
}

function App() {
  return (
    <SafeAreaProvider>
      <AuthProvider>
        <Navigator />
      </AuthProvider>
    </SafeAreaProvider>
  );
}

export default App;
