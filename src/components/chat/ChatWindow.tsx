import { useState, useEffect, useRef, KeyboardEvent } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useChat, ChatMessage } from '../../context/ChatContext';
import './ChatWindow.css';

interface Props {
  peerId: string;
  peerName: string;
  peerAvatar: string;
  messages: ChatMessage[];
  loading: boolean;
  minimized: boolean;
}

const ChatWindow = ({
  peerId,
  peerName,
  peerAvatar,
  messages,
  loading,
  minimized,
}: Props) => {
  const { user } = useAuth();
  const { onlineUsers, closeChat, toggleMinimize, sendMessage, markRead } =
    useChat();
  const [text, setText] = useState('');
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const isOnline = onlineUsers.has(peerId);

  useEffect(() => {
    if (!minimized) {
      bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
      markRead(peerId);
    }
  }, [messages, minimized, peerId, markRead]);

  useEffect(() => {
    if (!minimized) {
      inputRef.current?.focus();
      markRead(peerId);
    }
  }, [minimized, peerId, markRead]);

  const handleSend = () => {
    const trimmed = text.trim();
    if (!trimmed) return;
    sendMessage(peerId, trimmed);
    setText('');
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const formatTime = (iso: string) => {
    const d = new Date(iso);
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  return (
    <div className={`chat-window ${minimized ? 'chat-window--minimized' : ''}`}>
      <div className="chat-header" onClick={() => toggleMinimize(peerId)}>
        <div className="chat-header-user">
          <div className="chat-avatar-wrap">
            <img src={peerAvatar} alt={peerName} className="chat-avatar" />
            <span
              className={`chat-status-dot ${
                isOnline ? 'chat-status-dot--online' : ''
              }`}
            />
          </div>
          <div className="chat-header-info">
            <span className="chat-peer-name">{peerName}</span>
            <span className="chat-peer-status">
              {isOnline ? 'Active now' : 'Offline'}
            </span>
          </div>
        </div>
        <div className="chat-header-actions">
          <button
            className="chat-btn-icon"
            onClick={(e) => {
              e.stopPropagation();
              toggleMinimize(peerId);
            }}
            title={minimized ? 'Expand' : 'Minimize'}
          >
            {minimized ? '▲' : '▼'}
          </button>
          <button
            className="chat-btn-icon"
            onClick={(e) => {
              e.stopPropagation();
              closeChat(peerId);
            }}
            title="Close"
          >
            ✕
          </button>
        </div>
      </div>

      {!minimized && (
        <>
          <div className="chat-messages">
            {loading && (
              <div className="chat-loading">
                <div className="spinner" style={{ width: 24, height: 24 }} />
              </div>
            )}
            {!loading && messages.length === 0 && (
              <div className="chat-empty">Say hi to {peerName}!</div>
            )}
            {messages.map((msg, i) => {
              const isMine = msg.senderId === user?.id;
              const showTime =
                i === messages.length - 1 ||
                new Date(messages[i + 1].createdAt).getTime() -
                  new Date(msg.createdAt).getTime() >
                  5 * 60 * 1000;
              return (
                <div
                  key={msg.id ?? i}
                  className={`chat-msg-row ${
                    isMine ? 'chat-msg-row--mine' : ''
                  }`}
                >
                  {!isMine && (
                    <img
                      src={peerAvatar}
                      alt={peerName}
                      className="chat-msg-avatar"
                    />
                  )}
                  <div className="chat-msg-group">
                    <div
                      className={`chat-bubble ${
                        isMine ? 'chat-bubble--mine' : 'chat-bubble--theirs'
                      }`}
                    >
                      {msg.text}
                    </div>
                    {showTime && (
                      <span className="chat-msg-time">
                        {formatTime(msg.createdAt)}
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
            <div ref={bottomRef} />
          </div>

          <div className="chat-input-area">
            <input
              ref={inputRef}
              className="chat-input"
              placeholder="Aa"
              value={text}
              onChange={(e) => setText(e.target.value)}
              onKeyDown={handleKeyDown}
              maxLength={2000}
            />
            <button
              className={`chat-send-btn ${
                text.trim() ? 'chat-send-btn--active' : ''
              }`}
              onClick={handleSend}
              disabled={!text.trim()}
            >
              ➤
            </button>
          </div>
        </>
      )}
    </div>
  );
};

export default ChatWindow;
