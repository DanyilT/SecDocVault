import React from 'react';
import TestRenderer, { act } from 'react-test-renderer';
import { Animated } from 'react-native';

import { useVaultShellTransitionEffect } from '../../../src/app/controllers/useVaultShellTransitionEffect';

function Harness({params}: {params: any}) {
  useVaultShellTransitionEffect(params);
  return null;
}

describe('useVaultShellTransitionEffect', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('applies entry animation values and starts parallel timing animations', () => {
    const transitionOpacity = {setValue: jest.fn()} as any;
    const transitionTranslateY = {setValue: jest.fn()} as any;

    const start = jest.fn();
    const timingSpy = jest.spyOn(Animated, 'timing').mockImplementation(() => ({start} as any));
    const parallelSpy = jest.spyOn(Animated, 'parallel').mockImplementation(() => ({start} as any));

    act(() => {
      TestRenderer.create(
        <Harness
          params={{
            transitionOpacity,
            transitionTranslateY,
            accessMode: 'login',
            authGateStage: 'hero',
            authMode: 'login',
            screen: 'main',
            isAuthenticated: false,
            isVaultLocked: false,
          }}
        />,
      );
    });

    expect(transitionOpacity.setValue).toHaveBeenCalledWith(0.92);
    expect(transitionTranslateY.setValue).toHaveBeenCalledWith(6);
    expect(timingSpy).toHaveBeenCalledTimes(2);
    expect(parallelSpy).toHaveBeenCalledTimes(1);
    expect(start).toHaveBeenCalled();
  });
});
