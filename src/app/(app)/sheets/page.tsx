"use client";

import { useEffect, useState, useCallback } from "react";

/* ── Types ────────────────────────────────────── */
interface SheetRow { [key: string]: string }
type SheetKey = "crm_historique" | "crm_segmentation" | "db_products_master";

const SHEET_OPTIONS: { key: SheetKey; label: string; icon: string }[] = [
  { key: "crm_historique", label: "CRM Historique", icon: "📗" },
  { key: "crm_segmentation", label: "CRM Segmentation", icon: "📘" },
  { key: "db_products_master", label: "DB Products Master", icon: "📙" },
];

export default function SheetsPage() {
  const [activeSheet, setActiveSheet] = useState<SheetKey>("crm_historique");
  const [tabs, setTabs] = useState<string[]>([]);
  const [activeTab, setActiveTab] = useState("");
  const [headers, setHeaders] = useState<string[]>([]);
  const [rows, setRows] = useState<SheetRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState("");
  const [rowCount, setRowCount] = useState(0);

  // Load tabs for selected sheet
  useEffect(() => {
    setTabs([]);
    setActiveTab("");
    fetch(`/api/sheets?sheet=${activeSheet}&tabs=true`)
      .then((r) => r.json())
      .then((d) => {
        if (d.tabs) {
          setTabs(d.tabs);
          setActiveTab(d.tabs[0] || "");
        }
      });
  }, [activeSheet]);

  // Load data for selected tab
  const fetchData = useCallback(() => {
    if (!activeTab) return;
    setLoading(true);
    const params = new URLSearchParams({ sheet: activeSheet, tab: activeTab });
    fetch(`/api/sheets?${params}`)
      .then((r) => r.json())
      .then((d) => {
        setHeaders(d.headers || []);
        setRows(d.rows || []);
        setRowCount(d.rowCount || 0);
      })
      .finally(() => setLoading(false));
  }, [activeSheet, activeTab]);

  useEffect(() => { fetchData(); }, [fetchData]);

  // Search filter
  const filtered = rows.filter((row) => {
    if (!search) return true;
    const q = search.toLowerCase();
    return Object.values(row).some((v) => v.toLowerCase().includes(q));
  });

  return (
    <div className="chanv-surface">
      <div className="mx-auto max-w-7xl px-4 py-8 space-y-6">
        {/* Header */}
        <div>
          <h2 className="text-2xl font-bold mb-1">📑 Google Sheets</h2>
          <p className="text-sm text-slate-500">
            Lecture des données CRM, Segmentation et DB Products Master
          </p>
        </div>

        {/* Sheet selector */}
        <div className="flex flex-wrap gap-2">
          {SHEET_OPTIONS.map((s) => (
            <button
              key={s.key}
              onClick={() => setActiveSheet(s.key)}
              className={`inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold transition-all ${
                activeSheet === s.key
                  ? "bg-chanv-beige text-chanv-terre shadow-sm"
                  : "bg-[var(--chanv-fibre)] text-slate-600 hover:bg-white/80"
              }`}
            >
              <span>{s.icon}</span> {s.label}
            </button>
          ))}
        </div>

        {/* Tab selector */}
        {tabs.length > 1 && (
          <div className="flex gap-1 overflow-x-auto pb-1">
            {tabs.map((t) => (
              <button
                key={t}
                onClick={() => setActiveTab(t)}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-all ${
                  activeTab === t
                    ? "bg-[var(--chanv-terre)] text-white"
                    : "text-slate-500 hover:bg-[var(--chanv-fibre)]"
                }`}
              >
                {t}
              </button>
            ))}
          </div>
        )}

        {/* Search + info bar */}
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div className="text-sm text-slate-500">
            {loading ? "Chargement…" : `${filtered.length} / ${rowCount} lignes`}
            {activeTab && <span className="ml-2 text-xs text-slate-400">• {activeTab}</span>}
          </div>
          <input
            type="search"
            placeholder="Rechercher dans les données…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="chanv-input text-sm"
            style={{ maxWidth: 320 }}
          />
        </div>

        {/* Data table */}
        {loading ? (
          <div className="section-card p-8">
            <div className="skeleton-line" style={{ width: "100%", height: 300 }} />
          </div>
        ) : (
          <div className="section-card" style={{ padding: "12px 16px" }}>
            <div style={{ overflowX: "auto", maxHeight: "70vh" }}>
              <table className="chanv-table">
                <thead>
                  <tr>
                    <th style={{ width: 40 }}>#</th>
                    {headers.map((h) => (
                      <th key={h}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filtered.length === 0 ? (
                    <tr>
                      <td colSpan={headers.length + 1} className="text-center text-slate-400 py-8">
                        Aucune donnée
                      </td>
                    </tr>
                  ) : (
                    filtered.slice(0, 500).map((row, i) => (
                      <tr key={i}>
                        <td className="text-xs text-slate-400">{i + 1}</td>
                        {headers.map((h) => (
                          <td key={h} className="text-sm" style={{ maxWidth: 250, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                            {row[h] || ""}
                          </td>
                        ))}
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
            {filtered.length > 500 && (
              <p className="text-xs text-slate-400 text-center mt-2">
                Affichage limité à 500 lignes sur {filtered.length}
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
