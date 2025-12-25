import { chromium, Browser, BrowserContext } from 'playwright';
import { ScrapedOffer, ShopAdapter } from '../scrapingService';
import * as cheerio from 'cheerio';
import { logger } from '../../utils/logger';
import * as fs from 'fs';

/**
 * Ultra-realistic browser automation
 * Simulates real human behavior to bypass bot detection
 */
export class RealisticBrowserScraper implements ShopAdapter {
    name: string;
    private targetShop: 'autodoc' | 'kfzteile24';
    private static browser: Browser | null = null;
    private static context: BrowserContext | null = null;

    constructor(shopName: string, targetShop: 'autodoc' | 'kfzteile24') {
        this.name = shopName;
        this.targetShop = targetShop;
    }

    private async getBrowserContext(): Promise<BrowserContext> {
        if (RealisticBrowserScraper.context) {
            return RealisticBrowserScraper.context;
        }

        if (!RealisticBrowserScraper.browser) {
            RealisticBrowserScraper.browser = await chromium.launch({
                headless: false, // WICHTIG: Sichtbarer Browser um Bot-Detection zu umgehen
                args: [
                    '--disable-blink-features=AutomationControlled',
                    '--disable-features=IsolateOrigins,site-per-process'
                ]
            });
        }

        // Persistent context mit echtem User-Profil
        RealisticBrowserScraper.context = await RealisticBrowserScraper.browser.newContext({
            userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            viewport: { width: 1920, height: 1080 },
            locale: 'de-DE',
            timezoneId: 'Europe/Berlin',
            permissions: ['geolocation'],
            geolocation: { latitude: 52.520008, longitude: 13.404954 },
            colorScheme: 'light',
            hasTouch: false,
            isMobile: false,
            javaScriptEnabled: true,
            acceptDownloads: true,
            extraHTTPHeaders: {
                'Accept-Language': 'de-DE,de;q=0.9,en-US;q=0.8,en;q=0.7',
                'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
                'Accept-Encoding': 'gzip, deflate, br',
                'Cache-Control': 'no-cache',
                'Pragma': 'no-cache',
                'Sec-Ch-Ua': '"Not_A Brand";v="8", "Chromium";v="120", "Google Chrome";v="120"',
                'Sec-Ch-Ua-Mobile': '?0',
                'Sec-Ch-Ua-Platform': '"macOS"',
                'Sec-Fetch-Dest': 'document',
                'Sec-Fetch-Mode': 'navigate',
                'Sec-Fetch-Site': 'none',
                'Sec-Fetch-User': '?1',
                'Upgrade-Insecure-Requests': '1'
            }
        });

        // Anti-detection scripts
        await RealisticBrowserScraper.context.addInitScript(() => {
            // Remove webdriver property
            Object.defineProperty(navigator, 'webdriver', {
                get: () => undefined
            });

            // Mock chrome object
            (window as any).chrome = {
                runtime: {},
                loadTimes: function () { },
                csi: function () { },
                app: {}
            };

            // Mock permissions
            const originalQuery = window.navigator.permissions.query;
            window.navigator.permissions.query = (parameters: any) => (
                parameters.name === 'notifications' ?
                    Promise.resolve({ state: 'prompt' } as PermissionStatus) :
                    originalQuery(parameters)
            );

            // Mock plugins
            Object.defineProperty(navigator, 'plugins', {
                get: () => [
                    { name: 'Chrome PDF Plugin', filename: 'internal-pdf-viewer', description: 'Portable Document Format' },
                    { name: 'Chrome PDF Viewer', filename: 'mhjfbmdgcfjbbpaeojofohoefgiehjai', description: '' },
                    { name: 'Native Client', filename: 'internal-nacl-plugin', description: '' }
                ]
            });

            // Mock languages
            Object.defineProperty(navigator, 'languages', {
                get: () => ['de-DE', 'de', 'en-US', 'en']
            });
        });

        return RealisticBrowserScraper.context;
    }

