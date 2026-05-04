/**
 * Tests for app/navigation/constants.ts
 */

import { APP_SCREEN_TITLES, RECOVERY_SUB_SCREENS } from '../../../src/app/navigation/constants';
import type { AppScreen } from '../../../src/app/navigation/constants';

describe('APP_SCREEN_TITLES', () => {
  const expectedScreens: AppScreen[] = [
    'main', 'settings', 'recoverkeys', 'recoverydocs',
    'sharedetails', 'preview', 'upload', 'share',
  ];

  test('has a title for every AppScreen variant', () => {
    for (const screen of expectedScreens) {
      expect(APP_SCREEN_TITLES[screen]).toBeTruthy();
      expect(typeof APP_SCREEN_TITLES[screen]).toBe('string');
    }
  });

  test('main screen title is "Documents"', () => {
    expect(APP_SCREEN_TITLES.main).toBe('Documents');
  });

  test('settings screen title is "Settings"', () => {
    expect(APP_SCREEN_TITLES.settings).toBe('Settings');
  });

  test('recoverkeys screen title is "Recover Keys"', () => {
    expect(APP_SCREEN_TITLES.recoverkeys).toBe('Recover Keys');
  });
});

describe('RECOVERY_SUB_SCREENS', () => {
  test('contains recoverkeys', () => {
    expect(RECOVERY_SUB_SCREENS).toContain('recoverkeys');
  });

  test('contains recoverydocs', () => {
    expect(RECOVERY_SUB_SCREENS).toContain('recoverydocs');
  });

  test('is a readonly tuple with 2 entries', () => {
    expect(RECOVERY_SUB_SCREENS).toHaveLength(2);
  });
});

