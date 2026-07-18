import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  useRef,
  ReactNode,
} from 'react';
import { io, Socket } from 'socket.io-client';
import { useAuth } from './AuthContext';
import { TOKEN_KEY, apiClient } from '../services/apiClient';

export interface ChatMessage {
  id: string;
  conversationId: string;
  senderId: string;
  receiverId: string;
  text: string;
  createdAt: string;
  read: boolean;
}

export interface ChatPeer {
  userId: string;
  name: string;
  avatar: string;
  email?: string;
}

export interface ChatToast {
  id: string;
  peer: ChatPeer;
  text: string;
}

interface OpenChat {
  peer: ChatPeer;
  messages: ChatMessage[];
  loading: boolean;
  minimized: boolean;
}

interface ChatContextType {
  onlineUsers: Set<string>;
  openChats: OpenChat[];
  unreadCounts: Record<string, number>;
  totalUnread: number;
  toasts: ChatToast[];
  dismissToast: (id: string) => void;
  openChat: (peer: ChatPeer) => void;
  closeChat: (userId: string) => void;
  toggleMinimize: (userId: string) => void;
  sendMessage: (receiverId: string, text: string) => void;
  markRead: (userId: string) => void;
  registerPeers: (peers: ChatPeer[]) => void;
}

const ChatContext = createContext<ChatContextType | null>(null);

const SOCKET_URL =
  process.env.REACT_APP_API_BASE_URL?.replace('/api', '') ??
  'http://localhost:4000';

export const ChatProvider = ({ children }: { children: ReactNode }) => {
  const { user, status } = useAuth();
  const [onlineUsers, setOnlineUsers] = useState<Set<string>>(new Set());
  const [openChats, setOpenChats] = useState<OpenChat[]>([]);
  const [unreadCounts, setUnreadCounts] = useState<Record<string, number>>({});
  const [toasts, setToasts] = useState<ChatToast[]>([]);
  const socketRef = useRef<Socket | null>(null);
  const knownPeersRef = useRef<Map<string, ChatPeer>>(new Map());

  // We need refs to access latest state inside the socket handler without stale closures
  const openChatsRef = useRef<OpenChat[]>([]);
  openChatsRef.current = openChats;

  const addToast = useCallback((peer: ChatPeer, text: string) => {
    const toastId = `${peer.userId}-${Date.now()}`;
    setToasts((prev) => [...prev.slice(-4), { id: toastId, peer, text }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== toastId));
    }, 5000);
  }, []);

  const dismissToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  useEffect(() => {
    if (status !== 'authenticated' || !user) return;

    const token = localStorage.getItem(TOKEN_KEY);
    if (!token) return;

    const socket = io(SOCKET_URL, {
      auth: { token },
      transports: ['websocket'],
    });
    socketRef.current = socket;

    socket.on('online:list', (userIds: string[]) => {
      setOnlineUsers(new Set(userIds));
    });

    socket.on(
      'user:status',
      ({ userId, online }: { userId: string; online: boolean }) => {
        setOnlineUsers((prev) => {
          const next = new Set(prev);
          if (online) next.add(userId);
          else next.delete(userId);
          return next;
        });
      }
    );

    socket.on('chat:message', (msg: ChatMessage) => {
      const isIncoming = msg.senderId !== user.id;
      const peerId = isIncoming ? msg.senderId : msg.receiverId;

      // Append message to open chat if it exists
      setOpenChats((prev) => {
        const idx = prev.findIndex((c) => c.peer.userId === peerId);
        if (idx === -1) return prev;
        const updated = [...prev];
        updated[idx] = {
          ...updated[idx],
          messages: [...updated[idx].messages, msg],
        };
        return updated;
      });

      if (isIncoming) {
        const currentChats = openChatsRef.current;
        const openChat = currentChats.find(
          (c) => c.peer.userId === msg.senderId
        );
        const isVisible = openChat && !openChat.minimized;

        if (!isVisible) {
          // increment unread count
          setUnreadCounts((u) => ({
            ...u,
            [msg.senderId]: (u[msg.senderId] ?? 0) + 1,
          }));

          // show toast notification — we need sender info
          // if chat is open (minimized), we already have peer info
          const peer = openChat?.peer ??
            knownPeersRef.current.get(msg.senderId) ?? {
              userId: msg.senderId,
              name: 'New message',
              avatar: `https://api.dicebear.com/7.x/initials/svg?seed=?`,
            };
          addToast(peer, msg.text);
        }
      }
    });

    return () => {
      socket.disconnect();
      socketRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status, user?.id]);

  const openChat = useCallback(async (peer: ChatPeer) => {
    setOpenChats((prev) => {
      if (prev.find((c) => c.peer.userId === peer.userId)) {
        return prev.map((c) =>
          c.peer.userId === peer.userId ? { ...c, minimized: false } : c
        );
      }
      if (prev.length >= 3) {
        const minimizedIdx = prev.findIndex((c) => c.minimized);
        const removeIdx = minimizedIdx !== -1 ? minimizedIdx : 0;
        const next = prev.filter((_, i) => i !== removeIdx);
        return [
          ...next,
          { peer, messages: [], loading: true, minimized: false },
        ];
      }
      return [...prev, { peer, messages: [], loading: true, minimized: false }];
    });

    try {
      const res = await apiClient.get<{ messages: ChatMessage[] }>(
        `/chat/conversation/${peer.userId}`
      );
      setOpenChats((prev) =>
        prev.map((c) =>
          c.peer.userId === peer.userId
            ? { ...c, messages: res.data.messages, loading: false }
            : c
        )
      );
    } catch {
      setOpenChats((prev) =>
        prev.map((c) =>
          c.peer.userId === peer.userId ? { ...c, loading: false } : c
        )
      );
    }
  }, []);

  const closeChat = useCallback((userId: string) => {
    setOpenChats((prev) => prev.filter((c) => c.peer.userId !== userId));
  }, []);

  const toggleMinimize = useCallback((userId: string) => {
    setOpenChats((prev) =>
      prev.map((c) =>
        c.peer.userId === userId ? { ...c, minimized: !c.minimized } : c
      )
    );
  }, []);

  const sendMessage = useCallback((receiverId: string, text: string) => {
    socketRef.current?.emit('chat:send', { receiverId, text });
  }, []);

  const registerPeers = useCallback((peers: ChatPeer[]) => {
    peers.forEach((p) => knownPeersRef.current.set(p.userId, p));
  }, []);

  const markRead = useCallback((userId: string) => {
    setUnreadCounts((prev) => {
      if (!prev[userId]) return prev;
      const next = { ...prev };
      delete next[userId];
      return next;
    });
    apiClient.patch(`/chat/conversation/${userId}/read`).catch(() => {});
  }, []);

  const totalUnread = Object.values(unreadCounts).reduce((s, n) => s + n, 0);

  return (
    <ChatContext.Provider
      value={{
        onlineUsers,
        openChats,
        unreadCounts,
        totalUnread,
        toasts,
        dismissToast,
        openChat,
        closeChat,
        toggleMinimize,
        sendMessage,
        markRead,
        registerPeers,
      }}
    >
      {children}
    </ChatContext.Provider>
  );
};

export const useChat = () => {
  const ctx = useContext(ChatContext);
  if (!ctx) throw new Error('useChat must be used within ChatProvider');
  return ctx;
};
