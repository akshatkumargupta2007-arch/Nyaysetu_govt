import React from 'react';
import { DCLogic, css } from '../lib/dc.js';
import { TLink } from '../lib/TLink.jsx';
import { govRoles, currentRoleKey, switchRole } from '../lib/gov.js';
import { logout } from '../lib/client.js';
import './Legend.css';

/* What each word, label and colour on the portal means. It only lists what the portal still has:
   the Complaints page, the Audit log and this page. */
class LegendLogic extends DCLogic {
state = { lang: 'en', role: currentRoleKey() };
ROLES = govRoles();
NAVD = [['/complaints', 'Complaints', 'शिकायतें', 'nstcd'], ['/audit', 'Audit log', 'ऑडिट लॉग', 'n']];
T = {
en: { brand: 'NyaySetu Gov', generated: 'Generated data', view_as: 'View as', signout: 'Sign out', proto: 'Prototype. One vocabulary is used on every page.', title: 'Legend and data labels', sub: 'What each word, symbol and label means. Colour is never the only signal.', back: 'Back',
status: 'Complaint status', priority: 'Priority', verify: 'Citizen verification', verify_help: 'Only the citizen can close a complaint. The portal can only ask the citizen to confirm that the problem is fixed.', labels: 'Data labels', labels_help: 'These labels appear wherever they apply.',
access: 'Who can see which page', access_note: '✓ = can see · – = cannot. Everything is limited to the person’s own area; out-of-scope records behave as “not found”.', page: 'Page', page_names: 'Complaints (table, map, filters, export)|Audit log|Legend' },
hi: { brand: 'न्यायसेतु शासन', generated: 'जनित डेटा', view_as: 'इस रूप में देखें', signout: 'लॉग आउट', proto: 'प्रोटोटाइप। हर पृष्ठ पर एक ही शब्दावली।', title: 'संकेत-सूची और डेटा लेबल', sub: 'हर शब्द, प्रतीक और लेबल का मतलब। रंग कभी अकेला संकेत नहीं होता।', back: 'वापस',
status: 'शिकायत की स्थिति', priority: 'प्राथमिकता', verify: 'नागरिक की पुष्टि', verify_help: 'शिकायत केवल नागरिक ही बंद कर सकता है। पोर्टल केवल नागरिक से पुष्टि करने को कह सकता है कि समस्या ठीक हुई।', labels: 'डेटा लेबल', labels_help: 'ये लेबल जहाँ लागू हों वहाँ दिखते हैं।',
access: 'कौन सा पृष्ठ कौन देख सकता है', access_note: '✓ = देख सकता है · – = नहीं। सब कुछ व्यक्ति के अपने क्षेत्र तक सीमित है; क्षेत्र से बाहर के रिकॉर्ड “नहीं मिला” जैसे व्यवहार करते हैं।', page: 'पृष्ठ', page_names: 'शिकायतें (तालिका, मानचित्र, फ़िल्टर, एक्सपोर्ट)|ऑडिट लॉग|संकेत-सूची' }
};
componentDidMount() { try { const l = localStorage.getItem('gov.lang'); if (l === 'hi' || l === 'en') this.setState({ lang: l });  } catch (e) {} }
setLang(l) { try { localStorage.setItem('gov.lang', l); } catch (e) {} this.setState({ lang: l }); }
setRole(r) { switchRole(r); window.location.reload(); }
renderVals() {
const s = this.state; const l = s.lang; const t = this.T[l]; const L = l === 'hi' ? 1 : 0; const ro = this.ROLES[s.role]; const rc = ro[5];
const nav = this.NAVD.filter((n) => n[3].indexOf(rc) >= 0).map((n) => ({ href: n[0], label: n[1 + L], cls: '', cur: 'false' }));
const e = (en, hi) => (L ? hi : en);
const G = 'background:#DCFCE7;color:#14532D;', R = 'background:#FEE2E2;color:#7F1D1D;', Y = 'background:#FEF3C7;color:#78350F;', Gr = 'background:#E5E7EB;color:#1F2937;', B = 'background:#DBEAFE;color:#1E3A8A;';
const labels = [['!', e('Generated', 'जनित'), Y, e('The data was produced by a demo tool, not by a real citizen.', 'डेटा डेमो टूल ने बनाया, किसी असली नागरिक ने नहीं।')], ['◎', e('Approximate location', 'लगभग स्थान'), Gr, e('Locations are accurate to about ±25 m. Ward and sector outlines on the map are approximate.', 'स्थान लगभग ±25 मी तक सही हैं। मानचित्र पर वार्ड और सेक्टर की रेखाएँ लगभग हैं।')]].map((x) => ({ sym: x[0], name: x[1], style: x[2], text: x[3] }));
const statuses = [['Received', B, e('The complaint arrived.', 'शिकायत मिली।')], ['Needs triage', Y, e('The system could not decide who owns it.', 'सिस्टम तय नहीं कर पाया कि किसकी है।')], ['Assigned', 'background:#E0E7FF;color:#312E81;', e('Given to a department.', 'विभाग को सौंपी गई।')], ['Team dispatched', 'background:#E0E7FF;color:#312E81;', e('A team is on the way.', 'टीम रवाना है।')], [e('Work done – awaiting citizen', 'कार्य पूर्ण – नागरिक की पुष्टि बाकी'), 'background:#CCFBF1;color:#134E4A;', e('The field team says it is done. The citizen must confirm.', 'फ़ील्ड टीम ने पूरा बताया। नागरिक को पुष्टि करनी है।')], [e('Closed (citizen confirmed)', 'बंद (नागरिक द्वारा पुष्टि)'), G, e('The citizen said it is fixed.', 'नागरिक ने कहा ठीक हो गया।')], [e('Closed (not confirmed)', 'बंद (पुष्टि नहीं)'), Gr, e('Closed after 7 days with no answer.', '7 दिन में जवाब न मिलने पर बंद।')], [e('Reopened', 'पुनः खोली गई'), R, e('The citizen said it is not fixed.', 'नागरिक ने कहा ठीक नहीं हुआ।')]].map((x) => ({ name: x[0], style: x[1], text: x[2] }));
const priorities = [['Critical', 'background:#991B1B;color:#fff;', e('Safety risk. Handle first.', 'सुरक्षा का जोखिम। पहले निपटाएँ।')], ['High', 'background:#FFEDD5;color:#7C2D12;', e('Urgent.', 'ज़रूरी।')], ['Medium', Gr, e('Normal.', 'सामान्य।')], ['Low', 'background:#F3F4F6;color:#374151;border:1px solid #D1D5DB;', e('Can wait.', 'रुक सकती है।')]].map((x) => ({ name: L ? { Critical: 'अति गंभीर', High: 'उच्च', Medium: 'मध्यम', Low: 'कम' }[x[0]] : x[0], style: x[1], text: x[2] }));
const verifies = [[e('Awaiting citizen', 'नागरिक की पुष्टि बाकी'), B, e('The official asked the citizen to confirm the fix. The citizen has not answered yet.', 'अधिकारी ने नागरिक से पुष्टि माँगी। नागरिक ने अभी जवाब नहीं दिया।')], [e('Citizen confirmed', 'नागरिक ने पुष्टि की'), G, e('The citizen said the problem is fixed.', 'नागरिक ने कहा समस्या ठीक हो गई।')], [e('Citizen reopened', 'नागरिक ने दोबारा खोला'), R, e('The citizen said it is not fixed. The same complaint is open again with a higher escalation level.', 'नागरिक ने कहा ठीक नहीं हुआ। वही शिकायत ऊँचे एस्केलेशन स्तर के साथ फिर खुली है।')], [e('Unconfirmed after 7 days', '7 दिन बाद भी पुष्टि नहीं'), Gr, e('No answer came within 7 days of the work being marked done.', 'काम पूर्ण दिखाने के 7 दिन में कोई जवाब नहीं आया।')], [e('No request sent', 'अनुरोध नहीं भेजा'), 'background:#F3F4F6;color:#374151;border:1px solid #D1D5DB;', e('The official has not asked the citizen to verify.', 'अधिकारी ने नागरिक से पुष्टि नहीं माँगी।')]].map((x) => ({ name: x[0], style: x[1], text: x[2] }));
const names = t.page_names.split('|');
// columns: National, State, District, City, Department. The Audit log is for National officials only.
const M = ['✓✓✓✓✓', '✓––––', '✓✓✓✓✓'];
return { t, nav, role: s.role, roleOpts: Object.keys(this.ROLES).map((k) => ({ v: k, l: this.ROLES[k][3 + L] })), onRole: (x) => this.setRole(x.target.value), isEn: l === 'en', isHi: l === 'hi', setEn: () => this.setLang('en'), setHi: () => this.setLang('hi'), user: ro[0], scope: ro[1 + L],
labels, statuses, priorities, verifies, roles: [1, 2, 3, 4, 5].map((i) => this.ROLES[Object.keys(this.ROLES)[i - 1]][3 + L]), matrix: names.map((n, i) => ({ name: n, cells: M[i].split('') })) };
}
}

