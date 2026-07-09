"use client";

import { useEffect, useState, use } from "react";
import Link from "next/link";
import { useT, useLocale } from "@/lib/i18n";
import { KpiCard, KpiRow } from "@/components/KpiCard";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, ReferenceLine, Cell,
} from "recharts";

/* ── Types ─────────────────────────────────────── */
interface Impact {
  period_days: number;
  units_before: number;
  units_after: number;
  lift_units: number;
  lift_percent: number | null;
  reacted: boolean;
  reaction_days: number | null;
}

const ACTION_TYPE_META: Record<string, { emoji: string; key: string }> = {
  plv_envoye: { emoji: "📦", key: "mkt.type.plv_envoye" },
  plv_installe: { emoji: "🖼️", key: "mkt.type.plv_installe" },
  visite_terrain: { emoji: "🚗", key: "mkt.type.visite_terrain" },
  courriel: { emoji: "📧", key: "mkt.type.courriel" },
  appel: { emoji: "📞", key: "mkt.type.appel" },
  sms: { emoji: "💬", key: "mkt.type.sms" },
  formation: { emoji: "🎓", key: "mkt.type.formation" },
  promo: { emoji: "🏷️", key: "mkt.type.promo" },
  evenement: { emoji: "🎪", key: "mkt.type.evenement" },
  autre: { emoji: "📝", key: "mkt.type.autre" },
};

const STATUS_META: Record<string, { key: string; color: string }> = {
  planifie: { key: "mkt.status.planifie", color: "#718096" },
  en_cours: { key: "mkt.status.en_cours", color: "#D69E2E" },
  complete: { key: "mkt.status.complete", color: "#38A169" },
  annule: { key: "mkt.status.annule", color: "#E53E3E" },
};

