/**
 * Bot Worker — Separate Process for BullMQ Workers
 *
 * Purpose: Isolate heavy bot message processing from the Express event loop.
 * This prevents long-running OEM resolutions and scraping from blocking
 * HTTP request handling.
 *
 * Architecture:
 *   index.ts (Express API) ──queue──▶ worker.ts (BullMQ Worker)
 *
 * Run: `node dist/worker.js` or `ts-node src/worker.ts`
 * Docker: Use Dockerfile.worker for a separate container
 *
 * Environment: Same .env as main app (needs REDIS_URL, Supabase, AI keys)
 */

import dotenv from 'dotenv';
dotenv.config();

import { logger } from '@utils/logger';
import { initDb } from './services/core/database';
import { runOemAutoUpdate } from './scripts/oemDatabaseUpdate';

const REDIS_URL = process.env.REDIS_URL;

if (!REDIS_URL) {
  logger.error('[Worker] CRITICAL: REDIS_URL is required for worker mode');
  process.exit(1);
}

// ---------------------------------------------------------------------------
// Graceful Shutdown
// ---------------------------------------------------------------------------

let isShuttingDown = false;

function setupGracefulShutdown() {
  const signals: NodeJS.Signals[] = ['SIGTERM', 'SIGINT', 'SIGUSR2'];

  signals.forEach(signal => {
    process.on(signal, async () => {
      if (isShuttingDown) return;
      isShuttingDown = true;

      logger.info(`[Worker] Received ${signal}, shutting down gracefully...`);

      // Give active jobs 30s to complete
      setTimeout(() => {
        logger.warn('[Worker] Forced shutdown after 30s');
        process.exit(1);
      }, 30_000);

      try {
        // Close worker connections
        const botWorkerModule = await import('./queue/botWorker');
        // @ts-ignore
        if (typeof botWorkerModule.closeWorker === 'function') {
          // @ts-ignore
          await botWorkerModule.closeWorker();
        }
      } catch (err: any) {
        logger.error('[Worker] Error during shutdown', { error: err?.message });
      }

      process.exit(0);
    });
  });
}

// ---------------------------------------------------------------------------
// Worker Startup
// ---------------------------------------------------------------------------

async function startWorker() {
  logger.info('[Worker] ══════════════════════════════════════');
  logger.info('[Worker] Bot Worker Process Starting');
  logger.info('[Worker] ══════════════════════════════════════');

  // 1. Initialize local SQLite database (OEM data)
  try {
    await initDb();
    logger.info('[Worker] Local database initialized');
  } catch (err: any) {
    logger.error('[Worker] Database init failed', { error: err?.message });
    process.exit(1);
  }

  // 2. Start BullMQ workers
  try {
    await import('./queue/botWorker');
    logger.info('[Worker] BullMQ worker started, listening for messages...');
  } catch (err: any) {
    logger.error('[Worker] Failed to start BullMQ worker', { error: err?.message });
    process.exit(1);
  }

  // 3. Set up graceful shutdown
  setupGracefulShutdown();

  // 4. Health heartbeat (every 60s)
  setInterval(() => {
    if (!isShuttingDown) {
      logger.debug('[Worker] Heartbeat — worker is alive');
    }
  }, 60_000);

  // 5. OEM Database Auto-Updater (Daily)
  // Run once on startup, then every 24 hours
  if (!isShuttingDown) {
      logger.info('[Worker] Running initial OEM Database Auto-Update...');
      runOemAutoUpdate().catch(err => {
          logger.error('[Worker] Initial OEM update failed', { error: err?.message });
      });
  }

  setInterval(() => {
    if (!isShuttingDown) {
      logger.info('[Worker] Running daily OEM Database Auto-Update...');
      runOemAutoUpdate().catch(err => {
        logger.error('[Worker] OEM update failed', { error: err?.message });
      });
    }
  }, 24 * 60 * 60 * 1000);

  logger.info('[Worker] Ready to process messages');
}

// Start
startWorker().catch(err => {
  logger.error('[Worker] Fatal startup error', { error: err?.message });
  process.exit(1);
});
