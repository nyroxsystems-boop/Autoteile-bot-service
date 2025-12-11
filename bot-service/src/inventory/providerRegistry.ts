import { ProviderTypes } from "./providerTypes";
import DemoWwsProvider from "./providers/demoWwsProvider";
import HttpApiProvider from "./providers/httpApiProvider";
import ScraperProvider from "./providers/scraperProvider";
import {
  InventoryProviderConnection
} from "./providers/baseInventoryProvider";
import * as wwsConnectionModel from "../models/wwsConnectionModel";

let providersCache: Array<any> | null = null;

export function createProviderForConnection(connection: InventoryProviderConnection) {
  switch (connection.type) {
    case ProviderTypes.DEMO_WWS:
      return new DemoWwsProvider(connection);
    case ProviderTypes.HTTP_API:
      return new HttpApiProvider(connection);
    case ProviderTypes.SCRAPER:
      return new ScraperProvider(connection);
    default:
      console.warn("Unknown provider type", connection.type);
      return null;
  }
}

export function getAllProviders() {
  if (!providersCache) {
    const connections = wwsConnectionModel.getAllActiveConnections();
    providersCache = connections.map(createProviderForConnection).filter(Boolean);
  }
  return providersCache;
}

export function invalidateProvidersCache() {
  providersCache = null;
}
