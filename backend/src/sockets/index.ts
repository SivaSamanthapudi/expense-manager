import { Server as SocketIOServer, Socket } from 'socket.io';
import jwt from 'jsonwebtoken';
import { registerPresenceHandlers, OnlineUsers } from './presence.socket';
import { registerChatHandlers } from './chat.socket';

interface AuthenticatedSocket extends Socket {
  userId: string;
}

const onlineUsers: OnlineUsers = new Map();

export function initSockets(io: SocketIOServer): void {
  io.use((socket, next) => {
    const token = socket.handshake.auth?.token as string | undefined;
    if (!token) return next(new Error('No token'));
    try {
      const payload = jwt.verify(token, process.env.JWT_SECRET as string) as { userId: string };
      (socket as AuthenticatedSocket).userId = payload.userId;
      next();
    } catch {
      next(new Error('Invalid token'));
    }
  });

  io.on('connection', async (socket) => {
    const { userId } = socket as AuthenticatedSocket;
    await socket.join(`user:${userId}`);
    registerPresenceHandlers(socket, io, userId, onlineUsers);
    registerChatHandlers(socket, io, userId);
  });
}
