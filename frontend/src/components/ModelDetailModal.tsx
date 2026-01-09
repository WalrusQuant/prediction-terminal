import { useState } from 'react';
import {
  ScatterChart,
  Scatter,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  BarChart,
  Bar,
  Cell,
  ReferenceLine,
  LabelList,
} from 'recharts';
import { useKeyboardShortcuts } from '../hooks/useKeyboardShortcuts';

interface TestComparison {
  actual: number;
  predicted: number;
}

interface ResidualDistribution {
  range: string;
  count: number;
}

interface FeatureImportance {
  feature: string;
  importance: number;
}

interface CVResult {
  fold: number;
  train_samples: number;
  test_samples: number;
  r2_score: number;
  rmse: number;
  mae: number;
}

interface ModelDetail {
  id: string;
  name: string;
  model_type: string;
  features: string[];
  target: string;
  status: string;
  metrics?: {
    r2_score: number;
    mse: number;
    mae: number;
    rmse: number;
    train_r2?: number;
    train_samples?: number;
    test_samples?: number;
  };
  created_at: string;
  test_comparison: TestComparison[];
  residual_distribution: ResidualDistribution[];
  feature_importance: FeatureImportance[];
  split_type?: string;
  date_column?: string;
  cv_results?: CVResult[];
  std_metrics?: {
    r2_score: number;
    rmse: number;
    mae: number;
  };
}

interface ModelDetailModalProps {
  model: ModelDetail;
  onClose: () => void;
}

const MODEL_TYPE_LABELS: Record<string, string> = {
  linear_regression: 'Linear Regression',
  random_forest: 'Random Forest',
  xgboost: 'XGBoost',
};

const SPLIT_TYPE_LABELS: Record<string, string> = {
  random: 'Random Split',
  time_based: 'Time-Based Split',
  walk_forward: 'Walk-Forward CV',
};

