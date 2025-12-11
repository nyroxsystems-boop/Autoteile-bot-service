import { ApifyShopSearchSource, defaultExtractOems } from "./apifyShopSearchSourceBase";

export const OreillyApifySource = new ApifyShopSearchSource({
  actorId: "lexis-solutions/oreillyauto",
  shopName: "OReillyAuto",
  extractOems: defaultExtractOems
});
