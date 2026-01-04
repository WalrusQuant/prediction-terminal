import { useState, useEffect } from 'react';
import { Sidebar } from './components/Sidebar';
import { PredictionsTable } from './components/PredictionsTable';
import { ModelsTable } from './components/ModelsTable';
import { DataPanel } from './components/DataPanel';
import { DatasetDetailModal } from './components/DatasetDetailModal';
import type { DatasetDetails, StatsData } from './components/DatasetDetailModal';
import { TrainModelModal } from './components/TrainModelModal';
import { PredictModal } from './components/PredictModal';
import {
  fetchPredictions,
  fetchModels,
  fetchDatasets,
  uploadDataset,
  fetchDatasetDetails,
  fetchDatasetStats,
  deleteDataset,
  trainModel,
  deleteModel,
  createSinglePrediction,
  createBatchPredictions,
  clearPredictions,
} from './api/client';

interface Dataset {
  id: string;
  name: string;
  rows: number;
  columns: number;
  features: string[];
}

interface DatasetWithOptionalFeatures {
  id: string;
  name: string;
  rows: number;
  columns: number;
  features?: string[];
}

interface Model {
  id: string;
  name: string;
  model_type: string;
  status: string;
  accuracy: number | null;
  features: string[];
  target: string;
  created_at: string;
  last_run: string | null;
}

