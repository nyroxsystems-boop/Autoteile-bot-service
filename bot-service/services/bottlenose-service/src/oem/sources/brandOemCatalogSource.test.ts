import { BrandOemCatalogSource } from "./brandOemCatalogSource";

jest.mock("../../integrations/apify/apifyClient", () => {
  const callActor = jest.fn();
  return {
    __esModule: true,
    createApifyClient: jest.fn(() => ({ callActor })),
    callActorMock: callActor
  };
});

const { callActorMock } = require("../../integrations/apify/apifyClient");

describe("BrandOemCatalogSource", () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  it("maps actor results to OEM candidates with high confidence", async () => {
    callActorMock.mockResolvedValue([
      { oem: "123 456", manufacturer: "BMW" },
      { oemNumber: "7890" }
    ]);

    const source = new BrandOemCatalogSource("making-data-meaningful/bmw-parts-catalog", "BMW");
    const res = await source.resolve({
      vehicle: { vin: "VIN123", make: "BMW", model: "316i", year: 2001 },
      query: "Bremsscheiben vorne"
    } as any);

    expect(res).toHaveLength(2);
    expect(res[0].oemNumber).toBe("123456");
    expect(res[0].confidence).toBeGreaterThanOrEqual(0.9);
    expect(res[0].sourceName).toContain("brand-catalog");
  });

  it("returns empty array on actor failure", async () => {
    callActorMock.mockRejectedValue(new Error("404"));
    const source = new BrandOemCatalogSource("missing", "BMW");
    const res = await source.resolve({ vehicle: { make: "BMW" }, query: "Bremsscheiben vorne" } as any);
    expect(res).toEqual([]);
  });
});
