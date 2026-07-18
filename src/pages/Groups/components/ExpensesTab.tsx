import { type FC } from 'react';
import { useNavigate } from 'react-router-dom';
import { type Expense, type ExpenseCategory } from '../../../types';

const CATEGORY_ICONS: Record<ExpenseCategory, string> = {
  food: '🍔',
  transport: '🚗',
  accommodation: '🏨',
  entertainment: '🎬',
  utilities: '💡',
  other: '📦',
};

interface Props {
  groupId: string;
  expenses: Expense[];
  expenseDeleteError: string | null;
  onDeleteError: (msg: string | null) => void;
  onDelete: (id: string) => void;
  canModify: (e: { groupId: string }) => boolean;
  formatDate: (d: string) => string;
}

const ExpensesTab: FC<Props> = ({
  groupId,
  expenses,
  expenseDeleteError,
  onDeleteError,
  onDelete,
  canModify,
  formatDate,
}) => {
  const navigate = useNavigate();
  return (
    <div className="card">
      {expenseDeleteError && (
        <div
          className="remove-error-banner"
          style={{ borderRadius: '12px 12px 0 0' }}
        >
          ⚠️ {expenseDeleteError}
          <button
            className="remove-error-close"
            onClick={() => onDeleteError(null)}
          >
            ✕
          </button>
        </div>
      )}
      <div className="card-body">
        {expenses.length === 0 ? (
          <div className="empty-state">
            <div className="empty-icon">💸</div>
            <h3>No expenses yet</h3>
            <p>Add the first expense to this group</p>
            <button
              className="btn btn-primary"
              onClick={() => navigate(`/expenses/new?groupId=${groupId}`)}
            >
              Add Expense
            </button>
          </div>
        ) : (
          <div className="expense-list">
            {expenses.map((e) => (
              <div key={e.id} className="expense-row">
                <div className="expense-row-icon">
                  {CATEGORY_ICONS[e.category]}
                </div>
                <div className="expense-row-info">
                  <p className="font-semibold text-sm">{e.title}</p>
                  <p className="text-xs text-muted">
                    Paid by {e.paidByName} · {formatDate(e.date)}
                  </p>
                </div>
                <div className="expense-row-splits">
                  {e.splits.map((s) => (
                    <span
                      key={s.memberId}
                      className={`split-chip ${
                        s.paid ? 'split-paid' : 'split-unpaid'
                      }`}
                    >
                      {s.memberName.split(' ')[0]}: ₹{s.amount}
                    </span>
                  ))}
                </div>
                <div className="expense-row-actions">
                  <span className="expense-amount">
                    ₹{e.amount.toLocaleString()}
                  </span>
                  <button
                    className="btn btn-outline btn-sm"
                    onClick={() => navigate(`/expenses/edit/${e.id}`)}
                    disabled={!canModify(e)}
                    title={
                      !canModify(e)
                        ? 'You are not a participant in this expense'
                        : ''
                    }
                  >
                    Edit
                  </button>
                  <button
                    className="btn btn-danger btn-sm"
                    onClick={() => onDelete(e.id)}
                    disabled={!canModify(e)}
                    title={
                      !canModify(e)
                        ? 'You are not a participant in this expense'
                        : ''
                    }
                  >
                    Delete
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default ExpensesTab;
