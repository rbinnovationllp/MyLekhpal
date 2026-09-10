import { useEffect, useState } from 'react';
import type { Session } from '@supabase/supabase-js';
import { supabase } from './supabase';
import Workspace from '../app/workspace/workspace';

export default function Account() {
  const requestedRole = new URLSearchParams(window.location.search).get('role');
  const [session, setSession] = useState<Session | null>(null);
  const [ready, setReady] = useState(false);
  const [mode, setMode] = useState<'signin' | 'signup' | 'reset' | 'update'>('signin');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  useEffect(() => {
    let mounted = true;
    supabase.auth.getSession().then(({ data, error }) => {
      if (!mounted) return;
      setSession(data.session); setReady(true);
      if (error) setError(error.message);
    });
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, next) => {
      setSession(next); setReady(true);
      if (event === 'PASSWORD_RECOVERY') setMode('update');
    });
    return () => { mounted = false; subscription.unsubscribe(); };
  }, []);
  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault(); setBusy(true); setError(''); setNotice('');
    const form = new FormData(event.currentTarget);
    const email = String(form.get('email') || '').trim();
    const password = String(form.get('password') || '');
    try {
      const redirectTo = `${window.location.origin}/workspace`;
      if (mode === 'reset') {
        const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo });
        if (error) throw error;
        setNotice('If this email has an account, a password reset link will arrive shortly.');
      } else if (mode === 'update') {
        const { error } = await supabase.auth.updateUser({ password });
        if (error) throw error;
        setMode('signin');
      } else if (mode === 'signup') {
        const allowed = ['owner', 'ca_partner', 'accountant'];
        const role = allowed.includes(requestedRole || '') ? requestedRole : undefined;
        const { data, error } = await supabase.auth.signUp({ email, password, options: { emailRedirectTo: redirectTo, data: role ? { requested_role: role } : {} } });
        if (error) throw error;
        if (!data.session) setNotice('Check your email to confirm your account, then sign in.');
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
      }
    } catch (e) { setError(e instanceof Error ? e.message : 'Please try again.'); }
    finally { setBusy(false); }
  }
  if (!ready) return <main className="wrap"><p role="status">Loading your account…</p></main>;
  if (session && mode !== 'update') return <>
    <div className="wrap" style={{ display: 'flex', justifyContent: 'flex-end', paddingTop: 12 }}>
      <button className="button small" onClick={async () => {
        const { error } = await supabase.auth.signOut({ scope: 'local' });
        if (error) setError(error.message);
      }}>Sign out</button>
      {error && <p role="alert">{error}</p>}
    </div>
    <Workspace key={session.user.id} user={session.user.email || 'Your account'} />
  </>;
  const roleLabel = requestedRole === 'owner' ? 'Business Owner' : requestedRole === 'ca_partner' ? 'Chartered Accountant' : requestedRole === 'accountant' ? 'Accountant / Bookkeeper' : '';
  const title = mode === 'signup' ? `Create your ${roleLabel || 'Mylekhpal'} account` : mode === 'reset' ? 'Reset your password' : mode === 'update' ? 'Choose a new password' : roleLabel ? `Sign in as ${roleLabel}` : 'Sign in to Mylekhpal';
  return <main className="wrap" style={{ maxWidth: 520, paddingTop: 60, paddingBottom: 60 }}>
    <a href="/" className="brand">mylekhpal<span className="brand-dot">.</span></a>
    <h1 style={{ fontSize: '2rem', marginTop: 32 }}>{title}</h1>
    <form onSubmit={submit} style={{ display: 'grid', gap: 18, marginTop: 24 }}>
      {mode !== 'update' && <label>Email address<input name="email" type="email" autoComplete="email" required style={{ width: '100%' }} /></label>}
      {mode !== 'reset' && <label>Password<input name="password" type="password" minLength={8} maxLength={128} autoComplete={mode === 'signin' ? 'current-password' : 'new-password'} required style={{ width: '100%' }} /></label>}
      {error && <p role="alert" className="error">{error}</p>}
      {notice && <p role="status" className="success">{notice}</p>}
      <button className="button" disabled={busy}>{busy ? 'Please wait…' : title}</button>
    </form>
    {mode !== 'update' && <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', marginTop: 24 }}>
      {(['signin', 'signup', 'reset'] as const).filter(item => item !== mode).map(item => <button key={item} className="button small" onClick={() => { setMode(item); setError(''); setNotice(''); }}>{item === 'signin' ? 'Sign in' : item === 'signup' ? 'Create account' : 'Forgot password?'}</button>)}
    </div>}
  </main>;
}
