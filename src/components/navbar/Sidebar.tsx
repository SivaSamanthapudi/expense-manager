import { NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useChat } from '../../context/ChatContext';
import './Sidebar.css';

const BASE_NAV_ITEMS = [
  { path: '/dashboard', label: 'Dashboard', icon: '📊' },
  { path: '/groups', label: 'Groups', icon: '👥' },
  { path: '/expenses', label: 'Expenses', icon: '💰' },
  { path: '/people', label: 'People', icon: '🧑‍🤝‍🧑' },
];

interface Props {
  isOpen: boolean;
  onClose: () => void;
}

const Sidebar = ({ isOpen, onClose }: Props) => {
  const { user, logout } = useAuth();
  const { totalUnread } = useChat();
  const navigate = useNavigate();

  const handleLogout = () => { void logout(); };

  const handleNav = () => onClose();

  return (
    <aside className={`sidebar ${isOpen ? 'sidebar--open' : ''}`}>
      <div className="sidebar-logo">
        <span className="logo-icon">💸</span>
        <span className="logo-text">SplitWise</span>
        <button className="sidebar-close-btn" onClick={onClose} aria-label="Close menu">✕</button>
      </div>

      <nav className="sidebar-nav">
        {BASE_NAV_ITEMS.map(item => (
          <NavLink
            key={item.path}
            to={item.path}
            className={({ isActive }) => `nav-item ${isActive ? 'nav-item-active' : ''}`}
            onClick={handleNav}
          >
            <span className="nav-icon">{item.icon}</span>
            <span className="nav-label">{item.label}</span>
            {item.path === '/people' && totalUnread > 0 && (
              <span className="nav-unread-badge">{totalUnread > 99 ? '99+' : totalUnread}</span>
            )}
          </NavLink>
        ))}
      </nav>

      <div className="sidebar-footer">
        <button
          className="user-info user-info-btn"
          onClick={() => { navigate('/profile'); onClose(); }}
          title="Edit profile"
        >
          <img src={user?.avatar} alt={user?.name} className="avatar avatar-sm" />
          <div className="user-details">
            <p className="user-name">{user?.name}</p>
            <p className="user-email text-xs text-muted">{user?.email ?? user?.mobile}</p>
          </div>
        </button>
        <button className="btn-icon logout-btn" onClick={handleLogout} title="Logout">
          🚪
        </button>
      </div>
    </aside>
  );
};

export default Sidebar;
