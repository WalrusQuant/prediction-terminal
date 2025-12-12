import { useState, useEffect } from 'react';
import { Sidebar } from './components/Sidebar';
import { PredictionsTable } from './components/PredictionsTable';
import { ModelsTable } from './components/ModelsTable';
import { DataPanel } from './components/DataPanel';
import { fetchPredictions, fetchModels, fetchDatasets, uploadDataset } from './api/client';

function App() {
  const [activeTab, setActiveTab] = useState('predictions');
  const [predictions, setPredictions] = useState([]);
  const [models, setModels] = useState([]);
  const [datasets, setDatasets] = useState([]);
  const [loading, setLoading] = useState(true);

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

  const handleUpload = async (file: File) => {
    try {
      await uploadDataset(file);
      const dataRes = await fetchDatasets();
      setDatasets(dataRes.datasets || []);
    } catch (error) {
      console.error('Failed to upload:', error);
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
            <PredictionsTable predictions={predictions} loading={loading} />
          )}
          {activeTab === 'models' && (
            <ModelsTable models={models} loading={loading} />
          )}
          {activeTab === 'data' && (
            <DataPanel datasets={datasets} loading={loading} onUpload={handleUpload} />
          )}
        </div>
      </main>

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
