interface Prediction {
  id: string;
  player: string;
  market: string;
  prop_type: string;
  predicted_value: number;
  confidence: number;
  current_line: number;
  edge: number;
  timestamp: string;
}

interface PredictionsTableProps {
  predictions: Prediction[];
  loading: boolean;
}

export function PredictionsTable({ predictions, loading }: PredictionsTableProps) {
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
      <div className="terminal-panel-header">
        Predictions ({predictions.length})
      </div>
      <table className="terminal-table">
        <thead>
          <tr>
            <th>Player</th>
            <th>Market</th>
            <th>Prop</th>
            <th>Predicted</th>
            <th>Line</th>
            <th>Edge</th>
            <th>Confidence</th>
          </tr>
        </thead>
        <tbody>
          {predictions.map((pred) => (
            <tr key={pred.id}>
              <td>{pred.player}</td>
              <td style={{ color: 'var(--text-secondary)' }}>{pred.market}</td>
              <td>{pred.prop_type}</td>
              <td className="text-cyan">{pred.predicted_value.toFixed(1)}</td>
              <td>{pred.current_line}</td>
              <td className={pred.edge > 0 ? 'text-green' : 'text-red'}>
                {pred.edge > 0 ? '+' : ''}{pred.edge.toFixed(1)}%
              </td>
              <td>
                <ConfidenceBar value={pred.confidence} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function ConfidenceBar({ value }: { value: number }) {
  const percentage = Math.round(value * 100);
  const color = value >= 0.7 ? 'var(--green)' : value >= 0.5 ? 'var(--yellow)' : 'var(--red)';

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
      <div style={{
        width: '60px',
        height: '4px',
        backgroundColor: 'var(--bg-tertiary)',
        borderRadius: '2px',
        overflow: 'hidden',
      }}>
        <div style={{
          width: `${percentage}%`,
          height: '100%',
          backgroundColor: color,
          borderRadius: '2px',
        }} />
      </div>
      <span style={{ color, fontSize: '11px' }}>{percentage}%</span>
    </div>
  );
}
