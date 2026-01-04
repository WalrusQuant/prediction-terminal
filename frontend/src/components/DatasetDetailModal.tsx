export interface ColumnStats {
  dtype: string;
  null_count: number;
  unique_count: number;
  min?: number;
  max?: number;
  mean?: number;
  std?: number;
}

export interface DatasetDetails {
  id: string;
  name: string;
  rows: number;
  columns: number;
  features: string[];
  column_types: Record<string, string>;
  preview: Record<string, unknown>[];
}

export interface StatsData {
  dataset_id: string;
  total_rows: number;
  total_columns: number;
  columns: Record<string, ColumnStats>;
}

interface DatasetDetailModalProps {
  dataset: DatasetDetails | null;
  stats: StatsData | null;
  onClose: () => void;
}

export function DatasetDetailModal({ dataset, stats, onClose }: DatasetDetailModalProps) {
  if (!dataset) return null;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content terminal-panel" onClick={e => e.stopPropagation()}>
        <div className="terminal-panel-header modal-header">
          <span>{dataset.name}</span>
          <button onClick={onClose} style={{ padding: '4px 12px', fontSize: '11px' }}>
            Close
          </button>
        </div>

        <div style={{ padding: '16px' }}>
          <div style={{ marginBottom: '16px', color: 'var(--text-secondary)' }}>
            <span className="text-cyan">{dataset.rows.toLocaleString()}</span> rows x{' '}
            <span className="text-cyan">{dataset.columns}</span> columns
          </div>

          <h3 style={{
            marginBottom: '12px',
            fontSize: '11px',
            color: 'var(--cyan)',
            textTransform: 'uppercase',
            letterSpacing: '0.5px'
          }}>
            Column Statistics
          </h3>

          <div style={{ overflowX: 'auto', marginBottom: '24px' }}>
            <table className="terminal-table">
              <thead>
                <tr>
                  <th>Column</th>
                  <th>Type</th>
                  <th>Nulls</th>
                  <th>Unique</th>
                  <th>Min</th>
                  <th>Max</th>
                  <th>Mean</th>
                </tr>
              </thead>
              <tbody>
                {dataset.features.map(col => {
                  const colStats = stats?.columns?.[col];
                  return (
                    <tr key={col}>
                      <td style={{ color: 'var(--text-primary)' }}>{col}</td>
                      <td style={{ color: 'var(--text-secondary)' }}>{colStats?.dtype || '-'}</td>
                      <td>
                        {colStats?.null_count ? (
                          <span className="text-yellow">{colStats.null_count}</span>
                        ) : (
                          <span className="text-green">0</span>
                        )}
                      </td>
                      <td style={{ color: 'var(--text-secondary)' }}>{colStats?.unique_count || '-'}</td>
                      <td className="text-cyan">
                        {colStats?.min !== undefined ? colStats.min.toFixed(2) : '-'}
                      </td>
                      <td className="text-cyan">
                        {colStats?.max !== undefined ? colStats.max.toFixed(2) : '-'}
                      </td>
                      <td className="text-cyan">
                        {colStats?.mean !== undefined ? colStats.mean.toFixed(2) : '-'}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <h3 style={{
            marginBottom: '12px',
            fontSize: '11px',
            color: 'var(--cyan)',
            textTransform: 'uppercase',
            letterSpacing: '0.5px'
          }}>
            Data Preview (First 10 Rows)
          </h3>

          <div style={{ overflowX: 'auto' }}>
            <table className="terminal-table">
              <thead>
                <tr>
                  {dataset.features.map(col => (
                    <th key={col}>{col}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {dataset.preview.slice(0, 10).map((row, i) => (
                  <tr key={i}>
                    {dataset.features.map(col => (
                      <td key={col} style={{
                        color: typeof row[col] === 'number' ? 'var(--cyan)' : 'var(--text-primary)',
                        maxWidth: '150px',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap'
                      }}>
                        {row[col] !== null && row[col] !== undefined
                          ? (typeof row[col] === 'number'
                              ? (row[col] as number).toLocaleString()
                              : String(row[col]))
                          : <span className="text-muted">null</span>
                        }
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
