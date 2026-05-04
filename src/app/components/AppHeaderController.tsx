/**
 * app/components/AppHeaderController.tsx
 *
 * Controls header state (title, back target) based on routing and selection.
 * Implemented as a small component that subscribes to props rather than using
 * navigation libraries to keep the app simple and testable.
 */

import React from 'react';
import { EllipsisHorizontalCircleIcon, PencilSquareIcon } from 'react-native-heroicons/solid';

import { Header } from '../../components/ui';
import { AppScreen } from '../navigation/constants';
import { getBackTargetScreen } from '../navigation/routingReducer';

type AppHeaderControllerProps = {
  screen: AppScreen;
  shareOriginScreen: 'main' | 'preview';
  onLeaveUploadScreen: () => void;
  onSetScreen: (screen: AppScreen) => void;
  onLogout: () => void;
  onEditMetadata?: () => void;
  title: string;
};

/**
 * AppHeaderController
 *
 * Small controller component that maps routing state to the `Header` props
 * (title, back behavior, right action). Keeps header logic centralized and
 * decoupled from navigation libraries.
 *
 * @param props - `AppHeaderControllerProps` describing screen and handlers
 * @returns JSX.Element header component
 */
export function AppHeaderController({
  screen,
  shareOriginScreen,
  onLeaveUploadScreen,
  onSetScreen,
  onLogout,
  onEditMetadata,
  title,
}: AppHeaderControllerProps) {
  const rightIcon = screen === 'preview' ? PencilSquareIcon : screen === 'share' ? EllipsisHorizontalCircleIcon : undefined;

  return (
    <Header
      title={title}
      showBack={screen !== 'main'}
      onBack={() => {
        if (screen === 'upload') {
          onLeaveUploadScreen();
          return;
        }

        onSetScreen(getBackTargetScreen(screen, shareOriginScreen));
      }}
      rightLabel={screen === 'main' ? 'Settings' : screen === 'settings' ? 'Logout' : undefined}
      rightIcon={rightIcon}
      rightDanger={screen === 'settings'}
      onRightPress={() => {
        if (screen === 'preview') {
          onEditMetadata?.();
          return;
        }

        if (screen === 'share') {
          onSetScreen('sharedetails');
          return;
        }

        if (screen === 'main') {
          onSetScreen('settings');
          return;
        }

        if (screen !== 'settings') {
          return;
        }

        onLogout();
      }}
    />
  );
}
