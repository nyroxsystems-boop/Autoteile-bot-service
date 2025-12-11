export const ProviderTypes = {
  DEMO_WWS: "demo_wws",
  HTTP_API: "http_api",
  SCRAPER: "scraper"
} as const;

export type ProviderType = (typeof ProviderTypes)[keyof typeof ProviderTypes];
