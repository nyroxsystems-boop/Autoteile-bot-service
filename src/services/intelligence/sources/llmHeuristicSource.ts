import { OEMResolverRequest, OEMCandidate } from "../types";
import { OEMSource, clampConfidence, logSourceResult } from "./baseSource";
import { generateChatCompletion } from "../geminiService";
import { logger } from "@utils/logger";

/**
 * 🎯 PREMIUM AI OEM RESOLVER - 10/10 Quality
 * 
 * Uses Gemini AI with comprehensive automotive knowledge to:
 * 1. Understand the exact part requested
 * 2. Map to known OEM schemas for each brand
 * 3. Cross-reference with TecDoc/aftermarket knowledge
 * 4. Return high-confidence OEM candidates
 * 
 * This is the CORE fallback when web scrapers fail (403/404)
 */

// ============================================================================
// OEM Schema Knowledge Base
// ============================================================================

const OEM_SCHEMA_KNOWLEDGE = `
## OEM NUMBER SCHEMA BY BRAND

### BMW (Bayerische Motoren Werke)
- Format: 11 digits (XX XX XXX XXX X) or 7 digits
- Examples: 34 11 6 860 264 (Bremssattel VL), 16 14 7 163 296 (Filter)
- Structure: 2-digit system group + 9 digits
- Brake parts: Start with 34 (chassis group)
- Engine parts: Start with 11 (engine group)
- Fuel system: Start with 13, 16
- Electrical: Start with 12, 61, 63
- Suspension: Start with 31, 33

### Mercedes-Benz
- Format: A XXX XXX XX XX or W/N + 10 digits
- Examples: A 000 420 51 20 (Bremsscheibe), A 271 010 01 15 (Ölfilter)
- Prefix letters: A=Accessory, W=Motor, N=Standard, B=Chassis
- Groups: 000-099 Engine, 100-199 Transmission, 200-299 Chassis/Brake

### VAG (VW, Audi, Seat, Skoda, Porsche)
- Format: XXX XXX XXX A (9-10 chars, last is version letter)
- Examples: 1K0 698 151 A (Bremsbeläge Golf 5), 4F0 615 301 D (Bremsscheibe A6)
- First 3 chars = Model code: 1K0=Golf 5, 5C0=Golf 6, 8V0=A3 8V, 4F0=A6 C6
- Middle = Part group
- Last letter = Version (A=original, B-Z=supersessions)

### Toyota/Lexus
- Format: XXXXX-XXXXX (5-5 digit with dash)
- Examples: 04465-33471 (Bremsbeläge Camry), 04465-48150 (Bremsbeläge RX)
- First 5 = Part type, Last 5 = Application

### Hyundai/Kia
- Format: XXXXX-XXXXX (10 alphanumeric)
- Examples: 58101-2EA00 (Bremsscheibe), 26300-35530 (Ölfilter)

### Ford
- Format: 7-digit FINIS or XXXX-XXXXX-AA (Engineering)
- Examples: 1234567 (FINIS), 6G91-2M008-AA (Engineering)

### Opel/Vauxhall (GM)
- Format: 7-8 digit numeric catalog number
- Examples: 0542115 (Bremsbeläge), 95528240 (Filter)

### PSA (Peugeot, Citroën, DS)
- Format: XXXX.XXXXXX (4+6 with dot) or 10 digits
- Examples: 4254.62 (Bremsbeläge), 1609851280 (Filter)

### Renault/Dacia/Nissan
- Format: 10 digits or XXXXX-XXXXX (Nissan)
- Examples: 7701207668 (Filter Renault), 14200-EE500 (Nissan)

### Fiat/Alfa Romeo/Lancia
- Format: 8 digit numeric
- Examples: 77366668 (Bremsbeläge), 55242685 (Filter)

### Honda
- Format: 8 digit or XXXX-XXXX
- Examples: 45022-S3V-A00 (Bremsbeläge), 15400-RTA-003 (Ölfilter)

### Mazda
- Format: 4 letter + 6 digit or dash format
- Examples: D6Y0-33-28ZA (Bremsbeläge), LF02-14-302 (Filter)
`;

