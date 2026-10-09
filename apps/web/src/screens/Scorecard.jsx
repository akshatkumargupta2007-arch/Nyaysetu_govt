import React from 'react';
import { DCLogic, css } from '../lib/dc.js';
import { TLink } from '../lib/TLink.jsx';
import { govRoles, currentRoleKey, switchRole } from '../lib/gov.js';
import { logout, api } from '../lib/client.js';
import './Scorecard.css';

/* Behaviour and sample data of this screen. Replace the sample data with calls to your API (see docs/DATA.md). */
class ScorecardLogic extends DCLogic {
state = { lang: 'en', role: currentRoleKey(), running: false, pct: 0, ev: null, err: false };
ROLES = govRoles();
NAVD = [['/', 'Civic Pulse', 'सिविक पल्स', 'nstcd'], ['/complaints', 'Complaints', 'शिकायतें', 'nstcd'], ['/queue', 'Closure Court', 'क्लोज़र कोर्ट', 'nstcd'], ['/ask', 'Ask the City', 'शहर से पूछें', 'nstcd'], ['/scorecard', 'Scorecard', 'स्कोरकार्ड', 'nstc'], ['/benchmark', 'Benchmark', 'बेंचमार्क', 'n'], ['/health', 'System health', 'सिस्टम स्वास्थ्य', 'n'], ['/audit', 'Audit log', 'ऑडिट लॉग', 'n']];
T = {
en: { brand: 'NyaySetu Gov', generated: 'Generated data', legend: 'Legend', view_as: 'View as', signout: 'Sign out', proto: 'Prototype. Numbers on this page are sample values for the design.',
denied_title: 'This page is not available for your role', denied_body: 'The scorecard is for national, state, district and city officials. Choose another role in “View as”.', back_pulse: 'Back to Civic Pulse',
title: 'Scorecard: how the checks did against human labels', eval_set: 'Sample evaluation set (generated for the demo)', run: 'Run', models: 'Models', labelled: 'Labelled submissions', print: 'Print / PDF', rerun: 'Re-run the evaluation', read_only: 'Read only for your role', running: 'Running',
fp_title: 'False-pass rate', fp_help: 'Cases the system passed that a person says should not pass. This is the most important number, so it is shown first. Lower is better.', verdict_agree: 'Verdict agreement', agree_help: 'system verdict equals the human label', disagree: 'Two-pass disagreement', disagree_help: 'pass A and pass B disagree on a condition', schema: 'Schema-valid answers', coverage: 'Evidence coverage',
confusion: 'Confusion table', confusion_help: 'Rows: what a person said. Columns: what the system said. The diagonal is agreement.', label_row: 'Human label', system_col: 'System',
per_crit: 'Agreement per kind of condition', crit_type: 'Condition type', agree: 'Agreement', gates_title: 'Rule checks: which attacks they caught', gate: 'Check', attacks: 'Attack cases', caught: 'Caught',
cost_title: 'Speed and cost per assessment', lat_med: 'Median time', lat_p95: '95th percentile time', tokens: 'Tokens', cost: 'Cost', safety: 'Safety suite (adversarial cases)', safety_help: 'adversarial cases passed, including text-in-image attacks', trend: 'Across runs',
fail_title: 'Every failing case', fail_help: 'Nothing is hidden. Each case shows the image, what a person said, what the system said, and why it went wrong.', image: 'Image', human: 'Person said', system: 'System said', why: 'Why it went wrong', sample: 'sample', src: 'Source' },
hi: { brand: 'न्यायसेतु शासन', generated: 'जनित डेटा', legend: 'संकेत-सूची', view_as: 'इस रूप में देखें', signout: 'लॉग आउट', proto: 'प्रोटोटाइप। इस पृष्ठ की संख्याएँ डिज़ाइन के नमूना मान हैं।',
denied_title: 'आपकी भूमिका के लिए यह पृष्ठ उपलब्ध नहीं', denied_body: 'स्कोरकार्ड राष्ट्रीय, राज्य, ज़िला और शहर के अधिकारियों के लिए है। “इस रूप में देखें” में दूसरी भूमिका चुनें।', back_pulse: 'सिविक पल्स पर वापस',
title: 'स्कोरकार्ड: जाँच ने मानव लेबल के मुक़ाबले कैसा किया', eval_set: 'नमूना मूल्यांकन सेट (डेमो के लिए जनित)', run: 'रन', models: 'मॉडल', labelled: 'लेबल की गई प्रस्तुतियाँ', print: 'प्रिंट / PDF', rerun: 'मूल्यांकन दोबारा चलाएँ', read_only: 'आपकी भूमिका के लिए केवल पढ़ने योग्य', running: 'चल रहा है',
fp_title: 'झूठे-पास की दर', fp_help: 'वे मामले जिन्हें सिस्टम ने पास किया पर व्यक्ति के अनुसार पास नहीं होने चाहिए थे। यह सबसे अहम संख्या है, इसलिए सबसे पहले। कम बेहतर है।', verdict_agree: 'निर्णय सहमति', agree_help: 'सिस्टम का निर्णय मानव लेबल जैसा', disagree: 'दो-पास असहमति', disagree_help: 'पास A और पास B किसी शर्त पर असहमत', schema: 'स्कीमा-वैध उत्तर', coverage: 'प्रमाण कवरेज',
confusion: 'कन्फ़्यूज़न तालिका', confusion_help: 'पंक्तियाँ: व्यक्ति ने क्या कहा। स्तंभ: सिस्टम ने क्या कहा। विकर्ण = सहमति।', label_row: 'मानव लेबल', system_col: 'सिस्टम',
per_crit: 'शर्त के प्रकार के अनुसार सहमति', crit_type: 'शर्त का प्रकार', agree: 'सहमति', gates_title: 'नियम-जाँच: किन हमलों को पकड़ा', gate: 'जाँच', attacks: 'हमले के मामले', caught: 'पकड़े गए',
cost_title: 'प्रति आकलन गति और लागत', lat_med: 'सामान्य (माध्यिका) समय', lat_p95: '95वाँ प्रतिशतक समय', tokens: 'टोकन', cost: 'लागत', safety: 'सुरक्षा परीक्षण (विरोधी मामले)', safety_help: 'विरोधी मामले पास, जिनमें छवि में लिखे पाठ वाले हमले भी', trend: 'रनों में बदलाव',
fail_title: 'हर विफल मामला', fail_help: 'कुछ छिपाया नहीं गया। हर मामले में तस्वीर, व्यक्ति ने क्या कहा, सिस्टम ने क्या कहा और क्यों गड़बड़ हुई।', image: 'तस्वीर', human: 'व्यक्ति ने कहा', system: 'सिस्टम ने कहा', why: 'गड़बड़ क्यों हुई', sample: 'नमूना', src: 'स्रोत' }
};
VC = ['Rejected', 'Failed', 'Needs human review', 'Needs more evidence', 'Evidence passed'];
CONF = [[14, 1, 0, 0, 0], [0, 12, 2, 1, 0], [0, 1, 17, 3, 1], [0, 0, 3, 19, 2], [0, 0, 1, 1, 42]];
COMPONENT_NOTE = '';
componentDidMount() { api('/api/court/scorecard').then((r) => this.setState({ ev: r.result, running: !!r.running })).catch(() => this.setState({ err: true })); try { const l = localStorage.getItem('gov.lang'); if (l === 'hi' || l === 'en') this.setState({ lang: l });  } catch (e) {} }
setLang(l) { try { localStorage.setItem('gov.lang', l); } catch (e) {} this.setState({ lang: l }); }
async rerun() { this.setState({ running: true, err: false }); try { const r = await api('/api/court/scorecard/run', { method: 'POST', body: {} }); this.setState({ ev: r.result, running: false }); } catch (e) { this.setState({ running: false, err: true }); } }
setRole(r) { switchRole(r); window.location.reload(); }
renderVals() {
const s = this.state; const l = s.lang; const t = this.T[l]; const L = l === 'hi' ? 1 : 0; const ro = this.ROLES[s.role]; const rc = ro[5];
const nav = this.NAVD.filter((n) => n[3].indexOf(rc) >= 0).map((n) => ({ href: n[0], label: n[1 + L], cls: n[0] === '/scorecard' ? 'on' : '', cur: n[0] === '/scorecard' ? 'page' : 'false' }));
const ev = s.ev; const allowed = rc !== 'd'; const pts = (a) => a.map((v, i) => (28 + i * 67).toFixed(0) + ',' + (110 - v).toFixed(0)).join(' ');
return { t, nav, role: s.role, roleOpts: Object.keys(this.ROLES).map((k) => ({ v: k, l: this.ROLES[k][3 + L] })), onRole: (e) => this.setRole(e.target.value), isEn: l === 'en', isHi: l === 'hi', setEn: () => this.setLang('en'), setHi: () => this.setLang('hi'), user: ro[0], scope: ro[1 + L],
allowed, denied: !allowed, canRerun: rc === 'n', readonly: rc !== 'n' && allowed, doPrint: () => { try { window.print(); } catch (e) {} },
running: s.running, pct: s.pct, done: 0, rerun: () => this.rerun(), err: s.err, hasEv: !!ev, noEv: !ev, runAt: ev ? new Date(ev.at).toLocaleString('en-IN') : '', models: ev ? ev.models.examiner + ' + ' + ev.models.cross : '', nCases: ev ? ev.n : 0, src: ev ? (ev.fixtures === 'real' ? 'real photos' : 'generated drawings') : '',
fp: ev ? { rate: (ev.falsePass.rate ?? 0) + '%', text: (L ? ev.falsePass.of + ' में से ' + ev.falsePass.count + ' मामले जो पास नहीं होने चाहिए थे पास हुए' : ev.falsePass.count + ' of ' + ev.falsePass.of + ' cases that should not pass did pass') } : { rate: '–', text: '' },
agr: ev ? ev.agreement.rate + '%' : '–', dis: ev ? ev.disagreement.count + ' / ' + ev.disagreement.of : '–', sch: ev ? ev.schemaValid.count + ' / ' + ev.schemaValid.of : '–', lat: ev ? ev.latency.p50 + ' ms' : '–', lat95: ev ? ev.latency.p95 + ' ms' : '–',
vcols: this.VC, conf: (ev ? ev.confusion : this.CONF.map((r) => r.map(() => 0))).map((row, i) => ({ label: this.VC[i], cells: row.map((n, j) => ({ n, style: i === j ? 'background:#DBEAFE;font-weight:700;' : n > 0 ? 'background:#FEF3C7;' : 'color:#6B7280;' })) })),
crit: [],
gates: ev ? ev.gateRates.map((g) => ({ name: g.id, attacks: g.attacks, caught: g.caught + ' / ' + g.attacks })) : [],
safetyFail: [],
fails: ev ? ev.failures.map((f) => ({ id: f.id, img: f.image, human: f.expected.join(' / '), system: f.actual, why: f.why || f.title })) : [],
trendFp: '', trendAg: '', trendX: [], };
}
}

