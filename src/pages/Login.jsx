import { useState } from 'react';
import { Eye, EyeOff } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import {
  signInWithEmailAndPassword,
  sendPasswordResetEmail
} from 'firebase/auth';

import { auth } from '../services/firebase';
import { useApp } from '../services/AppContext';
import '../styles/auth.css';

export default function Login() {
  const navigate = useNavigate();
  const { showToast } = useApp();
  const [showPassword, setShowPassword] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [resetting, setResetting] = useState(false);

  // Sign in with Firebase Authentication.
  const handleLogin = async event => {
    event.preventDefault();
    if (loading || resetting) return;

    setError('');

    const cleanEmail = email.trim().toLowerCase();

    if (!cleanEmail || !password) {
      setError('Please enter email and password');
      return;
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) {
      setError('Enter a valid email address');
      return;
    }

    try {
      setLoading(true);

      await signInWithEmailAndPassword(
        auth,
        cleanEmail,
        password
      );

      navigate('/home', { replace: true });
    } catch (err) {
      console.error('SCANPRESS LOGIN ERROR:', err);

      const messages = {
        'auth/invalid-credential': 'Incorrect email or password',
        'auth/wrong-password': 'Incorrect email or password',
        'auth/user-not-found': 'Account not found',
        'auth/invalid-email': 'Enter a valid email address',
        'auth/user-disabled': 'This account has been disabled',
        'auth/too-many-requests': 'Too many attempts. Try again later',
        'auth/network-request-failed':
          'Network error. Check your connection'
      };

      setError(
        messages[err?.code] ||
        'Something went wrong. Please try again'
      );
    } finally {
      setLoading(false);
    }
  };

  // Send Firebase password-reset email.
  const handleForgotPassword = async () => {
    if (loading || resetting) return;

    setError('');

    const cleanEmail = email.trim().toLowerCase();

    if (!cleanEmail) {
      setError('Enter your registered email first');
      return;
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) {
      setError('Enter a valid email address');
      return;
    }

    try {
      setResetting(true);

      await sendPasswordResetEmail(
        auth,
        cleanEmail
      );

      showToast('Password reset email sent');
    } catch (err) {
      console.error(
        'SCANPRESS PASSWORD RESET ERROR:',
        err
      );

      if (err?.code === 'auth/user-not-found') {
        setError('Account not found');
      } else {
        setError('Failed to send reset email');
      }
    } finally {
      setResetting(false);
    }
  };

  return (
    <main className="auth-screen">
      <section className="auth-wrap">

        {/* Logo */}
        <div className="auth-logo-row">
          <div className="auth-logo-box">
            <svg
              width="22"
              height="22"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <path d="M6 9V2h12v7" />
              <path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2" />
              <path d="M6 14h12v8H6z" />
            </svg>
          </div>

          <div className="auth-logo-text">
            Scan<em>Press</em>
          </div>
        </div>

        {/* Login form */}
        <form
          className="auth-card"
          onSubmit={handleLogin}
        >
          <h1 className="auth-heading">
            Welcome back
          </h1>

          <p className="auth-sub">
            Sign in to manage your print queue
          </p>

          <div className="field-group">
            <label className="field-label">
              Email
            </label>

            <input
              className={`field${error ? ' err' : ''}`}
              type="email"
              placeholder="Email"
              value={email}
              autoComplete="email"
              onChange={e => {
                setEmail(e.target.value);
                setError('');
              }}
            />
          </div>

          <div className="field-group">
  <label className="field-label">Password</label>

  <div className="password-field">
    <input
      className={`field${error ? ' err' : ''}`}
      type={showPassword ? 'text' : 'password'}
      placeholder="*******"
      value={password}
      autoComplete="current-password"
      onChange={e => {
        setPassword(e.target.value);
        setError('');
      }}
    />

    <button
      type="button"
      className="password-toggle"
      onClick={() => setShowPassword(prev => !prev)}
      aria-label={showPassword ? 'Hide password' : 'Show password'}
    >
      {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
    </button>
  </div>
</div>

          <div className="forgot-row">
            <button
              type="button"
              className="forgot-link"
              onClick={handleForgotPassword}
              disabled={loading || resetting}
            >
              {resetting
                ? 'Sending...'
                : 'Forgot password?'}
            </button>
          </div>

          {error && (
            <div className="err-msg">
              {error}
            </div>
          )}

          <button
            type="submit"
            className="btn-primary"
            disabled={loading || resetting}
          >
            {loading
              ? 'Signing In...'
              : 'Sign In'}
          </button>

          <div className="auth-footer">
            New here?{' '}

            <button
              type="button"
              className="auth-link-button"
              onClick={() => navigate('/signup')}
            >
              Create account
            </button>
          </div>
        </form>

      </section>
    </main>
  );
}