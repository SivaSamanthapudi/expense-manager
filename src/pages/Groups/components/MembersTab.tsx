import { type FC } from 'react';

interface MemberBalance {
  id: string;
  name: string;
  avatar: string;
  email: string;
  paid: number;
  share: number;
  net: number;
}

interface Props {
  memberCount: number;
  memberBalances: MemberBalance[];
  selfMemberId?: string;
  removeError: string | null;
  onRemoveError: (msg: string | null) => void;
  onRemove: (id: string, name: string) => void;
  onAddMember: () => void;
}

const MembersTab: FC<Props> = ({
  memberCount,
  memberBalances,
  selfMemberId,
  removeError,
  onRemoveError,
  onRemove,
  onAddMember,
}) => (
  <div>
    <div className="flex justify-between items-center mb-4">
      <span className="text-sm text-muted">
        {memberCount} member{memberCount !== 1 ? 's' : ''}
      </span>
      <button className="btn btn-primary btn-sm" onClick={onAddMember}>
        + Add Member
      </button>
    </div>
    {removeError && (
      <div className="remove-error-banner">
        ⚠️ {removeError}
        <button
          className="remove-error-close"
          onClick={() => onRemoveError(null)}
        >
          ✕
        </button>
      </div>
    )}
    {memberBalances.length === 0 ? (
      <div className="card">
        <div className="empty-state">
          <div className="empty-icon">👤</div>
          <h3>No members yet</h3>
          <button className="btn btn-primary" onClick={onAddMember}>
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
                <img src={m.avatar} alt={m.name} className="avatar avatar-lg" />
                <div>
                  <p className="font-semibold">
                    {m.name}
                    {m.id === selfMemberId && (
                      <span className="self-tag" style={{ marginLeft: 6 }}>
                        you
                      </span>
                    )}
                  </p>
                  <p className="text-xs text-muted">{m.email}</p>
                </div>
              </div>
              <button
                className="btn-icon"
                onClick={() => onRemove(m.id, m.name)}
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
);

export default MembersTab;
