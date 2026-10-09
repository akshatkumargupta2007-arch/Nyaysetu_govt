import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Circle, MapContainer, TileLayer, useMap } from 'react-leaflet';
import L from 'leaflet';
import { api, qs } from '../api/client.js';
import { useAuth } from '../auth.jsx';
import { useI18n } from '../i18n/index.jsx';
import { num } from '../lib/format.js';
import Header from '../components/Header.jsx';

/** Civic Pulse: how the city is doing over time. Every number comes from SQL on the time-series tables. */
const W = 640, H = 190, PAD = { l: 38, r: 10, t: 10, b: 22 };

function useLoad(path, deps = []) {
  const [state, setState] = useState({ status: 'loading', data: null });
  useEffect(() => {
    let live = true;
    setState((s) => ({ ...s, status: 'loading' }));
    api(path).then((data) => live && setState({ status: 'ready', data })).catch(() => live && setState({ status: 'error', data: null }));
    return () => { live = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [path, ...deps]);
  return state;
}

/** A small line chart. lines = [{ key, label, color }], points = [{ t, [key]: number }] */
function LineChart({ points, lines, label }) {
  const xs = points.map((p) => new Date(p.t).getTime());
  if (!points.length) return <div className="empty">–</div>;
  const x0 = Math.min(...xs), x1 = Math.max(...xs, x0 + 1);
  const ymax = Math.max(1, ...points.flatMap((p) => lines.map((l) => Number(p[l.key]) || 0)));
  const X = (t) => PAD.l + ((new Date(t).getTime() - x0) / (x1 - x0)) * (W - PAD.l - PAD.r);
  const Y = (v) => PAD.t + (1 - v / ymax) * (H - PAD.t - PAD.b);
  const fmt = (t) => new Date(t).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', timeZone: 'Asia/Kolkata' });
  return (
    <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={label} style={{ width: '100%', height: 'auto' }}>
      {[0, 0.5, 1].map((f) => (
        <g key={f}>
          <line x1={PAD.l} x2={W - PAD.r} y1={Y(ymax * f)} y2={Y(ymax * f)} stroke="var(--line)" />
          <text x={PAD.l - 4} y={Y(ymax * f) + 3} textAnchor="end" fontSize="10" fill="var(--muted, #5b6778)">{num(Math.round(ymax * f))}</text>
        </g>
      ))}
      <text x={PAD.l} y={H - 6} fontSize="10" fill="var(--muted, #5b6778)">{fmt(points[0].t)}</text>
      <text x={W - PAD.r} y={H - 6} fontSize="10" textAnchor="end" fill="var(--muted, #5b6778)">{fmt(points[points.length - 1].t)}</text>
      {lines.map((l) => (
        <polyline key={l.key} fill="none" stroke={l.color} strokeWidth="2" strokeLinejoin="round"
          points={points.map((p) => `${X(p.t).toFixed(1)},${Y(Number(p[l.key]) || 0).toFixed(1)}`).join(' ')} />
      ))}
    </svg>
  );
}

function Legend({ lines }) {
  return (
    <div style={{ display: 'flex', gap: 12, fontSize: 12, flexWrap: 'wrap' }}>
      {lines.map((l) => <span key={l.key}><i style={{ display: 'inline-block', width: 10, height: 10, background: l.color, borderRadius: 2, marginRight: 4 }} />{l.label}</span>)}
    </div>
  );
}

function Panel({ title, source, ms, children }) {
  return (
    <section className="panel" style={{ flex: 'none' }}>
      <div className="panel__body" style={{ padding: 12 }}>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginBottom: 6 }}>
          <h2 style={{ margin: 0, fontSize: 15, color: 'var(--navy)' }}>{title}</h2>
          <span style={{ flex: 1 }} />
          {source && <small style={{ opacity: 0.65 }}>{source}{ms != null ? ` · ${ms} ms` : ''}</small>}
        </div>
        {children}
      </div>
    </section>
  );
}

function FitTo({ points }) {
  const map = useMap();
  useEffect(() => {
    if (points.length) map.fitBounds(L.latLngBounds(points.map((p) => [p.lat, p.lng])).pad(0.2), { maxZoom: 15, animate: false });
  }, [map, points]);
  return null;
}

