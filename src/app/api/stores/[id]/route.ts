import { NextRequest, NextResponse } from "next/server";
import { requireSession, requireGestionnaire, requireAdmin } from "@/lib/auth-server";
import { adminDb } from "@/lib/firebase-admin";

export const runtime = "nodejs";

type RouteContext = { params: Promise<{ id: string }> };

// Champs modifiables (allow-list stricte)
const ALLOWED_FIELDS = [
  "name", "address", "city", "state", "postal_code", "phone", "website",
  "email", "lat", "lng", "tags", "store_number", "representative",
  "region", "has_display", "archived",
];

function computeDiff(
  oldData: Record<string, unknown>,
  newData: Record<string, unknown>
): Record<string, { from: unknown; to: unknown }> {
  const diff: Record<string, { from: unknown; to: unknown }> = {};
  for (const key of Object.keys(newData)) {
    if (["updated_at", "updated_by"].includes(key)) continue;
    if (JSON.stringify(oldData[key]) !== JSON.stringify(newData[key])) {
      diff[key] = { from: oldData[key] ?? null, to: newData[key] };
    }
  }
  return diff;
}

/**
 * GET /api/stores/[id] — Détail d'un store + ses produits
 */
export async function GET(_req: NextRequest, ctx: RouteContext) {
  await requireSession();
  const { id } = await ctx.params;
  const db = adminDb();

  const storeDoc = await db.collection("stores").doc(id).get();
  if (!storeDoc.exists) {
    return NextResponse.json({ error: "Store non trouvé" }, { status: 404 });
  }

  const store = { id: storeDoc.id, ...storeDoc.data() };

  const productsSnap = await db
    .collection("stores")
    .doc(id)
    .collection("products")
    .get();
  const products = productsSnap.docs.map((doc) => ({ id: doc.id, ...doc.data() }));

  return NextResponse.json({ store, products });
}

/**
 * PUT /api/stores/[id] — Modifier un store
 */
export async function PUT(req: NextRequest, ctx: RouteContext) {
  const session = await requireGestionnaire();
  const { id } = await ctx.params;
  const body = await req.json();
  const db = adminDb();

  // Allow-list stricte
  const updateData: Record<string, unknown> = {};
  for (const key of ALLOWED_FIELDS) {
    if (body[key] !== undefined) updateData[key] = body[key];
  }
  updateData.updated_at = new Date();
  updateData.updated_by = session.email;

  // Fetch old data for changelog diff
  const oldDoc = await db.collection("stores").doc(id).get();
  if (!oldDoc.exists) {
    return NextResponse.json({ error: "Store non trouvé" }, { status: 404 });
  }
  const oldData = oldDoc.data() || {};

  await db.collection("stores").doc(id).update(updateData);

  // Changelog
  const diff = computeDiff(oldData, updateData);
  if (Object.keys(diff).length > 0) {
    await db
      .collection("stores")
      .doc(id)
      .collection("changelog")
      .add({
        action: "updated",
        changed_fields: diff,
        performed_by: session.email,
        performed_at: new Date(),
      });
  }

  return NextResponse.json({ status: "success" });
}

/**
 * DELETE /api/stores/[id] — Supprimer un store et ses produits (admin only)
 */
export async function DELETE(_req: NextRequest, ctx: RouteContext) {
  const session = await requireAdmin();
  const { id } = await ctx.params;
  const db = adminDb();

  const storeRef = db.collection("stores").doc(id);
  const storeDoc = await storeRef.get();
  if (!storeDoc.exists) {
    return NextResponse.json({ error: "Store non trouvé" }, { status: 404 });
  }

  // Changelog avant suppression
  await storeRef.collection("changelog").add({
    action: "deleted",
    changed_fields: { name: storeDoc.data()?.name },
    performed_by: session.email,
    performed_at: new Date(),
  });

  // Supprimer les sous-collections
  const productsSnap = await storeRef.collection("products").get();
  const batch = db.batch();
  productsSnap.docs.forEach((doc) => batch.delete(doc.ref));
  batch.delete(storeRef);
  await batch.commit();

  return NextResponse.json({ status: "success", deleted: id });
}
