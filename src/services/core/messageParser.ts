/**
 * 📝 Message Parser
 * 
 * Handles message parsing, intent detection, and content filtering.
 * Extracted from botLogicService.ts for better maintainability.
 */
import { logger } from "@utils/logger";

// ============================================================================
// TYPES
// ============================================================================

export type IntentType =
    | "greeting"
    | "send_vehicle_doc"
    | "request_part"
    | "describe_symptoms"
    | "general_question"
    | "smalltalk"
    | "abort_order"
    | "continue_order"
    | "status_question"
    | "new_order"
    | "other";

export type OrchestratorAction =
    | "ask_slot"
    | "confirm"
    | "oem_lookup"
    | "smalltalk"
    | "abusive"
    | "noop"
    | "order_status"
    | "stock_check"
    | "escalate_human";

export interface ParsedUserMessage {
    intent: IntentType;
    language?: "de" | "en" | null;
    is_auto_part?: boolean;
    user_part_text?: string | null;
    normalized_part_name?: string | null;
    part_category?: string | null;
    position?: string | null;
    position_needed?: boolean;
    side_needed?: boolean;
    quantity?: number | null;
    symptoms?: string | null;
    part?: string | null;
    partDetails?: Record<string, unknown> | null;
    missingVehicleInfo?: string[];
    missingPartInfo?: string[];
    smalltalkType?: "greeting" | "thanks" | "bot_question" | null;
    smalltalkReply?: string | null;
}

// ============================================================================
// ABUSE DETECTION
// ============================================================================

const ABUSIVE_WORDS = [
    // German
    "hurensohn", "arschloch", "fotze", "verpiss", "scheiss", "scheiße",
    "wichser", "missgeburt", "bastard", "vollidiot",
    // English
    "fuck", "bitch", "shit", "idiot", "asshole", "moron", "retard"
];

/**
 * Detects obviously abusive or insulting messages.
 * Returns true when the message should be treated as abuse.
 */
export function detectAbusive(text: string): boolean {
    if (!text) return false;
    const t = text.toLowerCase();
    return ABUSIVE_WORDS.some((w) => t.includes(w));
}

// ============================================================================
// INTENT DETECTION
// ============================================================================

const INTENT_PATTERNS: Record<IntentType, RegExp[]> = {
    abort_order: [
        /abbrechen/i, /cancel/i, /stopp/i, /stop/i, /aufhören/i,
        /nicht mehr/i, /kein interesse/i, /egal/i, /vergiss/i
    ],
    continue_order: [
        /noch ein teil/i, /weiteres teil/i, /another part/i,
        /dasselbe fahrzeug/i, /same vehicle/i, /noch was/i
    ],
    status_question: [
        /status/i, /bestellung/i, /order/i, /wo ist/i, /where is/i,
        /lieferung/i, /delivery/i, /tracking/i
    ],
    new_order: [
        /neues fahrzeug/i, /new vehicle/i, /anderes auto/i,
        /different car/i, /von vorne/i, /start over/i
    ],
    greeting: [
        /^(hallo|hello|hi|hey|moin|servus|guten\s?(tag|morgen|abend))$/i
    ],
    send_vehicle_doc: [
        /fahrzeugschein/i, /zulassung/i, /registration/i, /dokument/i
    ],
    request_part: [
        /brauche/i, /suche/i, /need/i, /looking for/i, /want/i, /möchte/i
    ],
    describe_symptoms: [
        /klackert/i, /quietscht/i, /noise/i, /problem/i, /kaputt/i, /defekt/i
    ],
    general_question: [
        /was kostet/i, /how much/i, /preis/i, /price/i
    ],
    smalltalk: [],
    other: []
};

/**
 * Detect user intent from message text
 */
export function detectIntent(text: string): IntentType {
    const t = text.trim().toLowerCase();

    for (const [intent, patterns] of Object.entries(INTENT_PATTERNS)) {
        if (patterns.some(p => p.test(t))) {
            return intent as IntentType;
        }
    }

    return "other";
}

// ============================================================================
// VEHICLE DOCUMENT DETECTION
// ============================================================================

const NO_VEHICLE_DOC_PATTERNS = [
    /habe? ?(ich )?keine?n? ?(fahrzeugschein|schein|dokument)/i,
    /habe? ?(ich )?nicht/i,
    /don'?t have/i,
    /no document/i,
    /kein bild/i,
    /kann nicht senden/i,
    /can'?t send/i
];

/**
 * Detect if user indicates they don't have a vehicle document
 */
export function detectNoVehicleDocument(text: string): boolean {
    const t = text.toLowerCase();
    return NO_VEHICLE_DOC_PATTERNS.some(p => p.test(t));
}

// ============================================================================
// PART INFO VALIDATION
// ============================================================================

/**
 * Required fields per part category for OEM lookup
 */
export const PART_REQUIRED_FIELDS: Record<string, string[]> = {
    brake_caliper: ["position"],
    brake_disc: ["position", "disc_diameter"],
    brake_pad: ["position"],
    shock_absorber: ["position"],
    spring: ["position"],
    control_arm: ["position", "side"],
    wishbone: ["position", "side"]
};

/**
 * Check if sufficient part info exists for OEM lookup
 */
export function hasSufficientPartInfo(
    parsed: ParsedUserMessage,
    orderData: Record<string, unknown>
): { ok: boolean; missing: string[] } {
    const category = parsed.part_category || (orderData.part_category as string);
    const requiredFields = PART_REQUIRED_FIELDS[category] || [];

    const missing: string[] = [];
    for (const field of requiredFields) {
        const value = (parsed as any)[field] || orderData[field];
        if (!value) {
            missing.push(field);
        }
    }

    return { ok: missing.length === 0, missing };
}
