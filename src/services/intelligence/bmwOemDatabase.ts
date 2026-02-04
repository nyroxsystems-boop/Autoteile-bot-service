/**
 * 🚗 BMW OEM DATABASE - Premium Brake/Suspension Parts
 * 
 * Static database of verified BMW OEM numbers for common parts.
 * This enables instant OEM resolution for BMW vehicles without web scraping.
 * 
 * Data sources: BMW ETK, TecDoc, verified dealer sources
 */

import { logger } from "@utils/logger";

// ============================================================================
// BMW Model Series Mapping
// ============================================================================

// Map common model names to BMW chassis codes
const BMW_CHASSIS_MAP: Record<string, string[]> = {
    // 1 Series
    "1er": ["F20", "F21", "F40", "E87", "E88", "E81", "E82"],
    "116": ["F20", "F21", "F40", "E87"],
    "118": ["F20", "F21", "F40", "E87"],
    "120": ["F20", "F21", "F40", "E87", "B47", "B48"],
    "125": ["F20", "F21"],
    "M135": ["F20", "F40"],
    "M140": ["F20", "F21"],

    // 2 Series
    "2er": ["F22", "F23", "F44", "F45", "F46", "G42"],
    "218": ["F44", "F45", "F46"],
    "220": ["F22", "F23", "F44", "G42"],
    "M235": ["F22", "F44"],
    "M240": ["F22", "G42"],

    // 3 Series
    "3er": ["G20", "G21", "F30", "F31", "F34", "E90", "E91", "E92", "E93"],
    "316": ["F30", "E90"],
    "318": ["G20", "F30", "E90", "B47"],
    "320": ["G20", "G21", "F30", "F31", "E90", "E91", "B47", "B48"],
    "320d": ["G20", "G21", "F30", "F31", "E90", "E91", "B47", "N47"],
    "320i": ["G20", "G21", "F30", "F31", "B48"],
    "325": ["G20", "F30", "E90"],
    "328": ["F30", "F31", "E90", "E91", "N20"],
    "330": ["G20", "G21", "F30", "F31", "E90", "E91", "B48", "N55"],
    "335": ["F30", "F31", "E90", "E91", "N55"],
    "340": ["F30", "F31", "G20", "B58"],
    "M340": ["G20", "G21", "B58"],
    "M3": ["G80", "F80", "E90", "S55", "S58"],

    // 4 Series
    "4er": ["G22", "G23", "G26", "F32", "F33", "F36"],
    "420": ["G22", "F32", "B48"],
    "430": ["G22", "G23", "F32", "F33", "B48"],
    "440": ["G22", "G23", "F32", "F33", "B58"],
    "M440": ["G22", "G23", "B58"],
    "M4": ["G82", "G83", "F82", "F83", "S55", "S58"],

    // 5 Series
    "5er": ["G30", "G31", "F10", "F11", "E60", "E61"],
    "520": ["G30", "G31", "F10", "F11", "E60", "B47", "N47"],
    "525": ["G30", "F10", "E60", "N52"],
    "530": ["G30", "G31", "F10", "F11", "E60", "E61", "B48", "N52"],
    "535": ["F10", "F11", "E60", "E61", "N55"],
    "540": ["G30", "G31", "F10", "B58"],
    "M550": ["G30", "G31", "N63"],
    "M5": ["G90", "F90", "F10", "E60", "S63"],

    // X Series
    "X1": ["F48", "E84", "U11"],
    "X2": ["F39"],
    "X3": ["G01", "F25", "E83"],
    "X4": ["G02", "F26"],
    "X5": ["G05", "F15", "E70", "E53"],
    "X6": ["G06", "F16", "E71"],
    "X7": ["G07"],
};

// ============================================================================
// BMW Brake OEM Database
// ============================================================================

interface BMWBrakeOEM {
    oem: string;
    description: string;
    position: "front" | "rear" | "front_left" | "front_right" | "rear_left" | "rear_right";
    type: "caliper" | "disc" | "pad" | "line" | "sensor";
    chassisCodes: string[];
    yearFrom?: number;
    yearTo?: number;
    notes?: string;
}

