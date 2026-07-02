import { NextRequest, NextResponse } from "next/server";
import { requireGestionnaire } from "@/lib/auth-server";
import { adminDb } from "@/lib/firebase-admin";
import { EDITABLE_SHEETS, deleteRow } from "@/lib/google-sheets";

export const runtime = "nodejs";

const EDIT_LOG_COLLECTION = "sheet_edit_logs";

/**
 * POST /api/sheets/delete — Supprimer une ligne d'un Google Sheet
 *
 * La ligne est ARCHIVÉE automatiquement avant suppression (filet de sécurité).
 *
 * Body:
 * - sheet: "crm_historique" | "crm_segmentation"
 * - tab: sheet tab name
 * - rowIndex: 1-indexed row number (>= 2)
 * - reason: (optional) why the row is being deleted
 */
export async function POST(req: NextRequest) {
  const session = await requireGestionnaire();
  const body = await req.json();

  const { sheet, tab, rowIndex, reason } = body as {
    sheet: string;
    tab: string;
    rowIndex: number;
    reason?: string;
  };

  // Validate sheet is editable
  const spreadsheetId = EDITABLE_SHEETS[sheet];
  if (!spreadsheetId) {
    return NextResponse.json(
      { error: `Ce sheet n'est pas supprimable. Sheets éditables: ${Object.keys(EDITABLE_SHEETS).join(", ")}` },
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

  // Sanitize reason
  const safeReason = typeof reason === "string"
    ? reason.trim().substring(0, 500)
    : "Suppression manuelle";

  try {
    // deleteRow archives first, then deletes
    await deleteRow(spreadsheetId, tab, rowIndex, session.email, safeReason);

    // Log the deletion in Firestore
    const db = adminDb();
    await db.collection(EDIT_LOG_COLLECTION).add({
      action: "delete",
      sheet,
      tab,
      row_index: rowIndex,
      reason: safeReason,
      performed_by: session.email,
      performed_at: new Date(),
    });

    return NextResponse.json({ status: "deleted" });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Erreur inconnue";
    console.error("Sheet delete error:", msg);

    const safeMsg = msg.includes("permission")
      ? "Accès refusé — le service account n'a pas les droits d'éditeur sur ce sheet"
      : msg.includes("introuvable")
        ? msg
        : "Erreur lors de la suppression";
    return NextResponse.json({ error: safeMsg }, { status: 500 });
  }
}
