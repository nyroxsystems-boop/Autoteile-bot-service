import { resolveOEMForOrder } from "../src/services/oemService";

async function run() {
  const orderId = "demo-smoke";
  const vehicle = {
    make: "BMW",
    model: "316TI",
    year: 2003,
    engine: "N42",
    vin: "WBAAT51010FM74113",
    hsn: "0005",
    tsn: "716"
  };
  const partText = "Bremsscheiben vorne";

  const res = await resolveOEMForOrder(orderId, vehicle, partText);
  console.log("OEM Smoke Result:", JSON.stringify(res, null, 2));
}

run().catch((err) => {
  console.error("Smoke test failed", err);
  process.exit(1);
});
