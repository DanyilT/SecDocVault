/**
 * app/controllers/useVaultShellTransitionEffect.ts
 *
 * Small visual transition helper used to animate the vault shell as the app
 * switches between auth gate and the unlocked vault UI. Exposes a hook that
 * manipulates `Animated.Value` properties passed from the controller state.
 */

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

/**
 * useVaultShellTransitionEffect
 *
 * Animate the vault shell entrance/exit when switching between auth and the
 * unlocked vault UI. Manipulates two `Animated.Value` objects supplied by
 * the controller state.
 *
 * @param params - animation values and state that influence the transition
 * @returns void
 */
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
