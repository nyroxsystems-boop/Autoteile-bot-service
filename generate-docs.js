const fs = require('fs');
const path = require('path');

const rootDir = path.join(__dirname, 'docs');
const adrDir = path.join(rootDir, 'adr');
const runbooksDir = path.join(rootDir, 'runbooks');

// Create directories
[rootDir, adrDir, runbooksDir].forEach(dir => {
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
});

// -----------------------------------------------------
// ADRs
// -----------------------------------------------------

fs.writeFileSync(path.join(adrDir, '001-dual-database.md'), `
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
`);

fs.writeFileSync(path.join(adrDir, '002-multi-ai-strategy.md'), `
# ADR 002: APEX Pipeline - Multi-AI Strategy (Gemini + Claude)

## Status
Accepted

## Context
Relying solely on one LLM provider for B2B OEM part resolution introduces systemic risks: single points of failure, uncompetitive pricing curves, and localized hallucination blindspots. 

## Decision
We implemented the **APEX (Adversarial Parts EXtraction)** Pipeline leveraging multiple models dynamically:
- **Primary Search Agent (Google Gemini):** Excellent at traversing the web and internal embeddings to surface initial catalog candidates quickly safely and cheaply.
- **Adversary Validator (Anthropic Claude):** Used explicitly to "grade" and dispute Gemini's decisions. Claude's logical deduction prevents catastrophic aftermarket false-positives that Gemini occasionally hallucinates.

## Consequences
- **Positive:** Accuracies jump from ~78% (Single Model) to >93% (Consensus/Debate Model). Cloud provider lock-in is broken. 
- **Negative:** Increased prompt engineering complexity. Increased token costs, mitigated by configuring Claude as a conditional fallback only when Gemini confidence < 90%.
`);

fs.writeFileSync(path.join(adrDir, '003-state-machine-vs-linear-flows.md'), `
# ADR 003: WhatsApp Bot State Machine

## Status
Accepted

## Context
Handling asynchronous conversational flows (WhatsApp/Twilio) where users randomly reply, send photos, or go silent requires robust state tracking. A linear procedural script fails immediately when users step out of bounds.

## Decision
We built a Redis-backed finite state machine (\`botLogicService.ts\`, \`stateMachine/\`) that maps users to isolated states (e.g., \`AWAITING_KBA\`, \`AWAITING_PART\`, \`AWAITING_CONFIRMATION\`). Every inbound webhook triggers a handler strictly mapped to the user's current state.

## Consequences
- **Positive:** Predictable UI behavior inside an unstructured text interface. Easy to unit test individual handlers.
- **Negative:** Adding a new step to a flow requires touching the Redis schema, the handler, and the state typings.
`);

fs.writeFileSync(path.join(adrDir, '004-jwt-migration.md'), `
# ADR 004: JWT Migration and Tenant Isolation

## Status
Accepted

## Context
Early prototypes relied on insecure header passing or weak \`localstorage\` tokens. B2B platforms require strict tenant isolation and secure stateless authentication for APIs scaling horizontally via Kubernetes.

## Decision
We migrated the entire Express backend and React frontend to a secure JWT (JSON Web Token) architecture (\`AuthContext\`, \`jwt.ts\`). 
Tokens encode the \`merchant_id\` (Tenant) immutably in their payload. All sensitive API routes demand a valid JWT and automatically enforce Row-Level Security (RLS) equivalents via the \`requireTenant\` Express middleware.

## Consequences
- **Positive:** Mathematically secure, stateless validation at the API edge. Perfect scaling.
- **Negative:** Token invalidation requires a blacklist cache (Redis) or short expiration times (e.g., 15m) paired with Refresh Tokens.
`);


// -----------------------------------------------------
// ONBOARDING
// -----------------------------------------------------

