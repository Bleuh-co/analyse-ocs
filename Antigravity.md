# Plan Architectural — 🚀 Analyse OCS

## 1. Résumé

**Analyse OCS** est une application interne permettant de croiser des données provenant de documents uploadés (CSV, Excel, PDF) avec des données récupérées via des API externes, afin de produire des analyses multi-zones et multi-périodes. Les utilisateurs configurent des analyses (zones, plages de dates, métriques), visualisent les résultats sous forme de courbes et tableaux, obtiennent des insights générés par IA, et exportent des rapports (PDF/Excel). Elle s'adresse aux analystes du Groupe Chanv qui doivent consolider des sources hétérogènes.

---

## 2. Pages (détaillé)

### `/analyses` — Liste des analyses
- **Rôle** : point d'entrée, vue d'ensemble de toutes les analyses.
- **Composants** : `AnalysisCard`, `AnalysisFilters`, `EmptyState`.
- **Interactions** :
  - Filtre par statut (draft/running/completed/failed) et recherche texte.
  - Clic sur une card → navigation vers `/analyses/[id]`.
  - Bouton "Nouvelle analyse" → `/analyses/new`.
- **États** :
  - *loading* : skeletons de cards.
  - *erreur* : bandeau `.badge-warning` + bouton réessayer.
  - *vide* : `EmptyState` avec CTA création.

### `/analyses/new` — Assistant de création
- **Rôle** : configuration pas-à-pas d'une analyse.
- **Composants** : `AnalysisWizard`, `ZoneSelector`, `DateRangePicker`, `SourcePicker`, `MetricSelector`.
- **Interactions** :
  - Étape 1 : titre/description.
  - Étape 2 : sélection des zones (multi-select hiérarchique).
  - Étape 3 : plage de dates + métriques + agrégation.
  - Étape 4 : sélection des sources (documents + API).
  - Bouton "Créer et exécuter" → POST `/api/analyses` puis POST `/run` → redirect `/analyses/[id]`.
- **États** : validation par étape, bouton "suivant" désactivé si étape invalide.

### `/analyses/[id]` — Détail d'une analyse
- **Rôle** : affichage des résultats.
- **Composants** : `AnalysisHeader`, `ChartViewer`, `ResultTable`, `InsightsPanel`, `ReportExportButton`.
- **Interactions** :
  - Toggle type de graphique (line/bar/area).
  - Bouton "Relancer" → POST `/run`.
  - Bouton "Générer rapport" → POST `/report` (modal choix format).
  - Bouton "Générer insights" → POST `/api/insights`.
- **États** :
  - *running* : spinner + message "Analyse en cours…", polling.
  - *failed* : message d'erreur `.badge-warning`.
  - *completed* : graphiques + tableau + insights.

### `/documents` — Gestion documents
- **Composants** : `DocumentUploader`, `DocumentList`, `DocumentRow`.
- **Interactions** : drag & drop / file input, parse manuel, suppression.
- **États** : badge de statut par document (`.badge-neutral`/`.badge-accent`/`.badge-warning`).

### `/sources` — Sources API
- **Composants** : `SourceForm`, `SourceList`, `SourceTestButton`.
- **Interactions** : créer/éditer une source, tester un fetch.

### `/zones` — Gestion zones
- **Composants** : `ZoneTree`, `ZoneForm`.
- **Interactions** : créer zone, définir parent, éditer code/metadata.

---

## 3. Composants métier

### `AnalysisCard.tsx`
```typescript
interface AnalysisCardProps {
  analysis: Analysis;
  onClick: (id: string) => void;
}
```
- Affiche titre, statut (badge coloré selon status), nb de zones, plage de dates.
- Classes : `.card`, `.badge-*`.

### `AnalysisWizard.tsx`
```typescript
interface AnalysisWizardProps {
  zones: Zone[];
  documents: UploadedDocument[];
  apiSources: ApiSource[];
  onSubmit: (config: AnalysisConfig & { title: string; description?: string; chartType: ChartType }) => Promise<void>;
}
```
- Gère état multi-étapes via `useState`, validation par étape.
- Classes : `.section-card`, `.input`, `.label`, `.btn-primary`, `.btn-secondary`.

### `ChartViewer.tsx`
```typescript
interface ChartViewerProps {
  series: ChartSeries[];
  chartType: ChartType;
  onChartTypeChange: (type: ChartType) => void;
}
```
- Wrap Recharts (`LineChart`/`BarChart`/`AreaChart`), une série par zone/métrique.
- Légende cliquable, tooltip.
- Classes : `.card`, boutons `.btn-ghost` pour toggle.

