import { createHmac, timingSafeEqual } from 'crypto';

/**
 * Verifies Meta's X-Hub-Signature-256 webhook header against the raw request
 * body. Must be computed over the raw bytes, not the parsed/re-serialized
 * JSON body (whitespace/key-order differences would break the HMAC).
 */
export function verifyMetaSignature(
  rawBody: Buffer | undefined,
  signatureHeader: string | undefined,
  appSecret: string | undefined,
): boolean {
  if (!rawBody || !signatureHeader || !appSecret) return false;

  const [algo, providedSignature] = signatureHeader.split('=');
  if (algo !== 'sha256' || !providedSignature) return false;

  const expectedSignature = createHmac('sha256', appSecret).update(rawBody).digest('hex');

  const expectedBuffer = Buffer.from(expectedSignature, 'utf8');
  const providedBuffer = Buffer.from(providedSignature, 'utf8');

  if (expectedBuffer.length !== providedBuffer.length) return false;
  return timingSafeEqual(expectedBuffer, providedBuffer);
}
