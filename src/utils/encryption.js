import crypto from 'crypto';
import env from '../config/env.js';

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 12;

/**
 * Gets the 32-byte encryption key from env.ENCRYPTION_KEY.
 * Hashes it using SHA-256 to guarantee it is exactly 32 bytes (256 bits).
 *
 * @returns {Buffer}
 */
function getEncryptionKey() {
  const secret = env.ENCRYPTION_KEY;
  if (!secret) {
    throw new Error('[Encryption] ENCRYPTION_KEY environment variable is not defined.');
  }
  return crypto.createHash('sha256').update(secret).digest();
}

/**
 * Encrypts a plaintext string.
 * Returns a colon-separated string: "iv:tag:encryptedData" in hex format.
 *
 * @param {string} text
 * @returns {string}
 */
export function encrypt(text) {
  if (text === null || text === undefined || text === '') {
    return text;
  }
  
  const key = getEncryptionKey();
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
  
  let encrypted = cipher.update(text, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  
  const tag = cipher.getAuthTag().toString('hex');
  
  return `${iv.toString('hex')}:${tag}:${encrypted}`;
}

/**
 * Decrypts an encrypted string in the format "iv:tag:encryptedData".
 *
 * @param {string} encryptedText
 * @returns {string}
 */
export function decrypt(encryptedText) {
  if (encryptedText === null || encryptedText === undefined || encryptedText === '') {
    return encryptedText;
  }
  
  const parts = encryptedText.split(':');
  if (parts.length !== 3) {
    throw new Error('[Encryption] Invalid encrypted text format. Expected "iv:tag:encryptedData".');
  }
  
  const [ivHex, tagHex, encryptedHex] = parts;
  const key = getEncryptionKey();
  const iv = Buffer.from(ivHex, 'hex');
  const tag = Buffer.from(tagHex, 'hex');
  const encrypted = Buffer.from(encryptedHex, 'hex');
  
  const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(tag);
  
  let decrypted = decipher.update(encrypted, 'hex', 'utf8');
  decrypted += decipher.final('utf8');
  
  return decrypted;
}
