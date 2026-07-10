import { Navigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import Sidebar from '../navbar/Sidebar';
import { ReactNode, useState } from 'react';

const ProtectedRoute = ({ children }: { children: ReactNode }) => {
  const { user, status } = useAuth();
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
      <Sidebar />
      <div className="main-content">
        {children}
      </div>
    </div>
  );
};

export default ProtectedRoute;
  