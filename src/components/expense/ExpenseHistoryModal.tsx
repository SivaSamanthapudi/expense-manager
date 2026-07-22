import { useState, useEffect, useCallback } from 'react';
import { ExpenseHistoryEntry, ExpenseHistoryChange } from '../../types';
import { expenseService } from '../../services/expenseService';
import './ExpenseHistoryModal.css';

interface Props {
  expenseId: string;
  expenseTitle: string;
  onClose: () => void;
}

const FIELD_LABELS: Record<string, string> = {
  title: 'Title',
  amount: 'Amount',
  category: 'Category',
  paidBy: 'Paid By (ID)',
  paidByName: 'Paid By',
  date: 'Date',
  notes: 'Notes',
  splits: 'Splits',
  receiptUrls: 'Attachments',
};

function formatValue(field: string, value: unknown): string {
  if (value === null || value === undefined || value === '') return '—';
  if (field === 'amount') return `₹${Number(value).toLocaleString()}`;
  if (field === 'date') {
    const d = new Date(value as string);
    return `${d.getDate().toString().padStart(2, '0')}-${d.toLocaleString('default', { month: 'short' })}-${d.getFullYear()}`;
  }
  if (field === 'splits' && Array.isArray(value)) {
    return (value as { memberName: string; amount: number; paid: boolean }[])
      .map(s => `${s.memberName}: ₹${s.amount}${s.paid ? ' ✓' : ''}`)
      .join(', ');
  }
  if (field === 'receiptUrls' && Array.isArray(value)) {
    return value.length === 0 ? 'None' : (value as string[]).map(u => u.split('/').pop()).join(', ');
  }
  return String(value);
}

function formatRelativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const minutes = Math.floor(diff / 60000);
  if (minutes < 1) return 'Just now';
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

function formatAbsoluteTime(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

function ChangeRow({ change }: { change: ExpenseHistoryChange }) {
  const label = FIELD_LABELS[change.field] ?? change.field;
  const oldStr = formatValue(change.field, change.oldValue);
  const newStr = formatValue(change.field, change.newValue);

  return (
    <div className="eh-change-row">
      <span className="eh-change-field">{label}</span>
      <span className="eh-change-old">{oldStr}</span>
      <span className="eh-change-arrow">→</span>
      <span className="eh-change-new">{newStr}</span>
    </div>
  );
}

const ExpenseHistoryModal = ({ expenseId, expenseTitle, onClose }: Props) => {
  const [entries, setEntries] = useState<ExpenseHistoryEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await expenseService.fetchHistory(expenseId);
      setEntries(data);
    } catch {
      setError('Failed to load edit history.');
    } finally {
      setLoading(false);
    }
  }, [expenseId]);

  useEffect(() => { void load(); }, [load]);

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal eh-modal" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h3 className="modal-title">Edit History</h3>
          <p className="modal-subtitle">{expenseTitle}</p>
          <button className="modal-close" onClick={onClose}>✕</button>
        </div>

        <div className="eh-body">
          {loading && (
            <div className="eh-state">
              <div className="spinner" />
              <p className="text-muted text-sm">Loading history…</p>
            </div>
          )}

          {!loading && error && (
            <div className="eh-state">
              <p style={{ color: '#ef4444' }}>{error}</p>
              <button className="btn btn-outline btn-sm mt-2" onClick={load}>Retry</button>
            </div>
          )}

          {!loading && !error && entries.length === 0 && (
            <div className="eh-state">
              <div style={{ fontSize: 32 }}>📋</div>
              <p className="text-muted text-sm mt-2">No edits recorded yet.</p>
            </div>
          )}

          {!loading && !error && entries.length > 0 && (
            <div className="eh-timeline">
              {entries.map(entry => (
                <div key={entry.id} className="eh-entry">
                  <div className="eh-entry-header">
                    <div className="eh-entry-avatar">
                      {entry.editedByName.charAt(0).toUpperCase()}
                    </div>
                    <div className="eh-entry-meta">
                      <span className="eh-entry-name">{entry.editedByName}</span>
                      <span
                        className="eh-entry-time"
                        title={formatAbsoluteTime(entry.editedAt)}
                      >
                        {formatRelativeTime(entry.editedAt)} · {formatAbsoluteTime(entry.editedAt)}
                      </span>
                    </div>
                  </div>
                  <div className="eh-changes">
                    {entry.changes.map((c, i) => (
                      <ChangeRow key={`${entry.id}-${i}`} change={c} />
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default ExpenseHistoryModal;
