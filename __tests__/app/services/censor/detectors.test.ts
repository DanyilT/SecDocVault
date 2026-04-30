import { detectSensitiveSpans } from '../../../../src/services/censor/detectors';

describe('detectSensitiveSpans', () => {
  it('detects emails', () => {
    expect(
      detectSensitiveSpans('contact me at john.doe@example.com please').some(
        s => s.category === 'email' && s.text === 'john.doe@example.com',
      ),
    ).toBe(true);
  });

  it('detects emails with OCR-introduced stray "(" before @', () => {
    expect(
      detectSensitiveSpans('email me at artemsa223(@gmail.com today').some(
        s => s.category === 'email',
      ),
    ).toBe(true);
  });

  it('detects emails where OCR replaced @ with "("', () => {
    expect(
      detectSensitiveSpans('write to artemsa223(gmail.com soon').some(
        s => s.category === 'email',
      ),
    ).toBe(true);
  });

  it('detects valid Luhn credit cards', () => {
    expect(
      detectSensitiveSpans('Card: 4242 4242 4242 4242 thanks').some(
        s => s.category === 'creditCard',
      ),
    ).toBe(true);
  });

  it('rejects non-Luhn 16-digit runs', () => {
    expect(
      detectSensitiveSpans('Order ref 1234567890123456 here').some(
        s => s.category === 'creditCard',
      ),
    ).toBe(false);
  });

  it('detects Cyrillic keywords', () => {
    expect(
      detectSensitiveSpans('Мій паспорт лежить вдома').some(
        s => s.category === 'keyword' && s.text.toLowerCase() === 'паспорт',
      ),
    ).toBe(true);
  });

  it('detects Ukrainian tax ids', () => {
    expect(
      detectSensitiveSpans('ІПН 1234567890 ще раз').some(
        s =>
          (s.category === 'taxId' || s.category === 'phone') &&
          s.text.includes('1234567890'),
      ),
    ).toBe(true);
  });

  it('returns empty for benign text', () => {
    const spans = detectSensitiveSpans(
      'Hello world, this is a normal sentence.',
    );
    expect(spans.some(s => s.category === 'email')).toBe(false);
    expect(spans.some(s => s.category === 'keyword')).toBe(false);
    expect(spans.some(s => s.category === 'creditCard')).toBe(false);
  });

  it('produces sorted, non-overlapping spans', () => {
    const spans = detectSensitiveSpans('email a@b.co and pass passport');
    for (let i = 1; i < spans.length; i++) {
      expect(spans[i].start).toBeGreaterThanOrEqual(spans[i - 1].end);
    }
  });
});

