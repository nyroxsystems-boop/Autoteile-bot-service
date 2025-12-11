import { Router, Request, Response } from "express";
import * as wwsConnectionModel from "../models/wwsConnectionModel";
import { invalidateProvidersCache, createProviderForConnection } from "../inventory/providerRegistry";

// Diese Endpoints sollten idealerweise per Auth geschützt werden (Dashboard-Only),
// und sensible authConfig-Daten müssten produktiv verschlüsselt in einer DB liegen.

const router = Router();

router.get("/", (_req: Request, res: Response) => {
  const connections = wwsConnectionModel.getAllConnections();
  res.json(connections);
});

router.post("/", (req: Request, res: Response) => {
  const { name, type, baseUrl, isActive, authConfig, config } = req.body ?? {};
  if (!name || !type) {
    return res.status(400).json({ error: "name and type are required" });
  }
  const connection = wwsConnectionModel.createConnection({ name, type, baseUrl, isActive, authConfig, config });
  invalidateProvidersCache();
  res.status(201).json(connection);
});

router.put("/:id", (req: Request, res: Response) => {
  const { id } = req.params;
  const updated = wwsConnectionModel.updateConnection(id, req.body ?? {});
  if (!updated) {
    return res.status(404).json({ error: "Connection not found" });
  }
  invalidateProvidersCache();
  res.json(updated);
});

router.delete("/:id", (req: Request, res: Response) => {
  const { id } = req.params;
  const ok = wwsConnectionModel.deleteConnection(id);
  if (!ok) {
    return res.status(404).json({ error: "Connection not found" });
  }
  invalidateProvidersCache();
  res.json({ success: true });
});

router.post("/:id/test", async (req: Request, res: Response) => {
  const { id } = req.params;
  const { oemNumber } = req.body ?? {};
  const connection = wwsConnectionModel.getConnectionById(id);
  if (!connection) {
    return res.status(404).json({ error: "Connection not found" });
  }

  const provider = createProviderForConnection(connection);
  if (!provider) {
    return res.status(400).json({ error: "Unsupported provider type" });
  }

  const testOem = oemNumber || connection.config?.testOemNumber || "11428507683";

  try {
    const result = await provider.checkAvailabilityByOem(testOem);
    res.json({
      ok: true,
      sampleResultsCount: Array.isArray(result) ? result.length : 0
    });
  } catch (err: any) {
    console.error("[wwsConnectionsRoutes] test failed", err?.message ?? err);
    res.status(400).json({
      ok: false,
      error: err?.message ?? String(err)
    });
  }
});

export default router;
