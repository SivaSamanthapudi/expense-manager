import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useGroups } from '../../context/GroupContext';
import { useExpenses } from '../../context/ExpenseContext';
import { useAuth } from '../../context/AuthContext';
import Modal from '../../components/modal/Modal';
import { Group, Member, GROUP_CATEGORIES, GroupCategory } from '../../types';
import { computeMemberBalances, simplifyDebts } from '../../utils/debtUtils';
import './Groups.css';

const CATEGORY_LABELS: Record<GroupCategory, string> = {
  trip: '✈️ Trip',
  home: '🏠 Home',
  food: '🍕 Food',
  other: '📁 Other',
};
const CATEGORY_ICONS: Record<GroupCategory, string> = {
  trip: '✈️',
  home: '🏠',
  food: '🍕',
  other: '📁',
};

type Step = 'details' | 'members';

const EMPTY_FORM = {
  name: '',
  description: '',
  category: GroupCategory.Trip as GroupCategory,
  simplifyDebts: true,
};

const Groups = () => {
  const { groups, addGroup, updateGroup, deleteGroup, refetch } = useGroups();
  const { expenses } = useExpenses();
  const { user } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    void refetch();
  }, [refetch]);

  const [modalOpen, setModalOpen] = useState(false);
  const [editingGroup, setEditingGroup] = useState<Group | null>(null);
  const [step, setStep] = useState<Step>('details');
  const [form, setForm] = useState<{
    name: string;
    description: string;
    category: GroupCategory;
    simplifyDebts: boolean;
  }>(EMPTY_FORM);
  const [error, setError] = useState('');
  const [saveError, setSaveError] = useState('');
  const [saving, setSaving] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const handleDeleteGroup = async (groupId: string, groupName: string) => {
    const hasUnsettled = expenses
      .filter((e) => e.groupId === groupId)
      .some((e) => e.splits.some((s) => !s.paid));
    if (hasUnsettled) {
      setDeleteError(
        `Cannot delete "${groupName}" — clear all payments first.`
      );
      return;
    }
    try {
      await deleteGroup(groupId);
    } catch (err) {
      setDeleteError(
        err instanceof Error ? err.message : `Failed to delete "${groupName}"`
      );
    }
  };

  // members to add: mix of picked-existing + newly typed
  // id is optional — present for existing members (preserves identity), absent for new ones
  const [selectedMembers, setSelectedMembers] = useState<
    Omit<Member, 'groupId'>[]
  >([]);
  const [newMember, setNewMember] = useState({ name: '', email: '' });
  const [memberError, setMemberError] = useState('');

  // flat list of all unique existing members across all groups (for quick-add)
  // Dedup by userId for registered users, by email for guests
  const allExistingMembers: Omit<Member, 'groupId'>[] = [];
  const seenUserIds = new Set<string>();
  const seenEmails = new Set<string>();
  groups.forEach((g) =>
    g.members.forEach((m) => {
      const key = m.userId ?? m.email;
      if (!key || seenUserIds.has(key) || seenEmails.has(m.email)) return;
      if (m.userId) seenUserIds.add(m.userId);
      else seenEmails.add(m.email);
      allExistingMembers.push({
        id: m.id,
        name: m.name,
        email: m.email,
        avatar: m.avatar,
        userId: m.userId,
      });
    })
  );

  const openCreate = () => {
    setEditingGroup(null);
    setForm(EMPTY_FORM);
    setSelectedMembers([]);
    setStep('details');
    setError('');
    setMemberError('');
    setModalOpen(true);
  };

  const openEdit = (g: Group, e: React.MouseEvent) => {
    e.stopPropagation();
    setEditingGroup(g);
    setForm({
      name: g.name,
      description: g.description,
      category: g.category,
      simplifyDebts: g.simplifyDebts,
    });
    setStep('details');
    setError('');
    setModalOpen(true);
  };

  const resetModal = () => {
    setModalOpen(false);
    setEditingGroup(null);
    setStep('details');
    setForm(EMPTY_FORM);
    setSelectedMembers([]);
    setNewMember({ name: '', email: '' });
    setError('');
    setSaveError('');
    setMemberError('');
  };

  const handleNextStep = () => {
    if (!form.name.trim()) {
      setError('Group name is required');
      return;
    }
    setError('');
    setStep('members');
  };

  const handleSaveEdit = async () => {
    if (!form.name.trim()) {
      setError('Group name is required');
      return;
    }
    if (!editingGroup) return;
    setSaving(true);
    setSaveError('');
    try {
      await updateGroup(editingGroup.id, {
        name: form.name,
        description: form.description,
        category: form.category,
        simplifyDebts: form.simplifyDebts,
      });
      resetModal();
    } catch (err) {
      setSaveError(
        err instanceof Error ? err.message : 'Failed to save changes'
      );
    } finally {
      setSaving(false);
    }
  };

  const toggleExistingMember = (m: Omit<Member, 'groupId'>) => {
    const matches = (s: Omit<Member, 'groupId'>) =>
      m.userId ? s.userId === m.userId : s.email === m.email;
    const already = selectedMembers.some(matches);
    if (already) setSelectedMembers((prev) => prev.filter((s) => !matches(s)));
    else setSelectedMembers((prev) => [...prev, m]);
  };

  const handleAddNewMember = () => {
    const name = newMember.name.trim();
    const email = newMember.email.trim().toLowerCase();
    if (!name) {
      setMemberError('Name is required');
      return;
    }
    // Duplicate check: by email if provided, otherwise by name (best-effort for no-email guests)
    if (email && selectedMembers.some((m) => m.email.toLowerCase() === email)) {
      setMemberError('A member with this email is already in the list');
      return;
    }
    if (
      !email &&
      selectedMembers.some(
        (m) =>
          !m.userId && !m.email && m.name.toLowerCase() === name.toLowerCase()
      )
    ) {
      setMemberError('A guest with this name is already in the list');
      return;
    }
    setSelectedMembers((prev) => [
      ...prev,
      {
        id: `new_${Date.now()}`,
        name,
        email,
        avatar: `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(
          name
        )}`,
        userId: null,
      },
    ]);
    setNewMember({ name: '', email: '' });
    setMemberError('');
  };

  const handleCreate = () => {
    addGroup({
      ...form,
      members: selectedMembers.map((m) => ({
        ...m,
        groupId: '',
      })),
      createdBy: user?.id ?? '1',
    });
    resetModal();
  };

  return (
    <div className="page-content">
      <div className="page-header">
        <div>
          <h1 className="page-title">Groups</h1>
          <p className="page-subtitle">
            {groups.length} group{groups.length !== 1 ? 's' : ''}
          </p>
        </div>
        <button className="btn btn-primary" onClick={openCreate}>
          + New Group
        </button>
      </div>

      {deleteError && (
        <div className="remove-error-banner mb-4" style={{ marginBottom: 16 }}>
          ⚠️ {deleteError}
          <button
            className="remove-error-close"
            onClick={() => setDeleteError(null)}
          >
            ✕
          </button>
        </div>
      )}

      {groups.length === 0 ? (
        <div className="card">
          <div className="empty-state">
            <div className="empty-icon">👥</div>
            <h3>No groups yet</h3>
            <p>Create a group to start splitting expenses with friends</p>
            <button className="btn btn-primary" onClick={openCreate}>
              Create your first group
            </button>
          </div>
        </div>
      ) : (
        <div className="grid-3">
          {groups.map((g) => {
            const groupExpenses = expenses.filter((e) => e.groupId === g.id);
            const total = groupExpenses.reduce((sum, e) => sum + e.amount, 0);

            // Balance for the logged-in user in this group — match by userId only
            const selfMember = g.members.find(
              (m) => !!user?.id && !!m.userId && m.userId === user.id
            );
            const balances = computeMemberBalances(g, expenses);
            const transactions = g.simplifyDebts
              ? simplifyDebts(balances)
              : groupExpenses.flatMap((expense) =>
                  expense.splits
                    .filter((s) => !s.paid && s.memberId !== expense.paidBy)
                    .map((s) => ({
                      fromId: s.memberId,
                      fromName: s.memberName,
                      toId: expense.paidBy,
                      toName: expense.paidByName,
                      amount: s.amount - (s.paidAmount ?? 0),
                    }))
                    .filter((t) => t.amount > 0.01)
                );
            const youOwe = selfMember
              ? transactions
                  .filter((t) => t.fromId === selfMember.id)
                  .reduce((s, t) => s + t.amount, 0)
              : 0;
            const owedToYou = selfMember
              ? transactions
                  .filter((t) => t.toId === selfMember.id)
                  .reduce((s, t) => s + t.amount, 0)
              : 0;
            const isSettled = selfMember && youOwe === 0 && owedToYou === 0;

            return (
              <div
                key={g.id}
                className="group-card card"
                onClick={() => navigate(`/groups/${g.id}`)}
              >
                <div className="group-card-header">
                  <div className="group-card-icon">
                    {CATEGORY_ICONS[g.category]}
                  </div>
                  <div className="group-card-actions">
                    {g.simplifyDebts && (
                      <span
                        className="simplify-badge"
                        title="Debt simplification enabled"
                      >
                        ⚡
                      </span>
                    )}
                    <button
                      className="btn-icon edit-btn"
                      onClick={(e) => openEdit(g, e)}
                      title="Edit group"
                    >
                      ✏️
                    </button>
                    <button
                      className="btn-icon delete-btn"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDeleteGroup(g.id, g.name);
                      }}
                      title="Delete group"
                    >
                      🗑️
                    </button>
                  </div>
                </div>
                <div className="group-card-body">
                  <h3 className="group-card-name">{g.name}</h3>
                  {g.description && (
                    <p className="group-card-desc text-muted text-sm">
                      {g.description}
                    </p>
                  )}
                </div>

                {/* Balance summary */}
                {selfMember && (
                  <div className="group-card-balances">
                    {isSettled ? (
                      <div className="group-balance-settled">
                        ✓ All settled up
                      </div>
                    ) : (
                      <>
                        {owedToYou > 0 && (
                          <div className="group-balance-pill receive">
                            <span className="group-balance-label">
                              Owed to you
                            </span>
                            <span className="group-balance-amount">
                              ₹{owedToYou.toLocaleString()}
                            </span>
                          </div>
                        )}
                        {youOwe > 0 && (
                          <div className="group-balance-pill owe">
                            <span className="group-balance-label">You owe</span>
                            <span className="group-balance-amount">
                              ₹{youOwe.toLocaleString()}
                            </span>
                          </div>
                        )}
                      </>
                    )}
                  </div>
                )}

                <div className="group-card-footer">
                  <div className="group-members">
                    {g.members.slice(0, 4).map((m) => (
                      <img
                        key={m.id}
                        src={m.avatar}
                        alt={m.name}
                        className="avatar avatar-sm member-avatar"
                        title={m.name}
                      />
                    ))}
                    {g.members.length > 4 && (
                      <span className="member-more">
                        +{g.members.length - 4}
                      </span>
                    )}
                    {g.members.length === 0 && (
                      <span className="text-xs text-muted">No members</span>
                    )}
                  </div>
                  <div className="group-card-total">
                    <span className="text-xs text-muted">Total</span>
                    <span className="font-semibold text-sm">
                      ₹{total.toLocaleString()}
                    </span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <Modal
        isOpen={modalOpen}
        onClose={resetModal}
        title={
          editingGroup
            ? `Edit "${editingGroup.name}"`
            : step === 'details'
            ? 'Create New Group'
            : `Add Members to "${form.name}"`
        }
        size="md"
        footer={
          editingGroup ? (
            <>
              <button
                className="btn btn-outline"
                onClick={resetModal}
                disabled={saving}
              >
                Cancel
              </button>
              <button
                className="btn btn-primary"
                onClick={handleSaveEdit}
                disabled={saving}
              >
                {saving ? 'Saving…' : 'Save Changes'}
              </button>
            </>
          ) : step === 'details' ? (
            <>
              <button className="btn btn-outline" onClick={resetModal}>
                Cancel
              </button>
              <button className="btn btn-primary" onClick={handleNextStep}>
                Next: Add Members →
              </button>
            </>
          ) : (
            <>
              <button
                className="btn btn-outline"
                onClick={() => setStep('details')}
              >
                ← Back
              </button>
              <button className="btn btn-primary" onClick={handleCreate}>
                Create Group{' '}
                {selectedMembers.length > 0
                  ? `(${selectedMembers.length} member${
                      selectedMembers.length > 1 ? 's' : ''
                    })`
                  : ''}
              </button>
            </>
          )
        }
      >
        {step === 'details' && (
          <>
            {saveError && (
              <p className="form-error" style={{ marginBottom: 12 }}>
                {saveError}
              </p>
            )}
            <div className="form-group">
              <label className="form-label">Group Name *</label>
              <input
                className="form-control"
                placeholder="e.g. Goa Trip 2025"
                value={form.name}
                onChange={(e) =>
                  setForm((f) => ({ ...f, name: e.target.value }))
                }
              />
              {error && <p className="form-error">{error}</p>}
            </div>
            <div className="form-group">
              <label className="form-label">Description</label>
              <textarea
                className="form-control"
                placeholder="Optional description..."
                rows={2}
                value={form.description}
                onChange={(e) =>
                  setForm((f) => ({ ...f, description: e.target.value }))
                }
              />
            </div>
            <div className="form-group">
              <label className="form-label">Category</label>
              <select
                className="form-control"
                value={form.category}
                onChange={(e) =>
                  setForm((f) => ({
                    ...f,
                    category: e.target.value as GroupCategory,
                  }))
                }
              >
                {GROUP_CATEGORIES.map((c) => (
                  <option key={c} value={c}>
                    {CATEGORY_LABELS[c]}
                  </option>
                ))}
              </select>
            </div>
            <div className="simplify-toggle-row">
              <div>
                <p className="form-label" style={{ marginBottom: 2 }}>
                  Simplify Debts
                </p>
                <p className="text-xs text-muted">
                  Minimise the number of payments using debt simplification
                </p>
              </div>
              <label className="toggle-switch">
                <input
                  type="checkbox"
                  checked={form.simplifyDebts}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, simplifyDebts: e.target.checked }))
                  }
                />
                <span className="toggle-track" />
              </label>
            </div>
          </>
        )}

        {step === 'members' && !editingGroup && (
          <>
            {/* Existing members quick-pick */}
            {allExistingMembers.length > 0 && (
              <div className="form-group">
                <label className="form-label">Add from existing members</label>
                <div className="existing-members-grid">
                  {allExistingMembers.map((m) => {
                    const picked = selectedMembers.some((s) =>
                      m.userId
                        ? s.userId === m.userId
                        : m.email && s.email === m.email
                    );
                    return (
                      <button
                        key={m.userId ?? m.id}
                        type="button"
                        className={`existing-member-chip ${
                          picked ? 'picked' : ''
                        }`}
                        onClick={() => toggleExistingMember(m)}
                      >
                        <img
                          src={m.avatar}
                          alt={m.name}
                          className="avatar avatar-sm"
                        />
                        <div className="existing-member-info">
                          <span className="text-sm font-semibold">
                            {m.name}
                          </span>
                          <span className="text-xs text-muted">{m.email}</span>
                        </div>
                        <span className="chip-check">{picked ? '✓' : '+'}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            <div className="divider" />

            {/* Add a brand new member */}
            <div className="form-group">
              <label className="form-label">Add unregistered guest</label>
              <div className="new-member-row">
                <input
                  className="form-control"
                  placeholder="Full name *"
                  value={newMember.name}
                  onChange={(e) =>
                    setNewMember((f) => ({ ...f, name: e.target.value }))
                  }
                  onKeyDown={(e) => e.key === 'Enter' && handleAddNewMember()}
                />
                <input
                  className="form-control"
                  placeholder="Email (optional)"
                  value={newMember.email}
                  onChange={(e) =>
                    setNewMember((f) => ({ ...f, email: e.target.value }))
                  }
                  onKeyDown={(e) => e.key === 'Enter' && handleAddNewMember()}
                />
                <button
                  className="btn btn-primary btn-sm"
                  onClick={handleAddNewMember}
                  style={{ whiteSpace: 'nowrap' }}
                >
                  + Add
                </button>
              </div>
              {memberError && <p className="form-error">{memberError}</p>}
            </div>

            {/* Selected members preview */}
            {selectedMembers.length > 0 && (
              <div className="selected-members-list">
                <p className="form-label">
                  Selected ({selectedMembers.length})
                </p>
                {selectedMembers.map((m, i) => (
                  <div key={m.userId ?? m.id} className="selected-member-row">
                    <img
                      src={m.avatar}
                      alt={m.name}
                      className="avatar avatar-sm"
                    />
                    <div className="flex-1">
                      <p className="text-sm font-semibold">{m.name}</p>
                      <p className="text-xs text-muted">{m.email}</p>
                    </div>
                    <button
                      className="btn-icon"
                      onClick={() =>
                        setSelectedMembers((prev) =>
                          prev.filter((_, idx) => idx !== i)
                        )
                      }
                    >
                      ✕
                    </button>
                  </div>
                ))}
              </div>
            )}

            {selectedMembers.length === 0 && (
              <p
                className="text-sm text-muted"
                style={{ textAlign: 'center', padding: '12px 0' }}
              >
                No members added yet — you can always add them later from the
                group page.
              </p>
            )}
          </>
        )}
      </Modal>
    </div>
  );
};

export default Groups;
