import { NextRequest, NextResponse } from "next/server";
import { requireSession } from "@/lib/auth-server";
import type { UploadedDocument } from "@/lib/types-ocs";

// GET /api/documents → Liste des documents
export async function GET() {
  await requireSession();
  // TODO: implémenter — voir Antigravity.md
  const documents: UploadedDocument[] = [];
  return NextResponse.json(documents);
}

// POST /api/documents → Uploader un document
export async function POST(_req: NextRequest) {
  await requireSession();
  // TODO: implémenter — voir Antigravity.md
  return NextResponse.json({ success: true });
}
