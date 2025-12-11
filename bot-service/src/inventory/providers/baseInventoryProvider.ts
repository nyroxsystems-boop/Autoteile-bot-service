import { ProviderType } from "../providerTypes";

export interface InventoryProviderConnection {
  id: string;
  name: string;
  type: ProviderType | string;
  baseUrl?: string;
  isActive?: boolean;
  authConfig?: any;
  config?: any;
}

export interface NormalizedInventoryResult {
  systemId: string;
  systemName: string;
  providerType: ProviderType | string;
  oemNumber: string;
  internalPartId: string | number | null;
  internalSku: string | null;
  title: string | null;
  brand: string | null;
  model: string | null;
  price: number | null;
  currency: string | null;
  availableQuantity: number | null;
  deliveryTime: string | null;
  sourceRaw?: any;
}

export default class BaseInventoryProvider {
  id: string;
  name: string;
  type: ProviderType | string;
  baseUrl: string;
  authConfig: any;
  config: any;

  constructor(connection: InventoryProviderConnection) {
    this.id = connection.id;
    this.name = connection.name;
    this.type = connection.type;
    this.baseUrl = connection.baseUrl ?? "";
    this.authConfig = connection.authConfig ?? null;
    this.config = connection.config ?? null;
  }

  // To be implemented by subclasses.
  async checkAvailabilityByOem(_oemNumber: string): Promise<NormalizedInventoryResult[]> {
    throw new Error("Not implemented");
  }
}
