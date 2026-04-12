import crypto from 'crypto';

type EncryptedPayload = {
  iv: string;
  tag: string;
  ciphertext: string;
};

const ALGO = 'aes-256-gcm';

function parseDirectKey(raw: string): Buffer | null {
  const normalized = raw.trim();

  // Accept 64-char hex key.
  if (/^[0-9a-fA-F]{64}$/.test(normalized)) {
    return Buffer.from(normalized, 'hex');
  }

  // Accept base64-encoded 32-byte key.
  const fromBase64 = Buffer.from(normalized, 'base64');
  if (fromBase64.length === 32) {
    return fromBase64;
  }

  return null;
}

function getEncryptionKey(): Buffer {
  const directKey = process.env.PII_ENCRYPTION_KEY;
  if (directKey) {
    const parsed = parseDirectKey(directKey);
    if (parsed) {
      return parsed;
    }

    if (process.env.NODE_ENV === 'production') {
      throw new Error('PII_ENCRYPTION_KEY must be 32-byte base64 or 64-char hex.');
    }

    console.warn('Invalid PII_ENCRYPTION_KEY format. Falling back to NEXTAUTH_SECRET/JWT_SECRET in non-production.');
  }

  // Fallback keeps non-production/dev setups working while still avoiding plaintext storage.
  const fallbackSecret = process.env.NEXTAUTH_SECRET || process.env.JWT_SECRET || '';
  if (!fallbackSecret) {
    throw new Error('Missing encryption secret. Set PII_ENCRYPTION_KEY or NEXTAUTH_SECRET.');
  }

  return crypto.createHash('sha256').update(fallbackSecret).digest();
}

export function encryptPII(value: string): string {
  const plain = value.trim();
  if (!plain) return '';

  const key = getEncryptionKey();
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv(ALGO, key, iv);
  const encrypted = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();

  const payload: EncryptedPayload = {
    iv: iv.toString('base64'),
    tag: tag.toString('base64'),
    ciphertext: encrypted.toString('base64'),
  };

  return Buffer.from(JSON.stringify(payload), 'utf8').toString('base64');
}

export function decryptPII(value: string): string {
  const raw = value.trim();
  if (!raw) return '';

  const key = getEncryptionKey();
  const decoded = Buffer.from(raw, 'base64').toString('utf8');
  const payload = JSON.parse(decoded) as EncryptedPayload;

  const decipher = crypto.createDecipheriv(ALGO, key, Buffer.from(payload.iv, 'base64'));
  decipher.setAuthTag(Buffer.from(payload.tag, 'base64'));

  const decrypted = Buffer.concat([
    decipher.update(Buffer.from(payload.ciphertext, 'base64')),
    decipher.final(),
  ]);

  return decrypted.toString('utf8');
}