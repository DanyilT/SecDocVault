import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';

import { useAuth } from '../context/AuthContext';
import { useVaultLock } from '../context/VaultLockContext';
import { AuthScreen } from '../screens/AuthScreen';
import { CompleteAuthScreen } from '../screens/CompleteAuthScreen';
import { IntroHeroScreen } from '../screens/IntroHeroScreen';
import { UnlockScreen } from '../screens/UnlockScreen';
import type { AuthStackParamList } from './types';

const Stack = createNativeStackNavigator<AuthStackParamList>();

export function AuthStack() {
  const { isAuthenticated } = useAuth();
  const { isVaultLocked, isCompletingAuthSetup } = useVaultLock();

  const initialRoute: keyof AuthStackParamList = isCompletingAuthSetup
    ? 'CompleteAuthSetup'
    : isAuthenticated && isVaultLocked
    ? 'Unlock'
    : 'IntroHero';

  return (
    <Stack.Navigator
      initialRouteName={initialRoute}
      screenOptions={{ headerShown: false, animation: 'fade' }}>
      <Stack.Screen name="IntroHero" component={IntroHeroScreen} />
      <Stack.Screen name="Auth" component={AuthScreen} />
      <Stack.Screen name="Unlock" component={UnlockScreen} />
      <Stack.Screen name="CompleteAuthSetup" component={CompleteAuthScreen} />
    </Stack.Navigator>
  );
}
