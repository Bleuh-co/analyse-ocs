// Données mock / seed — Analyse OCS
// TODO: utiliser pour le dev local et le seeding initial — voir Antigravity.md

import type {
  Zone,
  UploadedDocument,
  ApiSource,
  Analysis,
  DataPoint,
} from "./types-ocs";

const now = new Date().toISOString();

// 5 zones — hiérarchie Province > Régions
export const SEED_ZONES: Zone[] = [
  { id: "z-qc", name: "Québec", code: "QC", metadata: { level: "province" } },
  { id: "z-mtl", name: "Montréal", code: "QC-MTL", parentZoneId: "z-qc", metadata: { level: "region" } },
  { id: "z-qbc", name: "Capitale-Nationale", code: "QC-QBC", parentZoneId: "z-qc", metadata: { level: "region" } },
  { id: "z-est", name: "Estrie", code: "QC-EST", parentZoneId: "z-qc", metadata: { level: "region" } },
  { id: "z-mau", name: "Mauricie", code: "QC-MAU", parentZoneId: "z-qc", metadata: { level: "region" } },
];

// 3 documents fictifs (CSV parsés)
export const SEED_DOCUMENTS: UploadedDocument[] = [
  {
    id: "doc-1",
    fileName: "ventes-2024.csv",
    format: "csv",
    status: "parsed",
    storagePath: "documents/doc-1.csv",
    sizeBytes: 48211,
    uploadedBy: "seed",
    uploadedAt: now,
    parsedAt: now,
    rowCount: 1280,
    columns: ["date", "zone", "metric", "value"],
  },
  {
    id: "doc-2",
    fileName: "population-regions.csv",
    format: "csv",
    status: "parsed",
    storagePath: "documents/doc-2.csv",
    sizeBytes: 12044,
    uploadedBy: "seed",
    uploadedAt: now,
    parsedAt: now,
    rowCount: 60,
    columns: ["zone", "annee", "population"],
  },
  {
    id: "doc-3",
    fileName: "rapport-annuel.pdf",
    format: "pdf",
    status: "uploaded",
    storagePath: "documents/doc-3.pdf",
    sizeBytes: 982341,
    uploadedBy: "seed",
    uploadedAt: now,
  },
];

// 2 sources API configurées
export const SEED_SOURCES: ApiSource[] = [
  {
    id: "src-1",
    name: "Statistiques Québec",
    endpoint: "https://api.example.gouv.qc.ca/v1/stats",
    method: "GET",
    paramsTemplate: { zone: "{{zoneCode}}", from: "{{start}}", to: "{{end}}" },
    active: true,
    lastFetchedAt: now,
  },
  {
    id: "src-2",
    name: "Météo régionale",
    endpoint: "https://api.example.com/weather",
    method: "GET",
    headers: { "x-api-key": "<masked>" },
    active: false,
  },
];

// 2 analyses (1 completed avec result complet, 1 draft)
export const SEED_ANALYSES: Analysis[] = [
  {
    id: "an-1",
    title: "Ventes mensuelles par région 2024",
    description: "Croisement ventes CSV + population API.",
    status: "completed",
    chartType: "line",
    createdBy: "seed",
    createdAt: now,
    updatedAt: now,
    config: {
      zoneIds: ["z-mtl", "z-qbc", "z-est"],
      dateRange: { start: "2024-01-01T00:00:00Z", end: "2024-12-31T23:59:59Z" },
      metrics: ["ventes"],
      aggregation: "sum",
      documentIds: ["doc-1", "doc-2"],
      apiSourceIds: ["src-1"],
    },
    result: {
      series: [
        {
          label: "Montréal — ventes",
          zoneId: "z-mtl",
          metric: "ventes",
          data: Array.from({ length: 12 }, (_, i) => ({
            x: `2024-${String(i + 1).padStart(2, "0")}`,
            y: Math.round(1000 + Math.random() * 500),
          })),
        },
        {
          label: "Capitale-Nationale — ventes",
          zoneId: "z-qbc",
          metric: "ventes",
          data: Array.from({ length: 12 }, (_, i) => ({
            x: `2024-${String(i + 1).padStart(2, "0")}`,
            y: Math.round(700 + Math.random() * 400),
          })),
        },
      ],
      tableRows: [
        { zone: "Montréal", total: 14820, moyenne: 1235 },
        { zone: "Capitale-Nationale", total: 9450, moyenne: 787 },
      ],
      summary: {
        totalDataPoints: 36,
        zonesCovered: 3,
        insights: [
          "Montréal représente ~55% du volume total des ventes.",
          "Pic de ventes observé en décembre sur toutes les régions.",
        ],
        generatedAt: now,
      },
    },
  },
  {
    id: "an-2",
    title: "Analyse Estrie (brouillon)",
    status: "draft",
    chartType: "bar",
    createdBy: "seed",
    createdAt: now,
    updatedAt: now,
    config: {
      zoneIds: ["z-est"],
      dateRange: { start: "2024-06-01T00:00:00Z", end: "2024-12-31T23:59:59Z" },
      metrics: ["ventes", "population"],
      aggregation: "avg",
      documentIds: ["doc-1"],
      apiSourceIds: [],
    },
  },
];

// DataPoints générés : 5 zones × 12 mois × 3 métriques
const METRICS = ["ventes", "population", "trafic"];
export const SEED_DATAPOINTS: DataPoint[] = SEED_ZONES.flatMap((zone) =>
  Array.from({ length: 12 }, (_, m) =>
    METRICS.map<DataPoint>((metric) => ({
      zoneId: zone.id,
      timestamp: `2024-${String(m + 1).padStart(2, "0")}-01T00:00:00Z`,
      metric,
      value: Math.round(100 + Math.random() * 1000),
      source: "document",
      sourceId: "doc-1",
    }))
  ).flat()
);
