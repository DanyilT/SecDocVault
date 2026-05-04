/**
 * Tests for components/CensorToggle.tsx
 */

import React from 'react';
import ReactTestRenderer, { act } from 'react-test-renderer';

jest.mock('react-native-heroicons/solid', () => ({
  EyeIcon: () => null,
  EyeSlashIcon: () => null,
}));

import { CensorToggle } from '../../../src/components/CensorToggle';

describe('CensorToggle', () => {
  test('renders OFF label when value is false', () => {
    let renderer: ReactTestRenderer.ReactTestRenderer;
    act(() => {
      renderer = ReactTestRenderer.create(
        <CensorToggle value={false} onChange={jest.fn()} />,
      );
    });
    expect(renderer!.root.findByProps({ children: 'Censor: Off' })).toBeTruthy();
  });

  test('renders ON label when value is true', () => {
    let renderer: ReactTestRenderer.ReactTestRenderer;
    act(() => {
      renderer = ReactTestRenderer.create(
        <CensorToggle value={true} onChange={jest.fn()} />,
      );
    });
    expect(renderer!.root.findByProps({ children: 'Censor: On' })).toBeTruthy();
  });

  test('renders scanning label when loading is true', () => {
    let renderer: ReactTestRenderer.ReactTestRenderer;
    act(() => {
      renderer = ReactTestRenderer.create(
        <CensorToggle value={false} loading onChange={jest.fn()} />,
      );
    });
    expect(renderer!.root.findByProps({ children: 'scanning…' })).toBeTruthy();
  });

  test('calls onChange with toggled value when pressed', () => {
    const onChange = jest.fn();
    let renderer: ReactTestRenderer.ReactTestRenderer;
    act(() => {
      renderer = ReactTestRenderer.create(
        <CensorToggle value={false} onChange={onChange} />,
      );
    });
    const pressable = renderer!.root.findByProps({
      accessibilityRole: 'switch',
    });
    act(() => pressable.props.onPress());
    expect(onChange).toHaveBeenCalledWith(true);
  });

  test('calls onChange with false when toggling from true', () => {
    const onChange = jest.fn();
    let renderer: ReactTestRenderer.ReactTestRenderer;
    act(() => {
      renderer = ReactTestRenderer.create(
        <CensorToggle value={true} onChange={onChange} />,
      );
    });
    const pressable = renderer!.root.findByProps({ accessibilityRole: 'switch' });
    act(() => pressable.props.onPress());
    expect(onChange).toHaveBeenCalledWith(false);
  });

  test('is disabled when disabled prop is true', () => {
    let renderer: ReactTestRenderer.ReactTestRenderer;
    act(() => {
      renderer = ReactTestRenderer.create(
        <CensorToggle value={false} disabled onChange={jest.fn()} />,
      );
    });
    const pressable = renderer!.root.findByProps({ accessibilityRole: 'switch' });
    expect(pressable.props.disabled).toBe(true);
  });

  test('is disabled when loading is true', () => {
    let renderer: ReactTestRenderer.ReactTestRenderer;
    act(() => {
      renderer = ReactTestRenderer.create(
        <CensorToggle value={false} loading onChange={jest.fn()} />,
      );
    });
    const pressable = renderer!.root.findByProps({ accessibilityRole: 'switch' });
    expect(pressable.props.disabled).toBe(true);
  });

  test('has correct accessibility state when checked', () => {
    let renderer: ReactTestRenderer.ReactTestRenderer;
    act(() => {
      renderer = ReactTestRenderer.create(
        <CensorToggle value={true} onChange={jest.fn()} />,
      );
    });
    const pressable = renderer!.root.findByProps({ accessibilityRole: 'switch' });
    expect(pressable.props.accessibilityState.checked).toBe(true);
  });
});