function App() {
  const [activeTab, setActiveTab] = useState('data');
  const [predictions, setPredictions] = useState([]);
  const [models, setModels] = useState<Model[]>([]);
  const [datasets, setDatasets] = useState<DatasetWithOptionalFeatures[]>([]);
  const [loading, setLoading] = useState(true);

  // Modal states
  const [viewingDataset, setViewingDataset] = useState<DatasetDetails | null>(null);
  const [viewingStats, setViewingStats] = useState<StatsData | null>(null);
  const [trainingDataset, setTrainingDataset] = useState<Dataset | null>(null);
  const [predictingModel, setPredictingModel] = useState<Model | null>(null);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const [predRes, modelRes, dataRes] = await Promise.all([
        fetchPredictions(),
        fetchModels(),
        fetchDatasets(),
      ]);
      setPredictions(predRes.predictions || []);
      setModels(modelRes.models || []);
      setDatasets(dataRes.datasets || []);
    } catch (error) {
      console.error('Failed to load data:', error);
    }
    setLoading(false);
  };

  // Dataset handlers
  const handleUpload = async (file: File) => {
    try {
      await uploadDataset(file);
      const dataRes = await fetchDatasets();
      setDatasets(dataRes.datasets || []);
    } catch (error) {
      console.error('Failed to upload:', error);
    }
  };

  const handleViewDataset = async (dataset: DatasetWithOptionalFeatures) => {
    try {
      const [details, stats] = await Promise.all([
        fetchDatasetDetails(dataset.id),
        fetchDatasetStats(dataset.id),
      ]);
      setViewingDataset(details);
      setViewingStats(stats);
    } catch (error) {
      console.error('Failed to load dataset details:', error);
    }
  };

  const handleUseDataset = async (dataset: DatasetWithOptionalFeatures) => {
    // Fetch full details to get features
    try {
      const details = await fetchDatasetDetails(dataset.id);
      setTrainingDataset({
        ...dataset,
        features: details.features,
      });
    } catch (error) {
      console.error('Failed to load dataset:', error);
    }
  };

  const handleDeleteDataset = async (datasetId: string) => {
    if (!confirm('Are you sure you want to delete this dataset?')) return;
    try {
      await deleteDataset(datasetId);
      const dataRes = await fetchDatasets();
      setDatasets(dataRes.datasets || []);
    } catch (error) {
      console.error('Failed to delete dataset:', error);
    }
  };

  // Model handlers
  const handleTrainModel = async (config: {
    name: string;
    model_type: string;
    dataset_id: string;
    features: string[];
    target: string;
  }) => {
    const result = await trainModel(config);
    if (result.error) {
      throw new Error(result.detail || result.error);
    }
    const modelRes = await fetchModels();
    setModels(modelRes.models || []);
    setActiveTab('models');
  };

  const handleDeleteModel = async (modelId: string) => {
    if (!confirm('Are you sure you want to delete this model?')) return;
    try {
      await deleteModel(modelId);
      const modelRes = await fetchModels();
      setModels(modelRes.models || []);
    } catch (error) {
      console.error('Failed to delete model:', error);
    }
  };

  const handlePredict = (model: Model) => {
    setPredictingModel(model);
  };

  // Prediction handlers
  const handleSinglePredict = async (
    modelId: string,
    inputData: Record<string, number>,
    label?: string
  ) => {
    const result = await createSinglePrediction(modelId, inputData, label);
    if (result.error) {
      throw new Error(result.detail || result.error);
    }
    const predRes = await fetchPredictions();
    setPredictions(predRes.predictions || []);
    return result;
  };

  const handleBatchPredict = async (
    modelId: string,
    data: Record<string, unknown>[],
    labels?: string[]
  ) => {
    const result = await createBatchPredictions(modelId, data, labels);
    if (result.error) {
      throw new Error(result.detail || result.error);
    }
    const predRes = await fetchPredictions();
    setPredictions(predRes.predictions || []);
    return result;
  };

  const handleClearPredictions = async () => {
    if (!confirm('Are you sure you want to clear all predictions?')) return;
    try {
      await clearPredictions();
      setPredictions([]);
    } catch (error) {
      console.error('Failed to clear predictions:', error);
    }
  };

  return (
    <div className="app-container">
      <Sidebar activeTab={activeTab} onTabChange={setActiveTab} />
      <main className="main-content">
        <header className="main-header">
          <h1>{activeTab.charAt(0).toUpperCase() + activeTab.slice(1)}</h1>
          <div className="header-status">
            <span className="status-dot" />
            <span>Connected</span>
          </div>
        </header>
        <div className="content-area">
          {activeTab === 'predictions' && (
            <PredictionsTable
              predictions={predictions}
              loading={loading}
              onClear={handleClearPredictions}
            />
          )}
          {activeTab === 'models' && (
            <ModelsTable
              models={models}
              loading={loading}
              onPredict={handlePredict}
              onDelete={handleDeleteModel}
            />
          )}
          {activeTab === 'data' && (
            <DataPanel
              datasets={datasets}
              loading={loading}
              onUpload={handleUpload}
              onView={handleViewDataset}
              onUse={handleUseDataset}
              onDelete={handleDeleteDataset}
            />
          )}
        </div>
      </main>

      {/* Modals */}
      {viewingDataset && (
        <DatasetDetailModal
          dataset={viewingDataset}
          stats={viewingStats}
          onClose={() => {
            setViewingDataset(null);
            setViewingStats(null);
          }}
        />
      )}

      {trainingDataset && (
        <TrainModelModal
          dataset={trainingDataset}
          onTrain={handleTrainModel}
          onClose={() => setTrainingDataset(null)}
        />
      )}

      {predictingModel && (
        <PredictModal
          model={predictingModel}
          onSinglePredict={handleSinglePredict}
          onBatchPredict={handleBatchPredict}
          onClose={() => setPredictingModel(null)}
        />
      )}

      <style>{`
        .app-container {
          display: flex;
          min-height: 100vh;
        }
        .main-content {
          flex: 1;
          display: flex;
          flex-direction: column;
        }
        .main-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 16px 24px;
          border-bottom: 1px solid var(--border-color);
          background-color: var(--bg-secondary);
        }
        .main-header h1 {
          margin: 0;
          font-size: 16px;
          font-weight: 500;
        }
        .header-status {
          display: flex;
          align-items: center;
          gap: 8px;
          font-size: 12px;
          color: var(--text-secondary);
        }
        .status-dot {
          width: 8px;
          height: 8px;
          border-radius: 50%;
          background-color: var(--green);
        }
        .content-area {
          flex: 1;
          padding: 24px;
          overflow-y: auto;
        }
      `}</style>
    </div>
  );
}

export default App;
