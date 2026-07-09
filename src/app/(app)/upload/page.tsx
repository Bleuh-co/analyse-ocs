"use client";

import { useState, useCallback, useEffect } from "react";
import { FileDropZone } from "@/components/FileDropZone";
import { useT, useLocale } from "@/lib/i18n";
import type { EnrichedRow } from "@/lib/ocs-parser";

interface UploadLog {
  id: string;
  filename: string;
  uploaded_by: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  uploaded_at: any;
  rows_imported: number;
  stores_created: number;
  stores_updated: number;
  products_added: number;
  status: string;
}

function formatLogDate(d: unknown, locale: string): string {
  if (!d) return "—";
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const ts = typeof d === "object" && d !== null && "_seconds" in (d as any)
    ? (d as any)._seconds * 1000
    : Date.parse(d as string);
  if (isNaN(ts)) return "—";
  return new Intl.DateTimeFormat(locale, { dateStyle: "medium", timeStyle: "short" }).format(new Date(ts));
}

const STATUS_LABEL_KEYS: Record<string, string> = {
  completed: "upload.statusCompleted",
  processing: "upload.statusProcessing",
  failed: "upload.statusFailed",
};

type ParseResult = {
  filename: string;
  totalRows: number;
  stats: { matched: number; unmatched: number; invalid: number };
  rows: EnrichedRow[];
};

type ConfirmResult = {
  status: string;
  stats: { stores_created: number; stores_updated: number; products_added: number };
};

type Phase = "select" | "parsing" | "preview" | "confirming" | "done" | "error";

