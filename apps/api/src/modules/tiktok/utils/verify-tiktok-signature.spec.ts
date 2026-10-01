import { createHmac } from 'crypto';
import {
  parseTikTokSignatureHeader,
  isTikTokSignatureValid,
  isTikTokTimestampFresh,
} from './verify-tiktok-signature';

const CLIENT_SECRET = 'test_tiktok_client_secret';

function sign(timestamp: string, rawBody: Buffer): string {
  return createHmac('sha256', CLIENT_SECRET).update(`${timestamp}.${rawBody.toString('utf8')}`).digest('hex');
}

describe('parseTikTokSignatureHeader', () => {
  it('parses a well-formed t=,s= header', () => {
    const result = parseTikTokSignatureHeader('t=1700000000,s=abc123');
    expect(result).toEqual({ timestamp: '1700000000', signature: 'abc123' });
  });

  it('returns null for a missing header', () => {
    expect(parseTikTokSignatureHeader(undefined)).toBeNull();
  });

  it('returns null for a malformed header missing one of t/s', () => {
    expect(parseTikTokSignatureHeader('t=1700000000')).toBeNull();
    expect(parseTikTokSignatureHeader('garbage')).toBeNull();
  });
});

describe('isTikTokSignatureValid', () => {
  it('accepts a correctly computed signature', () => {
    const rawBody = Buffer.from(JSON.stringify({ event: 'message.received' }));
    const timestamp = '1700000000';
    const signature = sign(timestamp, rawBody);

    expect(isTikTokSignatureValid(rawBody, timestamp, signature, CLIENT_SECRET)).toBe(true);
  });

  it('rejects a tampered body', () => {
    const rawBody = Buffer.from(JSON.stringify({ event: 'message.received' }));
    const timestamp = '1700000000';
    const signature = sign(timestamp, rawBody);
    const tamperedBody = Buffer.from(JSON.stringify({ event: 'message.tampered' }));

    expect(isTikTokSignatureValid(tamperedBody, timestamp, signature, CLIENT_SECRET)).toBe(false);
  });

  it('rejects when the client secret is wrong', () => {
    const rawBody = Buffer.from(JSON.stringify({ event: 'message.received' }));
    const timestamp = '1700000000';
    const signature = sign(timestamp, rawBody);

    expect(isTikTokSignatureValid(rawBody, timestamp, signature, 'wrong_secret')).toBe(false);
  });

  it('returns false when rawBody or clientSecret is missing', () => {
    expect(isTikTokSignatureValid(undefined, '1700000000', 'sig', CLIENT_SECRET)).toBe(false);
    expect(isTikTokSignatureValid(Buffer.from('x'), '1700000000', 'sig', undefined)).toBe(false);
  });
});

describe('isTikTokTimestampFresh', () => {
  it('accepts a timestamp within the default 300s tolerance', () => {
    const nowSeconds = Math.floor(Date.now() / 1000);
    expect(isTikTokTimestampFresh(String(nowSeconds - 10))).toBe(true);
  });

  it('rejects a stale timestamp (valid signature, but 10 minutes old)', () => {
    const nowSeconds = Math.floor(Date.now() / 1000);
    expect(isTikTokTimestampFresh(String(nowSeconds - 600))).toBe(false);
  });

  it('rejects a non-numeric timestamp', () => {
    expect(isTikTokTimestampFresh('not-a-number')).toBe(false);
  });
});
