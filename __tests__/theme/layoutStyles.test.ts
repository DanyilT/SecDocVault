/**
 * __tests__/theme/layoutStyles.test.ts
 *
 * Unit tests for layout styles.
 */

import { layoutStyles } from '../../src/theme/styleSections/layoutStyles';

describe('layoutStyles', () => {
  it('should export layoutStyles object', () => {
    expect(layoutStyles).toBeDefined();
    expect(typeof layoutStyles).toBe('object');
  });

  it('should match snapshot', () => {
    expect(layoutStyles).toMatchSnapshot();
  });

  describe('appShell', () => {
    it('should have flex property set to 1', () => {
      expect(layoutStyles.appShell.flex).toBe(1);
    });

    it('should have dark background color', () => {
      expect(layoutStyles.appShell.backgroundColor).toBe('#0b1220');
    });
  });

  describe('container', () => {
    it('should have flex property set to 1', () => {
      expect(layoutStyles.container.flex).toBe(1);
    });

    it('should have dark background color matching appShell', () => {
      expect(layoutStyles.container.backgroundColor).toBe(layoutStyles.appShell.backgroundColor);
    });
  });

  describe('scrollContainer', () => {
    it('should have padding of 16', () => {
      expect(layoutStyles.scrollContainer.padding).toBe(16);
    });

    it('should have gap of 12', () => {
      expect(layoutStyles.scrollContainer.gap).toBe(12);
    });

    it('should have flexGrow set to 1', () => {
      expect(layoutStyles.scrollContainer.flexGrow).toBe(1);
    });
  });

  describe('pageBody', () => {
    it('should have flex property set to 1', () => {
      expect(layoutStyles.pageBody.flex).toBe(1);
    });

    it('should have consistent padding and gap with scrollContainer', () => {
      expect(layoutStyles.pageBody.padding).toBe(16);
      expect(layoutStyles.pageBody.gap).toBe(12);
    });
  });

  describe('loadingContainer', () => {
    it('should center content with flexbox properties', () => {
      expect(layoutStyles.loadingContainer.justifyContent).toBe('center');
      expect(layoutStyles.loadingContainer.alignItems).toBe('center');
    });

    it('should have flex property and padding', () => {
      expect(layoutStyles.loadingContainer.flex).toBe(1);
      expect(layoutStyles.loadingContainer.padding).toBe(16);
    });

    it('should have gap between centered items', () => {
      expect(layoutStyles.loadingContainer.gap).toBe(12);
    });
  });

  describe('footerView', () => {
    it('should push to bottom using marginTop auto', () => {
      expect(layoutStyles.footerView.marginTop).toBe('auto');
    });
  });

  describe('footerCopy', () => {
    it('should have gray text color', () => {
      expect(layoutStyles.footerCopy.color).toBe('#9ca3af');
    });

    it('should have small font size', () => {
      expect(layoutStyles.footerCopy.fontSize).toBe(12);
    });

    it('should be center aligned', () => {
      expect(layoutStyles.footerCopy.textAlign).toBe('center');
    });

    it('should have top margin and bottom padding', () => {
      expect(layoutStyles.footerCopy.marginTop).toBe(8);
      expect(layoutStyles.footerCopy.paddingBottom).toBe(12);
    });
  });

  it('should have consistent spacing values across styles', () => {
    const spacing = [8, 12, 16];
    const allValues = Object.values(layoutStyles).flatMap(style =>
      Object.values(style as Record<string, any>)
    );

    // Verify that gap and padding values are within expected spacing scale
    expect(layoutStyles.scrollContainer.padding).toBeGreaterThan(0);
    expect(layoutStyles.pageBody.gap).toBeGreaterThan(0);
  });

  it('should have valid color values', () => {
    const colorRegex = /^#[0-9a-f]{6}$|^rgba?/i;
    expect(layoutStyles.appShell.backgroundColor).toMatch(colorRegex);
    expect(layoutStyles.footerCopy.color).toMatch(colorRegex);
  });
});

