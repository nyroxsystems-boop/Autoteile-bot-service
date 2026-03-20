/**
 * 🔍 AI PRICE FINDER — Gemini Grounded Search Backup
 *
 * When ScraperAPI returns 0 results (HTML layout changed, blocked, etc.),
 * this module uses Gemini Grounded Search to find prices.
 *
 * Cost: ~$0.001 per search (1 Gemini Flash Grounded call)
 * Latency: 2-4s
 *
 * Returns parsed offers from AI search results.
 */

import { ScrapedOffer } from '../scrapingService';
import { generateGroundedCompletion } from '../../intelligence/geminiService';
import { logger } from '@utils/logger';

// ============================================================================
// Main Price Search
// ============================================================================

/**
 * AI-powered price finder as backup when scrapers fail.
 * Uses Gemini Grounded Search to find real prices from trusted shops.
 */
export async function findPricesWithAi(
  oemNumber: string,
  vehicleContext?: {
    make?: string;
    model?: string;
    year?: number;
  }
): Promise<ScrapedOffer[]> {
  const startTime = Date.now();

  logger.info('[AI-PriceFinder] Starting AI price search', { oemNumber });

  try {
    const vehicleStr = vehicleContext
      ? `${vehicleContext.make || ''} ${vehicleContext.model || ''} ${vehicleContext.year || ''}`.trim()
      : '';

    const prompt = `Suche den Preis für die Autoteil-OEM-Nummer "${oemNumber}"${vehicleStr ? ` (für ${vehicleStr})` : ''}.

Suche auf deutschen Autoteile-Shops wie autodoc.de, daparto.de, kfzteile24.de, pkwteile.de.

Für JEDES gefundene Angebot brauche ich:
- shop: Name des Shops
- brand: Hersteller/Marke des Teils (z.B. Zimmermann, ATE, Bosch)
- price: Preis in EUR (nur die Zahl, z.B. 45.99)
- url: Link zum Produkt
- availability: Verfügbarkeit (z.B. "Auf Lager", "2-3 Tage")
- delivery_days: Lieferzeit in Tagen (Zahl)

Antworte NUR als JSON:
{"offers":[{"shop":"","brand":"","price":0,"url":"","availability":"","delivery_days":0}]}

Wenn du KEINE Preise findest: {"offers":[]}
ERFINDE KEINE Preise. Nur echte, gefundene Preise.`;

    const result = await generateGroundedCompletion({
      prompt,
      systemInstruction: 'Du suchst Preise für Autoersatzteile auf deutschen Online-Shops. Antworte NUR im JSON-Format. Gib nur echte, im Internet gefundene Preise an.',
      temperature: 0.1,
    });

    const elapsed = Date.now() - startTime;

    if (!result.text) {
      logger.info('[AI-PriceFinder] Empty response', { elapsed });
      return [];
    }

    const offers = parseAiPriceResponse(result.text, oemNumber);

    logger.info('[AI-PriceFinder] Search complete', {
      oemNumber,
      offersFound: offers.length,
      isGrounded: result.isGrounded,
      groundingChunks: result.groundingChunks.length,
      elapsed,
    });

    return offers;

  } catch (err: any) {
    logger.error('[AI-PriceFinder] Search failed', {
      error: err?.message,
      oemNumber,
      elapsed: Date.now() - startTime,
    });
    return [];
  }
}

// ============================================================================
// Response Parser
// ============================================================================

function parseAiPriceResponse(text: string, oemNumber: string): ScrapedOffer[] {
  const offers: ScrapedOffer[] = [];

  try {
    const cleaned = text.replace(/```json\s*/gi, '').replace(/```\s*/g, '').trim();
    const jsonMatch = cleaned.match(/\{[\s\S]*"offers"[\s\S]*\}/);
    if (!jsonMatch) return [];

    const data = JSON.parse(jsonMatch[0]);

    if (!data.offers || !Array.isArray(data.offers)) return [];

    for (const item of data.offers) {
      const price = parseFloat(String(item.price || '0').replace(',', '.'));

      // Validate price is realistic (€1 - €5000)
      if (isNaN(price) || price <= 0 || price > 5000) continue;

      // Validate shop name exists
      const shopName = String(item.shop || '').trim();
      if (!shopName || shopName.length < 2) continue;

      offers.push({
        shopName: `${shopName} (AI)`, // Mark as AI-found for transparency
        brand: String(item.brand || 'Unbekannt').trim(),
        price,
        currency: 'EUR',
        availability: String(item.availability || 'Auf Lager').trim(),
        deliveryTimeDays: parseInt(String(item.delivery_days || '3'), 10) || 3,
        productUrl: item.url || null,
        imageUrl: null,
        rating: null,
        isRecommended: false,
        isEstimated: true, // B8 FIX: Flag AI-generated prices as estimated
      } as ScrapedOffer & { isEstimated: boolean });
    }

    // Deduplicate by shop
    const seen = new Set<string>();
    return offers.filter(o => {
      const key = `${o.shopName}-${o.price}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    }).slice(0, 5); // Max 5 offers

  } catch (err: any) {
    logger.warn('[AI-PriceFinder] Parse failed', { error: err?.message });
    return [];
  }
}
