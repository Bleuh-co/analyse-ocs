import { NextRequest, NextResponse } from "next/server";
import { requireSession, requireGestionnaire } from "@/lib/auth-server";
import { adminDb } from "@/lib/firebase-admin";

export const runtime = "nodejs";

// Seuil d'archivage : 4 mois sans mise à jour
const ARCHIVE_THRESHOLD_MS = 4 * 30 * 24 * 60 * 60 * 1000;

/**
 * GET /api/stores — Liste les stores Ontario
 * Query params: province, region, city, include_archived, search
 */
export async function GET(req: NextRequest) {
  await requireSession();
  const { searchParams } = req.nextUrl;
  const province = searchParams.get("province");
  const region = searchParams.get("region");
  const city = searchParams.get("city");
  const includeArchived = searchParams.get("include_archived") === "true";
  const search = searchParams.get("search")?.toLowerCase();

  const db = adminDb();
  let query: FirebaseFirestore.Query = db.collection("stores");
  if (province) {
    query = query.where("province", "==", province.toUpperCase());
  }

  const snapshot = await query.get();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let stores: any[] = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));

  // Auto-archivage
  if (!includeArchived) {
    const now = Date.now();
    stores = stores.filter((s) => {
      if (s.archived === true) return false;
      const updatedAt = s.updated_at?._seconds
        ? s.updated_at._seconds * 1000
        : s.updated_at instanceof Date
          ? s.updated_at.getTime()
          : Date.parse(s.updated_at);
      if (!updatedAt || isNaN(updatedAt)) return true;
      return now - updatedAt < ARCHIVE_THRESHOLD_MS;
    });
  }

  // Filtres côté serveur
  if (region) {
    const rl = region.toLowerCase();
    stores = stores.filter((s) => (s.region || "").toLowerCase().includes(rl));
  }
  if (city) {
    const cl = city.toLowerCase();
    stores = stores.filter((s) => (s.city || "").toLowerCase().includes(cl));
  }
  if (search) {
    stores = stores.filter(
      (s) =>
        (s.name || "").toLowerCase().includes(search) ||
        (s.city || "").toLowerCase().includes(search) ||
        (s.address || "").toLowerCase().includes(search) ||
        (s.postal_code || "").toLowerCase().includes(search)
    );
  }

  stores.sort((a, b) => (a.name || "").localeCompare(b.name || ""));

  return NextResponse.json({ stores, total: stores.length });
}

/**
 * POST /api/stores — Créer un nouveau store
 */
export async function POST(req: NextRequest) {
  const session = await requireGestionnaire();
  const body = await req.json();

  if (!body.name) {
    return NextResponse.json({ error: "Le nom du store est requis" }, { status: 400 });
  }

  const db = adminDb();
  const storeNumber =
    body.store_number || `ONTARIO-${Date.now().toString(36).toUpperCase()}`;
  const docId = storeNumber;

  const storeData = {
    name: body.name,
    store_number: storeNumber,
    province: "ON",
    source: "manual",
    address: body.address || "",
    city: body.city || "",
    state: body.state || "ON",
    postal_code: (body.postal_code || "").replace(/\s/g, "").toUpperCase(),
    phone: body.phone || "",
    website: body.website || "",
    email: body.email || "",
    representative: body.representative || "",
    region: body.region || "",
    has_display: body.has_display || false,
    lat: body.lat || null,
    lng: body.lng || null,
    tags: body.tags || [],
    archived: false,
    created_at: new Date(),
    updated_at: new Date(),
    created_by: session.email,
  };

  await db.collection("stores").doc(docId).set(storeData);

  // Changelog
  await db
    .collection("stores")
    .doc(docId)
    .collection("changelog")
    .add({
      action: "created",
      changed_fields: storeData,
      performed_by: session.email,
      performed_at: new Date(),
    });

  return NextResponse.json({ status: "success", id: docId, store_number: storeNumber });
}
