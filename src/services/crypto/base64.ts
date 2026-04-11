const BASE64_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';

/**
 * Encodes bytes to Base64 without depending on runtime-specific Buffer shims.
 */
export function encodeBase64(bytes: Uint8Array): string {
  if (bytes.length === 0) {
    return '';
  }

  let output = '';

  for (let index = 0; index < bytes.length; index += 3) {
    const first = bytes[index];
    const second = index + 1 < bytes.length ? bytes[index + 1] : 0;
    const third = index + 2 < bytes.length ? bytes[index + 2] : 0;

    const triple = (first << 16) | (second << 8) | third;

    output += BASE64_ALPHABET[(triple >> 18) & 0x3f];
    output += BASE64_ALPHABET[(triple >> 12) & 0x3f];
    output += index + 1 < bytes.length ? BASE64_ALPHABET[(triple >> 6) & 0x3f] : '=';
    output += index + 2 < bytes.length ? BASE64_ALPHABET[triple & 0x3f] : '=';
  }

  return output;
}
