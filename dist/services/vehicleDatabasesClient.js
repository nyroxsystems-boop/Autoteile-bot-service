"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.VehicleDatabasesClient = void 0;
const node_fetch_1 = __importDefault(require("node-fetch"));
class VehicleDatabasesClient {
    constructor(config) {
        this.baseUrl = (config?.baseUrl || "https://api.vehicledatabases.com").replace(/\/+$/, "");
        this.authKey = config?.authKey || process.env.VEHICLEDATABASES_AUTH_KEY || process.env.VEHICLEDATA_API_KEY || process.env.API_KEY || "";
        if (!this.authKey) {
            throw new Error("VehicleDatabasesClient requires an auth key (VEHICLEDATABASES_AUTH_KEY / VEHICLEDATA_API_KEY)");
        }
    }
    async request(path) {
        const url = `${this.baseUrl}${path}`;
        const res = await (0, node_fetch_1.default)(url, {
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
    async getVehicleHistory(vin) {
        const safeVin = encodeURIComponent(vin);
        return this.request(`/vehicle-history/${safeVin}`);
    }
}
exports.VehicleDatabasesClient = VehicleDatabasesClient;
// Usage example (commented):
// const client = new VehicleDatabasesClient();
// client.getVehicleHistory("WDBFA68F42F202731").then(console.log).catch(console.error);
