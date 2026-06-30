// Types métier — Analyse OCS
// Analyse de documents + données API croisées par zones et durées.

export type DataSourceType = 'document' | 'api';
export type DocumentStatus = 'uploaded' | 'parsing' | 'parsed' | 'error';
export type AnalysisStatus = 'draft' | 'running' | 'completed' | 'failed';
export type FileFormat = 'pdf' | 'csv' | 'xlsx' | 'json' | 'txt';
export type ChartType = 'line' | 'bar' | 'area' | 'pie' | 'scatter';
export type AggregationType = 'sum' | 'avg' | 'min' | 'max' | 'count';
export type ExportFormat = 'pdf' | 'xlsx' | 'csv';

export interface Zone {
  id: string;
  name: string;
  code: string;            // identifiant géographique/logique (ex: "QC-MTL")
  parentZoneId?: string;   // hiérarchie de zones
  metadata?: Record<string, unknown>;
}

export interface DateRange {
  start: string;           // ISO 8601
  end: string;             // ISO 8601
}

export interface UploadedDocument {
  id: string;
  fileName: string;
  format: FileFormat;
  status: DocumentStatus;
  storagePath: string;
  sizeBytes: number;
  uploadedBy: string;
  uploadedAt: string;
  parsedAt?: string;
  rowCount?: number;
  columns?: string[];
  errorMessage?: string;
}

export interface ApiSource {
  id: string;
  name: string;
  endpoint: string;
  method: 'GET' | 'POST';
  headers?: Record<string, string>;
  paramsTemplate?: Record<string, string>;
  active: boolean;
  lastFetchedAt?: string;
}

export interface DataPoint {
  zoneId: string;
  timestamp: string;       // ISO 8601
  metric: string;
  value: number;
  source: DataSourceType;
  sourceId: string;        // documentId ou apiSourceId
}

export interface AnalysisConfig {
  zoneIds: string[];
  dateRange: DateRange;
  metrics: string[];
  aggregation: AggregationType;
  documentIds: string[];
  apiSourceIds: string[];
}

export interface ChartSeries {
  label: string;
  zoneId: string;
  metric: string;
  data: { x: string; y: number }[];
}

export interface AnalysisResult {
  series: ChartSeries[];
  tableRows: Record<string, unknown>[];
  summary: AnalysisSummary;
}

export interface AnalysisSummary {
  totalDataPoints: number;
  zonesCovered: number;
  insights: string[];      // texte généré par LLM
  generatedAt: string;
}

export interface Analysis {
  id: string;
  title: string;
  description?: string;
  status: AnalysisStatus;
  config: AnalysisConfig;
  result?: AnalysisResult;
  chartType: ChartType;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
  errorMessage?: string;
}

export interface GeneratedReport {
  id: string;
  analysisId: string;
  format: ExportFormat;
  storagePath: string;
  generatedAt: string;
  generatedBy: string;
}
