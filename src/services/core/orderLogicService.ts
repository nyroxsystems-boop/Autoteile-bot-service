import { insertOrder, getOrderById, updateOrderStatus, findOrCreateOrder, updateOrder, updateOrderData, listShopOffersByOrderId } from '@adapters/supabaseService';
import { Order, Message, Vehicle, ShopOffer } from '../../types/models';
import { logger } from "@utils/logger";

/**
 * Regel-Engine: Bestes Angebot auswählen.
 *
 * Logik:
 * - niedrigster Preis gewinnt
 * - wenn Lieferzeit bekannt:
 *    bevorzugt Lieferzeit ≤ 2 Tage
 */
export function selectBestOffer(offers: ShopOffer[]): ShopOffer | null {
  logger.info("[OrderLogic] selectBestOffer called", { offersCount: offers?.length ?? 0 });
  if (!offers || offers.length === 0) return null;

  // 1. Filter bevorzugt schnelle Lieferung
  const fast = offers.filter(o => o.deliveryTimeDays != null && o.deliveryTimeDays <= 2);

  const candidates = fast.length > 0 ? fast : offers;

  // 2. Sortiere nach Preis
  candidates.sort((a, b) => a.price - b.price);

  const best = candidates[0] ?? null;
  if (best) {
    logger.info("[OrderLogic] selectBestOffer result", {
      orderId: (best as any)?.orderId ?? (best as any)?.order_id ?? null,
      shopName: (best as any)?.shopName ?? (best as any)?.shop_name ?? null,
      price: best.price
    });
  }
  return best;
}

/**
 * Markiert eine Order als "ready" und setzt bestOffer.
 */
export async function autoSelectOffer(orderId: string) {
  logger.info("[OrderLogic] autoSelectOffer start", { orderId });
  const offers = await listShopOffersByOrderId(orderId);
  logger.info("[OrderLogic] autoSelectOffer offers loaded", { orderId, offersCount: offers.length });
  if (offers.length === 0) {
    throw new Error("No shop offers available for this order.");
  }

  const best = selectBestOffer(offers);
  if (!best) {
    throw new Error("No suitable offer found.");
  }

  // Status aktualisieren
  await updateOrderStatus(orderId, "ready");
  logger.info("[OrderLogic] autoSelectOffer completed", {
    orderId,
    selectedOffer: {
      shopName: (best as any)?.shopName ?? (best as any)?.shop_name ?? null,
      price: best.price
    },
    newStatus: "ready"
  });

  return best;
}

/**
 * Auto-Bestellung (Mock).
 *
 * Später wird hier:
 * - Login beim Händler
 * - In den Warenkorb legen
 * - Bestellung abschließen
 * - Rechnung/Tracking speichern
 *
 * Jetzt nur Mock.
 */
export async function autoOrder(orderId: string, offer: ShopOffer) {
  logger.info("[OrderLogic] autoOrder start", {
    orderId,
    offer: {
      shopName: (offer as any)?.shopName ?? (offer as any)?.shop_name ?? null,
      price: offer.price
    }
  });
  // Fake-Verzögerung
  await new Promise(res => setTimeout(res, 300));
  logger.info("[OrderLogic] autoOrder mock delay finished", { orderId });

  // In Realität würdest du hier eine externe Bestellung ausführen.
  const confirmation = `MOCK - ORDER - ${orderId} -${offer.shopName} -${Date.now()} `;

  // 1. Mark as ordered
  await updateOrderStatus(orderId, "ordered");

  // 2. Automate Invoice Creation (Phase 7)
  try {
    // Dynamic import to avoid cycles or use dependency injection in real app
    const wawi = await import('../adapters/realInvenTreeAdapter');
    await wawi.createInvoice(orderId);
    logger.info("[OrderLogic] Automated Invoice created", { orderId });
  } catch (err: any) {
    logger.error("[OrderLogic] Failed to auto-create invoice", { orderId, error: err.message });
    // Don't fail the order flow, just log
  }

  // 3. Stock Sync (Phase 10)
  try {
    const oem = (offer as any).oemNumber || (offer as any).oem_number;
    if (oem) {
      // Dynamic import to avoid cycles
      const wawi = await import('../adapters/realInvenTreeAdapter');
      // Default tenant "public" or derived logic? For now "public" is safe default for single-tenant feel.
      const tenantId = "public";
      const part = await wawi.findPartByOem(tenantId, oem);

      if (part && part.pk) {
        await wawi.deductStock(tenantId, part.pk, 1);
        logger.info(`[OrderLogic] Stock deducted for Part ${part.pk}(OEM: ${oem})`);
      } else {
        logger.info(`[OrderLogic] No matching WWS part found for OEM ${oem} - Stock not deducted.`);
      }
    }
  } catch (err: any) {
    logger.error("[OrderLogic] Failed to sync stock", { orderId, error: err.message });
  }

  logger.info("[OrderLogic] autoOrder completed", {
    orderId,
    newStatus: "ordered",
    confirmation
  });

  return {
    success: true,
    confirmation,
    orderedFrom: offer.shopName,
    price: offer.price
  };
}
