import { NextRequest, NextResponse } from "next/server";
import { requireSession } from "@/lib/auth-server";
import { adminDb } from "@/lib/firebase-admin";

export const runtime = "nodejs";

/**
 * GET /api/dashboard/analytics — Agrégations avancées pour les dashboards Recharts.
 *
 * Charge toutes les sous-collections products de chaque store et renvoie :
 *   - byProduct : agrégation par SKU (units, stores count, first/last order)
 *   - byStore   : agrégation par store (units, SKU count, first/last order)
 *   - byMonth   : timeline mensuelle (units par mois)
 *   - byDay     : unités vendues par jour de semaine (lun–dim)
 *   - byRegion  : unités vendues par région OCS
 *   - byCategory: unités vendues par catégorie de produit
 *   - totals    : métriques globales
 */
export async function GET(req: NextRequest) {
  await requireSession();
  const db = adminDb();

  // Filtres optionnels via query params
  const url = new URL(req.url);
  const regionFilter = url.searchParams.get("region") || "";
  const fromDate = url.searchParams.get("from") || "";
  const toDate = url.searchParams.get("to") || "";

  // 1. Charger tous les stores
  const storesSnap = await db.collection("stores").get();

  // Maps d'agrégation
  const productMap = new Map<
    string,
    {
      sku: string;
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

  // 2. Itérer sur chaque store → ses produits
  for (const storeDoc of storesSnap.docs) {
    const storeData = storeDoc.data();
    const storeId = storeDoc.id;
    const storeRegion = (storeData.region as string) || "";

    // Filtre par région
    if (regionFilter && storeRegion !== regionFilter) continue;

    const prodsSnap = await db
      .collection("stores")
      .doc(storeId)
      .collection("products")
      .get();

    for (const prodDoc of prodsSnap.docs) {
      const p = prodDoc.data();
      const units = Number(p.units_sold) || 0;
      const orderDate = (p.last_order_date as string) || "";
      const region = (p.region as string) || storeRegion;
      const category = (p.category as string) || "Inconnu";
      const sku = (p.sku as string) || prodDoc.id;

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
          name: (p.name as string) || sku,
          category,
          brand: (p.brand as string) || "",
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
          name: (storeData.name as string) || storeId,
          city: (storeData.city as string) || "",
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
  }

  // 3. Formatter les résultats
  const DAY_LABELS = ["Dim", "Lun", "Mar", "Mer", "Jeu", "Ven", "Sam"];

  const byProduct = Array.from(productMap.values())
    .map((p) => ({
      sku: p.sku,
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
    new Set(storesSnap.docs.map((d) => (d.data().region as string) || "").filter(Boolean))
  ).sort();

  return NextResponse.json({
    byProduct,
    byStore,
    byMonth,
    byDay,
    byRegion,
    byCategory,
    regions,
    totals: {
      totalUnits,
      totalLines,
      totalProducts: productMap.size,
      totalStores: storeMap.size,
    },
  });
}
