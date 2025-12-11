export interface BrandOemActorConfig {
  actorId: string;
  displayName: string;
}

const BRAND_SYNONYMS: Record<string, string> = {
  VW: "VOLKSWAGEN",
  "V.W.": "VOLKSWAGEN",
  MB: "MERCEDES-BENZ",
  MERCEDES: "MERCEDES-BENZ",
  BENZ: "MERCEDES-BENZ",
  BMW: "BMW",
  AUDI: "AUDI",
  SKODA: "SKODA",
  SEAT: "SEAT",
  ASTON: "ASTON MARTIN",
  "ASTON-MARTIN": "ASTON MARTIN",
  ALFA: "ALFA ROMEO",
  "ALFA-ROMEO": "ALFA ROMEO",
  CHEVY: "CHEVROLET",
  CHEVROLET: "CHEVROLET",
  HYUNDAI: "HYUNDAI",
  KIA: "KIA",
  NISSAN: "NISSAN",
  OPEL: "OPEL",
  VAUXHALL: "OPEL",
  RENAULT: "RENAULT",
  PEUGEOT: "PEUGEOT",
  CITROEN: "CITROEN",
  FIAT: "FIAT",
  HONDA: "HONDA",
  FORD: "FORD",
  MAZDA: "MAZDA",
  MITSUBISHI: "MITSUBISHI",
  SUZUKI: "SUZUKI",
  PORSCHE: "PORSCHE",
  FERRARI: "FERRARI",
  LAMBORGHINI: "LAMBORGHINI",
  JAGUAR: "JAGUAR",
  CADILLAC: "CADILLAC",
  MAN: "MAN",
  MG: "MG",
  DACIA: "DACIA",
  TOYOTA: "TOYOTA",
  PONTIAC: "PONTIAC"
};

export const BRAND_OEM_ACTORS: Record<string, BrandOemActorConfig> = {
  BMW: { actorId: "making-data-meaningful/bmw-parts-catalog", displayName: "BMW Parts Catalog" },
  VOLKSWAGEN: { actorId: "making-data-meaningful/volkswagen-parts-catalog", displayName: "Volkswagen Parts Catalog" },
  AUDI: { actorId: "making-data-meaningful/audi-parts-catalog", displayName: "Audi Parts Catalog" },
  "MERCEDES-BENZ": { actorId: "making-data-meaningful/mercedes-benz-parts-catalog", displayName: "Mercedes-Benz Parts Catalog" },
  SKODA: { actorId: "making-data-meaningful/skoda-parts-catalog", displayName: "Skoda Parts Catalog" },
  SEAT: { actorId: "making-data-meaningful/seat-parts-catalog", displayName: "Seat Parts Catalog" },
  TOYOTA: { actorId: "making-data-meaningful/toyota-parts-catalog", displayName: "Toyota Parts Catalog" },
  HYUNDAI: { actorId: "making-data-meaningful/hyundai-parts-catalog", displayName: "Hyundai Parts Catalog" },
  KIA: { actorId: "making-data-meaningful/kia-parts-catalog", displayName: "Kia Parts Catalog" },
  NISSAN: { actorId: "making-data-meaningful/nissan-parts-catalog", displayName: "Nissan Parts Catalog" },
  OPEL: { actorId: "making-data-meaningful/opel-parts-catalog", displayName: "Opel Parts Catalog" },
  RENAULT: { actorId: "making-data-meaningful/renault-parts-catalog", displayName: "Renault Parts Catalog" },
  PEUGEOT: { actorId: "evocative_pavilion/peugeot-parts-catalog-task", displayName: "Peugeot Parts Catalog" },
  CITROEN: { actorId: "making-data-meaningful/citroen-parts-catalog", displayName: "Citroen Parts Catalog" },
  FIAT: { actorId: "making-data-meaningful/fiat-parts-catalog", displayName: "Fiat Parts Catalog" },
  HONDA: { actorId: "making-data-meaningful/honda-parts-catalog", displayName: "Honda Parts Catalog" },
  FORD: { actorId: "making-data-meaningful/ford-parts-catalog", displayName: "Ford Parts Catalog" },
  MAZDA: { actorId: "making-data-meaningful/mazda-parts-catalog", displayName: "Mazda Parts Catalog" },
  MITSUBISHI: { actorId: "making-data-meaningful/mitsubishi-parts-catalog", displayName: "Mitsubishi Parts Catalog" },
  SUZUKI: { actorId: "making-data-meaningful/suzuki-parts-catalog", displayName: "Suzuki Parts Catalog" },
  PORSCHE: { actorId: "making-data-meaningful/porsche-parts-catalog", displayName: "Porsche Parts Catalog" },
  FERRARI: { actorId: "making-data-meaningful/ferrari-parts-catalog", displayName: "Ferrari Parts Catalog" },
  LAMBORGHINI: { actorId: "making-data-meaningful/lamborghini-parts-catalog", displayName: "Lamborghini Parts Catalog" },
  JAGUAR: { actorId: "making-data-meaningful/jaguar-parts-catalog", displayName: "Jaguar Parts Catalog" },
  CADILLAC: { actorId: "making-data-meaningful/cadillac-parts-catalog", displayName: "Cadillac Parts Catalog" },
  MAN: { actorId: "making-data-meaningful/man-parts-catalog", displayName: "MAN Parts Catalog" },
  MG: { actorId: "making-data-meaningful/mg-parts-catalog", displayName: "MG Parts Catalog" },
  DACIA: { actorId: "making-data-meaningful/dacia-parts-catalog", displayName: "Dacia Parts Catalog" },
  "ASTON MARTIN": { actorId: "making-data-meaningful/aston-martin-parts-catalog", displayName: "Aston Martin Parts Catalog" },
  "ALFA ROMEO": { actorId: "making-data-meaningful/alfa-romeo-parts-catalog", displayName: "Alfa Romeo Parts Catalog" },
  CHEVROLET: { actorId: "making-data-meaningful/chevrolet-parts-catalog", displayName: "Chevrolet Parts Catalog" },
  PONTIAC: { actorId: "making-data-meaningful/pontiac-parts-catalog", displayName: "Pontiac Parts Catalog" }
};

function normalizeBrand(value: string | undefined | null): string | null {
  if (!value) return null;
  const cleaned = value.trim().toUpperCase().replace(/\s+/g, " ");
  if (BRAND_SYNONYMS[cleaned]) return BRAND_SYNONYMS[cleaned];
  return cleaned;
}

export function getBrandOemActorConfig(brand: string | undefined | null): BrandOemActorConfig | null {
  const norm = normalizeBrand(brand);
  if (!norm) return null;
  return BRAND_OEM_ACTORS[norm] || null;
}
