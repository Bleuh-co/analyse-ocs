"use client";

import { useState } from "react";

/* ────────────────────────────────────────────────
 * Page Aide / FAQ — Analyse OCS
 * Explique : à quoi sert l'app, comment l'utiliser,
 * comment les données sont récupérées (import + matching)
 * et comment chaque chiffre est calculé.
 * ──────────────────────────────────────────────── */

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
const FAQ_ITEMS: { q: string; a: React.ReactNode }[] = [
  {
    q: "Mon magasin n'apparaît pas après un import — pourquoi ?",
    a: (
      <>
        Le magasin n'a pas pu être <strong>matché</strong>. Le matching se fait sur le{" "}
        <strong>code postal normalisé</strong> ; si le code postal du fichier OCS est absent,
        mal formaté ou introuvable parmi les stores existants, la ligne est marquée{" "}
        <code>unmatched</code> et n'est pas écrite. Vérifiez l'aperçu avant confirmation :
        les lignes non matchées y sont listées.
      </>
    ),
  },
  {
    q: "Les unités du dashboard ne correspondent pas au fichier brut ?",
    a: (
      <>
        C'est attendu, pour trois raisons : (1) le dashboard{" "}
        <strong>ignore les stores marqués archivés</strong> et les stores inconnus ; (2) seules
        les lignes <em>matchées</em> et confirmées sont écrites en base ; (3) l'historique
        antérieur au journal cumulatif (juillet 2026) est partiel — seule la dernière commande
        connue de chaque magasin × produit a pu être préservée.
      </>
    ),
  },
  {
    q: "Que veut dire « le magasin a réagi » dans une action marketing ?",
    a: (
      <>
        Après une action, l'app regarde les 14 jours suivants pour le même magasin (et le SKU
        ciblé s'il est renseigné). Si au moins 1 unité a été commandée sur cette fenêtre,{" "}
        <strong>réagi = oui</strong>, et le <strong>temps de réaction</strong> est le nombre de
        jours jusqu'à la première commande post-action.
      </>
    ),
  },
  {
    q: "Le lift affiche « — » au lieu d'un pourcentage ?",
    a: (
      <>
        Le lift en % n'est calculé que si les ventes <strong>avant</strong> l'action sont
        supérieures à 0 (division impossible sinon). Le lift en unités (après − avant) reste,
        lui, toujours affiché.
      </>
    ),
  },
  {
    q: "Puis-je modifier un magasin ou une donnée sans être admin ?",
    a: (
      <>
        Oui : le rôle <strong>gestionnaire</strong> (grade Hub « Gestionnaire ») peut importer,
        créer / éditer des stores, éditer les Sheets CRM et gérer les actions marketing. Seule
        la <strong>suppression</strong> de stores exige le rôle <strong>administrateur</strong>.
        Le rôle <strong>membre</strong> (grade « Consulter ») est en lecture seule.
      </>
    ),
  },
  {
    q: "Que signifie « store archivé » ?",
    a: (
      <>
        Un store est <strong>archivé</strong> quand un gestionnaire ou un administrateur le
        marque comme tel (champ <code>archived</code>) — il est alors exclu des dashboards et
        de la liste par défaut. Il n'y a pas d'archivage automatique : un store inactif reste
        visible tant qu'il n'est pas archivé manuellement.
      </>
    ),
  },
  {
    q: "Est-ce que mes fichiers xlsx sont stockés quelque part ?",
    a: (
      <>
        Non. Les fichiers sont <strong>parsés à la volée</strong> en mémoire puis jetés. Seules
        les données extraites (stores + produits) sont écrites en base, et un journal léger de
        l'import est conservé dans la collection <code>ontario_uploads</code>.
      </>
    ),
  },
];

