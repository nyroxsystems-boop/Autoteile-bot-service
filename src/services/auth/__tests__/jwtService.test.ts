/**
 * JWT Service Tests
 * 
 * Tests for token generation, verification, rotation, and blacklisting.
 */

// Set test environment BEFORE importing jwtService
process.env.JWT_SECRET = 'test-secret-that-is-at-least-32-chars-long-for-testing';
process.env.JWT_REFRESH_SECRET = 'test-refresh-secret-that-is-at-least-32-chars-long';

import { jwtService, TokenUser } from '../jwtService';

const testUser: TokenUser = {
    id: 'user-123',
    email: 'test@example.com',
    role: 'admin',
    merchantId: 'merchant-001',
    tenantId: 'tenant-001',
};

describe('jwtService', () => {
    describe('generateTokenPair', () => {
        it('should generate access and refresh tokens', () => {
            const pair = jwtService.generateTokenPair(testUser);
            
            expect(pair).toHaveProperty('accessToken');
            expect(pair).toHaveProperty('refreshToken');
            expect(pair).toHaveProperty('expiresIn', 900); // 15 minutes
            expect(pair).toHaveProperty('tokenType', 'Bearer');
            expect(pair.accessToken).toContain('.');
            expect(pair.refreshToken).toContain('.');
            // JWT has 3 parts separated by dots
            expect(pair.accessToken.split('.').length).toBe(3);
            expect(pair.refreshToken.split('.').length).toBe(3);
        });

        it('should generate unique tokens each time', () => {
            const pair1 = jwtService.generateTokenPair(testUser);
            const pair2 = jwtService.generateTokenPair(testUser);
            
            expect(pair1.accessToken).not.toBe(pair2.accessToken);
            expect(pair1.refreshToken).not.toBe(pair2.refreshToken);
        });
    });

    describe('verifyAccessToken', () => {
        it('should verify a valid access token', async () => {
            const pair = jwtService.generateTokenPair(testUser);
            const payload = await jwtService.verifyAccessToken(pair.accessToken);

            expect(payload).not.toBeNull();
            expect(payload!.sub).toBe(testUser.id);
            expect(payload!.email).toBe(testUser.email);
            expect(payload!.role).toBe(testUser.role);
            expect(payload!.merchantId).toBe(testUser.merchantId);
            expect(payload!.type).toBe('access');
            expect(payload!.jti).toBeTruthy();
        });

        it('should reject a refresh token used as access token', async () => {
            const pair = jwtService.generateTokenPair(testUser);
            const payload = await jwtService.verifyAccessToken(pair.refreshToken);
            expect(payload).toBeNull();
        });

        it('should reject a tampered token', async () => {
            const pair = jwtService.generateTokenPair(testUser);
            const tampered = pair.accessToken.slice(0, -3) + 'XXX';
            const payload = await jwtService.verifyAccessToken(tampered);
            expect(payload).toBeNull();
        });

        it('should reject a malformed token', async () => {
            const payload = await jwtService.verifyAccessToken('not.a.valid.token');
            expect(payload).toBeNull();
        });

        it('should reject an empty string', async () => {
            const payload = await jwtService.verifyAccessToken('');
            expect(payload).toBeNull();
        });
    });

    describe('verifyRefreshToken', () => {
        it('should verify a valid refresh token', async () => {
            const pair = jwtService.generateTokenPair(testUser);
            const payload = await jwtService.verifyRefreshToken(pair.refreshToken);

            expect(payload).not.toBeNull();
            expect(payload!.sub).toBe(testUser.id);
            expect(payload!.type).toBe('refresh');
        });

        it('should reject an access token used as refresh token', async () => {
            const pair = jwtService.generateTokenPair(testUser);
            const payload = await jwtService.verifyRefreshToken(pair.accessToken);
            expect(payload).toBeNull();
        });
    });

    describe('blacklistToken', () => {
        it('should blacklist an access token', async () => {
            const pair = jwtService.generateTokenPair(testUser);

            // Verify it works before blacklisting
            const before = await jwtService.verifyAccessToken(pair.accessToken);
            expect(before).not.toBeNull();

            // Blacklist
            await jwtService.blacklistToken(pair.accessToken);

            // Should now be rejected
            const after = await jwtService.verifyAccessToken(pair.accessToken);
            expect(after).toBeNull();
        });

        it('should blacklist a refresh token', async () => {
            const pair = jwtService.generateTokenPair(testUser);

            const before = await jwtService.verifyRefreshToken(pair.refreshToken);
            expect(before).not.toBeNull();

            await jwtService.blacklistToken(pair.refreshToken);

            const after = await jwtService.verifyRefreshToken(pair.refreshToken);
            expect(after).toBeNull();
        });
    });

    describe('rotateRefreshToken', () => {
        it('should issue new token pair and blacklist old refresh token', async () => {
            const originalPair = jwtService.generateTokenPair(testUser);

            const newPair = await jwtService.rotateRefreshToken(originalPair.refreshToken);
            expect(newPair).not.toBeNull();
            expect(newPair!.accessToken).toBeTruthy();
            expect(newPair!.refreshToken).toBeTruthy();

            // Old refresh token should be blacklisted
            const oldPayload = await jwtService.verifyRefreshToken(originalPair.refreshToken);
            expect(oldPayload).toBeNull();

            // New tokens should be valid
            const newAccessPayload = await jwtService.verifyAccessToken(newPair!.accessToken);
            expect(newAccessPayload).not.toBeNull();
            expect(newAccessPayload!.sub).toBe(testUser.id);
        });

        it('should return null for invalid refresh token', async () => {
            const result = await jwtService.rotateRefreshToken('invalid.token.here');
            expect(result).toBeNull();
        });
    });

    describe('payloadToUser', () => {
        it('should extract user from payload', async () => {
            const pair = jwtService.generateTokenPair(testUser);
            const payload = await jwtService.verifyAccessToken(pair.accessToken);
            const user = jwtService.payloadToUser(payload!);

            expect(user.id).toBe(testUser.id);
            expect(user.email).toBe(testUser.email);
            expect(user.role).toBe(testUser.role);
            expect(user.merchantId).toBe(testUser.merchantId);
            expect(user.tenantId).toBe(testUser.tenantId);
        });
    });
});
