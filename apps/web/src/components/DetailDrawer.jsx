import React, { useEffect, useState } from 'react';
import { useI18n } from '../i18n/index.jsx';
import { useFetch } from '../lib/hooks.js';
import { dateTime } from '../lib/format.js';
import { Priority, StatusChip } from './Chips.jsx';
import PhoneReveal from './PhoneReveal.jsx';
import CloseRequestPanel from './CloseRequestPanel.jsx';

export default function DetailDrawer({ id, onClose, onChanged }) {
  const { t, pick, lang } = useI18n();
  const { data, loading, error, reload } = useFetch(`/api/complaints/${id}`);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const c = data?.complaint;
  async function copy() {
    try { await navigator.clipboard.writeText(c.code); setCopied(true); setTimeout(() => setCopied(false), 1500); } catch { /* clipboard blocked */ }
  }

  return (
    <>
      <div className="scrim" onClick={onClose} />
      <aside className="drawer" role="dialog" aria-modal="true" aria-label={t('detail.title')}>
        <div className="drawer__head">
          <div style={{ flex: 1, minWidth: 0 }}>
            {c ? (
              <>
                <h2>
                  <span className="code" style={{ fontFamily: 'ui-monospace, Menlo, monospace' }}>{c.code}</span>{' '}
                  <button type="button" className="btn btn--sm" onClick={copy}>{copied ? t('app.copied') : t('app.copy')}</button>
                </h2>
                <div style={{ marginTop: 6, display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                  <StatusChip status={c.status} />
                  <Priority band={c.priority} breached={c.slaBreached} />
                  {c.escalationLevel > 0 && <span className="chip chip--amber">{t('detail.escalation', { n: c.escalationLevel })}</span>}
                  {c.reportCount > 1 && <span className="chip chip--grey">{t('detail.reports', { n: c.reportCount })}</span>}
                </div>
              </>
            ) : <h2>{t('detail.title')}</h2>}
          </div>
          <button type="button" className="iconbtn" onClick={onClose} aria-label={t('app.close')}>✕</button>
        </div>

        <div className="drawer__body">
          {loading && !data && <div className="empty">{t('app.loading')}</div>}
          {error && <div className="err" role="alert">{error.status === 404 ? t('detail.notFound') : t('app.error')}</div>}
          {c && (
            <>
              <section>
                <h3>{t('detail.summary')}</h3>
                <p style={{ margin: 0 }}>{c.summary}</p>
                <dl className="kv" style={{ marginTop: 10 }}>
                  <dt>{t('col.category')}</dt><dd>{pick(c.category.names)} <span className="sub" style={{ color: 'var(--ink-3)' }}>({pick(c.category.l1Names)})</span></dd>
                  <dt>{t('col.department')}</dt><dd>{c.department ? pick(c.department.agency) : '–'}</dd>
                  <dt>{t('detail.location')}</dt>
                  <dd>
                    {[pick(c.location.state.name), pick(c.location.district.name), pick(c.location.city.name), c.location.area ? pick(c.location.area.name) : null].filter(Boolean).join(' › ')}
                    <div className="note">{c.location.lat.toFixed(5)}, {c.location.lng.toFixed(5)} · {t('detail.approx')}{c.location.area?.approximate ? ` · ${t('map.approxArea')}` : ''}</div>
                  </dd>
                  <dt>{t('detail.sla')}</dt><dd>{dateTime(c.slaDueAt, lang)}</dd>
                  <dt>{t('col.age')}</dt><dd>{dateTime(c.createdAt, lang)}</dd>
                </dl>
              </section>

              {c.originalText && (
                <section>
                  <h3>{t('detail.original')} {c.originalLang && <span className="chip chip--grey" lang="en">{c.originalLang}</span>}</h3>
                  <div className="quote" lang={c.originalLang || undefined}>{c.originalText}</div>
                </section>
              )}

              <section>
                <h3>{t('detail.reporters')}</h3>
                {c.reporters.length === 0 && <span className="note">–</span>}
                {c.reporters.map((r) => (
                  <div className="reporter" key={r.index}>
                    <span className="note" style={{ minWidth: 90 }}>{t('phone.reporter', { n: r.index + 1 })}</span>
                    {r.phoneAvailable
                      ? <PhoneReveal ticketId={c.id} masked={r.phoneMasked} reporterIndex={r.index} />
                      : <span className="note">{t('phone.erased')}</span>}
                  </div>
                ))}
              </section>

              <CloseRequestPanel
                ticketId={c.id}
                closeRequest={data.closeRequest}
                onSent={() => { reload(); onChanged?.(); }}
              />

              <section>
                <h3>{t('detail.timeline')}</h3>
                <ol className="tl">
                  {data.timeline.map((e) => (
                    <li key={e.seq}>
                      <div>
                        <strong>{e.toState && e.toState !== e.fromState ? t(`status.${e.toState}`) : e.type.replace(/_/g, ' ').toLowerCase()}</strong>
                        {e.type === 'CLOSE_REQUESTED_BY_GOV' && <span> · {t('close.title')}{e.official ? ` (${t('close.by', { name: e.official })})` : ''}{e.note ? `: “${e.note}”` : ''}</span>}
                        <div className="when">{dateTime(e.at, lang)} · {e.actor || ''}</div>
                      </div>
                    </li>
                  ))}
                </ol>
              </section>
            </>
          )}
        </div>
      </aside>
    </>
  );
}
