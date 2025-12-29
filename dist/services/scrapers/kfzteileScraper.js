"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.KFZTeile24Scraper = void 0;
const browserClient_1 = require("./browserClient");
const cheerio = __importStar(require("cheerio"));
const logger_1 = require("../../utils/logger");
class KFZTeile24Scraper {
    name = "KFZTeile24";
    async fetchOffers(oem) {
        logger_1.logger.info(`[KFZTeile24] Scraping for ${oem}...`);
        return await (0, browserClient_1.withPage)(async (page) => {
            const url = `https://www.kfzteile24.de/suche?search=${encodeURIComponent(oem)}`;
            await page.goto(url, { waitUntil: 'networkidle2', timeout: 30000 });
            // KFZTeile uses aggressive JS rendering sometimes
            try {
                await page.waitForSelector('.product-card, .search-no-results', { timeout: 15000 });
            }
            catch (e) {
                logger_1.logger.warn("[KFZTeile24] Timeout waiting for results");
            }
            const content = await page.content();
            const $ = cheerio.load(content);
            const offers = [];
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
                }
                catch (e) {
                    // ignore
                }
            });
            return offers;
        }) || [];
    }
}
exports.KFZTeile24Scraper = KFZTeile24Scraper;
