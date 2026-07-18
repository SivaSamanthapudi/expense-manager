import { Schema, model, Document, Types } from 'mongoose';

export interface IExpenseSplit {
  memberId: string;
  memberName: string;
  amount: number;
  paid: boolean;
  paidAmount?: number; // amount actually paid so far (for partial payments)
}

export interface IExpense extends Document {
  groupId: Types.ObjectId;
  title: string;
  amount: number;
  category: 'food' | 'transport' | 'accommodation' | 'entertainment' | 'utilities' | 'other';
  paidBy: string;
  paidByName: string;
  splits: IExpenseSplit[];
  date: Date;
  notes: string;
  receiptUrls: string[];
}

const splitSchema = new Schema<IExpenseSplit>({
  memberId: { type: String, required: true },
  memberName: { type: String, required: true },
  amount: { type: Number, required: true },
  paid: { type: Boolean, default: false },
  paidAmount: { type: Number, default: 0 },
});

const expenseSchema = new Schema<IExpense>(
  {
    groupId: { type: Schema.Types.ObjectId, ref: 'Group', required: true },
    title: { type: String, required: true, trim: true },
    amount: { type: Number, required: true, min: 0 },
    category: {
      type: String,
      enum: ['food', 'transport', 'accommodation', 'entertainment', 'utilities', 'other'],
      default: 'other',
    },
    paidBy: { type: String, required: true },
    paidByName: { type: String, required: true },
    splits: [splitSchema],
    date: { type: Date, required: true },
    notes: { type: String, default: '' },
    receiptUrls: { type: [String], default: [] },
  },
  { timestamps: true }
);

export const Expense = model<IExpense>('Expense', expenseSchema);
