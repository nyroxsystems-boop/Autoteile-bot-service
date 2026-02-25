/**
 * Conversation Intelligence Layer
 * 
 * AI-powered decision making BEFORE triggering OEM scraping.
 * This prevents unnecessary re-scraping when user confirms, wants a different part, etc.
 */

import { generateChatCompletion } from './geminiService';
import { logger } from '../../utils/logger';

export type ConversationDecision =
    | 'proceed'    // Actually run OEM lookup / scraping
    | 'skip'       // No scraping needed (confirmation, already have data, general question, wait)
    | 'reset'      // User wants different part or different vehicle
    | 'escalate';  // Hand off to human

// Legacy aliases for backward compatibility
export type LegacyDecision =
    | 'proceed_scraping'
    | 'continue_flow'
    | 'reset_part'
    | 'reset_all'
    | 'skip_scraping'
    | 'wait'
    | 'escalate'
    | 'answer_question';

/** Map old 8-type decisions to new 4-type system */
function normalizeDecision(decision: string): ConversationDecision {
    switch (decision) {
        case 'proceed_scraping': return 'proceed';
        case 'continue_flow': return 'skip';
        case 'skip_scraping': return 'skip';
        case 'answer_question': return 'skip';
        case 'wait': return 'skip';
        case 'reset_part': return 'reset';
        case 'reset_all': return 'reset';
        case 'escalate': return 'escalate';
        default: return 'proceed';
    }
}

export interface ConversationContext {
    userMessage: string;
    lastBotMessage?: string;
    orderData: {
        make?: string;
        model?: string;
        year?: number;
        requestedPart?: string;
        oem?: string;
        scrapeStatus?: 'idle' | 'running' | 'completed' | 'failed';
        offersCount?: number;
    };
    conversationHistory?: Array<{ role: 'user' | 'assistant'; content: string }>;
}

export interface IntelligenceResult {
    decision: ConversationDecision;
    reason: string;
    suggestedReply?: string;
    confidence: number;
}

const INTELLIGENCE_PROMPT = `Du bist ein Konversations-Analyst für einen Autoteile-Bot.

DEINE AUFGABE:
Analysiere die User-Nachricht und entscheide, was der Bot als NÄCHSTES tun soll.

KONTEXT:
- Fahrzeug: {vehicle}
- Gesuchtes Teil: {part}
- OEM-Nummer bekannt: {hasOem}
- Angebote vorhanden: {hasOffers}
- Letzte Bot-Nachricht: {lastBot}

USER-NACHRICHT: "{userMessage}"

ENTSCHEIDUNGS-REGELN (NUR 4 OPTIONEN):

1. proceed: User will NEUES Teil suchen und wir haben noch keine OEM dafür
   - "Ich brauche Bremsscheiben" (und wir haben keine OEM)
   - "Kannst du mir XXX suchen?" (neues Teil)

2. skip: KEIN Scraping nötig — Bestätigung, Frage, Warten, oder Daten bereits vorhanden
   - "Ja", "Genau", "Stimmt", "Ok" (Bestätigung)
   - "Was kostet das?", "Wie funktioniert das?" (Frage)
   - "Warte kurz", "Moment" (Pause)

3. reset: User will VON VORNE anfangen (anderes Teil oder anderes Fahrzeug)
   - "Anderes Teil", "Neues Fahrzeug", "Nochmal von vorne"

4. escalate: User will Menschen sprechen oder ist frustriert
   - "Echter Mitarbeiter", "Hilfe", "Das klappt nicht"

ANTWORTE NUR MIT JSON:
{
  "decision": "proceed|skip|reset|escalate",
  "reason": "Kurze Erklärung warum diese Entscheidung",
  "suggestedReply": "Optional: Vorgeschlagene Bot-Antwort",
  "confidence": 0.0-1.0
}`;

/**
 * Analyze conversation intent and decide what action to take
 * BEFORE blindly triggering OEM scraping
 */
