import { Response } from 'express';
import { AuthRequest } from '../middleware/auth';
import { ChatMessage } from '../models/ChatMessage';

export const makeConversationId = (a: string, b: string) =>
  [a, b].sort().join('_');

export const getConversation = async (
  req: AuthRequest,
  res: Response
): Promise<void> => {
  const myId = req.userId!;
  const otherId = req.params.otherUserId;
  const convId = makeConversationId(myId, otherId);

  const messages = await ChatMessage.find({ conversationId: convId })
    .sort({ createdAt: 1 })
    .limit(200)
    .lean();

  res.json({ messages });
};

export const markRead = async (
  req: AuthRequest,
  res: Response
): Promise<void> => {
  const myId = req.userId!;
  const otherId = req.params.otherUserId;
  const convId = makeConversationId(myId, otherId);

  await ChatMessage.updateMany(
    { conversationId: convId, receiverId: myId, read: false },
    { $set: { read: true } }
  );

  res.json({ ok: true });
};
