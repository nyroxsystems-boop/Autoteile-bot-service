/**
 * Express type extensions for authenticated requests.
 * Eliminates all `(req as any).user` patterns across the codebase.
 *
 * Usage:
 *   req.user?.id        // string
 *   req.user?.role      // 'admin' | 'user' | 'dealer' | 'superadmin'
 *   req.merchantId      // string — resolved from auth or phone mapping
 */

export interface AuthenticatedUser {
  id: string;
  email: string;
  role: 'admin' | 'user' | 'dealer' | 'superadmin';
  merchantId: string;
  tenantId?: string;
  name?: string;
}

declare global {
  namespace Express {
    interface Request {
      /** Populated by authMiddleware after session/JWT validation */
      user?: AuthenticatedUser;
      /** Resolved merchant ID from auth or phone mapping */
      merchantId?: string;
      /** Resolved tenant ID for multi-tenant isolation */
      tenantId?: string;
      /** User ID shorthand (from session) */
      userId?: string;
    }
  }
}

export {};
