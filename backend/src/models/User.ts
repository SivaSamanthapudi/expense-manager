import { Schema, model, Document } from 'mongoose';

export type MemberLinkStatus = 'pending' | 'linked' | 'failed';

export interface IUser extends Document {
  name: string;
  email?: string;
  mobile?: string;
  passwordHash: string;
  avatar: string;
  memberLinkStatus: MemberLinkStatus;
  createdAt: Date;
}

const userSchema = new Schema<IUser>(
  {
    name: { type: String, required: true, trim: true },
    email: {
      type: String,
      unique: true,
      sparse: true, // allows multiple docs with no email (only mobile users)
      lowercase: true,
      trim: true,
    },
    mobile: {
      type: String,
      unique: true,
      sparse: true, // allows multiple docs with no mobile (only email users)
      trim: true,
    },
    passwordHash: { type: String, required: true },
    avatar: { type: String, required: true },
    memberLinkStatus: {
      type: String,
      enum: ['pending', 'linked', 'failed'],
      default: 'pending',
    },
  },
  { timestamps: true }
);

// at least one of email/mobile must be present
userSchema.pre('validate', function (next) {
  if (!this.email && !this.mobile) {
    next(new Error('Either email or mobile number is required'));
  } else {
    next();
  }
});

export const User = model<IUser>('User', userSchema);
