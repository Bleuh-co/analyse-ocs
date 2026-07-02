#!/usr/bin/env node
/**
 * Backfill du journal cumulatif des ventes (`stores/{id}/sales`).
 *
 * Convertit chaque doc snapshot `stores/{id}/products/{gtin}` (dernière
 * commande connue) en une entrée de journal `sales/{gtin}_{date}`.
 * Idempotent (IDs déterministes, merge) et purement additif — ne modifie
 * aucun doc existant.
 *
 * Usage :
 *   GOOGLE_APPLICATION_CREDENTIALS=path/to/key.json node scripts/backfill-sales-ledger.mjs
 *   node scripts/backfill-sales-ledger.mjs path/to/key.json
 */
import { initializeApp, cert, applicationDefault } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import { readFileSync } from "fs";

const keyPath = process.argv[2] || process.env.GOOGLE_APPLICATION_CREDENTIALS;
initializeApp({
  credential: keyPath ? cert(JSON.parse(readFileSync(keyPath, "utf8"))) : applicationDefault(),
});
const db = getFirestore();

/** Serial Excel ou ISO → ISO YYYY-MM-DD ("" si inexploitable) */
function toIso(val) {
  if (val == null || val === "") return "";
  if (typeof val === "object" && typeof val.toDate === "function")
    return val.toDate().toISOString().substring(0, 10);
  const s = String(val);
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.substring(0, 10);
  const n = Number(s);
  if (!isNaN(n) && n >= 20000 && n <= 60000) {
    const epoch = new Date(1899, 11, 30);
    return new Date(epoch.getTime() + n * 86400000).toISOString().substring(0, 10);
  }
  return "";
}

const snap = await db.collectionGroup("products").get();
console.log(`${snap.size} docs products trouvés`);

let written = 0, skippedNoDate = 0, batch = db.batch(), ops = 0;
for (const doc of snap.docs) {
  const storeId = doc.ref.path.split("/")[1];
  const p = doc.data();
  const orderDate = toIso(p.last_order_date);
  if (!orderDate) { skippedNoDate++; continue; }
  const gtin = p.gtin || doc.id;
  batch.set(
    db.collection("stores").doc(storeId).collection("sales").doc(`${gtin}_${orderDate}`),
    {
      gtin,
      sku: p.sku || "",
      name: p.name || "",
      category: p.category || "",
      brand: p.brand || "",
      units_sold: Number(p.units_sold) || 0,
      order_date: orderDate,
      order_type: p.order_type || "",
      region: p.region || "",
      source_file: "backfill-snapshot",
      imported_at: new Date(),
    },
    { merge: true }
  );
  written++; ops++;
  if (ops >= 499) { await batch.commit(); batch = db.batch(); ops = 0; }
}
if (ops > 0) await batch.commit();
console.log(`✅ ${written} entrées de journal écrites, ${skippedNoDate} sans date ignorées`);
