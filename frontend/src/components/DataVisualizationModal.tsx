import { useState, useEffect } from 'react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ScatterChart,
  Scatter,
} from 'recharts';
import {
  fetchDatasetVisualization,
  type VisualizationData,
} from '../api/client';
import { useKeyboardShortcuts } from '../hooks/useKeyboardShortcuts';

interface DataVisualizationModalProps {
  datasetId: string;
  datasetName: string;
  onClose: () => void;
}

export function DataVisualizationModal({
  datasetId,
  datasetName,
  onClose,
}: DataVisualizationModalProps) {
  const [data, setData] = useState<VisualizationData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [activeTab, setActiveTab] = useState<'histograms' | 'scatter'>('histograms');
  const [selectedColumn, setSelectedColumn] = useState<string>('');
  const [selectedScatterIdx, setSelectedScatterIdx] = useState(0);

  useKeyboardShortcuts({ onEscape: onClose });

  useEffect(() => {
    loadVisualization();
  }, [datasetId]);

  const loadVisualization = async () => {
    setLoading(true);
    setError('');
    try {
      const vizData = await fetchDatasetVisualization(datasetId);
      setData(vizData);
      if (vizData.numeric_columns.length > 0) {
        setSelectedColumn(vizData.numeric_columns[0]);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load visualization');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="modal-overlay" onClick={onClose}>
        <div
          className="modal-content terminal-panel"
          onClick={(e) => e.stopPropagation()}
          style={{ maxWidth: '900px', width: '90%' }}
        >
          <div className="terminal-panel-header modal-header">
            <span>Visualize: {datasetName}</span>
            <button onClick={onClose} style={{ padding: '4px 12px', fontSize: '11px' }}>
              Close
            </button>
          </div>
          <div style={{ padding: '48px', textAlign: 'center', color: 'var(--text-muted)' }}>
            Loading visualization data...
          </div>
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="modal-overlay" onClick={onClose}>
        <div
          className="modal-content terminal-panel"
          onClick={(e) => e.stopPropagation()}
          style={{ maxWidth: '600px' }}
        >
          <div className="terminal-panel-header modal-header">
            <span>Visualize: {datasetName}</span>
            <button onClick={onClose} style={{ padding: '4px 12px', fontSize: '11px' }}>
              Close
            </button>
          </div>
          <div style={{ padding: '24px', color: 'var(--red)' }}>
            {error || 'Failed to load visualization data'}
          </div>
        </div>
      </div>
    );
  }

  const histogramData = selectedColumn ? data.histograms[selectedColumn] : null;
  const currentScatter = data.scatter_pairs[selectedScatterIdx];

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div
        className="modal-content terminal-panel"
        onClick={(e) => e.stopPropagation()}
        style={{ maxWidth: '1000px', width: '95%', maxHeight: '90vh', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}
      >
        <div className="terminal-panel-header modal-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
            <span>Visualize: {datasetName}</span>
            <div style={{ display: 'flex', gap: '4px' }}>
              <button
                onClick={() => setActiveTab('histograms')}
                style={{
                  padding: '4px 12px',
                  fontSize: '11px',
                  background: activeTab === 'histograms' ? 'var(--cyan)' : 'transparent',
                  color: activeTab === 'histograms' ? 'var(--bg-primary)' : 'var(--text-secondary)',
                  borderColor: activeTab === 'histograms' ? 'var(--cyan)' : 'var(--border-color)',
                }}
              >
                Histograms
              </button>
              <button
                onClick={() => setActiveTab('scatter')}
                style={{
                  padding: '4px 12px',
                  fontSize: '11px',
                  background: activeTab === 'scatter' ? 'var(--cyan)' : 'transparent',
                  color: activeTab === 'scatter' ? 'var(--bg-primary)' : 'var(--text-secondary)',
                  borderColor: activeTab === 'scatter' ? 'var(--cyan)' : 'var(--border-color)',
                }}
              >
                Scatter Plots
              </button>
            </div>
          </div>
          <button onClick={onClose} style={{ padding: '4px 12px', fontSize: '11px' }}>
            Close
          </button>
        </div>

        <div style={{ padding: '20px', flex: 1, overflowY: 'auto' }}>
          {activeTab === 'histograms' && (
            <div>
              {/* Column Selector */}
              <div style={{ marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '12px' }}>
                <span style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>Column:</span>
                <select
                  value={selectedColumn}
                  onChange={(e) => setSelectedColumn(e.target.value)}
                  style={{
                    padding: '6px 12px',
                    fontSize: '12px',
                    background: 'var(--bg-secondary)',
                    border: '1px solid var(--border-color)',
                    borderRadius: '4px',
                    color: 'var(--text-primary)',
                  }}
                >
                  {data.numeric_columns.map((col) => (
                    <option key={col} value={col}>
                      {col}
                    </option>
                  ))}
                </select>
              </div>

              {/* Histogram Chart */}
              {histogramData && histogramData.length > 0 ? (
                <div style={{
                  background: 'var(--bg-tertiary)',
                  padding: '16px',
                  borderRadius: '4px',
                  border: '1px solid var(--border-color)',
                }}>
                  <h3 style={{
                    fontSize: '13px',
                    color: 'var(--text-primary)',
                    marginBottom: '16px',
                  }}>
                    Distribution of {selectedColumn}
                  </h3>
                  <div style={{ height: '350px' }}>
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={histogramData} margin={{ top: 10, right: 20, bottom: 60, left: 40 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="var(--border-color)" />
                        <XAxis
                          dataKey="range"
                          tick={{ fill: 'var(--text-secondary)', fontSize: 9 }}
                          angle={-45}
                          textAnchor="end"
                          height={60}
                        />
                        <YAxis
                          tick={{ fill: 'var(--text-secondary)', fontSize: 10 }}
                          label={{ value: 'Count', angle: -90, position: 'insideLeft', fill: 'var(--text-secondary)', fontSize: 11 }}
                        />
                        <Tooltip
                          contentStyle={{
                            background: 'var(--bg-secondary)',
                            border: '1px solid var(--border-color)',
                            borderRadius: '4px',
                            fontSize: '11px',
                          }}
                          formatter={(value) => [typeof value === 'number' ? value.toLocaleString() : String(value), 'Count']}
                          labelFormatter={(label) => `Range: ${label}`}
                        />
                        <Bar dataKey="count" fill="var(--cyan)" radius={[2, 2, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>

                  {/* Quick stats */}
                  <div style={{
                    marginTop: '16px',
                    padding: '12px',
                    background: 'var(--bg-secondary)',
                    borderRadius: '4px',
                    display: 'flex',
                    gap: '24px',
                    fontSize: '11px',
                  }}>
                    <div>
                      <span style={{ color: 'var(--text-secondary)' }}>Min: </span>
                      <span className="text-cyan">{histogramData[0]?.min.toFixed(2)}</span>
                    </div>
                    <div>
                      <span style={{ color: 'var(--text-secondary)' }}>Max: </span>
                      <span className="text-cyan">{histogramData[histogramData.length - 1]?.max.toFixed(2)}</span>
                    </div>
                    <div>
                      <span style={{ color: 'var(--text-secondary)' }}>Bins: </span>
                      <span>{histogramData.length}</span>
                    </div>
                    <div>
                      <span style={{ color: 'var(--text-secondary)' }}>Total: </span>
                      <span>{histogramData.reduce((sum, b) => sum + b.count, 0).toLocaleString()}</span>
                    </div>
                  </div>
                </div>
              ) : (
                <div style={{ padding: '48px', textAlign: 'center', color: 'var(--text-muted)' }}>
                  No histogram data available for this column
                </div>
              )}
            </div>
          )}

          {activeTab === 'scatter' && (
            <div>
              {data.scatter_pairs.length === 0 ? (
                <div style={{ padding: '48px', textAlign: 'center', color: 'var(--text-muted)' }}>
                  Need at least 2 numeric columns for scatter plots
                </div>
              ) : (
                <>
                  {/* Pair Selector */}
                  <div style={{ marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <span style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>Column Pair:</span>
                    <select
                      value={selectedScatterIdx}
                      onChange={(e) => setSelectedScatterIdx(Number(e.target.value))}
                      style={{
                        padding: '6px 12px',
                        fontSize: '12px',
                        background: 'var(--bg-secondary)',
                        border: '1px solid var(--border-color)',
                        borderRadius: '4px',
                        color: 'var(--text-primary)',
                      }}
                    >
                      {data.scatter_pairs.map((pair, idx) => (
                        <option key={idx} value={idx}>
                          {pair.x_column} vs {pair.y_column}
                        </option>
                      ))}
                    </select>
                    <span style={{ fontSize: '10px', color: 'var(--text-muted)' }}>
                      {currentScatter?.data.length.toLocaleString()} points
                      {currentScatter?.data.length === 500 && ' (sampled)'}
                    </span>
                  </div>

                  {/* Scatter Chart */}
                  {currentScatter && (
                    <div style={{
                      background: 'var(--bg-tertiary)',
                      padding: '16px',
                      borderRadius: '4px',
                      border: '1px solid var(--border-color)',
                    }}>
                      <h3 style={{
                        fontSize: '13px',
                        color: 'var(--text-primary)',
                        marginBottom: '16px',
                      }}>
                        {currentScatter.x_column} vs {currentScatter.y_column}
                      </h3>
                      <div style={{ height: '400px' }}>
                        <ResponsiveContainer width="100%" height="100%">
                          <ScatterChart margin={{ top: 10, right: 20, bottom: 40, left: 40 }}>
                            <CartesianGrid strokeDasharray="3 3" stroke="var(--border-color)" />
                            <XAxis
                              dataKey="x"
                              type="number"
                              name={currentScatter.x_column}
                              tick={{ fill: 'var(--text-secondary)', fontSize: 10 }}
                              label={{ value: currentScatter.x_column, position: 'bottom', fill: 'var(--text-secondary)', fontSize: 11 }}
                            />
                            <YAxis
                              dataKey="y"
                              type="number"
                              name={currentScatter.y_column}
                              tick={{ fill: 'var(--text-secondary)', fontSize: 10 }}
                              label={{ value: currentScatter.y_column, angle: -90, position: 'insideLeft', fill: 'var(--text-secondary)', fontSize: 11 }}
                            />
                            <Tooltip
                              contentStyle={{
                                background: 'var(--bg-secondary)',
                                border: '1px solid var(--border-color)',
                                borderRadius: '4px',
                                fontSize: '11px',
                              }}
                              formatter={(value, name) => [typeof value === 'number' ? value.toFixed(2) : String(value), name]}
                            />
                            <Scatter
                              data={currentScatter.data}
                              fill="var(--green)"
                              opacity={0.6}
                            />
                          </ScatterChart>
                        </ResponsiveContainer>
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>
          )}
        </div>

        <div style={{
          padding: '12px 16px',
          borderTop: '1px solid var(--border-color)',
          fontSize: '10px',
          color: 'var(--text-muted)',
        }}>
          Visualizing {data.numeric_columns.length} numeric columns.
          {activeTab === 'scatter' && ' Scatter plots are limited to the first 5 columns and sampled to 500 points.'}
        </div>
      </div>
    </div>
  );
}
