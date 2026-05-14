import React, { forwardRef, useImperativeHandle } from 'react';
import ReactTestRenderer, { act } from 'react-test-renderer';

import { useShareFlow } from '../../../src/app/hooks';
import { VaultDocument } from '../../../src/types/vault';

type ShareHarnessRef = {
  openShare: (doc: VaultDocument) => void;
  handleCreateShare: () => Promise<void>;
  handleRevokeShareForRecipient: (recipientEmail: string) => Promise<void>;
  handleRevokeShare: () => Promise<void>;
  getShareStatus: () => string;
  setShareTarget: (value: string) => void;
  setAllowDownload: (value: boolean) => void;
  setShareExpiryDays: (value: string) => void;
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
    handleRevokeShareForRecipient: share.handleRevokeShareForRecipient,
    handleRevokeShare: share.handleRevokeShare,
    getShareStatus: () => share.shareStatus,
    setShareTarget: share.setShareTarget,
    setAllowDownload: share.setAllowDownload,
    setShareExpiryDays: share.setShareExpiryDays,
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

  it('blocks sharing when no cloud copy exists', () => {
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
      createDocumentShareGrant: jest.fn(),
      revokeDocumentShareGrant: jest.fn(),
    };

    const ref = React.createRef<ShareHarnessRef>();
    act(() => {
      ReactTestRenderer.create(<ShareHarness ref={ref} params={params as never} />);
    });

    act(() => {
      ref.current?.openShare({ ...makeDoc(), references: [{ source: 'local', localPath: '/tmp/a' } as never] });
    });

    expect(params.setUploadStatus).toHaveBeenCalledWith('Document must be saved to cloud before sharing.');
    expect(params.setScreen).not.toHaveBeenCalled();
  });

  it('blocks sharing when current user is not owner', () => {
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
      createDocumentShareGrant: jest.fn(),
      revokeDocumentShareGrant: jest.fn(),
    };

    const ref = React.createRef<ShareHarnessRef>();
    act(() => {
      ReactTestRenderer.create(<ShareHarness ref={ref} params={params as never} />);
    });

    act(() => {
      ref.current?.openShare(makeDoc({ owner: 'other-user' }));
    });

    expect(params.setUploadStatus).toHaveBeenCalledWith('Only the document owner can create or revoke share keys.');
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

  it('creates a share successfully and updates document list', async () => {
    const updatedDoc = makeDoc({ id: 'doc-2' });
    const params = {
      isGuest: false,
      userUid: 'user-1',
      screen: 'main',
      shareOriginScreen: 'preview' as const,
      setShareOriginScreen: jest.fn(),
      selectedDoc: makeDoc(),
      setSelectedDoc: jest.fn(),
      documents: [makeDoc(), updatedDoc],
      setDocuments: jest.fn(),
      setScreen: jest.fn(),
      setUploadStatus: jest.fn(),
      setBackupStatus: jest.fn(),
      createDocumentShareGrant: jest.fn(async () => updatedDoc),
      revokeDocumentShareGrant: jest.fn(),
    };

    const ref = React.createRef<ShareHarnessRef>();
    act(() => {
      ReactTestRenderer.create(<ShareHarness ref={ref} params={params as never} />);
    });

    act(() => {
      ref.current?.setShareTarget('recipient@example.com');
      ref.current?.setAllowDownload(false);
      ref.current?.setShareExpiryDays('45');
    });

    await act(async () => {
      await ref.current?.handleCreateShare();
    });

    expect(params.createDocumentShareGrant).toHaveBeenCalledWith(
      expect.objectContaining({id: 'doc-1', owner: 'user-1'}),
      'user-1',
      'recipient@example.com',
      false,
      45,
    );
    expect(params.setDocuments).toHaveBeenCalled();
    expect(params.setSelectedDoc).toHaveBeenCalledWith(updatedDoc);
    expect(params.setScreen).toHaveBeenCalledWith('preview');
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

  it('shows validation when share target is blank', async () => {
    const params = {
      isGuest: false,
      userUid: 'user-1',
      screen: 'main',
      shareOriginScreen: 'main' as const,
      setShareOriginScreen: jest.fn(),
      selectedDoc: makeDoc(),
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

    await act(async () => {
      await ref.current?.handleCreateShare();
    });

    expect(ref.current?.getShareStatus()).toBe('Enter recipient email before creating a share key.');
  });

  it('revokes a share successfully and returns to origin screen', async () => {
    const params = {
      isGuest: false,
      userUid: 'user-1',
      screen: 'share',
      shareOriginScreen: 'preview' as const,
      setShareOriginScreen: jest.fn(),
      selectedDoc: makeDoc(),
      setSelectedDoc: jest.fn(),
      documents: [makeDoc()],
      setDocuments: jest.fn(),
      setScreen: jest.fn(),
      setUploadStatus: jest.fn(),
      setBackupStatus: jest.fn(),
      createDocumentShareGrant: jest.fn(),
      revokeDocumentShareGrant: jest.fn(async () => makeDoc({ id: 'doc-1-revoked' })),
    };

    const ref = React.createRef<ShareHarnessRef>();
    act(() => {
      ReactTestRenderer.create(<ShareHarness ref={ref} params={params as never} />);
    });

    await act(async () => {
      await ref.current?.handleRevokeShareForRecipient('recipient@example.com');
    });

    expect(params.revokeDocumentShareGrant).toHaveBeenCalledWith(
      expect.objectContaining({id: 'doc-1', owner: 'user-1'}),
      'user-1',
      'recipient@example.com',
    );
    expect(params.setScreen).toHaveBeenCalledWith('preview');
    expect(params.setSelectedDoc).toHaveBeenCalled();
  });

  it('shows validation when revoking without selected document', async () => {
    const params = {
      isGuest: false,
      userUid: 'user-1',
      screen: 'share',
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

    await act(async () => {
      await ref.current?.handleRevokeShare();
    });

    expect(ref.current?.getShareStatus()).toBe('Select a document and sign in before revoking share.');
  });
});
