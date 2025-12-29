"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.aiGuessSource = void 0;
const baseSource_1 = require("./baseSource");
/**
 * AI-gestützter Fallback: nutzt OpenAI, um aus Fahrzeug + Teiltext plausible OEMs zu schätzen.
 * Achtung: kann halluzinieren – nur einsetzen, wenn echte Quellen nichts liefern.
 */
exports.aiGuessSource = {
    name: "ai_guess",
    async resolveCandidates(req) {
        if (!process.env.OPENAI_API_KEY) {
            (0, baseSource_1.logSourceResult)(this.name, 0);
            return [];
        }
        const vehicle = req.vehicle;
        const part = req.partQuery.rawText || "unbekanntes Teil";
        const prompt = `Fahrzeugdaten: ${JSON.stringify(vehicle)}\nGesuchtes Teil: ${part}\n
Gib eine JSON-Antwort: {"oems": ["<OEM1>", "<OEM2>", ...]}.
Regeln: 
- OEMs normalisieren (Großbuchstaben, keine Sonderzeichen außer Ziffern/Buchstaben).
- Keine Erklärungen, nur die JSON-Struktur.`;
        try {
            const res = await fetch("https://api.openai.com/v1/chat/completions", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${process.env.OPENAI_API_KEY}`
                },
                body: JSON.stringify({
                    model: process.env.OPENAI_MODEL || "gpt-4.1-mini",
                    messages: [
                        { role: "system", content: "Du schätzt OEM-Nummern für Fahrzeugteile. Antworte strikt mit JSON." },
                        { role: "user", content: prompt }
                    ],
                    temperature: 0
                })
            });
            const data = await res.json();
            const txt = data?.choices?.[0]?.message?.content || "";
            const match = txt.match(/\{[\s\S]*\}/);
            let parsed = null;
            if (match) {
                try {
                    parsed = JSON.parse(match[0]);
                }
                catch {
                    parsed = null;
                }
            }
            let oems = [];
            if (parsed && Array.isArray(parsed?.oems)) {
                oems = parsed.oems;
            }
            else {
                // Versuche, OEM-artige Tokens direkt aus der Antwort zu extrahieren
                const tokens = txt.match(/[A-Z0-9][A-Z0-9\.\-]{4,20}[A-Z0-9]/gi) || [];
                oems = tokens;
            }
            // Wenn immer noch nichts, generiere eine synthetische Guess
            if (oems.length === 0) {
                const guess = `${(vehicle.make || "OEM").toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 6)}${Date.now()
                    .toString()
                    .slice(-5)}`;
                oems = [guess];
            }
            const candidates = oems
                .map((o) => String(o).replace(/[^A-Z0-9]/gi, "").toUpperCase())
                .filter((o) => /^[A-Z0-9]{6,18}$/.test(o) && /[0-9]/.test(o))
                .map((o) => ({
                oem: o,
                brand: vehicle.make ? vehicle.make.toUpperCase() : undefined,
                source: this.name,
                confidence: (0, baseSource_1.clampConfidence)(0.55)
            }));
            (0, baseSource_1.logSourceResult)(this.name, candidates.length);
            return candidates;
        }
        catch {
            (0, baseSource_1.logSourceResult)(this.name, 0);
            return [];
        }
    }
};
