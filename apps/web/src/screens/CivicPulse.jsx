import React from 'react';
import { DCLogic, css } from '../lib/dc.js';
import { TLink } from '../lib/TLink.jsx';
import { govRoles, currentRoleKey, switchRole } from '../lib/gov.js';
import { logout, api, qs } from '../lib/client.js';
import './CivicPulse.css';

/* Behaviour and sample data of this screen. Replace the sample data with calls to your API (see docs/DATA.md). */
class CivicPulseLogic extends DCLogic {
state = { lang: 'en', role: currentRoleKey(), live: true, period: 'day', city: '', day: 0, play: false, live: true, ms: {}, bad: {}, simErr: false, alerts: null, fc: null, trend: null, res: null, sla: null, cells: null, eng: null, integ: null };

ROLES = govRoles();
NAVD = [['/', 'Civic Pulse', 'सिविक पल्स', 'nstcd'], ['/complaints', 'Complaints', 'शिकायतें', 'nstcd'], ['/queue', 'Closure Court', 'क्लोज़र कोर्ट', 'nstcd'], ['/ask', 'Ask the City', 'शहर से पूछें', 'nstcd'], ['/scorecard', 'Scorecard', 'स्कोरकार्ड', 'nstc'], ['/benchmark', 'Benchmark', 'बेंचमार्क', 'n'], ['/health', 'System health', 'सिस्टम स्वास्थ्य', 'n'], ['/audit', 'Audit log', 'ऑडिट लॉग', 'n']];
T = {
en: { brand: 'NyaySetu Gov', generated: 'Generated data', legend: 'Legend', view_as: 'View as', signout: 'Sign out', proto: 'Prototype. Not an official government website. Part of the demo data is generated and labelled as such.', tz: 'Times in IST · numbers in Indian grouping',
heart: 'Live heartbeat', eps: 'Events per second', last10: 'last 10 seconds', hour_now: 'New reports this hour', hour_prev: 'last hour', stored: 'Events stored', stored_sub: 'in the time-series table', engine: 'TimescaleDB 2.17 · 4 hypertables · 3 continuous aggregates · 19 of 24 chunks compressed · 6 background policies', src_live: 'Source: pulse/live and pulse/engine',
sim_title: 'Load simulator (demo only · generated data)', sim_start: 'Start live city', sim_surge: 'Surge in one spot (45 s)', sim_stop: 'Stop', live: 'Live', paused: 'Paused',
fc_title: 'Reports per hour vs the usual range', fc_help: 'Line = reports now. Blue band = usual range for this hour of the week (last 4 weeks, ±2 standard deviations). Red dot = well above normal. Grey = next 24 hours.', fc_above: 'above normal', fc_actual: 'Actual', fc_expected: 'Expected', fc_band: 'Usual range', fc_flag: 'Flagged', now: 'now',
tl_title: 'Time-lapse: reports per 500 m cell', city: 'City', day: 'Day', play: 'Play', pause: 'Pause', tl_legend: 'Darker = more reports. Thick outline = today. Locations approximate (±25 m).', tl_gen: 'generated data',
al_title: 'Alerts (found automatically)', al_in24: 'reports in 24 h', al_exp: 'expected', al_poll: 'refreshes every 5 s', gen_tag: 'Generated', open: 'Open', ack: 'Acknowledged', dis: 'False alarm',
tr_title: 'Trends', period: 'Period', hour: 'Hourly', day2: 'Daily', week: 'Weekly', received: 'Received', workdone: 'Work done', reopened: 'Reopened',
fix_title: 'How long a fix takes', median_h: 'median hours', p90_h: '90th percentile hours',
sla_title: 'Finished jobs past deadline', sla_today: 'of finished jobs today',
ci_title: 'Closure integrity', ci_help: 'Share of repair proofs by outcome. Groups under 5 are hidden. Never about a named person.', ci_hidden: 'Hidden: fewer than 5 submissions', ci_a: 'Passed first time', ci_b: 'Needed more evidence', ci_c: 'Rejected as reused', ci_d: 'Contested',
feed_title: 'Live feed', src: 'Source' },
hi: { brand: 'न्यायसेतु शासन', generated: 'जनित डेटा', legend: 'संकेत-सूची', view_as: 'इस रूप में देखें', signout: 'लॉग आउट', proto: 'प्रोटोटाइप। आधिकारिक सरकारी वेबसाइट नहीं। कुछ डेमो डेटा जनित है और उस पर लेबल है।', tz: 'समय IST में · संख्याएँ भारतीय समूहन में',
heart: 'लाइव धड़कन', eps: 'प्रति सेकंड घटनाएँ', last10: 'पिछले 10 सेकंड', hour_now: 'इस घंटे की नई शिकायतें', hour_prev: 'पिछला घंटा', stored: 'संग्रहीत घटनाएँ', stored_sub: 'टाइम-सीरीज़ तालिका में', engine: 'TimescaleDB 2.17 · 4 हाइपरटेबल · 3 सतत एग्रीगेट · 24 में से 19 चंक संपीड़ित · 6 बैकग्राउंड नीतियाँ', src_live: 'स्रोत: pulse/live और pulse/engine',
sim_title: 'लोड सिम्युलेटर (केवल डेमो · जनित डेटा)', sim_start: 'लाइव शहर शुरू करें', sim_surge: 'एक जगह उछाल (45 से.)', sim_stop: 'रोकें', live: 'लाइव', paused: 'रुका हुआ',
fc_title: 'प्रति घंटा शिकायतें बनाम सामान्य दायरा', fc_help: 'रेखा = अभी की शिकायतें। नीला दायरा = सप्ताह के इस घंटे का सामान्य दायरा (पिछले 4 सप्ताह, ±2 मानक विचलन)। लाल बिंदु = सामान्य से काफ़ी ऊपर। स्लेटी = अगले 24 घंटे।', fc_above: 'सामान्य से ऊपर', fc_actual: 'वास्तविक', fc_expected: 'अपेक्षित', fc_band: 'सामान्य दायरा', fc_flag: 'चिह्नित', now: 'अभी',
tl_title: 'टाइम-लैप्स: प्रति 500 मी सेल शिकायतें', city: 'शहर', day: 'दिन', play: 'चलाएँ', pause: 'रोकें', tl_legend: 'गहरा = अधिक शिकायतें। मोटी रेखा = आज। स्थान लगभग (±25 मी)।', tl_gen: 'जनित डेटा',
al_title: 'अलर्ट (अपने आप मिले)', al_in24: 'शिकायतें 24 घंटे में', al_exp: 'अपेक्षित', al_poll: 'हर 5 से. में ताज़ा', gen_tag: 'जनित', open: 'खुला', ack: 'देखा गया', dis: 'झूठा अलार्म',
tr_title: 'रुझान', period: 'अवधि', hour: 'घंटेवार', day2: 'दैनिक', week: 'साप्ताहिक', received: 'प्राप्त', workdone: 'कार्य पूर्ण', reopened: 'दोबारा खुली',
fix_title: 'समाधान में कितना समय लगता है', median_h: 'माध्यिका घंटे', p90_h: '90वाँ प्रतिशतक घंटे',
sla_title: 'समय-सीमा के बाद पूरे हुए काम', sla_today: 'आज पूरे हुए कामों में',
ci_title: 'क्लोज़र की विश्वसनीयता', ci_help: 'परिणाम के अनुसार मरम्मत-प्रमाण का हिस्सा। 5 से कम वाले समूह छिपे हैं। किसी नामित व्यक्ति के बारे में नहीं।', ci_hidden: 'छिपा: 5 से कम प्रस्तुतियाँ', ci_a: 'पहली बार में पास', ci_b: 'और प्रमाण चाहिए', ci_c: 'पुराना प्रमाण कहकर अस्वीकृत', ci_d: 'विवादित',
feed_title: 'लाइव फ़ीड', src: 'स्रोत' }
};

fmt(n) { const s = String(Math.round(Number(n) || 0)); if (s.length <= 3) return s; const last = s.slice(-3); let rest = s.slice(0, -3); const out = []; while (rest.length > 2) { out.unshift(rest.slice(-2)); rest = rest.slice(0, -2); } if (rest) out.unshift(rest); return out.join(',') + ',' + last; }
pts(vals, x0, x1, y0, y1, max) { const n = vals.length; return vals.map((v, i) => (x0 + (x1 - x0) * (n === 1 ? 0 : i / (n - 1))).toFixed(1) + ',' + (y1 - (v / (max || 1)) * (y1 - y0)).toFixed(1)).join(' '); }

// ---- real data ------------------------------------------------------------------------------------------
async get(key, path, set) {
  try { const t0 = performance.now(); const d = await api(path); const ms = Math.round(performance.now() - t0); this.setState((s) => ({ [key]: d, ms: { ...s.ms, [key]: d && d.ms != null ? d.ms : ms }, bad: { ...s.bad, [key]: false } })); if (set) set(d); }
  catch (e) { this.setState((s) => ({ bad: { ...s.bad, [key]: true } })); }
}
loadLive() { if (document.hidden && this._seen) return; this._seen = true; this.get('live', '/api/pulse/live'); }
loadFast() { this.get('alerts', '/api/pulse/alerts'); this.get('fc', '/api/pulse/forecast'); this.loadTrend(); }
loadTrend() { this.get('trend', '/api/pulse/trend' + qs({ grain: this.state.period })); }
loadOnce() { this.get('eng', '/api/pulse/engine'); this.get('res', '/api/pulse/resolution'); this.get('sla', '/api/pulse/sla'); this.get('cells', '/api/pulse/cells'); this.get('integ', '/api/pulse/integrity'); }
componentDidMount() {
  try { const l = localStorage.getItem('gov.lang'); if (l === 'hi' || l === 'en') this.setState({ lang: l }); } catch (e) {}
  this.loadLive(); this.loadFast(); this.loadOnce();
  this._iv = setInterval(() => { if (this.state.live) this.loadLive(); }, 2000);
  this._fv = setInterval(() => { if (this.state.live && !document.hidden) this.loadFast(); }, 8000);
  this._pv = setInterval(() => { if (this.state.play) { const n = this.dayList().length; this.setState({ day: n ? (this.state.day + 1) % n : 0 }); } }, 800);
  this.initMap();
}
componentWillUnmount() { clearInterval(this._iv); clearInterval(this._fv); clearInterval(this._pv); }
componentDidUpdate() { this.syncMap(); }
setLang(l) { try { localStorage.setItem('gov.lang', l); } catch (e) {} this.setState({ lang: l }); }
setRole(r) { switchRole(r); window.location.reload(); }
async sim(action, rate) { try { await api('/api/pulse/sim', { method: 'POST', body: { action, rate } }); this.loadLive(); } catch (e) { this.setState({ simErr: true }); } }

// time-lapse data: cells grouped per city and per day
dayList() { const c = this.state.cells; if (!c) return []; return [...new Set(c.cells.map((x) => x.t))].sort(); }
cityNames() { const c = this.state.cells; if (!c) return []; const ids = [...new Set(c.cells.map((x) => x.city_id))]; return ids.map((id) => { const f = (c.cities || []).find((q) => q.id === id); const nm = f ? (f.name[this.state.lang] || f.name.en) : id; return [nm, id]; }); }
cellsFor(cityId, dayIso) { const c = this.state.cells; if (!c) return []; return c.cells.filter((x) => x.city_id === cityId && x.t === dayIso).map((x) => [x.lat, x.lng, x.received]); }
cityCentre(cityId) { const c = this.state.cells; const r = c ? c.cells.filter((x) => x.city_id === cityId) : []; if (!r.length) return [21.19, 81.35]; return [r.reduce((a, x) => a + x.lat, 0) / r.length, r.reduce((a, x) => a + x.lng, 0) / r.length]; }
curCity() { const names = this.cityNames(); const f = names.find((n) => n[0] === this.state.city) || names[0]; return f ? f[1] : null; }

initMap() {
  try {
    const el = document.getElementById('tmap'); if (!el || this._map || !window.L) return;
    const L = window.L; const map = L.map(el, { zoomControl: false, attributionControl: false, scrollWheelZoom: false });
    L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19 }).addTo(map);
    this._map = map; this._lg = L.layerGroup().addTo(map); map.setView([21.19, 81.35], 13);
    setTimeout(() => { try { map.invalidateSize(); this.syncMap(true); } catch (e) {} }, 250);
  } catch (e) {}
}
syncMap(force) {
  try {
    const L = window.L; if (!L || !this._map) return; const s = this.state; const days = this.dayList(); const id = this.curCity(); if (!id || !days.length) return;
    const dayIso = days[Math.min(s.day, days.length - 1)]; const key = id + '|' + dayIso + '|' + (s.cells && s.cells.cells.length); if (!force && this._key === key) return; this._key = key;
    if (this._cityShown !== id) { this._cityShown = id; this._map.setView(this.cityCentre(id), 13); }
    this._lg.clearLayers(); const today = dayIso === days[days.length - 1];
    const col = (n) => (n > 18 ? '#7F1D1D' : n > 12 ? '#DC2626' : n > 7 ? '#F97316' : n > 3 ? '#FBBF24' : '#FEF08A');
    this.cellsFor(id, dayIso).forEach((q) => { const h = 0.0025; L.rectangle([[q[0] - h, q[1] - h], [q[0] + h, q[1] + h]], { color: today ? '#111827' : '#6B7280', weight: today ? 2.5 : 0.5, fillColor: col(q[2]), fillOpacity: 0.7 }).bindTooltip(q[2] + '').addTo(this._lg); });
  } catch (e) {}
}

