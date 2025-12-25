import { withPlaywrightPage, humanScroll, humanMouseMove } from './playwrightClient';
import { ScrapedOffer, ShopAdapter } from '../scrapingService';
import * as cheerio from 'cheerio';
import { logger } from '../../utils/logger';

export class PlaywrightKFZTeileScraper implements ShopAdapter {
    name = "KFZTeile24";

    async fetchOffers(oem: string): Promise<ScrapedOffer[]> {
        logger.info(`[KFZTeile24-PW] Ultra-stealth scraping for ${oem}...`);

        return await withPlaywrightPage(async (page) => {
            const url = `https://www.kfzteile24.de/suche?search=${encodeURIComponent(oem)}`;

            try {
                await page.goto(url, {
                    waitUntil: 'networkidle',
                    timeout: 60000
                });

                await page.waitForTimeout(1500 + Math.random() * 1500);

                // Human behavior
                await humanMouseMove(page);
                await humanScroll(page);

                // Wait for products
                try {
                    await page.waitForSelector('[data-testid="product-card"], .product-card, article', {
                        timeout: 12000,
                        state: 'visible'
                    });
                } catch (e) {
                    logger.warn("[KFZTeile24-PW] Product selector timeout");
                }

                await page.waitForTimeout(1000);

                const html = await page.content();
                return this.parseHtml(html, url);

            } catch (error: any) {
                logger.error("[KFZTeile24-PW] Scraping error", { error: error.message });
                return [];
            }
        }) || [];
    }

    private parseHtml(html: string, url: string): ScrapedOffer[] {
        const $ = cheerio.load(html);
        const offers: ScrapedOffer[] = [];

        const strategies = [
            {
                container: '[data-testid="product-card"]',
                brand: '[data-testid="brand-name"]',
                price: '[data-testid="price-value"]',
                link: 'a',
                image: 'img'
            },
            {
                container: '.product-card, article',
                brand: '.brand, [class*="brand"]',
                price: '.price, [class*="price"]',
                link: 'a',
                image: 'img'
            }
        ];

        for (const strategy of strategies) {
            const items = $(strategy.container);

            if (items.length > 0) {
                logger.info(`[KFZTeile24-PW] Found ${items.length} items`);

                items.each((i, el) => {
                    try {
                        const $el = $(el);
                        const brand = $el.find(strategy.brand).first().text().trim();
                        const priceText = $el.find(strategy.price).first().text().trim();

                        const priceMatch = priceText.match(/(\d+)[.,](\d{2})/);
                        if (priceMatch) {
                            const price = parseFloat(`${priceMatch[1]}.${priceMatch[2]}`);
                            const link = $el.find(strategy.link).first().attr('href');
                            const img = $el.find(strategy.image).first().attr('src');

                            if (!isNaN(price) && price > 0 && price < 10000) {
                                offers.push({
                                    shopName: "KFZTeile24",
                                    brand: brand || "Unknown",
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
                    } catch (e) {
                        // Skip item
                    }
                });

                if (offers.length > 0) break;
            }
        }

        return offers;
    }
}
