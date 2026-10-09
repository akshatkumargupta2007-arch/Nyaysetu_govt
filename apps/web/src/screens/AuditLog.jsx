import React from 'react';
import { DCLogic, css } from '../lib/dc.js';
import { TLink } from '../lib/TLink.jsx';
import { govRoles, currentRoleKey, switchRole } from '../lib/gov.js';
import { logout, api, qs } from '../lib/client.js';
import './AuditLog.css';

/* Behaviour and sample data of this screen. Replace the sample data with calls to your API (see docs/DATA.md). */
class AuditLogLogic extends DCLogic {
state = { lang: 'en', role: currentRoleKey(), tab: 'reveals', intact: false, broken: false, brokenAt: null, rv: [], rvNext: null, ac: [], acNext: null, bad: false, ms: null, checking: false };
ROLES = govRoles();
NAVD = [['/', 'Civic Pulse', 'सिविक पल्स', 'nstcd'], ['/complaints', 'Complaints', 'शिकायतें', 'nstcd'], ['/queue', 'Closure Court', 'क्लोज़र कोर्ट', 'nstcd'], ['/ask', 'Ask the City', 'शहर से पूछें', 'nstcd'], ['/scorecard', 'Scorecard', 'स्कोरकार्ड', 'nstc'], ['/benchmark', 'Benchmark', 'बेंचमार्क', 'n'], ['/health', 'System health', 'सिस्टम स्वास्थ्य', 'n'], ['/audit', 'Audit log', 'ऑडिट लॉग', 'n']];
T = {
en: { brand: 'NyaySetu Gov', generated: 'Generated data', legend: 'Legend', view_as: 'View as', signout: 'Sign out', proto: 'Prototype. Not an official government website.',
denied_title: 'This page is not available for your role', denied_body: 'The audit log is for the national administrator only.', back_pulse: 'Back to Civic Pulse',
nav_audit: 'Audit log', sub: 'Who looked at which mobile number, and every sensitive action. Nobody can edit or delete these entries.', check: 'Check that nothing was changed', intact: 'The audit log is intact: no entry was changed or removed.', broken: 'WARNING: the audit log was altered at entry 4,812.', preview_state: 'Preview a state',
reveals: 'Mobile number views', actions: 'Other actions', when: 'When', who: 'Official', c_id: 'Complaint ID', reason: 'Reason given', what: 'Action', target: 'Item', more: 'Load more', keep: 'Entries are kept for the legal period and cannot be edited. Every entry is linked to the one before it.', src: 'Source' },
hi: { brand: 'न्यायसेतु शासन', generated: 'जनित डेटा', legend: 'संकेत-सूची', view_as: 'इस रूप में देखें', signout: 'लॉग आउट', proto: 'प्रोटोटाइप। आधिकारिक सरकारी वेबसाइट नहीं।',
denied_title: 'आपकी भूमिका के लिए यह पृष्ठ उपलब्ध नहीं', denied_body: 'ऑडिट लॉग केवल राष्ट्रीय प्रशासक के लिए है।', back_pulse: 'सिविक पल्स पर वापस',
nav_audit: 'ऑडिट लॉग', sub: 'किसने कौन सा मोबाइल नंबर देखा, और हर संवेदनशील कार्रवाई। इन प्रविष्टियों को कोई बदल या मिटा नहीं सकता।', check: 'जाँचें कि कुछ बदला नहीं गया', intact: 'ऑडिट लॉग सुरक्षित है: कोई प्रविष्टि बदली या हटाई नहीं गई।', broken: 'चेतावनी: ऑडिट लॉग में प्रविष्टि 4,812 पर बदलाव हुआ।', preview_state: 'कोई स्थिति देखें',
reveals: 'मोबाइल नंबर देखे गए', actions: 'अन्य कार्रवाइयाँ', when: 'कब', who: 'अधिकारी', c_id: 'शिकायत संख्या', reason: 'दिया गया कारण', what: 'कार्रवाई', target: 'विषय', more: 'और लोड करें', keep: 'प्रविष्टियाँ कानूनी अवधि तक रखी जाती हैं और बदली नहीं जा सकतीं। हर प्रविष्टि पिछली से जुड़ी है।', src: 'स्रोत' }
};
async page(kind, before) { try { const t0 = performance.now(); const r = await api('/api/audit/' + (kind === 'rv' ? 'reveals' : 'log') + qs({ limit: 25, before })); const items = (before ? this.state[kind] : []).concat(r.items); this.setState({ [kind]: items, [kind + 'Next']: r.next || null, bad: false, ms: Math.round(performance.now() - t0) }); } catch (e) { this.setState({ bad: true }); } }
componentDidMount() { try { const l = localStorage.getItem('gov.lang'); if (l === 'hi' || l === 'en') this.setState({ lang: l });  } catch (e) {} if (this.state.role === 'national') { this.page('rv'); this.page('ac'); } }
setLang(l) { try { localStorage.setItem('gov.lang', l); } catch (e) {} this.setState({ lang: l }); }
setRole(r) { switchRole(r); window.location.reload(); }
renderVals() {
const s = this.state; const l = s.lang; const t = this.T[l]; const L = l === 'hi' ? 1 : 0; const ro = this.ROLES[s.role] || Object.values(this.ROLES)[0]; const rc = ro[5];
const nav = this.NAVD.filter((n) => n[3].indexOf(rc) >= 0).map((n) => ({ href: n[0], label: n[1 + L], cls: n[0] === '/audit' ? 'on' : '', cur: n[0] === '/audit' ? 'page' : 'false' }));
const allowed = rc === 'n'; const fmtT = (iso) => new Date(iso).toLocaleString(l === 'hi' ? 'hi-IN' : 'en-IN', { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit', timeZone: 'Asia/Kolkata' });
return { t, nav, role: s.role, roleOpts: Object.keys(this.ROLES).map((k) => ({ v: k, l: this.ROLES[k][3 + L] })), onRole: (e) => this.setRole(e.target.value), isEn: l === 'en', isHi: l === 'hi', setEn: () => this.setLang('en'), setHi: () => this.setLang('hi'), user: ro[0], scope: ro[1 + L],
allowed, denied: !allowed, tabReveals: s.tab === 'reveals', tabActions: s.tab === 'actions', showReveals: () => this.setState({ tab: 'reveals' }), showActions: () => this.setState({ tab: 'actions' }),
reveals: s.rv.map((r) => ({ when: fmtT(r.at), who: r.userName || r.userId, code: r.code, reason: r.reason })), actions: s.ac.map((r) => ({ when: fmtT(r.at), who: r.userName || r.userId, what: r.action, target: r.target || '–' })), more: () => { const k = this.state.tab === 'reveals' ? 'rv' : 'ac'; const nx = this.state[k + 'Next']; if (nx) this.page(k, nx); }, hasMore: !!(s.tab === 'reveals' ? s.rvNext : s.acNext), bad: s.bad, ms: s.ms,
intact: s.intact, broken: s.broken, check: async () => { try { const r = await api('/api/audit/verify'); this.setState({ intact: !!r.intact, broken: !r.intact, brokenAt: r.brokenAtId }); } catch (e) { this.setState({ bad: true }); } setTimeout(() => this.setState({ intact: false, broken: false }), 9000); },
brokenAt: s.brokenAt };
}
}

AuditLogLogic.prototype.view = function view(__v) {
  const { actions, allowed, broken, brokenAt, hasMore, bad, ms, check, denied, intact, isEn, isHi, more, n, nav, o, onRole, r, reveals, role, roleOpts, scope, setEn, setHi, showActions, showReveals, t, tabActions, tabReveals, user } = __v;
  return (
    <div className="sc-audit" style={{ width: "100%", minHeight: "100vh", display: "flex", flexDirection: "column", background: "#FFFFFF", color: "#111827", fontFamily: "'Noto Sans','Noto Sans Devanagari',system-ui,sans-serif", fontSize: "14px", lineHeight: "1.4" }}>
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
          <div style={{ display: "flex", alignItems: "center", gap: "14px", flexWrap: "wrap" }}>
            <h1 style={{ margin: "0", fontSize: "22px" }}>
              {t.nav_audit}
            </h1>
            <span style={{ color: "#4B5563" }}>
              {t.sub}
            </span>
            <span style={{ flex: "1" }}>
            </span>
            <button type="button" className="btn" onClick={check}>
              {t.check}
            </button>
          </div>
          {!!(intact) && (
            <>
            <div role="status" style={{ padding: "10px 14px", background: "#DCFCE7", border: "1px solid #86EFAC", borderRadius: "6px", color: "#14532D", fontWeight: "600" }}>
              ✓ {t.intact}
            </div>
            </>
          )}
          {!!(broken) && (
            <>
            <div role="alert" style={{ padding: "10px 14px", background: "#FEE2E2", border: "1px solid #FCA5A5", borderRadius: "6px", color: "#7F1D1D", fontWeight: "700" }}>
              ✕ {t.broken.replace('4,812', String(brokenAt))}
            </div>
            </>
          )}
          <div style={{ display: "flex", gap: "12px", alignItems: "center", flexWrap: "wrap" }}>
            <span className="seg" role="group" aria-label={t.nav_audit}>
              <button type="button" aria-pressed={tabReveals} onClick={showReveals}>
                {t.reveals}
              </button>
              <button type="button" aria-pressed={tabActions} onClick={showActions}>
                {t.actions}
              </button>
            </span>
          </div>
          <section style={{ background: "#FFFFFF", border: "0", borderTop: "3px solid #1F2937", borderRadius: "0", overflow: "hidden" }}>
            {!!(tabReveals) && (
              <>
              <table>
                <thead>
                  <tr>
                    <th scope="col">
                      {t.when}
                    </th>
                    <th scope="col">
                      {t.who}
                    </th>
                    <th scope="col">
                      {t.c_id}
                    </th>
                    <th scope="col">
                      {t.reason}
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {reveals.map((r, __i) => (
                    <React.Fragment key={__i}>
                    <tr>
                      <td style={{ whiteSpace: "nowrap" }}>
                        {r.when}
                      </td>
                      <td>
                        {r.who}
                      </td>
                      <td style={{ fontFamily: "ui-monospace, Menlo, monospace", fontWeight: "700" }}>
                        {r.code}
                      </td>
                      <td>
                        {r.reason}
                      </td>
                    </tr>
                    </React.Fragment>
                  ))}
                </tbody>
              </table>
              </>
            )}
            {!!(tabActions) && (
              <>
              <table>
                <thead>
                  <tr>
                    <th scope="col">
                      {t.when}
                    </th>
                    <th scope="col">
                      {t.who}
                    </th>
                    <th scope="col">
                      {t.what}
                    </th>
                    <th scope="col">
                      {t.target}
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {actions.map((r, __i) => (
                    <React.Fragment key={__i}>
                    <tr>
                      <td style={{ whiteSpace: "nowrap" }}>
                        {r.when}
                      </td>
                      <td>
                        {r.who}
                      </td>
                      <td>
                        {r.what}
                      </td>
                      <td style={{ fontFamily: "ui-monospace, Menlo, monospace" }}>
                        {r.target}
                      </td>
                    </tr>
                    </React.Fragment>
                  ))}
                </tbody>
              </table>
              </>
            )}
            <div style={{ padding: "8px 14px", fontSize: "12px", color: "#4B5563", borderTop: "1px solid #F3F4F6", display: "flex", gap: "12px" }}>
              <span>
                {t.src}: audit · {ms ?? '–'} ms{bad ? ' · ' + (isHi ? 'लोड नहीं हो सका' : 'could not load') : ''}
              </span>
              <span style={{ flex: "1" }}>
              </span>
              <button type="button" className="btn" onClick={more} disabled={!hasMore} style={{ height: "28px", fontSize: "12px" }}>
                {t.more}
              </button>
            </div>
          </section>
          <span style={{ color: "#4B5563", fontSize: "13px" }}>
            {t.keep}
          </span>
          </>
        )}
      </main>
      <footer style={{ padding: "10px 20px", fontSize: "12px", color: "#4B5563", borderTop: "1px solid #D1D5DB", background: "#fff", marginTop: "auto" }}>
        {t.proto}
      </footer>
    </div>
  );
};

export default AuditLogLogic;