    async fetchOffers(oem: string): Promise<ScrapedOffer[]> {
        logger.info(`[${this.name}-Realistic] Scraping with realistic browser for ${oem}...`);

        try {
            const context = await this.getBrowserContext();
            const page = await context.newPage();

            const url = this.buildTargetUrl(oem);
            logger.info(`[${this.name}-Realistic] Navigating to: ${url}`);

            // Realistische Navigation
            await page.goto(url, { waitUntil: 'networkidle', timeout: 60000 });

            // Warte auf Seite wie ein Mensch (länger für React-Apps)
            await this.humanWait(5000, 8000);

            // KFZTeile24 special handling: Check if redirected to category page
            if (this.targetShop === 'kfzteile24') {
                const currentUrl = page.url();
                if (currentUrl.includes('/ersatzteile-') || currentUrl.includes('/bremsanlage')) {
                    logger.info(`[${this.name}-Realistic] Detected category redirect, trying alternative approach...`);

                    // Try to find and click on "Bremsscheiben" or similar category
                    try {
                        const categoryLink = await page.locator('a[href*="bremsscheiben"]').first();
                        if (await categoryLink.count() > 0) {
                            logger.info(`[${this.name}-Realistic] Clicking on Bremsscheiben category...`);
                            await categoryLink.click();
                            await page.waitForLoadState('networkidle');
                            await this.humanWait(3000, 5000);
                        }
                    } catch (e) {
                        logger.warn(`[${this.name}-Realistic] Could not navigate to category`);
                    }
                }
            }

            // Simuliere Mausbewegung
            await this.humanMouseMovement(page);

            // Scroll wie ein Mensch (triggert lazy loading)
            await this.humanScroll(page);

            // Warte nochmal (React braucht Zeit)
            await this.humanWait(3000, 5000);

            // Warte auf Produkte (mit mehreren Selektoren)
            const productSelectors = [
                '[data-product-id]',
                '.product-card',
                '[itemtype*="Product"]',
                '.search-result',
                '[class*="product"]',
                '.productBox',  // KFZTeile24 specific
                '[data-article-id]'  // KFZTeile24 specific
            ];

            let productsLoaded = false;
            for (const selector of productSelectors) {
                try {
                    await page.waitForSelector(selector, {
                        timeout: 10000,
                        state: 'visible'
                    });
                    logger.info(`[${this.name}-Realistic] Products loaded with selector: ${selector}`);
                    productsLoaded = true;
                    break;
                } catch (e) {
                    // Try next selector
                }
            }

            if (!productsLoaded) {
                logger.warn(`[${this.name}-Realistic] No products found with any selector`);
            }

            // Noch ein bisschen warten
            await this.humanWait(2000, 3000);

            const html = await page.content();

            // DEBUG: Save HTML and screenshot
            const debugDir = '/tmp/scraper-debug';
            if (!fs.existsSync(debugDir)) {
                fs.mkdirSync(debugDir, { recursive: true });
            }

            const timestamp = Date.now();
            fs.writeFileSync(`${debugDir}/${this.targetShop}-${timestamp}.html`, html);
            await page.screenshot({ path: `${debugDir}/${this.targetShop}-${timestamp}.png`, fullPage: true });
            logger.info(`[${this.name}-Realistic] Saved debug files to ${debugDir}`);

            await page.close();

            logger.info(`[${this.name}-Realistic] Got HTML (${html.length} bytes)`);

            return this.parseHtml(html, oem, url);

        } catch (error: any) {
            logger.error(`[${this.name}-Realistic] Error`, { error: error.message });
            return [];
        }
    }

    private async humanWait(min: number, max: number): Promise<void> {
        const delay = Math.floor(Math.random() * (max - min + 1)) + min;
        await new Promise(resolve => setTimeout(resolve, delay));
    }

    private async humanMouseMovement(page: any): Promise<void> {
        // Simuliere realistische Mausbewegungen
        const movements = Math.floor(Math.random() * 3) + 2;
        for (let i = 0; i < movements; i++) {
            const x = Math.floor(Math.random() * 1000) + 100;
            const y = Math.floor(Math.random() * 700) + 100;
            await page.mouse.move(x, y, { steps: 10 });
            await this.humanWait(100, 300);
        }
    }

    private async humanScroll(page: any): Promise<void> {
        // Scroll in mehreren Schritten wie ein Mensch
        const scrolls = Math.floor(Math.random() * 3) + 2;
        for (let i = 0; i < scrolls; i++) {
            await page.evaluate(() => {
                window.scrollBy({
                    top: Math.random() * 400 + 200,
                    behavior: 'smooth'
                });
            });
            await this.humanWait(500, 1200);
        }
    }

