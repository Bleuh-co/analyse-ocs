"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

/* ── Types ─────────────────────────────────────── */
interface StoreOption { id: string; name: string; city: string; region: string; address: string }

const ACTION_TYPES = [
  { value: "plv_envoye", label: "📦 PLV envoyé" },
  { value: "plv_installe", label: "🖼️ PLV installé" },
  { value: "visite_terrain", label: "🚗 Visite terrain" },
  { value: "courriel", label: "📧 Courriel" },
  { value: "appel", label: "📞 Appel" },
  { value: "sms", label: "💬 SMS" },
  { value: "formation", label: "🎓 Formation" },
  { value: "promo", label: "🏷️ Promo" },
  { value: "evenement", label: "🎪 Événement" },
  { value: "autre", label: "📝 Autre" },
];

const STATUSES = [
  { value: "planifie", label: "Planifié" },
  { value: "en_cours", label: "En cours" },
  { value: "complete", label: "Complété" },
  { value: "annule", label: "Annulé" },
];

export default function NewActionPage() {
  const router = useRouter();
  const [stores, setStores] = useState<StoreOption[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  // Form state
  const [campaign, setCampaign] = useState("");
  const [actionType, setActionType] = useState("visite_terrain");
  const [storeId, setStoreId] = useState("");
  const [actionDate, setActionDate] = useState(new Date().toISOString().split("T")[0]);
  const [sku, setSku] = useState("");
  const [productName, setProductName] = useState("");
  const [responsible, setResponsible] = useState("");
  const [status, setStatus] = useState("planifie");
  const [plvType, setPlvType] = useState("");
  const [cost, setCost] = useState("");
  const [objective, setObjective] = useState("");
  const [proofLink, setProofLink] = useState("");
  const [notes, setNotes] = useState("");

  // Load stores dropdown
  useEffect(() => {
    fetch("/api/stores?limit=1000")
      .then((r) => r.json())
      .then((d) => {
        const list = (d.stores || []).map((s: Record<string, unknown>) => ({
          id: s.id,
          name: s.name || s.id,
          city: s.city || "",
          region: s.region || "",
          address: s.address || "",
        }));
        setStores(list.sort((a: StoreOption, b: StoreOption) => a.name.localeCompare(b.name)));
      });
  }, []);

  // Auto-fill store info
  const selectedStore = stores.find((s) => s.id === storeId);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setSaving(true);

    try {
      const body = {
        campaign,
        action_type: actionType,
        store_id: storeId,
        store_name: selectedStore?.name || "",
        store_address: selectedStore?.address || "",
        store_city: selectedStore?.city || "",
        store_region: selectedStore?.region || "",
        action_date: actionDate,
        sku,
        product_name: productName,
        responsible,
        status,
        plv_type: plvType,
        cost: cost ? parseFloat(cost) : null,
        objective,
        proof_link: proofLink,
        notes,
      };

      const res = await fetch("/api/marketing-actions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Erreur lors de la création");
        return;
      }

      router.push("/actions-marketing");
    } catch {
      setError("Erreur réseau");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="chanv-surface">
      <div className="mx-auto max-w-3xl px-4 py-8">
        <h2 className="text-2xl font-bold mb-1">➕ Nouvelle action marketing</h2>
        <p className="text-sm text-slate-500 mb-6">
          Enregistrer une action terrain, PLV ou campagne
        </p>

        {error && (
          <div className="bg-red-50 text-red-700 border border-red-200 rounded-lg px-4 py-3 mb-6 text-sm">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Campagne + Type */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="chanv-label" htmlFor="campaign">Campagne *</label>
              <input
                id="campaign"
                type="text"
                required
                maxLength={200}
                value={campaign}
                onChange={(e) => setCampaign(e.target.value)}
                className="chanv-input"
                placeholder="ex: Lancement Haze 3.5g"
              />
            </div>
            <div>
              <label className="chanv-label" htmlFor="actionType">Type d&apos;action *</label>
              <select
                id="actionType"
                required
                value={actionType}
                onChange={(e) => setActionType(e.target.value)}
                className="chanv-select"
              >
                {ACTION_TYPES.map((t) => (
                  <option key={t.value} value={t.value}>{t.label}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Store + Date */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="chanv-label" htmlFor="storeId">Store ciblé *</label>
              <select
                id="storeId"
                required
                value={storeId}
                onChange={(e) => setStoreId(e.target.value)}
                className="chanv-select"
              >
                <option value="">— Sélectionner un store —</option>
                {stores.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name} — {s.city}
                  </option>
                ))}
              </select>
              {selectedStore && (
                <p className="text-xs text-slate-400 mt-1">
                  📍 {selectedStore.address}, {selectedStore.city} • {selectedStore.region}
                </p>
              )}
            </div>
            <div>
              <label className="chanv-label" htmlFor="actionDate">Date de l&apos;action *</label>
              <input
                id="actionDate"
                type="date"
                required
                value={actionDate}
                onChange={(e) => setActionDate(e.target.value)}
                className="chanv-input"
              />
            </div>
          </div>

          {/* Produit + SKU */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="chanv-label" htmlFor="productName">Produit ciblé</label>
              <input
                id="productName"
                type="text"
                maxLength={200}
                value={productName}
                onChange={(e) => setProductName(e.target.value)}
                className="chanv-input"
                placeholder="ex: Bleuh Haze 3.5g"
              />
            </div>
            <div>
              <label className="chanv-label" htmlFor="sku">SKU</label>
              <input
                id="sku"
                type="text"
                maxLength={50}
                value={sku}
                onChange={(e) => setSku(e.target.value)}
                className="chanv-input"
                placeholder="ex: BLA-HYB-3.5G"
              />
            </div>
          </div>

          {/* Responsable + Statut */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="chanv-label" htmlFor="responsible">Responsable</label>
              <input
                id="responsible"
                type="text"
                maxLength={200}
                value={responsible}
                onChange={(e) => setResponsible(e.target.value)}
                className="chanv-input"
                placeholder="ex: Dany"
              />
            </div>
            <div>
              <label className="chanv-label" htmlFor="status">Statut</label>
              <select
                id="status"
                value={status}
                onChange={(e) => setStatus(e.target.value)}
                className="chanv-select"
              >
                {STATUSES.map((s) => (
                  <option key={s.value} value={s.value}>{s.label}</option>
                ))}
              </select>
            </div>
          </div>

          {/* PLV Type + Coût */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="chanv-label" htmlFor="plvType">Type de PLV / Asset</label>
              <input
                id="plvType"
                type="text"
                maxLength={100}
                value={plvType}
                onChange={(e) => setPlvType(e.target.value)}
                className="chanv-input"
                placeholder="ex: Affiche vitrine, Présentoir"
              />
            </div>
            <div>
              <label className="chanv-label" htmlFor="cost">Coût ($)</label>
              <input
                id="cost"
                type="number"
                min="0"
                step="0.01"
                value={cost}
                onChange={(e) => setCost(e.target.value)}
                className="chanv-input"
                placeholder="0.00"
              />
            </div>
          </div>

          {/* Objectif */}
          <div>
            <label className="chanv-label" htmlFor="objective">Objectif</label>
            <input
              id="objective"
              type="text"
              maxLength={500}
              value={objective}
              onChange={(e) => setObjective(e.target.value)}
              className="chanv-input"
              placeholder="ex: Augmenter la visibilité du produit"
            />
          </div>

          {/* Lien preuve */}
          <div>
            <label className="chanv-label" htmlFor="proofLink">Lien photo / preuve</label>
            <input
              id="proofLink"
              type="url"
              maxLength={500}
              value={proofLink}
              onChange={(e) => setProofLink(e.target.value)}
              className="chanv-input"
              placeholder="https://drive.google.com/..."
            />
          </div>

          {/* Notes */}
          <div>
            <label className="chanv-label" htmlFor="notes">Notes</label>
            <textarea
              id="notes"
              maxLength={1000}
              rows={3}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="chanv-input"
              placeholder="Notes additionnelles…"
            />
          </div>

          {/* Submit */}
          <div className="flex items-center gap-4 pt-2">
            <button
              type="submit"
              disabled={saving}
              className="chanv-btn-primary"
            >
              {saving ? "Enregistrement…" : "💾 Enregistrer l'action"}
            </button>
            <button
              type="button"
              onClick={() => router.push("/actions-marketing")}
              className="chanv-btn-secondary"
            >
              Annuler
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
