import React from 'react';
import TestRenderer, { act } from 'react-test-renderer';

const mockAppController = jest.fn();
const headerPropsRef: {current: any} = {current: null};
const routerPropsRef: {current: any} = {current: null};
const overlaysPropsRef: {current: any} = {current: null};

jest.mock('../../../src/app/controllers', () => ({
  useAppController: () => mockAppController(),
}));

jest.mock('../../../src/app/components/AppHeaderController', () => ({
  AppHeaderController: (props: any) => {
    headerPropsRef.current = props;
    return null;
  },
}));

jest.mock('../../../src/app/components/AppScreenRouter', () => ({
  AppScreenRouter: (props: any) => {
    routerPropsRef.current = props;
    return null;
  },
}));

jest.mock('../../../src/app/components/AppOverlays', () => ({
  AppOverlays: (props: any) => {
    overlaysPropsRef.current = props;
    return null;
  },
}));

import { AppShell } from '../../../src/app/components/AppShell';

describe('AppShell', () => {
  beforeEach(() => {
    mockAppController.mockReset();
    mockAppController.mockReturnValue({
      showVaultShell: true,
      appScreenRouterProps: {screen: 'main'},
      headerControllerProps: {screen: 'main', title: 'Vault'},
      overlaysProps: {showUploadDiscardWarning: false},
    });
    headerPropsRef.current = null;
    routerPropsRef.current = null;
    overlaysPropsRef.current = null;
  });

  it('renders the header only when the vault shell is visible', () => {
    let renderer: TestRenderer.ReactTestRenderer;
    act(() => {
      renderer = TestRenderer.create(<AppShell />);
    });

    expect(headerPropsRef.current).toEqual(expect.objectContaining({screen: 'main'}));
    expect(routerPropsRef.current).toEqual(expect.objectContaining({screen: 'main'}));
    expect(overlaysPropsRef.current).toEqual(expect.objectContaining({showUploadDiscardWarning: false}));

    mockAppController.mockReturnValueOnce({
      showVaultShell: false,
      appScreenRouterProps: {screen: 'main'},
      headerControllerProps: {screen: 'settings', title: 'Settings'},
      overlaysProps: {showUploadDiscardWarning: true},
    });

    headerPropsRef.current = null;

    act(() => {
      renderer!.update(<AppShell />);
    });

    expect(headerPropsRef.current).toBeNull();
    expect(routerPropsRef.current).toEqual(expect.objectContaining({screen: 'main'}));
    expect(overlaysPropsRef.current).toEqual(expect.objectContaining({showUploadDiscardWarning: true}));
  });
});
