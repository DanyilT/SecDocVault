import { useEffect } from 'react';
import { Animated } from 'react-native';

import { AppScreen } from '../navigation/constants';
import { AuthGateStage } from '../navigation/routingReducer';
import { AuthMode } from '../../types/vault';

type UseVaultShellTransitionEffectParams = {
  transitionOpacity: Animated.Value;
  transitionTranslateY: Animated.Value;
  accessMode: 'login' | 'guest';
  authGateStage: AuthGateStage;
  authMode: AuthMode;
  screen: AppScreen;
  isAuthenticated: boolean;
  isVaultLocked: boolean;
};

export function useVaultShellTransitionEffect({
  transitionOpacity,
  transitionTranslateY,
  accessMode,
  authGateStage,
  authMode,
  screen,
  isAuthenticated,
  isVaultLocked,
}: UseVaultShellTransitionEffectParams) {
  useEffect(() => {
    transitionOpacity.setValue(0.92);
    transitionTranslateY.setValue(6);
    Animated.parallel([
      Animated.timing(transitionOpacity, {
        toValue: 1,
        duration: 180,
        useNativeDriver: true,
      }),
      Animated.timing(transitionTranslateY, {
        toValue: 0,
        duration: 220,
        useNativeDriver: true,
      }),
    ]).start();
  }, [accessMode, authGateStage, authMode, screen, isAuthenticated, isVaultLocked, transitionOpacity, transitionTranslateY]);
}
