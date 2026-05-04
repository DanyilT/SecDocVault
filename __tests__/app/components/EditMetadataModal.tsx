/**
 * Tests for app/components/EditMetadataModal.tsx
 */

import React from 'react';
import TestRenderer, { act } from 'react-test-renderer';

import { EditMetadataModal, EditMetadataModalProps } from '../../../src/app/components/EditMetadataModal';

function baseProps(overrides: Partial<EditMetadataModalProps> = {}): EditMetadataModalProps {
  return {
    visible: true,
    nameInput: 'My Document',
    descriptionInput: 'Some description',
    isSubmitting: false,
    errorMessage: null,
    onChangeName: jest.fn(),
    onChangeDescription: jest.fn(),
    onCancel: jest.fn(),
    onSave: jest.fn(),
    ...overrides,
  };
}

const toText = (value: unknown): string => {
  if (typeof value === 'string' || typeof value === 'number') {
    return String(value);
  }
  if (Array.isArray(value)) {
    return value.map(item => toText(item)).join('');
  }
  return '';
};

const findPressableByText = (root: TestRenderer.ReactTestInstance, label: string) => {
  const labelNode = root.findAll(node => toText(node.props?.children) === label)[0];
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

const findTextInputs = (root: TestRenderer.ReactTestInstance) =>
  root.findAll(node => typeof node.type === 'string' && node.type === 'TextInput');

async function render(props: EditMetadataModalProps) {
  let renderer!: TestRenderer.ReactTestRenderer;
  await act(async () => {
    renderer = TestRenderer.create(<EditMetadataModal {...props} />);
  });
  return renderer;
}

describe('EditMetadataModal', () => {
  it('renders nothing when not visible', async () => {
    const renderer = await render(baseProps({ visible: false }));
    expect(renderer.toJSON()).toBeNull();
  });

  it('renders the modal with prefilled name and description when visible', async () => {
    const renderer = await render(baseProps());
    const inputs = findTextInputs(renderer.root);

    expect(inputs.length).toBeGreaterThanOrEqual(2);
    expect(inputs[0].props.value).toBe('My Document');
    expect(inputs[1].props.value).toBe('Some description');
  });

  it('calls onChangeName when the name input value changes', async () => {
    const onChangeName = jest.fn();
    const renderer = await render(baseProps({ onChangeName }));
    const inputs = findTextInputs(renderer.root);

    await act(async () => {
      inputs[0].props.onChangeText('Updated Name');
    });

    expect(onChangeName).toHaveBeenCalledWith('Updated Name');
  });

  it('calls onChangeDescription when the description input value changes', async () => {
    const onChangeDescription = jest.fn();
    const renderer = await render(baseProps({ onChangeDescription }));
    const inputs = findTextInputs(renderer.root);

    await act(async () => {
      inputs[1].props.onChangeText('Updated description');
    });

    expect(onChangeDescription).toHaveBeenCalledWith('Updated description');
  });

  it('invokes onCancel when the Cancel action is pressed', async () => {
    const onCancel = jest.fn();
    const renderer = await render(baseProps({ onCancel }));

    await act(async () => {
      findPressableByText(renderer.root, 'Cancel').props.onPress();
    });

    expect(onCancel).toHaveBeenCalledTimes(1);
  });

  it('invokes onSave when the Save action is pressed', async () => {
    const onSave = jest.fn();
    const renderer = await render(baseProps({ onSave }));

    await act(async () => {
      findPressableByText(renderer.root, 'Save').props.onPress();
    });

    expect(onSave).toHaveBeenCalledTimes(1);
  });

  it('disables the Save action when the name input is empty or whitespace-only', async () => {
    const onSave = jest.fn();
    const renderer = await render(baseProps({ nameInput: '   ', onSave }));

    const savePressable = findPressableByText(renderer.root, 'Save');
    expect(savePressable.props.disabled).toBe(true);
  });

  it('shows the saving label and disables both inputs while submitting', async () => {
    const renderer = await render(baseProps({ isSubmitting: true }));

    findPressableByText(renderer.root, 'Saving...');
    const inputs = findTextInputs(renderer.root);
    expect(inputs[0].props.editable).toBe(false);
    expect(inputs[1].props.editable).toBe(false);

    const cancelPressable = findPressableByText(renderer.root, 'Cancel');
    expect(cancelPressable.props.disabled).toBe(true);
  });

  it('renders an error message when one is supplied', async () => {
    const renderer = await render(baseProps({ errorMessage: 'Save failed' }));

    const matches = renderer.root.findAll(node => toText(node.props?.children) === 'Save failed');
    expect(matches.length).toBeGreaterThan(0);
  });
});
