/**
 * 🔐 Encryption Helper — AES-256-GCM for sensitive data at rest
 * 
 * Used for: IMAP passwords, API keys, etc.
 * Key must be 32 bytes (set ENCRYPTION_KEY env var as 64-char hex string).
 */
import { createCipheriv, createDecipheriv, randomBytes } from 'crypto';
import { logger } from "@utils/logger";

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 16;
const TAG_LENGTH = 16;

function getKey(): Buffer {
    const keyHex = process.env.ENCRYPTION_KEY;
    if (!keyHex || keyHex.length !== 64) {
        throw new Error(
            'ENCRYPTION_KEY env var must be a 64-char hex string (32 bytes). ' +
            'Generate with: node -e "logger.info(require(\'crypto\').randomBytes(32).toString(\'hex\'))"'
        );
    }
    return Buffer.from(keyHex, 'hex');
}

/**
 * Encrypt a plaintext string → returns `iv:ciphertext:authTag` (hex encoded)
 */
export function encrypt(plaintext: string): string {
    const key = getKey();
    const iv = randomBytes(IV_LENGTH);
    const cipher = createCipheriv(ALGORITHM, key, iv);

    let encrypted = cipher.update(plaintext, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    const authTag = cipher.getAuthTag();

    return `${iv.toString('hex')}:${encrypted}:${authTag.toString('hex')}`;
}

/**
 * Decrypt a `iv:ciphertext:authTag` string → returns plaintext
 */
export function decrypt(encryptedData: string): string {
    const key = getKey();
    const [ivHex, ciphertext, authTagHex] = encryptedData.split(':');

    if (!ivHex || !ciphertext || !authTagHex) {
        throw new Error('Invalid encrypted data format');
    }

    const iv = Buffer.from(ivHex, 'hex');
    const authTag = Buffer.from(authTagHex, 'hex');
    const decipher = createDecipheriv(ALGORITHM, key, iv);
    decipher.setAuthTag(authTag);

    let decrypted = decipher.update(ciphertext, 'hex', 'utf8');
    decrypted += decipher.final('utf8');

    return decrypted;
}

/**
 * Check if a string looks like it was encrypted with this module (vs old base64)
 */
export function isEncrypted(data: string): boolean {
    return data.includes(':') && data.split(':').length === 3;
}
