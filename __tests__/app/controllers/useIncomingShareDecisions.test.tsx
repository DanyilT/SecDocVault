import React, { forwardRef, useImperativeHandle, useState } from 'react';
import TestRenderer, { act } from 'react-test-renderer';

jest.mock('../../../src/storage/localVault', () => ({
  saveIncomingShareDecisionStore: jest.fn(async () => undefined),
}));

import { saveIncomingShareDecisionStore } from '../../../src/storage/localVault';
import { useIncomingShareDecisions } from '../../../src/app/controllers/useIncomingShareDecisions';

type HarnessRef = {
  accept: (docId: string) => void;
  decline: (docId: string) => void;
  getStoreForCurrentUser: () => Record<string, 'accepted' | 'declined'>;
};

const Harness = forwardRef<HarnessRef, {setUploadStatus: jest.Mock}>(({setUploadStatus}, ref) => {
  const [store, setStore] = useState<any>({
    u1: {docA: 'accepted'},
    other: {docB: 'declined'},
  });

  const api = useIncomingShareDecisions({
    currentShareDecisionOwnerKey: 'u1',
    incomingShareDecisionStore: store,
    setIncomingShareDecisionStore: setStore,
    setUploadStatus,
  });

  useImperativeHandle(ref, () => ({
    accept: api.handleAcceptIncomingShare,
    decline: api.handleDeclineIncomingShare,
    getStoreForCurrentUser: () => api.incomingShareDecisionsForCurrentUser,
  }));

  return null;
});

describe('useIncomingShareDecisions', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('exposes decisions only for current owner key', () => {
    const ref = React.createRef<HarnessRef>();
    const setUploadStatus = jest.fn();

    act(() => {
      TestRenderer.create(<Harness ref={ref} setUploadStatus={setUploadStatus} />);
    });

    expect(ref.current?.getStoreForCurrentUser()).toEqual({docA: 'accepted'});
  });

  it('persists accept decision and reports status', async () => {
    const ref = React.createRef<HarnessRef>();
    const setUploadStatus = jest.fn();

    act(() => {
      TestRenderer.create(<Harness ref={ref} setUploadStatus={setUploadStatus} />);
    });

    act(() => {
      ref.current?.accept('docX');
    });

    await Promise.resolve();

    expect(ref.current?.getStoreForCurrentUser()).toEqual({docA: 'accepted', docX: 'accepted'});
    expect(setUploadStatus).toHaveBeenCalledWith('Incoming shared document accepted.');
    expect(saveIncomingShareDecisionStore).toHaveBeenCalled();
  });

  it('persists decline decision and reports status', async () => {
    const ref = React.createRef<HarnessRef>();
    const setUploadStatus = jest.fn();

    act(() => {
      TestRenderer.create(<Harness ref={ref} setUploadStatus={setUploadStatus} />);
    });

    act(() => {
      ref.current?.decline('docY');
    });

    await Promise.resolve();

    expect(ref.current?.getStoreForCurrentUser()).toEqual({docA: 'accepted', docY: 'declined'});
    expect(setUploadStatus).toHaveBeenCalledWith('Incoming shared document declined.');
    expect(saveIncomingShareDecisionStore).toHaveBeenCalled();
  });
});
