interface Prediction {
  id: string;
  model_id: string;
  model_name: string;
  label: string;
  target: string;
  predicted_value: number;
  input_data: Record<string, unknown>;
  timestamp: string;
}

interface PredictionsTableProps {
  predictions: Prediction[];
  loading: boolean;
  onClear: () => void;
}

export function PredictionsTable({ predictions, loading, onClear }: PredictionsTableProps) {
  if (loading) {
    return (
      <div className="terminal-panel">
        <div className="terminal-panel-header">Predictions</div>
        <div style={{ padding: '24px', textAlign: 'center', color: 'var(--text-muted)' }}>
          Loading predictions...
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
        <span>Predictions ({predictions.length})</span>
        {predictions.length > 0 && (
          <button
            onClick={onClear}
            style={{
              padding: '4px 8px',
              fontSize: '11px',
              color: 'var(--red)',
              borderColor: 'var(--red)'
            }}
          >
            Clear All
          </button>
        )}
      </div>

      {predictions.length === 0 ? (
        <div style={{ padding: '24px', textAlign: 'center', color: 'var(--text-muted)' }}>
          No predictions yet. Train a model and generate predictions to see results here.
        </div>
      ) : (
        <table className="terminal-table">
          <thead>
            <tr>
              <th>Label</th>
              <th>Model</th>
              <th>Target</th>
              <th>Predicted Value</th>
              <th>Inputs</th>
              <th>Time</th>
            </tr>
          </thead>
          <tbody>
            {predictions.map((pred) => (
              <tr key={pred.id}>
                <td>{pred.label}</td>
                <td style={{ color: 'var(--text-secondary)' }}>{pred.model_name}</td>
                <td className="text-cyan">{pred.target}</td>
                <td style={{
                  color: 'var(--cyan)',
                  fontWeight: 'bold',
                  fontSize: '14px'
                }}>
                  {pred.predicted_value.toLocaleString(undefined, { maximumFractionDigits: 2 })}
                </td>
                <td style={{
                  color: 'var(--text-muted)',
                  fontSize: '11px',
                  maxWidth: '200px',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap'
                }}>
                  {formatInputs(pred.input_data)}
                </td>
                <td style={{ color: 'var(--text-secondary)' }}>
                  {formatTime(pred.timestamp)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}

function formatInputs(data: Record<string, unknown>): string {
  const entries = Object.entries(data);
  if (entries.length === 0) return '—';
  if (entries.length <= 3) {
    return entries.map(([k, v]) => `${k}: ${v}`).join(', ');
  }
  return `${entries.slice(0, 2).map(([k, v]) => `${k}: ${v}`).join(', ')} +${entries.length - 2} more`;
}

function formatTime(timestamp: string): string {
  const date = new Date(timestamp);
  return date.toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: true
  });
}
