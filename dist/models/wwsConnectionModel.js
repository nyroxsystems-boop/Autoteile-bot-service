"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getAllConnections = getAllConnections;
exports.getAllActiveConnections = getAllActiveConnections;
exports.getConnectionById = getConnectionById;
exports.createConnection = createConnection;
exports.updateConnection = updateConnection;
exports.deleteConnection = deleteConnection;
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
const dataPath = path_1.default.join(process.cwd(), "src", "data", "wwsConnections.json");
function ensureFile() {
    fs_1.default.mkdirSync(path_1.default.dirname(dataPath), { recursive: true });
    if (!fs_1.default.existsSync(dataPath)) {
        fs_1.default.writeFileSync(dataPath, JSON.stringify([
            {
                id: "demo-local-1",
                name: "Demo-WWS Lokal",
                type: "demo_wws",
                baseUrl: "http://localhost:4000",
                isActive: true,
                authConfig: null,
                config: null
            }
        ], null, 2), "utf-8");
    }
}
function loadAll() {
    ensureFile();
    try {
        const raw = fs_1.default.readFileSync(dataPath, "utf-8");
        return JSON.parse(raw);
    }
    catch (err) {
        console.error("Failed to load wwsConnections.json", err);
        return [];
    }
}
function saveAll(connections) {
    try {
        fs_1.default.writeFileSync(dataPath, JSON.stringify(connections, null, 2), "utf-8");
    }
    catch (err) {
        console.error("Failed to save wwsConnections.json", err);
    }
}
function getAllConnections() {
    return loadAll();
}
function getAllActiveConnections() {
    return loadAll().filter((c) => c.isActive !== false);
}
function getConnectionById(id) {
    return loadAll().find((c) => c.id === id);
}
function createConnection(data) {
    const connections = loadAll();
    const newConnection = {
        id: data.id || `wws-${Date.now()}`,
        name: data.name,
        type: data.type,
        baseUrl: data.baseUrl || "",
        isActive: data.isActive !== false,
        authConfig: data.authConfig ?? null,
        config: data.config ?? null
    };
    connections.push(newConnection);
    saveAll(connections);
    return newConnection;
}
function updateConnection(id, updates) {
    const connections = loadAll();
    const idx = connections.findIndex((c) => c.id === id);
    if (idx === -1)
        return null;
    const updated = { ...connections[idx], ...updates, id };
    connections[idx] = updated;
    saveAll(connections);
    return updated;
}
function deleteConnection(id) {
    const connections = loadAll();
    const next = connections.filter((c) => c.id !== id);
    if (next.length === connections.length)
        return false;
    saveAll(next);
    return true;
}