LegendLogic.prototype.view = function view(__v) {
  const { labels, matrix, nav, onRole, priorities, role, roleOpts, roles, scope, setEn, setHi, statuses, t, user, verifies, isEn, isHi } = __v;
  const Rows = ({ rows, width, sym }) => (
    <table>
      <tbody>
        {rows.map((v, i) => (
          <tr key={i}>
            <td style={{ width }}>
              <span className="chip" style={css(v.style)}>
                {sym ? `${v.sym} ` : ''}{v.name}
              </span>
            </td>
            <td>
              {v.text}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
  return (
    <div className="sc-legend" style={{ width: "100%", minHeight: "100vh", display: "flex", flexDirection: "column", background: "#FFFFFF", color: "#111827", fontFamily: "'Noto Sans','Noto Sans Devanagari',system-ui,sans-serif", fontSize: "14px", lineHeight: "1.4" }}>
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
        <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
          <h1 style={{ margin: "0", fontSize: "22px" }}>
            {t.title}
          </h1>
          <span style={{ color: "#4B5563" }}>
            {t.sub}
          </span>
          <span style={{ flex: "1" }}>
          </span>
          <TLink to="/complaints" className="btn">
            ← {t.back}
          </TLink>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: "12px", alignItems: "start" }}>
          <section className="card">
            <h2>
              {t.status}
            </h2>
            <Rows rows={statuses} width="250px" />
            <h2 style={{ marginTop: "6px" }}>
              {t.priority}
            </h2>
            <Rows rows={priorities} width="250px" />
          </section>
          <section className="card">
            <h2>
              {t.verify}
            </h2>
            <div style={{ fontSize: "12.5px", color: "#4B5563" }}>
              {t.verify_help}
            </div>
            <Rows rows={verifies} width="250px" />
            <h2 style={{ marginTop: "6px" }} id="data">
              {t.labels}
            </h2>
            <div style={{ fontSize: "12.5px", color: "#4B5563" }}>
              {t.labels_help}
            </div>
            <Rows rows={labels} width="250px" sym />
          </section>
        </div>
        <section className="card">
          <h2>
            {t.access}
          </h2>
          <table>
            <thead>
              <tr>
                <th scope="col">
                  {t.page}
                </th>
                {roles.map((r, __i) => (
                  <React.Fragment key={__i}>
                  <th scope="col" style={{ textAlign: "center" }}>
                    {r}
                  </th>
                  </React.Fragment>
                ))}
              </tr>
            </thead>
            <tbody>
              {matrix.map((m, __i) => (
                <React.Fragment key={__i}>
                <tr>
                  <td>
                    {m.name}
                  </td>
                  {m.cells.map((c, __j) => (
                    <React.Fragment key={__j}>
                    <td style={{ textAlign: "center", fontWeight: "700" }}>
                      {c}
                    </td>
                    </React.Fragment>
                  ))}
                </tr>
                </React.Fragment>
              ))}
            </tbody>
          </table>
          <div style={{ fontSize: "12.5px", color: "#4B5563" }}>
            {t.access_note}
          </div>
        </section>
      </main>
      <footer style={{ padding: "10px 20px", fontSize: "12px", color: "#4B5563", borderTop: "1px solid #D1D5DB", background: "#fff", marginTop: "auto" }}>
        {t.proto}
      </footer>
    </div>
  );
};

export default LegendLogic;
