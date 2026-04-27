jest.mock('../../../../src/services/censor/ocr', () => ({
  recognizeText: jest.fn(),
}));

import { censorImage } from '../../../../src/services/censor/censorImage';
import { recognizeText } from '../../../../src/services/censor/ocr';

const recognizeTextMock = recognizeText as jest.MockedFunction<
  typeof recognizeText
>;

describe('censorImage', () => {
  beforeEach(() => recognizeTextMock.mockReset());

  it('returns no boxes when OCR finds nothing sensitive', async () => {
    recognizeTextMock.mockResolvedValue({
      imageWidth: 100,
      imageHeight: 100,
      lines: [
        {
          text: 'hello world',
          box: { x: 0, y: 0, width: 50, height: 10 },
          words: [
            { text: 'hello', box: { x: 0, y: 0, width: 20, height: 10 } },
            { text: 'world', box: { x: 25, y: 0, width: 25, height: 10 } },
          ],
        },
      ],
      blocks: [],
    });
    const r = await censorImage('file://x.png');
    expect(r.imageWidth).toBe(100);
    expect(r.boxes).toHaveLength(0);
  });

  it('unions word boxes for a span across multiple words', async () => {
    recognizeTextMock.mockResolvedValue({
      imageWidth: 200,
      imageHeight: 100,
      lines: [
        {
          text: 'mail a@b.co',
          box: { x: 0, y: 0, width: 110, height: 20 },
          words: [
            { text: 'mail', box: { x: 0, y: 5, width: 40, height: 15 } },
            { text: 'a@b.co', box: { x: 50, y: 0, width: 60, height: 20 } },
          ],
        },
      ],
      blocks: [],
    });
    const r = await censorImage('file://x.png');
    expect(r.boxes).toHaveLength(1);
    expect(r.boxes[0]).toMatchObject({
      category: 'email',
      x: 50,
      y: 0,
      width: 60,
      height: 20,
    });
  });

  it('catches an email split across two OCR lines via the per-block pass', async () => {
    const lineA = {
      text: 'contact john.doe@example.',
      box: { x: 0, y: 0, width: 200, height: 20 },
      words: [
        { text: 'contact', box: { x: 0, y: 0, width: 60, height: 20 } },
        {
          text: 'john.doe@example.',
          box: { x: 70, y: 0, width: 130, height: 20 },
        },
      ],
    };
    const lineB = {
      text: 'com today',
      box: { x: 0, y: 25, width: 80, height: 20 },
      words: [
        { text: 'com', box: { x: 0, y: 25, width: 30, height: 20 } },
        { text: 'today', box: { x: 35, y: 25, width: 45, height: 20 } },
      ],
    };
    recognizeTextMock.mockResolvedValue({
      imageWidth: 300,
      imageHeight: 100,
      lines: [lineA, lineB],
      blocks: [
        {
          text: 'contact john.doe@example.\ncom today',
          box: { x: 0, y: 0, width: 300, height: 50 },
          lines: [lineA, lineB],
        },
      ],
    });
    const r = await censorImage('file://x.png');
    expect(r.boxes.some(b => b.category === 'email')).toBe(true);
  });
});