function CellMap({ cells, cities, t, lang }) {
  const byCity = useMemo(() => {
    const m = new Map();
    for (const c of cells) m.set(c.city_id, (m.get(c.city_id) || 0) + c.received);
    return [...m.entries()].sort((a, b) => b[1] - a[1]).map(([id]) => id);
  }, [cells]);
  const [city, setCity] = useState(null);
  const sel = city && byCity.includes(city) ? city : byCity[0];
  const mine = useMemo(() => cells.filter((c) => c.city_id === sel), [cells, sel]);
  const days = useMemo(() => [...new Set(mine.map((c) => c.t))].sort(), [mine]);
  const [i, setI] = useState(0);
  const [playing, setPlaying] = useState(false);
  useEffect(() => { setI(Math.max(0, days.length - 1)); setPlaying(false); }, [days.length, sel]);
  useEffect(() => {
    if (!playing) return undefined;
    const id = setInterval(() => setI((x) => (x + 1 >= days.length ? (setPlaying(false), x) : x + 1)), 300);
    return () => clearInterval(id);
  }, [playing, days.length]);
  if (!cells.length) return <div className="empty">–</div>;
  const day = days[i];
  const upto = new Map();
  for (const c of mine) if (c.t <= day) { const o = upto.get(c.cell); upto.set(c.cell, { ...c, total: (o?.total || 0) + c.received, today: c.t === day ? c.received : (o?.today || 0) }); }
  const shown = [...upto.values()];
  const peak = Math.max(1, ...shown.map((c) => c.total));
  const name = (id) => { const x = cities?.find((q) => q.id === id); return x ? (x.name[lang] || x.name.en || id) : id; };
  return (
    <div>
      <div style={{ display: 'flex', gap: 8, marginBottom: 6, alignItems: 'center' }}>
        <label style={{ fontSize: 12 }}>{t('pulse.city')}{' '}
          <select value={sel} onChange={(e) => setCity(e.target.value)}>{byCity.map((id) => <option key={id} value={id}>{name(id)}</option>)}</select>
        </label>
      </div>
      <MapContainer center={[21.19, 81.35]} zoom={12} style={{ height: 320, borderRadius: 6 }} scrollWheelZoom={false}>
        <TileLayer url="https://tile.openstreetmap.org/{z}/{x}/{y}.png" attribution="© OpenStreetMap contributors" maxZoom={19} />
        <FitTo points={mine} />
        {shown.map((c) => (
          <Circle key={c.cell} center={[c.lat, c.lng]} radius={90 + 260 * Math.sqrt(c.total / peak)}
            pathOptions={{ color: c.today ? '#b42318' : '#0e7c86', weight: 1, fillColor: c.today ? '#b42318' : '#0e7c86', fillOpacity: c.today ? 0.6 : 0.3 }} />
        ))}
      </MapContainer>
      <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginTop: 6 }}>
        <button type="button" className="btn" onClick={() => { if (i + 1 >= days.length) setI(0); setPlaying((p) => !p); }}>{playing ? t('pulse.pause') : t('pulse.play')}</button>
        <input type="range" min="0" max={Math.max(0, days.length - 1)} value={i} onChange={(e) => { setPlaying(false); setI(Number(e.target.value)); }} style={{ flex: 1 }} aria-label={t('pulse.day')} />
        <small>{day ? new Date(day).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', timeZone: 'Asia/Kolkata' }) : ''}</small>
      </div>
    </div>
  );
}

/** Poll an endpoint every `ms` while the page is visible. */
function usePoll(path, ms) {
  const [state, setState] = useState({ status: 'loading', data: null });
  useEffect(() => {
    let live = true, timer, first = true;
    const tick = async () => {
      if (first || document.visibilityState === 'visible') {
        first = false;
        try { const data = await api(path); if (live) setState({ status: 'ready', data }); } catch { if (live) setState((x) => ({ ...x, status: x.data ? 'ready' : 'error' })); }
      }
      if (live) timer = setTimeout(tick, ms);
    };
    tick();
    return () => { live = false; clearTimeout(timer); };
  }, [path, ms]);
  return state;
}

const STATE_KEY = { SUBMITTED: 'pulse.k_new', ASSIGNED: 'pulse.k_assigned', DISPATCHED: 'pulse.k_assigned', WORK_DONE_PENDING_CONFIRMATION: 'pulse.k_done', CLOSED_CONFIRMED: 'pulse.k_fixed', REOPENED: 'pulse.k_reopened' };

function Stat({ label, value, sub }) {
  return (
    <div style={{ minWidth: 120 }}>
      <div style={{ fontSize: 26, fontWeight: 700, lineHeight: 1.1, fontVariantNumeric: 'tabular-nums' }}>{value}</div>
      <div style={{ fontSize: 11, opacity: 0.75, textTransform: 'uppercase', letterSpacing: 0.4 }}>{label}</div>
      {sub && <div style={{ fontSize: 11, opacity: 0.6 }}>{sub}</div>}
    </div>
  );
}

