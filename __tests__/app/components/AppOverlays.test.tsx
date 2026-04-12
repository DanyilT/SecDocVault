import React from 'react';
import TestRenderer, { act } from 'react-test-renderer';

import { AppOverlays } from '../../../src/app/components/AppOverlays';

function baseProps(overrides: Record<string, unknown> = {}) {
  return {
    showKeyBackupSetupModal: false,
    recoveryPassphraseForSettings: null,
    onCopyPassphrase: jest.fn(async () => undefined),
    onCancelKeyBackupSetup: jest.fn(),
    onConfirmKeyBackupSetup: jest.fn(async () => undefined),
    showUploadDiscardWarning: false,
    dontShowUploadDiscardWarningAgain: false,
    onToggleDontShowUploadDiscardWarningAgain: jest.fn(),
    onCloseUploadDiscardWarning: jest.fn(),
    onConfirmDiscardUploadDraft: jest.fn(async () => undefined),
    ...overrides,
  } as React.ComponentProps<typeof AppOverlays>;
}

describe('AppOverlays', () => {
  const toText = (value: unknown): string => {
    if (typeof value === 'string' || typeof value === 'number') {
      return String(value);
    }
    if (Array.isArray(value)) {
      return value.map(item => toText(item)).join('');
    }
    return '';
  };

  const findPressableByText = (root: TestRenderer.ReactTestInstance, label: string, exact = false) => {
    const labelNode = root.findAll(node => {
      const text = toText(node.props?.children);
      return exact ? text === label : text.includes(label);
    })[0];

    if (!labelNode) {
      throw new Error(`No label node found for: ${label}`);
    }

    let current: TestRenderer.ReactTestInstance | null = labelNode;
    while (current && typeof current.props?.onPress !== 'function') {
      current = current.parent;
    }

    if (!current) {
      throw new Error(`No pressable found for label: ${label}`);
    }

    return current;
  };

  it('copies passphrase when passphrase row is pressed in key-backup modal', async () => {
    const props = baseProps({
      showKeyBackupSetupModal: true,
      recoveryPassphraseForSettings: 'alpha beta gamma',
    });

    let renderer: TestRenderer.ReactTestRenderer;
    await act(async () => {
      renderer = TestRenderer.create(<AppOverlays {...props} />);
    });

    const copyPressable = findPressableByText(renderer!.root, 'Passphrase: alpha beta gamma');

    await act(async () => {
      copyPressable.props.onPress();
    });

    expect(props.onCopyPassphrase).toHaveBeenCalledWith('alpha beta gamma');
  });

  it('calls discard-warning callbacks from overlay actions', async () => {
    const props = baseProps({
      showUploadDiscardWarning: true,
      dontShowUploadDiscardWarningAgain: false,
    });

    let renderer: TestRenderer.ReactTestRenderer;
    await act(async () => {
      renderer = TestRenderer.create(<AppOverlays {...props} />);
    });

    const discardPressable = findPressableByText(renderer!.root, 'Discard', true);
    const keepEditingPressable = findPressableByText(renderer!.root, 'Keep Editing', true);
    const togglePressable = findPressableByText(renderer!.root, 'Do not show this again', true);

    await act(async () => {
      togglePressable.props.onPress();
      keepEditingPressable.props.onPress();
      discardPressable.props.onPress();
    });

    expect(props.onToggleDontShowUploadDiscardWarningAgain).toHaveBeenCalledTimes(1);
    expect(props.onCloseUploadDiscardWarning).toHaveBeenCalledTimes(1);
    expect(props.onConfirmDiscardUploadDraft).toHaveBeenCalledTimes(1);
  });
});
