import fs from "fs";
import path from "path";
import { ProviderType } from "../inventory/providerTypes";
import { InventoryProviderConnection } from "../inventory/providers/baseInventoryProvider";

const dataPath = path.join(process.cwd(), "src", "data", "wwsConnections.json");

function ensureFile() {
  fs.mkdirSync(path.dirname(dataPath), { recursive: true });
  if (!fs.existsSync(dataPath)) {
    fs.writeFileSync(
      dataPath,
      JSON.stringify(
        [
          {
            id: "demo-local-1",
            name: "Demo-WWS Lokal",
            type: "demo_wws",
            baseUrl: "http://localhost:4000",
            isActive: true,
            authConfig: null,
            config: null
          }
        ],
        null,
        2
      ),
      "utf-8"
    );
  }
}

function loadAll(): InventoryProviderConnection[] {
  ensureFile();
  try {
    const raw = fs.readFileSync(dataPath, "utf-8");
    return JSON.parse(raw);
  } catch (err) {
    console.error("Failed to load wwsConnections.json", err);
    return [];
  }
}

function saveAll(connections: InventoryProviderConnection[]) {
  try {
    fs.writeFileSync(dataPath, JSON.stringify(connections, null, 2), "utf-8");
  } catch (err) {
    console.error("Failed to save wwsConnections.json", err);
  }
}

export function getAllConnections(): InventoryProviderConnection[] {
  return loadAll();
}

export function getAllActiveConnections(): InventoryProviderConnection[] {
  return loadAll().filter((c) => c.isActive !== false);
}

export function getConnectionById(id: string): InventoryProviderConnection | undefined {
  return loadAll().find((c) => c.id === id);
}

export function createConnection(
  data: Partial<InventoryProviderConnection> & { name: string; type: ProviderType | string }
): InventoryProviderConnection {
  const connections = loadAll();
  const newConnection: InventoryProviderConnection = {
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

export function updateConnection(
  id: string,
  updates: Partial<InventoryProviderConnection>
): InventoryProviderConnection | null {
  const connections = loadAll();
  const idx = connections.findIndex((c) => c.id === id);
  if (idx === -1) return null;
  const updated = { ...connections[idx], ...updates, id };
  connections[idx] = updated;
  saveAll(connections);
  return updated;
}

export function deleteConnection(id: string): boolean {
  const connections = loadAll();
  const next = connections.filter((c) => c.id !== id);
  if (next.length === connections.length) return false;
  saveAll(next);
  return true;
}

// Exporting for external usage if needed
export type { InventoryProviderConnection };
