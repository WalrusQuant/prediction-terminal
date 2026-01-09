import { useState, useEffect } from 'react';
import { Sidebar } from './components/Sidebar';
import { PredictionsTable } from './components/PredictionsTable';
import { ModelsTable } from './components/ModelsTable';
import { DataPanel } from './components/DataPanel';
import { DatasetDetailModal } from './components/DatasetDetailModal';
import type { DatasetDetails, StatsData } from './components/DatasetDetailModal';
import { TrainModelModal } from './components/TrainModelModal';
import { PredictModal } from './components/PredictModal';
import { ModelDetailModal } from './components/ModelDetailModal';
import { DataEditorModal } from './components/DataEditorModal';
import { ModelCompareModal } from './components/ModelCompareModal';
import { DataVisualizationModal } from './components/DataVisualizationModal';
import { ImportUrlModal } from './components/ImportUrlModal';
import { QuickPredictBar } from './components/QuickPredictBar';
import { AccuracyDashboard } from './components/AccuracyDashboard';
import { EnsembleModal } from './components/EnsembleModal';
import { useToast } from './components/Toast';
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
  fetchModelDetail,
  createSinglePrediction,
  createBatchPredictions,
  clearPredictions,
  deletePrediction,
  toggleModelFavorite,
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
  is_favorite?: boolean;
}

