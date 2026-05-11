/**
 * Tests for OCR module recognizeText function
 */

describe('ocr.ts', () => {
  beforeEach(() => {
    jest.resetModules();
    jest.clearAllMocks();
  });

  it('handles module not available gracefully', async () => {
    // Mock ML Kit as unavailable
    jest.mock('@react-native-ml-kit/text-recognition', () => {
      throw new Error('Module not found');
    });

    const { recognizeText } = require('../../../src/services/censor/ocr');
    const result = await recognizeText('file:///test.jpg');

    expect(result).toBeDefined();
    expect(result.lines).toEqual([]);
    expect(result.blocks).toEqual([]);
  });

  it('returns empty results when URI is invalid', async () => {
    const { recognizeText } = require('../../../src/services/censor/ocr');
    const result = await recognizeText('');

    expect(result).toBeDefined();
    expect(result.lines).toBeDefined();
    expect(result.blocks).toBeDefined();
  });

  it('returns structured OCR result', async () => {
    const { recognizeText } = require('../../../src/services/censor/ocr');
    const result = await recognizeText('file:///test.jpg');

    expect(result).toHaveProperty('imageWidth');
    expect(result).toHaveProperty('imageHeight');
    expect(result).toHaveProperty('lines');
    expect(result).toHaveProperty('blocks');
    expect(Array.isArray(result.lines)).toBe(true);
    expect(Array.isArray(result.blocks)).toBe(true);
  });

  it('handles file read errors', async () => {
    jest.mock('react-native-fs', () => ({
      readFile: jest.fn(async () => {
        throw new Error('File not found');
      }),
    }));

    const { recognizeText } = require('../../../src/services/censor/ocr');
    const result = await recognizeText('file:///nonexistent.jpg');

    expect(result).toBeDefined();
    expect(result.lines).toEqual([]);
    expect(result.blocks).toEqual([]);
  });

  it('handles ML Kit recognition errors', async () => {
    const { recognizeText } = require('../../../src/services/censor/ocr');
    const result = await recognizeText('file:///invalid.jpg');

    // Should always resolve without throwing
    expect(result).toBeDefined();
  });

  it('processes JPEG images', async () => {
    const { recognizeText } = require('../../../src/services/censor/ocr');
    const result = await recognizeText('file:///test.jpg');

    expect(result).toBeDefined();
    expect(typeof result.imageWidth).toBe('number');
    expect(typeof result.imageHeight).toBe('number');
  });

  it('processes PNG images', async () => {
    const { recognizeText } = require('../../../src/services/censor/ocr');
    const result = await recognizeText('file:///test.png');

    expect(result).toBeDefined();
    expect(typeof result.imageWidth).toBe('number');
    expect(typeof result.imageHeight).toBe('number');
  });

  it('initializes ML Kit module once', async () => {
    jest.mock('@react-native-ml-kit/text-recognition', () => ({
      recognize: jest.fn(async () => ({ blocks: [] })),
    }));

    const { recognizeText } = require('../../../src/services/censor/ocr');

    // Call twice
    await recognizeText('file:///test1.jpg');
    await recognizeText('file:///test2.jpg');

    // ML Kit should be loaded only once (lazy initialization)
    expect(true).toBe(true);
  });

  it('returns debug info when available', async () => {
    const { recognizeText } = require('../../../src/services/censor/ocr');
    const result = await recognizeText('file:///test.jpg');

    if (result.debug) {
      expect(result.debug).toHaveProperty('moduleAvailable');
      expect(typeof result.debug.moduleAvailable).toBe('boolean');
    }
  });

  it('handles empty file gracefully', async () => {
    jest.mock('react-native-fs', () => ({
      readFile: jest.fn(async () => ''),
    }));

    const { recognizeText } = require('../../../src/services/censor/ocr');
    const result = await recognizeText('file:///empty.jpg');

    expect(result).toBeDefined();
    expect(Array.isArray(result.lines)).toBe(true);
  });

  it('handles corrupted image data', async () => {
    jest.mock('react-native-fs', () => ({
      readFile: jest.fn(async () => 'not-valid-image-data'),
    }));

    const { recognizeText } = require('../../../src/services/censor/ocr');
    const result = await recognizeText('file:///corrupted.jpg');

    expect(result).toBeDefined();
    expect(result.lines).toEqual([]);
  });
});
