"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.fallbackResolveOem = fallbackResolveOem;
exports.findBestOemForVehicle = findBestOemForVehicle;
exports.demoBmwCase = demoBmwCase;
/**
 * Web-basierter OEM-Finder ohne TecDoc/Apify.
 * Sucht OEMs über mehrere Webseiten und aggregiert das Ergebnis.
 * Unterstützt optional OpenAI für Query-Expansion/Re-Ranking.
 */
const oemScraper_1 = require("./oemScraper");
const OPENAI_MODEL = process.env.OPENAI_MODEL || "gpt-4.1-mini";
const SCRAPE_TIMEOUT_MS = 30000; // Increased for ScraperAPI
const SCRAPER_API_KEY = process.env.SCRAPER_API_KEY;
async function fetchText(url, premium = false) {
    const controller = new AbortController();
    const id = setTimeout(() => controller.abort(), SCRAPE_TIMEOUT_MS);
    try {
        let targetUrl = url;
        if (SCRAPER_API_KEY) {
            // Use ScraperAPI
            const params = new URLSearchParams({
                api_key: SCRAPER_API_KEY,
                url: url,
                // Premium for tough sites (eBay), render for JS heavy sites if needed
                premium: premium ? "true" : "false",
                // country_code: "de" // Optional: Force German IP
            });
            targetUrl = `http://api.scraperapi.com?${params.toString()}`;
        }
        const res = await fetch(targetUrl, {
            signal: controller.signal,
            headers: SCRAPER_API_KEY ? {} : {
                "User-Agent": "Mozilla/5.0 (compatible; OEMFinder/1.0)",
                "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8"
            }
        });
        if (!res.ok) {
            // Log warning but throw to trigger catch/empty return
            console.warn(`[oemWebFinder] HTTP ${res.status} for ${url}`);
            throw new Error(`HTTP ${res.status}`);
        }
        return res.text();
    }
    finally {
        clearTimeout(id);
    }
}
/**
 * Best-effort Fetch with ScraperAPI (premium=true for tough targets)
 */
