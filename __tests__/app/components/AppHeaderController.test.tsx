import React from 'react';
import TestRenderer from 'react-test-renderer';
const { act } = TestRenderer;

import { AppHeaderController } from '../../../src/app/components/AppHeaderController';

const headerPropsRef: {current: any} = {current: null};

jest.mock('../../../src/components/ui', () => ({
  Header: (props: any) => {
    headerPropsRef.current = props;
    return null;
  },
}));

describe('AppHeaderController', () => {
  const renderHeader = (props: React.ComponentProps<typeof AppHeaderController>) => {
    act(() => {
      TestRenderer.create(<AppHeaderController {...props} />);
    });
  };

  beforeEach(() => {
    headerPropsRef.current = null;
  });

  it('uses upload leave handler on back from upload screen', () => {
    const onLeaveUploadScreen = jest.fn();
    const onSetScreen = jest.fn();

    renderHeader({
      screen: 'upload',
      shareOriginScreen: 'main',
      onLeaveUploadScreen,
      onSetScreen,
      onLogout: jest.fn(),
      title: 'Upload',
    });

    headerPropsRef.current.onBack();
    expect(onLeaveUploadScreen).toHaveBeenCalledTimes(1);
    expect(onSetScreen).not.toHaveBeenCalled();
  });

  it('routes right action from main to settings', () => {
    const onSetScreen = jest.fn();

    renderHeader({
      screen: 'main',
      shareOriginScreen: 'main',
      onLeaveUploadScreen: jest.fn(),
      onSetScreen,
      onLogout: jest.fn(),
      title: 'Documents',
    });

    headerPropsRef.current.onRightPress();
    expect(onSetScreen).toHaveBeenCalledWith('settings');
  });

  it('routes back from share to origin screen via reducer helper', () => {
    const onSetScreen = jest.fn();

    renderHeader({
      screen: 'share',
      shareOriginScreen: 'preview',
      onLeaveUploadScreen: jest.fn(),
      onSetScreen,
      onLogout: jest.fn(),
      title: 'Share',
    });

    headerPropsRef.current.onBack();
    expect(onSetScreen).toHaveBeenCalledWith('preview');
  });

  it('routes settings right action to logout', () => {
    const onLogout = jest.fn();

    renderHeader({
      screen: 'settings',
      shareOriginScreen: 'main',
      onLeaveUploadScreen: jest.fn(),
      onSetScreen: jest.fn(),
      onLogout,
      title: 'Settings',
    });

    headerPropsRef.current.onRightPress();
    expect(onLogout).toHaveBeenCalledTimes(1);
  });

  it('invokes onEditMetadata when the right action is pressed on the preview screen', () => {
    const onEditMetadata = jest.fn();
    const onSetScreen = jest.fn();
    const onLogout = jest.fn();

    renderHeader({
      screen: 'preview',
      shareOriginScreen: 'main',
      onLeaveUploadScreen: jest.fn(),
      onSetScreen,
      onLogout,
      onEditMetadata,
      title: 'Preview',
    });

    headerPropsRef.current.onRightPress();
    expect(onEditMetadata).toHaveBeenCalledTimes(1);
    expect(onSetScreen).not.toHaveBeenCalled();
    expect(onLogout).not.toHaveBeenCalled();
  });

  it('does not throw when the right action is pressed on preview without onEditMetadata supplied', () => {
    renderHeader({
      screen: 'preview',
      shareOriginScreen: 'main',
      onLeaveUploadScreen: jest.fn(),
      onSetScreen: jest.fn(),
      onLogout: jest.fn(),
      title: 'Preview',
    });

    expect(() => headerPropsRef.current.onRightPress()).not.toThrow();
  });
});