function Band({ points, now, label }) {
  const pts = points.filter((p) => p.upper !== null || p.actual !== null);
  if (!pts.length) return <div className="empty">–</div>;
  const ts = pts.map((p) => new Date(p.t).getTime());
  const x0 = Math.min(...ts), x1 = Math.max(...ts, x0 + 1);
  const ymax = Math.max(1, ...pts.flatMap((p) => [p.upper || 0, p.actual || 0]));
  const X = (t) => PAD.l + ((new Date(t).getTime() - x0) / (x1 - x0)) * (W - PAD.l - PAD.r);
  const Y = (v) => PAD.t + (1 - v / ymax) * (H - PAD.t - PAD.b);
  const band = pts.filter((p) => p.upper !== null);
  const poly = [...band.map((p) => `${X(p.t)},${Y(p.upper)}`), ...band.slice().reverse().map((p) => `${X(p.t)},${Y(p.lower)}`)].join(' ');
  const act = pts.filter((p) => p.actual !== null);
  const exp = band.map((p) => `${X(p.t).toFixed(1)},${Y(p.expected).toFixed(1)}`).join(' ');
  const nowX = X(now);
  const hot = act.filter((p) => p.upper !== null && p.actual > p.upper && p.actual >= 10);
  return (
    <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={label} style={{ width: '100%', height: 'auto' }}>
      {[0, 0.5, 1].map((f) => (<g key={f}><line x1={PAD.l} x2={W - PAD.r} y1={Y(ymax * f)} y2={Y(ymax * f)} stroke="var(--line)" /><text x={PAD.l - 4} y={Y(ymax * f) + 3} textAnchor="end" fontSize="10" fill="#5b6778">{num(Math.round(ymax * f))}</text></g>))}
      <polygon points={poly} fill="#0e7c86" fillOpacity="0.14" />
      <polyline points={exp} fill="none" stroke="#0e7c86" strokeDasharray="4 3" strokeWidth="1.5" />
      <rect x={nowX} y={PAD.t} width={Math.max(0, W - PAD.r - nowX)} height={H - PAD.t - PAD.b} fill="#1f3a5f" fillOpacity="0.05" />
      <line x1={nowX} x2={nowX} y1={PAD.t} y2={H - PAD.b} stroke="#1f3a5f" strokeDasharray="2 3" />
      <polyline points={act.map((p) => `${X(p.t).toFixed(1)},${Y(p.actual).toFixed(1)}`).join(' ')} fill="none" stroke="#1f6feb" strokeWidth="2" strokeLinejoin="round" />
      {hot.map((p) => <circle key={p.t} cx={X(p.t)} cy={Y(p.actual)} r="4" fill="#b42318" />)}
    </svg>
  );
}

function Race({ t }) {
  const [run, setRun] = useState(0);
  const [busy, setBusy] = useState(false);
  const [data, setData] = useState(null);
  const [err, setErr] = useState(false);
  const go = async () => {
    setBusy(true); setErr(false);
    try { setData(await api('/api/pulse/race')); setRun((x) => x + 1); } catch { setErr(true); } finally { setBusy(false); }
  };
  useEffect(() => { const id = setTimeout(go, 1200); return () => clearTimeout(id); /* eslint-disable-next-line */ }, []);
  const mb = (b) => Math.round(b / 1e6);
  return (
    <Panel title={t('pulse.race')} source={data ? t('pulse.rows_n', { n: num(data.rows) }) : ''}>
      {err && <div className="err" role="alert">{t('app.error')}</div>}
      {data && data.tests.map((x) => {
        const mx = Math.max(x.plain_ms, x.hypertable_ms, x.aggregate_ms, 1);
        const bar = (ms, color) => (<div style={{ display: 'flex', alignItems: 'center', gap: 6 }}><div style={{ width: `${Math.max(0.6, (ms / mx) * 100)}%`, height: 12, background: color, borderRadius: 3, transition: 'width .5s' }} /><small style={{ fontVariantNumeric: 'tabular-nums' }}>{ms} ms</small></div>);
        return (
          <div key={x.id} style={{ marginBottom: 10 }}>
            <div style={{ display: 'flex', gap: 8, alignItems: 'baseline' }}>
              <strong style={{ fontSize: 13 }}>{t(`pulse.q_${x.id}`)}</strong>
              <span style={{ flex: 1 }} />
              {x.speedup && <span className="chip" style={{ background: 'var(--green-bg)', color: 'var(--green)', padding: '1px 8px', borderRadius: 10, fontWeight: 700 }}>{x.speedup}× {t('pulse.faster')}</span>}
              <small>{x.same_answer ? '✓ ' + t('pulse.same') : '✗ ' + t('pulse.differ')}</small>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '110px 1fr', gap: '2px 8px', fontSize: 12, alignItems: 'center' }}>
              <span>{t('pulse.plain')}</span>{bar(x.plain_ms, '#b42318')}
              <span>{t('pulse.hyper')}</span>{bar(x.hypertable_ms, '#b26b00')}
              <span>{t('pulse.agg')}</span>{bar(x.aggregate_ms, '#1e7b34')}
            </div>
          </div>
        );
      })}
      {data && (
        <div style={{ fontSize: 13 }}>
          {t('pulse.storage', { plain: num(mb(data.storage.plain_bytes)), tiger: num(mb(data.storage.tiger_bytes)), ratio: data.storage.ratio })}
          <div><small style={{ opacity: 0.7 }}>{data.note}</small></div>
        </div>
      )}
      <button type="button" className="btn" style={{ marginTop: 6 }} disabled={busy} onClick={go}>{busy ? t('app.loading') : t('pulse.rerun')}{run ? '' : ''}</button>
    </Panel>
  );
}

