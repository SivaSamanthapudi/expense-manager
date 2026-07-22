import { Schema, model, Document, Types } from 'mongoose';

interface IExpenseHistoryChange {
  field: string;
  oldValue: unknown;
  newValue: unknown;
}

export interface IExpenseHistory extends Document {
  expenseId: Types.ObjectId;
  editedBy: string;
  editedByName: string;
  editedAt: Date;
  changes: IExpenseHistoryChange[];
}

const changeSchema = new Schema<IExpenseHistoryChange>(
  {
    field: { type: String, required: true },
    oldValue: { type: Schema.Types.Mixed },
    newValue: { type: Schema.Types.Mixed },
  },
  { _id: false }
);

const expenseHistorySchema = new Schema<IExpenseHistory>({
  expenseId: { type: Schema.Types.ObjectId, ref: 'Expense', required: true, index: true },
  editedBy: { type: String, required: true },
  editedByName: { type: String, required: true },
  editedAt: { type: Date, required: true },
  changes: [changeSchema],
});

export const ExpenseHistory = model<IExpenseHistory>('ExpenseHistory', expenseHistorySchema);
