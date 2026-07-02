"use client";

import { useEffect, useState, useCallback } from "react";
import { KpiCard, KpiRow } from "@/components/KpiCard";
import {
  BarChart, Bar, LineChart, Line, PieChart, Pie, Cell,
  ScatterChart, Scatter, ZAxis,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from "recharts";

/* ── Types ────────────────────────────────────────── */
interface Totals { totalUnits: number; totalLines: number; totalProducts: number; totalStores: number }
interface ProductRow { sku: string; gtin: string; name: string; category: string; brand: string; totalUnits: number; storeCount: number; firstOrder: string | null; lastOrder: string | null }
interface StoreRow { id: string; name: string; city: string; region: string; totalUnits: number; skuCount: number }
interface MonthRow { month: string; units: number }
interface DayRow { label: string; units: number }
interface RegionRow { region: string; units: number }
interface CategoryRow { category: string; units: number }
interface AnalyticsData { byProduct: ProductRow[]; byStore: StoreRow[]; byMonth: MonthRow[]; byDay: DayRow[]; byRegion: RegionRow[]; byCategory: CategoryRow[]; regions: string[]; source?: "ledger" | "snapshot"; totals: Totals }

/* Profil produit (THC/CBD) depuis DB-Products-Master */
interface MasterProduct { sku: string; retailerSku: string; gtin12: string; gtin14: string; nameFr: string; name: string; category: string; thc: string; cbd: string }
interface MasterEntry { thc: number | null; cbd: number | null; nameFr: string; category: string; masterSku: string }

/** URL de Pilotage Production (deep link natif : ?view=<SKU master>) */
const PRODUCTION_URL =
  process.env.NEXT_PUBLIC_PRODUCTION_URL ||
  "https://nouvelle-production-bleuh-271227085398.northamerica-northeast1.run.app";
/** Deux index : par GTIN-12 (clé primaire) et par Retailer SKU normalisé (fallback) */
interface MasterMap { byGtin: Record<string, MasterEntry>; bySku: Record<string, MasterEntry> }

/** Normalise un SKU OCS/retailer : "111049_14g___" → "111049_14g" */
function normalizeRetailerSku(sku: string): string {
  return sku.trim().toLowerCase().replace(/_+$/, "");
}

/** GTIN-14 → GTIN-12 (strip "00" de tête) pour aligner avec l'ID des docs produits */
function gtinTo12(g: string): string {
  const s = g.replace(/\D/g, "");
  if (s.length === 14 && s.startsWith("00")) return s.substring(2);
  if (s.length === 13 && s.startsWith("0")) return s.substring(1);
  return s;
}

const COLORS = ["#C4A265", "#8B6914", "#A0522D", "#6B8E23", "#4682B4", "#9370DB", "#CD853F", "#D2691E", "#BC8F8F", "#8FBC8F"];
const TABS = ["Aperçu", "Produits", "Stores", "Temps", "Profil"] as const;
type Tab = (typeof TABS)[number];

function formatNum(n: number): string {
  return new Intl.NumberFormat("fr-CA").format(n);
}

/**
 * Parse une valeur de potency du référentiel en % numérique, ou null.
 * Formats réels de DB-Products-Master : "25-31" (plage → point médian),
 * "0,1-1" (virgule décimale), "40%", "N/A".
 */
function parsePotency(raw: string): number | null {
  if (!raw) return null;
  const nums = (raw.replace(/,/g, ".").match(/\d+(?:\.\d+)?/g) || [])
    .map(Number)
    .filter((n) => !isNaN(n) && n <= 100); // garde-fou valeurs aberrantes
  if (!nums.length) return null; // "N/A", texte…
  const mid = nums.length >= 2 ? (nums[0] + nums[1]) / 2 : nums[0];
  return Math.round(mid * 10) / 10;
}

/** Coefficient de corrélation de Pearson entre deux séries de même longueur. */
function pearson(xs: number[], ys: number[]): number | null {
  const n = xs.length;
  if (n < 3) return null;
  const mx = xs.reduce((a, b) => a + b, 0) / n;
  const my = ys.reduce((a, b) => a + b, 0) / n;
  let num = 0, dx = 0, dy = 0;
  for (let i = 0; i < n; i++) {
    const a = xs[i] - mx, b = ys[i] - my;
    num += a * b; dx += a * a; dy += b * b;
  }
  const denom = Math.sqrt(dx * dy);
  return denom === 0 ? null : num / denom;
}

export default function DashboardPage() {
  const [data, setData] = useState<AnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<Tab>("Aperçu");
  const [region, setRegion] = useState("");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [error, setError] = useState("");
  const [master, setMaster] = useState<MasterMap | null>(null);

  // Charger le référentiel produits (THC/CBD/nom) une seule fois.
  // Jointure : GTIN-12 (= ID des docs produits) en priorité, Retailer SKU en fallback.
  useEffect(() => {
    fetch("/api/products-master")
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (!d?.products) return;
        const map: MasterMap = { byGtin: {}, bySku: {} };
        (d.products as MasterProduct[]).forEach((p) => {
          const entry: MasterEntry = {
            thc: parsePotency(p.thc),
            cbd: parsePotency(p.cbd),
            nameFr: p.nameFr || p.name || "",
            category: p.category || "",
            masterSku: p.sku || "",
          };
          const g12 = gtinTo12(p.gtin12 || p.gtin14 || "");
          if (g12) map.byGtin[g12] = entry;
          if (p.retailerSku) map.bySku[normalizeRetailerSku(p.retailerSku)] = entry;
        });
        setMaster(map);
      })
      .catch(() => {});
  }, []);

  const fetchData = useCallback(() => {
    setLoading(true);
    setError("");
    const params = new URLSearchParams();
    if (region) params.set("region", region);
    if (fromDate) params.set("from", fromDate);
    if (toDate) params.set("to", toDate);
    fetch(`/api/dashboard/analytics?${params}`)
      .then((r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json();
      })
      .then(setData)
      .catch((err) => {
        console.error("Analytics fetch error:", err);
        setError("Erreur lors du chargement des données. Réessayez.");
      })
      .finally(() => setLoading(false));
  }, [region, fromDate, toDate]);

  useEffect(() => { fetchData(); }, [fetchData]);

  return (
    <div className="chanv-surface">
      <div className="mx-auto max-w-6xl px-4 py-8 space-y-6">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-4">
          <div>
            <h2 className="text-2xl font-bold mb-1">📊 Tableau de bord</h2>
            <p className="text-sm text-slate-500">
              Ventes OCS Ontario — Performance Bleuh
              {data?.source && (
                <span
                  className="ml-2 text-[10px] uppercase tracking-wider px-2 py-0.5 rounded-full bg-[var(--chanv-fibre)] text-slate-500 align-middle"
                  title={
                    data.source === "ledger"
                      ? "Journal cumulatif des ventes : chaque commande compte à sa date réelle"
                      : "Instantané : dernière commande connue par magasin × produit"
                  }
                >
                  {data.source === "ledger" ? "📒 journal" : "📷 instantané"}
                </span>
              )}
            </p>
          </div>
          {/* Filtres */}
          <div className="flex flex-wrap items-center gap-2">
            <select
              value={region}
              onChange={(e) => setRegion(e.target.value)}
              className="chanv-select text-sm"
              aria-label="Filtrer par région"
            >
              <option value="">Toutes les régions</option>
              {(data?.regions || []).map((r) => (
                <option key={r} value={r}>{r}</option>
              ))}
            </select>
            <input
              type="date"
              value={fromDate}
              onChange={(e) => setFromDate(e.target.value)}
              className="chanv-input text-sm"
              aria-label="Date début"
              placeholder="Du"
            />
            <input
              type="date"
              value={toDate}
              onChange={(e) => setToDate(e.target.value)}
              className="chanv-input text-sm"
              aria-label="Date fin"
              placeholder="Au"
            />
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 bg-[var(--chanv-fibre)] rounded-xl p-1">
          {TABS.map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`flex-1 px-4 py-2 rounded-lg text-sm font-semibold transition-all ${
                tab === t
                  ? "bg-chanv-beige text-chanv-terre shadow-sm"
                  : "text-slate-500 hover:text-slate-700 hover:bg-white/50"
              }`}
            >
              {t}
            </button>
          ))}
        </div>

        {/* Error */}
        {error && (
          <div className="bg-red-50 text-red-700 border border-red-200 rounded-lg px-4 py-3 text-sm flex items-center justify-between">
            <span>{error}</span>
            <button onClick={fetchData} className="text-red-700 font-semibold hover:underline ml-4">
              🔄 Réessayer
            </button>
          </div>
        )}

        {/* KPIs */}
        <KpiRow>
          <KpiCard icon="📦" label="Unités vendues" value={formatNum(data?.totals.totalUnits ?? 0)} loading={loading} />
          <KpiCard icon="🏷️" label="Produits distincts" value={data?.totals.totalProducts ?? 0} loading={loading} />
          <KpiCard icon="🏪" label="Stores actifs" value={data?.totals.totalStores ?? 0} loading={loading} />
          <KpiCard icon="📋" label="Lignes de vente" value={formatNum(data?.totals.totalLines ?? 0)} loading={loading} />
        </KpiRow>

        {/* Tab content */}
        {tab === "Aperçu" && <OverviewTab data={data} loading={loading} />}
        {tab === "Produits" && <ProductsTab data={data} loading={loading} />}
        {tab === "Stores" && <StoresTab data={data} loading={loading} />}
        {tab === "Temps" && <TimeTab data={data} loading={loading} />}
        {tab === "Profil" && <ProfileTab data={data} master={master} loading={loading} />}
      </div>
    </div>
  );
}

