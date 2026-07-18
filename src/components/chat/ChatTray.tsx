import { useChat } from '../../context/ChatContext';
import ChatWindow from './ChatWindow';
import ChatNotificationToast from './ChatNotificationToast';
import './ChatTray.css';

const ChatTray = () => {
  const { openChats } = useChat();

  return (
    <>
      <ChatNotificationToast />
      {openChats.length > 0 && (
        <div className="chat-tray">
          {openChats.map((chat) => (
            <ChatWindow
              key={chat.peer.userId}
              peerId={chat.peer.userId}
              peerName={chat.peer.name}
              peerAvatar={chat.peer.avatar}
              messages={chat.messages}
              loading={chat.loading}
              minimized={chat.minimized}
            />
          ))}
        </div>
      )}
    </>
  );
};

export default ChatTray;
