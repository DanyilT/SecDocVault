import React from 'react';
import TestRenderer, { act } from 'react-test-renderer';

import { AppOverlays } from '../../../src/app/components/AppOverlays';

const editMetadataPropsRef: {current: any} = {current: null};

jest.mock('../../../src/app/components/EditMetadataModal', () => ({
  EditMetadataModal: (props: any) => {
    editMetadataPropsRef.current = props;
    return null;
  },
}));

function baseProps(overrides: Record<string, unknown> = {}) {
  return {
    showUploadDiscardWarning: false,
    dontShowUploadDiscardWarningAgain: false,
    onToggleDontShowUploadDiscardWarningAgain: jest.fn(),
    onCloseUploadDiscardWarning: jest.fn(),
    onConfirmDiscardUploadDraft: jest.fn(async () => undefined),
    showVaultPassphrasePrompt: false,
    ...overrides,
  } as React.ComponentProps<typeof AppOverlays>;
}

describe('AppOverlays', () => {
  const toText = (value: unknown): string => {
    if (typeof value === 'string' || typeof value === 'number') {
      return String(value);
    }
    if (Array.isArray(value)) {
      return value.map(item => toText(item)).join('');
    }
    return '';
  };

  const findPressableByText = (root: TestRenderer.ReactTestInstance, label: string, exact = false) => {
    const labelNode = root.findAll(node => {
      const text = toText(node.props?.children);
      return exact ? text === label : text.includes(label);
    })[0];

    if (!labelNode) {
      throw new Error(`No label node found for: ${label}`);
    }

    let current: TestRenderer.ReactTestInstance | null = labelNode;
    while (current && typeof current.props?.onPress !== 'function') {
      current = current.parent;
    }

    if (!current) {
      throw new Error(`No pressable found for label: ${label}`);
    }

    return current;
  };

  it('calls discard-warning callbacks from overlay actions', async () => {
    const props = baseProps({
      showUploadDiscardWarning: true,
      dontShowUploadDiscardWarningAgain: false,
    });

    let renderer: TestRenderer.ReactTestRenderer;
    await act(async () => {
      renderer = TestRenderer.create(<AppOverlays {...props} />);
    });

    const discardPressable = findPressableByText(renderer!.root, 'Discard', true);
    const keepEditingPressable = findPressableByText(renderer!.root, 'Keep Editing', true);
    const togglePressable = findPressableByText(renderer!.root, 'Do not show this again', true);

    await act(async () => {
      togglePressable.props.onPress();
      keepEditingPressable.props.onPress();
      discardPressable.props.onPress();
    });

    expect(props.onToggleDontShowUploadDiscardWarningAgain).toHaveBeenCalledTimes(1);
    expect(props.onCloseUploadDiscardWarning).toHaveBeenCalledTimes(1);
    expect(props.onConfirmDiscardUploadDraft).toHaveBeenCalledTimes(1);
  });

  it('swallows discard confirmation errors and still invokes the handler', async () => {
    const props = baseProps({
      showUploadDiscardWarning: true,
      onConfirmDiscardUploadDraft: jest.fn(async () => {
        throw new Error('discard failed');
      }),
    });

    let renderer: TestRenderer.ReactTestRenderer;
    await act(async () => {
      renderer = TestRenderer.create(<AppOverlays {...props} />);
    });

    const discardPressable = findPressableByText(renderer!.root, 'Discard', true);

    await act(async () => {
      discardPressable.props.onPress();
    });

    expect(props.onConfirmDiscardUploadDraft).toHaveBeenCalledTimes(1);
  });

  it('passes noop fallback handlers to the edit metadata modal when callbacks are omitted', async () => {
    const props = baseProps({
      showEditMetadataModal: true,
    });

    await act(async () => {
      TestRenderer.create(<AppOverlays {...props} />);
    });

    expect(editMetadataPropsRef.current.onChangeName).toEqual(expect.any(Function));
    expect(editMetadataPropsRef.current.onChangeDescription).toEqual(expect.any(Function));
    expect(editMetadataPropsRef.current.onCancel).toEqual(expect.any(Function));
    expect(editMetadataPropsRef.current.onSave).toEqual(expect.any(Function));

    expect(() => {
      editMetadataPropsRef.current.onChangeName('new name');
      editMetadataPropsRef.current.onChangeDescription('new description');
      editMetadataPropsRef.current.onCancel();
      editMetadataPropsRef.current.onSave();
    }).not.toThrow();
  });
});