export default function UploadPage() {
  const t = useT();
  const locale = useLocale();
  const [phase, setPhase] = useState<Phase>("select");
  const [result, setResult] = useState<ParseResult | null>(null);
  const [confirmResult, setConfirmResult] = useState<ConfirmResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Historique des imports
  const [logs, setLogs] = useState<UploadLog[]>([]);
  const loadLogs = useCallback(() => {
    fetch("/api/uploads")
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => setLogs(d?.uploads || []))
      .catch(() => {});
  }, []);
  useEffect(() => { loadLogs(); }, [loadLogs]);

  const handleFile = useCallback(async (file: File) => {
    setPhase("parsing");
    setError(null);

    try {
      const formData = new FormData();
      formData.append("file", file);

      const res = await fetch("/api/upload/parse", { method: "POST", body: formData });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || t("upload.parseError"));
      }

      const data: ParseResult = await res.json();
      setResult(data);
      setPhase("preview");
    } catch (e) {
      setError(e instanceof Error ? e.message : t("upload.unexpectedError"));
      setPhase("error");
    }
  }, [t]);

  const handleConfirm = useCallback(async () => {
    if (!result) return;
    setPhase("confirming");

    try {
      const res = await fetch("/api/upload/confirm", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ filename: result.filename, rows: result.rows }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || t("upload.confirmError"));
      }

      const data: ConfirmResult = await res.json();
      setConfirmResult(data);
      setPhase("done");
      loadLogs(); // rafraîchir l'historique
    } catch (e) {
      setError(e instanceof Error ? e.message : t("upload.unexpectedError"));
      setPhase("error");
    }
  }, [result, loadLogs, t]);

  const reset = useCallback(() => {
    setPhase("select");
    setResult(null);
    setConfirmResult(null);
    setError(null);
  }, []);

  return (
    <div className="chanv-surface">
      <div className="mx-auto max-w-5xl px-4 py-8 space-y-8">
        <div>
          <h2 className="text-2xl font-bold mb-1">📤 {t("upload.title")}</h2>
          <p className="text-sm text-slate-500">
            {t("upload.subtitle")}
          </p>
        </div>

        {/* Phase: Sélection du fichier */}
        {(phase === "select" || phase === "error") && (
          <div className="section-card" style={{ padding: "32px" }}>
            <div className="flex items-center gap-3 mb-6">
              <span className="section-num">01</span>
              <h3 className="text-lg font-semibold">{t("upload.selectFile")}</h3>
            </div>
            <FileDropZone onFile={handleFile} />
            {error && (
              <div className="mt-4 p-4 bg-red-50 border border-red-200 rounded-xl text-red-700 text-sm">
                ❌ {error}
              </div>
            )}
          </div>
        )}

        {/* Phase: Parsing en cours */}
        {phase === "parsing" && (
          <div className="section-card p-8 text-center">
            <div className="spinner mx-auto mb-4" />
            <p className="text-sm text-slate-500">{t("upload.parsing")}</p>
          </div>
        )}

        {/* Phase: Preview du matching */}
        {phase === "preview" && result && (
          <div className="section-card" style={{ padding: "32px" }}>
            <div className="flex items-center gap-3 mb-6">
              <span className="section-num">02</span>
              <h3 className="text-lg font-semibold">{t("upload.matchingResults")}</h3>
            </div>

            {/* Summary */}
            <div className="flex gap-4 mb-6 flex-wrap">
              <div className="badge-accent px-4 py-2 rounded-xl text-sm">
                ✅ {t("upload.matchedCount", { n: result.stats.matched })}
              </div>
              <div className="badge-neutral px-4 py-2 rounded-xl text-sm">
                ⚠️ {t("upload.unmatchedCount", { n: result.stats.unmatched })}
              </div>
              {result.stats.invalid > 0 && (
                <div className="px-4 py-2 rounded-xl text-sm bg-red-50 text-red-700">
                  ❌ {t("upload.invalidCount", { n: result.stats.invalid })}
                </div>
              )}
              <div className="px-4 py-2 rounded-xl text-sm bg-slate-100 text-slate-600 ml-auto">
                📊 {t("upload.totalRows", { n: result.totalRows })}
              </div>
            </div>

            {/* Table preview */}
            <div className="overflow-x-auto max-h-96 overflow-y-auto rounded-xl border border-[var(--chanv-fibre)]">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>{t("upload.colStatus")}</th>
                    <th>{t("upload.colStoreOcs")}</th>
                    <th>{t("upload.colCity")}</th>
                    <th>{t("upload.colMatchedStore")}</th>
                    <th>{t("upload.colStoreNumber")}</th>
                    <th>{t("upload.colProduct")}</th>
                    <th>{t("upload.colUnits")}</th>
                    <th>GTIN12</th>
                  </tr>
                </thead>
                <tbody>
                  {result.rows.slice(0, 100).map((row, i) => (
                    <tr key={i}>
                      <td>
                        <span
                          className={`badge ${
                            row.status === "matched"
                              ? "badge-accent"
                              : row.status === "unmatched"
                                ? "badge-neutral"
                                : ""
                          }`}
                          style={
                            row.status === "invalid"
                              ? { background: "#FED7D7", color: "#C53030" }
                              : undefined
                          }
                        >
                          {row.status === "matched"
                            ? "✅"
                            : row.status === "unmatched"
                              ? "⚠️"
                              : "❌"}
                        </span>
                      </td>
                      <td className="text-sm">{row.raw.storeName}</td>
                      <td className="text-sm">{row.raw.city || row.computed.mailingCity}</td>
                      <td className="text-sm">{row.computed.succursale}</td>
                      <td className="text-sm font-mono">{row.computed.storeNumber}</td>
                      <td className="text-sm">{row.raw.itemName}</td>
                      <td className="text-sm text-right">{row.raw.unitsSold}</td>
                      <td className="text-sm font-mono">{row.computed.gtin12}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {result.rows.length > 100 && (
              <p className="text-xs text-slate-400 mt-2 text-center">
                {t("upload.previewLimit", { n: result.rows.length })}
              </p>
            )}

            {/* Actions */}
            <div className="flex gap-4 mt-8 justify-end">
              <button className="btn btn-secondary" onClick={reset}>
                ← {t("upload.cancel")}
              </button>
              <button className="btn btn-primary" onClick={handleConfirm}>
                {t("upload.confirmImport")} ✓
              </button>
            </div>
          </div>
        )}

        {/* Phase: Confirmation en cours */}
        {phase === "confirming" && (
          <div className="section-card p-8 text-center">
            <div className="spinner mx-auto mb-4" />
            <p className="text-sm text-slate-500">
              {t("upload.writing")}
            </p>
          </div>
        )}

        {/* Phase: Terminé */}
        {phase === "done" && confirmResult && (
          <div className="section-card p-8 text-center">
            <div className="text-5xl mb-4">✅</div>
            <h3 className="text-xl font-bold mb-4">{t("upload.doneTitle")}</h3>
            <div className="flex gap-6 justify-center mb-8 flex-wrap">
              <div className="text-center">
                <div className="text-2xl font-bold text-[var(--chanv-terre)]">
                  {confirmResult.stats.stores_created}
                </div>
                <div className="text-xs text-slate-500 uppercase tracking-wider">
                  {t("upload.storesCreated")}
                </div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-[var(--chanv-terre)]">
                  {confirmResult.stats.stores_updated}
                </div>
                <div className="text-xs text-slate-500 uppercase tracking-wider">
                  {t("upload.storesUpdated")}
                </div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-[var(--chanv-terre)]">
                  {confirmResult.stats.products_added}
                </div>
                <div className="text-xs text-slate-500 uppercase tracking-wider">
                  {t("upload.productsAdded")}
                </div>
              </div>
            </div>
            <button className="btn btn-primary" onClick={reset}>
              {t("upload.newImport")}
            </button>
          </div>
        )}

        {/* Historique des imports */}
        {logs.length > 0 && (
          <div className="section-card" style={{ padding: "24px" }}>
            <h3 className="text-sm font-bold uppercase tracking-wider text-slate-500 mb-4">
              📋 {t("upload.historyTitle")}
            </h3>
            <div style={{ overflowX: "auto" }}>
              <table className="chanv-table">
                <thead>
                  <tr>
                    <th>{t("upload.colDate")}</th>
                    <th>{t("upload.colFile")}</th>
                    <th>{t("upload.colBy")}</th>
                    <th style={{ textAlign: "right" }}>{t("upload.colRows")}</th>
                    <th style={{ textAlign: "right" }}>{t("upload.storesCreated")}</th>
                    <th style={{ textAlign: "right" }}>{t("upload.colStoresUpdatedShort")}</th>
                    <th style={{ textAlign: "right" }}>{t("upload.colProducts")}</th>
                    <th>{t("upload.colStatusLabel")}</th>
                  </tr>
                </thead>
                <tbody>
                  {logs.map((log) => (
                    <tr key={log.id}>
                      <td className="text-xs whitespace-nowrap">{formatLogDate(log.uploaded_at, locale)}</td>
                      <td className="text-xs font-mono" style={{ maxWidth: 200, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                        {log.filename}
                      </td>
                      <td className="text-xs">{log.uploaded_by?.split("@")[0] || "—"}</td>
                      <td className="text-xs" style={{ textAlign: "right" }}>{log.rows_imported ?? "—"}</td>
                      <td className="text-xs" style={{ textAlign: "right" }}>{log.stores_created ?? 0}</td>
                      <td className="text-xs" style={{ textAlign: "right" }}>{log.stores_updated ?? 0}</td>
                      <td className="text-xs" style={{ textAlign: "right" }}>{log.products_added ?? 0}</td>
                      <td className="text-xs whitespace-nowrap">{STATUS_LABEL_KEYS[log.status] ? t(STATUS_LABEL_KEYS[log.status]) : log.status}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
