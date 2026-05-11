import React from 'react';
import { TextInput } from 'react-native';
import ReactTestRenderer, { act } from 'react-test-renderer';

import { ShareScreen } from '../../../src/screens';
import type { VaultDocument } from '../../../src/types/vault';

const doc: VaultDocument = {
  id: 'd1',
  name: 'Passport.pdf',
  hash: 'hash',
  size: '10KB',
  uploadedAt: '2026-01-01T00:00:00.000Z',
  sharedWith: [],
  sharedKeyGrants: [],
  references: [],
  saveMode: 'firebase',
  recoverable: false,
  offlineAvailable: false,
};

function buildProps(overrides: Record<string, unknown> = {}) {
  return {
    selectedDoc: doc,
    isGuest: false,
    canManageShares: true,
    shareTarget: 'user@example.com',
    allowDownload: false,
    shareStatus: '',
    isSubmitting: false,
    isSharedWithTarget: false,
    expiresInDays: '30',
    setShareTarget: jest.fn(),
    setAllowDownload: jest.fn(),
    setExpiresInDays: jest.fn(),
    onCreateShare: jest.fn(async () => undefined),
    onRevokeShare: jest.fn(async () => undefined),
    ...overrides,
  };
}

describe('ShareScreen', () => {
  beforeEach(() => jest.clearAllMocks());

  test('renders owner subtitle and create button, then calls create', async () => {
    const props = buildProps();
    let renderer: ReactTestRenderer.ReactTestRenderer;

    act(() => {
      renderer = ReactTestRenderer.create(<ShareScreen {...(props as any)} />);
    });

    expect(renderer!.root.findByProps({ children: `Generate secure access for another user. Sharing: ${doc.name}` })).toBeTruthy();

    const createBtn = renderer!.root.findByProps({ label: 'Create Share Key' });
    expect(createBtn.props.disabled).toBe(false);

    await act(async () => {
      createBtn.props.onPress();
    });

    expect(props.onCreateShare).toHaveBeenCalledTimes(1);
  });

  test('renders guest-disabled state and owner-required state', () => {
    let renderer: ReactTestRenderer.ReactTestRenderer;

    act(() => {
      renderer = ReactTestRenderer.create(
        <ShareScreen {...(buildProps({ isGuest: true, canManageShares: false, shareTarget: 'x@y.com' }) as any)} />,
      );
    });

    expect(renderer!.root.findByProps({ children: 'Guest mode is local-only. Sharing is disabled to avoid cloud exposure.' })).toBeTruthy();
    expect(renderer!.root.findByProps({ label: 'Sharing Disabled in Guest Mode' }).props.disabled).toBe(true);

    act(() => {
      renderer!.update(
        <ShareScreen {...(buildProps({ isGuest: false, canManageShares: false, shareTarget: 'x@y.com' }) as any)} />,
      );
    });

    expect(renderer!.root.findByProps({ children: 'Only the owner of this document can create or revoke share keys.' })).toBeTruthy();
    expect(renderer!.root.findByProps({ label: 'Owner Access Required' }).props.disabled).toBe(true);
  });

  test('shows update + revoke buttons when already shared and handles callbacks', async () => {
    const props = buildProps({ isSharedWithTarget: true, isSubmitting: true, shareStatus: 'Shared ok' });
    let renderer: ReactTestRenderer.ReactTestRenderer;

    act(() => {
      renderer = ReactTestRenderer.create(<ShareScreen {...(props as any)} />);
    });

    expect(renderer!.root.findByProps({ label: 'Creating Share Key...' })).toBeTruthy();
    const revokeBtn = renderer!.root.findByProps({ label: 'Revoking Share Key...' });
    expect(revokeBtn.props.disabled).toBe(true);
    expect(renderer!.root.findByProps({ children: 'Shared ok' })).toBeTruthy();

    act(() => {
      renderer!.update(
        <ShareScreen {...(buildProps({ isSharedWithTarget: true, isSubmitting: false }) as any)} />,
      );
    });

    const updateBtn = renderer!.root.findByProps({ label: 'Update Share Key' });
    const revokeReadyBtn = renderer!.root.findByProps({ label: 'Revoke Shared Key' });

    await act(async () => {
      updateBtn.props.onPress();
      revokeReadyBtn.props.onPress();
    });

    const refreshedProps: any = renderer!.root.findByType(ShareScreen).props;
    expect(refreshedProps.onCreateShare).toHaveBeenCalledTimes(1);
    expect(refreshedProps.onRevokeShare).toHaveBeenCalledTimes(1);
  });

  test('disables create for invalid target and wires input/switch handlers', async () => {
    const props = buildProps({ shareTarget: 'invalid-target' });
    let renderer: ReactTestRenderer.ReactTestRenderer;

    act(() => {
      renderer = ReactTestRenderer.create(<ShareScreen {...(props as any)} />);
    });

    const createBtn = renderer!.root.findByProps({ label: 'Create Share Key' });
    expect(createBtn.props.disabled).toBe(true);

    const inputs = renderer!.root.findAllByType(TextInput);
    const toggle = renderer!.root.findAll(
      node => typeof node.props?.onValueChange === 'function' && typeof node.props?.disabled === 'boolean',
    )[0];

    await act(async () => {
      inputs[0].props.onChangeText('new@user.com');
      inputs[1].props.onChangeText('7');
      toggle.props.onValueChange(true);
    });

    expect(props.setShareTarget).toHaveBeenCalledWith('new@user.com');
    expect(props.setExpiresInDays).toHaveBeenCalledWith('7');
    expect(props.setAllowDownload).toHaveBeenCalledWith(true);
  });
});