const COMMON_BRAKE_OEMS = `
## BEKANNTE BREMSTEILE-OEMs (REFERENZ)

### BMW 3er (G20/G21) 2019+
- Bremssattel VL: 34 11 6 860 264
- Bremssattel VR: 34 11 6 860 263
- Bremssattel HL: 34 21 6 860 253
- Bremssattel HR: 34 21 6 860 254
- Bremsscheibe vorne: 34 11 6 860 910
- Bremsscheibe hinten: 34 21 6 860 912
- Bremsbeläge vorne: 34 10 6 888 459
- Bremsbeläge hinten: 34 20 6 888 458

### BMW 3er (F30/F31) 2012-2019
- Bremssattel VL: 34 11 6 850 931
- Bremssattel VR: 34 11 6 850 932
- Bremsscheibe vorne: 34 11 6 792 217
- Bremsbeläge vorne: 34 11 6 850 568

### BMW 5er (G30/G31) 2017+
- Bremsscheibe vorne: 34 11 6 878 876
- Bremsscheibe hinten: 34 21 6 878 878

### VW Golf 5/6 (1K/5K)
- Bremsbeläge vorne: 1K0 698 151 A
- Bremsscheibe vorne: 1K0 615 301 AA
- Bremssattel VL: 1K0 615 123 E

### VW Golf 7 (5G)
- Bremsbeläge vorne: 5Q0 698 151 A
- Bremsscheibe vorne: 5Q0 615 301 B

### Audi A4 (B8/B9)
- Bremsbeläge vorne: 8K0 698 151 J
- Bremsscheibe vorne: 4G0 615 301 AH

### Mercedes C-Klasse (W205)
- Bremsscheibe vorne: A 205 421 10 12
- Bremsbeläge vorne: A 004 420 52 20

### Mercedes E-Klasse (W213)
- Bremsscheibe vorne: A 000 421 11 12
`;

const PART_CATEGORIES = `
## TEILEKATEGORIEN MIT TYPISCHEN OEM-GRUPPEN

### BREMSEN
- Bremssattel (Brake Caliper)
- Bremsscheibe (Brake Disc/Rotor)
- Bremsbeläge (Brake Pads)
- Bremsbacken (Brake Shoes - hinten bei Trommelbremse)
- Bremszylinder (Brake Cylinder)
- Bremsleitung (Brake Line)
- ABS-Sensor (ABS Speed Sensor)

### MOTOR
- Ölfilter (Oil Filter)
- Luftfilter (Air Filter)
- Kraftstofffilter (Fuel Filter)
- Innenraumfilter/Pollenfilter (Cabin Air Filter)
- Zündkerzen (Spark Plugs)
- Zündspule (Ignition Coil)
- Keilrippenriemen (Serpentine Belt)
- Zahnriemen (Timing Belt)
- Wasserpumpe (Water Pump)
- Thermostat (Thermostat)

### FAHRWERK
- Stoßdämpfer (Shock Absorber)
- Federbein (Strut/Spring)
- Querlenker (Control Arm)
- Spurstange (Tie Rod)
- Radlager (Wheel Bearing)
- Achsmanschette (CV Boot)
- Koppelstange (Stabilizer Link)

### ANTRIEB
- Kupplung (Clutch)
- Schwungrad (Flywheel)
- Antriebswelle (Drive Shaft)
- Getriebeöl (Transmission Fluid)

### ELEKTRISCH
- Batterie (Battery)
- Lichtmaschine (Alternator)
- Anlasser (Starter)
- Glühkerzen (Glow Plugs - Diesel)
`;

// ============================================================================
// Main Source Implementation
// ============================================================================

