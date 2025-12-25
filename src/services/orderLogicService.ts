import { listShopOffersByOrderId, updateOrderStatus } from "./supabaseService";
import type { ShopOffer } from "../types/models";

/**
 * Regel-Engine: Bestes Angebot auswählen.
 *
 * Logik:
 * - niedrigster Preis gewinnt
 * - wenn Lieferzeit bekannt:
 *    bevorzugt Lieferzeit ≤ 2 Tage
 */
export function selectBestOffer(offers: ShopOffer[]): ShopOffer | null {
  console.log("[OrderLogic] selectBestOffer called", { offersCount: offers?.length ?? 0 });
  if (!offers || offers.length === 0) return null;

  // 1. Filter bevorzugt schnelle Lieferung
  const fast = offers.filter(o => o.deliveryTimeDays != null && o.deliveryTimeDays <= 2);

  const candidates = fast.length > 0 ? fast : offers;

  // 2. Sortiere nach Preis
  candidates.sort((a, b) => a.price - b.price);

  const best = candidates[0] ?? null;
  if (best) {
    console.log("[OrderLogic] selectBestOffer result", {
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
  console.log("[OrderLogic] autoSelectOffer start", { orderId });
  const offers = await listShopOffersByOrderId(orderId);
  console.log("[OrderLogic] autoSelectOffer offers loaded", { orderId, offersCount: offers.length });
  if (offers.length === 0) {
    throw new Error("No shop offers available for this order.");
  }

  const best = selectBestOffer(offers);
  if (!best) {
    throw new Error("No suitable offer found.");
  }

  // Status aktualisieren
  await updateOrderStatus(orderId, "ready");
  console.log("[OrderLogic] autoSelectOffer completed", {
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
  console.log("[OrderLogic] autoOrder start", {
    orderId,
    offer: {
      shopName: (offer as any)?.shopName ?? (offer as any)?.shop_name ?? null,
      price: offer.price
    }
  });
  // Fake-Verzögerung
  await new Promise(res => setTimeout(res, 300));
  console.log("[OrderLogic] autoOrder mock delay finished", { orderId });

  // In Realität würdest du hier eine externe Bestellung ausführen.
  const confirmation = `MOCK-ORDER-${orderId}-${offer.shopName}-${Date.now()}`;

  await updateOrderStatus(orderId, "ordered");
  console.log("[OrderLogic] autoOrder completed", {
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
