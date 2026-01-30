/**
 * Gemini Email Generator Service
 * AI-powered email template generation for marketing campaigns
 */

import { GoogleGenerativeAI } from '@google/generative-ai';

const GEMINI_API_KEY = process.env.GEMINI_API_KEY || process.env.GOOGLE_AI_API_KEY || '';

// System prompt for email generation
const EMAIL_SYSTEM_PROMPT = `Du bist ein professioneller E-Mail-Marketing-Spezialist für Partsunion, eine B2B-Plattform für Autoteile-Händler.

Deine Aufgabe ist es, hochwertige, professionelle E-Mail-Templates zu erstellen.

WICHTIGE REGELN:
1. Schreibe auf Deutsch (formell Sie-Form für B2B)
2. Halte E-Mails kurz und prägnant (max. 200 Wörter)
3. Verwende eine klare Struktur: Betreff, Anrede, Hauptteil, Call-to-Action, Signatur
4. Sei professionell aber freundlich
5. Fokussiere auf den Mehrwert für den Empfänger
6. Verwende keine übertriebenen Marketing-Phrasen

OUTPUT FORMAT:
Gib die E-Mail als JSON zurück mit folgenden Feldern:
{
  "subject": "Der Betreff der E-Mail",
  "preview": "Vorschau-Text (max. 100 Zeichen)",
  "htmlContent": "Der HTML-Body der E-Mail (nur der Inhalt, ohne Header/Footer)",
  "plainText": "Nur-Text Version der E-Mail"
}

STYLING:
- Verwende <h1> für Hauptüberschriften (nur einmal pro E-Mail)
- Verwende <h2> für Unterüberschriften
- Verwende <p> für Absätze
- Verwende <strong> für wichtige Begriffe
- Verwende <a href="#" class="button"> für Call-to-Action Buttons
- Halte das HTML sauber und einfach

PARTSUNION KONTEXT:
- B2B-Plattform für Autoteile-Großhändler
- Bietet: WhatsApp-Bot für OEM-Ermittlung, Warenwirtschaft, Lieferanten-Integration
- Zielgruppe: Autoteile-Händler in Deutschland
- Tonalität: Professionell, technisch versiert, lösungsorientiert`;

interface GeneratedEmail {
    subject: string;
    preview: string;
    htmlContent: string;
    plainText: string;
}

/**
 * Generate email template using Gemini AI
 */
export async function generateEmailTemplate(prompt: string): Promise<GeneratedEmail> {
    if (!GEMINI_API_KEY) {
        throw new Error('GEMINI_API_KEY nicht konfiguriert');
    }

    const genAI = new GoogleGenerativeAI(GEMINI_API_KEY);
    const model = genAI.getGenerativeModel({
        model: 'gemini-2.0-flash',
        generationConfig: {
            temperature: 0.7,
            topP: 0.9,
            maxOutputTokens: 2048,
        }
    });

    const fullPrompt = `${EMAIL_SYSTEM_PROMPT}

BENUTZER-ANFRAGE:
${prompt}

Generiere jetzt die E-Mail im JSON-Format.`;

    try {
        const result = await model.generateContent(fullPrompt);
        const response = result.response;
        const text = response.text();

        // Extract JSON from response
        const jsonMatch = text.match(/\{[\s\S]*\}/);
        if (!jsonMatch) {
            throw new Error('Konnte kein gültiges JSON aus der Antwort extrahieren');
        }

        const emailData = JSON.parse(jsonMatch[0]) as GeneratedEmail;

        // Validate required fields
        if (!emailData.subject || !emailData.htmlContent) {
            throw new Error('Unvollständige E-Mail-Daten generiert');
        }

        console.log(`✅ Email template generated: "${emailData.subject.substring(0, 50)}..."`);
        return emailData;

    } catch (error: any) {
        console.error('Email generation error:', error.message);
        throw new Error(`E-Mail-Generierung fehlgeschlagen: ${error.message}`);
    }
}

/**
 * Generate multiple email variants for A/B testing
 */
export async function generateEmailVariants(prompt: string, count: number = 2): Promise<GeneratedEmail[]> {
    const variants: GeneratedEmail[] = [];

    for (let i = 0; i < count; i++) {
        const variantPrompt = `${prompt}\n\nDies ist Variante ${i + 1} von ${count}. Erstelle eine einzigartige Version.`;
        const variant = await generateEmailTemplate(variantPrompt);
        variants.push(variant);
    }

    return variants;
}

/**
 * Improve existing email content
 */
export async function improveEmailContent(existingHtml: string, instructions: string): Promise<GeneratedEmail> {
    const prompt = `Verbessere die folgende E-Mail basierend auf diesen Anweisungen:

ANWEISUNGEN: ${instructions}

BESTEHENDE E-MAIL:
${existingHtml}

Behalte die Grundstruktur bei, aber verbessere gemäß den Anweisungen.`;

    return generateEmailTemplate(prompt);
}
