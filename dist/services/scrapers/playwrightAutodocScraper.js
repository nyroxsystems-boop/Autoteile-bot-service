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
exports.PlaywrightAutodocScraper = void 0;
const playwrightClient_1 = require("./playwrightClient");
const cheerio = __importStar(require("cheerio"));
const logger_1 = require("../../utils/logger");
class PlaywrightAutodocScraper {
    name = "Autodoc";
    async fetchOffers(oem) {
        logger_1.logger.info(`[Autodoc-PW] Ultra-stealth scraping for ${oem}...`);
        return await (0, playwrightClient_1.withPlaywrightPage)(async (page) => {
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
                    await (0, playwrightClient_1.humanMouseMove)(page);
                    await (0, playwrightClient_1.humanScroll)(page);
                    await page.waitForTimeout(1000);
                }
                catch (e) {
                    // Page might have navigated, continue
                }
                // Try to wait for products
                try {
                    await page.waitForSelector('article, .product, [data-product]', {
                        timeout: 10000,
                        state: 'visible'
                    });
                }
                catch (e) {
                    logger_1.logger.warn("[Autodoc-PW] Product selector timeout");
                }
                // Additional scroll to trigger lazy loading (also wrapped)
                try {
                    await (0, playwrightClient_1.humanScroll)(page);
                    await page.waitForTimeout(1500);
                }
                catch (e) {
                    // Ignore
                }
                const html = await page.content();
                // Check for blocks
                if (html.includes('challenge-platform') ||
                    html.includes('cf-browser-verification') ||
                    html.includes('Verify you are human')) {
                    logger_1.logger.warn("[Autodoc-PW] Detected challenge page");
                    // Try to wait it out
                    await page.waitForTimeout(5000);
                    const retryHtml = await page.content();
                    if (retryHtml.includes('challenge-platform')) {
                        return [];
                    }
                }
                return this.parseHtml(html, url);
            }
            catch (error) {
                logger_1.logger.error("[Autodoc-PW] Scraping error", { error: error.message });
                return [];
            }
        }) || [];
    }
    parseHtml(html, url) {
        const $ = cheerio.load(html);
        const offers = [];
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
                logger_1.logger.info(`[Autodoc-PW] Found ${items.length} items with strategy`);
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
exports.PlaywrightAutodocScraper = PlaywrightAutodocScraper;
