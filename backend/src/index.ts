import 'dotenv/config';
import express from 'express';
import { createServer } from 'http';
import { Server as SocketIOServer } from 'socket.io';
import cors from 'cors';
import helmet from 'helmet';
import path from 'path';
import fs from 'fs';
import { connectDB } from './config/db';
import authRoutes from './routes/auth.routes';
import groupRoutes from './routes/group.routes';
import expenseRoutes from './routes/expense.routes';
import userRoutes from './routes/user.routes';
import chatRoutes from './routes/chat.routes';
import { initSockets } from './sockets';

const app = express();
const httpServer = createServer(app);

const allowedOrigins = (process.env.CORS_ORIGINS ?? 'http://localhost:3000,http://localhost:4201,http://localhost:4200')
  .split(',')
  .map(o => o.trim());

const io = new SocketIOServer(httpServer, {
  cors: { origin: allowedOrigins, credentials: true },
});

// Ensure uploads folder exists
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

initSockets(io);

const PORT = parseInt(process.env.PORT ?? '3000', 10);

connectDB()
  .then(() => {
    httpServer.listen(PORT, () => console.log(`Server running on http://localhost:${PORT}`));
  })
  .catch((err: unknown) => {
    console.error('Failed to connect to MongoDB:', err);
    process.exit(1);
  });
