import { NextRequest, NextResponse } from "next/server";
import { requireSession } from "@/lib/auth-server";
import { readSheet, listSheetTabs, SHEET_IDS } from "@/lib/google-sheets";

export const runtime = "nodejs";

/** Allowed sheet keys (validated against allow-list to prevent SSRF) */
const ALLOWED_SHEETS: Record<string, string> = {
  crm_historique: SHEET_IDS.CRM_HISTORIQUE,
  crm_segmentation: SHEET_IDS.CRM_SEGMENTATION,
  db_products_master: SHEET_IDS.DB_PRODUCTS_MASTER,
};

/**
 * GET /api/sheets?sheet=crm_historique&tab=Sheet1
 *
 * Read data from a known Google Sheet.
 * - sheet: one of crm_historique, crm_segmentation, db_products_master
 * - tab: optional sheet tab name (default: first tab)
 */
export async function GET(req: NextRequest) {
  await requireSession();

  const url = new URL(req.url);
  const sheetKey = url.searchParams.get("sheet") || "";
  const tab = url.searchParams.get("tab") || "";

  // Validate against allow-list (prevent arbitrary spreadsheet access)
  const spreadsheetId = ALLOWED_SHEETS[sheetKey];
  if (!spreadsheetId) {
    return NextResponse.json(
      {
        error: `Sheet inconnu: '${sheetKey}'. Valeurs: ${Object.keys(ALLOWED_SHEETS).join(", ")}`,
      },
      { status: 400 }
    );
  }

  try {
    // If requesting tabs list
    if (url.searchParams.get("tabs") === "true") {
      const tabs = await listSheetTabs(spreadsheetId);
      return NextResponse.json({ tabs });
    }

    const range = tab ? `${tab}!A:ZZ` : undefined;
    const data = await readSheet(spreadsheetId, range);

    return NextResponse.json({
      sheet: sheetKey,
      sheetTitle: data.sheetTitle,
      headers: data.headers,
      rowCount: data.rows.length,
      rows: data.rows,
    });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Erreur inconnue";
    // Don't expose internal details
    const safeMsg = msg.includes("not found")
      ? "Feuille introuvable"
      : msg.includes("permission")
        ? "Accès refusé au spreadsheet"
        : "Erreur lors de la lecture du spreadsheet";
    return NextResponse.json({ error: safeMsg }, { status: 500 });
  }
}
