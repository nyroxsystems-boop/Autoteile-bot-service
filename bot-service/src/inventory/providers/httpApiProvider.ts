import axios, { AxiosInstance } from "axios";
import BaseInventoryProvider, {
  InventoryProviderConnection,
  NormalizedInventoryResult
} from "./baseInventoryProvider";
import { ProviderTypes } from "../providerTypes";

type AuthConfig = {
  authType?: "api_key_header" | "basic";
  headerName?: string;
  apiKey?: string;
  username?: string;
  password?: string;
};

type ResponseMapping = {
  oemField?: string;
  internalPartIdField?: string;
  internalSkuField?: string;
  titleField?: string;
  brandField?: string;
  modelField?: string;
  priceField?: string;
  currencyField?: string;
  quantityField?: string;
  deliveryTimeField?: string;
};

type HttpProviderConfig = {
  oemEndpoint?: string;
  oemParamStyle?: "path" | "query";
  oemQueryParamName?: string;
  responseMapping?: ResponseMapping;
};

export default class HttpApiProvider extends BaseInventoryProvider {
  authConfig: AuthConfig;
  config: HttpProviderConfig;

  constructor(connection: InventoryProviderConnection) {
    super(connection);
    this.type = ProviderTypes.HTTP_API;
    this.baseUrl = connection.baseUrl || "";
    this.authConfig = (connection.authConfig as AuthConfig) || {};
    this.config = (connection.config as HttpProviderConfig) || {};
  }

  private createHttpClient(): AxiosInstance {
    const headers: Record<string, string> = {};
    const authType = this.authConfig?.authType;

    if (authType === "api_key_header") {
      const headerName = this.authConfig?.headerName || "X-API-Key";
      const apiKey = this.authConfig?.apiKey || "";
      if (apiKey) headers[headerName] = apiKey;
    }

    const axiosConfig: any = {
      baseURL: this.baseUrl,
      headers
    };

    if (authType === "basic" && this.authConfig?.username && this.authConfig?.password) {
      axiosConfig.auth = {
        username: this.authConfig.username,
        password: this.authConfig.password
      };
    }

    return axios.create(axiosConfig);
  }

  private buildUrl(oemNumber: string): string {
    const endpointTemplate = this.config?.oemEndpoint || "/inventory/by-oem/:oem";
    const style = this.config?.oemParamStyle || "path";
    const queryName = this.config?.oemQueryParamName || "oemNumber";

    if (style === "query") {
      const joiner = endpointTemplate.includes("?") ? "&" : "?";
      return `${endpointTemplate}${joiner}${encodeURIComponent(queryName)}=${encodeURIComponent(oemNumber)}`;
    }
    return endpointTemplate.replace(":oem", encodeURIComponent(oemNumber));
  }

  private pickFirst(item: any, fields: Array<string | undefined>): any {
    for (const f of fields) {
      if (!f) continue;
      if (item && Object.prototype.hasOwnProperty.call(item, f)) {
        return item[f];
      }
    }
    return undefined;
  }

  private toNumber(value: any): number | null {
    const n = typeof value === "string" ? Number(value) : value;
    return typeof n === "number" && !Number.isNaN(n) ? n : null;
  }

  async checkAvailabilityByOem(oemNumber: string): Promise<NormalizedInventoryResult[]> {
    try {
      const client = this.createHttpClient();
      const url = this.buildUrl(oemNumber);
      const response = await client.get(url);
      const data = response.data;

      const mapping = this.config?.responseMapping || {};
      const payload: any[] = Array.isArray(data?.results)
        ? data.results
        : Array.isArray(data)
        ? data
        : data
        ? [data]
        : [];

      return payload.map((item: any): NormalizedInventoryResult => {
        const price = this.toNumber(
          this.pickFirst(item, [mapping.priceField, "price", "unitPrice", "amount"])
        );
        const availableQuantity = this.toNumber(
          this.pickFirst(item, [mapping.quantityField, "availableQuantity", "stock", "qty", "quantity"])
        );

        return {
          systemId: this.id,
          systemName: this.name,
          providerType: this.type,
          oemNumber:
            this.pickFirst(item, [mapping.oemField, "oemNumber", "oem", "partNumber"]) ?? oemNumber,
          internalPartId: this.pickFirst(item, [mapping.internalPartIdField, "id", "partId"]) ?? null,
          internalSku: this.pickFirst(item, [mapping.internalSkuField, "sku", "internalSku"]) ?? null,
          title: this.pickFirst(item, [mapping.titleField, "title", "name", "description"]) ?? null,
          brand: this.pickFirst(item, [mapping.brandField, "brand", "make"]) ?? null,
          model: this.pickFirst(item, [mapping.modelField, "model"]) ?? null,
          price,
          currency: this.pickFirst(item, [mapping.currencyField, "currency"]) ?? null,
          availableQuantity,
          deliveryTime:
            this.pickFirst(item, [mapping.deliveryTimeField, "deliveryTime", "eta", "availability"]) ??
            null,
          sourceRaw: item
        };
      });
    } catch (error: any) {
      console.error("[HttpApiProvider] error", error?.message ?? error);
      return [];
    }
  }
}