function App() {
  const { showToast } = useToast();
  const [activeTab, setActiveTab] = useState('data');
  const [predictions, setPredictions] = useState([]);
  const [models, setModels] = useState<Model[]>([]);
  const [datasets, setDatasets] = useState<DatasetWithOptionalFeatures[]>([]);
  const [loading, setLoading] = useState(true);

  // Theme state
  const [theme, setTheme] = useState<'dark' | 'light'>(() => {
    const saved = localStorage.getItem('theme');
    return (saved === 'light' || saved === 'dark') ? saved : 'dark';
  });

  // Apply theme to document
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('theme', theme);
  }, [theme]);

  const toggleTheme = () => {
    setTheme(prev => prev === 'dark' ? 'light' : 'dark');
  };

  // Modal states
  const [viewingDataset, setViewingDataset] = useState<DatasetDetails | null>(null);
  const [viewingStats, setViewingStats] = useState<StatsData | null>(null);
  const [trainingDataset, setTrainingDataset] = useState<Dataset | null>(null);
  const [predictingModel, setPredictingModel] = useState<Model | null>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [viewingModelDetail, setViewingModelDetail] = useState<any | null>(null);
  const [editingDataset, setEditingDataset] = useState<{ id: string; name: string } | null>(null);
  const [comparingModels, setComparingModels] = useState(false);
  const [visualizingDataset, setVisualizingDataset] = useState<{ id: string; name: string } | null>(null);
  const [showImportUrl, setShowImportUrl] = useState(false);
  const [pinnedModel, setPinnedModel] = useState<Model | null>(null);
  const [showAccuracyDashboard, setShowAccuracyDashboard] = useState(false);
  const [showEnsemble, setShowEnsemble] = useState(false);

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
      showToast('error', `Failed to load data: ${error instanceof Error ? error.message : 'Unknown error'}. Is the backend running?`);
    }
    setLoading(false);
  };

  // Dataset handlers
  const handleUpload = async (file: File) => {
    try {
      const result = await uploadDataset(file);
      if (result.error) {
        showToast('error', `Upload failed: ${result.error}`);
        return;
      }
      const dataRes = await fetchDatasets();
      setDatasets(dataRes.datasets || []);
      showToast('success', `Dataset "${file.name}" uploaded successfully`);
    } catch (error) {
      console.error('Failed to upload:', error);
      showToast('error', 'Failed to upload dataset');
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
      showToast('success', 'Dataset deleted');
    } catch (error) {
      console.error('Failed to delete dataset:', error);
      showToast('error', 'Failed to delete dataset');
    }
  };

  const handleEditDataset = (dataset: DatasetWithOptionalFeatures) => {
    setEditingDataset({ id: dataset.id, name: dataset.name });
  };

  const handleDataChanged = async () => {
    const dataRes = await fetchDatasets();
    setDatasets(dataRes.datasets || []);
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
    showToast('success', `Model "${config.name}" trained successfully`);
  };

  const handleDeleteModel = async (modelId: string) => {
    if (!confirm('Are you sure you want to delete this model?')) return;
    try {
      await deleteModel(modelId);
      const modelRes = await fetchModels();
      setModels(modelRes.models || []);
      showToast('success', 'Model deleted');
    } catch (error) {
      console.error('Failed to delete model:', error);
      showToast('error', 'Failed to delete model');
    }
  };

  const handleToggleFavorite = async (modelId: string) => {
    try {
      const result = await toggleModelFavorite(modelId);
      setModels(prev => prev.map(m =>
        m.id === modelId ? { ...m, is_favorite: result.is_favorite } : m
      ));
    } catch (error) {
      console.error('Failed to toggle favorite:', error);
      showToast('error', 'Failed to update favorite');
    }
  };

  const handlePredict = (model: Model) => {
    setPredictingModel(model);
  };

  const handleViewModelDetail = async (model: Model) => {
    try {
      const detail = await fetchModelDetail(model.id);
      setViewingModelDetail(detail);
    } catch (error) {
      console.error('Failed to load model details:', error);
    }
  };

  // Prediction handlers
  const handleSinglePredict = async (
    modelId: string,
    inputData: Record<string, number>,
    label?: string,
    withConfidence?: boolean
  ) => {
    const result = await createSinglePrediction(modelId, inputData, label, withConfidence);
    if (result.error) {
      throw new Error(result.detail || result.error);
    }
    const predRes = await fetchPredictions();
    setPredictions(predRes.predictions || []);
    const predValue = Number(result.prediction.predicted_value);
    showToast('success', `Prediction: ${isNaN(predValue) ? result.prediction.predicted_value : predValue.toFixed(2)}`);
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
    showToast('success', `${result.predictions.length} predictions generated`);
    return result;
  };

  const handleClearPredictions = async () => {
    if (!confirm('Are you sure you want to clear all predictions?')) return;
    try {
      await clearPredictions();
      setPredictions([]);
      showToast('success', 'All predictions cleared');
    } catch (error) {
      console.error('Failed to clear predictions:', error);
      showToast('error', 'Failed to clear predictions');
    }
  };

  return (
    <div className="app-container">
      <Sidebar activeTab={activeTab} onTabChange={setActiveTab} theme={theme} onThemeToggle={toggleTheme} />
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
              onPredictionUpdated={async () => {
                const predRes = await fetchPredictions();
                setPredictions(predRes.predictions || []);
              }}
              onShowAccuracy={() => setShowAccuracyDashboard(true)}
              onDelete={async (predictionId) => {
                try {
                  await deletePrediction(predictionId);
                  const predRes = await fetchPredictions();
                  setPredictions(predRes.predictions || []);
                } catch (err) {
                  console.error('Failed to delete prediction:', err);
                }
              }}
            />
          )}
          {activeTab === 'models' && (
            <ModelsTable
              models={models}
              loading={loading}
              onPredict={handlePredict}
              onDelete={handleDeleteModel}
              onViewDetail={handleViewModelDetail}
              onCompare={() => setComparingModels(true)}
              onEnsemble={() => setShowEnsemble(true)}
              onToggleFavorite={handleToggleFavorite}
              onPin={(model) => setPinnedModel(pinnedModel?.id === model.id ? null : model)}
              pinnedModelId={pinnedModel?.id}
            />
          )}
          {activeTab === 'data' && (
            <DataPanel
              datasets={datasets}
              loading={loading}
              onUpload={handleUpload}
              onView={handleViewDataset}
              onEdit={handleEditDataset}
              onUse={handleUseDataset}
              onDelete={handleDeleteDataset}
              onImportUrl={() => setShowImportUrl(true)}
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
          onVisualize={() => {
            setVisualizingDataset({ id: viewingDataset.id, name: viewingDataset.name });
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

      {viewingModelDetail && (
        <ModelDetailModal
          model={viewingModelDetail}
          onClose={() => setViewingModelDetail(null)}
        />
      )}

      {editingDataset && (
        <DataEditorModal
          datasetId={editingDataset.id}
          datasetName={editingDataset.name}
          onClose={() => setEditingDataset(null)}
          onDataChanged={handleDataChanged}
        />
      )}

      {comparingModels && (
        <ModelCompareModal
          models={models}
          onClose={() => setComparingModels(false)}
        />
      )}

      {visualizingDataset && (
        <DataVisualizationModal
          datasetId={visualizingDataset.id}
          datasetName={visualizingDataset.name}
          onClose={() => setVisualizingDataset(null)}
        />
      )}

      {showImportUrl && (
        <ImportUrlModal
          onClose={() => setShowImportUrl(false)}
          onImported={async () => {
            const dataRes = await fetchDatasets();
            setDatasets(dataRes.datasets || []);
            showToast('success', 'Dataset imported successfully');
          }}
        />
      )}

      {showAccuracyDashboard && (
        <AccuracyDashboard
          onClose={() => setShowAccuracyDashboard(false)}
        />
      )}

      {showEnsemble && (
        <EnsembleModal
          onClose={() => setShowEnsemble(false)}
        />
      )}

      {/* Quick Predict Bar */}
      {pinnedModel && (
        <QuickPredictBar
          model={pinnedModel}
          onUnpin={() => setPinnedModel(null)}
          onPredictionMade={async (prediction) => {
            const predRes = await fetchPredictions();
            setPredictions(predRes.predictions || []);
            showToast('success', `Prediction: ${prediction.toFixed(2)}`);
          }}
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
