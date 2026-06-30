import { NextRequest, NextResponse } from "next/server";
import { requireSession } from "@/lib/auth-server";

// POST /api/documents/[id]/parse → Parser un document
export async function POST(_req: NextRequest, _ctx: { params: Promise<{ id: string }> }) {
  await requireSession();
  // TODO: implémenter — voir Antigravity.md
  return NextResponse.json({ success: true });
}
