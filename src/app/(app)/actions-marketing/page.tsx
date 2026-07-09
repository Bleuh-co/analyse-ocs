"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { useAuth } from "@/components/AuthProvider";
import { useT } from "@/lib/i18n";

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

const ACTION_TYPE_KEYS: Record<string, string> = {
  plv_envoye: "mkt.type.plv_envoye",
  plv_installe: "mkt.type.plv_installe",
  visite_terrain: "mkt.type.visite_terrain",
  courriel: "mkt.type.courriel",
  appel: "mkt.type.appel",
  sms: "mkt.type.sms",
  formation: "mkt.type.formation",
  promo: "mkt.type.promo",
  evenement: "mkt.type.evenement",
  autre: "mkt.type.autre",
};

const STATUS_META: Record<string, { key: string; color: string }> = {
  planifie: { key: "mkt.status.planifie", color: "#718096" },
  en_cours: { key: "mkt.status.en_cours", color: "#D69E2E" },
  complete: { key: "mkt.status.complete", color: "#38A169" },
  annule: { key: "mkt.status.annule", color: "#E53E3E" },
};

export default function MarketingActionsPage() {
  const t = useT();
  const { session } = useAuth();
  const [actions, setActions] = useState<MarketingAction[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState("");

  const isGestionnaire =
    session?.role === "gestionnaire" || session?.role === "admin" || session?.role === "superadmin";

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
            <h2 className="text-2xl font-bold mb-1">{t("mkt.list.title")}</h2>
            <p className="text-sm text-slate-500">
              {t("mkt.list.subtitle")}
            </p>
          </div>
          {isGestionnaire && (
            <Link
              href="/actions-marketing/new"
              className="chanv-btn-primary inline-flex items-center gap-2"
            >
              <span>➕</span> {t("mkt.list.new")}
            </Link>
          )}
        </div>

        {/* Filtres */}
        <div className="flex flex-wrap gap-3">
          <input
            type="search"
            placeholder={t("mkt.list.searchPlaceholder")}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="chanv-input text-sm flex-1"
            style={{ minWidth: 200, maxWidth: 360 }}
          />
          <select
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value)}
            className="chanv-select text-sm"
            aria-label={t("mkt.list.filterType")}
          >
            <option value="">{t("mkt.list.allTypes")}</option>
            {Object.entries(ACTION_TYPE_KEYS).map(([k, v]) => (
              <option key={k} value={k}>{t(v)}</option>
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
              {t("mkt.list.empty")}{" "}
              {isGestionnaire && (
                <Link href="/actions-marketing/new" className="text-[var(--chanv-beige)] font-semibold hover:underline">
                  {t("mkt.list.createFirst")}
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
                    <th>{t("mkt.table.date")}</th>
                    <th>{t("mkt.table.campaign")}</th>
                    <th>{t("mkt.table.type")}</th>
                    <th>{t("mkt.table.store")}</th>
                    <th>{t("mkt.table.product")}</th>
                    <th>{t("mkt.table.responsible")}</th>
                    <th>{t("mkt.table.status")}</th>
                    <th>{t("mkt.table.cost")}</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((a) => {
                    const statusInfo = STATUS_META[a.status] || STATUS_META.planifie;
                    return (
                      <tr key={a.id}>
                        <td className="text-xs whitespace-nowrap">{a.action_date}</td>
                        <td className="font-medium">{a.campaign}</td>
                        <td className="text-xs whitespace-nowrap">
                          {ACTION_TYPE_KEYS[a.action_type] ? t(ACTION_TYPE_KEYS[a.action_type]) : a.action_type}
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
                            {t(statusInfo.key)}
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
                            {t("mkt.list.view")}
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
