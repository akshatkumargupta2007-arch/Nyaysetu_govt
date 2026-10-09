import React from 'react';
import { DCLogic, css } from '../lib/dc.js';
import { TLink } from '../lib/TLink.jsx';
import { govRoles, currentRoleKey, switchRole } from '../lib/gov.js';
import { logout } from '../lib/client.js';
import './Legend.css';

/* Behaviour and sample data of this screen. Replace the sample data with calls to your API (see docs/DATA.md). */
class LegendLogic extends DCLogic {
state = { lang: 'en', role: currentRoleKey() };
ROLES = govRoles();
NAVD = [['/', 'Civic Pulse', 'सिविक पल्स', 'nstcd'], ['/complaints', 'Complaints', 'शिकायतें', 'nstcd'], ['/queue', 'Closure Court', 'क्लोज़र कोर्ट', 'nstcd'], ['/ask', 'Ask the City', 'शहर से पूछें', 'nstcd'], ['/scorecard', 'Scorecard', 'स्कोरकार्ड', 'nstc'], ['/benchmark', 'Benchmark', 'बेंचमार्क', 'n'], ['/health', 'System health', 'सिस्टम स्वास्थ्य', 'n'], ['/audit', 'Audit log', 'ऑडिट लॉग', 'n']];
T = {
en: { brand: 'NyaySetu Gov', generated: 'Generated data', view_as: 'View as', signout: 'Sign out', proto: 'Prototype. One vocabulary is used on every page.', title: 'Legend and data labels', sub: 'What each word, symbol and label means. Colour is never the only signal.', back: 'Back',
verdicts: 'Closure Court verdicts', verdicts_help: 'We never say “verified”, “fixed” or “AI approved”. The citizen decides whether the problem is fixed.',
gates: 'Rule-check results', conds: 'Condition status (after the two AI passes)', labels: 'Data labels', labels_help: 'These labels appear wherever they apply.', status: 'Complaint status', priority: 'Priority', access: 'Who can see which page', access_note: '✓ = can see · – = cannot. Everything is limited to the person’s own area; out-of-scope records behave as “not found”.', page: 'Page', page_names: 'Civic Pulse|Alert detail|Complaints|Closure Court / Review queue|Scorecard|Ask the City|Benchmark / Receipts|System health|Audit log|Simulator and demo controls' },
hi: { brand: 'न्यायसेतु शासन', generated: 'जनित डेटा', view_as: 'इस रूप में देखें', signout: 'लॉग आउट', proto: 'प्रोटोटाइप। हर पृष्ठ पर एक ही शब्दावली।', title: 'संकेत-सूची और डेटा लेबल', sub: 'हर शब्द, प्रतीक और लेबल का मतलब। रंग कभी अकेला संकेत नहीं होता।', back: 'वापस',
verdicts: 'क्लोज़र कोर्ट के निर्णय', verdicts_help: 'हम कभी “सत्यापित”, “ठीक” या “AI ने मंज़ूर किया” नहीं कहते। समस्या ठीक हुई या नहीं, नागरिक तय करता है।',
gates: 'नियम-जाँच के परिणाम', conds: 'शर्त की स्थिति (दो AI पास के बाद)', labels: 'डेटा लेबल', labels_help: 'ये लेबल जहाँ लागू हों वहाँ दिखते हैं।', status: 'शिकायत की स्थिति', priority: 'प्राथमिकता', access: 'कौन सा पृष्ठ कौन देख सकता है', access_note: '✓ = देख सकता है · – = नहीं। सब कुछ व्यक्ति के अपने क्षेत्र तक सीमित है; क्षेत्र से बाहर के रिकॉर्ड “नहीं मिला” जैसे व्यवहार करते हैं।', page: 'पृष्ठ', page_names: 'सिविक पल्स|अलर्ट विवरण|शिकायतें|क्लोज़र कोर्ट / समीक्षा सूची|स्कोरकार्ड|शहर से पूछें|बेंचमार्क / रसीदें|सिस्टम स्वास्थ्य|ऑडिट लॉग|सिम्युलेटर और डेमो नियंत्रण' }
};
componentDidMount() { try { const l = localStorage.getItem('gov.lang'); if (l === 'hi' || l === 'en') this.setState({ lang: l });  } catch (e) {} }
setLang(l) { try { localStorage.setItem('gov.lang', l); } catch (e) {} this.setState({ lang: l }); }
setRole(r) { switchRole(r); window.location.reload(); }
renderVals() {
const s = this.state; const l = s.lang; const t = this.T[l]; const L = l === 'hi' ? 1 : 0; const ro = this.ROLES[s.role]; const rc = ro[5];
const nav = this.NAVD.filter((n) => n[3].indexOf(rc) >= 0).map((n) => ({ href: n[0], label: n[1 + L], cls: '', cur: 'false' }));
const e = (en, hi) => (L ? hi : en);
const G = 'background:#DCFCE7;color:#14532D;', R = 'background:#FEE2E2;color:#7F1D1D;', Y = 'background:#FEF3C7;color:#78350F;', Gr = 'background:#E5E7EB;color:#1F2937;', P = 'background:#EDE9FE;color:#4C1D95;', B = 'background:#DBEAFE;color:#1E3A8A;';
const verdicts = [['✕', e('Rejected', 'अस्वीकृत'), 'background:#374151;color:#fff', e('A hard rule check failed (for example a reused photo). No AI call was made.', 'एक कड़ी नियम-जाँच विफल (जैसे पुरानी फ़ोटो)। कोई AI कॉल नहीं हुआ।')], ['✕', e('Failed', 'विफल'), 'background:#991B1B;color:#fff', e('The evidence contradicts the claim.', 'प्रमाण दावे के उलट है।')], ['?', e('Needs human review', 'व्यक्ति की समीक्षा चाहिए'), 'background:#5B21B6;color:#fff', e('The two AI passes disagree, or the AI was unavailable.', 'दोनों AI पास असहमत हैं, या AI उपलब्ध नहीं था।')], ['＋', e('Needs more evidence', 'और प्रमाण चाहिए'), 'background:#B45309;color:#fff', e('A condition is not demonstrated. The page says what is still needed.', 'कोई शर्त सिद्ध नहीं हुई। पृष्ठ बताता है कि और क्या चाहिए।')], ['✓', e('Evidence passed the checks', 'प्रमाण जाँच में पास'), 'background:#166534;color:#fff', e('All conditions are supported. This does not close the complaint.', 'सभी शर्तें समर्थित। इससे शिकायत बंद नहीं होती।')]].map((x) => ({ sym: x[0], name: x[1], style: x[2], text: x[3] }));
const gates = [['✓', e('Pass', 'पास'), G, e('The check found nothing wrong.', 'जाँच में कुछ गलत नहीं मिला।')], ['✕', e('Fail', 'विफल'), R, e('A hard failure. The process stops.', 'कड़ी विफलता। प्रक्रिया रुकती है।')], ['~', e('Weak', 'कमज़ोर'), Y, e('Not wrong, but not strong either (for example GPS drift).', 'गलत नहीं, पर मज़बूत भी नहीं (जैसे GPS खिसकाव)।')], ['?', e('Unknown', 'अज्ञात'), Gr, e('The check could not be done or does not apply.', 'जाँच हो नहीं सकी या लागू नहीं।')]].map((x) => ({ sym: x[0], name: x[1], style: x[2], text: x[3] }));
const conds = [['✓', e('Supported', 'समर्थित'), G, e('Both passes agree the evidence shows it.', 'दोनों पास सहमत कि प्रमाण यह दिखाता है।')], ['◐', e('Partially supported', 'आंशिक समर्थित'), Y, e('Shown in part only.', 'केवल आंशिक रूप से दिखता है।')], ['○', e('Not demonstrated', 'सिद्ध नहीं'), Gr, e('The evidence does not show it.', 'प्रमाण यह नहीं दिखाता।')], ['✕', e('Contradicted', 'खंडित'), R, e('The evidence shows the opposite.', 'प्रमाण उलटा दिखाता है।')], ['≠', e('Contested', 'विवादित'), P, e('The two passes disagree.', 'दोनों पास असहमत हैं।')]].map((x) => ({ sym: x[0], name: x[1], style: x[2], text: x[3] }));
const labels = [['!', e('Generated', 'जनित'), Y, e('The data was produced by the demo simulator, not by a real citizen.', 'डेटा डेमो सिम्युलेटर ने बनाया, किसी असली नागरिक ने नहीं।')], ['≈', e('Template (AI unavailable)', 'टेम्पलेट (AI अनुपलब्ध)'), Y, e('A standard contract was used because the AI was late or unavailable.', 'AI देर से या अनुपलब्ध था, इसलिए मानक अनुबंध उपयोग हुआ।')], ['R', e('Replay', 'रीप्ले'), Y, e('A recorded real run, not computed now. Always shown with its date.', 'दर्ज असली रन, अभी गणना नहीं हुई। तारीख़ के साथ दिखता है।')], ['◎', e('Approximate location', 'लगभग स्थान'), Gr, e('Locations are accurate to about ±25 m.', 'स्थान लगभग ±25 मी तक सही हैं।')], ['●', e('Live', 'लाइव'), G, e('Updating on its own.', 'अपने आप अपडेट हो रहा है।')], ['II', e('Paused', 'रुका हुआ'), Y, e('Updates are paused. Numbers may be old.', 'अपडेट रुके हैं। संख्याएँ पुरानी हो सकती हैं।')]].map((x) => ({ sym: x[0], name: x[1], style: x[2], text: x[3] }));
const statuses = [['Received', B, e('The complaint arrived.', 'शिकायत मिली।')], ['Needs triage', Y, e('The system could not decide who owns it.', 'सिस्टम तय नहीं कर पाया कि किसकी है।')], ['Assigned', 'background:#E0E7FF;color:#312E81;', e('Given to a department.', 'विभाग को सौंपी गई।')], ['Team dispatched', 'background:#E0E7FF;color:#312E81;', e('A team is on the way.', 'टीम रवाना है।')], [e('Work done – awaiting citizen', 'कार्य पूर्ण – नागरिक की पुष्टि बाकी'), 'background:#CCFBF1;color:#134E4A;', e('The field team says it is done. The citizen must confirm.', 'फ़ील्ड टीम ने पूरा बताया। नागरिक को पुष्टि करनी है।')], [e('Closed (citizen confirmed)', 'बंद (नागरिक द्वारा पुष्टि)'), G, e('The citizen said it is fixed.', 'नागरिक ने कहा ठीक हो गया।')], [e('Closed (not confirmed)', 'बंद (पुष्टि नहीं)'), Gr, e('Closed after 7 days with no answer.', '7 दिन में जवाब न मिलने पर बंद।')], [e('Reopened', 'पुनः खोली गई'), R, e('The citizen said it is not fixed.', 'नागरिक ने कहा ठीक नहीं हुआ।')]].map((x) => ({ name: x[0], style: x[1], text: x[2] }));
const priorities = [['Critical', 'background:#991B1B;color:#fff;', e('Safety risk. Handle first.', 'सुरक्षा का जोखिम। पहले निपटाएँ।')], ['High', 'background:#FFEDD5;color:#7C2D12;', e('Urgent.', 'ज़रूरी।')], ['Medium', Gr, e('Normal.', 'सामान्य।')], ['Low', 'background:#F3F4F6;color:#374151;border:1px solid #D1D5DB;', e('Can wait.', 'रुक सकती है।')]].map((x) => ({ name: L ? { Critical: 'अति गंभीर', High: 'उच्च', Medium: 'मध्यम', Low: 'कम' }[x[0]] : x[0], style: x[1], text: x[2] }));
const names = t.page_names.split('|');
const M = ['✓✓✓✓✓', '✓✓✓✓–', '✓✓✓✓✓', '✓✓✓✓✓', '✓✓✓✓–', '✓✓✓✓✓', '✓––––', '✓––––', '✓––––', '✓––––'];
return { t, nav, role: s.role, roleOpts: Object.keys(this.ROLES).map((k) => ({ v: k, l: this.ROLES[k][3 + L] })), onRole: (x) => this.setRole(x.target.value), isEn: l === 'en', isHi: l === 'hi', setEn: () => this.setLang('en'), setHi: () => this.setLang('hi'), user: ro[0], scope: ro[1 + L],
verdicts, gates, conds, labels, statuses, priorities, roles: [1, 2, 3, 4, 5].map((i) => this.ROLES[Object.keys(this.ROLES)[i - 1]][3 + L]), matrix: names.map((n, i) => ({ name: n, cells: M[i].split('') })) };
}
}

