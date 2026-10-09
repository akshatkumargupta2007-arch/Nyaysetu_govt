import React, { useEffect, useState } from 'react';
import { useI18n } from '../i18n/index.jsx';
import { useFetch, qs } from '../lib/hooks.js';
import { PRIORITIES, STATUS_ORDER, VERIFY_STATES } from '../lib/status.js';
import { download } from '../api/client.js';

const GROUPS = ['none', 'state', 'district', 'city', 'area', 'department', 'category_l1'];

function Select({ label, value, onChange, children, className = '' }) {
  return (
    <label className={`field ${className}`}>
      <span>{label}</span>
      <select value={value} onChange={(e) => onChange(e.target.value)}>{children}</select>
    </label>
  );
}

/** Options come from the data itself (only places that have complaints), narrowed by the choices above them. */
function useGroupOptions(groupBy, parents) {
  const { pick } = useI18n();
  const { data } = useFetch(`/api/complaints/groups${qs({ groupBy, ...parents })}`);
  return (data?.groups || []).filter((g) => g.key !== 'none').map((g) => ({ key: g.key, label: pick(g.name), count: g.count }));
}

export default function Filters({ filters, onSet, onSetMany, onClear, active }) {
  const { t, pick } = useI18n();
  const f = filters;
  const states = useFetch('/api/map/states');
  const districts = useGroupOptions('district', { state: f.state });
  const cities = useGroupOptions('city', { state: f.state, district: f.district });
  const areas = useGroupOptions('area', { city: f.city });
  const departments = useGroupOptions('department', { state: f.state, city: f.city });
  const categories = useGroupOptions('category_l1', {});

  // typing in the search box updates the URL after a short pause, not on every key
  const [q, setQ] = useState(f.q);
  useEffect(() => setQ(f.q), [f.q]);
  useEffect(() => {
    if (q === f.q) return undefined;
    const id = setTimeout(() => onSet('q', q.trim()), 350);
    return () => clearTimeout(id);
  }, [q]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <section className="filters" aria-label="Filters">
      <Select className="field--group" label={t('filter.groupBy')} value={f.groupBy} onChange={(v) => onSet('groupBy', v)}>
        {GROUPS.map((g) => <option key={g} value={g}>{t(`group.${g}`)}</option>)}
      </Select>

      <Select label={t('filter.state')} value={f.state} onChange={(v) => onSet('state', v)}>
        <option value="">{t('app.all')}</option>
        {(states.data?.states || []).map((s) => <option key={s.code} value={s.code}>{pick(s.name)}{s.count ? ` (${s.count})` : ''}</option>)}
      </Select>
      <Select label={t('filter.district')} value={f.district} onChange={(v) => onSet('district', v)}>
        <option value="">{t('app.all')}</option>
        {districts.map((o) => <option key={o.key} value={o.key}>{o.label} ({o.count})</option>)}
      </Select>
      <Select label={t('filter.city')} value={f.city} onChange={(v) => onSet('city', v)}>
        <option value="">{t('app.all')}</option>
        {cities.map((o) => <option key={o.key} value={o.key}>{o.label} ({o.count})</option>)}
      </Select>
      <Select label={t('filter.area')} value={f.area} onChange={(v) => onSet('area', v)}>
        <option value="">{t('app.all')}</option>
        {areas.map((o) => <option key={o.key} value={o.key}>{o.label} ({o.count})</option>)}
      </Select>
      <Select label={t('filter.department')} value={f.department} onChange={(v) => onSet('department', v)}>
        <option value="">{t('app.all')}</option>
        {departments.map((o) => <option key={o.key} value={o.key}>{o.label} ({o.count})</option>)}
      </Select>
      <Select label={t('filter.category')} value={f.category_l1} onChange={(v) => onSet('category_l1', v)}>
        <option value="">{t('app.all')}</option>
        {categories.map((o) => <option key={o.key} value={o.key}>{o.label} ({o.count})</option>)}
      </Select>
      <Select label={t('filter.status')} value={f.status} onChange={(v) => onSet('status', v)}>
        <option value="">{t('app.all')}</option>
        <option value="OPEN">{t('filter.open')}</option>
        {STATUS_ORDER.map((s) => <option key={s} value={s}>{t(`status.${s}`)}</option>)}
      </Select>
      <Select label={t('filter.priority')} value={f.priority} onChange={(v) => onSet('priority', v)}>
        <option value="">{t('app.all')}</option>
        {PRIORITIES.map((p) => <option key={p} value={p}>{t(`priority.${p}`)}</option>)}
      </Select>
      <Select label={t('filter.closeRequest')} value={f.close_request_status} onChange={(v) => onSet('close_request_status', v)}>
        <option value="">{t('app.all')}</option>
        {VERIFY_STATES.map((v) => <option key={v} value={v}>{t(`verify.${v}`)}</option>)}
      </Select>
      <label className="field">
        <span>{t('filter.from')}</span>
        <input type="date" value={f.from} max={f.to || undefined} onChange={(e) => onSet('from', e.target.value)} />
      </label>
      <label className="field">
        <span>{t('filter.to')}</span>
        <input type="date" value={f.to} min={f.from || undefined} onChange={(e) => onSet('to', e.target.value)} />
      </label>
      <label className="field field--search">
        <span>{t('filter.search')}</span>
        <input type="search" value={q} placeholder="BHI-26-… / 3221" onChange={(e) => setQ(e.target.value)} />
      </label>
      {active && <button type="button" className="btn" onClick={onClear}>{t('filter.clear')}</button>}
      <ExportButton filters={f} />
    </section>
  );
}

/** Downloads the current view as a spreadsheet (masked phone numbers only; limited to a few an hour). */
function ExportButton({ filters }) {
  const { t } = useI18n();
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  async function go() {
    setBusy(true);
    setErr('');
    const q = {};
    for (const k of ['state', 'district', 'city', 'area', 'department', 'category_l1', 'status', 'priority', 'close_request_status', 'from', 'to', 'q']) if (filters[k]) q[k] = filters[k];
    try { await download(`/api/export.csv${qs(q)}`, 'nyaysetu-complaints.csv'); }
    catch (e) { setErr(e.code === 'EXPORT_LIMIT' ? t('export.limit') : t('app.error')); }
    finally { setBusy(false); }
  }
  return (
    <span style={{ marginLeft: 'auto' }}>
      <button type="button" className="btn" disabled={busy} onClick={go}>{busy ? t('export.busy') : t('export.csv')}</button>
      {err && <span className="err" role="alert" style={{ marginLeft: 8 }}>{err}</span>}
    </span>
  );
}
