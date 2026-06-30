import { NextRequest, NextResponse } from "next/server";
import { requireSession } from "@/lib/auth-server";

// POST /api/analyses/[id]/run → Lancer l'exécution (croisement données)
export async function POST(_req: NextRequest, _ctx: { params: Promise<{ id: string }> }) {
  await requireSession();
  // TODO: implémenter — voir Antigravity.md
  return NextResponse.json({ success: true });
}
