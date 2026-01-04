import type { OEMSource } from "./baseSource";

export const cacheSource: OEMSource = {
  name: "cacheSource",
  async resolveCandidates() {
    return [];
  }
};
