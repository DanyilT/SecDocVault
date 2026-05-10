/**
 * Extended tests for app/components/AppOverlays.tsx
 * Covers the upload discard warning overlay.
 */

import React from 'react';
import ReactTestRenderer, { act } from 'react-test-renderer';

import { AppOverlays } from '../../../src/app/components/AppOverlays';

const baseProps = {
  showUploadDiscardWarning: false,
  dontShowUploadDiscardWarningAgain: false,
  onToggleDontShowUploadDiscardWarningAgain: jest.fn(),
  onCloseUploadDiscardWarning: jest.fn(),
  onConfirmDiscardUploadDraft: jest.fn(async () => undefined),
};

beforeEach(() => jest.clearAllMocks());

/**
 * Find the first node that has an `onPress` prop AND whose subtree
 * contains a Text node with exactly the given label.
 */
function findButtonByLabel(
  renderer: ReactTestRenderer.ReactTestRenderer,
  label: string,
) {
  const allNodes = renderer.root.findAll(() => true);
  return allNodes.find(node => {
    if (typeof node.props.onPress !== 'function') return false;
    try {
      node.findByProps({ children: label });
      return true;
    } catch {
      return false;
    }
  });
}

describe('AppOverlays – upload discard warning', () => {
  test('shows discard warning modal when showUploadDiscardWarning is true', () => {
    let renderer: ReactTestRenderer.ReactTestRenderer;
    act(() => {
      renderer = ReactTestRenderer.create(
        <AppOverlays {...baseProps} showUploadDiscardWarning />,
      );
    });
    expect(renderer!.root.findByProps({ children: 'Discard this upload?' })).toBeTruthy();
  });

  test('calls onCloseUploadDiscardWarning when Keep Editing pressed', () => {
    const onClose = jest.fn();
    let renderer: ReactTestRenderer.ReactTestRenderer;
    act(() => {
      renderer = ReactTestRenderer.create(
        <AppOverlays {...baseProps} showUploadDiscardWarning onCloseUploadDiscardWarning={onClose} />,
      );
    });
    const btn = findButtonByLabel(renderer!, 'Keep Editing');
    expect(btn).toBeTruthy();
    act(() => btn!.props.onPress());
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  test('calls onConfirmDiscardUploadDraft when Discard is pressed', async () => {
    const onDiscard = jest.fn(async () => undefined);
    let renderer: ReactTestRenderer.ReactTestRenderer;
    act(() => {
      renderer = ReactTestRenderer.create(
        <AppOverlays {...baseProps} showUploadDiscardWarning onConfirmDiscardUploadDraft={onDiscard} />,
      );
    });
    const btn = findButtonByLabel(renderer!, 'Discard');
    expect(btn).toBeTruthy();
    await act(async () => { btn!.props.onPress(); });
    expect(onDiscard).toHaveBeenCalledTimes(1);
  });

  test('shows checkbox checked state when dontShowAgain is true', () => {
    let renderer: ReactTestRenderer.ReactTestRenderer;
    act(() => {
      renderer = ReactTestRenderer.create(
        <AppOverlays {...baseProps} showUploadDiscardWarning dontShowUploadDiscardWarningAgain />,
      );
    });
    expect(renderer!.root.findByProps({ children: 'OK' })).toBeTruthy();
  });
});
