import { TecDocVehicleLookup } from "./tecdocClient";

export function determineRequiredFields(vehicle: TecDocVehicleLookup): string[] {
  const required: string[] = [];

  if (!vehicle.make) required.push("make");
  if (!vehicle.model) required.push("model");
  if (!vehicle.year) required.push("year");

  const hasIdentifier = Boolean(vehicle.vin) || (Boolean(vehicle.hsn) && Boolean(vehicle.tsn));
  const hasPowerHint = vehicle.engineKw !== undefined && vehicle.engineKw !== null;

  // Engine is only required if we have no VIN/HSN+TSN and no power hint at all
  if (!hasIdentifier && !hasPowerHint && !vehicle.engine) {
    required.push("engine");
  }

  return required;
}
