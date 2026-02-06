/**
 * CHOOSE LANGUAGE STATE HANDLER
 * 
 * Handles the initial language selection for new conversations.
 * If language already set → skip to collect_vehicle
 * If user selects language → persist and transition
 * Otherwise → show language menu
 */

import { createHandler, StateContext, StateResult } from '../stateMachine';
import { updateOrder } from '../../../adapters/supabaseService';
import { logger } from '../../../../utils/logger';

// ============================================================================
// Language Detection
// ============================================================================

function pickLanguageFromChoice(text: string): 'de' | 'en' | 'tr' | 'ku' | 'pl' | null {
    const t = text.toLowerCase().trim();

    // Number choices
    if (['1', 'eins', 'one'].some(k => t === k || t.startsWith(k + ' '))) return 'de';
    if (['2', 'zwei', 'two'].some(k => t === k || t.startsWith(k + ' '))) return 'en';
    if (['3', 'drei', 'three', 'üc', 'üç', 'uc'].some(k => t === k || t.startsWith(k + ' '))) return 'tr';
    if (['4', 'vier', 'four', 'çar', 'car'].some(k => t === k || t.startsWith(k + ' '))) return 'ku';
    if (['5', 'fünf', 'five', 'pięć', 'piec'].some(k => t === k || t.startsWith(k + ' '))) return 'pl';

    // Language name detection
    if (/deutsch|german|de\b/i.test(t)) return 'de';
    if (/english|englisch|en\b/i.test(t)) return 'en';
    if (/türkçe|turkish|türkisch|tr\b/i.test(t)) return 'tr';
    if (/kurdî|kurdish|kurdisch|ku\b/i.test(t)) return 'ku';
    if (/polski|polish|polnisch|pl\b/i.test(t)) return 'pl';

    return null;
}

// ============================================================================
// Greeting Messages
// ============================================================================

const GREETINGS: Record<string, string> = {
    en: "Great! 🎉 Please send me a photo of your vehicle registration document, or tell me: brand, model, year.",
    tr: "Harika! 🎉 Lütfen araç ruhsatınızın fotoğrafını gönderin veya marka, model, yıl bilgilerini yazın.",
    ku: "Baş e! 🎉 Ji kerema xwe wêneya belgeya qeydkirina wesayîta xwe bişînin, an jî marka, model, sal binivîsin.",
    pl: "Świetnie! 🎉 Wyślij mi zdjęcie dowodu rejestracyjnego pojazdu lub podaj: markę, model, rok.",
    de: "Super! 🎉 Schick mir bitte ein Foto deines Fahrzeugscheins, oder nenne mir: Marke, Modell, Baujahr."
};

const LANGUAGE_MENU =
    "Hallo! Bitte wähle deine Sprache:\n" +
    "1. Deutsch 🇩🇪\n" +
    "2. English 🇬🇧\n" +
    "3. Türkçe 🇹🇷\n" +
    "4. Kurdî ☀️\n" +
    "5. Polski 🇵🇱\n\n" +
    "Antworte einfach mit der Nummer (1, 2, 3, 4 oder 5).";

const SUPPORTED_LANGS = ['de', 'en', 'tr', 'ku', 'pl'];

// ============================================================================
// Handler
// ============================================================================

export const chooseLanguageHandler = createHandler(
    'ChooseLanguageHandler',
    ['choose_language'],
    async (ctx: StateContext): Promise<StateResult> => {
        const { order, language, userText } = ctx;

        // Already has language → skip to collect_vehicle
        if (language && SUPPORTED_LANGS.includes(language)) {
            logger.info('Language already set, skipping', {
                orderId: order.id,
                language
            });
            return {
                reply: GREETINGS[language] || GREETINGS.de,
                nextStatus: 'collect_vehicle',
                shouldPersistStatus: true
            };
        }

        // Try to pick language from user text
        const chosen = pickLanguageFromChoice(userText);

        if (chosen) {
            logger.info('Language selected', { orderId: order.id, language: chosen });

            try {
                await updateOrder(order.id, { language: chosen });
            } catch (err: any) {
                logger.error('Failed to persist chosen language', {
                    error: err?.message,
                    orderId: order.id
                });
            }

            return {
                reply: GREETINGS[chosen] || GREETINGS.de,
                nextStatus: 'collect_vehicle',
                shouldPersistStatus: true,
                updatedOrderData: { language: chosen }
            };
        }

        // No valid choice → show menu
        return {
            reply: LANGUAGE_MENU,
            nextStatus: 'choose_language',
            shouldPersistStatus: false
        };
    }
);
