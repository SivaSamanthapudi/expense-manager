import { Navigate, Outlet } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import Sidebar from '../navbar/Sidebar';
import ChatTray from '../chat/ChatTray';

const ProtectedRoute = () => {
  const { user, status } = useAuth();

  if (status === 'loading' || status === 'idle') {
    return (
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          height: '100vh',
        }}
      >
        <div className="spinner" />
      </div>
    );
  }

  if (status === 'unauthenticated' || !user) {
    return <Navigate to="/login" />;
  }

  return (
    <div className="layout">
      <Sidebar />
      <div className="main-content">
        <Outlet />
      </div>
      <ChatTray />
    </div>
  );
};

export default ProtectedRoute;