LegendLogic.prototype.view = function view(__v) {
  const { c, conds, gates, isEn, isHi, labels, m, matrix, n, nav, o, onRole, priorities, r, role, roleOpts, roles, scope, setEn, setHi, statuses, t, user, v, verdicts } = __v;
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
          <TLink to="/" className="btn">
            ← {t.back}
          </TLink>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", gap: "12px", alignItems: "start" }}>
          <section className="card">
            <h2>
              {t.verdicts}
            </h2>
            <div style={{ fontSize: "12.5px", color: "#4B5563" }}>
              {t.verdicts_help}
            </div>
            <table>
              <tbody>
                {verdicts.map((v, __i) => (
                  <React.Fragment key={__i}>
                  <tr>
                    <td style={{ width: "200px" }}>
                      <span className="chip" style={css(v.style)}>
                        {v.sym} {v.name}
                      </span>
                    </td>
                    <td>
                      {v.text}
                    </td>
                  </tr>
                  </React.Fragment>
                ))}
              </tbody>
            </table>
          </section>
          <section className="card">
            <h2>
              {t.gates}
            </h2>
            <table>
              <tbody>
                {gates.map((v, __i) => (
                  <React.Fragment key={__i}>
                  <tr>
                    <td style={{ width: "130px" }}>
                      <span className="chip" style={css(v.style)}>
                        {v.sym} {v.name}
                      </span>
                    </td>
                    <td>
                      {v.text}
                    </td>
                  </tr>
                  </React.Fragment>
                ))}
              </tbody>
            </table>
            <h2 style={{ marginTop: "6px" }}>
              {t.conds}
            </h2>
            <table>
              <tbody>
                {conds.map((v, __i) => (
                  <React.Fragment key={__i}>
                  <tr>
                    <td style={{ width: "190px" }}>
                      <span className="chip" style={css(v.style)}>
                        {v.sym} {v.name}
                      </span>
                    </td>
                    <td>
                      {v.text}
                    </td>
                  </tr>
                  </React.Fragment>
                ))}
              </tbody>
            </table>
          </section>
          <section className="card" id="data">
            <h2>
              {t.labels}
            </h2>
            <div style={{ fontSize: "12.5px", color: "#4B5563" }}>
              {t.labels_help}
            </div>
            <table>
              <tbody>
                {labels.map((v, __i) => (
                  <React.Fragment key={__i}>
                  <tr>
                    <td style={{ width: "190px" }}>
                      <span className="chip" style={css(v.style)}>
                        {v.sym} {v.name}
                      </span>
                    </td>
                    <td>
                      {v.text}
                    </td>
                  </tr>
                  </React.Fragment>
                ))}
              </tbody>
            </table>
          </section>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "minmax(0, 1fr) minmax(0, 1.2fr)", gap: "12px", alignItems: "start" }}>
          <section className="card">
            <h2>
              {t.status}
            </h2>
            <table>
              <tbody>
                {statuses.map((v, __i) => (
                  <React.Fragment key={__i}>
                  <tr>
                    <td style={{ width: "250px" }}>
                      <span className="chip" style={css(v.style)}>
                        {v.name}
                      </span>
                    </td>
                    <td>
                      {v.text}
                    </td>
                  </tr>
                  </React.Fragment>
                ))}
              </tbody>
            </table>
            <h2 style={{ marginTop: "6px" }}>
              {t.priority}
            </h2>
            <table>
              <tbody>
                {priorities.map((v, __i) => (
                  <React.Fragment key={__i}>
                  <tr>
                    <td style={{ width: "250px" }}>
                      <span className="chip" style={css(v.style)}>
                        {v.name}
                      </span>
                    </td>
                    <td>
                      {v.text}
                    </td>
                  </tr>
                  </React.Fragment>
                ))}
              </tbody>
            </table>
          </section>
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
                    {m.cells.map((c, __i) => (
                      <React.Fragment key={__i}>
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
        </div>
      </main>
      <footer style={{ padding: "10px 20px", fontSize: "12px", color: "#4B5563", borderTop: "1px solid #D1D5DB", background: "#fff", marginTop: "auto" }}>
        {t.proto}
      </footer>
    </div>
  );
};

export default LegendLogic;
