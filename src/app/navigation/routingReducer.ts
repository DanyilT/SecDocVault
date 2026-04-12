/**
 * app/navigation/routingReducer.ts
 *
 * Small reducer that tracks in-memory routing state for the simplified app
 * router used in this project (not React Navigation). Keeps `screen`,
 * `authGateStage` and other small routing flags.
 */

import { AppScreen, RECOVERY_SUB_SCREENS } from './constants';

export type AuthGateStage = 'hero' | 'auth' | 'unlock';
export type AuthReturnStage = 'hero' | 'unlock';

export type AppRoutingState = {
  screen: AppScreen;
  authGateStage: AuthGateStage;
  authReturnStage: AuthReturnStage;
  shareOriginScreen: 'main' | 'preview';
};

export type RoutingAction =
  | {type: 'SET_SCREEN'; payload: AppScreen}
  | {type: 'SET_AUTH_GATE_STAGE'; payload: AuthGateStage}
  | {type: 'SET_AUTH_RETURN_STAGE'; payload: AuthReturnStage}
  | {type: 'SET_SHARE_ORIGIN_SCREEN'; payload: 'main' | 'preview'}
  | {type: 'GO_TO_AUTH'; payload: {returnStage: AuthReturnStage}}
  | {type: 'RETURN_FROM_AUTH'}
  | {type: 'RESET_TO_HERO'};

export const initialRoutingState: AppRoutingState = {
  screen: 'main',
  authGateStage: 'hero',
  authReturnStage: 'hero',
  shareOriginScreen: 'main',
};

export function routingReducer(state: AppRoutingState, action: RoutingAction): AppRoutingState {
  switch (action.type) {
    case 'SET_SCREEN':
      return {
        ...state,
        screen: action.payload,
      };
    case 'SET_AUTH_GATE_STAGE':
      return {
        ...state,
        authGateStage: action.payload,
      };
    case 'SET_AUTH_RETURN_STAGE':
      return {
        ...state,
        authReturnStage: action.payload,
      };
    case 'SET_SHARE_ORIGIN_SCREEN':
      return {
        ...state,
        shareOriginScreen: action.payload,
      };
    case 'GO_TO_AUTH':
      return {
        ...state,
        authGateStage: 'auth',
        authReturnStage: action.payload.returnStage,
      };
    case 'RETURN_FROM_AUTH':
      return {
        ...state,
        authGateStage: state.authReturnStage,
      };
    case 'RESET_TO_HERO':
      return {
        ...state,
        screen: 'main',
        authGateStage: 'hero',
        authReturnStage: 'hero',
        shareOriginScreen: 'main',
      };
    default:
      return state;
  }
}

export function getBackTargetScreen(state: Pick<AppRoutingState, 'screen' | 'shareOriginScreen'>): AppScreen;
export function getBackTargetScreen(screen: AppScreen, shareOriginScreen: 'main' | 'preview'): AppScreen;
export function getBackTargetScreen(
  stateOrScreen: Pick<AppRoutingState, 'screen' | 'shareOriginScreen'> | AppScreen,
  shareOriginArg?: 'main' | 'preview',
): AppScreen {
  const screen = typeof stateOrScreen === 'string' ? stateOrScreen : stateOrScreen.screen;
  const shareOriginScreen =
    typeof stateOrScreen === 'string'
      ? (shareOriginArg ?? 'main')
      : stateOrScreen.shareOriginScreen;

  if (screen === 'sharedetails') {
    return 'share';
  }

  if (screen === 'share') {
    return shareOriginScreen;
  }

  if (RECOVERY_SUB_SCREENS.includes(screen as (typeof RECOVERY_SUB_SCREENS)[number])) {
    return 'settings';
  }

  return 'main';
}
