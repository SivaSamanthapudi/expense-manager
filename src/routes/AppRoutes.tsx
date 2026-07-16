import { Routes, Route, Navigate } from 'react-router-dom';
import ProtectedRoute from '../components/shared/ProtectedRoute';
import Login from '../pages/Auth/Login';
import Signup from '../pages/Auth/Signup';
import Dashboard from '../pages/Dashboard/Dashboard';
import Groups from '../pages/Groups/Groups';
import GroupDetail from '../pages/Groups/GroupDetail';
import Expenses from '../pages/Expenses/Expenses';
import ExpenseForm from '../pages/Expenses/ExpenseForm';
import People from '../pages/People/People';
import Profile from '../pages/Profile/Profile';
import ForgotPassword from '../pages/Auth/ForgotPassword';
import ResetPassword from '../pages/Auth/ResetPassword';

const AppRoutes = () => (
  <Routes>
    <Route path="/login" element={<Login />} />
    <Route path="/signup" element={<Signup />} />
    <Route path="/forgot-password" element={<ForgotPassword />} />
    <Route path="/reset-password" element={<ResetPassword />} />

    <Route path="/dashboard" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
    <Route path="/groups" element={<ProtectedRoute><Groups /></ProtectedRoute>} />
    <Route path="/groups/:id" element={<ProtectedRoute><GroupDetail /></ProtectedRoute>} />
    <Route path="/expenses" element={<ProtectedRoute><Expenses /></ProtectedRoute>} />
    <Route path="/expenses/new" element={<ProtectedRoute><ExpenseForm /></ProtectedRoute>} />
    <Route path="/expenses/edit/:id" element={<ProtectedRoute><ExpenseForm /></ProtectedRoute>} />
    <Route path="/people" element={<ProtectedRoute><People /></ProtectedRoute>} />
    <Route path="/profile" element={<ProtectedRoute><Profile /></ProtectedRoute>} />

    <Route path="/" element={<Navigate to="/dashboard" replace />} />
    <Route path="*" element={<Navigate to="/dashboard" replace />} />
  </Routes>
);

export default AppRoutes;
