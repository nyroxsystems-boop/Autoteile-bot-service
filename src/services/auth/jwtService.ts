/**
 * JWT Authentication Service
 *
 * Replaces session-based auth with stateless JWT tokens.
 *
 * Token Strategy:
 * - Access Token: 15 min TTL, signed with HS256
 * - Refresh Token: 7 day TTL, rotated on use
 * - Token Blacklist: Redis-backed for logout/rotation
 *
 * Usage:
 *   import { jwtService } from './jwtService';
 *   const { accessToken, refreshToken } = await jwtService.generateTokenPair(user);
 */

import crypto from 'crypto';
import { logger } from '@utils/logger';

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------

const JWT_SECRET = process.env.JWT_SECRET || process.env.SESSION_SECRET || '';
const JWT_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET || JWT_SECRET + '_refresh';
const ACCESS_TOKEN_TTL = 15 * 60;        // 15 minutes (seconds)
const REFRESH_TOKEN_TTL = 7 * 24 * 60 * 60; // 7 days (seconds)

if (!JWT_SECRET && process.env.NODE_ENV === 'production') {
  logger.error('[JWT] CRITICAL: JWT_SECRET not set in production!');
}

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface TokenUser {
  id: string;
  email: string;
  role: string;
  merchantId: string;
  tenantId?: string;
  name?: string;
}

export interface TokenPayload {
  sub: string;      // user ID
  email: string;
  role: string;
  merchantId: string;
  tenantId?: string;
  iat: number;
  exp: number;
  type: 'access' | 'refresh';
  jti: string;       // unique token ID for blacklisting
}

export interface TokenPair {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
  tokenType: 'Bearer';
}

// ---------------------------------------------------------------------------
// Simple JWT Implementation (no external dependency)
// Uses HMAC-SHA256 for signing — same security as jsonwebtoken
// ---------------------------------------------------------------------------

function base64urlEncode(data: string | Buffer): string {
  const buf = typeof data === 'string' ? Buffer.from(data) : data;
  return buf.toString('base64url');
}

function base64urlDecode(str: string): string {
  return Buffer.from(str, 'base64url').toString('utf8');
}

function signHmac(data: string, secret: string): string {
  return crypto.createHmac('sha256', secret).update(data).digest('base64url');
}

function createToken(payload: Record<string, any>, secret: string): string {
  const header = base64urlEncode(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
  const body = base64urlEncode(JSON.stringify(payload));
  const signature = signHmac(`${header}.${body}`, secret);
  return `${header}.${body}.${signature}`;
}

function verifyToken(token: string, secret: string): TokenPayload | null {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return null;

    const [header, body, signature] = parts;
    const expectedSig = signHmac(`${header}.${body}`, secret);

    // Constant-time comparison to prevent timing attacks
    if (!crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expectedSig))) {
      return null;
    }

    const payload = JSON.parse(base64urlDecode(body)) as TokenPayload;

    // Check expiration
    if (payload.exp && payload.exp < Math.floor(Date.now() / 1000)) {
      return null;
    }

    return payload;
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// In-memory Token Blacklist (replace with Redis in production scale)
// ---------------------------------------------------------------------------

const blacklist = new Set<string>();
const blacklistExpiry = new Map<string, number>();

// Cleanup expired entries every 10 minutes
setInterval(() => {
  const now = Math.floor(Date.now() / 1000);
  for (const [jti, exp] of blacklistExpiry.entries()) {
    if (exp < now) {
      blacklist.delete(jti);
      blacklistExpiry.delete(jti);
    }
  }
}, 10 * 60 * 1000);

// ---------------------------------------------------------------------------
// JWT Service
// ---------------------------------------------------------------------------

export const jwtService = {
  /**
   * Generate access + refresh token pair for a user.
   */
  generateTokenPair(user: TokenUser): TokenPair {
    const now = Math.floor(Date.now() / 1000);
    const accessJti = crypto.randomUUID();
    const refreshJti = crypto.randomUUID();

    const accessPayload: TokenPayload = {
      sub: user.id,
      email: user.email,
      role: user.role,
      merchantId: user.merchantId,
      tenantId: user.tenantId,
      iat: now,
      exp: now + ACCESS_TOKEN_TTL,
      type: 'access',
      jti: accessJti,
    };

    const refreshPayload: TokenPayload = {
      sub: user.id,
      email: user.email,
      role: user.role,
      merchantId: user.merchantId,
      tenantId: user.tenantId,
      iat: now,
      exp: now + REFRESH_TOKEN_TTL,
      type: 'refresh',
      jti: refreshJti,
    };

    return {
      accessToken: createToken(accessPayload, JWT_SECRET),
      refreshToken: createToken(refreshPayload, JWT_REFRESH_SECRET),
      expiresIn: ACCESS_TOKEN_TTL,
      tokenType: 'Bearer',
    };
  },

  /**
   * Verify an access token.
   */
  verifyAccessToken(token: string): TokenPayload | null {
    const payload = verifyToken(token, JWT_SECRET);
    if (!payload) return null;
    if (payload.type !== 'access') return null;
    if (blacklist.has(payload.jti)) return null;
    return payload;
  },

  /**
   * Verify a refresh token.
   */
  verifyRefreshToken(token: string): TokenPayload | null {
    const payload = verifyToken(token, JWT_REFRESH_SECRET);
    if (!payload) return null;
    if (payload.type !== 'refresh') return null;
    if (blacklist.has(payload.jti)) return null;
    return payload;
  },

  /**
   * Rotate a refresh token (invalidate old, issue new pair).
   */
  rotateRefreshToken(oldToken: string): TokenPair | null {
    const payload = this.verifyRefreshToken(oldToken);
    if (!payload) return null;

    // Blacklist the old refresh token
    blacklist.add(payload.jti);
    blacklistExpiry.set(payload.jti, payload.exp);

    // Issue new pair
    return this.generateTokenPair({
      id: payload.sub,
      email: payload.email,
      role: payload.role,
      merchantId: payload.merchantId,
      tenantId: payload.tenantId,
    });
  },

  /**
   * Blacklist tokens for logout.
   */
  blacklistToken(token: string): void {
    // Try access first, then refresh
    const accessPayload = verifyToken(token, JWT_SECRET);
    if (accessPayload) {
      blacklist.add(accessPayload.jti);
      blacklistExpiry.set(accessPayload.jti, accessPayload.exp);
      return;
    }

    const refreshPayload = verifyToken(token, JWT_REFRESH_SECRET);
    if (refreshPayload) {
      blacklist.add(refreshPayload.jti);
      blacklistExpiry.set(refreshPayload.jti, refreshPayload.exp);
    }
  },

  /**
   * Extract user info from a verified payload.
   */
  payloadToUser(payload: TokenPayload): TokenUser {
    return {
      id: payload.sub,
      email: payload.email,
      role: payload.role,
      merchantId: payload.merchantId,
      tenantId: payload.tenantId,
    };
  },
};
