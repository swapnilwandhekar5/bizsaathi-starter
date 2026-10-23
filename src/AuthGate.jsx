import React, { useEffect, useState } from 'react';
import { supabase } from './lib/supabase.js';

export default function AuthGate({ children }) {
  const [session, setSession] = useState(null);
  const [loading, setLoading] = useState(true);
  const [mode, setMode] = useState('login');
  const [email, setEmail] = useState('');
  const [businessName, setBusinessName] = useState('');
  const [password, setPassword] = useState('');
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let active = true;

    supabase.auth.getSession().then(({ data, error }) => {
      if (!active) return;
      if (error) setMessage(error.message);
      setSession(data?.session ?? null);
      setLoading(false);
    });

    const { data: listener } = supabase.auth.onAuthStateChange(
      (_event, nextSession) => setSession(nextSession)
    );

    return () => {
      active = false;
      listener.subscription.unsubscribe();
    };
  }, []);

  async function submit(event) {
    event.preventDefault();
    setMessage('');
    setBusy(true);

    try {
      if (mode === 'signup') {
        const { data, error } = await supabase.auth.signUp({
          email: email.trim(),
          password,
          options: {
            data: {
              business_name: businessName.trim()
            }
          }
        });
        if (error) throw error;

        if (data.session) {
          const { error: businessError } = await supabase.rpc('create_business_for_current_user', { p_name: businessName.trim() });
          if (businessError) throw businessError;
          setMessage('Account created successfully.');
        } else {
          setMessage('Account request received. Check your email to confirm signup, then log in.');
          setMode('login');
        }
      } else {
        const { error } = await supabase.auth.signInWithPassword({
          email: email.trim(),
          password
        });
        if (error) throw error;
      }
    } catch (error) {
      setMessage(error.message || 'Something went wrong.');
    } finally {
      setBusy(false);
    }
  }

  async function logout() {
    const { error } = await supabase.auth.signOut();
    if (error) setMessage(error.message);
  }

  if (loading) {
    return <div style={styles.center}>Checking your account…</div>;
  }

  if (session) {
    return (
      <div>
        <div style={styles.accountBar}>
          <span>Signed in: {session.user.email}</span>
          <button style={styles.logout} onClick={logout}>Log out</button>
        </div>
        {children}
      </div>
    );
  }

  return (
    <div style={styles.page}>
      <form onSubmit={submit} style={styles.card}>
        <div style={styles.logo}>B</div>
        <h1 style={styles.title}>BizSaathi</h1>
        <p style={styles.subtitle}>Business management workspace</p>
        <h2>{mode === 'login' ? 'Welcome back' : 'Create your account'}</h2>

        {mode === 'signup' && (<><label style={styles.label}>Business Name</label><input style={styles.input} type="text" required value={businessName} onChange={e => setBusinessName(e.target.value)} placeholder="Your shop or company name" /></>)} 
        <label style={styles.label}>Email address</label>
        <input
          style={styles.input}
          type="email"
          autoComplete="email"
          required
          value={email}
          onChange={e => setEmail(e.target.value)}
          placeholder="you@example.com"
        />

        <label style={styles.label}>Password</label>
        <input
          style={styles.input}
          type="password"
          autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
          minLength={6}
          required
          value={password}
          onChange={e => setPassword(e.target.value)}
          placeholder="At least 6 characters"
        />

        <button style={styles.submit} type="submit" disabled={busy}>
          {busy ? 'Please wait…' : mode === 'login' ? 'Log in' : 'Sign up'}
        </button>

        {message && <p role="status" style={styles.message}>{message}</p>}

        <p style={styles.switchText}>
          {mode === 'login' ? 'New to BizSaathi?' : 'Already have an account?'}{' '}
          <button
            type="button"
            style={styles.link}
            onClick={() => {
              setMessage('');
              setMode(mode === 'login' ? 'signup' : 'login');
            }}
          >
            {mode === 'login' ? 'Create account' : 'Log in'}
          </button>
        </p>
      </form>
    </div>
  );
}

const styles = {
  page: {
    minHeight: '100vh', display: 'grid', placeItems: 'center',
    background: '#f4f7f4', padding: 20, fontFamily: 'Arial, sans-serif'
  },
  card: {
    width: '100%', maxWidth: 400, boxSizing: 'border-box',
    background: '#fff', border: '1px solid #e1e9e2', borderRadius: 18,
    padding: 30, boxShadow: '0 12px 40px #163b2b12'
  },
  logo: {
    width: 42, height: 42, borderRadius: 12, background: '#d9f77b',
    color: '#143c2d', display: 'grid', placeItems: 'center',
    fontSize: 24, fontWeight: 800
  },
  title: { marginBottom: 4, color: '#143c2d' },
  subtitle: { color: '#6b7d73', marginTop: 0, marginBottom: 28 },
  label: { display: 'block', marginTop: 16, marginBottom: 7, fontSize: 14 },
  input: {
    width: '100%', boxSizing: 'border-box', padding: 12,
    border: '1px solid #ccd8cf', borderRadius: 9, fontSize: 15
  },
  submit: {
    width: '100%', padding: 13, marginTop: 22, border: 0,
    borderRadius: 9, background: '#143c2d', color: '#fff',
    fontWeight: 700, cursor: 'pointer'
  },
  message: {
    padding: 10, borderRadius: 8, background: '#f1f6e8',
    color: '#244b35', overflowWrap: 'anywhere'
  },
  switchText: { marginTop: 20, fontSize: 14, color: '#58685f' },
  link: {
    background: 'none', border: 0, color: '#176c48',
    textDecoration: 'underline', cursor: 'pointer'
  },
  center: { padding: 40, fontFamily: 'Arial, sans-serif' },
  accountBar: {
    position: 'sticky',
    top: 0,
    zIndex: 10000,
    display: 'flex',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 12,
    padding: '12px 20px',
    background: '#143c2d',
    color: '#ffffff',
    borderBottom: '2px solid #d9f77b',
    fontSize: 13,
    boxSizing: 'border-box',
    width: '100%'
  },
  logout: {
    border: '1px solid #d9f77b',
    borderRadius: 8,
    padding: '9px 16px',
    background: '#d9f77b',
    color: '#143c2d',
    fontWeight: 700,
    cursor: 'pointer',
    flexShrink: 0
  }
};




