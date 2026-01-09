import { useState } from 'react';
import { useKeyboardShortcuts } from '../hooks/useKeyboardShortcuts';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from 'recharts';

interface Model {
  id: string;
  name: string;
  model_type: string;
  features: string[];
  target: string;
  metrics?: {
    r2_score: number;
    rmse: number;
    mae: number;
    mse: number;
  };
}

interface ModelCompareModalProps {
  models: Model[];
  onClose: () => void;
}

const MODEL_TYPE_LABELS: Record<string, string> = {
  linear_regression: 'Linear Regression',
  random_forest: 'Random Forest',
  xgboost: 'XGBoost',
};

export function ModelCompareModal({ models, onClose }: ModelCompareModalProps) {
  const [model1Id, setModel1Id] = useState<string>('');
  const [model2Id, setModel2Id] = useState<string>('');

  useKeyboardShortcuts({ onEscape: onClose });

  const model1 = models.find(m => m.id === model1Id);
  const model2 = models.find(m => m.id === model2Id);

  const canCompare = model1 && model2 && model1.id !== model2.id;

  // Create unique display labels for chart (handles same-name models)
  const model1Label = model1
    ? (model1.name === model2?.name
        ? `${model1.name} (${MODEL_TYPE_LABELS[model1.model_type] || model1.model_type})`
        : model1.name)
    : '';
  const model2Label = model2
    ? (model2.name === model1?.name
        ? `${model2.name} (${MODEL_TYPE_LABELS[model2.model_type] || model2.model_type})`
        : model2.name)
    : '';

  // Prepare comparison data for charts
  const metricsComparison = canCompare && model1.metrics && model2.metrics ? [
    {
      metric: 'R² Score',
      [model1Label]: model1.metrics.r2_score,
      [model2Label]: model2.metrics.r2_score,
    },
    {
      metric: 'RMSE',
      [model1Label]: model1.metrics.rmse,
      [model2Label]: model2.metrics.rmse,
    },
    {
      metric: 'MAE',
      [model1Label]: model1.metrics.mae,
      [model2Label]: model2.metrics.mae,
    },
  ] : [];

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div
        className="modal-content terminal-panel"
        onClick={e => e.stopPropagation()}
        style={{ maxWidth: '1000px', width: '95%', maxHeight: '90vh', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}
      >
        <div className="terminal-panel-header modal-header">
          <span>Compare Models</span>
          <button onClick={onClose} style={{ padding: '4px 12px', fontSize: '11px' }}>
            Close
          </button>
        </div>

        <div style={{ padding: '16px', overflowY: 'auto', flex: 1 }}>
          {/* Model Selection */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: '1fr 1fr',
            gap: '16px',
            marginBottom: '24px'
          }}>
            <div>
              <label style={{
                display: 'block',
                marginBottom: '8px',
                color: 'var(--text-secondary)',
                fontSize: '11px',
                textTransform: 'uppercase'
              }}>
                Model 1
              </label>
              <select
                value={model1Id}
                onChange={e => {
                  const newModel1 = models.find(m => m.id === e.target.value);
                  const currentModel2 = models.find(m => m.id === model2Id);
                  // Clear model2 if it has a different target than the new model1
                  if (currentModel2 && newModel1 && currentModel2.target !== newModel1.target) {
                    setModel2Id('');
                  }
                  setModel1Id(e.target.value);
                }}
                style={{ width: '100%' }}
              >
                <option value="">-- Select Model --</option>
                {models.filter(m => m.metrics).map(m => (
                  <option key={m.id} value={m.id} disabled={m.id === model2Id}>
                    {m.name} ({MODEL_TYPE_LABELS[m.model_type] || m.model_type})
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label style={{
                display: 'block',
                marginBottom: '8px',
                color: 'var(--text-secondary)',
                fontSize: '11px',
                textTransform: 'uppercase'
              }}>
                Model 2 {model1 && <span style={{ color: 'var(--text-muted)' }}>(same target: {model1.target})</span>}
              </label>
              <select
                value={model2Id}
                onChange={e => setModel2Id(e.target.value)}
                style={{ width: '100%' }}
                disabled={!model1}
              >
                <option value="">{model1 ? '-- Select Model --' : '-- Select Model 1 first --'}</option>
                {models
                  .filter(m => m.metrics && m.id !== model1Id && (!model1 || m.target === model1.target))
                  .map(m => (
                  <option key={m.id} value={m.id}>
                    {m.name} ({MODEL_TYPE_LABELS[m.model_type] || m.model_type})
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Comparison Results */}
          {canCompare ? (
            <>
              {/* Side-by-side model info */}
              <div style={{
                display: 'grid',
                gridTemplateColumns: '1fr 1fr',
                gap: '16px',
                marginBottom: '24px'
              }}>
                {[model1, model2].map((model, idx) => (
                  <div
                    key={model.id}
                    style={{
                      padding: '16px',
                      background: 'var(--bg-tertiary)',
                      borderRadius: '4px',
                      border: `2px solid ${idx === 0 ? 'var(--cyan)' : 'var(--yellow)'}`
                    }}
                  >
                    <div style={{ fontSize: '14px', fontWeight: 'bold', marginBottom: '8px', color: idx === 0 ? 'var(--cyan)' : 'var(--yellow)' }}>
                      {model.name}
                    </div>
                    <div style={{ fontSize: '11px', color: 'var(--text-secondary)', marginBottom: '4px' }}>
                      Type: {MODEL_TYPE_LABELS[model.model_type] || model.model_type}
                    </div>
                    <div style={{ fontSize: '11px', color: 'var(--text-secondary)', marginBottom: '4px' }}>
                      Target: {model.target}
                    </div>
                    <div style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>
                      Features: {model.features.length}
                    </div>
                  </div>
                ))}
              </div>

              {/* Metrics Table */}
              <div style={{ marginBottom: '24px' }}>
                <h3 style={{ fontSize: '13px', marginBottom: '12px', color: 'var(--text-secondary)' }}>
                  Metrics Comparison
                </h3>
                <table className="terminal-table">
                  <thead>
                    <tr>
                      <th>Metric</th>
                      <th style={{ color: 'var(--cyan)' }}>{model1.name}</th>
                      <th style={{ color: 'var(--yellow)' }}>{model2.name}</th>
                      <th>Winner</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr>
                      <td>R² Score</td>
                      <td style={{ color: 'var(--cyan)' }}>{model1.metrics?.r2_score.toFixed(4)}</td>
                      <td style={{ color: 'var(--yellow)' }}>{model2.metrics?.r2_score.toFixed(4)}</td>
                      <td style={{ color: 'var(--green)' }}>
                        {model1.metrics && model2.metrics && (
                          model1.metrics.r2_score > model2.metrics.r2_score ? model1.name :
                          model2.metrics.r2_score > model1.metrics.r2_score ? model2.name : 'Tie'
                        )}
                      </td>
                    </tr>
                    <tr>
                      <td>RMSE</td>
                      <td style={{ color: 'var(--cyan)' }}>{model1.metrics?.rmse.toFixed(4)}</td>
                      <td style={{ color: 'var(--yellow)' }}>{model2.metrics?.rmse.toFixed(4)}</td>
                      <td style={{ color: 'var(--green)' }}>
                        {model1.metrics && model2.metrics && (
                          model1.metrics.rmse < model2.metrics.rmse ? model1.name :
                          model2.metrics.rmse < model1.metrics.rmse ? model2.name : 'Tie'
                        )}
                      </td>
                    </tr>
                    <tr>
                      <td>MAE</td>
                      <td style={{ color: 'var(--cyan)' }}>{model1.metrics?.mae.toFixed(4)}</td>
                      <td style={{ color: 'var(--yellow)' }}>{model2.metrics?.mae.toFixed(4)}</td>
                      <td style={{ color: 'var(--green)' }}>
                        {model1.metrics && model2.metrics && (
                          model1.metrics.mae < model2.metrics.mae ? model1.name :
                          model2.metrics.mae < model1.metrics.mae ? model2.name : 'Tie'
                        )}
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>

              {/* Metrics Chart */}
              {metricsComparison.length > 0 && (
                <div style={{ marginBottom: '24px' }}>
                  <h3 style={{ fontSize: '13px', marginBottom: '12px', color: 'var(--text-secondary)' }}>
                    Visual Comparison
                  </h3>
                  <div style={{ height: '250px' }}>
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={metricsComparison} layout="vertical">
                        <CartesianGrid strokeDasharray="3 3" stroke="var(--border-color)" />
                        <XAxis type="number" stroke="var(--text-muted)" tick={{ fill: 'var(--text-muted)', fontSize: 11 }} />
                        <YAxis dataKey="metric" type="category" stroke="var(--text-muted)" tick={{ fill: 'var(--text-muted)', fontSize: 11 }} width={80} />
                        <Tooltip
                          contentStyle={{
                            background: 'var(--bg-secondary)',
                            border: '1px solid var(--border-color)',
                            borderRadius: '4px',
                            fontSize: '11px',
                            color: 'var(--text-primary)',
                          }}
                        />
                        <Legend />
                        <Bar dataKey={model1Label} fill="var(--cyan)" />
                        <Bar dataKey={model2Label} fill="var(--yellow)" />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              )}

              {/* Summary */}
              <div style={{
                padding: '16px',
                background: 'rgba(0, 212, 170, 0.1)',
                borderRadius: '4px',
                border: '1px solid var(--cyan)'
              }}>
                <div style={{ fontSize: '13px', fontWeight: 'bold', marginBottom: '8px', color: 'var(--cyan)' }}>
                  Summary
                </div>
                <div style={{ fontSize: '12px', color: 'var(--text-primary)' }}>
                  {model1.metrics && model2.metrics && (
                    <>
                      {(() => {
                        const m1Wins = [
                          model1.metrics.r2_score > model2.metrics.r2_score,
                          model1.metrics.rmse < model2.metrics.rmse,
                          model1.metrics.mae < model2.metrics.mae,
                        ].filter(Boolean).length;
                        const m2Wins = 3 - m1Wins;

                        if (m1Wins > m2Wins) {
                          return (
                            <>
                              <strong style={{ color: 'var(--cyan)' }}>{model1.name}</strong> performs better overall,
                              winning {m1Wins} out of 3 metrics.
                            </>
                          );
                        } else if (m2Wins > m1Wins) {
                          return (
                            <>
                              <strong style={{ color: 'var(--yellow)' }}>{model2.name}</strong> performs better overall,
                              winning {m2Wins} out of 3 metrics.
                            </>
                          );
                        } else {
                          return 'Both models perform similarly across the metrics.';
                        }
                      })()}
                    </>
                  )}
                </div>
              </div>
            </>
          ) : (
            <div style={{
              padding: '48px',
              textAlign: 'center',
              color: 'var(--text-muted)'
            }}>
              {models.filter(m => m.metrics).length < 2 ? (
                'You need at least 2 trained models to compare. Train more models first.'
              ) : !model1 ? (
                'Select a model to start comparing.'
              ) : models.filter(m => m.metrics && m.id !== model1Id && m.target === model1.target).length === 0 ? (
                `No other models predict "${model1.target}". Train another model with the same target to compare.`
              ) : (
                'Select a second model above to compare performance.'
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
