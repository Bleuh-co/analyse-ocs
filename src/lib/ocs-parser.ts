/**
 * OCS XLSX Parser & Store Matching Engine
 * Porté depuis Ontario-Sales-Data/routes/upload.js
 *
 * Fonctions :
 *  - parseOCSAddress : parse les adresses multi-lignes OCS
 *  - normalizeAddress / normalizePostalCode : normalisation pour matching
 *  - gtin14to12 : conversion GTIN-14 → GTIN-12
 *  - parseChainAndBranch : extraction chaîne/succursale
 *  - buildCleNeobi : clé Neobi pour matching
 *  - excelSerialToISO : conversion date Excel serial → ISO 8601
 *  - parseAndMatchOcsXlsx : pipeline complet parse + matching
 */

import * as XLSX from "xlsx";

// ── Types ──────────────────────────────────────────────────────

export interface ParsedAddress {
  street: string;
  city: string;
  province: string;
  postalCode: string;
}

export interface OcsRawRow {
  sku: string;
  itemName: string;
  category: string;
  subCategory: string;
  brand: string;
  vendorId: string;
  vendorName: string;
  storeName: string;
  storeAddress: string;
  region: string;
  city: string;
  orderDate: string; // ISO 8601
  orderType: string;
  unitsSold: number;
  itemBarcode: string;
}

export interface ComputedFields {
  storeNumber: string;
  succursale: string;
  chaine: string;
  street: string;
  mailingStreet: string;
  mailingCity: string;
  mailingState: string;
  mailingPostcode: string;
  cleNeobi: string;
  gtin12: string;
}

export interface EnrichedRow {
  raw: OcsRawRow;
  status: "matched" | "unmatched" | "invalid";
  reason?: string;
  matchedStoreId: string | null;
  computed: ComputedFields;
}

export interface ParseResult {
  filename: string;
  totalRows: number;
  stats: { matched: number; unmatched: number; invalid: number };
  rows: EnrichedRow[];
}

export interface ExistingStore {
  id: string;
  name?: string;
  storeNumber?: string;
  address?: string;
  city?: string;
  state?: string;
  postalCode?: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  [key: string]: any;
}

// ── Helpers ────────────────────────────────────────────────────

/**
 * Parse une adresse OCS multi-lignes.
 * Format typique : "1136 concession st\r\nRussell, ON K4R1E1\r\nCAN"
 */
export function parseOCSAddress(raw: string): ParsedAddress {
  if (!raw) return { street: "", city: "", province: "", postalCode: "" };

  const lines = raw
    .split(/[\n\r]+/)
    .map((l) => l.trim())
    .filter(Boolean);

  const filtered = lines.filter(
    (l) => l.toUpperCase() !== "CAN" && l.toUpperCase() !== "CANADA"
  );

  let street = "";
  let city = "";
  let province = "";
  let postalCode = "";

  if (filtered.length >= 2) {
    street = filtered[0];
    const cityLine = filtered[1];
    const match = cityLine.match(
      /^(.+?),\s*([A-Z]{2})\s+([A-Z]\d[A-Z]\s?\d[A-Z]\d)$/i
    );
    if (match) {
      city = match[1].trim();
      province = match[2].toUpperCase();
      postalCode = match[3].replace(/\s/g, "").toUpperCase();
    } else {
      const parts = cityLine.split(",").map((p) => p.trim());
      city = parts[0] || "";
      if (parts[1]) {
        const rest = parts[1].trim();
        province = rest.substring(0, 2).toUpperCase();
        postalCode = rest
          .substring(2)
          .trim()
          .replace(/\s/g, "")
          .toUpperCase();
      }
    }
  } else if (filtered.length === 1) {
    street = filtered[0];
  }

  return { street, city, province, postalCode };
}

/**
 * Normalise une adresse pour le matching.
 */
