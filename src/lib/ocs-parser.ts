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

import ExcelJS from "exceljs";
import JSZip from "jszip";

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
 * Coerce n'importe quelle valeur de date stockée en Firestore vers ISO YYYY-MM-DD.
 * Gère : string ISO, serial Excel (number ou string — legacy Ontario-Sales-Data),
 * Date, Firestore Timestamp ({_seconds} ou .toDate()).
 * Retourne "" si la valeur est inexploitable.
 */
export function coerceToIsoDate(val: unknown): string {
  if (val == null || val === "") return "";
  if (val instanceof Date) return val.toISOString().substring(0, 10);
  if (typeof val === "object") {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const v = val as any;
    if (typeof v.toDate === "function") return v.toDate().toISOString().substring(0, 10);
    if ("_seconds" in v) return new Date(v._seconds * 1000).toISOString().substring(0, 10);
    return "";
  }
  if (typeof val === "string" && /^\d{4}-\d{2}-\d{2}/.test(val)) return val.substring(0, 10);
  // Serial Excel : plage plausible ~1954-2064 (20000–60000)
  const n = Number(val);
  if (!isNaN(n) && n >= 20000 && n <= 60000) return excelSerialToISO(n);
  return "";
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

// ── Extraction des lignes (ExcelJS + fallback format OCS) ─────

/** Décode les entités XML de base (&amp; &lt; &gt; &quot; &apos; &#xA; …). */
function xmlUnescape(s: string): string {
  return s
    .replace(/&#x([0-9a-fA-F]+);/g, (_, h) => String.fromCodePoint(parseInt(h, 16)))
    .replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(parseInt(d, 10)))
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&amp;/g, "&");
}

/** "A" → 0, "B" → 1, … "AA" → 26 */
function colLettersToIndex(letters: string): number {
  let idx = 0;
  for (const ch of letters) idx = idx * 26 + (ch.charCodeAt(0) - 64);
  return idx - 1;
}

/**
 * Fallback parser pour les exports OCS (générés par OpenXML SDK .NET) :
 * éléments préfixés (`<x:row>`) et lignes/cellules SANS attributs de référence
 * (`r="A1"`), deux formes valides OOXML que ExcelJS ne sait pas lire.
 * Retourne la grille brute (row-major) de la première feuille.
 */
async function parseXlsxRawGrid(buffer: Buffer): Promise<(string | number)[][]> {
  const zip = await JSZip.loadAsync(buffer);

  const sheetName = Object.keys(zip.files)
    .filter((n) => /^xl\/worksheets\/sheet\d+\.xml$/.test(n))
    .sort()[0];
  if (!sheetName) throw new Error("Aucune feuille trouvée dans le fichier xlsx");

  // sharedStrings (souvent absent des exports OCS, mais géré par robustesse)
  const shared: string[] = [];
  const ssFile = zip.files["xl/sharedStrings.xml"];
  if (ssFile) {
    const ss = (await ssFile.async("string")).replace(/<(\/?)[A-Za-z0-9]+:/g, "<$1");
    for (const si of ss.match(/<si>[\s\S]*?<\/si>/g) || []) {
      const ts = si.match(/<t[^>]*>[\s\S]*?<\/t>/g) || [];
      shared.push(
        ts.map((t) => xmlUnescape(t.replace(/^<t[^>]*>/, "").replace(/<\/t>$/, ""))).join("")
      );
    }
  }

  // Normaliser les préfixes de namespace des éléments (<x:c → <c)
  const xml = (await zip.files[sheetName].async("string")).replace(
    /<(\/?)[A-Za-z0-9]+:/g,
    "<$1"
  );
  const sheetData = xml.match(/<sheetData>([\s\S]*?)<\/sheetData>/)?.[1] ?? "";

  const grid: (string | number)[][] = [];
  const rowRe = /<row[^>]*?(?:\/>|>([\s\S]*?)<\/row>)/g;
  let rowMatch: RegExpExecArray | null;
  while ((rowMatch = rowRe.exec(sheetData))) {
    const inner = rowMatch[1] || "";
    const cells: (string | number)[] = [];
    let colIdx = 0;
    const cellRe = /<c([^>]*?)(?:\/>|>([\s\S]*?)<\/c>)/g;
    let cellMatch: RegExpExecArray | null;
    while ((cellMatch = cellRe.exec(inner))) {
      const attrs = cellMatch[1] || "";
      const body = cellMatch[2] || "";
      // Référence explicite ("B3") → position ; sinon colonne suivante
      const ref = attrs.match(/\br="([A-Z]+)\d+"/);
      if (ref) colIdx = colLettersToIndex(ref[1]);
      const type = attrs.match(/\bt="(\w+)"/)?.[1] || "";

      let val: string | number = "";
      if (type === "inlineStr") {
        const ts = body.match(/<t[^>]*>[\s\S]*?<\/t>/g) || [];
        val = ts
          .map((t) => xmlUnescape(t.replace(/^<t[^>]*>/, "").replace(/<\/t>$/, "")))
          .join("");
      } else {
        const v = body.match(/<v[^>]*>([\s\S]*?)<\/v>/)?.[1] ?? "";
        if (type === "s") val = shared[Number(v)] ?? "";
        else if (type === "str" || type === "b") val = xmlUnescape(v);
        else if (v !== "") {
          const n = Number(v);
          val = isNaN(n) ? xmlUnescape(v) : n;
        }
      }
      cells[colIdx] = val;
      colIdx++;
    }
    grid.push(cells);
  }
  return grid;
}

