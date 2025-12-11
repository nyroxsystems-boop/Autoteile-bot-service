import crypto from "crypto";
import { OemResolutionInput } from "../sources/apifyPartNumberCrossRefSource";

function normalizeString(value: string | undefined | null): string {
  return (value || "").toString().trim().toLowerCase();
}

function deriveVehicleId(input: OemResolutionInput): string {
  const v = input.vehicle || {};
  if (v.vin) return normalizeString(v.vin);

  const brand = normalizeString((v as any).brand || (v as any).make);
  const model = normalizeString((v as any).model);
  const engineCode = normalizeString((v as any).engineCode);
  const year = v.year ? String(v.year) : "";

  return [brand, model, engineCode, year].filter(Boolean).join("|");
}

export function buildOemCacheKey(input: OemResolutionInput): string {
  const vehicleId = deriveVehicleId(input);
  const partQuery = normalizeString((input as any).query);
  const keyPayload = `${vehicleId}::${partQuery}`;
  return crypto.createHash("sha256").update(keyPayload).digest("hex");
}
