import { ApifyShopSearchSource, defaultExtractOems } from "./apifyShopSearchSourceBase";

export const RockautoApifySource = new ApifyShopSearchSource({
  actorId: "lexis-solutions/rockauto",
  shopName: "Rockauto",
  extractOems: defaultExtractOems
});
