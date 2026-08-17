/**
 * __tests__/theme/introStyles.test.ts
 *
 * Unit tests for intro/onboarding screen styles.
 */

import { introStyles } from '../../src/theme/styleSections/introStyles';

describe('introStyles', () => {
  it('should export introStyles object', () => {
    expect(introStyles).toBeDefined();
    expect(typeof introStyles).toBe('object');
  });

  it('should match snapshot', () => {
    expect(introStyles).toMatchSnapshot();
  });

  describe('introHero', () => {
    it('should be centered with flexbox', () => {
      expect(introStyles.introHero.alignItems).toBe('center');
    });

    it('should have gap between items', () => {
      expect(introStyles.introHero.gap).toBe(10);
    });

    it('should have vertical padding', () => {
      expect(introStyles.introHero.paddingVertical).toBe(12);
    });
  });

  describe('logoPlaceholder', () => {
    it('should be a square (equal width and height)', () => {
      expect(introStyles.logoPlaceholder.width).toBe(72);
      expect(introStyles.logoPlaceholder.height).toBe(72);
    });

    it('should be circular with borderRadius', () => {
      expect(introStyles.logoPlaceholder.borderRadius).toBe(36);
    });

    it('should have dark background', () => {
      expect(introStyles.logoPlaceholder.backgroundColor).toBe('#111827');
    });

    it('should have border styling', () => {
      expect(introStyles.logoPlaceholder.borderWidth).toBe(1);
      expect(introStyles.logoPlaceholder.borderColor).toBe('#374151');
    });

    it('should center its content', () => {
      expect(introStyles.logoPlaceholder.alignItems).toBe('center');
      expect(introStyles.logoPlaceholder.justifyContent).toBe('center');
    });
  });

  describe('logoPlaceholderText', () => {
    it('should have blue text color', () => {
      expect(introStyles.logoPlaceholderText.color).toBe('#93c5fd');
    });

    it('should have small font with bold weight', () => {
      expect(introStyles.logoPlaceholderText.fontSize).toBe(13);
      expect(introStyles.logoPlaceholderText.fontWeight).toBe('700');
    });
  });

  describe('brand', () => {
    it('should have prominent blue color', () => {
      expect(introStyles.brand.color).toBe('#93c5fd');
    });

    it('should have large bold font', () => {
      expect(introStyles.brand.fontSize).toBe(26);
      expect(introStyles.brand.fontWeight).toBe('800');
    });

    it('should have top margin', () => {
      expect(introStyles.brand.marginTop).toBe(8);
    });
  });

  describe('previewTagline', () => {
    it('should have muted gray color', () => {
      expect(introStyles.previewTagline.color).toBe('#9ca3af');
    });

    it('should have small font size', () => {
      expect(introStyles.previewTagline.fontSize).toBe(13);
    });
  });

  describe('heroCard', () => {
    it('should have border styling', () => {
      expect(introStyles.heroCard.borderWidth).toBe(1);
      expect(introStyles.heroCard.borderColor).toBe('#374151');
    });

    it('should have rounded corners', () => {
      expect(introStyles.heroCard.borderRadius).toBe(16);
    });

    it('should have padding and gap', () => {
      expect(introStyles.heroCard.padding).toBe(16);
      expect(introStyles.heroCard.gap).toBe(12);
    });

    it('should have dark background', () => {
      expect(introStyles.heroCard.backgroundColor).toBe('#111827');
    });
  });

  describe('heroTitle', () => {
    it('should have light text color', () => {
      expect(introStyles.heroTitle.color).toBe('#f9fafb');
    });

    it('should have large bold font', () => {
      expect(introStyles.heroTitle.fontSize).toBe(20);
      expect(introStyles.heroTitle.fontWeight).toBe('800');
    });
  });

  it('should use consistent color palette', () => {
    const darkColor = '#111827';
    const borderColor = '#374151';
    const blueColor = '#93c5fd';

    expect(introStyles.logoPlaceholder.backgroundColor).toBe(darkColor);
    expect(introStyles.heroCard.backgroundColor).toBe(darkColor);
    expect(introStyles.logoPlaceholder.borderColor).toBe(borderColor);
    expect(introStyles.heroCard.borderColor).toBe(borderColor);
    expect(introStyles.logoPlaceholderText.color).toBe(blueColor);
    expect(introStyles.brand.color).toBe(blueColor);
  });

  it('should have valid color values', () => {
    const colorRegex = /^#[0-9a-f]{6}$/i;
    Object.values(introStyles).forEach(style => {
      if (style && typeof style === 'object' && 'color' in style) {
        expect((style as any).color).toMatch(colorRegex);
      }
      if (style && typeof style === 'object' && 'backgroundColor' in style) {
        expect((style as any).backgroundColor).toMatch(colorRegex);
      }
      if (style && typeof style === 'object' && 'borderColor' in style) {
        expect((style as any).borderColor).toMatch(colorRegex);
      }
    });
  });
});

