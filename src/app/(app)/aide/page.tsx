"use client";

import { useState } from "react";
import { useT } from "@/lib/i18n";

/* ────────────────────────────────────────────────
 * Page Aide / FAQ — Analyse OCS
 * Explique : à quoi sert l'app, comment l'utiliser,
 * comment les données sont récupérées (import + matching)
 * et comment chaque chiffre est calculé.
 * Textes trilingues via useT() ; les valeurs peuvent
 * contenir **gras**, *italique* et `code` (rendu par <Rich/>).
 * ──────────────────────────────────────────────── */

/* ── Mini-rendu riche : **gras**, *italique*, `code` ── */
function Rich({ text }: { text: string }) {
  const parts = text.split(/(\*\*[^*]+\*\*|\*[^*]+\*|`[^`]+`)/g);
  return (
    <>
      {parts.map((p, i) => {
        if (p.startsWith("**") && p.endsWith("**")) return <strong key={i}>{p.slice(2, -2)}</strong>;
        if (p.startsWith("`") && p.endsWith("`")) return <code key={i}>{p.slice(1, -1)}</code>;
        if (p.startsWith("*") && p.endsWith("*") && p.length > 2) return <em key={i}>{p.slice(1, -1)}</em>;
        return p;
      })}
    </>
  );
}

/* ── Petits composants de présentation ─────────── */

function Callout({
  variant = "info",
  children,
}: {
  variant?: "info" | "tip" | "warn";
  children: React.ReactNode;
}) {
  const styles = {
    info: "border-blue-200 bg-blue-50 text-blue-900",
    tip: "border-green-200 bg-green-50 text-green-900",
    warn: "border-amber-200 bg-amber-50 text-amber-900",
  }[variant];
  return (
    <div className={`rounded-xl border px-4 py-3 text-sm leading-relaxed ${styles}`}>
      {children}
    </div>
  );
}

function Card({
  title,
  children,
}: {
  title?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="section-card" style={{ padding: "18px 22px" }}>
      {title && <h4 className="font-bold mb-2 text-[15px]">{title}</h4>}
      <div className="text-sm text-slate-600 leading-relaxed space-y-2">{children}</div>
    </div>
  );
}

function Section({
  id,
  n,
  title,
  children,
}: {
  id: string;
  n: number;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section id={id} className="scroll-mt-24 space-y-4">
      <div className="flex items-center gap-3">
        <span className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full bg-chanv-beige text-chanv-terre font-bold text-sm">
          {n}
        </span>
        <h2 className="text-xl font-bold m-0">{title}</h2>
      </div>
      {children}
    </section>
  );
}

/* ── Formule : bloc "méthode de calcul" ────────── */
function Formula({
  label,
  formula,
  note,
}: {
  label: string;
  formula: string;
  note?: string;
}) {
  return (
    <div className="rounded-lg border border-[var(--chanv-beige)] bg-[var(--chanv-fibre)] px-4 py-3">
      <div className="text-[11px] uppercase tracking-wider text-slate-500 font-semibold mb-1">
        {label}
      </div>
      <code className="text-[13px] text-chanv-terre font-mono">{formula}</code>
      {note && <p className="text-xs text-slate-500 mt-1.5 mb-0">{note}</p>}
    </div>
  );
}

/* ── FAQ accordéon ─────────────────────────────── */
function FaqAccordion() {
  const t = useT();
  const [open, setOpen] = useState<number | null>(0);
  const items = [1, 2, 3, 4, 5, 6, 7].map((i) => ({
    q: t(`help.faq.q${i}`),
    a: t(`help.faq.a${i}`),
  }));
  return (
    <div className="space-y-2">
      {items.map((item, i) => {
        const isOpen = open === i;
        return (
          <div
            key={i}
            className="section-card overflow-hidden"
            style={{ padding: 0 }}
          >
            <button
              onClick={() => setOpen(isOpen ? null : i)}
              className="flex w-full items-center justify-between gap-3 px-5 py-4 text-left"
            >
              <span className="font-semibold text-sm text-chanv-terre">{item.q}</span>
              <span
                className={`text-slate-400 transition-transform ${isOpen ? "rotate-180" : ""}`}
              >
                ▾
              </span>
            </button>
            {isOpen && (
              <div className="px-5 pb-4 text-sm text-slate-600 leading-relaxed animate-[chanvFadeIn_0.25s_ease]">
                <Rich text={item.a} />
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

export default function AidePage() {
  const t = useT();

  /* ── Sommaire ──────────────────────────────── */
  const toc = [
    { id: "presentation", label: t("help.toc.presentation") },
    { id: "roles", label: t("help.toc.roles") },
    { id: "import", label: t("help.toc.import") },
    { id: "calculs", label: t("help.toc.calc") },
    { id: "marketing", label: t("help.toc.marketing") },
    { id: "sheets", label: t("help.toc.sheets") },
    { id: "faq", label: t("help.toc.faq") },
  ];

  return (
    <div className="chanv-surface">
      <div className="mx-auto max-w-4xl px-4 py-8 space-y-10">
        {/* Hero */}
        <header className="text-center space-y-2">
          <div className="text-4xl">📖</div>
          <h1 className="text-3xl font-black tracking-tight m-0">{t("help.title")}</h1>
          <p className="text-sm text-slate-500 max-w-xl mx-auto">
            {t("help.subtitle")}
          </p>
        </header>

        {/* Sommaire */}
        <nav className="section-card" style={{ padding: "18px 22px" }}>
          <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-3">
            {t("help.toc.title")}
          </h3>
          <ol className="grid sm:grid-cols-2 gap-x-6 gap-y-2 list-none m-0 p-0">
            {toc.map((item, i) => (
              <li key={item.id}>
                <a
                  href={`#${item.id}`}
                  className="flex items-center gap-2 text-sm text-slate-600 hover:text-chanv-terre transition-colors"
                >
                  <span className="text-xs font-bold text-[var(--chanv-beige)] w-4">
                    {i + 1}
                  </span>
                  {item.label}
                </a>
              </li>
            ))}
          </ol>
        </nav>

        {/* 1. Présentation */}
        <Section id="presentation" n={1} title={t("help.sec.presentation")}>
          <p className="text-sm text-slate-600 leading-relaxed">
            <Rich text={t("help.intro")} />
          </p>
          <div className="grid sm:grid-cols-2 gap-3">
            <Card title={`📤 ${t("help.card.import.title")}`}>
              <Rich text={t("help.card.import.body")} />
            </Card>
            <Card title={`📊 ${t("help.card.dash.title")}`}>
              <Rich text={t("help.card.dash.body")} />
            </Card>
            <Card title={`📣 ${t("help.card.mkt.title")}`}>
              <Rich text={t("help.card.mkt.body")} />
            </Card>
            <Card title={`📑 ${t("help.card.sheets.title")}`}>
              <Rich text={t("help.card.sheets.body")} />
            </Card>
          </div>
        </Section>

        {/* 2. Rôles */}
        <Section id="roles" n={2} title={t("help.sec.roles")}>
          <p className="text-sm text-slate-600">
            {t("help.roles.intro")}
          </p>
          <div className="section-card" style={{ padding: "12px 16px" }}>
            <table className="chanv-table">
              <thead>
                <tr>
                  <th>{t("help.roles.thRole")}</th>
                  <th>{t("help.roles.thCan")}</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td className="font-semibold">👁️ {t("help.roles.member")}</td>
                  <td>
                    <Rich text={t("help.roles.memberDesc")} />
                  </td>
                </tr>
                <tr>
                  <td className="font-semibold">🔧 {t("help.roles.gest")}</td>
                  <td>
                    <Rich text={t("help.roles.gestDesc")} />
                  </td>
                </tr>
                <tr>
                  <td className="font-semibold">⭐ {t("help.roles.admin")}</td>
                  <td><Rich text={t("help.roles.adminDesc")} /></td>
                </tr>
                <tr>
                  <td className="font-semibold">👑 {t("help.roles.superadmin")}</td>
                  <td><Rich text={t("help.roles.superadminDesc")} /></td>
                </tr>
              </tbody>
            </table>
          </div>
          <Callout variant="info">
            <Rich text={t("help.roles.callout")} />
          </Callout>
        </Section>

        {/* 3. Import & récupération */}
        <Section id="import" n={3} title={t("help.sec.import")}>
          <p className="text-sm text-slate-600">
            <Rich text={t("help.import.intro")} />
          </p>
          <div className="space-y-3">
            <Card title={t("help.import.s1.title")}>
              <Rich text={t("help.import.s1.body")} />
            </Card>
            <Card title={t("help.import.s2.title")}>
              <ul className="list-disc pl-5 space-y-1">
                <li><Rich text={t("help.import.s2.li1")} /></li>
                <li><Rich text={t("help.import.s2.li2")} /></li>
                <li><Rich text={t("help.import.s2.li3")} /></li>
                <li><Rich text={t("help.import.s2.li4")} /></li>
              </ul>
            </Card>
            <Card title={t("help.import.s3.title")}>
              <Rich text={t("help.import.s3.body")} />
              <div className="flex flex-wrap gap-2 mt-2">
                <span className="rounded-full bg-green-100 text-green-800 px-3 py-1 text-xs font-semibold">
                  {t("help.import.s3.matched")}
                </span>
                <span className="rounded-full bg-amber-100 text-amber-800 px-3 py-1 text-xs font-semibold">
                  {t("help.import.s3.unmatched")}
                </span>
                <span className="rounded-full bg-red-100 text-red-800 px-3 py-1 text-xs font-semibold">
                  {t("help.import.s3.invalid")}
                </span>
              </div>
            </Card>
            <Card title={t("help.import.s4.title")}>
              <Rich text={t("help.import.s4.body")} />
            </Card>
          </div>
          <Callout variant="info">
            <Rich text={t("help.import.callout1")} />
          </Callout>
          <Callout variant="tip">
            <Rich text={t("help.import.callout2")} />
          </Callout>
        </Section>

        {/* 4. Méthodes de calcul */}
        <Section id="calculs" n={4} title={t("help.sec.calc")}>
          <p className="text-sm text-slate-600">
            <Rich text={t("help.calc.intro")} />
          </p>

          <Callout variant="info">
            <Rich text={t("help.calc.callout1")} />
          </Callout>

          <h3 className="text-sm font-bold uppercase tracking-wider text-slate-500 mt-2">
            {t("help.calc.perProduct")}
          </h3>
          <div className="grid sm:grid-cols-2 gap-3">
            <Formula label={t("help.f.units.label")} formula="Σ units_sold" note={t("help.f.units.note")} />
            <Formula label={t("help.f.buyers.label")} formula="count(distinct store_id)" note={t("help.f.buyers.note")} />
            <Formula label={t("help.f.firstLast.label")} formula="min · max (last_order_date)" note={t("help.f.firstLast.note")} />
            <Formula label={t("help.f.catBrand.label")} formula={t("help.f.catBrand.formula")} />
          </div>

          <h3 className="text-sm font-bold uppercase tracking-wider text-slate-500 mt-2">
            {t("help.calc.perStore")}
          </h3>
          <div className="grid sm:grid-cols-2 gap-3">
            <Formula label={t("help.f.totalUnits.label")} formula="Σ units_sold" note={t("help.f.totalUnits.note")} />
            <Formula label={t("help.f.skus.label")} formula="count(distinct sku)" note={t("help.f.skus.note")} />
            <Formula label={t("help.f.firstLast.label")} formula="min · max (last_order_date)" />
          </div>

          <h3 className="text-sm font-bold uppercase tracking-wider text-slate-500 mt-2">
            {t("help.calc.timeseries")}
          </h3>
          <div className="grid sm:grid-cols-2 gap-3">
            <Formula label={t("help.f.byMonth.label")} formula="group by last_order_date[YYYY-MM]" note={t("help.f.byMonth.note")} />
            <Formula label={t("help.f.byWeekday.label")} formula="group by weekday(last_order_date)" note={t("help.f.byWeekday.note")} />
            <Formula label={t("help.f.byRegion.label")} formula="Σ units_sold group by region" />
            <Formula label={t("help.f.byCategory.label")} formula="Σ units_sold group by sub_category" note={t("help.f.byCategory.note")} />
          </div>
          <Callout variant="info">
            <Rich text={t("help.calc.callout2")} />
          </Callout>

          <h3 className="text-sm font-bold uppercase tracking-wider text-slate-500 mt-2">
            {t("help.calc.profile")}
          </h3>
          <div className="grid sm:grid-cols-2 gap-3">
            <Formula label={t("help.f.join.label")} formula={t("help.f.join.formula")} note={t("help.f.join.note")} />
            <Formula label={t("help.f.thc.label")} formula={t("help.f.thc.formula")} note={t("help.f.thc.note")} />
            <Formula label={t("help.f.corr.label")} formula={t("help.f.corr.formula")} note={t("help.f.corr.note")} />
          </div>
        </Section>

        {/* 5. Marketing & impact */}
        <Section id="marketing" n={5} title={t("help.sec.marketing")}>
          <p className="text-sm text-slate-600">
            <Rich text={t("help.mkt.intro")} />
          </p>
          <Card title={t("help.mkt.window.title")}>
            <ul className="list-disc pl-5 space-y-1">
              <li><Rich text={t("help.mkt.window.li1")} /></li>
              <li><Rich text={t("help.mkt.window.li2")} /></li>
            </ul>
          </Card>
          <div className="grid sm:grid-cols-2 gap-3">
            <Formula label={t("help.f.liftU.label")} formula="unités_après − unités_avant" />
            <Formula label={t("help.f.liftP.label")} formula="(lift / unités_avant) × 100" note={t("help.f.liftP.note")} />
            <Formula label={t("help.f.reacted.label")} formula="unités_après > 0" />
            <Formula label={t("help.f.reactTime.label")} formula={t("help.f.reactTime.formula")} />
          </div>
          <Callout variant="info">
            <Rich text={t("help.mkt.callout")} />
          </Callout>
        </Section>

        {/* 6. Google Sheets */}
        <Section id="sheets" n={6} title={t("help.sec.sheets")}>
          <p className="text-sm text-slate-600">
            <Rich text={t("help.sheets.intro")} />
          </p>
          <div className="grid sm:grid-cols-2 gap-3">
            <Card title={`✏️ ${t("help.sheets.edit.title")}`}>
              <Rich text={t("help.sheets.edit.body")} />
            </Card>
            <Card title={`🗂️ ${t("help.sheets.archive.title")}`}>
              <Rich text={t("help.sheets.archive.body")} />
            </Card>
          </div>
          <Callout variant="warn">
            <Rich text={t("help.sheets.callout")} />
          </Callout>
        </Section>

        {/* 7. FAQ */}
        <Section id="faq" n={7} title={t("help.sec.faq")}>
          <FaqAccordion />
        </Section>

        <footer className="text-center text-xs text-slate-400 pt-4 border-t border-black/5">
          {t("help.footer")}
        </footer>
      </div>
    </div>
  );
}
