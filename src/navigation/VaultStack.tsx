import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';

import { DocumentRecoveryScreen } from '../screens/DocumentRecoveryScreen';
import { KeyRecoveryScreen } from '../screens/KeyRecoveryScreen';
import { MainScreen } from '../screens/MainScreen';
import { PreviewScreen } from '../screens/PreviewScreen';
import { SettingsScreen } from '../screens/SettingsScreen';
import { ShareDetailsScreen } from '../screens/ShareDetailsScreen';
import { ShareScreen } from '../screens/ShareScreen';
import { UploadConfirmScreen } from '../screens/UploadConfirmScreen';
import type { VaultStackParamList } from './types';

const Stack = createNativeStackNavigator<VaultStackParamList>();

export function VaultStack() {
  return (
    <Stack.Navigator
      initialRouteName="Main"
      screenOptions={{ headerShown: false, animation: 'slide_from_right' }}>
      <Stack.Screen name="Main" component={MainScreen} />
      <Stack.Screen name="Preview" component={PreviewScreen} />
      <Stack.Screen name="Upload" component={UploadConfirmScreen} />
      <Stack.Screen name="Share" component={ShareScreen} />
      <Stack.Screen name="ShareDetails" component={ShareDetailsScreen} />
      <Stack.Screen name="Settings" component={SettingsScreen} />
      <Stack.Screen name="RecoverKeys" component={KeyRecoveryScreen} />
      <Stack.Screen name="RecoveryDocs" component={DocumentRecoveryScreen} />
    </Stack.Navigator>
  );
}
