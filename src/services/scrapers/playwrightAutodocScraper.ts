import { withPlaywrightPage, humanScroll, humanMouseMove } from './playwrightClient';
import { ScrapedOffer, ShopAdapter } from '../scrapingService';
import * as cheerio from 'cheerio';
import { logger } from '../../utils/logger';

export class PlaywrightAutodocScraper implements ShopAdapter {
    name = "Autodoc";

    async fetchOffers(oem: string): Promise<ScrapedOffer[]> {
        logger.info(`[Autodoc-PW] Ultra-stealth scraping for ${oem}...`);

        return await withPlaywrightPage(async (page) => {
            const url = `https://www.autodoc.de/search?keyword=${encodeURIComponent(oem)}`;

            try {
                // Navigate with realistic settings
                await page.goto(url, {
                    waitUntil: 'domcontentloaded',
                    timeout: 60000
                });

                // Wait a bit for JS to load
                await page.waitForTimeout(2000 + Math.random() * 2000);

                // Human-like behavior (wrapped in try-catch for navigation)
                try {
                    await humanMouseMove(page);
                    await humanScroll(page);
                    await page.waitForTimeout(1000);
                } catch (e) {
                    // Page might have navigated, continue
                }

                // Try to wait for products
                try {
                    await page.waitForSelector('article, .product, [data-product]', {
                        timeout: 10000,
                        state: 'visible'
                    });
                } catch (e) {
                    logger.warn("[Autodoc-PW] Product selector timeout");
                }

                // Additional scroll to trigger lazy loading (also wrapped)
                try {
                    await humanScroll(page);
                    await page.waitForTimeout(1500);
                } catch (e) {
                    // Ignore
                }

                const html = await page.content();

                // Check for blocks
                if (html.includes('challenge-platform') ||
                    html.includes('cf-browser-verification') ||
                    html.includes('Verify you are human')) {
                    logger.warn("[Autodoc-PW] Detected challenge page");

                    // Try to wait it out
                    await page.waitForTimeout(5000);
                    const retryHtml = await page.content();

                    if (retryHtml.includes('challenge-platform')) {
                        return [];
                    }
                }

                return this.parseHtml(html, url);

            } catch (error: any) {
                logger.error("[Autodoc-PW] Scraping error", { error: error.message });
                return [];
            }
        }) || [];
    }

    private parseHtml(html: string, url: string): ScrapedOffer[] {
        const $ = cheerio.load(html);
        const offers: ScrapedOffer[] = [];

        // Multiple selector strategies
        const strategies = [
            {
                container: 'article[data-product-id]',
                brand: '.brand-name, [data-brand]',
                price: '.price-value, .price',
                link: 'a[href*="/product/"]',
                image: 'img[src*="product"]'
            },
            {
                container: '.product-card, .product-item',
                brand: '.manufacturer, .brand',
                price: '[class*="price"]',
                link: 'a',
                image: 'img'
            },
            {
                container: '[class*="product"]',
                brand: '[class*="brand"], [class*="manufacturer"]',
                price: '[class*="price"]',
                link: 'a',
                image: 'img'
            }
        ];

        for (const strategy of strategies) {
            const items = $(strategy.container);

            if (items.length > 0) {
                logger.info(`[Autodoc-PW] Found ${items.length} items with strategy`);

                items.each((i, el) => {
                    try {
                        const $el = $(el);
                        const brand = $el.find(strategy.brand).first().text().trim();
                        const priceText = $el.find(strategy.price).first().text().trim();

                        // Extract price from various formats
                        const priceMatch = priceText.match(/(\d+)[.,](\d{2})/);
                        if (priceMatch) {
                            const price = parseFloat(`${priceMatch[1]}.${priceMatch[2]}`);
                            const link = $el.find(strategy.link).first().attr('href');
                            const img = $el.find(strategy.image).first().attr('src');

                            if (!isNaN(price) && price > 0 && price < 10000) {
                                offers.push({
                                    shopName: "Autodoc",
                                    brand: brand || "Unknown",
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
