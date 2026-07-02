import { NextRequest, NextResponse } from "next/server";
import { requireSession, requireGestionnaire } from "@/lib/auth-server";
import { adminDb } from "@/lib/firebase-admin";
import { coerceToIsoDate } from "@/lib/ocs-parser";

export const runtime = "nodejs";

const COLLECTION = "marketing_actions";

const VALID_ACTION_TYPES = [
  "plv_envoye", "plv_installe", "visite_terrain", "courriel",
  "appel", "sms", "formation", "promo", "evenement", "autre",
] as const;

type Params = { params: Promise<{ id: string }> };

/**
 * GET /api/marketing-actions/[id] — Détail d'une action + calcul d'impact
 */
export async function GET(_req: NextRequest, ctx: Params) {
  await requireSession();
  const { id } = await ctx.params;
  const db = adminDb();

  const doc = await db.collection(COLLECTION).doc(id).get();
  if (!doc.exists) {
    return NextResponse.json({ error: "Action introuvable" }, { status: 404 });
  }

  const action = { id: doc.id, ...doc.data() };

  // Calcul d'impact : ventes before/after (14 jours)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const actionData = action as any;
  let impact = null;

  if (actionData.store_id && actionData.action_date) {
    const actionDate = actionData.action_date as string;
    const storeId = actionData.store_id as string;
    const sku = (actionData.sku as string) || "";

    // Calculer les dates before/after
    const d = new Date(actionDate + "T00:00:00");
    const before14 = new Date(d.getTime() - 14 * 86400000)
      .toISOString()
      .split("T")[0];
    const after14 = new Date(d.getTime() + 14 * 86400000)
      .toISOString()
      .split("T")[0];

    // Charger tous les products du store
    const prodsSnap = await db
      .collection("stores")
      .doc(storeId)
      .collection("products")
      .get();

    let unitsBefore = 0;
    let unitsAfter = 0;
    let firstOrderAfter: string | null = null;

    for (const pDoc of prodsSnap.docs) {
      const p = pDoc.data();
      // Normalise ISO / serial Excel (legacy) / Timestamp
      const orderDate = coerceToIsoDate(p.last_order_date);
      const units = Number(p.units_sold) || 0;

      // Si on a un SKU cible, filtrer
      if (sku && (p.sku as string) !== sku && pDoc.id !== sku) continue;

      if (orderDate >= before14 && orderDate < actionDate) {
        unitsBefore += units;
      }
      if (orderDate >= actionDate && orderDate <= after14) {
        unitsAfter += units;
        if (!firstOrderAfter || orderDate < firstOrderAfter) {
          firstOrderAfter = orderDate;
        }
      }
    }

    const liftUnits = unitsAfter - unitsBefore;
    const liftPercent =
      unitsBefore > 0 ? Math.round((liftUnits / unitsBefore) * 100) : null;

    // Jours de réaction
    let reactionDays: number | null = null;
    if (firstOrderAfter) {
      const diff =
        new Date(firstOrderAfter).getTime() - new Date(actionDate).getTime();
      reactionDays = Math.round(diff / 86400000);
    }

    impact = {
      period_days: 14,
      units_before: unitsBefore,
      units_after: unitsAfter,
      lift_units: liftUnits,
      lift_percent: liftPercent,
      reacted: unitsAfter > 0,
      reaction_days: reactionDays,
    };
  }

  return NextResponse.json({ action, impact });
}

/**
 * PUT /api/marketing-actions/[id] — Modifier une action
 */
export async function PUT(req: NextRequest, ctx: Params) {
  await requireGestionnaire();
  const { id } = await ctx.params;
  const db = adminDb();

  const ref = db.collection(COLLECTION).doc(id);
  const doc = await ref.get();
  if (!doc.exists) {
    return NextResponse.json({ error: "Action introuvable" }, { status: 404 });
  }

  const body = await req.json();

  // Validate action_type if provided
  if (body.action_type && !VALID_ACTION_TYPES.includes(body.action_type)) {
    return NextResponse.json(
      { error: "Type d'action invalide" },
      { status: 400 }
    );
  }

  // Validate action_date format if provided
  if (body.action_date && !/^\d{4}-\d{2}-\d{2}$/.test(body.action_date)) {
    return NextResponse.json(
      { error: "Format de date invalide (YYYY-MM-DD)" },
      { status: 400 }
    );
  }

  // Sanitize string fields
  const sanitizeStr = (val: unknown, maxLen: number): string | undefined => {
    if (val === undefined) return undefined;
    if (typeof val !== "string") return "";
    return val.trim().substring(0, maxLen);
  };

  const updates: Record<string, unknown> = { updated_at: new Date() };

  // Only update provided fields
  const fieldMap: [string, number][] = [
    ["campaign", 200], ["action_type", 50], ["sku", 50],
    ["product_name", 200], ["store_id", 100], ["store_name", 200],
    ["store_address", 300], ["store_city", 100], ["store_region", 100],
    ["action_date", 10], ["responsible", 200], ["status", 50],
    ["plv_type", 100], ["objective", 500], ["proof_link", 500],
    ["notes", 1000],
  ];

  for (const [field, maxLen] of fieldMap) {
    const sanitized = sanitizeStr(body[field], maxLen);
    if (sanitized !== undefined) updates[field] = sanitized;
  }

  if (body.cost !== undefined) {
    updates.cost =
      typeof body.cost === "number" && body.cost >= 0 ? body.cost : null;
  }

  // Remove undefined values
  for (const key of Object.keys(updates)) {
    if (updates[key] === undefined) delete updates[key];
  }

  await ref.update(updates);

  return NextResponse.json({ status: "success" });
}

/**
 * DELETE /api/marketing-actions/[id] — Supprimer une action
 */
export async function DELETE(_req: NextRequest, ctx: Params) {
  await requireGestionnaire();
  const { id } = await ctx.params;
  const db = adminDb();

  const ref = db.collection(COLLECTION).doc(id);
  const doc = await ref.get();
  if (!doc.exists) {
    return NextResponse.json({ error: "Action introuvable" }, { status: 404 });
  }

  await ref.delete();

  return NextResponse.json({ status: "deleted" });
}
