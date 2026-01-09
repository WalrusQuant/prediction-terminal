import { useState, useRef, useEffect } from 'react';
import Papa from 'papaparse';
import { useKeyboardShortcuts } from '../hooks/useKeyboardShortcuts';
import { fetchTemplates, createTemplate, deleteTemplate, type PredictionTemplate } from '../api/client';

interface Model {
  id: string;
  name: string;
  features: string[];
  target: string;
}

interface PredictionResult {
  predicted_value: number;
  confidence_low?: number | null;
  confidence_high?: number | null;
}

interface PredictModalProps {
  model: Model;
  onSinglePredict: (modelId: string, inputData: Record<string, number>, label?: string, withConfidence?: boolean) => Promise<{ prediction: PredictionResult }>;
  onBatchPredict: (modelId: string, data: Record<string, unknown>[], labels?: string[]) => Promise<{ predictions: unknown[]; count: number }>;
  onClose: () => void;
}

export function PredictModal({ model, onSinglePredict, onBatchPredict, onClose }: PredictModalProps) {
  const [activeTab, setActiveTab] = useState<'single' | 'batch'>('single');
  const [inputValues, setInputValues] = useState<Record<string, string>>({});
  const [predictionResult, setPredictionResult] = useState<PredictionResult | null>(null);
  const [batchResults, setBatchResults] = useState<{ count: number } | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [label, setLabel] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Confidence interval state
  const [withConfidence, setWithConfidence] = useState(false);

  // Template state
  const [templates, setTemplates] = useState<PredictionTemplate[]>([]);
  const [showSaveTemplate, setShowSaveTemplate] = useState(false);
  const [templateName, setTemplateName] = useState('');
  const [templateDesc, setTemplateDesc] = useState('');
  const [savingTemplate, setSavingTemplate] = useState(false);

  // Load templates on mount
  useEffect(() => {
    loadTemplates();
  }, [model.id]);

  const loadTemplates = async () => {
    try {
      const result = await fetchTemplates(model.id);
      setTemplates(result.templates || []);
    } catch (err) {
      console.error('Failed to load templates:', err);
    }
  };

  const handleLoadTemplate = (template: PredictionTemplate) => {
    const newInputValues: Record<string, string> = {};
    for (const feature of model.features) {
      if (template.input_values[feature] !== undefined) {
        newInputValues[feature] = String(template.input_values[feature]);
      }
    }
    setInputValues(newInputValues);
    setPredictionResult(null);
    setError('');
  };

  const handleSaveTemplate = async () => {
    if (!templateName.trim()) {
      setError('Please enter a template name');
      return;
    }

    // Validate all features have values
    const numericData: Record<string, number> = {};
    for (const feature of model.features) {
      const val = parseFloat(inputValues[feature] || '');
      if (isNaN(val)) {
        setError(`Please enter valid values for all features before saving`);
        return;
      }
      numericData[feature] = val;
    }

    setSavingTemplate(true);
    setError('');
    try {
      await createTemplate(templateName.trim(), model.id, numericData, templateDesc.trim() || undefined);
      await loadTemplates();
      setShowSaveTemplate(false);
      setTemplateName('');
      setTemplateDesc('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save template');
    } finally {
      setSavingTemplate(false);
    }
  };

  const handleDeleteTemplate = async (templateId: string) => {
    if (!confirm('Delete this template?')) return;
    try {
      await deleteTemplate(templateId);
      await loadTemplates();
    } catch (err) {
      console.error('Failed to delete template:', err);
    }
  };

  // Keyboard shortcuts
  useKeyboardShortcuts({
    onEscape: () => !loading && onClose(),
    enabled: !loading,
  });

  const handleInputChange = (feature: string, value: string) => {
    setInputValues(prev => ({ ...prev, [feature]: value }));
    setPredictionResult(null);
    setError('');
  };

  const handleSinglePredict = async () => {
    setError('');
    setPredictionResult(null);

    // Validate all features have values
    const missingFeatures = model.features.filter(f => !inputValues[f] || inputValues[f].trim() === '');
    if (missingFeatures.length > 0) {
      setError(`Please enter values for: ${missingFeatures.join(', ')}`);
      return;
    }

    // Convert to numbers
    const numericData: Record<string, number> = {};
    for (const feature of model.features) {
      const val = parseFloat(inputValues[feature]);
      if (isNaN(val)) {
        setError(`Invalid number for ${feature}`);
        return;
      }
      numericData[feature] = val;
    }

    setLoading(true);
    try {
      const result = await onSinglePredict(model.id, numericData, label || undefined, withConfidence);
      setPredictionResult({
        predicted_value: result.prediction.predicted_value,
        confidence_low: result.prediction.confidence_low,
        confidence_high: result.prediction.confidence_high,
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Prediction failed');
    } finally {
      setLoading(false);
    }
  };

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setError('');
    setBatchResults(null);
    setLoading(true);

    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: async (results) => {
        try {
          const data = results.data as Record<string, unknown>[];

          if (data.length === 0) {
            setError('CSV file is empty');
            setLoading(false);
            return;
          }

          // Check for required features
          const csvColumns = Object.keys(data[0]);
          const missingFeatures = model.features.filter(f => !csvColumns.includes(f));
          if (missingFeatures.length > 0) {
            setError(`CSV missing required columns: ${missingFeatures.join(', ')}`);
            setLoading(false);
            return;
          }

          const result = await onBatchPredict(model.id, data);
          setBatchResults({ count: result.count });
        } catch (e) {
          setError(e instanceof Error ? e.message : 'Batch prediction failed');
        } finally {
          setLoading(false);
        }
      },
      error: (err) => {
        setError(`Failed to parse CSV: ${err.message}`);
        setLoading(false);
      }
    });

    // Reset file input
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content terminal-panel" onClick={e => e.stopPropagation()}>
        <div className="terminal-panel-header modal-header">
          <span>Predict with {model.name}</span>
          <button onClick={onClose} style={{ padding: '4px 12px', fontSize: '11px' }} disabled={loading}>
            Close
          </button>
        </div>

        <div className="tabs">
          <button
            className={`tab ${activeTab === 'single' ? 'active' : ''}`}
            onClick={() => { setActiveTab('single'); setError(''); }}
          >
            Manual Input
          </button>
          <button
            className={`tab ${activeTab === 'batch' ? 'active' : ''}`}
            onClick={() => { setActiveTab('batch'); setError(''); }}
          >
            CSV Upload
          </button>
        </div>

        <div style={{ padding: '16px' }}>
          {error && (
            <div style={{
              color: 'var(--red)',
              padding: '12px',
              background: 'rgba(255, 71, 87, 0.1)',
              border: '1px solid var(--red)',
              borderRadius: '4px',
              fontSize: '12px',
              marginBottom: '16px'
            }}>
              {error}
            </div>
          )}

          <div style={{
            marginBottom: '16px',
            padding: '12px',
            background: 'var(--bg-tertiary)',
            borderRadius: '4px',
            fontSize: '11px',
            color: 'var(--text-secondary)'
          }}>
            <div>Target: <span className="text-cyan">{model.target}</span></div>
            <div style={{ marginTop: '4px' }}>
              Required features: <span style={{ color: 'var(--text-primary)' }}>{model.features.join(', ')}</span>
            </div>
          </div>

          {activeTab === 'single' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              {/* Templates Section */}
              {templates.length > 0 && (
                <div style={{
                  padding: '12px',
                  background: 'var(--bg-secondary)',
                  borderRadius: '4px',
                  border: '1px solid var(--border-color)'
                }}>
                  <div style={{
                    fontSize: '11px',
                    color: 'var(--text-muted)',
                    marginBottom: '8px',
                    textTransform: 'uppercase',
                    letterSpacing: '0.5px'
                  }}>
                    Load Template
                  </div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                    {templates.map(template => (
                      <div
                        key={template.id}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '4px',
                          padding: '6px 10px',
                          background: 'var(--bg-tertiary)',
                          borderRadius: '4px',
                          border: '1px solid var(--border-color)',
                        }}
                      >
                        <button
                          onClick={() => handleLoadTemplate(template)}
                          style={{
                            padding: '0',
                            background: 'transparent',
                            border: 'none',
                            color: 'var(--cyan)',
                            fontSize: '12px',
                            cursor: 'pointer',
                          }}
                          title={template.description || 'Load this template'}
                        >
                          {template.name}
                        </button>
                        <button
                          onClick={() => handleDeleteTemplate(template.id)}
                          style={{
                            padding: '2px 4px',
                            background: 'transparent',
                            border: 'none',
                            color: 'var(--text-muted)',
                            fontSize: '10px',
                            cursor: 'pointer',
                          }}
                          title="Delete template"
                        >
                          x
                        </button>
                      </div>
                    ))}
                  </div>
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
                  Label (optional)
                </label>
                <input
                  type="text"
                  value={label}
                  onChange={e => setLabel(e.target.value)}
                  placeholder="e.g., Player name or description"
                  style={{ width: '100%' }}
                  disabled={loading}
                />
              </div>

              <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))',
                gap: '12px'
              }}>
                {model.features.map(feature => (
                  <div key={feature}>
                    <label style={{
                      display: 'block',
                      marginBottom: '4px',
                      color: 'var(--text-secondary)',
                      fontSize: '11px'
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
                      disabled={loading}
                    />
                  </div>
                ))}
              </div>

              {/* Confidence checkbox */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <input
                  type="checkbox"
                  id="withConfidence"
                  checked={withConfidence}
                  onChange={(e) => setWithConfidence(e.target.checked)}
                  disabled={loading}
                  style={{ width: '16px', height: '16px' }}
                />
                <label htmlFor="withConfidence" style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
                  Include 95% confidence interval
                </label>
              </div>

              {predictionResult !== null && (
                <div style={{
                  padding: '16px',
                  background: 'var(--bg-tertiary)',
                  borderRadius: '4px',
                  border: '1px solid var(--cyan)',
                  textAlign: 'center'
                }}>
                  <div style={{ fontSize: '11px', color: 'var(--text-secondary)', marginBottom: '4px' }}>
                    Predicted {model.target}
                  </div>
                  <div style={{ fontSize: '24px', color: 'var(--cyan)', fontWeight: 'bold' }}>
                    {predictionResult.predicted_value.toLocaleString(undefined, { maximumFractionDigits: 2 })}
                  </div>
                  {predictionResult.confidence_low !== null && predictionResult.confidence_low !== undefined &&
                   predictionResult.confidence_high !== null && predictionResult.confidence_high !== undefined && (
                    <div style={{ marginTop: '8px', fontSize: '12px', color: 'var(--text-muted)' }}>
                      95% Confidence: [{predictionResult.confidence_low.toFixed(2)} - {predictionResult.confidence_high.toFixed(2)}]
                    </div>
                  )}
                </div>
              )}

              <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
                <button
                  onClick={handleSinglePredict}
                  disabled={loading}
                  style={{
                    background: 'var(--cyan)',
                    color: 'var(--bg-primary)',
                    borderColor: 'var(--cyan)',
                    padding: '12px 24px'
                  }}
                >
                  {loading ? 'Predicting...' : 'Generate Prediction'}
                </button>

                <button
                  onClick={() => setShowSaveTemplate(!showSaveTemplate)}
                  disabled={loading}
                  style={{
                    padding: '12px 16px',
                    color: 'var(--yellow)',
                    borderColor: 'var(--yellow)',
                    background: showSaveTemplate ? 'rgba(255, 165, 2, 0.1)' : 'transparent',
                  }}
                >
                  {showSaveTemplate ? 'Cancel' : 'Save as Template'}
                </button>
              </div>

              {/* Save Template Form */}
              {showSaveTemplate && (
                <div style={{
                  padding: '12px',
                  background: 'var(--bg-secondary)',
                  borderRadius: '4px',
                  border: '1px solid var(--yellow)',
                }}>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                    <div>
                      <label style={{
                        display: 'block',
                        marginBottom: '4px',
                        color: 'var(--text-secondary)',
                        fontSize: '11px',
                        textTransform: 'uppercase',
                      }}>
                        Template Name *
                      </label>
                      <input
                        type="text"
                        value={templateName}
                        onChange={e => setTemplateName(e.target.value)}
                        placeholder="e.g., High-usage player"
                        style={{ width: '100%' }}
                        disabled={savingTemplate}
                      />
                    </div>
                    <div>
                      <label style={{
                        display: 'block',
                        marginBottom: '4px',
                        color: 'var(--text-secondary)',
                        fontSize: '11px',
                        textTransform: 'uppercase',
                      }}>
                        Description (optional)
                      </label>
                      <input
                        type="text"
                        value={templateDesc}
                        onChange={e => setTemplateDesc(e.target.value)}
                        placeholder="e.g., Typical star player stats"
                        style={{ width: '100%' }}
                        disabled={savingTemplate}
                      />
                    </div>
                    <button
                      onClick={handleSaveTemplate}
                      disabled={savingTemplate || !templateName.trim()}
                      style={{
                        padding: '8px 16px',
                        background: templateName.trim() ? 'var(--yellow)' : 'var(--bg-tertiary)',
                        color: templateName.trim() ? 'var(--bg-primary)' : 'var(--text-muted)',
                        borderColor: templateName.trim() ? 'var(--yellow)' : 'var(--border-color)',
                      }}
                    >
                      {savingTemplate ? 'Saving...' : 'Save Template'}
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {activeTab === 'batch' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div style={{
                padding: '24px',
                border: '2px dashed var(--border-color)',
                borderRadius: '4px',
                textAlign: 'center'
              }}>
                <input
                  type="file"
                  accept=".csv"
                  ref={fileInputRef}
                  onChange={handleFileUpload}
                  style={{ display: 'none' }}
                  disabled={loading}
                />
                <div style={{ marginBottom: '12px', color: 'var(--text-secondary)' }}>
                  Upload a CSV file with the required feature columns
                </div>
                <button
                  onClick={() => fileInputRef.current?.click()}
                  disabled={loading}
                  style={{
                    background: 'var(--cyan)',
                    color: 'var(--bg-primary)',
                    borderColor: 'var(--cyan)'
                  }}
                >
                  {loading ? 'Processing...' : 'Select CSV File'}
                </button>
              </div>

              {batchResults && (
                <div style={{
                  padding: '16px',
                  background: 'var(--bg-tertiary)',
                  borderRadius: '4px',
                  border: '1px solid var(--green)',
                  textAlign: 'center'
                }}>
                  <div style={{ fontSize: '11px', color: 'var(--text-secondary)', marginBottom: '4px' }}>
                    Predictions Generated
                  </div>
                  <div style={{ fontSize: '24px', color: 'var(--green)', fontWeight: 'bold' }}>
                    {batchResults.count.toLocaleString()}
                  </div>
                  <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '4px' }}>
                    View results in the Predictions tab
                  </div>
                </div>
              )}

              <div style={{
                fontSize: '11px',
                color: 'var(--text-muted)',
                padding: '12px',
                background: 'var(--bg-secondary)',
                borderRadius: '4px'
              }}>
                <strong>CSV Format:</strong> Your CSV must include columns for each required feature.
                Column names must match exactly: {model.features.join(', ')}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
