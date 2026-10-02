import { createCipheriv, createDecipheriv, randomBytes } from 'crypto';

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 12; // recommended length for GCM

function getKey(): Buffer {
  const hex = process.env.SECRETS_ENCRYPTION_KEY;
  if (!hex) {
    throw new Error('SECRETS_ENCRYPTION_KEY is not configured — cannot encrypt/decrypt tenant secrets');
  }
  const key = Buffer.from(hex, 'hex');
  if (key.length !== 32) {
    throw new Error('SECRETS_ENCRYPTION_KEY must be a 32-byte hex string (64 hex characters) — generate one with `openssl rand -hex 32`');
  }
  return key;
}

// Per-tenant third-party secrets (AI provider API keys, a tenant's own Meta
// App Secret) stored at rest — AES-256-GCM, a fresh random IV per call.
// Output format: "iv:authTag:ciphertext", all hex, so a single text column
// is enough (no separate iv/authTag columns needed).
export function encryptSecret(plaintext: string): string {
  const iv = randomBytes(IV_LENGTH);
  const cipher = createCipheriv(ALGORITHM, getKey(), iv);
  const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return `${iv.toString('hex')}:${authTag.toString('hex')}:${encrypted.toString('hex')}`;
}

export function decryptSecret(ciphertext: string): string {
  const [ivHex, authTagHex, dataHex] = ciphertext.split(':');
  if (!ivHex || !authTagHex || !dataHex) {
    throw new Error('Malformed encrypted secret — expected "iv:authTag:ciphertext"');
  }
  const decipher = createDecipheriv(ALGORITHM, getKey(), Buffer.from(ivHex, 'hex'));
  decipher.setAuthTag(Buffer.from(authTagHex, 'hex'));
  const decrypted = Buffer.concat([decipher.update(Buffer.from(dataHex, 'hex')), decipher.final()]);
  return decrypted.toString('utf8');
}
