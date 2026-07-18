import { type FC } from 'react';
import { type PaymentRecord } from '../../../types';

interface MemberBalance {
  id: string;
  name: string;
  avatar: string;
  email: string;
  paid: number;
  share: number;
  net: number;
}

interface DebtTransaction {
  fromId: string;
  fromName: string;
  toId: string;
  toName: string;
  amount: number;
}

interface Props {
  memberBalances: MemberBalance[];
  simplified: DebtTransaction[];
  paymentHistory: PaymentRecord[];
  selfMemberId?: string;
  simplifyDebts: boolean;
  formatDate: (d: string) => string;
  onPayClick: (fromId: string, toId: string) => void;
}

const BalancesTab: FC<Props> = ({
  memberBalances,
  simplified,
  paymentHistory,
  selfMemberId,
  simplifyDebts,
  formatDate,
  onPayClick,
}) => (
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
                m.id === selfMemberId ? 'balance-row-self' : ''
              }`}
            >
              <img src={m.avatar} alt={m.name} className="avatar avatar-sm" />
              <div className="balance-member-info">
                <p className="text-sm font-semibold">
                  {m.name}
                  {m.id === selfMemberId && (
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
            {simplifyDebts
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
            const isYouPaying = t.fromId === selfMemberId;
            const isYouReceiving = t.toId === selfMemberId;
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
                        isYouPaying ? 'you-pay-label' : 'you-receive-label'
                      }`}
                    >
                      {isYouPaying ? '↑ you owe this' : '↓ you receive this'}
                    </span>
                  )}
                </div>
                <span className="settle-amount">
                  ₹{t.amount.toLocaleString()}
                </span>
                <button
                  className="btn btn-sm btn-outline"
                  style={{ flexShrink: 0, marginLeft: 8 }}
                  onClick={() => onPayClick(t.fromId, t.toId)}
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

    {paymentHistory.length > 0 && (
      <div className="card card-body mt-4">
        <h4 className="font-semibold mb-3" style={{ fontSize: 14 }}>
          Payment History
        </h4>
        <div className="payment-history-list">
          {paymentHistory.map((p) => {
            const isYou =
              p.fromMemberId === selfMemberId || p.toMemberId === selfMemberId;
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
                  <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>
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
                      {p.fromMemberId === selfMemberId
                        ? 'You'
                        : p.fromMemberName.split(' ')[0]}
                    </span>
                    <span className="text-muted"> paid </span>
                    <span className="font-semibold">
                      {p.toMemberId === selfMemberId
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
);

export default BalancesTab;