/* ── Aperçu ─────────────────────────────────────── */
function OverviewTab({ data, loading }: { data: AnalyticsData | null; loading: boolean }) {
  if (loading || !data) return <LoadingSkeleton />;
  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      {/* Ventes par mois */}
      <ChartCard title="📈 Ventes par mois">
        <ResponsiveContainer width="100%" height={280}>
          <LineChart data={data.byMonth}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--chanv-fibre)" />
            <XAxis dataKey="month" tick={{ fontSize: 11 }} />
            <YAxis tick={{ fontSize: 11 }} />
            <Tooltip formatter={(v: number) => [formatNum(v), "Unités"]} />
            <Line type="monotone" dataKey="units" stroke="#C4A265" strokeWidth={2} dot={{ r: 3 }} />
          </LineChart>
        </ResponsiveContainer>
      </ChartCard>

      {/* Par région */}
      <ChartCard title="🗺️ Ventes par région">
        <ResponsiveContainer width="100%" height={280}>
          <PieChart>
            <Pie data={data.byRegion.slice(0, 10)} dataKey="units" nameKey="region" cx="50%" cy="50%" outerRadius={100} label={(e) => e.region}>
              {data.byRegion.slice(0, 10).map((_, i) => (
                <Cell key={i} fill={COLORS[i % COLORS.length]} />
              ))}
            </Pie>
            <Tooltip formatter={(v: number) => [formatNum(v), "Unités"]} />
          </PieChart>
        </ResponsiveContainer>
      </ChartCard>

      {/* Top 10 produits */}
      <ChartCard title="🏆 Top 10 produits">
        <ResponsiveContainer width="100%" height={300}>
          <BarChart data={data.byProduct.slice(0, 10)} layout="vertical">
            <CartesianGrid strokeDasharray="3 3" stroke="var(--chanv-fibre)" />
            <XAxis type="number" tick={{ fontSize: 11 }} />
            <YAxis dataKey="name" type="category" width={140} tick={{ fontSize: 10 }} />
            <Tooltip formatter={(v: number) => [formatNum(v), "Unités"]} />
            <Bar dataKey="totalUnits" fill="#C4A265" radius={[0, 4, 4, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </ChartCard>

      {/* Par catégorie */}
      <ChartCard title="📂 Ventes par catégorie de produit">
        <ResponsiveContainer width="100%" height={300}>
          <BarChart data={data.byCategory.slice(0, 8)}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--chanv-fibre)" />
            <XAxis dataKey="category" tick={{ fontSize: 10 }} angle={-20} textAnchor="end" height={60} />
            <YAxis tick={{ fontSize: 11 }} />
            <Tooltip formatter={(v: number) => [formatNum(v), "Unités"]} />
            <Bar dataKey="units" fill="#8B6914" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </ChartCard>
    </div>
  );
}

