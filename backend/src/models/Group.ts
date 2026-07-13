import { Schema, model, Document, Types } from 'mongoose';

export interface IMember {
  _id: Types.ObjectId;
  name: string;
  email?: string;
  mobile?: string;
  avatar: string;
  groupId: Types.ObjectId;
  userId?: Types.ObjectId; // set when the member is a registered SplitWise user
}

export interface IGroup extends Document {
  name: string;
  description: string;
  category: 'trip' | 'home' | 'food' | 'other';
  simplifyDebts: boolean;
  members: IMember[];
  createdBy: Types.ObjectId;
  createdAt: Date;
}

const memberSchema = new Schema<IMember>({
  name: { type: String, required: true, trim: true },
  email: {
    type: String,
    required: false,
    lowercase: true,
    trim: true,
    default: '',
  },
  mobile: { type: String, required: false, trim: true, default: '' },
  avatar: { type: String, default: '' },
  groupId: { type: Schema.Types.ObjectId },
  userId: { type: Schema.Types.ObjectId, ref: 'User', required: false },
});

const groupSchema = new Schema<IGroup>(
  {
    name: { type: String, required: true, trim: true },
    description: { type: String, default: '' },
    category: {
      type: String,
      enum: ['trip', 'home', 'food', 'other'],
      default: 'other',
    },
    simplifyDebts: { type: Boolean, default: false },
    members: [memberSchema],
    createdBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  },
  { timestamps: true }
);

export const Group = model<IGroup>('Group', groupSchema);
