/**
 * Tests for screens/KeyRecoveryScreen.tsx
 */

import React from 'react';
import ReactTestRenderer, { act } from 'react-test-renderer';

import { KeyRecoveryScreen } from '../../../src/screens/KeyRecoveryScreen';

const baseProps = {
  isGuest: false,
  isSubmitting: false,
  status: '',
  onRestoreKeys: jest.fn(async () => undefined),
};

beforeEach(() => jest.clearAllMocks());

describe('KeyRecoveryScreen', () => {
  test('renders without crashing', () => {
    let renderer: ReactTestRenderer.ReactTestRenderer;
    act(() => {
      renderer = ReactTestRenderer.create(<KeyRecoveryScreen {...baseProps} />);
    });
    expect(renderer!.toJSON()).toBeTruthy();
  });

  test('renders passphrase input', () => {
    let renderer: ReactTestRenderer.ReactTestRenderer;
    act(() => {
      renderer = ReactTestRenderer.create(<KeyRecoveryScreen {...baseProps} />);
    });
    expect(renderer!.root.findByProps({ placeholder: 'Recovery passphrase' })).toBeTruthy();
  });

  test('shows Confirm Key Recovery button text when not submitting', () => {
    let renderer: ReactTestRenderer.ReactTestRenderer;
    act(() => {
      renderer = ReactTestRenderer.create(<KeyRecoveryScreen {...baseProps} />);
    });
    expect(renderer!.root.findByProps({ label: 'Confirm Key Recovery' })).toBeTruthy();
  });

  test('shows Recovering... when isSubmitting is true', () => {
    let renderer: ReactTestRenderer.ReactTestRenderer;
    act(() => {
      renderer = ReactTestRenderer.create(
        <KeyRecoveryScreen {...baseProps} isSubmitting />,
      );
    });
    expect(renderer!.root.findByProps({ label: 'Recovering...' })).toBeTruthy();
  });

  test('button is disabled when passphrase is too short', () => {
    let renderer: ReactTestRenderer.ReactTestRenderer;
    act(() => {
      renderer = ReactTestRenderer.create(<KeyRecoveryScreen {...baseProps} />);
    });
    const btn = renderer!.root.findByProps({ label: 'Confirm Key Recovery' });
    expect(btn.props.disabled).toBe(true);
  });

  test('button is enabled when passphrase >= 6 chars', async () => {
    let renderer: ReactTestRenderer.ReactTestRenderer;
    act(() => {
      renderer = ReactTestRenderer.create(<KeyRecoveryScreen {...baseProps} />);
    });
    const input = renderer!.root.findByProps({ placeholder: 'Recovery passphrase' });
    await act(async () => { input.props.onChangeText('secure-passphrase'); });
    const btn = renderer!.root.findByProps({ label: 'Confirm Key Recovery' });
    expect(btn.props.disabled).toBe(false);
  });

  test('calls onRestoreKeys with trimmed passphrase when pressed', async () => {
    const onRestore = jest.fn(async () => undefined);
    let renderer: ReactTestRenderer.ReactTestRenderer;
    act(() => {
      renderer = ReactTestRenderer.create(
        <KeyRecoveryScreen {...baseProps} onRestoreKeys={onRestore} />,
      );
    });
    const input = renderer!.root.findByProps({ placeholder: 'Recovery passphrase' });
    await act(async () => { input.props.onChangeText('  my-passphrase  '); });
    const btn = renderer!.root.findByProps({ label: 'Confirm Key Recovery' });
    await act(async () => { btn.props.onPress(); });
    expect(onRestore).toHaveBeenCalledWith('my-passphrase');
  });

  test('displays status text when status prop provided', () => {
    let renderer: ReactTestRenderer.ReactTestRenderer;
    act(() => {
      renderer = ReactTestRenderer.create(
        <KeyRecoveryScreen {...baseProps} status="Keys restored successfully." />,
      );
    });
    expect(renderer!.root.findByProps({ children: 'Keys restored successfully.' })).toBeTruthy();
  });

  test('button is disabled when isGuest is true', async () => {
    let renderer: ReactTestRenderer.ReactTestRenderer;
    act(() => {
      renderer = ReactTestRenderer.create(
        <KeyRecoveryScreen {...baseProps} isGuest />,
      );
    });
    const input = renderer!.root.findByProps({ placeholder: 'Recovery passphrase' });
    await act(async () => { input.props.onChangeText('valid-passphrase'); });
    const btn = renderer!.root.findByProps({ label: 'Confirm Key Recovery' });
    expect(btn.props.disabled).toBe(true);
  });
});

