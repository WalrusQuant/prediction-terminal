import { useState, useEffect } from 'react';
import { analyzeFeatures, type FeatureAnalysisResult, type FeatureAnalysis } from '../api/client';
import { useKeyboardShortcuts } from '../hooks/useKeyboardShortcuts';

interface FeatureAnalysisModalProps {
  datasetId: string;
  datasetName: string;
  target: string;
  currentFeatures: string[];
  onClose: () => void;
  onApply: (selectedFeatures: string[]) => void;
}

const recommendationColors: Record<string, string> = {
  good: 'var(--green)',
  moderate: 'var(--cyan)',
  weak: 'var(--text-secondary)',
  very_weak: 'var(--text-muted)',
  caution: 'var(--yellow)',
  avoid: 'var(--red)',
  categorical: 'var(--purple, #a78bfa)',
  neutral: 'var(--text-secondary)',
};

const recommendationLabels: Record<string, string> = {
  good: 'Good',
  moderate: 'Moderate',
  weak: 'Weak',
  very_weak: 'Very Weak',
  caution: 'Caution',
  avoid: 'Avoid',
  categorical: 'Categorical',
  neutral: 'Neutral',
};

export function FeatureAnalysisModal({
  datasetId,
  datasetName,
  target,
  currentFeatures,
  onClose,
  onApply,
}: FeatureAnalysisModalProps) {
  const [analysis, setAnalysis] = useState<FeatureAnalysisResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selectedFeatures, setSelectedFeatures] = useState<Set<string>>(new Set(currentFeatures));

  useKeyboardShortcuts({ onEscape: onClose });

  useEffect(() => {
    loadAnalysis();
  }, [datasetId, target]);

  const loadAnalysis = async () => {
    setLoading(true);
    setError('');
    try {
      const result = await analyzeFeatures(datasetId, target);
      setAnalysis(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to analyze features');
    } finally {
      setLoading(false);
    }
  };

  const toggleFeature = (feature: string) => {
    setSelectedFeatures(prev => {
      const next = new Set(prev);
      if (next.has(feature)) {
        next.delete(feature);
      } else {
        next.add(feature);
      }
      return next;
    });
  };

  const selectRecommended = () => {
    if (!analysis) return;
    const recommended = new Set([
      ...analysis.summary.good,
      ...analysis.summary.moderate,
    ]);
    setSelectedFeatures(recommended);
  };

  const selectAll = () => {
    if (!analysis) return;
    const all = new Set(analysis.features.map(f => f.feature));
    setSelectedFeatures(all);
  };

  const clearAll = () => {
    setSelectedFeatures(new Set());
  };

  const handleApply = () => {
    onApply(Array.from(selectedFeatures));
    onClose();
  };

  const getCorrelationBar = (corr: number | null) => {
    if (corr === null) return null;
    const absCorr = Math.abs(corr);
    const width = Math.min(absCorr * 100, 100);
    const color = corr >= 0 ? 'var(--green)' : 'var(--red)';
    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', minWidth: '150px' }}>
        <div style={{
          width: '80px',
          height: '8px',
          background: 'var(--bg-tertiary)',
          borderRadius: '4px',
          overflow: 'hidden',
        }}>
          <div style={{
            width: `${width}%`,
            height: '100%',
            background: color,
            borderRadius: '4px',
          }} />
        </div>
        <span style={{ fontSize: '11px', color: 'var(--text-secondary)', minWidth: '50px' }}>
          {corr.toFixed(3)}
        </span>
      </div>
    );
  };

  if (loading) {
    return (
      <div className="modal-overlay" onClick={onClose}>
        <div className="modal-content terminal-panel" onClick={e => e.stopPropagation()} style={{ maxWidth: '900px', width: '90%' }}>
          <div className="terminal-panel-header modal-header">
            <span>Feature Analysis: {target}</span>
            <button onClick={onClose} style={{ padding: '4px 12px', fontSize: '11px' }}>Close</button>
          </div>
          <div style={{ padding: '48px', textAlign: 'center', color: 'var(--text-muted)' }}>
            Analyzing features...
          </div>
        </div>
      </div>
    );
  }

  if (error || !analysis) {
    return (
      <div className="modal-overlay" onClick={onClose}>
        <div className="modal-content terminal-panel" onClick={e => e.stopPropagation()} style={{ maxWidth: '600px' }}>
          <div className="terminal-panel-header modal-header">
            <span>Feature Analysis</span>
            <button onClick={onClose} style={{ padding: '4px 12px', fontSize: '11px' }}>Close</button>
          </div>
          <div style={{ padding: '24px', color: 'var(--red)' }}>
            {error || 'Failed to analyze features'}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div
        className="modal-content terminal-panel"
        onClick={e => e.stopPropagation()}
        style={{ maxWidth: '1000px', width: '95%', maxHeight: '90vh', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}
      >
        <div className="terminal-panel-header modal-header">
          <span>Feature Analysis for Target: {target}</span>
          <button onClick={onClose} style={{ padding: '4px 12px', fontSize: '11px' }}>Close</button>
        </div>

        <div style={{ padding: '16px', borderBottom: '1px solid var(--border-color)' }}>
          {/* Summary */}
          <div style={{ display: 'flex', gap: '24px', flexWrap: 'wrap', marginBottom: '12px' }}>
            <div style={{ fontSize: '12px' }}>
              <span style={{ color: 'var(--text-secondary)' }}>Total Features: </span>
              <span style={{ color: 'var(--text-primary)' }}>{analysis.total_features}</span>
            </div>
            <div style={{ fontSize: '12px' }}>
              <span style={{ color: 'var(--text-secondary)' }}>Numeric: </span>
              <span style={{ color: 'var(--text-primary)' }}>{analysis.numeric_features}</span>
            </div>
            <div style={{ fontSize: '12px' }}>
              <span style={{ color: 'var(--text-secondary)' }}>Selected: </span>
              <span style={{ color: 'var(--cyan)' }}>{selectedFeatures.size}</span>
            </div>
          </div>

          {/* Legend */}
          <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap', marginBottom: '12px' }}>
            {Object.entries(recommendationLabels).map(([key, label]) => (
              <div key={key} style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '10px' }}>
                <div style={{ width: '8px', height: '8px', borderRadius: '2px', background: recommendationColors[key] }} />
                <span style={{ color: 'var(--text-secondary)' }}>{label}</span>
              </div>
            ))}
          </div>

          {/* Quick Actions */}
          <div style={{ display: 'flex', gap: '8px' }}>
            <button onClick={selectRecommended} style={{ padding: '4px 12px', fontSize: '11px' }}>
              Select Recommended
            </button>
            <button onClick={selectAll} style={{ padding: '4px 12px', fontSize: '11px' }}>
              Select All
            </button>
            <button onClick={clearAll} style={{ padding: '4px 12px', fontSize: '11px' }}>
              Clear All
            </button>
          </div>
        </div>

        {/* Warning Banner */}
        {analysis.summary.avoid.length > 0 && (
          <div style={{
            padding: '12px 16px',
            background: 'rgba(239, 68, 68, 0.1)',
            borderBottom: '1px solid var(--border-color)',
            fontSize: '12px',
            color: 'var(--red)',
          }}>
            <strong>Warning:</strong> {analysis.summary.avoid.length} feature(s) have extremely high correlation with the target
            and may cause data leakage: {analysis.summary.avoid.join(', ')}
          </div>
        )}

        {/* Feature Table */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '0' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
            <thead>
              <tr style={{ background: 'var(--bg-tertiary)', position: 'sticky', top: 0 }}>
                <th style={{ padding: '10px 12px', textAlign: 'left', fontWeight: 500, width: '40px' }}>
                  <input
                    type="checkbox"
                    checked={selectedFeatures.size === analysis.features.length}
                    onChange={() => selectedFeatures.size === analysis.features.length ? clearAll() : selectAll()}
                  />
                </th>
                <th style={{ padding: '10px 12px', textAlign: 'left', fontWeight: 500 }}>Feature</th>
                <th style={{ padding: '10px 12px', textAlign: 'left', fontWeight: 500 }}>Correlation</th>
                <th style={{ padding: '10px 12px', textAlign: 'left', fontWeight: 500 }}>Status</th>
                <th style={{ padding: '10px 12px', textAlign: 'left', fontWeight: 500 }}>Warning</th>
              </tr>
            </thead>
            <tbody>
              {analysis.features.map((feature: FeatureAnalysis) => (
                <tr
                  key={feature.feature}
                  style={{
                    borderBottom: '1px solid var(--border-color)',
                    background: selectedFeatures.has(feature.feature) ? 'rgba(6, 182, 212, 0.1)' : 'transparent',
                    cursor: 'pointer',
                  }}
                  onClick={() => toggleFeature(feature.feature)}
                >
                  <td style={{ padding: '10px 12px' }}>
                    <input
                      type="checkbox"
                      checked={selectedFeatures.has(feature.feature)}
                      onChange={() => toggleFeature(feature.feature)}
                      onClick={e => e.stopPropagation()}
                    />
                  </td>
                  <td style={{ padding: '10px 12px' }}>
                    <div style={{ fontWeight: 500, color: 'var(--text-primary)' }}>{feature.feature}</div>
                    <div style={{ fontSize: '10px', color: 'var(--text-muted)' }}>
                      {feature.dtype} · {feature.unique_count} unique
                      {feature.missing_count > 0 && ` · ${feature.missing_percent}% missing`}
                    </div>
                  </td>
                  <td style={{ padding: '10px 12px' }}>
                    {feature.is_numeric ? getCorrelationBar(feature.correlation) : (
                      <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>N/A (categorical)</span>
                    )}
                  </td>
                  <td style={{ padding: '10px 12px' }}>
                    <span style={{
                      padding: '2px 8px',
                      borderRadius: '4px',
                      fontSize: '10px',
                      fontWeight: 500,
                      background: `${recommendationColors[feature.recommendation]}20`,
                      color: recommendationColors[feature.recommendation],
                    }}>
                      {recommendationLabels[feature.recommendation]}
                    </span>
                  </td>
                  <td style={{ padding: '10px 12px', fontSize: '11px', color: 'var(--text-secondary)' }}>
                    {feature.warning || '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Footer */}
        <div style={{
          padding: '12px 16px',
          borderTop: '1px solid var(--border-color)',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
        }}>
          <div style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>
            {analysis.suggestion}
          </div>
          <div style={{ display: 'flex', gap: '8px' }}>
            <button onClick={onClose} style={{ padding: '6px 16px', fontSize: '12px' }}>
              Cancel
            </button>
            <button
              onClick={handleApply}
              disabled={selectedFeatures.size === 0}
              style={{
                padding: '6px 16px',
                fontSize: '12px',
                background: selectedFeatures.size > 0 ? 'var(--cyan)' : 'var(--bg-tertiary)',
                color: selectedFeatures.size > 0 ? 'var(--bg-primary)' : 'var(--text-muted)',
                borderColor: selectedFeatures.size > 0 ? 'var(--cyan)' : 'var(--border-color)',
              }}
            >
              Apply Selection ({selectedFeatures.size} features)
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
