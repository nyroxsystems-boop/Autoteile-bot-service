
# ADR 001: Dual-Database Strategy (Supabase + Local SQLite)

## Status
Accepted

## Context
The platform needs to balance extreme performance for the OEM parts resolution pipeline (which executes millions of string comparisons and trigram searches) with robust, compliant, and highly available transactional data storage for orders, invoices, and B2B users.

## Decision
We actively use a Dual-Database strategy:
1. **PostgreSQL (Supabase/Managed PG):** Serves as the primary source of truth for transactional state (Tenants, Orders, Chats, GoBD Invoices, Audit Logs). Accessed via HTTP API or native Pooler (pgBouncer).
2. **SQLite (Local):** Acts as an embedded, read-only cache and resolution engine. It holds million-row catalogs of TecAlliance / OEM mapping data. Local indexing (FTS5) enables 0-latency multi-keyword searching that would overwhelm a remote PostgreSQL instance over standard HTTP networks.

## Consequences
- **Positive:** Unbeatable latency for the core business value (OEM resolving). Deeply decoupled operational state vs catalog state.
- **Negative:** Catalog updates (SQLite files) must be distributed to all worker nodes via volume mounts or S3 pulls, adding complexity to the deployment pipeline.
