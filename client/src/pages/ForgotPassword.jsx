import { useState } from 'react';
import { Link } from 'react-router-dom';
import * as authService from '../services/authService';
import Spinner from '../components/Spinner';

export default function ForgotPassword() {
  const [email, setEmail] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [sent, setSent] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSubmitting(true);
    try {
      await authService.forgotPassword(email);
      setSent(true);
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
          <h2>Forgot password</h2>
          {sent ? (
            <p>If an account with that email exists, a password reset link has been sent. Check your inbox.</p>
          ) : (
            <>
              <p>Enter your account email and we&apos;ll send you a link to reset your password.</p>
              {error && <div className="alert alert-error">{error}</div>}
              <form onSubmit={handleSubmit}>
                <div className="field">
                  <label htmlFor="email">Email</label>
                  <input id="email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
                </div>
                <button className="btn btn-primary btn-block" type="submit" disabled={submitting}>
                  {submitting ? <Spinner /> : 'Send reset link'}
                </button>
              </form>
            </>
          )}
        </div>
        <div className="auth-footer-link">
          <Link to="/login">Back to login</Link>
        </div>
      </div>
    </div>
  );
}
