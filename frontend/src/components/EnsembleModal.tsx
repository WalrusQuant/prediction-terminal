import { useState, useEffect } from 'react';
import { fetchCompatibleModels, createEnsemblePrediction, type CompatibleGroup, type EnsemblePredictResult } from '../api/client';

interface EnsembleModalProps {
  onClose: () => void;
}

export function EnsembleModal({ onClose }: EnsembleModalProps) {
  const [compatibleGroups, setCompatibleGroups] = useState<CompatibleGroup[]>([]);
  const [selectedGroup, setSelectedGroup] = useState<CompatibleGroup | null>(null);
  const [selectedModels, setSelectedModels] = useState<string[]>([]);
  const [inputValues, setInputValues] = useState<Record<string, string>>({});
  const [method, setMethod] = useState<'weighted' | 'median'>('weighted');
  const [weights, setWeights] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const [predicting, setPredicting] = useState(false);
  const [result, setResult] = useState<EnsemblePredictResult | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    loadCompatibleModels();
  }, []);

  const loadCompatibleModels = async () => {
    setLoading(true);
    try {
      const res = await fetchCompatibleModels();
      setCompatibleGroups(res.compatible_groups || []);
      if (res.compatible_groups.length > 0) {
        setSelectedGroup(res.compatible_groups[0]);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load compatible models');
    } finally {
      setLoading(false);
    }
  };

  const handleSelectGroup = (group: CompatibleGroup) => {
    setSelectedGroup(group);
    setSelectedModels([]);
    setInputValues({});
    setWeights({});
    setResult(null);
    setError('');
  };

  const handleToggleModel = (modelId: string) => {
    if (selectedModels.includes(modelId)) {
      setSelectedModels(prev => prev.filter(id => id !== modelId));
      setWeights(prev => {
        const next = { ...prev };
        delete next[modelId];
        return next;
      });
    } else {
      setSelectedModels(prev => [...prev, modelId]);
      setWeights(prev => ({ ...prev, [modelId]: 1 }));
    }
  };

  const handleWeightChange = (modelId: string, value: string) => {
    const num = parseFloat(value);
    if (!isNaN(num) && num >= 0) {
      setWeights(prev => ({ ...prev, [modelId]: num }));
    }
  };

  const handleInputChange = (feature: string, value: string) => {
    setInputValues(prev => ({ ...prev, [feature]: value }));
  };

  const handlePredict = async () => {
    if (selectedModels.length < 2) {
      setError('Please select at least 2 models');
      return;
    }

    if (!selectedGroup) return;

    // Validate inputs
    const numericInputs: Record<string, number> = {};
    for (const feature of selectedGroup.features) {
      const val = parseFloat(inputValues[feature] || '');
      if (isNaN(val)) {
        setError(`Please enter a valid value for ${feature}`);
        return;
      }
      numericInputs[feature] = val;
    }

    setPredicting(true);
    setError('');
    setResult(null);

    try {
      const res = await createEnsemblePrediction(
        selectedModels,
        [numericInputs],
        method === 'weighted' ? weights : undefined,
        method
      );
      setResult(res);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Ensemble prediction failed');
    } finally {
      setPredicting(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div
        className="modal-content terminal-panel"
        onClick={e => e.stopPropagation()}
        style={{ maxWidth: '800px', maxHeight: '90vh', overflow: 'auto' }}
      >
        <div className="terminal-panel-header modal-header">
          <span>Ensemble Predictions</span>
          <button onClick={onClose} style={{ padding: '4px 12px', fontSize: '11px' }}>
            Close
          </button>
        </div>

        <div style={{ padding: '16px' }}>
          {loading ? (
            <div style={{ textAlign: 'center', padding: '24px', color: 'var(--text-muted)' }}>
              Loading compatible models...
            </div>
          ) : compatibleGroups.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '24px', color: 'var(--text-muted)' }}>
              No compatible model groups found. Train at least 2 models with the same features and target to use ensembling.
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
              {/* Group selector */}
              {compatibleGroups.length > 1 && (
                <div>
                  <label style={{
                    display: 'block',
                    fontSize: '11px',
                    color: 'var(--text-muted)',
                    marginBottom: '8px',
                    textTransform: 'uppercase',
                  }}>
                    Select Model Group
                  </label>
                  <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                    {compatibleGroups.map((group, idx) => (
                      <button
                        key={idx}
                        onClick={() => handleSelectGroup(group)}
                        style={{
                          padding: '8px 12px',
                          fontSize: '12px',
                          background: selectedGroup === group ? 'var(--cyan)' : 'var(--bg-tertiary)',
                          color: selectedGroup === group ? 'var(--bg-primary)' : 'var(--text-primary)',
                          border: '1px solid var(--border-color)',
                          borderRadius: '4px',
                        }}
                      >
                        {group.target} ({group.models.length} models)
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Model selection */}
              {selectedGroup && (
                <div>
                  <label style={{
                    display: 'block',
                    fontSize: '11px',
                    color: 'var(--text-muted)',
                    marginBottom: '8px',
                    textTransform: 'uppercase',
                  }}>
                    Select Models for Ensemble (min 2)
                  </label>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    {selectedGroup.models.map(model => (
                      <div
                        key={model.id}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '12px',
                          padding: '8px 12px',
                          background: selectedModels.includes(model.id) ? 'rgba(0, 212, 170, 0.1)' : 'var(--bg-tertiary)',
                          borderRadius: '4px',
                          border: selectedModels.includes(model.id) ? '1px solid var(--cyan)' : '1px solid var(--border-color)',
                        }}
                      >
                        <input
                          type="checkbox"
                          checked={selectedModels.includes(model.id)}
                          onChange={() => handleToggleModel(model.id)}
                          style={{ width: '16px', height: '16px' }}
                        />
                        <div style={{ flex: 1 }}>
                          <div style={{ fontWeight: 500 }}>{model.name}</div>
                          <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                            {model.model_type} | R²: {model.metrics.r2_score?.toFixed(3) || '—'}
                          </div>
                        </div>
                        {selectedModels.includes(model.id) && method === 'weighted' && (
                          <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                            <label style={{ fontSize: '10px', color: 'var(--text-muted)' }}>Weight:</label>
                            <input
                              type="number"
                              min="0"
                              step="0.1"
                              value={weights[model.id] || 1}
                              onChange={e => handleWeightChange(model.id, e.target.value)}
                              style={{
                                width: '60px',
                                padding: '4px',
                                fontSize: '11px',
                                background: 'var(--bg-secondary)',
                                border: '1px solid var(--border-color)',
                                borderRadius: '2px',
                              }}
                            />
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Method selector */}
              {selectedModels.length >= 2 && (
                <div>
                  <label style={{
                    display: 'block',
                    fontSize: '11px',
                    color: 'var(--text-muted)',
                    marginBottom: '8px',
                    textTransform: 'uppercase',
                  }}>
                    Ensemble Method
                  </label>
                  <div style={{ display: 'flex', gap: '12px' }}>
                    <label style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer' }}>
                      <input
                        type="radio"
                        checked={method === 'weighted'}
                        onChange={() => setMethod('weighted')}
                      />
                      <span style={{ fontSize: '12px' }}>Weighted Average</span>
                    </label>
                    <label style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer' }}>
                      <input
                        type="radio"
                        checked={method === 'median'}
                        onChange={() => setMethod('median')}
                      />
                      <span style={{ fontSize: '12px' }}>Median</span>
                    </label>
                  </div>
                </div>
              )}

              {/* Input values */}
              {selectedGroup && selectedModels.length >= 2 && (
                <div>
                  <label style={{
                    display: 'block',
                    fontSize: '11px',
                    color: 'var(--text-muted)',
                    marginBottom: '8px',
                    textTransform: 'uppercase',
                  }}>
                    Input Values
                  </label>
                  <div style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))',
                    gap: '12px',
                  }}>
                    {selectedGroup.features.map(feature => (
                      <div key={feature}>
                        <label style={{
                          display: 'block',
                          fontSize: '10px',
                          color: 'var(--text-muted)',
                          marginBottom: '4px',
                        }}>
                          {feature}
                        </label>
                        <input
                          type="number"
                          step="any"
                          value={inputValues[feature] || ''}
                          onChange={e => handleInputChange(feature, e.target.value)}
                          placeholder="0"
                          style={{ width: '100%' }}
                        />
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Error */}
              {error && (
                <div style={{
                  padding: '12px',
                  background: 'rgba(255, 71, 87, 0.1)',
                  border: '1px solid var(--red)',
                  borderRadius: '4px',
                  color: 'var(--red)',
                  fontSize: '12px',
                }}>
                  {error}
                </div>
              )}

              {/* Predict button */}
              {selectedModels.length >= 2 && (
                <button
                  onClick={handlePredict}
                  disabled={predicting}
                  style={{
                    padding: '12px 24px',
                    background: 'var(--cyan)',
                    color: 'var(--bg-primary)',
                    border: 'none',
                    borderRadius: '4px',
                    fontSize: '14px',
                    cursor: predicting ? 'default' : 'pointer',
                  }}
                >
                  {predicting ? 'Generating Ensemble Prediction...' : 'Generate Ensemble Prediction'}
                </button>
              )}

              {/* Results */}
              {result && (
                <div style={{
                  padding: '16px',
                  background: 'var(--bg-tertiary)',
                  borderRadius: '4px',
                  border: '1px solid var(--cyan)',
                }}>
                  <div style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'flex-start',
                    marginBottom: '16px',
                  }}>
                    <div>
                      <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginBottom: '4px' }}>
                        Ensemble Prediction ({result.method})
                      </div>
                      <div style={{ fontSize: '28px', color: 'var(--cyan)', fontWeight: 'bold' }}>
                        {result.ensemble_predictions[0].toFixed(2)}
                      </div>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <div style={{ fontSize: '10px', color: 'var(--text-muted)' }}>
                        Model Disagreement: {result.stats.avg_model_disagreement.toFixed(3)}
                      </div>
                    </div>
                  </div>

                  <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginBottom: '8px' }}>
                    Individual Model Predictions:
                  </div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                    {Object.entries(result.detailed_results[0].individual_predictions).map(([modelId, pred]) => (
                      <div
                        key={modelId}
                        style={{
                          padding: '8px 12px',
                          background: 'var(--bg-secondary)',
                          borderRadius: '4px',
                          border: '1px solid var(--border-color)',
                        }}
                      >
                        <div style={{ fontSize: '10px', color: 'var(--text-muted)' }}>
                          {result.model_names[modelId]}
                        </div>
                        <div style={{ fontSize: '14px', fontWeight: 500 }}>
                          {pred.toFixed(2)}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