/* ── Produits ────────────────────────────────────── */
function ProductsTab({ data, loading }: { data: AnalyticsData | null; loading: boolean }) {
  const [search, setSearch] = useState("");
  if (loading || !data) return <LoadingSkeleton />;

  const filtered = data.byProduct.filter((p) =>
    !search || p.name.toLowerCase().includes(search.toLowerCase()) || p.sku.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="section-card" style={{ padding: "24px" }}>
      <div className="flex items-center justify-between mb-4 gap-4 flex-wrap">
        <h3 className="text-sm font-bold uppercase tracking-wider text-slate-500">
          Performance par produit ({formatNum(filtered.length)})
        </h3>
        <input
          type="search"
          placeholder="Rechercher SKU ou nom…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="chanv-input text-sm"
          style={{ maxWidth: 260 }}
        />
      </div>
      <div style={{ overflowX: "auto" }}>
        <table className="chanv-table">
          <thead>
            <tr>
              <th>Produit</th>
              <th>SKU</th>
              <th>Catégorie</th>
              <th style={{ textAlign: "right" }}>Unités</th>
              <th style={{ textAlign: "right" }}>Stores</th>
              <th style={{ textAlign: "right" }}>Vélocité/Store</th>
              <th>Première vente</th>
              <th>Dernière vente</th>
            </tr>
          </thead>
          <tbody>
            {filtered.slice(0, 100).map((p) => (
              <tr key={p.sku}>
                <td className="font-medium">{p.name}</td>
                <td className="text-xs text-slate-400 font-mono">{p.sku}</td>
                <td>{p.category}</td>
                <td style={{ textAlign: "right" }} className="font-semibold">{formatNum(p.totalUnits)}</td>
                <td style={{ textAlign: "right" }}>{p.storeCount}</td>
                <td style={{ textAlign: "right" }}>
                  {p.storeCount > 0 ? (p.totalUnits / p.storeCount).toFixed(1) : "—"}
                </td>
                <td className="text-xs">{p.firstOrder || "—"}</td>
                <td className="text-xs">{p.lastOrder || "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/* ── Stores ──────────────────────────────────────── */
function StoresTab({ data, loading }: { data: AnalyticsData | null; loading: boolean }) {
  const [search, setSearch] = useState("");
  if (loading || !data) return <LoadingSkeleton />;

  const filtered = data.byStore.filter((s) =>
    !search || s.name.toLowerCase().includes(search.toLowerCase()) || s.city.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-6">
      {/* Top 15 bar chart */}
      <ChartCard title="🏆 Top 15 stores par volume">
        <ResponsiveContainer width="100%" height={350}>
          <BarChart data={data.byStore.slice(0, 15)} layout="vertical">
            <CartesianGrid strokeDasharray="3 3" stroke="var(--chanv-fibre)" />
            <XAxis type="number" tick={{ fontSize: 11 }} />
            <YAxis dataKey="name" type="category" width={160} tick={{ fontSize: 10 }} />
            <Tooltip formatter={(v: number) => [formatNum(v), "Unités"]} />
            <Legend />
            <Bar dataKey="totalUnits" name="Unités vendues" fill="#C4A265" radius={[0, 4, 4, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </ChartCard>

      {/* Table */}
      <div className="section-card" style={{ padding: "24px" }}>
        <div className="flex items-center justify-between mb-4 gap-4 flex-wrap">
          <h3 className="text-sm font-bold uppercase tracking-wider text-slate-500">
            Tous les stores ({formatNum(filtered.length)})
          </h3>
          <input
            type="search"
            placeholder="Rechercher nom ou ville…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="chanv-input text-sm"
            style={{ maxWidth: 260 }}
          />
        </div>
        <div style={{ overflowX: "auto" }}>
          <table className="chanv-table">
            <thead>
              <tr>
                <th>Store</th>
                <th>Ville</th>
                <th>Région</th>
                <th style={{ textAlign: "right" }}>Unités</th>
                <th style={{ textAlign: "right" }}>SKUs</th>
                <th style={{ textAlign: "right" }}>Unités/SKU</th>
              </tr>
            </thead>
            <tbody>
              {filtered.slice(0, 100).map((s) => (
                <tr key={s.id}>
                  <td className="font-medium">{s.name}</td>
                  <td>{s.city}</td>
                  <td>{s.region}</td>
                  <td style={{ textAlign: "right" }} className="font-semibold">{formatNum(s.totalUnits)}</td>
                  <td style={{ textAlign: "right" }}>{s.skuCount}</td>
                  <td style={{ textAlign: "right" }}>
                    {s.skuCount > 0 ? (s.totalUnits / s.skuCount).toFixed(1) : "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

/* ── Temps ───────────────────────────────────────── */
function TimeTab({ data, loading }: { data: AnalyticsData | null; loading: boolean }) {
  if (loading || !data) return <LoadingSkeleton />;
  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      {/* Timeline mensuelle */}
      <ChartCard title="📅 Volume mensuel">
        <ResponsiveContainer width="100%" height={300}>
          <BarChart data={data.byMonth}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--chanv-fibre)" />
            <XAxis dataKey="month" tick={{ fontSize: 11 }} />
            <YAxis tick={{ fontSize: 11 }} />
            <Tooltip formatter={(v: number) => [formatNum(v), "Unités"]} />
            <Bar dataKey="units" fill="#C4A265" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </ChartCard>

      {/* Par jour de semaine */}
      <ChartCard title="📆 Ventes par jour de la semaine">
        <ResponsiveContainer width="100%" height={300}>
          <BarChart data={data.byDay}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--chanv-fibre)" />
            <XAxis dataKey="label" tick={{ fontSize: 12 }} />
            <YAxis tick={{ fontSize: 11 }} />
            <Tooltip formatter={(v: number) => [formatNum(v), "Unités"]} />
            <Bar dataKey="units" fill="#8B6914" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </ChartCard>

      {/* Tendance (line) */}
      <ChartCard title="📈 Tendance des ventes" className="lg:col-span-2">
        <ResponsiveContainer width="100%" height={280}>
          <LineChart data={data.byMonth}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--chanv-fibre)" />
            <XAxis dataKey="month" tick={{ fontSize: 11 }} />
            <YAxis tick={{ fontSize: 11 }} />
            <Tooltip formatter={(v: number) => [formatNum(v), "Unités"]} />
            <Line type="monotone" dataKey="units" stroke="#C4A265" strokeWidth={3} dot={{ r: 4, fill: "#C4A265" }} />
          </LineChart>
        </ResponsiveContainer>
      </ChartCard>
    </div>
  );
}

/* ── Profil produit (THC/CBD × ventes) ───────────── */
const THC_BANDS = [
  { label: "< 10 %", min: 0, max: 10 },
  { label: "10–15 %", min: 10, max: 15 },
  { label: "15–20 %", min: 15, max: 20 },
  { label: "20–25 %", min: 20, max: 25 },
  { label: "25 %+", min: 25, max: Infinity },
];

function ProfileTab({
  data,
  master,
  loading,
}: {
  data: AnalyticsData | null;
  master: MasterMap | null;
  loading: boolean;
}) {
  const [search, setSearch] = useState("");
  if (loading || !data) return <LoadingSkeleton />;
  if (!master) {
    return (
      <div className="section-card p-8 text-center text-slate-400">
        Chargement du référentiel produits (THC/CBD)…
      </div>
    );
  }

  // Joindre les ventes par produit avec le profil THC/CBD du Products-Master.
  // Clé primaire : GTIN-12 (ID des docs Firestore) ; fallback : Retailer SKU
  // normalisé ("111049_14g___" côté OCS → "111049_14g" côté master).
  const enriched = data.byProduct
    .map((p) => {
      const m =
        master.byGtin[gtinTo12(p.gtin || "")] ??
        master.bySku[normalizeRetailerSku(p.sku)];
      return {
        sku: p.sku,
        name: m?.nameFr || p.name,
        category: p.category || m?.category || "",
        units: p.totalUnits,
        storeCount: p.storeCount,
        thc: m?.thc ?? null,
        cbd: m?.cbd ?? null,
        masterSku: m?.masterSku || "",
      };
    });

  const withThc = enriched.filter((p) => p.thc !== null);
  const matchRate = enriched.length
    ? Math.round((withThc.length / enriched.length) * 100)
    : 0;

  // Corrélation THC × unités
  const r = pearson(withThc.map((p) => p.thc as number), withThc.map((p) => p.units));
  const corrLabel =
    r === null ? "—" : r > 0.15 ? "positive" : r < -0.15 ? "négative" : "faible";

  // Ventes par tranche de THC
  const bands = THC_BANDS.map((b) => ({
    label: b.label,
    units: withThc
      .filter((p) => (p.thc as number) >= b.min && (p.thc as number) < b.max)
      .reduce((sum, p) => sum + p.units, 0),
    products: withThc.filter((p) => (p.thc as number) >= b.min && (p.thc as number) < b.max).length,
  }));

  // Nuage de points (top 150 pour rester lisible)
  const scatter = withThc.slice(0, 150).map((p) => ({
    thc: p.thc,
    units: p.units,
    name: p.name,
  }));

  const filtered = enriched.filter(
    (p) => !search || p.name.toLowerCase().includes(search.toLowerCase()) || p.sku.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-6">
      {/* Insight corrélation */}
      <div className="section-card" style={{ padding: "18px 24px" }}>
        <div className="flex flex-wrap items-center gap-x-8 gap-y-3">
          <div>
            <div className="text-[11px] uppercase tracking-wider text-slate-500 font-semibold">
              Corrélation THC × unités vendues
            </div>
            <div className="text-2xl font-bold text-chanv-terre">
              {r === null ? "—" : r.toFixed(2)}
              <span className="text-sm font-medium text-slate-500 ml-2">({corrLabel})</span>
            </div>
          </div>
          <div>
            <div className="text-[11px] uppercase tracking-wider text-slate-500 font-semibold">
              Produits enrichis
            </div>
            <div className="text-2xl font-bold text-chanv-terre">
              {withThc.length}
              <span className="text-sm font-medium text-slate-500 ml-2">/ {enriched.length} ({matchRate} %)</span>
            </div>
          </div>
        </div>
        {matchRate < 60 && (
          <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 mt-3 mb-0">
            ⚠️ Seuls {matchRate} % des produits ont un THC connu dans DB-Products-Master — la
            corrélation est indicative. Complétez le référentiel pour affiner.
          </p>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Nuage THC vs ventes */}
        <ChartCard title="🌿 THC (%) × unités vendues">
          <ResponsiveContainer width="100%" height={320}>
            <ScatterChart margin={{ top: 10, right: 10, bottom: 30, left: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--chanv-fibre)" />
              <XAxis
                type="number" dataKey="thc" name="THC" unit="%"
                tick={{ fontSize: 11 }} domain={[0, "dataMax + 2"]}
                label={{ value: "THC (%)", position: "insideBottom", offset: -15, fontSize: 11 }}
              />
              <YAxis type="number" dataKey="units" name="Unités" tick={{ fontSize: 11 }} />
              <ZAxis range={[40, 40]} />
              <Tooltip
                cursor={{ strokeDasharray: "3 3" }}
                formatter={(v: number, n: string) => [n === "THC" ? `${v}%` : formatNum(v), n]}
                labelFormatter={() => ""}
                content={({ payload }) =>
                  payload && payload.length ? (
                    <div className="bg-white border border-black/10 rounded-lg px-3 py-2 text-xs shadow">
                      <div className="font-semibold">{payload[0].payload.name}</div>
                      <div>THC : {payload[0].payload.thc}%</div>
                      <div>Unités : {formatNum(payload[0].payload.units)}</div>
                    </div>
                  ) : null
                }
              />
              <Scatter data={scatter} fill="#6B8E23" fillOpacity={0.6} />
            </ScatterChart>
          </ResponsiveContainer>
        </ChartCard>

        {/* Ventes par tranche de THC */}
        <ChartCard title="📊 Unités vendues par tranche de THC">
          <ResponsiveContainer width="100%" height={320}>
            <BarChart data={bands}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--chanv-fibre)" />
              <XAxis dataKey="label" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} />
              <Tooltip
                formatter={(v: number, n: string) => [n === "units" ? formatNum(v) : v, n === "units" ? "Unités" : "Produits"]}
              />
              <Bar dataKey="units" fill="#6B8E23" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>
      </div>

      {/* Table enrichie */}
      <div className="section-card" style={{ padding: "24px" }}>
        <div className="flex items-center justify-between mb-4 gap-4 flex-wrap">
          <h3 className="text-sm font-bold uppercase tracking-wider text-slate-500">
            Produits enrichis THC / CBD ({formatNum(filtered.length)})
          </h3>
          <input
            type="search"
            placeholder="Rechercher SKU ou nom…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="chanv-input text-sm"
            style={{ maxWidth: 260 }}
          />
        </div>
        <div style={{ overflowX: "auto" }}>
          <table className="chanv-table">
            <thead>
              <tr>
                <th>Produit (FR)</th>
                <th>SKU</th>
                <th>Catégorie</th>
                <th style={{ textAlign: "right" }}>THC</th>
                <th style={{ textAlign: "right" }}>CBD</th>
                <th style={{ textAlign: "right" }}>Unités</th>
                <th style={{ textAlign: "right" }}>Stores</th>
                <th style={{ textAlign: "center" }}>Lots</th>
              </tr>
            </thead>
            <tbody>
              {filtered.slice(0, 100).map((p) => (
                <tr key={p.sku}>
                  <td className="font-medium">{p.name}</td>
                  <td className="text-xs text-slate-400 font-mono">{p.sku}</td>
                  <td>{p.category || "—"}</td>
                  <td style={{ textAlign: "right" }}>{p.thc !== null ? `${p.thc}%` : "—"}</td>
                  <td style={{ textAlign: "right" }}>{p.cbd !== null ? `${p.cbd}%` : "—"}</td>
                  <td style={{ textAlign: "right" }} className="font-semibold">{formatNum(p.units)}</td>
                  <td style={{ textAlign: "right" }}>{p.storeCount}</td>
                  <td style={{ textAlign: "center" }}>
                    {p.masterSku ? (
                      <a
                        href={`${PRODUCTION_URL}/?view=${encodeURIComponent(p.masterSku)}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        title={`Voir les lots de ${p.masterSku} dans Pilotage Production (THC, CBD, terpènes par lot)`}
                        className="text-slate-400 hover:text-chanv-terre transition-colors"
                      >
                        🧪
                      </a>
                    ) : (
                      <span className="text-slate-200">—</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

/* ── Shared components ───────────────────────────── */
function ChartCard({ title, children, className }: { title: string; children: React.ReactNode; className?: string }) {
  return (
    <div className={`section-card ${className || ""}`} style={{ padding: "24px" }}>
      <h3 className="text-sm font-bold uppercase tracking-wider text-slate-500 mb-4">{title}</h3>
      {children}
    </div>
  );
}

function LoadingSkeleton() {
  return (
    <div className="section-card p-8 space-y-4">
      <div className="skeleton-line" style={{ width: "40%", marginBottom: 16 }} />
      <div className="skeleton-line" style={{ width: "100%", height: 200 }} />
    </div>
  );
}
