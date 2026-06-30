import { NextRequest, NextResponse } from "next/server";
import { requireSession } from "@/lib/auth-server";
import type { ApiSource } from "@/lib/types-ocs";

// GET /api/sources → Liste des sources API
export async function GET() {
  await requireSession();
  // TODO: implémenter — voir Antigravity.md
  const sources: ApiSource[] = [];
  return NextResponse.json(sources);
}

// POST /api/sources → Créer une source API
export async function POST(_req: NextRequest) {
  await requireSession();
  // TODO: implémenter — voir Antigravity.md
  return NextResponse.json({ success: true });
}
