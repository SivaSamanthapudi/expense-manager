import { useGroups } from '../../context/GroupContext';
import { useExpenses } from '../../context/ExpenseContext';
import { useAuth } from '../../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import { ExpenseCategory, GroupCategory } from '../../types';
import { computeMemberBalances, simplifyDebts } from '../../utils/debtUtils';
import './Dashboard.css';

const EXPENSE_CATEGORY_ICONS: Record<ExpenseCategory, string> = {
  food: '🍔', transport: '🚗', accommodation: '🏨',
  entertainment: '🎬', utilities: '💡', other: '📦',
};

const GROUP_CATEGORY_ICONS: Record<GroupCategory, string> = {
  trip: '✈️', home: '🏠', food: '🍕', other: '📁',
};

const getGreeting = () => {
  const hour = new Date().getHours();
  if (hour < 12) return 'Good morning';
  if (hour < 17) return 'Good afternoon';
  return 'Good evening';
};

const Dashboard = () => {
  const { groups } = useGroups();
  const { expenses } = useExpenses();
  const { user, status } = useAuth();
  const navigate = useNavigate();

  const userName = user?.name?.toLowerCase();

  // Groups the logged-in user belongs to (name-matched against members list)
  const myGroups = groups.filter(g =>
    g.members.some(m => m.name.toLowerCase() === userName)
  );

  // The user may have a different member ID in each group — collect them all
  const selfMemberIds = new Set(
    myGroups
      .flatMap(g => g.members)
      .filter(m => m.name.toLowerCase() === userName)
      .map(m => m.id)
  );

  // Expenses where the user is either the payer or a split participant
  const myExpenses = expenses.filter(e =>
    myGroups.some(g => g.id === e.groupId) &&
    (
      e.paidByName.toLowerCase() === userName ||
      e.splits.some(s => s.memberName.toLowerCase() === userName)
    )
  );

  const totalExpenses = myExpenses.reduce((sum, e) => sum + e.amount, 0);
  const recentExpenses = [...myExpenses].sort((a, b) => b.date.localeCompare(a.date)).slice(0, 5);

  // Compute per-group debt transactions, respecting each group's simplifyDebts flag
  let youOwe = 0;
  let owedToYou = 0;
  myGroups.forEach(g => {
    const groupExpenses = expenses.filter(e => e.groupId === g.id);
    const balances = computeMemberBalances(g, expenses);
    const transactions = g.simplifyDebts
      ? simplifyDebts(balances)
      : groupExpenses.flatMap(expense =>
          expense.splits
            .filter(s => !s.paid && s.memberId !== expense.paidBy)
            .map(s => ({ fromId: s.memberId, toId: expense.paidBy, amount: s.amount }))
        );
    youOwe    += transactions.filter(t => selfMemberIds.has(t.fromId)).reduce((s, t) => s + t.amount, 0);
    owedToYou += transactions.filter(t => selfMemberIds.has(t.toId)).reduce((s, t) => s + t.amount, 0);
  });

  return (
    <div className="page-content">
      <div className="page-header">
        <div>
          <h1 className="page-title">{getGreeting()}, {user?.name?.split(' ')[0]} 👋</h1>
          <p className="page-subtitle">Here's what's happening with your expenses</p>
        </div>
      </div>

      <div className="grid-4 mb-4">
        <div className="stat-card">
          <div className="stat-icon" style={{ background: '#e0e7ff' }}>📊</div>
          <div className="stat-body">
            <p className="stat-label">Total Expenses</p>
            <p className="stat-value">₹{totalExpenses.toLocaleString()}</p>
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-icon" style={{ background: '#d1fae5' }}>👥</div>
          <div className="stat-body">
            <p className="stat-label">Groups</p>
            <p className="stat-value">{myGroups.length}</p>
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-icon" style={{ background: '#fef3c7' }}>🧾</div>
          <div className="stat-body">
            <p className="stat-label">You Owe</p>
            <p className="stat-value" style={{ color: '#ef4444' }}>₹{youOwe.toLocaleString()}</p>
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-icon" style={{ background: '#dcfce7' }}>💵</div>
          <div className="stat-body">
            <p className="stat-label">Owed to You</p>
            <p className="stat-value" style={{ color: '#10b981' }}>₹{owedToYou.toLocaleString()}</p>
          </div>
        </div>
      </div>

      <div className="grid-2">
        <div className="card">
          <div className="card-body">
            <div className="flex justify-between items-center mb-4">
              <h2 className="font-semibold">Recent Expenses</h2>
              <button className="btn btn-ghost btn-sm" onClick={() => navigate('/expenses')}>View all</button>
            </div>
            {recentExpenses.length === 0 ? (
              <p className="text-muted text-sm">No expenses yet</p>
            ) : (
              <div className="recent-list">
                {recentExpenses.map(e => (
                  <div key={e.id} className="recent-item">
                    <div className="recent-icon">{EXPENSE_CATEGORY_ICONS[e.category]}</div>
                    <div className="recent-info">
                      <p className="recent-title">{e.title}</p>
                      <p className="text-xs text-muted">{e.paidByName} · {e.date}</p>
                    </div>
                    <span className="recent-amount">₹{e.amount.toLocaleString()}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="card">
          <div className="card-body">
            <div className="flex justify-between items-center mb-4">
              <h2 className="font-semibold">Your Groups</h2>
              <button className="btn btn-ghost btn-sm" onClick={() => navigate('/groups')}>View all</button>
            </div>
            {myGroups.length === 0 ? (
              <p className="text-muted text-sm">No groups yet</p>
            ) : (
              <div className="group-list">
                {myGroups.map(g => {
                  const groupTotal = myExpenses.filter(e => e.groupId === g.id).reduce((s, e) => s + e.amount, 0);
                  return (
                    <div key={g.id} className="group-list-item" onClick={() => navigate(`/groups/${g.id}`)}>
                      <div className="group-list-icon">{GROUP_CATEGORY_ICONS[g.category]}</div>
                      <div className="group-list-info">
                        <p className="font-semibold text-sm">{g.name}</p>
                        <p className="text-xs text-muted">{g.members.length} members</p>
                      </div>
                      <span className="text-sm font-semibold">₹{groupTotal.toLocaleString()}</span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
