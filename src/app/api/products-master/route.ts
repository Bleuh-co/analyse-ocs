import { NextResponse } from "next/server";
import { requireSession } from "@/lib/auth-server";
import { readSheet, SHEET_IDS } from "@/lib/google-sheets";

export const runtime = "nodejs";

/**
 * GET /api/products-master — Récupère le référentiel produits depuis DB-Products-Master.
 *
 * Renvoie la liste des produits avec GTIN-12, GTIN-14, SKU, nom, catégorie, etc.
 * Utilisé pour enrichir les données OCS et les dropdowns marketing.
 */
export async function GET() {
  await requireSession();

  try {
    const data = await readSheet(SHEET_IDS.DB_PRODUCTS_MASTER);

    // Normaliser les noms de colonnes (certains sheets ont des espaces/accents)
    const products = data.rows.map((row) => {
      // Chercher les colonnes par nom partiel (robuste aux variations)
      const findCol = (patterns: string[]): string => {
        for (const p of patterns) {
          const key = Object.keys(row).find((k) =>
            k.toLowerCase().includes(p.toLowerCase())
          );
          if (key && row[key]) return row[key];
        }
        return "";
      };

      return {
        sku: findCol(["SKU", "sku"]),
        // SKU côté détaillant (ex. "111049_14g" pour OCS) — clé de jointure ventes
        retailerSku: findCol(["Retailer SKU"]),
        gtin12: findCol(["GTIN-12", "GTIN12", "gtin12"]),
        gtin14: findCol(["GTIN-14", "GTIN14", "gtin14"]),
        name: findCol(["Nom", "Name", "Produit", "Product"]),
        nameFr: findCol(["Nom FR", "Name FR", "Nom Français"]),
        nameEn: findCol(["Nom EN", "Name EN", "Nom Anglais"]),
        category: findCol(["Catégorie", "Category", "Cat"]),
        subCategory: findCol(["Sous-catégorie", "Sub-Category", "SubCat"]),
        brand: findCol(["Marque", "Brand"]),
        weight: findCol(["Poids", "Weight", "Format"]),
        thc: findCol(["THC", "thc"]),
        cbd: findCol(["CBD", "cbd"]),
        province: findCol(["Province"]),
      };
    }).filter((p) => p.sku || p.gtin12 || p.gtin14); // Exclure les lignes vides

    return NextResponse.json({
      count: products.length,
      products,
    });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Erreur inconnue";
    console.error("Products Master read error:", msg);
    return NextResponse.json(
      { error: "Erreur lors de la lecture du référentiel produits" },
      { status: 500 }
    );
  }
}
