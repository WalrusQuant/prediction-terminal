const API_BASE = 'http://localhost:8000/api';

// Helper to handle fetch with better error handling
async function fetchWithErrorHandling(url: string, options?: RequestInit) {
  try {
    const response = await fetch(url, options);
    if (!response.ok) {
      const errorText = await response.text();
      console.error(`[API] ${options?.method || 'GET'} ${url} failed:`, response.status, errorText);
      throw new Error(`API error ${response.status}: ${errorText}`);
    }
    return response;
  } catch (error) {
    if (error instanceof TypeError && error.message.includes('fetch')) {
      console.error(`[API] Network error - is the backend running? ${url}`);
      throw new Error('Cannot connect to backend. Is the server running?');
    }
    throw error;
  }
}

// Data Quality Types
export interface ColumnAnalysis {
  name: string;
  dtype: string;
  type: 'numeric' | 'categorical';
  missing_count: number;
  missing_percent: number;
  unique_count: number;
  is_constant: boolean;
  outlier_count: number;
  outlier_indices: number[];
}

export interface DataQualityAnalysis {
  total_rows: number;
  total_columns: number;
  columns: ColumnAnalysis[];
  issues: {
    duplicate_rows: { count: number; row_indices: number[] };
    columns_with_missing: string[];
    constant_columns: string[];
    columns_with_outliers: string[];
  };
  summary: {
    total_missing_cells: number;
    missing_cell_percent: number;
    has_issues: boolean;
  };
}

export interface PaginatedRows {
  rows: Record<string, unknown>[];
  columns: string[];
  total_rows: number;
  total_pages: number;
  start_index: number;
  end_index: number;
  row_issues: Record<string, string[]>;
}

export interface CleanOperation {
  type: 'fill_missing' | 'delete_column' | 'delete_rows' | 'remove_duplicates' | 'remove_outliers';
  column?: string;
  strategy?: 'median' | 'mean' | 'mode';
  indices?: number[];
}

// Dataset endpoints
export async function fetchDatasets() {
  const response = await fetchWithErrorHandling(`${API_BASE}/data/`);
  return response.json();
}

export async function fetchDatasetDetails(datasetId: string) {
  const response = await fetch(`${API_BASE}/data/${datasetId}`);
  return response.json();
}

export async function fetchDatasetStats(datasetId: string) {
  const response = await fetch(`${API_BASE}/data/${datasetId}/stats`);
  return response.json();
}

export async function uploadDataset(file: File) {
  const formData = new FormData();
  formData.append('file', file);

  const response = await fetch(`${API_BASE}/data/upload`, {
    method: 'POST',
    body: formData,
  });
  return response.json();
}

export async function deleteDataset(datasetId: string) {
  const response = await fetch(`${API_BASE}/data/${datasetId}`, {
    method: 'DELETE',
  });
  return response.json();
}

export async function fetchDataQuality(datasetId: string, iqrMultiplier: number = 1.5): Promise<DataQualityAnalysis> {
  const response = await fetch(`${API_BASE}/data/${datasetId}/quality?iqr_multiplier=${iqrMultiplier}`);
  return response.json();
}

export async function fetchDatasetRows(
  datasetId: string,
  page: number = 1,
  pageSize: number = 50,
  iqrMultiplier: number = 1.5
): Promise<PaginatedRows> {
  const response = await fetch(
    `${API_BASE}/data/${datasetId}/rows?page=${page}&page_size=${pageSize}&iqr_multiplier=${iqrMultiplier}`
  );
  return response.json();
}

export async function cleanDataset(
  datasetId: string,
  operations: CleanOperation[]
): Promise<{ message: string; summary: Record<string, unknown> }> {
  const response = await fetch(`${API_BASE}/data/${datasetId}/clean`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ operations }),
  });
  return response.json();
}

export async function fetchDateColumns(datasetId: string): Promise<{ date_columns: string[] }> {
  const response = await fetch(`${API_BASE}/data/${datasetId}/date-columns`);
  return response.json();
}

export interface CorrelationPair {
  feature1: string;
  feature2: string;
  correlation: number;
  strength: 'moderate' | 'strong';
}