    private buildTargetUrl(oem: string): string {
        if (this.targetShop === 'autodoc') {
            return `https://www.autodoc.de/search?keyword=${encodeURIComponent(oem)}`;
        } else {
            // KFZTeile24: Try multiple URL strategies
            // Strategy 1: Direct search (might redirect to categories)
            // Strategy 2: Use as article number filter
            // We'll try the direct search first
            return `https://www.kfzteile24.de/suche?search=${encodeURIComponent(oem)}`;
        }
    }

    private parseHtml(html: string, oem: string, url: string): ScrapedOffer[] {
        const $ = cheerio.load(html);
        const offers: ScrapedOffer[] = [];

        if (this.targetShop === 'autodoc') {
            // Autodoc uses .listing-item with data-price attribute
            const items = $('.listing-item[data-price]');

            if (items.length > 0) {
                logger.info(`[${this.name}-Realistic] Found ${items.length} Autodoc products`);

                items.slice(0, 10).each((i, el) => {
                    try {
                        const $el = $(el);

                        // Price is in data-price attribute!
                        const priceStr = $el.attr('data-price');
                        const price = priceStr ? parseFloat(priceStr) : 0;

                        // Brand is in the product name (e.g. "RIDEX Bremsscheibe")
                        const nameText = $el.find('.listing-item__name').first().text().trim();
                        const brand = nameText.split(' ')[0] || "Unknown";

                        // Link
                        const link = $el.find('.listing-item__name').first().attr('href');

                        // Image
                        const img = $el.find('.listing-item__image-product img').first().attr('src');

                        // Article number
                        const articleText = $el.find('.listing-item__article-item').first().text();

                        if (!isNaN(price) && price > 0 && price < 10000) {
                            offers.push({
                                shopName: "Autodoc",
                                brand: brand,
                                price: price,
                                currency: "EUR",
                                availability: "In Stock",
                                deliveryTimeDays: 2,
                                productUrl: link ? (link.startsWith('http') ? link : `https://www.autodoc.de${link}`) : url,
                                imageUrl: img,
                                rating: 4.5,
                                isRecommended: i === 0
                            });
                        }
                    } catch (e) {
                        logger.warn(`[${this.name}-Realistic] Error parsing item: ${e}`);
                    }
                });
            } else {
                logger.warn(`[${this.name}-Realistic] No .listing-item elements found`);
            }
        } else {
            // KFZTeile24 parsing...
            const strategies = [
                '[data-testid="product-card"]',
                '.product-card',
                'article'
            ];

            for (const selector of strategies) {
                const items = $(selector);
                if (items.length > 0) {
                    logger.info(`[${this.name}-Realistic] Found ${items.length} items`);

                    items.slice(0, 10).each((i, el) => {
                        try {
                            const $el = $(el);
                            const brand = $el.find('[data-testid="brand-name"], .brand').first().text().trim() || "Unknown";
                            const priceText = $el.find('[data-testid="price-value"], .price').first().text().trim();
                            const priceMatch = priceText.match(/(\d+)[.,](\d{2})/);

                            if (priceMatch) {
                                const price = parseFloat(`${priceMatch[1]}.${priceMatch[2]}`);
                                const link = $el.find('a').first().attr('href');
                                const img = $el.find('img').first().attr('src');

                                if (!isNaN(price) && price > 0 && price < 10000) {
                                    offers.push({
                                        shopName: "KFZTeile24",
                                        brand: brand,
                                        price: price,
                                        currency: "EUR",
                                        availability: "In Stock",
                                        deliveryTimeDays: 1,
                                        productUrl: link ? (link.startsWith('http') ? link : `https://www.kfzteile24.de${link}`) : url,
                                        imageUrl: img,
                                        rating: 4.3,
                                        isRecommended: i === 0
                                    });
                                }
                            }
                        } catch (e) { }
                    });

                    if (offers.length > 0) break;
                }
            }
        }

        return offers;
    }

    static async cleanup() {
        if (RealisticBrowserScraper.context) {
            await RealisticBrowserScraper.context.close();
            RealisticBrowserScraper.context = null;
        }
        if (RealisticBrowserScraper.browser) {
            await RealisticBrowserScraper.browser.close();
            RealisticBrowserScraper.browser = null;
        }
    }
}
