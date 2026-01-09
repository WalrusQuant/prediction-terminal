import { useState } from 'react';
import { updatePredictionActual } from '../api/client';

interface Prediction {
  id: string;
  model_id: string;
  model_name: string;
  label: string;
  target: string;
  predicted_value: number;
  confidence_low?: number | null;
  confidence_high?: number | null;
  confidence_std?: number | null;
  actual_value?: number | null;
  error?: number | null;
  percent_error?: number | null;
  input_data: Record<string, unknown>;
  timestamp: string;
}

interface PredictionsTableProps {
  predictions: Prediction[];
  loading: boolean;
  onClear: () => void;
  onPredictionUpdated?: () => void;
  onShowAccuracy?: () => void;
}

function exportToCSV(predictions: Prediction[]) {
  if (predictions.length === 0) return;

  // Get all unique input keys
  const inputKeys = new Set<string>();
  predictions.forEach(p => {
    Object.keys(p.input_data).forEach(k => inputKeys.add(k));
  });
  const inputKeysArray = Array.from(inputKeys).sort();

  // Build CSV header
  const headers = ['Label', 'Model', 'Target', 'Predicted Value', 'Actual Value', 'Error', 'Error %', ...inputKeysArray, 'Timestamp'];

  // Build CSV rows
  const rows = predictions.map(p => {
    const inputValues = inputKeysArray.map(k => {
      const val = p.input_data[k];
      return val !== undefined ? String(val) : '';
    });
    return [
      p.label,
      p.model_name,
      p.target,
      p.predicted_value.toString(),
      p.actual_value !== null && p.actual_value !== undefined ? p.actual_value.toString() : '',
      p.error !== null && p.error !== undefined ? p.error.toString() : '',
      p.percent_error !== null && p.percent_error !== undefined ? p.percent_error.toFixed(1) + '%' : '',
      ...inputValues,
      p.timestamp
    ];
  });

  // Convert to CSV string
  const csvContent = [
    headers.join(','),
    ...rows.map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(','))
  ].join('\n');

  // Download
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = `predictions_${new Date().toISOString().slice(0, 10)}.csv`;
  link.click();
  URL.revokeObjectURL(link.href);
}

