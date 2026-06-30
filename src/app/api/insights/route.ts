import { NextRequest, NextResponse } from "next/server";
import { requireSession } from "@/lib/auth-server";

// POST /api/insights → Générer insights via LLM
export async function POST(_req: NextRequest) {
  await requireSession();
  // TODO: implémenter — voir Antigravity.md
  return NextResponse.json({ success: true, insights: [] });
}
