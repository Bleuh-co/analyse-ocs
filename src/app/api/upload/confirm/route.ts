import { NextRequest, NextResponse } from "next/server";
import { requireGestionnaire } from "@/lib/auth-server";
import { adminDb } from "@/lib/firebase-admin";
import type { EnrichedRow } from "@/lib/ocs-parser";

export const runtime = "nodejs";

const MAX_BATCH_OPS = 499;

/**
 * POST /api/upload/confirm — Confirme l'import et écrit dans Firestore
 */
export async function POST(req: NextRequest) {
  const session = await requireGestionnaire();
  const { filename, rows } = (await req.json()) as {
    filename: string;
    rows: EnrichedRow[];
  };

  if (!rows || !Array.isArray(rows) || rows.length === 0) {
    return NextResponse.json({ error: "Aucune donnée à importer" }, { status: 400 });
  }

  const db = adminDb();
  const validRows = rows.filter((r) => r.status !== "invalid").length;

  // Log d'upload (status: processing)
  const uploadLogRef = await db.collection("ontario_uploads").add({
    filename: filename || "unknown.xlsx",
    uploaded_by: session.email,
    uploaded_at: new Date(),
    rows_imported: validRows,
    stores_created: 0,
    stores_updated: 0,
    products_added: 0,
    status: "processing",
  });

  try {
    const stats = { stores_created: 0, stores_updated: 0, products_added: 0 };
    const processedStores = new Set<string>();

    // Collecter toutes les opérations
    const operations: Array<{
      ref: FirebaseFirestore.DocumentReference;
      data: Record<string, unknown>;
      merge: boolean;
    }> = [];

    for (const row of rows) {
      if (row.status === "invalid") continue;

      const storeId =
        row.matchedStoreId || row.computed.storeNumber || null;
      if (!storeId) continue;

      // Upsert store si nouveau (non matché)
      if (row.status === "unmatched") {
        operations.push({
          ref: db.collection("stores").doc(storeId),
          data: {
            name: row.computed.succursale,
            store_number: storeId,
            province: "ON",
            source: "xlsx",
            address: row.computed.street,
            city: row.computed.mailingCity,
            state: row.computed.mailingState || "ON",
            postal_code: row.computed.mailingPostcode,
            phone: "",
            website: "",
            lat: null,
            lng: null,
            tags: [],
            created_at: new Date(),
            updated_at: new Date(),
            created_by: session.email,
          },
          merge: true,
        });
        if (!processedStores.has(storeId)) stats.stores_created++;
      } else if (!processedStores.has(storeId)) {
        operations.push({
          ref: db.collection("stores").doc(storeId),
          data: { updated_at: new Date() },
          merge: true,
        });
        stats.stores_updated++;
      }
      processedStores.add(storeId);

      // Upsert produit dans la sous-collection du store
      // (snapshot "dernière commande connue" — compatible Ontario-Sales-Data)
      const gtin = row.computed.gtin12 || row.raw.itemBarcode;
      if (gtin) {
        operations.push({
          ref: db
            .collection("stores")
            .doc(storeId)
            .collection("products")
            .doc(gtin),
          data: {
            gtin,
            sku: row.raw.sku,
            name: row.raw.itemName,
            category: row.raw.category,
            sub_category: row.raw.subCategory || "",
            brand: row.raw.brand,
            units_sold: row.raw.unitsSold || 0,
            last_order_date: row.raw.orderDate,
            order_type: row.raw.orderType || "",
            region: row.raw.region || "",
            updated_at: new Date(),
          },
          merge: true,
        });
        stats.products_added++;

        // Journal cumulatif des ventes : 1 doc par store × produit × date de
        // commande. L'ID déterministe rend le ré-import d'un même fichier
        // idempotent, tandis que des dates différentes s'accumulent —
        // contrairement au snapshot ci-dessus qui écrase.
        if (row.raw.orderDate) {
          operations.push({
            ref: db
              .collection("stores")
              .doc(storeId)
              .collection("sales")
              .doc(`${gtin}_${row.raw.orderDate}`),
            data: {
              gtin,
              sku: row.raw.sku,
              name: row.raw.itemName,
              category: row.raw.category,
              brand: row.raw.brand,
              units_sold: row.raw.unitsSold || 0,
              order_date: row.raw.orderDate,
              order_type: row.raw.orderType || "",
              region: row.raw.region || "",
              source_file: filename || "unknown.xlsx",
              imported_at: new Date(),
            },
            merge: true,
          });
        }
      }
    }

    // Batch write en chunks
    for (let i = 0; i < operations.length; i += MAX_BATCH_OPS) {
      const chunk = operations.slice(i, i + MAX_BATCH_OPS);
      const batch = db.batch();
      for (const op of chunk) {
        batch.set(op.ref, op.data, { merge: op.merge });
      }
      await batch.commit();
    }

    // Mettre à jour le log → completed
    await uploadLogRef.update({
      stores_created: stats.stores_created,
      stores_updated: stats.stores_updated,
      products_added: stats.products_added,
      status: "completed",
    });

    return NextResponse.json({ status: "success", stats });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Erreur inconnue";
    // Marquer le log comme échoué
    try {
      await uploadLogRef.update({ status: "failed", error: msg });
    } catch {
      // Ignorer l'erreur de log
    }
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
