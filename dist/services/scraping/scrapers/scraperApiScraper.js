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
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ScraperAPIScraper = void 0;
const logger_1 = require("../../../utils/logger");
const node_fetch_1 = __importDefault(require("node-fetch"));
const cheerio = __importStar(require("cheerio"));
/**
 * ScraperAPI.com Integration - Optimized for Autodoc & KFZTeile24
 */
class ScraperAPIScraper {
    name;
    apiKey;
    targetShop;
    constructor(shopName, targetShop) {
        this.name = shopName;
        this.targetShop = targetShop;
        this.apiKey = process.env.SCRAPER_API_KEY || '';
        if (!this.apiKey) {
            logger_1.logger.warn(`[${this.name}] SCRAPER_API_KEY not set - scraping will fail`);
        }
    }
    async fetchOffers(oem) {
        if (!this.apiKey) {
            logger_1.logger.error(`[${this.name}] Cannot scrape without SCRAPER_API_KEY`);
            return [];
        }
        logger_1.logger.info(`[${this.name}] Scraping via ScraperAPI for ${oem}...`);
        try {
            const targetUrl = this.buildTargetUrl(oem);
            // ScraperAPI Ultra Premium Configuration for maximum success
            const apiUrl = `http://api.scraperapi.com?` +
                `api_key=${this.apiKey}` +
                `&url=${encodeURIComponent(targetUrl)}` +
                `&render=true` + // JavaScript rendering
                `&country_code=de` + // German IPs
                `&ultra_premium=true` + // Highest quality proxies
                `&device_type=desktop` + // Desktop user agent
                `&wait_for_selector=article,product,.product-card` + // Wait for products
                `&session_number=${Math.floor(Math.random() * 10000)}`; // Unique session
            logger_1.logger.info(`[${this.name}] Requesting with Ultra Premium: ${targetUrl}`);
            const response = await (0, node_fetch_1.default)(apiUrl, {
                method: 'GET',
                timeout: 120000 // 2 minutes for ultra premium
            });
            if (!response.ok) {
                // Retry with different settings if failed
                if (response.status === 403 || response.status === 500) {
                    logger_1.logger.warn(`[${this.name}] First attempt failed (${response.status}), retrying with different config...`);
                    // Retry without ultra_premium but with autoparse
                    const retryUrl = `http://api.scraperapi.com?` +
                        `api_key=${this.apiKey}` +
                        `&url=${encodeURIComponent(targetUrl)}` +
                        `&render=true` +
                        `&country_code=de` +
                        `&keep_headers=true` +
                        `&session_number=${Math.floor(Math.random() * 10000)}`;
                    const retryResponse = await (0, node_fetch_1.default)(retryUrl, {
                        method: 'GET',
                        timeout: 120000
                    });
                    if (!retryResponse.ok) {
                        throw new Error(`ScraperAPI returned ${retryResponse.status} after retry`);
                    }
                    const html = await retryResponse.text();
                    logger_1.logger.info(`[${this.name}] Retry successful! Received HTML (${html.length} bytes)`);
                    return this.parseHtml(html, oem, targetUrl);
                }
                throw new Error(`ScraperAPI returned ${response.status}`);
            }
            const html = await response.text();
            logger_1.logger.info(`[${this.name}] Received HTML (${html.length} bytes)`);
            return this.parseHtml(html, oem, targetUrl);
        }
        catch (error) {
            logger_1.logger.error(`[${this.name}] ScraperAPI error`, { error: error.message });
            return [];
        }
    }
    buildTargetUrl(oem) {
        if (this.targetShop === 'autodoc') {
            // Autodoc search URL
            return `https://www.autodoc.de/search?keyword=${encodeURIComponent(oem)}`;
        }
        else {
            // KFZTeile24 search URL (correct format)
            return `https://www.kfzteile24.de/suche?search=${encodeURIComponent(oem)}`;
        }
    }
    parseHtml(html, oem, url) {
        const $ = cheerio.load(html);
        const offers = [];
        if (this.targetShop === 'autodoc') {
            // Autodoc: Try multiple selector strategies
            const strategies = [
                'article[data-product-id]',
                '.product-card',
                '.search-result-item',
                '[itemtype="http://schema.org/Product"]'
            ];
            for (const selector of strategies) {
                const items = $(selector);
                if (items.length > 0) {
                    logger_1.logger.info(`[${this.name}] Found ${items.length} items with selector: ${selector}`);
                    items.slice(0, 10).each((i, el) => {
                        try {
                            const $el = $(el);
                            // Extract brand
                            const brand = $el.find('[data-brand], .brand, .manufacturer, [itemprop="brand"]')
                                .first().text().trim() ||
                                $el.find('img[alt]').attr('alt')?.split(' ')[0] ||
                                "Unknown";
                            // Extract price - multiple patterns
                            const priceText = $el.find('[data-price], .price, [itemprop="price"]')
                                .first().text().trim();
                            const priceMatch = priceText.match(/(\d+)[.,](\d{2})/);
                            if (priceMatch) {
                                const price = parseFloat(`${priceMatch[1]}.${priceMatch[2]}`);
                                const link = $el.find('a[href*="/product/"], a[href*="/ersatzteile/"]').first().attr('href');
                                const img = $el.find('img').first().attr('src') || $el.find('img').first().attr('data-src');
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
                        catch (e) {
                            // Skip item
                        }
                    });
                    if (offers.length > 0)
                        break;
                }
            }
            // If no products found, log for debugging
            if (offers.length === 0) {
                logger_1.logger.warn(`[${this.name}] No products found. HTML snippet: ${html.substring(0, 500)}`);
            }
        }
        else {
            // KFZTeile24
            const strategies = [
                '[data-testid="product-card"]',
                '.product-card',
                'article',
                '[itemtype="http://schema.org/Product"]'
            ];
            for (const selector of strategies) {
                const items = $(selector);
                if (items.length > 0) {
                    logger_1.logger.info(`[${this.name}] Found ${items.length} items`);
                    items.slice(0, 10).each((i, el) => {
                        try {
                            const $el = $(el);
                            const brand = $el.find('[data-testid="brand-name"], .brand, [itemprop="brand"]')
                                .first().text().trim() || "Unknown";
                            const priceText = $el.find('[data-testid="price-value"], .price, [itemprop="price"]')
                                .first().text().trim();
                            const priceMatch = priceText.match(/(\d+)[.,](\d{2})/);
                            if (priceMatch) {
                                const price = parseFloat(`${priceMatch[1]}.${priceMatch[2]}`);
                                const link = $el.find('a').first().attr('href');
                                const img = $el.find('img').first().attr('src') || $el.find('img').first().attr('data-src');
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
                        catch (e) {
                            // Skip item
                        }
                    });
                    if (offers.length > 0)
                        break;
                }
            }
        }
        logger_1.logger.info(`[${this.name}] Parsed ${offers.length} offers`);
        return offers;
    }
}
exports.ScraperAPIScraper = ScraperAPIScraper;
