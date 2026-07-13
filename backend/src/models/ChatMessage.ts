import { Schema, model, Document } from 'mongoose';

export interface IChatMessage extends Document {
  conversationId: string; // sorted pair of userIds: "userId1_userId2"
  senderId: string;
  receiverId: string;
  text: string;
  createdAt: Date;
  read: boolean;
}

const chatMessageSchema = new Schema<IChatMessage>(
  {
    conversationId: { type: String, required: true, index: true },
    senderId: { type: String, required: true },
    receiverId: { type: String, required: true },
    text: { type: String, required: true, trim: true, maxlength: 2000 },
    read: { type: Boolean, default: false },
  },
  { timestamps: true }
);

export const ChatMessage = model<IChatMessage>(
  'ChatMessage',
  chatMessageSchema
);
