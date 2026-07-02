import { NextRequest, NextResponse } from "next/server";
import { requireGestionnaire } from "@/lib/auth-server";
import { adminDb } from "@/lib/firebase-admin";
import { parseAndMatchOcsXlsx, type ExistingStore } from "@/lib/ocs-parser";

export const runtime = "nodejs";

// Taille max : 10 MB
const MAX_SIZE = 10 * 1024 * 1024;

/**
 * POST /api/upload/parse — Reçoit un xlsx, le parse et retourne le preview du matching
 */
export async function POST(req: NextRequest) {
  await requireGestionnaire();

  const formData = await req.formData();
  const file = formData.get("file") as File | null;

  if (!file) {
    return NextResponse.json({ error: "Aucun fichier reçu" }, { status: 400 });
  }

  // Validation extension
  const name = file.name.toLowerCase();
  if (!name.endsWith(".xlsx") && !name.endsWith(".xls")) {
    return NextResponse.json(
      { error: "Seuls les fichiers .xlsx / .xls sont acceptés" },
      { status: 400 }
    );
  }

  // Validation taille
  if (file.size > MAX_SIZE) {
    return NextResponse.json(
      { error: "Le fichier dépasse la taille maximale de 10 MB" },
      { status: 400 }
    );
  }

  const buffer = Buffer.from(await file.arrayBuffer());

  // Charger les stores existants pour le matching
  const db = adminDb();
  const storesSnap = await db.collection("stores").get();
  const existingStores: ExistingStore[] = storesSnap.docs.map((doc) => ({
    id: doc.id,
    ...doc.data(),
  }));

  const result = await parseAndMatchOcsXlsx(buffer, existingStores, file.name);

  return NextResponse.json(result);
}
