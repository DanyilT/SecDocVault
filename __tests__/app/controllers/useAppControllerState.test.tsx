import React, { forwardRef, useImperativeHandle } from 'react';
import TestRenderer, { act } from 'react-test-renderer';

import { useAppControllerState } from '../../../src/app/controllers/useAppControllerState';

type HarnessRef = {
  getSnapshot: () => {
    authMode: 'login' | 'register';
    backupCloud: boolean;
    pendingUploadName: string;
    transitionOpacityType: string;
  };
  updateFields: () => void;
};

const Harness = forwardRef<HarnessRef>((_props, ref) => {
  const state = useAppControllerState();

  useImperativeHandle(ref, () => ({
    getSnapshot: () => ({
      authMode: state.authMode,
      backupCloud: state.backupCloud,
      pendingUploadName: state.pendingUploadName,
      transitionOpacityType: state.transitionOpacity?.constructor?.name ?? '',
    }),
    updateFields: () => {
      state.setAuthMode('register');
      state.setBackupCloud(false);
      state.setPendingUploadName('Renamed Doc');
    },
  }));

  return null;
});

describe('useAppControllerState', () => {
  it('exposes expected defaults and animated refs', () => {
    const ref = React.createRef<HarnessRef>();

    act(() => {
      TestRenderer.create(<Harness ref={ref} />);
    });

    expect(ref.current?.getSnapshot()).toEqual({
      authMode: 'login',
      backupCloud: true,
      pendingUploadName: 'Document',
      transitionOpacityType: 'AnimatedValue',
    });
  });

  it('updates exposed state setters', () => {
    const ref = React.createRef<HarnessRef>();

    act(() => {
      TestRenderer.create(<Harness ref={ref} />);
    });

    act(() => {
      ref.current?.updateFields();
    });

    expect(ref.current?.getSnapshot()).toEqual({
      authMode: 'register',
      backupCloud: false,
      pendingUploadName: 'Renamed Doc',
      transitionOpacityType: 'AnimatedValue',
    });
  });
});
