/**
 * app/hooks/useAppRouting.ts
 *
 * Small routing helper that centralizes navigation-related state (current
 * screen, auth gate stage, share origin) in-memory for the simplified app
 * router used in this project. This is not React Navigation — it's an app
 * scoped routing abstraction used in tests and small apps.
 */

import { useCallback, useReducer } from 'react';

import { AppScreen, ScreenParams } from '../navigation/constants';
import { AuthGateStage, AuthReturnStage, initialRoutingState, routingReducer } from '../navigation/routingReducer';

export type UseAppRoutingApi = {
  screen: AppScreen;
  screenParams: ScreenParams;
  authGateStage: AuthGateStage;
  authReturnStage: AuthReturnStage;
  shareOriginScreen: 'main' | 'preview';
  setScreen: <T extends AppScreen>(screen: T, params?: ScreenParams[T]) => void;
  setAuthGateStage: (stage: AuthGateStage) => void;
  setAuthReturnStage: (stage: AuthReturnStage) => void;
  setShareOriginScreen: (screen: 'main' | 'preview') => void;
  goToAuth: (returnStage: AuthReturnStage) => void;
  returnFromAuth: () => void;
  resetToHero: () => void;
};

export function useAppRouting(): UseAppRoutingApi {
  const [state, dispatch] = useReducer(routingReducer, initialRoutingState);

  const setScreen = useCallback(<T extends AppScreen>(screen: T, params?: ScreenParams[T]) => {
    dispatch({type: 'SET_SCREEN', payload: {screen, params}});
  }, []);

  const setAuthGateStage = useCallback((stage: AuthGateStage) => {
    dispatch({type: 'SET_AUTH_GATE_STAGE', payload: stage});
  }, []);

  const setAuthReturnStage = useCallback((stage: AuthReturnStage) => {
    dispatch({type: 'SET_AUTH_RETURN_STAGE', payload: stage});
  }, []);

  const setShareOriginScreen = useCallback((screen: 'main' | 'preview') => {
    dispatch({type: 'SET_SHARE_ORIGIN_SCREEN', payload: screen});
  }, []);

  const goToAuth = useCallback((returnStage: AuthReturnStage) => {
    dispatch({type: 'GO_TO_AUTH', payload: {returnStage}});
  }, []);

  const returnFromAuth = useCallback(() => {
    dispatch({type: 'RETURN_FROM_AUTH'});
  }, []);

  const resetToHero = useCallback(() => {
    dispatch({type: 'RESET_TO_HERO'});
  }, []);

  return {
    ...state,
    setScreen,
    setAuthGateStage,
    setAuthReturnStage,
    setShareOriginScreen,
    goToAuth,
    returnFromAuth,
    resetToHero,
  };
}
