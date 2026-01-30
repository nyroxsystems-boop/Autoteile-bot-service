/**
 * 🌐 Language Service
 * 
 * Handles language detection, selection, and localization for the WhatsApp bot.
 * Extracted from botLogicService.ts for better maintainability.
 */

// ============================================================================
// TYPES
// ============================================================================

export type SupportedLanguage = "de" | "en";
export type SmalltalkType = "greeting" | "thanks" | "bot_question";

// ============================================================================
// LANGUAGE DETECTION
// ============================================================================

/**
 * Detect language from explicit user selection (menu choice)
 */
export function detectLanguageSelection(text: string): SupportedLanguage | null {
    if (!text) return null;
    const t = text.trim().toLowerCase();

    if (["1", "de", "deutsch", "german", "ger"].includes(t)) return "de";
    if (["2", "en", "english", "englisch", "eng"].includes(t)) return "en";

    return null;
}

/**
 * Detect language from message content using keyword analysis
 */
export function detectLanguageFromText(text: string): SupportedLanguage | null {
    const t = text?.toLowerCase() ?? "";

    const germanHints = [
        "hallo", "moin", "servus", "grüß", "danke", "tschau", "bitte",
        "guten", "morgen", "abend", "tag", "brauche", "suche", "möchte"
    ];
    const englishHints = [
        "hello", "hi", "hey", "thanks", "thank you", "cheers",
        "good", "morning", "evening", "need", "looking", "want"
    ];

    if (germanHints.some((w) => t.includes(w))) return "de";
    if (englishHints.some((w) => t.includes(w))) return "en";
    return null;
}

// ============================================================================
// SMALLTALK DETECTION
// ============================================================================

/**
 * Detect if message is smalltalk (greeting, thanks, etc.)
 */
export function detectSmalltalk(text: string): SmalltalkType | null {
    const t = text.toLowerCase().trim();

    // Greetings
    const greetings = ["hallo", "hello", "hi", "hey", "moin", "servus", "guten tag", "guten morgen", "good morning"];
    if (greetings.some(g => t.includes(g))) return "greeting";

    // Thanks
    const thanks = ["danke", "thanks", "thank you", "vielen dank", "thx"];
    if (thanks.some(th => t.includes(th))) return "thanks";

    // Bot questions
    const botQuestions = ["bist du ein bot", "are you a bot", "wer bist du", "who are you"];
    if (botQuestions.some(q => t.includes(q))) return "bot_question";

    return null;
}

// ============================================================================
// RESPONSE BUILDERS
// ============================================================================

/**
 * Build a smalltalk response based on type and language
 */
export function buildSmalltalkReply(
    kind: SmalltalkType,
    lang: SupportedLanguage,
    stage: string | null
): string {
    const responses: Record<SmalltalkType, Record<SupportedLanguage, string>> = {
        greeting: {
            de: "Hallo! 👋 Wie kann ich Ihnen bei der Teilesuche helfen?",
            en: "Hello! 👋 How can I help you find the right part?"
        },
        thanks: {
            de: "Gerne! Kann ich noch etwas für Sie tun?",
            en: "You're welcome! Is there anything else I can help with?"
        },
        bot_question: {
            de: "Ich bin ein KI-Assistent für Autoteile. Ich helfe Ihnen, das richtige Teil zu finden! 🤖",
            en: "I'm an AI assistant for auto parts. I help you find the right part! 🤖"
        }
    };

    return responses[kind]?.[lang] || responses[kind]?.de || "";
}

// ============================================================================
// LOCALIZED MESSAGES
// ============================================================================

export const MESSAGES = {
    LANGUAGE_PROMPT: {
        de: "Bitte wählen Sie Ihre Sprache:\n1️⃣ Deutsch\n2️⃣ English",
        en: "Please select your language:\n1️⃣ Deutsch\n2️⃣ English"
    },
    VEHICLE_REQUEST: {
        de: "Bitte senden Sie mir ein Foto Ihres Fahrzeugscheins (Zulassungsbescheinigung Teil 1) 📸",
        en: "Please send me a photo of your vehicle registration document 📸"
    },
    PART_REQUEST: {
        de: "Welches Teil suchen Sie?",
        en: "Which part are you looking for?"
    },
    PROCESSING: {
        de: "Einen Moment bitte, ich suche nach dem besten Angebot... ⏳",
        en: "One moment please, I'm searching for the best offer... ⏳"
    },
    ERROR: {
        de: "Entschuldigung, es ist ein Fehler aufgetreten. Bitte versuchen Sie es erneut.",
        en: "Sorry, an error occurred. Please try again."
    }
} as const;

/**
 * Get a localized message
 */
export function getMessage(
    key: keyof typeof MESSAGES,
    lang: SupportedLanguage = "de"
): string {
    return MESSAGES[key][lang];
}