function FaqAccordion() {
  const [open, setOpen] = useState<number | null>(0);
  return (
    <div className="space-y-2">
      {FAQ_ITEMS.map((item, i) => {
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
                {item.a}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

/* ── Sommaire ──────────────────────────────────── */
const TOC = [
  { id: "presentation", label: "Présentation" },
  { id: "roles", label: "Rôles & permissions" },
  { id: "import", label: "Import & récupération des données" },
  { id: "calculs", label: "Méthodes de calcul" },
  { id: "marketing", label: "Actions marketing & impact" },
  { id: "sheets", label: "Google Sheets" },
  { id: "faq", label: "Questions fréquentes" },
];

export default function AidePage() {
  return (
    <div className="chanv-surface">
      <div className="mx-auto max-w-4xl px-4 py-8 space-y-10">
        {/* Hero */}
        <header className="text-center space-y-2">
          <div className="text-4xl">📖</div>
          <h1 className="text-3xl font-black tracking-tight m-0">Aide & FAQ</h1>
          <p className="text-sm text-slate-500 max-w-xl mx-auto">
            Comment utiliser Analyse OCS, comment les données sont récupérées depuis vos
            fichiers, et comment chaque chiffre est calculé.
          </p>
        </header>

        {/* Sommaire */}
        <nav className="section-card" style={{ padding: "18px 22px" }}>
          <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-3">
            Sommaire
          </h3>
          <ol className="grid sm:grid-cols-2 gap-x-6 gap-y-2 list-none m-0 p-0">
            {TOC.map((t, i) => (
              <li key={t.id}>
                <a
                  href={`#${t.id}`}
                  className="flex items-center gap-2 text-sm text-slate-600 hover:text-chanv-terre transition-colors"
                >
                  <span className="text-xs font-bold text-[var(--chanv-beige)] w-4">
                    {i + 1}
                  </span>
                  {t.label}
                </a>
              </li>
            ))}
          </ol>
        </nav>

        {/* 1. Présentation */}
        <Section id="presentation" n={1} title="Présentation">
          <p className="text-sm text-slate-600 leading-relaxed">
            <strong>Analyse OCS</strong> centralise les ventes de Bleuh vers les détaillants
            (OCS — Ontario). Vous importez les fichiers de ventes, l'app fait le lien avec vos
            magasins, puis affiche des tableaux de bord, mesure l'impact de vos actions
            marketing et donne accès aux données CRM.
          </p>
          <div className="grid sm:grid-cols-2 gap-3">
            <Card title="📤 Importer">
              Chargez un fichier xlsx OCS. L'app extrait et rapproche automatiquement chaque
              ligne d'un magasin connu.
            </Card>
            <Card title="📊 Dashboard">
              Unités vendues, vélocité, top produits et magasins, évolution par mois, jour,
              région et catégorie.
            </Card>
            <Card title="📣 Marketing">
              Consignez vos actions (PLV, promos…) et mesurez leur effet réel sur les ventes.
            </Card>
            <Card title="📑 Sheets">
              Consultez et éditez les données CRM (Historique, Segmentation, Products Master).
            </Card>
          </div>
        </Section>

        {/* 2. Rôles */}
        <Section id="roles" n={2} title="Rôles & permissions">
          <p className="text-sm text-slate-600">
            Votre rôle détermine ce que vous pouvez faire. Il est géré par le SSO du Hub Chanv.
          </p>
          <div className="section-card" style={{ padding: "12px 16px" }}>
            <table className="chanv-table">
              <thead>
                <tr>
                  <th>Rôle</th>
                  <th>Peut faire</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td className="font-semibold">👁️ Membre</td>
                  <td>
                    Consulter : dashboard, stores, sheets, historique (lecture seule).
                    Correspond au grade Hub « Consulter ».
                  </td>
                </tr>
                <tr>
                  <td className="font-semibold">🔧 Gestionnaire</td>
                  <td>
                    Tout le membre + importer des fichiers, créer / éditer des stores, éditer
                    les Sheets CRM, gérer les actions marketing
                  </td>
                </tr>
                <tr>
                  <td className="font-semibold">⭐ Administrateur</td>
                  <td>Tout le gestionnaire + supprimer des stores</td>
                </tr>
                <tr>
                  <td className="font-semibold">👑 Super Administrateur</td>
                  <td>Accès complet</td>
                </tr>
              </tbody>
            </table>
          </div>
          <Callout variant="info">
            Toutes les routes exigent une session valide ; les écritures (import, édition,
            suppression) vérifient en plus le rôle côté serveur — impossible de contourner
            depuis le navigateur.
          </Callout>
        </Section>

        {/* 3. Import & récupération */}
        <Section id="import" n={3} title="Import & récupération des données">
          <p className="text-sm text-slate-600">
            Depuis <strong>Importer</strong>, déposez un fichier xlsx OCS. Voici ce qui se passe :
          </p>
          <div className="space-y-3">
            <Card title="1. Lecture des colonnes">
              L'app reconnaît les colonnes OCS standard : <code>SKU</code>,{" "}
              <code>Item Name</code>, <code>Category</code>, <code>Brand</code>,{" "}
              <code>Store Name</code>, <code>Store Address</code>, <code>Region</code>,{" "}
              <code>City</code>, <code>Order Date</code>, <code>Units Sold</code>,{" "}
              <code>Item Barcode</code>… (les variantes en snake_case sont aussi acceptées).
            </Card>
            <Card title="2. Nettoyage & normalisation">
              <ul className="list-disc pl-5 space-y-1">
                <li>Les dates Excel (numéro de série) sont converties en dates ISO.</li>
                <li>
                  L'adresse est décomposée en <strong>rue / ville / province / code postal</strong>.
                </li>
                <li>
                  Le code postal est normalisé (<code>K4R 1E1</code> → <code>K4R1E1</code>) pour
                  servir de clé de rapprochement.
                </li>
                <li>
                  Le code-barres GTIN-14 est ramené au GTIN-12 pour l'enrichissement produit.
                </li>
              </ul>
            </Card>
            <Card title="3. Rapprochement (matching) avec vos magasins">
              Chaque ligne est comparée aux stores existants via l'<strong>index de codes
              postaux</strong>. Si plusieurs magasins partagent le même code postal,
              l'adresse (rue) départage — à défaut, le premier candidat est retenu.
              Trois statuts possibles :
              <div className="flex flex-wrap gap-2 mt-2">
                <span className="rounded-full bg-green-100 text-green-800 px-3 py-1 text-xs font-semibold">
                  matched — rattachée à un magasin
                </span>
                <span className="rounded-full bg-amber-100 text-amber-800 px-3 py-1 text-xs font-semibold">
                  unmatched — aucun magasin trouvé
                </span>
                <span className="rounded-full bg-red-100 text-red-800 px-3 py-1 text-xs font-semibold">
                  invalid — ligne inexploitable
                </span>
              </div>
            </Card>
            <Card title="4. Aperçu → Confirmation → Écriture">
              Vous voyez un aperçu (matched / unmatched / invalid) <strong>avant</strong> toute
              écriture. À la confirmation, les données sont écrites en base par lots (max 499
              opérations) et un journal d'import est conservé.
            </Card>
          </div>
          <Callout variant="info">
            ℹ️ <strong>Donnée conservée :</strong> chaque import alimente un{" "}
            <strong>journal cumulatif des ventes</strong> (1 entrée par magasin × produit ×
            date de commande) — réimporter le même fichier ne crée pas de doublon. La fiche
            magasin affiche en plus l'état de la <em>dernière commande connue</em> par produit.
            Les lignes « Total » et « Applied filters » en fin de fichier sont automatiquement
            ignorées.
          </Callout>
          <Callout variant="tip">
            💡 Astuce : si beaucoup de lignes sont <code>unmatched</code>, créez d'abord les
            magasins manquants dans <strong>Stores</strong> (avec leur code postal), puis
            relancez l'import.
          </Callout>
        </Section>

        {/* 4. Méthodes de calcul */}
        <Section id="calculs" n={4} title="Méthodes de calcul">
          <p className="text-sm text-slate-600">
            Le dashboard agrège tous les produits rattachés à des magasins actifs. Les stores{" "}
            <strong>archivés ou inconnus sont exclus</strong>. Les filtres région et plage de
            dates s'appliquent avant agrégation.
          </p>

          <Callout variant="info">
            ℹ️ Les agrégations utilisent le <strong>journal cumulatif des ventes</strong> :
            chaque commande importée compte une fois, à sa date réelle. L'historique antérieur
            au journal (initialisé en juillet 2026) provient de la dernière commande connue par
            magasin × produit — il est donc partiel avant cette date.
          </Callout>

          <h3 className="text-sm font-bold uppercase tracking-wider text-slate-500 mt-2">
            Par produit
          </h3>
          <div className="grid sm:grid-cols-2 gap-3">
            <Formula label="Unités vendues" formula="Σ units_sold" note="Somme, sur tous les magasins, des unités de la dernière commande connue." />
            <Formula label="Magasins acheteurs" formula="count(distinct store_id)" note="Nombre de magasins distincts ayant déjà commandé ce SKU." />
            <Formula label="Première / dernière commande" formula="min · max (last_order_date)" note="Bornes sur les dernières commandes connues par magasin." />
            <Formula label="Catégorie / marque" formula="depuis la ligne OCS ou Products Master" />
          </div>

          <h3 className="text-sm font-bold uppercase tracking-wider text-slate-500 mt-2">
            Par magasin
          </h3>
          <div className="grid sm:grid-cols-2 gap-3">
            <Formula label="Unités totales" formula="Σ units_sold" note="Somme des dernières commandes connues, tous produits du magasin." />
            <Formula label="SKU distincts" formula="count(distinct sku)" note="Diversité de l'assortiment commandé." />
            <Formula label="Première / dernière commande" formula="min · max (last_order_date)" />
          </div>

          <h3 className="text-sm font-bold uppercase tracking-wider text-slate-500 mt-2">
            Séries temporelles & répartitions
          </h3>
          <div className="grid sm:grid-cols-2 gap-3">
            <Formula label="Par mois" formula="group by last_order_date[YYYY-MM]" note="Unités groupées par mois de la dernière commande connue." />
            <Formula label="Par jour de semaine" formula="group by weekday(last_order_date)" note="Dim → Sam, pour repérer les jours de commande." />
            <Formula label="Par région" formula="Σ units_sold group by region" />
            <Formula label="Par catégorie" formula="Σ units_sold group by sub_category" note="Sous-catégorie OCS : Dried Flower, Vapes, Concentrates, Pre-Rolled…" />
          </div>
          <Callout variant="info">
            Toutes les agrégations sont recalculées à chaque chargement à partir d'une seule
            requête <code>collectionGroup</code> sur les produits — les chiffres reflètent
            toujours l'état courant de la base. Les dates héritées de l'ancien système
            (numéros de série Excel) sont automatiquement converties.
          </Callout>

          <h3 className="text-sm font-bold uppercase tracking-wider text-slate-500 mt-2">
            Onglet Profil (THC/CBD)
          </h3>
          <div className="grid sm:grid-cols-2 gap-3">
            <Formula label="Jointure référentiel" formula="GTIN-12, sinon Retailer SKU" note="Chaque produit vendu est relié à DB-Products-Master par son code GTIN." />
            <Formula label="THC / CBD" formula="point médian de la plage" note="« 25-31 » → 28 % ; « N/A » → non renseigné." />
            <Formula label="Corrélation" formula="Pearson (THC × unités)" note="Indicative : ne prouve pas de causalité." />
          </div>
        </Section>

        {/* 5. Marketing & impact */}
        <Section id="marketing" n={5} title="Actions marketing & mesure d'impact">
          <p className="text-sm text-slate-600">
            Enregistrez une action (campagne, PLV, promo…) liée à un magasin et éventuellement à
            un SKU. L'app compare ensuite les ventes <strong>avant</strong> et <strong>après</strong>{" "}
            pour estimer l'effet.
          </p>
          <Card title="Fenêtre d'observation : 14 jours">
            <ul className="list-disc pl-5 space-y-1">
              <li>
                <strong>Avant</strong> = ventes du magasin (SKU ciblé si renseigné) sur les 14
                jours <em>précédant</em> la date d'action.
              </li>
              <li>
                <strong>Après</strong> = ventes sur les 14 jours <em>suivant</em> la date d'action.
              </li>
            </ul>
          </Card>
          <div className="grid sm:grid-cols-2 gap-3">
            <Formula label="Lift (unités)" formula="unités_après − unités_avant" />
            <Formula label="Lift (%)" formula="(lift / unités_avant) × 100" note="Affiché seulement si unités_avant > 0." />
            <Formula label="A réagi ?" formula="unités_après > 0" />
            <Formula label="Temps de réaction" formula="jours entre l'action et la 1ʳᵉ commande" />
          </div>
          <Callout variant="info">
            ℹ️ Le calcul s'appuie sur le <strong>journal cumulatif des ventes</strong> : chaque
            commande compte à sa date réelle. Pour les actions antérieures au journal
            (juillet 2026), la fenêtre « avant » peut être incomplète — interprétez alors le
            lift comme un signal de réaction plutôt qu'une mesure exacte.
          </Callout>
        </Section>

        {/* 6. Google Sheets */}
        <Section id="sheets" n={6} title="Google Sheets (CRM)">
          <p className="text-sm text-slate-600">
            La page <strong>Sheets</strong> lit trois sources CRM : <em>Historique</em>,{" "}
            <em>Segmentation</em> et <em>DB Products Master</em>. Seule une liste blanche de
            classeurs est accessible (protection contre les accès non prévus).
          </p>
          <div className="grid sm:grid-cols-2 gap-3">
            <Card title="✏️ Édition (gestionnaire et +)">
              Cliquez une cellule pour la modifier. Historique et Segmentation sont éditables ;
              Products Master est en lecture seule.
            </Card>
            <Card title="🗂️ Archivage automatique">
              Avant chaque modification ou suppression, la ligne d'origine est archivée et
              l'action est journalisée (qui, quand, quels champs).
            </Card>
          </div>
          <Callout variant="warn">
            L'accès en lecture/écriture aux Sheets passe par le compte de service{" "}
            <code>antigravity@…iam.gserviceaccount.com</code>. Un nouveau classeur doit être
            partagé avec ce compte pour être lisible.
          </Callout>
        </Section>

        {/* 7. FAQ */}
        <Section id="faq" n={7} title="Questions fréquentes">
          <FaqAccordion />
        </Section>

        <footer className="text-center text-xs text-slate-400 pt-4 border-t border-black/5">
          Une question non couverte ? Contactez l'équipe Données · Groupe Chanv.
        </footer>
      </div>
    </div>
  );
}
