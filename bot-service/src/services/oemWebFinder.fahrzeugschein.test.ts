// Integration-style test that uses the sample "fahrzeugschein" vehicle data
// and asserts that the OEM web finder prefers the OEM coming from multiple
// occurrences in scraped HTML over noisy alternatives.

import { findBestOemForVehicle, SearchContext } from "./oemWebFinder";

describe("oemWebFinder with Fahrzeugschein sample", () => {
  const originalFetch = global.fetch;

  // Simulated HTML returned by all sources. Contains multiple occurrences of a
  // BMW spark-plug OEM (12120037607) plus some noise to ensure the histogram
  // logic picks the repeated value.
  const primaryOem = "BMW1212003A";
  const noiseOem = "ABC12X";

  const mockHtml = `
    <html><body>
      ${primaryOem} | ${noiseOem}
    </body></html>
  `;

  const ctx: SearchContext = {
    vehicle: {
      brand: "BMW",
      model: "316TI",
      year: 2001,
      vin: "WBAZZZZZZZZZZZZZZ",
      hsn: "0005",
      tsn: "716"
    },
    userQuery: "Zündkerzen"
  };

  beforeAll(() => {
    // Avoid hitting OpenAI in this test – keep the filters inactive.
    process.env.OPENAI_API_KEY = "";

    // Mock global fetch to always return the same HTML fixture.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    global.fetch = jest.fn(async () => ({
      ok: true,
      status: 200,
      text: async () => mockHtml
    })) as any;
  });

  afterAll(() => {
    global.fetch = originalFetch;
  });

  it("prefers the repeated OEM from scraped HTML", async () => {
    const res = await findBestOemForVehicle(ctx);

    // Log the resolved shape for visibility in CI output.
    // (We assert below to keep the test strict.)
    // eslint-disable-next-line no-console
    console.log("fahrzeugschein sample result", {
      bestOem: res.bestOem,
      histogram: res.histogram,
      fallbackUsed: res.fallbackUsed,
      confirmationHits: res.confirmationHits,
      confirmationSources: res.confirmationSources
    });

    expect(res.bestOem).toBe(primaryOem);
    expect(res.fallbackUsed).toBe(false);
    expect(res.histogram[primaryOem]).toBeGreaterThan(0);
    expect(res.confirmationHits).toBeGreaterThan(0);
  });
});
