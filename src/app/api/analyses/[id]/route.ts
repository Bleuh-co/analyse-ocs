import { NextRequest, NextResponse } from "next/server";
import { requireSession } from "@/lib/auth-server";

// GET /api/analyses/[id] → Détail d'une analyse
export async function GET(_req: NextRequest, _ctx: { params: Promise<{ id: string }> }) {
  await requireSession();
  // TODO: implémenter — voir Antigravity.md
  return NextResponse.json({});
}

// PUT /api/analyses/[id] → Modifier une analyse
export async function PUT(_req: NextRequest, _ctx: { params: Promise<{ id: string }> }) {
  await requireSession();
  // TODO: implémenter — voir Antigravity.md
  return NextResponse.json({ success: true });
}

// DELETE /api/analyses/[id] → Supprimer une analyse
export async function DELETE(_req: NextRequest, _ctx: { params: Promise<{ id: string }> }) {
  await requireSession();
  // TODO: implémenter — voir Antigravity.md
  return NextResponse.json({ success: true });
}
