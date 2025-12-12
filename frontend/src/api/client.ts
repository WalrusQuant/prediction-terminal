const API_BASE = 'http://localhost:8000/api';

export async function fetchPredictions() {
  const response = await fetch(`${API_BASE}/predictions/`);
  return response.json();
}

export async function fetchModels() {
  const response = await fetch(`${API_BASE}/models/`);
  return response.json();
}

export async function fetchDatasets() {
  const response = await fetch(`${API_BASE}/data/`);
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

export async function createModel(config: {
  name: string;
  model_type: string;
  features: string[];
  target: string;
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
