import { withPage } from './browserClient';
import { ScrapedOffer, ShopAdapter } from '../scrapingService';
import * as cheerio from 'cheerio';
import { logger } from '../../utils/logger';

async function randomScroll(page: any) {
    await page.evaluate(() => {
        window.scrollBy(0, Math.random() * 300 + 100);
    });
    await new Promise(resolve => setTimeout(resolve, Math.random() * 500 + 200));
}

export class AutodocScraper implements ShopAdapter {
    name = "Autodoc";

    async fetchOffers(oem: string): Promise<ScrapedOffer[]> {
        logger.info(`[Autodoc] Scraping for ${oem}...`);

        return await withPage(async (page) => {
            const url = `https://www.autodoc.de/search?keyword=${encodeURIComponent(oem)}`;

            try {
                // Navigate with realistic timeout
                await page.goto(url, {
                    waitUntil: 'networkidle0',
                    timeout: 45000
                });

                // Human-like scroll
                await randomScroll(page);
                await new Promise(resolve => setTimeout(resolve, 1000));

                // Wait for either products or no results
                await Promise.race([
                    page.waitForSelector('.product-list-item, .search-results-item', { timeout: 15000 }),
                    page.waitForSelector('.no-results', { timeout: 15000 })
                ]).catch(() => {
                    logger.warn("[Autodoc] No selector matched within timeout");
                });

                const content = await page.content();

                // Check for blocks
                if (content.includes("Verify you are human") ||
                    content.includes("Access denied") ||
                    content.includes("challenge-platform") ||
                    content.includes("cf-browser-verification")) {
                    logger.warn("[Autodoc] Detected anti-bot challenge");
                    return [];
                }

                const $ = cheerio.load(content);
                const offers: ScrapedOffer[] = [];

                // Try multiple selector patterns
                const selectors = [
                    '.product-list-item',
                    '.search-results-item',
                    '[data-product-id]',
                    '.product-card'
                ];

                let foundItems = false;
                for (const selector of selectors) {
                    const items = $(selector);
                    if (items.length > 0) {
                        foundItems = true;
                        logger.info(`[Autodoc] Found ${items.length} items with selector: ${selector}`);

                        items.each((i, el) => {
                            try {
                                const $el = $(el);
                                const brand = $el.find('.brand, .manufacturer, [class*="brand"]').first().text().trim();
                                const priceText = $el.find('.price, [class*="price"]').first().text().trim();
                                const priceMatch = priceText.match(/[\d,]+/);

                                if (priceMatch) {
                                    const price = parseFloat(priceMatch[0].replace(',', '.'));
                                    const link = $el.find('a').first().attr('href');
                                    const img = $el.find('img').first().attr('src');
                                    const availability = $el.find('.availability, .stock').text().includes('Nicht') ? 'Out of Stock' : 'In Stock';

                                    if (!isNaN(price) && price > 0) {
                                        offers.push({
                                            shopName: "Autodoc",
                                            brand: brand || "Unknown",
                                            price: price,
                                            currency: "EUR",
                                            availability: availability,
                                            deliveryTimeDays: 2,
                                            productUrl: link ? (link.startsWith('http') ? link : `https://www.autodoc.de${link}`) : url,
                                            imageUrl: img,
                                            rating: 4.5,
                                            isRecommended: i === 0
                                        });
                                    }
                                }
                            } catch (e) {
                                // Skip problematic items
                            }
                        });
                        break;
                    }
                }

                if (!foundItems) {
                    logger.warn("[Autodoc] No product items found with any selector");
                }

                return offers;
            } catch (error: any) {
                logger.error("[Autodoc] Scraping error", { error: error.message });
                return [];
            }
        }) || [];
    }
}
