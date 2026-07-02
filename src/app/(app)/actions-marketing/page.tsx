"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { useAuth } from "@/components/AuthProvider";

/* ── Types ─────────────────────────────────────── */
interface MarketingAction {
  id: string;
  campaign: string;
  action_type: string;
  sku: string;
  product_name: string;
  store_id: string;
  store_name: string;
  store_city: string;
  store_region: string;
  action_date: string;
  responsible: string;
  status: string;
  cost: number | null;
  notes: string;
  created_at: { _seconds: number } | string;
}

const ACTION_TYPE_LABELS: Record<string, string> = {
  plv_envoye: "📦 PLV envoyé",
  plv_installe: "🖼️ PLV installé",
  visite_terrain: "🚗 Visite terrain",
  courriel: "📧 Courriel",
  appel: "📞 Appel",
  sms: "💬 SMS",
  formation: "🎓 Formation",
  promo: "🏷️ Promo",
  evenement: "🎪 Événement",
  autre: "📝 Autre",
};

const STATUS_LABELS: Record<string, { label: string; color: string }> = {
  planifie: { label: "Planifié", color: "#718096" },
  en_cours: { label: "En cours", color: "#D69E2E" },
  complete: { label: "Complété", color: "#38A169" },
  annule: { label: "Annulé", color: "#E53E3E" },
};

export default function MarketingActionsPage() {
  const { session } = useAuth();
  const [actions, setActions] = useState<MarketingAction[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState("");

  const isGestionnaire = session?.role === "admin" || session?.role === "superadmin";

  const fetchActions = useCallback(() => {
    setLoading(true);
    const params = new URLSearchParams();
    if (typeFilter) params.set("type", typeFilter);
    fetch(`/api/marketing-actions?${params}`)
      .then((r) => r.json())
      .then((d) => setActions(d.actions || []))
      .finally(() => setLoading(false));
  }, [typeFilter]);

  useEffect(() => { fetchActions(); }, [fetchActions]);

  const filtered = actions.filter((a) => {
    if (!search) return true;
    const q = search.toLowerCase();
    return (
      a.campaign.toLowerCase().includes(q) ||
      a.store_name.toLowerCase().includes(q) ||
      a.product_name?.toLowerCase().includes(q) ||
      a.responsible?.toLowerCase().includes(q)
    );
  });

  return (
    <div className="chanv-surface">
      <div className="mx-auto max-w-6xl px-4 py-8 space-y-6">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-4">
          <div>
            <h2 className="text-2xl font-bold mb-1">📣 Actions Marketing</h2>
            <p className="text-sm text-slate-500">
              Suivi des actions terrain, PLV, visites et campagnes
            </p>
          </div>
          {isGestionnaire && (
            <Link
              href="/actions-marketing/new"
              className="chanv-btn-primary inline-flex items-center gap-2"
            >
              <span>➕</span> Nouvelle action
            </Link>
          )}
        </div>

        {/* Filtres */}
        <div className="flex flex-wrap gap-3">
          <input
            type="search"
            placeholder="Rechercher campagne, store, produit…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="chanv-input text-sm flex-1"
            style={{ minWidth: 200, maxWidth: 360 }}
          />
          <select
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value)}
            className="chanv-select text-sm"
            aria-label="Filtrer par type"
          >
            <option value="">Tous les types</option>
            {Object.entries(ACTION_TYPE_LABELS).map(([k, v]) => (
              <option key={k} value={k}>{v}</option>
            ))}
          </select>
        </div>

        {/* Table */}
        {loading ? (
          <div className="section-card p-8">
            <div className="skeleton-line" style={{ width: "100%", height: 200 }} />
          </div>
        ) : filtered.length === 0 ? (
          <div className="section-card p-8 text-center">
            <p className="text-slate-400 text-sm">
              Aucune action marketing.{" "}
              {isGestionnaire && (
                <Link href="/actions-marketing/new" className="text-[var(--chanv-beige)] font-semibold hover:underline">
                  Créer la première
                </Link>
              )}
            </p>
          </div>
        ) : (
          <div className="section-card" style={{ padding: "16px 24px" }}>
            <div style={{ overflowX: "auto" }}>
              <table className="chanv-table">
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>Campagne</th>
                    <th>Type</th>
                    <th>Store</th>
                    <th>Produit</th>
                    <th>Responsable</th>
                    <th>Statut</th>
                    <th>Coût</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((a) => {
                    const statusInfo = STATUS_LABELS[a.status] || STATUS_LABELS.planifie;
                    return (
                      <tr key={a.id}>
                        <td className="text-xs whitespace-nowrap">{a.action_date}</td>
                        <td className="font-medium">{a.campaign}</td>
                        <td className="text-xs whitespace-nowrap">
                          {ACTION_TYPE_LABELS[a.action_type] || a.action_type}
                        </td>
                        <td>
                          <div className="font-medium">{a.store_name}</div>
                          {a.store_city && (
                            <div className="text-xs text-slate-400">{a.store_city}</div>
                          )}
                        </td>
                        <td className="text-sm">{a.product_name || a.sku || "—"}</td>
                        <td className="text-sm">{a.responsible || "—"}</td>
                        <td>
                          <span
                            className="inline-block px-2 py-0.5 rounded-full text-[11px] font-semibold text-white"
                            style={{ background: statusInfo.color }}
                          >
                            {statusInfo.label}
                          </span>
                        </td>
                        <td className="text-sm text-right">
                          {a.cost != null ? `${a.cost.toFixed(2)} $` : "—"}
                        </td>
                        <td>
                          <Link
                            href={`/actions-marketing/${a.id}`}
                            className="text-[var(--chanv-beige)] hover:underline text-sm font-semibold"
                          >
                            Voir
                          </Link>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