/**
 * Extrait les lignes de données (header row 1 → objets clé/valeur).
 * Essaie ExcelJS (xlsx standard), puis bascule sur le parser OCS
 * si ExcelJS échoue ou ne trouve aucune ligne.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function extractRawRows(buffer: Buffer): Promise<Record<string, any>[]> {
  // 1) ExcelJS — fichiers xlsx standards (Excel, Google Sheets…)
  try {
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(buffer as unknown as ArrayBuffer);
    const worksheet = workbook.worksheets[0];

    if (worksheet && worksheet.rowCount > 1) {
      const headers: string[] = [];
      worksheet.getRow(1).eachCell({ includeEmpty: true }, (cell, colNumber) => {
        headers[colNumber] = String(cell.value || "").trim();
      });

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const rawRows: Record<string, any>[] = [];
      worksheet.eachRow({ includeEmpty: false }, (row, rowNumber) => {
        if (rowNumber === 1) return; // skip header
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const obj: Record<string, any> = {};
        row.eachCell({ includeEmpty: true }, (cell, colNumber) => {
          const key = headers[colNumber];
          if (key) {
            // Handle ExcelJS rich text / date objects
            const v = cell.value;
            if (v instanceof Date) {
              obj[key] = v.toISOString().substring(0, 10);
            } else if (typeof v === "object" && v !== null && "richText" in v) {
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              obj[key] = (v as any).richText.map((r: any) => r.text).join("");
            } else {
              obj[key] = v ?? "";
            }
          }
        });
        rawRows.push(obj);
      });
      if (rawRows.length > 0) return rawRows;
    }
  } catch {
    // Format non supporté par ExcelJS (export OCS) → fallback ci-dessous
  }

  // 2) Fallback — format d'export OCS
  const grid = await parseXlsxRawGrid(buffer);
  if (grid.length <= 1) return [];
  const headers = grid[0].map((h) => String(h ?? "").trim());
  return grid
    .slice(1)
    .map((cells) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const obj: Record<string, any> = {};
      headers.forEach((h, i) => {
        if (h) obj[h] = cells[i] ?? "";
      });
      return obj;
    })
    .filter((o) => Object.values(o).some((v) => v !== "" && v != null));
}

// ── Pipeline principal ────────────────────────────────────────

/**
 * Parse un fichier XLSX OCS et matche les lignes contre les stores existants.
 */
export async function parseAndMatchOcsXlsx(
  buffer: Buffer,
  existingStores: ExistingStore[],
  filename = "data.xlsx"
): Promise<ParseResult> {
  const rawRows = await extractRawRows(buffer);

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
    const orderDate = excelSerialToISO(row["Order Date"] ?? row["order_date"] ?? "");

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
