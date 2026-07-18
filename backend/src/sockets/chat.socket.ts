import { Server as SocketIOServer, Socket } from 'socket.io';
import { ChatMessage } from '../models/ChatMessage';
import { makeConversationId } from '../controllers/chat.controller';
import { encryptText } from '../utils/encryption';

export function registerChatHandlers(
  socket: Socket,
  io: SocketIOServer,
  userId: string,
): void {
  socket.on('chat:send', async (data: { receiverId: string; text: string }) => {
    const text = (data.text ?? '').trim().slice(0, 2000);
    if (!text || !data.receiverId) return;

    const convId = makeConversationId(userId, data.receiverId);
    const msg = await ChatMessage.create({
      conversationId: convId,
      senderId: userId,
      receiverId: data.receiverId,
      text: encryptText(text),
    });

    const payload = {
      id: (msg._id as unknown as string).toString(),
      conversationId: convId,
      senderId: userId,
      receiverId: data.receiverId,
      text,   // plaintext over socket — only DB stores the encrypted value
      createdAt: msg.createdAt,
      read: false,
    };

    io.to(`user:${data.receiverId}`).emit('chat:message', payload);
    socket.emit('chat:message', payload);
  });
}
