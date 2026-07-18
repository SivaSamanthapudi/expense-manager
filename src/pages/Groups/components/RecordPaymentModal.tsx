import { useState, type FC } from 'react';
import Modal from '../../../components/modal/Modal';
import { type Member } from '../../../types';
import { groupService } from '../../../services/groupService';

interface DebtTransaction {
  fromId: string;
  toId: string;
  amount: number;
}

interface Props {
  isOpen: boolean;
  groupId: string;
  members: Member[];
  simplified: DebtTransaction[];
  fromMemberId: string;
  toMemberId: string;
  onClose: () => void;
  onSuccess: () => Promise<void>;
}

const RecordPaymentModal: FC<Props> = ({
  isOpen,
  groupId,
  members,
  simplified,
  fromMemberId,
  toMemberId,
  onClose,
  onSuccess,
}) => {
  const [amount, setAmount] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const handleClose = () => {
    setAmount('');
    setError('');
    setSaving(false);
    onClose();
  };

  const handleRecord = async () => {
    const amt = parseFloat(amount);
    if (!amt || amt <= 0) {
      setError('Enter a valid amount');
      return;
    }
    setSaving(true);
    setError('');
    try {
      await groupService.recordPayment(groupId, fromMemberId, toMemberId, amt);
      await onSuccess();
      handleClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to record payment');
      setSaving(false);
    }
  };

  const fromMember = members.find((m) => m.id === fromMemberId);
  const toMember = members.find((m) => m.id === toMemberId);
  const totalOwed = simplified
    .filter((t) => t.fromId === fromMemberId && t.toId === toMemberId)
    .reduce((s, t) => s + t.amount, 0);

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleClose}
      title="Record Payment"
      size="sm"
      footer={
        <>
          <button
            className="btn btn-outline"
            onClick={handleClose}
            disabled={saving}
          >
            Cancel
          </button>
          <button
            className="btn btn-primary"
            onClick={() => void handleRecord()}
            disabled={saving || !amount}
          >
            {saving ? 'Recording…' : 'Record Payment'}
          </button>
        </>
      }
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 12,
          background: 'var(--secondary)',
          borderRadius: 'var(--radius)',
          padding: '12px 14px',
          marginBottom: 16,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <img
            src={fromMember?.avatar}
            alt={fromMember?.name}
            className="avatar avatar-sm"
          />
          <span className="text-sm font-semibold">
            {fromMember?.name ?? '—'}
          </span>
        </div>
        <span style={{ color: 'var(--text-muted)', fontSize: 18 }}>→</span>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <img
            src={toMember?.avatar}
            alt={toMember?.name}
            className="avatar avatar-sm"
          />
          <span className="text-sm font-semibold">{toMember?.name ?? '—'}</span>
        </div>
        {totalOwed > 0 && (
          <span
            style={{
              marginLeft: 'auto',
              fontWeight: 700,
              color: '#ef4444',
              fontSize: 14,
            }}
          >
            owes ₹{totalOwed.toLocaleString()}
          </span>
        )}
      </div>

      <div className="form-group">
        <label className="form-label">Payment Amount (₹) *</label>
        <input
          className="form-control"
          type="number"
          min="0.01"
          step="0.01"
          placeholder={`Full amount: ₹${totalOwed.toLocaleString()}`}
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          autoFocus
        />
        {totalOwed > 0 && (
          <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
            <button
              type="button"
              className="btn btn-outline btn-sm"
              onClick={() => setAmount(totalOwed.toString())}
            >
              Full ₹{totalOwed.toLocaleString()}
            </button>
          </div>
        )}
      </div>

      {error && (
        <p className="form-error" style={{ marginTop: 8 }}>
          {error}
        </p>
      )}
    </Modal>
  );
};

export default RecordPaymentModal;
