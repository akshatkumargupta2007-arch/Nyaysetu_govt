import React from 'react';
import { DCLogic, css } from '../lib/dc.js';
import { login } from '../lib/client.js';
import './Login.css';

/* Behaviour and sample data of this screen. Replace the sample data with calls to your API (see docs/DATA.md). */
class LoginLogic extends DCLogic {
state = { lang: 'en', pstate: (typeof location !== 'undefined' && /expired=1/.test(location.search)) ? 'expired' : 'normal', email: '', password: '', busy: false };
T = {
en: { brand: 'NyaySetu Gov', title: 'Official sign in', email: 'Email', password: 'Password', submit: 'Sign in', note: 'For authorised officials only. Every sign-in is recorded.', proto: 'Prototype. Not an official government website.', proto_full: 'This is a prototype and not an official government website. Part of the demo data is generated and labelled as such.',
wrong: 'Wrong email or password. After 5 wrong tries from the same device you must wait 15 minutes.', locked: 'Too many wrong tries from this device. You can try again in 15 minutes.', expired: 'Your session expired. Please sign in again.', demo_title: 'Demo only', demo_state: 'Preview a state', demo_roles: 'After signing in, use “View as” in the header to see the portal as a national, state, district, city or department official.' },
hi: { brand: 'न्यायसेतु शासन', title: 'अधिकारी लॉगिन', email: 'ईमेल', password: 'पासवर्ड', submit: 'लॉगिन करें', note: 'केवल अधिकृत अधिकारियों के लिए। हर लॉगिन दर्ज किया जाता है।', proto: 'प्रोटोटाइप। आधिकारिक सरकारी वेबसाइट नहीं।', proto_full: 'यह एक प्रोटोटाइप है, आधिकारिक सरकारी वेबसाइट नहीं। कुछ डेमो डेटा जनित है और उस पर लेबल है।',
wrong: 'ईमेल या पासवर्ड ग़लत है। एक ही डिवाइस से 5 बार ग़लत डालने पर 15 मिनट इंतज़ार करना होगा।', locked: 'इस डिवाइस से बहुत बार ग़लत डाला गया। 15 मिनट बाद दोबारा कोशिश करें।', expired: 'आपका सत्र समाप्त हो गया। कृपया दोबारा लॉगिन करें।', demo_title: 'केवल डेमो', demo_state: 'कोई स्थिति देखें', demo_roles: 'लॉगिन के बाद शीर्ष पट्टी में “इस रूप में देखें” से राष्ट्रीय, राज्य, ज़िला, शहर या विभाग के अधिकारी के रूप में देखें।' }
};
componentDidMount() { try { const l = localStorage.getItem('gov.lang'); if (l === 'hi' || l === 'en') this.setState({ lang: l }); } catch (e) {} }
setLang(l) { try { localStorage.setItem('gov.lang', l); } catch (e) {} this.setState({ lang: l }); }
renderVals() {
const s = this.state; const l = s.lang; const t = this.T[l]; const L = l === 'hi' ? 1 : 0;
return { t, isEn: l === 'en', isHi: l === 'hi', setEn: () => this.setLang('en'), setHi: () => this.setLang('hi'), submit: async (e) => { e.preventDefault(); if (this.state.busy) return; this.setState({ busy: true, pstate: 'normal' }); try { await login(this.state.email.trim(), this.state.password); window.location.assign('/'); } catch (err) { this.setState({ busy: false, pstate: err.status === 423 ? 'locked' : 'wrong' }); } },
email: s.email, password: s.password, busy: s.busy, onEmail: (e) => this.setState({ email: e.target.value }), onPassword: (e) => this.setState({ password: e.target.value }),
isWrong: s.pstate === 'wrong', isLocked: s.pstate === 'locked', isExpired: s.pstate === 'expired', goStyle: s.pstate === 'locked' ? 'pointer-events:none;opacity:.5;' : '',
pstate: s.pstate, onP: (e) => this.setState({ pstate: e.target.value }), pOpts: [['normal', L ? 'सामान्य' : 'Normal'], ['wrong', L ? 'ग़लत पासवर्ड' : 'Wrong credentials'], ['locked', L ? '15 मिनट के लिए बंद' : 'Locked for 15 minutes'], ['expired', L ? 'सत्र समाप्त' : 'Session expired']].map((o) => ({ v: o[0], l: o[1] })) };
}
}

