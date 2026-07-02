import { NextRequest, NextResponse } from "next/server";
import { requireSession } from "@/lib/auth-server";
import { adminDb } from "@/lib/firebase-admin";

export const runtime = "nodejs";

type RouteContext = { params: Promise<{ id: string }> };

/**
 * GET /api/stores/[id]/changelog — Historique des modifications
 */
export async function GET(_req: NextRequest, ctx: RouteContext) {
  await requireSession();
  const { id } = await ctx.params;
  const db = adminDb();

  const snap = await db
    .collection("stores")
    .doc(id)
    .collection("changelog")
    .orderBy("performed_at", "desc")
    .limit(50)
    .get();

  const changelog = snap.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
  return NextResponse.json({ changelog });
}
