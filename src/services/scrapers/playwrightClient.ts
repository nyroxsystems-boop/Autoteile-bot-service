import { chromium, Browser, Page } from 'playwright';
import { logger } from '../../utils/logger';
import UserAgent from 'user-agents';

let browserInstance: Browser | null = null;
let lastUsed = 0;
const TIMEOUT_MS = 180000; // 3 minutes

// Realistic fingerprints
const SCREEN_RESOLUTIONS = [
    { width: 1920, height: 1080 },
    { width: 1366, height: 768 },
    { width: 1440, height: 900 },
    { width: 1536, height: 864 },
    { width: 1280, height: 720 }
];

const LANGUAGES = [
    ['de-DE', 'de', 'en-US', 'en'],
    ['de-DE', 'de', 'en'],
    ['de', 'en-US', 'en']
];

function randomChoice<T>(arr: T[]): T {
    return arr[Math.floor(Math.random() * arr.length)];
}

function randomDelay(min: number, max: number): Promise<void> {
    const delay = Math.floor(Math.random() * (max - min + 1)) + min;
    return new Promise(resolve => setTimeout(resolve, delay));
}

export async function getPlaywrightBrowser(): Promise<Browser> {
    lastUsed = Date.now();

    if (browserInstance && browserInstance.isConnected()) {
        return browserInstance;
    }

    logger.info("[Playwright] Launching ultra-stealth browser...");

    browserInstance = await chromium.launch({
        headless: true,
        args: [
            '--disable-blink-features=AutomationControlled',
            '--disable-dev-shm-usage',
            '--no-sandbox',
            '--disable-setuid-sandbox',
            '--disable-web-security',
            '--disable-features=IsolateOrigins,site-per-process,VizDisplayCompositor',
            '--disable-background-timer-throttling',
            '--disable-backgrounding-occluded-windows',
            '--disable-renderer-backgrounding',
            '--disable-infobars',
            '--window-position=0,0',
            '--ignore-certifcate-errors',
            '--ignore-certifcate-errors-spki-list',
            '--disable-gpu'
        ]
    });

    setTimeout(checkIdle, TIMEOUT_MS);
    return browserInstance;
}

async function checkIdle() {
    if (!browserInstance) return;
    if (Date.now() - lastUsed > TIMEOUT_MS) {
        logger.info("[Playwright] Idle timeout, closing browser.");
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

export async function withPlaywrightPage<T>(callback: (page: Page) => Promise<T>): Promise<T | null> {
    const browser = await getPlaywrightBrowser();
    const resolution = randomChoice(SCREEN_RESOLUTIONS);
    const languages = randomChoice(LANGUAGES);
    const userAgent = new UserAgent({ deviceCategory: 'desktop' });

    const context = await browser.newContext({
        viewport: resolution,
        userAgent: userAgent.toString(),
        locale: 'de-DE',
        timezoneId: 'Europe/Berlin',
        permissions: [],
        geolocation: { latitude: 52.520008, longitude: 13.404954 }, // Berlin
        colorScheme: 'light',
        extraHTTPHeaders: {
            'Accept-Language': languages.join(','),
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
            'Accept-Encoding': 'gzip, deflate, br',
            'Cache-Control': 'max-age=0',
            'Sec-Fetch-Dest': 'document',
            'Sec-Fetch-Mode': 'navigate',
            'Sec-Fetch-Site': 'none',
            'Sec-Fetch-User': '?1',
            'Sec-Ch-Ua': '"Not_A Brand";v="8", "Chromium";v="120", "Google Chrome";v="120"',
            'Sec-Ch-Ua-Mobile': '?0',
            'Sec-Ch-Ua-Platform': '"Windows"',
            'Upgrade-Insecure-Requests': '1'
        }
    });

    // Advanced anti-detection
    await context.addInitScript(() => {
        // Override navigator.webdriver
        Object.defineProperty(navigator, 'webdriver', {
            get: () => undefined
        });

        // Mock plugins
        Object.defineProperty(navigator, 'plugins', {
            get: () => [
                { name: 'Chrome PDF Plugin', filename: 'internal-pdf-viewer' },
                { name: 'Chrome PDF Viewer', filename: 'mhjfbmdgcfjbbpaeojofohoefgiehjai' },
                { name: 'Native Client', filename: 'internal-nacl-plugin' }
            ]
        });

        // Mock permissions
        const originalQuery = window.navigator.permissions.query;
        window.navigator.permissions.query = (parameters: any) => (
            parameters.name === 'notifications' ?
                Promise.resolve({ state: 'denied' } as PermissionStatus) :
                originalQuery(parameters)
        );

        // Chrome runtime
        (window as any).chrome = {
            runtime: {},
            loadTimes: function () { },
            csi: function () { }
        };

        // Remove automation indicators
        delete (window as any).__nightmare;
        delete (window as any)._phantom;
        delete (window as any).callPhantom;
    });

    const page = await context.newPage();

    try {
        // Random initial delay
        await randomDelay(800, 2000);

        const result = await callback(page);

        await context.close();
        return result;
    } catch (error: any) {
        logger.error("[Playwright] Page error", { error: error.message });
        await context.close();
        return null;
    }
}

// Human-like mouse movements
export async function humanScroll(page: Page) {
    const scrolls = Math.floor(Math.random() * 3) + 1;
    for (let i = 0; i < scrolls; i++) {
        await page.evaluate(() => {
            window.scrollBy({
                top: Math.random() * 400 + 200,
                behavior: 'smooth'
            });
        });
        await randomDelay(500, 1200);
    }
}

export async function humanMouseMove(page: Page) {
    const x = Math.floor(Math.random() * 800) + 100;
    const y = Math.floor(Math.random() * 600) + 100;
    await page.mouse.move(x, y);
    await randomDelay(100, 300);
}
