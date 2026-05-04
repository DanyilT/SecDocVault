/**
 * Tests for screens/DocumentRecoveryScreen.tsx
 */

import React from 'react';
import ReactTestRenderer, { act } from 'react-test-renderer';

import { DocumentRecoveryScreen } from '../../../src/screens/DocumentRecoveryScreen';

const baseProps = {
  isSubmitting: false,
  keyBackupEnabled: true,
  backedUpDocs: [],
  notBackedUpDocs: [],
  onToggleDocBackup: jest.fn(async () => undefined),
};

beforeEach(() => jest.clearAllMocks());

describe('DocumentRecoveryScreen', () => {
  test('renders without crashing', () => {
    let renderer: ReactTestRenderer.ReactTestRenderer;
    act(() => {
      renderer = ReactTestRenderer.create(<DocumentRecoveryScreen {...baseProps} />);
    });
    expect(renderer!.toJSON()).toBeTruthy();
  });

  test('renders Recoverable Documents and Not Recoverable sections', () => {
    let renderer: ReactTestRenderer.ReactTestRenderer;
    act(() => {
      renderer = ReactTestRenderer.create(<DocumentRecoveryScreen {...baseProps} />);
    });
    expect(renderer!.root.findByProps({ children: 'Recoverable Documents' })).toBeTruthy();
    expect(renderer!.root.findByProps({ children: 'Not Recoverable' })).toBeTruthy();
  });

  test('shows None placeholder when backedUpDocs is empty', () => {
    let renderer: ReactTestRenderer.ReactTestRenderer;
    act(() => {
      renderer = ReactTestRenderer.create(<DocumentRecoveryScreen {...baseProps} />);
    });
    const nones = renderer!.root.findAllByProps({ children: 'None' });
    expect(nones.length).toBeGreaterThanOrEqual(2);
  });

  test('shows backup off warning when keyBackupEnabled is false', () => {
    let renderer: ReactTestRenderer.ReactTestRenderer;
    act(() => {
      renderer = ReactTestRenderer.create(
        <DocumentRecoveryScreen {...baseProps} keyBackupEnabled={false} />,
      );
    });
    const json = JSON.stringify(renderer!.toJSON());
    expect(json).toContain('Key backup is off');
  });

  test('renders backed-up document names', () => {
    const docs = [
      { id: 'doc1', name: 'Passport', canRecover: true },
      { id: 'doc2', name: 'ID Card', canRecover: true },
    ];
    let renderer: ReactTestRenderer.ReactTestRenderer;
    act(() => {
      renderer = ReactTestRenderer.create(
        <DocumentRecoveryScreen {...baseProps} backedUpDocs={docs} />,
      );
    });
    expect(renderer!.root.findByProps({ children: 'Passport' })).toBeTruthy();
    expect(renderer!.root.findByProps({ children: 'ID Card' })).toBeTruthy();
  });

  test('calls onToggleDocBackup when a switch is toggled', async () => {
    const onToggle = jest.fn(async () => undefined);
    const docs = [{ id: 'doc1', name: 'Passport', canRecover: true }];
    let renderer: ReactTestRenderer.ReactTestRenderer;
    act(() => {
      renderer = ReactTestRenderer.create(
        <DocumentRecoveryScreen
          {...baseProps}
          backedUpDocs={docs}
          onToggleDocBackup={onToggle}
        />,
      );
    });
    // Find the Switch by its onValueChange prop presence
    const switchEl = renderer!.root.findAll(
      node => typeof node.props.onValueChange === 'function',
    )[0];
    expect(switchEl).toBeTruthy();
    await act(async () => { switchEl.props.onValueChange(false); });
    expect(onToggle).toHaveBeenCalledWith('doc1', false);
  });
});
