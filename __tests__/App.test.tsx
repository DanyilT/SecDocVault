import React from 'react';
import TestRenderer, { act } from 'react-test-renderer';

const appShellPropsRef: {current: any} = {current: null};
const statusBarPropsRef: {current: any} = {current: null};

jest.mock('react-native', () => {
  return {
    useColorScheme: jest.fn(),
    StatusBar: (props: any) => {
      statusBarPropsRef.current = props;
      return null;
    },
  };
});

jest.mock('react-native-safe-area-context', () => {
  const React = require('react');
  return {
    SafeAreaProvider: ({children}: any) => React.createElement(React.Fragment, null, children),
  };
});

jest.mock('react-native-gesture-handler', () => {
  const React = require('react');
  return {
    GestureHandlerRootView: ({children}: any) => React.createElement(React.Fragment, null, children),
  };
});

jest.mock('../src/context/AuthContext', () => ({
  AuthProvider: ({children}: any) => children,
}));
jest.mock('../src/context/VaultLockContext', () => ({
  VaultLockProvider: ({children}: any) => children,
}));
jest.mock('../src/context/DocumentVaultContext', () => ({
  DocumentVaultProvider: ({children}: any) => children,
}));

jest.mock('../src/app/components/AppShell', () => ({
  AppShell: () => {
    appShellPropsRef.current = {};
    return null;
  },
}));

import { useColorScheme } from 'react-native';
import App from '../App';

describe('App', () => {
  beforeEach(() => {
    appShellPropsRef.current = null;
    statusBarPropsRef.current = null;
    jest.mocked(useColorScheme).mockReset();
  });

  it('uses dark status bar styling in dark mode', () => {
    jest.mocked(useColorScheme).mockReturnValue('dark');

    act(() => {
      TestRenderer.create(<App />);
    });

    expect(statusBarPropsRef.current.barStyle).toBe('light-content');
    expect(appShellPropsRef.current).toEqual({});
  });

  it('uses light status bar styling in light mode', () => {
    jest.mocked(useColorScheme).mockReturnValue('light');

    act(() => {
      TestRenderer.create(<App />);
    });

    expect(statusBarPropsRef.current.barStyle).toBe('dark-content');
  });
});
