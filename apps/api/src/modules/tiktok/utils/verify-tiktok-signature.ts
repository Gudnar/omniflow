import { createHmac, timingSafeEqual } from 'crypto';

/**
 * TikTok's webhook signature scheme (Business Messaging), per their
 * developer docs: header `Tiktok-Signature: t=<unix_seconds>,s=<hex_hmac>`.
 * NOTE: this shape has not been verified against a real TikTok payload
 * (their portal docs weren't fully accessible at implementation time) — a
 * reasonable, clearly-flagged best guess to revisit once real API access
 * exists, same as the rest of the TikTok integration in this phase.
 */
export interface TikTokSignatureHeader {
  timestamp: string;
  signature: string;
}

export function parseTikTokSignatureHeader(header: string | undefined): TikTokSignatureHeader | null {
  if (!header) return null;

  const parts = Object.fromEntries(
    header.split(',').map((part) => {
      const [key, value] = part.split('=');
      return [key?.trim(), value?.trim()];
    }),
  );

  if (!parts.t || !parts.s) return null;
  return { timestamp: parts.t, signature: parts.s };
}

export function isTikTokSignatureValid(
  rawBody: Buffer | undefined,
  timestamp: string,
  signature: string,
  clientSecret: string | undefined,
): boolean {
  if (!rawBody || !clientSecret) return false;

  const signedPayload = `${timestamp}.${rawBody.toString('utf8')}`;
  const expectedSignature = createHmac('sha256', clientSecret).update(signedPayload).digest('hex');

  const expectedBuffer = Buffer.from(expectedSignature, 'utf8');
  const providedBuffer = Buffer.from(signature, 'utf8');

  if (expectedBuffer.length !== providedBuffer.length) return false;
  return timingSafeEqual(expectedBuffer, providedBuffer);
}

// TikTok itself recommends a much tighter (~5s) freshness window, which is
// unrealistically strict for anything but a same-datacenter round trip.
// 300s is a practical tolerance for real-world clock skew/latency, chosen as
// a deliberate judgment call — a valid-but-stale signature is a materially
// different situation (possible replay) from an invalid one (forged/tampered)
// and the two are logged distinguishably at the call site.
export function isTikTokTimestampFresh(timestamp: string, toleranceSeconds = 300): boolean {
  const parsed = Number(timestamp);
  if (!Number.isFinite(parsed)) return false;

  const nowSeconds = Date.now() / 1000;
  return Math.abs(nowSeconds - parsed) <= toleranceSeconds;
}
