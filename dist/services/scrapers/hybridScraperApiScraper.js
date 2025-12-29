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
exports.HybridScraperAPIScraper = void 0;
const playwright_1 = require("playwright");
const cheerio = __importStar(require("cheerio"));
const logger_1 = require("../../utils/logger");
/**
 * Hybrid approach: Playwright + ScraperAPI Proxy
 * Uses Playwright for full browser control with ScraperAPI's proxy network
 */
class HybridScraperAPIScraper {
    name;
    apiKey;
    targetShop;
    constructor(shopName, targetShop) {
        this.name = shopName;
        this.targetShop = targetShop;
        this.apiKey = process.env.SCRAPER_API_KEY || '';
    }
    async fetchOffers(oem) {
        if (!this.apiKey) {
            return [];
        }
        logger_1.logger.info(`[${this.name}-Hybrid] Scraping with Playwright + ScraperAPI Proxy for ${oem}...`);
        try {
            const targetUrl = this.buildTargetUrl(oem);
            // Use ScraperAPI as HTTP proxy for Playwright
            const proxyServer = `http://scraperapi:${this.apiKey}@proxy-server.scraperapi.com:8001`;
            const browser = await playwright_1.chromium.launch({
                headless: true,
                proxy: {
                    server: proxyServer
                }
            });
            const context = await browser.newContext({
                userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                viewport: { width: 1920, height: 1080 },
                locale: 'de-DE'
            });
            const page = await context.newPage();
            logger_1.logger.info(`[${this.name}-Hybrid] Navigating to: ${targetUrl}`);
            await page.goto(targetUrl, { waitUntil: 'networkidle', timeout: 60000 });
            // Wait for products
            await page.waitForTimeout(3000);
            const html = await page.content();
            await browser.close();
            logger_1.logger.info(`[${this.name}-Hybrid] Got HTML (${html.length} bytes)`);
            return this.parseHtml(html, oem, targetUrl);
        }
        catch (error) {
            logger_1.logger.error(`[${this.name}-Hybrid] Error`, { error: error.message });
            return [];
        }
    }
    buildTargetUrl(oem) {
        if (this.targetShop === 'autodoc') {
            return `https://www.autodoc.de/search?keyword=${encodeURIComponent(oem)}`;
        }
        else {
            return `https://www.kfzteile24.de/suche?search=${encodeURIComponent(oem)}`;
        }
    }
    parseHtml(html, oem, url) {
        const $ = cheerio.load(html);
        const offers = [];
        if (this.targetShop === 'autodoc') {
            const strategies = [
                'article[data-product-id]',
                '.product-card',
                '[itemtype="http://schema.org/Product"]'
            ];
            for (const selector of strategies) {
                const items = $(selector);
                if (items.length > 0) {
                    logger_1.logger.info(`[${this.name}-Hybrid] Found ${items.length} items`);
                    items.slice(0, 10).each((i, el) => {
                        try {
                            const $el = $(el);
                            const brand = $el.find('[data-brand], .brand, [itemprop="brand"]').first().text().trim() || "Unknown";
                            const priceText = $el.find('[data-price], .price, [itemprop="price"]').first().text().trim();
                            const priceMatch = priceText.match(/(\d+)[.,](\d{2})/);
                            if (priceMatch) {
                                const price = parseFloat(`${priceMatch[1]}.${priceMatch[2]}`);
                                const link = $el.find('a').first().attr('href');
                                const img = $el.find('img').first().attr('src');
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
                            }
                        }
                        catch (e) { }
                    });
                    if (offers.length > 0)
                        break;
                }
            }
        }
        else {
            const strategies = [
                '[data-testid="product-card"]',
                '.product-card',
                'article'
            ];
            for (const selector of strategies) {
                const items = $(selector);
                if (items.length > 0) {
                    logger_1.logger.info(`[${this.name}-Hybrid] Found ${items.length} items`);
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
                        }
                        catch (e) { }
                    });
                    if (offers.length > 0)
                        break;
                }
            }
        }
        return offers;
    }
}
exports.HybridScraperAPIScraper = HybridScraperAPIScraper;
