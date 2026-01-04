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
}

interface ModelsTableProps {
  models: Model[];
  loading: boolean;
  onPredict: (model: Model) => void;
  onDelete: (modelId: string) => void;
}

export function ModelsTable({ models, loading, onPredict, onDelete }: ModelsTableProps) {
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
      <div className="terminal-panel-header">
        Models ({models.length})
      </div>
      <table className="terminal-table">
        <thead>
          <tr>
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
          {models.map((model) => (
            <tr key={model.id}>
              <td>{model.name}</td>
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
