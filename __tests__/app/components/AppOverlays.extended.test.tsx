/**
 * Extended tests for app/components/AppOverlays.tsx
 * Covers the vault passphrase prompt and upload discard warning overlays.
 */

import React from 'react';
import ReactTestRenderer, { act } from 'react-test-renderer';

import { AppOverlays } from '../../../src/app/components/AppOverlays';

const baseProps = {
  showKeyBackupSetupModal: false,
  onCancelKeyBackupSetup: jest.fn(),
  onConfirmKeyBackupSetup: jest.fn(async () => undefined),
  showUploadDiscardWarning: false,
  dontShowUploadDiscardWarningAgain: false,
  onToggleDontShowUploadDiscardWarningAgain: jest.fn(),
  onCloseUploadDiscardWarning: jest.fn(),
  onConfirmDiscardUploadDraft: jest.fn(async () => undefined),
  showVaultPassphrasePrompt: false,
  vaultPassphrasePromptInput: '',
  vaultPassphrasePromptAttemptsLeft: 3,
  isVaultPassphrasePromptSubmitting: false,
  vaultPassphrasePromptError: null,
  onVaultPassphraseInputChange: jest.fn(),
  onVaultPassphraseSubmit: jest.fn(async () => undefined),
  onVaultPassphrasePromptDismiss: jest.fn(),
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

describe('AppOverlays – key backup modal', () => {
  test('renders nothing when all modals are hidden', () => {
    let renderer: ReactTestRenderer.ReactTestRenderer;
    act(() => {
      renderer = ReactTestRenderer.create(<AppOverlays {...baseProps} />);
    });
    const json = JSON.stringify(renderer!.toJSON());
    expect(json).not.toContain('Set up key backup');
    expect(json).not.toContain('Discard this upload');
    expect(json).not.toContain('Enter Your Vault Passphrase');
  });

  test('shows key backup modal when showKeyBackupSetupModal is true', () => {
    let renderer: ReactTestRenderer.ReactTestRenderer;
    act(() => {
      renderer = ReactTestRenderer.create(
        <AppOverlays {...baseProps} showKeyBackupSetupModal />,
      );
    });
    expect(renderer!.root.findByProps({ children: 'Set up key backup first' })).toBeTruthy();
  });

  test('calls onCancelKeyBackupSetup when Cancel is pressed', () => {
    const onCancel = jest.fn();
    let renderer: ReactTestRenderer.ReactTestRenderer;
    act(() => {
      renderer = ReactTestRenderer.create(
        <AppOverlays {...baseProps} showKeyBackupSetupModal onCancelKeyBackupSetup={onCancel} />,
      );
    });
    const btn = findButtonByLabel(renderer!, 'Cancel');
    expect(btn).toBeTruthy();
    act(() => btn!.props.onPress());
    expect(onCancel).toHaveBeenCalledTimes(1);
  });

  test('calls onConfirmKeyBackupSetup when Set Up is pressed', async () => {
    const onConfirm = jest.fn(async () => undefined);
    let renderer: ReactTestRenderer.ReactTestRenderer;
    act(() => {
      renderer = ReactTestRenderer.create(
        <AppOverlays {...baseProps} showKeyBackupSetupModal onConfirmKeyBackupSetup={onConfirm} />,
      );
    });
    const btn = findButtonByLabel(renderer!, 'Set Up');
    expect(btn).toBeTruthy();
    await act(async () => { btn!.props.onPress(); });
    expect(onConfirm).toHaveBeenCalledTimes(1);
  });
});

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

describe('AppOverlays – vault passphrase prompt', () => {
  test('shows passphrase prompt when showVaultPassphrasePrompt is true', () => {
    let renderer: ReactTestRenderer.ReactTestRenderer;
    act(() => {
      renderer = ReactTestRenderer.create(
        <AppOverlays {...baseProps} showVaultPassphrasePrompt />,
      );
    });
    expect(renderer!.root.findByProps({ children: 'Enter Your Vault Passphrase' })).toBeTruthy();
  });

  test('shows error text when vaultPassphrasePromptError is set', () => {
    let renderer: ReactTestRenderer.ReactTestRenderer;
    act(() => {
      renderer = ReactTestRenderer.create(
        <AppOverlays {...baseProps} showVaultPassphrasePrompt vaultPassphrasePromptError="Wrong passphrase" />,
      );
    });
    expect(renderer!.root.findByProps({ children: 'Wrong passphrase' })).toBeTruthy();
  });

  test('shows attempts remaining when attemptsLeft < 3', () => {
    let renderer: ReactTestRenderer.ReactTestRenderer;
    act(() => {
      renderer = ReactTestRenderer.create(
        <AppOverlays {...baseProps} showVaultPassphrasePrompt vaultPassphrasePromptAttemptsLeft={1} />,
      );
    });
    expect(JSON.stringify(renderer!.toJSON())).toContain('attempt');
  });

  test('calls onVaultPassphrasePromptDismiss when Dismiss pressed', () => {
    const onDismiss = jest.fn();
    let renderer: ReactTestRenderer.ReactTestRenderer;
    act(() => {
      renderer = ReactTestRenderer.create(
        <AppOverlays {...baseProps} showVaultPassphrasePrompt onVaultPassphrasePromptDismiss={onDismiss} />,
      );
    });
    const btn = findButtonByLabel(renderer!, 'Dismiss');
    expect(btn).toBeTruthy();
    act(() => btn!.props.onPress());
    expect(onDismiss).toHaveBeenCalledTimes(1);
  });

  test('shows Unlocking... text when submitting', () => {
    let renderer: ReactTestRenderer.ReactTestRenderer;
    act(() => {
      renderer = ReactTestRenderer.create(
        <AppOverlays {...baseProps} showVaultPassphrasePrompt isVaultPassphrasePromptSubmitting vaultPassphrasePromptInput="abc" />,
      );
    });
    expect(renderer!.root.findByProps({ children: 'Unlocking...' })).toBeTruthy();
  });

  test('toggles passphrase visibility when Show/Hide is pressed', () => {
    let renderer: ReactTestRenderer.ReactTestRenderer;
    act(() => {
      renderer = ReactTestRenderer.create(
        <AppOverlays {...baseProps} showVaultPassphrasePrompt />,
      );
    });
    const showBtn = findButtonByLabel(renderer!, 'Show');
    expect(showBtn).toBeTruthy();
    act(() => showBtn!.props.onPress());
    expect(renderer!.root.findByProps({ children: 'Hide' })).toBeTruthy();
  });
});

