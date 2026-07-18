import { Server as SocketIOServer, Socket } from 'socket.io';

export type OnlineUsers = Map<string, Set<string>>;

export function registerPresenceHandlers(
  socket: Socket,
  io: SocketIOServer,
  userId: string,
  onlineUsers: OnlineUsers
): void {
  // Track this socket
  if (!onlineUsers.has(userId)) onlineUsers.set(userId, new Set());
  onlineUsers.get(userId)!.add(socket.id);
  io.emit('user:status', { userId, online: true });

  // Send the current online list only to this socket
  socket.emit('online:list', Array.from(onlineUsers.keys()));

  socket.on('disconnect', () => {
    const sockets = onlineUsers.get(userId);
    if (sockets) {
      sockets.delete(socket.id);
      if (sockets.size === 0) {
        onlineUsers.delete(userId);
        io.emit('user:status', { userId, online: false });
      }
    }
  });
}
