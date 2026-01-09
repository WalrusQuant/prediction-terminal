import { useState } from 'react';
import {
  engineerFeature,
  type FeatureEngineerRequest,
} from '../api/client';
import { useKeyboardShortcuts } from '../hooks/useKeyboardShortcuts';

interface FeatureEngineerModalProps {
  datasetId: string;
  datasetName: string;
  columns: string[];
  onClose: () => void;
  onFeatureAdded: () => void;
}

type OperationType = FeatureEngineerRequest['operation_type'];

const OPERATION_INFO: Record<OperationType, { label: string; description: string }> = {
  rolling_average: {
    label: 'Rolling Average',
    description: 'Calculate a moving average over a window of rows',
  },
  ratio: {
    label: 'Ratio',
    description: 'Divide one column by another (A / B)',
  },
  difference: {
    label: 'Difference',
    description: 'Subtract one column from another (A - B)',
  },
  percentage_change: {
    label: 'Percentage Change',
    description: 'Calculate % change from previous rows',
  },
  lag: {
    label: 'Lag Feature',
    description: 'Use values from previous rows as a feature',
  },
  product: {
    label: 'Product',
    description: 'Multiply two columns together (A * B)',
  },
};

export function FeatureEngineerModal({
  datasetId,
  datasetName,
  columns,
  onClose,
  onFeatureAdded,
}: FeatureEngineerModalProps) {
  const [operationType, setOperationType] = useState<OperationType>('rolling_average');
  const [column, setColumn] = useState(columns[0] || '');
  const [column1, setColumn1] = useState(columns[0] || '');
  const [column2, setColumn2] = useState(columns[1] || columns[0] || '');
  const [numerator, setNumerator] = useState(columns[0] || '');
  const [denominator, setDenominator] = useState(columns[1] || columns[0] || '');
  const [window, setWindow] = useState(3);
  const [periods, setPeriods] = useState(1);
  const [newColumnName, setNewColumnName] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useKeyboardShortcuts({ onEscape: onClose, enabled: !loading });

  const handleSubmit = async () => {
    setLoading(true);
    setError('');

    try {
      const request: FeatureEngineerRequest = {
        operation_type: operationType,
        new_column_name: newColumnName || undefined,
      };

      switch (operationType) {
        case 'rolling_average':
          request.column = column;
          request.window = window;
          break;
        case 'ratio':
          request.numerator = numerator;
          request.denominator = denominator;
          break;
        case 'difference':
          request.column1 = column1;
          request.column2 = column2;
          break;
        case 'percentage_change':
          request.column = column;
          request.periods = periods;
          break;
        case 'lag':
          request.column = column;
          request.periods = periods;
          break;
        case 'product':
          request.column1 = column1;
          request.column2 = column2;
          break;
      }

      const result = await engineerFeature(datasetId, request);

      if ('detail' in result) {
        throw new Error((result as { detail: string }).detail);
      }

      onFeatureAdded();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to add feature');
    } finally {
      setLoading(false);
    }
  };

  const getPreviewName = (): string => {
    if (newColumnName) return newColumnName;

    switch (operationType) {
      case 'rolling_average':
        return `${column}_rolling_${window}`;
      case 'ratio':
        return `${numerator}_div_${denominator}`;
      case 'difference':
        return `${column1}_minus_${column2}`;
      case 'percentage_change':
        return `${column}_pct_change_${periods}`;
      case 'lag':
        return `${column}_lag_${periods}`;
      case 'product':
        return `${column1}_times_${column2}`;
      default:
        return 'new_feature';
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div
        className="modal-content terminal-panel"
        onClick={(e) => e.stopPropagation()}
        style={{ maxWidth: '500px', width: '90%' }}
      >
        <div className="terminal-panel-header modal-header">
          <span>Add Feature: {datasetName}</span>
          <button onClick={onClose} style={{ padding: '4px 12px', fontSize: '11px' }}>
            Close
          </button>
        </div>

        <div style={{ padding: '20px' }}>
          {error && (
            <div style={{
              marginBottom: '16px',
              padding: '12px',
              background: 'rgba(255, 71, 87, 0.2)',
              borderRadius: '4px',
              color: 'var(--red)',
              fontSize: '12px',
            }}>
              {error}
            </div>
          )}

          {/* Operation Type */}
          <div style={{ marginBottom: '16px' }}>
            <label style={{ fontSize: '11px', color: 'var(--text-secondary)', display: 'block', marginBottom: '6px' }}>
              Operation Type
            </label>
            <select
              value={operationType}
              onChange={(e) => setOperationType(e.target.value as OperationType)}
              style={{
                width: '100%',
                padding: '8px 12px',
                fontSize: '12px',
                background: 'var(--bg-secondary)',
                border: '1px solid var(--border-color)',
                borderRadius: '4px',
                color: 'var(--text-primary)',
              }}
            >
              {(Object.keys(OPERATION_INFO) as OperationType[]).map((op) => (
                <option key={op} value={op}>
                  {OPERATION_INFO[op].label}
                </option>
              ))}
            </select>
            <div style={{ fontSize: '10px', color: 'var(--text-muted)', marginTop: '4px' }}>
              {OPERATION_INFO[operationType].description}
            </div>
          </div>

          {/* Operation-specific inputs */}
          {operationType === 'rolling_average' && (
            <>
              <div style={{ marginBottom: '16px' }}>
                <label style={{ fontSize: '11px', color: 'var(--text-secondary)', display: 'block', marginBottom: '6px' }}>
                  Column
                </label>
                <select
                  value={column}
                  onChange={(e) => setColumn(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '8px 12px',
                    fontSize: '12px',
                    background: 'var(--bg-secondary)',
                    border: '1px solid var(--border-color)',
                    borderRadius: '4px',
                    color: 'var(--text-primary)',
                  }}
                >
                  {columns.map((col) => (
                    <option key={col} value={col}>{col}</option>
                  ))}
                </select>
              </div>
              <div style={{ marginBottom: '16px' }}>
                <label style={{ fontSize: '11px', color: 'var(--text-secondary)', display: 'block', marginBottom: '6px' }}>
                  Window Size (rows)
                </label>
                <input
                  type="number"
                  value={window}
                  onChange={(e) => setWindow(Math.max(1, parseInt(e.target.value) || 1))}
                  min={1}
                  style={{
                    width: '100%',
                    padding: '8px 12px',
                    fontSize: '12px',
                    background: 'var(--bg-secondary)',
                    border: '1px solid var(--border-color)',
                    borderRadius: '4px',
                    color: 'var(--text-primary)',
                  }}
                />
              </div>
            </>
          )}

          {operationType === 'ratio' && (
            <>
              <div style={{ marginBottom: '16px' }}>
                <label style={{ fontSize: '11px', color: 'var(--text-secondary)', display: 'block', marginBottom: '6px' }}>
                  Numerator (A)
                </label>
                <select
                  value={numerator}
                  onChange={(e) => setNumerator(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '8px 12px',
                    fontSize: '12px',
                    background: 'var(--bg-secondary)',
                    border: '1px solid var(--border-color)',
                    borderRadius: '4px',
                    color: 'var(--text-primary)',
                  }}
                >
                  {columns.map((col) => (
                    <option key={col} value={col}>{col}</option>
                  ))}
                </select>
              </div>
              <div style={{ marginBottom: '16px' }}>
                <label style={{ fontSize: '11px', color: 'var(--text-secondary)', display: 'block', marginBottom: '6px' }}>
                  Denominator (B)
                </label>
                <select
                  value={denominator}
                  onChange={(e) => setDenominator(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '8px 12px',
                    fontSize: '12px',
                    background: 'var(--bg-secondary)',
                    border: '1px solid var(--border-color)',
                    borderRadius: '4px',
                    color: 'var(--text-primary)',
                  }}
                >
                  {columns.map((col) => (
                    <option key={col} value={col}>{col}</option>
                  ))}
                </select>
              </div>
            </>
          )}

          {(operationType === 'difference' || operationType === 'product') && (
            <>
              <div style={{ marginBottom: '16px' }}>
                <label style={{ fontSize: '11px', color: 'var(--text-secondary)', display: 'block', marginBottom: '6px' }}>
                  Column A
                </label>
                <select
                  value={column1}
                  onChange={(e) => setColumn1(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '8px 12px',
                    fontSize: '12px',
                    background: 'var(--bg-secondary)',
                    border: '1px solid var(--border-color)',
                    borderRadius: '4px',
                    color: 'var(--text-primary)',
                  }}
                >
                  {columns.map((col) => (
                    <option key={col} value={col}>{col}</option>
                  ))}
                </select>
              </div>
              <div style={{ marginBottom: '16px' }}>
                <label style={{ fontSize: '11px', color: 'var(--text-secondary)', display: 'block', marginBottom: '6px' }}>
                  Column B
                </label>
                <select
                  value={column2}
                  onChange={(e) => setColumn2(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '8px 12px',
                    fontSize: '12px',
                    background: 'var(--bg-secondary)',
                    border: '1px solid var(--border-color)',
                    borderRadius: '4px',
                    color: 'var(--text-primary)',
                  }}
                >
                  {columns.map((col) => (
                    <option key={col} value={col}>{col}</option>
                  ))}
                </select>
              </div>
            </>
          )}

          {(operationType === 'percentage_change' || operationType === 'lag') && (
            <>
              <div style={{ marginBottom: '16px' }}>
                <label style={{ fontSize: '11px', color: 'var(--text-secondary)', display: 'block', marginBottom: '6px' }}>
                  Column
                </label>
                <select
                  value={column}
                  onChange={(e) => setColumn(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '8px 12px',
                    fontSize: '12px',
                    background: 'var(--bg-secondary)',
                    border: '1px solid var(--border-color)',
                    borderRadius: '4px',
                    color: 'var(--text-primary)',
                  }}
                >
                  {columns.map((col) => (
                    <option key={col} value={col}>{col}</option>
                  ))}
                </select>
              </div>
              <div style={{ marginBottom: '16px' }}>
                <label style={{ fontSize: '11px', color: 'var(--text-secondary)', display: 'block', marginBottom: '6px' }}>
                  Periods (rows to look back)
                </label>
                <input
                  type="number"
                  value={periods}
                  onChange={(e) => setPeriods(Math.max(1, parseInt(e.target.value) || 1))}
                  min={1}
                  style={{
                    width: '100%',
                    padding: '8px 12px',
                    fontSize: '12px',
                    background: 'var(--bg-secondary)',
                    border: '1px solid var(--border-color)',
                    borderRadius: '4px',
                    color: 'var(--text-primary)',
                  }}
                />
              </div>
            </>
          )}

          {/* Custom column name */}
          <div style={{ marginBottom: '20px' }}>
            <label style={{ fontSize: '11px', color: 'var(--text-secondary)', display: 'block', marginBottom: '6px' }}>
              Custom Column Name (optional)
            </label>
            <input
              type="text"
              value={newColumnName}
              onChange={(e) => setNewColumnName(e.target.value)}
              placeholder={getPreviewName()}
              style={{
                width: '100%',
                padding: '8px 12px',
                fontSize: '12px',
                background: 'var(--bg-secondary)',
                border: '1px solid var(--border-color)',
                borderRadius: '4px',
                color: 'var(--text-primary)',
              }}
            />
          </div>

          {/* Preview */}
          <div style={{
            marginBottom: '20px',
            padding: '12px',
            background: 'var(--bg-tertiary)',
            borderRadius: '4px',
            border: '1px solid var(--border-color)',
          }}>
            <div style={{ fontSize: '11px', color: 'var(--text-secondary)', marginBottom: '4px' }}>
              New column name:
            </div>
            <div style={{ fontSize: '13px', color: 'var(--cyan)', fontFamily: 'monospace' }}>
              {getPreviewName()}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div style={{
          padding: '12px 20px',
          borderTop: '1px solid var(--border-color)',
          display: 'flex',
          justifyContent: 'flex-end',
          gap: '12px',
        }}>
          <button
            onClick={onClose}
            disabled={loading}
            style={{ padding: '8px 16px', fontSize: '12px' }}
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={loading}
            style={{
              padding: '8px 16px',
              fontSize: '12px',
              background: 'var(--cyan)',
              color: 'var(--bg-primary)',
              border: 'none',
            }}
          >
            {loading ? 'Adding...' : 'Add Feature'}
          </button>
        </div>
      </div>
    </div>
  );
}
