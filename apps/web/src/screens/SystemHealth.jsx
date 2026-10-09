import React from 'react';
import { DCLogic, css } from '../lib/dc.js';
import { TLink } from '../lib/TLink.jsx';
import { govRoles, currentRoleKey, switchRole } from '../lib/gov.js';
import { logout, api } from '../lib/client.js';
import './SystemHealth.css';

/* Behaviour and sample data of this screen. Replace the sample data with calls to your API (see docs/DATA.md). */
class SystemHealthLogic extends DCLogic {
state = { lang: 'en', role: currentRoleKey(), h: null, bad: false, ms: 0 };
ROLES = govRoles();
NAVD = [['/', 'Civic Pulse', 'सिविक पल्स', 'nstcd'], ['/complaints', 'Complaints', 'शिकायतें', 'nstcd'], ['/queue', 'Closure Court', 'क्लोज़र कोर्ट', 'nstcd'], ['/ask', 'Ask the City', 'शहर से पूछें', 'nstcd'], ['/scorecard', 'Scorecard', 'स्कोरकार्ड', 'nstc'], ['/benchmark', 'Benchmark', 'बेंचमार्क', 'n'], ['/health', 'System health', 'सिस्टम स्वास्थ्य', 'n'], ['/audit', 'Audit log', 'ऑडिट लॉग', 'n']];
T = {
en: { brand: 'NyaySetu Gov', generated: 'Generated data', legend: 'Legend', view_as: 'View as', signout: 'Sign out', proto: 'Prototype. Sample values for the design.',
denied_title: 'This page is not available for your role', denied_body: 'System health is for the national administrator only.', back_pulse: 'Back to Civic Pulse',
title: 'System health: the AI layer', sub: 'Built to fail safely. Everything here is for the last hour.', preview_state: 'Preview a state',
degraded_title: 'Which features are running in a reduced way', models: 'Models and what they were used for', models_help: 'One row per model and purpose.', model: 'Model', purpose: 'Purpose', calls: 'Calls', errors: 'Errors', avg: 'Average time', p95: '95th percentile', circuit: 'Circuit', src: 'Source',
chain: 'Fallback chain', chain_help: 'If the first model fails, the next one is tried. The last column shows which one answered recent calls.', startup: 'Start-up model check', latency: 'Response time per minute (95th percentile)', latency_help: 'Each line is one model. A rising line is early warning.', now: 'now', taxonomy: 'Kinds of errors', taxonomy_help: 'Counted in the last hour.' },
hi: { brand: 'न्यायसेतु शासन', generated: 'जनित डेटा', legend: 'संकेत-सूची', view_as: 'इस रूप में देखें', signout: 'लॉग आउट', proto: 'प्रोटोटाइप। डिज़ाइन के नमूना मान।',
denied_title: 'आपकी भूमिका के लिए यह पृष्ठ उपलब्ध नहीं', denied_body: 'सिस्टम स्वास्थ्य केवल राष्ट्रीय प्रशासक के लिए है।', back_pulse: 'सिविक पल्स पर वापस',
title: 'सिस्टम स्वास्थ्य: AI परत', sub: 'सुरक्षित रूप से विफल होने के लिए बनाई गई। यहाँ सब कुछ पिछले एक घंटे का है।', preview_state: 'कोई स्थिति देखें',
degraded_title: 'कौन सी सुविधाएँ सीमित रूप से चल रही हैं', models: 'मॉडल और उनका उपयोग', models_help: 'हर मॉडल और उद्देश्य की एक पंक्ति।', model: 'मॉडल', purpose: 'उद्देश्य', calls: 'कॉल', errors: 'त्रुटियाँ', avg: 'औसत समय', p95: '95वाँ प्रतिशतक', circuit: 'सर्किट', src: 'स्रोत',
chain: 'वैकल्पिक मॉडल क्रम', chain_help: 'पहला मॉडल विफल हो तो अगला आज़माया जाता है। आख़िरी स्तंभ बताता है कि हाल के कॉल किसने उत्तर दिए।', startup: 'शुरू में मॉडल की जाँच', latency: 'प्रति मिनट प्रतिक्रिया समय (95वाँ प्रतिशतक)', latency_help: 'हर रेखा एक मॉडल है। ऊपर जाती रेखा पहली चेतावनी है।', now: 'अभी', taxonomy: 'त्रुटियों के प्रकार', taxonomy_help: 'पिछले एक घंटे में गिनी गईं।' }
};
async load() { try { const t0 = performance.now(); const h = await api('/api/health/ai'); this.setState({ h, bad: false, ms: Math.round(performance.now() - t0) }); } catch (e) { this.setState({ bad: true }); } }
componentDidMount() { try { const l = localStorage.getItem('gov.lang'); if (l === 'hi' || l === 'en') this.setState({ lang: l });  } catch (e) {} if (this.state.role === 'national') { this.load(); this._iv = setInterval(() => { if (!document.hidden) this.load(); }, 10000); } }
componentWillUnmount() { clearInterval(this._iv); }
setLang(l) { try { localStorage.setItem('gov.lang', l); } catch (e) {} this.setState({ lang: l }); }
setRole(r) { switchRole(r); window.location.reload(); }
renderVals() {
const s = this.state; const l = s.lang; const t = this.T[l]; const L = l === 'hi' ? 1 : 0; const ro = this.ROLES[s.role] || Object.values(this.ROLES)[0]; const rc = ro[5];
const nav = this.NAVD.filter((n) => n[3].indexOf(rc) >= 0).map((n) => ({ href: n[0], label: n[1 + L], cls: n[0] === '/health' ? 'on' : '', cur: n[0] === '/health' ? 'page' : 'false' }));
const allowed = rc === 'n'; const H = s.h || { models: [], series: [], circuits: [], chain: [], errors: {}, startup: null };
const okS = 'background:#DCFCE7;color:#14532D;', warnS = 'background:#FEF3C7;color:#78350F;', badS = 'background:#FEE2E2;color:#7F1D1D;';
const circ = (m) => H.circuits.find((c) => c.model === m);
const cc = (c) => { const st = c ? c.circuit : 'closed'; if (st === 'open') { const mins = c.opensUntil ? Math.max(1, Math.round((new Date(c.opensUntil) - Date.now()) / 60000)) : 1; return ['✕', L ? 'खुला: ' + mins + ' मिनट में बंद होगा' : 'Open: closes in ' + mins + ' min', badS]; } return ['●', L ? 'बंद (सामान्य)' : 'Closed (normal)', okS]; };
const PUR = { 'vision-examiner': ['Assessment (pass A)', 'आकलन (पास A)'], 'vision-cross': ['Assessment (pass B)', 'आकलन (पास B)'], contract: ['Contract writing', 'अनुबंध लेखन'], 'vision-instruction-scan': ['Text-in-image scan', 'छवि में पाठ की जाँच'], understand: ['Understanding a complaint', 'शिकायत समझना'], embed: ['Embeddings (reuse check)', 'एम्बेडिंग (पुनः उपयोग जाँच)'], proof_gates: ['Proof gates', 'प्रमाण जाँच'] };
const rows = H.models.map((m) => { const q = cc(circ(m.model)); const e = m.errors; return { model: m.model, purpose: (PUR[m.purpose] || [m.purpose, m.purpose])[L], calls: m.calls, errors: e, avg: m.avg_ms, p95: m.p95_ms, errStyle: e > 5 ? 'color:#B91C1C;' : '', cSym: q[0], cText: q[1], cStyle: q[2] }; });
const openModels = H.circuits.filter((c) => c.circuit === 'open').map((c) => c.model);
const featDefs = [[L ? 'क्लोज़र कोर्ट आकलन' : 'Closure Court assessment', ['vision-examiner', 'vision-cross']], [L ? 'अनुबंध लेखन' : 'Contract writing', ['contract']], [L ? 'शिकायत समझना' : 'Understanding a complaint', ['understand']], [L ? 'पुनः उपयोग जाँच' : 'Reuse check', ['embed']]];
const features = featDefs.map((f) => { const degraded = H.models.some((m) => f[1].indexOf(m.purpose) >= 0 && openModels.indexOf(m.model) >= 0); return { name: f[0], sym: degraded ? '!' : '✓', text: degraded ? (L ? 'सीमित मोड' : 'Degraded mode') : (L ? 'सामान्य' : 'Normal'), note: degraded ? (L ? 'मामले व्यक्ति के पास जा रहे हैं' : 'cases go to human review') : (L ? 'कोई समस्या नहीं' : 'no action needed'), bg: degraded ? '#FFFBEB' : '#F0FDF4', border: degraded ? '#F59E0B' : '#86EFAC' }; });
const fallback = H.chain.map((m, i) => ({ n: i + 1, model: m, note: i === 0 ? (L ? 'मुख्य' : 'Primary') : (L ? 'विकल्प ' + i : 'Fallback ' + i), served: ((circ(m) || {}).served || 0) + (L ? ' कॉल' : ' calls') })).concat([{ n: H.chain.length + 1, model: L ? 'व्यक्ति की समीक्षा' : 'Human review', note: L ? 'अंतिम विकल्प · AI के बिना' : 'Last resort · no AI', served: '–' }]);
const SU = H.startup; const startup = SU ? SU.available.map((m) => ({ model: m, sym: '✓', text: L ? 'उपलब्ध' : 'Available', style: okS, note: (L ? 'जाँचा गया ' : 'checked ') + new Date(SU.at).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Kolkata' }) + ' IST' })).concat(SU.missing.map((m) => ({ model: m, sym: '✕', text: L ? 'अनुपलब्ध' : 'Not on this key', style: badS, note: L ? 'सेट किया गया पर इस कुंजी पर नहीं मिला' : 'configured but not available' }))) : [];
const byModel = {}; H.series.forEach((p) => { (byModel[p.model] = byModel[p.model] || []).push(p); });
const top = Object.keys(byModel).sort((x, y) => byModel[y].length - byModel[x].length).slice(0, 3);
const line = (m) => { const a = (byModel[m] || []).slice(-60); return a.map((p, i) => (40 + i * (590 / Math.max(1, a.length - 1))).toFixed(0) + ',' + (150 - (Math.min(8, p.avg_ms / 1000) / 8) * 142).toFixed(0)).join(' '); };
const lines = { a: top[0] ? line(top[0]) : '', b: top[1] ? line(top[1]) : '', c: top[2] ? line(top[2]) : '' };
const KL = [['TIMEOUT', 'Timeout', 'समय सीमा पार (timeout)'], ['RATE_LIMIT', 'Rate limit', 'दर सीमा (rate limit)'], ['MODEL_GONE', 'Model retired', 'मॉडल हटाया गया'], ['SCHEMA', 'Schema violation', 'स्कीमा उल्लंघन'], ['SAFETY', 'Safety block', 'सुरक्षा ब्लॉक']];
const errs0 = KL.map((k) => [L ? k[2] : k[1], H.errors[k[0]] || 0]); const mx = Math.max(1, ...errs0.map((e) => e[1]));
return { t, nav, role: s.role, roleOpts: Object.keys(this.ROLES).map((k) => ({ v: k, l: this.ROLES[k][3 + L] })), onRole: (e) => this.setRole(e.target.value), isEn: l === 'en', isHi: l === 'hi', setEn: () => this.setLang('en'), setHi: () => this.setLang('hi'), user: ro[0], scope: ro[1 + L],
allowed, denied: !allowed, bad: s.bad, ms: s.ms, pstate: 'normal', onP: () => {}, pOpts: [],
features, rows, fallback, startup, lines, errs: errs0.map((e) => ({ name: e[0], n: e[1], pct: Math.round(e[1] / mx * 100) })) };
}
}

SystemHealthLogic.prototype.view = function view(__v) {
  const { bad, ms, allowed, denied, e, errs, f, fallback, features, isEn, isHi, lines, n, nav, o, onP, onRole, pOpts, pstate, r, role, roleOpts, rows, s, scope, setEn, setHi, startup, t, user } = __v;
  return (
    <div className="sc-health" style={{ width: "100%", minHeight: "100vh", display: "flex", flexDirection: "column", background: "#FFFFFF", color: "#111827", fontFamily: "'Noto Sans','Noto Sans Devanagari',system-ui,sans-serif", fontSize: "14px", lineHeight: "1.4" }}>
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
            <h1 style={{ margin: "0", fontSize: "22px" }}>
              {t.title}
            </h1>
            <span style={{ color: "#4B5563" }}>
              {t.sub}
            </span>
            <span style={{ flex: "1" }}>
            </span>
          </div>
          <section className="card" aria-label={t.degraded_title}>
            <h2>
              {t.degraded_title}
            </h2>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(4, minmax(0, 1fr))", gap: "8px" }}>
              {features.map((f, __i) => (
                <React.Fragment key={__i}>
                <div style={css(`border: 1px solid ${f.border}; background: ${f.bg}; border-radius: 6px; padding: 8px 10px;`)}>
                  <b>
                    {f.name}
                  </b>
                  <div style={{ fontWeight: "700" }}>
                    {f.sym} {f.text}
                  </div>
                  <div className="sub">
                    {f.note}
                  </div>
                </div>
                </React.Fragment>
              ))}
            </div>
          </section>
          <div style={{ display: "grid", gridTemplateColumns: "minmax(0, 1.5fr) minmax(0, 1fr)", gap: "12px", alignItems: "start" }}>
            <section className="card">
              <h2>
                {t.models}
              </h2>
              <div className="sub">
                {t.models_help}
              </div>
              <table>
                <thead>
                  <tr>
                    <th scope="col">
                      {t.model}
                    </th>
                    <th scope="col">
                      {t.purpose}
                    </th>
                    <th scope="col" style={{ textAlign: "right" }}>
                      {t.calls}
                    </th>
                    <th scope="col" style={{ textAlign: "right" }}>
                      {t.errors}
                    </th>
                    <th scope="col" style={{ textAlign: "right" }}>
                      {t.avg}
                    </th>
                    <th scope="col" style={{ textAlign: "right" }}>
                      {t.p95}
                    </th>
                    <th scope="col">
                      {t.circuit}
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r, __i) => (
                    <React.Fragment key={__i}>
                    <tr>
                      <td style={{ fontFamily: "ui-monospace, Menlo, monospace", fontSize: "12.5px" }}>
                        {r.model}
                      </td>
                      <td>
                        {r.purpose}
                      </td>
                      <td style={{ textAlign: "right" }}>
                        {r.calls}
                      </td>
                      <td style={css(`text-align:right;font-weight:700;${r.errStyle}`)}>
                        {r.errors}
                      </td>
                      <td style={{ textAlign: "right" }}>
                        {r.avg} ms
                      </td>
                      <td style={{ textAlign: "right" }}>
                        {r.p95} ms
                      </td>
                      <td>
                        <span className="chip" style={css(r.cStyle)}>
                          {r.cSym} {r.cText}
                        </span>
                      </td>
                    </tr>
                    </React.Fragment>
                  ))}
                </tbody>
              </table>
              <div className="sub">
                {t.src}: health/ai · {ms} ms · {isHi ? 'पिछला घंटा' : 'last hour'}{bad ? (isHi ? ' · लोड नहीं हो सका' : ' · could not load') : ''}
              </div>
            </section>
            <section className="card">
              <h2>
                {t.chain}
              </h2>
              <div className="sub">
                {t.chain_help}
              </div>
              <ol style={{ margin: "0", padding: "0", listStyle: "none", display: "flex", flexDirection: "column", gap: "6px" }}>
                {fallback.map((f, __i) => (
                  <React.Fragment key={__i}>
                  <li style={{ display: "grid", gridTemplateColumns: "28px 1fr auto", gap: "8px", alignItems: "center", border: "1px solid #D1D5DB", borderRadius: "6px", padding: "7px 10px" }}>
                    <span className="chip" style={{ background: "#111827", color: "#fff" }}>
                      {f.n}
                    </span>
                    <span>
                      <b style={{ fontFamily: "ui-monospace, Menlo, monospace", fontSize: "12.5px" }}>
                        {f.model}
                      </b>
                      <span className="sub" style={{ display: "block" }}>
                        {f.note}
                      </span>
                    </span>
                    <span style={{ fontWeight: "700" }}>
                      {f.served}
                    </span>
                  </li>
                  </React.Fragment>
                ))}
              </ol>
              <h2 style={{ marginTop: "6px" }}>
                {t.startup}
              </h2>
              <ul style={{ margin: "0", padding: "0", listStyle: "none", display: "flex", flexDirection: "column", gap: "4px" }}>
                {startup.map((s, __i) => (
                  <React.Fragment key={__i}>
                  <li style={{ fontSize: "13px" }}>
                    <span className="chip" style={css(s.style)}>
                      {s.sym} {s.text}
                    </span>
                    <b style={{ fontFamily: "ui-monospace, Menlo, monospace", fontSize: "12.5px" }}>
                      {s.model}
                    </b>
                    <span className="sub">
                      {s.note}
                    </span>
                  </li>
                  </React.Fragment>
                ))}
              </ul>
            </section>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "minmax(0, 1.5fr) minmax(0, 1fr)", gap: "12px", alignItems: "start" }}>
            <section className="card">
              <h2>
                {t.latency}
              </h2>
              <div className="sub">
                {t.latency_help}
              </div>
              <svg viewBox="0 0 640 180" role="img" aria-label={t.latency} style={{ width: "100%" }}>
                <line x1="40" y1="150" x2="636" y2="150" stroke="#9CA3AF" />
                <line x1="40" y1="8" x2="40" y2="150" stroke="#9CA3AF" />
                <polyline points={lines.a} fill="none" stroke="#1D4ED8" strokeWidth="2.2" />
                <polyline points={lines.b} fill="none" stroke="#B45309" strokeWidth="2.2" strokeDasharray="6 3" />
                <polyline points={lines.c} fill="none" stroke="#111827" strokeWidth="2" strokeDasharray="2 3" />
                <text x="36" y="14" fontSize="11" textAnchor="end" fill="#374151">
                  8 s
                </text>
                <text x="36" y="150" fontSize="11" textAnchor="end" fill="#374151">
                  0
                </text>
                <text x="40" y="168" fontSize="11" fill="#374151">
                  −60 min
                </text>
                <text x="636" y="168" fontSize="11" textAnchor="end" fill="#374151">
                  {t.now}
                </text>
              </svg>
              <div style={{ fontSize: "12px", display: "flex", gap: "14px" }}>
                <span style={{ color: "#1D4ED8", fontWeight: "700" }}>
                  ━ gemini-3.5-flash (assess)
                </span>
                <span style={{ color: "#B45309", fontWeight: "700" }}>
                  ┅ gemini-3.5-flash-lite (fallback)
                </span>
                <span style={{ fontWeight: "700" }}>
                  ··· gemini-embedding-001
                </span>
              </div>
            </section>
            <section className="card">
              <h2>
                {t.taxonomy}
              </h2>
              <div className="sub">
                {t.taxonomy_help}
              </div>
              <table>
                <tbody>
                  {errs.map((e, __i) => (
                    <React.Fragment key={__i}>
                    <tr>
                      <td>
                        {e.name}
                      </td>
                      <td style={{ textAlign: "right", fontWeight: "700" }}>
                        {e.n}
                      </td>
                      <td style={{ width: "45%" }}>
                        <div style={{ height: "10px", background: "#E5E7EB", borderRadius: "5px" }}>
                          <div style={css(`height: 10px; width: ${e.pct}%; background: #B45309; border-radius: 5px;`)}>
                          </div>
                        </div>
                      </td>
                    </tr>
                    </React.Fragment>
                  ))}
                </tbody>
              </table>
            </section>
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

export default SystemHealthLogic;
