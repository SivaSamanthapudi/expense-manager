import { Schema, model, Document, Types } from 'mongoose';

export interface IPayment extends Document {
  groupId: Types.ObjectId;
  fromMemberId: string;
  fromMemberName: string;
  toMemberId: string;
  toMemberName: string;
  amount: number;
  appliedAmount: number;
  date: Date;
}

const paymentSchema = new Schema<IPayment>(
  {
    groupId: { type: Schema.Types.ObjectId, ref: 'Group', required: true },
    fromMemberId: { type: String, required: true },
    fromMemberName: { type: String, required: true },
    toMemberId: { type: String, required: true },
    toMemberName: { type: String, required: true },
    amount: { type: Number, required: true },
    appliedAmount: { type: Number, required: true },
    date: { type: Date, default: Date.now },
  },
  { timestamps: true }
);

export const Payment = model<IPayment>('Payment', paymentSchema);
