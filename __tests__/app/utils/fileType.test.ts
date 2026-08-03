import { canPreviewInApp, getFileCategory, getFileIcon } from '../../../src/utils/fileType';

describe('fileType utils', () => {
  describe('getFileCategory', () => {
    it('classifies images', () => {
      expect(getFileCategory('image/jpeg')).toBe('image');
      expect(getFileCategory('image/png')).toBe('image');
    });

    it('classifies pdf', () => {
      expect(getFileCategory('application/pdf')).toBe('pdf');
    });

    it('classifies text', () => {
      expect(getFileCategory('text/plain')).toBe('text');
      expect(getFileCategory('text/csv')).toBe('text');
    });

    it('classifies office documents', () => {
      expect(getFileCategory('application/msword')).toBe('office');
      expect(
        getFileCategory('application/vnd.openxmlformats-officedocument.wordprocessingml.document'),
      ).toBe('office');
      expect(getFileCategory('application/vnd.ms-excel')).toBe('office');
      expect(
        getFileCategory('application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'),
      ).toBe('office');
      expect(getFileCategory('application/vnd.ms-powerpoint')).toBe('office');
      expect(
        getFileCategory('application/vnd.openxmlformats-officedocument.presentationml.presentation'),
      ).toBe('office');
    });

    it('classifies audio and video', () => {
      expect(getFileCategory('audio/mpeg')).toBe('audio');
      expect(getFileCategory('video/mp4')).toBe('video');
    });

    it('returns unknown for unrecognized or missing types', () => {
      expect(getFileCategory('application/zip')).toBe('unknown');
      expect(getFileCategory(null)).toBe('unknown');
      expect(getFileCategory(undefined)).toBe('unknown');
    });
  });

  describe('canPreviewInApp', () => {
    it('is true for image, pdf, text, audio and video', () => {
      expect(canPreviewInApp('image/png')).toBe(true);
      expect(canPreviewInApp('application/pdf')).toBe(true);
      expect(canPreviewInApp('text/plain')).toBe(true);
      expect(canPreviewInApp('audio/mpeg')).toBe(true);
      expect(canPreviewInApp('video/mp4')).toBe(true);
    });

    it('is false for office and unknown types', () => {
      expect(canPreviewInApp('application/msword')).toBe(false);
      expect(canPreviewInApp('application/zip')).toBe(false);
      expect(canPreviewInApp(null)).toBe(false);
    });
  });

  describe('getFileIcon', () => {
    it('returns a component for every category', () => {
      expect(typeof getFileIcon('image/jpeg')).toBe('function');
      expect(typeof getFileIcon('application/pdf')).toBe('function');
      expect(typeof getFileIcon('text/plain')).toBe('function');
      expect(typeof getFileIcon('application/msword')).toBe('function');
      expect(typeof getFileIcon('audio/mpeg')).toBe('function');
      expect(typeof getFileIcon('video/mp4')).toBe('function');
      expect(typeof getFileIcon('application/zip')).toBe('function');
      expect(typeof getFileIcon(null)).toBe('function');
    });

    it('differentiates excel and powerpoint icons from generic office icon', () => {
      const wordIcon = getFileIcon('application/msword');
      const excelIcon = getFileIcon('application/vnd.ms-excel');
      const pptIcon = getFileIcon('application/vnd.ms-powerpoint');

      expect(excelIcon).not.toBe(wordIcon);
      expect(pptIcon).not.toBe(wordIcon);
      expect(excelIcon).not.toBe(pptIcon);
    });
  });
});
