/**
 * Tests for screens/IntroHeroScreen.tsx
 */

import React from 'react';
import ReactTestRenderer, { act } from 'react-test-renderer';

import { IntroHeroScreen } from '../../../src/screens/IntroHeroScreen';

describe('IntroHeroScreen', () => {
  test('renders without crashing', () => {
    let renderer: ReactTestRenderer.ReactTestRenderer;
    act(() => {
      renderer = ReactTestRenderer.create(
        <IntroHeroScreen onLogin={jest.fn()} onGuest={jest.fn()} />,
      );
    });
    expect(renderer!.toJSON()).toBeTruthy();
  });

  test('renders SecDocVault brand name', () => {
    let renderer: ReactTestRenderer.ReactTestRenderer;
    act(() => {
      renderer = ReactTestRenderer.create(
        <IntroHeroScreen onLogin={jest.fn()} onGuest={jest.fn()} />,
      );
    });
    expect(renderer!.root.findByProps({ children: 'SecDocVault' })).toBeTruthy();
  });

  test('renders Login and Guest buttons', () => {
    let renderer: ReactTestRenderer.ReactTestRenderer;
    act(() => {
      renderer = ReactTestRenderer.create(
        <IntroHeroScreen onLogin={jest.fn()} onGuest={jest.fn()} />,
      );
    });
    expect(renderer!.root.findByProps({ children: 'Login' })).toBeTruthy();
    expect(renderer!.root.findByProps({ children: 'Guest' })).toBeTruthy();
  });

  test('calls onLogin when Login is pressed', () => {
    const onLogin = jest.fn();
    let renderer: ReactTestRenderer.ReactTestRenderer;
    act(() => {
      renderer = ReactTestRenderer.create(
        <IntroHeroScreen onLogin={onLogin} onGuest={jest.fn()} />,
      );
    });
    const loginBtn = renderer!.root.findByProps({ label: 'Login' });
    act(() => loginBtn.props.onPress());
    expect(onLogin).toHaveBeenCalledTimes(1);
  });

  test('calls onGuest when Guest is pressed', () => {
    const onGuest = jest.fn();
    let renderer: ReactTestRenderer.ReactTestRenderer;
    act(() => {
      renderer = ReactTestRenderer.create(
        <IntroHeroScreen onLogin={jest.fn()} onGuest={onGuest} />,
      );
    });
    const guestBtn = renderer!.root.findByProps({ label: 'Guest' });
    act(() => guestBtn.props.onPress());
    expect(onGuest).toHaveBeenCalledTimes(1);
  });
});

