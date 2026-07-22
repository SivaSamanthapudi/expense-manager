import { useState, useEffect } from 'react';
import { Navigate, Outlet } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import Sidebar from '../navbar/Sidebar';
import ChatTray from '../chat/ChatTray';

const ProtectedRoute = () => {
  const { user, status } = useAuth();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  // Prevent body scroll when sidebar overlay is shown on mobile
  useEffect(() => {
    document.body.style.overflow = sidebarOpen ? 'hidden' : '';
    return () => { document.body.style.overflow = ''; };
  }, [sidebarOpen]);

  if (status === 'loading' || status === 'idle') {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh' }}>
        <div className="spinner" />
      </div>
    );
  }

  if (status === 'unauthenticated' || !user) {
    return <Navigate to="/login" />;
  }

  return (
    <div className="layout">
      <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />
      {sidebarOpen && (
        <div className="sidebar-overlay" onClick={() => setSidebarOpen(false)} />
      )}
      <div className="main-content">
        <header className="mobile-header">
          <button
            className="mobile-menu-btn"
            onClick={() => setSidebarOpen(true)}
            aria-label="Open navigation menu"
          >
            ☰
          </button>
          <span className="mobile-logo-text">💸 SplitWise</span>
        </header>
        <Outlet />
      </div>
      <ChatTray />
    </div>
  );
};

export default ProtectedRoute;
