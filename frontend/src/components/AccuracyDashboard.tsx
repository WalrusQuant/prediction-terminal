import { useState, useEffect } from 'react';
import { fetchAccuracyStats, type AccuracyStats } from '../api/client';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts';

interface AccuracyDashboardProps {
  onClose: () => void;
}

export function AccuracyDashboard({ onClose }: AccuracyDashboardProps) {
  const [stats, setStats] = useState<AccuracyStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    loadStats();
  }, []);

  const loadStats = async () => {
    setLoading(true);
    try {
      const result = await fetchAccuracyStats();
      setStats(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load accuracy stats');
    } finally {
      setLoading(false);
    }
  };

  const modelData = stats?.by_model ? Object.entries(stats.by_model).map(([name, data]) => ({
    name: name.length > 15 ? name.slice(0, 15) + '...' : name,
    fullName: name,
    mae: data.mae,
    rmse: data.rmse,
    count: data.count,
  })) : [];

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content terminal-panel" onClick={e => e.stopPropagation()} style={{ maxWidth: '700px' }}>
        <div className="terminal-panel-header modal-header">
          <span>Prediction Accuracy Dashboard</span>
          <button onClick={onClose} style={{ padding: '4px 12px', fontSize: '11px' }}>
            Close
          </button>
        </div>

        <div style={{ padding: '16px' }}>
          {loading ? (
            <div style={{ textAlign: 'center', padding: '24px', color: 'var(--text-muted)' }}>
              Loading accuracy statistics...
            </div>
          ) : error ? (
            <div style={{
              padding: '12px',
              background: 'rgba(255, 71, 87, 0.1)',
              border: '1px solid var(--red)',
              borderRadius: '4px',
              color: 'var(--red)',
            }}>
              {error}
            </div>
          ) : !stats || stats.predictions_with_actuals === 0 ? (
            <div style={{ textAlign: 'center', padding: '24px', color: 'var(--text-muted)' }}>
              No predictions with actual values yet. Add actual values to your predictions to see accuracy stats.
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
              {/* Overall Stats */}
              <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(4, 1fr)',
                gap: '12px',
              }}>
                <StatCard
                  label="Predictions Tracked"
                  value={`${stats.predictions_with_actuals} / ${stats.total_predictions}`}
                  subtext={`${((stats.predictions_with_actuals / stats.total_predictions) * 100).toFixed(0)}% tracked`}
                />
                <StatCard
                  label="MAE"
                  value={stats.mae?.toFixed(2) || '—'}
                  subtext="Mean Absolute Error"
                  highlight
                />
                <StatCard
                  label="RMSE"
                  value={stats.rmse?.toFixed(2) || '—'}
                  subtext="Root Mean Sq Error"
                  highlight
                />
                <StatCard
                  label="Avg Error %"
                  value={stats.avg_percent_error !== null ? `${stats.avg_percent_error.toFixed(1)}%` : '—'}
                  subtext="Mean Percent Error"
                />
              </div>

              {/* Per-Model Comparison */}
              {modelData.length > 0 && (
                <div>
                  <h3 style={{
                    margin: '0 0 12px 0',
                    fontSize: '12px',
                    color: 'var(--text-secondary)',
                    textTransform: 'uppercase',
                    letterSpacing: '0.5px',
                  }}>
                    Accuracy by Model
                  </h3>
                  <div style={{ height: '200px' }}>
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={modelData} layout="vertical" margin={{ left: 10, right: 20 }}>
                        <XAxis type="number" tick={{ fill: 'var(--text-secondary)', fontSize: 10 }} />
                        <YAxis
                          type="category"
                          dataKey="name"
                          tick={{ fill: 'var(--text-secondary)', fontSize: 10 }}
                          width={100}
                        />
                        <Tooltip
                          content={({ payload }) => {
                            if (!payload || payload.length === 0) return null;
                            const data = payload[0].payload;
                            return (
                              <div style={{
                                background: 'var(--bg-secondary)',
                                border: '1px solid var(--border-color)',
                                padding: '8px 12px',
                                borderRadius: '4px',
                                fontSize: '11px',
                              }}>
                                <div style={{ fontWeight: 'bold', marginBottom: '4px' }}>{data.fullName}</div>
                                <div>MAE: {data.mae.toFixed(2)}</div>
                                <div>RMSE: {data.rmse.toFixed(2)}</div>
                                <div style={{ color: 'var(--text-muted)' }}>{data.count} predictions</div>
                              </div>
                            );
                          }}
                        />
                        <Bar dataKey="mae" name="MAE" radius={[0, 4, 4, 0]}>
                          {modelData.map((_, index) => (
                            <Cell
                              key={`cell-${index}`}
                              fill={index % 2 === 0 ? 'var(--cyan)' : 'var(--green)'}
                            />
                          ))}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              )}

              {/* Model Details Table */}
              {modelData.length > 0 && (
                <div>
                  <h3 style={{
                    margin: '0 0 12px 0',
                    fontSize: '12px',
                    color: 'var(--text-secondary)',
                    textTransform: 'uppercase',
                    letterSpacing: '0.5px',
                  }}>
                    Model Details
                  </h3>
                  <table className="terminal-table">
                    <thead>
                      <tr>
                        <th>Model</th>
                        <th>Predictions</th>
                        <th>MAE</th>
                        <th>RMSE</th>
                      </tr>
                    </thead>
                    <tbody>
                      {modelData.map((model) => (
                        <tr key={model.fullName}>
                          <td>{model.fullName}</td>
                          <td className="text-cyan">{model.count}</td>
                          <td style={{ color: 'var(--yellow)' }}>{model.mae.toFixed(3)}</td>
                          <td style={{ color: 'var(--yellow)' }}>{model.rmse.toFixed(3)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              {/* Legend */}
              <div style={{
                padding: '12px',
                background: 'var(--bg-tertiary)',
                borderRadius: '4px',
                fontSize: '11px',
                color: 'var(--text-muted)',
              }}>
                <strong>Metrics:</strong> MAE (Mean Absolute Error) = average of absolute differences between predicted and actual values.
                RMSE (Root Mean Squared Error) = penalizes larger errors more heavily.
                Lower values indicate better accuracy.
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function StatCard({ label, value, subtext, highlight }: { label: string; value: string; subtext: string; highlight?: boolean }) {
  return (
    <div style={{
      padding: '12px',
      background: highlight ? 'rgba(0, 212, 170, 0.05)' : 'var(--bg-tertiary)',
      borderRadius: '4px',
      border: highlight ? '1px solid var(--cyan)' : '1px solid var(--border-color)',
    }}>
      <div style={{
        fontSize: '10px',
        color: 'var(--text-muted)',
        textTransform: 'uppercase',
        marginBottom: '4px',
      }}>
        {label}
      </div>
      <div style={{
        fontSize: '20px',
        fontWeight: 'bold',
        color: highlight ? 'var(--cyan)' : 'var(--text-primary)',
        marginBottom: '2px',
      }}>
        {value}
      </div>
      <div style={{
        fontSize: '9px',
        color: 'var(--text-muted)',
      }}>
        {subtext}
      </div>
    </div>
  );
}
