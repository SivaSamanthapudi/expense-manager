import { NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import './Sidebar.css';

const NAV_ITEMS = [
  { path: '/dashboard', label: 'Dashboard', icon: '📊' },
  { path: '/groups', label: 'Groups', icon: '👥' },
  { path: '/expenses', label: 'Expenses', icon: '💰' },
  { path: '/people', label: 'People', icon: '🧑‍🤝‍🧑' },
];

const Sidebar = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <aside className="sidebar">
      <div className="sidebar-logo">
        <span className="logo-icon">💸</span>
        <span className="logo-text">SplitWise</span>
      </div>

      <nav className="sidebar-nav">
        {NAV_ITEMS.map(item => (
          <NavLink
            key={item.path}
            to={item.path}
            className={({ isActive }) => `nav-item ${isActive ? 'nav-item-active' : ''}`}
          >
            <span className="nav-icon">{item.icon}</span>
            <span className="nav-label">{item.label}</span>
          </NavLink>
        ))}
      </nav>

      <div className="sidebar-footer">
        <div className="user-info">
          <img src={user?.avatar} alt={user?.name} className="avatar avatar-sm" />
          <div className="user-details">
            <p className="user-name">{user?.name}</p>
            <p className="user-email text-xs text-muted">{user?.email}</p>
          </div>
        </div>
        <button className="btn-icon logout-btn" onClick={handleLogout} title="Logout">
          🚪
        </button>
      </div>
    </aside>
  );
};

export default Sidebar;
