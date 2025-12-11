import { ApifyShopSearchSource, defaultExtractOems } from "./apifyShopSearchSourceBase";

export const AutoZoneApifySource = new ApifyShopSearchSource({
  actorId: "lexis-solutions/auto-zone-com",
  shopName: "AutoZone",
  extractOems: defaultExtractOems
});
