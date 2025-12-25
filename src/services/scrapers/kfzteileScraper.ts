import { withPage } from './browserClient';
import { ScrapedOffer, ShopAdapter } from '../scrapingService';
import * as cheerio from 'cheerio';
import { logger } from '../../utils/logger';

export class KFZTeile24Scraper implements ShopAdapter {
    name = "KFZTeile24";

    async fetchOffers(oem: string): Promise<ScrapedOffer[]> {
        logger.info(`[KFZTeile24] Scraping for ${oem}...`);

        return await withPage(async (page) => {
            const url = `https://www.kfzteile24.de/suche?search=${encodeURIComponent(oem)}`;

            await page.goto(url, { waitUntil: 'networkidle2', timeout: 30000 });

            // KFZTeile uses aggressive JS rendering sometimes
            try {
                await page.waitForSelector('.product-card, .search-no-results', { timeout: 15000 });
            } catch (e) {
                logger.warn("[KFZTeile24] Timeout waiting for results");
            }

            const content = await page.content();
            const $ = cheerio.load(content);
            const offers: ScrapedOffer[] = [];

            // Selectors need periodic maintenance
            $('[data-testid="product-card"]').each((i, el) => {
                try {
                    const brand = $(el).find('[data-testid="brand-name"]').text().trim();
                    const priceRaw = $(el).find('[data-testid="price-value"]').text().replace('€', '').replace(/\./g, '').replace(',', '.').trim();
                    const price = parseFloat(priceRaw) / 100; // usually formatted like 1.234,56
                    // Fix simpler parsing
                    const simplePrice = parseFloat($(el).find('.price-wrapper').text().replace(/[^0-9,]/g, '').replace(',', '.'));

                    const finalPrice = isNaN(price) ? simplePrice : price;
                    const link = $(el).find('a').attr('href');
                    const img = $(el).find('img').attr('src');

                    if (brand && !isNaN(finalPrice)) {
                        offers.push({
                            shopName: "KFZTeile24",
                            brand: brand,
                            price: finalPrice,
                            currency: "EUR",
                            availability: "In Stock",
                            productUrl: link ? `https://www.kfzteile24.de${link}` : url,
                            imageUrl: img,
                            rating: 4.0,
                            isRecommended: false
                        });
                    }
                } catch (e) {
                    // ignore
                }
            });

            return offers;
        }) || [];
    }
}
