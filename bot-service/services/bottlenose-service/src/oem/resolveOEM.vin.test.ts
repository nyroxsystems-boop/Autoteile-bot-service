import { resolveOEM, setVinDecoder } from "./resolveOEM";
import { setOemCacheRepository } from "./resolveOEM";
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

describe("resolveOEM VIN enrichment", () => {
  const inputBase = {
    vehicle: { vin: "VIN123" },
    query: "spark plugs"
  } as any;

  beforeEach(() => {
    jest.clearAllMocks();
    setOemCacheRepository(new InMemoryOemCacheRepository());
  });

  it("enriches missing vehicle fields via VIN decoder", async () => {
    const fakeVinDecoder = { decode: jest.fn().mockResolvedValue({ vin: "VIN123", brand: "BMW", model: "316ti", engineCode: "N42", year: 2003 }) };
    setVinDecoder(fakeVinDecoder as any);

    ApifyPartNumberCrossRefSource.resolve.mockResolvedValue([{ oemNumber: "OEM1", sourceName: "crossref", confidence: 0.8 }]);
    ApifyTecdocSource.resolve.mockResolvedValue([]);
    AutodocApifySource.search.mockResolvedValue([]);
    DapartoApifySource.search.mockResolvedValue([]);
    MisterAutoApifySource.search.mockResolvedValue([]);

    const res = await resolveOEM(inputBase);
    expect(fakeVinDecoder.decode).toHaveBeenCalledWith("VIN123");
    expect(res.primaryOem).toBe("OEM1");
  });

  it("continues without VIN data when decode fails", async () => {
    const fakeVinDecoder = { decode: jest.fn().mockResolvedValue(null) };
    setVinDecoder(fakeVinDecoder as any);

    ApifyPartNumberCrossRefSource.resolve.mockResolvedValue([{ oemNumber: "OEM1", sourceName: "crossref", confidence: 0.7 }]);
    ApifyTecdocSource.resolve.mockResolvedValue([]);
    AutodocApifySource.search.mockResolvedValue([]);
    DapartoApifySource.search.mockResolvedValue([]);
    MisterAutoApifySource.search.mockResolvedValue([]);

    const res = await resolveOEM(inputBase);
    expect(fakeVinDecoder.decode).toHaveBeenCalled();
    expect(res.primaryOem).toBe("OEM1");
  });
});
