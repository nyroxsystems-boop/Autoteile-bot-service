"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.createProviderForConnection = createProviderForConnection;
exports.getAllProviders = getAllProviders;
exports.invalidateProvidersCache = invalidateProvidersCache;
const providerTypes_1 = require("./providerTypes");
const demoWwsProvider_1 = __importDefault(require("./providers/demoWwsProvider"));
const httpApiProvider_1 = __importDefault(require("./providers/httpApiProvider"));
const scraperProvider_1 = __importDefault(require("./providers/scraperProvider"));
const wwsConnectionModel = __importStar(require("../models/wwsConnectionModel"));
let providersCache = null;
function createProviderForConnection(connection) {
    switch (connection.type) {
        case providerTypes_1.ProviderTypes.DEMO_WWS:
            return new demoWwsProvider_1.default(connection);
        case providerTypes_1.ProviderTypes.HTTP_API:
            return new httpApiProvider_1.default(connection);
        case providerTypes_1.ProviderTypes.SCRAPER:
            return new scraperProvider_1.default(connection);
        default:
            console.warn("Unknown provider type", connection.type);
            return null;
    }
}
function getAllProviders() {
    if (!providersCache) {
        const connections = wwsConnectionModel.getAllActiveConnections();
        providersCache = connections.map(createProviderForConnection).filter(Boolean);
    }
    return providersCache;
}
function invalidateProvidersCache() {
    providersCache = null;
}
