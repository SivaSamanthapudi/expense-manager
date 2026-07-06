import { useState, useEffect } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { useGroups } from '../../context/GroupContext';
import { useExpenses } from '../../context/ExpenseContext';
import { useAuth } from '../../context/AuthContext';
import { Expense, ExpenseSplit, EXPENSE_CATEGORIES, ExpenseCategory } from '../../types';
import './ExpenseForm.css';

type SplitMode = 'equal' | 'custom';

const ExpenseForm = () => {
  const { id } = useParams<{ id: string }>();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { groups } = useGroups();
  const { expenses, addExpense, updateExpense } = useExpenses();
  const { user } = useAuth();

  const SELF_ID = 'self';
  const isEdit = Boolean(id);
  const existing = expenses.find(e => e.id === id);
  const defaultGroupId = searchParams.get('groupId') ?? existing?.groupId ?? groups[0]?.id ?? '';

  const [form, setForm] = useState({
    title: existing?.title ?? '',
    amount: existing?.amount?.toString() ?? '',
    category: existing?.category ?? ExpenseCategory.Food,
    groupId: defaultGroupId,
    paidBy: existing?.paidBy ?? SELF_ID,
    date: existing?.date ?? new Date().toISOString().split('T')[0],
    notes: existing?.notes ?? '',
  });

  // Detect split mode from saved data: if all amounts are equal → equal, else custom
  const detectSplitMode = (): SplitMode => {
    if (!existing?.splits || existing.splits.length <= 1) return 'equal';
    const amounts = existing.splits.map(s => s.amount);
    const allEqual = amounts.every(a => Math.abs(a - amounts[0]) < 0.01);
    return allEqual ? 'equal' : 'custom';
  };

  const [splitMode, setSplitMode] = useState<SplitMode>(detectSplitMode);
  // In edit mode: seed strictly from saved splits — never auto-include new group members
  const [splits, setSplits] = useState<ExpenseSplit[]>(existing?.splits ?? []);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const group = groups.find(g => g.id === form.groupId);
  const allGroupMembers = group?.members ?? [];

  // Members not yet in the current split — shown in the "add member" picker
  const membersNotInSplit = allGroupMembers.filter(
    m => !splits.some(s => s.memberId === m.id)
  );

  // ── Effect 1: When group changes (add mode only) reset splits to all members ──
  useEffect(() => {
    if (isEdit) return; // editing: never auto-rebuild from group members
    if (allGroupMembers.length === 0) { setSplits([]); return; }
    const total = parseFloat(form.amount || '0');
    const count = allGroupMembers.length;
    const each = total > 0 ? parseFloat((total / count).toFixed(2)) : 0;
    setSplits(allGroupMembers.map((m, i) => ({
      memberId: m.id,
      memberName: m.name,
      amount: total > 0 && i === count - 1
        ? parseFloat((total - each * (count - 1)).toFixed(2))
        : each,
      paid: (() => {
        const resolvedId = form.paidBy === SELF_ID
          ? allGroupMembers.find(mb => mb.name.toLowerCase() === user?.name?.toLowerCase())?.id ?? SELF_ID
          : form.paidBy;
        return m.id === resolvedId;
      })(),
    })));
    if (!form.paidBy) {
      setForm(f => ({ ...f, paidBy: SELF_ID }));
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form.groupId]);

  // ── Effect 2: Recalculate amounts when amount changes or equal mode toggled ──
  // Only recalculates members ALREADY in splits — never adds new ones.
  // `initializedRef` prevents this from firing on first mount in edit mode
  // (which would overwrite perfectly good saved custom amounts).
  const [amountInitialized, setAmountInitialized] = useState(!isEdit);

  useEffect(() => {
    if (!amountInitialized) { setAmountInitialized(true); return; }
    if (!form.amount || splits.length === 0) return;
    if (splitMode !== 'equal') return;
    const total = parseFloat(form.amount);
    const count = splits.length;
    const each = parseFloat((total / count).toFixed(2));
    setSplits(prev => prev.map((s, i) => ({
      ...s,
      amount: i === count - 1
        ? parseFloat((total - each * (count - 1)).toFixed(2))
        : each,
    })));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form.amount, splitMode]);

  // Sync paid flags for all splits based on who paid — called on every paidBy change
  const syncPaidFlags = (newPaidBy: string) => {
    const resolvedId = newPaidBy === SELF_ID
      ? allGroupMembers.find(m => m.name.toLowerCase() === user?.name?.toLowerCase())?.id ?? SELF_ID
      : newPaidBy;
    setSplits(prev => prev.map(s => ({
      ...s,
      paid: s.memberId === resolvedId,
    })));
  };

  // ── Manually add a member to the split ──
  const addMemberToSplit = (memberId: string) => {
    const member = allGroupMembers.find(m => m.id === memberId);
    if (!member) return;
    const total = parseFloat(form.amount || '0');
    const newCount = splits.length + 1;

    if (splitMode === 'equal' && total > 0) {
      const each = parseFloat((total / newCount).toFixed(2));
      const newSplits = [...splits, { memberId: member.id, memberName: member.name, amount: 0, paid: false }];
      setSplits(newSplits.map((s, i) => ({
        ...s,
        amount: i === newSplits.length - 1
          ? parseFloat((total - each * (newCount - 1)).toFixed(2))
          : each,
      })));
    } else {
      // custom mode: add with 0, let the user fill in the amount
      setSplits(prev => [...prev, { memberId: member.id, memberName: member.name, amount: 0, paid: false }]);
    }
  };

  // ── Remove a member from the split ──
  const removeMemberFromSplit = (memberId: string) => {
    const remaining = splits.filter(s => s.memberId !== memberId);
    if (splitMode === 'equal' && remaining.length > 0) {
      const total = parseFloat(form.amount || '0');
      const each = parseFloat((total / remaining.length).toFixed(2));
      setSplits(remaining.map((s, i) => ({
        ...s,
        amount: i === remaining.length - 1
          ? parseFloat((total - each * (remaining.length - 1)).toFixed(2))
          : each,
      })));
    } else {
      setSplits(remaining);
    }
  };

  const validate = () => {
    const e: Record<string, string> = {};
    if (!form.title.trim()) e.title = 'Title is required';
    if (!form.amount || isNaN(parseFloat(form.amount)) || parseFloat(form.amount) <= 0) e.amount = 'Valid amount is required';
    if (!form.groupId) e.groupId = 'Group is required';
    if (!form.paidBy) e.paidBy = 'Paid by is required';
    if (splits.length === 0) e.splits = 'Add at least one member to the split';
    const splitTotal = splits.reduce((s, sp) => s + sp.amount, 0);
    if (Math.abs(splitTotal - parseFloat(form.amount || '0')) > 0.01) e.splits = `Split total ₹${splitTotal.toFixed(2)} doesn't match ₹${form.amount}`;
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleSubmit = () => {
    if (!validate()) return;

    // Resolve 'self' → actual group member whose name matches the logged-in user.
    // Fall back to the user's name as display if no member match found.
    let resolvedPaidBy: { id: string; name: string };
    if (form.paidBy === SELF_ID) {
      const matchedMember = allGroupMembers.find(
        m => m.name.toLowerCase() === user?.name?.toLowerCase()
      );
      resolvedPaidBy = matchedMember
        ? { id: matchedMember.id, name: matchedMember.name }
        : { id: SELF_ID, name: user?.name ?? 'Me' };
    } else {
      const m = allGroupMembers.find(m => m.id === form.paidBy);
      resolvedPaidBy = { id: form.paidBy, name: m?.name ?? '' };
    }

    const payload = {
      groupId: form.groupId,
      title: form.title,
      amount: parseFloat(form.amount),
      category: form.category,
      paidBy: resolvedPaidBy.id,
      paidByName: resolvedPaidBy.name,
      splits,
      date: form.date,
      notes: form.notes,
    };
    if (isEdit && id) updateExpense(id, payload);
    else addExpense(payload);
    navigate(form.groupId ? `/groups/${form.groupId}` : '/expenses');
  };

  const updateSplitAmount = (memberId: string, value: string) => {
    setSplits(prev => prev.map(s => s.memberId === memberId ? { ...s, amount: parseFloat(value) || 0 } : s));
  };

  const toggleSplitPaid = (memberId: string) => {
    setSplits(prev => prev.map(s => s.memberId === memberId ? { ...s, paid: !s.paid } : s));
  };

  const splitTotal = splits.reduce((s, sp) => s + sp.amount, 0);
  const remaining = parseFloat(form.amount || '0') - splitTotal;

  return (
    <div className="page-content">
      <div className="page-header">
        <div className="flex items-center gap-3">
          <button className="btn btn-outline btn-sm" onClick={() => navigate(-1)}>← Back</button>
          <h1 className="page-title">{isEdit ? 'Edit Expense' : 'Add Expense'}</h1>
        </div>
      </div>

      <div className="expense-form-grid">
        {/* Left column: Expense details */}
        <div>
          <div className="card card-body mb-4">
            <h3 className="font-semibold mb-4">Expense Details</h3>

            <div className="form-group">
              <label className="form-label">Title *</label>
              <input className="form-control" placeholder="What was this for?" value={form.title}
                onChange={e => setForm(f => ({ ...f, title: e.target.value }))} />
              {errors.title && <p className="form-error">{errors.title}</p>}
            </div>

            <div className="grid-2">
              <div className="form-group">
                <label className="form-label">Amount (₹) *</label>
                <input className="form-control" type="number" placeholder="0.00" value={form.amount}
                  onChange={e => setForm(f => ({ ...f, amount: e.target.value }))} />
                {errors.amount && <p className="form-error">{errors.amount}</p>}
              </div>
              <div className="form-group">
                <label className="form-label">Date</label>
                <input className="form-control" type="date" value={form.date}
                  onChange={e => setForm(f => ({ ...f, date: e.target.value }))} />
              </div>
            </div>

            <div className="grid-2">
              <div className="form-group">
                <label className="form-label">Category</label>
                <select className="form-control" value={form.category}
                  onChange={e => setForm(f => ({ ...f, category: e.target.value as ExpenseCategory }))}>
                  {EXPENSE_CATEGORIES.map(c => <option key={c} value={c}>{c.charAt(0).toUpperCase() + c.slice(1)}</option>)}
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">Group *</label>
                <select className="form-control" value={form.groupId}
                  onChange={e => setForm(f => ({ ...f, groupId: e.target.value, paidBy: '' }))}>
                  <option value="">Select group</option>
                  {groups.map(g => <option key={g.id} value={g.id}>{g.name}</option>)}
                </select>
                {errors.groupId && <p className="form-error">{errors.groupId}</p>}
              </div>
            </div>

            <div className="form-group">
              <label className="form-label">Paid By *</label>
              <select className="form-control" value={form.paidBy}
                onChange={e => {
                  const val = e.target.value;
                  setForm(f => ({ ...f, paidBy: val }));
                  syncPaidFlags(val);
                }}
                disabled={allGroupMembers.length === 0}>
                <option value="">Select who paid</option>
                <option value={SELF_ID}>👤 Me (self) — {user?.name}</option>
                {allGroupMembers.length > 0 && <option disabled>──────────────</option>}
                {allGroupMembers.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
              </select>
              {errors.paidBy && <p className="form-error">{errors.paidBy}</p>}
            </div>

            <div className="form-group">
              <label className="form-label">Notes</label>
              <textarea className="form-control" placeholder="Optional notes..." rows={2} value={form.notes}
                onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} />
            </div>
          </div>
        </div>

        {/* Right column: Split */}
        <div>
          <div className="card card-body">
            <div className="flex justify-between items-center mb-4">
              <div>
                <h3 className="font-semibold">Split Among Members</h3>
                <p className="text-xs text-muted mt-1">{splits.length} member{splits.length !== 1 ? 's' : ''} in this split</p>
              </div>
              <div className="split-mode-toggle">
                <button className={`split-mode-btn ${splitMode === 'equal' ? 'active' : ''}`}
                  onClick={() => setSplitMode('equal')}>Equal</button>
                <button className={`split-mode-btn ${splitMode === 'custom' ? 'active' : ''}`}
                  onClick={() => setSplitMode('custom')}>Custom</button>
              </div>
            </div>

            {splits.length === 0 && allGroupMembers.length === 0 ? (
              <p className="text-muted text-sm">Select a group with members to split</p>
            ) : (
              <>
                <div className="split-list">
                  {splits.map(s => (
                    <div key={s.memberId} className="split-row">
                      <div className="flex items-center gap-3 flex-1">
                        <img src={`https://api.dicebear.com/7.x/initials/svg?seed=${s.memberName}`}
                          alt={s.memberName} className="avatar avatar-sm" />
                        <div>
                          <p className="text-sm font-semibold">{s.memberName}</p>
                          {(s.memberId === form.paidBy || (form.paidBy === SELF_ID && s.memberName === user?.name)) &&
                            <span className="badge badge-success" style={{ fontSize: 11 }}>Paid</span>}
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <input
                          className="form-control split-amount-input"
                          type="number"
                          value={s.amount}
                          disabled={splitMode === 'equal'}
                          onChange={e => updateSplitAmount(s.memberId, e.target.value)}
                        />
                        <label className="paid-toggle">
                          <input type="checkbox" checked={s.paid} onChange={() => toggleSplitPaid(s.memberId)} />
                          <span className="text-xs text-muted">Done</span>
                        </label>
                        <button
                          className="btn-icon remove-split-btn"
                          title="Remove from split"
                          onClick={() => removeMemberFromSplit(s.memberId)}
                        >✕</button>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Add member to split */}
                {membersNotInSplit.length > 0 && (
                  <div className="add-to-split">
                    <p className="text-xs text-muted mb-2">Add group member to this split:</p>
                    <div className="add-to-split-chips">
                      {membersNotInSplit.map(m => (
                        <button
                          key={m.id}
                          className="add-split-chip"
                          onClick={() => addMemberToSplit(m.id)}
                          title={m.email}
                        >
                          <img src={m.avatar} alt={m.name} className="avatar" style={{ width: 20, height: 20 }} />
                          <span>{m.name.split(' ')[0]}</span>
                          <span className="add-chip-plus">+</span>
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                <div className="split-summary">
                  <div className="split-summary-row">
                    <span className="text-sm text-muted">Expense total</span>
                    <span className="font-semibold">₹{parseFloat(form.amount || '0').toLocaleString()}</span>
                  </div>
                  <div className="split-summary-row">
                    <span className="text-sm text-muted">Split total</span>
                    <span className="font-semibold">₹{splitTotal.toFixed(2)}</span>
                  </div>
                  {Math.abs(remaining) > 0.01 && (
                    <div className="split-summary-row" style={{ color: '#ef4444' }}>
                      <span className="text-sm">Unallocated</span>
                      <span className="font-semibold">₹{remaining.toFixed(2)}</span>
                    </div>
                  )}
                </div>
                {errors.splits && <p className="form-error">{errors.splits}</p>}
              </>
            )}
          </div>

          <div className="flex justify-end gap-3 mt-4">
            <button className="btn btn-outline" onClick={() => navigate(-1)}>Cancel</button>
            <button className="btn btn-primary" onClick={handleSubmit}>
              {isEdit ? 'Save Changes' : 'Add Expense'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ExpenseForm;