### `ResultTable.tsx`
```typescript
interface ResultTableProps {
  rows: Record<string, unknown>[];
  columns: string[];
}
```
- Tableau scrollable, tri par colonne, pagination simple.

### `InsightsPanel.tsx`
```typescript
interface InsightsPanelProps {
  summary?: AnalysisSummary;
  onGenerate: () => Promise<void>;
  loading: boolean;
}
```
- Affiche insights texte (liste), bouton génération si absent.
- Classes : `.section-card`.

### `ZoneSelector.tsx`
```typescript
interface ZoneSelectorProps {
  zones: Zone[];
  selected: string[];
  onChange: (ids: string[]) => void;
}
```
- Arbre hiérarchique avec checkboxes (cascade parent→enfants).

### `DateRangePicker.tsx`
```typescript
interface DateRangePickerProps {
  value: DateRange;
  onChange: (range: DateRange) => void;
}
```
- Deux inputs `type="date"`, validation start < end.

### `DocumentUploader.tsx`
```typescript
interface DocumentUploaderProps {
  onUploaded: (doc: UploadedDocument) => void;
}
```
- Drag & drop + input file, POST multipart `/api/documents`.
- Classes : `.section-card`, `.btn-primary`.

### `SourceForm.tsx`
```typescript
interface SourceFormProps {
  initial?: Partial<ApiSource>;
  onSave: (source: Omit<ApiSource, 'id'>) => Promise<void>;
}
```
- Formulaire endpoint/method/headers/params.

### `ReportExportButton.tsx`
```typescript
interface ReportExportButtonProps {
  analysisId: string;
}
```
- Modal choix format → POST `/report` → téléchargement.

---

## 4. Routes API (détaillé)

### `GET /api/analyses`
- **Query** : `?status=&search=`
- **Output** : `Analysis[]`
- **Firestore** : `collection('analyses')` filtré par `createdBy` (user courant), tri `updatedAt desc`.

### `POST /api/analyses`
- **Body** : `{ title, description?, config: AnalysisConfig, chartType }`
- **Validations** : title requis, config.zoneIds non vide, dateRange valide.
- **Output** : `Analysis` (status `draft`).
- **Firestore** : `add` dans `analyses`.

### `GET /api/analyses/[id]`
- **Output** : `Analysis`
- **Erreurs** : 404 si absent, 403 si autre user.

### `PUT /api/analyses/[id]`
- **Body** : `Partial<Analysis>` → met à jour `updatedAt`.

### `DELETE /api/analyses/[id]`
- Supprime le doc + rapports liés.

### `POST /api/analyses/[id]/run`
- **Logique** :
  1. Charger `config`.
  2. Récupérer DataPoints : documents parsés (`dataPoints` filtrés par documentId) + fetch API sources.
  3. Filtrer par `zoneIds`, `dateRange`, `metrics`.
  4. Agréger selon `aggregation` → construire `ChartSeries[]` et `tableRows`.
  5. Calculer `summary` (sans insights LLM à ce stade).
  6. Sauvegarder `result`, status `completed`.
- **Output** : `Analysis` mis à jour.
- **Erreurs** : status `failed` + `errorMessage` si parsing/fetch échoue.

### `POST /api/analyses/[id]/report`
- **Body** : `{ format: ExportFormat }`
- **Logique** : générer PDF (`@react-pdf/renderer`) ou xlsx (`xlsx`), stocker dans Cloud Storage, créer `GeneratedReport`.
- **Output** : `{ downloadUrl: string }`.

### `GET /api/documents` / `POST /api/documents`
- POST : multipart, upload vers Storage, créer `UploadedDocument` status `uploaded`.

### `POST /api/documents/[id]/parse`
- Détecte format, parse (`papaparse`/`xlsx`/`pdf-parse`), extrait colonnes + rows, mappe vers `DataPoint[]` stockés dans sous-collection `documents/{id}/dataPoints`. Status → `parsed`.

### `DELETE /api/documents/[id]`
- Supprime fichier Storage + doc Firestore.

### `GET /api/sources` / `POST /api/sources`
### `POST /api/sources/[id]/fetch`
- Exécute la requête vers `endpoint` avec `paramsTemplate`, normalise la réponse en `DataPoint[]`, met à jour `lastFetchedAt`.