renderVals() {
  const s = this.state; const l = s.lang; const t = this.T[l]; const ro = this.ROLES[s.role] || Object.values(this.ROLES)[0]; const L = l === 'hi' ? 1 : 0; const rc = ro[5];
  const nav = this.NAVD.filter((n) => n[3].indexOf(rc) >= 0).map((n) => ({ href: n[0], label: n[1 + L], cls: n[0] === '/' ? 'on' : '', cur: n[0] === '/' ? 'page' : 'false' }));
  const pad = (n) => (n < 10 ? '0' : '') + n; const num = (v) => (v === null || v === undefined ? 0 : Number(v));
  const ms = s.ms || {}; const bad = s.bad || {};
  // forecast band
  const pts = (s.fc && s.fc.points) || []; const N = Math.max(pts.length, 2);
  const ymax = Math.max(10, Math.ceil(Math.max(0, ...pts.map((p) => Math.max(num(p.upper), num(p.actual)))) / 10) * 10);
  const X = (h) => 48 + (h / (N - 1)) * 552; const Y = (v) => 196 - (v / ymax) * 188;
  const lo = pts.map((p) => num(p.lower)), hi = pts.map((p) => num(p.upper)), exp = pts.map((p) => num(p.expected));
  const actIdx = pts.map((p, i) => ({ p, i })).filter((x) => x.p.actual !== null && x.p.actual !== undefined);
  const flags = actIdx.filter((x) => x.p.upper !== null && num(x.p.actual) > num(x.p.upper) && num(x.p.actual) >= 10).map((x) => ({ x: X(x.i), y: Y(num(x.p.actual)) }));
  const band = hi.map((v, i) => X(i).toFixed(1) + ',' + Y(v).toFixed(1)).concat(lo.map((v, i) => X(N - 1 - i).toFixed(1) + ',' + Y(lo[N - 1 - i]).toFixed(1))).join(' ');
  const lastActual = actIdx.length ? actIdx[actIdx.length - 1].i : 0;
  const fc = { band, exp: exp.map((v, i) => X(i).toFixed(1) + ',' + Y(v).toFixed(1)).join(' '), act: actIdx.map((x) => X(x.i).toFixed(1) + ',' + Y(num(x.p.actual)).toFixed(1)).join(' '), flags, nowX: X(lastActual), futX: X(lastActual), futW: 600 - X(lastActual), ymax };
  // trends
  const ser = (s.trend && s.trend.series) || [];
  const rv = ser.map((x) => num(x.received)), dn = ser.map((x) => num(x.work_done)), rp = ser.map((x) => num(x.reopened));
  const mx = Math.max(10, Math.ceil(Math.max(0, ...rv, ...dn) / 10) * 10);
  const dlab = (iso) => { if (!iso) return ''; const d = new Date(iso); return s.period === 'hour' ? pad(d.getUTCHours() + 5 + (d.getUTCMinutes() + 30 >= 60 ? 1 : 0)) % 24 + ':00' : d.getUTCDate() + ' ' + d.toLocaleString('en', { month: 'short', timeZone: 'UTC' }); };
  const sum = (a) => this.fmt(a.reduce((x, y) => x + y, 0));
  const tr = { recv: this.pts(rv, 30, 316, 6, 130, mx), done: this.pts(dn, 30, 316, 6, 130, mx), reop: this.pts(rp, 30, 316, 6, 130, mx), max: mx, first: ser.length ? dlab(ser[0].t) : '', last: ser.length ? dlab(ser[ser.length - 1].t) : '', tRecv: sum(rv), tDone: sum(dn), tReop: sum(rp) };
  // fix time and deadline misses (last 14 days)
  const rs = ((s.res && s.res.series) || []).slice(-14); const m50 = rs.map((x) => num(x.median_hours)), m90 = rs.map((x) => num(x.p90_hours));
  const fixMax = Math.max(10, Math.ceil(Math.max(0, ...m90) / 10) * 10);
  const fix = { med: Math.round(m50[m50.length - 1] || 0), p90: Math.round(m90[m90.length - 1] || 0), l50: this.pts(m50, 4, 196, 4, 84, fixMax), l90: this.pts(m90, 4, 196, 4, 84, fixMax) };
  const sl = ((s.sla && s.sla.series) || []).slice(-14).map((x) => num(x.breached_pct)); const slMax = Math.max(10, Math.ceil(Math.max(0, ...sl) / 10) * 10);
  const sla = { now: Math.round(sl[sl.length - 1] || 0), line: this.pts(sl, 4, 196, 4, 84, slMax) };
  // closure integrity (from the Closure Court data)
  const integrity = ((s.integ && s.integ.rows) || []).map((r) => { const n = r.total; const sh = n >= 5; const p = (v) => (n ? Math.round(v / n * 100) : 0); return { dept: r.department, n, shown: sh, hidden: !sh, a: p(r.passed_first), b: p(r.needed_more), c: p(r.rejected_reused), d: p(r.contested), text: p(r.passed_first) + '% · ' + p(r.needed_more) + '% · ' + p(r.rejected_reused) + '% · ' + p(r.contested) + '%' }; });
  // alerts
  const stT = { open: [t.open, 'background:#FEE2E2;color:#7F1D1D;'], ack: [t.ack, 'background:#DBEAFE;color:#1E3A8A;'], dis: [t.dis, 'background:#E5E7EB;color:#1F2937;'] };
  const stMap = { open: 'open', acknowledged: 'ack', ack: 'ack', dismissed: 'dis', false_alarm: 'dis', dis: 'dis' };
  const title = (c) => String(c || '').replace(/_/g, ' ').toLowerCase().replace(/^./, (x) => x.toUpperCase());
  const cityName = (id) => { const f = s.cells && (s.cells.cities || []).find((q) => q.id === id); return f ? (f.name[l] || f.name.en) : String(id || '').split('.').pop().replace(/^./, (x) => x.toUpperCase()); };
  const alerts = ((s.alerts && s.alerts.alerts) || []).map((a) => { const st = stMap[a.status] || 'open'; return { cat: title(a.category_l1), city: cityName(a.city_id), obs: a.observed, exp: Number(a.expected).toFixed(1), z: Number(a.zscore).toFixed(1), synthetic: a.synthetic, stText: stT[st][0], stStyle: stT[st][1], bg: st === 'open' ? '#FEF2F2' : '#fff', border: st === 'open' ? '#FCA5A5' : '#D1D5DB', open: () => { try { sessionStorage.setItem('gov.alert', String(a.id)); } catch (e) {} } }; });
  // live strip
  const Lv = s.live || {}; const sim = Lv.sim; const simOn = !!sim;
  const simText = simOn ? (l === 'hi' ? sim.rate + '/से. चल रहा · ' + this.fmt(sim.inserted) + ' डाले गए' : 'Running ' + sim.rate + '/s · ' + this.fmt(sim.inserted) + ' inserted') + (sim.surging ? ' · surge' : '') : (l === 'hi' ? 'बंद' : 'Off');
  const rel = (iso) => { const sec = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 1000)); return sec < 60 ? sec + ' s' : Math.floor(sec / 60) + ' min'; };
  const KIND = { SUBMITTED: 'New report', ASSIGNED: 'Assigned', DISPATCHED: 'Assigned', WORK_DONE_PENDING_CONFIRMATION: 'Work done', CLOSED_CONFIRMED: 'Confirmed fixed', REOPENED: 'Reopened' };
  const feed = (Lv.feed || []).map((e) => ({ when: rel(e.at), kind: e.kind === 'CLOSE_REQUESTED_BY_GOV' ? 'Close request' : (e.kind === 'REPORT_RECEIVED' ? 'New report' : (KIND[e.to_state] || 'Update')), text: title(e.category_l1) + ' · ' + cityName(e.city_id), synthetic: !!e.synthetic }));
  const E = s.eng || {}; const engineLine = E.timescaledb ? 'TimescaleDB ' + E.timescaledb + ' · ' + E.hypertables + (l === 'hi' ? ' हाइपरटेबल · ' : ' hypertables · ') + E.continuous_aggregates + (l === 'hi' ? ' सतत एग्रीगेट · ' : ' continuous aggregates · ') + E.compressed_chunks + (l === 'hi' ? ' / ' : ' of ') + E.chunks + (l === 'hi' ? ' चंक संपीड़ित · ' : ' chunks compressed · ') + E.policy_jobs + (l === 'hi' ? ' बैकग्राउंड नीतियाँ' : ' background policies') : (bad.eng ? (l === 'hi' ? 'इंजन की जानकारी उपलब्ध नहीं' : 'Engine information unavailable') : '…');
  // time-lapse
  const days = this.dayList(); const names = this.cityNames(); const dIdx = Math.min(s.day, Math.max(0, days.length - 1));
  const city = (names.find((n) => n[0] === s.city) || names[0] || [''])[0]; const dayDate = days.length ? new Date(days[dIdx]) : null;
  const errMsg = Object.keys(bad).filter((k) => bad[k]).length ? (l === 'hi' ? 'कुछ पैनल का डेटा अभी उपलब्ध नहीं है: ' : 'Some panels could not load: ') + Object.keys(bad).filter((k) => bad[k]).join(', ') : '';
  const stamp = pad(new Date().getHours()) + ':' + pad(new Date().getMinutes()) + ':' + pad(new Date().getSeconds()) + ' IST';
  return {
    t, nav, role: s.role, roleOpts: Object.keys(this.ROLES).map((k) => ({ v: k, l: this.ROLES[k][3 + L] })), onRole: (e) => this.setRole(e.target.value), isEn: l === 'en', isHi: l === 'hi', setEn: () => this.setLang('en'), setHi: () => this.setLang('hi'), user: ro[0], scope: ro[1 + L],
    isNational: s.role === 'national' && !!Lv.simAllowed,
    eps: Number(Lv.eps || 0).toFixed(1), hourNow: this.fmt(Lv.reportsLastHour), hourPrev: '–', total: Lv.totalEvents != null ? this.fmt(Lv.totalEvents) : '–',
    live: s.live, liveLabel: s.live ? '● ' + t.live : '' + t.paused, liveStyle: s.live ? 'background:#DCFCE7;border-color:#15803D;color:#14532D;' : 'background:#FEF3C7;border-color:#B45309;color:#78350F;', liveWord: s.live ? t.live : t.paused, toggleLive: () => this.setState({ live: !this.state.live }),
    simStart: () => this.sim('start', 8), simStop: () => this.sim('stop'), simSurge: () => this.sim('surge'), simText,
    stamp, fc, fcFlagged: flags.length, engineLine, errMsg, ms,
    periods: [['hour', t.hour], ['day', t.day2], ['week', t.week]].map((p) => ({ label: p[1], on: s.period === p[0], pick: () => this.setState({ period: p[0] }, () => this.loadTrend()) })), tr, fix, sla, integrity, alerts,
    city, cities: names.map((n) => n[0]), onCity: (e) => this.setState({ city: e.target.value }),
    play: s.play, playLabel: s.play ? t.pause : t.play, togglePlay: () => this.setState({ play: !this.state.play }), day: dIdx, dayMax: Math.max(0, days.length - 1), onDay: (e) => this.setState({ day: parseInt(e.target.value, 10), play: false }),
    dayLabel: dayDate ? pad(dayDate.getUTCDate()) + ' ' + dayDate.toLocaleString('en', { month: 'short', timeZone: 'UTC' }) + (dIdx === days.length - 1 ? ' · ' + (l === 'hi' ? 'आज' : 'today') : '') : '',
    feed
  };
}
}