export default function Pulse() {
  const { t, lang } = useI18n();
  const { user } = useAuth();
  const national = user?.role === 'NATIONAL';
  const [grain, setGrain] = useState('day');
  const live = usePoll('/api/pulse/live', 2000);
  const eng = useLoad('/api/pulse/engine');
  const fc = usePoll('/api/pulse/forecast', 10000);
  const alerts = usePoll('/api/pulse/alerts', 5000);
  const trend = usePoll(`/api/pulse/trend${qs({ grain })}`, 10000);
  const res = useLoad('/api/pulse/resolution');
  const sla = useLoad('/api/pulse/sla');
  const cells = useLoad('/api/pulse/cells');
  const [simBusy, setSimBusy] = useState(false);
  const L = live.data;
  const sendSim = async (action, rate) => {
    setSimBusy(true);
    try { await api('/api/pulse/sim', { method: 'POST', body: { action, rate } }); } catch { /* shown by the live panel state */ } finally { setSimBusy(false); }
  };
  const E = eng.data;
  return (
    <div className="page">
      <Header />
      <main className="page__body" style={{ overflow: 'auto' }}>
        <section style={{ background: 'linear-gradient(135deg,#12294a,#1f3a5f)', color: '#fff', borderRadius: 10, padding: '14px 18px', display: 'flex', flexWrap: 'wrap', gap: 22, alignItems: 'center' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span className="pulse-dot" aria-hidden="true" />
              <h1 style={{ margin: 0, fontSize: 20 }}>{t('pulse.title')}</h1>
            </div>
            <div style={{ fontSize: 12, opacity: 0.8, maxWidth: 360 }}>{t('pulse.sub')}</div>
          </div>
          <Stat label={t('pulse.eps')} value={L ? L.eps.toFixed(1) : '–'} sub={L?.sim ? t('pulse.simon', { n: L.sim.rate }) : t('pulse.live10')} />
          <Stat label={t('pulse.newreports')} value={L ? num(L.reportsLastHour) : '–'} sub={t('pulse.hour_sub')} />
          {L?.totalEvents != null && <Stat label={t('pulse.stored')} value={num(L.totalEvents)} sub={t('pulse.stored_sub')} />}
          <span style={{ flex: 1 }} />
          {national && L?.simAllowed && (
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              {!L.sim
                ? <button type="button" className="btn" disabled={simBusy} onClick={() => sendSim('start', 8)}>▶ {t('pulse.start')}</button>
                : (<><button type="button" className="btn" disabled={simBusy} onClick={() => sendSim('surge')}>⚡ {t('pulse.surge')}</button>
                  <button type="button" className="btn" disabled={simBusy} onClick={() => sendSim('stop')}>■ {t('pulse.stop')}</button></>)}
            </div>
          )}
        </section>
        {E && E.timescaledb && (
          <div style={{ fontSize: 12, opacity: 0.75 }}>
            {t('pulse.engine', { v: E.timescaledb, h: E.hypertables, a: E.continuous_aggregates, c: E.compressed_chunks, n: E.chunks, j: E.policy_jobs })}
          </div>
        )}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(340px,1fr))', gap: 10 }}>
          <Panel title={t('pulse.alerts')} source="alerts">
            {alerts.data && (alerts.data.alerts.length
              ? alerts.data.alerts.map((a) => (
                <div key={a.id} className="err" style={{ marginBottom: 4, fontSize: 13 }}>
                  <strong>{a.category_l1 || ''}</strong> {t('pulse.hotspot', { n: a.observed, exp: a.expected, z: a.zscore })} · {a.city_id}{a.synthetic ? ` · ${t('pulse.synth')}` : ''}
                </div>))
              : <div className="ok">{t('pulse.nohot')}</div>)}
          </Panel>
          <Panel title={t('pulse.feed')} source="complaint_activity" ms={L?.ms}>
            <div style={{ fontSize: 12, fontFamily: 'ui-monospace,Menlo,monospace', display: 'grid', gap: 2 }}>
              {(L?.feed || []).map((e, i) => (
                <div key={`${e.at}${i}`} style={{ display: 'flex', gap: 8, opacity: e.synthetic ? 0.7 : 1 }}>
                  <span style={{ opacity: 0.6 }}>{new Date(e.at).toLocaleTimeString('en-IN', { timeZone: 'Asia/Kolkata', hour12: false })}</span>
                  <span style={{ minWidth: 96 }}>{t(e.kind === 'REPORT_RECEIVED' ? 'pulse.k_new' : (e.kind === 'CLOSE_REQUESTED_BY_GOV' ? 'pulse.k_close' : (STATE_KEY[e.to_state] || 'pulse.k_moved')))}</span>
                  <span>{e.category_l1 || ''}</span><span style={{ opacity: 0.6 }}>{e.city_id}</span>
                </div>))}
            </div>
          </Panel>
        </div>
        <Panel title={t('pulse.forecast')} source={fc.data?.source} ms={fc.data?.ms}>
          {fc.data && <><Band points={fc.data.points} now={fc.data.now} label={t('pulse.forecast')} />
            <div style={{ fontSize: 12, opacity: 0.75 }}>{t('pulse.forecast_help')}</div></>}
        </Panel>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
          <h2 style={{ margin: 0, fontSize: 15, color: 'var(--navy)' }}>{t('pulse.trend')}</h2>
          <div className="langsw" role="group" style={{ borderColor: 'var(--line)' }}>
            {['hour', 'day', 'week'].map((g) => (<button key={g} type="button" aria-pressed={grain === g} style={{ color: grain === g ? undefined : 'var(--ink)' }} onClick={() => setGrain(g)}>{t(`pulse.g_${g}`)}</button>))}
          </div>
        </div>
        <Panel title={t('pulse.trend_t')} source={trend.data?.source} ms={trend.data?.ms}>
          {trend.data && (() => {
            const lines = [{ key: 'received', label: t('pulse.received'), color: '#1f6feb' }, { key: 'work_done', label: t('pulse.workdone'), color: '#0e7c86' }, { key: 'reopened', label: t('pulse.reopened'), color: '#b42318' }];
            return (<><LineChart points={trend.data.series} lines={lines} label={t('pulse.trend_t')} /><Legend lines={lines} /></>);
          })()}
        </Panel>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(340px,1fr))', gap: 10 }}>
          <Panel title={t('pulse.resolution')} source={res.data?.source} ms={res.data?.ms}>
            {res.status === 'ready' && (() => {
              const lines = [{ key: 'median_hours', label: t('pulse.median_h'), color: '#0e7c86' }, { key: 'p90_hours', label: t('pulse.p90_h'), color: '#b26b00' }];
              return (<><LineChart points={res.data.series} lines={lines} label={t('pulse.resolution')} /><Legend lines={lines} /></>);
            })()}
          </Panel>
          <Panel title={t('pulse.sla')} source={sla.data?.source} ms={sla.data?.ms}>
            {sla.status === 'ready' && <LineChart points={sla.data.series} lines={[{ key: 'breached_pct', label: '%', color: '#b42318' }]} label={t('pulse.sla')} />}
          </Panel>
        </div>
        <Panel title={t('pulse.map')} source={cells.data?.source} ms={cells.data?.ms}>
          {cells.status === 'ready' && <CellMap cells={cells.data.cells} cities={cells.data.cities} t={t} lang={lang} />}
        </Panel>
        {national && <Race t={t} />}
      </main>
    </div>
  );
}