async function fetchTextWithFallback(url, premium = false) {
    // Direct pass-through to the enhanced fetchText which handles ScraperAPI
    return fetchText(url, premium);
}
async function aiExtractOemsFromHtml(html, ctx) {
    if (!process.env.OPENAI_API_KEY)
        return [];
    const prompt = `HTML-Ausschnitt einer Teile-Suche:\n\n${html.slice(0, 12000)}\n\nFahrzeug: ${JSON.stringify(ctx.vehicle)}\nUser-Query: ${ctx.userQuery}\nExtrahiere OEM-Nummern (OE/OEM/MPN) als JSON-Array strings. Nur OEMs, keine Erklärungen.`;
    try {
        const res = await fetch("https://api.openai.com/v1/chat/completions", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${process.env.OPENAI_API_KEY}`
            },
            // @ts-ignore agent is supported in node-fetch runtime
            agent: proxyAgent,
            body: JSON.stringify({
                model: OPENAI_MODEL,
                messages: [
                    { role: "system", content: "Du extrahierst OEM-Nummern aus HTML." },
                    { role: "user", content: prompt }
                ],
                temperature: 0
            })
        });
        const data = await res.json();
        const txt = data?.choices?.[0]?.message?.content || "";
        const match = txt.match(/\[[\s\S]*\]/);
        if (!match)
            return [];
        const arr = JSON.parse(match[0]);
        return Array.isArray(arr) ? arr.map((v) => (0, oemScraper_1.normalizeOem)(String(v))).filter(Boolean) : [];
    }
    catch {
        return [];
    }
}
// ----------------------------------
// OpenAI-Helfer: Query-Expansion / Re-Ranking
// ----------------------------------
async function openAiSuggestQueries(ctx) {
    if (!process.env.OPENAI_API_KEY)
        return [];
    const prompt = `Fahrzeug: ${JSON.stringify(ctx.vehicle)}\nUser-Query: ${ctx.userQuery}\nGeneriere 2-3 kurze Suchbegriffe für Ersatzteil/OEM-Suche (ohne Sonderzeichen).`;
    try {
        const res = await fetch("https://api.openai.com/v1/chat/completions", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${process.env.OPENAI_API_KEY}`
            },
            body: JSON.stringify({
                model: OPENAI_MODEL,
                messages: [
                    { role: "system", content: "Du generierst kurze Suchbegriffe für Autoteile/OEM-Suche." },
                    { role: "user", content: prompt }
                ],
                temperature: 0.2
            })
        });
        const data = await res.json();
        const txt = data?.choices?.[0]?.message?.content || "";
        return txt
            .split("\n")
            .map((s) => s.replace(/^\-\s*/, "").trim())
            .filter(Boolean)
            .slice(0, 3);
    }
    catch {
        return [];
    }
}
async function openAiRerank(bestOem, candidates, ctx) {
    if (!process.env.OPENAI_API_KEY || !bestOem)
        return bestOem;
    const prompt = `Fahrzeug: ${JSON.stringify(ctx.vehicle)}\nUser-Query: ${ctx.userQuery}\nKandidaten: ${JSON.stringify(candidates)}\nAktuell bester OEM: ${bestOem}\nWähle die passendste OEM für das Fahrzeug/Teil. Antworte nur mit der OEM oder "NONE".`;
    try {
        const res = await fetch("https://api.openai.com/v1/chat/completions", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${process.env.OPENAI_API_KEY}`
            },
            body: JSON.stringify({
                model: OPENAI_MODEL,
                messages: [
                    { role: "system", content: "Du wählst die plausibelste OEM-Nummer aus einer Kandidatenliste." },
                    { role: "user", content: prompt }
                ],
                temperature: 0
            })
        });
        const data = await res.json();
        const txt = (data?.choices?.[0]?.message?.content || "").trim();
        const norm = (0, oemScraper_1.normalizeOem)(txt);
        if (norm && (0, oemScraper_1.looksLikeOem)(norm))
            return norm;
        return bestOem;
    }
    catch {
        return bestOem;
    }
}
// ----------------------------------
// Quellen: 5 echte Seiten (teils als Platzhalter)
// ----------------------------------
async function searchOemOnPartSouq(ctx) {
    try {
        const q = ctx.vehicle.vin
            ? ctx.vehicle.vin
            : [ctx.vehicle.brand, ctx.vehicle.model, ctx.userQuery].filter(Boolean).join(" ");
        const url = `https://partsouq.com/en/search/all?q=${encodeURIComponent(q)}`;
        const html = await fetchTextWithFallback(url);
        if (html.includes("cf-mitigated") || html.includes("challenge-platform"))
            return [];
        let oems = (0, oemScraper_1.extractOemsFromHtml)(html);
        if (!oems.length) {
            oems = await aiExtractOemsFromHtml(html, ctx);
        }
        return oems.map((o) => ({ source: "PartSouq", rawValue: o, normalized: o }));
    }
    catch {
        return [];
    }
}
async function searchOemOnAmayama(ctx) {
    try {
        const q = [ctx.vehicle.brand, ctx.vehicle.model, ctx.userQuery].filter(Boolean).join(" ");
        const url = `https://www.amayama.com/en/search?q=${encodeURIComponent(q)}`;
        const html = await fetchTextWithFallback(url);
        const inlineJson = html.match(/\"part_number\"\\s*:\\s*\"([A-Z0-9\\-\\.]+)\"/gi) || [];
        const extra = inlineJson
            .map((s) => s.replace(/.*\"part_number\"\\s*:\\s*\"/i, "").replace(/\".*/, ""))
            .map((s) => (0, oemScraper_1.normalizeOem)(s))
            .filter(Boolean);
        let oems = [...(0, oemScraper_1.extractOemsFromHtml)(html), ...extra];
        if (!oems.length) {
            oems = await aiExtractOemsFromHtml(html, ctx);
        }
        return oems.map((o) => ({ source: "Amayama", rawValue: o, normalized: o }));
    }
    catch {
        return [];
    }
}
async function searchOemOnAutodocParts(ctx) {
    try {
        const q = [ctx.vehicle.brand, ctx.vehicle.model, ctx.userQuery].filter(Boolean).join(" ");
        const url = `https://www.autodoc.parts/search?keyword=${encodeURIComponent(q)}`;
        const html = await fetchTextWithFallback(url);
        if (html.includes("Just a moment") && html.includes("challenge-platform"))
            return [];
        const jsonMatches = html.match(/\"oeNumbers\"\\s*:\\s*\\[(.*?)\\]/gi) || [];
        const extracted = [];
        jsonMatches.forEach((m) => {
            const parts = m.match(/[A-Z0-9\\-\\.]{5,20}/gi);
            if (parts)
                parts.forEach((p) => extracted.push(p));
        });
        let oems = [...(0, oemScraper_1.extractOemsFromHtml)(html), ...extracted];
        if (!oems.length) {
            oems = await aiExtractOemsFromHtml(html, ctx);
        }
        return oems.map((o) => ({ source: "Autodoc.parts", rawValue: o, normalized: o }));
    }
    catch {
        return [];
    }
}
async function searchOemOnSpareto(ctx) {
    try {
        const q = [ctx.vehicle.brand, ctx.vehicle.model, ctx.userQuery].filter(Boolean).join(" ");
        const url = `https://www.spareto.com/search?q=${encodeURIComponent(q)}`;
        const html = await fetchTextWithFallback(url);
        const ldJson = html.match(/application\/ld\+json">([\s\S]*?)<\/script>/i);
        const extracted = [];
        if (ldJson && ldJson[1]) {
            const mpnMatches = ldJson[1].match(/\"mpn\"\\s*:\\s*\"([A-Z0-9\\-\\.]{5,20})\"/gi) || [];
            mpnMatches.forEach((m) => {
                const v = m.replace(/.*\"mpn\"\\s*:\\s*\"/i, "").replace(/\".*/, "");
                extracted.push(v);
            });
            const skuMatches = ldJson[1].match(/\"sku\"\\s*:\\s*\"([A-Z0-9\\-\\.]{5,20})\"/gi) || [];
            skuMatches.forEach((m) => {
                const v = m.replace(/.*\"sku\"\\s*:\\s*\"/i, "").replace(/\".*/, "");
                extracted.push(v);
            });
        }
        let oems = (0, oemScraper_1.extractOemsFromHtml)(html).concat(extracted.map((e) => (0, oemScraper_1.normalizeOem)(e)).filter(Boolean));
        if (!oems.length) {
            oems = await aiExtractOemsFromHtml(html, ctx);
        }
        return oems.map((o) => ({ source: "Spareto", rawValue: o, normalized: o }));
    }
    catch {
        return [];
    }
}
async function searchOemOnSite5(ctx) {
    try {
        // Beispiel MegaZip; ggf. Login nötig -> nur Struktur als Beispiel
        const q = ctx.vehicle.vin ? ctx.vehicle.vin : [ctx.vehicle.brand, ctx.vehicle.model, ctx.userQuery].filter(Boolean).join(" ");
        const url = `https://www.megazip.net/zapchasti-dlya-avtomobiley?q=${encodeURIComponent(q)}`;
        const html = await fetchTextWithFallback(url);
        let oems = (0, oemScraper_1.extractOemsFromHtml)(html);
        if (!oems.length) {
            oems = await aiExtractOemsFromHtml(html, ctx);
        }
        return oems.map((o) => ({ source: "MegaZip", rawValue: o, normalized: o }));
    }
    catch {
        return [];
    }
}
async function searchOemOn7zap(ctx) {
    try {
        const q = ctx.vehicle.vin ? ctx.vehicle.vin : [ctx.vehicle.brand, ctx.vehicle.model, ctx.userQuery].filter(Boolean).join(" ");
        const url = `https://7zap.com/en/search/?keyword=${encodeURIComponent(q)}`;
        const html = await fetchText(url);
        const oems = (0, oemScraper_1.extractOemsFromHtml)(html);
        return oems.map((o) => ({ source: "7zap", rawValue: o, normalized: o }));
    }
    catch {
        return [];
    }
}
async function searchOemOnDaparto(ctx) {
    try {
        // Daparto allows specific constructed URLs if we have HSN/TSN, but Google Search is often better
        // to land on the specific category page.
        // Strategy: Search via DDG or similar ("site:daparto.de Golf 7 Bremsbeläge hinten")
        // We try a direct search URL which Daparto often redirects to results
        const q = [ctx.vehicle.brand, ctx.vehicle.model, ctx.userQuery].filter(Boolean).join(" ");
        const url = `https://html.duckduckgo.com/html?q=${encodeURIComponent("site:daparto.de " + q)}`;
        const html = await fetchTextWithFallback(url);
        const oems = (0, oemScraper_1.extractOemsFromHtml)(html);
        // AI check on the search result snippet
        const aiOems = await aiExtractOemsFromHtml(html, ctx);
        return [...oems, ...aiOems].map((o) => ({ source: "Daparto_Search", rawValue: o, normalized: o }));
    }
    catch {
        return [];
    }
}
async function searchOemOnMotointegrator(ctx) {
    try {
        const q = [ctx.vehicle.brand, ctx.vehicle.model, ctx.userQuery].filter(Boolean).join(" ");
        const url = `https://www.motointegrator.de/suche/result/?q=${encodeURIComponent(q)}`;
        const html = await fetchTextWithFallback(url);
        // Motointegrator often lists "OE Nummer" in the product details cards
        const oems = (0, oemScraper_1.extractOemsFromHtml)(html);
        const aiOems = await aiExtractOemsFromHtml(html, ctx);
        return [...oems, ...aiOems].map((o) => ({ source: "Motointegrator", rawValue: o, normalized: o }));
    }
    catch {
        return [];
    }
}
async function searchOemOnEbay(ctx) {
    try {
        // eBay Keyword Search
        // Strategy: Use Brand + Model + Part, or just Part number if suspected
        const q = ctx.suspectedNumber
            ? ctx.suspectedNumber
            : [ctx.vehicle.brand, ctx.vehicle.model, ctx.userQuery].filter(Boolean).join(" ");
        const url = `https://www.ebay.de/sch/i.html?_nkw=${encodeURIComponent(q)}&_sacat=0`;
        // eBay needs premium proxy usually
        const html = await fetchTextWithFallback(url, true);
        // eBay often puts MPN in "s-item__details" or title
        // Generic extraction works well for titles (e.g. "Bremsscheibe ATE 12345...")
        const oems = (0, oemScraper_1.extractOemsFromHtml)(html);
        // Optional: AI Refinement if enabled
        const aiOems = await aiExtractOemsFromHtml(html, ctx);
        return [...oems, ...aiOems].map((o) => ({ source: "eBay", rawValue: o, normalized: o }));
    }
    catch (err) {
        // Silent fail for scraper
        return [];
    }
}
// ----------------------------------
// Fallback-Resolver (Platzhalter)
// ----------------------------------
async function fallbackResolveOem(ctx) {
    // KI-gestützter Fallback: Versuche zuerst eine Nummer im Usertext, danach OpenAI-Guess.
    const match = ctx.userQuery.match(/\b(?=.*\d)[A-Z0-9][A-Z0-9\.\-\s]{4,20}[A-Z0-9]\b/i);
    if (match)
        return (0, oemScraper_1.normalizeOem)(match[0]);
    // OpenAI-gestützter Guess basierend auf Fahrzeug + Teilname
    if (process.env.OPENAI_API_KEY) {
        try {
            const prompt = `Fahrzeugdaten:\n${JSON.stringify(ctx.vehicle, null, 2)}\nTeil: ${ctx.userQuery}\n\nGib eine JSON-Antwort: {\"oems\": [\"<OEM1>\", \"<OEM2>\"]}. Keine Erklärungen. OEMs normalisiert (Großbuchstaben, keine Sonderzeichen).`;
            const res = await fetch("https://api.openai.com/v1/chat/completions", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${process.env.OPENAI_API_KEY}`
                },
                body: JSON.stringify({
                    model: OPENAI_MODEL,
                    messages: [
                        { role: "system", content: "Du bist ein Automotive-OEM-Detektor. Antworte strikt mit JSON und plausiblen OEM-Nummern." },
                        { role: "user", content: prompt }
                    ],
                    temperature: 0
                })
            });
            const data = await res.json();
            const txt = data?.choices?.[0]?.message?.content || "";
            let parsed = null;
            try {
                parsed = JSON.parse(txt);
            }
            catch {
                const matchJson = txt.match(/\{[\s\S]*\}/);
                if (matchJson) {
                    try {
                        parsed = JSON.parse(matchJson[0]);
                    }
                    catch {
                        parsed = null;
                    }
                }
            }
            const fromList = Array.isArray(parsed?.oems) ? parsed.oems.map((o) => (0, oemScraper_1.normalizeOem)(o)).find(Boolean) : null;
            if (fromList)
                return fromList;
            // Fallback: direkt erste OEM-artige Zeichenfolge aus dem Text holen
            const regex = /[A-Z0-9][A-Z0-9\.\-\s]{4,20}[A-Z0-9]/gi;
            const plainMatch = txt.match(regex);
            const first = plainMatch
                ?.map((s) => (0, oemScraper_1.normalizeOem)(s))
                .find((n) => n && (0, oemScraper_1.looksLikeOem)(n)) || null;
            if (first)
                return first;
        }
        catch (err) {
            // ignore and fallback
        }
    }
    // Fallback-Synthetic
    if (ctx.vehicle.brand && ctx.vehicle.model) {
        return (0, oemScraper_1.normalizeOem)(`${ctx.vehicle.brand}-${ctx.vehicle.model}-${ctx.userQuery}`.replace(/\s+/g, ""));
    }
    return null;
}
// ----------------------------------
// Aggregation & Auswahl der besten OEM
// ----------------------------------
async function findBestOemForVehicle(ctx, useFallback = true) {
    // Query-Expansion über OpenAI
    const extraQueries = await openAiSuggestQueries(ctx);
    const queryVariants = [ctx.suspectedNumber || undefined, ctx.userQuery, ...extraQueries].filter((v) => typeof v === "string" && v.length > 0);
    const scrapeOnce = async (userQuery) => {
        const subCtx = { ...ctx, userQuery };
        const results = await Promise.allSettled([
            searchOemOnPartSouq(subCtx),
            searchOemOnAmayama(subCtx),
            searchOemOnAutodocParts(subCtx),
            searchOemOnSpareto(subCtx),
            searchOemOn7zap(subCtx),
            searchOemOnSite5(subCtx),
            searchOemOnDaparto(subCtx),
            searchOemOnMotointegrator(subCtx)
        ]);
        const cands = [];
        for (const r of results) {
            if (r.status === "fulfilled")
                cands.push(...r.value);
        }
        return cands;
    };
    let candidates = [];
    for (const q of queryVariants) {
        candidates.push(...(await scrapeOnce(q)));
    }
    // eBay-Specific Search (High Value)
    // We run this separately because it's a key requirement from the user
    if (ctx.userQuery) {
        const ebayCands = await searchOemOnEbay(ctx);
        candidates.push(...ebayCands);
    }
    // Histogramm bauen
    const histogram = {};
    for (const c of candidates) {
        histogram[c.normalized] = (histogram[c.normalized] || 0) + 1;
    }
    let bestOem = null;
    if (candidates.length > 0) {
        const sorted = Object.entries(histogram).sort((a, b) => {
            if (b[1] !== a[1])
                return b[1] - a[1];
            return b[0].length - a[0].length;
        });
        bestOem = sorted[0]?.[0] ?? null;
    }
    // OpenAI-Reranking
    bestOem = await openAiRerank(bestOem, candidates, ctx);
    // Fallback, falls nichts gefunden
    let fallbackUsed = false;
    if (!bestOem && useFallback) {
        const fb = await fallbackResolveOem(ctx);
        if (fb) {
            fallbackUsed = true;
            bestOem = fb;
            candidates.push({ source: "fallback-resolver", rawValue: fb, normalized: fb, score: 1 });
            histogram[fb] = (histogram[fb] || 0) + 1;
        }
    }
    // Rückabsicherung: mit der gefundenen OEM erneut quer suchen
    let confirmationHits = 0;
    const confirmationSources = [];
    if (bestOem) {
        const confirmCands = await scrapeOnce(bestOem);
        confirmCands.forEach((c) => {
            candidates.push(c);
            histogram[c.normalized] = (histogram[c.normalized] || 0) + 1;
            if (c.normalized === bestOem) {
                confirmationHits += 1;
                confirmationSources.push(c.source);
            }
        });
    }
    return { bestOem, candidates, histogram, fallbackUsed, confirmationHits, confirmationSources };
}
// ----------------------------------
// Beispiel: BMW-Testfall
// ----------------------------------
async function demoBmwCase() {
    const ctx = {
        vehicle: {
            brand: "BMW",
            model: "316TI",
            year: 2003,
            vin: "WBAxxxxxxxxxxxxxx",
            hsn: "0005",
            tsn: "742" // Beispiel
        },
        userQuery: "Bremsscheiben vorne"
    };
    const result = await findBestOemForVehicle(ctx);
    console.log("Beste OEM:", result.bestOem);
    console.log("Fallback genutzt:", result.fallbackUsed);
    console.log("Kandidaten:", result.candidates);
}
