/**
 * Tests for components/GuestLoginNotice.tsx
 */

import React from 'react';
import ReactTestRenderer, { act } from 'react-test-renderer';

import { GuestLoginNotice } from '../../../src/components/GuestLoginNotice';

describe('GuestLoginNotice', () => {
  test('renders without crashing', () => {
    let renderer: ReactTestRenderer.ReactTestRenderer;
    act(() => {
      renderer = ReactTestRenderer.create(<GuestLoginNotice />);
    });
    expect(renderer!.toJSON()).toBeTruthy();
  });

  test('contains guest login notice text', () => {
    let renderer: ReactTestRenderer.ReactTestRenderer;
    act(() => {
      renderer = ReactTestRenderer.create(<GuestLoginNotice />);
    });
    const json = JSON.stringify(renderer!.toJSON());
    expect(json).toContain('Guest login is anonymous');
  });

  test('contains server storage disclaimer text', () => {
    let renderer: ReactTestRenderer.ReactTestRenderer;
    act(() => {
      renderer = ReactTestRenderer.create(<GuestLoginNotice />);
    });
    const json = JSON.stringify(renderer!.toJSON());
    expect(json).toContain('Nothing are gonna be stored on our servers');
  });
});

