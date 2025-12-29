"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
// Helper to load resolver with mocked sources
function runWithSources(sources, fn) {
    jest.resetModules();
    jest.doMock("./sources/cacheSource", () => ({ cacheSource: sources.find((s) => s.name === "cache") }));
    jest.doMock("./sources/tecdocLightSource", () => ({
        tecdocLightSource: sources.find((s) => s.name === "tecdoc_light")
    }));
    jest.doMock("./sources/shopSearchSource", () => ({
        shopSearchSource: sources.find((s) => s.name === "shop_search")
    }));
    jest.doMock("./sources/llmHeuristicSource", () => ({
        llmHeuristicSource: sources.find((s) => s.name === "llm_heuristic")
    }));
    const resolver = require("./oemResolver");
    return fn(resolver.resolveOEM);
}
const baseReq = {
    orderId: "order-1",
    vehicle: { make: "BMW", model: "316ti", year: 2001, vin: "VIN123", kw: 85 },
    partQuery: { rawText: "Zündkerzen", normalizedCategory: "spark_plug" }
};
describe("OEM Resolver orchestration", () => {
    afterEach(() => {
        jest.resetModules();
        jest.clearAllMocks();
    });
    it("happy path with multiple sources agreeing", async () => {
        const sources = [
            { name: "cache", resolveCandidates: async () => [{ oem: "OEM-1", source: "cache", confidence: 0.8 }] },
            { name: "tecdoc_light", resolveCandidates: async () => [{ oem: "OEM-1", source: "tecdoc_light", confidence: 0.7 }] },
            {
                name: "shop_search",
                resolveCandidates: async () => [
                    { oem: "OEM-1", source: "shop_search", confidence: 0.6 },
                    { oem: "OEM-ALT", source: "shop_search", confidence: 0.5 }
                ]
            },
            { name: "llm_heuristic", resolveCandidates: async () => [] }
        ];
        await runWithSources(sources, async (resolveOEM) => {
            const res = await resolveOEM(baseReq);
            expect(res.primaryOEM).toBe("OEM-1");
            expect(res.overallConfidence).toBeGreaterThanOrEqual(0.9);
            const srcJoined = res.candidates.find((c) => c.oem === "OEM-1")?.source || "";
            expect(srcJoined).toMatch(/cache/);
            expect(srcJoined).toMatch(/tecdoc_light/);
            expect(srcJoined).toMatch(/shop_search/);
        });
    });
    it("only TecDoc-Light finds something", async () => {
        const sources = [
            { name: "cache", resolveCandidates: async () => [] },
            { name: "tecdoc_light", resolveCandidates: async () => [{ oem: "OEM-TD", source: "tecdoc_light", confidence: 0.85 }] },
            { name: "shop_search", resolveCandidates: async () => [] },
            { name: "llm_heuristic", resolveCandidates: async () => [] }
        ];
        await runWithSources(sources, async (resolveOEM) => {
            const res = await resolveOEM(baseReq);
            expect(res.primaryOEM).toBe("OEM-TD");
            expect(res.overallConfidence).toBeGreaterThanOrEqual(0.85);
        });
    });
    it("only shop search finds mid confidence OEMs", async () => {
        const sources = [
            { name: "cache", resolveCandidates: async () => [] },
            { name: "tecdoc_light", resolveCandidates: async () => [] },
            {
                name: "shop_search",
                resolveCandidates: async () => [
                    { oem: "OEM-S1", source: "shop_search", confidence: 0.7 },
                    { oem: "OEM-S2", source: "shop_search", confidence: 0.65 }
                ]
            },
            { name: "llm_heuristic", resolveCandidates: async () => [] }
        ];
        await runWithSources(sources, async (resolveOEM) => {
            const res = await resolveOEM(baseReq);
            expect(["OEM-S1", undefined]).toContain(res.primaryOEM);
            expect(res.overallConfidence).toBeGreaterThanOrEqual(0.65);
        });
    });
    it("conflict: distinct OEMs with similar confidence", async () => {
        const sources = [
            { name: "cache", resolveCandidates: async () => [] },
            { name: "tecdoc_light", resolveCandidates: async () => [{ oem: "OEM-A", source: "tecdoc_light", confidence: 0.8 }] },
            { name: "shop_search", resolveCandidates: async () => [{ oem: "OEM-B", source: "shop_search", confidence: 0.8 }] },
            { name: "llm_heuristic", resolveCandidates: async () => [] }
        ];
        await runWithSources(sources, async (resolveOEM) => {
            const res = await resolveOEM(baseReq);
            expect(res.overallConfidence).toBeLessThan(0.9);
            expect(res.notes).toBeDefined();
        });
    });
    it("unclear: no candidates or very low confidence", async () => {
        const sources = [
            { name: "cache", resolveCandidates: async () => [] },
            { name: "tecdoc_light", resolveCandidates: async () => [{ oem: "X", source: "tecdoc_light", confidence: 0.2 }] },
            { name: "shop_search", resolveCandidates: async () => [] },
            { name: "llm_heuristic", resolveCandidates: async () => [] }
        ];
        await runWithSources(sources, async (resolveOEM) => {
            const res = await resolveOEM(baseReq);
            expect(res.primaryOEM).toBeUndefined();
            expect(res.overallConfidence).toBeLessThan(0.7);
            expect(res.notes).toBeDefined();
        });
    });
});
