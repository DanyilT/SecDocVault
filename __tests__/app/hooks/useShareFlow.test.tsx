import React, { forwardRef, useImperativeHandle } from 'react';
import ReactTestRenderer, { act } from 'react-test-renderer';

import { useShareFlow } from '../../../src/app/hooks';
import { VaultDocument } from '../../../src/types/vault';

type ShareHarnessRef = {
  openShare: (doc: VaultDocument) => void;
  handleCreateShare: () => Promise<void>;
  getShareStatus: () => string;
};

function makeDoc(overrides: Partial<VaultDocument> = {}): VaultDocument {
  return {
    id: 'doc-1',
    name: 'Doc',
    hash: 'hash',
    size: '12 KB',
    uploadedAt: new Date().toISOString(),
    owner: 'user-1',
    references: [{source: 'firebase', name: 'a.jpg', size: 100, type: 'image/jpeg'}],
    ...overrides,
  };
}

const ShareHarness = forwardRef<ShareHarnessRef, {params: Parameters<typeof useShareFlow>[0]}>(({params}, ref) => {
  const share = useShareFlow(params);

  useImperativeHandle(ref, () => ({
    openShare: share.openShare,
    handleCreateShare: share.handleCreateShare,
    getShareStatus: () => share.shareStatus,
  }));

  return null;
});

describe('useShareFlow', () => {
  it('blocks sharing in guest mode', () => {
    const params = {
      isGuest: true,
      userUid: 'user-1',
      screen: 'main',
      shareOriginScreen: 'main' as const,
      setShareOriginScreen: jest.fn(),
      selectedDoc: null,
      setSelectedDoc: jest.fn(),
      documents: [],
      setDocuments: jest.fn(),
      setScreen: jest.fn(),
      setUploadStatus: jest.fn(),
      setBackupStatus: jest.fn(),
      createDocumentShareGrant: jest.fn(),
      revokeDocumentShareGrant: jest.fn(),
    };

    const ref = React.createRef<ShareHarnessRef>();
    act(() => {
      ReactTestRenderer.create(<ShareHarness ref={ref} params={params as never} />);
    });

    act(() => {
      ref.current?.openShare(makeDoc());
    });

    expect(params.setBackupStatus).toHaveBeenCalledWith('Sharing is disabled in guest mode.');
    expect(params.setScreen).not.toHaveBeenCalled();
  });

  it('opens share screen for owner cloud document', () => {
    const params = {
      isGuest: false,
      userUid: 'user-1',
      screen: 'preview',
      shareOriginScreen: 'main' as const,
      setShareOriginScreen: jest.fn(),
      selectedDoc: null,
      setSelectedDoc: jest.fn(),
      documents: [],
      setDocuments: jest.fn(),
      setScreen: jest.fn(),
      setUploadStatus: jest.fn(),
      setBackupStatus: jest.fn(),
      createDocumentShareGrant: jest.fn(),
      revokeDocumentShareGrant: jest.fn(),
    };

    const ref = React.createRef<ShareHarnessRef>();
    act(() => {
      ReactTestRenderer.create(<ShareHarness ref={ref} params={params as never} />);
    });

    act(() => {
      ref.current?.openShare(makeDoc());
    });

    expect(params.setShareOriginScreen).toHaveBeenCalledWith('preview');
    expect(params.setScreen).toHaveBeenCalledWith('share');
  });

  it('fails create share when no selected doc', async () => {
    const params = {
      isGuest: false,
      userUid: 'user-1',
      screen: 'main',
      shareOriginScreen: 'main' as const,
      setShareOriginScreen: jest.fn(),
      selectedDoc: null,
      setSelectedDoc: jest.fn(),
      documents: [],
      setDocuments: jest.fn(),
      setScreen: jest.fn(),
      setUploadStatus: jest.fn(),
      setBackupStatus: jest.fn(),
      createDocumentShareGrant: jest.fn(async () => makeDoc()),
      revokeDocumentShareGrant: jest.fn(async () => makeDoc()),
    };

    const ref = React.createRef<ShareHarnessRef>();
    act(() => {
      ReactTestRenderer.create(<ShareHarness ref={ref} params={params as never} />);
    });

    await act(async () => {
      await ref.current?.handleCreateShare();
    });

    expect(ref.current?.getShareStatus()).toBe('Select a document and sign in before sharing.');
  });
});
