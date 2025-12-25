import { TecDocVehicleLookup } from "./tecdocClient";

export function determineRequiredFields(vehicle: TecDocVehicleLookup): string[] {
  const required: string[] = [];

  // If we have VIN, we can decode everything else.
  if (vehicle.vin) return [];

  // If we have HSN/TSN, we can often decode, but HSN/TSN is sometimes ambiguous for engine.
  // We'll allow it for now to avoid blocking.
  if (vehicle.hsn && vehicle.tsn) return [];

  if (!vehicle.make) required.push("make");
  if (!vehicle.model) required.push("model");
  if (!vehicle.year) required.push("year");
  if (!vehicle.engine) required.push("engine");

  return required;
}
