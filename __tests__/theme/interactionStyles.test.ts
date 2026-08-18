/**
 * __tests__/theme/interactionStyles.test.ts
 *
 * Unit tests for interaction-related styles (buttons, inputs, etc).
 */

import { interactionStyles } from '../../src/theme/styleSections/interactionStyles';

describe('interactionStyles', () => {
  it('should export interactionStyles object', () => {
    expect(interactionStyles).toBeDefined();
    expect(typeof interactionStyles).toBe('object');
  });

  it('should match snapshot', () => {
    expect(interactionStyles).toMatchSnapshot();
  });

  describe('fieldGroup and securityGroup', () => {
    it('should have consistent gap', () => {
      expect(interactionStyles.fieldGroup.gap).toBe(10);
      expect(interactionStyles.securityGroup.gap).toBe(10);
    });
  });

  describe('sectionLabel', () => {
    it('should have light text color', () => {
      expect(interactionStyles.sectionLabel.color).toBe('#f9fafb');
    });

    it('should have bold font', () => {
      expect(interactionStyles.sectionLabel.fontSize).toBe(14);
      expect(interactionStyles.sectionLabel.fontWeight).toBe('700');
    });
  });

  describe('securityRow', () => {
    it('should be a row layout', () => {
      expect(interactionStyles.securityRow.flexDirection).toBe('row');
    });

    it('should have gap between items', () => {
      expect(interactionStyles.securityRow.gap).toBe(8);
    });

    it('should wrap on overflow', () => {
      expect(interactionStyles.securityRow.flexWrap).toBe('wrap');
    });
  });

  describe('input', () => {
    it('should have border styling', () => {
      expect(interactionStyles.input.borderWidth).toBe(1);
      expect(interactionStyles.input.borderColor).toBe('#374151');
    });

    it('should have rounded corners', () => {
      expect(interactionStyles.input.borderRadius).toBe(12);
    });

    it('should have light text color', () => {
      expect(interactionStyles.input.color).toBe('#f9fafb');
    });

    it('should have dark background', () => {
      expect(interactionStyles.input.backgroundColor).toBe('#111827');
    });

    it('should have consistent padding', () => {
      expect(interactionStyles.input.paddingHorizontal).toBe(14);
      expect(interactionStyles.input.paddingVertical).toBe(12);
    });

    it('should have readable font size', () => {
      expect(interactionStyles.input.fontSize).toBe(15);
    });
  });

  describe('segmentRow and actionRow', () => {
    it('should both be row layouts', () => {
      expect(interactionStyles.segmentRow.flexDirection).toBe('row');
      expect(interactionStyles.actionRow.flexDirection).toBe('row');
    });

    it('should have gap between items', () => {
      expect(interactionStyles.segmentRow.gap).toBe(10);
      expect(interactionStyles.actionRow.gap).toBe(10);
    });

    it('segmentRow should have bottom margin', () => {
      expect(interactionStyles.segmentRow.marginBottom).toBe(6);
    });
  });

  describe('segmentButton and segmentButtonActive', () => {
    it('should have flex layout for equal width', () => {
      expect(interactionStyles.segmentButton.flex).toBe(1);
    });

    it('should have border styling', () => {
      expect(interactionStyles.segmentButton.borderWidth).toBe(1);
      expect(interactionStyles.segmentButton.borderColor).toBe('#374151');
    });

    it('should have rounded corners', () => {
      expect(interactionStyles.segmentButton.borderRadius).toBe(10);
    });

    it('should have padding and be centered', () => {
      expect(interactionStyles.segmentButton.paddingVertical).toBe(10);
      expect(interactionStyles.segmentButton.alignItems).toBe('center');
    });

    it('should have dark background', () => {
      expect(interactionStyles.segmentButton.backgroundColor).toBe('#111827');
    });

    it('active state should use blue colors', () => {
      expect(interactionStyles.segmentButtonActive.borderColor).toBe('#3b82f6');
      expect(interactionStyles.segmentButtonActive.backgroundColor).toBe('#1d4ed8');
    });
  });

  describe('segmentText and segmentTextActive', () => {
    it('should have appropriate colors', () => {
      expect(interactionStyles.segmentText.color).toBe('#d1d5db');
      expect(interactionStyles.segmentTextActive.color).toBe('#f9fafb');
    });

    it('should have semi-bold font weight', () => {
      expect(interactionStyles.segmentText.fontWeight).toBe('600');
    });
  });

  describe('switchRow', () => {
    it('should be a row layout with space-between', () => {
      expect(interactionStyles.switchRow.flexDirection).toBe('row');
      expect(interactionStyles.switchRow.justifyContent).toBe('space-between');
    });

    it('should center items vertically', () => {
      expect(interactionStyles.switchRow.alignItems).toBe('center');
    });

    it('should have border styling', () => {
      expect(interactionStyles.switchRow.borderWidth).toBe(1);
      expect(interactionStyles.switchRow.borderColor).toBe('#374151');
    });

    it('should have rounded corners', () => {
      expect(interactionStyles.switchRow.borderRadius).toBe(12);
    });

    it('should have padding', () => {
      expect(interactionStyles.switchRow.paddingHorizontal).toBe(12);
      expect(interactionStyles.switchRow.paddingVertical).toBe(10);
    });

    it('should have dark background', () => {
      expect(interactionStyles.switchRow.backgroundColor).toBe('#111827');
    });
  });

  describe('switchLabel', () => {
    it('should have light text color', () => {
      expect(interactionStyles.switchLabel.color).toBe('#e5e7eb');
    });

    it('should have flex and margin for spacing', () => {
      expect(interactionStyles.switchLabel.flex).toBe(1);
      expect(interactionStyles.switchLabel.marginRight).toBe(12);
    });

    it('should have readable font size', () => {
      expect(interactionStyles.switchLabel.fontSize).toBe(14);
    });
  });

  describe('warningText', () => {
    it('should have amber/warning color', () => {
      expect(interactionStyles.warningText.color).toBe('#fbbf24');
    });

    it('should have small font size', () => {
      expect(interactionStyles.warningText.fontSize).toBe(13);
    });
  });

  describe('errorText', () => {
    it('should have red error color', () => {
      expect(interactionStyles.errorText.color).toBe('#fca5a5');
    });

    it('should have small font size', () => {
      expect(interactionStyles.errorText.fontSize).toBe(13);
    });

    it('should have top margin', () => {
      expect(interactionStyles.errorText.marginTop).toBe(4);
    });
  });

  it('should use consistent color palette for states', () => {
    const darkBg = '#111827';
    const borderColor = '#374151';
    const blueActive = '#3b82f6';
    const warningColor = '#fbbf24';
    const errorColor = '#fca5a5';

    expect(interactionStyles.input.backgroundColor).toBe(darkBg);
    expect(interactionStyles.segmentButton.backgroundColor).toBe(darkBg);
    expect(interactionStyles.switchRow.backgroundColor).toBe(darkBg);

    expect(interactionStyles.input.borderColor).toBe(borderColor);
    expect(interactionStyles.segmentButton.borderColor).toBe(borderColor);

    expect(interactionStyles.segmentButtonActive.borderColor).toBe(blueActive);
    expect(interactionStyles.warningText.color).toBe(warningColor);
    expect(interactionStyles.errorText.color).toBe(errorColor);
  });

  it('should have valid color values', () => {
    const colorRegex = /^#[0-9a-f]{6}$/i;
    const allowedProps = ['color', 'backgroundColor', 'borderColor'];

    Object.values(interactionStyles).forEach(style => {
      if (style && typeof style === 'object') {
        allowedProps.forEach(prop => {
          if (prop in style && (style as any)[prop]) {
            expect((style as any)[prop]).toMatch(colorRegex);
          }
        });
      }
    });
  });
});

