import React from 'react';
import { DCLogic, css } from '../lib/dc.js';
import { TLink } from '../lib/TLink.jsx';
import { govRoles, currentRoleKey, switchRole } from '../lib/gov.js';
import { logout, api } from '../lib/client.js';
import './Benchmark.css';

/* Behaviour and sample data of this screen. Replace the sample data with calls to your API (see docs/DATA.md). */
class BenchmarkLogic extends DCLogic {
state = { lang: 'en', role: currentRoleKey(), running: false, pct: 0, runN: 0, race: null, hist: [], pols: null, bad: false };
ROLES = govRoles();
NAVD = [['/', 'Civic Pulse', 'सिविक पल्स', 'nstcd'], ['/complaints', 'Complaints', 'शिकायतें', 'nstcd'], ['/queue', 'Closure Court', 'क्लोज़र कोर्ट', 'nstcd'], ['/ask', 'Ask the City', 'शहर से पूछें', 'nstcd'], ['/scorecard', 'Scorecard', 'स्कोरकार्ड', 'nstc'], ['/benchmark', 'Benchmark', 'बेंचमार्क', 'n'], ['/health', 'System health', 'सिस्टम स्वास्थ्य', 'n'], ['/audit', 'Audit log', 'ऑडिट लॉग', 'n']];
T = {
en: { brand: 'NyaySetu Gov', generated: 'Generated data', legend: 'Legend', view_as: 'View as', signout: 'Sign out', proto: 'Prototype. Timings are sample values for the design; the real page shows live measurements.',
denied_title: 'This page is not available for your role', denied_body: 'Benchmark and receipts are for the national administrator only.', back_pulse: 'Back to Civic Pulse',
title: 'Benchmark and receipts', sub: 'The evidence for the time-series database choice. Measured on this database, not claimed.', rerun: 'Run again', running: 'Running',
race: 'The race: the same three questions on three kinds of table', race_help: 'Ordinary table = plain Postgres table. Time-series table = hypertable. Summary = pre-computed continuous aggregate. Every row is the median of 5 runs and must return the same answer.', question: 'Question', plain: 'Ordinary table', hyper: 'Time-series table', agg: 'Pre-computed summary', speedup: 'Speed-up', same: 'Same answer?', same_yes: 'Same answer', same_no: 'Answers differ', median5: 'median of 5 runs', src: 'Source',
rows: 'Rows stored', rows_split: 'real vs generated', real: 'Real', generated_row: 'Generated', storage: 'Storage', smaller: 'smaller', store_before: 'Plain table', store_after: 'After compression', chunks: 'Chunks compressed', chunks_help: 'older data is compressed automatically', hypertables: 'Hypertables', caggs: 'Continuous aggregates', policies_n: 'Policies', fresh: 'Summary freshness', fresh_help: 'how far behind the summaries are', fresh_limit: 'Allowed lag', fresh_ok: 'Within limit',
policies: 'Background policies', policy: 'Policy', schedule: 'Schedule', last_run: 'Last run', status: 'Status', history: 'Past benchmark runs', when: 'When',
statement: 'What was measured', n_text: '1,84,213 events over 90 days (see “Rows stored”).', s_data: 'Data source', data_text: 'The citizen app’s event ledger plus generated load. Generated rows are marked in every list.', s_date: 'Date', s_machine: 'Machine', machine_text: '4 vCPU, 16 GB, one Postgres instance with TimescaleDB 2.17 (sample description).', s_method: 'Method', method_text: 'Each question was run 5 times after a warm-up. The median is shown. Answers were compared and must match.', generated_note: 'Part of the data in this benchmark is generated, and the page says so wherever it applies.' },
hi: { brand: 'न्यायसेतु शासन', generated: 'जनित डेटा', legend: 'संकेत-सूची', view_as: 'इस रूप में देखें', signout: 'लॉग आउट', proto: 'प्रोटोटाइप। समय डिज़ाइन के नमूना मान हैं; असली पृष्ठ लाइव माप दिखाता है।',
denied_title: 'आपकी भूमिका के लिए यह पृष्ठ उपलब्ध नहीं', denied_body: 'बेंचमार्क और रसीदें केवल राष्ट्रीय प्रशासक के लिए हैं।', back_pulse: 'सिविक पल्स पर वापस',
title: 'बेंचमार्क और रसीदें', sub: 'टाइम-सीरीज़ डेटाबेस चुनने का प्रमाण। इसी डेटाबेस पर मापा गया, दावा नहीं।', rerun: 'फिर चलाएँ', running: 'चल रहा है',
race: 'दौड़: तीन तरह की तालिकाओं पर वही तीन प्रश्न', race_help: 'साधारण तालिका = सामान्य Postgres तालिका। टाइम-सीरीज़ तालिका = हाइपरटेबल। सारांश = पहले से गणना किया निरंतर एग्रीगेट। हर पंक्ति 5 रनों की माध्यिका है और उत्तर समान होना ज़रूरी है।', question: 'प्रश्न', plain: 'साधारण तालिका', hyper: 'टाइम-सीरीज़ तालिका', agg: 'पहले से गणना सारांश', speedup: 'गति-वृद्धि', same: 'उत्तर समान?', same_yes: 'उत्तर समान', same_no: 'उत्तर अलग', median5: '5 रनों की माध्यिका', src: 'स्रोत',
rows: 'संग्रहीत पंक्तियाँ', rows_split: 'असली बनाम जनित', real: 'असली', generated_row: 'जनित', storage: 'भंडारण', smaller: 'छोटा', store_before: 'साधारण तालिका', store_after: 'संपीड़न के बाद', chunks: 'संपीड़ित चंक', chunks_help: 'पुराना डेटा अपने आप संपीड़ित होता है', hypertables: 'हाइपरटेबल', caggs: 'निरंतर एग्रीगेट', policies_n: 'नीतियाँ', fresh: 'सारांश की ताज़गी', fresh_help: 'सारांश कितने पीछे हैं', fresh_limit: 'अनुमत देरी', fresh_ok: 'सीमा के भीतर',
policies: 'बैकग्राउंड नीतियाँ', policy: 'नीति', schedule: 'समय-सारणी', last_run: 'पिछली बार', status: 'स्थिति', history: 'पिछले बेंचमार्क रन', when: 'कब',
statement: 'क्या मापा गया', n_text: '90 दिनों की 1,84,213 घटनाएँ (“संग्रहीत पंक्तियाँ” देखें)।', s_data: 'डेटा का स्रोत', data_text: 'नागरिक ऐप का इवेंट लेजर और जनित लोड। जनित पंक्तियों पर हर सूची में लेबल है।', s_date: 'तारीख', s_machine: 'मशीन', machine_text: '4 vCPU, 16 GB, TimescaleDB 2.17 वाला एक Postgres (नमूना विवरण)।', s_method: 'विधि', method_text: 'हर प्रश्न गर्म करने के बाद 5 बार चलाया गया। माध्यिका दिखाई गई है। उत्तरों की तुलना की गई और मेल खाना ज़रूरी है।', generated_note: 'इस बेंचमार्क के डेटा का एक हिस्सा जनित है, और जहाँ लागू हो पृष्ठ यह बताता है।' }
};
Q = { daily: [['Reports per day per category, 90 days', 'daily totals by category'], ['प्रति दिन प्रति श्रेणी शिकायतें, 90 दिन', 'श्रेणी के अनुसार दैनिक योग']], cells: [['Ten busiest map cells, 30 days', 'top cells by count'], ['नक्शे के दस सबसे व्यस्त खाने, 30 दिन', 'गिनती के अनुसार शीर्ष खाने']], fixtime: [['Median hours to fix, per day, 90 days', 'median by day'], ['ठीक होने में माध्यिका घंटे, प्रति दिन, 90 दिन', 'दिन के अनुसार माध्यिका']] };
async runRace() {
  this.setState({ running: true, pct: 5, bad: false }); const tick = setInterval(() => this.setState((x) => ({ pct: Math.min(90, x.pct + 6) })), 700);
  try { const race = await api('/api/pulse/race'); this.setState({ race, runN: this.state.runN + 1 }); } catch (e) { this.setState({ bad: true }); }
  clearInterval(tick); this.setState({ running: false, pct: 100 }); this.loadSide();
}
async loadSide() { try { const [h, p] = await Promise.all([api('/api/pulse/race/history'), api('/api/pulse/policies')]); this.setState({ hist: h.runs, pols: p }); } catch (e) { this.setState({ bad: true }); } }
componentDidMount() { try { const l = localStorage.getItem('gov.lang'); if (l === 'hi' || l === 'en') this.setState({ lang: l });  } catch (e) {} if (this.state.role === 'national') { this.loadSide(); this.runRace(); } }
setLang(l) { try { localStorage.setItem('gov.lang', l); } catch (e) {} this.setState({ lang: l }); }
setRole(r) { switchRole(r); window.location.reload(); }
renderVals() {
const s = this.state; const l = s.lang; const t = this.T[l]; const L = l === 'hi' ? 1 : 0; const ro = this.ROLES[s.role] || Object.values(this.ROLES)[0]; const rc = ro[5];
const nav = this.NAVD.filter((n) => n[3].indexOf(rc) >= 0).map((n) => ({ href: n[0], label: n[1 + L], cls: n[0] === '/benchmark' ? 'on' : '', cur: n[0] === '/benchmark' ? 'page' : 'false' }));
const allowed = rc === 'n'; const j = s.runN * 7;
const R = s.race; const fmt = (n) => { const x = String(Math.round(Number(n) || 0)); if (x.length <= 3) return x; let rest = x.slice(0, -3); const out = []; while (rest.length > 2) { out.unshift(rest.slice(-2)); rest = rest.slice(0, -2); } if (rest) out.unshift(rest); return out.join(',') + ',' + x.slice(-3); };
const tests = R ? R.tests.map((r) => ({ q: this.Q[r.id][L][0], note: this.Q[r.id][L][1], plain: r.plain_ms, hyper: r.hypertable_ms, agg: r.aggregate_ms, speed: Math.round(r.speedup || 0), sameStyle: r.same_answer ? 'background:#DCFCE7;color:#14532D;' : 'background:#FEE2E2;color:#7F1D1D;', sameSym: r.same_answer ? '✓' : '✗', sameText: r.same_answer ? t.same_yes : (t.same_no || 'Answers differ') })) : [];
const P = s.pols; const pnames = { policy_compression: ['Compress old chunks', 'पुराने चंक संपीड़ित करें'], policy_refresh_continuous_aggregate: ['Refresh a summary', 'सारांश ताज़ा करें'], policy_retention: ['Drop old raw events', 'पुराने कच्चे डेटा हटाएँ'], policy_reorder: ['Reorder chunks', 'चंक पुनः क्रमबद्ध'] };
const pol = (P ? P.policies : []).map((p) => ({ name: (pnames[p.proc_name] || [p.proc_name, p.proc_name])[L] + ' · ' + p.hypertable_name, sched: p.schedule, last: p.last_run_started_at ? new Date(p.last_run_started_at).toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Kolkata' }) : '–', sym: p.last_run_status === 'Success' ? '✓' : '!', text: p.last_run_status === 'Success' ? (L ? 'सफल' : 'Succeeded') : (p.last_run_status || (L ? 'अभी नहीं चला' : 'Not run yet')), style: p.last_run_status === 'Success' ? 'background:#DCFCE7;color:#14532D;' : 'background:#FEF3C7;color:#78350F;' }));
const mb = (b) => Math.round((b || 0) / 1e6);
return { t, nav, role: s.role, roleOpts: Object.keys(this.ROLES).map((k) => ({ v: k, l: this.ROLES[k][3 + L] })), onRole: (e) => this.setRole(e.target.value), isEn: l === 'en', isHi: l === 'hi', setEn: () => this.setLang('en'), setHi: () => this.setLang('hi'), user: ro[0], scope: ro[1 + L],
allowed, denied: !allowed, running: s.running, pct: s.pct, stepText: s.pct < 35 ? (L ? 'साधारण तालिका' : 'ordinary table') : s.pct < 70 ? (L ? 'टाइम-सीरीज़ तालिका' : 'time-series table') : (L ? 'सारांश' : 'summary'),
rerun: () => this.runRace(), bad: s.bad,
tests, measured: R ? new Date(R.measured_at).toLocaleString('en-IN', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Kolkata' }) + ' IST' : '–', rows: R ? { total: fmt(R.rows), real: fmt(R.rows_real), gen: fmt(R.rows_generated), realPct: Math.round(R.rows_real / Math.max(1, R.rows) * 100), genPct: Math.round(R.rows_generated / Math.max(1, R.rows) * 100) } : { total: '–', real: '–', gen: '–', realPct: 0, genPct: 0 }, store: R ? { ratio: R.storage.ratio, plain: mb(R.storage.plain_bytes), tiger: mb(R.storage.tiger_bytes), pct: R.storage.plain_bytes ? Math.max(2, Math.round(R.storage.tiger_bytes / R.storage.plain_bytes * 100)) : 0 } : { ratio: '–', plain: 0, tiger: 0, pct: 0 }, chunks: P ? { compressed: P.chunks.compressed, total: P.chunks.total } : { compressed: 0, total: 0 }, fresh: { lag: P && P.summaryLagMinutes != null ? P.summaryLagMinutes : '–' },
pol, hist: s.hist.map((h) => ({ when: new Date(h.at).toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Kolkata' }), rows: fmt(h.total_rows), speed: Math.round(h.best_speedup || 0), store: h.storage_ratio })) };
}
}

BenchmarkLogic.prototype.view = function view(__v) {
  const { bad, allowed, chunks, denied, fresh, h, hist, isEn, isHi, measured, n, nav, o, onRole, p, pct, pol, r, rerun, role, roleOpts, rows, running, scope, setEn, setHi, stepText, store, t, tests, user } = __v;
  return (
    <div className="sc-bench" style={{ width: "100%", minHeight: "100vh", display: "flex", flexDirection: "column", background: "#FFFFFF", color: "#111827", fontFamily: "'Noto Sans','Noto Sans Devanagari',system-ui,sans-serif", fontSize: "14px", lineHeight: "1.4" }}>
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
            <button type="button" className="btn pri" onClick={rerun} disabled={running}>
              ↻ {t.rerun}
            </button>
          </div>
          {!!(running) && (
            <>
            <div role="status" style={{ padding: "8px 12px", background: "#EFF6FF", border: "1px solid #93C5FD", borderRadius: "6px" }}>
              {t.running}: {stepText} ({pct}%)
              <div style={{ height: "8px", background: "#DBEAFE", borderRadius: "4px", marginTop: "4px" }}>
                <div style={css(`height: 8px; width: ${pct}%; background: #1D4ED8; border-radius: 4px;`)}>
                </div>
              </div>
            </div>
            </>
          )}
          <section className="card" aria-label={t.race}>
            <h2>
              {t.race}
            </h2>
            <div className="sub">
              {t.race_help}
            </div>
            <table>
              <thead>
                <tr>
                  <th scope="col">
                    {t.question}
                  </th>
                  <th scope="col" style={{ textAlign: "right" }}>
                    {t.plain}
                  </th>
                  <th scope="col" style={{ textAlign: "right" }}>
                    {t.hyper}
                  </th>
                  <th scope="col" style={{ textAlign: "right" }}>
                    {t.agg}
                  </th>
                  <th scope="col" style={{ textAlign: "right" }}>
                    {t.speedup}
                  </th>
                  <th scope="col">
                    {t.same}
                  </th>
                </tr>
              </thead>
              <tbody>
                {tests.map((r, __i) => (
                  <React.Fragment key={__i}>
                  <tr>
                    <td>
                      <b>
                        {r.q}
                      </b>
                      <div className="sub">
                        {r.note}
                      </div>
                    </td>
                    <td style={{ textAlign: "right" }}>
                      {r.plain} ms
                    </td>
                    <td style={{ textAlign: "right" }}>
                      {r.hyper} ms
                    </td>
                    <td style={{ textAlign: "right", fontWeight: "700" }}>
                      {r.agg} ms
                    </td>
                    <td style={{ textAlign: "right", fontWeight: "700" }}>
                      {r.speed}×
                    </td>
                    <td>
                      <span className="chip" style={css(r.sameStyle)}>
                        {r.sameSym} {r.sameText}
                      </span>
                    </td>
                  </tr>
                  </React.Fragment>
                ))}
              </tbody>
            </table>
            <div className="sub">
              {t.src}: pulse/race · measured {measured} · {t.median5}
            </div>
          </section>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(4, minmax(0, 1fr))", gap: "12px" }}>
            <section className="card">
              <h2>
                {t.rows}
              </h2>
              <div className="big">
                {rows.total}
              </div>
              <div className="sub">
                {t.rows_split}
              </div>
              <div style={{ display: "flex", height: "16px", border: "1px solid #6B7280", borderRadius: "3px", overflow: "hidden" }}>
                <i style={css(`width: ${rows.realPct}%; background: #1D4ED8;`)}>
                </i>
                <i style={css(`width: ${rows.genPct}%; background: #F59E0B;`)}>
                </i>
              </div>
              <div style={{ fontSize: "12.5px" }}>
                <span style={{ color: "#1D4ED8", fontWeight: "700" }}>
                  ▮ {t.real} {rows.real}
                </span>
                {' '}·{' '}
                <span style={{ color: "#B45309", fontWeight: "700" }}>
                  ▮ {t.generated_row} {rows.gen}
                </span>
              </div>
            </section>
            <section className="card">
              <h2>
                {t.storage}
              </h2>
              <div className="big">
                {store.ratio}× {t.smaller}
              </div>
              <div className="sub">
                {t.store_before}: {store.plain} MB → {t.store_after}: {store.tiger} MB
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
                <div style={{ height: "14px", width: "100%", background: "#6B7280" }}>
                </div>
                <div style={css(`height: 14px; width: ${store.pct}%; background: #1D4ED8;`)}>
                </div>
              </div>
            </section>
            <section className="card">
              <h2>
                {t.chunks}
              </h2>
              <div className="big">
                {chunks.compressed} / {chunks.total}
              </div>
              <div className="sub">
                {t.chunks_help}
              </div>
              <div style={{ fontSize: "12.5px" }}>
                {t.hypertables}:{' '}
                <b>
                  4
                </b>
                {' '}· {t.caggs}:{' '}
                <b>
                  3
                </b>
                {' '}· {t.policies_n}:{' '}
                <b>
                  6
                </b>
              </div>
            </section>
            <section className="card">
              <h2>
                {t.fresh}
              </h2>
              <div className="big">
                {fresh.lag} s
              </div>
              <div className="sub">
                {t.fresh_help}
              </div>
              <div style={{ fontSize: "12.5px" }}>
                {t.fresh_limit}:{' '}
                <b>
                  60 s
                </b>
                {' '}·{' '}
                <span className="chip" style={{ background: "#DCFCE7", color: "#14532D" }}>
                  ✓ {t.fresh_ok}
                </span>
              </div>
            </section>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "minmax(0, 1.2fr) minmax(0, 1fr)", gap: "12px", alignItems: "start" }}>
            <section className="card">
              <h2>
                {t.policies}
              </h2>
              <table>
                <thead>
                  <tr>
                    <th scope="col">
                      {t.policy}
                    </th>
                    <th scope="col">
                      {t.schedule}
                    </th>
                    <th scope="col">
                      {t.last_run}
                    </th>
                    <th scope="col">
                      {t.status}
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {pol.map((p, __i) => (
                    <React.Fragment key={__i}>
                    <tr>
                      <td>
                        {p.name}
                      </td>
                      <td>
                        {p.sched}
                      </td>
                      <td>
                        {p.last}
                      </td>
                      <td>
                        <span className="chip" style={css(p.style)}>
                          {p.sym} {p.text}
                        </span>
                      </td>
                    </tr>
                    </React.Fragment>
                  ))}
                </tbody>
              </table>
            </section>
            <section className="card">
              <h2>
                {t.history}
              </h2>
              <table>
                <thead>
                  <tr>
                    <th scope="col">
                      {t.when}
                    </th>
                    <th scope="col" style={{ textAlign: "right" }}>
                      {t.rows}
                    </th>
                    <th scope="col" style={{ textAlign: "right" }}>
                      {t.speedup}
                    </th>
                    <th scope="col" style={{ textAlign: "right" }}>
                      {t.storage}
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {hist.map((h, __i) => (
                    <React.Fragment key={__i}>
                    <tr>
                      <td>
                        {h.when}
                      </td>
                      <td style={{ textAlign: "right" }}>
                        {h.rows}
                      </td>
                      <td style={{ textAlign: "right", fontWeight: "700" }}>
                        {h.speed}×
                      </td>
                      <td style={{ textAlign: "right" }}>
                        {h.store}×
                      </td>
                    </tr>
                    </React.Fragment>
                  ))}
                </tbody>
              </table>
            </section>
          </div>
          <section className="card" style={{ background: "#F9FAFB" }}>
            <h2>
              {t.statement}
            </h2>
            <dl style={{ margin: "0", display: "grid", gridTemplateColumns: "200px 1fr", gap: "5px 12px", fontSize: "13.5px" }}>
              <dt style={{ color: "#4B5563", fontWeight: "600" }}>
                n
              </dt>
              <dd style={{ margin: "0" }}>
                {t.n_text}
              </dd>
              <dt style={{ color: "#4B5563", fontWeight: "600" }}>
                {t.s_data}
              </dt>
              <dd style={{ margin: "0" }}>
                {t.data_text}
              </dd>
              <dt style={{ color: "#4B5563", fontWeight: "600" }}>
                {t.s_date}
              </dt>
              <dd style={{ margin: "0" }}>
                9 Oct 2026, 09:40 IST
              </dd>
              <dt style={{ color: "#4B5563", fontWeight: "600" }}>
                {t.s_machine}
              </dt>
              <dd style={{ margin: "0" }}>
                {t.machine_text}
              </dd>
              <dt style={{ color: "#4B5563", fontWeight: "600" }}>
                {t.s_method}
              </dt>
              <dd style={{ margin: "0" }}>
                {t.method_text}
              </dd>
            </dl>
            <div style={{ fontWeight: "700", color: "#78350F" }}>
              {t.generated_note}
            </div>
          </section>
          </>
        )}
      </main>
      <footer style={{ padding: "10px 20px", fontSize: "12px", color: "#4B5563", borderTop: "1px solid #D1D5DB", background: "#fff", marginTop: "auto" }}>
        {t.proto}
      </footer>
    </div>
  );
};

export default BenchmarkLogic;
