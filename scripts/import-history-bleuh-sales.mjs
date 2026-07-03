#!/usr/bin/env node
/**
 * Import historique — onglet "Export" du Google Sheet Bleuh_Sales_Data
 * (= CRM Historique, 1KrKMBcXJRF…). Couvre février 2025 → aujourd'hui.
 *
 * Écrit UNIQUEMENT dans le journal des ventes `stores/{id}/sales/{gtin}_{date}`
 * (IDs déterministes + merge → ré-exécutable sans doublon). Ne touche PAS au
 * snapshot `products` ni au `updated_at` des stores existants — l'historique
 * ne doit pas passer pour de l'activité récente.
 *
 * Les stores présents dans l'historique mais absents de Firestore (fermés
 * depuis) sont créés en docs minimaux, `source: "history"`, avec `updated_at`
 * = leur dernière vente historique.
 *
 * Usage :
 *   node scripts/import-history-bleuh-sales.mjs <key.json> [--dry-run]
 */
import { initializeApp, cert } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import { google } from "googleapis";
import { readFileSync } from "fs";

const keyPath = process.argv[2] || process.env.GOOGLE_APPLICATION_CREDENTIALS;
const dryRun = process.argv.includes("--dry-run");
if (!keyPath) { console.error("Usage: node import-history-bleuh-sales.mjs <key.json> [--dry-run]"); process.exit(1); }

const SHEET_ID = "1KrKMBcXJRF7DJ4ROoY8-wcjek2cBGI2ioEziWLxo8cs";
const TAB = "Export";
const SOURCE = "history:Bleuh_Sales_Data:Export";

/* Dates françaises "décembre 15, 2025" → "2025-12-15" */
const MOIS = { janvier: "01", février: "02", mars: "03", avril: "04", mai: "05", juin: "06",
  juillet: "07", août: "08", septembre: "09", octobre: "10", novembre: "11", décembre: "12" };
function frToIso(s) {
  if (!s) return null;
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.substring(0, 10);
  const m = String(s).trim().match(/^(\S+)\s+(\d{1,2}),\s*(\d{4})$/);
  if (!m) return null;
  const mm = MOIS[m[1].toLowerCase()];
  return mm ? `${m[3]}-${mm}-${String(m[2]).padStart(2, "0")}` : null;
}

function gtin14to12(b) {
  const s = String(b || "").trim();
  if (s.length === 14 && s.startsWith("00")) return s.substring(2);
  if (s.length === 13 && s.startsWith("0")) return s.substring(1);
  return s;
}

initializeApp({ credential: cert(JSON.parse(readFileSync(keyPath, "utf8"))) });
const db = getFirestore();

// 1. Stores existants
const storesSnap = await db.collection("stores").get();
const knownIds = new Set(storesSnap.docs.map((d) => d.id));
console.log(`Firestore: ${knownIds.size} stores connus`);

// 2. Lire l'onglet Export
const auth = new google.auth.GoogleAuth({ keyFile: keyPath, scopes: ["https://www.googleapis.com/auth/spreadsheets.readonly"] });
const sheetsApi = google.sheets({ version: "v4", auth });
const resp = await sheetsApi.spreadsheets.values.get({ spreadsheetId: SHEET_ID, range: `${TAB}!A2:R20000` });
const rows = (resp.data.values || []).filter((x) => x[0]);
console.log(`Sheet "${TAB}": ${rows.length} lignes`);

// Colonnes : A SKU, B Item Name, C Category, D Sub Category, E Brand, H Store Name,
// J Region, K City, L Order Date, M Order Type, N Units Sold, O Item Barcode,
// P Store number, Q Succursale, R Chaine
const entries = new Map(); // `${storeId}|${gtin}|${date}` → entry (unités sommées si doublon)
const missingStores = new Map(); // storeId → info du store à créer
let badDate = 0, badGtin = 0;

for (const x of rows) {
  const date = frToIso(x[11]);
  const gtin = gtin14to12(x[14]);
  const storeId = String(x[15] || "").trim();
  const units = parseInt(String(x[13] || "0"), 10) || 0;
  if (!date) { badDate++; continue; }
  if (!gtin || !storeId) { badGtin++; continue; }

  const key = `${storeId}|${gtin}|${date}`;
  const prev = entries.get(key);
  if (prev) prev.units_sold += units;
  else entries.set(key, {
    storeId, gtin,
    sku: x[0] || "", name: x[1] || "",
    category: x[2] || "", sub_category: x[3] || "", brand: x[4] || "",
    units_sold: units, order_date: date, order_type: x[12] || "", region: x[9] || "",
  });

  if (!knownIds.has(storeId)) {
    const prev = missingStores.get(storeId);
    if (!prev || date > prev.lastDate) {
      missingStores.set(storeId, {
        name: x[16] || x[7] || storeId, // Succursale, sinon Store Name OCS
        chain: x[17] || "", city: x[10] || "", region: x[9] || "", lastDate: date,
      });
    }
  }
}

const dates = [...entries.values()].map((e) => e.order_date).sort();
console.log(`→ ${entries.size} entrées de journal (doublons sommés) | ${dates[0]} → ${dates[dates.length - 1]}`);
console.log(`→ dates illisibles: ${badDate} | sans gtin/store: ${badGtin}`);
console.log(`→ stores à créer: ${missingStores.size} (${[...missingStores.keys()].slice(0, 8).join(", ")}…)`);

if (dryRun) { console.log("(dry-run — aucune écriture)"); process.exit(0); }

// 3. Créer les stores manquants (docs minimaux, updated_at = dernière vente historique)
let batch = db.batch(), ops = 0, created = 0, written = 0;
async function flush() { if (ops > 0) { await batch.commit(); batch = db.batch(); ops = 0; } }

for (const [id, s] of missingStores) {
  batch.set(db.collection("stores").doc(id), {
    name: s.name, store_number: id, province: "ON", state: "ON",
    city: s.city, region: s.region, source: "history",
    address: "", postal_code: "", phone: "", website: "", lat: null, lng: null, tags: [],
    created_at: new Date(), updated_at: new Date(s.lastDate + "T12:00:00Z"),
    created_by: "import-history-script",
  }, { merge: true });
  created++; ops++;
  if (ops >= 400) await flush();
}

// 4. Écrire le journal
for (const e of entries.values()) {
  batch.set(
    db.collection("stores").doc(e.storeId).collection("sales").doc(`${e.gtin}_${e.order_date}`),
    {
      gtin: e.gtin, sku: e.sku, name: e.name,
      category: e.category, sub_category: e.sub_category, brand: e.brand,
      units_sold: e.units_sold, order_date: e.order_date, order_type: e.order_type,
      region: e.region, source_file: SOURCE, imported_at: new Date(),
    },
    { merge: true }
  );
  written++; ops++;
  if (ops >= 400) await flush();
}
await flush();

console.log(`✅ ${created} stores créés, ${written} entrées de journal écrites`);
