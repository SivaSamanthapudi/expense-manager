import { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { authService, parseApiError } from '../../services/authService';
import './Auth.css';

const ResetPassword = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const prefillIdentifier = searchParams.get('identifier') ?? '';

  const [identifier, setIdentifier] = useState(prefillIdentifier);
  const [otp, setOtp] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!identifier.trim()) {
      setError('Email or mobile is required');
      return;
    }
    if (otp.trim().length !== 6) {
      setError('Enter the 6-digit code');
      return;
    }
    if (newPassword.length < 6) {
      setError('Password must be at least 6 characters');
      return;
    }
    if (newPassword !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }

    setLoading(true);
    setError('');
    try {
      await authService.resetPassword(
        identifier.trim(),
        otp.trim(),
        newPassword
      );
      setSuccess(true);
    } catch (err) {
      setError(parseApiError(err));
    } finally {
      setLoading(false);
    }
  };

  if (success) {
    return (
      <div className="auth-page">
        <div className="auth-card">
          <div className="auth-logo">
            <span>💸</span>
            <h1>SplitWise</h1>
          </div>
          <div className="forgot-sent-state">
            <div className="forgot-sent-icon">✅</div>
            <h2 className="forgot-sent-title">Password reset!</h2>
            <p className="text-sm text-muted" style={{ marginBottom: 24 }}>
              Your password has been updated. You can now sign in with your new
              password.
            </p>
            <button
              className="btn btn-primary w-full auth-submit"
              onClick={() => navigate('/login')}
            >
              Go to Sign In
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="auth-page">
      <div className="auth-card">
        <div className="auth-logo">
          <span>💸</span>
          <h1>SplitWise</h1>
        </div>
        <p className="auth-tagline">Set a new password</p>

        <form onSubmit={handleSubmit} className="auth-form">
          {!prefillIdentifier && (
            <div className="form-group">
              <label className="form-label">Email or Mobile Number</label>
              <input
                className="form-control"
                type="text"
                placeholder="you@example.com or 9876543210"
                value={identifier}
                onChange={(e) => setIdentifier(e.target.value)}
              />
            </div>
          )}

          <div className="form-group">
            <label className="form-label">6-Digit Reset Code</label>
            <input
              className="form-control otp-input"
              type="text"
              inputMode="numeric"
              maxLength={6}
              placeholder="______"
              value={otp}
              onChange={(e) => setOtp(e.target.value.replace(/\D/g, ''))}
              autoFocus={!!prefillIdentifier}
            />
          </div>

          <div className="form-group">
            <label className="form-label">New Password</label>
            <input
              className="form-control"
              type="password"
              placeholder="Min. 6 characters"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              autoComplete="new-password"
            />
          </div>

          <div className="form-group">
            <label className="form-label">Confirm New Password</label>
            <input
              className="form-control"
              type="password"
              placeholder="••••••••"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              autoComplete="new-password"
            />
          </div>

          {error && <p className="form-error">{error}</p>}

          <button
            className="btn btn-primary w-full auth-submit"
            type="submit"
            disabled={loading}
          >
            {loading ? 'Resetting…' : 'Reset Password'}
          </button>
        </form>

        <p className="auth-switch" style={{ marginTop: 16 }}>
          <Link to="/forgot-password">Resend code</Link>
          {' · '}
          <Link to="/login">Sign In</Link>
        </p>
      </div>
    </div>
  );
};

export default ResetPassword;
