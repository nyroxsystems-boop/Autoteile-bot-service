/**
 * Gemini Email Reply Service
 * AI-powered email reply generation
 */

const GEMINI_API_KEY = process.env.GEMINI_API_KEY || '';
const GEMINI_MODEL = 'gemini-2.0-flash';

interface EmailContext {
    from: string;
    subject: string;
    body: string;
    date: string;
}

/**
 * Generate an AI-powered email reply
 */
export async function generateEmailReply(
    originalEmail: EmailContext,
    prompt: string,
    tone: 'professional' | 'friendly' | 'formal' | 'brief' = 'professional',
    signature?: string,
    senderName?: string
): Promise<string> {
    if (!GEMINI_API_KEY) {
        throw new Error('GEMINI_API_KEY nicht konfiguriert');
    }

    const toneInstructions = {
        professional: 'Schreibe professionell und höflich, aber warm und persönlich.',
        friendly: 'Schreibe freundlich und nahbar, aber immer noch professionell.',
        formal: 'Schreibe sehr formell und geschäftlich.',
        brief: 'Schreibe kurz und prägnant, nur das Wesentliche.'
    };

    const systemPrompt = `Du bist ein E-Mail-Assistent für Partsunion, einen B2B-Autoteile-Marktplatz.
Du hilfst beim Verfassen von E-Mail-Antworten.

WICHTIGE REGELN:
1. Schreibe IMMER auf Deutsch
2. ${toneInstructions[tone]}
3. Beginne NICHT mit "Betreff:" - schreibe nur den E-Mail-Body
4. Verwende "Sie" (formelle Anrede)
5. Halte die Antwort relevant zur ursprünglichen E-Mail
6. Wenn du unsicher bist, frage in der Antwort nach Klärung

${senderName ? `Der Absender (du) heißt: ${senderName}` : ''}`;

    const userPrompt = `ORIGINAL E-MAIL:
Von: ${originalEmail.from}
Betreff: ${originalEmail.subject}
Datum: ${originalEmail.date}

${originalEmail.body}

---

AUFGABE: ${prompt}

Schreibe eine passende Antwort:`;

    try {
        const response = await fetch(
            `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${GEMINI_API_KEY}`,
            {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    contents: [
                        { role: 'user', parts: [{ text: systemPrompt }] },
                        { role: 'model', parts: [{ text: 'Verstanden. Ich werde professionelle E-Mail-Antworten auf Deutsch verfassen.' }] },
                        { role: 'user', parts: [{ text: userPrompt }] }
                    ],
                    generationConfig: {
                        temperature: 0.7,
                        maxOutputTokens: 1024,
                        topP: 0.9
                    }
                })
            }
        );

        if (!response.ok) {
            const errorText = await response.text();
            console.error('Gemini API error:', errorText);
            throw new Error('Gemini API Fehler');
        }

        const data = await response.json() as any;
        let replyText = data.candidates?.[0]?.content?.parts?.[0]?.text || '';

        // Clean up the response
        replyText = replyText.trim();

        // Add signature if provided
        if (signature) {
            replyText += `\n\n--\n${signature}`;
        }

        return replyText;

    } catch (error: any) {
        console.error('Email reply generation error:', error);
        throw new Error('Antwort konnte nicht generiert werden: ' + error.message);
    }
}

/**
 * Pre-defined prompt templates for common scenarios
 */
export const REPLY_TEMPLATES = {
    acknowledge: 'Bestätige den Empfang der E-Mail und teile mit, dass wir uns darum kümmern werden.',
    decline: 'Lehne die Anfrage höflich ab und erkläre warum.',
    moreInfo: 'Frage nach weiteren Informationen, die wir benötigen.',
    schedule: 'Schlage einen Termin für ein Gespräch vor.',
    followUp: 'Frage nach dem aktuellen Stand oder erinnere an eine ausstehende Antwort.',
    thankYou: 'Bedanke dich für die Zusammenarbeit und die E-Mail.',
    quote: 'Teile mit, dass wir ein Angebot erstellen werden und frage nach Details.',
    shipping: 'Informiere über den Versandstatus oder frage nach Lieferdetails.',
    complaint: 'Antworte auf eine Beschwerde, zeige Verständnis und biete eine Lösung an.',
    welcome: 'Begrüße einen neuen Kunden oder Partner.'
};