export async function analyzeConversationIntent(
    context: ConversationContext
): Promise<IntelligenceResult> {
    const startTime = Date.now();

    try {
        // Build context description
        const vehicle = context.orderData.make && context.orderData.model
            ? `${context.orderData.make} ${context.orderData.model} ${context.orderData.year || ''}`
            : 'Noch nicht bekannt';

        const part = context.orderData.requestedPart || 'Noch nicht bekannt';
        const hasOem = context.orderData.oem ? 'Ja' : 'Nein';
        const hasOffers = (context.orderData.offersCount || 0) > 0 ? 'Ja' : 'Nein';
        const lastBot = context.lastBotMessage?.substring(0, 200) || 'Keine';

        // Fill in the prompt template
        const prompt = INTELLIGENCE_PROMPT
            .replace('{vehicle}', vehicle)
            .replace('{part}', part)
            .replace('{hasOem}', hasOem)
            .replace('{hasOffers}', hasOffers)
            .replace('{lastBot}', lastBot)
            .replace('{userMessage}', context.userMessage);

        const response = await generateChatCompletion({
            messages: [
                { role: 'system', content: prompt },
                { role: 'user', content: context.userMessage }
            ],
            responseFormat: 'json_object',
            temperature: 0.1
        });

        const elapsed = Date.now() - startTime;

        // Parse response
        const jsonStart = response.indexOf('{');
        const jsonEnd = response.lastIndexOf('}');

        if (jsonStart !== -1 && jsonEnd !== -1) {
            const parsed = JSON.parse(response.slice(jsonStart, jsonEnd + 1));

            logger.info('[ConversationIntelligence] Decision made', {
                decision: parsed.decision,
                reason: parsed.reason,
                confidence: parsed.confidence,
                elapsed,
                userMessage: context.userMessage.substring(0, 50)
            });

            return {
                decision: normalizeDecision(parsed.decision) || 'proceed',
                reason: parsed.reason || 'Default fallback',
                suggestedReply: parsed.suggestedReply,
                confidence: parsed.confidence || 0.5
            };
        }

        throw new Error('Could not parse JSON response');

    } catch (error: any) {
        logger.error('[ConversationIntelligence] Analysis failed, defaulting to proceed', {
            error: error?.message,
            userMessage: context.userMessage.substring(0, 50)
        });

        // Fallback: proceed with scraping (safe default)
        return {
            decision: 'proceed',
            reason: 'Analysis failed, defaulting to proceed',
            confidence: 0.3
        };
    }
}

/**
 * Quick heuristic check for common patterns
 * Returns a decision without AI call if pattern is obvious.
 * EXPANDED: covers more patterns to reduce unnecessary AI calls.
 */
export function quickPatternCheck(userMessage: string): IntelligenceResult | null {
    const t = userMessage.toLowerCase().trim();

    // === SKIP patterns (confirmations, questions, greetings) ===

    // Simple confirmations
    if (/^(ja|jo|jap|yes|ok|okay|genau|stimmt|richtig|korrekt|passt|gut|alles klar|super|perfekt|top|danke|vielen dank|dankeschön)\b.*$/i.test(t)) {
        return {
            decision: 'skip',
            reason: 'Simple confirmation detected',
            confidence: 0.95
        };
    }

    // Price/availability questions (already have data)
    if (/was kostet|preis|kosten|auf lager|verfügbar|lieferzeit|lieferbar|wann kommt|angebot/i.test(t)) {
        return {
            decision: 'skip',
            reason: 'Price/availability question — no scraping needed',
            confidence: 0.9
        };
    }

    // General questions
    if (/wie funktioniert|wer seid ihr|öffnungszeiten|standort|telefon|email|adresse|kontakt/i.test(t)) {
        return {
            decision: 'skip',
            reason: 'General question detected',
            confidence: 0.9
        };
    }

    // Wait/pause patterns
    if (/^(moment|warte|kurz|gleich|sekunde|bin gleich|eine minute)/i.test(t)) {
        return {
            decision: 'skip',
            reason: 'Wait pattern detected',
            suggestedReply: 'Kein Problem, ich warte! Melde dich, wenn du so weit bist. 👍',
            confidence: 0.85
        };
    }

    // Greetings (don't scrape on "Hallo")
    if (/^(hallo|hi|hey|moin|guten (tag|morgen|abend)|servus|grüß gott)\b/i.test(t) && t.length < 30) {
        return {
            decision: 'skip',
            reason: 'Greeting detected',
            confidence: 0.9
        };
    }

    // === RESET patterns ===

    if (/anderes teil|neues teil|andere anfrage|was anderes|nochmal von vorne|neues fahrzeug|anderes auto|reset|von vorne/i.test(t)) {
        return {
            decision: 'reset',
            reason: 'Reset pattern detected',
            suggestedReply: 'Natürlich! Was suchst du als Nächstes?',
            confidence: 0.9
        };
    }

    // === ESCALATE patterns ===

    if (/echter mitarbeiter|mit menschen|hilfe|support|klappt nicht|funktioniert nicht|beschwerde|reklamation|manager/i.test(t)) {
        return {
            decision: 'escalate',
            reason: 'Escalation pattern detected',
            confidence: 0.85
        };
    }

    // No quick match — needs AI analysis
    return null;
}

/**
 * Main entry point: Check patterns first, then use AI
 */
export async function getConversationDecision(
    context: ConversationContext
): Promise<IntelligenceResult> {
    // 1. Try quick heuristic first (faster, no API call)
    const quickResult = quickPatternCheck(context.userMessage);
    if (quickResult && quickResult.confidence >= 0.8) {
        logger.info('[ConversationIntelligence] Quick pattern match', {
            decision: quickResult.decision,
            message: context.userMessage.substring(0, 30)
        });
        return quickResult;
    }

    // 2. Use AI for more complex analysis
    return analyzeConversationIntent(context);
}

export default {
    getConversationDecision,
    analyzeConversationIntent,
    quickPatternCheck,
    normalizeDecision
};

