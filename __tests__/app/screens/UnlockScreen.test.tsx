/**
 * Tests for screens/UnlockScreen.tsx
 */

import React from 'react';
import ReactTestRenderer, { act } from 'react-test-renderer';

jest.mock('react-native-heroicons/solid', () => ({
  FaceSmileIcon: () => null,
  FingerPrintIcon: () => null,
  LockClosedIcon: () => null,
  LockOpenIcon: () => null,
}));

import { UnlockScreen } from '../../../src/screens/UnlockScreen';

const baseProps = {
  preferredProtection: 'passkey' as const,
  pinBiometricEnabled: false,
  canUnlock: true,
  isSubmitting: false,
  authError: null as string | null,
  onUnlock: jest.fn(async () => undefined),
  onUnlockWithPin: jest.fn(async () => undefined),
  onGoToAuth: jest.fn(),
};

beforeEach(() => {
  jest.clearAllMocks();
  jest.useFakeTimers();
});

afterEach(() => {
  jest.useRealTimers();
});

function findButtonByLabel(
  renderer: ReactTestRenderer.ReactTestRenderer,
  label: string,
) {
  return renderer.root.findAll(() => true).find(node => {
    if (typeof node.props.onPress !== 'function') return false;
    try {
      node.findByProps({ children: label });
      return true;
    } catch {
      return false;
    }
  });
}

describe('UnlockScreen', () => {
  test('renders without crashing', () => {
    let renderer: ReactTestRenderer.ReactTestRenderer;
    act(() => {
      renderer = ReactTestRenderer.create(<UnlockScreen {...baseProps} />);
    });
    expect(renderer!.toJSON()).toBeTruthy();
  });

  test('renders Unlock Vault title', () => {
    let renderer: ReactTestRenderer.ReactTestRenderer;
    act(() => {
      renderer = ReactTestRenderer.create(<UnlockScreen {...baseProps} />);
    });
    expect(renderer!.root.findByProps({ children: 'Unlock Vault' })).toBeTruthy();
  });

  test('shows Unlock with Passkey button text for passkey protection', () => {
    let renderer: ReactTestRenderer.ReactTestRenderer;
    act(() => {
      renderer = ReactTestRenderer.create(<UnlockScreen {...baseProps} />);
    });
    expect(JSON.stringify(renderer!.toJSON())).toContain('Unlock with Passkey');
  });

  test('shows PIN input when preferredProtection is pin', () => {
    let renderer: ReactTestRenderer.ReactTestRenderer;
    act(() => {
      renderer = ReactTestRenderer.create(
        <UnlockScreen {...baseProps} preferredProtection="pin" />,
      );
    });
    expect(renderer!.root.findByProps({ placeholder: 'Enter PIN' })).toBeTruthy();
  });

  test('shows error text when authError is set', () => {
    let renderer: ReactTestRenderer.ReactTestRenderer;
    act(() => {
      renderer = ReactTestRenderer.create(
        <UnlockScreen {...baseProps} authError="Invalid credentials" />,
      );
    });
    expect(renderer!.root.findByProps({ children: 'Invalid credentials' })).toBeTruthy();
  });

  test('shows Please wait... when submitting', () => {
    let renderer: ReactTestRenderer.ReactTestRenderer;
    act(() => {
      renderer = ReactTestRenderer.create(
        <UnlockScreen {...baseProps} isSubmitting />,
      );
    });
    expect(JSON.stringify(renderer!.toJSON())).toContain('Please wait...');
  });

  test('calls onGoToAuth when Use Login / Register pressed', () => {
    const onGoToAuth = jest.fn();
    let renderer: ReactTestRenderer.ReactTestRenderer;
    act(() => {
      renderer = ReactTestRenderer.create(
        <UnlockScreen {...baseProps} onGoToAuth={onGoToAuth} />,
      );
    });
    const btn = findButtonByLabel(renderer!, 'Use Login / Register');
    expect(btn).toBeTruthy();
    act(() => btn!.props.onPress());
    expect(onGoToAuth).toHaveBeenCalledTimes(1);
  });
});
