import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useGroups } from '../../context/GroupContext';
import { useExpenses } from '../../context/ExpenseContext';
import { useAuth } from '../../context/AuthContext';
import Modal from '../../components/modal/Modal';
import { ExpenseCategory } from '../../types';
import { simplifyDebts, computeMemberBalances, DebtTransaction } from '../../utils/debtUtils';
import './GroupDetail.css';

const CATEGORY_ICONS: Record<ExpenseCategory, string> = {
  food: '🍔', transport: '🚗', accommodation: '🏨',
  entertainment: '🎬', utilities: '💡', other: '📦',
};

const GroupDetail = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { groups, addMember, removeMember } = useGroups();
  const { expenses, deleteExpense } = useExpenses();
  const { user } = useAuth();

  const group = groups.find(g => g.id === id);

  const canModifyExpense = (e: { paidByName: string; splits: { memberName: string }[] }) => {
    if (!user) return false;
    const name = user.name.toLowerCase();
    return (
      e.paidByName.toLowerCase().includes(name) ||
      e.splits.some(s => s.memberName.toLowerCase().includes(name))
    );
  };

  const [memberModal, setMemberModal] = useState(false);
  const [memberForm, setMemberForm] = useState({ name: '', email: '' });
  const [memberError, setMemberError] = useState('');
  const [activeTab, setActiveTab] = useState<'expenses' | 'members' | 'balances'>('expenses');
  const [removeError, setRemoveError] = useState<string | null>(null);
  const [leaveError, setLeaveError] = useState<string | null>(null);

  if (!group) return (
    <div className="page-content">
      <div className="empty-state">
        <div className="empty-icon">🔍</div>
        <h3>Group not found</h3>
        <button className="btn btn-primary" onClick={() => navigate('/groups')}>Back to Groups</button>
      </div>
    </div>
  );

  const groupExpenses = expenses.filter(e => e.groupId === id);
  const total = groupExpenses.reduce((sum, e) => sum + e.amount, 0);

  // ── Per-member net balances ──
  const memberBalances = group.members.map(m => {
    const paid = groupExpenses
      .filter(e => e.paidBy === m.id)
      .reduce((s, e) => s + e.amount, 0);
    const share = groupExpenses.reduce((s, e) => {
      const split = e.splits.find(sp => sp.memberId === m.id);
      return s + (split?.amount ?? 0);
    }, 0);
    return { id: m.id, name: m.name, avatar: m.avatar, email: m.email, paid, share, net: paid - share };
  });

  // ── Debt transactions — simplified if flag is on, otherwise raw per-expense unpaid splits ──
  const simplified = group.simplifyDebts
    ? simplifyDebts(memberBalances)
    : groupExpenses.flatMap(expense =>
        expense.splits
          .filter(s => !s.paid && s.memberId !== expense.paidBy)
          .map(s => ({
            fromId:   s.memberId,
            fromName: s.memberName,
            toId:     expense.paidBy,
            toName:   expense.paidByName,
            amount:   s.amount,
          }))
      );

  // ── "You" perspective: match logged-in user to a group member by name ──
  const selfMember = group.members.find(
    m => m.name.toLowerCase() === user?.name?.toLowerCase()
  );
  const youOwe = simplified
    .filter(t => t.fromId === selfMember?.id)
    .reduce((s, t) => s + t.amount, 0);
  const owedToYou = simplified
    .filter(t => t.toId === selfMember?.id)
    .reduce((s, t) => s + t.amount, 0);

  const handleLeaveGroup = () => {
    if (!selfMember) return;
    const hasUnsettled = groupExpenses.some(e =>
      e.splits.some(s => s.memberId === selfMember.id && !s.paid)
    );
    if (hasUnsettled) {
      setLeaveError('You have unsettled debts in this group. Clear all your payments before leaving.');
      return;
    }
    removeMember(selfMember.id, group.id);
    navigate('/groups');
  };

  const handleRemoveMember = (memberId: string, memberName: string) => {
    // Check if member has any unsettled split in this group
    const hasUnsettledDebt = groupExpenses.some(e =>
      e.splits.some(s => s.memberId === memberId && !s.paid)
    );
    if (hasUnsettledDebt) {
      setRemoveError(`Cannot remove ${memberName} — they have unsettled debts in this group. Settle all their splits first.`);
      return;
    }
    setRemoveError(null);
    removeMember(memberId, group.id);
  };

  const handleAddMember = () => {
    if (!memberForm.name.trim()) { setMemberError('Name is required'); return; }
    if (!memberForm.email.trim()) { setMemberError('Email is required'); return; }
    if (group.members.some(m => m.email.toLowerCase() === memberForm.email.toLowerCase())) {
      setMemberError(`${memberForm.email} is already a member of this group`);
      return;
    }
    addMember({
      name: memberForm.name,
      email: memberForm.email,
      avatar: `https://api.dicebear.com/7.x/initials/svg?seed=${memberForm.name}`,
      groupId: group.id,
    });
    setMemberForm({ name: '', email: '' });
    setMemberError('');
    setMemberModal(false);
  };

  return (
    <div className="page-content">
      <div className="page-header">
        <div className="flex items-center gap-3">
          <button className="btn btn-outline btn-sm" onClick={() => navigate('/groups')}>← Back</button>
          <div>
            <h1 className="page-title">{group.name}</h1>
            {group.description && <p className="page-subtitle">{group.description}</p>}
          </div>
        </div>
        <div className="flex items-center gap-2">
          {selfMember && (
            <button className="btn btn-outline btn-sm" style={{ color: '#ef4444', borderColor: '#ef4444' }} onClick={handleLeaveGroup}>
              🚪 Leave Group
            </button>
          )}
          <button className="btn btn-primary" onClick={() => navigate(`/expenses/new?groupId=${group.id}`)}>
            + Add Expense
          </button>
        </div>
      </div>

      {leaveError && (
        <div className="remove-error-banner mb-4">
          ⚠️ {leaveError}
          <button className="remove-error-close" onClick={() => setLeaveError(null)}>✕</button>
        </div>
      )}

      {/* ── Stats row ── */}
      <div className="group-stats-row mb-4">
        <div className="mini-stat card card-body">
          <p className="text-muted text-sm">Total Spent</p>
          <p className="stat-value-sm">₹{total.toLocaleString()}</p>
        </div>
        <div className="mini-stat card card-body">
          <p className="text-muted text-sm">Expenses</p>
          <p className="stat-value-sm">{groupExpenses.length}</p>
        </div>
        <div className="mini-stat card card-body">
          <p className="text-muted text-sm">Members</p>
          <p className="stat-value-sm">{group.members.length}</p>
        </div>
        {selfMember && (
          <>
            <div className="mini-stat card card-body">
              <p className="text-muted text-sm">You Owe</p>
              <p className="stat-value-sm" style={{ color: youOwe > 0 ? '#ef4444' : '#10b981' }}>
                ₹{youOwe.toLocaleString()}
              </p>
            </div>
            <div className="mini-stat card card-body">
              <p className="text-muted text-sm">Owed to You</p>
              <p className="stat-value-sm" style={{ color: owedToYou > 0 ? '#10b981' : '#64748b' }}>
                ₹{owedToYou.toLocaleString()}
              </p>
            </div>
          </>
        )}
      </div>

      {/* ── Owed to You / You Owe cards ── */}
      {selfMember && (
        <div className="debt-cards-row mb-4">
          <div className="debt-card debt-card-receive card card-body">
            <div className="debt-card-header">
              <span className="debt-card-icon">💰</span>
              <div>
                <h4 className="debt-card-title">Owed to You</h4>
                <p className="debt-card-total">
                  {owedToYou > 0 ? `₹${owedToYou.toLocaleString()} total` : 'Nothing owed'}
                </p>
              </div>
            </div>
            {simplified.filter(t => t.toId === selfMember.id).length === 0 ? (
              <p className="debt-card-empty">You're all settled up! 🎉</p>
            ) : (
              <div className="debt-person-list">
                {simplified.filter(t => t.toId === selfMember.id).map((t, i) => (
                  <div key={i} className="debt-person-row">
                    <img
                      src={`https://api.dicebear.com/7.x/initials/svg?seed=${t.fromName}`}
                      alt={t.fromName}
                      className="avatar avatar-sm"
                    />
                    <span className="debt-person-name">{t.fromName.split(' ')[0]}</span>
                    <span className="debt-person-amount receive">₹{t.amount.toLocaleString()}</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="debt-card debt-card-owe card card-body">
            <div className="debt-card-header">
              <span className="debt-card-icon">💳</span>
              <div>
                <h4 className="debt-card-title">You Owe</h4>
                <p className="debt-card-total">
                  {youOwe > 0 ? `₹${youOwe.toLocaleString()} total` : 'Nothing owed'}
                </p>
              </div>
            </div>
            {simplified.filter(t => t.fromId === selfMember.id).length === 0 ? (
              <p className="debt-card-empty">You don't owe anyone! 🎉</p>
            ) : (
              <div className="debt-person-list">
                {simplified.filter(t => t.fromId === selfMember.id).map((t, i) => (
                  <div key={i} className="debt-person-row">
                    <img
                      src={`https://api.dicebear.com/7.x/initials/svg?seed=${t.toName}`}
                      alt={t.toName}
                      className="avatar avatar-sm"
                    />
                    <span className="debt-person-name">{t.toName.split(' ')[0]}</span>
                    <span className="debt-person-amount owe">₹{t.amount.toLocaleString()}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── Tabs ── */}
      <div className="tabs mb-4">
        <button className={`tab ${activeTab === 'expenses' ? 'tab-active' : ''}`} onClick={() => setActiveTab('expenses')}>
          💰 Expenses ({groupExpenses.length})
        </button>
        <button className={`tab ${activeTab === 'balances' ? 'tab-active' : ''}`} onClick={() => setActiveTab('balances')}>
          ⚖️ Balances
        </button>
        <button className={`tab ${activeTab === 'members' ? 'tab-active' : ''}`} onClick={() => setActiveTab('members')}>
          👥 Members ({group.members.length})
        </button>
      </div>

      {/* ── Expenses tab ── */}
      {activeTab === 'expenses' && (
        <div className="card">
          <div className="card-body">
            {groupExpenses.length === 0 ? (
              <div className="empty-state">
                <div className="empty-icon">💸</div>
                <h3>No expenses yet</h3>
                <p>Add the first expense to this group</p>
                <button className="btn btn-primary" onClick={() => navigate(`/expenses/new?groupId=${group.id}`)}>
                  Add Expense
                </button>
              </div>
            ) : (
              <div className="expense-list">
                {groupExpenses.map(e => (
                  <div key={e.id} className="expense-row">
                    <div className="expense-row-icon">{CATEGORY_ICONS[e.category]}</div>
                    <div className="expense-row-info">
                      <p className="font-semibold text-sm">{e.title}</p>
                      <p className="text-xs text-muted">Paid by {e.paidByName} · {e.date}</p>
                    </div>
                    <div className="expense-row-splits">
                      {e.splits.map(s => (
                        <span key={s.memberId} className={`split-chip ${s.paid ? 'split-paid' : 'split-unpaid'}`}>
                          {s.memberName.split(' ')[0]}: ₹{s.amount}
                        </span>
                      ))}
                    </div>
                    <div className="expense-row-actions">
                      <span className="expense-amount">₹{e.amount.toLocaleString()}</span>
                      <button
                        className="btn btn-outline btn-sm"
                        onClick={() => navigate(`/expenses/edit/${e.id}`)}
                        disabled={!canModifyExpense(e)}
                        title={!canModifyExpense(e) ? 'You are not a participant in this expense' : ''}
                      >Edit</button>
                      <button
                        className="btn btn-danger btn-sm"
                        onClick={() => deleteExpense(e.id)}
                        disabled={!canModifyExpense(e)}
                        title={!canModifyExpense(e) ? 'You are not a participant in this expense' : ''}
                      >Delete</button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── Balances tab ── */}
      {activeTab === 'balances' && (
        <div className="balances-layout">
          {/* Left: per-member net balance */}
          <div className="card card-body">
            <h3 className="font-semibold mb-4">Member Balances</h3>
            {memberBalances.length === 0 ? (
              <p className="text-muted text-sm">No members yet</p>
            ) : (
              <div className="balance-list">
                {memberBalances.map(m => (
                  <div key={m.id} className={`balance-row ${m.id === selfMember?.id ? 'balance-row-self' : ''}`}>
                    <img src={m.avatar} alt={m.name} className="avatar avatar-sm" />
                    <div className="balance-member-info">
                      <p className="text-sm font-semibold">
                        {m.name}
                        {m.id === selfMember?.id && <span className="self-tag">you</span>}
                      </p>
                      <div className="balance-bars">
                        <span className="text-xs" style={{ color: '#10b981' }}>paid ₹{m.paid.toLocaleString()}</span>
                        <span className="text-xs text-muted">·</span>
                        <span className="text-xs" style={{ color: '#ef4444' }}>share ₹{m.share.toLocaleString()}</span>
                      </div>
                    </div>
                    <div className="balance-net">
                      <span className={`balance-net-value ${m.net > 0 ? 'net-positive' : m.net < 0 ? 'net-negative' : 'net-zero'}`}>
                        {m.net > 0 ? `gets back ₹${m.net.toLocaleString()}` :
                         m.net < 0 ? `owes ₹${Math.abs(m.net).toLocaleString()}` : 'settled up'}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Right: debt settlement */}
          <div className="card card-body">
            <div className="flex justify-between items-center mb-4">
              <div>
                <h3 className="font-semibold">Settle Up</h3>
                <p className="text-xs text-muted mt-1">
                  {group.simplifyDebts ? 'Minimum transactions to clear all debts' : 'Per-expense payment breakdown'}
                </p>
              </div>
              {simplified.length > 0 && (
                <span className="badge badge-primary">{simplified.length} payment{simplified.length > 1 ? 's' : ''}</span>
              )}
            </div>

            {simplified.length === 0 ? (
              <div className="settled-state">
                <div style={{ fontSize: 40, marginBottom: 12 }}>🎉</div>
                <p className="font-semibold">All settled up!</p>
                <p className="text-sm text-muted mt-1">No outstanding debts in this group</p>
              </div>
            ) : (
              <div className="settle-list">
                {simplified.map((t, i) => {
                  const isYouPaying = t.fromId === selfMember?.id;
                  const isYouReceiving = t.toId === selfMember?.id;
                  return (
                    <div key={i} className={`settle-row ${isYouPaying ? 'settle-you-pay' : isYouReceiving ? 'settle-you-receive' : ''}`}>
                      <div className="settle-avatars">
                        <img
                          src={`https://api.dicebear.com/7.x/initials/svg?seed=${t.fromName}`}
                          alt={t.fromName} className="avatar avatar-sm"
                        />
                        <span className="settle-arrow">→</span>
                        <img
                          src={`https://api.dicebear.com/7.x/initials/svg?seed=${t.toName}`}
                          alt={t.toName} className="avatar avatar-sm"
                        />
                      </div>
                      <div className="settle-info">
                        <p className="text-sm">
                          <span className="font-semibold">{isYouPaying ? 'You' : t.fromName.split(' ')[0]}</span>
                          <span className="text-muted"> pays </span>
                          <span className="font-semibold">{isYouReceiving ? 'You' : t.toName.split(' ')[0]}</span>
                        </p>
                        {(isYouPaying || isYouReceiving) && (
                          <span className={`text-xs ${isYouPaying ? 'you-pay-label' : 'you-receive-label'}`}>
                            {isYouPaying ? '↑ you owe this' : '↓ you receive this'}
                          </span>
                        )}
                      </div>
                      <span className="settle-amount">₹{t.amount.toLocaleString()}</span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── Members tab ── */}
      {activeTab === 'members' && (
        <div>
          <div className="flex justify-between items-center mb-4">
            <span className="text-sm text-muted">{group.members.length} member{group.members.length !== 1 ? 's' : ''}</span>
            <button className="btn btn-primary btn-sm" onClick={() => setMemberModal(true)}>+ Add Member</button>
          </div>
          {removeError && (
            <div className="remove-error-banner">
              ⚠️ {removeError}
              <button className="remove-error-close" onClick={() => setRemoveError(null)}>✕</button>
            </div>
          )}
          {group.members.length === 0 ? (
            <div className="card">
              <div className="empty-state">
                <div className="empty-icon">👤</div>
                <h3>No members yet</h3>
                <button className="btn btn-primary" onClick={() => setMemberModal(true)}>Add Member</button>
              </div>
            </div>
          ) : (
            <div className="member-grid">
              {memberBalances.map(m => (
                <div key={m.id} className="member-card card card-body">
                  <div className="flex justify-between items-start">
                    <div className="flex items-center gap-3">
                      <img src={m.avatar} alt={m.name} className="avatar avatar-lg" />
                      <div>
                        <p className="font-semibold">{m.name}</p>
                        <p className="text-xs text-muted">{m.email}</p>
                      </div>
                    </div>
                    <button className="btn-icon" onClick={() => handleRemoveMember(m.id, m.name)} title="Remove member">🗑️</button>
                  </div>
                  <div className="divider" />
                  <div className="flex justify-between text-sm">
                    <div>
                      <p className="text-muted text-xs">Paid</p>
                      <p className="font-semibold" style={{ color: '#10b981' }}>₹{m.paid.toLocaleString()}</p>
                    </div>
                    <div>
                      <p className="text-muted text-xs">Share</p>
                      <p className="font-semibold" style={{ color: '#ef4444' }}>₹{m.share.toLocaleString()}</p>
                    </div>
                    <div>
                      <p className="text-muted text-xs">Net</p>
                      <p className="font-semibold" style={{ color: m.net >= 0 ? '#10b981' : '#ef4444' }}>
                        {m.net >= 0 ? '+' : ''}₹{m.net.toLocaleString()}
                      </p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      <Modal
        isOpen={memberModal}
        onClose={() => { setMemberModal(false); setMemberError(''); }}
        title="Add Member"
        size="sm"
        footer={
          <>
            <button className="btn btn-outline" onClick={() => setMemberModal(false)}>Cancel</button>
            <button className="btn btn-primary" onClick={handleAddMember}>Add</button>
          </>
        }
      >
        <div className="form-group">
          <label className="form-label">Name *</label>
          <input className="form-control" placeholder="Full name" value={memberForm.name}
            onChange={e => setMemberForm(f => ({ ...f, name: e.target.value }))} />
        </div>
        <div className="form-group">
          <label className="form-label">Email *</label>
          <input className="form-control" type="email" placeholder="email@example.com" value={memberForm.email}
            onChange={e => setMemberForm(f => ({ ...f, email: e.target.value }))} />
        </div>
        {memberError && <p className="form-error">{memberError}</p>}
      </Modal>
    </div>
  );
};

export default GroupDetail;
