import { useState, useEffect, useRef, useMemo } from 'react';
import { fetchDateColumns, fetchFeatureCorrelations, tuneModel, type CorrelationPair, type TuningResult } from '../api/client';
import { useKeyboardShortcuts } from '../hooks/useKeyboardShortcuts';

const TRAINING_STEPS = [
  { id: 'prepare', label: 'Preparing data', duration: 1500 },
  { id: 'split', label: 'Splitting train/test', duration: 1000 },
  { id: 'train', label: 'Training model', duration: 3000 },
  { id: 'evaluate', label: 'Evaluating performance', duration: 1500 },
  { id: 'complete', label: 'Finalizing', duration: 500 },
];

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
    split_type?: string;
    date_column?: string;
    n_cv_splits?: number;
  }) => Promise<void>;
  onClose: () => void;
}

const MODEL_TYPES = [
  { value: 'linear_regression', label: 'Linear Regression', description: 'Simple and interpretable' },
  { value: 'random_forest', label: 'Random Forest', description: 'Good for most datasets' },
  { value: 'xgboost', label: 'XGBoost', description: 'High performance gradient boosting' },
];

const SPLIT_TYPES = [
  { value: 'random', label: 'Random Split', description: 'Standard 80/20 random split' },
  { value: 'time_based', label: 'Time-Based Split', description: 'Train on earlier data, test on later' },
  { value: 'walk_forward', label: 'Walk-Forward CV', description: 'Multiple time-ordered folds' },
];

