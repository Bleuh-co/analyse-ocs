"use client";

import { useEffect, useState, use } from "react";
import Link from "next/link";
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

function formatNum(n: number): string {
  return new Intl.NumberFormat("fr-CA").format(n);
}

export default function ActionDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
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
            <p className="text-slate-400">Action introuvable</p>
            <Link href="/actions-marketing" className="text-[var(--chanv-beige)] mt-2 inline-block">
              ← Retour
            </Link>
          </div>
        </div>
      </div>
    );
  }

  const statusInfo = STATUS_LABELS[action.status] || STATUS_LABELS.planifie;

  // Impact chart data
  const impactChartData = impact
    ? [
        { label: `14j avant`, units: impact.units_before, type: "before" },
        { label: `14j après`, units: impact.units_after, type: "after" },
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
          ← Retour aux actions
        </Link>

        {/* Header */}
        <div className="section-card" style={{ padding: "24px 32px" }}>
          <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4">
            <div>
              <div className="flex items-center gap-3 mb-2">
                <span className="text-2xl">
                  {ACTION_TYPE_LABELS[action.action_type]?.split(" ")[0] || "📣"}
                </span>
                <h2 className="text-xl font-bold">{action.campaign}</h2>
                <span
                  className="inline-block px-3 py-1 rounded-full text-xs font-semibold text-white"
                  style={{ background: statusInfo.color }}
                >
                  {statusInfo.label}
                </span>
              </div>
              <p className="text-sm text-slate-500">
                {ACTION_TYPE_LABELS[action.action_type] || action.action_type}
                {" • "}
                {action.action_date}
                {action.responsible && ` • ${action.responsible}`}
              </p>
            </div>
            {action.cost != null && (
              <div className="text-right">
                <div className="text-sm text-slate-500">Coût</div>
                <div className="text-lg font-bold">{action.cost.toFixed(2)} $</div>
              </div>
            )}
          </div>

          {/* Détails */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-6 pt-4 border-t border-[var(--chanv-fibre)]">
            <div>
              <div className="text-xs text-slate-400 uppercase tracking-wider">Store</div>
              <div className="font-medium">{action.store_name}</div>
              <div className="text-xs text-slate-500">
                {[action.store_city, action.store_region].filter(Boolean).join(" • ")}
              </div>
            </div>
            <div>
              <div className="text-xs text-slate-400 uppercase tracking-wider">Produit</div>
              <div className="font-medium">{action.product_name || "—"}</div>
              {action.sku && <div className="text-xs text-slate-500 font-mono">{action.sku}</div>}
            </div>
            <div>
              <div className="text-xs text-slate-400 uppercase tracking-wider">PLV / Asset</div>
              <div className="font-medium">{action.plv_type || "—"}</div>
            </div>
          </div>

          {action.objective && (
            <div className="mt-4 pt-3 border-t border-[var(--chanv-fibre)]">
              <div className="text-xs text-slate-400 uppercase tracking-wider mb-1">Objectif</div>
              <p className="text-sm">{action.objective}</p>
            </div>
          )}

          {action.notes && (
            <div className="mt-3">
              <div className="text-xs text-slate-400 uppercase tracking-wider mb-1">Notes</div>
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
                📸 Voir la preuve / photo
              </a>
            </div>
          )}
        </div>

        {/* Impact Section */}
        {impact && (
          <>
            <h3 className="text-lg font-bold">📈 Mesure d&apos;impact (±14 jours)</h3>

            <KpiRow>
              <KpiCard
                icon="📉"
                label="Avant l'action"
                value={formatNum(impact.units_before)}
                subtitle="unités (14 jours)"
                loading={false}
              />
              <KpiCard
                icon="📈"
                label="Après l'action"
                value={formatNum(impact.units_after)}
                subtitle="unités (14 jours)"
                loading={false}
              />
              <KpiCard
                icon={impact.lift_units >= 0 ? "🚀" : "📉"}
                label="Lift"
                value={`${impact.lift_units >= 0 ? "+" : ""}${formatNum(impact.lift_units)}`}
                subtitle={
                  impact.lift_percent !== null
                    ? `${impact.lift_percent >= 0 ? "+" : ""}${impact.lift_percent}%`
                    : "Pas de baseline"
                }
                trend={impact.lift_units > 0 ? "up" : impact.lift_units < 0 ? "down" : "neutral"}
                loading={false}
              />
              <KpiCard
                icon={impact.reacted ? "✅" : "❌"}
                label="Réaction"
                value={impact.reacted ? "Oui" : "Non"}
                subtitle={
                  impact.reaction_days !== null
                    ? `${impact.reaction_days} jour${impact.reaction_days !== 1 ? "s" : ""} après`
                    : undefined
                }
                loading={false}
              />
            </KpiRow>

            {/* Before/After Chart */}
            <div className="section-card" style={{ padding: "24px" }}>
              <h4 className="text-sm font-bold uppercase tracking-wider text-slate-500 mb-4">
                Comparaison avant / après
              </h4>
              <ResponsiveContainer width="100%" height={250}>
                <BarChart data={impactChartData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--chanv-fibre)" />
                  <XAxis dataKey="label" tick={{ fontSize: 13 }} />
                  <YAxis tick={{ fontSize: 11 }} />
                  <Tooltip formatter={(v: number) => [formatNum(v), "Unités"]} />
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
              Pas assez de données pour calculer l&apos;impact. Les données de ventes
              OCS doivent couvrir la période autour de la date d&apos;action.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
