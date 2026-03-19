/**
 * Encryption Module Tests
 * 
 * Tests AES-256-GCM encryption/decryption and edge cases.
 */

import crypto from 'crypto';

// Set a valid 32-byte (64-char hex) encryption key for tests
const TEST_KEY = crypto.randomBytes(32).toString('hex');
process.env.ENCRYPTION_KEY = TEST_KEY;

import { encrypt, decrypt, isEncrypted } from '../encryption';

describe('Encryption Module', () => {
    describe('encrypt / decrypt roundtrip', () => {
        it('should encrypt and decrypt a simple string', () => {
            const plaintext = 'my-secret-password';
            const encrypted = encrypt(plaintext);
            const decrypted = decrypt(encrypted);
            
            expect(decrypted).toBe(plaintext);
            expect(encrypted).not.toBe(plaintext);
        });

        it('should encrypt and decrypt unicode text', () => {
            const plaintext = 'Ü Ö Ä ß 中文 日本語 🔐🎉';
            const encrypted = encrypt(plaintext);
            const decrypted = decrypt(encrypted);
            expect(decrypted).toBe(plaintext);
        });

        it('should encrypt and decrypt an empty string', () => {
            const plaintext = '';
            const encrypted = encrypt(plaintext);
            const decrypted = decrypt(encrypted);
            expect(decrypted).toBe(plaintext);
        });

        it('should encrypt and decrypt long text', () => {
            const plaintext = 'A'.repeat(10000);
            const encrypted = encrypt(plaintext);
            const decrypted = decrypt(encrypted);
            expect(decrypted).toBe(plaintext);
        });
    });

    describe('encryption format', () => {
        it('should produce iv:ciphertext:authTag format', () => {
            const encrypted = encrypt('test');
            const parts = encrypted.split(':');
            expect(parts.length).toBe(3);
            
            // IV should be 32 hex chars (16 bytes)
            expect(parts[0].length).toBe(32);
            // Auth tag should be 32 hex chars (16 bytes)
            expect(parts[2].length).toBe(32);
        });

        it('should generate unique ciphertext for same plaintext (random IV)', () => {
            const encrypted1 = encrypt('same-input');
            const encrypted2 = encrypt('same-input');
            expect(encrypted1).not.toBe(encrypted2);

            // But both should decrypt to the same value
            expect(decrypt(encrypted1)).toBe('same-input');
            expect(decrypt(encrypted2)).toBe('same-input');
        });
    });

    describe('isEncrypted', () => {
        it('should detect encrypted strings', () => {
            const encrypted = encrypt('test');
            expect(isEncrypted(encrypted)).toBe(true);
        });

        it('should reject plain strings', () => {
            expect(isEncrypted('just-a-plain-string')).toBe(false);
            expect(isEncrypted('')).toBe(false);
        });

        it('should reject base64 strings (old format)', () => {
            const base64 = Buffer.from('not-encrypted').toString('base64');
            expect(isEncrypted(base64)).toBe(false);
        });
    });

    describe('error cases', () => {
        it('should throw on tampered ciphertext', () => {
            const encrypted = encrypt('secret');
            const parts = encrypted.split(':');
            // Tamper with ciphertext
            parts[1] = '00'.repeat(parts[1].length / 2);
            const tampered = parts.join(':');
            
            expect(() => decrypt(tampered)).toThrow();
        });

        it('should throw on invalid format', () => {
            expect(() => decrypt('not-valid')).toThrow('Invalid encrypted data format');
        });
    });

    describe('key validation', () => {
        it('should fail with missing ENCRYPTION_KEY', () => {
            const originalKey = process.env.ENCRYPTION_KEY;
            delete process.env.ENCRYPTION_KEY;
            
            expect(() => encrypt('test')).toThrow('ENCRYPTION_KEY');
            
            // Restore
            process.env.ENCRYPTION_KEY = originalKey;
        });

        it('should fail with short ENCRYPTION_KEY', () => {
            const originalKey = process.env.ENCRYPTION_KEY;
            process.env.ENCRYPTION_KEY = 'tooshort';
            
            expect(() => encrypt('test')).toThrow('ENCRYPTION_KEY');
            
            // Restore
            process.env.ENCRYPTION_KEY = originalKey;
        });
    });
});
