import crypto from 'crypto';

const ALGO = 'aes-256-gcm';
const IV_LENGTH = 12;
const AUTH_TAG_LENGTH = 16;
const PREFIX = 'enc:v1';

function getKey(): Buffer {
  const secret = process.env.DOC_ENCRYPTION_KEY || process.env.JWT_SECRET;
  if (!secret) {
    throw new Error('Missing DOC_ENCRYPTION_KEY (or JWT_SECRET fallback) for field encryption');
  }
  // Derive a stable 32-byte key from the configured secret.
  return crypto.createHash('sha256').update(secret, 'utf8').digest();
}

export function encryptField(value: string): string {
  const input = value.trim();
  if (!input) return input;

  // Avoid double-encryption.
  if (input.startsWith(`${PREFIX}:`)) return input;

  const key = getKey();
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGO, key, iv, { authTagLength: AUTH_TAG_LENGTH });

  const encrypted = Buffer.concat([cipher.update(input, 'utf8'), cipher.final()]);
  const authTag = cipher.getAuthTag();

  return [
    PREFIX,
    iv.toString('base64'),
    authTag.toString('base64'),
    encrypted.toString('base64'),
  ].join(':');
}

export function decryptField(value: string): string {
  if (!value.startsWith(`${PREFIX}:`)) return value;

  const parts = value.split(':');
  if (parts.length !== 5) {
    throw new Error('Invalid encrypted field format');
  }

  const [, , ivBase64, authTagBase64, dataBase64] = parts;
  const key = getKey();
  const iv = Buffer.from(ivBase64, 'base64');
  const authTag = Buffer.from(authTagBase64, 'base64');
  const encrypted = Buffer.from(dataBase64, 'base64');

  const decipher = crypto.createDecipheriv(ALGO, key, iv, { authTagLength: AUTH_TAG_LENGTH });
  decipher.setAuthTag(authTag);

  const decrypted = Buffer.concat([decipher.update(encrypted), decipher.final()]);
  return decrypted.toString('utf8');
}
