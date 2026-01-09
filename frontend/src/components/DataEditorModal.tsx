import { useState, useEffect, useCallback } from 'react';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
} from '@dnd-kit/core';
import type { DragEndEvent } from '@dnd-kit/core';
import {
  SortableContext,
  horizontalListSortingStrategy,
} from '@dnd-kit/sortable';
import {
  fetchDataQuality,
  fetchDatasetRows,
  cleanDataset,
  fetchDatasetHistory,
  restoreDatasetSnapshot,
  type DataQualityAnalysis,
  type PaginatedRows,
  type CleanOperation,
  type Snapshot,
} from '../api/client';
import { useKeyboardShortcuts } from '../hooks/useKeyboardShortcuts';
import { FeatureEngineerModal } from './FeatureEngineerModal';
import { DraggableTableHeader } from './DraggableTableHeader';

interface DataEditorModalProps {
  datasetId: string;
  datasetName: string;
  onClose: () => void;
  onDataChanged: () => void;
}

export function DataEditorModal({
  datasetId,
  datasetName,
  onClose,
  onDataChanged,
}: DataEditorModalProps) {
  const [analysis, setAnalysis] = useState<DataQualityAnalysis | null>(null);
  const [rows, setRows] = useState<PaginatedRows | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [selectedRows, setSelectedRows] = useState<Set<number>>(new Set());
  const [pendingOperations, setPendingOperations] = useState<CleanOperation[]>([]);
  const [loading, setLoading] = useState(true);
  const [applying, setApplying] = useState(false);
  const [error, setError] = useState('');
  const [iqrMultiplier, setIqrMultiplier] = useState(1.5);
  const [sortColumn, setSortColumn] = useState<string | null>(null);
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');
  const [searchTerm, setSearchTerm] = useState('');
  const [snapshots, setSnapshots] = useState<Snapshot[]>([]);
  const [showHistory, setShowHistory] = useState(false);
  const [restoring, setRestoring] = useState(false);
  const [showFeatureEngineer, setShowFeatureEngineer] = useState(false);
  const [columnOrder, setColumnOrder] = useState<string[]>([]);

  // DnD sensors
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    }),
    useSensor(KeyboardSensor)
  );

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (over && active.id !== over.id) {
      setColumnOrder(current => {
        const activeIndex = current.indexOf(String(active.id));
        const overIndex = current.indexOf(String(over.id));
        if (activeIndex === -1 || overIndex === -1) return current;
        const newOrder = [...current];
        newOrder.splice(activeIndex, 1);
        newOrder.splice(overIndex, 0, String(active.id));
        // Save to localStorage
        localStorage.setItem(`column-order-data-${datasetId}`, JSON.stringify(newOrder));
        return newOrder;
      });
    }
  };

  const resetColumnOrder = () => {
    if (rows) {
      setColumnOrder(rows.columns);
      localStorage.removeItem(`column-order-data-${datasetId}`);
    }
  };

  // Keyboard shortcuts
  useKeyboardShortcuts({
    onEscape: () => !applying && onClose(),
    enabled: !applying,
  });

  const loadData = useCallback(
    async (page: number = 1, iqr: number = iqrMultiplier) => {
      setLoading(true);
      setError('');
      try {
        const [qualityData, rowsData, historyData] = await Promise.all([
          fetchDataQuality(datasetId, iqr),
          fetchDatasetRows(datasetId, page, 50, iqr),
          fetchDatasetHistory(datasetId),
        ]);
        setAnalysis(qualityData);
        setRows(rowsData);
        setCurrentPage(page);
        setSnapshots(historyData.snapshots || []);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load data');
      } finally {
        setLoading(false);
      }
    },
    [datasetId, iqrMultiplier]
  );

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Initialize column order when rows load
  useEffect(() => {
    if (rows && rows.columns.length > 0) {
      // Try to load saved order from localStorage
      try {
        const saved = localStorage.getItem(`column-order-data-${datasetId}`);
        if (saved) {
          const savedOrder = JSON.parse(saved);
          // Validate saved order contains all current columns
          const currentCols = new Set(rows.columns);
          const validSaved = savedOrder.filter((col: string) => currentCols.has(col));
          // Add any new columns not in saved order
          const savedSet = new Set(validSaved);
          const newCols = rows.columns.filter(col => !savedSet.has(col));
          setColumnOrder([...validSaved, ...newCols]);
        } else {
          setColumnOrder(rows.columns);
        }
      } catch {
        setColumnOrder(rows.columns);
      }
    }
  }, [rows, datasetId]);

  const addOperation = (op: CleanOperation) => {
    setPendingOperations((prev) => [...prev, op]);
  };

  const removeOperation = (index: number) => {
    setPendingOperations((prev) => prev.filter((_, i) => i !== index));
  };

  const applyOperations = async () => {
    if (pendingOperations.length === 0) return;

    setApplying(true);
    setError('');
    try {
      await cleanDataset(datasetId, pendingOperations);
      setPendingOperations([]);
      setSelectedRows(new Set());
      await loadData(1);
      onDataChanged();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to apply changes');
    } finally {
      setApplying(false);
    }
  };

  const handleRestore = async (snapshotId: string) => {
    if (!confirm('Restore dataset to this point? Current state will be saved as a snapshot.')) {
      return;
    }

    setRestoring(true);
    setError('');
    try {
      await restoreDatasetSnapshot(datasetId, snapshotId);
      setShowHistory(false);
      await loadData(1);
      onDataChanged();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to restore snapshot');
    } finally {
      setRestoring(false);
    }
  };

  const handlePageChange = async (newPage: number) => {
    await loadData(newPage);
    setSelectedRows(new Set());
  };

  const toggleRowSelection = (rowIndex: number) => {
    setSelectedRows((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(rowIndex)) {
        newSet.delete(rowIndex);
      } else {
        newSet.add(rowIndex);
      }
      return newSet;
    });
  };

  const selectAllOnPage = () => {
    if (!rows) return;
    const pageIndices = new Set<number>();
    for (let i = rows.start_index; i < rows.end_index; i++) {
      pageIndices.add(i);
    }
    setSelectedRows(pageIndices);
  };

  const clearSelection = () => {
    setSelectedRows(new Set());
  };

  const toggleSort = (column: string) => {
    if (sortColumn === column) {
      setSortDirection(prev => prev === 'asc' ? 'desc' : 'asc');
    } else {
      setSortColumn(column);
      setSortDirection('asc');
    }
  };

  // Sort and filter rows
  type RowWithIndex = Record<string, unknown> & { __originalIndex: number };

  const getProcessedRows = (): RowWithIndex[] => {
    if (!rows) return [];

    let processedRows: RowWithIndex[] = rows.rows.map((row, idx) => ({
      ...row,
      __originalIndex: rows.start_index + idx
    }));

    // Filter by search term
    if (searchTerm.trim()) {
      const term = searchTerm.toLowerCase();
      processedRows = processedRows.filter(row =>
        Object.values(row).some(val =>
          val !== null && val !== undefined && String(val).toLowerCase().includes(term)
        )
      );
    }

    // Sort if column selected
    if (sortColumn) {
      processedRows.sort((a, b) => {
        const aVal = a[sortColumn];
        const bVal = b[sortColumn];

        // Handle nulls
        if (aVal === null || aVal === undefined) return sortDirection === 'asc' ? 1 : -1;
        if (bVal === null || bVal === undefined) return sortDirection === 'asc' ? -1 : 1;

        // Compare
        if (typeof aVal === 'number' && typeof bVal === 'number') {
          return sortDirection === 'asc' ? aVal - bVal : bVal - aVal;
        }

        const aStr = String(aVal).toLowerCase();
        const bStr = String(bVal).toLowerCase();
        return sortDirection === 'asc'
          ? aStr.localeCompare(bStr)
          : bStr.localeCompare(aStr);
      });
    }

    return processedRows;
  };

  const processedRows = rows ? getProcessedRows() : [];

  const getOperationLabel = (op: CleanOperation): string => {
    switch (op.type) {
      case 'fill_missing':
        return `Fill ${op.column} (${op.strategy})`;
      case 'delete_column':
        return `Delete column: ${op.column}`;
      case 'delete_rows':
        return `Delete ${op.indices?.length} rows`;
      case 'remove_duplicates':
        return 'Remove duplicates';
      case 'remove_outliers':
        return `Remove outliers: ${op.column}`;
      default:
        return op.type;
    }
  };

  if (!analysis || !rows) {
    return (
      <div className="modal-overlay" onClick={onClose}>
        <div
          className="modal-content terminal-panel"
          onClick={(e) => e.stopPropagation()}
          style={{ maxWidth: '1000px', width: '90%' }}
        >
          <div className="terminal-panel-header modal-header">
            <span>Edit Data: {datasetName}</span>
            <button onClick={onClose} style={{ padding: '4px 12px', fontSize: '11px' }}>
              Close
            </button>
          </div>
          <div style={{ padding: '24px', textAlign: 'center' }}>
            {loading ? (
              <span className="text-muted">Loading data...</span>
            ) : error ? (
              <span className="text-red">{error}</span>
            ) : null}
          </div>
        </div>
      </div>
    );
  }

  // Handle error responses from API
  if ('error' in analysis) {
    return (
      <div className="modal-overlay" onClick={onClose}>
        <div
          className="modal-content terminal-panel"
          onClick={(e) => e.stopPropagation()}
          style={{ maxWidth: '600px' }}
        >
          <div className="terminal-panel-header modal-header">
            <span>Edit Data: {datasetName}</span>
            <button onClick={onClose} style={{ padding: '4px 12px', fontSize: '11px' }}>
              Close
            </button>
          </div>
          <div style={{ padding: '24px' }}>
            <div style={{ color: 'var(--red)', marginBottom: '16px' }}>
              Error loading data: {(analysis as { error: string }).error}
            </div>
            <button onClick={() => loadData(1)} style={{ padding: '8px 16px' }}>
              Retry
            </button>
          </div>
        </div>
      </div>
    );
  }

  const { issues, summary, columns } = analysis;
  const totalOutliers = columns.reduce((sum, col) => sum + col.outlier_count, 0);

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div
        className="modal-content terminal-panel"
        onClick={(e) => e.stopPropagation()}
        style={{ maxWidth: '1600px', width: '98%', maxHeight: '90vh', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}
      >
        <div className="terminal-panel-header modal-header">
          <div>
            <span>Edit Data: {datasetName}</span>
            <span style={{ marginLeft: '16px', color: 'var(--text-secondary)', fontSize: '11px' }}>
              {analysis.total_rows.toLocaleString()} rows, {analysis.total_columns} columns
            </span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            {summary.has_issues ? (
              <span className="text-yellow" style={{ fontSize: '11px' }}>Issues detected</span>
            ) : (
              <span className="text-green" style={{ fontSize: '11px' }}>Data looks good</span>
            )}
            <button onClick={onClose} style={{ padding: '4px 12px', fontSize: '11px' }}>
              Close
            </button>
          </div>
        </div>

        <div style={{ padding: '16px', overflowY: 'auto', flex: 1 }}>
          {error && (
            <div style={{ marginBottom: '16px', padding: '12px', background: 'rgba(255, 71, 87, 0.2)', borderRadius: '4px', color: 'var(--red)' }}>
              {error}
            </div>
          )}

          {/* Controls Bar */}
          <div style={{
            marginBottom: '16px',
            padding: '12px',
            background: 'var(--bg-tertiary)',
            borderRadius: '4px',
            display: 'flex',
            alignItems: 'center',
            gap: '12px',
            justifyContent: 'space-between'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <span style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>Outlier Sensitivity:</span>
              <select
                value={iqrMultiplier}
                onChange={(e) => {
                  const newValue = parseFloat(e.target.value);
                  setIqrMultiplier(newValue);
                  loadData(1, newValue);
                }}
                style={{ fontSize: '11px', padding: '4px 8px' }}
                disabled={loading}
              >
                <option value={1.5}>1.5x IQR (Strict)</option>
                <option value={2.0}>2.0x IQR (Moderate)</option>
                <option value={2.5}>2.5x IQR (Relaxed)</option>
                <option value={3.0}>3.0x IQR (Lenient)</option>
              </select>
              <span style={{ fontSize: '10px', color: 'var(--text-muted)' }}>
                Higher = fewer outliers detected
              </span>
            </div>

            {/* Add Feature Button */}
            <button
              onClick={() => setShowFeatureEngineer(true)}
              style={{
                padding: '4px 12px',
                fontSize: '11px',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                color: 'var(--cyan)',
                borderColor: 'var(--cyan)',
              }}
            >
              + Add Feature
            </button>

            {/* Undo/History Button */}
            <button
              onClick={() => setShowHistory(!showHistory)}
              disabled={snapshots.length === 0}
              style={{
                padding: '4px 12px',
                fontSize: '11px',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                opacity: snapshots.length === 0 ? 0.5 : 1
              }}
            >
              <span style={{ fontSize: '14px' }}>&#8634;</span>
              Undo History ({snapshots.length})
            </button>
          </div>

          {/* History Panel */}
          {showHistory && snapshots.length > 0 && (
            <div style={{
              marginBottom: '16px',
              padding: '12px',
              background: 'var(--bg-tertiary)',
              borderRadius: '4px',
              border: '1px solid var(--border-color)'
            }}>
              <div style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                marginBottom: '12px'
              }}>
                <span style={{ fontSize: '11px', color: 'var(--cyan)', textTransform: 'uppercase' }}>
                  Undo History (up to 10 snapshots)
                </span>
                <button
                  onClick={() => setShowHistory(false)}
                  style={{ padding: '2px 8px', fontSize: '11px' }}
                >
                  Close
                </button>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: '200px', overflowY: 'auto' }}>
                {snapshots.map((snapshot) => (
                  <div
                    key={snapshot.id}
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      padding: '8px 12px',
                      background: 'var(--bg-secondary)',
                      borderRadius: '4px',
                      border: '1px solid var(--border-color)'
                    }}
                  >
                    <div>
                      <div style={{ fontSize: '11px', color: 'var(--text-primary)' }}>
                        {snapshot.description}
                      </div>
                      <div style={{ fontSize: '10px', color: 'var(--text-muted)', marginTop: '2px' }}>
                        {new Date(snapshot.timestamp).toLocaleString()} - {snapshot.rows} rows, {snapshot.columns} cols
                      </div>
                    </div>
                    <button
                      onClick={() => handleRestore(snapshot.id)}
                      disabled={restoring}
                      style={{
                        padding: '4px 12px',
                        fontSize: '11px',
                        color: 'var(--cyan)',
                        borderColor: 'var(--cyan)'
                      }}
                    >
                      {restoring ? 'Restoring...' : 'Restore'}
                    </button>
                  </div>
                ))}
              </div>
              <div style={{ fontSize: '10px', color: 'var(--text-muted)', marginTop: '8px' }}>
                Restoring will save current state as a new snapshot before reverting.
              </div>
            </div>
          )}

          {/* Issue Summary Cards */}
          {summary.has_issues && (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '12px', marginBottom: '16px' }}>
              {/* Missing Values */}
              <div style={{
                padding: '12px',
                background: summary.total_missing_cells > 0 ? 'rgba(255, 165, 2, 0.1)' : 'var(--bg-tertiary)',
                borderRadius: '4px',
                border: `1px solid ${summary.total_missing_cells > 0 ? 'var(--yellow)' : 'var(--border-color)'}`
              }}>
                <div style={{ fontSize: '11px', color: 'var(--text-secondary)', marginBottom: '4px' }}>Missing Values</div>
                <div style={{ fontSize: '20px', fontWeight: 'bold', color: summary.total_missing_cells > 0 ? 'var(--yellow)' : 'var(--text-muted)' }}>
                  {summary.total_missing_cells}
                </div>
                <div style={{ fontSize: '10px', color: 'var(--text-muted)' }}>{summary.missing_cell_percent}% of cells</div>
              </div>

              {/* Duplicate Rows */}
              <div style={{
                padding: '12px',
                background: issues.duplicate_rows.count > 0 ? 'rgba(255, 71, 87, 0.1)' : 'var(--bg-tertiary)',
                borderRadius: '4px',
                border: `1px solid ${issues.duplicate_rows.count > 0 ? 'var(--red)' : 'var(--border-color)'}`
              }}>
                <div style={{ fontSize: '11px', color: 'var(--text-secondary)', marginBottom: '4px' }}>Duplicate Rows</div>
                <div style={{ fontSize: '20px', fontWeight: 'bold', color: issues.duplicate_rows.count > 0 ? 'var(--red)' : 'var(--text-muted)' }}>
                  {issues.duplicate_rows.count}
                </div>
                {issues.duplicate_rows.count > 0 && (
                  <button
                    onClick={() => addOperation({ type: 'remove_duplicates' })}
                    style={{ marginTop: '8px', padding: '4px 8px', fontSize: '10px', color: 'var(--red)', borderColor: 'var(--red)' }}
                  >
                    Remove
                  </button>
                )}
              </div>

              {/* Constant Columns */}
              <div style={{
                padding: '12px',
                background: issues.constant_columns.length > 0 ? 'rgba(136, 136, 136, 0.1)' : 'var(--bg-tertiary)',
                borderRadius: '4px',
                border: '1px solid var(--border-color)'
              }}>
                <div style={{ fontSize: '11px', color: 'var(--text-secondary)', marginBottom: '4px' }}>Constant Columns</div>
                <div style={{ fontSize: '20px', fontWeight: 'bold', color: issues.constant_columns.length > 0 ? 'var(--text-secondary)' : 'var(--text-muted)' }}>
                  {issues.constant_columns.length}
                </div>
                {issues.constant_columns.length > 0 && (
                  <div style={{ fontSize: '10px', color: 'var(--text-muted)', marginTop: '4px' }}>
                    {issues.constant_columns.slice(0, 2).join(', ')}
                    {issues.constant_columns.length > 2 && '...'}
                  </div>
                )}
              </div>

              {/* Outliers */}
              <div style={{
                padding: '12px',
                background: issues.columns_with_outliers.length > 0 ? 'rgba(0, 212, 170, 0.1)' : 'var(--bg-tertiary)',
                borderRadius: '4px',
                border: `1px solid ${issues.columns_with_outliers.length > 0 ? 'var(--cyan)' : 'var(--border-color)'}`
              }}>
                <div style={{ fontSize: '11px', color: 'var(--text-secondary)', marginBottom: '4px' }}>Outliers (IQR)</div>
                <div style={{ fontSize: '20px', fontWeight: 'bold', color: issues.columns_with_outliers.length > 0 ? 'var(--cyan)' : 'var(--text-muted)' }}>
                  {totalOutliers}
                </div>
                <div style={{ fontSize: '10px', color: 'var(--text-muted)', marginBottom: '8px' }}>
                  in {issues.columns_with_outliers.length} column{issues.columns_with_outliers.length !== 1 ? 's' : ''}
                </div>
                {issues.columns_with_outliers.length > 0 && (
                  <select
                    onChange={(e) => {
                      if (e.target.value) {
                        addOperation({ type: 'remove_outliers', column: e.target.value });
                      }
                      e.target.value = '';
                    }}
                    style={{ fontSize: '10px', padding: '4px 6px', width: '100%' }}
                    defaultValue=""
                  >
                    <option value="" disabled>Remove from...</option>
                    {columns
                      .filter((c) => c.outlier_count > 0)
                      .map((c) => (
                        <option key={c.name} value={c.name}>
                          {c.name} ({c.outlier_count})
                        </option>
                      ))}
                  </select>
                )}
              </div>
            </div>
          )}

          {/* Pending Operations */}
          {pendingOperations.length > 0 && (
            <div style={{
              marginBottom: '16px',
              padding: '12px',
              background: 'rgba(0, 212, 170, 0.1)',
              borderRadius: '4px',
              border: '1px solid var(--cyan)'
            }}>
              <div style={{ fontSize: '11px', color: 'var(--cyan)', marginBottom: '8px' }}>
                Pending Operations ({pendingOperations.length})
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                {pendingOperations.map((op, idx) => (
                  <span
                    key={idx}
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '6px',
                      padding: '4px 8px',
                      background: 'var(--bg-secondary)',
                      borderRadius: '4px',
                      fontSize: '11px',
                      border: '1px solid var(--border-color)'
                    }}
                  >
                    {getOperationLabel(op)}
                    <button
                      onClick={() => removeOperation(idx)}
                      style={{
                        padding: '0 4px',
                        fontSize: '14px',
                        background: 'transparent',
                        border: 'none',
                        color: 'var(--red)',
                        cursor: 'pointer'
                      }}
                    >
                      x
                    </button>
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Actions Toolbar */}
          <div style={{
            marginBottom: '16px',
            padding: '12px',
            background: 'var(--bg-tertiary)',
            borderRadius: '4px',
            display: 'flex',
            flexWrap: 'wrap',
            alignItems: 'center',
            gap: '12px'
          }}>
            <span style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>Actions:</span>

            {/* Fill Missing Dropdown */}
            <select
              onChange={(e) => {
                const [strategy, col] = e.target.value.split('::');
                if (strategy && col) {
                  addOperation({
                    type: 'fill_missing',
                    column: col,
                    strategy: strategy as 'median' | 'mean' | 'mode',
                  });
                }
                e.target.value = '';
              }}
              style={{ fontSize: '11px', padding: '4px 8px' }}
              defaultValue=""
            >
              <option value="" disabled>Fill Missing...</option>
              {columns.filter((c) => c.missing_count > 0 && c.type === 'numeric').length > 0 && (
                <optgroup label="Median (numeric)">
                  {columns
                    .filter((c) => c.missing_count > 0 && c.type === 'numeric')
                    .map((c) => (
                      <option key={`med_${c.name}`} value={`median::${c.name}`}>
                        {c.name} ({c.missing_count})
                      </option>
                    ))}
                </optgroup>
              )}
              {columns.filter((c) => c.missing_count > 0).length > 0 && (
                <optgroup label="Mode (any)">
                  {columns
                    .filter((c) => c.missing_count > 0)
                    .map((c) => (
                      <option key={`mode_${c.name}`} value={`mode::${c.name}`}>
                        {c.name} ({c.missing_count})
                      </option>
                    ))}
                </optgroup>
              )}
            </select>

            {/* Delete Column Dropdown */}
            <select
              onChange={(e) => {
                if (e.target.value) {
                  addOperation({ type: 'delete_column', column: e.target.value });
                }
                e.target.value = '';
              }}
              style={{ fontSize: '11px', padding: '4px 8px' }}
              defaultValue=""
            >
              <option value="" disabled>Delete Column...</option>
              {columns.map((c) => (
                <option key={c.name} value={c.name}>
                  {c.name}
                </option>
              ))}
            </select>

            <div style={{ height: '20px', borderLeft: '1px solid var(--border-color)' }} />

            {/* Delete selected rows */}
            {selectedRows.size > 0 && (
              <button
                onClick={() => {
                  addOperation({ type: 'delete_rows', indices: Array.from(selectedRows) });
                  setSelectedRows(new Set());
                }}
                style={{ padding: '4px 8px', fontSize: '11px', color: 'var(--red)', borderColor: 'var(--red)' }}
              >
                Delete {selectedRows.size} selected rows
              </button>
            )}

            <div style={{ flex: 1 }} />

            {/* Search */}
            <input
              type="text"
              placeholder="Search..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              style={{
                fontSize: '11px',
                padding: '4px 8px',
                width: '150px',
                background: 'var(--bg-secondary)',
                border: '1px solid var(--border-color)',
                borderRadius: '4px',
                color: 'var(--text-primary)'
              }}
            />
            {searchTerm && (
              <button
                onClick={() => setSearchTerm('')}
                style={{ padding: '4px 8px', fontSize: '11px' }}
              >
                Clear
              </button>
            )}

            <div style={{ height: '20px', borderLeft: '1px solid var(--border-color)' }} />

            {/* Reset column order */}
            <button
              onClick={resetColumnOrder}
              style={{ padding: '4px 8px', fontSize: '11px' }}
              title="Reset column order to default"
            >
              Reset Cols
            </button>

            <div style={{ height: '20px', borderLeft: '1px solid var(--border-color)' }} />

            {/* Selection controls */}
            <button onClick={selectAllOnPage} style={{ padding: '4px 8px', fontSize: '11px' }}>
              Select page
            </button>
            {selectedRows.size > 0 && (
              <button onClick={clearSelection} style={{ padding: '4px 8px', fontSize: '11px' }}>
                Clear selection
              </button>
            )}
          </div>

          {/* Data Table */}
          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragEnd={handleDragEnd}
          >
          <div style={{
            overflowX: 'auto',
            overflowY: 'auto',
            maxHeight: '400px',
            border: '1px solid var(--border-color)',
            borderRadius: '4px'
          }}>
            <table className="terminal-table" style={{ minWidth: '100%' }}>
              <thead style={{ position: 'sticky', top: 0, zIndex: 10 }}>
                <tr style={{ background: 'var(--bg-secondary)' }}>
                  <th style={{ width: '40px', background: 'var(--bg-secondary)' }}>
                    <input
                      type="checkbox"
                      onChange={(e) => (e.target.checked ? selectAllOnPage() : clearSelection())}
                      checked={
                        selectedRows.size > 0 &&
                        rows &&
                        selectedRows.size === rows.end_index - rows.start_index
                      }
                    />
                  </th>
                  <th style={{ width: '60px', background: 'var(--bg-secondary)' }}>#</th>
                  <SortableContext items={columnOrder} strategy={horizontalListSortingStrategy}>
                    {columnOrder.map((col) => {
                      const colInfo = columns.find((c) => c.name === col);
                      const isSorted = sortColumn === col;
                      return (
                        <DraggableTableHeader
                          key={col}
                          id={col}
                          style={{ background: 'var(--bg-secondary)' }}
                        >
                          <div
                            style={{ display: 'flex', alignItems: 'center', gap: '4px', cursor: 'pointer' }}
                            onClick={() => toggleSort(col)}
                          >
                            <span>{col}</span>
                            {isSorted && (
                              <span style={{ color: 'var(--cyan)', fontSize: '10px' }}>
                                {sortDirection === 'asc' ? '▲' : '▼'}
                              </span>
                            )}
                            {colInfo && colInfo.missing_count > 0 && (
                              <span style={{ color: 'var(--yellow)', fontSize: '10px' }}>
                                ({colInfo.missing_count})
                              </span>
                            )}
                            {colInfo?.is_constant && (
                              <span style={{
                                fontSize: '9px',
                                padding: '1px 4px',
                                background: 'var(--bg-tertiary)',
                                borderRadius: '2px',
                                color: 'var(--text-muted)'
                              }}>
                                const
                              </span>
                            )}
                          </div>
                        </DraggableTableHeader>
                      );
                    })}
                  </SortableContext>
                </tr>
              </thead>
              <tbody>
                {processedRows.length === 0 ? (
                  <tr>
                    <td colSpan={columnOrder.length + 2} style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '24px' }}>
                      {searchTerm ? 'No rows match your search' : 'No data to display'}
                    </td>
                  </tr>
                ) : (
                  processedRows.map((row) => {
                    const globalIdx = row.__originalIndex;
                    const rowIssues = rows.row_issues[String(globalIdx)] || [];
                    const isDuplicate = rowIssues.includes('duplicate');
                    const isSelected = selectedRows.has(globalIdx);

                    return (
                      <tr
                        key={globalIdx}
                        style={{
                          background: isDuplicate
                            ? 'rgba(255, 71, 87, 0.1)'
                            : isSelected
                            ? 'rgba(0, 212, 170, 0.1)'
                            : undefined,
                        }}
                      >
                        <td>
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={() => toggleRowSelection(globalIdx)}
                          />
                        </td>
                        <td style={{ color: 'var(--text-muted)', fontFamily: 'monospace', fontSize: '10px' }}>
                          {globalIdx}
                          {isDuplicate && (
                            <span style={{ marginLeft: '4px', color: 'var(--red)' }} title="Duplicate row">
                              !
                            </span>
                          )}
                        </td>
                        {columnOrder.map((col) => {
                          const value = row[col];
                          const isMissing = value === null || value === undefined;
                          const colInfo = columns.find((c) => c.name === col);
                          const isOutlier = colInfo?.outlier_indices.includes(globalIdx);

                          return (
                            <td
                              key={col}
                              style={{
                                background: isMissing ? 'rgba(255, 165, 2, 0.15)' : undefined,
                                color: isMissing
                                  ? 'var(--yellow)'
                                  : typeof value === 'number'
                                  ? 'var(--cyan)'
                                  : 'var(--text-primary)',
                                fontStyle: isMissing ? 'italic' : undefined,
                                maxWidth: '150px',
                                overflow: 'hidden',
                                textOverflow: 'ellipsis',
                                whiteSpace: 'nowrap',
                              }}
                            >
                              {isMissing ? (
                                '(missing)'
                              ) : (
                                <>
                                  {typeof value === 'number' ? value.toLocaleString() : String(value)}
                                  {isOutlier && (
                                    <span style={{ marginLeft: '4px', color: 'var(--cyan)' }} title="Outlier">
                                      *
                                    </span>
                                  )}
                                </>
                              )}
                            </td>
                          );
                        })}
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
          </DndContext>

          {/* Pagination */}
          <div style={{
            marginTop: '12px',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center'
          }}>
            <div style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>
              {searchTerm || sortColumn ? (
                <>
                  Showing {processedRows.length} of {rows.rows.length} on page
                  {searchTerm && <span style={{ color: 'var(--cyan)' }}> (filtered)</span>}
                  {sortColumn && <span style={{ color: 'var(--yellow)' }}> (sorted by {sortColumn})</span>}
                </>
              ) : (
                <>Showing {rows.start_index + 1}-{rows.end_index} of {rows.total_rows}</>
              )}
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <button
                onClick={() => handlePageChange(currentPage - 1)}
                disabled={currentPage === 1 || loading}
                style={{ padding: '4px 12px', fontSize: '11px' }}
              >
                Prev
              </button>
              <span style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>
                Page {currentPage} of {rows.total_pages}
              </span>
              <button
                onClick={() => handlePageChange(currentPage + 1)}
                disabled={currentPage >= rows.total_pages || loading}
                style={{ padding: '4px 12px', fontSize: '11px' }}
              >
                Next
              </button>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div style={{
          padding: '12px 16px',
          borderTop: '1px solid var(--border-color)',
          display: 'flex',
          justifyContent: 'flex-end',
          gap: '12px'
        }}>
          {pendingOperations.length > 0 && (
            <button
              onClick={applyOperations}
              disabled={applying}
              style={{
                padding: '8px 16px',
                fontSize: '12px',
                background: 'var(--cyan)',
                color: 'var(--bg-primary)',
                border: 'none',
                opacity: applying ? 0.5 : 1,
              }}
            >
              {applying ? 'Applying...' : `Apply ${pendingOperations.length} Changes`}
            </button>
          )}
        </div>
      </div>

      {/* Feature Engineer Modal */}
      {showFeatureEngineer && rows && (
        <FeatureEngineerModal
          datasetId={datasetId}
          datasetName={datasetName}
          columns={rows.columns}
          onClose={() => setShowFeatureEngineer(false)}
          onFeatureAdded={() => {
            loadData(1);
            onDataChanged();
          }}
        />
      )}
    </div>
  );
}
