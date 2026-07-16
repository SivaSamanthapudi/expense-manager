import { useState } from 'react';
import { Link } from 'react-router-dom';
import { authService, parseApiError } from '../../services/authService';
import './Auth.css';

const ForgotPassword = () => {
  const [identifier, setIdentifier] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [devOtp, setDevOtp] = useState('');
  const [sent, setSent] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!identifier.trim()) {
      setError('Email or mobile number is required');
      return;
    }
    setLoading(true);
    setError('');
    try {
      const result = await authService.forgotPassword(identifier.trim());
      setSent(true);
      if (result.devOtp) setDevOtp(result.devOtp);
    } catch (err) {
      setError(parseApiError(err));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-page">
      <div className="auth-card">
        <div className="auth-logo">
          <span>💸</span>
          <h1>SplitWise</h1>
        </div>

        {!sent ? (
          <>
            <p className="auth-tagline">Reset your password</p>
            <p className="text-sm text-muted" style={{ marginBottom: 24 }}>
              Enter your registered email or mobile number and we'll send you a
              reset code.
            </p>

            <form onSubmit={handleSubmit} className="auth-form">
              <div className="form-group">
                <label className="form-label">Email or Mobile Number</label>
                <input
                  className="form-control"
                  type="text"
                  placeholder="you@example.com or 9876543210"
                  value={identifier}
                  onChange={(e) => setIdentifier(e.target.value)}
                  autoFocus
                />
              </div>

              {error && <p className="form-error">{error}</p>}

              <button
                className="btn btn-primary w-full auth-submit"
                type="submit"
                disabled={loading}
              >
                {loading ? 'Sending…' : 'Send Reset Code'}
              </button>
            </form>
          </>
        ) : (
          <div className="forgot-sent-state">
            <div className="forgot-sent-icon">📬</div>
            <h2 className="forgot-sent-title">Reset code sent!</h2>
            <p className="text-sm text-muted" style={{ marginBottom: 16 }}>
              If an account exists for <strong>{identifier}</strong>, a 6-digit
              code has been sent. Enter it on the next page to set a new
              password.
            </p>

            {devOtp && (
              <div className="dev-otp-box">
                <p className="text-xs text-muted" style={{ marginBottom: 4 }}>
                  Development mode — OTP:
                </p>
                <p className="dev-otp-code">{devOtp}</p>
              </div>
            )}

            <Link
              to={`/reset-password?identifier=${encodeURIComponent(
                identifier
              )}`}
              className="btn btn-primary w-full auth-submit"
              style={{ display: 'block', textAlign: 'center', marginTop: 16 }}
            >
              Enter Reset Code →
            </Link>
          </div>
        )}

        <p className="auth-switch" style={{ marginTop: 20 }}>
          <Link to="/login">← Back to Sign In</Link>
        </p>
      </div>
    </div>
  );
};

export default ForgotPassword;
