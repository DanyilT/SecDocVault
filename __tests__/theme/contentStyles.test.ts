/**
 * __tests__/theme/contentStyles.test.ts
 *
 * Unit tests for content-focused styles (cards, labels, buttons, etc).
 */

import { contentStyles } from '../../src/theme/styleSections/contentStyles';

describe('contentStyles', () => {
  it('should export contentStyles object', () => {
    expect(contentStyles).toBeDefined();
    expect(typeof contentStyles).toBe('object');
  });

  it('should match snapshot', () => {
    expect(contentStyles).toMatchSnapshot();
  });

  describe('pageTitle', () => {
    it('should have light text color', () => {
      expect(contentStyles.pageTitle.color).toBe('#f9fafb');
    });

    it('should have large bold font', () => {
      expect(contentStyles.pageTitle.fontSize).toBe(22);
      expect(contentStyles.pageTitle.fontWeight).toBe('700');
    });
  });

  describe('subtitle', () => {
    it('should have muted gray color', () => {
      expect(contentStyles.subtitle.color).toBe('#9ca3af');
    });

    it('should have small font size', () => {
      expect(contentStyles.subtitle.fontSize).toBe(14);
    });

    it('should have bottom margin', () => {
      expect(contentStyles.subtitle.marginBottom).toBe(8);
    });
  });

  describe('card', () => {
    it('should have border styling', () => {
      expect(contentStyles.card.borderWidth).toBe(1);
      expect(contentStyles.card.borderColor).toBe('#374151');
    });

    it('should have rounded corners', () => {
      expect(contentStyles.card.borderRadius).toBe(12);
    });

    it('should have padding and gap', () => {
      expect(contentStyles.card.padding).toBe(14);
      expect(contentStyles.card.gap).toBe(6);
    });

    it('should have dark background', () => {
      expect(contentStyles.card.backgroundColor).toBe('#111827');
    });
  });

  describe('cardTitle and cardMeta', () => {
    it('cardTitle should have light color and bold font', () => {
      expect(contentStyles.cardTitle.color).toBe('#f9fafb');
      expect(contentStyles.cardTitle.fontSize).toBe(16);
      expect(contentStyles.cardTitle.fontWeight).toBe('700');
    });

    it('cardMeta should have gray color and small font', () => {
      expect(contentStyles.cardMeta.color).toBe('#9ca3af');
      expect(contentStyles.cardMeta.fontSize).toBe(13);
    });
  });

  describe('cardActions', () => {
    it('should be a row layout', () => {
      expect(contentStyles.cardActions.flexDirection).toBe('row');
    });

    it('should have gap between actions', () => {
      expect(contentStyles.cardActions.gap).toBe(10);
    });

    it('should have top margin', () => {
      expect(contentStyles.cardActions.marginTop).toBe(6);
    });
  });

  describe('primaryButton', () => {
    it('should have blue background', () => {
      expect(contentStyles.primaryButton.backgroundColor).toBe('#2563eb');
    });

    it('should have rounded corners', () => {
      expect(contentStyles.primaryButton.borderRadius).toBe(12);
    });

    it('should be centered', () => {
      expect(contentStyles.primaryButton.alignItems).toBe('center');
    });

    it('should have padding and top margin', () => {
      expect(contentStyles.primaryButton.paddingVertical).toBe(12);
      expect(contentStyles.primaryButton.marginTop).toBe(4);
    });
  });

  describe('primaryButtonOutline', () => {
    it('should be transparent with blue border', () => {
      expect(contentStyles.primaryButtonOutline.backgroundColor).toBe('transparent');
      expect(contentStyles.primaryButtonOutline.borderWidth).toBe(1);
      expect(contentStyles.primaryButtonOutline.borderColor).toBe('#3b82f6');
    });
  });

  describe('primaryButtonDisabled', () => {
    it('should have gray background for disabled state', () => {
      expect(contentStyles.primaryButtonDisabled.backgroundColor).toBe('#334155');
    });
  });

  describe('primaryButtonDanger', () => {
    it('should have red background for destructive actions', () => {
      expect(contentStyles.primaryButtonDanger.backgroundColor).toBe('#b91c1c');
    });
  });

  describe('primaryButtonText', () => {
    it('should have light text color', () => {
      expect(contentStyles.primaryButtonText.color).toBe('#f8fafc');
    });

    it('should have bold font', () => {
      expect(contentStyles.primaryButtonText.fontWeight).toBe('700');
    });

    it('should have readable font size', () => {
      expect(contentStyles.primaryButtonText.fontSize).toBe(15);
    });
  });

  describe('primaryButtonTextOutline', () => {
    it('should have light blue text for outline variant', () => {
      expect(contentStyles.primaryButtonTextOutline.color).toBe('#93c5fd');
    });
  });

  describe('primaryButtonContent', () => {
    it('should be centered row layout', () => {
      expect(contentStyles.primaryButtonContent.flexDirection).toBe('row');
      expect(contentStyles.primaryButtonContent.alignItems).toBe('center');
      expect(contentStyles.primaryButtonContent.justifyContent).toBe('center');
    });

    it('should have gap between icon and text', () => {
      expect(contentStyles.primaryButtonContent.gap).toBe(6);
    });
  });

  describe('secondaryButton', () => {
    it('should have border styling', () => {
      expect(contentStyles.secondaryButton.borderWidth).toBe(1);
      expect(contentStyles.secondaryButton.borderColor).toBe('#475569');
    });

    it('should have rounded corners', () => {
      expect(contentStyles.secondaryButton.borderRadius).toBe(10);
    });

    it('should have padding', () => {
      expect(contentStyles.secondaryButton.paddingVertical).toBe(8);
      expect(contentStyles.secondaryButton.paddingHorizontal).toBe(14);
    });
  });

  describe('secondaryButtonText', () => {
    it('should have light gray text color', () => {
      expect(contentStyles.secondaryButtonText.color).toBe('#cbd5e1');
    });

    it('should have semi-bold font weight', () => {
      expect(contentStyles.secondaryButtonText.fontWeight).toBe('600');
    });
  });

  describe('previewLabel', () => {
    it('should have light blue color', () => {
      expect(contentStyles.previewLabel.color).toBe('#93c5fd');
    });

    it('should have bold font', () => {
      expect(contentStyles.previewLabel.fontWeight).toBe('700');
    });

    it('should have small font size', () => {
      expect(contentStyles.previewLabel.fontSize).toBe(13);
    });
  });

  describe('hashBlock', () => {
    it('should have monospace font for code display', () => {
      expect(contentStyles.hashBlock.fontFamily).toBe('Courier');
    });

    it('should have blue text on dark background', () => {
      expect(contentStyles.hashBlock.color).toBe('#93c5fd');
      expect(contentStyles.hashBlock.backgroundColor).toBe('#111827');
    });

    it('should have border and rounded corners', () => {
      expect(contentStyles.hashBlock.borderRadius).toBe(10);
      expect(contentStyles.hashBlock.borderWidth).toBe(1);
      expect(contentStyles.hashBlock.borderColor).toBe('#374151');
    });

    it('should have padding', () => {
      expect(contentStyles.hashBlock.padding).toBe(12);
    });
  });

  describe('previewText', () => {
    it('should have light gray text color', () => {
      expect(contentStyles.previewText.color).toBe('#d1d5db');
    });

    it('should have readable font size', () => {
      expect(contentStyles.previewText.fontSize).toBe(14);
    });
  });

  describe('previewImage', () => {
    it('should be full width with fixed height', () => {
      expect(contentStyles.previewImage.width).toBe('100%');
      expect(contentStyles.previewImage.height).toBe(260);
    });

    it('should have rounded corners and border', () => {
      expect(contentStyles.previewImage.borderRadius).toBe(12);
      expect(contentStyles.previewImage.borderWidth).toBe(1);
      expect(contentStyles.previewImage.borderColor).toBe('#334155');
    });

    it('should have dark background', () => {
      expect(contentStyles.previewImage.backgroundColor).toBe('#111827');
    });
  });

  describe('backupStatus', () => {
    it('should have blue text color', () => {
      expect(contentStyles.backupStatus.color).toBe('#93c5fd');
    });

    it('should have readable font size', () => {
      expect(contentStyles.backupStatus.fontSize).toBe(14);
    });

    it('should have top margin', () => {
      expect(contentStyles.backupStatus.marginTop).toBe(6);
    });
  });

  describe('previewActionsWrap', () => {
    it('should wrap items horizontally', () => {
      expect(contentStyles.previewActionsWrap.flexDirection).toBe('row');
      expect(contentStyles.previewActionsWrap.flexWrap).toBe('wrap');
    });

    it('should have gap between items', () => {
      expect(contentStyles.previewActionsWrap.gap).toBe(8);
    });

    it('should have top margin', () => {
      expect(contentStyles.previewActionsWrap.marginTop).toBe(6);
    });
  });

  describe('previewActionButton', () => {
    it('should have minimum width and flex grow', () => {
      expect(contentStyles.previewActionButton.minWidth).toBe(150);
      expect(contentStyles.previewActionButton.flexGrow).toBe(1);
    });

    it('should not have top margin', () => {
      expect(contentStyles.previewActionButton.marginTop).toBe(0);
    });
  });

  describe('footerActions and settingsCardGap', () => {
    it('footerActions should have top margin', () => {
      expect(contentStyles.footerActions.marginTop).toBe(4);
    });

    it('settingsCardGap should have gap', () => {
      expect(contentStyles.settingsCardGap.gap).toBe(10);
    });
  });

  describe('settingsStatus and settingsNote', () => {
    it('settingsStatus should have light gray color', () => {
      expect(contentStyles.settingsStatus.color).toBe('#cbd5e1');
      expect(contentStyles.settingsStatus.fontSize).toBe(14);
    });

    it('settingsNote should have muted gray color', () => {
      expect(contentStyles.settingsNote.color).toBe('#9ca3af');
      expect(contentStyles.settingsNote.fontSize).toBe(13);
    });
  });

  it('should have consistent dark theme colors', () => {
    const darkBg = '#111827';
    const borderColor = '#374151';

    expect(contentStyles.card.backgroundColor).toBe(darkBg);
    expect(contentStyles.previewImage.backgroundColor).toBe(darkBg);
    expect(contentStyles.hashBlock.backgroundColor).toBe(darkBg);

    expect(contentStyles.card.borderColor).toBe(borderColor);
    expect(contentStyles.hashBlock.borderColor).toBe(borderColor);
  });

  it('should have valid color values', () => {
    const colorRegex = /^#[0-9a-f]{6}$|^transparent$/i;

    const colorProps = [
      contentStyles.pageTitle,
      contentStyles.subtitle,
      contentStyles.card,
      contentStyles.cardTitle,
      contentStyles.cardMeta,
      contentStyles.primaryButton,
      contentStyles.primaryButtonDisabled,
      contentStyles.primaryButtonDanger,
      contentStyles.primaryButtonText,
      contentStyles.secondaryButton,
      contentStyles.previewLabel,
      contentStyles.hashBlock,
      contentStyles.previewText,
      contentStyles.previewImage,
      contentStyles.backupStatus,
      contentStyles.settingsStatus,
      contentStyles.settingsNote,
    ];

    colorProps.forEach(style => {
      if (style && 'color' in style && (style as any).color) {
        expect((style as any).color).toMatch(colorRegex);
      }
      if (style && 'backgroundColor' in style && (style as any).backgroundColor) {
        expect((style as any).backgroundColor).toMatch(colorRegex);
      }
      if (style && 'borderColor' in style && (style as any).borderColor) {
        expect((style as any).borderColor).toMatch(colorRegex);
      }
    });
  });
});

