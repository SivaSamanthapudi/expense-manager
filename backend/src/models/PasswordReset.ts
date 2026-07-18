import { Schema, model, Document, Types } from 'mongoose';

export interface IPasswordReset extends Document {
  userId: Types.ObjectId;
  otpHash: string;   // bcrypt hash of the 6-digit OTP
  expiresAt: Date;
  used: boolean;
}

const passwordResetSchema = new Schema<IPasswordReset>(
  {
    userId:    { type: Schema.Types.ObjectId, ref: 'User', required: true },
    otpHash:   { type: String, required: true },
    expiresAt: { type: Date, required: true },
    used:      { type: Boolean, default: false },
  },
  { timestamps: true }
);

// Auto-delete documents after they expire
passwordResetSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

export const PasswordReset = model<IPasswordReset>('PasswordReset', passwordResetSchema);
