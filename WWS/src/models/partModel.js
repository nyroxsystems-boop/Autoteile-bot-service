const fs = require("fs");
const path = require("path");

const dataPath = path.join(__dirname, "..", "data", "parts.json");
let parts = [];
let nextId = 1;

function loadParts() {
  try {
    const raw = fs.readFileSync(dataPath, "utf-8");
    parts = JSON.parse(raw);
    const maxId = parts.reduce((max, p) => Math.max(max, Number(p.id) || 0), 0);
    nextId = maxId + 1;
  } catch (err) {
    console.error("Failed to load parts.json", err);
    parts = [];
    nextId = 1;
  }
}

function persist() {
  try {
    fs.writeFileSync(dataPath, JSON.stringify(parts, null, 2), "utf-8");
  } catch (err) {
    // For demo we keep going even if persisting fails.
    console.warn("Could not persist parts.json", err.message);
  }
}

function getAllParts() {
  return parts;
}

function matchText(value, searchTerm) {
  return value && value.toLowerCase().includes(searchTerm);
}

function findPartsByQuery({ brand, model, modelCode, oemNumber, search }) {
  const searchTerm = search ? String(search).toLowerCase() : null;
  const oemTerm = oemNumber ? String(oemNumber).toLowerCase() : null;

  return parts.filter((part) => {
    if (brand && part.brand.toLowerCase() !== String(brand).toLowerCase()) {
      return false;
    }
    if (model && part.model.toLowerCase() !== String(model).toLowerCase()) {
      return false;
    }
    if (modelCode && part.modelCode.toLowerCase() !== String(modelCode).toLowerCase()) {
      return false;
    }
    if (oemTerm && part.oemNumber.toLowerCase() !== oemTerm) {
      return false;
    }
    if (searchTerm) {
      const inCompatible = Array.isArray(part.compatibleModels)
        ? part.compatibleModels.some((m) => matchText(String(m), searchTerm))
        : false;
      const fields = [
        part.title,
        part.description,
        part.oemNumber,
        part.internalSku,
        inCompatible ? searchTerm : null
      ];
      const matches = fields.some((f) => (f ? String(f).toLowerCase().includes(searchTerm) : false));
      if (!matches) {
        return false;
      }
    }
    return true;
  });
}

function getPartById(id) {
  return parts.find((p) => String(p.id) === String(id));
}

function createPart(partData) {
  const newPart = {
    id: String(nextId++),
    lastUpdated: new Date().toISOString(),
    stockReserved: 0,
    stockLocal: 0,
    currency: "EUR",
    ...partData
  };
  parts.push(newPart);
  persist();
  return newPart;
}

function updatePart(id, updates) {
  const part = getPartById(id);
  if (!part) {
    return null;
  }
  Object.assign(part, updates, { lastUpdated: new Date().toISOString() });
  persist();
  return part;
}

function deletePart(id) {
  const idx = parts.findIndex((p) => String(p.id) === String(id));
  if (idx === -1) return false;
  parts.splice(idx, 1);
  persist();
  return true;
}

function reserveStock(partId, quantity) {
  const part = getPartById(partId);
  if (!part) return { error: "not_found" };
  const qty = Number(quantity);
  if (!qty || qty <= 0) return { error: "invalid_quantity" };
  const available = part.stockLocal - part.stockReserved;
  if (qty > available) return { error: "insufficient_stock", available };
  part.stockReserved += qty;
  part.lastUpdated = new Date().toISOString();
  persist();
  return { part };
}

function releaseStock(partId, quantity) {
  const part = getPartById(partId);
  if (!part) return { error: "not_found" };
  const qty = Number(quantity);
  if (!qty || qty <= 0) return { error: "invalid_quantity" };
  part.stockReserved = Math.max(0, part.stockReserved - qty);
  part.lastUpdated = new Date().toISOString();
  persist();
  return { part };
}

function bookStock(partId, quantity) {
  const part = getPartById(partId);
  if (!part) return { error: "not_found" };
  const qty = Number(quantity);
  if (!qty || qty <= 0) return { error: "invalid_quantity" };
  if (qty > part.stockLocal) return { error: "insufficient_stock", available: part.stockLocal };
  part.stockLocal -= qty;
  const reservedReduction = Math.min(part.stockReserved, qty);
  part.stockReserved -= reservedReduction;
  part.lastUpdated = new Date().toISOString();
  persist();
  return { part };
}

loadParts();

module.exports = {
  getAllParts,
  findPartsByQuery,
  getPartById,
  createPart,
  updatePart,
  deletePart,
  reserveStock,
  releaseStock,
  bookStock
};
