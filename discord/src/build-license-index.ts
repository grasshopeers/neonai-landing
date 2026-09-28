/**
 * Builds a SHA-256 hashed license index from LICENSE_KEYS_FULL_INVENTORY.txt
 * so the bot can auto-accept keys without shipping plaintext inventory.
 *
 * Usage:
 *   npx tsx src/build-license-index.ts [path-to-inventory.txt]
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { readFileSync } from "node:fs";
import { parseInventoryFile } from "./license-lookup.js";

const here = dirname(fileURLToPath(import.meta.url));
const defaultInventory =
  process.env.LICENSE_INVENTORY_PATH ??
  "C:\\Users\\aadit\\Downloads\\NeonAi\\deploy\\LICENSE_KEYS_FULL_INVENTORY.txt";
const inventoryPath = process.argv[2] ?? defaultInventory;

const text = readFileSync(inventoryPath, "utf8");
const entries = parseInventoryFile(text);
const outDir = join(here, "..", "data");
mkdirSync(outDir, { recursive: true });
const outPath = join(outDir, "license-inventory-index.json");

writeFileSync(
  outPath,
  JSON.stringify(
    {
      updatedAt: new Date().toISOString(),
      source: inventoryPath,
      entries,
    },
    null,
    2
  )
);

console.log(`Wrote ${entries.length} hashed keys → ${outPath}`);
