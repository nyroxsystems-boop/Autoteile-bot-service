const express = require("express");
const inventoryService = require("../services/inventoryService");

const router = express.Router();

router.get("/by-oem/:oemNumber", async (req, res) => {
  const { oemNumber } = req.params;
  try {
    const data = await inventoryService.getCombinedAvailability(oemNumber);
    res.json(data);
  } catch (err) {
    console.error("Failed to fetch availability", err);
    res.status(500).json({ message: "Failed to fetch availability" });
  }
});

module.exports = router;
