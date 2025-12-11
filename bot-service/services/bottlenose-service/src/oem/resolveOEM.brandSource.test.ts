import { resolveOEM, setOemCacheRepository, setVinDecoder } from "./resolveOEM";
import { InMemoryOemCacheRepository } from "./cache/inMemoryOemCacheRepository";

jest.mock("./sources/apifyPartNumberCrossRefSource", () => ({
  ApifyPartNumberCrossRefSource: { name: "crossref", resolve: jest.fn().mockResolvedValue([]) }
}));

jest.mock("./sources/apifyTecdocSource", () => ({
  ApifyTecdocSource: { name: "tecdoc", resolve: jest.fn().mockResolvedValue([]) }
}));

jest.mock("./llm/refineOemCandidatesWithLlm", () => ({
  refineOemCandidatesWithLlm: jest.fn((input: any, cands: any) => cands)
}));

jest.mock("../shops/sources/autodocApifySource", () => ({
  AutodocApifySource: { name: "Autodoc", search: jest.fn().mockResolvedValue([]) }
}));
jest.mock("../shops/sources/dapartoApifySource", () => ({
  DapartoApifySource: { name: "Daparto", search: jest.fn().mockResolvedValue([]) }
}));
jest.mock("../shops/sources/misterAutoApifySource", () => ({
  MisterAutoApifySource: { name: "Mister-Auto", search: jest.fn().mockResolvedValue([]) }
}));

jest.mock("./sources/brandOemCatalogSource", () => {
  const mockResolve = jest.fn();
  const BrandOemCatalogSource = jest.fn().mockImplementation(() => ({
    name: "apify:brand-catalog:bmw",
    resolve: mockResolve
  }));
  return {
    __esModule: true,
    BrandOemCatalogSource,
    brandResolveMock: mockResolve
  };
});

const { brandResolveMock, BrandOemCatalogSource } = require("./sources/brandOemCatalogSource");

describe("resolveOEM brand-specific source inclusion", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    setOemCacheRepository(new InMemoryOemCacheRepository());
    setVinDecoder({ decode: jest.fn().mockResolvedValue(null) } as any);
  });

  it("includes brand catalog source when brand is known", async () => {
    brandResolveMock.mockResolvedValue([{ oemNumber: "BMW123", sourceName: "apify:brand-catalog:bmw", confidence: 0.9 }]);
    const res = await resolveOEM({
      vehicle: { brand: "BMW", model: "316i", year: 2001 },
      query: "Bremsscheiben vorne"
    } as any);

    expect(BrandOemCatalogSource).toHaveBeenCalled();
    expect(res.primaryOem).toBe("BMW123");
  });

  it("does not include brand source when brand unknown", async () => {
    const res = await resolveOEM({
      vehicle: { brand: "UNKNOWN", model: "X" },
      query: "Bremsscheiben vorne"
    } as any);
    expect(BrandOemCatalogSource).not.toHaveBeenCalled();
    expect(res.candidates.length).toBe(0);
  });
});
