import React from 'react';
import ReactTestRenderer, { act } from 'react-test-renderer';
import { AuthScreen } from '../../../src/screens/AuthScreen';
import { TextInput } from 'react-native';

jest.mock('react-native-heroicons/solid', () => ({
  CheckCircleIcon: () => null,
  ClipboardIcon: () => null,
  CursorArrowRaysIcon: () => null,
  EnvelopeIcon: () => null,
  EyeIcon: () => null,
  EyeSlashIcon: () => null,
  ArrowPathRoundedSquareIcon: () => null,
}));

jest.mock('../../../src/components/ui', () => {
  const React = require('react');
  return {
    Header: (props: any) => React.createElement('Header', props),
    PrimaryButton: (props: any) => React.createElement('PrimaryButton', props),
    SegmentButton: (props: any) => React.createElement('SegmentButton', props),
  };
});

jest.mock('../../../src/components/GuestLoginNotice.tsx', () => ({
  GuestLoginNotice: () => null,
}));

describe('AuthScreen', () => {
  const defaultProps = {
    authMode: 'login' as const,
    email: '',
    password: '',
    confirmPassword: '',
    vaultPassphrase: '',
    canSubmitAuth: true,
    isSubmitting: false,
    authError: null,
    authNotice: null,
    emailVerifiedForRegistration: false,
    verificationCooldown: 0,
    verificationLinkInput: '',
    accessMode: 'login' as const,
    setAccessMode: jest.fn(),
    setAuthMode: jest.fn(),
    setEmail: jest.fn(),
    setPassword: jest.fn(),
    setConfirmPassword: jest.fn(),
    setVaultPassphrase: jest.fn(),
    setVerificationLinkInput: jest.fn(),
    onResendVerificationEmail: jest.fn(async () => {}),
    onVerifyEmailLinkManually: jest.fn(),
    onResetPassword: jest.fn(),
    handleAuth: jest.fn(async () => {}),
    onBackToHero: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders login screen correctly', () => {
    let renderer: ReactTestRenderer.ReactTestRenderer;
    act(() => {
      renderer = ReactTestRenderer.create(<AuthScreen {...defaultProps} />);
    });
    const inputs = renderer!.root.findAllByType(TextInput);
    expect(inputs.length).toBeGreaterThanOrEqual(1);
    expect(renderer!.root.findByProps({ label: 'Sign In' })).toBeTruthy();
  });

  it('renders register screen correctly', () => {
    const props = { ...defaultProps, authMode: 'register' as const };
    let renderer: ReactTestRenderer.ReactTestRenderer;
    act(() => {
      renderer = ReactTestRenderer.create(<AuthScreen {...props} />);
    });
    expect(renderer!.root.findByProps({ label: 'Create Account' })).toBeTruthy();
  });

  it('calls setEmail when email input changes', () => {
    let renderer: ReactTestRenderer.ReactTestRenderer;
    act(() => {
      renderer = ReactTestRenderer.create(<AuthScreen {...defaultProps} />);
    });
    const emailInput = renderer!.root.findAllByType(TextInput)[0];
    act(() => {
      emailInput.props.onChangeText('test@example.com');
    });
    expect(defaultProps.setEmail).toHaveBeenCalledWith('test@example.com');
  });

  it('toggles access mode between login and guest', () => {
    let renderer: ReactTestRenderer.ReactTestRenderer;
    act(() => {
      renderer = ReactTestRenderer.create(<AuthScreen {...defaultProps} />);
    });
    const guestButton = renderer!.root.findByProps({ label: 'Login as Guest' });
    act(() => {
      guestButton.props.onPress();
    });
    expect(defaultProps.setAccessMode).toHaveBeenCalledWith('guest');
  });

  it('displays auth error when provided', () => {
    const props = { ...defaultProps, authError: 'Invalid credentials' };
    let renderer: ReactTestRenderer.ReactTestRenderer;
    act(() => {
      renderer = ReactTestRenderer.create(<AuthScreen {...props} />);
    });
    expect(renderer!.root.findByProps({ children: 'Invalid credentials' })).toBeTruthy();
  });

  it('calls handleAuth when primary button is pressed', async () => {
    let renderer: ReactTestRenderer.ReactTestRenderer;
    act(() => {
      renderer = ReactTestRenderer.create(<AuthScreen {...defaultProps} />);
    });
    const submitButton = renderer!.root.findByProps({ label: 'Sign In' });
    await act(async () => {
      submitButton.props.onPress();
    });
    expect(defaultProps.handleAuth).toHaveBeenCalled();
  });

  it('shows password warning during registration', () => {
    const props = { ...defaultProps, authMode: 'register' as const, password: 'short' };
    let renderer: ReactTestRenderer.ReactTestRenderer;
    act(() => {
      renderer = ReactTestRenderer.create(<AuthScreen {...props} />);
    });
    const warningText = renderer!.root.findAll(el => 
      typeof el.props.children === 'string' && el.props.children.includes('Password needs')
    );
    expect(warningText.length).toBeGreaterThan(0);
  });

  it('calls onResendVerificationEmail when clicking envelope icon', () => {
    const props = {
      ...defaultProps,
      authMode: 'register' as const,
      accessMode: 'login' as const,
      email: 'test@test.com',
      emailVerifiedForRegistration: false,
    };
    let renderer: ReactTestRenderer.ReactTestRenderer;
    act(() => {
      renderer = ReactTestRenderer.create(<AuthScreen {...props} />);
    });
    // Find the Pressable by testID
    const resendButton = renderer!.root.findByProps({ testID: 'resend-verification-btn' });
    
    act(() => {
      resendButton.props.onPress();
    });
    expect(defaultProps.onResendVerificationEmail).toHaveBeenCalled();
  });
});
