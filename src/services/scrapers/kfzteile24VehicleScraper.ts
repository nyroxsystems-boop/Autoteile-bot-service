import { chromium, Page } from 'playwright';
import { ScrapedOffer, ShopAdapter } from '../scrapingService';
import * as cheerio from 'cheerio';
import { logger } from '../../utils/logger';

/**
 * KFZTeile24 Scraper mit Fahrzeugdaten
 * Nutzt Marke, Modell, Jahr statt OEM-Nummer
 */
export class KFZTeile24VehicleScraper implements ShopAdapter {
    name: string = "KFZTeile24";

    private vehicleData: {
        make?: string;
        model?: string;
        year?: number;
        engine?: string;
    } | null = null;

    constructor(vehicleData?: any) {
        this.vehicleData = vehicleData || null;
    }

    async fetchOffers(oem: string): Promise<ScrapedOffer[]> {
        // Wenn keine Fahrzeugdaten, können wir nicht suchen
        if (!this.vehicleData || !this.vehicleData.make || !this.vehicleData.model) {
            logger.warn(`[${this.name}] No vehicle data available, skipping KFZTeile24`);
            return [];
        }

        logger.info(`[${this.name}] Scraping with vehicle data:`, this.vehicleData);

        try {
            const browser = await chromium.launch({ headless: false });
            const context = await browser.newContext({
                userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
                viewport: { width: 1920, height: 1080 },
                locale: 'de-DE'
            });

            const page = await context.newPage();

            // STEP 1: Go to homepage
            logger.info(`[${this.name}] Step 1: Going to homepage...`);
            await page.goto('https://www.kfzteile24.de', { waitUntil: 'networkidle' });
            await page.waitForTimeout(3000);

            // STEP 2: Enter vehicle data in selector
            logger.info(`[${this.name}] Step 2: Entering vehicle data...`);
            const success = await this.selectVehicle(page);

            if (!success) {
                logger.warn(`[${this.name}] Could not select vehicle`);
                await browser.close();
                return [];
            }

            // STEP 3: Search for part category (e.g. "Bremsscheibe")
            logger.info(`[${this.name}] Step 3: Searching for parts...`);
            await page.waitForTimeout(2000);

            // Try to search for "Bremsscheibe" or use OEM number
            try {
                const searchBox = await page.locator('input[name="search"]').first();
                await searchBox.fill(oem);
                await searchBox.press('Enter');
                await page.waitForLoadState('networkidle');
                await page.waitForTimeout(3000);
            } catch (e) {
                logger.warn(`[${this.name}] Could not use search box`);
            }

            // STEP 4: Parse products
            const html = await page.content();
            await browser.close();

            logger.info(`[${this.name}] Got HTML (${html.length} bytes)`);

            return this.parseHtml(html, oem);

        } catch (error: any) {
            logger.error(`[${this.name}] Error:`, error.message);
            return [];
        }
    }

    private async selectVehicle(page: Page): Promise<boolean> {
        try {
            const { make, model, year } = this.vehicleData!;

            // Click on vehicle selector
            const selectorButton = page.locator('.vehicleSelector, [data-vehicle-selector]').first();
            if (await selectorButton.count() > 0) {
                await selectorButton.click();
                await page.waitForTimeout(2000);
            }

            // Select make (e.g. "VW")
            const makeInput = page.locator('input[placeholder*="Marke"], input[name*="make"]').first();
            if (await makeInput.count() > 0) {
                await makeInput.fill(make!);
                await page.waitForTimeout(1000);
                await page.keyboard.press('ArrowDown');
                await page.keyboard.press('Enter');
                await page.waitForTimeout(1000);
            }

            // Select model (e.g. "Golf")
            const modelInput = page.locator('input[placeholder*="Modell"], input[name*="model"]').first();
            if (await modelInput.count() > 0) {
                await modelInput.fill(model!);
                await page.waitForTimeout(1000);
                await page.keyboard.press('ArrowDown');
                await page.keyboard.press('Enter');
                await page.waitForTimeout(1000);
            }

            // Select year if available
            if (year) {
                const yearInput = page.locator('input[placeholder*="Jahr"], select[name*="year"]').first();
                if (await yearInput.count() > 0) {
                    await yearInput.fill(year.toString());
                    await page.waitForTimeout(500);
                }
            }

            // Submit
            const submitButton = page.locator('button[type="submit"], .submitVehicle').first();
            if (await submitButton.count() > 0) {
                await submitButton.click();
                await page.waitForLoadState('networkidle');
                await page.waitForTimeout(2000);
                return true;
            }

            return false;

        } catch (e) {
            logger.error(`[${this.name}] Error selecting vehicle:`, String(e));
            return false;
        }
    }

    private parseHtml(html: string, oem: string): ScrapedOffer[] {
        const $ = cheerio.load(html);
        const offers: ScrapedOffer[] = [];

        // Try multiple selectors
        const selectors = [
            '.productBox',
            '[data-article-id]',
            '.product-item',
            'article'
        ];

        for (const selector of selectors) {
            const items = $(selector);
            if (items.length > 0) {
                logger.info(`[${this.name}] Found ${items.length} products with ${selector}`);

                items.slice(0, 10).each((i, el) => {
                    try {
                        const $el = $(el);

                        // Extract brand
                        const brand = $el.find('.brand, [data-brand]').first().text().trim() || "Unknown";

                        // Extract price
                        const priceText = $el.find('.price, [data-price]').first().text().trim();
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
                                    productUrl: link ? (link.startsWith('http') ? link : `https://www.kfzteile24.de${link}`) : null,
                                    imageUrl: img,
                                    rating: 4.3,
                                    isRecommended: i === 0
                                });
                            }
                        }
                    } catch (e) {
                        // Skip item
                    }
                });

                if (offers.length > 0) break;
            }
        }

        logger.info(`[${this.name}] Parsed ${offers.length} offers`);
        return offers;
    }
}