const BMW_BRAKE_DATABASE: BMWBrakeOEM[] = [
    // =========================================================================
    // G20/G21 3er (2019+) - Bremssättel
    // =========================================================================
    { oem: "34116860264", description: "Bremssattel vorne links", position: "front_left", type: "caliper", chassisCodes: ["G20", "G21"], yearFrom: 2019 },
    { oem: "34116860263", description: "Bremssattel vorne rechts", position: "front_right", type: "caliper", chassisCodes: ["G20", "G21"], yearFrom: 2019 },
    { oem: "34216860253", description: "Bremssattel hinten links", position: "rear_left", type: "caliper", chassisCodes: ["G20", "G21"], yearFrom: 2019 },
    { oem: "34216860254", description: "Bremssattel hinten rechts", position: "rear_right", type: "caliper", chassisCodes: ["G20", "G21"], yearFrom: 2019 },

    // G20/G21 - Bremsscheiben
    { oem: "34116860910", description: "Bremsscheibe vorne (348x36mm)", position: "front", type: "disc", chassisCodes: ["G20", "G21"], yearFrom: 2019 },
    { oem: "34216860912", description: "Bremsscheibe hinten (345x24mm)", position: "rear", type: "disc", chassisCodes: ["G20", "G21"], yearFrom: 2019 },

    // G20/G21 - Bremsbeläge
    { oem: "34106888459", description: "Bremsbeläge vorne", position: "front", type: "pad", chassisCodes: ["G20", "G21"], yearFrom: 2019 },
    { oem: "34206888458", description: "Bremsbeläge hinten", position: "rear", type: "pad", chassisCodes: ["G20", "G21"], yearFrom: 2019 },

    // =========================================================================
    // F30/F31 3er (2012-2019) - Bremssättel
    // =========================================================================
    { oem: "34116850931", description: "Bremssattel vorne links", position: "front_left", type: "caliper", chassisCodes: ["F30", "F31"], yearFrom: 2012, yearTo: 2019 },
    { oem: "34116850932", description: "Bremssattel vorne rechts", position: "front_right", type: "caliper", chassisCodes: ["F30", "F31"], yearFrom: 2012, yearTo: 2019 },
    { oem: "34216850540", description: "Bremssattel hinten links", position: "rear_left", type: "caliper", chassisCodes: ["F30", "F31"], yearFrom: 2012, yearTo: 2019 },
    { oem: "34216850541", description: "Bremssattel hinten rechts", position: "rear_right", type: "caliper", chassisCodes: ["F30", "F31"], yearFrom: 2012, yearTo: 2019 },

    // F30/F31 - Bremsscheiben
    { oem: "34116792217", description: "Bremsscheibe vorne (312x24mm)", position: "front", type: "disc", chassisCodes: ["F30", "F31"], yearFrom: 2012, yearTo: 2019 },
    { oem: "34216792227", description: "Bremsscheibe hinten (300x20mm)", position: "rear", type: "disc", chassisCodes: ["F30", "F31"], yearFrom: 2012, yearTo: 2019 },

    // F30/F31 - Bremsbeläge
    { oem: "34116850568", description: "Bremsbeläge vorne", position: "front", type: "pad", chassisCodes: ["F30", "F31"], yearFrom: 2012, yearTo: 2019 },
    { oem: "34216873093", description: "Bremsbeläge hinten", position: "rear", type: "pad", chassisCodes: ["F30", "F31"], yearFrom: 2012, yearTo: 2019 },

    // =========================================================================
    // E90/E91 3er (2005-2012) - Bremssättel
    // =========================================================================
    { oem: "34116766224", description: "Bremssattel vorne links", position: "front_left", type: "caliper", chassisCodes: ["E90", "E91"], yearFrom: 2005, yearTo: 2012 },
    { oem: "34116766223", description: "Bremssattel vorne rechts", position: "front_right", type: "caliper", chassisCodes: ["E90", "E91"], yearFrom: 2005, yearTo: 2012 },
    { oem: "34216758135", description: "Bremssattel hinten links", position: "rear_left", type: "caliper", chassisCodes: ["E90", "E91"], yearFrom: 2005, yearTo: 2012 },
    { oem: "34216758136", description: "Bremssattel hinten rechts", position: "rear_right", type: "caliper", chassisCodes: ["E90", "E91"], yearFrom: 2005, yearTo: 2012 },

    // E90/E91 - Bremsscheiben
    { oem: "34116855153", description: "Bremsscheibe vorne (300x24mm)", position: "front", type: "disc", chassisCodes: ["E90", "E91"], yearFrom: 2005, yearTo: 2012 },
    { oem: "34216855007", description: "Bremsscheibe hinten (300x20mm)", position: "rear", type: "disc", chassisCodes: ["E90", "E91"], yearFrom: 2005, yearTo: 2012 },

    // =========================================================================
    // G30/G31 5er (2017+) - Bremsen
    // =========================================================================
    { oem: "34116879138", description: "Bremssattel vorne links", position: "front_left", type: "caliper", chassisCodes: ["G30", "G31"], yearFrom: 2017 },
    { oem: "34116879137", description: "Bremssattel vorne rechts", position: "front_right", type: "caliper", chassisCodes: ["G30", "G31"], yearFrom: 2017 },
    { oem: "34216879124", description: "Bremssattel hinten links", position: "rear_left", type: "caliper", chassisCodes: ["G30", "G31"], yearFrom: 2017 },
    { oem: "34216879125", description: "Bremssattel hinten rechts", position: "rear_right", type: "caliper", chassisCodes: ["G30", "G31"], yearFrom: 2017 },
    { oem: "34116878876", description: "Bremsscheibe vorne (348x36mm)", position: "front", type: "disc", chassisCodes: ["G30", "G31"], yearFrom: 2017 },
    { oem: "34216878878", description: "Bremsscheibe hinten (345x24mm)", position: "rear", type: "disc", chassisCodes: ["G30", "G31"], yearFrom: 2017 },

    // =========================================================================
    // X3 G01 (2017+) - Bremsen
    // =========================================================================
    { oem: "34116868938", description: "Bremssattel vorne links", position: "front_left", type: "caliper", chassisCodes: ["G01"], yearFrom: 2017 },
    { oem: "34116868937", description: "Bremssattel vorne rechts", position: "front_right", type: "caliper", chassisCodes: ["G01"], yearFrom: 2017 },
    { oem: "34116860911", description: "Bremsscheibe vorne (348x36mm)", position: "front", type: "disc", chassisCodes: ["G01"], yearFrom: 2017 },
    { oem: "34216860913", description: "Bremsscheibe hinten (330x20mm)", position: "rear", type: "disc", chassisCodes: ["G01"], yearFrom: 2017 },

    // =========================================================================
    // X5 G05 (2018+) - Bremsen
    // =========================================================================
    { oem: "34116879795", description: "Bremssattel vorne links", position: "front_left", type: "caliper", chassisCodes: ["G05"], yearFrom: 2018 },
    { oem: "34116879796", description: "Bremssattel vorne rechts", position: "front_right", type: "caliper", chassisCodes: ["G05"], yearFrom: 2018 },
    { oem: "34116889275", description: "Bremsscheibe vorne (374x36mm)", position: "front", type: "disc", chassisCodes: ["G05"], yearFrom: 2018 },
];

