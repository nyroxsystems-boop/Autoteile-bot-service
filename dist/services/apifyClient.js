"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ApifyClient = void 0;
const node_fetch_1 = __importDefault(require("node-fetch"));
class ApifyClient {
    options;
    constructor(options) {
        this.options = options;
    }
    normalizeActorIdForUrl(actorId) {
        return actorId.replace(/\//g, "~");
    }
    async runActorDataset(actorId, input) {
        const token = this.options.token;
        const baseUrl = (this.options.baseUrl ?? "https://api.apify.com").replace(/\/+$/, "");
        if (!token) {
            throw new Error("Apify token is required");
        }
        const actorPath = this.normalizeActorIdForUrl(actorId);
        const url = `${baseUrl}/v2/acts/${actorPath}/run-sync-get-dataset-items?token=${encodeURIComponent(token)}`;
        const resp = await (0, node_fetch_1.default)(url, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
            },
            body: JSON.stringify(input ?? {}),
        });
        if (!resp.ok) {
            const text = await resp.text();
            throw new Error(`Apify run failed: ${resp.status} ${resp.statusText} - ${text}`);
        }
        const data = (await resp.json());
        return data ?? [];
    }
}
exports.ApifyClient = ApifyClient;
