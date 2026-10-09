import React from 'react';
import { DCLogic, css } from '../lib/dc.js';
import { TLink } from '../lib/TLink.jsx';
import { govRoles, currentRoleKey, switchRole } from '../lib/gov.js';
import { logout, api } from '../lib/client.js';
import './AlertDetail.css';

/* Behaviour and sample data of this screen. Replace the sample data with calls to your API (see docs/DATA.md). */
class AlertDetailLogic extends DCLogic {
state = { lang: 'en', role: currentRoleKey(), id: '', data: null, bad: false, ms: 0, note: '', toast: '' };
ROLES = govRoles();
NAVD = [['/', 'Civic Pulse', 'सिविक पल्स', 'nstcd'], ['/complaints', 'Complaints', 'शिकायतें', 'nstcd'], ['/queue', 'Closure Court', 'क्लोज़र कोर्ट', 'nstcd'], ['/ask', 'Ask the City', 'शहर से पूछें', 'nstcd'], ['/scorecard', 'Scorecard', 'स्कोरकार्ड', 'nstc'], ['/benchmark', 'Benchmark', 'बेंचमार्क', 'n'], ['/health', 'System health', 'सिस्टम स्वास्थ्य', 'n'], ['/audit', 'Audit log', 'ऑडिट लॉग', 'n']];
T = {
en: { brand: 'NyaySetu Gov', generated: 'Generated data', generated_row: 'Generated data', legend: 'Legend', view_as: 'View as', signout: 'Sign out', proto: 'Prototype. Not an official government website. Part of the demo data is generated and labelled as such.',
denied_title: 'This page is not available for your role', denied_body: 'Alert details are for national, state, district and city officials. Choose another role in “View as” or go back.', back_pulse: 'Back to Civic Pulse', back: 'Civic Pulse',
why: 'Why this was flagged', observed: 'Reports in 24 hours', in24: 'observed', expected: 'Expected', usual: 'usual for this place and hour', z_help: 'how unusual (3 or more is flagged)', rule: 'Rule', rule_b: 'reports in 24 h', rule_c: 'the usual', cell: 'Map cell', when: 'When', src: 'Source', live_word: 'Live',
by_cat: 'Reports in this cell over the last 14 days', other_cats: 'Other categories', cluster: 'Complaints in this cluster', c_id: 'Complaint ID', c_cat: 'Category', c_status: 'Status', c_age: 'Age', open_drawer: 'Open', prefilter: 'Open in Complaints, filtered to this area',
where: 'Where', open_cell: 'Open this cell on the Pulse map', open_map: 'Open on the Complaints map', actions: 'What you can do', ack: 'Acknowledge', dismiss: 'Mark as false alarm', reopen: 'Set back to open', note: 'Note', note_ph: 'What did you find or decide?', add_note: 'Add note', history: 'Activity on this alert', cell_history: 'Earlier alerts for this cell', reports: 'Reports',
speak: 'Read this alert aloud', stop: 'Stop', open: 'Open', ack_s: 'Acknowledged', dis_s: 'False alarm', ok_ack: 'Alert acknowledged.', ok_dis: 'Marked as a false alarm.', ok_note: 'Note added.' },
hi: { brand: 'न्यायसेतु शासन', generated: 'जनित डेटा', generated_row: 'जनित डेटा', legend: 'संकेत-सूची', view_as: 'इस रूप में देखें', signout: 'लॉग आउट', proto: 'प्रोटोटाइप। आधिकारिक सरकारी वेबसाइट नहीं। कुछ डेमो डेटा जनित है और उस पर लेबल है।',
denied_title: 'आपकी भूमिका के लिए यह पृष्ठ उपलब्ध नहीं', denied_body: 'अलर्ट विवरण राष्ट्रीय, राज्य, ज़िला और शहर के अधिकारियों के लिए है। “इस रूप में देखें” में दूसरी भूमिका चुनें या वापस जाएँ।', back_pulse: 'सिविक पल्स पर वापस', back: 'सिविक पल्स',
why: 'यह क्यों चिह्नित हुआ', observed: '24 घंटे में शिकायतें', in24: 'देखी गईं', expected: 'अपेक्षित', usual: 'इस जगह और घंटे के लिए सामान्य', z_help: 'कितना असामान्य (3 या अधिक चिह्नित)', rule: 'नियम', rule_b: 'शिकायतें 24 घंटे में', rule_c: 'सामान्य', cell: 'मानचित्र सेल', when: 'कब', src: 'स्रोत', live_word: 'लाइव',
by_cat: 'पिछले 14 दिनों में इस सेल की शिकायतें', other_cats: 'अन्य श्रेणियाँ', cluster: 'इस समूह की शिकायतें', c_id: 'शिकायत संख्या', c_cat: 'श्रेणी', c_status: 'स्थिति', c_age: 'अवधि', open_drawer: 'खोलें', prefilter: 'शिकायतों में इस क्षेत्र के फ़िल्टर के साथ खोलें',
where: 'कहाँ', open_cell: 'इस सेल को पल्स मानचित्र पर खोलें', open_map: 'शिकायत मानचित्र पर खोलें', actions: 'आप क्या कर सकते हैं', ack: 'देखा गया चिह्नित करें', dismiss: 'झूठा अलार्म चिह्नित करें', reopen: 'फिर खुला करें', note: 'टिप्पणी', note_ph: 'आपने क्या पाया या तय किया?', add_note: 'टिप्पणी जोड़ें', history: 'इस अलर्ट की गतिविधि', cell_history: 'इस सेल के पुराने अलर्ट', reports: 'शिकायतें',
speak: 'यह अलर्ट पढ़कर सुनाएँ', stop: 'रोकें', open: 'खुला', ack_s: 'देखा गया', dis_s: 'झूठा अलार्म', ok_ack: 'अलर्ट देखा गया चिह्नित हुआ।', ok_dis: 'झूठा अलार्म चिह्नित हुआ।', ok_note: 'टिप्पणी जोड़ी गई।' }
};
async load() { try { let id = ''; try { id = sessionStorage.getItem('gov.alert') || ''; } catch (e) {} if (!id) { const r0 = await api('/api/pulse/alerts'); if (r0.alerts.length) id = String(r0.alerts[0].id); } if (!id) { this.setState({ none: true }); return; } const t0 = performance.now(); const d = await api('/api/pulse/alerts/' + id); this.setState({ id, data: d, bad: false, none: false, ms: Math.round(performance.now() - t0) }); setTimeout(() => { this._id = ''; this.syncMap(); }, 50); } catch (e) { this.setState({ bad: true }); } }
async act(kind, body) { try { await api('/api/pulse/alerts/' + this.state.id + '/' + (kind === 'reopen' ? 'restore' : kind), { method: 'POST', body: body || {} }); await this.load(); return true; } catch (e) { this.setState({ toast: this.state.lang === 'hi' ? 'कार्रवाई नहीं हो सकी।' : 'That did not work. Nothing was changed.' }); setTimeout(() => this.setState({ toast: '' }), 3500); return false; } }
componentDidMount() { try { const l = localStorage.getItem('gov.lang'); if (l === 'hi' || l === 'en') this.setState({ lang: l }); } catch (e) {} this.load(); setTimeout(() => this.initMap(), 300); }
setLang(l) { try { localStorage.setItem('gov.lang', l); } catch (e) {} this.setState({ lang: l }); }
setRole(r) { switchRole(r); window.location.reload(); }
componentDidUpdate() { this.syncMap(); }
initMap() { try { const el = document.getElementById('amap'); if (!el || !window.L) return; if (this._map && this._mapEl === el) return; const L = window.L; const A0 = this.state.data && this.state.data.alert; const map = L.map(el, { zoomControl: true }); L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19, attribution: '&copy; OpenStreetMap contributors' }).addTo(map); map.setView(A0 && A0.lat != null ? [A0.lat, A0.lng] : [21.19, 81.35], 15); this._map = map; this._mapEl = el; this._lg = L.layerGroup().addTo(map); this._id = ''; setTimeout(() => { try { map.invalidateSize(); } catch (e) {} this.syncMap(); }, 200); } catch (e) {} }
syncMap() { try { const L = window.L; const el = document.getElementById('amap'); if (!L || !el) return; if (!this._map || this._mapEl !== el) { this.initMap(); return; } const A = this.state.data && this.state.data.alert; if (!A || A.lat == null) return; if (this._id === this.state.id) return; this._id = this.state.id; const pos = [A.lat, A.lng]; this._map.setView(pos, 15); this._lg.clearLayers(); const h = 0.0025; L.rectangle([[pos[0] - h, pos[1] - h], [pos[0] + h, pos[1] + h]], { color: '#B91C1C', weight: 3, fillColor: '#F97316', fillOpacity: 0.45 }).addTo(this._lg); (this.state.data.cluster || []).forEach((c, i) => { /* complaints carry no coordinates here: shown in the list */ }); } catch (e) {} }
renderVals() {
const s = this.state; const l = s.lang; const t = this.T[l]; const L = l === 'hi' ? 1 : 0; const ro = this.ROLES[s.role] || Object.values(this.ROLES)[0]; const rc = ro[5];
const nav = this.NAVD.filter((n) => n[3].indexOf(rc) >= 0).map((n) => ({ href: n[0], label: n[1 + L], cls: n[0] === '/' ? 'on' : '', cur: n[0] === '/' ? 'page' : 'false' }));
const allowed = rc !== 'd'; const D = s.data; const A = D ? D.alert : null; const title = (c) => String(c || '').replace(/_/g, ' ').toLowerCase().replace(/^./, (x) => x.toUpperCase());
const fmtT = (iso) => new Date(iso).toLocaleString(l === 'hi' ? 'hi-IN' : 'en-IN', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Kolkata' });
const cur = A ? ({ open: 'open', acknowledged: 'ack', dismissed: 'dis' }[A.status] || 'open') : 'open';
const stm = { open: [t.open, 'background:#FEE2E2;color:#7F1D1D;'], ack: [t.ack_s, 'background:#DBEAFE;color:#1E3A8A;'], dis: [t.dis_s, 'background:#E5E7EB;color:#1F2937;'] };
const raw = D ? D.bars : []; const mxv = Math.max(10, ...raw.map((b) => (b.this_cat || 0) + (b.other || 0))); const sc = 118 / mxv;
const bars = raw.slice(-14).map((b, i) => { const hot = (b.this_cat || 0) * sc, oth = (b.other || 0) * sc; return { x: 40 + i * 34, tx: 51 + i * 34, y1: 126 - hot, h1: hot, y2: 126 - hot - oth, h2: oth, label: new Date(b.day).getUTCDate() + '' }; });
const NOTE = { ack: t.ack_s, dismiss: t.dis_s, reopen: L ? 'फिर से खोला गया' : 'Reopened', note: '' };
const hist = (D ? D.notes : []).map((n) => fmtT(n.at) + ' · ' + n.user_name + (n.action === 'note' ? ': ' + n.text : ': ' + NOTE[n.action])).concat(A ? [fmtT(A.at) + ' · ' + (L ? 'नियम से बनाया गया (z ≥ 3)' : 'created by the rule (z ≥ 3)')] : []);
const ageOf = (iso) => { const m = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 60000)); return m >= 1440 ? Math.floor(m / 1440) + ' d' : m >= 60 ? Math.floor(m / 60) + ' h' : m + ' min'; };
const cluster = (D ? D.cluster : []).map((c) => ({ code: c.code, cat: (c.category_names[l] || c.category_names.en), status: String(c.status).replace(/_/g, ' ').toLowerCase(), age: ageOf(c.created_at) }));
const al = A ? { cat: title(A.category_l1), city: String(A.city_id || '').split('.').pop().replace(/^./, (x) => x.toUpperCase()), obs: A.observed, exp: Number(A.expected).toFixed(1), z: Number(A.zscore).toFixed(1), syn: A.synthetic, cell: A.cell ? (L ? '500 मी सेल, लगभग ' : '500 m cell near ') + Number(A.lat).toFixed(4) + ' N, ' + Number(A.lng).toFixed(4) + ' E' : '', when: fmtT(A.at) + ' IST' } : { cat: '', city: '', obs: 0, exp: '0', z: '0', syn: false, cell: '', when: '' };
const act = (kind) => () => { this.act(kind).then((ok) => { if (ok) { this.setState({ toast: kind === 'ack' ? t.ok_ack : kind === 'dismiss' ? t.ok_dis : '' }); setTimeout(() => this.setState({ toast: '' }), 3500); } }); };
return { t, nav, role: s.role, roleOpts: Object.keys(this.ROLES).map((k) => ({ v: k, l: this.ROLES[k][3 + L] })), onRole: (e) => this.setRole(e.target.value), isEn: l === 'en', isHi: l === 'hi', setEn: () => this.setLang('en'), setHi: () => this.setLang('hi'), user: ro[0], scope: ro[1 + L],
allowed, denied: !allowed, bad: this.state.bad, none: !!this.state.none, a: { cat: al.cat, city: al.city, obs: al.obs, exp: al.exp, z: al.z, synthetic: al.syn, cell: al.cell, when: al.when, stText: stm[cur][0], stStyle: stm[cur][1], acked: cur === 'ack' }, bars, barMax: mxv, cluster, bad: s.bad, none: s.none, ms: s.ms, idText: s.id ? 'A-' + s.id : '',
history: hist, cellHist: (D ? D.earlier : []).map((e) => ({ when: fmtT(e.at), status: ({ open: t.open, acknowledged: t.ack_s, dismissed: t.dis_s }[e.status] || e.status), n: e.observed })),
ack: act('ack'),
dismiss: act('dismiss'),
reopenAlert: act('reopen'),
note: s.note, onNote: (e) => this.setState({ note: e.target.value }), addNote: () => { const n = this.state.note.trim(); if (!n) return; this.act('note', { note: n }).then((ok) => { if (ok) { this.setState({ note: '', toast: t.ok_note }); setTimeout(() => this.setState({ toast: '' }), 3000); } }); },
speakLabel: t.speak, speak: () => { try { const u = new SpeechSynthesisUtterance(al.cat + ' in ' + al.city + '. ' + al.obs + ' reports in 24 hours, about ' + al.exp + ' expected.'); u.lang = 'en-IN'; window.speechSynthesis.cancel(); window.speechSynthesis.speak(u); } catch (e) {} },
toast: s.toast };
}
}

