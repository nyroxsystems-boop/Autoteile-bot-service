/**
 * 🎯 PREMIUM RESPONSE TEMPLATES
 * 
 * Professionelle, kontextuelle Antworten für 700€/Monat Premium-Service.
 * B2B-tauglich, präzise, proaktiv.
 */

export interface PremiumResponseContext {
    language: "de" | "en";
    dealerName?: string;
    customerName?: string;
    timeOfDay?: "morning" | "afternoon" | "evening";
}

function getTimeOfDay(): "morning" | "afternoon" | "evening" {
    const hour = new Date().getHours();
    if (hour < 12) return "morning";
    if (hour < 18) return "afternoon";
    return "evening";
}

function getGreetingPrefix(ctx: PremiumResponseContext): string {
    const time = ctx.timeOfDay || getTimeOfDay();
    const greetings = {
        de: {
            morning: "Guten Morgen",
            afternoon: "Guten Tag",
            evening: "Guten Abend"
        },
        en: {
            morning: "Good morning",
            afternoon: "Good afternoon",
            evening: "Good evening"
        }
    };
    return greetings[ctx.language][time];
}

export const PREMIUM_RESPONSES = {
    // ============================================================================
    // GREETINGS
    // ============================================================================
    greeting: (ctx: PremiumResponseContext): string => {
        const prefix = getGreetingPrefix(ctx);
        const dealer = ctx.dealerName || "uns";

        if (ctx.language === "de") {
            return `${prefix}! 👋 Willkommen bei ${dealer}. Wie kann ich Ihnen heute helfen?`;
        }
        return `${prefix}! 👋 Welcome. How may I assist you today?`;
    },

    // ============================================================================
    // VEHICLE REQUEST
    // ============================================================================
    vehicleRequest: (ctx: PremiumResponseContext): string => {
        if (ctx.language === "de") {
            return `Für eine präzise Teilesuche benötige ich Ihr Fahrzeug.\n\n` +
                `📸 **Am schnellsten**: Foto des Fahrzeugscheins\n` +
                `📝 **Alternativ**: VIN, HSN/TSN oder Marke+Modell+Baujahr`;
        }
        return `For accurate part identification, I need your vehicle data.\n\n` +
            `📸 **Fastest**: Photo of vehicle registration\n` +
            `📝 **Alternative**: VIN or Make+Model+Year`;
    },

    // ============================================================================
    // PROCESSING STATES
    // ============================================================================
    processing: {
        oemSearch: (ctx: PremiumResponseContext): string => {
            if (ctx.language === "de") {
                return `🔍 Ich suche jetzt die passende OEM-Nummer. Einen Moment bitte...`;
            }
            return `🔍 Searching for the correct OEM number. One moment please...`;
        },

        stockCheck: (ctx: PremiumResponseContext): string => {
            if (ctx.language === "de") {
                return `📦 Ich prüfe die Verfügbarkeit für Sie...`;
            }
            return `📦 Checking availability for you...`;
        },

        priceSearch: (ctx: PremiumResponseContext): string => {
            if (ctx.language === "de") {
                return `💰 Ich ermittle die besten Preise. Bitte warten...`;
            }
            return `💰 Finding the best prices. Please wait...`;
        }
    },

    // ============================================================================
    // STOCK & AVAILABILITY
    // ============================================================================
    stockAvailable: (ctx: PremiumResponseContext, quantity: number): string => {
        if (ctx.language === "de") {
            return `✅ **Gute Nachricht!** ${quantity}x auf Lager, sofort verfügbar.\n` +
                `Möchten Sie ein Angebot?`;
        }
        return `✅ **Great news!** ${quantity}x in stock, immediately available.\n` +
            `Would you like a quote?`;
    },

    stockUnavailable: (ctx: PremiumResponseContext): string => {
        if (ctx.language === "de") {
            return `Das Teil ist aktuell nicht auf Lager. Ich suche Alternativen bei unseren Lieferanten...`;
        }
        return `This part is currently out of stock. Searching supplier alternatives...`;
    },

    // ============================================================================
    // PRICE QUOTES
    // ============================================================================
    priceQuote: (ctx: PremiumResponseContext, params: {
        partName: string;
        brand: string;
        price: number;
        deliveryDays: number;
        isFromStock: boolean;
    }): string => {
        const { partName, brand, price, deliveryDays, isFromStock } = params;
        const priceFormatted = price.toFixed(2).replace(".", ",");

        if (ctx.language === "de") {
            const delivery = isFromStock
                ? "🚗 Sofort abholbar"
                : `🚚 Lieferung in ${deliveryDays} Werktagen`;

            return `**Ihr Angebot:**\n\n` +
                `🔧 ${partName}\n` +
                `🏭 ${brand}\n` +
                `💰 **${priceFormatted} EUR** inkl. MwSt.\n` +
                `${delivery}\n\n` +
                `Interesse? Antworten Sie mit **JA** zum Bestellen.`;
        }

        const delivery = isFromStock
            ? "🚗 Ready for pickup"
            : `🚚 Delivery in ${deliveryDays} business days`;

        return `**Your Quote:**\n\n` +
            `🔧 ${partName}\n` +
            `🏭 ${brand}\n` +
            `💰 **${priceFormatted} EUR** incl. VAT\n` +
            `${delivery}\n\n` +
            `Interested? Reply **YES** to order.`;
    },

    // ============================================================================
    // ORDER STATUS
    // ============================================================================
    orderStatus: (ctx: PremiumResponseContext, params: {
        orderId: string;
        status: string;
        partName?: string;
        updatedAt?: string;
    }): string => {
        const { orderId, status, partName, updatedAt } = params;
        const shortId = orderId.slice(-6).toUpperCase();

        const statusMap: Record<string, { de: string; en: string }> = {
            "choose_language": {
                de: "⏳ Warten auf Sprachauswahl",
                en: "⏳ Awaiting language selection"
            },
            "collect_vehicle": {
                de: "🚗 Fahrzeugdaten werden erfasst",
                en: "🚗 Collecting vehicle data"
            },
            "collect_part": {
                de: "🔧 Teileangabe wird erfasst",
                en: "🔧 Collecting part details"
            },
            "oem_lookup": {
                de: "🔍 OEM-Suche läuft",
                en: "🔍 OEM search in progress"
            },
            "show_offers": {
                de: "📋 Angebote werden erstellt",
                en: "📋 Preparing offers"
            },
            "await_offer_confirmation": {
                de: "⏳ Warten auf Ihre Entscheidung",
                en: "⏳ Awaiting your decision"
            },
            "collect_address": {
                de: "📍 Adresseingabe",
                en: "📍 Collecting address"
            },
            "done": {
                de: "✅ Abgeschlossen",
                en: "✅ Completed"
            },
            "cancelled": {
                de: "❌ Storniert",
                en: "❌ Cancelled"
            }
        };

        const statusText = statusMap[status]?.[ctx.language] || status;

        if (ctx.language === "de") {
            return `**Bestellstatus #${shortId}**\n\n` +
                (partName ? `🔧 ${partName}\n` : "") +
                `📊 ${statusText}\n` +
                (updatedAt ? `🕐 Letzte Aktualisierung: ${new Date(updatedAt).toLocaleString("de-DE")}` : "");
        }

        return `**Order Status #${shortId}**\n\n` +
            (partName ? `🔧 ${partName}\n` : "") +
            `📊 ${statusText}\n` +
            (updatedAt ? `🕐 Last update: ${new Date(updatedAt).toLocaleString("en-US")}` : "");
    },

    // ============================================================================
    // CONFIRMATIONS
    // ============================================================================
    orderConfirmed: (ctx: PremiumResponseContext, params: {
        orderId: string;
        partName: string;
        price: number;
        deliveryMethod: "pickup" | "delivery";
    }): string => {
        const { orderId, partName, price, deliveryMethod } = params;
        const shortId = orderId.slice(-6).toUpperCase();
        const priceFormatted = price.toFixed(2).replace(".", ",");

        if (ctx.language === "de") {
            const method = deliveryMethod === "pickup"
                ? "🚗 Abholung im Geschäft"
                : "🚚 Lieferung an Ihre Adresse";

            return `✅ **Bestellung bestätigt!**\n\n` +
                `📦 Bestellung #${shortId}\n` +
                `🔧 ${partName}\n` +
                `💰 ${priceFormatted} EUR\n` +
                `${method}\n\n` +
                `Vielen Dank für Ihr Vertrauen!`;
        }

        const method = deliveryMethod === "pickup"
            ? "🚗 Store pickup"
            : "🚚 Delivery to your address";

        return `✅ **Order confirmed!**\n\n` +
            `📦 Order #${shortId}\n` +
            `🔧 ${partName}\n` +
            `💰 ${priceFormatted} EUR\n` +
            `${method}\n\n` +
            `Thank you for your business!`;
    },

    // ============================================================================
    // ERRORS & ESCALATION
    // ============================================================================
    escalateToHuman: (ctx: PremiumResponseContext): string => {
        if (ctx.language === "de") {
            return `Ich verbinde Sie mit einem Mitarbeiter. ` +
                `Bitte haben Sie einen Moment Geduld – wir melden uns schnellstmöglich!`;
        }
        return `Connecting you with a team member. ` +
            `Please wait – we'll get back to you as soon as possible!`;
    },

    oemNotFound: (ctx: PremiumResponseContext): string => {
        if (ctx.language === "de") {
            return `Leider konnte ich die OEM-Nummer nicht automatisch ermitteln. ` +
                `Haben Sie möglicherweise die Teilenummer vom alten Teil abgelesen? ` +
                `Das würde mir sehr helfen.`;
        }
        return `I couldn't automatically determine the OEM number. ` +
            `Do you perhaps have the part number from the old part? ` +
            `That would help greatly.`;
    },

    // ============================================================================
    // FAREWELL
    // ============================================================================
    farewell: (ctx: PremiumResponseContext): string => {
        if (ctx.language === "de") {
            return `Vielen Dank für Ihre Anfrage! Bei weiteren Fragen stehe ich jederzeit zur Verfügung. ` +
                `Einen schönen Tag noch! 👋`;
        }
        return `Thank you for your inquiry! I'm here anytime for further questions. ` +
            `Have a great day! 👋`;
    }
};

// Helper export for easy context creation
export function createResponseContext(
    language: "de" | "en",
    dealerName?: string
): PremiumResponseContext {
    return {
        language,
        dealerName: dealerName || process.env.DEALER_NAME || "Partsunion",
        timeOfDay: getTimeOfDay()
    };
}
