/**
 * Tests for services/connectivity.ts
 */

import {
  hasInternetAccess,
  assertInternetAccess,
  NO_INTERNET_MESSAGE,
} from '../../../src/services/connectivity';

const mockFetch = jest.fn();
global.fetch = mockFetch;

beforeEach(() => {
  jest.clearAllMocks();
});

describe('NO_INTERNET_MESSAGE', () => {
  test('is the expected constant string', () => {
    expect(NO_INTERNET_MESSAGE).toBe('no internet access');
  });
});

describe('hasInternetAccess', () => {
  test('returns true when fetch responds with status 204', async () => {
    mockFetch.mockResolvedValueOnce({ ok: false, status: 204 });
    const result = await hasInternetAccess();
    expect(result).toBe(true);
  });

  test('returns true when fetch responds with ok: true', async () => {
    mockFetch.mockResolvedValueOnce({ ok: true, status: 200 });
    const result = await hasInternetAccess();
    expect(result).toBe(true);
  });

  test('returns false when fetch throws an error', async () => {
    mockFetch.mockRejectedValueOnce(new Error('Network error'));
    const result = await hasInternetAccess();
    expect(result).toBe(false);
  });

  test('returns false when fetch responds with non-ok, non-204 status', async () => {
    mockFetch.mockResolvedValueOnce({ ok: false, status: 500 });
    const result = await hasInternetAccess();
    expect(result).toBe(false);
  });

  test('times out and returns false when fetch never resolves within timeout', async () => {
    mockFetch.mockImplementationOnce(
      () => new Promise(resolve => setTimeout(resolve, 10000)),
    );
    const result = await hasInternetAccess(50);
    expect(result).toBe(false);
  }, 3000);

  test('uses HEAD method for the connectivity check URL', async () => {
    mockFetch.mockResolvedValueOnce({ ok: true, status: 200 });
    await hasInternetAccess();
    expect(mockFetch).toHaveBeenCalledWith(
      expect.stringContaining('generate_204'),
      expect.objectContaining({ method: 'HEAD' }),
    );
  });
});

describe('assertInternetAccess', () => {
  test('resolves when there is internet access', async () => {
    mockFetch.mockResolvedValueOnce({ ok: true, status: 200 });
    await expect(assertInternetAccess()).resolves.toBeUndefined();
  });

  test('throws NO_INTERNET_MESSAGE when there is no internet access', async () => {
    mockFetch.mockRejectedValueOnce(new Error('offline'));
    await expect(assertInternetAccess()).rejects.toThrow(NO_INTERNET_MESSAGE);
  });
});

