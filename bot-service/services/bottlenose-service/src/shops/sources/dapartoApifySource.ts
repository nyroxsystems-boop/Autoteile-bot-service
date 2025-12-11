import { ApifyShopSearchSource, defaultExtractOems } from "./apifyShopSearchSourceBase";

export const DapartoApifySource = new ApifyShopSearchSource({
  actorId: "daparto-shop-search",
  shopName: "Daparto",
  extractOems: defaultExtractOems
});
