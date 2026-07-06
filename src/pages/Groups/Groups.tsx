import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useGroups } from '../../context/GroupContext';
import { useExpenses } from '../../context/ExpenseContext';
import { useAuth } from '../../context/AuthContext';
import Modal from '../../components/modal/Modal';
import { Group, Member, GROUP_CATEGORIES, GroupCategory } from '../../types';
import './Groups.css';

const CATEGORY_LABELS: Record<GroupCategory, string> = { trip: '✈️ Trip', home: '🏠 Home', food: '🍕 Food', other: '📁 Other' };
const CATEGORY_ICONS: Record<GroupCategory, string> = { trip: '✈️', home: '🏠', food: '🍕', other: '📁' };

type Step = 'details' | 'members';

const EMPTY_FORM = { name: '', description: '', category: GroupCategory.Trip as GroupCategory, simplifyDebts: true };

const Groups = () => {
  const { groups, addGroup, updateGroup, deleteGroup } = useGroups();
  const { expenses } = useExpenses();
  const { user } = useAuth();
  const navigate = useNavigate();

  const [modalOpen, setModalOpen] = useState(false);
  const [editingGroup, setEditingGroup] = useState<Group | null>(null);
  const [step, setStep] = useState<Step>('details');
  const [form, setForm] = useState<{ name: string; description: string; category: GroupCategory; simplifyDebts: boolean }>(EMPTY_FORM);
  const [error, setError] = useState('');
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const handleDeleteGroup = (groupId: string, groupName: string) => {
    const hasUnsettled = expenses
      .filter(e => e.groupId === groupId)
      .some(e => e.splits.some(s => !s.paid));
    if (hasUnsettled) {
      setDeleteError(`Cannot delete "${groupName}" — clear all payments first.`);
      return;
    }
    deleteGroup(groupId);
  };

  // members to add: mix of picked-existing + newly typed
  // id is optional — present for existing members (preserves identity), absent for new ones
  const [selectedMembers, setSelectedMembers] = useState<Omit<Member, 'groupId'>[]>([]);
  const [newMember, setNewMember] = useState({ name: '', email: '' });
  const [memberError, setMemberError] = useState('');

  // flat list of all unique existing members across all groups (for quick-add), with their canonical id
  const allExistingMembers: Omit<Member, 'groupId'>[] = [];
  const seenEmails = new Set<string>();
  groups.forEach(g => g.members.forEach(m => {
    if (!seenEmails.has(m.email)) {
      seenEmails.add(m.email);
      allExistingMembers.push({ id: m.id, name: m.name, email: m.email, avatar: m.avatar });
    }
  }));

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
    setForm({ name: g.name, description: g.description, category: g.category, simplifyDebts: g.simplifyDebts });
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
    setMemberError('');
  };

  const handleNextStep = () => {
    if (!form.name.trim()) { setError('Group name is required'); return; }
    setError('');
    setStep('members');
  };

  const handleSaveEdit = () => {
    if (!form.name.trim()) { setError('Group name is required'); return; }
    if (editingGroup) {
      updateGroup(editingGroup.id, { name: form.name, description: form.description, category: form.category, simplifyDebts: form.simplifyDebts });
    }
    resetModal();
  };

  const toggleExistingMember = (m: Omit<Member, 'groupId'>) => {
    const already = selectedMembers.some(s => s.email === m.email);
    if (already) setSelectedMembers(prev => prev.filter(s => s.email !== m.email));
    else setSelectedMembers(prev => [...prev, m]);
  };

  const handleAddNewMember = () => {
    if (!newMember.name.trim()) { setMemberError('Name is required'); return; }
    if (!newMember.email.trim()) { setMemberError('Email is required'); return; }
    if (selectedMembers.some(m => m.email === newMember.email)) { setMemberError('Already added'); return; }
    // Check if this email already exists in any group — reuse their id if so
    const existing = allExistingMembers.find(m => m.email.toLowerCase() === newMember.email.toLowerCase());
    setSelectedMembers(prev => [...prev, {
      id: existing?.id ?? `new_${Date.now()}`,
      name: newMember.name,
      email: newMember.email,
      avatar: existing?.avatar ?? `https://api.dicebear.com/7.x/initials/svg?seed=${newMember.name}`,
    }]);
    setNewMember({ name: '', email: '' });
    setMemberError('');
  };

  const handleCreate = () => {
    addGroup({
      ...form,
      members: selectedMembers.map(m => ({
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
          <p className="page-subtitle">{groups.length} group{groups.length !== 1 ? 's' : ''}</p>
        </div>
        <button className="btn btn-primary" onClick={openCreate}>+ New Group</button>
      </div>

      {deleteError && (
        <div className="remove-error-banner mb-4" style={{ marginBottom: 16 }}>
          ⚠️ {deleteError}
          <button className="remove-error-close" onClick={() => setDeleteError(null)}>✕</button>
        </div>
      )}

      {groups.length === 0 ? (
        <div className="card">
          <div className="empty-state">
            <div className="empty-icon">👥</div>
            <h3>No groups yet</h3>
            <p>Create a group to start splitting expenses with friends</p>
            <button className="btn btn-primary" onClick={openCreate}>Create your first group</button>
          </div>
        </div>
      ) : (
        <div className="grid-3">
          {groups.map(g => {
            const groupExpenses = expenses.filter(e => e.groupId === g.id);
            const total = groupExpenses.reduce((sum, e) => sum + e.amount, 0);
            return (
              <div key={g.id} className="group-card card" onClick={() => navigate(`/groups/${g.id}`)}>
                <div className="group-card-header">
                  <div className="group-card-icon">{CATEGORY_ICONS[g.category]}</div>
                  <div className="group-card-actions">
                    {g.simplifyDebts && <span className="simplify-badge" title="Debt simplification enabled">⚡</span>}
                    <button className="btn-icon edit-btn" onClick={e => openEdit(g, e)} title="Edit group">✏️</button>
                    <button className="btn-icon delete-btn" onClick={e => { e.stopPropagation(); handleDeleteGroup(g.id, g.name); }} title="Delete group">🗑️</button>
                  </div>
                </div>
                <div className="group-card-body">
                  <h3 className="group-card-name">{g.name}</h3>
                  {g.description && <p className="group-card-desc text-muted text-sm">{g.description}</p>}
                </div>
                <div className="group-card-footer">
                  <div className="group-members">
                    {g.members.slice(0, 4).map(m => (
                      <img key={m.id} src={m.avatar} alt={m.name} className="avatar avatar-sm member-avatar" title={m.name} />
                    ))}
                    {g.members.length > 4 && <span className="member-more">+{g.members.length - 4}</span>}
                    {g.members.length === 0 && <span className="text-xs text-muted">No members</span>}
                  </div>
                  <div className="group-card-total">
                    <span className="text-xs text-muted">Total</span>
                    <span className="font-semibold text-sm">₹{total.toLocaleString()}</span>
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
        title={editingGroup ? `Edit "${editingGroup.name}"` : step === 'details' ? 'Create New Group' : `Add Members to "${form.name}"`}
        size="md"
        footer={
          editingGroup ? (
            <>
              <button className="btn btn-outline" onClick={resetModal}>Cancel</button>
              <button className="btn btn-primary" onClick={handleSaveEdit}>Save Changes</button>
            </>
          ) : step === 'details' ? (
            <>
              <button className="btn btn-outline" onClick={resetModal}>Cancel</button>
              <button className="btn btn-primary" onClick={handleNextStep}>Next: Add Members →</button>
            </>
          ) : (
            <>
              <button className="btn btn-outline" onClick={() => setStep('details')}>← Back</button>
              <button className="btn btn-primary" onClick={handleCreate}>
                Create Group {selectedMembers.length > 0 ? `(${selectedMembers.length} member${selectedMembers.length > 1 ? 's' : ''})` : ''}
              </button>
            </>
          )
        }
      >
        {step === 'details' && (
          <>
            <div className="form-group">
              <label className="form-label">Group Name *</label>
              <input className="form-control" placeholder="e.g. Goa Trip 2025" value={form.name}
                onChange={e => setForm(f => ({ ...f, name: e.target.value }))} />
              {error && <p className="form-error">{error}</p>}
            </div>
            <div className="form-group">
              <label className="form-label">Description</label>
              <textarea className="form-control" placeholder="Optional description..." rows={2}
                value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} />
            </div>
            <div className="form-group">
              <label className="form-label">Category</label>
              <select className="form-control" value={form.category}
                onChange={e => setForm(f => ({ ...f, category: e.target.value as GroupCategory }))}>
                {GROUP_CATEGORIES.map(c => <option key={c} value={c}>{CATEGORY_LABELS[c]}</option>)}
              </select>
            </div>
            <div className="simplify-toggle-row">
              <div>
                <p className="form-label" style={{ marginBottom: 2 }}>Simplify Debts</p>
                <p className="text-xs text-muted">Minimise the number of payments using debt simplification</p>
              </div>
              <label className="toggle-switch">
                <input type="checkbox" checked={form.simplifyDebts}
                  onChange={e => setForm(f => ({ ...f, simplifyDebts: e.target.checked }))} />
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
                  {allExistingMembers.map(m => {
                    const picked = selectedMembers.some(s => s.email === m.email);
                    return (
                      <button
                        key={m.email}
                        type="button"
                        className={`existing-member-chip ${picked ? 'picked' : ''}`}
                        onClick={() => toggleExistingMember(m)}
                      >
                        <img src={m.avatar} alt={m.name} className="avatar avatar-sm" />
                        <div className="existing-member-info">
                          <span className="text-sm font-semibold">{m.name}</span>
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
              <label className="form-label">Add new member</label>
              <div className="new-member-row">
                <input className="form-control" placeholder="Full name" value={newMember.name}
                  onChange={e => setNewMember(f => ({ ...f, name: e.target.value }))}
                  onKeyDown={e => e.key === 'Enter' && handleAddNewMember()} />
                <input className="form-control" placeholder="Email" value={newMember.email}
                  onChange={e => setNewMember(f => ({ ...f, email: e.target.value }))}
                  onKeyDown={e => e.key === 'Enter' && handleAddNewMember()} />
                <button className="btn btn-primary btn-sm" onClick={handleAddNewMember} style={{ whiteSpace: 'nowrap' }}>+ Add</button>
              </div>
              {memberError && <p className="form-error">{memberError}</p>}
            </div>

            {/* Selected members preview */}
            {selectedMembers.length > 0 && (
              <div className="selected-members-list">
                <p className="form-label">Selected ({selectedMembers.length})</p>
                {selectedMembers.map((m, i) => (
                  <div key={m.email} className="selected-member-row">
                    <img src={m.avatar} alt={m.name} className="avatar avatar-sm" />
                    <div className="flex-1">
                      <p className="text-sm font-semibold">{m.name}</p>
                      <p className="text-xs text-muted">{m.email}</p>
                    </div>
                    <button className="btn-icon" onClick={() => setSelectedMembers(prev => prev.filter((_, idx) => idx !== i))}>✕</button>
                  </div>
                ))}
              </div>
            )}

            {selectedMembers.length === 0 && (
              <p className="text-sm text-muted" style={{ textAlign: 'center', padding: '12px 0' }}>
                No members added yet — you can always add them later from the group page.
              </p>
            )}
          </>
        )}
      </Modal>
    </div>
  );
};

export default Groups;
