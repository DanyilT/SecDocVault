/**
 * Tests for components/ui.tsx — Header, PrimaryButton, SecondaryButton, SegmentButton
 */

import React from 'react';
import ReactTestRenderer, { act } from 'react-test-renderer';

import { Header, PrimaryButton, SecondaryButton, SegmentButton } from '../../../src/components/ui';

describe('PrimaryButton', () => {
  test('renders with label text', () => {
    let renderer: ReactTestRenderer.ReactTestRenderer;
    act(() => {
      renderer = ReactTestRenderer.create(
        <PrimaryButton label="Click Me" onPress={jest.fn()} />,
      );
    });
    expect(renderer!.root.findByProps({ children: 'Click Me' })).toBeTruthy();
  });

  test('calls onPress when pressed', () => {
    const onPress = jest.fn();
    let renderer: ReactTestRenderer.ReactTestRenderer;
    act(() => {
      renderer = ReactTestRenderer.create(
        <PrimaryButton label="Press" onPress={onPress} />,
      );
    });
    const pressable = renderer!.root.findByProps({ onPress });
    act(() => pressable.props.onPress());
    expect(onPress).toHaveBeenCalledTimes(1);
  });

  test('is disabled when disabled prop is true', () => {
    let renderer: ReactTestRenderer.ReactTestRenderer;
    act(() => {
      renderer = ReactTestRenderer.create(
        <PrimaryButton label="Disabled" onPress={jest.fn()} disabled />,
      );
    });
    const pressable = renderer!.root.findByProps({ disabled: true });
    expect(pressable).toBeTruthy();
  });

  test('renders danger variant', () => {
    let renderer: ReactTestRenderer.ReactTestRenderer;
    act(() => {
      renderer = ReactTestRenderer.create(
        <PrimaryButton label="Delete" onPress={jest.fn()} variant="danger" />,
      );
    });
    expect(renderer!.root.findByProps({ children: 'Delete' })).toBeTruthy();
  });

  test('renders outline variant', () => {
    let renderer: ReactTestRenderer.ReactTestRenderer;
    act(() => {
      renderer = ReactTestRenderer.create(
        <PrimaryButton label="Outline" onPress={jest.fn()} variant="outline" />,
      );
    });
    expect(renderer!.root.findByProps({ children: 'Outline' })).toBeTruthy();
  });
});

describe('SecondaryButton', () => {
  test('renders with label text', () => {
    let renderer: ReactTestRenderer.ReactTestRenderer;
    act(() => {
      renderer = ReactTestRenderer.create(
        <SecondaryButton label="Cancel" onPress={jest.fn()} />,
      );
    });
    expect(renderer!.root.findByProps({ children: 'Cancel' })).toBeTruthy();
  });

  test('calls onPress when pressed', () => {
    const onPress = jest.fn();
    let renderer: ReactTestRenderer.ReactTestRenderer;
    act(() => {
      renderer = ReactTestRenderer.create(
        <SecondaryButton label="Cancel" onPress={onPress} />,
      );
    });
    const pressable = renderer!.root.findByProps({ onPress });
    act(() => pressable.props.onPress());
    expect(onPress).toHaveBeenCalledTimes(1);
  });
});

describe('SegmentButton', () => {
  test('renders label', () => {
    let renderer: ReactTestRenderer.ReactTestRenderer;
    act(() => {
      renderer = ReactTestRenderer.create(
        <SegmentButton label="Tab 1" isActive={false} onPress={jest.fn()} />,
      );
    });
    expect(renderer!.root.findByProps({ children: 'Tab 1' })).toBeTruthy();
  });

  test('calls onPress when pressed', () => {
    const onPress = jest.fn();
    let renderer: ReactTestRenderer.ReactTestRenderer;
    act(() => {
      renderer = ReactTestRenderer.create(
        <SegmentButton label="Tab" isActive={true} onPress={onPress} />,
      );
    });
    const pressable = renderer!.root.findByProps({ onPress });
    act(() => pressable.props.onPress());
    expect(onPress).toHaveBeenCalledTimes(1);
  });
});

describe('Header', () => {
  test('renders title', () => {
    let renderer: ReactTestRenderer.ReactTestRenderer;
    act(() => {
      renderer = ReactTestRenderer.create(
        <Header title="My Screen" />,
      );
    });
    expect(renderer!.root.findByProps({ children: 'My Screen' })).toBeTruthy();
  });

  test('renders back button as non-disabled when showBack=true', () => {
    let renderer: ReactTestRenderer.ReactTestRenderer;
    act(() => {
      renderer = ReactTestRenderer.create(
        <Header title="Screen" showBack onBack={jest.fn()} />,
      );
    });
    expect(renderer!.root.findByProps({ children: 'Back' })).toBeTruthy();
  });

  test('calls onBack when back is pressed', () => {
    const onBack = jest.fn();
    let renderer: ReactTestRenderer.ReactTestRenderer;
    act(() => {
      renderer = ReactTestRenderer.create(
        <Header title="Screen" showBack onBack={onBack} />,
      );
    });
    const backPressable = renderer!.root.findByProps({ onPress: onBack });
    act(() => backPressable.props.onPress());
    expect(onBack).toHaveBeenCalledTimes(1);
  });

  test('renders right label when rightLabel and onRightPress provided', () => {
    const onRightPress = jest.fn();
    let renderer: ReactTestRenderer.ReactTestRenderer;
    act(() => {
      renderer = ReactTestRenderer.create(
        <Header title="Screen" rightLabel="Edit" onRightPress={onRightPress} />,
      );
    });
    expect(renderer!.root.findByProps({ children: 'Edit' })).toBeTruthy();
  });

  test('calls onRightPress when right action pressed', () => {
    const onRightPress = jest.fn();
    let renderer: ReactTestRenderer.ReactTestRenderer;
    act(() => {
      renderer = ReactTestRenderer.create(
        <Header title="Screen" rightLabel="Edit" onRightPress={onRightPress} />,
      );
    });
    const rightPressable = renderer!.root.findByProps({ onPress: onRightPress });
    act(() => rightPressable.props.onPress());
    expect(onRightPress).toHaveBeenCalledTimes(1);
  });
});

