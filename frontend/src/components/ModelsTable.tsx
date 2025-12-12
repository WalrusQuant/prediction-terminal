interface Model {
  id: string;
  name: string;
  model_type: string;
  status: string;
  accuracy: number | null;
  created_at: string;
  last_run: string | null;
}

interface ModelsTableProps {
  models: Model[];
  loading: boolean;
}

export function ModelsTable({ models, loading }: ModelsTableProps) {
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
            <th>Status</th>
            <th>Accuracy</th>
            <th>Last Run</th>
          </tr>
        </thead>
        <tbody>
          {models.map((model) => (
            <tr key={model.id}>
              <td>{model.name}</td>
              <td style={{ color: 'var(--text-secondary)' }}>
                {formatModelType(model.model_type)}
              </td>
              <td>
                <StatusBadge status={model.status} />
              </td>
              <td className={model.accuracy ? 'text-cyan' : 'text-muted'}>
                {model.accuracy ? `${(model.accuracy * 100).toFixed(1)}%` : '—'}
              </td>
              <td style={{ color: 'var(--text-secondary)' }}>
                {model.last_run ? formatTime(model.last_run) : '—'}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
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

function formatTime(timestamp: string): string {
  const date = new Date(timestamp);
  return date.toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: true
  });
}
