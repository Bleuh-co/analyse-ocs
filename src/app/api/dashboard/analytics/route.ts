import { NextRequest, NextResponse } from "next/server";
import { requireSession } from "@/lib/auth-server";
import { adminDb } from "@/lib/firebase-admin";
import { coerceToIsoDate } from "@/lib/ocs-parser";

export const runtime = "nodejs";

// Increase timeout for this heavy route
export const maxDuration = 30;

/**
 * Safely coerce any Firestore value to a string.
 * Handles: string, number, Timestamp ({_seconds}), Date, null, undefined.
 */
function toStr(val: unknown): string {
  if (val == null) return "";
  if (typeof val === "string") return val;
  if (typeof val === "number") return String(val);
  // Firestore Timestamp has toDate()
  if (typeof val === "object" && val !== null) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const v = val as any;
    if (typeof v.toDate === "function") {
      return v.toDate().toISOString().split("T")[0]; // YYYY-MM-DD
    }
    if (v instanceof Date) {
      return v.toISOString().split("T")[0];
    }
    if ("_seconds" in v) {
      return new Date(v._seconds * 1000).toISOString().split("T")[0];
    }
  }
  return String(val);
}

/**
 * GET /api/dashboard/analytics — Agrégations avancées pour les dashboards Recharts.
 *
 * Uses collectionGroup('products') for a single query instead of
 * iterating 700+ stores one by one (which times out on Cloud Run).
 */