export interface CorrelationsResponse {
  correlations: CorrelationPair[];
  threshold: number;
  total_numeric_features: number;
}

export async function fetchFeatureCorrelations(
  datasetId: string,
  threshold: number = 0.7
): Promise<CorrelationsResponse> {
  const response = await fetch(`${API_BASE}/data/${datasetId}/correlations?threshold=${threshold}`);
  return response.json();
}

// Model endpoints
export async function fetchModels() {
  const response = await fetch(`${API_BASE}/models/`);
  return response.json();
}

export async function fetchModel(modelId: string) {
  const response = await fetch(`${API_BASE}/models/${modelId}`);
  return response.json();
}

export async function fetchModelDetail(modelId: string) {
  const response = await fetch(`${API_BASE}/models/${modelId}/detail`);
  return response.json();
}

export async function trainModel(config: {
  name: string;
  model_type: string;
  dataset_id: string;
  features: string[];
  target: string;
  description?: string;
  split_type?: 'random' | 'time_based' | 'walk_forward';
  date_column?: string;
  n_cv_splits?: number;
}) {
  const response = await fetch(`${API_BASE}/models/`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(config),
  });
  return response.json();
}

export async function deleteModel(modelId: string) {
  const response = await fetch(`${API_BASE}/models/${modelId}`, {
    method: 'DELETE',
  });
  return response.json();
}

export async function toggleModelFavorite(modelId: string): Promise<{ model_id: string; is_favorite: boolean }> {
  const response = await fetch(`${API_BASE}/models/${modelId}/favorite`, {
    method: 'PATCH',
  });
  return response.json();
}

export async function renameModel(modelId: string, name: string): Promise<{ model_id: string; name: string }> {
  const response = await fetch(`${API_BASE}/models/${modelId}/rename`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name }),
  });
  return response.json();
}

// Prediction endpoints
export async function fetchPredictions() {
  const response = await fetch(`${API_BASE}/predictions/`);
  return response.json();
}

export async function createSinglePrediction(
  modelId: string,
  inputData: Record<string, number>,
  label?: string,
  withConfidence?: boolean,
  confidenceLevel?: number
) {
  const response = await fetch(`${API_BASE}/predictions/single`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model_id: modelId,
      input_data: inputData,
      label,
      with_confidence: withConfidence || false,
      confidence_level: confidenceLevel || 0.95,
    }),
  });
  return response.json();
}

export async function createBatchPredictions(
  modelId: string,
  data: Record<string, unknown>[],
  labels?: string[]
) {
  const response = await fetch(`${API_BASE}/predictions/batch`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model_id: modelId,
      data,
      labels,
    }),
  });
  return response.json();
}

export async function clearPredictions() {
  const response = await fetch(`${API_BASE}/predictions/`, {
    method: 'DELETE',
  });
  return response.json();
}

export async function deletePrediction(predictionId: string) {
  const response = await fetch(`${API_BASE}/predictions/${predictionId}`, {
    method: 'DELETE',
  });
  return response.json();
}

// Dataset Visualization
export interface HistogramBin {
  range: string;
  count: number;
  min: number;
  max: number;
}

export interface ScatterPair {
  x_column: string;
  y_column: string;
  data: { x: number; y: number }[];
  total_points?: number;
  sampled?: boolean;
}

export interface VisualizationData {
  dataset_id: string;
  numeric_columns: string[];
  histograms: Record<string, HistogramBin[]>;
  scatter_pairs: ScatterPair[];
  sample_size?: number;
}

export interface VisualizationOptions {
  column?: string;
  x_column?: string;
  y_column?: string;
  sample_size?: number;
}

export async function fetchDatasetVisualization(
  datasetId: string,
  options?: VisualizationOptions
): Promise<VisualizationData> {
  const params = new URLSearchParams();
  if (options?.column) params.append('column', options.column);
  if (options?.x_column) params.append('x_column', options.x_column);
  if (options?.y_column) params.append('y_column', options.y_column);
  if (options?.sample_size) params.append('sample_size', options.sample_size.toString());

  const queryString = params.toString();
  const url = queryString
    ? `${API_BASE}/data/${datasetId}/visualization?${queryString}`
    : `${API_BASE}/data/${datasetId}/visualization`;
  const response = await fetch(url);
  return response.json();
}