// ============================================================================
// Part Type Detection
// ============================================================================

type BMWPartType = "caliper" | "disc" | "pad" | "line" | "sensor" | null;
type BMWPosition = "front" | "rear" | "front_left" | "front_right" | "rear_left" | "rear_right" | null;

interface PartDetection {
    type: BMWPartType;
    position: BMWPosition;
}

function detectBMWPartType(query: string): PartDetection {
    const q = query.toLowerCase();

    let type: BMWPartType = null;
    let position: BMWPosition = null;

    // Detect type - EXPANDED for German plurals and variations
    if (q.includes("sattel") || q.includes("sättel") || q.includes("caliper") ||
        q.includes("bremssattel") || q.includes("bremssättel") ||
        q.includes("brake caliper") || q.includes("bremsattel")) {
        type = "caliper";
    } else if (q.includes("scheibe") || q.includes("disc") || q.includes("bremsscheibe") ||
        q.includes("scheiben") || q.includes("bremsscheiben") || q.includes("rotor")) {
        type = "disc";
    } else if (q.includes("belag") || q.includes("beläge") || q.includes("pad") ||
        q.includes("bremsbelag") || q.includes("bremsbeläge") || q.includes("pads") ||
        q.includes("klötze") || q.includes("bremsklotz") || q.includes("bremsklötze")) {
        type = "pad";
    } else if (q.includes("leitung") || q.includes("schlauch") || q.includes("line") ||
        q.includes("bremsleitung") || q.includes("bremsleitungen") ||
        q.includes("schläuche") || q.includes("bremsschlauch")) {
        type = "line";
    } else if (q.includes("sensor") || q.includes("verschleiß") || q.includes("warnkontakt") ||
        q.includes("sensoren") || q.includes("verschleissanzeige")) {
        type = "sensor";
    }

    // Detect position
    if (q.includes("vorne links") || q.includes("front left") || q.includes("vl") ||
        q.includes("links vorne") || q.includes("vorn links")) {
        position = "front_left";
    } else if (q.includes("vorne rechts") || q.includes("front right") || q.includes("vr") ||
        q.includes("rechts vorne") || q.includes("vorn rechts")) {
        position = "front_right";
    } else if (q.includes("hinten links") || q.includes("rear left") || q.includes("hl") ||
        q.includes("links hinten")) {
        position = "rear_left";
    } else if (q.includes("hinten rechts") || q.includes("rear right") || q.includes("hr") ||
        q.includes("rechts hinten")) {
        position = "rear_right";
    } else if (q.includes("vorn") || q.includes("front") || q.includes("vorder") || q.includes("va")) {
        position = "front";
    } else if (q.includes("hint") || q.includes("rear") || q.includes("hinter") || q.includes("ha")) {
        position = "rear";
    }

    return { type, position };
}

