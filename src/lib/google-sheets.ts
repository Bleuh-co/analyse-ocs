import "server-only";
import { google, sheets_v4 } from "googleapis";

/**
 * Google Sheets helper for analyse-ocs.
 *
 * In production (Cloud Run), uses Application Default Credentials (ADC).
 * Locally, falls back to a credentials.json file if present.
 *
 * NOTE: Public sheets (anyone with the link = viewer) can be read with
 * an API key OR with service account ADC. We use ADC for consistency
 * and to enable future write access.
 */

let _sheets: sheets_v4.Sheets | null = null;

function getSheetsClient(): sheets_v4.Sheets {
  if (_sheets) return _sheets;

  const auth = new google.auth.GoogleAuth({
    scopes: ["https://www.googleapis.com/auth/spreadsheets.readonly"],
  });

  _sheets = google.sheets({ version: "v4", auth });
  return _sheets;
}

/** Known spreadsheet IDs */
export const SHEET_IDS = {
  /** CRM historique (David's weekly tracker) */
  CRM_HISTORIQUE: "1KrKMBcXJRF7DJ4ROoY8-wcjek2cBGI2ioEziWLxo8cs",
  /** CRM Segmentation */
  CRM_SEGMENTATION: "1tIaaJSTv903UvebwRBPcN86WfsoR4jC0iWdVUzttt4o",
  /** DB-Products-Master (GTIN/SKU reference) */
  DB_PRODUCTS_MASTER: "1GLaG4FgH0ySS6dVe1GkpILl5EpfJ73UJ_AZ1Wxntq1M",
} as const;

export interface SheetData {
  headers: string[];
  rows: Record<string, string>[];
  sheetTitle: string;
}

/**
 * Read all data from the first sheet of a spreadsheet.
 * Returns headers + rows as key-value objects.
 */
export async function readSheet(
  spreadsheetId: string,
  range?: string
): Promise<SheetData> {
  const sheets = getSheetsClient();

  // If no range specified, get the first sheet's title
  let sheetTitle = "Sheet1";
  if (!range) {
    const meta = await sheets.spreadsheets.get({ spreadsheetId });
    sheetTitle = meta.data.sheets?.[0]?.properties?.title || "Sheet1";
    range = `${sheetTitle}!A:ZZ`;
  } else {
    sheetTitle = range.split("!")[0] || "Sheet1";
  }

  const response = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range,
  });

  const rawRows = response.data.values;
  if (!rawRows || rawRows.length < 2) {
    return { headers: rawRows?.[0] || [], rows: [], sheetTitle };
  }

  const headers = rawRows[0].map((h: string) => (h || "").trim());
  const rows = rawRows.slice(1).map((row) => {
    const obj: Record<string, string> = {};
    headers.forEach((h, i) => {
      if (h) obj[h] = (row[i] || "").toString();
    });
    return obj;
  });

  return { headers, rows, sheetTitle };
}

/**
 * List all sheet tabs in a spreadsheet.
 */
export async function listSheetTabs(
  spreadsheetId: string
): Promise<string[]> {
  const sheets = getSheetsClient();
  const meta = await sheets.spreadsheets.get({ spreadsheetId });
  return (meta.data.sheets || []).map(
    (s) => s.properties?.title || ""
  ).filter(Boolean);
}
