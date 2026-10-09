import React from 'react';
import { DCLogic, css } from '../lib/dc.js';
import { TLink } from '../lib/TLink.jsx';
import { govRoles, currentRoleKey, switchRole } from '../lib/gov.js';
import { logout, api } from '../lib/client.js';
import './AskTheCity.css';

/* Behaviour and sample data of this screen. Replace the sample data with calls to your API (see docs/DATA.md). */
class AskTheCityLogic extends DCLogic {
state = { lang: 'en', role: currentRoleKey(), question: '', res: null, asked: '', loading: false, listening: false, recent: [] };
ROLES = govRoles();
NAVD = [['/', 'Civic Pulse', 'सिविक पल्स', 'nstcd'], ['/complaints', 'Complaints', 'शिकायतें', 'nstcd'], ['/queue', 'Closure Court', 'क्लोज़र कोर्ट', 'nstcd'], ['/ask', 'Ask the City', 'शहर से पूछें', 'nstcd'], ['/scorecard', 'Scorecard', 'स्कोरकार्ड', 'nstc'], ['/benchmark', 'Benchmark', 'बेंचमार्क', 'n'], ['/health', 'System health', 'सिस्टम स्वास्थ्य', 'n'], ['/audit', 'Audit log', 'ऑडिट लॉग', 'n']];
T = {
en: { brand: 'NyaySetu Gov', generated: 'Generated data', legend: 'Legend', view_as: 'View as', signout: 'Sign out', proto: 'Prototype. The AI turns your question into a small, checkable query. It never writes SQL and never sees data outside your area.',
title: 'Ask the City', sub: 'Ask in plain words. You see the answer and exactly what was asked of the data.', scoped: 'Scoped to your area', scoped_small: 'scoped to your area', preview_state: 'Preview a state', ask_label: 'Your question', ask_ph: 'For example: which areas had the most sewage complaints last week?', mic: 'Speak your question', mic_on: 'Listening…', mic_off: 'Speak', ask: 'Ask', examples: 'Try one', recent: 'Recent questions',
loading: 'Working out your question…', loading_sub: 'Turning it into a query, running it on your area’s data.', error: 'Something went wrong.', error_sub: 'We could not get an answer. Nothing was changed. Try again.', retry: 'Try again',
cannot: 'This question cannot be answered with the data this tool is allowed to use.', cannot_sub: 'Questions about individual people, or about things we do not store, are not answered.', allowed_views: 'What you can ask about',
degraded: 'The AI is unavailable. Showing the raw table only, without a plain-language summary. The query below was built from your selection.', answer: 'Answer', spec: 'What was asked of the data', spec_help: 'The AI only fills in this form. A fixed program turns it into the query, so you can inspect it.', raw: 'Show as JSON', s_view: 'View', s_metrics: 'Measures', s_group: 'Group by', s_filters: 'Filters', s_time: 'Time', s_order: 'Order', s_limit: 'Limit', s_scope: 'Your area', limits_note: 'If the AI makes a mistake, it can only choose a wrong view or filter. It cannot reach data outside your area.', src: 'Source', gen_data: 'includes generated data' },
hi: { brand: 'न्यायसेतु शासन', generated: 'जनित डेटा', legend: 'संकेत-सूची', view_as: 'इस रूप में देखें', signout: 'लॉग आउट', proto: 'प्रोटोटाइप। AI आपके प्रश्न को छोटी, जाँचने योग्य क्वेरी में बदलता है। वह कभी SQL नहीं लिखता और आपके क्षेत्र से बाहर का डेटा नहीं देखता।',
title: 'शहर से पूछें', sub: 'सरल शब्दों में पूछें। आप उत्तर और डेटा से जो पूछा गया वह दोनों देखते हैं।', scoped: 'आपके क्षेत्र तक सीमित', scoped_small: 'आपके क्षेत्र तक सीमित', preview_state: 'कोई स्थिति देखें', ask_label: 'आपका प्रश्न', ask_ph: 'उदाहरण: पिछले सप्ताह किन क्षेत्रों में सीवर की सबसे ज़्यादा शिकायतें थीं?', mic: 'प्रश्न बोलें', mic_on: 'सुन रहा है…', mic_off: 'बोलें', ask: 'पूछें', examples: 'कोई आज़माएँ', recent: 'हाल के प्रश्न',
loading: 'आपका प्रश्न समझा जा रहा है…', loading_sub: 'उसे क्वेरी बनाकर आपके क्षेत्र के डेटा पर चलाया जा रहा है।', error: 'कुछ गड़बड़ हुई।', error_sub: 'उत्तर नहीं मिल सका। कुछ बदला नहीं गया। दोबारा कोशिश करें।', retry: 'दोबारा कोशिश करें',
cannot: 'इस उपकरण को जिस डेटा की अनुमति है, उससे इस प्रश्न का उत्तर नहीं दिया जा सकता।', cannot_sub: 'व्यक्तियों के बारे में या जो हम रखते ही नहीं, उन प्रश्नों के उत्तर नहीं दिए जाते।', allowed_views: 'आप किस बारे में पूछ सकते हैं',
degraded: 'AI उपलब्ध नहीं है। सरल भाषा के सारांश के बिना केवल कच्ची तालिका दिखाई जा रही है। नीचे की क्वेरी आपके चुनाव से बनी है।', answer: 'उत्तर', spec: 'डेटा से क्या पूछा गया', spec_help: 'AI केवल यह फ़ॉर्म भरता है। एक तय प्रोग्राम इसे क्वेरी बनाता है, ताकि आप जाँच सकें।', raw: 'JSON में देखें', s_view: 'दृश्य', s_metrics: 'माप', s_group: 'समूह', s_filters: 'फ़िल्टर', s_time: 'समय', s_order: 'क्रम', s_limit: 'सीमा', s_scope: 'आपका क्षेत्र', limits_note: 'AI से गलती हो तो वह केवल गलत दृश्य या फ़िल्टर चुन सकता है। वह आपके क्षेत्र से बाहर का डेटा नहीं छू सकता।', src: 'स्रोत', gen_data: 'जनित डेटा शामिल' }
};
EX = [{ q: 'Which areas had the most reports last week?' }, { q: 'How long does a fix take each day this fortnight?' }, { q: 'How many reports were reopened, by department, this month?' }, { q: 'Which officer is the slowest?' }];
VIEWS = [['reports_daily', 'reports per day, by area, department and category'], ['resolution_daily', 'median and slowest-tenth fix times per day'], ['sla_daily', 'finished jobs past their deadline, per day'], ['tickets_summary', 'counts of open, reopened, resolved complaints'], ['proof_outcomes', 'repair-proof outcomes by department (groups under 5 hidden)']];
componentDidMount() { try { const l = localStorage.getItem('gov.lang'); if (l === 'hi' || l === 'en') this.setState({ lang: l });  } catch (e) {} try { this.setState({ recent: JSON.parse(localStorage.getItem('gov.ask.recent') || '[]') }); } catch (e) {} }
setLang(l) { try { localStorage.setItem('gov.lang', l); } catch (e) {} this.setState({ lang: l }); }
setRole(r) { switchRole(r); window.location.reload(); }
async run(q) { q = (q || this.state.question).trim(); if (q.length < 3) return; this.setState({ question: q, asked: q, loading: true, res: null }); try { const res = await api('/api/ask', { method: 'POST', body: { question: q, lang: this.state.lang } }); const rec = [{ when: new Date().toLocaleDateString('en-IN', { day: 'numeric', month: 'short' }), q }].concat(this.state.recent.filter((r) => r.q !== q)).slice(0, 5); try { localStorage.setItem('gov.ask.recent', JSON.stringify(rec)); } catch (e) {} this.setState({ res, loading: false, recent: rec }); } catch (e) { this.setState({ res: { status: 'error' }, loading: false }); } }
mic() { try { const SR = window.SpeechRecognition || window.webkitSpeechRecognition; if (!SR) return; const r = new SR(); r.lang = this.state.lang === 'hi' ? 'hi-IN' : 'en-IN'; this.setState({ listening: true }); r.onresult = (ev) => { const text = ev.results[0][0].transcript; this.setState({ question: text }); this.run(text); }; r.onend = () => this.setState({ listening: false }); r.onerror = () => this.setState({ listening: false }); r.start(); } catch (e) { this.setState({ listening: false }); } }
renderVals() {
const s = this.state; const l = s.lang; const t = this.T[l]; const L = l === 'hi' ? 1 : 0; const ro = this.ROLES[s.role] || Object.values(this.ROLES)[0]; const rc = ro[5];
const nav = this.NAVD.filter((n) => n[3].indexOf(rc) >= 0).map((n) => ({ href: n[0], label: n[1 + L], cls: n[0] === '/ask' ? 'on' : '', cur: n[0] === '/ask' ? 'page' : 'false' }));
const scopeTxt = ro[1 + L]; const R = s.res || {}; const ok = R.status === 'ok'; const sp = R.spec || {};
const cols = ok ? R.columns : []; const rowsA = ok ? R.rows : []; const label = (v) => (v === null || v === undefined ? '–' : /^\d{4}-\d{2}-\d{2}T/.test(String(v)) ? String(v).slice(0, 10) : typeof v === 'number' ? v.toLocaleString('en-IN') : String(v));
const mcol = ok && sp.metrics ? sp.metrics[0] : null; const gcol = ok && sp.group_by && sp.group_by[0] ? sp.group_by[0] : null; const max = ok && mcol ? Math.max(1, ...rowsA.map((r) => Number(r[mcol]) || 0)) : 1;
const bars = ok && mcol && gcol ? rowsA.slice(0, 8).map((r, i) => { const v = Number(r[mcol]) || 0; return { label: label(r[gcol]), val: label(v), y: 8 + i * 48, ty: 28 + i * 48, w: Math.round((v / max) * 330), vx: 150 + Math.round((v / max) * 330) + 8 }; }) : [];
const ans = ok ? { q: s.asked, summary: R.summary, cols: cols.map((c) => c.replace(/_/g, ' ')), rows: rowsA.map((r) => ({ cells: cols.map((c) => label(r[c])) })), ms: R.ms, view: sp.view, metrics: (sp.metrics || []).join(', '), group: (sp.group_by || []).join(', ') || '–', filters: Object.keys(sp.filters || {}).length ? Object.entries(sp.filters).map(([k, v]) => k + ' = ' + v).join(', ') : '–', time: sp.time.from + ' → ' + sp.time.to, order: sp.order_by ? sp.order_by.metric + ', ' + (sp.order_by.dir === 'asc' ? 'low to high' : 'high to low') : '–', limit: String(sp.limit), scope: scopeTxt + (L ? ' (अपने आप लागू)' : ' (applied automatically)'), json: JSON.stringify(sp, null, 2) }
  : { q: s.asked, summary: '', cols: [], rows: [], ms: 0, view: '', metrics: '', group: '', filters: '', time: '', order: '', limit: '', scope: scopeTxt, json: '' };
const on = (k) => (v) => this.setState({ [k]: v.target.value });
return { t, nav, role: s.role, roleOpts: Object.keys(this.ROLES).map((k) => ({ v: k, l: this.ROLES[k][3 + L] })), onRole: (x) => this.setRole(x.target.value), isEn: l === 'en', isHi: l === 'hi', setEn: () => this.setLang('en'), setHi: () => this.setLang('hi'), user: ro[0], scope: scopeTxt,
question: s.question, onQ: on('question'), listening: s.listening, micLabel: s.listening ? t.mic_on : t.mic_off,
mic: () => this.mic(),
ask: () => this.run(),
examples: this.EX.map((x) => ({ q: x.q, pick: () => this.run(x.q) })), recent: s.recent.map((r) => ({ when: r.when, q: r.q, pick: () => this.run(r.q) })),
pstate: 'normal', onP: () => {}, pOpts: [],
loading: s.loading, error: R.status === 'error', cannot: R.status === 'cannot', cannotReason: R.reason || '', degraded: R.status === 'degraded', hasAnswer: ok, views: this.VIEWS.map((v) => ({ name: v[0], text: v[1] })),
ans, bars, chartH: 16 + bars.length * 48, showChart: bars.length > 0 };
}
}

