import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useGroups } from '../../context/GroupContext';
import { useExpenses } from '../../context/ExpenseContext';
import { useAuth } from '../../context/AuthContext';
import PageLoader from '../../components/shared/PageLoader';
import { type Member, type PaymentRecord } from '../../types';
import { simplifyDebts } from '../../utils/debtUtils';
import { groupService } from '../../services/groupService';
import GroupStatsRow from './components/GroupStatsRow';
import GroupDebtCards from './components/GroupDebtCards';
import ExpensesTab from './components/ExpensesTab';
import BalancesTab from './components/BalancesTab';
import MembersTab from './components/MembersTab';
import RecordPaymentModal from './components/RecordPaymentModal';
import AddMembersModal from './components/AddMembersModal';
import './GroupDetail.css';

interface PendingMember {
  key: string;
  userId: string | null;
  name: string;
  email: string;
  mobile?: string;
  avatar: string;
  isRegistered: boolean;
  locked: boolean;
}

const formatDate = (dateString: string) => {
  if (!dateString) return '';
  const date = new Date(dateString);
  const day = date.getDate().toString().padStart(2, '0');
  const month = date.toLocaleString('default', { month: 'short' });
  return `${day}-${month}-${date.getFullYear()}`;
};

const GroupDetail = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { groups, addMember, removeMember, status: groupsStatus } = useGroups();
  const { expenses, deleteExpense, refetch: refetchExpenses, status: expensesStatus } = useExpenses();
  const { user } = useAuth();

  const group = groups.find(g => g.id === id);

  const isSelfMember = (m: Member) => !!user?.id && !!m.userId && m.userId === user.id;
  const canModify = (e: { groupId: string }) => {
    if (!user) return false;
    return groups.some(g => g.id === e.groupId && g.members.some(isSelfMember));
  };

  // ── Tab ──────────────────────────────────────────────────────────────────────
  const [activeTab, setActiveTab] = useState<'expenses' | 'members' | 'balances'>('expenses');

  // ── Error banners ────────────────────────────────────────────────────────────
  const [removeError, setRemoveError] = useState<string | null>(null);
  const [leaveError, setLeaveError] = useState<string | null>(null);
  const [expenseDeleteError, setExpenseDeleteError] = useState<string | null>(null);

  // ── Member modal state ───────────────────────────────────────────────────────
  const [memberModal, setMemberModal] = useState(false);
  const [memberAdding, setMemberAdding] = useState(false);
  const [memberError, setMemberError] = useState('');

  // ── Payment modal state ──────────────────────────────────────────────────────
  const [paymentModal, setPaymentModal] = useState(false);
  const [paymentFrom, setPaymentFrom] = useState('');
  const [paymentTo, setPaymentTo] = useState('');

  // ── Payment history ──────────────────────────────────────────────────────────
  const [paymentHistory, setPaymentHistory] = useState<PaymentRecord[]>([]);

  const loadPaymentHistory = useCallback(async (groupId: string) => {
    try {
      const records = await groupService.getPayments(groupId);
      setPaymentHistory(records);
    } catch {
      // non-fatal
    }
  }, []);

  useEffect(() => {
    if (id) void loadPaymentHistory(id);
  }, [id, loadPaymentHistory]);

  // ── Guard ────────────────────────────────────────────────────────────────────
  const isLoading = groupsStatus === 'loading' || groupsStatus === 'idle'
    || expensesStatus === 'loading' || expensesStatus === 'idle';

  if (isLoading && !group) return <PageLoader message="Loading group…" />;

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

  const memberBalances = group.members.map(m => {
    const paid = groupExpenses.filter(e => e.paidBy === m.id).reduce((s, e) => s + e.amount, 0);
    const share = groupExpenses.reduce((s, e) => {
      const split = e.splits.find(sp => sp.memberId === m.id);
      return s + (split?.amount ?? 0);
    }, 0);
    let net = 0;
    for (const e of groupExpenses) {
      const isPayer = e.paidBy === m.id;
      for (const split of e.splits) {
        const remaining = split.paid ? 0 : split.amount - (split.paidAmount ?? 0);
        if (split.memberId === m.id) { if (!isPayer) net -= remaining; }
        else if (isPayer) { net += remaining; }
      }
    }
    return { id: m.id, name: m.name, avatar: m.avatar, email: m.email, paid, share, net };
  });

  const simplified = group.simplifyDebts
    ? simplifyDebts(memberBalances)
    : groupExpenses.flatMap(expense =>
        expense.splits
          .filter(s => !s.paid && s.memberId !== expense.paidBy)
          .map(s => ({
            fromId: s.memberId, fromName: s.memberName,
            toId: expense.paidBy, toName: expense.paidByName,
            amount: s.amount - (s.paidAmount ?? 0),
          }))
          .filter(t => t.amount > 0.01)
      );

  const selfMember = group.members.find(m => !!user?.id && !!m.userId && m.userId === user.id);
  const youOwe = simplified.filter(t => t.fromId === selfMember?.id).reduce((s, t) => s + t.amount, 0);
  const owedToYou = simplified.filter(t => t.toId === selfMember?.id).reduce((s, t) => s + t.amount, 0);

  // ── Existing members pool (from other groups) ────────────────────────────────
  const currentGroupUserIds = new Set(group.members.map(m => m.userId).filter(Boolean));
  const currentGroupEmails = new Set(group.members.filter(m => !m.userId && m.email).map(m => m.email.toLowerCase()));
  const currentGroupMobiles = new Set(group.members.filter(m => !m.userId && m.mobile).map(m => m.mobile!.trim()));
  const existingPool: { id: string; name: string; email: string; mobile?: string; avatar: string; userId: string | null }[] = [];
  const seenKeys = new Set<string>();
  groups.forEach(g => {
    if (g.id === group.id) return;
    g.members.forEach(m => {
      const dedupKey = m.userId ?? (m.email ? `email:${m.email.toLowerCase()}` : null) ?? (m.mobile ? `mobile:${m.mobile.trim()}` : null);
      if (!dedupKey || seenKeys.has(dedupKey)) return;
      const alreadyInGroup = m.userId
        ? currentGroupUserIds.has(m.userId)
        : (m.email ? currentGroupEmails.has(m.email.toLowerCase()) : (m.mobile ? currentGroupMobiles.has(m.mobile.trim()) : false));
      if (alreadyInGroup) return;
      seenKeys.add(dedupKey);
      existingPool.push({ id: m.id, name: m.name, email: m.email, mobile: m.mobile, avatar: m.avatar, userId: m.userId ?? null });
    });
  });

  // ── Handlers ─────────────────────────────────────────────────────────────────
  const handleRemoveMember = async (memberId: string, memberName: string) => {
    const hasUnsettledDebt = groupExpenses.some(e => e.splits.some(s => s.memberId === memberId && !s.paid));
    if (hasUnsettledDebt) {
      setRemoveError(`Cannot remove ${memberName} — they have unsettled debts. Settle all their splits first.`);
      return;
    }
    const hasPendingTransactions = simplified.some(t => t.fromId === memberId || t.toId === memberId);
    if (hasPendingTransactions) {
      const owes = simplified.some(t => t.fromId === memberId);
      const getsBack = simplified.some(t => t.toId === memberId);
      const reason = owes && getsBack
        ? 'they owe money and are owed money by others'
        : owes ? 'they still owe money to others' : 'others still owe them money';
      setRemoveError(`Cannot remove ${memberName} — ${reason}. Settle all transactions first.`);
      return;
    }
    setRemoveError(null);
    try { void removeMember(memberId, group.id); }
    catch (err) { setRemoveError(err instanceof Error ? err.message : `Failed to remove ${memberName}`); }
  };

  const handleDeleteExpense = async (expenseId: string) => {
    setExpenseDeleteError(null);
    try { void deleteExpense(expenseId); }
    catch (err) { setExpenseDeleteError(err instanceof Error ? err.message : 'Failed to delete expense'); }
  };

  const handleLeaveGroup = () => {
    if (!selfMember) return;
    if (youOwe > 0.01) { setLeaveError('You still owe money in this group. Settle your dues before leaving.'); return; }
    if (owedToYou > 0.01) { setLeaveError('Others still owe you money in this group. Collect your dues or write them off before leaving.'); return; }
    void removeMember(selfMember.id, group.id);
    navigate('/groups');
  };

  const handleAddMembers = async (pending: PendingMember[]) => {
    if (pending.length === 0) { setMemberError('Add at least one member'); return; }
    setMemberAdding(true);
    setMemberError('');
    const errors: string[] = [];
    for (const p of pending) {
      try {
        await addMember({ name: p.name, email: p.email, ...(p.mobile ? { mobile: p.mobile } : {}), avatar: p.avatar, groupId: group.id, userId: p.userId });
      } catch (err) {
        errors.push(`${p.name}: ${err instanceof Error ? err.message : 'failed'}`);
      }
    }
    setMemberAdding(false);
    if (errors.length > 0) { setMemberError(errors.join(' · ')); }
    else { setMemberModal(false); setMemberError(''); }
  };

  const handlePaymentSuccess = async () => {
    await Promise.all([refetchExpenses(), loadPaymentHistory(group.id)]);
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

      <GroupStatsRow
        total={total}
        expenseCount={groupExpenses.length}
        memberCount={group.members.length}
        selfMember={!!selfMember}
        youOwe={youOwe}
        owedToYou={owedToYou}
      />

      {selfMember && (
        <GroupDebtCards
          selfMemberId={selfMember.id}
          simplified={simplified}
          owedToYou={owedToYou}
          youOwe={youOwe}
        />
      )}

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

      {activeTab === 'expenses' && (
        <ExpensesTab
          groupId={group.id}
          expenses={groupExpenses}
          expenseDeleteError={expenseDeleteError}
          onDeleteError={setExpenseDeleteError}
          onDelete={handleDeleteExpense}
          canModify={canModify}
          formatDate={formatDate}
        />
      )}

      {activeTab === 'balances' && (
        <BalancesTab
          memberBalances={memberBalances}
          simplified={simplified}
          paymentHistory={paymentHistory}
          selfMemberId={selfMember?.id}
          simplifyDebts={group.simplifyDebts}
          formatDate={formatDate}
          onPayClick={(from, to) => { setPaymentFrom(from); setPaymentTo(to); setPaymentModal(true); }}
        />
      )}

      {activeTab === 'members' && (
        <MembersTab
          memberCount={group.members.length}
          memberBalances={memberBalances}
          selfMemberId={selfMember?.id}
          removeError={removeError}
          onRemoveError={setRemoveError}
          onRemove={handleRemoveMember}
          onAddMember={() => setMemberModal(true)}
        />
      )}

      <RecordPaymentModal
        isOpen={paymentModal}
        groupId={group.id}
        members={group.members}
        simplified={simplified}
        fromMemberId={paymentFrom}
        toMemberId={paymentTo}
        onClose={() => setPaymentModal(false)}
        onSuccess={handlePaymentSuccess}
      />

      <AddMembersModal
        isOpen={memberModal}
        groupMembers={group.members}
        existingPool={existingPool}
        adding={memberAdding}
        error={memberError}
        onClose={() => { setMemberModal(false); setMemberError(''); }}
        onAdd={handleAddMembers}
      />
    </div>
  );
};

export default GroupDetail;
