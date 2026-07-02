import "server-only";
import { google, sheets_v4 } from "googleapis";

/**
 * Google Sheets helper for analyse-ocs.
 *
 * In production (Cloud Run), uses Application Default Credentials (ADC).
 * Locally, falls back to credentials.json if present.
 *
 * Scope: full read/write access to spreadsheets the service account
 * has been shared on as Editor.
 */

let _sheets: sheets_v4.Sheets | null = null;

function getSheetsClient(): sheets_v4.Sheets {
  if (_sheets) return _sheets;

  const auth = new google.auth.GoogleAuth({
    // Full read/write scope — needed for editing CRM sheets
    scopes: ["https://www.googleapis.com/auth/spreadsheets"],
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

/** Which sheets are editable (not all are — Master is read-only) */
export const EDITABLE_SHEETS: Record<string, string> = {
  crm_historique: SHEET_IDS.CRM_HISTORIQUE,
  crm_segmentation: SHEET_IDS.CRM_SEGMENTATION,
};

/** Archive sheet name convention (same as Nouvelle-production-Bleuh) */
const ARCHIVE_PREFIX = "Archive_";

export interface SheetData {
  headers: string[];
  rows: Record<string, string>[];
  sheetTitle: string;
}

// ────────────────────────────────────────────────
// READ
// ────────────────────────────────────────────────

/**
 * Read all data from a sheet tab.
 * Returns headers + rows as key-value objects.
 */
export async function readSheet(
  spreadsheetId: string,
  range?: string
): Promise<SheetData> {
  const sheets = getSheetsClient();

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
  return (meta.data.sheets || [])
    .map((s) => s.properties?.title || "")
    .filter(Boolean);
}

// ────────────────────────────────────────────────
// WRITE / EDIT
// ────────────────────────────────────────────────

/**
 * Update a single cell or range in a sheet.
 */
export async function updateSheetCell(
  spreadsheetId: string,
  range: string,
  values: string[][]
): Promise<void> {
  const sheets = getSheetsClient();
  await sheets.spreadsheets.values.update({
    spreadsheetId,
    range,
    valueInputOption: "USER_ENTERED",
    requestBody: { values },
  });
}

/**
 * Read a single row by its 1-indexed row number.
 * Returns the raw array of cell values.
 */
export async function readRow(
  spreadsheetId: string,
  sheetTitle: string,
  rowIndex: number
): Promise<string[]> {
  const sheets = getSheetsClient();
  const response = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range: `${sheetTitle}!A${rowIndex}:ZZ${rowIndex}`,
  });
  if (!response.data.values || response.data.values.length === 0) {
    throw new Error(`Ligne ${rowIndex} introuvable dans ${sheetTitle}`);
  }
  return response.data.values[0].map((v: unknown) => String(v ?? ""));
}

/**
 * Read headers (row 1) of a sheet tab.
 */
export async function readHeaders(
  spreadsheetId: string,
  sheetTitle: string
): Promise<string[]> {
  const sheets = getSheetsClient();
  const response = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range: `${sheetTitle}!1:1`,
  });
  if (!response.data.values || response.data.values.length === 0) {
    return [];
  }
  return response.data.values[0].map((h: unknown) => String(h ?? "").trim());
}

// ────────────────────────────────────────────────
// ARCHIVE (same pattern as Nouvelle-production-Bleuh)
// ────────────────────────────────────────────────

/**
 * Ensure an archive tab exists for the given source tab.
 * Creates it with the same headers + "Date Archivage" + "Archivé par" + "Raison".
 * Returns the archive sheet title.
 */
export async function ensureArchiveTab(
  spreadsheetId: string,
  sourceTab: string
): Promise<string> {
  const sheets = getSheetsClient();
  const archiveTab = `${ARCHIVE_PREFIX}${sourceTab}`;

  const meta = await sheets.spreadsheets.get({ spreadsheetId });
  const exists = (meta.data.sheets || []).some(
    (s) => s.properties?.title === archiveTab
  );

  if (!exists) {
    // Create the archive tab
    await sheets.spreadsheets.batchUpdate({
      spreadsheetId,
      requestBody: {
        requests: [
          {
            addSheet: {
              properties: { title: archiveTab },
            },
          },
        ],
      },
    });

    // Copy headers from source + archive metadata columns
    const sourceHeaders = await readHeaders(spreadsheetId, sourceTab);
    const archiveHeaders = [
      ...sourceHeaders,
      "Date Archivage",
      "Archivé par",
      "Raison",
    ];

    await sheets.spreadsheets.values.update({
      spreadsheetId,
      range: `${archiveTab}!A1`,
      valueInputOption: "RAW",
      requestBody: { values: [archiveHeaders] },
    });
  }

  return archiveTab;
}

/**
 * Archive a row: copies it to the archive tab with metadata, then clears the original.
 *
 * @param spreadsheetId - The spreadsheet ID
 * @param sourceTab - The source tab name
 * @param rowIndex - 1-indexed row number (must be >= 2, row 1 = headers)
 * @param archivedBy - Email of the person archiving
 * @param reason - Why the row was archived (e.g., "edit", "delete")
 */
export async function archiveRow(
  spreadsheetId: string,
  sourceTab: string,
  rowIndex: number,
  archivedBy: string,
  reason: string
): Promise<void> {
  if (rowIndex < 2) throw new Error("Cannot archive header row");

  // 1. Read the row to archive
  const rowData = await readRow(spreadsheetId, sourceTab, rowIndex);

  // 2. Ensure archive tab exists
  const archiveTab = await ensureArchiveTab(spreadsheetId, sourceTab);

  // 3. Append to archive tab
  const sheets = getSheetsClient();
  const now = new Date();
  const dateArchivage =
    now.toLocaleDateString("fr-CA") + " " + now.toLocaleTimeString("fr-CA");

  await sheets.spreadsheets.values.append({
    spreadsheetId,
    range: `${archiveTab}!A1`,
    valueInputOption: "USER_ENTERED",
    requestBody: {
      values: [[...rowData, dateArchivage, archivedBy, reason]],
    },
  });
}

/**
 * Delete a row from a sheet (shifts rows up).
 * First archives the row for safety.
 */
export async function deleteRow(
  spreadsheetId: string,
  sourceTab: string,
  rowIndex: number,
  deletedBy: string,
  reason: string
): Promise<void> {
  if (rowIndex < 2) throw new Error("Cannot delete header row");

  // 1. Archive first (safety net)
  await archiveRow(spreadsheetId, sourceTab, rowIndex, deletedBy, reason);

  // 2. Find the sheetId for the tab
  const sheets = getSheetsClient();
  const meta = await sheets.spreadsheets.get({ spreadsheetId });
  const sheet = (meta.data.sheets || []).find(
    (s) => s.properties?.title === sourceTab
  );
  if (!sheet?.properties?.sheetId && sheet?.properties?.sheetId !== 0) {
    throw new Error(`Onglet '${sourceTab}' introuvable`);
  }

  // 3. Delete the row
  await sheets.spreadsheets.batchUpdate({
    spreadsheetId,
    requestBody: {
      requests: [
        {
          deleteDimension: {
            range: {
              sheetId: sheet.properties.sheetId,
              dimension: "ROWS",
              startIndex: rowIndex - 1, // 0-indexed
              endIndex: rowIndex,
            },
          },
        },
      ],
    },
  });
}
