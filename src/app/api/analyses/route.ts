import { NextRequest, NextResponse } from "next/server";
import { requireSession } from "@/lib/auth-server";
import type { Analysis } from "@/lib/types-ocs";

// GET /api/analyses → Liste des analyses
export async function GET() {
  await requireSession();
  // TODO: implémenter — voir Antigravity.md
  const analyses: Analysis[] = [];
  return NextResponse.json(analyses);
}

// POST /api/analyses → Créer une analyse
export async function POST(_req: NextRequest) {
  await requireSession();
  // TODO: implémenter — voir Antigravity.md
  return NextResponse.json({ success: true });
}
