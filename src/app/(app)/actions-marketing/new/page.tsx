"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useT } from "@/lib/i18n";

/* ── Types ─────────────────────────────────────── */
interface StoreOption { id: string; name: string; city: string; region: string; address: string }
interface ProductOption { sku: string; name: string }

const ACTION_TYPES = [
  { value: "plv_envoye", emoji: "📦", key: "mkt.type.plv_envoye" },
  { value: "plv_installe", emoji: "🖼️", key: "mkt.type.plv_installe" },
  { value: "visite_terrain", emoji: "🚗", key: "mkt.type.visite_terrain" },
  { value: "courriel", emoji: "📧", key: "mkt.type.courriel" },
  { value: "appel", emoji: "📞", key: "mkt.type.appel" },
  { value: "sms", emoji: "💬", key: "mkt.type.sms" },
  { value: "formation", emoji: "🎓", key: "mkt.type.formation" },
  { value: "promo", emoji: "🏷️", key: "mkt.type.promo" },
  { value: "evenement", emoji: "🎪", key: "mkt.type.evenement" },
  { value: "autre", emoji: "📝", key: "mkt.type.autre" },
];

const STATUSES = [
  { value: "planifie", key: "mkt.status.planifie" },
  { value: "en_cours", key: "mkt.status.en_cours" },
  { value: "complete", key: "mkt.status.complete" },
  { value: "annule", key: "mkt.status.annule" },
];

export default function NewActionPage() {
  const t = useT();
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

  // Produits du store sélectionné → datalist SKU (le calcul d'impact
  // matche par SKU exact : une typo donnerait un impact silencieusement nul)
  const [storeProducts, setStoreProducts] = useState<ProductOption[]>([]);
  useEffect(() => {
    if (!storeId) { setStoreProducts([]); return; }
    fetch(`/api/stores/${storeId}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        const prods = ((d?.products || []) as Record<string, unknown>[])
          .map((p) => ({ sku: String(p.sku || ""), name: String(p.name || "") }))
          .filter((p) => p.sku);
        setStoreProducts(prods.sort((a, b) => a.name.localeCompare(b.name)));
      })
      .catch(() => setStoreProducts([]));
  }, [storeId]);

  // Auto-remplir le nom du produit quand le SKU saisi correspond
  useEffect(() => {
    if (!sku || productName) return;
    const match = storeProducts.find((p) => p.sku === sku);
    if (match?.name) setProductName(match.name);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sku, storeProducts]);

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
        setError(data.error || t("mkt.new.errorCreate"));
        return;
      }

      router.push("/actions-marketing");
    } catch {
      setError(t("mkt.new.errorNetwork"));
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="chanv-surface">
      <div className="mx-auto max-w-3xl px-4 py-8">
        <h2 className="text-2xl font-bold mb-1">➕ {t("mkt.new.title")}</h2>
        <p className="text-sm text-slate-500 mb-6">
          {t("mkt.new.subtitle")}
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
              <label className="chanv-label" htmlFor="campaign">{t("mkt.form.campaign")} *</label>
              <input
                id="campaign"
                type="text"
                required
                maxLength={200}
                value={campaign}
                onChange={(e) => setCampaign(e.target.value)}
                className="chanv-input"
                placeholder={t("mkt.form.campaignPh")}
              />
            </div>
            <div>
              <label className="chanv-label" htmlFor="actionType">{t("mkt.form.actionType")} *</label>
              <select
                id="actionType"
                required
                value={actionType}
                onChange={(e) => setActionType(e.target.value)}
                className="chanv-select"
              >
                {ACTION_TYPES.map((at) => (
                  <option key={at.value} value={at.value}>{at.emoji} {t(at.key)}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Store + Date */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="chanv-label" htmlFor="storeId">{t("mkt.form.store")} *</label>
              <select
                id="storeId"
                required
                value={storeId}
                onChange={(e) => setStoreId(e.target.value)}
                className="chanv-select"
              >
                <option value="">{t("mkt.form.storeSelect")}</option>
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
              <label className="chanv-label" htmlFor="actionDate">{t("mkt.form.date")} *</label>
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
              <label className="chanv-label" htmlFor="productName">{t("mkt.form.product")}</label>
              <input
                id="productName"
                type="text"
                maxLength={200}
                value={productName}
                onChange={(e) => setProductName(e.target.value)}
                className="chanv-input"
                placeholder={t("mkt.form.productPh")}
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
                list="sku-options"
                placeholder={storeId ? t("mkt.form.skuPhStore") : t("mkt.form.skuPh")}
              />
              <datalist id="sku-options">
                {storeProducts.map((p) => (
                  <option key={p.sku} value={p.sku}>{p.name}</option>
                ))}
              </datalist>
              {storeId && storeProducts.length === 0 && (
                <p className="text-xs text-slate-400 mt-1">{t("mkt.form.noProducts")}</p>
              )}
            </div>
          </div>

          {/* Responsable + Statut */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="chanv-label" htmlFor="responsible">{t("mkt.form.responsible")}</label>
              <input
                id="responsible"
                type="text"
                maxLength={200}
                value={responsible}
                onChange={(e) => setResponsible(e.target.value)}
                className="chanv-input"
                placeholder={t("mkt.form.responsiblePh")}
              />
            </div>
            <div>
              <label className="chanv-label" htmlFor="status">{t("mkt.form.status")}</label>
              <select
                id="status"
                value={status}
                onChange={(e) => setStatus(e.target.value)}
                className="chanv-select"
              >
                {STATUSES.map((s) => (
                  <option key={s.value} value={s.value}>{t(s.key)}</option>
                ))}
              </select>
            </div>
          </div>

          {/* PLV Type + Coût */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="chanv-label" htmlFor="plvType">{t("mkt.form.plvType")}</label>
              <input
                id="plvType"
                type="text"
                maxLength={100}
                value={plvType}
                onChange={(e) => setPlvType(e.target.value)}
                className="chanv-input"
                placeholder={t("mkt.form.plvPh")}
              />
            </div>
            <div>
              <label className="chanv-label" htmlFor="cost">{t("mkt.form.cost")}</label>
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
            <label className="chanv-label" htmlFor="objective">{t("mkt.form.objective")}</label>
            <input
              id="objective"
              type="text"
              maxLength={500}
              value={objective}
              onChange={(e) => setObjective(e.target.value)}
              className="chanv-input"
              placeholder={t("mkt.form.objectivePh")}
            />
          </div>

          {/* Lien preuve */}
          <div>
            <label className="chanv-label" htmlFor="proofLink">{t("mkt.form.proofLink")}</label>
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
            <label className="chanv-label" htmlFor="notes">{t("mkt.form.notes")}</label>
            <textarea
              id="notes"
              maxLength={1000}
              rows={3}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="chanv-input"
              placeholder={t("mkt.form.notesPh")}
            />
          </div>

          {/* Submit */}
          <div className="flex items-center gap-4 pt-2">
            <button
              type="submit"
              disabled={saving}
              className="chanv-btn-primary"
            >
              {saving ? t("mkt.form.saving") : `💾 ${t("mkt.form.save")}`}
            </button>
            <button
              type="button"
              onClick={() => router.push("/actions-marketing")}
              className="chanv-btn-secondary"
            >
              {t("mkt.form.cancel")}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
