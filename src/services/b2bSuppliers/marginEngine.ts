// Margin Calculation Engine
// Applies configured margins to B2B purchase prices

import type { B2BSupplierConfig, B2BPartSearchResult, B2BPartOffer } from './types';

/**
 * Apply margin to a purchase price based on supplier config
 */
export function applyMargin(
    purchasePrice: number,
    config: B2BSupplierConfig
): { sellingPrice: number; marginAmount: number; marginPercent: number } {
    let marginAmount: number;

    if (config.margin_type === 'fixed') {
        // Fixed margin (e.g., always add €10)
        marginAmount = config.margin_value;
    } else {
        // Percentage margin (e.g., add 15%)
        marginAmount = purchasePrice * (config.margin_value / 100);
    }

    // Ensure minimum margin
    if (marginAmount < config.minimum_margin) {
        marginAmount = config.minimum_margin;
    }

    let sellingPrice = purchasePrice + marginAmount;

    // Apply rounding strategy
    sellingPrice = applyRounding(sellingPrice, config.rounding_strategy, config.round_to);

    // Recalculate actual margin after rounding
    const actualMargin = sellingPrice - purchasePrice;
    const marginPercent = (actualMargin / purchasePrice) * 100;

    return {
        sellingPrice,
        marginAmount: actualMargin,
        marginPercent: Math.round(marginPercent * 100) / 100
    };
}

/**
 * Apply rounding to a price
 */
function applyRounding(
    price: number,
    strategy: 'up' | 'down' | 'nearest',
    roundTo: number
): number {
    if (roundTo <= 0) return price;

    // Special case: round to X.99 pattern
    if (roundTo === 0.99 || roundTo === 0.49) {
        const basePrice = Math.floor(price);
        const decimal = price - basePrice;

        if (strategy === 'up') {
            // Always round up to next .99
            return decimal > roundTo ? basePrice + 1 + roundTo : basePrice + roundTo;
        } else if (strategy === 'down') {
            // Round down to .99 of current or previous whole number
            return decimal >= roundTo ? basePrice + roundTo : (basePrice > 0 ? basePrice - 1 + roundTo : roundTo);
        } else {
            // Nearest .99
            const lower = basePrice + roundTo;
            const upper = basePrice + 1 + roundTo;
            return (price - lower) < (upper - price) ? lower : upper;
        }
    }

    // Standard rounding (to nearest X, e.g., 0.50)
    const multiplier = 1 / roundTo;

    switch (strategy) {
        case 'up':
            return Math.ceil(price * multiplier) / multiplier;
        case 'down':
            return Math.floor(price * multiplier) / multiplier;
        case 'nearest':
        default:
            return Math.round(price * multiplier) / multiplier;
    }
}

/**
 * Convert B2B search results to offers with margin applied
 */
export function convertToOffers(
    results: B2BPartSearchResult[],
    config: B2BSupplierConfig
): B2BPartOffer[] {
    return results.map(result => {
        const { sellingPrice, marginAmount, marginPercent } = applyMargin(result.purchasePrice, config);

        return {
            ...result,
            sellingPrice,
            marginAmount,
            marginPercent
        };
    });
}

/**
 * Calculate suggested selling price for display
 */
export function formatPrice(price: number, currency: string = 'EUR'): string {
    return new Intl.NumberFormat('de-DE', {
        style: 'currency',
        currency
    }).format(price);
}

/**
 * Get price tier discount info
 */
export function getPriceTierInfo(tier: string): { name: string; discount: number; minOrders: number } {
    const tiers: Record<string, { name: string; discount: number; minOrders: number }> = {
        basic: { name: 'Basic', discount: 0, minOrders: 0 },
        silver: { name: 'Silver', discount: 5, minOrders: 50 },
        gold: { name: 'Gold', discount: 10, minOrders: 200 },
        platinum: { name: 'Platinum', discount: 15, minOrders: 500 }
    };

    return tiers[tier] || tiers.basic;
}
