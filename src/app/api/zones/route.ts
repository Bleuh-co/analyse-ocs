import { NextRequest, NextResponse } from "next/server";
import { requireSession } from "@/lib/auth-server";
import type { Zone } from "@/lib/types-ocs";

// GET /api/zones → Liste des zones
export async function GET() {
  await requireSession();
  // TODO: implémenter — voir Antigravity.md
  const zones: Zone[] = [];
  return NextResponse.json(zones);
}

// POST /api/zones → Créer une zone
export async function POST(_req: NextRequest) {
  await requireSession();
  // TODO: implémenter — voir Antigravity.md
  return NextResponse.json({ success: true });
}
