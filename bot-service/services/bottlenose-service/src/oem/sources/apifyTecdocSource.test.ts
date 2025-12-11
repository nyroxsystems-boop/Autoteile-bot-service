import { ApifyTecdocSource } from "./apifyTecdocSource";

jest.mock("../../integrations/apify/apifyClient", () => {
  const callActor = jest.fn();
  return {
    __esModule: true,
    createApifyClient: jest.fn(() => ({ callActor })),
    callActorMock: callActor
  };
});

const { callActorMock } = require("../../integrations/apify/apifyClient");

describe("ApifyTecdocSource", () => {
  const baseInput = {
    vehicle: { vin: "VIN123", brand: "BMW", model: "316ti", year: 2003 },
    query: "front brake pads",
    locale: "de",
    countryCode: "DE"
  };

  afterEach(() => {
    jest.clearAllMocks();
  });

  it("maps TecDoc items with OEMs to candidates with expected confidence", async () => {
    callActorMock.mockResolvedValue([
      {
        oemNumbers: ["12 34 56", "78 90"],
        brand: "BMW",
        articleNumber: "ART1",
        description: "Front brake pads",
        matchedByVin: true
      }
    ]);

    const res = await ApifyTecdocSource.resolve(baseInput);
    expect(res).toHaveLength(2);
    const oem = res.find((c) => c.oemNumber === "123456");
    expect(oem).toBeDefined();
    expect(oem?.confidence).toBeGreaterThanOrEqual(0.65);
    expect(oem?.confidence).toBeLessThanOrEqual(0.75);
    expect(res.every((c) => c.sourceName === "apify:tecdoc")).toBe(true);
  });

  it("returns empty array when no OEM numbers are present", async () => {
    callActorMock.mockResolvedValue([
      { oemNumbers: [], description: "no oem here" },
      { description: "also empty" }
    ]);

    const res = await ApifyTecdocSource.resolve(baseInput);
    expect(res).toEqual([]);
  });
});
