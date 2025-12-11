import { AutodocApifySource } from "./autodocApifySource";
import { DapartoApifySource } from "./dapartoApifySource";
import { MisterAutoApifySource } from "./misterAutoApifySource";

jest.mock("../../integrations/apify/apifyClient", () => {
  const callActor = jest.fn();
  return {
    __esModule: true,
    createApifyClient: jest.fn(() => ({ callActor })),
    callActorMock: callActor
  };
});

const { callActorMock } = require("../../integrations/apify/apifyClient");

describe("Apify shop search sources", () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  it("maps Autodoc products and normalizes OEMs", async () => {
    callActorMock.mockResolvedValue([
      {
        id: "p1",
        title: "Autodoc Brake Pad",
        oemNumbers: ["OE 12 34 56", "78/90"],
        price: "49,90",
        currency: "EUR"
      }
    ]);

    const res = await AutodocApifySource.search({ query: "brake pads", locale: "de", countryCode: "DE" });
    expect(res).toHaveLength(1);
    expect(res[0].shopName).toBe("Autodoc");
    expect(res[0].oemNumbers).toEqual(expect.arrayContaining(["123456", "78", "90"]));
    expect(res[0].price).toBeCloseTo(49.9);
  });

  it("maps Daparto products with reference numbers", async () => {
    callActorMock.mockResolvedValue([
      {
        id: "d1",
        name: "Daparto Oil Filter",
        referenceNumbers: ["abc 123", "def-456"],
        price: 15.5,
        currency: "EUR"
      }
    ]);

    const res = await DapartoApifySource.search({ query: "oil filter" });
    expect(res[0].shopName).toBe("Daparto");
    expect(res[0].oemNumbers).toEqual(expect.arrayContaining(["ABC123", "DEF456"]));
  });

  it("maps Mister-Auto products using attribute OE fields", async () => {
    callActorMock.mockResolvedValue([
      {
        id: "m1",
        description: "Mister Auto Spark Plug",
        attributes: [{ name: "For OE number", value: "12 34 56; 65 43 21" }]
      }
    ]);

    const res = await MisterAutoApifySource.search({ query: "spark plug" });
    expect(res[0].shopName).toBe("Mister-Auto");
    expect(res[0].oemNumbers).toEqual(expect.arrayContaining(["123456", "654321"]));
  });

  it("returns empty when actor yields no items", async () => {
    callActorMock.mockResolvedValue([]);
    const res = await AutodocApifySource.search({ query: "nonexistent" });
    expect(res).toEqual([]);
  });
});
