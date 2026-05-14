import { styles } from '../../src/theme/styles';
import { overlayStyles } from '../../src/theme/styleComponents/overlayStyles';
import { contentStyles } from '../../src/theme/styleSections/contentStyles';
import { headerStyles } from '../../src/theme/styleSections/headerStyles';
import { interactionStyles } from '../../src/theme/styleSections/interactionStyles';

describe('theme styles', () => {
  it('merges section styles into `styles`', () => {
    // keys coming from different style sections should be present on the merged export
    expect(styles.pageTitle).toBeDefined();
    expect(styles.headerTitle).toBeDefined();
    expect(styles.sectionLabel).toBeDefined();
  });

  it('overlayStyles exports expected tokens', () => {
    expect(overlayStyles).toBeDefined();
    // backdrop should be present and include a semi-transparent background color
    expect(overlayStyles.backdrop).toBeDefined();
    expect(overlayStyles.backdrop.backgroundColor).toMatch(/rgba\(/);
  });

  it('contentStyles contains preview image dimensions and button tokens', () => {
    expect(contentStyles.previewImage).toBeDefined();
    expect(contentStyles.previewImage.width).toBe('100%');
    expect(contentStyles.previewImage.height).toBe(260);
    expect(contentStyles.primaryButton).toBeDefined();
    expect(contentStyles.primaryButton.backgroundColor).toBe('#2563eb');
  });

  it('individual section objects still export expected keys', () => {
    expect(headerStyles.header).toBeDefined();
    expect(headerStyles.headerTitle.color).toBe('#f9fafb');
    expect(interactionStyles.input).toBeDefined();
    expect(interactionStyles.segmentButtonActive.backgroundColor).toBe('#1d4ed8');
  });
});
