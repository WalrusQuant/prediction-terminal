import { useRef } from 'react';

interface Dataset {
  id: string;
  name: string;
  rows: number;
  columns: number;
  features?: string[];
}

interface DataPanelProps {
  datasets: Dataset[];
  loading: boolean;
  onUpload: (file: File) => void;
  onView: (dataset: Dataset) => void;
  onUse: (dataset: Dataset) => void;
  onDelete: (datasetId: string) => void;
}

export function DataPanel({ datasets, loading, onUpload, onView, onUse, onDelete }: DataPanelProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      onUpload(file);
      // Reset input so same file can be uploaded again
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  return (
    <div className="terminal-panel">
      <div className="terminal-panel-header" style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center'
      }}>
        <span>Datasets ({datasets.length})</span>
        <button onClick={() => fileInputRef.current?.click()}>
          + Upload CSV
        </button>
        <input
          ref={fileInputRef}
          type="file"
          accept=".csv"
          onChange={handleFileChange}
          style={{ display: 'none' }}
        />
      </div>

      {loading ? (
        <div style={{ padding: '24px', textAlign: 'center', color: 'var(--text-muted)' }}>
          Loading datasets...
        </div>
      ) : datasets.length === 0 ? (
        <div style={{ padding: '24px', textAlign: 'center', color: 'var(--text-muted)' }}>
          No datasets uploaded yet. Upload a CSV file to get started.
        </div>
      ) : (
        <table className="terminal-table">
          <thead>
            <tr>
              <th>Name</th>
              <th>Rows</th>
              <th>Columns</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {datasets.map((dataset) => (
              <tr key={dataset.id}>
                <td>{dataset.name}</td>
                <td className="text-cyan">{dataset.rows.toLocaleString()}</td>
                <td>{dataset.columns}</td>
                <td>
                  <button
                    onClick={() => onView(dataset)}
                    style={{
                      padding: '4px 8px',
                      fontSize: '11px',
                      marginRight: '8px'
                    }}
                  >
                    View
                  </button>
                  <button
                    onClick={() => onUse(dataset)}
                    style={{
                      padding: '4px 8px',
                      fontSize: '11px',
                      marginRight: '8px',
                      background: 'var(--cyan)',
                      color: 'var(--bg-primary)',
                      borderColor: 'var(--cyan)'
                    }}
                  >
                    Train Model
                  </button>
                  <button
                    onClick={() => onDelete(dataset.id)}
                    style={{
                      padding: '4px 8px',
                      fontSize: '11px',
                      color: 'var(--red)',
                      borderColor: 'var(--red)'
                    }}
                  >
                    Delete
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
