import { useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import './Profile.css';

type Tab = 'profile' | 'password';

const AVATAR_SEEDS = [
  'Felix',
  'Mia',
  'Leo',
  'Zoe',
  'Kai',
  'Luna',
  'Max',
  'Aria',
];

const Profile = () => {
  const { user, updateProfile, updatePassword } = useAuth();
  const [activeTab, setActiveTab] = useState<Tab>('profile');

  // Profile form
  const [name, setName] = useState(user?.name ?? '');
  const [email, setEmail] = useState(user?.email ?? '');
  const [mobile, setMobile] = useState(user?.mobile ?? '');
  const [avatar, setAvatar] = useState(user?.avatar ?? '');
  const [profileSaving, setProfileSaving] = useState(false);
  const [profileSuccess, setProfileSuccess] = useState('');
  const [profileError, setProfileError] = useState('');

  // Password form
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [passwordSaving, setPasswordSaving] = useState(false);
  const [passwordSuccess, setPasswordSuccess] = useState('');
  const [passwordError, setPasswordError] = useState('');

  const handleProfileSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setProfileError('Name is required');
      return;
    }
    if (!email.trim() && !mobile.trim()) {
      setProfileError('At least one of email or mobile is required');
      return;
    }
    if (mobile && !/^[6-9]\d{9}$/.test(mobile.trim())) {
      setProfileError('Enter a valid 10-digit mobile number');
      return;
    }

    setProfileSaving(true);
    setProfileError('');
    setProfileSuccess('');
    try {
      await updateProfile({
        name: name.trim(),
        ...(email.trim() ? { email: email.trim() } : {}),
        ...(mobile.trim() ? { mobile: mobile.trim() } : {}),
        avatar,
      });
      setProfileSuccess('Profile updated successfully');
    } catch (err) {
      setProfileError(
        err instanceof Error ? err.message : 'Failed to update profile'
      );
    } finally {
      setProfileSaving(false);
    }
  };

  const handlePasswordSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentPassword) {
      setPasswordError('Current password is required');
      return;
    }
    if (newPassword.length < 6) {
      setPasswordError('New password must be at least 6 characters');
      return;
    }
    if (newPassword !== confirmPassword) {
      setPasswordError('Passwords do not match');
      return;
    }

    setPasswordSaving(true);
    setPasswordError('');
    setPasswordSuccess('');
    try {
      await updatePassword(currentPassword, newPassword);
      setPasswordSuccess(
        'Password updated. Other devices have been logged out.'
      );
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
    } catch (err) {
      setPasswordError(
        err instanceof Error ? err.message : 'Failed to update password'
      );
    } finally {
      setPasswordSaving(false);
    }
  };

  const pickAvatar = (seed: string) => {
    setAvatar(
      `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(
        seed
      )}`
    );
  };

  return (
    <div className="page-content">
      <div className="page-header">
        <div>
          <h1 className="page-title">Profile</h1>
          <p className="page-subtitle">Manage your account details</p>
        </div>
      </div>

      <div className="profile-layout">
        {/* Left: avatar card */}
        <div className="profile-avatar-card card card-body">
          <img
            src={avatar || user?.avatar}
            alt={user?.name}
            className="profile-avatar-img"
          />
          <p className="profile-avatar-name">{user?.name}</p>
          <p className="profile-avatar-contact">
            {user?.email ?? user?.mobile}
          </p>

          <div className="profile-avatar-section">
            <p className="form-label" style={{ marginBottom: 8 }}>
              Choose avatar
            </p>
            <div className="profile-avatar-grid">
              {AVATAR_SEEDS.map((seed) => {
                const url = `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(
                  seed
                )}`;
                return (
                  <button
                    key={seed}
                    type="button"
                    className={`profile-avatar-option ${
                      avatar === url ? 'selected' : ''
                    }`}
                    onClick={() => pickAvatar(seed)}
                    title={seed}
                  >
                    <img src={url} alt={seed} />
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* Right: tabs */}
        <div className="profile-form-card card">
          <div
            className="tabs"
            style={{
              padding: '0 24px',
              borderBottom: '1px solid var(--border)',
            }}
          >
            <button
              className={`tab ${activeTab === 'profile' ? 'tab-active' : ''}`}
              onClick={() => setActiveTab('profile')}
            >
              Personal Info
            </button>
            <button
              className={`tab ${activeTab === 'password' ? 'tab-active' : ''}`}
              onClick={() => setActiveTab('password')}
            >
              Change Password
            </button>
          </div>

          <div className="card-body">
            {activeTab === 'profile' && (
              <form onSubmit={handleProfileSave}>
                <div className="form-group">
                  <label className="form-label">Full Name *</label>
                  <input
                    className="form-control"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Your full name"
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">Email</label>
                  <input
                    className="form-control"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="you@example.com"
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">Mobile Number</label>
                  <input
                    className="form-control"
                    type="tel"
                    value={mobile}
                    onChange={(e) => setMobile(e.target.value)}
                    placeholder="10-digit mobile number"
                  />
                  <p className="form-hint">
                    At least one of email or mobile is required
                  </p>
                </div>

                {profileError && <p className="form-error">{profileError}</p>}
                {profileSuccess && (
                  <p className="form-success">{profileSuccess}</p>
                )}

                <button
                  className="btn btn-primary"
                  type="submit"
                  disabled={profileSaving}
                >
                  {profileSaving ? 'Saving…' : 'Save Changes'}
                </button>
              </form>
            )}

            {activeTab === 'password' && (
              <form onSubmit={handlePasswordSave}>
                <div className="form-group">
                  <label className="form-label">Current Password *</label>
                  <input
                    className="form-control"
                    type="password"
                    value={currentPassword}
                    onChange={(e) => setCurrentPassword(e.target.value)}
                    placeholder="••••••••"
                    autoComplete="current-password"
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">New Password *</label>
                  <input
                    className="form-control"
                    type="password"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="Min. 6 characters"
                    autoComplete="new-password"
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">Confirm New Password *</label>
                  <input
                    className="form-control"
                    type="password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="••••••••"
                    autoComplete="new-password"
                  />
                </div>

                {passwordError && <p className="form-error">{passwordError}</p>}
                {passwordSuccess && (
                  <p className="form-success">{passwordSuccess}</p>
                )}

                <button
                  className="btn btn-primary"
                  type="submit"
                  disabled={passwordSaving}
                >
                  {passwordSaving ? 'Updating…' : 'Update Password'}
                </button>
              </form>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default Profile;
