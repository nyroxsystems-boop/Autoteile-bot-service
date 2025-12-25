import { ScrapedOffer, ShopAdapter } from '../scrapingService';
import { logger } from '../../utils/logger';

/**
 * Fallback Mock Scraper for testing and development
 * Returns realistic dummy data when real scraping fails
 */
export class MockFallbackScraper implements ShopAdapter {
    name = "MockFallback";

    async fetchOffers(oem: string): Promise<ScrapedOffer[]> {
        logger.info(`[MockFallback] Generating test data for ${oem}...`);

        // Simulate network delay
        await new Promise(resolve => setTimeout(resolve, 500 + Math.random() * 1000));

        const brands = ['ATE', 'Brembo', 'TRW', 'Bosch', 'Febi', 'Meyle'];
        const randomBrand = brands[Math.floor(Math.random() * brands.length)];

        const basePrice = 45 + Math.random() * 150;

        return [
            {
                shopName: "Autodoc (Mock)",
                brand: randomBrand,
                price: Math.round(basePrice * 100) / 100,
                currency: "EUR",
                availability: "In Stock",
                deliveryTimeDays: 2,
                productUrl: `https://www.autodoc.de/search?keyword=${encodeURIComponent(oem)}`,
                imageUrl: "https://via.placeholder.com/150",
                rating: 4.5,
                isRecommended: true
            },
            {
                shopName: "KFZTeile24 (Mock)",
                brand: brands[Math.floor(Math.random() * brands.length)],
                price: Math.round((basePrice * 1.1) * 100) / 100,
                currency: "EUR",
                availability: "In Stock",
                deliveryTimeDays: 1,
                productUrl: `https://www.kfzteile24.de/search?q=${encodeURIComponent(oem)}`,
                imageUrl: "https://via.placeholder.com/150",
                rating: 4.3,
                isRecommended: false
            },
            {
                shopName: "ATU (Mock)",
                brand: brands[Math.floor(Math.random() * brands.length)],
                price: Math.round((basePrice * 1.15) * 100) / 100,
                currency: "EUR",
                availability: "Limited Stock",
                deliveryTimeDays: 3,
                productUrl: `https://www.atu.de/search?q=${encodeURIComponent(oem)}`,
                imageUrl: "https://via.placeholder.com/150",
                rating: 4.0,
                isRecommended: false
            }
        ];
    }
}