LoginLogic.prototype.view = function view(__v) {
  const { goStyle, isEn, isExpired, isHi, isLocked, isWrong, setEn, setHi, submit, t, email, password, busy, onEmail, onPassword } = __v;
  return (
    <div className="sc-login" style={{ width: "100%", minHeight: "100vh", display: "flex", flexDirection: "column", background: "#FFFFFF", color: "#111827", fontFamily: "'Noto Sans','Noto Sans Devanagari',system-ui,sans-serif", fontSize: "15px", lineHeight: "1.45" }}>
      <header style={{ height: "56px", background: "#1F2937", color: "#FFFFFF", display: "flex", alignItems: "center", padding: "0 24px", gap: "12px", flex: "none" }}>
        <strong style={{ fontSize: "18px" }}>
          {t.brand}
        </strong>
        <span style={{ fontSize: "12px", padding: "2px 8px", border: "1px solid #9CA3AF", borderRadius: "4px", color: "#E5E7EB" }}>
          Prototype
        </span>
        <span style={{ flex: "1" }}>
        </span>
        <span className="lang" role="group" aria-label="Language" style={{ display: "inline-flex", border: "1px solid #9CA3AF", borderRadius: "6px", overflow: "hidden", background: "#fff" }}>
          <button type="button" aria-pressed={isEn} onClick={setEn}>
            English
          </button>
          <button type="button" aria-pressed={isHi} onClick={setHi}>
            हिन्दी
          </button>
        </span>
      </header>
      <main style={{ flex: "1", display: "flex", alignItems: "center", justifyContent: "center", padding: "40px 24px", gap: "40px", flexWrap: "wrap" }}>
        <form onSubmit={submit} style={{ width: "100%", maxWidth: "460px", background: "#FFFFFF", border: "0", borderTop: "3px solid #1F2937", borderRadius: "0", padding: "32px", display: "flex", flexDirection: "column", gap: "16px" }}>
          <h1 style={{ margin: "0", fontSize: "24px" }}>
            {t.title}
          </h1>
          {!!(isExpired) && (
            <>
            <div role="alert" style={{ padding: "10px 12px", background: "#FEF3C7", border: "1px solid #F59E0B", borderRadius: "6px", fontWeight: "600", color: "#78350F" }}>
              {t.expired}
            </div>
            </>
          )}
          {!!(isWrong) && (
            <>
            <div role="alert" style={{ padding: "10px 12px", background: "#FEE2E2", border: "1px solid #FCA5A5", borderRadius: "6px", fontWeight: "600", color: "#7F1D1D" }}>
              {t.wrong}
            </div>
            </>
          )}
          {!!(isLocked) && (
            <>
            <div role="alert" style={{ padding: "10px 12px", background: "#FEE2E2", border: "1px solid #FCA5A5", borderRadius: "6px", fontWeight: "600", color: "#7F1D1D" }}>
              {t.locked}
            </div>
            </>
          )}
          <label className="f">
            {t.email}
            <input type="email" autoComplete="username" required value={email} onChange={onEmail} disabled={isLocked} />
          </label>
          <label className="f">
            {t.password}
            <input type="password" autoComplete="current-password" required value={password} onChange={onPassword} disabled={isLocked || busy} />
          </label>
          <button type="submit" className="btn pri" style={css(goStyle)} disabled={busy}>
            {t.submit}
          </button>
          <p style={{ margin: "0", color: "#4B5563", fontSize: "14px" }}>
            {t.note}
          </p>
        </form>
        <aside style={{ width: "100%", maxWidth: "360px", fontSize: "13.5px", color: "#374151", display: "flex", flexDirection: "column", gap: "10px" }}>
          <div style={{ border: "1px dashed #B45309", background: "#FFFBEB", borderRadius: "8px", padding: "12px 14px" }}>
            <b style={{ color: "#78350F" }}>
              {t.demo_title}
            </b>
                        <div style={{ marginTop: "8px" }}>
              {t.demo_roles}
            </div>
          </div>
          <div style={{ border: "1px solid #D1D5DB", background: "#fff", borderRadius: "8px", padding: "12px 14px" }}>
            {t.proto_full}
          </div>
        </aside>
      </main>
      <footer style={{ padding: "12px 24px", textAlign: "center", color: "#4B5563", fontSize: "13px", borderTop: "1px solid #D1D5DB", background: "#FFFFFF" }}>
        {t.proto}
      </footer>
    </div>
  );
};

export default LoginLogic;
