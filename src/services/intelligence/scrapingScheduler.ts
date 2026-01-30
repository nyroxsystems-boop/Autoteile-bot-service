/**
 * 🕷️ OEM SCRAPING SCHEDULER
 * Automated scheduling for OEM data collection
 * 
 * Schedules:
 * - Daily P0 scrape at 3:00 AM
 * - Weekly full scrape on Sunday 2:00 AM
 * - On-demand triggers
 */

import { runScrape } from './oemScrapingEngine';
import { logger } from '@utils/logger';

// ============================================================================
// Configuration
// ============================================================================

interface ScheduleConfig {
    name: string;
    cron: string;           // Cron expression
    priority?: 0 | 1 | 2;
    maxPages?: number;
    enabled: boolean;
}

const SCHEDULES: ScheduleConfig[] = [
    {
        name: 'daily-priority',
        cron: '0 3 * * *',        // 3:00 AM daily
        priority: 0,              // Only P0 targets
        maxPages: 500,
        enabled: true,
    },
    {
        name: 'weekly-full',
        cron: '0 2 * * 0',        // 2:00 AM Sunday
        priority: undefined,      // All targets
        maxPages: 1000,
        enabled: true,
    },
    {
        name: 'hourly-check',
        cron: '0 * * * *',        // Every hour
        priority: 0,
        maxPages: 50,             // Quick check
        enabled: false,           // Disabled by default
    },
];

// ============================================================================
// Scheduler State
// ============================================================================

interface SchedulerState {
    isRunning: boolean;
    lastRun?: Date;
    lastError?: string;
    runsToday: number;
    totalOEMsCollected: number;
}

const state: SchedulerState = {
    isRunning: false,
    runsToday: 0,
    totalOEMsCollected: 0,
};

// ============================================================================
// Schedule Execution
// ============================================================================

async function executeSchedule(config: ScheduleConfig): Promise<void> {
    if (state.isRunning) {
        logger.warn(`[Scheduler] Skipping ${config.name}: Another scrape is running`);
        return;
    }

    state.isRunning = true;
    logger.info(`[Scheduler] Starting scheduled scrape: ${config.name}`);

    try {
        const stats = await runScrape({
            priority: config.priority,
            maxPages: config.maxPages,
        });

        state.lastRun = new Date();
        state.runsToday++;
        state.totalOEMsCollected += stats.oemsExtracted;

        logger.info(`[Scheduler] Completed ${config.name}: ${stats.oemsExtracted} OEMs`);

    } catch (error: any) {
        state.lastError = error.message;
        logger.error(`[Scheduler] Failed ${config.name}: ${error.message}`);
    } finally {
        state.isRunning = false;
    }
}

// ============================================================================
// Cron Parser (Simple)
// ============================================================================

function parseCron(cron: string): { minute: number; hour: number; dayOfWeek?: number } | null {
    const parts = cron.split(' ');
    if (parts.length < 5) return null;

    const [minute, hour, , , dayOfWeek] = parts;

    return {
        minute: parseInt(minute, 10),
        hour: parseInt(hour, 10),
        dayOfWeek: dayOfWeek !== '*' ? parseInt(dayOfWeek, 10) : undefined,
    };
}

function shouldRunNow(config: ScheduleConfig): boolean {
    if (!config.enabled) return false;

    const parsed = parseCron(config.cron);
    if (!parsed) return false;

    const now = new Date();

    if (now.getMinutes() !== parsed.minute) return false;
    if (now.getHours() !== parsed.hour) return false;
    if (parsed.dayOfWeek !== undefined && now.getDay() !== parsed.dayOfWeek) return false;

    return true;
}

// ============================================================================
// Scheduler Loop
// ============================================================================

let schedulerInterval: NodeJS.Timeout | null = null;

export function startScheduler(): void {
    if (schedulerInterval) {
        logger.warn('[Scheduler] Already running');
        return;
    }

    logger.info('[Scheduler] Starting OEM scraping scheduler');

    // Check every minute
    schedulerInterval = setInterval(() => {
        for (const config of SCHEDULES) {
            if (shouldRunNow(config)) {
                executeSchedule(config);
            }
        }
    }, 60000); // 1 minute

    // Log active schedules
    const active = SCHEDULES.filter(s => s.enabled);
    logger.info(`[Scheduler] Active schedules: ${active.map(s => s.name).join(', ')}`);
}

export function stopScheduler(): void {
    if (schedulerInterval) {
        clearInterval(schedulerInterval);
        schedulerInterval = null;
        logger.info('[Scheduler] Stopped');
    }
}

// ============================================================================
// Manual Triggers
// ============================================================================

export async function triggerScrape(scheduleName?: string): Promise<void> {
    const config = scheduleName
        ? SCHEDULES.find(s => s.name === scheduleName)
        : SCHEDULES[0]; // Default to first

    if (!config) {
        throw new Error(`Unknown schedule: ${scheduleName}`);
    }

    await executeSchedule(config);
}

export function getSchedulerStatus(): SchedulerState & { schedules: ScheduleConfig[] } {
    return {
        ...state,
        schedules: SCHEDULES,
    };
}

// ============================================================================
// CLI
// ============================================================================

if (require.main === module) {
    const args = process.argv.slice(2);

    if (args.includes('--trigger')) {
        const name = args[args.indexOf('--trigger') + 1];
        console.log(`🕷️ Triggering scrape: ${name || 'daily-priority'}`);
        triggerScrape(name).then(() => {
            console.log('✅ Complete');
            process.exit(0);
        });
    } else if (args.includes('--status')) {
        console.log('📊 Scheduler Status:');
        console.log(JSON.stringify(getSchedulerStatus(), null, 2));
    } else {
        console.log('🕷️ Starting OEM Scraping Scheduler...');
        console.log('Press Ctrl+C to stop\n');
        startScheduler();
    }
}

export default {
    startScheduler,
    stopScheduler,
    triggerScrape,
    getSchedulerStatus,
};
