import { refineOemCandidatesWithLlm } from "./refineOemCandidatesWithLlm";

jest.mock("../../llm/openAiClient", () => {
  const chat = jest.fn();
  return {
    __esModule: true,
    createOpenAiClient: jest.fn(() => ({ chat })),
    chatMock: chat
  };
});

const { chatMock } = require("../../llm/openAiClient");

describe("refineOemCandidatesWithLlm", () => {
  const input = {
    vehicle: { brand: "BMW", model: "316ti", year: 2003 },
    query: "spark plugs"
  } as any;

  afterEach(() => {
    jest.clearAllMocks();
    delete process.env.ENABLE_OEM_LLM_VALIDATION;
  });

  it("re-ranks candidates using LLM scores", async () => {
    chatMock.mockResolvedValue(`
      { "candidates": [
        { "oem": "OEM1", "score": 0.6 },
        { "oem": "OEM2", "score": 0.95 }
      ]}
    `);

    const candidates = [
      { oem: "OEM1", finalConfidence: 0.8, sources: ["s1"], rawCandidates: [], maxConfidence: 0.8, avgConfidence: 0.8 },
      { oem: "OEM2", finalConfidence: 0.75, sources: ["s2"], rawCandidates: [], maxConfidence: 0.75, avgConfidence: 0.75 }
    ];

    const refined = await refineOemCandidatesWithLlm(input, candidates);
    expect(refined[0].oem).toBe("OEM2");
    // combined 0.5*(0.75)+0.5*(0.95)=0.85
    expect(refined[0].finalConfidence).toBeGreaterThan(refined[1].finalConfidence);
  });

  it("falls back to original confidences on invalid JSON", async () => {
    chatMock.mockResolvedValue("not a json");
    const candidates = [
      { oem: "OEM1", finalConfidence: 0.8, sources: ["s1"], rawCandidates: [], maxConfidence: 0.8, avgConfidence: 0.8 }
    ];
    const refined = await refineOemCandidatesWithLlm(input, candidates);
    expect(refined[0].finalConfidence).toBe(0.8);
  });
});
