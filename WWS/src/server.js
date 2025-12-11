const express = require("express");
const path = require("path");
const cors = require("cors");
const bodyParser = require("body-parser");

const { PORT } = require("./config");
const authRoutes = require("./routes/authRoutes");
const partsRoutes = require("./routes/partsRoutes");
const inventoryRoutes = require("./routes/inventoryRoutes");
const partModel = require("./models/partModel");

const app = express();

app.use(cors());
app.use(bodyParser.json());
app.use(express.static(path.join(__dirname, "..", "public")));

app.get("/api/health", (req, res) => {
  res.json({ status: "ok" });
});

app.use("/api/auth", authRoutes);
app.use("/api/parts", partsRoutes);
app.use("/api/inventory", inventoryRoutes);

// fallback to index.html for root
app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "..", "public", "index.html"));
});

if (require.main === module) {
  app.listen(PORT, () => {
    console.log(`WWS server listening on port ${PORT}`);
    console.log(`Loaded parts: ${partModel.getAllParts().length}`);
  });
}

module.exports = app;
