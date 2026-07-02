"use client";

import { useEffect, useState } from "react";
import { KpiCard, KpiRow } from "@/components/KpiCard";

interface DashboardData {
  totalStores: number;
  activeStores: number;
  archivedStores: number;
  totalProducts: number;
  lastUpload: {
    id: string;
    filename: string;
    uploaded_by: string;
    uploaded_at: { _seconds: number } | string;
    rows_imported: number;
    stores_created: number;
    stores_updated: number;
    products_added: number;
    status: string;
  } | null;
}

function formatDate(d: { _seconds: number } | string | undefined): string {
  if (!d) return "—";
  const ts = typeof d === "object" && "_seconds" in d ? d._seconds * 1000 : Date.parse(d as string);
  if (isNaN(ts)) return "—";
  return new Intl.DateTimeFormat("fr-CA", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(ts));
}

export default function DashboardPage() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/dashboard")
      .then((r) => r.json())
      .then(setData)
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="chanv-surface">
      <div className="mx-auto max-w-5xl px-4 py-8 space-y-8">
        <div>
          <h2 className="text-2xl font-bold mb-1">📊 Tableau de bord</h2>
          <p className="text-sm text-slate-500">
            Vue d&apos;ensemble des données OCS Ontario
          </p>
        </div>

        <KpiRow>
          <KpiCard
            icon="🏪"
            label="Stores actifs"
            value={data?.activeStores ?? 0}
            subtitle={data ? `${data.archivedStores} archivés` : undefined}
            loading={loading}
          />
          <KpiCard
            icon="📦"
            label="Produits distribués"
            value={data?.totalProducts ?? 0}
            loading={loading}
          />
          <KpiCard
            icon="📊"
            label="Total stores"
            value={data?.totalStores ?? 0}
            loading={loading}
          />
          <KpiCard
            icon="📤"
            label="Dernier import"
            value={data?.lastUpload ? formatDate(data.lastUpload.uploaded_at) : "—"}
            subtitle={
              data?.lastUpload
                ? `${data.lastUpload.rows_imported} lignes • ${data.lastUpload.filename}`
                : undefined
            }
            loading={loading}
          />
        </KpiRow>

        {/* Section Historique rapide */}
        <RecentUploads />
      </div>
    </div>
  );
}

function RecentUploads() {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [uploads, setUploads] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/uploads")
      .then((r) => r.json())
      .then((d) => setUploads(d.uploads || []))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="section-card p-8">
        <div className="skeleton-line" style={{ width: "40%", marginBottom: 16 }} />
        <div className="skeleton-line" style={{ width: "100%", marginBottom: 8 }} />
        <div className="skeleton-line" style={{ width: "80%" }} />
      </div>
    );
  }

  if (uploads.length === 0) {
    return (
      <div className="section-card p-8 text-center">
        <p className="text-slate-400 text-sm">
          Aucun import effectué. Rendez-vous dans{" "}
          <a href="/upload" className="text-[var(--chanv-beige)] font-semibold hover:underline">
            📤 Importer
          </a>{" "}
          pour commencer.
        </p>
      </div>
    );
  }

  return (
    <div className="section-card" style={{ padding: "24px 32px" }}>
      <h3 className="text-sm font-bold uppercase tracking-wider text-slate-500 mb-4">
        📋 Derniers imports
      </h3>
      <div className="space-y-3">
        {uploads.slice(0, 5).map((u) => (
          <div
            key={u.id}
            className="flex items-center justify-between gap-4 py-2 border-b border-[var(--chanv-fibre)] last:border-0"
          >
            <div>
              <span className="text-sm font-medium">{u.filename}</span>
              <span className="text-xs text-slate-400 ml-3">
                {formatDate(u.uploaded_at)}
              </span>
            </div>
            <div className="flex items-center gap-3">
              <span className="text-xs text-slate-500">
                {u.rows_imported} lignes
              </span>
              <span
                className={`badge ${u.status === "completed" ? "badge-accent" : u.status === "failed" ? "badge-danger" : "badge-neutral"}`}
              >
                {u.status === "completed"
                  ? "✅"
                  : u.status === "failed"
                    ? "❌"
                    : "⏳"}
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
