import React, { forwardRef, useImperativeHandle } from 'react';
import TestRenderer, { act } from 'react-test-renderer';

import {
  useBackedUpDocs,
  useCurrentShareDecisionOwnerKey,
  useCurrentUserIdentifiers,
  useNotBackedUpDocs,
  useRecoverableDocsCount,
} from '../../../src/app/controllers/useAppControllerSelectors';

type HarnessRef = {
  getCurrentUserIdentifiers: () => string[];
  getOwnerKey: () => string;
  getRecoverableCount: () => number;
  getBackedUpDocs: () => Array<{id: string; name: string; canRecover: boolean}>;
  getNotBackedUpDocs: () => Array<{id: string; name: string; canRecover: boolean}>;
};

const docs = [
  {
    id: 'doc-1',
    name: 'Doc 1',
    hash: 'h1',
    size: '1KB',
    uploadedAt: '2026-01-01T00:00:00.000Z',
    recoverable: true,
    references: [{source: 'firebase', name: 'a', size: 1, type: 'image/jpeg'}],
  },
  {
    id: 'doc-2',
    name: 'Doc 2',
    hash: 'h2',
    size: '2KB',
    uploadedAt: '2026-01-02T00:00:00.000Z',
    recoverable: false,
    references: [{source: 'local', name: 'b', size: 1, type: 'image/jpeg'}],
  },
] as any;

const Harness = forwardRef<HarnessRef>((_props, ref) => {
  const user = {uid: ' u1 ', email: ' user@example.com '};

  const currentUserIdentifiers = useCurrentUserIdentifiers(user);
  const ownerKey = useCurrentShareDecisionOwnerKey(user);
  const recoverableCount = useRecoverableDocsCount(docs);
  const backedUpDocs = useBackedUpDocs(docs);
  const notBackedUpDocs = useNotBackedUpDocs(docs);

  useImperativeHandle(ref, () => ({
    getCurrentUserIdentifiers: () => currentUserIdentifiers,
    getOwnerKey: () => ownerKey,
    getRecoverableCount: () => recoverableCount,
    getBackedUpDocs: () => backedUpDocs,
    getNotBackedUpDocs: () => notBackedUpDocs,
  }));

  return null;
});

describe('useAppControllerSelectors', () => {
  it('derives user identifiers and owner key from uid/email', () => {
    const ref = React.createRef<HarnessRef>();

    act(() => {
      TestRenderer.create(<Harness ref={ref} />);
    });

    expect(ref.current?.getCurrentUserIdentifiers()).toEqual(['u1', 'user@example.com']);
    expect(ref.current?.getOwnerKey()).toBe('u1');
  });

  it('derives recoverable/backed-up vs not-backed-up docs', () => {
    const ref = React.createRef<HarnessRef>();

    act(() => {
      TestRenderer.create(<Harness ref={ref} />);
    });

    expect(ref.current?.getRecoverableCount()).toBe(1);
    expect(ref.current?.getBackedUpDocs()).toEqual([{id: 'doc-1', name: 'Doc 1', canRecover: true}]);
    expect(ref.current?.getNotBackedUpDocs()).toEqual([{id: 'doc-2', name: 'Doc 2', canRecover: false}]);
  });
});
