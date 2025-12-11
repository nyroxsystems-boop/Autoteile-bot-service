import { getRankedInventoryForOem } from "../../services/oemInventoryFlow";
import { askLLM, ChatMessage } from "../llmClient";
import { detectOemFromUserMessage } from "../../services/oemDetection";

// Baut einen Textbaustein für den LLM-Prompt auf Basis des zusammengeführten Inventars.
export async function buildInventorySummaryForPrompt(oemNumber: string): Promise<string> {
  const { entries } = await getRankedInventoryForOem(oemNumber);

  if (!entries.length) {
    return `Für OEM ${oemNumber} wurde in den angebundenen Warenwirtschaftssystemen kein Bestand gefunden.`;
  }

  const lines = entries.slice(0, 5).map((e) => {
    const price =
      e.price != null && e.currency ? `${e.price.toFixed(2)} ${e.currency}` : "Preis unbekannt";
    const qty =
      e.availableQuantity != null ? `${e.availableQuantity} Stück verfügbar` : "Verfügbarkeit unbekannt";

    return [
      `System: ${e.systemName} (${e.providerType})`,
      `Titel: ${e.title ?? "n/a"}`,
      `OEM: ${e.oemNumber}`,
      `Interne SKU: ${e.internalSku ?? "n/a"}`,
      `Preis: ${price}`,
      `Bestand: ${qty}`,
      `Lieferzeit: ${e.deliveryTime ?? "unbekannt"}`
    ].join(" | ");
  });

  return [`Inventar-Übersicht für OEM ${oemNumber}:`, ...lines].join("\n");
}

// Integration-Hinweis:
// Diese Funktion sollte im Dialogfluss aufgerufen werden, wenn die OEM feststeht,
// bevor die finale LLM-Antwort erzeugt wird.
// Beispiel-Flow (Pseudo):
// 1. Text-Nachricht → LLM → OEM ermitteln
// 2. getRankedInventoryForOem(oem)
// 3. inventorySummaryText = buildInventorySummaryForPrompt(oem)
// 4. LLM-Aufruf: System-Prompt + inventorySummaryText + User-Nachricht → Antwort

// Beispielhafter Handler, der OEM ermittelt, Inventar lädt und den LLM antworten lässt.
export async function handlePartsRequest(userMessage: string): Promise<string> {
  const oem = await detectOemFromUserMessage(userMessage);
  if (!oem) {
    return "Ich konnte keine eindeutige OEM-Nummer ermitteln. Bitte nenne mir Hersteller, Modell, Baujahr, Motorisierung oder eine OEM-Nummer.";
  }

  const inventorySummary = await buildInventorySummaryForPrompt(oem);

  const systemPrompt = `
Du bist ein KI-Assistent für Autoteile-Händler und Werkstätten.
Regeln:
- Nutze immer zuerst die Inventar-Informationen, die dir das System liefert.
- Erfinde niemals Lagerbestände oder Preise.
- Wenn für eine OEM kein Bestand gefunden wurde, sag das ehrlich.
- Bevorzuge Einträge aus dem eigenen Lager gegenüber externen Quellen.
- Sprich in klarem, verständlichem Deutsch.
`.trim();

  const assistantContext = `
Hier sind die aktuell ermittelten Bestände für die OEM ${oem} aus allen angebundenen Warenwirtschaftssystemen:

${inventorySummary}
`.trim();

  const messages: ChatMessage[] = [
    { role: "system", content: systemPrompt },
    { role: "assistant", content: assistantContext },
    { role: "user", content: userMessage }
  ];

  const answer = await askLLM(messages);
  return answer;
}
