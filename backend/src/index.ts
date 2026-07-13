import 'dotenv/config';
import express from 'express';
import { createServer } from 'http';
import { Server as SocketIOServer } from 'socket.io';
import cors from 'cors';
import helmet from 'helmet';
import path from 'path';
import fs from 'fs';
import jwt from 'jsonwebtoken';
import { connectDB } from './config/db';
import authRoutes from './routes/auth.routes';
import groupRoutes from './routes/group.routes';
import expenseRoutes from './routes/expense.routes';
import userRoutes from './routes/user.routes';
import { ChatMessage } from './models/ChatMessage';
import { makeConversationId } from './controllers/chat.controller';
import chatRoutes from './routes/chat.routes';

const app = express();
const httpServer = createServer(app);

const allowedOrigins = (
  process.env.CORS_ORIGINS ?? 'http://localhost:3000,http://localhost:4200'
)
  .split(',')
  .map((o) => o.trim());

const io = new SocketIOServer(httpServer, {
  cors: { origin: allowedOrigins, credentials: true },
});

// ensure uploads folder exists
const uploadsDir = path.join(__dirname, '..', 'uploads', 'receipts');
if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true });

app.use(helmet({ crossOriginResourcePolicy: { policy: 'cross-origin' } }));
app.use(cors({ origin: allowedOrigins, credentials: true }));
app.use(express.json());

app.use('/uploads', express.static(path.join(__dirname, '..', 'uploads')));

app.use('/api/auth', authRoutes);
app.use('/api/groups', groupRoutes);
app.use('/api/expenses', expenseRoutes);
app.use('/api/users', userRoutes);
app.use('/api/chat', chatRoutes);

app.get('/api/health', (_req, res) => res.json({ status: 'ok' }));

// track online users: userId -> Set<socketId>
const onlineUsers = new Map<string, Set<string>>();

const broadcastOnlineStatus = (userId: string, isOnline: boolean) => {
  io.emit('user:status', { userId, online: isOnline });
};

io.use((socket, next) => {
  const token = socket.handshake.auth?.token as string | undefined;
  if (!token) return next(new Error('No token'));
  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET as string) as {
      userId: string;
    };
    (socket as any).userId = payload.userId;
    next();
  } catch {
    next(new Error('Invalid token'));
  }
});

io.on('connection', (socket) => {
  const userId = (socket as any).userId as string;

  // track socket
  if (!onlineUsers.has(userId)) onlineUsers.set(userId, new Set());
  onlineUsers.get(userId)!.add(socket.id);
  broadcastOnlineStatus(userId, true);

  // join personal room so we can send targeted messages
  void socket.join(`user:${userId}`);

  // send current online list to the newly connected socket
  const onlineList = Array.from(onlineUsers.keys());
  socket.emit('online:list', onlineList);

  socket.on('chat:send', async (data: { receiverId: string; text: string }) => {
    const text = (data.text ?? '').trim().slice(0, 2000);
    if (!text || !data.receiverId) return;

    const convId = makeConversationId(userId, data.receiverId);
    const msg = await ChatMessage.create({
      conversationId: convId,
      senderId: userId,
      receiverId: data.receiverId,
      text,
    });

    const payload = {
      id: (msg._id as any).toString(),
      conversationId: convId,
      senderId: userId,
      receiverId: data.receiverId,
      text: msg.text,
      createdAt: msg.createdAt,
      read: false,
    };

    // deliver to receiver's room and back to sender
    io.to(`user:${data.receiverId}`).emit('chat:message', payload);
    socket.emit('chat:message', payload);
  });

  socket.on('disconnect', () => {
    const sockets = onlineUsers.get(userId);
    if (sockets) {
      sockets.delete(socket.id);
      if (sockets.size === 0) {
        onlineUsers.delete(userId);
        broadcastOnlineStatus(userId, false);
      }
    }
  });
});

const PORT = parseInt(process.env.PORT ?? '4000', 10);

connectDB()
  .then(() => {
    httpServer.listen(PORT, () =>
      console.log(`Server running on http://localhost:${PORT}`)
    );
  })
  .catch((err: unknown) => {
    console.error('Failed to connect to MongoDB:', err);
    process.exit(1);
  });
