import { NextRequest, NextResponse } from "next/server";
import { requireGestionnaire } from "@/lib/auth-server";
import { adminDb } from "@/lib/firebase-admin";
import {
  EDITABLE_SHEETS,
  readHeaders,
  readRow,
  updateSheetCell,
  archiveRow,
  deleteRow,
} from "@/lib/google-sheets";

export const runtime = "nodejs";

const EDIT_LOG_COLLECTION = "sheet_edit_logs";

/**
 * POST /api/sheets/edit — Modifier une cellule ou ligne dans un Google Sheet
 *
 * Body:
 * - sheet: "crm_historique" | "crm_segmentation"
 * - tab: sheet tab name
 * - rowIndex: 1-indexed row number (>= 2)
 * - updates: { [columnHeader]: newValue }
 */
export async function POST(req: NextRequest) {
  const session = await requireGestionnaire();
  const body = await req.json();

  const { sheet, tab, rowIndex, updates } = body as {
    sheet: string;
    tab: string;
    rowIndex: number;
    updates: Record<string, string>;
  };

  // Validate sheet is editable
  const spreadsheetId = EDITABLE_SHEETS[sheet];
  if (!spreadsheetId) {
    return NextResponse.json(
      { error: `Ce sheet n'est pas éditable. Sheets éditables: ${Object.keys(EDITABLE_SHEETS).join(", ")}` },
      { status: 400 }
    );
  }

  if (!tab || typeof tab !== "string") {
    return NextResponse.json({ error: "Onglet (tab) requis" }, { status: 400 });
  }

  if (!rowIndex || typeof rowIndex !== "number" || rowIndex < 2) {
    return NextResponse.json(
      { error: "rowIndex requis (>= 2, la ligne 1 est les en-têtes)" },
      { status: 400 }
    );
  }

  if (!updates || typeof updates !== "object" || Object.keys(updates).length === 0) {
    return NextResponse.json(
      { error: "Aucune modification fournie (updates vide)" },
      { status: 400 }
    );
  }

  // Sanitize: limit field values to 1000 chars
  for (const key of Object.keys(updates)) {
    if (typeof updates[key] !== "string") {
      updates[key] = String(updates[key] ?? "");
    }
    if (updates[key].length > 1000) {
      updates[key] = updates[key].substring(0, 1000);
    }
  }

  try {
    // 1. Read current headers to find column indices
    const headers = await readHeaders(spreadsheetId, tab);
    if (headers.length === 0) {
      return NextResponse.json(
        { error: "Impossible de lire les en-têtes du sheet" },
        { status: 500 }
      );
    }

    // 2. Read current row (for archive + diff)
    const currentRow = await readRow(spreadsheetId, tab, rowIndex);

    // 3. Archive the row BEFORE editing (safety net)
    await archiveRow(spreadsheetId, tab, rowIndex, session.email, "edit");

    // 4. Compute diff and apply updates column by column
    const diff: Record<string, { from: string; to: string }> = {};

    for (const [colName, newValue] of Object.entries(updates)) {
      const colIndex = headers.indexOf(colName);
      if (colIndex === -1) {
        continue; // Skip unknown columns silently
      }

      const oldValue = currentRow[colIndex] || "";
      if (oldValue === newValue) continue; // No change

      diff[colName] = { from: oldValue, to: newValue };

      // Column letter (A=0, B=1, ..., Z=25, AA=26, etc.)
      const colLetter = columnIndexToLetter(colIndex);
      const cellRange = `${tab}!${colLetter}${rowIndex}`;

      await updateSheetCell(spreadsheetId, cellRange, [[newValue]]);
    }

    // 5. Log the edit in Firestore
    if (Object.keys(diff).length > 0) {
      const db = adminDb();
      await db.collection(EDIT_LOG_COLLECTION).add({
        action: "edit",
        sheet,
        tab,
        row_index: rowIndex,
        changed_fields: diff,
        performed_by: session.email,
        performed_at: new Date(),
      });
    }

    return NextResponse.json({
      status: "success",
      changes: Object.keys(diff).length,
      diff,
    });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Erreur inconnue";
    console.error("Sheet edit error:", msg);

    const safeMsg = msg.includes("permission")
      ? "Accès refusé — le service account n'a pas les droits d'éditeur sur ce sheet"
      : "Erreur lors de la modification du sheet";
    return NextResponse.json({ error: safeMsg }, { status: 500 });
  }
}

/**
 * Convert a 0-indexed column number to a letter (A, B, ..., Z, AA, AB, ...).
 */
function columnIndexToLetter(index: number): string {
  let letter = "";
  let n = index;
  while (n >= 0) {
    letter = String.fromCharCode((n % 26) + 65) + letter;
    n = Math.floor(n / 26) - 1;
  }
  return letter;
}
