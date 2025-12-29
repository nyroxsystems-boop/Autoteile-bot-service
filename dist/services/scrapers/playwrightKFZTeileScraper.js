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
exports.PlaywrightKFZTeileScraper = void 0;
const playwrightClient_1 = require("./playwrightClient");
const cheerio = __importStar(require("cheerio"));
const logger_1 = require("../../utils/logger");
class PlaywrightKFZTeileScraper {
    name = "KFZTeile24";
    async fetchOffers(oem) {
        logger_1.logger.info(`[KFZTeile24-PW] Ultra-stealth scraping for ${oem}...`);
        return await (0, playwrightClient_1.withPlaywrightPage)(async (page) => {
            const url = `https://www.kfzteile24.de/suche?search=${encodeURIComponent(oem)}`;
            try {
                await page.goto(url, {
                    waitUntil: 'networkidle',
                    timeout: 60000
                });
                await page.waitForTimeout(1500 + Math.random() * 1500);
                // Human behavior
                await (0, playwrightClient_1.humanMouseMove)(page);
                await (0, playwrightClient_1.humanScroll)(page);
                // Wait for products
                try {
                    await page.waitForSelector('[data-testid="product-card"], .product-card, article', {
                        timeout: 12000,
                        state: 'visible'
                    });
                }
                catch (e) {
                    logger_1.logger.warn("[KFZTeile24-PW] Product selector timeout");
                }
                await page.waitForTimeout(1000);
                const html = await page.content();
                return this.parseHtml(html, url);
            }
            catch (error) {
                logger_1.logger.error("[KFZTeile24-PW] Scraping error", { error: error.message });
                return [];
            }
        }) || [];
    }
    parseHtml(html, url) {
        const $ = cheerio.load(html);
        const offers = [];
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
                logger_1.logger.info(`[KFZTeile24-PW] Found ${items.length} items`);
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
                    }
                    catch (e) {
                        // Skip item
                    }
                });
                if (offers.length > 0)
                    break;
            }
        }
        return offers;
    }
}
exports.PlaywrightKFZTeileScraper = PlaywrightKFZTeileScraper;
