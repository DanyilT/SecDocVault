/**
 * __tests__/app/controllers/index.test.ts
 *
 * Unit tests for controllers barrel exports.
 */

describe('controllers barrel exports', () => {
  it('should export useAppController', () => {
    const exports = require('../../../src/app/controllers/index');
    expect(exports.useAppController).toBeDefined();
  });

  it('useAppController should be a function', () => {
    const exports = require('../../../src/app/controllers/index');
    expect(typeof exports.useAppController).toBe('function');
  });

  it('should have all required exports', () => {
    const exports = require('../../../src/app/controllers/index');
    const requiredExports = ['useAppController'];

    requiredExports.forEach(exportName => {
      expect(exports).toHaveProperty(exportName);
    });
  });

  it('should not have duplicate exports', () => {
    const exports = require('../../../src/app/controllers/index');
    const exportNames = Object.keys(exports);
    const uniqueExports = new Set(exportNames);

    expect(exportNames.length).toBe(uniqueExports.size);
  });
});