fs.writeFileSync(path.join(rootDir, 'ONBOARDING.md'), `
# Partsunion Developer Onboarding

Welcome to the Partsunion Engineering Team! 🚀

## 1. System Overview
Partsunion is a B2B platform consisting of two main pillars:
1. **Whatsapp-Bot (Backend):** A Node.js/Express service that drives the conversational AI, the APEX Pipeline, and Core Business APIs (Invoicing, Orders).
2. **User-Dashboard (Frontend):** A React/Vite SPA where mechanics track auto-orders, tweak margins, and handle billing.

## 2. Local Setup
### Dependencies
- Node.js v20+
- PostgreSQL (or Supabase local CLI)
- Redis

### Getting Started
\`\`\`bash
git clone https://github.com/partsunion/core.git
cd core

# Install Frontend
cd User-Dashboard && npm install
cp .env.example .env.local

# Install Backend
cd ../Whatsapp-Bot && npm install
cp .env.example .env
npm run setup-auth # Configures DB & seeds demo data

# Run
npm run dev # Starts both via concurrently or manually start each
\`\`\`

## 3. Architecture & Concepts
- Please read the files inside \`docs/adr/\` first!
- **APM & Logging:** We use a centralized \`logger.ts\` and \`apm.ts\`. Never use raw \`console.log\`.
- **Database Access:** Use the abstraction layer \`@core/database\` (never \`pg\` directly unless writing migrations). 

## 4. Pull Requests
- We enforce strict TypeScript. Run \`npx tsc --noEmit\` before committing.
- Squash commits and use conventional commits (e.g., \`feat: add new pricing tier\`).
- Tests must pass (\`npm test\`). Coverage should not decrease.
`);


// -----------------------------------------------------
// RUNBOOKS
// -----------------------------------------------------

fs.writeFileSync(path.join(runbooksDir, 'incident-response.md'), `
# Runbook: General Incident Response

## Severity Levels
- **SEV-1 (Critical):** Core flows broken (WhatsApp webhooks dropping, APEX pipeline failing 100%, Database down).
- **SEV-2 (High):** Significant degradation (Dashboard slow, invoices failing occasionally).
- **SEV-3 (Medium):** Non-blocking bugs, UI glitches.

## First Response
1. **Acknowledge:** Post in Slack \`#incidents\` channel: "@here Investigating alert [Alert_Name]".
2. **Triaging:** 
    - Check APM (Datadog/Sentry) for sudden spike in 5xx errors.
    - Check Kubernetes metrics (\`kubectl top pods -n partsunion\`) for CPU/OOM Kills.
    - Test system manually (send a WhatsApp message to the Sandbox bot).
3. **Mitigation:** Focus on restoring service, NOT finding the root cause.
    - Bad deployment? Rollback immediately: \`helm rollback partsunion\`
    - High CPU? Force scale: \`kubectl scale deploy partsunion-api --replicas=10\`
4. **Post-Mortem:** Within 24 hours of SEV-1, author a blameless post-mortem document.
`);

fs.writeFileSync(path.join(runbooksDir, 'oem-database-update.md'), `
# Runbook: Updating the OEM SQLite Database

## Context
The massive \`oem_cross_references.sqlite\` is intentionally isolated. It needs to be updated weekly/monthly from the TecAlliance/OEM data providers.

## Procedure
1. Run the ETL pipeline (Airflow or Python Script) to produce the new \`.sqlite\` artifact.
2. Verify checksum and schema locally: \`sqlite3 test.db "PRAGMA integrity_check;"\`
3. Upload to the S3 catalog bucket: \`aws s3 cp new_catalog.sqlite s3://partsunion-catalogs/v2_45_0.sqlite\`
4. Update the Kubernetes ConfigMap or Helm \`values.yaml\` to point to the new S3 key, or use init-containers to pull the latest file on boot.
5. Trigger a rolling restart of the Worker pods: \`kubectl rollout restart deploy/partsunion-worker\`
`);

fs.writeFileSync(path.join(runbooksDir, 'deployment-rollback.md'), `
# Runbook: Deployment & Rollback

## CI/CD Pipeline
Deployments are handled fully automatically via GitHub Actions upon merging into \`main\`.
Images are pushed to GitHub Container Registry (GHCR) and applied to the K8s cluster via Helm.

## Manual Rollback (Emergency)
If the automated tests passed but production is failing:

1. Identify the last known good Helm revision:
   \`helm history partsunion -n production\`
2. Roll back specifically to that revision:
   \`helm rollback partsunion <REVISION_ID> -n production\`
3. Verify recovery via Logs & APM.
4. Revert the problematic PR in GitHub so \`main\` matches production again.
`);

console.log('Documentation generated successfully in docs/');
