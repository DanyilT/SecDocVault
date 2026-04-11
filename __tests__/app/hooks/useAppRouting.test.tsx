import React, { forwardRef, useImperativeHandle } from 'react';
import ReactTestRenderer, { act } from 'react-test-renderer';

import { AppScreen } from '../../../src/app/navigation/constants';
import { useAppRouting } from '../../../src/app/hooks';

type RoutingHarnessRef = {
  getState: () => {
    screen: AppScreen;
    authGateStage: 'hero' | 'auth' | 'unlock';
    authReturnStage: 'hero' | 'unlock';
    shareOriginScreen: 'main' | 'preview';
  };
  setScreen: (screen: AppScreen) => void;
  goToAuth: (returnStage: 'hero' | 'unlock') => void;
  returnFromAuth: () => void;
  resetToHero: () => void;
  setShareOriginScreen: (screen: 'main' | 'preview') => void;
};

const RoutingHarness = forwardRef<RoutingHarnessRef>((_, ref) => {
  const routing = useAppRouting();

  useImperativeHandle(ref, () => ({
    getState: () => ({
      screen: routing.screen,
      authGateStage: routing.authGateStage,
      authReturnStage: routing.authReturnStage,
      shareOriginScreen: routing.shareOriginScreen,
    }),
    setScreen: routing.setScreen,
    goToAuth: routing.goToAuth,
    returnFromAuth: routing.returnFromAuth,
    resetToHero: routing.resetToHero,
    setShareOriginScreen: routing.setShareOriginScreen,
  }));

  return null;
});

describe('useAppRouting', () => {
  const renderHarness = () => {
    const ref = React.createRef<RoutingHarnessRef>();
    let renderer: ReactTestRenderer.ReactTestRenderer;

    act(() => {
      renderer = ReactTestRenderer.create(<RoutingHarness ref={ref} />);
    });

    return {
      ref,
      unmount: () => {
        act(() => {
          renderer.unmount();
        });
      },
    };
  };

  it('starts with expected defaults', () => {
    const {ref, unmount} = renderHarness();

    expect(ref.current?.getState()).toEqual({
      screen: 'main',
      authGateStage: 'hero',
      authReturnStage: 'hero',
      shareOriginScreen: 'main',
    });

    unmount();
  });

  it('navigates into auth and returns to configured stage', () => {
    const {ref, unmount} = renderHarness();

    act(() => {
      ref.current?.goToAuth('unlock');
    });

    expect(ref.current?.getState()).toEqual({
      screen: 'main',
      authGateStage: 'auth',
      authReturnStage: 'unlock',
      shareOriginScreen: 'main',
    });

    act(() => {
      ref.current?.returnFromAuth();
    });

    expect(ref.current?.getState()?.authGateStage).toBe('unlock');

    unmount();
  });

  it('resets routing state after changes', () => {
    const {ref, unmount} = renderHarness();

    act(() => {
      ref.current?.setScreen('settings');
      ref.current?.goToAuth('unlock');
      ref.current?.setShareOriginScreen('preview');
    });

    act(() => {
      ref.current?.resetToHero();
    });

    expect(ref.current?.getState()).toEqual({
      screen: 'main',
      authGateStage: 'hero',
      authReturnStage: 'hero',
      shareOriginScreen: 'main',
    });

    unmount();
  });
});
