import { ApifyClient } from "../src/services/apifyClient";
import dotenv from "dotenv";

dotenv.config();

async function main() {
  const token = process.env.APIFY_TOKEN;
  const actorId = process.env.APIFY_ACTOR_ID || "making-data-meaningful/tecdoc"; // default example
  if (!token) {
    console.error("APIFY_TOKEN is required in env to run this script.");
    process.exit(2);
  }

  const client = new ApifyClient({ token });

  const input = {
    // Example input shape expected by the tecdoc actor or supplier actor.
    // Adjust as needed for your actors.
    oem: process.env.TEST_OEM || "OEM-12345",
    country: process.env.TEST_COUNTRY || "DE",
    language: process.env.TEST_LANGUAGE || "de"
  };

  console.log("Running Apify actor", actorId, "with input", input);
  try {
    const results = await client.runActorDataset(actorId, input);
    console.log("Apify run finished. Results:", JSON.stringify(results, null, 2));
  } catch (err: any) {
    console.error("Apify run failed:", err?.message ?? err);
    process.exit(1);
  }
}

main();