export default function ActionDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const t = useT();
  const locale = useLocale();
  const formatNum = (n: number): string => new Intl.NumberFormat(locale).format(n);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [action, setAction] = useState<any>(null);
  const [impact, setImpact] = useState<Impact | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`/api/marketing-actions/${encodeURIComponent(id)}`)
      .then((r) => r.json())
      .then((d) => {
        setAction(d.action);
        setImpact(d.impact);
      })
      .finally(() => setLoading(false));
  }, [id]);

  if (loading) {
    return (
      <div className="chanv-surface">
        <div className="mx-auto max-w-5xl px-4 py-8">
          <div className="section-card p-8">
            <div className="skeleton-line" style={{ width: "40%", marginBottom: 16 }} />
            <div className="skeleton-line" style={{ width: "100%", height: 200 }} />
          </div>
        </div>
      </div>
    );
  }

  if (!action) {
    return (
      <div className="chanv-surface">
        <div className="mx-auto max-w-5xl px-4 py-8">
          <div className="section-card p-8 text-center">
            <p className="text-slate-400">{t("mkt.detail.notFound")}</p>
            <Link href="/actions-marketing" className="text-[var(--chanv-beige)] mt-2 inline-block">
              ← {t("mkt.detail.back")}
            </Link>
          </div>
        </div>
      </div>
    );
  }

  const statusInfo = STATUS_META[action.status] || STATUS_META.planifie;
  const typeInfo = ACTION_TYPE_META[action.action_type];

  // Impact chart data
  const impactChartData = impact
    ? [
        { label: t("mkt.detail.chartBefore"), units: impact.units_before, type: "before" },
        { label: t("mkt.detail.chartAfter"), units: impact.units_after, type: "after" },
      ]
    : [];

  return (
    <div className="chanv-surface">
      <div className="mx-auto max-w-5xl px-4 py-8 space-y-6">
        {/* Breadcrumb */}
        <Link
          href="/actions-marketing"
          className="text-sm text-[var(--chanv-beige)] hover:underline"
        >
          ← {t("mkt.detail.backToList")}
        </Link>

        {/* Header */}
        <div className="section-card" style={{ padding: "24px 32px" }}>
          <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4">
            <div>
              <div className="flex items-center gap-3 mb-2">
                <span className="text-2xl">
                  {typeInfo?.emoji || "📣"}
                </span>
                <h2 className="text-xl font-bold">{action.campaign}</h2>
                <span
                  className="inline-block px-3 py-1 rounded-full text-xs font-semibold text-white"
                  style={{ background: statusInfo.color }}
                >
                  {t(statusInfo.key)}
                </span>
              </div>
              <p className="text-sm text-slate-500">
                {typeInfo ? `${typeInfo.emoji} ${t(typeInfo.key)}` : action.action_type}
                {" • "}
                {action.action_date}
                {action.responsible && ` • ${action.responsible}`}
              </p>
            </div>
            {action.cost != null && (
              <div className="text-right">
                <div className="text-sm text-slate-500">{t("mkt.detail.cost")}</div>
                <div className="text-lg font-bold">{action.cost.toFixed(2)} $</div>
              </div>
            )}
          </div>

          {/* Détails */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-6 pt-4 border-t border-[var(--chanv-fibre)]">
            <div>
              <div className="text-xs text-slate-400 uppercase tracking-wider">{t("mkt.detail.store")}</div>
              <div className="font-medium">{action.store_name}</div>
              <div className="text-xs text-slate-500">
                {[action.store_city, action.store_region].filter(Boolean).join(" • ")}
              </div>
            </div>
            <div>
              <div className="text-xs text-slate-400 uppercase tracking-wider">{t("mkt.detail.product")}</div>
              <div className="font-medium">{action.product_name || "—"}</div>
              {action.sku && <div className="text-xs text-slate-500 font-mono">{action.sku}</div>}
            </div>
            <div>
              <div className="text-xs text-slate-400 uppercase tracking-wider">{t("mkt.detail.plv")}</div>
              <div className="font-medium">{action.plv_type || "—"}</div>
            </div>
          </div>

          {action.objective && (
            <div className="mt-4 pt-3 border-t border-[var(--chanv-fibre)]">
              <div className="text-xs text-slate-400 uppercase tracking-wider mb-1">{t("mkt.detail.objective")}</div>
              <p className="text-sm">{action.objective}</p>
            </div>
          )}

          {action.notes && (
            <div className="mt-3">
              <div className="text-xs text-slate-400 uppercase tracking-wider mb-1">{t("mkt.detail.notes")}</div>
              <p className="text-sm text-slate-600">{action.notes}</p>
            </div>
          )}

          {action.proof_link && (
            <div className="mt-3">
              <a
                href={action.proof_link}
                target="_blank"
                rel="noopener noreferrer"
                className="text-sm text-[var(--chanv-beige)] hover:underline"
              >
                📸 {t("mkt.detail.proof")}
              </a>
            </div>
          )}
        </div>

        {/* Impact Section */}
        {impact && (
          <>
            <h3 className="text-lg font-bold">📈 {t("mkt.detail.impactTitle")}</h3>

            <KpiRow>
              <KpiCard
                icon="📉"
                label={t("mkt.detail.before")}
                value={formatNum(impact.units_before)}
                subtitle={t("mkt.detail.unitsSub")}
                loading={false}
              />
              <KpiCard
                icon="📈"
                label={t("mkt.detail.after")}
                value={formatNum(impact.units_after)}
                subtitle={t("mkt.detail.unitsSub")}
                loading={false}
              />
              <KpiCard
                icon={impact.lift_units >= 0 ? "🚀" : "📉"}
                label={t("mkt.detail.lift")}
                value={`${impact.lift_units >= 0 ? "+" : ""}${formatNum(impact.lift_units)}`}
                subtitle={
                  impact.lift_percent !== null
                    ? `${impact.lift_percent >= 0 ? "+" : ""}${impact.lift_percent}%`
                    : t("mkt.detail.noBaseline")
                }
                trend={impact.lift_units > 0 ? "up" : impact.lift_units < 0 ? "down" : "neutral"}
                loading={false}
              />
              <KpiCard
                icon={impact.reacted ? "✅" : "❌"}
                label={t("mkt.detail.reaction")}
                value={impact.reacted ? t("mkt.detail.yes") : t("mkt.detail.no")}
                subtitle={
                  impact.reaction_days !== null
                    ? t(
                        impact.reaction_days === 1 ? "mkt.detail.dayAfter" : "mkt.detail.daysAfter",
                        { n: impact.reaction_days },
                      )
                    : undefined
                }
                loading={false}
              />
            </KpiRow>

            {/* Before/After Chart */}
            <div className="section-card" style={{ padding: "24px" }}>
              <h4 className="text-sm font-bold uppercase tracking-wider text-slate-500 mb-4">
                {t("mkt.detail.compare")}
              </h4>
              <ResponsiveContainer width="100%" height={250}>
                <BarChart data={impactChartData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--chanv-fibre)" />
                  <XAxis dataKey="label" tick={{ fontSize: 13 }} />
                  <YAxis tick={{ fontSize: 11 }} />
                  <Tooltip formatter={(v: number) => [formatNum(v), t("mkt.detail.units")]} />
                  <ReferenceLine y={0} stroke="#ccc" />
                  <Bar dataKey="units" radius={[6, 6, 0, 0]} maxBarSize={80}>
                    {impactChartData.map((entry, i) => (
                      <Cell
                        key={i}
                        fill={entry.type === "before" ? "#A0AEC0" : "#C4A265"}
                      />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </>
        )}

        {!impact && (
          <div className="section-card p-8 text-center">
            <p className="text-slate-400 text-sm">
              {t("mkt.detail.noData")}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