### `GET /api/zones` / `POST /api/zones`
- CRUD simple sur `zones`.

### `POST /api/insights`
- **Body** : `{ analysisId }`
- **Logique** : récupérer `result`, construire prompt résumant series + summary, appeler **gemini-3.5-flash** (rapide, économique pour résumés), retourner `insights: string[]`, persister dans `summary.insights`.
- **Output** : `{ insights: string[] }`.

---

## 5. Structure de données

### Collections Firestore

**`zones`**
```
{ id, name, code, parentZoneId?, metadata? }
```

**`documents`**
```
{ id, fileName, format, status, storagePath, sizeBytes, uploadedBy, uploadedAt, parsedAt?, rowCount?, columns?, errorMessage? }
```
- Sous-collection `documents/{id}/dataPoints` : `DataPoint[]`.

**`apiSources`**
```
{ id, name, endpoint, method, headers?, paramsTemplate?, active, lastFetchedAt? }
```

**`analyses`**
```
{ id, title, description?, status, config, result?, chartType, createdBy, createdAt, updatedAt, errorMessage? }
```

**`reports`**
```
{ id, analysisId, format, storagePath, generatedAt, generatedBy }
```

### Relations
- `Analysis.config.zoneIds` → `zones`
- `Analysis.config.documentIds` → `documents`
- `Analysis.config.apiSourceIds` → `apiSources`
- `GeneratedReport.analysisId` → `analyses`
- `Zone.parentZoneId` → hiérarchie auto-référente

### Indexes
- `analyses` : composite `(createdBy ASC, updatedAt DESC)`
- `analyses` : composite `(createdBy ASC, status ASC)`
- `documents/{id}/dataPoints` : `(zoneId ASC, timestamp ASC)`
- `reports` : `(analysisId ASC, generatedAt DESC)`

---

## 6. Dépendances npm

| Package | Raison |
|---------|--------|
| `recharts` | Rendu des courbes/barres/aires de manière déclarative et React-friendly. |
| `papaparse` | Parsing robuste de CSV côté serveur. |
| `xlsx` | Lecture des fichiers Excel + export Excel des rapports. |
| `pdf-parse` | Extraction de texte/tableaux depuis PDF uploadés. |
| `@react-pdf/renderer` | Génération de rapports PDF stylés côté serveur. |

> Le SDK Firebase Admin et l'appel LLM (via le gateway interne) sont déjà disponibles dans le framework.

---

## 7. Notes techniques

- **Exécution longue (`/run`)** : le croisement de données peut dépasser le timeout HTTP. Pour un MVP, exécuter en synchrone avec limite de volume ; à terme, déclencher un traitement asynchrone (status `running`) avec polling côté client toutes les 3s sur `GET /api/analyses/[id]`.
- **Normalisation des données** : documents et API renvoient des structures hétérogènes. Centraliser la conversion dans `src/lib/normalize.ts` qui produit toujours des `DataPoint`. Prévoir un mapping configurable (colonne → metric/zone/timestamp).
- **Volumétrie Firestore** : les `dataPoints` peuvent être nombreux. Paginer les lectures et plafonner le nombre de points affichés dans les graphiques (downsampling : 1 point par période agrégée).
- **Sécurité des sources API** : ne jamais exposer les `headers` (clés/secrets) au client — masquer dans `GET /api/sources`. Stocker les secrets côté serveur uniquement.
- **Insights LLM** : utiliser `gemini-3.5-flash` (résumés rapides/peu coûteux). Limiter le prompt à un résumé statistique des séries (pas les données brutes) pour rester dans la fenêtre de contexte et éviter les coûts.
- **Storage des fichiers** : utiliser un bucket Cloud Storage ; stocker uniquement `storagePath` dans Firestore et générer des URLs signées temporaires pour téléchargement.
- **Accessibilité** : tableaux avec `<th scope>`, graphiques accompagnés du `ResultTable` comme alternative textuelle, focus visible sur les contrôles du wizard.
- **Edge cases** : zones sans données (afficher série vide explicite), plage de dates sans recouvrement entre sources, document en `error` exclu de l'analyse avec avertissement, source API indisponible → marquer l'analyse `failed` avec message clair.
- **Performance graphiques** : mémoïser les séries transformées (`useMemo`) et limiter le re-render lors du toggle de `chartType`.

Note utilisateur supplementaire: Attention que le logo Chanv en haut a gauche emmene bien sur le bon Apps Hub en fonction de l'environnement (prod ou dev)