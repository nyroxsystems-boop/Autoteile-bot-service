/**
 * Conversation Intelligence Layer
 * 
 * AI-powered decision making BEFORE triggering OEM scraping.
 * This prevents unnecessary re-scraping when user confirms, wants a different part, etc.
 */

import { generateChatCompletion } from './geminiService';
import { logger } from '../../utils/logger';

export type ConversationDecision =
    | 'proceed_scraping'    // Actually run OEM lookup
    | 'continue_flow'       // User confirmed, continue without re-scraping
    | 'reset_part'          // User wants different part, keep vehicle
    | 'reset_all'           // User wants to start completely over
    | 'skip_scraping'       // OEM already known, don't re-scrape
    | 'wait'                // User asked to wait/pause
    | 'escalate'            // Hand off to human
    | 'answer_question';    // Just answer a question, no scraping

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

ENTSCHEIDUNGS-REGELN:

1. proceed_scraping: NUR wenn User NEUES Teil anfragt UND wir die OEM noch NICHT haben
   - "Ich brauche Bremsscheiben" (und wir haben keine OEM)
   - "Kannst du mir XXX suchen?" (neues Teil)

2. continue_flow: User BESTÄTIGT etwas, kein neues Scraping nötig
   - "Ja", "Genau", "Stimmt", "Ok", "Richtig"
   - "Das passt", "Korrekt"
   - Kurze Zustimmung ohne neue Information

3. reset_part: User will ANDERES Teil, Fahrzeug behalten
   - "Anderes Teil", "Lass mal ein anderes Teil"
   - "Alles gut, kann ich was anderes suchen?"
   - "Neues Teil bitte"

4. reset_all: User will KOMPLETT von vorne anfangen
   - "Nochmal von vorne", "Neues Fahrzeug"
   - "Anderes Auto", "Reset"

5. skip_scraping: Wir haben schon OEM/Angebote, User fragt danach
   - "Was kostet das?", "Preis?"
   - "Habt ihr das auf Lager?"
   - "Wann kommt es an?"

6. answer_question: Allgemeine Frage die KEIN Scraping braucht
   - "Wie funktioniert das?", "Wer seid ihr?"
   - "Kann ich auch vor Ort kaufen?"

7. escalate: User will Menschen sprechen
   - "Echten Mitarbeiter", "Mit Menschen reden"
   - "Das klappt nicht", "Hilfe"

8. wait: User bittet um Pause
   - "Moment mal", "Warte kurz"
   - "Ich muss kurz nachschauen"

ANTWORTE NUR MIT JSON:
{
  "decision": "proceed_scraping|continue_flow|reset_part|reset_all|skip_scraping|answer_question|escalate|wait",
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
                decision: parsed.decision || 'proceed_scraping',
                reason: parsed.reason || 'Default fallback',
                suggestedReply: parsed.suggestedReply,
                confidence: parsed.confidence || 0.5
            };
        }

        throw new Error('Could not parse JSON response');

    } catch (error: any) {
        logger.error('[ConversationIntelligence] Analysis failed, defaulting to proceed_scraping', {
            error: error?.message,
            userMessage: context.userMessage.substring(0, 50)
        });

        // Fallback: proceed with scraping (safe default)
        return {
            decision: 'proceed_scraping',
            reason: 'Analysis failed, defaulting to proceed',
            confidence: 0.3
        };
    }
}

/**
 * Quick heuristic check for common patterns
 * Returns a decision without AI call if pattern is obvious
 */
export function quickPatternCheck(userMessage: string): IntelligenceResult | null {
    const t = userMessage.toLowerCase().trim();

    // Simple confirmations - no AI needed
    if (/^(ja|jo|jap|yes|ok|okay|genau|stimmt|richtig|korrekt|passt|gut)\.?!?$/i.test(t)) {
        return {
            decision: 'continue_flow',
            reason: 'Simple confirmation detected',
            confidence: 0.95
        };
    }

    // Reset part patterns
    if (/anderes teil|neues teil|andere anfrage|was anderes/i.test(t)) {
        return {
            decision: 'reset_part',
            reason: 'Reset part pattern detected',
            suggestedReply: 'Natürlich! Welches andere Teil brauchst du?',
            confidence: 0.9
        };
    }

    // Escalation patterns
    if (/echter mitarbeiter|mit menschen|hilfe|support|klappt nicht/i.test(t)) {
        return {
            decision: 'escalate',
            reason: 'Escalation pattern detected',
            confidence: 0.85
        };
    }

    // Wait patterns
    if (/moment|warte|kurz|gleich|sekunde/i.test(t)) {
        return {
            decision: 'wait',
            reason: 'Wait pattern detected',
            suggestedReply: 'Kein Problem, ich warte! Melde dich, wenn du so weit bist.',
            confidence: 0.8
        };
    }

    // No quick match - needs AI analysis
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
    quickPatternCheck
};
