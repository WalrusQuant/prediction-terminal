import { useState } from 'react';

interface Dataset {
  id: string;
  name: string;
  features: string[];
}

interface TrainModelModalProps {
  dataset: Dataset;
  onTrain: (config: {
    name: string;
    model_type: string;
    dataset_id: string;
    features: string[];
    target: string;
  }) => Promise<void>;
  onClose: () => void;
}

const MODEL_TYPES = [
  { value: 'linear_regression', label: 'Linear Regression', description: 'Simple and interpretable' },
  { value: 'random_forest', label: 'Random Forest', description: 'Good for most datasets' },
  { value: 'xgboost', label: 'XGBoost', description: 'High performance gradient boosting' },
];

export function TrainModelModal({ dataset, onTrain, onClose }: TrainModelModalProps) {
  const [name, setName] = useState('');
  const [modelType, setModelType] = useState('random_forest');
  const [selectedFeatures, setSelectedFeatures] = useState<string[]>([]);
  const [target, setTarget] = useState('');
  const [training, setTraining] = useState(false);
  const [error, setError] = useState('');

  const handleFeatureToggle = (feature: string) => {
    if (feature === target) return;
    setSelectedFeatures(prev =>
      prev.includes(feature)
        ? prev.filter(f => f !== feature)
        : [...prev, feature]
    );
  };

  const handleTargetChange = (newTarget: string) => {
    setTarget(newTarget);
    setSelectedFeatures(prev => prev.filter(f => f !== newTarget));
  };

  const handleSelectAllFeatures = () => {
    const available = dataset.features.filter(f => f !== target);
    setSelectedFeatures(available);
  };

  const handleClearFeatures = () => {
    setSelectedFeatures([]);
  };

  const handleSubmit = async () => {
    setError('');

    if (!name.trim()) {
      setError('Please enter a model name');
      return;
    }
    if (!target) {
      setError('Please select a target variable (what you want to predict)');
      return;
    }
    if (selectedFeatures.length === 0) {
      setError('Please select at least one feature');
      return;
    }

    setTraining(true);

    try {
      await onTrain({
        name: name.trim(),
        model_type: modelType,
        dataset_id: dataset.id,
        features: selectedFeatures,
        target,
      });
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Training failed');
    } finally {
      setTraining(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content terminal-panel" onClick={e => e.stopPropagation()}>
        <div className="terminal-panel-header modal-header">
          <span>Train Model on {dataset.name}</span>
          <button onClick={onClose} style={{ padding: '4px 12px', fontSize: '11px' }} disabled={training}>
            Close
          </button>
        </div>

        <div style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
          {error && (
            <div style={{
              color: 'var(--red)',
              padding: '12px',
              background: 'rgba(255, 71, 87, 0.1)',
              border: '1px solid var(--red)',
              borderRadius: '4px',
              fontSize: '12px'
            }}>
              {error}
            </div>
          )}

          <div>
            <label style={{
              display: 'block',
              marginBottom: '8px',
              color: 'var(--text-secondary)',
              fontSize: '11px',
              textTransform: 'uppercase',
              letterSpacing: '0.5px'
            }}>
              Model Name
            </label>
            <input
              type="text"
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="e.g., Points Predictor"
              style={{ width: '100%' }}
              disabled={training}
            />
          </div>

          <div>
            <label style={{
              display: 'block',
              marginBottom: '8px',
              color: 'var(--text-secondary)',
              fontSize: '11px',
              textTransform: 'uppercase',
              letterSpacing: '0.5px'
            }}>
              Model Type
            </label>
            <select
              value={modelType}
              onChange={e => setModelType(e.target.value)}
              style={{ width: '100%' }}
              disabled={training}
            >
              {MODEL_TYPES.map(mt => (
                <option key={mt.value} value={mt.value}>
                  {mt.label} - {mt.description}
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
              textTransform: 'uppercase',
              letterSpacing: '0.5px'
            }}>
              Target Variable <span style={{ color: 'var(--cyan)' }}>(What to Predict)</span>
            </label>
            <select
              value={target}
              onChange={e => handleTargetChange(e.target.value)}
              style={{ width: '100%' }}
              disabled={training}
            >
              <option value="">-- Select Target --</option>
              {dataset.features.map(f => (
                <option key={f} value={f}>{f}</option>
              ))}
            </select>
          </div>

          <div>
            <div style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginBottom: '8px'
            }}>
              <label style={{
                color: 'var(--text-secondary)',
                fontSize: '11px',
                textTransform: 'uppercase',
                letterSpacing: '0.5px'
              }}>
                Features <span style={{ color: 'var(--cyan)' }}>(Input Variables)</span>
              </label>
              <div style={{ display: 'flex', gap: '8px' }}>
                <button
                  onClick={handleSelectAllFeatures}
                  disabled={training || !target}
                  style={{ padding: '4px 8px', fontSize: '10px' }}
                >
                  Select All
                </button>
                <button
                  onClick={handleClearFeatures}
                  disabled={training}
                  style={{ padding: '4px 8px', fontSize: '10px' }}
                >
                  Clear
                </button>
              </div>
            </div>

            {!target && (
              <div style={{ color: 'var(--text-muted)', fontSize: '12px', marginBottom: '8px' }}>
                Select a target variable first
              </div>
            )}

            <div style={{
              display: 'flex',
              flexWrap: 'wrap',
              gap: '8px',
              maxHeight: '300px',
              overflowY: 'auto',
              padding: '8px',
              background: 'var(--bg-tertiary)',
              borderRadius: '4px',
              border: '1px solid var(--border-color)'
            }}>
              {dataset.features
                .filter(f => f !== target)
                .map(feature => (
                  <button
                    key={feature}
                    onClick={() => handleFeatureToggle(feature)}
                    disabled={training || !target}
                    className={`feature-chip ${selectedFeatures.includes(feature) ? 'selected' : ''}`}
                  >
                    {feature}
                  </button>
                ))}
            </div>

            <div style={{ marginTop: '8px', fontSize: '11px', color: 'var(--text-muted)' }}>
              {selectedFeatures.length} of {dataset.features.filter(f => f !== target).length} features selected
            </div>
          </div>

          <div style={{
            display: 'flex',
            gap: '12px',
            justifyContent: 'flex-end',
            marginTop: '8px',
            paddingTop: '16px',
            borderTop: '1px solid var(--border-color)'
          }}>
            <button onClick={onClose} disabled={training}>
              Cancel
            </button>
            <button
              onClick={handleSubmit}
              disabled={training || !name || !target || selectedFeatures.length === 0}
              style={{
                background: training ? 'var(--bg-tertiary)' : 'var(--cyan)',
                color: training ? 'var(--text-primary)' : 'var(--bg-primary)',
                borderColor: 'var(--cyan)'
              }}
            >
              {training ? 'Training...' : 'Train Model'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
