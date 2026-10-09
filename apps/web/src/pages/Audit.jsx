import React, { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api, qs } from '../api/client.js';
import { useI18n } from '../i18n/index.jsx';
import { dateTime } from '../lib/format.js';
import Header from '../components/Header.jsx';

/** Accountability for national officials: who looked at which phone number, every sensitive action, and an integrity check. */
function usePaged(path) {
  const [items, setItems] = useState([]);
  const [next, setNext] = useState(null);
  const [state, setState] = useState('loading'); // loading | ready | error
  const load = useCallback(async (before) => {
    setState('loading');
    try {
      const r = await api(`${path}${qs({ limit: 50, before })}`);
      setItems((prev) => (before ? [...prev, ...r.items] : r.items));
      setNext(r.next);
      setState('ready');
    } catch { setState('error'); }
  }, [path]);
  useEffect(() => { load(null); }, [load]);
  return { items, next, state, more: () => load(next) };
}

export default function Audit() {
  const { t, lang } = useI18n();
  const [tab, setTab] = useState('reveals');
  const reveals = usePaged('/api/audit/reveals');
  const log = usePaged('/api/audit/log');
  const [integrity, setIntegrity] = useState(null);
  const cur = tab === 'reveals' ? reveals : log;

  async function check() {
    try { setIntegrity(await api('/api/audit/verify')); } catch { setIntegrity({ error: true }); }
  }

  return (
    <div className="page">
      <Header />
      <main className="page__body" style={{ overflow: 'auto' }}>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
          <Link to="/" className="btn" style={{ display: 'inline-flex', alignItems: 'center', textDecoration: 'none' }}>← {t('nav.dashboard')}</Link>
          <h1 style={{ margin: 0, fontSize: 20, color: 'var(--navy)' }}>{t('audit.title')}</h1>
          <span style={{ flex: 1 }} />
          <button type="button" className="btn" onClick={check}>{t('audit.verify')}</button>
        </div>
        {integrity && (
          integrity.error ? <div className="err" role="alert">{t('app.error')}</div>
            : integrity.intact ? <div className="ok" role="status">{t('audit.intact')}</div>
              : <div className="err" role="alert">{t('audit.broken', { id: integrity.brokenAtId })}</div>
        )}
        <div className="langsw" role="group" style={{ alignSelf: 'flex-start', borderColor: 'var(--line)' }}>
          <button type="button" aria-pressed={tab === 'reveals'} style={{ color: tab === 'reveals' ? undefined : 'var(--ink)' }} onClick={() => setTab('reveals')}>{t('audit.reveals')}</button>
          <button type="button" aria-pressed={tab === 'log'} style={{ color: tab === 'log' ? undefined : 'var(--ink)' }} onClick={() => setTab('log')}>{t('audit.actions')}</button>
        </div>
        <section className="panel" style={{ flex: 'none' }}>
          <div className="panel__body">
            <table className="tbl">
              <thead>
                <tr>
                  <th scope="col">{t('audit.when')}</th>
                  <th scope="col">{t('audit.who')}</th>
                  {tab === 'reveals'
                    ? (<><th scope="col">{t('col.id')}</th><th scope="col">{t('audit.reason')}</th></>)
                    : (<><th scope="col">{t('audit.what')}</th><th scope="col">{t('audit.target')}</th></>)}
                </tr>
              </thead>
              <tbody>
                {cur.items.map((r) => (
                  <tr key={r.id}>
                    <td style={{ whiteSpace: 'nowrap' }}>{dateTime(r.at, lang)}</td>
                    <td>{r.userName || r.userId || '–'}</td>
                    {tab === 'reveals'
                      ? (<><td className="code">{r.code}</td><td>{r.reason || '–'}</td></>)
                      : (<><td>{r.action}</td><td className="code">{r.target || '–'}</td></>)}
                  </tr>
                ))}
              </tbody>
            </table>
            {cur.state === 'loading' && <div className="empty">{t('app.loading')}</div>}
            {cur.state === 'error' && <div className="empty">{t('app.error')}</div>}
            {cur.state === 'ready' && cur.items.length === 0 && <div className="empty">{t('audit.nothing')}</div>}
            {cur.next && cur.state === 'ready' && <div className="more"><button type="button" className="btn" onClick={cur.more}>{t('table.more')}</button></div>}
          </div>
        </section>
      </main>
      <footer className="foot">{t('app.prototype')}</footer>
    </div>
  );
}