// Feature Engineering
export interface FeatureEngineerRequest {
  operation_type: 'rolling_average' | 'ratio' | 'difference' | 'percentage_change' | 'lag' | 'product';
  column?: string;
  column1?: string;
  column2?: string;
  numerator?: string;
  denominator?: string;
  window?: number;
  periods?: number;
  new_column_name?: string;
}

export async function engineerFeature(
  datasetId: string,
  request: FeatureEngineerRequest
): Promise<{ message: string; new_column: string; total_columns: number }> {
  const response = await fetch(`${API_BASE}/data/${datasetId}/engineer`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(request),
  });
  return response.json();
}

// Import from URL
export interface ImportUrlResponse {
  message: string;
  dataset_id: string;
  name: string;
  rows: number;
  columns: number;
  features: string[];
  detail?: string;
}

export async function importDatasetFromUrl(
  url: string,
  name?: string
): Promise<ImportUrlResponse> {
  const response = await fetch(`${API_BASE}/data/import-url`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ url, name }),
  });
  return response.json();
}

// Dataset History/Undo endpoints
export interface Snapshot {
  id: string;
  timestamp: string;
  description: string;
  rows: number;
  columns: number;
}

export interface DatasetHistory {
  dataset_id: string;
  snapshots: Snapshot[];
}

export async function fetchDatasetHistory(datasetId: string): Promise<DatasetHistory> {
  const response = await fetch(`${API_BASE}/data/${datasetId}/history`);
  return response.json();
}

export async function restoreDatasetSnapshot(
  datasetId: string,
  snapshotId: string
): Promise<{ message: string; dataset_id: string; snapshot_id: string; rows: number; columns: number }> {
  const response = await fetch(`${API_BASE}/data/${datasetId}/restore/${snapshotId}`, {
    method: 'POST',
  });
  return response.json();
}

// Prediction Templates
export interface PredictionTemplate {
  id: string;
  name: string;
  model_id: string;
  input_values: Record<string, number>;
  description?: string;
  created_at: string;
  updated_at: string;
}

export async function fetchTemplates(modelId?: string): Promise<{ templates: PredictionTemplate[] }> {
  const url = modelId
    ? `${API_BASE}/templates/?model_id=${modelId}`
    : `${API_BASE}/templates/`;
  const response = await fetch(url);
  return response.json();
}

export async function fetchTemplate(templateId: string): Promise<PredictionTemplate> {
  const response = await fetch(`${API_BASE}/templates/${templateId}`);
  return response.json();
}

export async function createTemplate(
  name: string,
  modelId: string,
  inputValues: Record<string, number>,
  description?: string
): Promise<{ message: string; template: PredictionTemplate }> {
  const response = await fetch(`${API_BASE}/templates/`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      name,
      model_id: modelId,
      input_values: inputValues,
      description,
    }),
  });
  return response.json();
}

export async function updateTemplate(
  templateId: string,
  updates: { name?: string; input_values?: Record<string, number>; description?: string }
): Promise<{ message: string; template: PredictionTemplate }> {
  const response = await fetch(`${API_BASE}/templates/${templateId}`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(updates),
  });
  return response.json();
}

export async function deleteTemplate(templateId: string): Promise<{ message: string; template_id: string }> {
  const response = await fetch(`${API_BASE}/templates/${templateId}`, {
    method: 'DELETE',
  });
  return response.json();
}

// Actual Value Tracking
export interface PredictionWithActual {
  id: string;
  model_id: string;
  model_name: string;
  label: string;
  target: string;
  predicted_value: number;
  actual_value: number | null;
  error: number | null;
  absolute_error: number | null;
  percent_error: number | null;
  input_data: Record<string, unknown>;
  timestamp: string;
}

export async function updatePredictionActual(
  predictionId: string,
  actualValue: number
): Promise<{ message: string; prediction: PredictionWithActual }> {
  const response = await fetch(`${API_BASE}/predictions/${predictionId}/actual`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ actual_value: actualValue }),
  });
  return response.json();
}

