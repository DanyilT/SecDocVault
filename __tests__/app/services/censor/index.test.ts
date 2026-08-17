/**
 * __tests__/app/services/censor/index.test.ts
 */
describe('censor service barrel exports', () => {
  it('should export detectSensitiveSpans from detectors module', () => {
    const exports = require('../../../../src/services/censor/index');
    expect(exports.detectSensitiveSpans).toBeDefined();
  });
  it('should export censorImage from censorImage module', () => {
    const exports = require('../../../../src/services/censor/index');
    expect(exports.censorImage).toBeDefined();
  });
  it('should export recognizeText from ocr module', () => {
    const exports = require('../../../../src/services/censor/index');
    expect(exports.recognizeText).toBeDefined();
  });
  it('should have all required runtime exports', () => {
    const exports = require('../../../../src/services/censor/index');
    const requiredExports = ['detectSensitiveSpans', 'censorImage', 'recognizeText'];
    requiredExports.forEach(exportName => {
      expect(exports).toHaveProperty(exportName);
    });
  });
  it('should not have duplicate exports', () => {
    const exports = require('../../../../src/services/censor/index');
    const exportNames = Object.keys(exports);
    const uniqueExports = new Set(exportNames);
    expect(exportNames.length).toBe(uniqueExports.size);
  });
});