AlertDetailLogic.prototype.view = function view(__v) {
  const { bad, none, a, ack, addNote, allowed, b, barMax, bars, c, cellHist, cluster, denied, dismiss, h, history, isEn, isHi, n, nav, note, o, onNote, onRole, reopenAlert, role, roleOpts, scope, setEn, setHi, speak, speakLabel, t, toast, user } = __v;
  return (
    <div className="sc-alert" style={{ width: "100%", minHeight: "100vh", display: "flex", flexDirection: "column", background: "#FFFFFF", color: "#111827", fontFamily: "'Noto Sans','Noto Sans Devanagari',system-ui,sans-serif", fontSize: "14px", lineHeight: "1.4" }}>
      <header style={{ minHeight: "52px", background: "#1F2937", color: "#FFFFFF", display: "flex", alignItems: "center", padding: "0 16px", gap: "10px", flex: "none" }}>
        <strong style={{ fontSize: "16px", whiteSpace: "nowrap" }}>
          {t.brand}
        </strong>
        <span style={{ fontSize: "11px", padding: "1px 7px", border: "1px solid #9CA3AF", borderRadius: "4px", color: "#E5E7EB", whiteSpace: "nowrap" }}>
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
      {(!!bad || !!none) && (<div role="alert" style={{ margin: "8px 20px 0", padding: "8px 12px", background: "#FEF3C7", border: "1px solid #F59E0B", borderRadius: "6px", color: "#78350F", fontWeight: "600" }}>{none ? (isHi ? "अभी कोई अलर्ट नहीं है।" : "There are no alerts yet.") : (isHi ? "अलर्ट लोड नहीं हो सका।" : "The alert could not be loaded.")}</div>)}
      <main style={{ width: "100%", maxWidth: "1560px", margin: "0 auto", padding: "14px 20px 24px", display: "flex", flexDirection: "column", gap: "12px" }}>
        {!!(denied) && (
          <>
          <div role="alert" style={{ padding: "40px", background: "#fff", border: "0", borderTop: "3px solid #1F2937", borderRadius: "0", textAlign: "center" }}>
            <h1 style={{ margin: "0 0 8px", fontSize: "22px" }}>
              {t.denied_title}
            </h1>
            <div style={{ color: "#4B5563" }}>
              {t.denied_body}
            </div>
            <div style={{ marginTop: "14px" }}>
              <TLink to="/" className="btn pri">
                {t.back_pulse}
              </TLink>
            </div>
          </div>
          </>
        )}
        {!!(allowed) && (
          <>
          <div style={{ display: "flex", alignItems: "center", gap: "12px", flexWrap: "wrap" }}>
            <TLink to="/" className="btn">
              ← {t.back}
            </TLink>
            <h1 style={{ margin: "0", fontSize: "22px" }}>
              {a.cat} · {a.city}
            </h1>
            <span className="chip" style={css(a.stStyle)}>
              {a.stText}
            </span>
            {!!(a.synthetic) && (
              <>
              <span className="chip" style={{ background: "#FEF3C7", color: "#78350F" }}>
                {t.generated_row}
              </span>
              </>
            )}
            <span style={{ flex: "1" }}>
            </span>
            <button type="button" className="btn" onClick={speak}>
              {speakLabel}
            </button>
          </div>
          {!!(toast) && (
            <>
            <div role="status" style={{ padding: "8px 12px", background: "#DCFCE7", border: "1px solid #86EFAC", borderRadius: "6px", color: "#14532D", fontWeight: "600" }}>
              {toast}
            </div>
            </>
          )}
          <div style={{ display: "grid", gridTemplateColumns: "minmax(0, 1.1fr) minmax(0, 1fr)", gap: "12px", alignItems: "start" }}>
            <div style={{ display: "flex", flexDirection: "column", gap: "12px", minWidth: "0" }}>
              <section className="card">
                <h2>
                  {t.why}
                </h2>
                <div style={{ display: "flex", gap: "28px", flexWrap: "wrap" }}>
                  <div>
                    <div style={{ fontSize: "12px", color: "#4B5563", fontWeight: "600" }}>
                      {t.observed}
                    </div>
                    <b style={{ fontSize: "36px", color: "#B91C1C" }}>
                      {a.obs}
                    </b>
                    <div style={{ fontSize: "12px", color: "#4B5563" }}>
                      {t.in24}
                    </div>
                  </div>
                  <div>
                    <div style={{ fontSize: "12px", color: "#4B5563", fontWeight: "600" }}>
                      {t.expected}
                    </div>
                    <b style={{ fontSize: "36px" }}>
                      {a.exp}
                    </b>
                    <div style={{ fontSize: "12px", color: "#4B5563" }}>
                      {t.usual}
                    </div>
                  </div>
                  <div>
                    <div style={{ fontSize: "12px", color: "#4B5563", fontWeight: "600" }}>
                      z-score
                    </div>
                    <b style={{ fontSize: "36px" }}>
                      {a.z}
                    </b>
                    <div style={{ fontSize: "12px", color: "#4B5563" }}>
                      {t.z_help}
                    </div>
                  </div>
                </div>
                <dl className="kv">
                  <dt>
                    {t.rule}
                  </dt>
                  <dd>
                    z ≥ 3, ≥ 8 {t.rule_b}, 3× {t.rule_c}
                  </dd>
                  <dt>
                    {t.cell}
                  </dt>
                  <dd>
                    {a.cell}
                  </dd>
                  <dt>
                    {t.when}
                  </dt>
                  <dd>
                    {a.when}
                  </dd>
                  <dt>
                    {t.src}
                  </dt>
                  <dd>
                    pulse/alerts · 22 ms ·{' '}
                    <span className="chip" style={{ background: "#E5E7EB", color: "#1F2937" }}>
                      {t.live_word}
                    </span>
                  </dd>
                </dl>
              </section>
              <section className="card">
                <h2>
                  {t.by_cat}
                </h2>
                <svg viewBox="0 0 520 150" role="img" aria-label={t.by_cat} style={{ width: "100%" }}>
                  <line x1="30" y1="126" x2="516" y2="126" stroke="#9CA3AF" />
                  {bars.map((b, __i) => (
                    <React.Fragment key={__i}>
                    <rect x={b.x} y={b.y1} width="22" height={b.h1} fill="#7F1D1D" />
                    <rect x={b.x} y={b.y2} width="22" height={b.h2} fill="#F59E0B" />
                    <text x={b.tx} y="141" fontSize="10" textAnchor="middle" fill="#374151">
                      {b.label}
                    </text>
                    </React.Fragment>
                  ))}
                  <text x="26" y="12" fontSize="10" textAnchor="end" fill="#374151">
                    {barMax}
                  </text>
                </svg>
                <div style={{ fontSize: "12px", display: "flex", gap: "14px" }}>
                  <span>
                    <i style={{ display: "inline-block", width: "10px", height: "10px", background: "#7F1D1D" }}>
                    </i>
                    {' '}{a.cat}
                  </span>
                  <span>
                    <i style={{ display: "inline-block", width: "10px", height: "10px", background: "#F59E0B" }}>
                    </i>
                    {' '}{t.other_cats}
                  </span>
                </div>
              </section>
              <section className="card">
                <h2>
                  {t.cluster} ({cluster.length})
                </h2>
                <table>
                  <thead>
                    <tr>
                      <th scope="col">
                        {t.c_id}
                      </th>
                      <th scope="col">
                        {t.c_cat}
                      </th>
                      <th scope="col">
                        {t.c_status}
                      </th>
                      <th scope="col">
                        {t.c_age}
                      </th>
                      <th scope="col">
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {cluster.map((c, __i) => (
                      <React.Fragment key={__i}>
                      <tr>
                        <td style={{ fontWeight: "700", fontFamily: "ui-monospace, Menlo, monospace" }}>
                          {c.code}
                        </td>
                        <td>
                          {c.cat}
                        </td>
                        <td>
                          {c.status}
                        </td>
                        <td>
                          {c.age}
                        </td>
                        <td>
                          <TLink to="/complaints" className="btn sm">
                            {t.open_drawer}
                          </TLink>
                        </td>
                      </tr>
                      </React.Fragment>
                    ))}
                  </tbody>
                </table>
                <TLink to="/complaints" className="btn" style={{ alignSelf: "flex-start" }}>
                  {t.prefilter} →
                </TLink>
              </section>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: "12px", minWidth: "0" }}>
              <section className="card">
                <h2>
                  {t.where}
                </h2>
                <div style={{ position: "relative", isolation: "isolate", height: "460px", border: "1px solid #9CA3AF", borderRadius: "6px", overflow: "hidden", background: "#E5E7EB" }}>
                  <div id="amap" style={{ position: "absolute", inset: "0" }}>
                  </div>
                </div>
                <div style={{ display: "flex", gap: "8px" }}>
                  <TLink to="/" className="btn">
                    {t.open_cell}
                  </TLink>
                  <TLink to="/complaints" className="btn">
                    {t.open_map}
                  </TLink>
                </div>
              </section>
              <section className="card">
                <h2>
                  {t.actions}
                </h2>
                <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
                  <button type="button" className="btn pri" onClick={ack} disabled={a.acked}>
                    {t.ack}
                  </button>
                  <button type="button" className="btn" onClick={dismiss}>
                    {t.dismiss}
                  </button>
                  <button type="button" className="btn" onClick={reopenAlert}>
                    {t.reopen}
                  </button>
                </div>
                <label className="field">
                  {t.note}
                  <textarea rows="5" value={note} onChange={onNote} placeholder={t.note_ph}>
                  </textarea>
                </label>
                <div>
                  <button type="button" className="btn" onClick={addNote}>
                    {t.add_note}
                  </button>
                </div>
                <div style={{ fontSize: "12.5px" }}>
                  <b>
                    {t.history}
                  </b>
                </div>
                <ul style={{ margin: "0", paddingLeft: "18px", fontSize: "13px" }}>
                  {history.map((h, __i) => (
                    <React.Fragment key={__i}>
                    <li>
                      {h}
                    </li>
                    </React.Fragment>
                  ))}
                </ul>
              </section>
              <section className="card">
                <h2>
                  {t.cell_history}
                </h2>
                <table>
                  <thead>
                    <tr>
                      <th scope="col">
                        {t.when}
                      </th>
                      <th scope="col">
                        {t.c_status}
                      </th>
                      <th scope="col">
                        {t.reports}
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {cellHist.map((h, __i) => (
                      <React.Fragment key={__i}>
                      <tr>
                        <td>
                          {h.when}
                        </td>
                        <td>
                          {h.status}
                        </td>
                        <td>
                          {h.n}
                        </td>
                      </tr>
                      </React.Fragment>
                    ))}
                  </tbody>
                </table>
              </section>
            </div>
          </div>
          </>
        )}
      </main>
      <footer style={{ padding: "10px 20px", fontSize: "12px", color: "#4B5563", borderTop: "1px solid #D1D5DB", background: "#fff", marginTop: "auto" }}>
        {t.proto}
      </footer>
    </div>
  );
};

export default AlertDetailLogic;
