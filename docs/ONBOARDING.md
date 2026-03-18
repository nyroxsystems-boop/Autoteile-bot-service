
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
```bash
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
```

## 3. Architecture & Concepts
- Please read the files inside `docs/adr/` first!
- **APM & Logging:** We use a centralized `logger.ts` and `apm.ts`. Never use raw `console.log`.
- **Database Access:** Use the abstraction layer `@core/database` (never `pg` directly unless writing migrations). 

## 4. Pull Requests
- We enforce strict TypeScript. Run `npx tsc --noEmit` before committing.
- Squash commits and use conventional commits (e.g., `feat: add new pricing tier`).
- Tests must pass (`npm test`). Coverage should not decrease.
