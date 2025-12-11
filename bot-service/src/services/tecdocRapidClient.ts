import fetch, { RequestInit } from "node-fetch";

export interface ModelsListResponse {
  data?: Array<{
    modelId?: number;
    modelName?: string;
    modelSeriesId?: number;
    constructionType?: string;
    yearFrom?: number;
    yearTo?: number;
  }>;
  [key: string]: any;
}

export interface ModelDetailsResponse {
  data?: {
    modelId?: number;
    modelName?: string;
    constructionType?: string;
    yearFrom?: number;
    yearTo?: number;
    manufacturerId?: number;
    typeId?: number;
  };
  [key: string]: any;
}

export interface CommodityGroupSearchResponse {
  data?: Array<{
    assemblyGroupNodeId?: number;
    name?: string;
    parentNodeId?: number;
  }>;
  [key: string]: any;
}

export interface SearchAllEqualOemNoResponse {
  data?: any[];
  articleDirectSearchResults?: any[];
  [key: string]: any;
}

export interface SelectOemPartsResponse {
  data?: any[];
  [key: string]: any;
}

export interface SearchPassengerCarByLtnResponse {
  data?: any[];
  [key: string]: any;
}

export interface VinDecodeResponse {
  data?: any[];
  [key: string]: any;
}

export interface VehicleCategoriesResponse {
  data?: any[];
  [key: string]: any;
}

export interface VehicleArticlesResponse {
  data?: any[];
  [key: string]: any;
}

function buildPath(template: string, params: Record<string, string | number>): string {
  return template.replace(/{(\w+)}/g, (_, key) => {
    const value = params[key];
    if (value === undefined || value === null) {
      throw new Error(`Missing path param ${key} for template ${template}`);
    }
    return encodeURIComponent(String(value));
  });
}

export class TecDocClient {
  private readonly baseUrl: string;
  private readonly apiKey: string;
  private readonly apiHost: string;

  constructor(config?: { baseUrl?: string; apiKey?: string; apiHost?: string }) {
    this.baseUrl = (config?.baseUrl || "https://tecdoc-catalog.p.rapidapi.com").replace(/\/+$/, "");
    this.apiKey = config?.apiKey || process.env.RAPIDAPI_KEY || "";
    this.apiHost = config?.apiHost || process.env.RAPIDAPI_HOST || "tecdoc-catalog.p.rapidapi.com";
    if (!this.apiKey) {
      throw new Error("TecDocClient requires RAPIDAPI_KEY (apiKey)");
    }
  }

  private async request(path: string, options: RequestInit = {}) {
    const url = `${this.baseUrl}${path}`;
    const headers = {
      Accept: "application/json",
      "x-rapidapi-key": this.apiKey,
      "x-rapidapi-host": this.apiHost,
      ...(options.headers || {})
    };

    const res = await fetch(url, { ...options, headers });
    if (!res.ok) {
      const text = await res.text();
      throw new Error(`TecDoc Rapid error ${res.status}: ${text}`);
    }
    return res.json();
  }

  async listModelsByTypeAndManufacturer(
    typeId: string,
    manufacturerId: string,
    langId: string,
    countryFilterId: string
  ): Promise<ModelsListResponse> {
    const path = buildPath(
      "/models/list/type-id/{typeId}/manufacturer-id/{manufacturerId}/lang-id/{langId}/country-filter-id/{countryFilterId}",
      { typeId, manufacturerId, langId, countryFilterId }
    );
    return this.request(path);
  }

  async getModelByType(
    typeId: string,
    modelId: string,
    langId: string,
    countryFilterId: string
  ): Promise<ModelDetailsResponse> {
    const path = buildPath(
      "/models/type-id/{typeId}/model-id/{modelId}/lang-id/{langId}/country-filter-id/{countryFilterId}",
      { typeId, modelId, langId, countryFilterId }
    );
    return this.request(path);
  }

  async searchCommodityGroupsByDescription(
    typeId: string,
    langId: string,
    searchText: string
  ): Promise<CommodityGroupSearchResponse> {
    const path = buildPath(
      "/category/search-for-the-commodity-group-tree-by-description/type-id/{typeId}/lang-id/{langId}/search-text/{searchText}",
      { typeId, langId, searchText }
    );
    return this.request(path);
  }

  async searchAllEqualOemNo(langId: string, articleOemNo: string): Promise<SearchAllEqualOemNoResponse> {
    const path = buildPath(
      "/articles-oem/search-all-equal-oem-no/lang-id/{langId}/article-oem-no/{articleOemNo}",
      { langId, articleOemNo }
    );
    return this.request(path);
  }

  async selectOemPartsByVehicleAndDescription(
    typeId: string,
    vehicleId: string,
    langId: string,
    searchParam: string
  ): Promise<SelectOemPartsResponse> {
    const path = buildPath(
      "/articles-oem/selecting-oem-parts-vehicle-modification-description-product-group/type-id/{typeId}/vehicle-id/{vehicleId}/lang-id/{langId}/search-param/{searchParam}",
      { typeId, vehicleId, langId, searchParam }
    );
    return this.request(path);
  }

  async searchPassengerCarByLtnNumber(
    langId: string,
    countryFilterId: string,
    ltnNumber: string,
    numberType: string
  ): Promise<SearchPassengerCarByLtnResponse> {
    const path = buildPath(
      "/types/searching-the-passenger-car-by-ltn-number/lang-id/{langId}/country-filter-id/{countryFilterId}/ltn-number/{ltnNumber}/number-type/{numberType}",
      { langId, countryFilterId, ltnNumber, numberType }
    );
    return this.request(path);
  }

  async listCategoriesForVehicle(
    typeId: string,
    vehicleId: string,
    langId: string,
    variant: 1 | 2 | 3 = 1
  ): Promise<VehicleCategoriesResponse> {
    const path = `/category/type-id/${typeId}/products-groups-variant-${variant}/${vehicleId}/lang-id/${langId}`;
    return this.request(path);
  }

  async listArticlesForVehicleCategory(
    typeId: string,
    vehicleId: string,
    categoryId: string,
    langId: string
  ): Promise<VehicleArticlesResponse> {
    const path = `/articles/list/type-id/${typeId}/vehicle-id/${vehicleId}/category-id/${categoryId}/lang-id/${langId}`;
    return this.request(path);
  }

  async decodeVin(vin: string, variant: "v1" | "v2" | "v3" = "v3"): Promise<VinDecodeResponse> {
    const path = `/vin/decoder-${variant}/${encodeURIComponent(vin)}`;
    return this.request(path);
  }
}

// Usage example:
// const client = new TecDocClient();
// client
//   .listModelsByTypeAndManufacturer("1", "5", "4", "63")
//   .then((res) => console.log(res))
//   .catch((err) => console.error(err));
