import { getBackTargetScreen, initialRoutingState, RoutingAction, routingReducer } from '../../../src/app/navigation/routingReducer';

describe('routingReducer', () => {
  it('updates screen directly', () => {
    const next = routingReducer(initialRoutingState, {type: 'SET_SCREEN', payload: 'settings'});
    expect(next.screen).toBe('settings');
  });

  it('updates share origin screen', () => {
    const next = routingReducer(initialRoutingState, {
      type: 'SET_SHARE_ORIGIN_SCREEN',
      payload: 'preview',
    } satisfies RoutingAction);
    expect(next.shareOriginScreen).toBe('preview');
  });

  it('enters auth with configured return stage', () => {
    const next = routingReducer(initialRoutingState, {
      type: 'GO_TO_AUTH',
      payload: {returnStage: 'unlock'},
    });

    expect(next.authGateStage).toBe('auth');
    expect(next.authReturnStage).toBe('unlock');
  });

  it('returns from auth to configured stage', () => {
    const withAuth = routingReducer(initialRoutingState, {
      type: 'GO_TO_AUTH',
      payload: {returnStage: 'unlock'},
    });
    const next = routingReducer(withAuth, {type: 'RETURN_FROM_AUTH'});

    expect(next.authGateStage).toBe('unlock');
  });

  it('resets to hero defaults', () => {
    const dirtyState = {
      ...initialRoutingState,
      screen: 'preview' as const,
      authGateStage: 'auth' as const,
      authReturnStage: 'unlock' as const,
    };

    const next = routingReducer(dirtyState, {type: 'RESET_TO_HERO'});
    expect(next).toEqual(initialRoutingState);
  });
});

describe('getBackTargetScreen', () => {
  it('routes share details back to share', () => {
    expect(getBackTargetScreen({screen: 'sharedetails', shareOriginScreen: 'main'})).toBe('share');
  });

  it('routes share back to origin screen', () => {
    expect(getBackTargetScreen({screen: 'share', shareOriginScreen: 'preview'})).toBe('preview');
  });

  it('routes recovery sub-screens to settings', () => {
    expect(getBackTargetScreen({screen: 'recoverkeys', shareOriginScreen: 'main'})).toBe('settings');
    expect(getBackTargetScreen({screen: 'recoverydocs', shareOriginScreen: 'main'})).toBe('settings');
  });

  it('routes any other screen to main', () => {
    expect(getBackTargetScreen({screen: 'backup', shareOriginScreen: 'main'})).toBe('main');
  });
});
