const API_BASE = 'http://localhost:8000/api';

// Dataset endpoints
export async function fetchDatasets() {
  const response = await fetch(`${API_BASE}/data/`);
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

// Model endpoints
export async function fetchModels() {
  const response = await fetch(`${API_BASE}/models/`);
  return response.json();
}

export async function fetchModel(modelId: string) {
  const response = await fetch(`${API_BASE}/models/${modelId}`);
  return response.json();
}

export async function trainModel(config: {
  name: string;
  model_type: string;
  dataset_id: string;
  features: string[];
  target: string;
  description?: string;
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

// Prediction endpoints
export async function fetchPredictions() {
  const response = await fetch(`${API_BASE}/predictions/`);
  return response.json();
}

export async function createSinglePrediction(
  modelId: string,
  inputData: Record<string, number>,
  label?: string
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
