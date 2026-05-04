/**
 * Tests for screens/ShareDetailsScreen.tsx
 */

import React from 'react';
import ReactTestRenderer, { act } from 'react-test-renderer';

import { ShareDetailsScreen } from '../../../src/screens/ShareDetailsScreen';
import type { VaultDocument } from '../../../src/types/vault';

const mockDoc: VaultDocument = {
  id: 'doc1',
  name: 'Passport',
  hash: 'hash',
  size: '1 KB',
  uploadedAt: '2026-01-01',
  sharedWith: [],
  sharedKeyGrants: [],
  references: [],
  saveMode: 'firebase',
  recoverable: false,
  offlineAvailable: false,
};

const baseProps = {
  selectedDoc: mockDoc,
  shareTarget: '',
  allowDownload: false,
  expiresInDays: '30',
  onOpenShareOptions: jest.fn(),
  onRevokeShareForRecipient: jest.fn(),
};

beforeEach(() => jest.clearAllMocks());

describe('ShareDetailsScreen', () => {
  test('renders without crashing', () => {
    let renderer: ReactTestRenderer.ReactTestRenderer;
    act(() => {
      renderer = ReactTestRenderer.create(<ShareDetailsScreen {...baseProps} />);
    });
    expect(renderer!.toJSON()).toBeTruthy();
  });

  test('renders Active Grants section', () => {
    let renderer: ReactTestRenderer.ReactTestRenderer;
    act(() => {
      renderer = ReactTestRenderer.create(<ShareDetailsScreen {...baseProps} />);
    });
    expect(renderer!.root.findByProps({ children: 'Active Grants' })).toBeTruthy();
  });

  test('shows no active shares message when sharedKeyGrants is empty', () => {
    let renderer: ReactTestRenderer.ReactTestRenderer;
    act(() => {
      renderer = ReactTestRenderer.create(<ShareDetailsScreen {...baseProps} />);
    });
    expect(
      renderer!.root.findByProps({ children: 'No active shares for this document.' }),
    ).toBeTruthy();
  });

  test('renders Open Sharing Options button', () => {
    let renderer: ReactTestRenderer.ReactTestRenderer;
    act(() => {
      renderer = ReactTestRenderer.create(<ShareDetailsScreen {...baseProps} />);
    });
    expect(renderer!.root.findByProps({ label: 'Open Sharing Options' })).toBeTruthy();
  });

  test('calls onOpenShareOptions when button pressed', () => {
    const onOpen = jest.fn();
    let renderer: ReactTestRenderer.ReactTestRenderer;
    act(() => {
      renderer = ReactTestRenderer.create(
        <ShareDetailsScreen {...baseProps} onOpenShareOptions={onOpen} />,
      );
    });
    const btn = renderer!.root.findByProps({ label: 'Open Sharing Options' });
    act(() => btn.props.onPress());
    expect(onOpen).toHaveBeenCalledTimes(1);
  });

  test('renders active grants with revoke button', () => {
    const futureDate = new Date(Date.now() + 86400000 * 30).toISOString();
    const docWithGrant: VaultDocument = {
      ...mockDoc,
      sharedKeyGrants: [{
        recipientUid: 'uid1',
        recipientEmail: 'user@example.com',
        allowExport: false,
        wrappedKeyCipher: 'cipher',
        keyWrapAlgorithm: 'RSA-OAEP-SHA256',
        wrappedKeyIv: '',
        senderEphemeralPublicKey: '',
        createdAt: '2026-01-01T00:00:00.000Z',
        expiresAt: futureDate,
        revokedAt: null,
      }] as any,
    };
    let renderer: ReactTestRenderer.ReactTestRenderer;
    act(() => {
      renderer = ReactTestRenderer.create(
        <ShareDetailsScreen {...baseProps} selectedDoc={docWithGrant} />,
      );
    });
    expect(renderer!.root.findByProps({ children: 'user@example.com' })).toBeTruthy();
    expect(renderer!.root.findByProps({ label: 'Revoke' })).toBeTruthy();
  });

  test('calls onRevokeShareForRecipient when Revoke is pressed', async () => {
    const onRevoke = jest.fn();
    const futureDate = new Date(Date.now() + 86400000 * 30).toISOString();
    const docWithGrant: VaultDocument = {
      ...mockDoc,
      sharedKeyGrants: [{
        recipientUid: 'uid1',
        recipientEmail: 'user@example.com',
        allowExport: false,
        wrappedKeyCipher: 'cipher',
        keyWrapAlgorithm: 'RSA-OAEP-SHA256',
        wrappedKeyIv: '',
        senderEphemeralPublicKey: '',
        createdAt: '2026-01-01T00:00:00.000Z',
        expiresAt: futureDate,
        revokedAt: null,
      }] as any,
    };
    let renderer: ReactTestRenderer.ReactTestRenderer;
    act(() => {
      renderer = ReactTestRenderer.create(
        <ShareDetailsScreen
          {...baseProps}
          selectedDoc={docWithGrant}
          onRevokeShareForRecipient={onRevoke}
        />,
      );
    });
    const revokeBtn = renderer!.root.findByProps({ label: 'Revoke' });
    await act(async () => { revokeBtn.props.onPress(); });
    expect(onRevoke).toHaveBeenCalledWith('user@example.com');
  });
});

