import puppeteer from 'puppeteer-extra';
import StealthPlugin from 'puppeteer-extra-plugin-stealth';
import { Browser, Page } from 'puppeteer';
import { logger } from '../../utils/logger';

puppeteer.use(StealthPlugin());

let browserInstance: Browser | null = null;
let lastUsed = 0;
const TIMEOUT_MS = 120000; // 2 minutes auto-close

// Random user agents pool
const USER_AGENTS = [
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.1 Safari/605.1.15'
];

function randomUserAgent(): string {
    return USER_AGENTS[Math.floor(Math.random() * USER_AGENTS.length)];
}

function randomDelay(min: number, max: number): Promise<void> {
    const delay = Math.floor(Math.random() * (max - min + 1)) + min;
    return new Promise(resolve => setTimeout(resolve, delay));
}

export async function getBrowser(): Promise<Browser> {
    lastUsed = Date.now();
    if (browserInstance) {
        return browserInstance;
    }

    logger.info("[Browser] Launching enhanced stealth browser...");
    browserInstance = await puppeteer.launch({
        headless: true, // Set to false for debugging
        args: [
            '--no-sandbox',
            '--disable-setuid-sandbox',
            '--disable-blink-features=AutomationControlled',
            '--disable-dev-shm-usage',
            '--disable-accelerated-2d-canvas',
            '--disable-gpu',
            '--window-size=1920,1080',
            '--disable-web-security',
            '--disable-features=IsolateOrigins,site-per-process',
            `--user-agent=${randomUserAgent()}`
        ]
    });

    // Auto-close logic
    setTimeout(checkIdle, TIMEOUT_MS);

    return browserInstance;
}

async function checkIdle() {
    if (!browserInstance) return;
    if (Date.now() - lastUsed > TIMEOUT_MS) {
        logger.info("[Browser] Idle timeout, closing browser.");
        await browserInstance.close();
        browserInstance = null;
    } else {
        setTimeout(checkIdle, TIMEOUT_MS);
    }
}

export async function closeBrowser() {
    if (browserInstance) {
        await browserInstance.close();
        browserInstance = null;
    }
}

export async function withPage<T>(callback: (page: Page) => Promise<T>): Promise<T | null> {
    const browser = await getBrowser();
    const page = await browser.newPage();
    try {
        // Randomize viewport
        const viewports = [
            { width: 1920, height: 1080 },
            { width: 1366, height: 768 },
            { width: 1440, height: 900 }
        ];
        const viewport = viewports[Math.floor(Math.random() * viewports.length)];
        await page.setViewport(viewport);

        // Enhanced headers
        await page.setExtraHTTPHeaders({
            'Accept-Language': 'de-DE,de;q=0.9,en-US;q=0.8,en;q=0.7',
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
            'Accept-Encoding': 'gzip, deflate, br',
            'Cache-Control': 'max-age=0',
            'Sec-Fetch-Dest': 'document',
            'Sec-Fetch-Mode': 'navigate',
            'Sec-Fetch-Site': 'none',
            'Sec-Fetch-User': '?1',
            'Upgrade-Insecure-Requests': '1'
        });

        // Override navigator properties to hide automation
        await page.evaluateOnNewDocument(() => {
            Object.defineProperty(navigator, 'webdriver', {
                get: () => false,
            });

            // Mock plugins
            Object.defineProperty(navigator, 'plugins', {
                get: () => [1, 2, 3, 4, 5],
            });

            // Mock languages
            Object.defineProperty(navigator, 'languages', {
                get: () => ['de-DE', 'de', 'en-US', 'en'],
            });

            // Chrome runtime
            (window as any).chrome = {
                runtime: {}
            };
        });

        // Random initial delay to mimic human behavior
        await randomDelay(500, 1500);

        return await callback(page);
    } catch (error: any) {
        logger.error("[Browser] Page error", { error: error.message });
        return null;
    } finally {
        await page.close();
    }
}
