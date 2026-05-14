import React from 'react';
import TestRenderer, { act } from 'react-test-renderer';

jest.mock('../../../src/context/AuthContext', () => ({
  useAuth: jest.fn(),
}));

jest.mock('../../../src/storage/localVault', () => ({
  getLocalDocuments: jest.fn(async (userId?: string) => {
    if (userId) return [{ id: 'local-owned', owner: userId }];
    return [{ id: 'local-guest', owner: 'guest' }];
  }),
  getIncomingShareDecisionStore: jest.fn(async () => ({})),
  saveLocalDocuments: jest.fn(async () => undefined),
  saveIncomingShareDecisionStore: jest.fn(async () => undefined),
}));

jest.mock('../../../src/services/documentVault', () => ({
  listVaultDocumentsFromFirebase: jest.fn(async (userId: string) => [{ id: 'remote-1', owner: userId }]),
  listVaultDocumentsSharedWithUser: jest.fn(async () => []),
  enforceExpiredShareRevocations: jest.fn(async (d: any) => d),
}));

jest.mock('../../../src/app/hooks/useDocumentVault', () => ({
  mergeVaultDocuments: jest.fn((a: any[], b: any[], c: any[]) => [...a, ...b, ...c]),
}));

import { useAuth } from '../../../src/context/AuthContext';

describe('DocumentVaultContext', () => {
  afterEach(() => jest.clearAllMocks());

  test('loads local documents when unauthenticated', async () => {
    (useAuth as jest.Mock).mockReturnValue({ user: null, isAuthenticated: false, isInitializing: false, isGuest: false });

    const { DocumentVaultProvider, useDocumentVaultContext } = require('../../../src/context/DocumentVaultContext');

    function Probe() {
      const ctx = useDocumentVaultContext();
      // @ts-ignore
      (Probe as any).latest = ctx;
      return null;
    }

    await act(async () => {
      TestRenderer.create(
        <DocumentVaultProvider>
          <Probe />
        </DocumentVaultProvider>,
      );
    });

    const latest = (Probe as any).latest;
    // explicitly call loadDocuments to ensure behavior
    await act(async () => {
      await latest.loadDocuments();
    });

    expect(latest.documents).toEqual([{ id: 'local-guest', owner: 'guest' }]);
  });

  test('loads remote and local documents when authenticated', async () => {
    (useAuth as jest.Mock).mockReturnValue({ user: { uid: 'user123', email: 'me@example.com' }, isAuthenticated: true, isInitializing: false, isGuest: false });

    const { DocumentVaultProvider, useDocumentVaultContext } = require('../../../src/context/DocumentVaultContext');

    function Probe() {
      const ctx = useDocumentVaultContext();
      // @ts-ignore
      (Probe as any).latest = ctx;
      return null;
    }

    await act(async () => {
      TestRenderer.create(
        <DocumentVaultProvider>
          <Probe />
        </DocumentVaultProvider>,
      );
    });

    await act(async () => {
      await (Probe as any).latest.loadDocuments();
    });

    // mergeVaultDocuments returns concatenated arrays
    expect((Probe as any).latest.documents).toEqual([{ id: 'remote-1', owner: 'user123' }, { id: 'local-owned', owner: 'user123' }]);
  });

  test('falls back to local documents when remote fetch fails', async () => {
    const docService = require('../../../src/services/documentVault');
    docService.listVaultDocumentsFromFirebase.mockImplementation(async () => { throw new Error('boom'); });

    (useAuth as jest.Mock).mockReturnValue({ user: { uid: 'user123' }, isAuthenticated: true, isInitializing: false, isGuest: false });

    const { DocumentVaultProvider, useDocumentVaultContext } = require('../../../src/context/DocumentVaultContext');

    function Probe() {
      const ctx = useDocumentVaultContext();
      // @ts-ignore
      (Probe as any).latest = ctx;
      return null;
    }

    await act(async () => {
      TestRenderer.create(
        <DocumentVaultProvider>
          <Probe />
        </DocumentVaultProvider>,
      );
    });

    await act(async () => {
      await (Probe as any).latest.loadDocuments();
    });

    expect((Probe as any).latest.documents).toEqual([{ id: 'local-owned', owner: 'user123' }]);
  });
});
