/**
 * app/components/AppShell.tsx
 *
 * Top-level application shell. Composes the header controller, screen router
 * and overlay layer from the single `useAppController` hook. Replaces the old
 * React Navigation entry point so App.tsx stays minimal.
 */

import React from 'react';
import { View } from 'react-native';

import { useAppController } from '../controllers';
import { AppHeaderController } from './AppHeaderController';
import { AppOverlays } from './AppOverlays';
import { AppScreenRouter } from './AppScreenRouter';

export function AppShell() {
  const {
    showVaultShell,
    appScreenRouterProps,
    headerControllerProps,
    overlaysProps,
  } = useAppController();

  return (
    <View style={{ flex: 1 }}>
      {showVaultShell ? <AppHeaderController {...headerControllerProps} /> : null}
      <AppScreenRouter {...appScreenRouterProps} />
      <AppOverlays {...overlaysProps} />
    </View>
  );
}
