"use client";

import { useEffect, useState, useCallback } from "react";
import { useAuth } from "@/components/AuthProvider";
import { DataTable } from "@/components/DataTable";
import { useT, useLocale } from "@/lib/i18n";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Store = Record<string, any>;

function canEdit(role?: string) {
  return role === "admin" || role === "superadmin" || role === "gestionnaire";
}
function isAdmin(role?: string) {
  return role === "admin" || role === "superadmin";
}

function formatDate(d: { _seconds: number } | string | undefined, locale: string): string {
  if (!d) return "—";
  const ts = typeof d === "object" && "_seconds" in d ? d._seconds * 1000 : Date.parse(d as string);
  if (isNaN(ts)) return "—";
  return new Intl.DateTimeFormat(locale, { dateStyle: "medium" }).format(new Date(ts));
}

export default function StoresPage() {
  const t = useT();
  const locale = useLocale();
  const { session } = useAuth();
  const [stores, setStores] = useState<Store[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedStore, setSelectedStore] = useState<Store | null>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [storeProducts, setStoreProducts] = useState<any[]>([]);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [changelog, setChangelog] = useState<any[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [editingStore, setEditingStore] = useState<Store | null>(null);
  const [saving, setSaving] = useState(false);

  const loadStores = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/stores");
      const data = await res.json();
      setStores(data.stores || []);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadStores();
  }, [loadStores]);

  const openDetail = useCallback(async (store: Store) => {
    setSelectedStore(store);
    setStoreProducts([]);
    setChangelog([]);

    const [detailRes, changelogRes] = await Promise.all([
      fetch(`/api/stores/${store.id}`),
      fetch(`/api/stores/${store.id}/changelog`),
    ]);
    const detail = await detailRes.json();
    const cl = await changelogRes.json();

    setStoreProducts(detail.products || []);
    setChangelog(cl.changelog || []);
  }, []);

  const openForm = useCallback((store?: Store) => {
    setEditingStore(store || null);
    setShowForm(true);
  }, []);

  const saveStore = useCallback(
    async (formData: Record<string, string>) => {
      setSaving(true);
      try {
        if (editingStore) {
          await fetch(`/api/stores/${editingStore.id}`, {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(formData),
          });
        } else {
          await fetch("/api/stores", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(formData),
          });
        }
        setShowForm(false);
        setSelectedStore(null);
        loadStores();
      } finally {
        setSaving(false);
      }
    },
    [editingStore, loadStores]
  );

  const deleteStore = useCallback(
    async (id: string) => {
      if (!window.confirm(t("stores.confirmDelete"))) return;
      await fetch(`/api/stores/${id}`, { method: "DELETE" });
      setSelectedStore(null);
      loadStores();
    },
    [loadStores, t]
  );

  const columns = [
    { key: "name", label: t("stores.colName") },
    { key: "city", label: t("stores.colCity") },
    { key: "address", label: t("stores.colAddress") },
    { key: "postal_code", label: t("stores.colPostalCode") },
    { key: "store_number", label: t("stores.colStoreNumber") },
    {
      key: "updated_at",
      label: t("stores.colUpdated"),
      render: (row: Store) => formatDate(row.updated_at, locale),
    },
  ];

  return (
    <div className="chanv-surface">
      <div className="mx-auto max-w-5xl px-4 py-8 space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold mb-1">🏪 {t("stores.title")}</h2>
            <p className="text-sm text-slate-500">
              {t("stores.activeCount", { n: stores.length })}
            </p>
          </div>
          {canEdit(session?.role) && (
            <button className="btn btn-primary" onClick={() => openForm()}>
              + {t("stores.addStore")}
            </button>
          )}
        </div>

        {session?.role === "membre" && (
          <div className="p-4 rounded-xl border" style={{ background: "linear-gradient(90deg, rgba(49,130,206,0.1), rgba(49,130,206,0.05))", borderColor: "rgba(49,130,206,0.25)" }}>
            <strong style={{ color: "#2B6CB0", fontSize: "14px" }}>👁️ {t("stores.viewModeTitle")}</strong>
            <p className="text-xs text-slate-500 mt-1">
              {t("stores.viewModeDesc")}
            </p>
          </div>
        )}

        <DataTable
          columns={columns}
          data={stores}
          loading={loading}
          searchPlaceholder={`🔍 ${t("stores.searchPlaceholder")}`}
          searchKeys={["name", "city", "address", "postal_code"]}
          emptyMessage={t("stores.emptyMessage")}
          onRowClick={openDetail}
        />
      </div>

      {/* Store Detail Modal */}
      {selectedStore && (
        <div className="modal-overlay" onClick={() => setSelectedStore(null)}>
          <div className="modal-card" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 900 }}>
            <div className="modal-header">
              <h2>{selectedStore.name}</h2>
              <button className="modal-close" onClick={() => setSelectedStore(null)}>
                ×
              </button>
            </div>

            <div style={{ padding: "24px", maxHeight: "70vh", overflowY: "auto" }}>
              {/* Store info grid */}
              <div className="grid grid-cols-2 gap-4 mb-6" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
                <InfoField label={t("stores.fieldStoreNumber")} value={selectedStore.store_number} />
                <InfoField label={t("stores.fieldCity")} value={selectedStore.city} />
                <InfoField label={t("stores.fieldAddress")} value={selectedStore.address} />
                <InfoField label={t("stores.fieldPostalCode")} value={selectedStore.postal_code} />
                <InfoField label={t("stores.fieldProvince")} value={selectedStore.state || "ON"} />
                <InfoField label={t("stores.fieldRegion")} value={selectedStore.region} />
                <InfoField label={t("stores.fieldPhone")} value={selectedStore.phone} />
                <InfoField label={t("stores.fieldWebsite")} value={selectedStore.website} />
                <InfoField label={t("stores.fieldRepresentative")} value={selectedStore.representative} />
                <InfoField label={t("stores.fieldSource")} value={selectedStore.source} />
              </div>

              {/* Products */}
              {storeProducts.length > 0 && (
                <div className="mb-6">
                  <h4 className="text-sm font-bold uppercase tracking-wider text-slate-500 mb-3">
                    📦 {t("stores.productsTitle", { n: storeProducts.length })}
                  </h4>
                  <div className="overflow-x-auto rounded-xl border border-[var(--chanv-fibre)]">
                    <table className="data-table">
                      <thead>
                        <tr>
                          <th>{t("stores.colProdName")}</th>
                          <th>SKU</th>
                          <th>{t("stores.colCategory")}</th>
                          <th>{t("stores.colUnits")}</th>
                          <th>{t("stores.colLastOrder")}</th>
                        </tr>
                      </thead>
                      <tbody>
                        {storeProducts.map((p) => (
                          <tr key={p.id}>
                            <td className="text-sm">{p.name}</td>
                            <td className="text-sm font-mono">{p.sku}</td>
                            <td className="text-sm">{p.category}</td>
                            <td className="text-sm text-right">{p.units_sold}</td>
                            <td className="text-sm">{p.last_order_date}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* Changelog */}
              {changelog.length > 0 && (
                <div>
                  <h4 className="text-sm font-bold uppercase tracking-wider text-slate-500 mb-3">
                    📋 {t("stores.historyTitle")}
                  </h4>
                  <div className="space-y-2">
                    {changelog.slice(0, 10).map((entry) => (
                      <div
                        key={entry.id}
                        className="text-xs p-3 rounded-lg bg-[var(--chanv-fibre)]"
                      >
                        <strong>{entry.action}</strong> {t("stores.by")} {entry.performed_by} —{" "}
                        {formatDate(entry.performed_at, locale)}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Actions */}
            {canEdit(session?.role) && (
              <div className="flex gap-3" style={{ padding: "16px 24px", borderTop: "1px solid var(--chanv-fibre)" }}>
                <button
                  className="btn btn-primary"
                  style={{ flex: 1 }}
                  onClick={() => {
                    setSelectedStore(null);
                    openForm(selectedStore);
                  }}
                >
                  ✏️ {t("stores.edit")}
                </button>
                {isAdmin(session?.role) && (
                  <button
                    className="btn"
                    style={{
                      padding: "10px 20px",
                      background: "#E53E3E",
                      color: "white",
                      border: "none",
                      borderRadius: "12px",
                      cursor: "pointer",
                      fontWeight: 600,
                    }}
                    onClick={() => deleteStore(selectedStore.id)}
                  >
                    🗑️ {t("stores.delete")}
                  </button>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Store Form Modal */}
      {showForm && (
        <StoreForm
          store={editingStore}
          saving={saving}
          onSave={saveStore}
          onClose={() => setShowForm(false)}
        />
      )}
    </div>
  );
}

function InfoField({ label, value }: { label: string; value?: string }) {
  return (
    <div>
      <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1">
        {label}
      </div>
      <div className="text-sm">{value || "—"}</div>
    </div>
  );
}

function StoreForm({
  store,
  saving,
  onSave,
  onClose,
}: {
  store: Store | null;
  saving: boolean;
  onSave: (data: Record<string, string>) => void;
  onClose: () => void;
}) {
  const t = useT();
  const fields = [
    { key: "name", label: t("stores.fieldNameRequired"), span: 2, required: true },
    { key: "store_number", label: t("stores.fieldStoreNumber"), placeholder: t("stores.placeholderAutoGenerated") },
    { key: "phone", label: t("stores.fieldPhone"), placeholder: "(613) 555-1234" },
    { key: "address", label: t("stores.fieldAddress"), span: 2 },
    { key: "city", label: t("stores.fieldCity") },
    { key: "state", label: t("stores.fieldProvince"), defaultValue: "ON" },
    { key: "postal_code", label: t("stores.fieldPostalCode") },
    { key: "region", label: t("stores.fieldRegion") },
    { key: "website", label: t("stores.fieldWebsite"), span: 2, type: "url" },
    { key: "email", label: t("stores.fieldEmail"), type: "email" },
    { key: "representative", label: t("stores.fieldRepresentative") },
  ];

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    const data: Record<string, string> = {};
    fields.forEach((f) => {
      data[f.key] = (form.get(f.key) as string) || "";
    });
    onSave(data);
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-card" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 700 }}>
        <div className="modal-header">
          <h2>{store ? t("stores.formTitleEdit") : t("stores.formTitleNew")}</h2>
          <button className="modal-close" onClick={onClose}>
            ×
          </button>
        </div>
        <form onSubmit={handleSubmit} style={{ padding: 24, maxHeight: "70vh", overflowY: "auto" }}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
            {fields.map((f) => (
              <div key={f.key} style={f.span === 2 ? { gridColumn: "span 2" } : undefined}>
                <label className="label">{f.label}</label>
                <input
                  name={f.key}
                  type={f.type || "text"}
                  className="input"
                  defaultValue={store?.[f.key] || f.defaultValue || ""}
                  placeholder={f.placeholder || ""}
                  required={f.required}
                />
              </div>
            ))}
          </div>
          <div className="flex gap-3 mt-6" style={{ display: "flex", gap: 12, marginTop: 24 }}>
            <button type="button" className="btn btn-secondary" onClick={onClose} style={{ flex: 1 }}>
              ← {t("stores.cancel")}
            </button>
            <button type="submit" className="btn btn-primary" disabled={saving} style={{ flex: 2 }}>
              {saving ? t("stores.saving") : `💾 ${t("stores.save")}`}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
