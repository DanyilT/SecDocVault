/**
 * __tests__/theme/headerStyles.test.ts
 *
 * Unit tests for header component styles.
 */

import { headerStyles } from '../../src/theme/styleSections/headerStyles';

describe('headerStyles', () => {
  it('should export headerStyles object', () => {
    expect(headerStyles).toBeDefined();
    expect(typeof headerStyles).toBe('object');
  });

  it('should match snapshot', () => {
    expect(headerStyles).toMatchSnapshot();
  });

  describe('header', () => {
    it('should be a row layout with space-between', () => {
      expect(headerStyles.header.flexDirection).toBe('row');
      expect(headerStyles.header.justifyContent).toBe('space-between');
    });

    it('should center items vertically', () => {
      expect(headerStyles.header.alignItems).toBe('center');
    });

    it('should have consistent padding', () => {
      expect(headerStyles.header.paddingHorizontal).toBe(16);
      expect(headerStyles.header.paddingVertical).toBe(12);
    });

    it('should have bottom border', () => {
      expect(headerStyles.header.borderBottomWidth).toBe(1);
      expect(headerStyles.header.borderBottomColor).toBe('#1f2937');
    });

    it('should have dark background', () => {
      expect(headerStyles.header.backgroundColor).toBe('#111827');
    });
  });

  describe('headerTitle', () => {
    it('should have light text color', () => {
      expect(headerStyles.headerTitle.color).toBe('#f9fafb');
    });

    it('should have bold font', () => {
      expect(headerStyles.headerTitle.fontSize).toBe(16);
      expect(headerStyles.headerTitle.fontWeight).toBe('700');
    });
  });

  describe('headerLink', () => {
    it('should have blue link color', () => {
      expect(headerStyles.headerLink.color).toBe('#60a5fa');
    });

    it('should have semi-bold font weight', () => {
      expect(headerStyles.headerLink.fontWeight).toBe('600');
    });

    it('should have small font size', () => {
      expect(headerStyles.headerLink.fontSize).toBe(14);
    });

    it('should have fixed width', () => {
      expect(headerStyles.headerLink.width).toBe(56);
    });
  });

  describe('headerSpacer', () => {
    it('should match headerLink width for alignment', () => {
      expect(headerStyles.headerSpacer.width).toBe(headerStyles.headerLink.width);
    });
  });

  describe('headerLinkMuted', () => {
    it('should have muted gray color', () => {
      expect(headerStyles.headerLinkMuted.color).toBe('#4b5563');
    });

    it('should be applicable to disabled links', () => {
      expect(headerStyles.headerLinkMuted).toBeDefined();
    });
  });

  describe('headerLinkDanger', () => {
    it('should have red color for danger actions', () => {
      expect(headerStyles.headerLinkDanger.color).toBe('#ef4444');
    });

    it('should be applicable to delete/logout links', () => {
      expect(headerStyles.headerLinkDanger).toBeDefined();
    });
  });

  it('should have valid color values', () => {
    const colorRegex = /^#[0-9a-f]{6}$/i;

    expect(headerStyles.header.backgroundColor).toMatch(colorRegex);
    expect(headerStyles.header.borderBottomColor).toMatch(colorRegex);
    expect(headerStyles.headerTitle.color).toMatch(colorRegex);
    expect(headerStyles.headerLink.color).toMatch(colorRegex);
    expect(headerStyles.headerLinkMuted.color).toMatch(colorRegex);
    expect(headerStyles.headerLinkDanger.color).toMatch(colorRegex);
  });

  it('should provide consistent sizing for header action alignment', () => {
    // The spacer and link should have same width for visual balance
    expect(headerStyles.headerLink.width).toBe(56);
    expect(headerStyles.headerSpacer.width).toBe(56);
  });

  it('should define all required style variants', () => {
    expect(headerStyles.header).toBeDefined();
    expect(headerStyles.headerTitle).toBeDefined();
    expect(headerStyles.headerLink).toBeDefined();
    expect(headerStyles.headerSpacer).toBeDefined();
    expect(headerStyles.headerLinkMuted).toBeDefined();
    expect(headerStyles.headerLinkDanger).toBeDefined();
  });
});

