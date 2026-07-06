import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useGroups } from '../../context/GroupContext';
import { useExpenses } from '../../context/ExpenseContext';
import { useAuth } from '../../context/AuthContext';
import { EXPENSE_CATEGORIES, ExpenseCategory } from '../../types';
import './Expenses.css';

const CATEGORY_ICONS: Record<ExpenseCategory, string> = {
  food: '🍔', transport: '🚗', accommodation: '🏨',
  entertainment: '🎬', utilities: '💡', other: '📦',
};

const Expenses = () => {
  const { groups } = useGroups();
  const { expenses, deleteExpense } = useExpenses();
  const { user } = useAuth();
  const navigate = useNavigate();

  // User can edit/delete only if they are a participant (in splits) or the payer
  const canModify = (e: { paidByName: string; splits: { memberName: string }[] }) => {
    if (!user) return false;
    const name = user.name.toLowerCase();
    return (
      e.paidByName.toLowerCase().includes(name) ||
      e.splits.some(s => s.memberName.toLowerCase().includes(name))
    );
  };
  const [filterGroup, setFilterGroup] = useState('');
  const [filterCategory, setFilterCategory] = useState('');
  const [search, setSearch] = useState('');

  const filtered = expenses.filter(e => {
    if (filterGroup && e.groupId !== filterGroup) return false;
    if (filterCategory && e.category !== filterCategory) return false;
    if (search && !e.title.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  const total = filtered.reduce((sum, e) => sum + e.amount, 0);

  return (
    <div className="page-content">
      <div className="page-header">
        <div>
          <h1 className="page-title">Expenses</h1>
          <p className="page-subtitle">{filtered.length} expense{filtered.length !== 1 ? 's' : ''} · ₹{total.toLocaleString()} total</p>
        </div>
        <button className="btn btn-primary" onClick={() => navigate('/expenses/new')}>+ Add Expense</button>
      </div>

      <div className="expense-filters card card-body mb-4">
        <input className="form-control" placeholder="🔍 Search expenses..." value={search}
          onChange={e => setSearch(e.target.value)} style={{ maxWidth: 260 }} />
        <select className="form-control" value={filterGroup} onChange={e => setFilterGroup(e.target.value)} style={{ maxWidth: 200 }}>
          <option value="">All Groups</option>
          {groups.map(g => <option key={g.id} value={g.id}>{g.name}</option>)}
        </select>
        <select className="form-control" value={filterCategory} onChange={e => setFilterCategory(e.target.value)} style={{ maxWidth: 180 }}>
          <option value="">All Categories</option>
          {EXPENSE_CATEGORIES.map(c => <option key={c} value={c}>{CATEGORY_ICONS[c]} {c}</option>)}
        </select>
      </div>

      {filtered.length === 0 ? (
        <div className="card">
          <div className="empty-state">
            <div className="empty-icon">💸</div>
            <h3>No expenses found</h3>
            <p>Try adjusting filters or add a new expense</p>
            <button className="btn btn-primary" onClick={() => navigate('/expenses/new')}>Add Expense</button>
          </div>
        </div>
      ) : (
        <div className="card">
          <div className="card-body" style={{ padding: 0 }}>
            <table className="expenses-table">
              <thead>
                <tr>
                  <th>Expense</th>
                  <th>Group</th>
                  <th>Paid By</th>
                  <th>Date</th>
                  <th>Split</th>
                  <th>Amount</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(e => {
                  const group = groups.find(g => g.id === e.groupId);
                  const allowed = canModify(e);
                  return (
                    <tr key={e.id}>
                      <td>
                        <div className="flex items-center gap-3">
                          <span className="expense-table-icon">{CATEGORY_ICONS[e.category]}</span>
                          <div>
                            <p className="font-semibold text-sm">{e.title}</p>
                            {e.notes && <p className="text-xs text-muted">{e.notes}</p>}
                          </div>
                        </div>
                      </td>
                      <td><span className="badge badge-primary">{group?.name ?? '—'}</span></td>
                      <td><span className="text-sm">{e.paidByName}</span></td>
                      <td><span className="text-sm text-muted">{e.date}</span></td>
                      <td>
                        <div className="split-chips">
                          {e.splits.map(s => (
                            <span key={s.memberId} className={`split-chip ${s.paid ? 'split-paid' : 'split-unpaid'}`}>
                              {s.memberName.split(' ')[0]}
                            </span>
                          ))}
                        </div>
                      </td>
                      <td><span className="font-bold">₹{e.amount.toLocaleString()}</span></td>
                      <td>
                        <div className="flex gap-2">
                          <button
                            className="btn btn-outline btn-sm"
                            onClick={() => navigate(`/expenses/edit/${e.id}`)}
                            disabled={!allowed}
                            title={!allowed ? 'You are not a participant in this expense' : ''}
                          >Edit</button>
                          <button
                            className="btn btn-danger btn-sm"
                            onClick={() => deleteExpense(e.id)}
                            disabled={!allowed}
                            title={!allowed ? 'You are not a participant in this expense' : ''}
                          >Del</button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};

export default Expenses;
