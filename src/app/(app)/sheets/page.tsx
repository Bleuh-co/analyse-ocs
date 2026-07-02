"use client";

import { useEffect, useState, useCallback } from "react";
import { useAuth } from "@/components/AuthProvider";

/* ── Types ────────────────────────────────────── */
interface SheetRow { [key: string]: string }
type SheetKey = "crm_historique" | "crm_segmentation" | "db_products_master";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
interface EditLog { id: string; action: string; sheet: string; tab: string; row_index: number; performed_by: string; performed_at: any; changed_fields?: Record<string, { from: string; to: string }>; reason?: string }

const SHEET_OPTIONS: { key: SheetKey; label: string; icon: string; editable: boolean }[] = [
  { key: "crm_historique", label: "CRM Historique", icon: "📗", editable: true },
  { key: "crm_segmentation", label: "CRM Segmentation", icon: "📘", editable: true },
  { key: "db_products_master", label: "DB Products Master", icon: "📙", editable: false },
];

const ACTION_LABELS: Record<string, string> = {
  edit: "✏️ Modification",
  delete: "🗑️ Suppression",
};

export default function SheetsPage() {
  const { session } = useAuth();
  const isGestionnaire =
    session?.role === "gestionnaire" || session?.role === "admin" || session?.role === "superadmin";

  const [activeSheet, setActiveSheet] = useState<SheetKey>("crm_historique");
  const [tabs, setTabs] = useState<string[]>([]);
  const [activeTab, setActiveTab] = useState("");
  const [headers, setHeaders] = useState<string[]>([]);
  const [rows, setRows] = useState<SheetRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState("");
  const [rowCount, setRowCount] = useState(0);

  // Edit state
  const [editingCell, setEditingCell] = useState<{ row: number; col: string } | null>(null);
  const [editValue, setEditValue] = useState("");
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<{ type: "success" | "error"; msg: string } | null>(null);

  // Logs
  const [showLogs, setShowLogs] = useState(false);
  const [logs, setLogs] = useState<EditLog[]>([]);
  const [logsLoading, setLogsLoading] = useState(false);

  // Delete
  const [deleteConfirm, setDeleteConfirm] = useState<number | null>(null);

  const sheetMeta = SHEET_OPTIONS.find((s) => s.key === activeSheet);
  const canEdit = isGestionnaire && sheetMeta?.editable;

  // Auto-dismiss toast
  useEffect(() => {
    if (toast) {
      const t = setTimeout(() => setToast(null), 4000);
      return () => clearTimeout(t);
    }
  }, [toast]);

  // Load tabs
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

  // Load data
  const fetchData = useCallback(() => {
    if (!activeTab) return;
    setLoading(true);
    setEditingCell(null);
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

  // Load logs
  const fetchLogs = useCallback(() => {
    setLogsLoading(true);
    fetch(`/api/sheets/logs?sheet=${activeSheet}&limit=30`)
      .then((r) => r.json())
      .then((d) => setLogs(d.logs || []))
      .finally(() => setLogsLoading(false));
  }, [activeSheet]);

  useEffect(() => {
    if (showLogs) fetchLogs();
  }, [showLogs, fetchLogs]);

  // Search filter
  const filtered = rows.filter((row) => {
    if (!search) return true;
    const q = search.toLowerCase();
    return Object.values(row).some((v) => v.toLowerCase().includes(q));
  });

  // Start editing
  function startEdit(rowIdx: number, col: string) {
    if (!canEdit) return;
    const row = filtered[rowIdx];
    setEditingCell({ row: rowIdx, col });
    setEditValue(row[col] || "");
  }

  // Save edit
  async function saveEdit() {
    if (!editingCell || !canEdit) return;
    setSaving(true);

    // The actual row index in the sheet is:
    // filtered index → find in rows → row index + 2 (1 for header, 1 for 0-index)
    const filteredRow = filtered[editingCell.row];
    const actualIndex = rows.indexOf(filteredRow);
    const sheetRowIndex = actualIndex + 2; // +1 for header, +1 for 1-indexed

    try {
      const res = await fetch("/api/sheets/edit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sheet: activeSheet,
          tab: activeTab,
          rowIndex: sheetRowIndex,
          updates: { [editingCell.col]: editValue },
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        setToast({ type: "error", msg: data.error || "Erreur" });
        return;
      }

      // Update local state
      const updatedRows = [...rows];
      updatedRows[actualIndex] = {
        ...updatedRows[actualIndex],
        [editingCell.col]: editValue,
      };
      setRows(updatedRows);
      setEditingCell(null);
      setToast({ type: "success", msg: `✅ Cellule modifiée (${data.changes} champ${data.changes > 1 ? "s" : ""})` });
    } catch {
      setToast({ type: "error", msg: "Erreur réseau" });
    } finally {
      setSaving(false);
    }
  }

  // Delete row
  async function handleDelete(filteredIdx: number) {
    if (!canEdit) return;

    const filteredRow = filtered[filteredIdx];
    const actualIndex = rows.indexOf(filteredRow);
    const sheetRowIndex = actualIndex + 2;

    setSaving(true);
    try {
      const res = await fetch("/api/sheets/delete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sheet: activeSheet,
          tab: activeTab,
          rowIndex: sheetRowIndex,
          reason: "Suppression via Analyse OCS",
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        setToast({ type: "error", msg: data.error || "Erreur" });
        return;
      }

      setDeleteConfirm(null);
      setToast({ type: "success", msg: "✅ Ligne supprimée et archivée" });
      fetchData(); // Reload
    } catch {
      setToast({ type: "error", msg: "Erreur réseau" });
    } finally {
      setSaving(false);
    }
  }

  // Format log date
  function formatLogDate(d: unknown): string {
    if (!d) return "—";
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const ts = typeof d === "object" && d !== null && "_seconds" in (d as any) ? (d as any)._seconds * 1000 : Date.parse(d as string);
    if (isNaN(ts)) return "—";
    return new Intl.DateTimeFormat("fr-CA", { dateStyle: "short", timeStyle: "short" }).format(new Date(ts));
  }

  return (
    <div className="chanv-surface">
      <div className="mx-auto max-w-7xl px-4 py-8 space-y-6">
        {/* Toast */}
        {toast && (
          <div
            className={`fixed top-20 right-6 z-50 px-4 py-3 rounded-xl shadow-lg text-sm font-medium animate-[chanvFadeIn_0.3s_ease] ${
              toast.type === "success"
                ? "bg-green-50 text-green-800 border border-green-200"
                : "bg-red-50 text-red-800 border border-red-200"
            }`}
          >
            {toast.msg}
          </div>
        )}

        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-4">
          <div>
            <h2 className="text-2xl font-bold mb-1">📑 Google Sheets</h2>
            <p className="text-sm text-slate-500">
              {canEdit
                ? "Cliquer sur une cellule pour la modifier • Archivage automatique avant chaque modification"
                : sheetMeta?.editable
                  ? "Mode lecture seule (rôle gestionnaire requis pour éditer)"
                  : "Lecture seule"}
            </p>
          </div>
          {canEdit && (
            <button
              onClick={() => setShowLogs(!showLogs)}
              className={`chanv-btn-secondary text-sm ${showLogs ? "ring-2 ring-[var(--chanv-beige)]" : ""}`}
            >
              📋 {showLogs ? "Masquer" : "Voir"} l&apos;historique
            </button>
          )}
        </div>

        {/* Sheet selector */}
        <div className="flex flex-wrap gap-2">
          {SHEET_OPTIONS.map((s) => (
            <button
              key={s.key}
              onClick={() => { setActiveSheet(s.key); setShowLogs(false); }}
              className={`inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold transition-all ${
                activeSheet === s.key
                  ? "bg-chanv-beige text-chanv-terre shadow-sm"
                  : "bg-[var(--chanv-fibre)] text-slate-600 hover:bg-white/80"
              }`}
            >
              <span>{s.icon}</span> {s.label}
              {s.editable && <span className="text-[10px] opacity-50">✏️</span>}
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

        {/* Edit logs panel */}
        {showLogs && (
          <div className="section-card" style={{ padding: "16px 24px" }}>
            <h3 className="text-sm font-bold uppercase tracking-wider text-slate-500 mb-3">
              📋 Historique des modifications
            </h3>
            {logsLoading ? (
              <div className="skeleton-line" style={{ width: "100%", height: 100 }} />
            ) : logs.length === 0 ? (
              <p className="text-sm text-slate-400">Aucune modification enregistrée.</p>
            ) : (
              <div style={{ maxHeight: 300, overflowY: "auto" }}>
                <table className="chanv-table">
                  <thead>
                    <tr>
                      <th>Date</th>
                      <th>Action</th>
                      <th>Onglet</th>
                      <th>Ligne</th>
                      <th>Détails</th>
                      <th>Par</th>
                    </tr>
                  </thead>
                  <tbody>
                    {logs.map((log) => (
                      <tr key={log.id}>
                        <td className="text-xs whitespace-nowrap">{formatLogDate(log.performed_at)}</td>
                        <td className="text-xs">{ACTION_LABELS[log.action] || log.action}</td>
                        <td className="text-xs">{log.tab}</td>
                        <td className="text-xs text-center">{log.row_index}</td>
                        <td className="text-xs">
                          {log.changed_fields ? (
                            <span title={JSON.stringify(log.changed_fields, null, 2)}>
                              {Object.keys(log.changed_fields).join(", ")}
                            </span>
                          ) : (
                            log.reason || "—"
                          )}
                        </td>
                        <td className="text-xs">{log.performed_by?.split("@")[0]}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
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
                    {canEdit && <th style={{ width: 60 }}>Actions</th>}
                  </tr>
                </thead>
                <tbody>
                  {filtered.length === 0 ? (
                    <tr>
                      <td colSpan={headers.length + (canEdit ? 2 : 1)} className="text-center text-slate-400 py-8">
                        Aucune donnée
                      </td>
                    </tr>
                  ) : (
                    filtered.slice(0, 500).map((row, i) => (
                      <tr key={i}>
                        <td className="text-xs text-slate-400">{i + 1}</td>
                        {headers.map((h) => {
                          const isEditing = editingCell?.row === i && editingCell?.col === h;
                          return (
                            <td
                              key={h}
                              className={`text-sm ${canEdit ? "cursor-pointer hover:bg-[var(--chanv-fibre)]" : ""}`}
                              style={{ maxWidth: 250, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}
                              onClick={() => !isEditing && startEdit(i, h)}
                              title={canEdit ? "Cliquer pour modifier" : undefined}
                            >
                              {isEditing ? (
                                <div className="flex items-center gap-1">
                                  <input
                                    type="text"
                                    value={editValue}
                                    onChange={(e) => setEditValue(e.target.value)}
                                    onKeyDown={(e) => {
                                      if (e.key === "Enter") saveEdit();
                                      if (e.key === "Escape") setEditingCell(null);
                                    }}
                                    className="chanv-input text-sm py-1 px-2"
                                    style={{ minWidth: 120 }}
                                    autoFocus
                                    disabled={saving}
                                  />
                                  <button
                                    onClick={(e) => { e.stopPropagation(); saveEdit(); }}
                                    disabled={saving}
                                    className="text-green-600 hover:text-green-800 text-sm font-bold"
                                    title="Sauvegarder"
                                  >
                                    ✓
                                  </button>
                                  <button
                                    onClick={(e) => { e.stopPropagation(); setEditingCell(null); }}
                                    className="text-red-400 hover:text-red-600 text-sm"
                                    title="Annuler"
                                  >
                                    ✕
                                  </button>
                                </div>
                              ) : (
                                row[h] || ""
                              )}
                            </td>
                          );
                        })}
                        {canEdit && (
                          <td>
                            {deleteConfirm === i ? (
                              <div className="flex items-center gap-1">
                                <button
                                  onClick={() => handleDelete(i)}
                                  disabled={saving}
                                  className="text-[11px] text-red-600 font-bold hover:underline"
                                >
                                  Confirmer
                                </button>
                                <button
                                  onClick={() => setDeleteConfirm(null)}
                                  className="text-[11px] text-slate-400 hover:underline"
                                >
                                  Non
                                </button>
                              </div>
                            ) : (
                              <button
                                onClick={() => setDeleteConfirm(i)}
                                className="text-slate-400 hover:text-red-500 text-sm transition-colors"
                                title="Supprimer cette ligne"
                              >
                                🗑️
                              </button>
                            )}
                          </td>
                        )}
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