export function normalizeAddress(addr: string): string {
  if (!addr) return "";
  return addr
    .toLowerCase()
    .replace(/[.,#\-]/g, " ")
    .replace(/\b(unit|suite|apt|ste|#)\s*\w*/gi, "")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Normalise un code postal canadien : "K4R 1E1" → "K4R1E1"
 */
export function normalizePostalCode(pc: string): string {
  if (!pc) return "";
  return pc.replace(/\s/g, "").toUpperCase();
}

/**
 * GTIN-14 → GTIN-12 : strip leading "00"
 */
export function gtin14to12(barcode: string): string {
  if (!barcode) return "";
  const s = String(barcode).trim();
  if (s.length === 14 && s.startsWith("00")) return s.substring(2);
  if (s.length === 13 && s.startsWith("0")) return s.substring(1);
  return s;
}

/**
 * Clé Neobi — premiers mots significatifs de l'adresse.
 */
export function buildCleNeobi(street: string): string {
  if (!street) return "";
  const words = street.replace(/[.,#\-]/g, "").split(/\s+/);
  return words.slice(0, 2).join(" ");
}

/**
 * Extraction chaîne et succursale du nom du store.
 * "True North Cannabis - Gordon" → chain="True North Cannabis", branch="Gordon"
 */
export function parseChainAndBranch(storeName: string): {
  chain: string;
  branch: string;
} {
  if (!storeName) return { chain: "", branch: storeName || "" };
  const sep = storeName.indexOf(" - ");
  if (sep > 0) {
    return {
      chain: storeName.substring(0, sep).trim(),
      branch: storeName.substring(sep + 3).trim(),
    };
  }
  return { chain: storeName, branch: "" };
}

/**
 * Convertit un numéro de série de date Excel en string ISO 8601 (YYYY-MM-DD).
 * Excel serial 1 = 1900-01-01, mais avec le bug du "29 fév 1900" de Lotus 1-2-3.
 */
export function excelSerialToISO(serial: number | string): string {
  if (typeof serial === "string") {
    // Déjà une date ISO ou lisible ?
    if (/^\d{4}-\d{2}-\d{2}/.test(serial)) return serial.substring(0, 10);
    const n = Number(serial);
    if (isNaN(n)) return serial;
    serial = n;
  }
  if (typeof serial !== "number" || isNaN(serial)) return "";
  // Excel epoch: 1899-12-30 (avec le bug Lotus)
  const excelEpoch = new Date(1899, 11, 30);
  const date = new Date(excelEpoch.getTime() + serial * 86400000);
  return date.toISOString().substring(0, 10);
}

// ── Colonnes OCS attendues ────────────────────────────────────

const COLUMN_MAP: Record<string, keyof OcsRawRow> = {
  SKU: "sku",
  "Item Name": "itemName",
  Category: "category",
  "Sub Category": "subCategory",
  Brand: "brand",
  "Vendor ID": "vendorId",
  "Vendor Name": "vendorName",
  "Store Name": "storeName",
  "Store Address": "storeAddress",
  Region: "region",
  City: "city",
  "Order Date": "orderDate",
  "Order Type": "orderType",
  "Units Sold": "unitsSold",
  "Item Barcode": "itemBarcode",
};

// ── Pipeline principal ────────────────────────────────────────

/**
 * Parse un fichier XLSX OCS et matche les lignes contre les stores existants.
 */
export function parseAndMatchOcsXlsx(
  buffer: Buffer,
  existingStores: ExistingStore[],
  filename = "data.xlsx"
): ParseResult {
  const workbook = XLSX.read(buffer, { type: "buffer" });
  const sheetName = workbook.SheetNames[0];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const rawRows: Record<string, any>[] = XLSX.utils.sheet_to_json(
    workbook.Sheets[sheetName],
    { defval: "" }
  );

  if (rawRows.length === 0) {
    return {
      filename,
      totalRows: 0,
      stats: { matched: 0, unmatched: 0, invalid: 0 },
      rows: [],
    };
  }

  // Index des stores par postal code
  const storesByPostalCode: Record<string, ExistingStore[]> = {};
  for (const store of existingStores) {
    const pc = normalizePostalCode(
      store.postalCode || store.postal_code || ""
    );
    if (pc) {
      if (!storesByPostalCode[pc]) storesByPostalCode[pc] = [];
      storesByPostalCode[pc].push(store);
    }
  }

  const stats = { matched: 0, unmatched: 0, invalid: 0 };
  const enrichedRows: EnrichedRow[] = [];

  for (const row of rawRows) {
    // Extraire les colonnes (supporte les noms originaux et snake_case)
    const getValue = (keys: string[]): string => {
      for (const k of keys) {
        if (row[k] !== undefined && row[k] !== "") return String(row[k]);
      }
      return "";
    };

    const rawAddress = getValue(["Store Address", "store_address"]);
    const storeName = getValue(["Store Name", "store_name"]);
    const barcode = getValue(["Item Barcode", "item_barcode"]);
    const rawOrderDate = row["Order Date"] ?? row["order_date"] ?? "";
    const rawUnitsSold = row["Units Sold"] ?? row["units_sold"] ?? 0;

    // Parse l'adresse OCS
    const parsed = parseOCSAddress(rawAddress);

    // Validation de base
    if (!storeName && !rawAddress) {
      stats.invalid++;
      enrichedRows.push({
        raw: buildRawRow(row),
        status: "invalid",
        reason: "Pas de Store Name ni Store Address",
        matchedStoreId: null,
        computed: emptyComputed(),
      });
      continue;
    }

    // Match par postal code
    let matchedStore: ExistingStore | null = null;
    const normalizedPC = normalizePostalCode(parsed.postalCode);

    if (normalizedPC && storesByPostalCode[normalizedPC]) {
      const candidates = storesByPostalCode[normalizedPC];
      if (candidates.length === 1) {
        matchedStore = candidates[0];
      } else {
        const normalizedStreet = normalizeAddress(parsed.street);
        matchedStore =
          candidates.find((s) => {
            const sAddr = normalizeAddress(s.address || "");
            return (
              sAddr.includes(normalizedStreet) ||
              normalizedStreet.includes(sAddr)
            );
          }) || candidates[0];
      }
    }

    const gtin12 = gtin14to12(barcode);
    const orderDate = excelSerialToISO(rawOrderDate);

    if (matchedStore) {
      const { chain } = parseChainAndBranch(matchedStore.name || "");
      enrichedRows.push({
        raw: buildRawRow(row, orderDate),
        status: "matched",
        matchedStoreId: matchedStore.id,
        computed: {
          storeNumber:
            matchedStore.storeNumber || matchedStore.store_number || matchedStore.id,
          succursale: matchedStore.name || "",
          chaine: chain,
          street: matchedStore.address || "",
          mailingStreet: matchedStore.address || "",
          mailingCity: matchedStore.city || "",
          mailingState: matchedStore.state || "ON",
          mailingPostcode: matchedStore.postalCode || matchedStore.postal_code || "",
          cleNeobi: buildCleNeobi(matchedStore.address || ""),
          gtin12,
        },
      });
      stats.matched++;
    } else {
      enrichedRows.push({
        raw: buildRawRow(row, orderDate),
        status: "unmatched",
        matchedStoreId: null,
        computed: {
          storeNumber: "",
          succursale: storeName,
          chaine: "",
          street: parsed.street,
          mailingStreet: parsed.street,
          mailingCity: parsed.city || getValue(["City", "city"]),
          mailingState: parsed.province || "ON",
          mailingPostcode: normalizedPC,
          cleNeobi: buildCleNeobi(parsed.street),
          gtin12,
        },
      });
      stats.unmatched++;
    }
  }

  return { filename, totalRows: rawRows.length, stats, rows: enrichedRows };
}

// ── Helpers internes ──────────────────────────────────────────

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function buildRawRow(row: Record<string, any>, orderDateOverride?: string): OcsRawRow {
  const get = (keys: string[]): string => {
    for (const k of keys) {
      if (row[k] !== undefined && row[k] !== "") return String(row[k]);
    }
    return "";
  };

  return {
    sku: get(["SKU", "sku"]),
    itemName: get(["Item Name", "item_name"]),
    category: get(["Category", "category"]),
    subCategory: get(["Sub Category", "sub_category"]),
    brand: get(["Brand", "brand"]),
    vendorId: get(["Vendor ID", "vendor_id"]),
    vendorName: get(["Vendor Name", "vendor_name"]),
    storeName: get(["Store Name", "store_name"]),
    storeAddress: get(["Store Address", "store_address"]),
    region: get(["Region", "region"]),
    city: get(["City", "city"]),
    orderDate:
      orderDateOverride ||
      excelSerialToISO(row["Order Date"] ?? row["order_date"] ?? ""),
    orderType: get(["Order Type", "order_type"]),
    unitsSold: parseInt(
      String(row["Units Sold"] ?? row["units_sold"] ?? "0"),
      10
    ),
    itemBarcode: get(["Item Barcode", "item_barcode"]),
  };
}

function emptyComputed(): ComputedFields {
  return {
    storeNumber: "",
    succursale: "",
    chaine: "",
    street: "",
    mailingStreet: "",
    mailingCity: "",
    mailingState: "",
    mailingPostcode: "",
    cleNeobi: "",
    gtin12: "",
  };
}
