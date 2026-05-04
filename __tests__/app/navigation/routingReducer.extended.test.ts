/**
 * Extended tests for app/navigation/routingReducer.ts
 * Covers the remaining uncovered branches.
 */

import {
  routingReducer,
  initialRoutingState,
  getBackTargetScreen,
} from '../../../src/app/navigation/routingReducer';

describe('routingReducer – SET_AUTH_GATE_STAGE', () => {
  test('updates authGateStage', () => {
    const next = routingReducer(initialRoutingState, {
      type: 'SET_AUTH_GATE_STAGE',
      payload: 'auth',
    });
    expect(next.authGateStage).toBe('auth');
  });
});

describe('routingReducer – SET_AUTH_RETURN_STAGE', () => {
  test('updates authReturnStage', () => {
    const next = routingReducer(initialRoutingState, {
      type: 'SET_AUTH_RETURN_STAGE',
      payload: 'unlock',
    });
    expect(next.authReturnStage).toBe('unlock');
  });
});

describe('routingReducer – unknown action (default)', () => {
  test('returns unchanged state for unknown action type', () => {
    const next = routingReducer(initialRoutingState, { type: 'UNKNOWN' } as any);
    expect(next).toEqual(initialRoutingState);
  });
});

describe('getBackTargetScreen – overloaded signature (screen + shareOriginArg)', () => {
  test('routes sharedetails to share using string args', () => {
    expect(getBackTargetScreen('sharedetails', 'main')).toBe('share');
  });

  test('routes share to preview origin using string args', () => {
    expect(getBackTargetScreen('share', 'preview')).toBe('preview');
  });

  test('routes share to main origin using string args', () => {
    expect(getBackTargetScreen('share', 'main')).toBe('main');
  });

  test('routes recoverkeys to settings using string args', () => {
    expect(getBackTargetScreen('recoverkeys', 'main')).toBe('settings');
  });

  test('defaults shareOriginArg to main when not provided', () => {
    expect(getBackTargetScreen('settings', undefined as any)).toBe('main');
  });
});