export function TrainModelModal({ dataset, onTrain, onClose }: TrainModelModalProps) {
  const [name, setName] = useState('');
  const [modelType, setModelType] = useState('random_forest');
  const [selectedFeatures, setSelectedFeatures] = useState<string[]>([]);
  const [target, setTarget] = useState('');
  const [training, setTraining] = useState(false);
  const [trainingStep, setTrainingStep] = useState(0);
  const [error, setError] = useState('');
  const stepTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Split options
  const [splitType, setSplitType] = useState('random');
  const [dateColumns, setDateColumns] = useState<string[]>([]);
  const [selectedDateColumn, setSelectedDateColumn] = useState('');
  const [nCvSplits, setNcvSplits] = useState(5);
  const [loadingDateCols, setLoadingDateCols] = useState(false);

  // Correlation warnings
  const [correlations, setCorrelations] = useState<CorrelationPair[]>([]);
  const [showCorrelationDetails, setShowCorrelationDetails] = useState(false);

  // Tuning state
  const [tuning, setTuning] = useState(false);
  const [tuningResult, setTuningResult] = useState<TuningResult | null>(null);

  // Keyboard shortcuts
  useKeyboardShortcuts({
    onEscape: () => !training && onClose(),
    enabled: !training,
  });

  // Advance through training steps when training
  useEffect(() => {
    if (training && trainingStep < TRAINING_STEPS.length - 1) {
      stepTimerRef.current = setTimeout(() => {
        setTrainingStep(prev => Math.min(prev + 1, TRAINING_STEPS.length - 1));
      }, TRAINING_STEPS[trainingStep].duration);
    }
    return () => {
      if (stepTimerRef.current) {
        clearTimeout(stepTimerRef.current);
      }
    };
  }, [training, trainingStep]);

  // Fetch date columns and correlations on mount
  useEffect(() => {
    const loadDateColumns = async () => {
      setLoadingDateCols(true);
      try {
        const result = await fetchDateColumns(dataset.id);
        setDateColumns(result.date_columns || []);
      } catch (err) {
        console.error('Failed to load date columns:', err);
      } finally {
        setLoadingDateCols(false);
      }
    };

    const loadCorrelations = async () => {
      try {
        const result = await fetchFeatureCorrelations(dataset.id, 0.7);
        setCorrelations(result.correlations || []);
      } catch (err) {
        console.error('Failed to load correlations:', err);
      }
    };

    loadDateColumns();
    loadCorrelations();
  }, [dataset.id]);

  // Filter correlations to only show those affecting selected features
  const relevantCorrelations = useMemo(() => {
    return correlations.filter(
      c => selectedFeatures.includes(c.feature1) && selectedFeatures.includes(c.feature2)
    );
  }, [correlations, selectedFeatures]);

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

  const handleAutoTune = async () => {
    if (!target) {
      setError('Please select a target variable before tuning');
      return;
    }

    setTuning(true);
    setError('');
    setTuningResult(null);

    // Use all available features if none selected
    const featuresToTune = selectedFeatures.length > 0
      ? selectedFeatures
      : dataset.features.filter(f => f !== target);

    try {
      const result = await tuneModel(
        modelType,
        dataset.id,
        featuresToTune,
        target,
        20,
        5,
        'random'
      );
      // Store the features used for tuning with the result
      setTuningResult({ ...result.result, features_tested: featuresToTune });
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Tuning failed');
    } finally {
      setTuning(false);
    }
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
    if (splitType !== 'random' && !selectedDateColumn) {
      setError('Please select a date column for time-based validation');
      return;
    }

    setTraining(true);
    setTrainingStep(0);

    try {
      const config: Parameters<typeof onTrain>[0] = {
        name: name.trim(),
        model_type: modelType,
        dataset_id: dataset.id,
        features: selectedFeatures,
        target,
      };

      if (splitType !== 'random') {
        config.split_type = splitType;
        config.date_column = selectedDateColumn;
        if (splitType === 'walk_forward') {
          config.n_cv_splits = nCvSplits;
        }
      }

      await onTrain(config);
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Training failed');
    } finally {
      setTraining(false);
    }
  };

  const needsDateColumn = splitType !== 'random';

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content terminal-panel" onClick={e => e.stopPropagation()} style={{ maxWidth: '800px', width: '90%' }}>
        <div className="terminal-panel-header modal-header">
          <span>Train Model on {dataset.name}</span>
          <button onClick={onClose} style={{ padding: '4px 12px', fontSize: '11px' }} disabled={training}>
            Close
          </button>
        </div>

        <div style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: '20px', maxHeight: '70vh', overflowY: 'auto' }}>
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
              onChange={e => { setModelType(e.target.value); setTuningResult(null); }}
              style={{ width: '100%' }}
              disabled={training || tuning}
            >
              {MODEL_TYPES.map(mt => (
                <option key={mt.value} value={mt.value}>
                  {mt.label} - {mt.description}
                </option>
              ))}
            </select>

          </div>

          {/* Validation Split Section */}
          <div style={{
            padding: '12px',
            background: 'var(--bg-tertiary)',
            borderRadius: '4px',
            border: '1px solid var(--border-color)'
          }}>
            <label style={{
              display: 'block',
              marginBottom: '8px',
              color: 'var(--text-secondary)',
              fontSize: '11px',
              textTransform: 'uppercase',
              letterSpacing: '0.5px'
            }}>
              Validation Strategy
            </label>
            <select
              value={splitType}
              onChange={e => setSplitType(e.target.value)}
              style={{ width: '100%', marginBottom: needsDateColumn ? '12px' : '0' }}
              disabled={training}
            >
              {SPLIT_TYPES.map(st => (
                <option key={st.value} value={st.value}>
                  {st.label} - {st.description}
                </option>
              ))}
            </select>

            {needsDateColumn && (
              <div style={{ marginTop: '12px' }}>
                <label style={{
                  display: 'block',
                  marginBottom: '8px',
                  color: 'var(--text-secondary)',
                  fontSize: '11px',
                  textTransform: 'uppercase',
                  letterSpacing: '0.5px'
                }}>
                  Date Column
                </label>
                {loadingDateCols ? (
                  <div style={{ color: 'var(--text-muted)', fontSize: '12px' }}>
                    Detecting date columns...
                  </div>
                ) : dateColumns.length === 0 ? (
                  <div style={{ color: 'var(--yellow)', fontSize: '12px' }}>
                    No date columns detected. Ensure your dataset has a column with dates.
                  </div>
                ) : (
                  <select
                    value={selectedDateColumn}
                    onChange={e => setSelectedDateColumn(e.target.value)}
                    style={{ width: '100%' }}
                    disabled={training}
                  >
                    <option value="">-- Select Date Column --</option>
                    {dateColumns.map(col => (
                      <option key={col} value={col}>{col}</option>
                    ))}
                  </select>
                )}
              </div>
            )}

            {splitType === 'walk_forward' && (
              <div style={{ marginTop: '12px' }}>
                <label style={{
                  display: 'block',
                  marginBottom: '8px',
                  color: 'var(--text-secondary)',
                  fontSize: '11px',
                  textTransform: 'uppercase',
                  letterSpacing: '0.5px'
                }}>
                  Number of CV Folds
                </label>
                <input
                  type="number"
                  min={2}
                  max={10}
                  value={nCvSplits}
                  onChange={e => setNcvSplits(Math.max(2, Math.min(10, parseInt(e.target.value) || 5)))}
                  style={{ width: '100px' }}
                  disabled={training}
                />
                <span style={{ marginLeft: '8px', color: 'var(--text-muted)', fontSize: '11px' }}>
                  (2-10 folds)
                </span>
              </div>
            )}
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

            {/* Auto-Tune Button - appears after target is selected */}
            <button
              onClick={handleAutoTune}
              disabled={training || tuning || !target}
              style={{
                marginTop: '12px',
                padding: '8px 16px',
                fontSize: '12px',
                width: '100%',
                color: (training || tuning || !target)
                  ? 'var(--text-muted)'
                  : 'var(--yellow)',
                borderColor: (training || tuning || !target)
                  ? 'var(--border-color)'
                  : 'var(--yellow)',
                background: tuning ? 'var(--bg-tertiary)' : 'transparent',
                cursor: (training || tuning || !target)
                  ? 'not-allowed'
                  : 'pointer',
                opacity: (training || tuning || !target) ? 0.6 : 1,
              }}
            >
              {tuning
                ? 'Searching for optimal parameters...'
                : !target
                  ? 'Auto-Tune (Select target first)'
                  : `Auto-Tune ${MODEL_TYPES.find(m => m.value === modelType)?.label || ''}`}
            </button>
            {target && !tuning && (
              <div style={{ fontSize: '10px', color: 'var(--text-muted)', marginTop: '4px' }}>
                Tests all {dataset.features.filter(f => f !== target).length} available features to find optimal parameters
              </div>
            )}

            {/* Tuning Results */}
            {tuningResult && (
              <div style={{
                marginTop: '12px',
                padding: '12px',
                background: 'rgba(0, 212, 170, 0.1)',
                border: '1px solid var(--cyan)',
                borderRadius: '4px',
              }}>
                <div style={{
                  fontSize: '11px',
                  color: 'var(--text-muted)',
                  marginBottom: '8px',
                  textTransform: 'uppercase',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                }}>
                  <span>Tuning Results - {MODEL_TYPES.find(m => m.value === modelType)?.label}</span>
                  <span style={{ textTransform: 'none', fontSize: '10px' }}>
                    Tested {tuningResult.all_results?.length || 0} configs with {tuningResult.cv_folds}-fold CV
                  </span>
                </div>

                {/* Features Tested */}
                <div style={{
                  marginBottom: '12px',
                  padding: '8px',
                  background: 'var(--bg-tertiary)',
                  borderRadius: '4px',
                }}>
                  <div style={{ fontSize: '10px', color: 'var(--text-muted)', marginBottom: '4px' }}>
                    Features Tested ({tuningResult.features_tested?.length || selectedFeatures.length})
                  </div>
                  <div style={{ fontSize: '11px', color: 'var(--text-secondary)', lineHeight: '1.4' }}>
                    {(tuningResult.features_tested || selectedFeatures).join(', ')}
                  </div>
                </div>

                {/* Score */}
                <div style={{ display: 'flex', gap: '24px', flexWrap: 'wrap', marginBottom: '12px' }}>
                  <div>
                    <div style={{ fontSize: '10px', color: 'var(--text-muted)' }}>Best CV Score (R²)</div>
                    <div style={{ fontSize: '20px', fontWeight: 'bold', color: 'var(--cyan)' }}>
                      {tuningResult.best_score.toFixed(4)}
                      <span style={{ fontSize: '12px', fontWeight: 'normal', color: 'var(--text-muted)', marginLeft: '4px' }}>
                        ± {tuningResult.best_std.toFixed(4)}
                      </span>
                    </div>
                    <div style={{ fontSize: '10px', color: 'var(--text-muted)', marginTop: '2px' }}>
                      {tuningResult.best_score >= 0.8 ? 'Excellent fit' :
                       tuningResult.best_score >= 0.6 ? 'Good fit' :
                       tuningResult.best_score >= 0.4 ? 'Moderate fit' : 'Weak fit - consider more features'}
                    </div>
                  </div>
                </div>

                {/* Best Parameters with Explanations */}
                <div style={{
                  padding: '8px',
                  background: 'var(--bg-tertiary)',
                  borderRadius: '4px',
                }}>
                  <div style={{ fontSize: '10px', color: 'var(--text-muted)', marginBottom: '8px' }}>
                    Optimal Parameters Found:
                  </div>

                  {tuningResult.best_variant && (
                    <div style={{ marginBottom: '6px' }}>
                      <span style={{ fontSize: '11px', color: 'var(--yellow)', fontWeight: 'bold' }}>
                        Model Variant: {tuningResult.best_variant}
                      </span>
                      <span style={{ fontSize: '10px', color: 'var(--text-muted)', marginLeft: '8px' }}>
                        {tuningResult.best_variant === 'linear' ? '(Standard linear regression)' :
                         tuningResult.best_variant === 'ridge' ? '(L2 regularization - reduces overfitting)' :
                         tuningResult.best_variant === 'lasso' ? '(L1 regularization - feature selection)' : ''}
                      </span>
                    </div>
                  )}

                  <table style={{ width: '100%', fontSize: '11px', borderCollapse: 'collapse' }}>
                    <tbody>
                      {Object.entries(tuningResult.best_params).map(([param, value]) => (
                        <tr key={param} style={{ borderBottom: '1px solid var(--border-color)' }}>
                          <td style={{ padding: '4px 0', color: 'var(--yellow)', fontFamily: 'monospace', width: '40%' }}>
                            {param}
                          </td>
                          <td style={{ padding: '4px 8px', color: 'var(--text-primary)', fontWeight: 'bold' }}>
                            {String(value) === 'null' ? 'None (unlimited)' : String(value)}
                          </td>
                          <td style={{ padding: '4px 0', color: 'var(--text-muted)', fontSize: '10px' }}>
                            {param === 'n_estimators' ? 'Number of trees in the forest' :
                             param === 'max_depth' ? 'Maximum tree depth (None = unlimited)' :
                             param === 'min_samples_split' ? 'Min samples to split a node' :
                             param === 'min_samples_leaf' ? 'Min samples in leaf nodes' :
                             param === 'learning_rate' ? 'Step size for gradient descent' :
                             param === 'subsample' ? 'Fraction of samples per tree' :
                             param === 'colsample_bytree' ? 'Fraction of features per tree' :
                             param === 'alpha' ? 'Regularization strength' : ''}
                          </td>
                        </tr>
                      ))}
                      {Object.keys(tuningResult.best_params).length === 0 && !tuningResult.best_variant && (
                        <tr>
                          <td colSpan={3} style={{ padding: '4px 0', color: 'var(--text-muted)' }}>
                            Default parameters are optimal for this dataset
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>

                {/* Action hint */}
                <div style={{
                  marginTop: '12px',
                  padding: '8px',
                  background: 'rgba(255, 165, 2, 0.1)',
                  border: '1px solid var(--yellow)',
                  borderRadius: '4px',
                  fontSize: '11px',
                  color: 'var(--text-secondary)',
                }}>
                  <strong style={{ color: 'var(--yellow)' }}>Note:</strong> These are the best parameters found for {MODEL_TYPES.find(m => m.value === modelType)?.label}.
                  The model will be trained with default parameters. Use these results to compare model types or as a reference.
                </div>
              </div>
            )}
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
              maxHeight: '200px',
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

          {/* Correlation Warning */}
          {relevantCorrelations.length > 0 && (
            <div style={{
              padding: '12px',
              background: 'rgba(255, 165, 2, 0.1)',
              border: '1px solid var(--yellow)',
              borderRadius: '4px'
            }}>
              <div style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                marginBottom: showCorrelationDetails ? '12px' : '0'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span style={{ color: 'var(--yellow)', fontSize: '14px' }}>!</span>
                  <span style={{ color: 'var(--yellow)', fontSize: '12px', fontWeight: 'bold' }}>
                    Correlation Warning
                  </span>
                  <span style={{ color: 'var(--text-secondary)', fontSize: '11px' }}>
                    {relevantCorrelations.length} highly correlated feature pair{relevantCorrelations.length > 1 ? 's' : ''} selected
                  </span>
                </div>
                <button
                  onClick={() => setShowCorrelationDetails(!showCorrelationDetails)}
                  style={{
                    padding: '4px 8px',
                    fontSize: '10px',
                    background: 'transparent',
                    color: 'var(--yellow)',
                    borderColor: 'var(--yellow)'
                  }}
                >
                  {showCorrelationDetails ? 'Hide' : 'Details'}
                </button>
              </div>

              {showCorrelationDetails && (
                <div style={{ marginTop: '8px' }}>
                  <div style={{
                    fontSize: '11px',
                    color: 'var(--text-secondary)',
                    marginBottom: '8px'
                  }}>
                    Highly correlated features may cause multicollinearity issues, especially with linear regression.
                    Consider removing one feature from each correlated pair.
                  </div>
                  <table style={{ width: '100%', fontSize: '11px', borderCollapse: 'collapse' }}>
                    <thead>
                      <tr style={{ borderBottom: '1px solid var(--border-color)' }}>
                        <th style={{ textAlign: 'left', padding: '4px 8px', color: 'var(--text-secondary)' }}>Feature 1</th>
                        <th style={{ textAlign: 'left', padding: '4px 8px', color: 'var(--text-secondary)' }}>Feature 2</th>
                        <th style={{ textAlign: 'right', padding: '4px 8px', color: 'var(--text-secondary)' }}>Correlation</th>
                        <th style={{ textAlign: 'center', padding: '4px 8px', color: 'var(--text-secondary)' }}>Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      {relevantCorrelations.map((corr, idx) => (
                        <tr key={idx} style={{ borderBottom: '1px solid var(--border-color)' }}>
                          <td style={{ padding: '6px 8px', color: 'var(--text-primary)' }}>{corr.feature1}</td>
                          <td style={{ padding: '6px 8px', color: 'var(--text-primary)' }}>{corr.feature2}</td>
                          <td style={{
                            padding: '6px 8px',
                            textAlign: 'right',
                            color: corr.strength === 'strong' ? 'var(--red)' : 'var(--yellow)'
                          }}>
                            {(corr.correlation * 100).toFixed(1)}%
                          </td>
                          <td style={{ padding: '6px 8px', textAlign: 'center' }}>
                            <button
                              onClick={() => setSelectedFeatures(prev => prev.filter(f => f !== corr.feature2))}
                              style={{
                                padding: '2px 6px',
                                fontSize: '10px',
                                color: 'var(--red)',
                                borderColor: 'var(--red)',
                                marginRight: '4px'
                              }}
                              title={`Remove ${corr.feature2}`}
                            >
                              Drop {corr.feature2.length > 10 ? corr.feature2.slice(0, 10) + '...' : corr.feature2}
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {/* Training Progress Indicator */}
          {training && (
            <div style={{
              padding: '16px',
              background: 'var(--bg-tertiary)',
              borderRadius: '4px',
              border: '1px solid var(--cyan)',
              marginTop: '8px'
            }}>
              <div style={{
                fontSize: '12px',
                color: 'var(--cyan)',
                marginBottom: '12px',
                fontWeight: 'bold'
              }}>
                Training in Progress...
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {TRAINING_STEPS.map((step, idx) => (
                  <div
                    key={step.id}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '12px',
                      opacity: idx <= trainingStep ? 1 : 0.4,
                    }}
                  >
                    <div style={{
                      width: '20px',
                      height: '20px',
                      borderRadius: '50%',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: '11px',
                      fontWeight: 'bold',
                      background: idx < trainingStep
                        ? 'var(--green)'
                        : idx === trainingStep
                        ? 'var(--cyan)'
                        : 'var(--bg-secondary)',
                      color: idx <= trainingStep ? 'var(--bg-primary)' : 'var(--text-muted)',
                      border: `2px solid ${
                        idx < trainingStep
                          ? 'var(--green)'
                          : idx === trainingStep
                          ? 'var(--cyan)'
                          : 'var(--border-color)'
                      }`,
                    }}>
                      {idx < trainingStep ? '✓' : idx + 1}
                    </div>
                    <span style={{
                      fontSize: '12px',
                      color: idx <= trainingStep ? 'var(--text-primary)' : 'var(--text-muted)',
                    }}>
                      {step.label}
                      {idx === trainingStep && (
                        <span className="training-dots" style={{ color: 'var(--cyan)' }}>...</span>
                      )}
                    </span>
                  </div>
                ))}
              </div>
              <div style={{
                marginTop: '12px',
                height: '4px',
                background: 'var(--bg-secondary)',
                borderRadius: '2px',
                overflow: 'hidden'
              }}>
                <div
                  style={{
                    height: '100%',
                    background: 'var(--cyan)',
                    borderRadius: '2px',
                    transition: 'width 0.3s ease',
                    width: `${((trainingStep + 1) / TRAINING_STEPS.length) * 100}%`,
                  }}
                />
              </div>
            </div>
          )}

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
              disabled={training || !name || !target || selectedFeatures.length === 0 || (needsDateColumn && !selectedDateColumn)}
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