export function ModelDetailModal({ model, onClose }: ModelDetailModalProps) {
  // Keyboard shortcuts
  useKeyboardShortcuts({ onEscape: onClose });

  // Feature importance chart controls
  const [sortOrder, setSortOrder] = useState<'desc' | 'asc'>('desc');
  const [topN, setTopN] = useState<number>(10);

  const metrics = model.metrics;

  // Calculate perfect line for scatter plot
  const scatterData = model.test_comparison || [];
  const minVal = scatterData.length > 0
    ? Math.min(...scatterData.map(d => Math.min(d.actual, d.predicted)))
    : 0;
  const maxVal = scatterData.length > 0
    ? Math.max(...scatterData.map(d => Math.max(d.actual, d.predicted)))
    : 100;
  const padding = (maxVal - minVal) * 0.1;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content terminal-panel" onClick={e => e.stopPropagation()}>
        <div className="terminal-panel-header modal-header">
          <span>{model.name} - Model Details</span>
          <button onClick={onClose} style={{ padding: '4px 12px', fontSize: '11px' }}>
            Close
          </button>
        </div>

        <div style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '24px' }}>
          {/* Model Summary */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
            <div>
              <h3 style={{
                fontSize: '11px',
                color: 'var(--cyan)',
                textTransform: 'uppercase',
                letterSpacing: '0.5px',
                marginBottom: '12px'
              }}>
                Model Configuration
              </h3>
              <div style={{
                background: 'var(--bg-tertiary)',
                padding: '16px',
                borderRadius: '4px',
                border: '1px solid var(--border-color)'
              }}>
                <div style={{ display: 'grid', gap: '8px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ color: 'var(--text-secondary)' }}>Type:</span>
                    <span className="text-cyan">{MODEL_TYPE_LABELS[model.model_type] || model.model_type}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ color: 'var(--text-secondary)' }}>Target:</span>
                    <span className="text-cyan">{model.target}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ color: 'var(--text-secondary)' }}>Features:</span>
                    <span>{model.features?.length || 0}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ color: 'var(--text-secondary)' }}>Validation:</span>
                    <span className={model.split_type === 'walk_forward' ? 'text-cyan' : ''}>
                      {SPLIT_TYPE_LABELS[model.split_type || 'random'] || model.split_type}
                    </span>
                  </div>
                  {model.date_column && (
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span style={{ color: 'var(--text-secondary)' }}>Date Column:</span>
                      <span>{model.date_column}</span>
                    </div>
                  )}
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ color: 'var(--text-secondary)' }}>Status:</span>
                    <span className={model.status === 'trained' ? 'text-green' : 'text-yellow'}>
                      {model.status}
                    </span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ color: 'var(--text-secondary)' }}>Created:</span>
                    <span>{new Date(model.created_at).toLocaleDateString()}</span>
                  </div>
                </div>
              </div>
            </div>

            <div>
              <h3 style={{
                fontSize: '11px',
                color: 'var(--cyan)',
                textTransform: 'uppercase',
                letterSpacing: '0.5px',
                marginBottom: '12px'
              }}>
                Performance Metrics
              </h3>
              <div style={{
                background: 'var(--bg-tertiary)',
                padding: '16px',
                borderRadius: '4px',
                border: '1px solid var(--border-color)'
              }}>
                <div style={{ display: 'grid', gap: '8px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ color: 'var(--text-secondary)' }}>R² Score:</span>
                    <span className={metrics?.r2_score && metrics.r2_score > 0.7 ? 'text-green' : metrics?.r2_score && metrics.r2_score > 0.5 ? 'text-yellow' : 'text-red'}>
                      {metrics?.r2_score?.toFixed(4) || 'N/A'}
                    </span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ color: 'var(--text-secondary)' }}>Train R²:</span>
                    <span className="text-cyan">{metrics?.train_r2?.toFixed(4) || 'N/A'}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ color: 'var(--text-secondary)' }}>RMSE:</span>
                    <span className="text-yellow">{metrics?.rmse?.toFixed(4) || 'N/A'}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ color: 'var(--text-secondary)' }}>MAE:</span>
                    <span className="text-yellow">{metrics?.mae?.toFixed(4) || 'N/A'}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ color: 'var(--text-secondary)' }}>MSE:</span>
                    <span style={{ color: 'var(--text-secondary)' }}>{metrics?.mse?.toFixed(4) || 'N/A'}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ color: 'var(--text-secondary)' }}>Train/Test Split:</span>
                    <span>{metrics?.train_samples || '?'} / {metrics?.test_samples || '?'}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Metrics Explanation */}
          <div style={{
            background: 'var(--bg-tertiary)',
            padding: '12px 16px',
            borderRadius: '4px',
            border: '1px solid var(--border-color)',
            fontSize: '11px',
            color: 'var(--text-muted)'
          }}>
            <strong style={{ color: 'var(--text-secondary)' }}>Metrics Guide:</strong>
            <span> R² measures how well the model explains variance (1.0 = perfect). </span>
            <span>RMSE/MAE measure average prediction error in target units (lower = better). </span>
            <span>Train R² higher than Test R² may indicate overfitting.</span>
          </div>

          {/* CV Results Section (for walk-forward) */}
          {model.cv_results && model.cv_results.length > 0 && (
            <div>
              <h3 style={{
                fontSize: '11px',
                color: 'var(--cyan)',
                textTransform: 'uppercase',
                letterSpacing: '0.5px',
                marginBottom: '12px'
              }}>
                Cross-Validation Results ({model.cv_results.length} Folds)
              </h3>
              <div style={{
                background: 'var(--bg-tertiary)',
                padding: '16px',
                borderRadius: '4px',
                border: '1px solid var(--border-color)',
                overflowX: 'auto'
              }}>
                <table className="terminal-table" style={{ marginBottom: '16px' }}>
                  <thead>
                    <tr>
                      <th>Fold</th>
                      <th>Train</th>
                      <th>Test</th>
                      <th>R²</th>
                      <th>RMSE</th>
                      <th>MAE</th>
                    </tr>
                  </thead>
                  <tbody>
                    {model.cv_results.map((fold) => (
                      <tr key={fold.fold}>
                        <td>{fold.fold}</td>
                        <td>{fold.train_samples.toLocaleString()}</td>
                        <td>{fold.test_samples.toLocaleString()}</td>
                        <td className={fold.r2_score > 0.7 ? 'text-green' : fold.r2_score > 0.5 ? 'text-yellow' : 'text-red'}>
                          {fold.r2_score.toFixed(4)}
                        </td>
                        <td className="text-yellow">{fold.rmse.toFixed(4)}</td>
                        <td className="text-yellow">{fold.mae.toFixed(4)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>

                {model.std_metrics && (
                  <div style={{
                    display: 'flex',
                    gap: '24px',
                    padding: '12px',
                    background: 'var(--bg-secondary)',
                    borderRadius: '4px',
                    fontSize: '11px'
                  }}>
                    <div>
                      <span style={{ color: 'var(--text-secondary)' }}>Mean R²: </span>
                      <span className="text-cyan">{metrics?.r2_score.toFixed(4)}</span>
                      <span style={{ color: 'var(--text-muted)' }}> ± {model.std_metrics.r2_score.toFixed(4)}</span>
                    </div>
                    <div>
                      <span style={{ color: 'var(--text-secondary)' }}>Mean RMSE: </span>
                      <span className="text-yellow">{metrics?.rmse.toFixed(4)}</span>
                      <span style={{ color: 'var(--text-muted)' }}> ± {model.std_metrics.rmse.toFixed(4)}</span>
                    </div>
                    <div>
                      <span style={{ color: 'var(--text-secondary)' }}>Mean MAE: </span>
                      <span className="text-yellow">{metrics?.mae.toFixed(4)}</span>
                      <span style={{ color: 'var(--text-muted)' }}> ± {model.std_metrics.mae.toFixed(4)}</span>
                    </div>
                  </div>
                )}
              </div>
              <div style={{ fontSize: '10px', color: 'var(--text-muted)', marginTop: '8px' }}>
                Walk-forward CV trains on earlier data and tests on later data, preventing data leakage.
              </div>
            </div>
          )}

          {/* Charts Row */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
            {/* Actual vs Predicted Scatter Plot */}
            <div>
              <h3 style={{
                fontSize: '11px',
                color: 'var(--cyan)',
                textTransform: 'uppercase',
                letterSpacing: '0.5px',
                marginBottom: '12px'
              }}>
                Actual vs Predicted
              </h3>
              <div style={{
                background: 'var(--bg-tertiary)',
                padding: '16px',
                borderRadius: '4px',
                border: '1px solid var(--border-color)',
                height: '300px'
              }}>
                {scatterData.length > 0 ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <ScatterChart margin={{ top: 10, right: 10, bottom: 30, left: 10 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="var(--border-color)" />
                      <XAxis
                        dataKey="actual"
                        type="number"
                        domain={[minVal - padding, maxVal + padding]}
                        name="Actual"
                        tick={{ fill: 'var(--text-secondary)', fontSize: 10 }}
                        label={{ value: 'Actual', position: 'bottom', fill: 'var(--text-secondary)', fontSize: 11 }}
                      />
                      <YAxis
                        dataKey="predicted"
                        type="number"
                        domain={[minVal - padding, maxVal + padding]}
                        name="Predicted"
                        tick={{ fill: 'var(--text-secondary)', fontSize: 10 }}
                        label={{ value: 'Predicted', angle: -90, position: 'insideLeft', fill: 'var(--text-secondary)', fontSize: 11 }}
                      />
                      <Tooltip
                        contentStyle={{
                          background: 'var(--bg-secondary)',
                          border: '1px solid var(--border-color)',
                          borderRadius: '4px',
                          fontSize: '11px',
                          color: 'var(--text-primary)',
                        }}
                        formatter={(value) => typeof value === 'number' ? value.toFixed(2) : value}
                      />
                      <ReferenceLine
                        segment={[{ x: minVal - padding, y: minVal - padding }, { x: maxVal + padding, y: maxVal + padding }]}
                        stroke="var(--cyan)"
                        strokeDasharray="5 5"
                        strokeWidth={2}
                      />
                      <Scatter data={scatterData} fill="var(--green)" opacity={0.7} />
                    </ScatterChart>
                  </ResponsiveContainer>
                ) : (
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: 'var(--text-muted)' }}>
                    No test data available
                  </div>
                )}
              </div>
              <div style={{ fontSize: '10px', color: 'var(--text-muted)', marginTop: '8px' }}>
                Points on the dashed line = perfect predictions. Spread indicates prediction error.
              </div>
            </div>

            {/* Residual Distribution */}
            <div>
              <h3 style={{
                fontSize: '11px',
                color: 'var(--cyan)',
                textTransform: 'uppercase',
                letterSpacing: '0.5px',
                marginBottom: '12px'
              }}>
                Error Distribution (Residuals)
              </h3>
              <div style={{
                background: 'var(--bg-tertiary)',
                padding: '16px',
                borderRadius: '4px',
                border: '1px solid var(--border-color)',
                height: '300px'
              }}>
                {model.residual_distribution?.length > 0 ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={model.residual_distribution} margin={{ top: 10, right: 10, bottom: 30, left: 10 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="var(--border-color)" />
                      <XAxis
                        dataKey="range"
                        tick={{ fill: 'var(--text-secondary)', fontSize: 9 }}
                        angle={-45}
                        textAnchor="end"
                        height={60}
                        label={{ value: 'Error Range', position: 'bottom', fill: 'var(--text-secondary)', fontSize: 11, offset: -10 }}
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
                          color: 'var(--text-primary)',
                        }}
                      />
                      <Bar dataKey="count" fill="var(--yellow)" />
                    </BarChart>
                  </ResponsiveContainer>
                ) : (
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: 'var(--text-muted)' }}>
                    No residual data available
                  </div>
                )}
              </div>
              <div style={{ fontSize: '10px', color: 'var(--text-muted)', marginTop: '8px' }}>
                Residuals = Actual - Predicted. Ideal: centered at 0, normally distributed.
              </div>
            </div>
          </div>

          {/* Feature Importance */}
          {model.feature_importance?.length > 0 && (() => {
            // Prepare sorted data
            const sortedFeatures = [...model.feature_importance]
              .sort((a, b) => sortOrder === 'desc'
                ? b.importance - a.importance
                : a.importance - b.importance)
              .slice(0, topN)
              .map(item => ({
                ...item,
                percentage: (item.importance * 100).toFixed(1) + '%'
              }));

            const totalFeatures = model.feature_importance.length;
            const topNOptions = [5, 10, 15, 20].filter(n => n <= totalFeatures);
            if (!topNOptions.includes(totalFeatures) && totalFeatures > 0) {
              topNOptions.push(totalFeatures);
            }

            return (
              <div>
                <div style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  marginBottom: '12px'
                }}>
                  <h3 style={{
                    fontSize: '11px',
                    color: 'var(--cyan)',
                    textTransform: 'uppercase',
                    letterSpacing: '0.5px',
                    margin: 0
                  }}>
                    Feature Importance
                  </h3>
                  <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                    <select
                      value={topN}
                      onChange={(e) => setTopN(Number(e.target.value))}
                      style={{
                        padding: '4px 8px',
                        fontSize: '11px',
                        background: 'var(--bg-secondary)',
                        border: '1px solid var(--border-color)',
                        borderRadius: '4px',
                        color: 'var(--text-primary)',
                        cursor: 'pointer'
                      }}
                    >
                      {topNOptions.map(n => (
                        <option key={n} value={n}>Top {n}</option>
                      ))}
                    </select>
                    <button
                      onClick={() => setSortOrder(prev => prev === 'desc' ? 'asc' : 'desc')}
                      style={{
                        padding: '4px 8px',
                        fontSize: '11px',
                        background: 'var(--bg-secondary)',
                        border: '1px solid var(--border-color)',
                        borderRadius: '4px',
                        color: 'var(--text-primary)',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '4px'
                      }}
                      title={sortOrder === 'desc' ? 'Showing highest first' : 'Showing lowest first'}
                    >
                      {sortOrder === 'desc' ? '↓ High→Low' : '↑ Low→High'}
                    </button>
                  </div>
                </div>
                <div style={{
                  background: 'var(--bg-tertiary)',
                  padding: '16px',
                  borderRadius: '4px',
                  border: '1px solid var(--border-color)',
                  height: Math.min(400, sortedFeatures.length * 32 + 40)
                }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart
                      data={sortedFeatures}
                      layout="vertical"
                      margin={{ top: 5, right: 60, left: 100, bottom: 5 }}
                    >
                      <CartesianGrid strokeDasharray="3 3" stroke="var(--border-color)" />
                      <XAxis
                        type="number"
                        domain={[0, 'auto']}
                        tick={{ fill: 'var(--text-secondary)', fontSize: 10 }}
                        tickFormatter={(value) => `${(value * 100).toFixed(0)}%`}
                      />
                      <YAxis
                        dataKey="feature"
                        type="category"
                        tick={{ fill: 'var(--text-primary)', fontSize: 11 }}
                        width={90}
                      />
                      <Tooltip
                        contentStyle={{
                          background: 'var(--bg-secondary)',
                          border: '1px solid var(--border-color)',
                          borderRadius: '4px',
                          fontSize: '11px',
                          color: 'var(--text-primary)',
                        }}
                        formatter={(value) => typeof value === 'number' ? [(value * 100).toFixed(2) + '%', 'Importance'] : value}
                      />
                      <Bar dataKey="importance" radius={[0, 4, 4, 0]}>
                        {sortedFeatures.map((entry, index) => {
                          // Color based on importance value, not index
                          const maxImportance = Math.max(...model.feature_importance.map(f => f.importance));
                          const ratio = entry.importance / maxImportance;
                          const isTop = ratio > 0.8;
                          const isMid = ratio > 0.5;
                          return (
                            <Cell
                              key={`cell-${index}`}
                              fill={isTop ? 'var(--cyan)' : isMid ? 'var(--green)' : 'var(--text-secondary)'}
                            />
                          );
                        })}
                        <LabelList
                          dataKey="percentage"
                          position="right"
                          fill="var(--text-secondary)"
                          fontSize={10}
                        />
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
                <div style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  fontSize: '10px',
                  color: 'var(--text-muted)',
                  marginTop: '8px'
                }}>
                  <span>
                    {model.model_type === 'linear_regression'
                      ? 'Relative coefficient magnitude (normalized). Higher = more impact on predictions.'
                      : 'Feature importance from model. Higher = more impact on predictions.'}
                  </span>
                  <span>Showing {sortedFeatures.length} of {totalFeatures} features</span>
                </div>
              </div>
            );
          })()}

          {/* Features List */}
          <div>
            <h3 style={{
              fontSize: '11px',
              color: 'var(--cyan)',
              textTransform: 'uppercase',
              letterSpacing: '0.5px',
              marginBottom: '12px'
            }}>
              Input Features ({model.features?.length || 0})
            </h3>
            <div style={{
              display: 'flex',
              flexWrap: 'wrap',
              gap: '8px',
              padding: '12px',
              background: 'var(--bg-tertiary)',
              borderRadius: '4px',
              border: '1px solid var(--border-color)'
            }}>
              {model.features?.map(feature => (
                <span
                  key={feature}
                  style={{
                    padding: '4px 10px',
                    fontSize: '11px',
                    background: 'var(--bg-secondary)',
                    border: '1px solid var(--border-color)',
                    borderRadius: '4px',
                    color: 'var(--text-primary)'
                  }}
                >
                  {feature}
                </span>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
