import { useState } from 'react';

interface Model {
  id: string;
  name: string;
  model_type: string;
  status: string;
  accuracy: number | null;
  features: string[];
  target: string;
  metrics?: {
    r2_score: number;
    mse: number;
    mae: number;
    rmse: number;
  };
  created_at: string;
  last_run: string | null;
  is_favorite?: boolean;
}

interface ModelsTableProps {
  models: Model[];
  loading: boolean;
  onPredict: (model: Model) => void;
  onDelete: (modelId: string) => void;
  onViewDetail: (model: Model) => void;
  onCompare: () => void;
  onEnsemble?: () => void;
  onToggleFavorite: (modelId: string) => void;
  onRename?: (modelId: string, newName: string) => void;
  onPin?: (model: Model) => void;
  pinnedModelId?: string | null;
}

export function ModelsTable({ models, loading, onPredict, onDelete, onViewDetail, onCompare, onEnsemble, onToggleFavorite, onRename, onPin, pinnedModelId }: ModelsTableProps) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');

  const handleStartEdit = (model: Model) => {
    setEditingId(model.id);
    setEditName(model.name);
  };

  const handleSaveEdit = () => {
    if (editingId && editName.trim() && onRename) {
      onRename(editingId, editName.trim());
    }
    setEditingId(null);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleSaveEdit();
    } else if (e.key === 'Escape') {
      setEditingId(null);
    }
  };

  // Sort models: favorites first, then by created date
  const sortedModels = [...models].sort((a, b) => {
    if (a.is_favorite && !b.is_favorite) return -1;
    if (!a.is_favorite && b.is_favorite) return 1;
    return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
  });
  if (loading) {
    return (
      <div className="terminal-panel">
        <div className="terminal-panel-header">Models</div>
        <div style={{ padding: '24px', textAlign: 'center', color: 'var(--text-muted)' }}>
          Loading models...
        </div>
      </div>
    );
  }

  if (models.length === 0) {
    return (
      <div className="terminal-panel">
        <div className="terminal-panel-header">Models (0)</div>
        <div style={{ padding: '24px', textAlign: 'center', color: 'var(--text-muted)' }}>
          No models trained yet. Upload data and train a model to get started.
        </div>
      </div>
    );
  }

  return (
    <div className="terminal-panel">
      <div className="terminal-panel-header" style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center'
      }}>
        <span>Models ({models.length})</span>
        <div style={{ display: 'flex', gap: '8px' }}>
          {models.filter(m => m.metrics).length >= 2 && onEnsemble && (
            <button
              onClick={onEnsemble}
              style={{
                padding: '4px 8px',
                fontSize: '11px',
                color: 'var(--yellow)',
                borderColor: 'var(--yellow)'
              }}
            >
              Ensemble
            </button>
          )}
          {models.filter(m => m.metrics).length >= 2 && (
            <button
              onClick={onCompare}
              style={{
                padding: '4px 8px',
                fontSize: '11px',
                color: 'var(--cyan)',
                borderColor: 'var(--cyan)'
              }}
            >
              Compare Models
            </button>
          )}
        </div>
      </div>
      <table className="terminal-table">
        <thead>
          <tr>
            <th style={{ width: '40px' }}></th>
            <th>Name</th>
            <th>Type</th>
            <th>Target</th>
            <th>Features</th>
            <th>R²</th>
            <th>RMSE</th>
            <th>MAE</th>
            <th>Status</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          {sortedModels.map((model) => (
            <tr key={model.id} style={{ background: model.is_favorite ? 'rgba(0, 212, 170, 0.05)' : undefined }}>
              <td style={{ width: '40px', textAlign: 'center' }}>
                <button
                  onClick={() => onToggleFavorite(model.id)}
                  style={{
                    padding: '4px 8px',
                    fontSize: '14px',
                    background: 'transparent',
                    border: 'none',
                    cursor: 'pointer',
                    color: model.is_favorite ? 'var(--yellow)' : 'var(--text-muted)',
                  }}
                  title={model.is_favorite ? 'Remove from favorites' : 'Add to favorites'}
                >
                  {model.is_favorite ? '★' : '☆'}
                </button>
              </td>
              <td>
                {editingId === model.id ? (
                  <input
                    type="text"
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    onKeyDown={handleKeyDown}
                    onBlur={handleSaveEdit}
                    autoFocus
                    style={{
                      width: '100%',
                      padding: '2px 6px',
                      fontSize: '12px',
                      background: 'var(--bg-tertiary)',
                      border: '1px solid var(--cyan)',
                      borderRadius: '2px',
                      color: 'var(--text-primary)',
                    }}
                  />
                ) : (
                  <span
                    onClick={() => onRename && handleStartEdit(model)}
                    style={{
                      cursor: onRename ? 'pointer' : 'default',
                    }}
                    title={onRename ? 'Click to rename' : undefined}
                  >
                    {model.name}
                  </span>
                )}
              </td>
              <td style={{ color: 'var(--text-secondary)' }}>
                {formatModelType(model.model_type)}
              </td>
              <td className="text-cyan">{model.target}</td>
              <td style={{ color: 'var(--text-secondary)', fontSize: '11px' }}>
                {model.features?.length || 0} features
              </td>
              <td className={model.metrics?.r2_score ? 'text-cyan' : 'text-muted'}>
                {model.metrics?.r2_score !== undefined ? model.metrics.r2_score.toFixed(4) : '—'}
              </td>
              <td className={model.metrics?.rmse ? 'text-yellow' : 'text-muted'}>
                {model.metrics?.rmse !== undefined ? model.metrics.rmse.toFixed(4) : '—'}
              </td>
              <td className={model.metrics?.mae ? 'text-yellow' : 'text-muted'}>
                {model.metrics?.mae !== undefined ? model.metrics.mae.toFixed(4) : '—'}
              </td>
              <td>
                <StatusBadge status={model.status} />
              </td>
              <td>
                <button
                  onClick={() => onViewDetail(model)}
                  style={{
                    padding: '4px 8px',
                    fontSize: '11px',
                    marginRight: '8px',
                  }}
                >
                  View
                </button>
                <button
                  onClick={() => onPredict(model)}
                  disabled={model.status !== 'trained'}
                  style={{
                    padding: '4px 8px',
                    fontSize: '11px',
                    marginRight: '8px',
                    background: model.status === 'trained' ? 'var(--cyan)' : 'var(--bg-tertiary)',
                    color: model.status === 'trained' ? 'var(--bg-primary)' : 'var(--text-muted)',
                    borderColor: model.status === 'trained' ? 'var(--cyan)' : 'var(--border-color)'
                  }}
                >
                  Predict
                </button>
                {onPin && (
                  <button
                    onClick={() => onPin(model)}
                    disabled={model.status !== 'trained'}
                    style={{
                      padding: '4px 8px',
                      fontSize: '11px',
                      marginRight: '8px',
                      color: pinnedModelId === model.id ? 'var(--yellow)' : 'var(--text-secondary)',
                      borderColor: pinnedModelId === model.id ? 'var(--yellow)' : 'var(--border-color)',
                      background: pinnedModelId === model.id ? 'rgba(255, 165, 2, 0.1)' : 'transparent',
                    }}
                    title={pinnedModelId === model.id ? 'Pinned for quick predict' : 'Pin for quick predict'}
                  >
                    {pinnedModelId === model.id ? '★ Pinned' : 'Pin'}
                  </button>
                )}
                <button
                  onClick={() => onDelete(model.id)}
                  style={{
                    padding: '4px 8px',
                    fontSize: '11px',
                    color: 'var(--red)',
                    borderColor: 'var(--red)'
                  }}
                >
                  Delete
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      <div style={{
        padding: '12px 16px',
        borderTop: '1px solid var(--border-color)',
        fontSize: '11px',
        color: 'var(--text-muted)'
      }}>
        <strong>Metrics:</strong> R² = coefficient of determination (higher is better, max 1.0) |
        RMSE = root mean squared error (lower is better) |
        MAE = mean absolute error (lower is better)
      </div>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const colors: Record<string, string> = {
    trained: 'var(--green)',
    training: 'var(--yellow)',
    error: 'var(--red)',
    pending: 'var(--text-muted)',
  };

  return (
    <span style={{
      display: 'inline-flex',
      alignItems: 'center',
      gap: '6px',
      color: colors[status] || 'var(--text-secondary)',
    }}>
      <span style={{
        width: '6px',
        height: '6px',
        borderRadius: '50%',
        backgroundColor: colors[status] || 'var(--text-secondary)',
      }} />
      {status}
    </span>
  );
}

function formatModelType(type: string): string {
  const types: Record<string, string> = {
    linear_regression: 'Linear Reg',
    random_forest: 'Random Forest',
    xgboost: 'XGBoost',
    neural_network: 'Neural Net',
  };
  return types[type] || type;
}
