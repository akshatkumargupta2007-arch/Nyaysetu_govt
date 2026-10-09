import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../auth.jsx';
import { useI18n } from '../i18n/index.jsx';
import LangSwitch from '../components/LangSwitch.jsx';

export default function Login() {
  const { signIn } = useAuth();
  const { t } = useI18n();
  const nav = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function submit(e) {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    setError('');
    try {
      await signIn(email.trim(), password);
      nav('/', { replace: true });
    } catch (err) {
      if (err.code === 'LOCKED') setError(t('login.locked', { minutes: Math.max(1, Math.ceil((err.body.retryAfterSeconds || 900) / 60)) }));
      else if (err.status === 401) setError(t('login.wrong'));
      else setError(t('app.error'));
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="login">
      <form className="login__card" onSubmit={submit} noValidate>
        <div className="login__bar">
          <strong style={{ color: 'var(--navy)' }}>{t('app.name')}</strong>
          <LangSwitch />
        </div>
        <h1>{t('login.title')}</h1>
        {error && <div className="err" role="alert">{error}</div>}
        <label className="field">
          <span>{t('login.email')}</span>
          <input type="email" autoComplete="username" value={email} onChange={(e) => setEmail(e.target.value)} required autoFocus />
        </label>
        <label className="field">
          <span>{t('login.password')}</span>
          <input type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} required />
        </label>
        <button className="btn btn--primary" style={{ height: 40 }} disabled={busy || !email || !password}>{t('login.submit')}</button>
        <p className="note">{t('login.note')}</p>
        <p className="note">{t('app.prototype')}</p>
      </form>
    </main>
  );
}
