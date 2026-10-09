import React, { useEffect, useRef, useState } from 'react';
import { api } from '../api/client.js';
import { useI18n } from '../i18n/index.jsx';

/** Shows a masked number; "Show number" asks for confirmation (the view is logged), then reveals it for 30 s. */
export default function PhoneReveal({ ticketId, masked, reporterIndex = 0, compact = false }) {
  const { t } = useI18n();
  const [asking, setAsking] = useState(false);
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  const [number, setNumber] = useState('');
  const [error, setError] = useState('');
  const timer = useRef(null);

  useEffect(() => () => clearTimeout(timer.current), []);
  useEffect(() => { setNumber(''); setError(''); }, [ticketId, reporterIndex]); // never carry a number over to another complaint

  async function reveal() {
    setBusy(true);
    setError('');
    try {
      const r = await api(`/api/complaints/${ticketId}/reveal-phone`, { method: 'POST', body: { reporterIndex, reason: reason.trim() || undefined } });
      setNumber(r.phone);
      setAsking(false);
      setReason('');
      clearTimeout(timer.current);
      timer.current = setTimeout(() => setNumber(''), 30_000);
    } catch (e) {
      setError(e.code === 'PHONE_ERASED' ? t('phone.erased') : e.code === 'REVEAL_LIMIT' ? t('phone.limit') : t('app.error'));
      setAsking(false);
    } finally {
      setBusy(false);
    }
  }

  return (
    <span className="phone" onClick={(e) => e.stopPropagation()}>
      {number ? (
        <>
          <a href={`tel:${number}`} style={{ fontWeight: 600 }}>{number}</a>{' '}
          <button type="button" className="btn btn--sm" onClick={() => setNumber('')}>{t('phone.hide')}</button>
        </>
      ) : (
        <>
          <span aria-label="masked number">{masked || '–'}</span>{' '}
          {masked && (
            <button type="button" className="btn btn--sm" onClick={() => setAsking(true)}>{compact ? '👁' : t('phone.show')}</button>
          )}
        </>
      )}
      {error && <div className="err" role="alert" style={{ marginTop: 4 }}>{error}</div>}
      {asking && (
        <>
          <div className="scrim" onClick={() => setAsking(false)} />
          <div className="modal" role="dialog" aria-modal="true" aria-label={t('phone.show')}>
            <h2>{t('phone.show')}</h2>
            <p style={{ margin: 0 }}>{t('phone.logWarn')}</p>
            <label className="field">
              <span>{t('phone.reason')}</span>
              <input style={{ maxWidth: 'none' }} value={reason} maxLength={200} onChange={(e) => setReason(e.target.value)} autoFocus />
            </label>
            <div className="modal__actions">
              <button type="button" className="btn" onClick={() => setAsking(false)}>{t('app.cancel')}</button>
              <button type="button" className="btn btn--primary" disabled={busy} onClick={reveal}>{t('app.confirm')}</button>
            </div>
          </div>
        </>
      )}
    </span>
  );
}
