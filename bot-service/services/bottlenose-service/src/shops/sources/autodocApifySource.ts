import { ApifyShopSearchSource, defaultExtractOems } from "./apifyShopSearchSourceBase";

export const AutodocApifySource = new ApifyShopSearchSource({
  actorId: "autodoc-shop-search",
  shopName: "Autodoc",
  extractOems: defaultExtractOems
});
