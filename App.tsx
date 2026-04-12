import React from 'react';
import { Animated, StatusBar, useColorScheme } from 'react-native';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';

import { AppOverlays } from './src/app/components/AppOverlays';
import { AppHeaderController } from './src/app/components/AppHeaderController';
import { AppScreenRouter } from './src/app/components/AppScreenRouter';
import { useAppController } from './src/app/controllers';
import { AuthProvider } from './src/context/AuthContext';
import { styles } from './src/theme/styles';

function App(): React.JSX.Element {
  const isDarkMode = useColorScheme() === 'dark';

  return (
    <SafeAreaProvider>
      <StatusBar barStyle={isDarkMode ? 'light-content' : 'dark-content'} />
      <SafeAreaView style={styles.appShell}>
        <AuthProvider>
          <AppContent />
        </AuthProvider>
      </SafeAreaView>
    </SafeAreaProvider>
  );
}

function AppContent() {
  const {
    showVaultShell,
    transitionOpacity,
    transitionTranslateY,
    appScreenRouterProps,
    headerControllerProps,
    overlaysProps,
  } = useAppController();

  const router = <AppScreenRouter {...appScreenRouterProps} />;

  if (!showVaultShell) {
    return router;
  }

  return (
    <Animated.View style={[styles.container, { opacity: transitionOpacity, transform: [{ translateY: transitionTranslateY }] }] }>
      <AppHeaderController {...headerControllerProps} />
      {router}
      <AppOverlays {...overlaysProps} />
    </Animated.View>
  );
}

export default App;
