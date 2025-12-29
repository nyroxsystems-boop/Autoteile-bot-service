"use strict";
// Sehr einfache OEM-Erkennung als Platzhalter.
// In einem echten Bot würdest du hier ein Modell / Regex + Wissensbasis nutzen.
Object.defineProperty(exports, "__esModule", { value: true });
exports.detectOemFromUserMessage = detectOemFromUserMessage;
async function detectOemFromUserMessage(message) {
    // Naive Heuristik: erste 5+ stellige Zahl oder Kombination aus Buchstaben/Zahlen.
    const regex = /[A-Z0-9]{5,}/gi;
    const match = message.match(regex);
    if (match && match.length) {
        return match[0];
    }
    return null;
}
