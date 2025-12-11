import { ApifyShopSearchSource, defaultExtractOems } from "./apifyShopSearchSourceBase";

export const MisterAutoApifySource = new ApifyShopSearchSource({
  actorId: "mister-auto-shop-search",
  shopName: "Mister-Auto",
  extractOems: defaultExtractOems
});
