import React from 'react';
import { DCLogic, css } from '../lib/dc.js';
import { TLink } from '../lib/TLink.jsx';
import { govRoles, currentRoleKey, switchRole } from '../lib/gov.js';
import { logout, api } from '../lib/client.js';
import './ReviewQueue.css';

/* Behaviour and sample data of this screen. Replace the sample data with calls to your API (see docs/DATA.md). */
class ReviewQueueLogic extends DCLogic {
state = { items: [], ms: 0, bad: false, lang: 'en', role: currentRoleKey(), verdict: '', dept: '', age: '', sort: 'oldest' };
ROLES = govRoles();
NAVD = [['/', 'Civic Pulse', 'सिविक पल्स', 'nstcd'], ['/complaints', 'Complaints', 'शिकायतें', 'nstcd'], ['/queue', 'Closure Court', 'क्लोज़र कोर्ट', 'nstcd'], ['/ask', 'Ask the City', 'शहर से पूछें', 'nstcd'], ['/scorecard', 'Scorecard', 'स्कोरकार्ड', 'nstc'], ['/benchmark', 'Benchmark', 'बेंचमार्क', 'n'], ['/health', 'System health', 'सिस्टम स्वास्थ्य', 'n'], ['/audit', 'Audit log', 'ऑडिट लॉग', 'n']];
T = {
en: { brand: 'NyaySetu Gov', generated: 'Generated data', legend: 'Legend', view_as: 'View as', signout: 'Sign out', proto: 'Prototype. The AI never closes a complaint. The citizen decides.',
title: 'Closure Court: review queue', sub: 'Complaints with repair proof that need a person.', scoped: 'Scoped to your area', to_score: 'Scorecard →', verdicts: 'Verdicts',
dept: 'Department', all: 'All', age: 'Waiting for', age1: 'More than 1 day', age3: 'More than 3 days', age7: 'More than 7 days', sort: 'Sort', sort_old: 'Oldest waiting first', sort_new: 'Newest first',
c_id: 'Complaint ID', c_cat: 'Category', c_area: 'Area', c_verdict: 'Latest verdict', c_subs: 'Proofs', c_last: 'Last activity', c_wait: 'Waiting', c_contract: 'Contract', c_tag: 'Demo tag', gen_tag: 'Generated', empty: 'No complaints with this verdict in your area.', src: 'Source', gen_note: 'demo tickets are generated' },
hi: { brand: 'न्यायसेतु शासन', generated: 'जनित डेटा', legend: 'संकेत-सूची', view_as: 'इस रूप में देखें', signout: 'लॉग आउट', proto: 'प्रोटोटाइप। AI कभी शिकायत बंद नहीं करता। नागरिक तय करता है।',
title: 'क्लोज़र कोर्ट: समीक्षा सूची', sub: 'मरम्मत-प्रमाण वाली शिकायतें जिन्हें व्यक्ति चाहिए।', scoped: 'आपके क्षेत्र तक सीमित', to_score: 'स्कोरकार्ड →', verdicts: 'निर्णय',
dept: 'विभाग', all: 'सभी', age: 'इंतज़ार', age1: '1 दिन से अधिक', age3: '3 दिन से अधिक', age7: '7 दिन से अधिक', sort: 'क्रम', sort_old: 'सबसे पुराना पहले', sort_new: 'सबसे नया पहले',
c_id: 'शिकायत संख्या', c_cat: 'श्रेणी', c_area: 'क्षेत्र', c_verdict: 'ताज़ा निर्णय', c_subs: 'प्रमाण', c_last: 'पिछली गतिविधि', c_wait: 'इंतज़ार', c_contract: 'अनुबंध', c_tag: 'डेमो टैग', gen_tag: 'जनित', empty: 'आपके क्षेत्र में इस निर्णय वाली कोई शिकायत नहीं।', src: 'स्रोत', gen_note: 'डेमो टिकट जनित हैं' }
};
V = { hum: ['?', 'Needs human review', 'व्यक्ति की समीक्षा', 'background:#EDE9FE;color:#4C1D95;'], cont: ['≠', 'Contested', 'विवादित', 'background:#EDE9FE;color:#4C1D95;'], more: ['＋', 'Needs more evidence', 'और प्रमाण चाहिए', 'background:#FEF3C7;color:#78350F;'], fail: ['✕', 'Failed', 'विफल', 'background:#FEE2E2;color:#7F1D1D;'], rej: ['✕', 'Rejected', 'अस्वीकृत', 'background:#E5E7EB;color:#1F2937;'], pass: ['✓', 'Passed, awaiting citizen', 'पास, नागरिक की प्रतीक्षा', 'background:#DCFCE7;color:#14532D;'] };
get D() {
  const l = this.state.lang; const nm = (o) => (o ? (o[l] || o.en || '') : ''); const vm = { NEEDS_HUMAN_REVIEW: 'hum', NEEDS_MORE_EVIDENCE: 'more', FAILED: 'fail', REJECTED: 'rej', EVIDENCE_PASSED: 'pass' };
  return (this.state.items || []).map((i) => [i.code, nm(i.category.names), nm(i.department.agency), nm(i.city), nm(i.area), vm[i.verdict] || 'hum', i.submissions, i.lastActivity ? new Date(i.lastActivity).toLocaleString(l === 'hi' ? 'hi-IN' : 'en-IN', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Kolkata' }) : '–', Math.max(0, (Date.now() - new Date(i.lastActivity || Date.now()).getTime()) / 86400000), i.contractSource === 'gemini' ? 'gemini' : 'template', '', i.id]);
}
async load() { try { const t0 = performance.now(); const q = await api('/api/court/queue'); this.setState({ items: q.items, ms: Math.round(performance.now() - t0), bad: false }); } catch (e) { this.setState({ bad: true }); } }
componentDidMount() { try { const l = localStorage.getItem('gov.lang'); if (l === 'hi' || l === 'en') this.setState({ lang: l });  } catch (e) {} this.load(); this._iv = setInterval(() => { if (!document.hidden) this.load(); }, 15000); }
componentWillUnmount() { clearInterval(this._iv); }
setLang(l) { try { localStorage.setItem('gov.lang', l); } catch (e) {} this.setState({ lang: l }); }
setRole(r) { switchRole(r); window.location.reload(); }
inScope() { return true; } // the server only returns complaints inside the official's area
renderVals() {
const s = this.state; const l = s.lang; const t = this.T[l]; const L = l === 'hi' ? 1 : 0; const ro = this.ROLES[s.role] || Object.values(this.ROLES)[0]; const rc = ro[5];
const nav = this.NAVD.filter((n) => n[3].indexOf(rc) >= 0).map((n) => ({ href: n[0], label: n[1 + L], cls: n[0] === '/queue' ? 'on' : '', cur: n[0] === '/queue' ? 'page' : 'false' }));
const base = this.D.filter((r) => this.inScope(r) && (!s.dept || r[2] === s.dept) && (!s.age || r[8] > parseInt(s.age, 10)));
const keys = ['hum', 'more', 'fail', 'rej', 'pass'];
const vfilters = [{ sym: '≡', label: L ? 'सभी' : 'All', n: base.length, on: s.verdict === '', pick: () => this.setState({ verdict: '' }) }].concat(keys.map((k) => ({ sym: this.V[k][0], label: this.V[k][1 + L], n: base.filter((r) => r[5] === k).length, on: s.verdict === k, pick: () => this.setState({ verdict: k }) })));
let list = base.filter((r) => !s.verdict || r[5] === s.verdict); list = list.sort((a, b) => (s.sort === 'oldest' ? b[8] - a[8] : a[8] - b[8]));
const rows = list.map((r) => ({ code: r[0], cat: r[1], dept: r[2], area: r[4] + ', ' + r[3], vSym: this.V[r[5]][0], vText: this.V[r[5]][1 + L], vStyle: this.V[r[5]][3], subs: r[6], last: r[7], wait: (r[8] < 1 ? Math.round(r[8] * 24) + ' h' : r[8].toFixed(1) + ' d'), cText: r[9] === 'gemini' ? 'Gemini' : (L ? 'टेम्पलेट' : 'Template'), cStyle: r[9] === 'gemini' ? 'background:#DBEAFE;color:#1E3A8A;' : 'background:#FEF3C7;color:#78350F;', demo: !!r[10], scenario: r[10], open: (e) => { if (e && e.stopPropagation) e.stopPropagation(); try { sessionStorage.setItem('gov.court', JSON.stringify({ code: r[0], id: r[11] })); } catch (x) {} setTimeout(() => { try { document.getElementById('goCourt').click(); } catch (x) {} }, 30); } }));
const depts = []; this.D.filter((r) => this.inScope(r)).forEach((r) => { if (depts.indexOf(r[2]) < 0) depts.push(r[2]); });
const on = (k) => (e) => this.setState({ [k]: e.target.value });
return { t, nav, role: s.role, roleOpts: Object.keys(this.ROLES).map((k) => ({ v: k, l: this.ROLES[k][3 + L] })), onRole: (e) => this.setRole(e.target.value), isEn: l === 'en', isHi: l === 'hi', setEn: () => this.setLang('en'), setHi: () => this.setLang('hi'), user: ro[0], scope: ro[1 + L],
bad: s.bad, ms: s.ms, vfilters, rows, empty: rows.length === 0, countText: rows.length + ' / ' + base.length, dept: s.dept, age: s.age, sort: s.sort, onDept: on('dept'), onAge: on('age'), onSort: on('sort'), deptOpts: depts.sort() };
}
}

ReviewQueueLogic.prototype.view = function view(__v) {
  const { bad, ms, age, countText, dept, deptOpts, empty, isEn, isHi, n, nav, o, onAge, onDept, onRole, onSort, r, role, roleOpts, rows, scope, setEn, setHi, sort, t, user, v, vfilters } = __v;
  return (
    <div className="sc-queue" style={{ width: "100%", minHeight: "100vh", display: "flex", flexDirection: "column", background: "#FFFFFF", color: "#111827", fontFamily: "'Noto Sans','Noto Sans Devanagari',system-ui,sans-serif", fontSize: "14px", lineHeight: "1.4" }}>
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
      {!!bad && (<div role="alert" style={{ margin: "8px 20px 0", padding: "8px 12px", background: "#FEF3C7", border: "1px solid #F59E0B", borderRadius: "6px", color: "#78350F", fontWeight: "600" }}>{isHi ? "कतार लोड नहीं हो सकी।" : "The queue could not be loaded."}</div>)}
      <main style={{ flex: "1 1 auto", width: "100%", maxWidth: "1560px", margin: "0 auto", padding: "14px 20px 20px", display: "flex", flexDirection: "column", gap: "14px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "14px", flexWrap: "wrap" }}>
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
          <TLink to="/scorecard" className="btn">
            {t.to_score}
          </TLink>
        </div>
        <section aria-label={t.verdicts} style={{ display: "grid", gridTemplateColumns: "repeat(7, minmax(0, 1fr))", gap: "8px" }}>
          {vfilters.map((v, __i) => (
            <React.Fragment key={__i}>
            <button type="button" className="vf" aria-pressed={v.on} onClick={v.pick}>
              <span style={{ fontWeight: "600", fontSize: "13px" }}>
                {v.sym} {v.label}
              </span>
              <b>
                {v.n}
              </b>
            </button>
            </React.Fragment>
          ))}
        </section>
        <section style={{ background: "#fff", border: "0", borderTop: "3px solid #1F2937", borderRadius: "0", padding: "10px 14px", display: "flex", gap: "14px", alignItems: "end", flexWrap: "wrap" }}>
          <label className="field">
            {t.dept}
            <select value={dept} onChange={onDept}>
              <option value="">
                {t.all}
              </option>
              {deptOpts.map((o, __i) => (
                <React.Fragment key={__i}>
                <option value={o}>
                  {o}
                </option>
                </React.Fragment>
              ))}
            </select>
          </label>
          <label className="field">
            {t.age}
            <select value={age} onChange={onAge}>
              <option value="">
                {t.all}
              </option>
              <option value="1">
                {t.age1}
              </option>
              <option value="3">
                {t.age3}
              </option>
              <option value="7">
                {t.age7}
              </option>
            </select>
          </label>
          <label className="field">
            {t.sort}
            <select value={sort} onChange={onSort}>
              <option value="oldest">
                {t.sort_old}
              </option>
              <option value="new">
                {t.sort_new}
              </option>
            </select>
          </label>
          <span style={{ flex: "1" }}>
          </span>
          <span style={{ color: "#4B5563", fontSize: "13px" }}>
            {countText}
          </span>
        </section>
        <section style={{ background: "#fff", border: "0", borderTop: "3px solid #1F2937", borderRadius: "0", overflow: "hidden" }}>
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
                  {t.dept}
                </th>
                <th scope="col">
                  {t.c_area}
                </th>
                <th scope="col">
                  {t.c_verdict}
                </th>
                <th scope="col">
                  {t.c_subs}
                </th>
                <th scope="col">
                  {t.c_last}
                </th>
                <th scope="col">
                  {t.c_wait}
                </th>
                <th scope="col">
                  {t.c_contract}
                </th>
                <th scope="col">
                  {t.c_tag}
                </th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r, __i) => (
                <React.Fragment key={__i}>
                <tr className="row" onClick={r.open}>
                  <td style={{ whiteSpace: "nowrap" }}>
                    <TLink to="/court" onClick={r.open} style={{ fontWeight: "700", fontFamily: "ui-monospace, Menlo, monospace" }}>
                      {r.code}
                    </TLink>
                  </td>
                  <td>
                    {r.cat}
                  </td>
                  <td>
                    {r.dept}
                  </td>
                  <td>
                    {r.area}
                  </td>
                  <td>
                    <span className="chip" style={css(r.vStyle)}>
                      {r.vSym} {r.vText}
                    </span>
                  </td>
                  <td>
                    {r.subs}
                  </td>
                  <td style={{ whiteSpace: "nowrap" }}>
                    {r.last}
                  </td>
                  <td style={{ whiteSpace: "nowrap", fontWeight: "700" }}>
                    {r.wait}
                  </td>
                  <td>
                    <span className="chip" style={css(r.cStyle)}>
                      {r.cText}
                    </span>
                  </td>
                  <td>
                    {!!(r.demo) && (
                      <>
                      <span className="chip" style={{ background: "#FEF3C7", color: "#78350F" }}>
                        {t.gen_tag} · {r.scenario}
                      </span>
                      </>
                    )}
                  </td>
                </tr>
                </React.Fragment>
              ))}
            </tbody>
          </table>
          {!!(empty) && (
            <>
            <div style={{ padding: "40px", textAlign: "center", color: "#4B5563" }}>
              {t.empty}
            </div>
            </>
          )}
          <div style={{ padding: "6px 12px", fontSize: "11px", color: "#4B5563", borderTop: "1px solid #F3F4F6" }}>
            {t.src}: court/queue · {ms} ms
          </div>
        </section>
      </main>
      <TLink id="goCourt" to="/court" tabIndex="-1" aria-hidden="true" style={{ display: "none" }}>
      </TLink>
      <footer style={{ padding: "10px 20px", fontSize: "12px", color: "#4B5563", borderTop: "1px solid #D1D5DB", background: "#fff", marginTop: "auto" }}>
        {t.proto}
      </footer>
    </div>
  );
};

export default ReviewQueueLogic;