CivicPulseLogic.prototype.view = function view(__v) {
  const { engineLine, errMsg, ms, dayMax, a, alerts, c, cities, city, day, dayLabel, eps, f, fc, fcFlagged, feed, fix, hourNow, hourPrev, integrity, isEn, isHi, isNational, live, liveLabel, liveStyle, liveWord, n, nav, o, onCity, onDay, onRole, p, periods, play, playLabel, r, role, roleOpts, scope, setEn, setHi, simStart, simStop, simSurge, simText, sla, stamp, t, toggleLive, togglePlay, total, tr, user } = __v;
  return (
    <div className="sc-pulse" style={{ width: "100%", height: "100vh", minHeight: "780px", overflow: "hidden", display: "flex", flexDirection: "column", background: "#FFFFFF", color: "#111827", fontFamily: "'Noto Sans','Noto Sans Devanagari',system-ui,sans-serif", fontSize: "14px", lineHeight: "1.4" }}>
      <header style={{ minHeight: "52px", background: "#1F2937", color: "#FFFFFF", display: "flex", alignItems: "center", padding: "0 16px", gap: "10px", flex: "none" }}>
        <strong style={{ fontSize: "16px", whiteSpace: "nowrap" }}>
          {t.brand}
        </strong>
        <span style={{ fontSize: "11px", whiteSpace: "nowrap", padding: "1px 7px", border: "1px solid #9CA3AF", borderRadius: "4px", color: "#E5E7EB" }}>
          Prototype
        </span>
        <nav className="nav" aria-label="Main" style={{ display: "flex", marginLeft: "6px" }}>
          {nav.map((n, __i) => (
            <React.Fragment key={__i}>
            <TLink to={n.href} className={n.cls} aria-current={n.cur}>
              {n.label}
            </TLink>
            </React.Fragment>
          ))}
        </nav>
        <span style={{ flex: "1" }}>
        </span>
        <TLink className="gen" to="/legend">
          {t.generated}
        </TLink>
        <TLink to="/legend" style={{ color: "#FFFFFF", fontWeight: "600", fontSize: "13px" }}>
          {t.legend}
        </TLink>
        <label style={{ fontSize: "12px", color: "#D1D5DB", display: "flex", alignItems: "center", gap: "4px" }}>
          {t.view_as}
          <select className="hsel" value={role} onChange={onRole}>
            {roleOpts.map((o, __i) => (
              <React.Fragment key={__i}>
              <option value={o.v}>
                {o.l}
              </option>
              </React.Fragment>
            ))}
          </select>
        </label>
        <span className="lang" role="group" aria-label="Language" style={{ display: "inline-flex", border: "1px solid #9CA3AF", borderRadius: "6px", overflow: "hidden", background: "#fff" }}>
          <button type="button" aria-pressed={isEn} onClick={setEn}>
            EN
          </button>
          <button type="button" aria-pressed={isHi} onClick={setHi}>
            हिं
          </button>
        </span>
        <span style={{ display: "flex", flexDirection: "column", lineHeight: "1.15", textAlign: "right", fontSize: "13px" }}>
          <b>
            {user}
          </b>
          <small style={{ color: "#D1D5DB" }}>
            {scope}
          </small>
        </span>
        <a href="/login" onClick={(e) => { e.preventDefault(); logout().then(() => window.location.assign("/login")); }} style={{ color: "#FFFFFF", fontWeight: "600", fontSize: "13px" }}>
          {t.signout}
        </a>
      </header>
      <section aria-label={t.heart} style={{ margin: "10px 14px 0", background: "#fff", border: "0", borderTop: "3px solid #1F2937", borderRadius: "0", padding: "8px 14px", display: "flex", alignItems: "center", gap: "26px", flex: "none" }}>
        <div className="kv" style={{ display: "flex", flexDirection: "column" }}>
          <span style={{ fontSize: "12px", color: "#374151", fontWeight: "600" }}>
            {t.eps}
          </span>
          <b>
            {eps}
          </b>
          <span style={{ fontSize: "11px", color: "#4B5563" }}>
            {t.last10}
          </span>
        </div>
        <div className="kv" style={{ display: "flex", flexDirection: "column" }}>
          <span style={{ fontSize: "12px", color: "#374151", fontWeight: "600" }}>
            {t.hour_now}
          </span>
          <b>
            {hourNow}
          </b>
          <span style={{ fontSize: "11px", color: "#4B5563" }}>
            {t.hour_prev}: {hourPrev}
          </span>
        </div>
        <div className="kv" style={{ display: "flex", flexDirection: "column" }}>
          <span style={{ fontSize: "12px", color: "#374151", fontWeight: "600" }}>
            {t.stored}
          </span>
          <b>
            {total}
          </b>
          <span style={{ fontSize: "11px", color: "#4B5563" }}>
            {t.stored_sub}
          </span>
        </div>
        <div style={{ flex: "1", minWidth: "0", fontSize: "12px", color: "#374151", lineHeight: "1.5" }}>
          {engineLine}
          <br />
          <span style={{ color: "#4B5563" }}>
            {t.src_live}
          </span>
        </div>
        {!!(isNational) && (
          <>
          <div style={{ display: "flex", flexDirection: "column", gap: "4px", alignItems: "flex-start", paddingLeft: "14px", borderLeft: "1px solid #D1D5DB" }}>
            <span style={{ fontSize: "11px", fontWeight: "700", color: "#78350F" }}>
              {t.sim_title}
            </span>
            <span style={{ display: "flex", gap: "6px" }}>
              <button type="button" className="btn sm pri" onClick={simStart}>
                {t.sim_start}
              </button>
              <button type="button" className="btn sm red" onClick={simSurge}>
                {t.sim_surge}
              </button>
              <button type="button" className="btn sm" onClick={simStop}>
                {t.sim_stop}
              </button>
            </span>
            <span style={{ fontSize: "11px", color: "#4B5563" }}>
              {simText}
            </span>
          </div>
          </>
        )}
        <button type="button" className="btn" onClick={toggleLive} aria-pressed={live} style={css(liveStyle)}>
          {liveLabel}
        </button>
      </section>
      {!!errMsg && (<div role="alert" style={{ margin: "6px 14px 0", padding: "8px 12px", background: "#FEF3C7", border: "1px solid #F59E0B", borderRadius: "6px", color: "#78350F", fontWeight: "600" }}>{errMsg}</div>)}
      <main style={{ flex: "1", minHeight: "0", padding: "10px 14px 6px", display: "grid", gridTemplateColumns: "repeat(12, minmax(0, 1fr))", gridTemplateRows: "minmax(0, 1.12fr) minmax(0, 1fr)", gap: "10px" }}>
        <section className="panel" style={{ gridColumn: "span 5" }} aria-label={t.fc_title}>
          <div style={{ display: "flex", alignItems: "center", gap: "10px", padding: "8px 12px 0" }}>
            <h2 style={{ padding: "0", fontSize: "14px", margin: "0" }}>
              {t.fc_title}
            </h2>
            <span style={{ flex: "1" }}>
            </span>
            <span className="chip" style={{ background: "#FEE2E2", color: "#7F1D1D" }}>
              ● {fcFlagged} {t.fc_above}
            </span>
          </div>
          <div style={{ padding: "0 12px", fontSize: "11px", color: "#4B5563" }}>
            {t.fc_help}
          </div>
          <svg viewBox="0 0 600 230" preserveAspectRatio="none" role="img" aria-label={t.fc_title} style={{ flex: "1", minHeight: "0", width: "100%", padding: "4px 8px" }}>
            <rect x="48" y="8" width="552" height="188" fill="#FFFFFF" />
            <polygon points={fc.band} fill="#BFDBFE" opacity="0.7" />
            <rect x={fc.futX} y="8" width={fc.futW} height="188" fill="#9CA3AF" opacity="0.18" />
            <polyline points={fc.exp} fill="none" stroke="#1E40AF" strokeWidth="1.6" strokeDasharray="5 4" />
            <polyline points={fc.act} fill="none" stroke="#111827" strokeWidth="2.2" />
            {fc.flags.map((f, __i) => (
              <React.Fragment key={__i}>
              <circle cx={f.x} cy={f.y} r="5.5" fill="#B91C1C" stroke="#fff" strokeWidth="1.5" />
              </React.Fragment>
            ))}
            <line x1={fc.nowX} y1="8" x2={fc.nowX} y2="196" stroke="#6B7280" strokeWidth="1" strokeDasharray="3 3" />
            <line x1="48" y1="196" x2="600" y2="196" stroke="#9CA3AF" />
            <line x1="48" y1="8" x2="48" y2="196" stroke="#9CA3AF" />
            <text x="44" y="14" textAnchor="end" fontSize="11" fill="#374151">
              {fc.ymax}
            </text>
            <text x="44" y="196" textAnchor="end" fontSize="11" fill="#374151">
              0
            </text>
            <text x="48" y="214" fontSize="11" fill="#374151">
              −48 h
            </text>
            <text x={fc.nowX} y="214" textAnchor="middle" fontSize="11" fill="#374151" fontWeight="700">
              {t.now}
            </text>
            <text x="600" y="214" textAnchor="end" fontSize="11" fill="#374151">
              +24 h
            </text>
          </svg>
          <div style={{ display: "flex", gap: "14px", padding: "0 12px 2px", fontSize: "11px", color: "#374151" }}>
            <span>
              ━ {t.fc_actual}
            </span>
            <span>
              ┅ {t.fc_expected}
            </span>
            <span style={{ color: "#1E40AF" }}>
              ▮ {t.fc_band}
            </span>
            <span style={{ color: "#B91C1C" }}>
              ● {t.fc_flag}
            </span>
          </div>
          <div className="prov">
            {t.src}: pulse/forecast · {ms.fc ?? "–"} ms · {stamp} · {liveWord}
          </div>
        </section>
        <section className="panel" style={{ gridColumn: "span 4" }} aria-label={t.tl_title}>
          <div style={{ display: "flex", alignItems: "center", gap: "8px", padding: "8px 12px 0" }}>
            <h2 style={{ padding: "0", margin: "0", fontSize: "14px" }}>
              {t.tl_title}
            </h2>
            <span style={{ flex: "1" }}>
            </span>
            <select className="hsel" aria-label={t.city} value={city} onChange={onCity} style={{ background: "#fff", color: "#111827", borderColor: "#6B7280" }}>
              {cities.map((c, __i) => (
                <React.Fragment key={__i}>
                <option value={c}>
                  {c}
                </option>
                </React.Fragment>
              ))}
            </select>
          </div>
          <div style={{ position: "relative", flex: "1", minHeight: "0", margin: "6px 12px 0", border: "1px solid #9CA3AF", borderRadius: "6px", overflow: "hidden", background: "#E5E7EB" }}>
            <div id="tmap" style={{ position: "absolute", inset: "0" }}>
            </div>
            <div style={{ position: "absolute", left: "6px", bottom: "6px", zIndex: "1000", background: "rgba(255,255,255,0.92)", border: "1px solid #9CA3AF", borderRadius: "4px", padding: "3px 6px", fontSize: "10.5px", lineHeight: "1.4" }}>
              {t.tl_legend}
            </div>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: "8px", padding: "6px 12px 0" }}>
            <button type="button" className="btn sm" onClick={togglePlay} aria-pressed={play} style={{ width: "76px", justifyContent: "center" }}>
              {playLabel}
            </button>
            <input type="range" min="0" max={dayMax} value={day} onChange={onDay} aria-label={t.day} style={{ flex: "1", accentColor: "#1D4ED8" }} />
            <span style={{ fontSize: "12px", fontWeight: "700", minWidth: "80px", textAlign: "right" }}>
              {dayLabel}
            </span>
          </div>
          <div className="prov">
            {t.src}: pulse/cells · {ms.cells ?? "–"} ms · {stamp} · {liveWord} · {t.tl_gen}
          </div>
        </section>
        <section className="panel" style={{ gridColumn: "span 3" }} aria-label={t.al_title}>
          <h2>
            {t.al_title}
          </h2>
          <div style={{ padding: "4px 10px", display: "flex", flexDirection: "column", gap: "8px", overflow: "auto", flex: "1", minHeight: "0" }}>
            {alerts.map((a, __i) => (
              <React.Fragment key={__i}>
              <TLink to="/alert" onClick={a.open} style={css(`text-decoration: none; color: inherit; border: 1px solid ${a.border}; background: ${a.bg}; border-radius: 6px; padding: 8px 10px; display: flex; flex-direction: column; gap: 3px;`)}>
                <span style={{ display: "flex", alignItems: "center", gap: "6px", flexWrap: "wrap" }}>
                  <b>
                    {a.cat}
                  </b>
                  <span className="chip" style={css(a.stStyle)}>
                    {a.stText}
                  </span>
                  {!!(a.synthetic) && (
                    <>
                    <span className="chip" style={{ background: "#FEF3C7", color: "#78350F" }}>
                      {t.gen_tag}
                    </span>
                    </>
                  )}
                </span>
                <span style={{ fontSize: "12.5px" }}>
                  {a.city} · {a.obs} {t.al_in24} · {t.al_exp} {a.exp} · z = {a.z}
                </span>
              </TLink>
              </React.Fragment>
            ))}
          </div>
          <div className="prov">
            {t.src}: pulse/alerts · {ms.alerts ?? "–"} ms · {stamp} · {t.al_poll}
          </div>
        </section>
        <section className="panel" style={{ gridColumn: "span 3" }} aria-label={t.tr_title}>
          <div style={{ display: "flex", alignItems: "center", gap: "8px", padding: "8px 12px 0" }}>
            <h2 style={{ padding: "0", margin: "0", fontSize: "14px" }}>
              {t.tr_title}
            </h2>
            <span style={{ flex: "1" }}>
            </span>
            <span className="seg" role="group" aria-label={t.period}>
              {periods.map((p, __i) => (
                <React.Fragment key={__i}>
                <button type="button" aria-pressed={p.on} onClick={p.pick}>
                  {p.label}
                </button>
                </React.Fragment>
              ))}
            </span>
          </div>
          <svg viewBox="0 0 320 150" preserveAspectRatio="none" role="img" aria-label={t.tr_title} style={{ flex: "1", minHeight: "0", width: "100%", padding: "2px 8px" }}>
            <line x1="30" y1="130" x2="316" y2="130" stroke="#9CA3AF" />
            <line x1="30" y1="6" x2="30" y2="130" stroke="#9CA3AF" />
            <polyline points={tr.recv} fill="none" stroke="#1D4ED8" strokeWidth="2.2" />
            <polyline points={tr.done} fill="none" stroke="#C2410C" strokeWidth="2.2" strokeDasharray="6 3" />
            <polyline points={tr.reop} fill="none" stroke="#111827" strokeWidth="2" strokeDasharray="2 3" />
            <text x="26" y="12" textAnchor="end" fontSize="10" fill="#374151">
              {tr.max}
            </text>
            <text x="26" y="130" textAnchor="end" fontSize="10" fill="#374151">
              0
            </text>
            <text x="30" y="145" fontSize="10" fill="#374151">
              {tr.first}
            </text>
            <text x="316" y="145" textAnchor="end" fontSize="10" fill="#374151">
              {tr.last}
            </text>
          </svg>
          <div style={{ display: "flex", gap: "10px", padding: "0 12px 2px", fontSize: "11px", flexWrap: "wrap" }}>
            <span style={{ color: "#1D4ED8", fontWeight: "700" }}>
              ━ {t.received} {tr.tRecv}
            </span>
            <span style={{ color: "#C2410C", fontWeight: "700" }}>
              ┅ {t.workdone} {tr.tDone}
            </span>
            <span style={{ fontWeight: "700" }}>
              ··· {t.reopened} {tr.tReop}
            </span>
          </div>
          <div className="prov">
            {t.src}: pulse/trend · {ms.trend ?? "–"} ms · {stamp} · {liveWord}
          </div>
        </section>
        <section className="panel" style={{ gridColumn: "span 2" }} aria-label={t.fix_title}>
          <h2>
            {t.fix_title}
          </h2>
          <div style={{ display: "flex", gap: "12px", padding: "4px 12px 0" }}>
            <div className="kv">
              <b>
                {fix.med}
              </b>
              <div style={{ fontSize: "11px", color: "#374151" }}>
                {t.median_h}
              </div>
            </div>
            <div className="kv">
              <b style={{ color: "#9A3412" }}>
                {fix.p90}
              </b>
              <div style={{ fontSize: "11px", color: "#374151" }}>
                {t.p90_h}
              </div>
            </div>
          </div>
          <svg viewBox="0 0 200 90" preserveAspectRatio="none" role="img" aria-label={t.fix_title} style={{ flex: "1", minHeight: "0", width: "100%", padding: "2px 8px" }}>
            <polyline points={fix.l90} fill="none" stroke="#9A3412" strokeWidth="2" strokeDasharray="5 3" />
            <polyline points={fix.l50} fill="none" stroke="#1D4ED8" strokeWidth="2.2" />
            <line x1="4" y1="84" x2="196" y2="84" stroke="#9CA3AF" />
          </svg>
          <div className="prov">
            {t.src}: pulse/resolution · {ms.res ?? "–"} ms · {stamp}
          </div>
        </section>
        <section className="panel" style={{ gridColumn: "span 2" }} aria-label={t.sla_title}>
          <h2>
            {t.sla_title}
          </h2>
          <div className="kv" style={{ padding: "4px 12px 0" }}>
            <b style={{ color: "#B91C1C" }}>
              {sla.now}%
            </b>
            <div style={{ fontSize: "11px", color: "#374151" }}>
              {t.sla_today}
            </div>
          </div>
          <svg viewBox="0 0 200 90" preserveAspectRatio="none" role="img" aria-label={t.sla_title} style={{ flex: "1", minHeight: "0", width: "100%", padding: "2px 8px" }}>
            <polyline points={sla.line} fill="none" stroke="#B91C1C" strokeWidth="2.2" />
            <line x1="4" y1="84" x2="196" y2="84" stroke="#9CA3AF" />
          </svg>
          <div className="prov">
            {t.src}: pulse/sla · {ms.sla ?? "–"} ms · {stamp}
          </div>
        </section>
        <section className="panel" style={{ gridColumn: "span 2" }} aria-label={t.ci_title}>
          <h2>
            {t.ci_title}
          </h2>
          <div style={{ padding: "2px 10px", fontSize: "11px", color: "#4B5563" }}>
            {t.ci_help}
          </div>
          <div style={{ padding: "2px 10px", display: "flex", flexDirection: "column", gap: "6px", flex: "1", minHeight: "0", overflow: "auto" }}>
            {integrity.map((r, __i) => (
              <React.Fragment key={__i}>
              <div>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: "12px" }}>
                  <b>
                    {r.dept}
                  </b>
                  <span>
                    n = {r.n}
                  </span>
                </div>
                {!!(r.shown) && (
                  <>
                  <div style={{ display: "flex", height: "12px", border: "1px solid #6B7280", borderRadius: "3px", overflow: "hidden" }}>
                    <i style={css(`width: ${r.a}%; background: #15803D;`)}>
                    </i>
                    <i style={css(`width: ${r.b}%; background: #F59E0B;`)}>
                    </i>
                    <i style={css(`width: ${r.c}%; background: #374151;`)}>
                    </i>
                    <i style={css(`width: ${r.d}%; background: #7C3AED;`)}>
                    </i>
                  </div>
                  <div style={{ fontSize: "10.5px", color: "#374151" }}>
                    {r.text}
                  </div>
                  </>
                )}
                {!!(r.hidden) && (
                  <>
                  <div style={{ fontSize: "11px", color: "#4B5563" }}>
                    {t.ci_hidden}
                  </div>
                  </>
                )}
              </div>
              </React.Fragment>
            ))}
          </div>
          <div style={{ padding: "0 10px", fontSize: "10.5px", color: "#374151", display: "flex", flexWrap: "wrap", gap: "2px 8px" }}>
            <span>
              <i style={{ display: "inline-block", width: "9px", height: "9px", background: "#15803D" }}>
              </i>
              {' '}{t.ci_a}
            </span>
            <span>
              <i style={{ display: "inline-block", width: "9px", height: "9px", background: "#F59E0B" }}>
              </i>
              {' '}{t.ci_b}
            </span>
            <span>
              <i style={{ display: "inline-block", width: "9px", height: "9px", background: "#374151" }}>
              </i>
              {' '}{t.ci_c}
            </span>
            <span>
              <i style={{ display: "inline-block", width: "9px", height: "9px", background: "#7C3AED" }}>
              </i>
              {' '}{t.ci_d}
            </span>
          </div>
          <div className="prov">
            {t.src}: court/integrity · {ms.integ ?? "–"} ms · {stamp} · {t.gen_tag}
          </div>
        </section>
        <section className="panel" style={{ gridColumn: "span 3" }} aria-label={t.feed_title}>
          <h2>
            {t.feed_title}
          </h2>
          <ul style={{ listStyle: "none", margin: "0", padding: "2px 10px", flex: "1", minHeight: "0", overflow: "hidden", display: "flex", flexDirection: "column" }}>
            {feed.map((f, __i) => (
              <React.Fragment key={__i}>
              <li style={{ display: "grid", gridTemplateColumns: "52px 108px minmax(0, 1fr) auto", gap: "6px", padding: "2.5px 0", borderBottom: "1px solid #F3F4F6", fontSize: "12px", alignItems: "center" }}>
                <span style={{ color: "#4B5563" }}>
                  {f.when}
                </span>
                <b>
                  {f.kind}
                </b>
                <span style={{ whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                  {f.text}
                </span>
                {!!(f.synthetic) && (
                  <>
                  <span className="chip" style={{ background: "#FEF3C7", color: "#78350F", fontSize: "10px", padding: "0 5px", minHeight: "16px" }}>
                    {t.gen_tag}
                  </span>
                  </>
                )}
              </li>
              </React.Fragment>
            ))}
          </ul>
          <div className="prov">
            {t.src}: pulse/live · {ms.live ?? "–"} ms · {stamp} · {liveWord}
          </div>
        </section>
      </main>
      <footer style={{ padding: "3px 14px 6px", fontSize: "11px", color: "#4B5563", flex: "none", display: "flex", gap: "14px" }}>
        <span>
          {t.proto}
        </span>
        <span style={{ flex: "1" }}>
        </span>
        <span>
          {t.tz}
        </span>
      </footer>
    </div>
  );
};

export default CivicPulseLogic;
