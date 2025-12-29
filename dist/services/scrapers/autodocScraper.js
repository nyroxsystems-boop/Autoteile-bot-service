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
exports.AutodocScraper = void 0;
const browserClient_1 = require("./browserClient");
const cheerio = __importStar(require("cheerio"));
const logger_1 = require("../../utils/logger");
async function randomScroll(page) {
    await page.evaluate(() => {
        window.scrollBy(0, Math.random() * 300 + 100);
    });
    await new Promise(resolve => setTimeout(resolve, Math.random() * 500 + 200));
}
class AutodocScraper {
    name = "Autodoc";
    async fetchOffers(oem) {
        logger_1.logger.info(`[Autodoc] Scraping for ${oem}...`);
        return await (0, browserClient_1.withPage)(async (page) => {
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
                    logger_1.logger.warn("[Autodoc] No selector matched within timeout");
                });
                const content = await page.content();
                // Check for blocks
                if (content.includes("Verify you are human") ||
                    content.includes("Access denied") ||
                    content.includes("challenge-platform") ||
                    content.includes("cf-browser-verification")) {
                    logger_1.logger.warn("[Autodoc] Detected anti-bot challenge");
                    return [];
                }
                const $ = cheerio.load(content);
                const offers = [];
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
                        logger_1.logger.info(`[Autodoc] Found ${items.length} items with selector: ${selector}`);
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
                            }
                            catch (e) {
                                // Skip problematic items
                            }
                        });
                        break;
                    }
                }
                if (!foundItems) {
                    logger_1.logger.warn("[Autodoc] No product items found with any selector");
                }
                return offers;
            }
            catch (error) {
                logger_1.logger.error("[Autodoc] Scraping error", { error: error.message });
                return [];
            }
        }) || [];
    }
}
exports.AutodocScraper = AutodocScraper;
