import { NextResponse } from "next/server";
import { requireSession } from "@/lib/auth-server";
import { adminDb } from "@/lib/firebase-admin";

export const runtime = "nodejs";

// Seuil d'archivage : 4 mois
const ARCHIVE_THRESHOLD_MS = 4 * 30 * 24 * 60 * 60 * 1000;

/**
 * GET /api/dashboard — KPI agrégés pour le dashboard
 */
export async function GET() {
  await requireSession();
  const db = adminDb();

  // 1. Stores Ontario
  const storesSnap = await db.collection("stores").get();
  const now = Date.now();
  let activeCount = 0;
  let archivedCount = 0;

  storesSnap.docs.forEach((doc) => {
    const d = doc.data();
    if (d.archived === true) {
      archivedCount++;
      return;
    }
    const updatedAt = d.updated_at?._seconds
      ? d.updated_at._seconds * 1000
      : d.updated_at instanceof Date
        ? d.updated_at.getTime()
        : Date.parse(d.updated_at);
    if (updatedAt && !isNaN(updatedAt) && now - updatedAt >= ARCHIVE_THRESHOLD_MS) {
      archivedCount++;
    } else {
      activeCount++;
    }
  });

  // 2. Dernier upload
  const uploadsSnap = await db
    .collection("ontario_uploads")
    .where("status", "==", "completed")
    .orderBy("uploaded_at", "desc")
    .limit(1)
    .get();

  let lastUpload = null;
  if (!uploadsSnap.empty) {
    const doc = uploadsSnap.docs[0];
    lastUpload = { id: doc.id, ...doc.data() };
  }

  // 3. Nombre de produits (échantillon 50 premiers stores)
  let totalProducts = 0;
  const storeIds = storesSnap.docs.slice(0, 50).map((d) => d.id);
  const productCounts = await Promise.all(
    storeIds.map(async (id) => {
      const prodSnap = await db
        .collection("stores")
        .doc(id)
        .collection("products")
        .count()
        .get();
      return prodSnap.data().count;
    })
  );
  totalProducts = productCounts.reduce((sum, c) => sum + c, 0);

  return NextResponse.json({
    totalStores: storesSnap.size,
    activeStores: activeCount,
    archivedStores: archivedCount,
    totalProducts,
    lastUpload,
  });
}
