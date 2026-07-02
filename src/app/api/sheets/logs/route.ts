import { NextRequest, NextResponse } from "next/server";
import { requireSession } from "@/lib/auth-server";
import { adminDb } from "@/lib/firebase-admin";

export const runtime = "nodejs";

/**
 * GET /api/sheets/logs — Historique des modifications de sheets
 *
 * Query params:
 * - sheet: (optional) filter by sheet key
 * - limit: (optional) max results (default 50, max 200)
 */
export async function GET(req: NextRequest) {
  await requireSession();
  const db = adminDb();

  const url = new URL(req.url);
  const sheetFilter = url.searchParams.get("sheet") || "";
  const limit = Math.min(Number(url.searchParams.get("limit")) || 50, 200);

  let query: FirebaseFirestore.Query = db
    .collection("sheet_edit_logs")
    .orderBy("performed_at", "desc")
    .limit(limit);

  if (sheetFilter) {
    query = query.where("sheet", "==", sheetFilter);
  }

  const snap = await query.get();
  const logs = snap.docs.map((doc) => ({ id: doc.id, ...doc.data() }));

  return NextResponse.json({ logs });
}
