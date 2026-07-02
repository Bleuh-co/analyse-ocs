import { NextResponse } from "next/server";
import { requireSession } from "@/lib/auth-server";
import { adminDb } from "@/lib/firebase-admin";

export const runtime = "nodejs";

/**
 * GET /api/uploads — Historique des imports
 */
export async function GET() {
  await requireSession();
  const db = adminDb();

  const snapshot = await db
    .collection("ontario_uploads")
    .orderBy("uploaded_at", "desc")
    .limit(20)
    .get();

  const uploads = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
  return NextResponse.json({ uploads });
}
