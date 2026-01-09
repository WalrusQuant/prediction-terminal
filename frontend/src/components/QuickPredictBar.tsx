import { useState } from 'react';
import { createSinglePrediction } from '../api/client';

interface Model {
  id: string;
  name: string;
  features: string[];
  target: string;
}

interface QuickPredictBarProps {
  model: Model;
  onUnpin: () => void;
  onPredictionMade: (prediction: number) => void;
}

export function QuickPredictBar({ model, onUnpin, onPredictionMade }: QuickPredictBarProps) {
  const [inputs, setInputs] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);
  const [lastPrediction, setLastPrediction] = useState<number | null>(null);
  const [error, setError] = useState('');

  const handleInputChange = (feature: string, value: string) => {
    setInputs(prev => ({ ...prev, [feature]: value }));
  };

  const handlePredict = async () => {
    // Validate all inputs
    const numericInputs: Record<string, number> = {};
    for (const feature of model.features) {
      const value = parseFloat(inputs[feature] || '');
      if (isNaN(value)) {
        setError(`Please enter a valid number for ${feature}`);
        return;
      }
      numericInputs[feature] = value;
    }

    setLoading(true);
    setError('');

    try {
      const result = await createSinglePrediction(model.id, numericInputs, 'Quick predict');

      if (result.error) {
        throw new Error(result.detail || result.error);
      }

      // result.prediction is an object with predicted_value, not a number directly
      const predValue = Number(result.prediction?.predicted_value ?? result.prediction);
      setLastPrediction(predValue);
      onPredictionMade(predValue);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Prediction failed');
    } finally {
      setLoading(false);
    }
  };

  const allFieldsFilled = model.features.every(f => inputs[f]?.trim() !== '' && inputs[f] !== undefined);

  return (
    <div style={{
      position: 'fixed',
      bottom: '20px',
      left: '50%',
      transform: 'translateX(-50%)',
      background: 'var(--bg-secondary)',
      border: '1px solid var(--cyan)',
      borderRadius: '8px',
      padding: '12px 16px',
      display: 'flex',
      alignItems: 'center',
      gap: '12px',
      boxShadow: '0 4px 20px rgba(0, 0, 0, 0.3)',
      zIndex: 1000,
      maxWidth: '90vw',
      overflowX: 'auto',
    }}>
      {/* Model name */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: '8px',
        borderRight: '1px solid var(--border-color)',
        paddingRight: '12px',
      }}>
        <span style={{ fontSize: '14px', color: 'var(--cyan)' }}>&#9733;</span>
        <span style={{ fontSize: '12px', fontWeight: 500, color: 'var(--text-primary)' }}>
          {model.name}
        </span>
        <button
          onClick={onUnpin}
          style={{
            padding: '2px 6px',
            fontSize: '10px',
            background: 'transparent',
            border: 'none',
            color: 'var(--text-muted)',
            cursor: 'pointer',
          }}
          title="Unpin model"
        >
          x
        </button>
      </div>

      {/* Input fields */}
      <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
        {model.features.slice(0, 5).map(feature => (
          <div key={feature} style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
            <label style={{ fontSize: '9px', color: 'var(--text-muted)', textTransform: 'uppercase' }}>
              {feature.length > 10 ? feature.slice(0, 10) + '...' : feature}
            </label>
            <input
              type="number"
              value={inputs[feature] || ''}
              onChange={(e) => handleInputChange(feature, e.target.value)}
              style={{
                width: '70px',
                padding: '4px 6px',
                fontSize: '11px',
                background: 'var(--bg-tertiary)',
                border: '1px solid var(--border-color)',
                borderRadius: '4px',
                color: 'var(--text-primary)',
              }}
              placeholder="0"
            />
          </div>
        ))}
        {model.features.length > 5 && (
          <span style={{ fontSize: '10px', color: 'var(--text-muted)' }}>
            +{model.features.length - 5} more
          </span>
        )}
      </div>

      {/* Predict button */}
      <button
        onClick={handlePredict}
        disabled={loading || !allFieldsFilled}
        style={{
          padding: '8px 16px',
          fontSize: '12px',
          background: allFieldsFilled ? 'var(--cyan)' : 'var(--bg-tertiary)',
          color: allFieldsFilled ? 'var(--bg-primary)' : 'var(--text-muted)',
          border: 'none',
          borderRadius: '4px',
          cursor: allFieldsFilled ? 'pointer' : 'default',
          whiteSpace: 'nowrap',
        }}
      >
        {loading ? 'Predicting...' : 'Predict'}
      </button>

      {/* Result / Error */}
      {(lastPrediction !== null || error) && (
        <div style={{
          borderLeft: '1px solid var(--border-color)',
          paddingLeft: '12px',
          display: 'flex',
          flexDirection: 'column',
          gap: '2px',
        }}>
          <span style={{ fontSize: '9px', color: 'var(--text-muted)', textTransform: 'uppercase' }}>
            {model.target}
          </span>
          {error ? (
            <span style={{ fontSize: '12px', color: 'var(--red)' }}>{error}</span>
          ) : (
            <span style={{ fontSize: '16px', fontWeight: 'bold', color: 'var(--green)' }}>
              {lastPrediction?.toFixed(2)}
            </span>
          )}
        </div>
      )}
    </div>
  );
}
