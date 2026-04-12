import React from 'react';
import TestRenderer, { act } from 'react-test-renderer';

jest.mock('../../../src/services/keyBackup', () => ({
  autoSyncKeysIfEnabled: jest.fn(async () => false),
}));

jest.mock('../../../src/storage/localVault', () => ({
  saveLocalDocuments: jest.fn(async () => undefined),
}));

import { autoSyncKeysIfEnabled } from '../../../src/services/keyBackup';
import { saveLocalDocuments } from '../../../src/storage/localVault';
import { useDocumentLifecycleEffects } from '../../../src/app/controllers/useDocumentLifecycleEffects';

function makeDoc(id: string) {
  return {
    id,
    name: `Doc ${id}`,
    hash: `hash-${id}`,
    size: '1KB',
    uploadedAt: '2026-01-01T00:00:00.000Z',
    references: [],
  } as any;
}

function Harness({params}: {params: any}) {
  useDocumentLifecycleEffects(params);
  return null;
}

function baseParams(overrides: Record<string, unknown> = {}) {
  return {
    isInitializing: false,
    isAuthenticated: true,
    isGuest: false,
    userUid: 'u1',
    documents: [makeDoc('1')],
    selectedDoc: null,
    autoSyncKeys: false,
    hasUnlockedThisLaunch: true,
    reloadDocuments: jest.fn(async () => undefined),
    setSelectedDoc: jest.fn(),
    setKeyBackupStatus: jest.fn(),
    setIsVaultLocked: jest.fn(),
    ...overrides,
  } as any;
}

describe('useDocumentLifecycleEffects', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('reloads documents on mount and initializes selected doc when missing', async () => {
    const params = baseParams({selectedDoc: null});

    await act(async () => {
      TestRenderer.create(<Harness params={params} />);
    });

    expect(params.reloadDocuments).toHaveBeenCalledTimes(1);
    expect(params.setSelectedDoc).toHaveBeenCalledWith(expect.objectContaining({id: '1'}));
  });

  it('persists docs after initialization and updates lock state for auth gate', async () => {
    const params = baseParams({isInitializing: true, isAuthenticated: false, hasUnlockedThisLaunch: false});
    let renderer: TestRenderer.ReactTestRenderer;

    await act(async () => {
      renderer = TestRenderer.create(<Harness params={params} />);
    });

    expect(saveLocalDocuments).not.toHaveBeenCalled();
    expect(params.setIsVaultLocked).toHaveBeenCalledWith(false);

    const nextParams = {
      ...params,
      isInitializing: false,
      isAuthenticated: true,
      hasUnlockedThisLaunch: false,
      documents: [makeDoc('2')],
    };

    await act(async () => {
      renderer!.update(<Harness params={nextParams} />);
    });

    expect(saveLocalDocuments).toHaveBeenCalledWith(nextParams.documents);
    expect(nextParams.setIsVaultLocked).toHaveBeenCalledWith(true);
  });

  it('runs auto-sync and sets success status when synced', async () => {
    (autoSyncKeysIfEnabled as jest.Mock).mockResolvedValue(true);
    const params = baseParams({autoSyncKeys: true});

    await act(async () => {
      TestRenderer.create(<Harness params={params} />);
    });

    await act(async () => {
      await Promise.resolve();
    });

    expect(autoSyncKeysIfEnabled).toHaveBeenCalledWith('u1', params.documents);
    expect(params.setKeyBackupStatus).toHaveBeenCalledWith('Auto-sync complete: encrypted keys updated in Firebase backup.');
  });

  it('sets auto-sync error status when syncing fails', async () => {
    (autoSyncKeysIfEnabled as jest.Mock).mockRejectedValue(new Error('boom'));
    const params = baseParams({autoSyncKeys: true});

    await act(async () => {
      TestRenderer.create(<Harness params={params} />);
    });

    await act(async () => {
      await Promise.resolve();
    });

    expect(params.setKeyBackupStatus).toHaveBeenCalledWith('Auto-sync error: boom');
  });
});
