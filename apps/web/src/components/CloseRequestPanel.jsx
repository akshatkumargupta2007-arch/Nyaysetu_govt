import React, { useState } from 'react';
import { api } from '../api/client.js';
import { useI18n } from '../i18n/index.jsx';
import { dateTime } from '../lib/format.js';
import { VerifyChip } from './Chips.jsx';

/**
 * Asks the CITIZEN to verify the fix. The button is on only when the server says so (work done, nothing sent in
 * the last 24 h). This panel never closes anything: only the citizen can.
 */
export default function CloseRequestPanel({ ticketId, closeRequest, onSent }) {
  const { t, lang } = useI18n();
  const [asking, setAsking] = useState(false);
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [sent, setSent] = useState(false);
  const c = closeRequest;

  async function send() {
    setBusy(true);
    setError('');
    try {
      await api(`/api/complaints/${ticketId}/close-request`, { method: 'POST', body: note.trim() ? { note: note.trim() } : {} });
      setAsking(false);
      setNote('');
      setSent(true);
      onSent?.();
    } catch (e) {
      setError(t(`close.err.${e.code}`) !== `close.err.${e.code}` ? t(`close.err.${e.code}`) : t('app.error'));
    } finally {
      setBusy(false);
    }
  }

  const disabledText = !c.canRequest
    ? c.reason === 'TOO_SOON'
      ? t('close.disabled.TOO_SOON', { when: dateTime(c.cooldownUntil, lang) })
      : t('close.disabled.NOT_AWAITING_CITIZEN')
    : '';

  return (
    <section className={`cr ${c.canRequest ? 'cr--active' : ''}`} aria-label={t('close.title')}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <strong style={{ color: 'var(--navy)' }}>{t('close.title')}</strong>
        <span style={{ flex: 1 }} />
        <VerifyChip status={c.status} />
      </div>
      <p className="note" style={{ margin: 0 }}>{t('close.help')}</p>
      {c.reopenCount > 0 && <div className="chip chip--red" style={{ alignSelf: 'flex-start' }}>{t('close.reopenCount', { n: c.reopenCount })}</div>}
      {sent && <div className="ok" role="status">{t('close.sent')}</div>}
      <div>
        <button type="button" className="btn btn--primary" disabled={!c.canRequest || sent} onClick={() => { setError(''); setAsking(true); }}>{t('close.button')}</button>
      </div>
      {disabledText && <div className="note">{disabledText}</div>}
      {c.history?.length > 0 && (
        <div>
          <div className="note" style={{ fontWeight: 600 }}>{t('close.history')}</div>
          <ul style={{ margin: '4px 0 0', paddingLeft: 18 }}>
            {c.history.map((h, i) => (
              <li key={i}>
                {dateTime(h.at, lang)}{h.official ? ` ${t('close.by', { name: h.official })}` : ''}{h.note ? `: “${h.note}”` : ''}
              </li>
            ))}
          </ul>
        </div>
      )}
      {asking && (
        <>
          <div className="scrim" onClick={() => !busy && setAsking(false)} />
          <div className="modal" role="dialog" aria-modal="true" aria-label={t('close.title')}>
            <h2>{t('close.title')}</h2>
            <p style={{ margin: 0 }}>{t('close.help')}</p>
            <label className="field">
              <span>{t('close.note')}</span>
              <textarea value={note} maxLength={300} onChange={(e) => setNote(e.target.value)} autoFocus />
              <span style={{ alignSelf: 'flex-end' }}>{t('close.noteHint', { n: note.length })}</span>
            </label>
            {error && <div className="err" role="alert">{error}</div>}
            <div className="modal__actions">
              <button type="button" className="btn" disabled={busy} onClick={() => setAsking(false)}>{t('app.cancel')}</button>
              <button type="button" className="btn btn--primary" disabled={busy} onClick={send}>{t('close.send')}</button>
            </div>
          </div>
        </>
      )}
    </section>
  );
}
