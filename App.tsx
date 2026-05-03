import React from 'react';
import { StatusBar, useColorScheme } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { GestureHandlerRootView } from 'react-native-gesture-handler';

import { AuthProvider } from './src/context/AuthContext';
import { VaultLockProvider } from './src/context/VaultLockContext';
import { DocumentVaultProvider } from './src/context/DocumentVaultContext';
import { AppShell } from './src/app/components/AppShell';

function App(): React.JSX.Element {
  const isDarkMode = useColorScheme() === 'dark';

  return (
    <GestureHandlerRootView style={{ flex: 1, backgroundColor: '#0b1220' }}>
      <SafeAreaProvider style={{ backgroundColor: '#0b1220' }}>
        <StatusBar barStyle={isDarkMode ? 'light-content' : 'dark-content'} />
        <AuthProvider>
          <VaultLockProvider>
            <DocumentVaultProvider>
              <AppShell />
            </DocumentVaultProvider>
          </VaultLockProvider>
        </AuthProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

export default App;