export function PredictionsTable({ predictions, loading, onClear, onPredictionUpdated, onShowAccuracy }: PredictionsTableProps) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editValue, setEditValue] = useState('');
  const [saving, setSaving] = useState(false);

  const handleStartEdit = (pred: Prediction) => {
    setEditingId(pred.id);
    setEditValue(pred.actual_value !== null && pred.actual_value !== undefined ? String(pred.actual_value) : '');
  };

  const handleSaveActual = async (predId: string) => {
    const value = parseFloat(editValue);
    if (isNaN(value)) {
      setEditingId(null);
      return;
    }

    setSaving(true);
    try {
      await updatePredictionActual(predId, value);
      onPredictionUpdated?.();
    } catch (err) {
      console.error('Failed to update actual value:', err);
    } finally {
      setSaving(false);
      setEditingId(null);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent, predId: string) => {
    if (e.key === 'Enter') {
      handleSaveActual(predId);
    } else if (e.key === 'Escape') {
      setEditingId(null);
    }
  };

  const predictionsWithActuals = predictions.filter(p => p.actual_value !== null && p.actual_value !== undefined);

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
          <div style={{ display: 'flex', gap: '8px' }}>
            {predictionsWithActuals.length > 0 && onShowAccuracy && (
              <button
                onClick={onShowAccuracy}
                style={{
                  padding: '4px 8px',
                  fontSize: '11px',
                  color: 'var(--green)',
                  borderColor: 'var(--green)'
                }}
              >
                Accuracy ({predictionsWithActuals.length})
              </button>
            )}
            <button
              onClick={() => exportToCSV(predictions)}
              style={{
                padding: '4px 8px',
                fontSize: '11px',
                color: 'var(--cyan)',
                borderColor: 'var(--cyan)'
              }}
            >
              Export CSV
            </button>
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
          </div>
        )}
      </div>

      {predictions.length === 0 ? (
        <div style={{ padding: '24px', textAlign: 'center', color: 'var(--text-muted)' }}>
          No predictions yet. Train a model and generate predictions to see results here.
        </div>
      ) : (
        <>
          <table className="terminal-table">
            <thead>
              <tr>
                <th>Label</th>
                <th>Model</th>
                <th>Target</th>
                <th>Predicted</th>
                <th>Actual</th>
                <th>Error</th>
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
                    {pred.confidence_low !== null && pred.confidence_low !== undefined &&
                     pred.confidence_high !== null && pred.confidence_high !== undefined && (
                      <div style={{
                        fontSize: '10px',
                        fontWeight: 'normal',
                        color: 'var(--text-muted)',
                        marginTop: '2px'
                      }}>
                        [{pred.confidence_low.toFixed(1)} - {pred.confidence_high.toFixed(1)}]
                      </div>
                    )}
                  </td>
                  <td style={{ minWidth: '80px' }}>
                    {editingId === pred.id ? (
                      <input
                        type="number"
                        value={editValue}
                        onChange={(e) => setEditValue(e.target.value)}
                        onKeyDown={(e) => handleKeyDown(e, pred.id)}
                        onBlur={() => handleSaveActual(pred.id)}
                        autoFocus
                        disabled={saving}
                        style={{
                          width: '70px',
                          padding: '2px 4px',
                          fontSize: '12px',
                          background: 'var(--bg-tertiary)',
                          border: '1px solid var(--cyan)',
                          borderRadius: '2px',
                          color: 'var(--text-primary)',
                        }}
                      />
                    ) : (
                      <button
                        onClick={() => handleStartEdit(pred)}
                        style={{
                          padding: '2px 6px',
                          fontSize: '11px',
                          background: pred.actual_value !== null && pred.actual_value !== undefined
                            ? 'transparent'
                            : 'rgba(0, 212, 170, 0.1)',
                          border: '1px solid var(--border-color)',
                          borderRadius: '2px',
                          color: pred.actual_value !== null && pred.actual_value !== undefined
                            ? 'var(--green)'
                            : 'var(--text-muted)',
                          cursor: 'pointer',
                        }}
                        title="Click to enter actual value"
                      >
                        {pred.actual_value !== null && pred.actual_value !== undefined
                          ? pred.actual_value.toLocaleString(undefined, { maximumFractionDigits: 2 })
                          : '+ Add'}
                      </button>
                    )}
                  </td>
                  <td>
                    {pred.error !== null && pred.error !== undefined ? (
                      <span style={{
                        color: pred.error > 0 ? 'var(--green)' : pred.error < 0 ? 'var(--red)' : 'var(--text-secondary)',
                        fontSize: '12px',
                      }}>
                        {pred.error > 0 ? '+' : ''}{pred.error.toFixed(2)}
                        {pred.percent_error !== null && pred.percent_error !== undefined && (
                          <span style={{ color: 'var(--text-muted)', fontSize: '10px', marginLeft: '4px' }}>
                            ({pred.percent_error.toFixed(1)}%)
                          </span>
                        )}
                      </span>
                    ) : (
                      <span style={{ color: 'var(--text-muted)' }}>—</span>
                    )}
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
          <div style={{
            padding: '12px 16px',
            borderTop: '1px solid var(--border-color)',
            fontSize: '11px',
            color: 'var(--text-muted)'
          }}>
            <strong>Tip:</strong> Click on the Actual column to enter real outcomes and track prediction accuracy.
            {predictionsWithActuals.length > 0 && (
              <span style={{ marginLeft: '8px' }}>
                {predictionsWithActuals.length} of {predictions.length} predictions have actual values.
              </span>
            )}
          </div>
        </>
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