export interface AccuracyStats {
  total_predictions: number;
  predictions_with_actuals: number;
  mae: number | null;
  mse: number | null;
  rmse: number | null;
  avg_percent_error: number | null;
  by_model: Record<string, {
    model_id: string;
    count: number;
    mae: number;
    rmse: number;
  }>;
}

export async function fetchAccuracyStats(): Promise<AccuracyStats> {
  const response = await fetch(`${API_BASE}/predictions/accuracy`);
  return response.json();
}

// Ensemble functions
export interface CompatibleModel {
  id: string;
  name: string;
  model_type: string;
  target: string;
  features: string[];
  metrics: { r2_score?: number; rmse?: number };
}

export interface CompatibleGroup {
  target: string;
  features: string[];
  models: CompatibleModel[];
}

export async function fetchCompatibleModels(): Promise<{ compatible_groups: CompatibleGroup[] }> {
  const response = await fetch(`${API_BASE}/models/ensemble/compatible`);
  return response.json();
}

export interface EnsemblePredictResult {
  ensemble_predictions: number[];
  detailed_results: {
    index: number;
    ensemble_prediction: number;
    individual_predictions: Record<string, number>;
  }[];
  stats: {
    num_models: number;
    num_predictions: number;
    avg_model_disagreement: number;
    max_model_disagreement: number;
    model_correlations: Record<string, number>;
  };
  method: string;
  model_names: Record<string, string>;
}

export async function createEnsemblePrediction(
  modelIds: string[],
  inputData: Record<string, unknown>[],
  weights?: Record<string, number>,
  method?: string
): Promise<EnsemblePredictResult> {
  const response = await fetch(`${API_BASE}/models/ensemble/predict`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model_ids: modelIds,
      input_data: inputData,
      weights,
      method: method || 'weighted',
    }),
  });
  return response.json();
}

// Hyperparameter Tuning
export interface TuningResult {
  model_type: string;
  best_params: Record<string, unknown>;
  best_score: number;
  best_std: number;
  all_results: {
    params?: Record<string, unknown>;
    variant?: string;
    mean_test_score?: number;
    mean_r2?: number;
    std_test_score?: number;
    std_r2?: number;
    rank?: number;
  }[];
  method: string;
  cv_folds: number;
  best_variant?: string;
  features_tested?: string[];  // Added by frontend after tuning
}

export async function tuneModel(
  modelType: string,
  datasetId: string,
  features: string[],
  target: string,
  nIter?: number,
  cvFolds?: number,
  method?: string
): Promise<{ message: string; result: TuningResult }> {
  const response = await fetch(`${API_BASE}/models/tune`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model_type: modelType,
      dataset_id: datasetId,
      features,
      target,
      n_iter: nIter || 20,
      cv_folds: cvFolds || 5,
      method: method || 'random',
    }),
  });
  return response.json();
}

export async function getTuningRecommendations(modelType: string): Promise<{
  description: string;
  recommended: Record<string, unknown>;
}> {
  const response = await fetch(`${API_BASE}/models/tune/recommendations/${modelType}`);
  return response.json();
}

// Feature Analysis
export interface FeatureAnalysis {
  feature: string;
  dtype: string;
  is_numeric: boolean;
  missing_count: number;
  missing_percent: number;
  unique_count: number;
  correlation: number | null;
  abs_correlation: number | null;
  recommendation: 'good' | 'moderate' | 'weak' | 'very_weak' | 'caution' | 'avoid' | 'categorical' | 'neutral';
  warning: string | null;
}

export interface FeatureAnalysisResult {
  target: string;
  total_features: number;
  numeric_features: number;
  features: FeatureAnalysis[];
  summary: {
    good: string[];
    moderate: string[];
    caution: string[];
    avoid: string[];
  };
  suggestion: string;
}

export async function analyzeFeatures(
  datasetId: string,
  target: string
): Promise<FeatureAnalysisResult> {
  const response = await fetch(`${API_BASE}/models/analyze-features`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      dataset_id: datasetId,
      target,
    }),
  });
  return response.json();
}
