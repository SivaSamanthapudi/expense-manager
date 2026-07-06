import { useGroups } from '../../context/GroupContext';
import { useExpenses } from '../../context/ExpenseContext';
import { useNavigate } from 'react-router-dom';
import './People.css';

const People = () => {
  const { groups } = useGroups();
  const { expenses } = useExpenses();
  const navigate = useNavigate();

  // Build a deduplicated global people list keyed by email
  const peopleMap = new Map<
    string,
    {
      name: string;
      email: string;
      avatar: string;
      groups: { id: string; name: string }[];
      totalPaid: number;
      totalShare: number;
    }
  >();

  groups.forEach((g) => {
    g.members.forEach((m) => {
      const key = m.email.toLowerCase();
      if (!peopleMap.has(key)) {
        peopleMap.set(key, {
          name: m.name,
          email: m.email,
          avatar: m.avatar,
          groups: [],
          totalPaid: 0,
          totalShare: 0,
        });
      }
      const entry = peopleMap.get(key)!;
      if (!entry.groups.find((eg) => eg.id === g.id)) {
        entry.groups.push({ id: g.id, name: g.name });
      }
      // accumulate financials
      expenses
        .filter((e) => e.groupId === g.id)
        .forEach((e) => {
          if (e.paidBy === m.id) entry.totalPaid += e.amount;
          const split = e.splits.find((s) => s.memberId === m.id);
          if (split) entry.totalShare += split.amount;
        });
    });
  });

  const people = Array.from(peopleMap.values()).sort((a, b) =>
    a.name.localeCompare(b.name)
  );

  return (
    <div className="page-content">
      <div className="page-header">
        <div>
          <h1 className="page-title">People</h1>
          <p className="page-subtitle">
            {people.length} people across all groups
          </p>
        </div>
      </div>

      {people.length === 0 ? (
        <div className="card">
          <div className="empty-state">
            <div className="empty-icon">👤</div>
            <h3>No people yet</h3>
            <p>Add members to your groups to see them here</p>
            <button
              className="btn btn-primary"
              onClick={() => navigate('/groups')}
            >
              Go to Groups
            </button>
          </div>
        </div>
      ) : (
        <div className="people-grid">
          {people.map((p) => {
            const net = p.totalPaid - p.totalShare;
            return (
              <div key={p.email} className="person-card card card-body">
                <div className="person-header">
                  <img
                    src={p.avatar}
                    alt={p.name}
                    className="avatar avatar-lg"
                  />
                  <div className="person-info">
                    <p className="font-semibold">{p.name}</p>
                    <p className="text-xs text-muted">{p.email}</p>
                  </div>
                </div>

                <div className="person-groups">
                  {p.groups.map((g) => (
                    <span
                      key={g.id}
                      className="person-group-chip"
                      onClick={() => navigate(`/groups/${g.id}`)}
                    >
                      {g.name}
                    </span>
                  ))}
                </div>

                <div className="divider" />

                <div className="person-stats">
                  <div className="person-stat">
                    <p className="text-xs text-muted">Total Paid</p>
                    <p
                      className="font-semibold text-sm"
                      style={{ color: '#10b981' }}
                    >
                      ₹{p.totalPaid.toLocaleString()}
                    </p>
                  </div>
                  <div className="person-stat">
                    <p className="text-xs text-muted">Total Share</p>
                    <p
                      className="font-semibold text-sm"
                      style={{ color: '#ef4444' }}
                    >
                      ₹{p.totalShare.toLocaleString()}
                    </p>
                  </div>
                  <div className="person-stat">
                    <p className="text-xs text-muted">Net</p>
                    <p
                      className="font-semibold text-sm"
                      style={{ color: net >= 0 ? '#10b981' : '#ef4444' }}
                    >
                      {net >= 0 ? '+' : ''}₹{net.toLocaleString()}
                    </p>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default People;
