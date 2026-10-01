import { createHmac } from 'crypto';
import { verifyMetaSignature } from './verify-meta-signature';

describe('verifyMetaSignature', () => {
  const secret = 'test_secret';
  const body = Buffer.from(JSON.stringify({ hello: 'world' }));

  function sign(rawBody: Buffer, appSecret: string): string {
    return `sha256=${createHmac('sha256', appSecret).update(rawBody).digest('hex')}`;
  }

  it('returns true for a signature computed with the correct secret over the exact raw body', () => {
    const header = sign(body, secret);
    expect(verifyMetaSignature(body, header, secret)).toBe(true);
  });

  it('returns false when the secret used to sign differs from the configured one', () => {
    const header = sign(body, 'wrong_secret');
    expect(verifyMetaSignature(body, header, secret)).toBe(false);
  });

  it('returns false when the body was tampered with after signing', () => {
    const header = sign(body, secret);
    const tampered = Buffer.from(JSON.stringify({ hello: 'tampered' }));
    expect(verifyMetaSignature(tampered, header, secret)).toBe(false);
  });

  it('returns false for a malformed header missing the sha256= prefix', () => {
    expect(verifyMetaSignature(body, 'not-a-valid-header', secret)).toBe(false);
  });

  it('returns false when the signature header is undefined', () => {
    expect(verifyMetaSignature(body, undefined, secret)).toBe(false);
  });

  it('returns false when the app secret is not configured', () => {
    const header = sign(body, secret);
    expect(verifyMetaSignature(body, header, undefined)).toBe(false);
  });

  it('returns false when the raw body is undefined', () => {
    const header = sign(body, secret);
    expect(verifyMetaSignature(undefined, header, secret)).toBe(false);
  });
});
