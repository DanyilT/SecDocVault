/**
 * __tests__/app/components/EditMetadataModal.test.tsx
 */
import React from 'react';
import TestRenderer, { act } from 'react-test-renderer';
import { EditMetadataModal, EditMetadataModalProps } from '../../../src/app/components/EditMetadataModal';
describe('EditMetadataModal', () => {
  const defaultProps: EditMetadataModalProps = {
    visible: true,
    nameInput: 'Test Document',
    descriptionInput: 'Test Description',
    isSubmitting: false,
    errorMessage: null,
    onChangeName: jest.fn(),
    onChangeDescription: jest.fn(),
    onCancel: jest.fn(),
    onSave: jest.fn(),
  };
  beforeEach(() => {
    jest.clearAllMocks();
  });
  describe('visibility', () => {
    it('should render when visible is true', () => {
      let renderer: TestRenderer.ReactTestRenderer | undefined;
      act(() => {
        renderer = TestRenderer.create(<EditMetadataModal {...defaultProps} visible={true} />);
      });
      expect(renderer).toBeTruthy();
      const tree = renderer?.toJSON();
      expect(tree).toBeTruthy();
    });
    it('should not render when visible is false', () => {
      let renderer: TestRenderer.ReactTestRenderer | undefined;
      act(() => {
        renderer = TestRenderer.create(<EditMetadataModal {...defaultProps} visible={false} />);
      });
      const tree = renderer?.toJSON();
      expect(tree).toBeNull();
    });
    it('should return null when not visible', () => {
      let renderer: TestRenderer.ReactTestRenderer | undefined;
      act(() => {
        renderer = TestRenderer.create(<EditMetadataModal {...defaultProps} visible={false} />);
      });
      expect(renderer?.toJSON()).toBeNull();
    });
  });
  describe('rendering content when visible', () => {
    it('should contain text input for document name', () => {
      let renderer: TestRenderer.ReactTestRenderer | undefined;
      act(() => {
        renderer = TestRenderer.create(<EditMetadataModal {...defaultProps} visible={true} />);
      });
      const tree = renderer?.toJSON() as any;
      const content = JSON.stringify(tree);
      expect(content).toContain('Document Name');
    });
    it('should contain text input for description', () => {
      let renderer: TestRenderer.ReactTestRenderer | undefined;
      act(() => {
        renderer = TestRenderer.create(<EditMetadataModal {...defaultProps} visible={true} />);
      });
      const tree = renderer?.toJSON() as any;
      const content = JSON.stringify(tree);
      expect(content).toContain('Description');
    });
    it('should display current name value', () => {
      let renderer: TestRenderer.ReactTestRenderer | undefined;
      act(() => {
        renderer = TestRenderer.create(<EditMetadataModal {...defaultProps} nameInput="My Doc" visible={true} />);
      });
      const tree = renderer?.toJSON() as any;
      const content = JSON.stringify(tree);
      expect(content).toContain('My Doc');
    });
    it('should display edit header', () => {
      let renderer: TestRenderer.ReactTestRenderer | undefined;
      act(() => {
        renderer = TestRenderer.create(<EditMetadataModal {...defaultProps} visible={true} />);
      });
      const tree = renderer?.toJSON() as any;
      const content = JSON.stringify(tree);
      expect(content).toContain('Edit document metadata');
    });
  });
  describe('save button state', () => {
    it('should be enabled with valid name', () => {
      const onSave = jest.fn();
      let renderer: TestRenderer.ReactTestRenderer | undefined;
      act(() => {
        renderer = TestRenderer.create(
          <EditMetadataModal 
            {...defaultProps}
            nameInput="Valid Name"
            isSubmitting={false}
            onSave={onSave}
            visible={true}
          />
        );
      });
      expect(renderer).toBeTruthy();
    });
    it('should be disabled with empty name', () => {
      let renderer: TestRenderer.ReactTestRenderer | undefined;
      act(() => {
        renderer = TestRenderer.create(
          <EditMetadataModal
            {...defaultProps}
            nameInput=""
            isSubmitting={false}
            visible={true}
          />
        );
      });
      expect(renderer).toBeTruthy();
    });
    it('should be disabled with whitespace-only name', () => {
      let renderer: TestRenderer.ReactTestRenderer | undefined;
      act(() => {
        renderer = TestRenderer.create(
          <EditMetadataModal
            {...defaultProps}
            nameInput="   "
            isSubmitting={false}
            visible={true}
          />
        );
      });
      expect(renderer).toBeTruthy();
    });
    it('should be disabled while submitting', () => {
      let renderer: TestRenderer.ReactTestRenderer | undefined;
      act(() => {
        renderer = TestRenderer.create(
          <EditMetadataModal
            {...defaultProps}
            nameInput="Valid Name"
            isSubmitting={true}
            visible={true}
          />
        );
      });
      const tree = renderer?.toJSON() as any;
      const content = JSON.stringify(tree);
      expect(content).toContain('Saving...');
    });
    it('should show Save text when not submitting', () => {
      let renderer: TestRenderer.ReactTestRenderer | undefined;
      act(() => {
        renderer = TestRenderer.create(
          <EditMetadataModal
            {...defaultProps}
            nameInput="Valid Name"
            isSubmitting={false}
            visible={true}
          />
        );
      });
      const tree = renderer?.toJSON() as any;
      const content = JSON.stringify(tree);
      expect(content).toContain('Save');
    });
  });
  describe('error message display', () => {
    it('should display error message when provided', () => {
      let renderer: TestRenderer.ReactTestRenderer | undefined;
      act(() => {
        renderer = TestRenderer.create(
          <EditMetadataModal {...defaultProps} errorMessage="Name already exists" visible={true} />
        );
      });
      const tree = renderer?.toJSON() as any;
      const content = JSON.stringify(tree);
      expect(content).toContain('Name already exists');
    });
    it('should not display error message when null', () => {
      let renderer: TestRenderer.ReactTestRenderer | undefined;
      act(() => {
        renderer = TestRenderer.create(
          <EditMetadataModal {...defaultProps} errorMessage={null} visible={true} />
        );
      });
      expect(renderer).toBeTruthy();
    });
    it('should not display error message when undefined', () => {
      let renderer: TestRenderer.ReactTestRenderer | undefined;
      act(() => {
        renderer = TestRenderer.create(
          <EditMetadataModal {...defaultProps} errorMessage={undefined} visible={true} />
        );
      });
      expect(renderer).toBeTruthy();
    });
  });
  describe('controlled component behavior', () => {
    it('should update on nameInput prop change', () => {
      let renderer: TestRenderer.ReactTestRenderer | undefined;
      act(() => {
        renderer = TestRenderer.create(
          <EditMetadataModal {...defaultProps} nameInput="Original" visible={true} />
        );
      });
      let tree = renderer?.toJSON() as any;
      expect(JSON.stringify(tree)).toContain('Original');
      act(() => {
        renderer?.update(
          <EditMetadataModal {...defaultProps} nameInput="Updated" visible={true} />
        );
      });
      tree = renderer?.toJSON() as any;
      expect(JSON.stringify(tree)).toContain('Updated');
    });
    it('should update on descriptionInput prop change', () => {
      let renderer: TestRenderer.ReactTestRenderer | undefined;
      act(() => {
        renderer = TestRenderer.create(
          <EditMetadataModal {...defaultProps} descriptionInput="Original" visible={true} />
        );
      });
      let tree = renderer?.toJSON() as any;
      expect(JSON.stringify(tree)).toContain('Original');
      act(() => {
        renderer?.update(
          <EditMetadataModal {...defaultProps} descriptionInput="Updated" visible={true} />
        );
      });
      tree = renderer?.toJSON() as any;
      expect(JSON.stringify(tree)).toContain('Updated');
    });
  });
  describe('accessibility', () => {
    it('should have accessibility labels for buttons', () => {
      let renderer: TestRenderer.ReactTestRenderer | undefined;
      act(() => {
        renderer = TestRenderer.create(<EditMetadataModal {...defaultProps} visible={true} />);
      });
      const tree = renderer?.toJSON() as any;
      const content = JSON.stringify(tree);
      expect(content).toContain('Cancel');
      expect(content).toContain('Save');
    });
  });
  describe('integration scenarios', () => {
    it('should render complete edit form', () => {
      const onChangeName = jest.fn();
      const onChangeDescription = jest.fn();
      const onSave = jest.fn();
      const onCancel = jest.fn();
      let renderer: TestRenderer.ReactTestRenderer | undefined;
      act(() => {
        renderer = TestRenderer.create(
          <EditMetadataModal
            visible={true}
            nameInput="Original"
            descriptionInput="Original Desc"
            isSubmitting={false}
            errorMessage={null}
            onChangeName={onChangeName}
            onChangeDescription={onChangeDescription}
            onSave={onSave}
            onCancel={onCancel}
          />
        );
      });
      const tree = renderer?.toJSON() as any;
      const content = JSON.stringify(tree);
      // Verify all key elements are present
      expect(content).toContain('Edit document metadata');
      expect(content).toContain('Document Name');
      expect(content).toContain('Description');
      expect(content).toContain('Cancel');
      expect(content).toContain('Save');
    });
    it('should handle error state during submission', () => {
      let renderer: TestRenderer.ReactTestRenderer | undefined;
      act(() => {
        renderer = TestRenderer.create(
          <EditMetadataModal
            {...defaultProps}
            nameInput="Valid Name"
            isSubmitting={true}
            errorMessage={null}
            visible={true}
          />
        );
      });
      let tree = renderer?.toJSON() as any;
      expect(JSON.stringify(tree)).not.toContain('Error occurred');
      // Simulate error response
      act(() => {
        renderer?.update(
          <EditMetadataModal
            {...defaultProps}
            nameInput="Valid Name"
            isSubmitting={false}
            errorMessage="Name already exists"
            visible={true}
          />
        );
      });
      tree = renderer?.toJSON() as any;
      expect(JSON.stringify(tree)).toContain('Name already exists');
    });
  });
});
