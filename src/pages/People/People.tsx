import { useEffect } from 'react';
import { useGroups } from '../../context/GroupContext';
import { useExpenses } from '../../context/ExpenseContext';
import { useAuth } from '../../context/AuthContext';
import { useChat } from '../../context/ChatContext';
import { useNavigate } from 'react-router-dom';
import './People.css';

const People = () => {
  const { groups } = useGroups();
  const { expenses } = useExpenses();
  const { user: me } = useAuth();
  const { onlineUsers, openChat, unreadCounts, registerPeers } = useChat();
  const navigate = useNavigate();

  // Build a deduplicated global people list.
  // Key: userId for registered users, email for unregistered (non-empty email only).
  // Members with no userId and no email are skipped — they have no stable identity.
  const peopleMap = new Map<
    string,
    {
      name: string;
      email: string;
      avatar: string;
      userId: string | null;
      groups: { id: string; name: string }[];
      totalPaid: number;
      totalShare: number;
    }
  >();

  groups.forEach((g) => {
    g.members.forEach((m) => {
      const key = m.userId ?? (m.email ? m.email.toLowerCase() : null);
      if (!key) return; // no stable identity — skip
      if (!peopleMap.has(key)) {
        peopleMap.set(key, {
          name: m.name,
          email: m.email,
          avatar: m.avatar,
          userId: m.userId ?? null,
          groups: [],
          totalPaid: 0,
          totalShare: 0,
        });
      }
      const entry = peopleMap.get(key)!;
      if (!entry.groups.find((eg) => eg.id === g.id)) {
        entry.groups.push({ id: g.id, name: g.name });
      }
      expenses
        .filter((e) => e.groupId === g.id)
        .forEach((e) => {
          if (e.paidBy === m.id) entry.totalPaid += e.amount;
          const split = e.splits.find((s) => s.memberId === m.id);
          if (split) entry.totalShare += split.amount;
        });
    });
  });

  const people = Array.from(peopleMap.values())
    .filter((p) => !(me?.id && p.userId && p.userId === me.id))
    .sort((a, b) => a.name.localeCompare(b.name));

  useEffect(() => {
    const peers = people
      .filter((p) => p.userId)
      .map((p) => ({
        userId: p.userId!,
        name: p.name,
        avatar: p.avatar,
        email: p.email,
      }));
    if (peers.length > 0) registerPeers(peers);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [people.length]);

  const handleMessage = (p: {
    name: string;
    email: string;
    avatar: string;
    userId: string | null;
  }) => {
    if (!p.userId) return;
    openChat({
      userId: p.userId,
      name: p.name,
      avatar: p.avatar,
      email: p.email,
    });
  };

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
            const isOnline = p.userId ? onlineUsers.has(p.userId) : false;
            const canChat = !!p.userId;
            const unread = p.userId ? unreadCounts[p.userId] ?? 0 : 0;

            return (
              <div
                key={p.userId ?? p.email}
                className="person-card card card-body"
              >
                <div className="person-header">
                  <div className="person-avatar-wrap">
                    <img
                      src={p.avatar}
                      alt={p.name}
                      className="avatar avatar-lg"
                    />
                    {canChat && (
                      <span
                        className={`person-online-dot ${
                          isOnline ? 'person-online-dot--on' : ''
                        }`}
                      />
                    )}
                  </div>
                  <div className="person-info">
                    <p className="font-semibold">{p.name}</p>
                    <p className="text-xs text-muted">{p.email}</p>
                    {canChat && (
                      <p
                        className={`text-xs person-status-label ${
                          isOnline ? 'person-status-label--on' : ''
                        }`}
                      >
                        {isOnline ? 'Active now' : 'Offline'}
                      </p>
                    )}
                  </div>
                  {canChat && (
                    <button
                      className="btn-message"
                      onClick={() => handleMessage(p)}
                      title={`Message ${p.name}`}
                    >
                      <span className="btn-message-icon">💬</span>
                      {unread > 0 && (
                        <span className="btn-message-badge">{unread}</span>
                      )}
                    </button>
                  )}
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
