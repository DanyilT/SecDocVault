/**
 * __tests__/theme/overlayStyles.test.ts
 *
 * Unit tests for overlay component styles (modals, toasts, etc).
 */

import { overlayStyles } from '../../src/theme/styleComponents/overlayStyles';

describe('overlayStyles', () => {
  it('should export overlayStyles object', () => {
    expect(overlayStyles).toBeDefined();
    expect(typeof overlayStyles).toBe('object');
  });

  it('should match snapshot', () => {
    expect(overlayStyles).toMatchSnapshot();
  });

  describe('backdrop', () => {
    it('should be absolutely positioned overlay', () => {
      expect(overlayStyles.backdrop.position).toBe('absolute');
      expect(overlayStyles.backdrop.top).toBe(0);
      expect(overlayStyles.backdrop.right).toBe(0);
      expect(overlayStyles.backdrop.bottom).toBe(0);
      expect(overlayStyles.backdrop.left).toBe(0);
    });

    it('should have semi-transparent dark background', () => {
      expect(overlayStyles.backdrop.backgroundColor).toBe('rgba(3,7,18,0.65)');
    });

    it('should center content with flexbox', () => {
      expect(overlayStyles.backdrop.alignItems).toBe('center');
      expect(overlayStyles.backdrop.justifyContent).toBe('center');
    });

    it('should have padding', () => {
      expect(overlayStyles.backdrop.padding).toBe(20);
    });
  });

  describe('keyBackupCard', () => {
    it('should be full width with max width constraint', () => {
      expect(overlayStyles.keyBackupCard.width).toBe('100%');
      expect(overlayStyles.keyBackupCard.maxWidth).toBe(360);
    });

    it('should have gap between elements', () => {
      expect(overlayStyles.keyBackupCard.gap).toBe(12);
    });
  });

  describe('discardCard', () => {
    it('should be full width with max width constraint', () => {
      expect(overlayStyles.discardCard.width).toBe('100%');
      expect(overlayStyles.discardCard.maxWidth).toBe(340);
    });

    it('should have gap between elements', () => {
      expect(overlayStyles.discardCard.gap).toBe(12);
    });

    it('should be narrower than keyBackupCard', () => {
      expect(overlayStyles.discardCard.maxWidth).toBeLessThan(overlayStyles.keyBackupCard.maxWidth as number);
    });
  });

  describe('actionButton and actionButtonNoTopMargin', () => {
    it('actionButton should flex equally and be centered', () => {
      expect(overlayStyles.actionButton.flex).toBe(1);
      expect(overlayStyles.actionButton.alignItems).toBe('center');
      expect(overlayStyles.actionButton.justifyContent).toBe('center');
    });

    it('actionButton should have minimum height', () => {
      expect(overlayStyles.actionButton.minHeight).toBe(44);
    });

    it('actionButtonNoTopMargin should have same flex and centering', () => {
      expect(overlayStyles.actionButtonNoTopMargin.flex).toBe(1);
      expect(overlayStyles.actionButtonNoTopMargin.alignItems).toBe('center');
      expect(overlayStyles.actionButtonNoTopMargin.justifyContent).toBe('center');
    });

    it('actionButtonNoTopMargin should have same minimum height', () => {
      expect(overlayStyles.actionButtonNoTopMargin.minHeight).toBe(44);
    });

    it('actionButtonNoTopMargin should explicitly disable top margin', () => {
      expect(overlayStyles.actionButtonNoTopMargin.marginTop).toBe(0);
    });
  });

  describe('actionButtonLabel', () => {
    it('should center text and be full width', () => {
      expect(overlayStyles.actionButtonLabel.textAlign).toBe('center');
      expect(overlayStyles.actionButtonLabel.width).toBe('100%');
    });
  });

  describe('discardWarningRow', () => {
    it('should be a row layout', () => {
      expect(overlayStyles.discardWarningRow.flexDirection).toBe('row');
    });

    it('should center items vertically', () => {
      expect(overlayStyles.discardWarningRow.alignItems).toBe('center');
    });

    it('should have gap between checkbox and label', () => {
      expect(overlayStyles.discardWarningRow.gap).toBe(10);
    });

    it('should have top margin', () => {
      expect(overlayStyles.discardWarningRow.marginTop).toBe(2);
    });
  });

  describe('discardWarningCheckbox and discardWarningCheckboxChecked', () => {
    it('should be a small square with blue border', () => {
      expect(overlayStyles.discardWarningCheckbox.width).toBe(20);
      expect(overlayStyles.discardWarningCheckbox.height).toBe(20);
      expect(overlayStyles.discardWarningCheckbox.borderRadius).toBe(4);
      expect(overlayStyles.discardWarningCheckbox.borderWidth).toBe(1);
      expect(overlayStyles.discardWarningCheckbox.borderColor).toBe('#60a5fa');
    });

    it('should center content', () => {
      expect(overlayStyles.discardWarningCheckbox.alignItems).toBe('center');
      expect(overlayStyles.discardWarningCheckbox.justifyContent).toBe('center');
    });

    it('checked state should have blue background', () => {
      expect(overlayStyles.discardWarningCheckboxChecked.backgroundColor).toBe('#2563eb');
    });
  });

  describe('discardWarningCheckboxText', () => {
    it('should have white text color', () => {
      expect(overlayStyles.discardWarningCheckboxText.color).toBe('#fff');
    });

    it('should have small bold font', () => {
      expect(overlayStyles.discardWarningCheckboxText.fontSize).toBe(12);
      expect(overlayStyles.discardWarningCheckboxText.fontWeight).toBe('800');
    });
  });

  describe('discardWarningLabel', () => {
    it('should have light gray text color', () => {
      expect(overlayStyles.discardWarningLabel.color).toBe('#d1d5db');
    });

    it('should have readable font size', () => {
      expect(overlayStyles.discardWarningLabel.fontSize).toBe(14);
    });

    it('should have line height for readability', () => {
      expect(overlayStyles.discardWarningLabel.lineHeight).toBe(18);
    });

    it('should shrink to fit text', () => {
      expect(overlayStyles.discardWarningLabel.flexShrink).toBe(1);
    });
  });

  it('should define all required style keys', () => {
    const requiredKeys = [
      'backdrop',
      'keyBackupCard',
      'discardCard',
      'actionButton',
      'actionButtonNoTopMargin',
      'actionButtonLabel',
      'discardWarningRow',
      'discardWarningCheckbox',
      'discardWarningCheckboxChecked',
      'discardWarningCheckboxText',
      'discardWarningLabel',
    ];

    requiredKeys.forEach(key => {
      expect(overlayStyles).toHaveProperty(key);
    });
  });

  it('should use consistent overlay styling', () => {
    const blueColor = '#60a5fa';
    const blueActive = '#2563eb';

    expect(overlayStyles.discardWarningCheckbox.borderColor).toBe(blueColor);
    expect(overlayStyles.discardWarningCheckboxChecked.backgroundColor).toBe(blueActive);
  });

  it('should have valid color values', () => {
    const colorRegex = /^#[0-9a-f]{6}$|^rgba?\(.*\)$|^#fff$/i;

    const colorStyles = [
      overlayStyles.backdrop,
      overlayStyles.discardWarningCheckbox,
      overlayStyles.discardWarningCheckboxChecked,
      overlayStyles.discardWarningCheckboxText,
      overlayStyles.discardWarningLabel,
    ];

    colorStyles.forEach(style => {
      if (style && 'backgroundColor' in style && (style as any).backgroundColor) {
        expect((style as any).backgroundColor).toMatch(colorRegex);
      }
      if (style && 'borderColor' in style && (style as any).borderColor) {
        expect((style as any).borderColor).toMatch(colorRegex);
      }
      if (style && 'color' in style && (style as any).color) {
        expect((style as any).color).toMatch(colorRegex);
      }
    });
  });

  it('should maintain consistent sizing for card components', () => {
    // Both cards should have responsive sizing
    expect(overlayStyles.keyBackupCard.width).toBe('100%');
    expect(overlayStyles.discardCard.width).toBe('100%');

    // Both should have max width constraints
    expect(typeof overlayStyles.keyBackupCard.maxWidth).toBe('number');
    expect(typeof overlayStyles.discardCard.maxWidth).toBe('number');
  });
});

