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
  {/* Public Routes */}
  <Route path="/login" element={<Login />} />
  <Route path="/signup" element={<Signup />} />
  <Route path="/forgot-password" element={<ForgotPassword />} />
  <Route path="/reset-password" element={<ResetPassword />} />

  {/* Protected Routes (Grouped) */}
  <Route element={<ProtectedRoute />}>
    <Route path="/dashboard" element={<Dashboard />} />
    <Route path="/groups" element={<Groups />} />
    <Route path="/groups/:id" element={<GroupDetail />} />
    <Route path="/expenses" element={<Expenses />} />
    <Route path="/expenses/new" element={<ExpenseForm />} />
    <Route path="/expenses/edit/:id" element={<ExpenseForm />} />
    <Route path="/people" element={<People />} />
    <Route path="/profile" element={<Profile />} />
  </Route>

  {/* Wildcard & Redirects */}
  <Route path="/" element={<Navigate to="/dashboard" replace />} />
  <Route path="*" element={<Navigate to="/dashboard" replace />} />
</Routes>
);

export default AppRoutes;