ScorecardLogic.prototype.view = function view(__v) {
  const { runAt, models, nCases, src, agr, dis, sch, lat, lat95, err, allowed, c, canRerun, conf, crit, denied, doPrint, done, f, fails, fp, g, gates, isEn, isHi, n, nav, o, onRole, pct, r, readonly, rerun, role, roleOpts, running, s, safetyFail, scope, setEn, setHi, t, trendAg, trendFp, trendX, user, vcols, x } = __v;
  return (
    <div className="sc-scorecard" style={{ width: "100%", minHeight: "100vh", display: "flex", flexDirection: "column", background: "#FFFFFF", color: "#111827", fontFamily: "'Noto Sans','Noto Sans Devanagari',system-ui,sans-serif", fontSize: "14px", lineHeight: "1.4" }}>
      <header className="noprint" style={{ minHeight: "52px", background: "#1F2937", color: "#FFFFFF", display: "flex", alignItems: "center", padding: "0 16px", gap: "10px", flex: "none" }}>
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
            <span className="chip" style={{ background: "#FEF3C7", color: "#78350F" }}>
              {src || t.eval_set}
            </span>
            <span style={{ flex: "1" }}>
            </span>
            <span style={{ color: "#4B5563", fontSize: "13px" }}>
              {t.run}:{' '}
              <b>
                {runAt || '–'}
              </b>
              {' '}· {t.models}:{' '}
              <b>
                {models || '–'}
              </b>
              {' '}· {t.labelled}:{' '}
              <b>
                {nCases}
              </b>
            </span>
            <button type="button" className="btn noprint" onClick={doPrint}>
              {t.print}
            </button>
            {!!(canRerun) && (
              <>
              <button type="button" className="btn pri noprint" onClick={rerun} disabled={running}>
                {t.rerun}
              </button>
              </>
            )}
            {!!(readonly) && (
              <>
              <span className="chip" style={{ background: "#E5E7EB", color: "#1F2937" }}>
                {t.read_only}
              </span>
              </>
            )}
          </div>
          {!!(running) && (
            <>
            <div role="status" style={{ padding: "8px 12px", background: "#EFF6FF", border: "1px solid #93C5FD", borderRadius: "6px" }}>
              {t.running}: {pct}% 
              <div style={{ height: "8px", background: "#DBEAFE", borderRadius: "4px", marginTop: "4px" }}>
                <div style={css(`height: 8px; width: ${pct}%; background: #1D4ED8; border-radius: 4px;`)}>
                </div>
              </div>
            </div>
            </>
          )}
          <section className="card" style={{ border: "2px solid #B91C1C" }} aria-label={t.fp_title}>
            <div style={{ display: "flex", alignItems: "center", gap: "28px", flexWrap: "wrap" }}>
              <div>
                <h2 style={{ color: "#7F1D1D" }}>
                  {t.fp_title}
                </h2>
                <div className="big" style={{ color: "#B91C1C", fontSize: "56px" }}>
                  {fp.rate}
                </div>
                <div className="sub">
                  {fp.text}
                </div>
              </div>
              <div style={{ flex: "1", minWidth: "320px", fontSize: "13.5px" }}>
                {t.fp_help}
              </div>
              <div>
                <div className="sub">
                  {t.verdict_agree}
                </div>
                <div className="big">
                  {agr}
                </div>
                <div className="sub">
                  {t.agree_help}
                </div>
              </div>
              <div>
                <div className="sub">
                  {t.disagree}
                </div>
                <div className="big">
                  {dis}
                </div>
                <div className="sub">
                  {t.disagree_help}
                </div>
              </div>
              <div>
                <div className="sub">
                  {t.schema}
                </div>
                <div className="big">
                  {sch}
                </div>
              </div>
              <div>
                <div className="sub">
                  {t.coverage}
                </div>
                <div className="big">
                  –
                </div>
              </div>
            </div>
          </section>
          <div style={{ display: "grid", gridTemplateColumns: "minmax(0, 1.2fr) minmax(0, 1fr)", gap: "12px", alignItems: "start" }}>
            <section className="card">
              <h2>
                {t.confusion}
              </h2>
              <div className="sub">
                {t.confusion_help}
              </div>
              <table>
                <thead>
                  <tr>
                    <th scope="col">
                      {t.label_row} ↓ / {t.system_col} →
                    </th>
                    {vcols.map((c, __i) => (
                      <React.Fragment key={__i}>
                      <th scope="col">
                        {c}
                      </th>
                      </React.Fragment>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {conf.map((r, __i) => (
                    <React.Fragment key={__i}>
                    <tr>
                      <th scope="row">
                        {r.label}
                      </th>
                      {r.cells.map((c, __i) => (
                        <React.Fragment key={__i}>
                        <td style={css(c.style)}>
                          {c.n}
                        </td>
                        </React.Fragment>
                      ))}
                    </tr>
                    </React.Fragment>
                  ))}
                </tbody>
              </table>
            </section>
            <section className="card">
              <h2>
                {t.per_crit}
              </h2>
              <table>
                <thead>
                  <tr>
                    <th scope="col">
                      {t.crit_type}
                    </th>
                    <th scope="col">
                      {t.agree}
                    </th>
                    <th scope="col">
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {crit.map((c, __i) => (
                    <React.Fragment key={__i}>
                    <tr>
                      <td>
                        {c.name}
                      </td>
                      <td style={{ fontWeight: "700" }}>
                        {c.pct}%
                      </td>
                      <td style={{ width: "55%" }}>
                        <div style={{ height: "10px", background: "#E5E7EB", borderRadius: "5px" }}>
                          <div style={css(`height: 10px; width: ${c.pct}%; background: #1D4ED8; border-radius: 5px;`)}>
                          </div>
                        </div>
                      </td>
                    </tr>
                    </React.Fragment>
                  ))}
                </tbody>
              </table>
              <h2 style={{ marginTop: "6px" }}>
                {t.gates_title}
              </h2>
              <table>
                <thead>
                  <tr>
                    <th scope="col">
                      {t.gate}
                    </th>
                    <th scope="col">
                      {t.attacks}
                    </th>
                    <th scope="col">
                      {t.caught}
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {gates.map((g, __i) => (
                    <React.Fragment key={__i}>
                    <tr>
                      <td>
                        {g.name}
                      </td>
                      <td>
                        {g.attacks}
                      </td>
                      <td style={{ fontWeight: "700" }}>
                        {g.caught}
                      </td>
                    </tr>
                    </React.Fragment>
                  ))}
                </tbody>
              </table>
            </section>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", gap: "12px", alignItems: "start" }}>
            <section className="card">
              <h2>
                {t.cost_title}
              </h2>
              <dl style={{ margin: "0", display: "grid", gridTemplateColumns: "1fr auto", gap: "5px 10px" }}>
                <dt>
                  {t.lat_med}
                </dt>
                <dd style={{ margin: "0", fontWeight: "700" }}>
                  {lat}
                </dd>
                <dt>
                  {t.lat_p95}
                </dt>
                <dd style={{ margin: "0", fontWeight: "700" }}>
                  {lat95}
                </dd>
                <dt>
                  {t.tokens}
                </dt>
                <dd style={{ margin: "0", fontWeight: "700" }}>
                  3,420
                </dd>
                <dt>
                  {t.cost}
                </dt>
                <dd style={{ margin: "0", fontWeight: "700" }}>
                  –
                </dd>
              </dl>
            </section>
            <section className="card">
              <h2>
                {t.safety}
              </h2>
              <div className="big">
                58 / 60
              </div>
              <div className="sub">
                {t.safety_help}
              </div>
              <ul style={{ margin: "0", paddingLeft: "18px", fontSize: "13px" }}>
                {safetyFail.map((s, __i) => (
                  <React.Fragment key={__i}>
                  <li>
                    {s}
                  </li>
                  </React.Fragment>
                ))}
              </ul>
            </section>
            <section className="card">
              <h2>
                {t.trend}
              </h2>
              <svg viewBox="0 0 300 130" role="img" aria-label={t.trend} style={{ width: "100%" }}>
                <line x1="28" y1="110" x2="296" y2="110" stroke="#9CA3AF" />
                <line x1="28" y1="8" x2="28" y2="110" stroke="#9CA3AF" />
                <polyline points={trendFp} fill="none" stroke="#B91C1C" strokeWidth="2.4" />
                <polyline points={trendAg} fill="none" stroke="#1D4ED8" strokeWidth="2.4" strokeDasharray="6 3" />
                <text x="24" y="14" fontSize="10" textAnchor="end" fill="#374151">
                  100%
                </text>
                <text x="24" y="110" fontSize="10" textAnchor="end" fill="#374151">
                  0
                </text>
                {trendX.map((x, __i) => (
                  <React.Fragment key={__i}>
                  <text x={x.x} y="124" fontSize="10" textAnchor="middle" fill="#374151">
                    {x.l}
                  </text>
                  </React.Fragment>
                ))}
              </svg>
              <div style={{ fontSize: "12px", display: "flex", gap: "12px" }}>
                <span style={{ color: "#B91C1C", fontWeight: "700" }}>
                  ━ {t.fp_title}
                </span>
                <span style={{ color: "#1D4ED8", fontWeight: "700" }}>
                  ┅ {t.verdict_agree}
                </span>
              </div>
            </section>
          </div>
          <section className="card">
            <h2>
              {t.fail_title} ({fails.length})
            </h2>
            <div className="sub">
              {t.fail_help}
            </div>
            <table>
              <thead>
                <tr>
                  <th scope="col">
                    {t.image}
                  </th>
                  <th scope="col">
                    {t.human}
                  </th>
                  <th scope="col">
                    {t.system}
                  </th>
                  <th scope="col">
                    {t.why}
                  </th>
                </tr>
              </thead>
              <tbody>
                {fails.map((f, __i) => (
                  <React.Fragment key={__i}>
                  <tr>
                    <td style={{ width: "120px" }}>
                      <img src={f.img} alt={f.id} style={{ width: "110px", border: "1px solid #9CA3AF", borderRadius: "4px" }} />
                      <div className="sub">
                        {f.id}
                      </div>
                    </td>
                    <td>
                      {f.human}
                    </td>
                    <td>
                      {f.system}
                    </td>
                    <td>
                      {f.why}
                    </td>
                  </tr>
                  </React.Fragment>
                ))}
              </tbody>
            </table>
          </section>
          </>
        )}
      </main>
      <footer style={{ padding: "10px 20px", fontSize: "12px", color: "#4B5563", borderTop: "1px solid #D1D5DB", background: "#fff", marginTop: "auto" }}>
        {t.src}: court/scorecard · {t.proto}
      </footer>
    </div>
  );
};

export default ScorecardLogic;
