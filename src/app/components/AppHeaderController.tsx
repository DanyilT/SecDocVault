import React from 'react';
import { Alert } from 'react-native';
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
  title: string;
};

export function AppHeaderController({
  screen,
  shareOriginScreen,
  onLeaveUploadScreen,
  onSetScreen,
  onLogout,
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
          Alert.alert('Edit document metadata', 'Doc metadata editing are not implemented yet.');
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
