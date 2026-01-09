import { useState } from 'react';
import { importDatasetFromUrl } from '../api/client';
import { useKeyboardShortcuts } from '../hooks/useKeyboardShortcuts';

interface ImportUrlModalProps {
  onClose: () => void;
  onImported: () => void;
}

export function ImportUrlModal({ onClose, onImported }: ImportUrlModalProps) {
  const [url, setUrl] = useState('');
  const [name, setName] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useKeyboardShortcuts({ onEscape: onClose, enabled: !loading });

  const handleSubmit = async () => {
    if (!url.trim()) {
      setError('Please enter a URL');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const result = await importDatasetFromUrl(url.trim(), name.trim() || undefined);

      if (result.detail) {
        throw new Error(result.detail);
      }

      onImported();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to import dataset');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div
        className="modal-content terminal-panel"
        onClick={(e) => e.stopPropagation()}
        style={{ maxWidth: '500px', width: '90%' }}
      >
        <div className="terminal-panel-header modal-header">
          <span>Import from URL</span>
          <button onClick={onClose} style={{ padding: '4px 12px', fontSize: '11px' }}>
            Close
          </button>
        </div>

        <div style={{ padding: '20px' }}>
          {error && (
            <div style={{
              marginBottom: '16px',
              padding: '12px',
              background: 'rgba(255, 71, 87, 0.2)',
              borderRadius: '4px',
              color: 'var(--red)',
              fontSize: '12px',
            }}>
              {error}
            </div>
          )}

          <div style={{ marginBottom: '16px' }}>
            <label style={{ fontSize: '11px', color: 'var(--text-secondary)', display: 'block', marginBottom: '6px' }}>
              CSV URL *
            </label>
            <input
              type="url"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://example.com/data.csv"
              style={{
                width: '100%',
                padding: '10px 12px',
                fontSize: '12px',
                background: 'var(--bg-secondary)',
                border: '1px solid var(--border-color)',
                borderRadius: '4px',
                color: 'var(--text-primary)',
              }}
            />
            <div style={{ fontSize: '10px', color: 'var(--text-muted)', marginTop: '4px' }}>
              The URL must point directly to a CSV file
            </div>
          </div>

          <div style={{ marginBottom: '16px' }}>
            <label style={{ fontSize: '11px', color: 'var(--text-secondary)', display: 'block', marginBottom: '6px' }}>
              Dataset Name (optional)
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Leave empty to extract from URL"
              style={{
                width: '100%',
                padding: '10px 12px',
                fontSize: '12px',
                background: 'var(--bg-secondary)',
                border: '1px solid var(--border-color)',
                borderRadius: '4px',
                color: 'var(--text-primary)',
              }}
            />
          </div>

          <div style={{
            padding: '12px',
            background: 'var(--bg-tertiary)',
            borderRadius: '4px',
            border: '1px solid var(--border-color)',
            fontSize: '11px',
            color: 'var(--text-muted)',
          }}>
            <strong>Note:</strong> The URL must be publicly accessible and return a valid CSV file.
            CORS restrictions may prevent some URLs from working.
          </div>
        </div>

        {/* Footer */}
        <div style={{
          padding: '12px 20px',
          borderTop: '1px solid var(--border-color)',
          display: 'flex',
          justifyContent: 'flex-end',
          gap: '12px',
        }}>
          <button
            onClick={onClose}
            disabled={loading}
            style={{ padding: '8px 16px', fontSize: '12px' }}
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={loading || !url.trim()}
            style={{
              padding: '8px 16px',
              fontSize: '12px',
              background: url.trim() ? 'var(--cyan)' : 'var(--bg-tertiary)',
              color: url.trim() ? 'var(--bg-primary)' : 'var(--text-muted)',
              border: 'none',
            }}
          >
            {loading ? 'Importing...' : 'Import'}
          </button>
        </div>
      </div>
    </div>
  );
}
