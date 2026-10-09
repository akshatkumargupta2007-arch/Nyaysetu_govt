import React from 'react';
import { useI18n } from '../i18n/index.jsx';
import { useFetch, qs } from '../lib/hooks.js';
import { num, pct } from '../lib/format.js';

export default function Kpis({ filters, version }) {
  const { t } = useI18n();
  const { data, error } = useFetch(`/api/stats/kpis${qs({ ...filters, _v: version })}`);
  const k = data?.kpis;
  const tiles = [
    ['received', num(k?.received), ''],
    ['open', num(k?.open), ''],
    ['awaiting', num(k?.awaitingCitizen), k?.awaitingCitizen ? 'warn' : ''],
    ['resolved', num(k?.resolved), 'good'],
    ['hours', k?.avgResolutionHours == null ? '–' : t('kpi.hoursUnit', { n: num(k.avgResolutionHours) }), ''],
    ['sla', pct(k?.slaBreachedPct), k?.slaBreachedPct > 25 ? 'bad' : ''],
    ['reopen', pct(k?.reopenPct), k?.reopenPct > 15 ? 'warn' : ''],
    ['fix', pct(k?.confirmedFixRate), 'good'],
  ];
  return (
    <section className="kpis" aria-label="Key numbers">
      {tiles.map(([key, value, tone]) => (
        <div key={key} className={`kpi ${tone ? `kpi--${tone}` : ''}`} title={t(`kpi.hint.${key}`)}>
          <div className="kpi__v">{error ? '–' : value}</div>
          <div className="kpi__l">{t(`kpi.${key}`)}</div>
        </div>
      ))}
    </section>
  );
}