AskTheCityLogic.prototype.view = function view(__v) {
  const { cannotReason, ans, ask, b, bars, c, cannot, chartH, degraded, e, error, examples, hasAnswer, isEn, isHi, listening, loading, mic, micLabel, n, nav, o, onP, onQ, onRole, pOpts, pstate, question, r, recent, role, roleOpts, scope, setEn, setHi, showChart, t, user, v, views } = __v;
  return (
    <div className="sc-ask" style={{ width: "100%", minHeight: "100vh", display: "flex", flexDirection: "column", background: "#FFFFFF", color: "#111827", fontFamily: "'Noto Sans','Noto Sans Devanagari',system-ui,sans-serif", fontSize: "14px", lineHeight: "1.4" }}>
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
        <div style={{ display: "flex", alignItems: "center", gap: "12px", flexWrap: "wrap" }}>
          <h1 style={{ margin: "0", fontSize: "22px" }}>
            {t.title}
          </h1>
          <span style={{ color: "#4B5563" }}>
            {t.sub}
          </span>
          <span className="chip" style={{ background: "#E5E7EB", color: "#1F2937" }}>
            {t.scoped}: {scope}
          </span>
          <span style={{ flex: "1" }}>
          </span>
        </div>
        <section className="card">
          <div style={{ display: "flex", gap: "8px" }}>
            <input type="text" value={question} onChange={onQ} aria-label={t.ask_label} placeholder={t.ask_ph} style={{ flex: "1", height: "44px", border: "2px solid #1D4ED8", borderRadius: "6px", padding: "0 12px", fontSize: "16px" }} />
            <button type="button" className="btn" onClick={mic} aria-label={t.mic} aria-pressed={listening}>
              {micLabel}
            </button>
            <button type="button" className="btn pri" style={{ height: "44px" }} onClick={ask}>
              {t.ask}
            </button>
          </div>
          <div style={{ display: "flex", gap: "8px", flexWrap: "wrap", alignItems: "center" }}>
            <span style={{ fontSize: "12.5px", color: "#4B5563", fontWeight: "600" }}>
              {t.examples}:
            </span>
            {examples.map((e, __i) => (
              <React.Fragment key={__i}>
              <button type="button" className="ex" onClick={e.pick}>
                {e.q}
              </button>
              </React.Fragment>
            ))}
          </div>
        </section>
        {!!(loading) && (
          <>
          <section className="card" role="status" style={{ alignItems: "center", padding: "40px" }}>
            <div style={{ fontSize: "16px", fontWeight: "600" }}>
              {t.loading}
            </div>
            <div style={{ color: "#4B5563" }}>
              {t.loading_sub}
            </div>
          </section>
          </>
        )}
        {!!(error) && (
          <>
          <section className="card" role="alert" style={{ borderColor: "#FCA5A5", background: "#FEF2F2" }}>
            <b style={{ color: "#7F1D1D" }}>
              {t.error}
            </b>
            <div>
              {t.error_sub}
            </div>
            <div>
              <button type="button" className="btn" onClick={ask}>
                {t.retry}
              </button>
            </div>
          </section>
          </>
        )}
        {!!(cannot) && (
          <>
          <section className="card" style={{ borderColor: "#F59E0B", background: "#FFFBEB" }}>
            <b>
              {t.cannot}
            </b>
            <div>
              {cannotReason || t.cannot_sub}
            </div>
            <div style={{ fontSize: "13px" }}>
              <b>
                {t.allowed_views}:
              </b>
            </div>
            <ul style={{ margin: "0", paddingLeft: "18px", fontSize: "13px" }}>
              {views.map((v, __i) => (
                <React.Fragment key={__i}>
                <li>
                  <b style={{ fontFamily: "ui-monospace, Menlo, monospace" }}>
                    {v.name}
                  </b>
                  {' '}– {v.text}
                </li>
                </React.Fragment>
              ))}
            </ul>
          </section>
          </>
        )}
        {!!(hasAnswer) && (
          <>
          {!!(degraded) && (
            <>
            <div role="status" style={{ padding: "8px 12px", background: "#FEF3C7", border: "1px solid #F59E0B", borderRadius: "6px", fontWeight: "600", color: "#78350F" }}>
              {t.degraded}
            </div>
            </>
          )}
          <div style={{ display: "grid", gridTemplateColumns: "minmax(0, 1.5fr) minmax(0, 1fr)", gap: "12px", alignItems: "start" }}>
            <section className="card">
              <h2>
                {t.answer}: {ans.q}
              </h2>
              <div style={{ fontSize: "15px" }}>
                {ans.summary}
              </div>
              {!!(showChart) && (
                <>
                <svg viewBox={`0 0 560 ${chartH}`} role="img" aria-label={ans.q} style={{ width: "100%" }}>
                  {bars.map((b, __i) => (
                    <React.Fragment key={__i}>
                    <text x="0" y={b.ty} fontSize="13" fill="#111827">
                      {b.label}
                    </text>
                    <rect x="150" y={b.y} width={b.w} height="30" fill="#1D4ED8" />
                    <text x={b.vx} y={b.ty} fontSize="13" fontWeight="700" fill="#111827">
                      {b.val}
                    </text>
                    </React.Fragment>
                  ))}
                </svg>
                </>
              )}
              <table>
                <thead>
                  <tr>
                    {ans.cols.map((c, __i) => (
                      <React.Fragment key={__i}>
                      <th scope="col">
                        {c}
                      </th>
                      </React.Fragment>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {ans.rows.map((r, __i) => (
                    <React.Fragment key={__i}>
                    <tr>
                      {r.cells.map((c, __i) => (
                        <React.Fragment key={__i}>
                        <td>
                          {c}
                        </td>
                        </React.Fragment>
                      ))}
                    </tr>
                    </React.Fragment>
                  ))}
                </tbody>
              </table>
              <div style={{ fontSize: "11.5px", color: "#4B5563" }}>
                {t.src}: ask/run · {ans.ms} ms · {t.scoped_small} · {t.gen_data}
              </div>
            </section>
            <section className="card" aria-label={t.spec}>
              <h2>
                {t.spec}
              </h2>
              <div style={{ fontSize: "12.5px", color: "#4B5563" }}>
                {t.spec_help}
              </div>
              <dl className="spec">
                <dt>
                  {t.s_view}
                </dt>
                <dd>
                  {ans.view}
                </dd>
                <dt>
                  {t.s_metrics}
                </dt>
                <dd>
                  {ans.metrics}
                </dd>
                <dt>
                  {t.s_group}
                </dt>
                <dd>
                  {ans.group}
                </dd>
                <dt>
                  {t.s_filters}
                </dt>
                <dd>
                  {ans.filters}
                </dd>
                <dt>
                  {t.s_time}
                </dt>
                <dd>
                  {ans.time}
                </dd>
                <dt>
                  {t.s_order}
                </dt>
                <dd>
                  {ans.order}
                </dd>
                <dt>
                  {t.s_limit}
                </dt>
                <dd>
                  {ans.limit}
                </dd>
                <dt>
                  {t.s_scope}
                </dt>
                <dd>
                  {ans.scope}
                </dd>
              </dl>
              <details style={{ fontSize: "12.5px" }}>
                <summary style={{ cursor: "pointer", fontWeight: "600" }}>
                  {t.raw}
                </summary>
                <pre style={{ margin: "6px 0 0", padding: "8px", background: "#F3F4F6", borderRadius: "6px", overflow: "auto", fontSize: "11.5px" }}>
                  {ans.json}
                </pre>
              </details>
              <div style={{ fontSize: "12.5px", padding: "8px 10px", background: "#F9FAFB", borderRadius: "6px" }}>
                {t.limits_note}
              </div>
            </section>
          </div>
          </>
        )}
        <section className="card">
          <h2>
            {t.recent}
          </h2>
          <ul style={{ margin: "0", padding: "0", listStyle: "none", display: "flex", flexDirection: "column", gap: "4px" }}>
            {recent.map((r, __i) => (
              <React.Fragment key={__i}>
              <li style={{ display: "flex", gap: "10px", fontSize: "13.5px" }}>
                <span style={{ color: "#4B5563", minWidth: "70px" }}>
                  {r.when}
                </span>
                <button type="button" className="ex" onClick={r.pick} style={{ borderRadius: "6px" }}>
                  {r.q}
                </button>
              </li>
              </React.Fragment>
            ))}
          </ul>
        </section>
      </main>
      <footer style={{ padding: "10px 20px", fontSize: "12px", color: "#4B5563", borderTop: "1px solid #D1D5DB", background: "#fff", marginTop: "auto" }}>
        {t.proto}
      </footer>
    </div>
  );
};

export default AskTheCityLogic;
