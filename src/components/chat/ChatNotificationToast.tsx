import { useChat, ChatToast } from '../../context/ChatContext';
import './ChatNotificationToast.css';

const Toast = ({
  toast,
  onDismiss,
  onOpen,
}: {
  toast: ChatToast;
  onDismiss: () => void;
  onOpen: () => void;
}) => (
  <div className="chat-toast" onClick={onOpen} role="button" tabIndex={0}>
    <img
      src={toast.peer.avatar}
      alt={toast.peer.name}
      className="chat-toast-avatar"
    />
    <div className="chat-toast-body">
      <p className="chat-toast-name">{toast.peer.name}</p>
      <p className="chat-toast-text">
        {toast.text.length > 60 ? toast.text.slice(0, 60) + '…' : toast.text}
      </p>
    </div>
    <button
      className="chat-toast-close"
      onClick={(e) => {
        e.stopPropagation();
        onDismiss();
      }}
      aria-label="Dismiss"
    >
      ✕
    </button>
  </div>
);

const ChatNotificationToast = () => {
  const { toasts, dismissToast, openChat } = useChat();

  if (toasts.length === 0) return null;

  return (
    <div className="chat-toast-container">
      {toasts.map((t) => (
        <Toast
          key={t.id}
          toast={t}
          onDismiss={() => dismissToast(t.id)}
          onOpen={() => {
            openChat(t.peer);
            dismissToast(t.id);
          }}
        />
      ))}
    </div>
  );
};

export default ChatNotificationToast;
