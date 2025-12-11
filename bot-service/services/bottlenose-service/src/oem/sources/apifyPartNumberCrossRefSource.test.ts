import { ApifyPartNumberCrossRefSource } from "./apifyPartNumberCrossRefSource";

jest.mock("../../integrations/apify/apifyClient", () => {
  const callActor = jest.fn();
  return {
    __esModule: true,
    createApifyClient: jest.fn(() => ({ callActor })),
    callActorMock: callActor
  };
});

const { callActorMock } = require("../../integrations/apify/apifyClient");

describe("ApifyPartNumberCrossRefSource", () => {
  const input = {
    vehicle: { make: "BMW", model: "316ti", vin: "VIN123" },
    query: "spark plug",
    oemHint: "12120037560",
    locale: "de",
    countryCode: "DE"
  };

  afterEach(() => {
    jest.clearAllMocks();
  });

  it("maps multiple items and boosts confidence when OEM confirmed", async () => {
    callActorMock.mockResolvedValue([
      { sourceOem: "12120037560", equivalentOem: "12120037560", brand: "BMW", partNumber: "12120037560" },
      { sourceOem: "12120037560", equivalentOem: "12120037560", brand: "BMW", partNumber: "12120037560" },
      { sourceOem: "12120037560", equivalentOem: "12120037560A", brand: "After", partNumber: "12120037560A" }
    ]);

    const res = await ApifyPartNumberCrossRefSource.resolve(input);
    const primary = res.find((c) => c.oemNumber === "12120037560");
    expect(primary).toBeDefined();
    expect(primary?.confidence).toBeGreaterThanOrEqual(0.9);
    expect(res.some((c) => c.oemNumber === "12120037560A")).toBe(true);
  });

  it("returns empty array when actor returns nothing", async () => {
    callActorMock.mockResolvedValue([]);
    const res = await ApifyPartNumberCrossRefSource.resolve({ ...input, oemHint: undefined });
    expect(res).toEqual([]);
  });
});
