"use client";

import { useEffect, useState, useCallback } from "react";
import { useAuth } from "@/components/AuthProvider";
import { DataTable } from "@/components/DataTable";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Store = Record<string, any>;

function canEdit(role?: string) {
  return role === "admin" || role === "superadmin" || role === "gestionnaire";
}
function isAdmin(role?: string) {
  return role === "admin" || role === "superadmin";
}

function formatDate(d: { _seconds: number } | string | undefined): string {
  if (!d) return "—";
  const ts = typeof d === "object" && "_seconds" in d ? d._seconds * 1000 : Date.parse(d as string);
  if (isNaN(ts)) return "—";
  return new Intl.DateTimeFormat("fr-CA", { dateStyle: "medium" }).format(new Date(ts));
}

export default function StoresPage() {
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
      if (!window.confirm("Supprimer ce store et tous ses produits ?")) return;
      await fetch(`/api/stores/${id}`, { method: "DELETE" });
      setSelectedStore(null);
      loadStores();
    },
    [loadStores]
  );

  const columns = [
    { key: "name", label: "Nom" },
    { key: "city", label: "Ville" },
    { key: "address", label: "Adresse" },
    { key: "postal_code", label: "Code Postal" },
    { key: "store_number", label: "Store #" },
    {
      key: "updated_at",
      label: "MAJ",
      render: (row: Store) => formatDate(row.updated_at),
    },
  ];

  return (
    <div className="chanv-surface">
      <div className="mx-auto max-w-5xl px-4 py-8 space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold mb-1">🏪 Retailers Ontario</h2>
            <p className="text-sm text-slate-500">
              {stores.length} stores actifs
            </p>
          </div>
          {canEdit(session?.role) && (
            <button className="btn btn-primary" onClick={() => openForm()}>
              + Ajouter un store
            </button>
          )}
        </div>

        {session?.role === "membre" && (
          <div className="p-4 rounded-xl border" style={{ background: "linear-gradient(90deg, rgba(49,130,206,0.1), rgba(49,130,206,0.05))", borderColor: "rgba(49,130,206,0.25)" }}>
            <strong style={{ color: "#2B6CB0", fontSize: "14px" }}>👁️ Mode Consultation</strong>
            <p className="text-xs text-slate-500 mt-1">
              Accès en lecture seule. Contactez un administrateur pour les droits d&apos;édition.
            </p>
          </div>
        )}

        <DataTable
          columns={columns}
          data={stores}
          loading={loading}
          searchPlaceholder="🔍 Rechercher par nom, ville, adresse..."
          searchKeys={["name", "city", "address", "postal_code"]}
          emptyMessage="Aucun store trouvé"
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
                <InfoField label="Store #" value={selectedStore.store_number} />
                <InfoField label="Ville" value={selectedStore.city} />
                <InfoField label="Adresse" value={selectedStore.address} />
                <InfoField label="Code postal" value={selectedStore.postal_code} />
                <InfoField label="Province" value={selectedStore.state || "ON"} />
                <InfoField label="Région" value={selectedStore.region} />
                <InfoField label="Téléphone" value={selectedStore.phone} />
                <InfoField label="Website" value={selectedStore.website} />
                <InfoField label="Représentant" value={selectedStore.representative} />
                <InfoField label="Source" value={selectedStore.source} />
              </div>

              {/* Products */}
              {storeProducts.length > 0 && (
                <div className="mb-6">
                  <h4 className="text-sm font-bold uppercase tracking-wider text-slate-500 mb-3">
                    📦 Produits ({storeProducts.length})
                  </h4>
                  <div className="overflow-x-auto rounded-xl border border-[var(--chanv-fibre)]">
                    <table className="data-table">
                      <thead>
                        <tr>
                          <th>Nom</th>
                          <th>SKU</th>
                          <th>Catégorie</th>
                          <th>Unités</th>
                          <th>Dernière commande</th>
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
                    📋 Historique
                  </h4>
                  <div className="space-y-2">
                    {changelog.slice(0, 10).map((entry) => (
                      <div
                        key={entry.id}
                        className="text-xs p-3 rounded-lg bg-[var(--chanv-fibre)]"
                      >
                        <strong>{entry.action}</strong> par {entry.performed_by} —{" "}
                        {formatDate(entry.performed_at)}
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
                  ✏️ Modifier
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
                    🗑️ Supprimer
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
  const fields = [
    { key: "name", label: "Nom du store *", span: 2, required: true },
    { key: "store_number", label: "Store #", placeholder: "Auto-généré si vide" },
    { key: "phone", label: "Téléphone", placeholder: "(613) 555-1234" },
    { key: "address", label: "Adresse", span: 2 },
    { key: "city", label: "Ville" },
    { key: "state", label: "Province", defaultValue: "ON" },
    { key: "postal_code", label: "Code postal" },
    { key: "region", label: "Région" },
    { key: "website", label: "Website", span: 2, type: "url" },
    { key: "email", label: "Email", type: "email" },
    { key: "representative", label: "Représentant" },
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
          <h2>{store ? "Modifier le store" : "Nouveau Store"}</h2>
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
              ← Annuler
            </button>
            <button type="submit" className="btn btn-primary" disabled={saving} style={{ flex: 2 }}>
              {saving ? "Enregistrement..." : "💾 Enregistrer"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