// ============================================================================
// Chassis Code Detection from Model
// ============================================================================

function detectChassisCode(model: string, year?: number): string[] {
    const m = model.toUpperCase().replace(/[-\s]/g, "");

    // Direct chassis code match
    if (m.startsWith("G20") || m.startsWith("G21")) return ["G20", "G21"];
    if (m.startsWith("F30") || m.startsWith("F31")) return ["F30", "F31"];
    if (m.startsWith("E90") || m.startsWith("E91")) return ["E90", "E91"];
    if (m.startsWith("G30") || m.startsWith("G31")) return ["G30", "G31"];
    if (m.startsWith("G01")) return ["G01"];
    if (m.startsWith("G05")) return ["G05"];

    // Model name match
    for (const [modelKey, chassis] of Object.entries(BMW_CHASSIS_MAP)) {
        if (m.includes(modelKey.toUpperCase().replace(/[-\s]/g, ""))) {
            // Filter by year if provided
            if (year) {
                if (year >= 2019 && chassis.some(c => c.startsWith("G"))) {
                    return chassis.filter(c => c.startsWith("G"));
                } else if (year >= 2012 && year < 2019 && chassis.some(c => c.startsWith("F"))) {
                    return chassis.filter(c => c.startsWith("F"));
                } else if (year < 2012 && chassis.some(c => c.startsWith("E"))) {
                    return chassis.filter(c => c.startsWith("E"));
                }
            }
            return chassis;
        }
    }

    // Year-based fallback for 3er
    if (m.includes("3ER") || m.includes("320") || m.includes("318") || m.includes("330")) {
        if (year && year >= 2019) return ["G20", "G21"];
        if (year && year >= 2012) return ["F30", "F31"];
        if (year) return ["E90", "E91"];
    }

    return [];
}

// ============================================================================
// Main Lookup Function
// ============================================================================

export interface BMWOEMResult {
    found: boolean;
    candidates: Array<{
        oem: string;
        description: string;
        confidence: number;
        source: string;
        position?: string;
    }>;
    chassisDetected?: string[];
    partTypeDetected?: string;
}

export function lookupBMWOEM(
    model: string,
    partQuery: string,
    year?: number
): BMWOEMResult {
    logger.info("[BMW OEM DB] Looking up", { model, partQuery, year });

    // Detect chassis code
    const chassisCodes = detectChassisCode(model, year);
    if (chassisCodes.length === 0) {
        logger.warn("[BMW OEM DB] No chassis code detected", { model });
        return { found: false, candidates: [], chassisDetected: [] };
    }

    // Detect part type
    const { type, position } = detectBMWPartType(partQuery);
    if (!type) {
        logger.warn("[BMW OEM DB] Part type not detected", { partQuery });
        return { found: false, candidates: [], chassisDetected: chassisCodes, partTypeDetected: type || undefined };
    }

    // Find matching OEMs
    const candidates: BMWOEMResult["candidates"] = [];

    for (const entry of BMW_BRAKE_DATABASE) {
        // Must match type
        if (entry.type !== type) continue;

        // Must match at least one chassis code
        const chassisMatch = entry.chassisCodes.some(c => chassisCodes.includes(c));
        if (!chassisMatch) continue;

        // Year filter
        if (year) {
            if (entry.yearFrom && year < entry.yearFrom) continue;
            if (entry.yearTo && year > entry.yearTo) continue;
        }

        // Position filter (if specified)
        let confidence = 0.92;
        if (position) {
            if (position === entry.position) {
                confidence = 0.98; // Exact position match
            } else if (
                (position === "front" && entry.position.startsWith("front")) ||
                (position === "rear" && entry.position.startsWith("rear"))
            ) {
                confidence = 0.95; // General position match
            } else {
                continue; // Position mismatch
            }
        }

        candidates.push({
            oem: entry.oem,
            description: entry.description,
            confidence,
            source: "bmw_oem_database",
            position: entry.position,
        });
    }

    // Sort by confidence
    candidates.sort((a, b) => b.confidence - a.confidence);

    logger.info("[BMW OEM DB] Lookup result", {
        found: candidates.length > 0,
        count: candidates.length,
        chassisCodes,
        type,
        position,
    });

    return {
        found: candidates.length > 0,
        candidates,
        chassisDetected: chassisCodes,
        partTypeDetected: type,
    };
}

// ============================================================================
// Quick Check
// ============================================================================

export function isBMWVehicle(make: string): boolean {
    const m = make.toUpperCase();
    return m === "BMW" || m.includes("BMW");
}

export default {
    lookupBMWOEM,
    isBMWVehicle,
    detectChassisCode,
    BMW_BRAKE_DATABASE,
};
