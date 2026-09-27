import { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import Spinner from '../components/Spinner';

export default function Login() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSubmitting(true);
    try {
      // Read the form's actual current values instead of trusting only the
      // React state variables: some browsers/password managers fill the
      // fields (autofill, or a very fast paste-and-submit) without firing
      // a React-visible input event first, which left `email`/`password`
      // stale (often empty) even though the fields looked correctly
      // filled on screen — causing the first submit to fail with a wrong
      // password and only a manual retype-and-resubmit to work.
      const formValues = new FormData(e.currentTarget);
      const submittedEmail = String(formValues.get('email') || email).trim();
      const submittedPassword = String(formValues.get('password') || password);

      const user = await login(submittedEmail, submittedPassword);
      if (user.temporaryPassword) {
        navigate('/change-password', { replace: true });
        return;
      }
      // Only honor "return to where you came from" if that page actually
      // belongs to this user's own role — otherwise a stale redirect target
      // left over from an earlier visit to a different role's route (e.g.
      // another account's dashboard bookmarked/typed in the same browser)
      // would send a correctly-authenticated user to a route ProtectedRoute
      // then bounces out of, which looked like "login failed."
      const requestedFrom = location.state?.from?.pathname;
      const ownDashboard = `/${user.role}/dashboard`;
      const dest = requestedFrom && requestedFrom.startsWith(`/${user.role}/`) ? requestedFrom : ownDashboard;
      navigate(dest, { replace: true });
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
          <h2>Log in</h2>
          {error && <div className="alert alert-error">{error}</div>}
          <form onSubmit={handleSubmit}>
            <div className="field">
              <label htmlFor="email">Email</label>
              <input
                id="email"
                name="email"
                type="email"
                required
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>
            <div className="field">
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <label htmlFor="password">Password</label>
                <Link to="/forgot-password" style={{ fontSize: 12 }}>
                  Forgot password?
                </Link>
              </div>
              <input
                id="password"
                name="password"
                type="password"
                required
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>
            <button className="btn btn-primary btn-block" type="submit" disabled={submitting}>
              {submitting ? <Spinner /> : 'Log in'}
            </button>
          </form>
        </div>
        <div className="auth-footer-link">
          New to Hirevion? <Link to="/register?role=candidate">Create a candidate account</Link> or{' '}
          <Link to="/register?role=recruiter">join as a recruiter</Link>.
        </div>
      </div>
    </div>
  );
}
