import { NextRequest, NextResponse } from "next/server";
import { requireSession, requireGestionnaire } from "@/lib/auth-server";
import { adminDb } from "@/lib/firebase-admin";

export const runtime = "nodejs";

const COLLECTION = "marketing_actions";

// Allowed action types (validated server-side)
const VALID_ACTION_TYPES = [
  "plv_envoye",
  "plv_installe",
  "visite_terrain",
  "courriel",
  "appel",
  "sms",
  "formation",
  "promo",
  "evenement",
  "autre",
] as const;

/**
 * GET /api/marketing-actions — Liste paginée des actions marketing
 */
export async function GET(req: NextRequest) {
  await requireSession();
  const db = adminDb();

  const url = new URL(req.url);
  const limit = Math.min(Number(url.searchParams.get("limit")) || 50, 200);
  const storeId = url.searchParams.get("storeId") || "";
  const actionType = url.searchParams.get("type") || "";

  let query: FirebaseFirestore.Query = db
    .collection(COLLECTION)
    .orderBy("action_date", "desc")
    .limit(limit);

  if (storeId) {
    query = query.where("store_id", "==", storeId);
  }

  const snap = await query.get();
  let actions = snap.docs.map((d) => ({ id: d.id, ...d.data() }));

  // Client-side filter for type (avoids composite index)
  if (actionType) {
    actions = actions.filter(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (a: any) => a.action_type === actionType
    );
  }

  return NextResponse.json({ actions });
}

/**
 * POST /api/marketing-actions — Créer une action marketing
 * Requiert rôle gestionnaire minimum.
 */
export async function POST(req: NextRequest) {
  const session = await requireGestionnaire();
  const db = adminDb();

  const body = await req.json();

  // Validation des champs requis
  const { campaign, action_type, store_id, store_name, action_date } = body;

  if (!campaign || typeof campaign !== "string" || campaign.length > 200) {
    return NextResponse.json(
      { error: "Campagne requise (max 200 caractères)" },
      { status: 400 }
    );
  }
  if (!action_type || !VALID_ACTION_TYPES.includes(action_type)) {
    return NextResponse.json(
      { error: `Type d'action invalide. Valeurs: ${VALID_ACTION_TYPES.join(", ")}` },
      { status: 400 }
    );
  }
  if (!store_id || typeof store_id !== "string") {
    return NextResponse.json({ error: "Store ID requis" }, { status: 400 });
  }
  if (!action_date || !/^\d{4}-\d{2}-\d{2}$/.test(action_date)) {
    return NextResponse.json(
      { error: "Date de l'action requise (format YYYY-MM-DD)" },
      { status: 400 }
    );
  }

  // Sanitize string fields (max lengths)
  const sanitizeStr = (val: unknown, maxLen: number): string => {
    if (typeof val !== "string") return "";
    return val.trim().substring(0, maxLen);
  };

  const data = {
    campaign: sanitizeStr(campaign, 200),
    action_type,
    sku: sanitizeStr(body.sku, 50),
    product_name: sanitizeStr(body.product_name, 200),
    store_id: sanitizeStr(store_id, 100),
    store_name: sanitizeStr(store_name, 200),
    store_address: sanitizeStr(body.store_address, 300),
    store_city: sanitizeStr(body.store_city, 100),
    store_region: sanitizeStr(body.store_region, 100),
    action_date,
    responsible: sanitizeStr(body.responsible, 200),
    status: sanitizeStr(body.status, 50) || "planifie",
    plv_type: sanitizeStr(body.plv_type, 100),
    cost: typeof body.cost === "number" && body.cost >= 0 ? body.cost : null,
    objective: sanitizeStr(body.objective, 500),
    proof_link: sanitizeStr(body.proof_link, 500),
    notes: sanitizeStr(body.notes, 1000),
    created_at: new Date(),
    created_by: session.email,
    updated_at: new Date(),
  };

  const ref = await db.collection(COLLECTION).add(data);

  return NextResponse.json({ id: ref.id, ...data });
}
