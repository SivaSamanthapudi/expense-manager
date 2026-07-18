import { type FC } from 'react';

interface Props {
  total: number;
  expenseCount: number;
  memberCount: number;
  selfMember: boolean;
  youOwe: number;
  owedToYou: number;
}

const GroupStatsRow: FC<Props> = ({
  total,
  expenseCount,
  memberCount,
  selfMember,
  youOwe,
  owedToYou,
}) => (
  <div className="group-stats-row mb-4">
    <div className="mini-stat card card-body">
      <p className="text-muted text-sm">Total Spent</p>
      <p className="stat-value-sm">₹{total.toLocaleString()}</p>
    </div>
    <div className="mini-stat card card-body">
      <p className="text-muted text-sm">Expenses</p>
      <p className="stat-value-sm">{expenseCount}</p>
    </div>
    <div className="mini-stat card card-body">
      <p className="text-muted text-sm">Members</p>
      <p className="stat-value-sm">{memberCount}</p>
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
);

export default GroupStatsRow;
