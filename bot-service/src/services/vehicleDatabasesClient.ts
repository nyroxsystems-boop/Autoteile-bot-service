import fetch from "node-fetch";

export interface VehicleHistoryResponse {
  data?: any;
  [key: string]: any;
}

export class VehicleDatabasesClient {
  private readonly baseUrl: string;
  private readonly authKey: string;

  constructor(config?: { baseUrl?: string; authKey?: string }) {
    this.baseUrl = (config?.baseUrl || "https://api.vehicledatabases.com").replace(/\/+$/, "");
    this.authKey = config?.authKey || process.env.VEHICLEDATABASES_AUTH_KEY || process.env.VEHICLEDATA_API_KEY || process.env.API_KEY || "";
    if (!this.authKey) {
      throw new Error("VehicleDatabasesClient requires an auth key (VEHICLEDATABASES_AUTH_KEY / VEHICLEDATA_API_KEY)");
    }
  }

  private async request(path: string) {
    const url = `${this.baseUrl}${path}`;
    const res = await fetch(url, {
      method: "GET",
      headers: {
        Accept: "application/json",
        "x-AuthKey": this.authKey
      }
    });

    if (!res.ok) {
      const text = await res.text();
      throw new Error(`VehicleDatabases error ${res.status}: ${text}`);
    }

    return res.json();
  }

  async getVehicleHistory(vin: string): Promise<VehicleHistoryResponse> {
    const safeVin = encodeURIComponent(vin);
    return this.request(`/vehicle-history/${safeVin}`);
  }
}

// Usage example (commented):
// const client = new VehicleDatabasesClient();
// client.getVehicleHistory("WDBFA68F42F202731").then(console.log).catch(console.error);