export const llmHeuristicSource: OEMSource = {
  name: "premium_ai_oem_resolver",

  async resolveCandidates(req: OEMResolverRequest): Promise<OEMCandidate[]> {
    const vehicleInfo = formatVehicleInfo(req);
    const partQuery = req.partQuery.rawText;
    const brand = req.vehicle.make?.toUpperCase() || "UNBEKANNT";

    // Build comprehensive prompt
    const systemPrompt = `Du bist ein PREMIUM KFZ-Teilekatalog-Experte mit vollständigem TecDoc und ETKA/ETK Wissen.
Du kennst ALLE OEM-Nummern für europäische und japanische Fahrzeuge.
${OEM_SCHEMA_KNOWLEDGE}
${COMMON_BRAKE_OEMS}
${PART_CATEGORIES}

DEINE AUFGABE:
Du wirst eine Fahrzeug- und Teileanfrage erhalten und musst die EXAKTEN Original-Herstellernummern (OEM) liefern.`;

    const userPrompt = `## ANFRAGE

FAHRZEUG:
${vehicleInfo}

GESUCHTES TEIL:
"${partQuery}"

## AUFGABE

1. Identifiziere das EXAKTE Teil (z.B. "Bremssattel vorne links" → brake caliper front left)
2. Finde die OEM-Nummer für ${brand} mit dem korrekten Schema
3. Bei BMW: Nutze 11-stellige Nummern (XX XX XXX XXX X)
4. Bei VAG: Nutze das XXX XXX XXX A Format
5. Bei Mercedes: Nutze A XXX XXX XX XX Format

## ANTWORT FORMAT

Antworte NUR mit einem JSON-Array. Keine Erklärung vorher oder nachher:

[
  {
    "oem": "34116860264",
    "brand": "BMW",
    "confidence": 0.85,
    "description": "Bremssattel vorne links für G20/G21",
    "position": "front_left",
    "reasoning": "G20 320d xDrive nutzt diese Sattel-Nummer"
  }
]

WICHTIG:
- Gib 1-5 Kandidaten zurück, sortiert nach Confidence (höchste zuerst)
- Confidence 0.7-0.9: Basierend auf Modell und Teil
- Confidence 0.5-0.7: Unsicher, mehrere Varianten möglich
- Lasse die Nummern OHNE Leerzeichen (komprimiert)
- Wenn du unsicher bist, nenne mehrere Kandidaten`;

    try {
      logger.info("[Premium AI OEM] Calling Gemini", {
        brand,
        part: partQuery.substring(0, 50),
      });

      const raw = await generateChatCompletion({
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt }
        ],
        responseFormat: "json_object",
        temperature: 0.2 // Low for consistency
      });

      // Parse JSON response
      const start = raw.indexOf("[");
      const end = raw.lastIndexOf("]");
      if (start === -1 || end === -1) {
        logger.warn("[Premium AI OEM] No JSON array found", { rawPreview: raw.substring(0, 200) });
        return [];
      }

      const parsed = JSON.parse(raw.slice(start, end + 1)) as any[];

      const candidates: OEMCandidate[] = parsed.map(p => ({
        oem: normalizeOem(p.oem, brand),
        brand: p.brand || brand,
        source: this.name,
        confidence: clampConfidence(Number(p.confidence || 0.5)),
        meta: {
          description: p.description,
          position: p.position,
          reasoning: p.reasoning,
          source_type: "ai_inference"
        }
      })).filter(c => c.oem.length >= 5);

      logger.info("[Premium AI OEM] Success", {
        candidateCount: candidates.length,
        topOEM: candidates[0]?.oem,
        topConf: candidates[0]?.confidence,
      });

      logSourceResult(this.name, candidates.length);
      return candidates;

    } catch (err: any) {
      logger.error("[Premium AI OEM] Failed", { error: err?.message });
      return [];
    }
  }
};

// ============================================================================
// Helper Functions
// ============================================================================

function formatVehicleInfo(req: OEMResolverRequest): string {
  const v = req.vehicle;
  const lines: string[] = [];

  if (v.make) lines.push(`Marke: ${v.make}`);
  if (v.model) lines.push(`Modell: ${v.model}`);
  if (v.year) lines.push(`Baujahr: ${v.year}`);
  if (v.vin) lines.push(`VIN: ${v.vin}`);
  if (v.hsn) lines.push(`HSN: ${v.hsn}`);
  if (v.tsn) lines.push(`TSN: ${v.tsn}`);
  if (v.motorcode) lines.push(`Motorcode: ${v.motorcode}`);
  if (v.kw) lines.push(`Leistung: ${v.kw} kW`);
  if (v.prCodes?.length) lines.push(`PR-Codes: ${v.prCodes.join(", ")}`);

  return lines.join("\n") || "Keine Fahrzeugdaten verfügbar";
}

function normalizeOem(oem: string, brand: string): string {
  if (!oem) return "";

  // Remove all spaces and special chars
  let normalized = oem.replace(/[\s.-]/g, "").toUpperCase();

  // Remove common prefixes that aren't part of the OEM
  normalized = normalized.replace(/^(OEM|ORIGINAL|GENUINE)/i, "");

  // BMW: Ensure 11 digits (remove leading zeros if needed)
  if (brand.includes("BMW")) {
    normalized = normalized.replace(/\D/g, ""); // Keep only digits
    if (normalized.length > 11) {
      normalized = normalized.slice(0, 11);
    }
  }

  // VAG: Keep alphanumeric, max 10 chars
  if (["VW", "VOLKSWAGEN", "AUDI", "SEAT", "SKODA", "CUPRA"].some(b => brand.includes(b))) {
    normalized = normalized.replace(/[^A-Z0-9]/g, "");
    if (normalized.length > 10) {
      normalized = normalized.slice(0, 10);
    }
  }

  // Mercedes: Keep format, max 13 chars
  if (brand.includes("MERCEDES") || brand.includes("BENZ")) {
    normalized = normalized.replace(/[^A-Z0-9]/g, "");
    if (normalized.length > 13) {
      normalized = normalized.slice(0, 13);
    }
  }

  return normalized;
}

export default llmHeuristicSource;
