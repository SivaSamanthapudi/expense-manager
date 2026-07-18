import { type FC } from 'react';

interface DebtTransaction {
  fromId: string;
  fromName: string;
  toId: string;
  toName: string;
  amount: number;
}

interface Props {
  selfMemberId: string;
  simplified: DebtTransaction[];
  owedToYou: number;
  youOwe: number;
}

const GroupDebtCards: FC<Props> = ({
  selfMemberId,
  simplified,
  owedToYou,
  youOwe,
}) => (
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
      {simplified.filter((t) => t.toId === selfMemberId).length === 0 ? (
        <p className="debt-card-empty">You're all settled up! 🎉</p>
      ) : (
        <div className="debt-person-list">
          {simplified
            .filter((t) => t.toId === selfMemberId)
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
            {youOwe > 0 ? `₹${youOwe.toLocaleString()} total` : 'Nothing owed'}
          </p>
        </div>
      </div>
      {simplified.filter((t) => t.fromId === selfMemberId).length === 0 ? (
        <p className="debt-card-empty">You don't owe anyone! 🎉</p>
      ) : (
        <div className="debt-person-list">
          {simplified
            .filter((t) => t.fromId === selfMemberId)
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
);

export default GroupDebtCards;
