import { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import * as authService from '../services/authService';
import Spinner from '../components/Spinner';

export default function ResetPassword() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const email = params.get('email') || '';
  const token = params.get('token') || '';

  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  if (!email || !token) {
    return (
      <div className="auth-shell">
        <div className="card" style={{ maxWidth: 420 }}>
          <h2>Invalid reset link</h2>
          <p>This password reset link is missing required information.</p>
          <Link to="/forgot-password" className="btn btn-primary">
            Request a new link
          </Link>
        </div>
      </div>
    );
  }

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    if (newPassword !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }
    setSubmitting(true);
    try {
      await authService.resetPassword(email, token, newPassword);
      navigate('/login', { replace: true, state: { passwordReset: true } });
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="auth-shell">
      <div className="auth-card">
        <div className="auth-logo">
          <span className="dot" /> Hirevion
        </div>
        <div className="card">
          <h2>Reset your password</h2>
          {error && <div className="alert alert-error">{error}</div>}
          <form onSubmit={handleSubmit}>
            <div className="field">
              <label>New password</label>
              <input type="password" required value={newPassword} onChange={(e) => setNewPassword(e.target.value)} />
              <div className="hint">At least 8 characters, with uppercase, lowercase, a number, and a special character.</div>
            </div>
            <div className="field">
              <label>Confirm new password</label>
              <input type="password" required value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} />
            </div>
            <button className="btn btn-primary btn-block" type="submit" disabled={submitting}>
              {submitting ? <Spinner /> : 'Reset password'}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
