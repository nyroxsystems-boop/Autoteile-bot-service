import { resolveOEM, setOemCacheRepository } from "./resolveOEM";
import { InMemoryOemCacheRepository } from "./cache/inMemoryOemCacheRepository";

jest.mock("./sources/apifyPartNumberCrossRefSource", () => ({
  ApifyPartNumberCrossRefSource: { name: "crossref", resolve: jest.fn() }
}));

jest.mock("./sources/apifyTecdocSource", () => ({
  ApifyTecdocSource: { name: "tecdoc", resolve: jest.fn() }
}));

jest.mock("../shops/sources/autodocApifySource", () => ({
  AutodocApifySource: { name: "Autodoc", search: jest.fn() }
}));

jest.mock("../shops/sources/dapartoApifySource", () => ({
  DapartoApifySource: { name: "Daparto", search: jest.fn() }
}));

jest.mock("../shops/sources/misterAutoApifySource", () => ({
  MisterAutoApifySource: { name: "Mister-Auto", search: jest.fn() }
}));

const { ApifyPartNumberCrossRefSource } = require("./sources/apifyPartNumberCrossRefSource");
const { ApifyTecdocSource } = require("./sources/apifyTecdocSource");
const { AutodocApifySource } = require("../shops/sources/autodocApifySource");
const { DapartoApifySource } = require("../shops/sources/dapartoApifySource");
const { MisterAutoApifySource } = require("../shops/sources/misterAutoApifySource");

describe("resolveOEM aggregation", () => {
  const input = {
    vehicle: { vin: "VIN1", brand: "BMW", model: "316ti", year: 2003 },
    query: "spark plugs",
    locale: "de",
    countryCode: "DE"
  };

  beforeEach(() => {
    jest.clearAllMocks();
    setOemCacheRepository(new InMemoryOemCacheRepository());
  });

  it("boosts confidence when multiple sources agree on same OEM", async () => {
    ApifyPartNumberCrossRefSource.resolve.mockResolvedValue([{ oemNumber: "OE 123 456", sourceName: "crossref", confidence: 0.72 }]);
    ApifyTecdocSource.resolve.mockResolvedValue([{ oemNumber: "123456", sourceName: "tecdoc", confidence: 0.8 }]);
    AutodocApifySource.search.mockResolvedValue([{ id: "p1", oemNumbers: ["123456"], shopName: "Autodoc", title: "Part" }]);
    DapartoApifySource.search.mockResolvedValue([]);
    MisterAutoApifySource.search.mockResolvedValue([]);

    const result = await resolveOEM(input as any);
    expect(result.primaryOem).toBe("123456");
    expect(result.primaryConfidence).toBeGreaterThan(0.8); // boosted above best single source
    const candidate = result.candidates.find((c: any) => c.oem === "123456");
    expect(candidate?.sources).toEqual(expect.arrayContaining(["crossref", "tecdoc", "Autodoc"]));
  });

  it("handles conflicting OEMs but still selects the highest scored", async () => {
    ApifyPartNumberCrossRefSource.resolve.mockResolvedValue([{ oemNumber: "OEM-A", sourceName: "crossref", confidence: 0.82 }]);
    ApifyTecdocSource.resolve.mockResolvedValue([{ oemNumber: "OEM-B", sourceName: "tecdoc", confidence: 0.81 }]);
    AutodocApifySource.search.mockResolvedValue([{ id: "p2", oemNumbers: ["OEM-B"], title: "Prod" }]);
    DapartoApifySource.search.mockResolvedValue([]);
    MisterAutoApifySource.search.mockResolvedValue([]);

    const result = await resolveOEM(input as any);
    expect(result.candidates.map((c: any) => c.oem)).toEqual(expect.arrayContaining(["OEMA", "OEMB"]));
    expect(result.primaryOem).toBe("OEMB");
    expect(result.primaryConfidence).toBeGreaterThan(0.81);
  });

  it("stores result in cache when confident and returns from cache on next call", async () => {
    const repo = new InMemoryOemCacheRepository();
    setOemCacheRepository(repo);

    ApifyPartNumberCrossRefSource.resolve.mockResolvedValue([{ oemNumber: "OE 999", sourceName: "crossref", confidence: 0.92 }]);
    ApifyTecdocSource.resolve.mockResolvedValue([]);
    AutodocApifySource.search.mockResolvedValue([]);
    DapartoApifySource.search.mockResolvedValue([]);
    MisterAutoApifySource.search.mockResolvedValue([]);

    const first = await resolveOEM(input as any);
    expect(first.fromCache).toBeUndefined();
    expect(first.primaryOem).toBe("999");
    expect(first.primaryConfidence).toBeGreaterThanOrEqual(0.92);

    // reset mocks to ensure cache hit bypasses calls
    jest.clearAllMocks();
    const second = await resolveOEM(input as any);
    expect(second.fromCache).toBe(true);
    expect(second.primaryOem).toBe("999");
    expect(second.primaryConfidence).toBeGreaterThan(first.primaryConfidence);
    expect(ApifyPartNumberCrossRefSource.resolve).not.toHaveBeenCalled();
    expect(ApifyTecdocSource.resolve).not.toHaveBeenCalled();
  });
});
