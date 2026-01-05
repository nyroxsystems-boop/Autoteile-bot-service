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
exports.selectBestOffer = selectBestOffer;
exports.autoSelectOffer = autoSelectOffer;
exports.autoOrder = autoOrder;
const supabaseService_1 = require("@adapters/supabaseService");
/**
 * Regel-Engine: Bestes Angebot auswählen.
 *
 * Logik:
 * - niedrigster Preis gewinnt
 * - wenn Lieferzeit bekannt:
 *    bevorzugt Lieferzeit ≤ 2 Tage
 */
function selectBestOffer(offers) {
    console.log("[OrderLogic] selectBestOffer called", { offersCount: offers?.length ?? 0 });
    if (!offers || offers.length === 0)
        return null;
    // 1. Filter bevorzugt schnelle Lieferung
    const fast = offers.filter(o => o.deliveryTimeDays != null && o.deliveryTimeDays <= 2);
    const candidates = fast.length > 0 ? fast : offers;
    // 2. Sortiere nach Preis
    candidates.sort((a, b) => a.price - b.price);
    const best = candidates[0] ?? null;
    if (best) {
        console.log("[OrderLogic] selectBestOffer result", {
            orderId: best?.orderId ?? best?.order_id ?? null,
            shopName: best?.shopName ?? best?.shop_name ?? null,
            price: best.price
        });
    }
    return best;
}
/**
 * Markiert eine Order als "ready" und setzt bestOffer.
 */
async function autoSelectOffer(orderId) {
    console.log("[OrderLogic] autoSelectOffer start", { orderId });
    const offers = await (0, supabaseService_1.listShopOffersByOrderId)(orderId);
    console.log("[OrderLogic] autoSelectOffer offers loaded", { orderId, offersCount: offers.length });
    if (offers.length === 0) {
        throw new Error("No shop offers available for this order.");
    }
    const best = selectBestOffer(offers);
    if (!best) {
        throw new Error("No suitable offer found.");
    }
    // Status aktualisieren
    await (0, supabaseService_1.updateOrderStatus)(orderId, "ready");
    console.log("[OrderLogic] autoSelectOffer completed", {
        orderId,
        selectedOffer: {
            shopName: best?.shopName ?? best?.shop_name ?? null,
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
async function autoOrder(orderId, offer) {
    console.log("[OrderLogic] autoOrder start", {
        orderId,
        offer: {
            shopName: offer?.shopName ?? offer?.shop_name ?? null,
            price: offer.price
        }
    });
    // Fake-Verzögerung
    await new Promise(res => setTimeout(res, 300));
    console.log("[OrderLogic] autoOrder mock delay finished", { orderId });
    // In Realität würdest du hier eine externe Bestellung ausführen.
    const confirmation = `MOCK - ORDER - ${orderId} -${offer.shopName} -${Date.now()} `;
    // 1. Mark as ordered
    await (0, supabaseService_1.updateOrderStatus)(orderId, "ordered");
    // 2. Automate Invoice Creation (Phase 7)
    try {
        // Dynamic import to avoid cycles or use dependency injection in real app
        const wawi = await Promise.resolve().then(() => __importStar(require('../adapters/realInvenTreeAdapter')));
        await wawi.createInvoice(orderId);
        console.log("[OrderLogic] Automated Invoice created", { orderId });
    }
    catch (err) {
        console.error("[OrderLogic] Failed to auto-create invoice", { orderId, error: err.message });
        // Don't fail the order flow, just log
    }
    // 3. Stock Sync (Phase 10)
    try {
        const oem = offer.oemNumber || offer.oem_number;
        if (oem) {
            // Dynamic import to avoid cycles
            const wawi = await Promise.resolve().then(() => __importStar(require('../adapters/realInvenTreeAdapter')));
            // Default tenant "public" or derived logic? For now "public" is safe default for single-tenant feel.
            const tenantId = "public";
            const part = await wawi.findPartByOem(tenantId, oem);
            if (part && part.pk) {
                await wawi.deductStock(tenantId, part.pk, 1);
                console.log(`[OrderLogic] Stock deducted for Part ${part.pk}(OEM: ${oem})`);
            }
            else {
                console.log(`[OrderLogic] No matching WWS part found for OEM ${oem} - Stock not deducted.`);
            }
        }
    }
    catch (err) {
        console.error("[OrderLogic] Failed to sync stock", { orderId, error: err.message });
    }
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
