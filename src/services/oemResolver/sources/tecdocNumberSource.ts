import type { OEMSource } from "./baseSource";

export const tecdocNumberSource: OEMSource = {
  name: "tecdocNumberSource",
  async resolveCandidates() {
    return [];
  }
};
