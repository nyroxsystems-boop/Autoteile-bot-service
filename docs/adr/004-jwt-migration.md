
# ADR 004: JWT Migration and Tenant Isolation

## Status
Accepted

## Context
Early prototypes relied on insecure header passing or weak `localstorage` tokens. B2B platforms require strict tenant isolation and secure stateless authentication for APIs scaling horizontally via Kubernetes.

## Decision
We migrated the entire Express backend and React frontend to a secure JWT (JSON Web Token) architecture (`AuthContext`, `jwt.ts`). 
Tokens encode the `merchant_id` (Tenant) immutably in their payload. All sensitive API routes demand a valid JWT and automatically enforce Row-Level Security (RLS) equivalents via the `requireTenant` Express middleware.

## Consequences
- **Positive:** Mathematically secure, stateless validation at the API edge. Perfect scaling.
- **Negative:** Token invalidation requires a blacklist cache (Redis) or short expiration times (e.g., 15m) paired with Refresh Tokens.
