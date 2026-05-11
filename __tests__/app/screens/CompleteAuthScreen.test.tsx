import React from 'react';
import { TextInput } from 'react-native';
import ReactTestRenderer, { act } from 'react-test-renderer';

import { CompleteAuthScreen } from '../../../src/screens';

jest.mock('react-native-keychain', () => ({
  getSupportedBiometryType: jest.fn(),
}));

describe('CompleteAuthScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    const Keychain = require('react-native-keychain');
    Keychain.getSupportedBiometryType.mockResolvedValue('FaceID');
  });

  test('renders and submits PIN payload when valid', async () => {
    const onComplete = jest.fn(async () => undefined);
    let renderer: ReactTestRenderer.ReactTestRenderer;

    await act(async () => {
      renderer = ReactTestRenderer.create(
        <CompleteAuthScreen isSubmitting={false} authError={null} onComplete={onComplete} />,
      );
    });

    const inputs = renderer!.root.findAllByType(TextInput);
    await act(async () => {
      inputs[0].props.onChangeText('12ab34');
      inputs[1].props.onChangeText('1234');
    });

    const biometricSwitch = renderer!.root.findAll(
      node => typeof node.props?.onValueChange === 'function' && node.props?.value === false,
    )[0];
    await act(async () => {
      biometricSwitch.props.onValueChange(true);
    });

    const btn = renderer!.root.findByProps({ label: 'Complete Setup' });
    await act(async () => {
      btn.props.onPress();
    });

    expect(onComplete).toHaveBeenCalledWith({
      method: 'pin',
      pin: '1234',
      useBiometricForPin: true,
    });
  });

  test('shows pin mismatch error and disables completion', async () => {
    let renderer: ReactTestRenderer.ReactTestRenderer;

    await act(async () => {
      renderer = ReactTestRenderer.create(
        <CompleteAuthScreen isSubmitting={false} authError={null} onComplete={jest.fn(async () => undefined)} />,
      );
    });

    const inputs = renderer!.root.findAllByType(TextInput);
    await act(async () => {
      inputs[0].props.onChangeText('1234');
      inputs[1].props.onChangeText('9999');
    });

    expect(renderer!.root.findByProps({ children: 'PIN entries do not match.' })).toBeTruthy();
    expect(renderer!.root.findByProps({ label: 'Complete Setup' }).props.disabled).toBe(true);
  });

  test('handles passkey and none modes and biometric unavailable branch', async () => {
    const Keychain = require('react-native-keychain');
    Keychain.getSupportedBiometryType.mockResolvedValueOnce(null);
    const onComplete = jest.fn(async () => undefined);
    let renderer: ReactTestRenderer.ReactTestRenderer;

    await act(async () => {
      renderer = ReactTestRenderer.create(
        <CompleteAuthScreen isSubmitting={false} authError={'Oops'} onComplete={onComplete} />,
      );
    });

    expect(renderer!.root.findByProps({ children: 'Oops' })).toBeTruthy();
    expect(
      renderer!.root.findAll(node => typeof node.props?.onValueChange === 'function'),
    ).toHaveLength(0);

    const passkeySegment = renderer!.root.findByProps({ label: 'Passkey' });
    await act(async () => {
      passkeySegment.props.onPress();
    });

    await act(async () => {
      renderer!.root.findByProps({ label: 'Complete Setup' }).props.onPress();
    });
    expect(onComplete).toHaveBeenLastCalledWith({
      method: 'passkey',
      pin: undefined,
      useBiometricForPin: false,
    });

    const noneSegment = renderer!.root.findByProps({ label: 'None' });
    await act(async () => {
      noneSegment.props.onPress();
    });
    await act(async () => {
      renderer!.root.findByProps({ label: 'Complete Setup' }).props.onPress();
    });

    expect(onComplete).toHaveBeenLastCalledWith({
      method: 'none',
      pin: undefined,
      useBiometricForPin: false,
    });
  });

  test('handles keychain error when biometry query fails', async () => {
    const Keychain = require('react-native-keychain');
    Keychain.getSupportedBiometryType.mockRejectedValueOnce(new Error('native fail'));

    let renderer: ReactTestRenderer.ReactTestRenderer;
    await act(async () => {
      renderer = ReactTestRenderer.create(
        <CompleteAuthScreen isSubmitting={false} authError={null} onComplete={jest.fn(async () => undefined)} />,
      );
    });

    expect(
      renderer!.root.findAll(node => typeof node.props?.onValueChange === 'function'),
    ).toHaveLength(0);
  });
});
