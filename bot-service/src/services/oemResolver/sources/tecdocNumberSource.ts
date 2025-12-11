import { TecDocClient } from "../../tecdocRapidClient";
import { tecdocApi } from "../../tecdocClient";
import { OEMSource, clampConfidence, logSourceResult } from "./baseSource";
import { OEMCandidate, OEMResolverRequest } from "../types";

// Extract OEM numbers from TecDoc article-like response shapes
function extractOems(payload: any): string[] {
  const out = new Set<string>();
  const add = (val: any) => {
    if (!val) return;
    const norm = String(val).toUpperCase().replace(/[^A-Z0-9]/g, "");
    if (norm) out.add(norm);
  };

  const items: any[] = payload?.articleDirectSearchResults || payload?.data || payload?.results || payload || [];
  for (const it of items) {
    add(it?.articleNumber || it?.articleNo || it?.oemNumber);
    (it?.oeNumbers || it?.oemNumbers || []).forEach((o: any) => add(o?.oeNumber || o?.oemNumber || o));
  }
  return Array.from(out);
}

export const tecdocNumberSource: OEMSource = {
  name: "tecdoc_number",

  async resolveCandidates(req: OEMResolverRequest): Promise<OEMCandidate[]> {
    const out: OEMCandidate[] = [];
    const suspected = req.partQuery.rawText?.match(/[A-Z0-9][A-Z0-9\.\-]{4,}/gi)?.[0] || null;
    if (!suspected) {
      return out;
    }

    try {
      const client = new TecDocClient({
        apiKey: process.env.TECDOC_API_KEY || process.env.RAPIDAPI_KEY,
        apiHost: process.env.TECDOC_RAPIDAPI_HOST || process.env.RAPIDAPI_HOST || "tecdoc-catalog.p.rapidapi.com"
      });

      const langId = "4";
      // Search by article number
      try {
        const res = await client.searchAllEqualOemNo(langId, suspected);
        const oems = extractOems(res);
        for (const oem of oems) {
          out.push({
            oem,
            source: this.name,
            confidence: clampConfidence(0.95),
            meta: { method: "searchAllEqualOemNo", suspected }
          });
        }
      } catch {
        /* ignore */
      }

      // Fallback to article number search via legacy API helper
      try {
        const res2 = await tecdocApi.searchArticlesByNumber({ langId: Number(langId), articleSearchNr: suspected });
        const oems2 = extractOems(res2);
        for (const oem of oems2) {
          out.push({
            oem,
            source: this.name,
            confidence: clampConfidence(0.9),
            meta: { method: "searchArticlesByNumber", suspected }
          });
        }
      } catch {
        /* ignore */
      }

      logSourceResult(this.name, out.length);
      return out;
    } catch (err: any) {
      // eslint-disable-next-line no-console
      console.warn(`[${this.name}] failed:`, err?.message ?? err);
      return out;
    }
  }
};
