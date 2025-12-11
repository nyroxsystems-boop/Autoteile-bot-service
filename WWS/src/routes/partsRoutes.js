const express = require("express");
const partModel = require("../models/partModel");
const { authenticate } = require("../middleware/authMiddleware");

const router = express.Router();

router.get("/", (req, res) => {
  const { brand, model, modelCode, oemNumber, search } = req.query;
  const parts = partModel.findPartsByQuery({ brand, model, modelCode, oemNumber, search });
  res.json(parts);
});

router.get("/:id", (req, res) => {
  const part = partModel.getPartById(req.params.id);
  if (!part) {
    return res.status(404).json({ message: "Part not found" });
  }
  res.json(part);
});

router.post("/", authenticate, (req, res) => {
  const newPart = partModel.createPart(req.body || {});
  res.status(201).json(newPart);
});

router.put("/:id", authenticate, (req, res) => {
  const updated = partModel.updatePart(req.params.id, req.body || {});
  if (!updated) {
    return res.status(404).json({ message: "Part not found" });
  }
  res.json(updated);
});

router.delete("/:id", authenticate, (req, res) => {
  const deleted = partModel.deletePart(req.params.id);
  if (!deleted) {
    return res.status(404).json({ message: "Part not found" });
  }
  res.json({ success: true });
});

router.post("/:id/reserve", authenticate, (req, res) => {
  const { quantity } = req.body || {};
  const result = partModel.reserveStock(req.params.id, quantity);
  if (result.error === "not_found") return res.status(404).json({ message: "Part not found" });
  if (result.error) return res.status(400).json({ message: result.error, available: result.available });
  res.json(result.part);
});

router.post("/:id/release", authenticate, (req, res) => {
  const { quantity } = req.body || {};
  const result = partModel.releaseStock(req.params.id, quantity);
  if (result.error === "not_found") return res.status(404).json({ message: "Part not found" });
  if (result.error) return res.status(400).json({ message: result.error });
  res.json(result.part);
});

router.post("/:id/book", authenticate, (req, res) => {
  const { quantity } = req.body || {};
  const result = partModel.bookStock(req.params.id, quantity);
  if (result.error === "not_found") return res.status(404).json({ message: "Part not found" });
  if (result.error) return res.status(400).json({ message: result.error, available: result.available });
  res.json(result.part);
});

module.exports = router;
