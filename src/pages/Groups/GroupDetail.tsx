import { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useGroups } from '../../context/GroupContext';
import { useExpenses } from '../../context/ExpenseContext';
import { useAuth } from '../../context/AuthContext';
import Modal from '../../components/modal/Modal';
import { ExpenseCategory, PaymentRecord, Member } from '../../types';
import { simplifyDebts } from '../../utils/debtUtils';
import { groupService, UserSuggestion } from '../../services/groupService';
import './GroupDetail.css';

const CATEGORY_ICONS: Record<ExpenseCategory, string> = {
  food: '🍔',
  transport: '🚗',
  accommodation: '🏨',
  entertainment: '🎬',
  utilities: '💡',
  other: '📦',
};

// A pending entry in the "Add Members" modal
interface PendingMember {
  key: string; // stable React key (userId for registered, timestamp for manual)
  userId: string | null; // set for registered SplitWise users
  name: string;
  email: string;
  mobile?: string;
  avatar: string;
  isRegistered: boolean; // false = not found in SplitWise
  locked: boolean; // true when picked from a suggestion
}

const GroupDetail = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { groups, addMember, removeMember } = useGroups();
  const { expenses, deleteExpense, refetch: refetchExpenses } = useExpenses();
  const { user } = useAuth();

  const group = groups.find((g) => g.id === id);

  const isSelfMember = (m: Member) =>
    !!user?.id && !!m.userId && m.userId === user.id;

  const canModify = (e: { groupId: string }) => {
    if (!user) return false;
    return groups.some(
      (g) => g.id === e.groupId && g.members.some(isSelfMember)
    );
  };

  const formatDate = (dateString: string) => {
    if (!dateString) return '';
    const date = new Date(dateString);
    const day = date.getDate().toString().padStart(2, '0');
    const month = date.toLocaleString('default', { month: 'short' });
    const year = date.getFullYear();
    return `${day}-${month}-${year}`;
  };

  // ── Modal state ──────────────────────────────────────────────────────────────
  const [memberModal, setMemberModal] = useState(false);
  const [memberAdding, setMemberAdding] = useState(false);
  const [memberError, setMemberError] = useState('');

  // Search input
  const [searchQuery, setSearchQuery] = useState('');
  const [suggestions, setSuggestions] = useState<UserSuggestion[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [searchDone, setSearchDone] = useState(false); // true after first debounce result

  // Pending members to add (multi-select basket)
  const [pending, setPending] = useState<PendingMember[]>([]);

  // Single manual-entry form (for unregistered)
  const [manualForm, setManualForm] = useState({
    name: '',
    email: '',
    mobile: '',
    contactMethod: 'email' as 'email' | 'mobile',
  });
  const [manualError, setManualError] = useState('');
  const [showManual, setShowManual] = useState(false);

  const suggestionsRef = useRef<HTMLDivElement>(null);
  const searchTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ── Payment modal state ──────────────────────────────────────────────────────
  const [paymentModal, setPaymentModal] = useState(false);
  const [paymentForm, setPaymentForm] = useState({
    fromMemberId: '',
    toMemberId: '',
    amount: '',
  });
  const [paymentSaving, setPaymentSaving] = useState(false);
  const [paymentError, setPaymentError] = useState('');
  const [paymentSuccess, setPaymentSuccess] = useState('');

  // ── Payment history ──────────────────────────────────────────────────────────
  const [paymentHistory, setPaymentHistory] = useState<PaymentRecord[]>([]);

  const loadPaymentHistory = useCallback(async (groupId: string) => {
    try {
      const records = await groupService.getPayments(groupId);
      setPaymentHistory(records);
    } catch {
      // non-fatal — history stays empty
    }
  }, []);

  // ── Other tab/error state ────────────────────────────────────────────────────
  const [activeTab, setActiveTab] = useState<
    'expenses' | 'members' | 'balances'
  >('expenses');
  const [removeError, setRemoveError] = useState<string | null>(null);
  const [leaveError, setLeaveError] = useState<string | null>(null);
  const [expenseDeleteError, setExpenseDeleteError] = useState<string | null>(
    null
  );

  // Load payment history whenever the group changes
  useEffect(() => {
    if (id) void loadPaymentHistory(id);
  }, [id, loadPaymentHistory]);

  // Close suggestions on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (
        suggestionsRef.current &&
        !suggestionsRef.current.contains(e.target as Node)
      ) {
        setShowSuggestions(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  // ── Search handler ───────────────────────────────────────────────────────────
  const handleSearchChange = (value: string) => {
    setSearchQuery(value);
    setShowSuggestions(false);
    setSearchDone(false);
    if (searchTimeout.current) clearTimeout(searchTimeout.current);
    if (value.trim().length < 2) {
      setSuggestions([]);
      return;
    }

    searchTimeout.current = setTimeout(async () => {
      try {
        const results = await groupService.searchUsers(value.trim());
        // Exclude already-in-group members and already-pending members
        const filtered = results.filter(
          (u) =>
            !group?.members.some((m) => m.userId === u.id) &&
            !pending.some((p) => p.userId === u.id)
        );
        setSuggestions(filtered);
        setShowSuggestions(filtered.length > 0);
        setSearchDone(true);
      } catch {
        setSuggestions([]);
        setSearchDone(true);
      }
    }, 300);
  };

  // Pick a registered user from suggestions → add to pending basket
  const pickSuggestion = (u: UserSuggestion) => {
    setPending((prev) => [
      ...prev,
      {
        key: u.id,
        userId: u.id,
        name: u.name,
        email: u.email || u.mobile,
        avatar: u.avatar,
        isRegistered: true,
        locked: true,
      },
    ]);
    setSearchQuery('');
    setSuggestions([]);
    setShowSuggestions(false);
    setSearchDone(false);
  };

  // Remove from pending basket
  const removePending = (key: string) => {
    setPending((prev) => prev.filter((p) => p.key !== key));
  };

  // Add a manually-typed (unregistered) member
  const addManualMember = () => {
    const name = manualForm.name.trim();
    const email = manualForm.email.trim().toLowerCase();
    const mobile = manualForm.mobile.trim();
    if (!name) {
      setManualError('Name is required');
      return;
    }
    if (manualForm.contactMethod === 'email' && !email) {
      setManualError('Email is required');
      return;
    }
    if (manualForm.contactMethod === 'mobile' && !mobile) {
      setManualError('Mobile number is required');
      return;
    }
    if (manualForm.contactMethod === 'mobile' && !/^[6-9]\d{9}$/.test(mobile)) {
      setManualError('Enter a valid 10-digit mobile number');
      return;
    }
    setManualError('');
    const contact = manualForm.contactMethod === 'email' ? email : mobile;
    setPending((prev) => [
      ...prev,
      {
        key: `manual_${Date.now()}`,
        userId: null,
        name,
        email: manualForm.contactMethod === 'email' ? email : '',
        mobile: manualForm.contactMethod === 'mobile' ? mobile : undefined,
        avatar: `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(
          name
        )}`,
        isRegistered: false,
        locked: false,
      } as PendingMember,
    ]);
    setManualForm({
      name: '',
      email: '',
      mobile: '',
      contactMethod: manualForm.contactMethod,
    });
    setShowManual(false);
    setSearchQuery('');
    setSearchDone(false);
    void contact; // used for dedup — kept for clarity
  };

  const closeMemberModal = () => {
    setMemberModal(false);
    setMemberError('');
    setPending([]);
    setSearchQuery('');
    setSuggestions([]);
    setShowSuggestions(false);
    setSearchDone(false);
    setShowManual(false);
    setManualForm({ name: '', email: '', mobile: '', contactMethod: 'email' });
    setManualError('');
  };

  // ── Batch add all pending members ────────────────────────────────────────────
  const handleAddMembers = async () => {
    if (pending.length === 0) {
      setMemberError('Add at least one member');
      return;
    }
    setMemberAdding(true);
    setMemberError('');
    const errors: string[] = [];
    for (const p of pending) {
      try {
        await addMember({
          name: p.name,
          email: p.email,
          ...(p.mobile ? { mobile: p.mobile } : {}),
          avatar: p.avatar,
          groupId: group!.id,
          userId: p.userId,
        });
      } catch (err) {
        errors.push(
          `${p.name}: ${err instanceof Error ? err.message : 'failed'}`
        );
      }
    }
    setMemberAdding(false);
    if (errors.length > 0) {
      setMemberError(errors.join(' · '));
    } else {
      closeMemberModal();
    }
  };

  // ── Payment handler ──────────────────────────────────────────────────────────
  const openPaymentModal = (fromMemberId: string, toMemberId: string) => {
    setPaymentForm({ fromMemberId, toMemberId, amount: '' });
    setPaymentError('');
    setPaymentSuccess('');
    setPaymentModal(true);
  };

  const closePaymentModal = () => {
    setPaymentModal(false);
    setPaymentForm({ fromMemberId: '', toMemberId: '', amount: '' });
    setPaymentError('');
    setPaymentSuccess('');
    setPaymentSaving(false);
  };

  const handleRecordPayment = async () => {
    const amt = parseFloat(paymentForm.amount);
    if (!amt || amt <= 0) {
      setPaymentError('Enter a valid amount');
      return;
    }
    setPaymentSaving(true);
    setPaymentError('');
    try {
      await groupService.recordPayment(
        group!.id,
        paymentForm.fromMemberId,
        paymentForm.toMemberId,
        amt
      );
      // Refresh expenses (updates balances everywhere) and payment history
      await Promise.all([refetchExpenses(), loadPaymentHistory(group!.id)]);
      closePaymentModal(); // resets paymentSaving too
    } catch (err) {
      setPaymentError(
        err instanceof Error ? err.message : 'Failed to record payment'
      );
      setPaymentSaving(false);
    }
  };

  // ── Member / expense handlers ────────────────────────────────────────────────
  const handleRemoveMember = async (memberId: string, memberName: string) => {
    const hasUnsettledDebt = groupExpenses.some((e) =>
      e.splits.some((s) => s.memberId === memberId && !s.paid)
    );
    if (hasUnsettledDebt) {
      setRemoveError(
        `Cannot remove ${memberName} — they have unsettled debts. Settle all their splits first.`
      );
      return;
    }
    setRemoveError(null);
    try {
      void removeMember(memberId, group!.id);
    } catch (err) {
      setRemoveError(
        err instanceof Error ? err.message : `Failed to remove ${memberName}`
      );
    }
  };

  const handleDeleteExpense = async (expenseId: string) => {
    setExpenseDeleteError(null);
    try {
      void deleteExpense(expenseId);
    } catch (err) {
      setExpenseDeleteError(
        err instanceof Error ? err.message : 'Failed to delete expense'
      );
    }
  };

  const handleLeaveGroup = () => {
    if (!selfMember) return;
    const hasUnsettled = groupExpenses.some((e) =>
      e.splits.some((s) => s.memberId === selfMember.id && !s.paid)
    );
    if (hasUnsettled) {
      setLeaveError(
        'You have unsettled debts in this group. Clear all your payments before leaving.'
      );
      return;
    }
    void removeMember(selfMember.id, group!.id);
    navigate('/groups');
  };

  // ── Guard ────────────────────────────────────────────────────────────────────
  if (!group)
    return (
      <div className="page-content">
        <div className="empty-state">
          <div className="empty-icon">🔍</div>
          <h3>Group not found</h3>
          <button
            className="btn btn-primary"
            onClick={() => navigate('/groups')}
          >
            Back to Groups
          </button>
        </div>
      </div>
    );

  const groupExpenses = expenses.filter((e) => e.groupId === id);
  const total = groupExpenses.reduce((sum, e) => sum + e.amount, 0);

  const memberBalances = group.members.map((m) => {
    const paid = groupExpenses
      .filter((e) => e.paidBy === m.id)
      .reduce((s, e) => s + e.amount, 0);
    const share = groupExpenses.reduce((s, e) => {
      const split = e.splits.find((sp) => sp.memberId === m.id);
      return s + (split?.amount ?? 0);
    }, 0);
    // Net: for each expense, sum what others still owe me (I paid) minus what I still owe others
    let net = 0;
    for (const e of groupExpenses) {
      const isPayer = e.paidBy === m.id;
      for (const split of e.splits) {
        const remaining = split.paid
          ? 0
          : split.amount - (split.paidAmount ?? 0);
        if (split.memberId === m.id) {
          if (!isPayer) net -= remaining;
        } else if (isPayer) {
          net += remaining;
        }
      }
    }
    return {
      id: m.id,
      name: m.name,
      avatar: m.avatar,
      email: m.email,
      paid,
      share,
      net,
    };
  });

  const simplified = group.simplifyDebts
    ? simplifyDebts(memberBalances)
    : groupExpenses.flatMap((expense) =>
        expense.splits
          .filter((s) => !s.paid && s.memberId !== expense.paidBy)
          .map((s) => ({
            fromId: s.memberId,
            fromName: s.memberName,
            toId: expense.paidBy,
            toName: expense.paidByName,
            // Show remaining unpaid amount after any partial payment
            amount: s.amount - (s.paidAmount ?? 0),
          }))
          .filter((t) => t.amount > 0.01)
      );

  const selfMember = group.members.find(
    (m) => !!user?.id && !!m.userId && m.userId === user.id
  );
  const youOwe = simplified
    .filter((t) => t.fromId === selfMember?.id)
    .reduce((s, t) => s + t.amount, 0);
  const owedToYou = simplified
    .filter((t) => t.toId === selfMember?.id)
    .reduce((s, t) => s + t.amount, 0);

  // "no match in system" state — search completed, results empty, query non-empty, no suggestions shown
  const noMatch =
    searchDone &&
    searchQuery.trim().length >= 2 &&
    suggestions.length === 0 &&
    !showSuggestions;

  // Members from other groups that can be added to this group.
  // Registered users (userId set) are deduplicated by userId.
  // Unregistered guests (no userId) are deduplicated by non-empty email; those with no email are skipped.
  const currentGroupUserIds = new Set(
    group.members.map((m) => m.userId).filter(Boolean)
  );
  const currentGroupEmails = new Set(
    group.members
      .filter((m) => !m.userId && m.email)
      .map((m) => m.email.toLowerCase())
  );
  const currentGroupMobiles = new Set(
    group.members
      .filter((m) => !m.userId && m.mobile)
      .map((m) => m.mobile!.trim())
  );
  const existingPool: {
    id: string;
    name: string;
    email: string;
    mobile?: string;
    avatar: string;
    userId: string | null;
  }[] = [];
  const seenKeys = new Set<string>();
  groups.forEach((g) => {
    if (g.id === group.id) return;
    g.members.forEach((m) => {
      const dedupKey =
        m.userId ??
        (m.email ? `email:${m.email.toLowerCase()}` : null) ??
        (m.mobile ? `mobile:${m.mobile.trim()}` : null);
      if (!dedupKey) return;
      if (seenKeys.has(dedupKey)) return;
      const alreadyInGroup = m.userId
        ? currentGroupUserIds.has(m.userId)
        : m.email
        ? currentGroupEmails.has(m.email.toLowerCase())
        : m.mobile
        ? currentGroupMobiles.has(m.mobile.trim())
        : false;
      if (alreadyInGroup) return;
      const alreadyPending = pending.some((p) =>
        m.userId
          ? p.key === m.userId
          : m.email
          ? p.email && p.email.toLowerCase() === m.email.toLowerCase()
          : m.mobile
          ? p.mobile && p.mobile.trim() === m.mobile!.trim()
          : false
      );
      if (alreadyPending) return;
      seenKeys.add(dedupKey);
      existingPool.push({
        id: m.id,
        name: m.name,
        email: m.email,
        mobile: m.mobile,
        avatar: m.avatar,
        userId: m.userId ?? null,
      });
    });
  });

  return (
    <div className="page-content">
      <div className="page-header">
        <div className="flex items-center gap-3">
          <button
            className="btn btn-outline btn-sm"
            onClick={() => navigate('/groups')}
          >
            ← Back
          </button>
          <div>
            <h1 className="page-title">{group.name}</h1>
            {group.description && (
              <p className="page-subtitle">{group.description}</p>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2">
          {selfMember && (
            <button
              className="btn btn-outline btn-sm"
              style={{ color: '#ef4444', borderColor: '#ef4444' }}
              onClick={handleLeaveGroup}
            >
              🚪 Leave Group
            </button>
          )}
          <button
            className="btn btn-primary"
            onClick={() => navigate(`/expenses/new?groupId=${group.id}`)}
          >
            + Add Expense
          </button>
        </div>
      </div>

      {leaveError && (
        <div className="remove-error-banner mb-4">
          ⚠️ {leaveError}
          <button
            className="remove-error-close"
            onClick={() => setLeaveError(null)}
          >
            ✕
          </button>
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
              <p
                className="stat-value-sm"
                style={{ color: youOwe > 0 ? '#ef4444' : '#10b981' }}
              >
                ₹{youOwe.toLocaleString()}
              </p>
            </div>
            <div className="mini-stat card card-body">
              <p className="text-muted text-sm">Owed to You</p>
              <p
                className="stat-value-sm"
                style={{ color: owedToYou > 0 ? '#10b981' : '#64748b' }}
              >
                ₹{owedToYou.toLocaleString()}
              </p>
            </div>
          </>
        )}
      </div>

      {/* ── Debt cards ── */}
      {selfMember && (
        <div className="debt-cards-row mb-4">
          <div className="debt-card debt-card-receive card card-body">
            <div className="debt-card-header">
              <span className="debt-card-icon">💰</span>
              <div>
                <h4 className="debt-card-title">Owed to You</h4>
                <p className="debt-card-total">
                  {owedToYou > 0
                    ? `₹${owedToYou.toLocaleString()} total`
                    : 'Nothing owed'}
                </p>
              </div>
            </div>
            {simplified.filter((t) => t.toId === selfMember.id).length === 0 ? (
              <p className="debt-card-empty">You're all settled up! 🎉</p>
            ) : (
              <div className="debt-person-list">
                {simplified
                  .filter((t) => t.toId === selfMember.id)
                  .map((t, i) => (
                    <div key={i} className="debt-person-row">
                      <img
                        src={`https://api.dicebear.com/7.x/initials/svg?seed=${t.fromName}`}
                        alt={t.fromName}
                        className="avatar avatar-sm"
                      />
                      <span className="debt-person-name">
                        {t.fromName.split(' ')[0]}
                      </span>
                      <span className="debt-person-amount receive">
                        ₹{t.amount.toLocaleString()}
                      </span>
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
                  {youOwe > 0
                    ? `₹${youOwe.toLocaleString()} total`
                    : 'Nothing owed'}
                </p>
              </div>
            </div>
            {simplified.filter((t) => t.fromId === selfMember.id).length ===
            0 ? (
              <p className="debt-card-empty">You don't owe anyone! 🎉</p>
            ) : (
              <div className="debt-person-list">
                {simplified
                  .filter((t) => t.fromId === selfMember.id)
                  .map((t, i) => (
                    <div key={i} className="debt-person-row">
                      <img
                        src={`https://api.dicebear.com/7.x/initials/svg?seed=${t.toName}`}
                        alt={t.toName}
                        className="avatar avatar-sm"
                      />
                      <span className="debt-person-name">
                        {t.toName.split(' ')[0]}
                      </span>
                      <span className="debt-person-amount owe">
                        ₹{t.amount.toLocaleString()}
                      </span>
                    </div>
                  ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── Tabs ── */}
      <div className="tabs mb-4">
        <button
          className={`tab ${activeTab === 'expenses' ? 'tab-active' : ''}`}
          onClick={() => setActiveTab('expenses')}
        >
          💰 Expenses ({groupExpenses.length})
        </button>
        <button
          className={`tab ${activeTab === 'balances' ? 'tab-active' : ''}`}
          onClick={() => setActiveTab('balances')}
        >
          ⚖️ Balances
        </button>
        <button
          className={`tab ${activeTab === 'members' ? 'tab-active' : ''}`}
          onClick={() => setActiveTab('members')}
        >
          👥 Members ({group.members.length})
        </button>
      </div>

      {/* ── Expenses tab ── */}
      {activeTab === 'expenses' && (
        <div className="card">
          {expenseDeleteError && (
            <div
              className="remove-error-banner"
              style={{ borderRadius: '12px 12px 0 0' }}
            >
              ⚠️ {expenseDeleteError}
              <button
                className="remove-error-close"
                onClick={() => setExpenseDeleteError(null)}
              >
                ✕
              </button>
            </div>
          )}
          <div className="card-body">
            {groupExpenses.length === 0 ? (
              <div className="empty-state">
                <div className="empty-icon">💸</div>
                <h3>No expenses yet</h3>
                <p>Add the first expense to this group</p>
                <button
                  className="btn btn-primary"
                  onClick={() => navigate(`/expenses/new?groupId=${group.id}`)}
                >
                  Add Expense
                </button>
              </div>
            ) : (
              <div className="expense-list">
                {groupExpenses.map((e) => (
                  <div key={e.id} className="expense-row">
                    <div className="expense-row-icon">
                      {CATEGORY_ICONS[e.category]}
                    </div>
                    <div className="expense-row-info">
                      <p className="font-semibold text-sm">{e.title}</p>
                      <p className="text-xs text-muted">
                        Paid by {e.paidByName} · {formatDate(e.date)}
                      </p>
                    </div>
                    <div className="expense-row-splits">
                      {e.splits.map((s) => (
                        <span
                          key={s.memberId}
                          className={`split-chip ${
                            s.paid ? 'split-paid' : 'split-unpaid'
                          }`}
                        >
                          {s.memberName.split(' ')[0]}: ₹{s.amount}
                        </span>
                      ))}
                    </div>
                    <div className="expense-row-actions">
                      <span className="expense-amount">
                        ₹{e.amount.toLocaleString()}
                      </span>
                      <button
                        className="btn btn-outline btn-sm"
                        onClick={() => navigate(`/expenses/edit/${e.id}`)}
                        disabled={!canModify(e)}
                        title={
                          !canModify(e)
                            ? 'You are not a participant in this expense'
                            : ''
                        }
                      >
                        Edit
                      </button>
                      <button
                        className="btn btn-danger btn-sm"
                        onClick={() => handleDeleteExpense(e.id)}
                        disabled={!canModify(e)}
                        title={
                          !canModify(e)
                            ? 'You are not a participant in this expense'
                            : ''
                        }
                      >
                        Delete
                      </button>
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
          <div className="card card-body">
            <h3 className="font-semibold mb-4">Member Balances</h3>
            {memberBalances.length === 0 ? (
              <p className="text-muted text-sm">No members yet</p>
            ) : (
              <div className="balance-list">
                {memberBalances.map((m) => (
                  <div
                    key={m.id}
                    className={`balance-row ${
                      m.id === selfMember?.id ? 'balance-row-self' : ''
                    }`}
                  >
                    <img
                      src={m.avatar}
                      alt={m.name}
                      className="avatar avatar-sm"
                    />
                    <div className="balance-member-info">
                      <p className="text-sm font-semibold">
                        {m.name}
                        {m.id === selfMember?.id && (
                          <span className="self-tag">you</span>
                        )}
                      </p>
                      <div className="balance-bars">
                        <span className="text-xs" style={{ color: '#10b981' }}>
                          paid ₹{m.paid.toLocaleString()}
                        </span>
                        <span className="text-xs text-muted">·</span>
                        <span className="text-xs" style={{ color: '#ef4444' }}>
                          share ₹{m.share.toLocaleString()}
                        </span>
                      </div>
                    </div>
                    <div className="balance-net">
                      <span
                        className={`balance-net-value ${
                          m.net > 0
                            ? 'net-positive'
                            : m.net < 0
                            ? 'net-negative'
                            : 'net-zero'
                        }`}
                      >
                        {m.net > 0
                          ? `gets back ₹${m.net.toLocaleString()}`
                          : m.net < 0
                          ? `owes ₹${Math.abs(m.net).toLocaleString()}`
                          : 'settled up'}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="card card-body">
            <div className="flex justify-between items-center mb-4">
              <div>
                <h3 className="font-semibold">Settle Up</h3>
                <p className="text-xs text-muted mt-1">
                  {group.simplifyDebts
                    ? 'Minimum transactions to clear all debts'
                    : 'Per-expense payment breakdown'}
                </p>
              </div>
              {simplified.length > 0 && (
                <span className="badge badge-primary">
                  {simplified.length} payment{simplified.length > 1 ? 's' : ''}
                </span>
              )}
            </div>
            {simplified.length === 0 ? (
              <div className="settled-state">
                <div style={{ fontSize: 40, marginBottom: 12 }}>🎉</div>
                <p className="font-semibold">All settled up!</p>
                <p className="text-sm text-muted mt-1">
                  No outstanding debts in this group
                </p>
              </div>
            ) : (
              <div className="settle-list">
                {simplified.map((t, i) => {
                  const isYouPaying = t.fromId === selfMember?.id;
                  const isYouReceiving = t.toId === selfMember?.id;
                  return (
                    <div
                      key={i}
                      className={`settle-row ${
                        isYouPaying
                          ? 'settle-you-pay'
                          : isYouReceiving
                          ? 'settle-you-receive'
                          : ''
                      }`}
                    >
                      <div className="settle-avatars">
                        <img
                          src={`https://api.dicebear.com/7.x/initials/svg?seed=${t.fromName}`}
                          alt={t.fromName}
                          className="avatar avatar-sm"
                        />
                        <span className="settle-arrow">→</span>
                        <img
                          src={`https://api.dicebear.com/7.x/initials/svg?seed=${t.toName}`}
                          alt={t.toName}
                          className="avatar avatar-sm"
                        />
                      </div>
                      <div className="settle-info">
                        <p className="text-sm">
                          <span className="font-semibold">
                            {isYouPaying ? 'You' : t.fromName.split(' ')[0]}
                          </span>
                          <span className="text-muted"> pays </span>
                          <span className="font-semibold">
                            {isYouReceiving ? 'You' : t.toName.split(' ')[0]}
                          </span>
                        </p>
                        {(isYouPaying || isYouReceiving) && (
                          <span
                            className={`text-xs ${
                              isYouPaying
                                ? 'you-pay-label'
                                : 'you-receive-label'
                            }`}
                          >
                            {isYouPaying
                              ? '↑ you owe this'
                              : '↓ you receive this'}
                          </span>
                        )}
                      </div>
                      <span className="settle-amount">
                        ₹{t.amount.toLocaleString()}
                      </span>
                      <button
                        className="btn btn-sm btn-outline"
                        style={{ flexShrink: 0, marginLeft: 8 }}
                        onClick={() => openPaymentModal(t.fromId, t.toId)}
                        title="Record payment"
                      >
                        💸 Pay
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* ── Payment History ── */}
          {paymentHistory.length > 0 && (
            <div className="card card-body mt-4">
              <h4 className="font-semibold mb-3" style={{ fontSize: 14 }}>
                Payment History
              </h4>
              <div className="payment-history-list">
                {paymentHistory.map((p) => {
                  const isYou =
                    p.fromMemberId === selfMember?.id ||
                    p.toMemberId === selfMember?.id;
                  return (
                    <div
                      key={p.id}
                      className={`payment-history-row ${
                        isYou ? 'payment-history-row-you' : ''
                      }`}
                    >
                      <div className="payment-history-avatars">
                        <img
                          src={`https://api.dicebear.com/7.x/initials/svg?seed=${p.fromMemberName}`}
                          alt={p.fromMemberName}
                          className="avatar avatar-sm"
                        />
                        <span
                          style={{ fontSize: 12, color: 'var(--text-muted)' }}
                        >
                          →
                        </span>
                        <img
                          src={`https://api.dicebear.com/7.x/initials/svg?seed=${p.toMemberName}`}
                          alt={p.toMemberName}
                          className="avatar avatar-sm"
                        />
                      </div>
                      <div className="payment-history-info">
                        <span className="text-sm">
                          <span className="font-semibold">
                            {p.fromMemberId === selfMember?.id
                              ? 'You'
                              : p.fromMemberName.split(' ')[0]}
                          </span>
                          <span className="text-muted"> paid </span>
                          <span className="font-semibold">
                            {p.toMemberId === selfMember?.id
                              ? 'You'
                              : p.toMemberName.split(' ')[0]}
                          </span>
                        </span>
                        <span className="text-xs text-muted">
                          {formatDate(p.date)}
                        </span>
                      </div>
                      <span className="payment-history-amount">
                        ₹{p.appliedAmount.toLocaleString()}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── Members tab ── */}
      {activeTab === 'members' && (
        <div>
          <div className="flex justify-between items-center mb-4">
            <span className="text-sm text-muted">
              {group.members.length} member
              {group.members.length !== 1 ? 's' : ''}
            </span>
            <button
              className="btn btn-primary btn-sm"
              onClick={() => setMemberModal(true)}
            >
              + Add Member
            </button>
          </div>
          {removeError && (
            <div className="remove-error-banner">
              ⚠️ {removeError}
              <button
                className="remove-error-close"
                onClick={() => setRemoveError(null)}
              >
                ✕
              </button>
            </div>
          )}
          {group.members.length === 0 ? (
            <div className="card">
              <div className="empty-state">
                <div className="empty-icon">👤</div>
                <h3>No members yet</h3>
                <button
                  className="btn btn-primary"
                  onClick={() => setMemberModal(true)}
                >
                  Add Member
                </button>
              </div>
            </div>
          ) : (
            <div className="member-grid">
              {memberBalances.map((m) => (
                <div key={m.id} className="member-card card card-body">
                  <div className="flex justify-between items-start">
                    <div className="flex items-center gap-3">
                      <img
                        src={m.avatar}
                        alt={m.name}
                        className="avatar avatar-lg"
                      />
                      <div>
                        <p className="font-semibold">{m.name}</p>
                        <p className="text-xs text-muted">{m.email}</p>
                      </div>
                    </div>
                    <button
                      className="btn-icon"
                      onClick={() => handleRemoveMember(m.id, m.name)}
                      title="Remove member"
                    >
                      🗑️
                    </button>
                  </div>
                  <div className="divider" />
                  <div className="flex justify-between text-sm">
                    <div>
                      <p className="text-muted text-xs">Paid</p>
                      <p className="font-semibold" style={{ color: '#10b981' }}>
                        ₹{m.paid.toLocaleString()}
                      </p>
                    </div>
                    <div>
                      <p className="text-muted text-xs">Share</p>
                      <p className="font-semibold" style={{ color: '#ef4444' }}>
                        ₹{m.share.toLocaleString()}
                      </p>
                    </div>
                    <div>
                      <p className="text-muted text-xs">Net</p>
                      <p
                        className="font-semibold"
                        style={{ color: m.net >= 0 ? '#10b981' : '#ef4444' }}
                      >
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

      {/* ── Record Payment Modal ── */}
      <Modal
        isOpen={paymentModal}
        onClose={closePaymentModal}
        title="Record Payment"
        size="sm"
        footer={
          <>
            <button
              className="btn btn-outline"
              onClick={closePaymentModal}
              disabled={paymentSaving}
            >
              Cancel
            </button>
            <button
              className="btn btn-primary"
              onClick={handleRecordPayment}
              disabled={paymentSaving || !paymentForm.amount}
            >
              {paymentSaving ? 'Recording…' : 'Record Payment'}
            </button>
          </>
        }
      >
        {(() => {
          const fromMember = group.members.find(
            (m) => m.id === paymentForm.fromMemberId
          );
          const toMember = group.members.find(
            (m) => m.id === paymentForm.toMemberId
          );

          // How much fromMember still owes toMember
          const totalOwed = simplified
            .filter(
              (t) =>
                t.fromId === paymentForm.fromMemberId &&
                t.toId === paymentForm.toMemberId
            )
            .reduce((s, t) => s + t.amount, 0);

          return (
            <>
              {/* Payment summary header */}
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
                <span style={{ color: 'var(--text-muted)', fontSize: 18 }}>
                  →
                </span>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <img
                    src={toMember?.avatar}
                    alt={toMember?.name}
                    className="avatar avatar-sm"
                  />
                  <span className="text-sm font-semibold">
                    {toMember?.name ?? '—'}
                  </span>
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

              {/* Amount input */}
              <div className="form-group">
                <label className="form-label">Payment Amount (₹) *</label>
                <input
                  className="form-control"
                  type="number"
                  min="0.01"
                  step="0.01"
                  placeholder={`Full amount: ₹${totalOwed.toLocaleString()}`}
                  value={paymentForm.amount}
                  onChange={(e) =>
                    setPaymentForm((f) => ({ ...f, amount: e.target.value }))
                  }
                  autoFocus
                />
                {totalOwed > 0 && (
                  <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
                    <button
                      type="button"
                      className="btn btn-outline btn-sm"
                      onClick={() =>
                        setPaymentForm((f) => ({
                          ...f,
                          amount: totalOwed.toString(),
                        }))
                      }
                    >
                      Full ₹{totalOwed.toLocaleString()}
                    </button>
                  </div>
                )}
              </div>

              {paymentError && (
                <p className="form-error" style={{ marginTop: 8 }}>
                  {paymentError}
                </p>
              )}
              {paymentSuccess && (
                <p
                  style={{
                    color: '#10b981',
                    fontSize: 13,
                    marginTop: 8,
                    fontWeight: 500,
                  }}
                >
                  ✓ {paymentSuccess}
                </p>
              )}
            </>
          );
        })()}
      </Modal>

      {/* ── Add Members Modal ── */}
      <Modal
        isOpen={memberModal}
        onClose={closeMemberModal}
        title="Add Members"
        size="sm"
        footer={
          <>
            <button
              className="btn btn-outline"
              onClick={closeMemberModal}
              disabled={memberAdding}
            >
              Cancel
            </button>
            <button
              className="btn btn-primary"
              onClick={handleAddMembers}
              disabled={memberAdding || pending.length === 0}
            >
              {memberAdding
                ? 'Adding…'
                : `Add ${pending.length > 0 ? `${pending.length} ` : ''}Member${
                    pending.length !== 1 ? 's' : ''
                  }`}
            </button>
          </>
        }
      >
        {/* ── Quick-pick from members of other groups ── */}
        {existingPool.length > 0 && (
          <div className="form-group">
            <label className="form-label">Add from existing members</label>
            <div className="existing-members-grid">
              {existingPool.map((m) => {
                // Match pending by userId if available, otherwise by email
                const picked = pending.some((p) =>
                  m.userId
                    ? p.key === m.userId
                    : p.email &&
                      m.email &&
                      p.email.toLowerCase() === m.email.toLowerCase()
                );
                return (
                  <button
                    key={m.userId ?? m.id}
                    type="button"
                    className={`existing-member-chip ${picked ? 'picked' : ''}`}
                    onClick={() => {
                      if (picked) {
                        setPending((prev) =>
                          prev.filter((p) =>
                            m.userId
                              ? p.key !== m.userId
                              : !(
                                  p.email &&
                                  m.email &&
                                  p.email.toLowerCase() ===
                                    m.email.toLowerCase()
                                )
                          )
                        );
                      } else {
                        setPending((prev) => [
                          ...prev,
                          {
                            key: m.userId ?? m.id,
                            userId: m.userId,
                            name: m.name,
                            email: m.email,
                            avatar: m.avatar,
                            isRegistered: !!m.userId,
                            locked: true,
                          },
                        ]);
                      }
                    }}
                  >
                    <img
                      src={m.avatar}
                      alt={m.name}
                      className="avatar avatar-sm"
                    />
                    <div className="existing-member-info">
                      <span className="text-sm font-semibold">{m.name}</span>
                      <span className="text-xs text-muted">
                        {m.email || m.mobile}
                      </span>
                    </div>
                    <span className="chip-check">{picked ? '✓' : '+'}</span>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {existingPool.length > 0 && <div className="divider" />}

        {/* ── Search registered users ── */}
        <div
          className="form-group"
          style={{ position: 'relative' }}
          ref={suggestionsRef}
        >
          <label className="form-label">Search by name or email</label>
          <input
            className="form-control"
            placeholder="Type to search registered users…"
            value={searchQuery}
            onChange={(e) => handleSearchChange(e.target.value)}
            onFocus={() => suggestions.length > 0 && setShowSuggestions(true)}
            autoComplete="off"
          />
          {showSuggestions && suggestions.length > 0 && (
            <div className="member-suggestions">
              {suggestions.map((u) => (
                <button
                  key={u.id}
                  type="button"
                  className="member-suggestion-item"
                  onMouseDown={() => pickSuggestion(u)}
                >
                  <img
                    src={u.avatar}
                    alt={u.name}
                    className="avatar"
                    style={{ width: 28, height: 28, flexShrink: 0 }}
                  />
                  <div className="member-suggestion-info">
                    <span className="member-suggestion-name">{u.name}</span>
                    <span className="member-suggestion-sub">
                      {u.email || u.mobile}
                    </span>
                  </div>
                  <span className="member-suggestion-add">+ Add</span>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* ── Not found in SplitWise ── */}
        {noMatch && !showManual && (
          <div className="member-not-found">
            <span className="member-not-found-text">
              <span className="member-not-found-icon">🔍</span>"
              <strong>{searchQuery}</strong>" is not registered in SplitWise
            </span>
            <div className="member-not-found-actions">
              <button
                type="button"
                className="btn btn-outline btn-sm"
                onClick={() => {
                  setManualForm({ name: searchQuery, email: '', mobile:'', contactMethod:'email' });
                  setShowManual(true);
                  setSearchQuery('');
                  setSearchDone(false);
                }}
              >
                ✉️ Invite &amp; Add
              </button>
            </div>
          </div>
        )}

        {/* ── Manual entry form (unregistered) ── */}
        {showManual && (
          <div className="manual-member-form">
            <div className="manual-member-header">
              <span className="text-sm font-semibold">
                Add unregistered member
              </span>
              <button
                type="button"
                className="btn-icon"
                onClick={() => {
                  setShowManual(false);
                  setManualForm({
                    name: '',
                    email: '',
                    mobile: '',
                    contactMethod: 'email',
                  });
                  setManualError('');
                }}
              >
                ✕
              </button>
            </div>
            <div className="form-group" style={{ marginBottom: 8 }}>
              <input
                className="form-control"
                placeholder="Full name *"
                value={manualForm.name}
                onChange={(e) =>
                  setManualForm((f) => ({ ...f, name: e.target.value }))
                }
              />
            </div>
            <div style={{ display: 'flex', gap: 6, marginBottom: 8 }}>
              <button
                type="button"
                className={`auth-toggle-btn${
                  manualForm.contactMethod === 'email' ? ' active' : ''
                }`}
                style={{
                  flex: 1,
                  padding: '6px 10px',
                  fontSize: 12,
                  borderRadius: 6,
                  border: '1px solid #e2e8f0',
                }}
                onClick={() =>
                  setManualForm((f) => ({
                    ...f,
                    contactMethod: 'email',
                    mobile: '',
                  }))
                }
              >
                Email
              </button>
              <button
                type="button"
                className={`auth-toggle-btn${
                  manualForm.contactMethod === 'mobile' ? ' active' : ''
                }`}
                style={{
                  flex: 1,
                  padding: '6px 10px',
                  fontSize: 12,
                  borderRadius: 6,
                  border: '1px solid #e2e8f0',
                }}
                onClick={() =>
                  setManualForm((f) => ({
                    ...f,
                    contactMethod: 'mobile',
                    email: '',
                  }))
                }
              >
                Mobile
              </button>
            </div>
            {manualForm.contactMethod === 'email' ? (
              <div className="form-group" style={{ marginBottom: 8 }}>
                <input
                  className="form-control"
                  type="email"
                  placeholder="Email address *"
                  value={manualForm.email}
                  onChange={(e) =>
                    setManualForm((f) => ({ ...f, email: e.target.value }))
                  }
                />
              </div>
            ) : (
              <div className="form-group" style={{ marginBottom: 8 }}>
                <input
                  className="form-control"
                  type="tel"
                  placeholder="10-digit mobile number *"
                  value={manualForm.mobile}
                  onChange={(e) =>
                    setManualForm((f) => ({ ...f, mobile: e.target.value }))
                  }
                />
              </div>
            )}
            {manualError && (
              <p className="form-error" style={{ marginBottom: 6 }}>
                {manualError}
              </p>
            )}
            <button
              type="button"
              className="btn btn-primary btn-sm w-full"
              onClick={addManualMember}
            >
              Add to list
            </button>
          </div>
        )}

        {/* ── Pending basket ── */}
        {pending.length > 0 && (
          <div className="pending-members-section">
            <p className="form-label" style={{ marginBottom: 8 }}>
              To be added ({pending.length})
            </p>
            <div className="pending-members-list">
              {pending.map((p) => (
                <div
                  key={p.key}
                  className={`pending-member-chip ${
                    p.isRegistered ? 'registered' : 'unregistered'
                  }`}
                >
                  <img
                    src={p.avatar}
                    alt={p.name}
                    className="avatar"
                    style={{ width: 24, height: 24, flexShrink: 0 }}
                  />
                  <div className="pending-member-info">
                    <span className="pending-member-name">{p.name}</span>
                    {p.email && (
                      <span className="pending-member-email">{p.email}</span>
                    )}
                    {!p.email && p.mobile && (
                      <span className="pending-member-email">{p.mobile}</span>
                    )}
                    {!p.isRegistered && (
                      <span className="pending-member-badge">
                        Not in SplitWise · invite pending
                      </span>
                    )}
                  </div>
                  <button
                    type="button"
                    className="pending-member-remove"
                    onClick={() => removePending(p.key)}
                    title="Remove"
                  >
                    ✕
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {memberError && (
          <p className="form-error" style={{ marginTop: 8 }}>
            {memberError}
          </p>
        )}
      </Modal>
    </div>
  );
};

export default GroupDetail;