export async function GET(req: NextRequest) {
  await requireSession();
  const db = adminDb();

  try {
    // Filtres optionnels via query params
    const url = new URL(req.url);
    const regionFilter = url.searchParams.get("region") || "";
    const fromDate = url.searchParams.get("from") || "";
    const toDate = url.searchParams.get("to") || "";

    // 1. Charger tous les stores (metadata only — lightweight)
    const storesSnap = await db.collection("stores").select("name", "city", "region", "address", "archived").get();

    const storeIndex = new Map<string, { name: string; city: string; region: string }>();
    for (const doc of storesSnap.docs) {
      const d = doc.data();
      if (d.archived === true) continue;
      storeIndex.set(doc.id, {
        name: (d.name as string) || doc.id,
        city: (d.city as string) || "",
        region: (d.region as string) || "",
      });
    }

    // 2. Source des ventes : journal cumulatif `sales` (1 doc par
    //    store × produit × date — vraies séries temporelles) si présent,
    //    sinon fallback sur le snapshot `products` (dernière commande
    //    connue par store × produit, hérité d'Ontario-Sales-Data).
    const salesSnap = await db.collectionGroup("sales").get();
    const useLedger = !salesSnap.empty;
    const sourceDocs = useLedger
      ? salesSnap.docs
      : (await db.collectionGroup("products").get()).docs;

    // Maps d'agrégation
    const productMap = new Map<
      string,
      {
        sku: string;
        gtin: string;
        name: string;
        category: string;
        brand: string;
        totalUnits: number;
        storeIds: Set<string>;
        orderDates: string[];
      }
    >();

    const storeMap = new Map<
      string,
      {
        name: string;
        city: string;
        region: string;
        totalUnits: number;
        skus: Set<string>;
        orderDates: string[];
      }
    >();

    const monthMap = new Map<string, number>();
    const dayMap = new Map<number, number>();
    const regionMap = new Map<string, number>();
    const categoryMap = new Map<string, number>();

    let totalUnits = 0;
    let totalLines = 0;

    for (const prodDoc of sourceDocs) {
      // Extract storeId from the document path: stores/{storeId}/(sales|products)/{docId}
      const pathParts = prodDoc.ref.path.split("/");
      const storeId = pathParts[1] || "";
      const storeInfo = storeIndex.get(storeId);
      if (!storeInfo) continue; // Skip archived or unknown stores

      const storeRegion = storeInfo.region;

      // Filtre par région
      if (regionFilter && storeRegion !== regionFilter) continue;

      const p = prodDoc.data();
      const units = Number(p.units_sold) || 0;
      // Normalise ISO / serial Excel (legacy Ontario-Sales-Data) / Timestamp
      const orderDate = coerceToIsoDate(useLedger ? p.order_date : p.last_order_date);
      const region = toStr(p.region) || storeRegion;
      // Sub Category OCS (Dried Flower, Vapes, Concentrates…) — la Category
      // OCS ne contient que "Cannabis"/"Accessories", sans intérêt analytique
      const category = toStr(p.sub_category) || toStr(p.category) || "Inconnu";
      const sku = toStr(p.sku) || prodDoc.id;
      // GTIN-12 : champ explicite (ledger) ou ID du doc produit (snapshot) —
      // clé de jointure vers DB-Products-Master
      const gtin = toStr(p.gtin) || prodDoc.id;

      // Filtre par date
      if (fromDate && orderDate < fromDate) continue;
      if (toDate && orderDate > toDate) continue;

      totalUnits += units;
      totalLines++;

      // --- byProduct ---
      const existing = productMap.get(sku);
      if (existing) {
        existing.totalUnits += units;
        existing.storeIds.add(storeId);
        if (orderDate) existing.orderDates.push(orderDate);
      } else {
        productMap.set(sku, {
          sku,
          gtin,
          name: toStr(p.name) || sku,
          category,
          brand: toStr(p.brand),
          totalUnits: units,
          storeIds: new Set([storeId]),
          orderDates: orderDate ? [orderDate] : [],
        });
      }

      // --- byStore ---
      const existingStore = storeMap.get(storeId);
      if (existingStore) {
        existingStore.totalUnits += units;
        existingStore.skus.add(sku);
        if (orderDate) existingStore.orderDates.push(orderDate);
      } else {
        storeMap.set(storeId, {
          name: storeInfo.name,
          city: storeInfo.city,
          region,
          totalUnits: units,
          skus: new Set([sku]),
          orderDates: orderDate ? [orderDate] : [],
        });
      }

      // --- byMonth ---
      if (orderDate) {
        const month = orderDate.substring(0, 7); // YYYY-MM
        monthMap.set(month, (monthMap.get(month) || 0) + units);
      }

      // --- byDay (0=dim, 1=lun...) ---
      if (orderDate) {
        const dayOfWeek = new Date(orderDate + "T00:00:00").getDay();
        dayMap.set(dayOfWeek, (dayMap.get(dayOfWeek) || 0) + units);
      }

      // --- byRegion ---
      if (region) {
        regionMap.set(region, (regionMap.get(region) || 0) + units);
      }

      // --- byCategory ---
      categoryMap.set(category, (categoryMap.get(category) || 0) + units);
    }

    // 3. Formatter les résultats
    const DAY_LABELS = ["Dim", "Lun", "Mar", "Mer", "Jeu", "Ven", "Sam"];

    const byProduct = Array.from(productMap.values())
      .map((p) => ({
        sku: p.sku,
        gtin: p.gtin,
        name: p.name,
        category: p.category,
        brand: p.brand,
        totalUnits: p.totalUnits,
        storeCount: p.storeIds.size,
        firstOrder: p.orderDates.length ? p.orderDates.sort()[0] : null,
        lastOrder: p.orderDates.length
          ? p.orderDates.sort()[p.orderDates.length - 1]
          : null,
      }))
      .sort((a, b) => b.totalUnits - a.totalUnits);

    const byStore = Array.from(storeMap.entries())
      .map(([id, s]) => ({
        id,
        name: s.name,
        city: s.city,
        region: s.region,
        totalUnits: s.totalUnits,
        skuCount: s.skus.size,
        firstOrder: s.orderDates.length ? s.orderDates.sort()[0] : null,
        lastOrder: s.orderDates.length
          ? s.orderDates.sort()[s.orderDates.length - 1]
          : null,
      }))
      .sort((a, b) => b.totalUnits - a.totalUnits);

    const byMonth = Array.from(monthMap.entries())
      .map(([month, units]) => ({ month, units }))
      .sort((a, b) => a.month.localeCompare(b.month));

    const byDay = Array.from(dayMap.entries())
      .map(([day, units]) => ({ day, label: DAY_LABELS[day], units }))
      .sort((a, b) => a.day - b.day);

    const byRegion = Array.from(regionMap.entries())
      .map(([region, units]) => ({ region, units }))
      .sort((a, b) => b.units - a.units);

    const byCategory = Array.from(categoryMap.entries())
      .map(([category, units]) => ({ category, units }))
      .sort((a, b) => b.units - a.units);

    // Régions distinctes pour filtre dropdown
    const regions = Array.from(
      new Set(Array.from(storeIndex.values()).map((s) => s.region).filter(Boolean))
    ).sort();

    return NextResponse.json({
      byProduct,
      byStore,
      byMonth,
      byDay,
      byRegion,
      byCategory,
      regions,
      // "ledger" = journal cumulatif (vraies séries temporelles) ;
      // "snapshot" = dernière commande connue par store × produit
      source: useLedger ? "ledger" : "snapshot",
      totals: {
        totalUnits,
        totalLines,
        totalProducts: productMap.size,
        totalStores: storeMap.size,
      },
    });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Erreur inconnue";
    console.error("Analytics API error:", msg);
    return NextResponse.json(
      { error: "Erreur lors du chargement des analytics" },
      { status: 500 }
    );
  }
}
