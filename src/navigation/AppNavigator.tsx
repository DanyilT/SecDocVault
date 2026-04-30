import React from 'react';
import { ActivityIndicator, View } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';

import { useAuth } from '../context/AuthContext';
import { useVaultLock } from '../context/VaultLockContext';
import { AuthStack } from './AuthStack';
import { VaultStack } from './VaultStack';

export function AppNavigator() {
  const { isInitializing, isAuthenticated } = useAuth();
  const { isVaultLocked, isCompletingAuthSetup } = useVaultLock();

  if (isInitializing) {
    return (
      <View style={{ flex: 1, backgroundColor: '#0b1220', justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator size="large" color="#93c5fd" />
      </View>
    );
  }

  const showVaultStack = isAuthenticated && !isVaultLocked && !isCompletingAuthSetup;

  return (
    <NavigationContainer theme={{ dark: true, colors: { background: '#0b1220', primary: '#2563eb', card: '#0b1220', text: '#f9fafb', border: '#374151', notification: '#2563eb' }, fonts: { regular: { fontFamily: 'System', fontWeight: '400' }, medium: { fontFamily: 'System', fontWeight: '500' }, bold: { fontFamily: 'System', fontWeight: '700' }, heavy: { fontFamily: 'System', fontWeight: '900' } } }}>
      {showVaultStack ? <VaultStack /> : <AuthStack />}
    </NavigationContainer>
  );
}
