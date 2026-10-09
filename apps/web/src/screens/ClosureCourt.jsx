import React from 'react';
import { DCLogic, css } from '../lib/dc.js';
import { TLink } from '../lib/TLink.jsx';
import { govRoles, currentRoleKey, switchRole } from '../lib/gov.js';
import { logout, api, blobUrl } from '../lib/client.js';
import './ClosureCourt.css';

/* Behaviour and sample data of this screen. Replace the sample data with calls to your API (see docs/DATA.md). */
class ClosureCourtLogic extends DCLogic {
state = { lang: 'en', role: currentRoleKey(), tid: '', data: null, ms: 0, bad: false, none: false, imgTick: 0, sel: 0, cmp: false, zoom: 100, tab: 'contract', mode: 'live', rshown: 0, scn: 'A', modal: '', hashOk: false, hashBad: false, chainOk: false, chainBad: false, uploading: false, upPct: 0, chDone: false, chResult: null, chErr: '', toast: '' };
ROLES = govRoles();
NAVD = [['/', 'Civic Pulse', 'सिविक पल्स', 'nstcd'], ['/complaints', 'Complaints', 'शिकायतें', 'nstcd'], ['/queue', 'Closure Court', 'क्लोज़र कोर्ट', 'nstcd'], ['/ask', 'Ask the City', 'शहर से पूछें', 'nstcd'], ['/scorecard', 'Scorecard', 'स्कोरकार्ड', 'nstc'], ['/benchmark', 'Benchmark', 'बेंचमार्क', 'n'], ['/health', 'System health', 'सिस्टम स्वास्थ्य', 'n'], ['/audit', 'Audit log', 'ऑडिट लॉग', 'n']];
T = {
en: { brand: 'NyaySetu Gov', generated: 'Generated data', legend: 'Legend', view_as: 'View as', signout: 'Sign out', proto_short: 'Prototype. The AI never closes a complaint.',
queue: 'Review queue', open_drawer: 'Open complaint', mode: 'Mode', live: 'Live', replay: 'Replay', submit: 'Submit proof', challenge: 'Open Challenge', print: 'Print / PDF',
replay_banner: 'Replay of the recorded ledger for this complaint. Nothing on this screen is being computed now.',
demo: 'Demo controls (National)', gen_tag: 'generated', scenario: 'Scenario', next_fixture: 'Submit next prepared file', reset: 'Reset', preview_state: 'Preview a state',
contract: 'Frozen contract', timeline: 'Timeline', claim: 'The claim', version: 'Version', frozen: 'frozen, cannot be edited', source: 'Source', created: 'Created', hash: 'Hash', verify_hash: 'Verify hash', hash_ok: 'Matches the ledger', ledger_link: 'Ledger event', night: 'Night required', needs_ev: 'Needs', insuff: 'Not enough if', no_contract: 'The contract is being prepared. Proof can be submitted after it is frozen.',
ledger: 'Ledger', verify_chain: 'Verify hash chain', chain_ok: 'Chain intact',
evidence: 'Evidence', compare: 'Compare two', zoom: 'Zoom', taken: 'Taken', distance: 'From complaint point', filehash: 'File hash', sample_img: 'Pictures here are sample illustrations for the demo.',
gates: 'Rule checks (before any AI)', gate: 'Check', result: 'Result', reason: 'Why', no_ai: 'A hard check failed. No AI call was made.', pending: 'This submission is waiting to be checked.', bad_video: 'This video is too large or in a format we cannot read. Ask for a clip under 15 seconds.',
verdict: 'Verdict', rule: 'Rule that produced it', not_close: 'This does not close the complaint. The citizen decides.', next_ev: 'Evidence still needed', ai_down: 'The AI was unavailable, so this case goes to a person. Nothing was decided by the AI.',
per_crit: 'Each condition, checked twice by AI', pass_a: 'Pass A', pass_b: 'Pass B', cannot: 'The evidence cannot establish', conf: 'Confidence', objection: 'Strongest objection', citizen: 'Citizen’s side',
ai_health: 'AI health', models: 'Models', latency: 'Latency', fallback: 'Fallback used', degraded: 'Degraded mode', health_link: 'System health →', src: 'Source',
drop: 'Drop up to 4 photos or one clip (15 seconds at most) here', choose_files: 'Choose files', uploading: 'Checking', limits: 'Photos up to 10 MB each. Clip up to 15 s. Taken with the camera at the place.', cancel: 'Cancel', close: 'Close',
challenge_help: 'Demo tickets only. Upload any image as “proof” and see the honest result, including what cannot be established.', drop_one: 'Drop any image here', choose_image: 'Choose an image', challenge_result: 'Result', challenge_text: 'The image shows a street scene, but it does not show this pole or this place. The system cannot establish identity (C1) or that the light is on (C2). Verdict: Needs more evidence. The AI did not close anything.' },
hi: { brand: 'न्यायसेतु शासन', generated: 'जनित डेटा', legend: 'संकेत-सूची', view_as: 'इस रूप में देखें', signout: 'लॉग आउट', proto_short: 'प्रोटोटाइप। AI कभी शिकायत बंद नहीं करता।',
queue: 'समीक्षा सूची', open_drawer: 'शिकायत खोलें', mode: 'मोड', live: 'लाइव', replay: 'रीप्ले', submit: 'प्रमाण जमा करें', challenge: 'ओपन चैलेंज', print: 'प्रिंट / PDF',
replay_banner: 'इस शिकायत के दर्ज बही-खाते का रीप्ले। इस स्क्रीन पर अभी कुछ गणना नहीं हो रही।',
demo: 'डेमो नियंत्रण (राष्ट्रीय)', gen_tag: 'जनित', scenario: 'परिदृश्य', next_fixture: 'अगली तैयार फ़ाइल जमा करें', reset: 'रीसेट', preview_state: 'कोई स्थिति देखें',
contract: 'जमा हुआ अनुबंध', timeline: 'घटनाक्रम', claim: 'दावा', version: 'संस्करण', frozen: 'जमा, बदला नहीं जा सकता', source: 'स्रोत', created: 'बना', hash: 'हैश', verify_hash: 'हैश जाँचें', hash_ok: 'लेजर से मेल खाता है', ledger_link: 'लेजर घटना', night: 'रात ज़रूरी', needs_ev: 'चाहिए', insuff: 'इतना काफ़ी नहीं', no_contract: 'अनुबंध तैयार हो रहा है। जमा होने के बाद प्रमाण दिया जा सकता है।',
ledger: 'लेजर', verify_chain: 'हैश-श्रृंखला जाँचें', chain_ok: 'श्रृंखला सुरक्षित',
evidence: 'प्रमाण', compare: 'दो की तुलना', zoom: 'ज़ूम', taken: 'लिया गया', distance: 'शिकायत-स्थल से दूरी', filehash: 'फ़ाइल हैश', sample_img: 'यहाँ की तस्वीरें डेमो के नमूना चित्र हैं।',
gates: 'नियम-जाँच (AI से पहले)', gate: 'जाँच', result: 'परिणाम', reason: 'कारण', no_ai: 'एक कड़ी जाँच विफल रही। कोई AI कॉल नहीं हुआ।', pending: 'यह प्रस्तुति जाँच के इंतज़ार में है।', bad_video: 'यह वीडियो बहुत बड़ा है या पढ़ा नहीं जा सकता। 15 सेकंड से छोटी क्लिप माँगें।',
verdict: 'निर्णय', rule: 'जिस नियम से निकला', not_close: 'इससे शिकायत बंद नहीं होती। नागरिक तय करता है।', next_ev: 'अभी और चाहिए', ai_down: 'AI उपलब्ध नहीं था, इसलिए मामला व्यक्ति के पास जाता है। AI ने कुछ तय नहीं किया।',
per_crit: 'हर शर्त, AI द्वारा दो बार जाँची', pass_a: 'पास A', pass_b: 'पास B', cannot: 'प्रमाण से यह सिद्ध नहीं होता', conf: 'विश्वास', objection: 'सबसे मज़बूत आपत्ति', citizen: 'नागरिक की ओर से',
ai_health: 'AI स्वास्थ्य', models: 'मॉडल', latency: 'विलंब', fallback: 'वैकल्पिक मॉडल', degraded: 'सीमित मोड', health_link: 'सिस्टम स्वास्थ्य →', src: 'स्रोत',
drop: 'यहाँ अधिकतम 4 फ़ोटो या एक क्लिप (अधिकतम 15 सेकंड) डालें', choose_files: 'फ़ाइलें चुनें', uploading: 'जाँच हो रही है', limits: 'हर फ़ोटो 10 MB तक। क्लिप 15 से. तक। जगह पर कैमरे से ली गई।', cancel: 'रद्द करें', close: 'बंद करें',
challenge_help: 'केवल डेमो टिकट। कोई भी तस्वीर “प्रमाण” के रूप में डालें और ईमानदार परिणाम देखें।', drop_one: 'यहाँ कोई भी तस्वीर डालें', choose_image: 'तस्वीर चुनें', challenge_result: 'परिणाम', challenge_text: 'तस्वीर में सड़क का दृश्य है, पर यह इस खंभे या इस जगह को नहीं दिखाती। पहचान (C1) और बत्ती जलने (C2) को सिद्ध नहीं किया जा सकता। निर्णय: और प्रमाण चाहिए। AI ने कुछ बंद नहीं किया।' }
};
GATEN = { en: { reuse: 'Exact reuse of a photo', similar: 'Similar, mirrored or cropped reuse', place: 'Place', time: 'Time', sun: 'Sun position (day / night)', inject: 'Text in the image aimed at the AI' }, hi: { reuse: 'फ़ोटो का हूबहू दोहराव', similar: 'मिलता-जुलता, उलटा या कटा दोहराव', place: 'स्थान', time: 'समय', sun: 'सूर्य की स्थिति (दिन / रात)', inject: 'छवि में AI पर निशाना साधता पाठ' } };
GRES = { pass: ['✓', 'Pass', 'पास', 'background:#DCFCE7;color:#14532D;'], fail: ['✕', 'Fail', 'विफल', 'background:#FEE2E2;color:#7F1D1D;'], weak: ['~', 'Weak', 'कमज़ोर', 'background:#FEF3C7;color:#78350F;'], unk: ['?', 'Unknown', 'अज्ञात', 'background:#E5E7EB;color:#1F2937;'] };
CST = { sup: ['✓', 'Supported', 'समर्थित', 'background:#DCFCE7;color:#14532D;'], par: ['◐', 'Partially supported', 'आंशिक समर्थित', 'background:#FEF3C7;color:#78350F;'], nd: ['○', 'Not demonstrated', 'सिद्ध नहीं', 'background:#E5E7EB;color:#1F2937;'], con: ['✕', 'Contradicted', 'खंडित', 'background:#FEE2E2;color:#7F1D1D;'], cont: ['≠', 'Contested', 'विवादित', 'background:#EDE9FE;color:#4C1D95;'] };
VER = { rej: ['✕', 'Rejected', 'अस्वीकृत', 'background:#374151;color:#fff', 'background:#F3F4F6;'], fail: ['✕', 'Failed', 'विफल', 'background:#991B1B;color:#fff', 'background:#FEF2F2;'], hum: ['?', 'Needs human review', 'व्यक्ति की समीक्षा चाहिए', 'background:#5B21B6;color:#fff', 'background:#F5F3FF;'], more: ['＋', 'Needs more evidence', 'और प्रमाण चाहिए', 'background:#B45309;color:#fff', 'background:#FFFBEB;'], pass: ['✓', 'Evidence passed the checks', 'प्रमाण जाँच में पास', 'background:#166534;color:#fff', 'background:#F0FDF4;'] };
TYPES = { identity: 'Identity', hazard: 'Hazard removed', outcome: 'Outcome', operation: 'Operation', permanence: 'Durability' };


vis(a) { const sky = a[0], sun = a[1], ground = a[2], pole = a[3], glow = a[4], road = a[5], hole = a[6], holeOp = a[7], drain = a[8]; return { sky, sun, ground, poleStyle: pole ? '' : 'display:none', glow: glow, roadGlow: road, hole: hole || '#1F2937', holeStyle: (a[8] === 'patched' ? 'opacity:1;' : '') + (hole ? 'opacity:' + holeOp + ';' : 'display:none'), drainStyle: drain === 'blocked' ? 'opacity:1;fill:#1E293B;' : drain === 'flow' ? 'opacity:.9;fill:#38BDF8;' : 'display:none' }; }
componentDidMount() {
  try { const l = localStorage.getItem('gov.lang'); if (l === 'hi' || l === 'en') this.setState({ lang: l }); } catch (e) {}
  let id = ''; try { const c = JSON.parse(sessionStorage.getItem('gov.court') || 'null'); if (c && c.id) id = c.id; } catch (e) {}
  if (id) this.load(id); else this.pickDefault();
  this._iv = setInterval(() => { if (!document.hidden && this.state.tid) this.load(this.state.tid, true); }, 12000);
  this._input = document.createElement('input'); this._input.type = 'file'; this._input.multiple = true; this._input.accept = 'image/*,video/*'; this._input.style.display = 'none'; document.body.appendChild(this._input);
  this._input.onchange = () => { const f = Array.from(this._input.files || []); this._input.value = ''; if (f.length) this.upload(f, !!this._chal); };
}
componentWillUnmount() { clearInterval(this._iv); if (this._input) this._input.remove(); }
setLang(l) { try { localStorage.setItem('gov.lang', l); } catch (e) {} this.setState({ lang: l }); }
setRole(r) { switchRole(r); window.location.reload(); }
async pickDefault() { try { const q = await api('/api/court/queue'); if (q.items.length) this.load(q.items[0].id); else this.setState({ none: true }); } catch (e) { this.setState({ bad: true }); } }
async load(id, quiet) {
  try {
    const t0 = performance.now(); const d = await api('/api/court/' + id);
    this.setState((x) => ({ tid: id, data: d, ms: Math.round(performance.now() - t0), bad: false, none: false, sel: x.tid === id ? x.sel : Math.max(0, ((d.view && d.view.submissions) || []).length - 1) }));
    const urls = Object.assign({}, this._urls || {}); this._urls = urls;
    const media = (d.view && d.view.media) || [];
    for (const m of media) { if (!urls[m.id]) { urls[m.id] = 'pending'; blobUrl('/api/court/media/' + m.id).then((u) => { urls[m.id] = u; this.setState({ imgTick: (this.state.imgTick || 0) + 1 }); }).catch(() => { urls[m.id] = ''; }); } }
  } catch (e) { if (!quiet) this.setState({ bad: true }); }
}
fixture(scn, step) {
  // Prepared pictures are drawn here, clearly generated drawings. Step 0 is a good fix, the others are attacks or failures.
  const cv = document.createElement('canvas'); cv.width = 800; cv.height = 560; const g = cv.getContext('2d');
  const road = () => { g.fillStyle = '#8a8f94'; g.fillRect(0, 0, 800, 560); g.fillStyle = '#3b3b3b'; g.fillRect(0, 250, 800, 310); };
  const el = (c, x, y, rx, ry) => { g.fillStyle = c; g.beginPath(); g.ellipse(x, y, rx, ry, 0, 0, 7); g.fill(); };
  const mk = (name) => new Promise((res) => cv.toBlob((b) => res(new File([b], name, { type: 'image/jpeg' })), 'image/jpeg', 0.88));
  if (scn === 'A') {
    if (step === 1) { const m = (((this.state.data || {}).view || {}).media || []).filter((x) => x.kind === 'before')[0]; const u = m && (this._urls || {})[m.id]; if (u && u !== 'pending') return new Promise((res) => { const im = new Image(); im.onload = () => { g.translate(800, 0); g.scale(-1, 1); g.drawImage(im, 0, 0, 800, 560); cv.toBlob((b) => res(new File([b], 'mirrored.jpg', { type: 'image/jpeg' })), 'image/jpeg', 0.8); }; im.src = u; }); }
    road(); el('#4d4d4d', 400, 440, 150, 55); if (step === 2) el('#101010', 400, 440, 70, 24); return mk('pothole-' + step + '.jpg');
  }
  if (scn === 'B') { road(); g.fillStyle = '#9aa3ad'; g.fillRect(250, 400, 300, 60); if (step === 1) { g.globalAlpha = 0.8; el('#5fa8d3', 400, 480, 260, 40); } return mk('drain-' + step + '.jpg'); }
  if (step === 1) { g.fillStyle = '#9fd0ff'; g.fillRect(0, 0, 800, 560); g.fillStyle = '#8a9a8a'; g.fillRect(0, 330, 800, 230); g.fillStyle = '#5b6470'; g.fillRect(390, 120, 14, 230); return mk('light-day.jpg'); }
  g.fillStyle = '#0b1020'; g.fillRect(0, 0, 800, 560); g.fillStyle = '#161a22'; g.fillRect(0, 330, 800, 230); g.fillStyle = '#2a2f3a'; g.fillRect(390, 120, 14, 230); g.globalAlpha = 0.9; el('#fde047', 470, 90, 46, 46); g.globalAlpha = 0.35; el('#fde047', 440, 420, 260, 70); return mk('light-night.jpg');
}
async nextFixture() { const n = (((this.state.data || {}).view || {}).submissions || []).length; const f = await this.fixture(this.state.scn || 'A', n % 3); await this.upload([f], true); }
replayStep() { const total = ((((this.state.data || {}).view || {}).submissions) || []).length; this.setState((x) => ({ rshown: x.rshown >= total ? 0 : x.rshown + 1 })); }
async upload(files, challenge) {
  const id = this.state.tid; if (!id) return;
  this.setState({ uploading: true, upPct: 15, chErr: '' });
  const tick = setInterval(() => this.setState((x) => ({ upPct: Math.min(92, x.upPct + 7) })), 600);
  try {
    const enc = await Promise.all(files.slice(0, 4).map((f) => new Promise((res, rej) => { const r = new FileReader(); r.onload = () => res({ name: f.name, mime: f.type || 'application/octet-stream', base64: String(r.result).split(',')[1] }); r.onerror = rej; r.readAsDataURL(f); })));
    const out = await api('/api/court/' + id + '/proof', { method: 'POST', body: { files: enc } });
    this.setState({ chResult: out, chDone: true });
    await this.load(id); this.setState((x) => ({ sel: Math.max(0, (((x.data && x.data.view && x.data.view.submissions) || []).length - 1)) }));
    if (!challenge) this.setState({ modal: '' });
  } catch (e) { this.setState({ chErr: e.code === 'TOO_BIG' || e.status === 413 ? 'too_big' : (e.code || 'failed') }); }
  clearInterval(tick); this.setState({ uploading: false, upPct: 100 });
}
// Turns what the API returned into the structure this screen draws.
build() {
  const s = this.state; const d = s.data; if (!d) return null; const l = s.lang; const urls = this._urls || {};
  const view = d.view; const C = d.complaint; const nm = (o) => (o ? (o[l] || o.en || '') : '');
  const fmtT = (iso) => (iso ? new Date(iso).toLocaleString(l === 'hi' ? 'hi-IN' : 'en-IN', { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit', timeZone: 'Asia/Kolkata' }) : '–');
  const short = (h) => (h ? h.slice(0, 4) + '…' + h.slice(-4) : '–');
  const kind = { identity: 'identity', hazard_removed: 'hazard', outcome: 'outcome', operation: 'operation', permanence_hint: 'permanence' };
  const st = { supported: 'sup', partially_supported: 'par', not_demonstrated: 'nd', contradicted: 'con', contested: 'cont', unavailable: 'nd' };
  const gk = { G1: 'reuse', G2: 'similar', G3: 'place', G4: 'time', G5: 'sun', G6: 'inject' }; const gs = { pass: 'pass', fail: 'fail', weak: 'weak', unknown: 'unk' };
  const vk = { REJECTED: 'rej', FAILED: 'fail', NEEDS_HUMAN_REVIEW: 'hum', NEEDS_MORE_EVIDENCE: 'more', EVIDENCE_PASSED: 'pass' };
  const conf = (c) => (c >= 0.75 ? 'High' : c >= 0.45 ? 'Medium' : 'Low');
  const contract = view && view.contract ? view.contract : null; const cc = contract ? contract.contract : null;
  const media = (view && view.media) || []; const byId = Object.fromEntries(media.map((m) => [m.id, m]));
  const img = (m) => (m && urls[m.id] && urls[m.id] !== 'pending' ? urls[m.id] : null);
  const gpsOf = (m) => (m && m.exif && m.exif.lat != null ? Number(m.exif.lat).toFixed(5) + ' N, ' + Number(m.exif.lng).toFixed(5) + ' E' : '–');
  const before = media.filter((m) => m.kind === 'before')[0];
  const complaint = { label: 'Complaint photo', time: before ? fmtT(before.created_at) : '–', gps: gpsOf(before), dist: '–', hash: short(before && before.sha256), img: img(before), mime: before && before.mime, v: ['#BFD9C5', '#F5E3B5', '#4B6B55', false, 0, 0, null, 0, ''] };
  const evs = d.events || [];
  const subs = ((view && view.submissions) || []).map((q, i) => {
    const m0 = byId[(q.media_ids || [])[0]]; const gates = (q.gates || []).map((g) => [gk[g.id], gs[g.status], g.reason]); const hard = (q.gates || []).some((g) => g.hard && g.status === 'fail');
    const A = q.pass_a, B = q.pass_b; const crits = cc ? cc.criteria : [];
    const assess = (A && B) ? crits.map((k) => { const a = A.assessments.find((x) => x.criterion_id === k.id) || {}; const b = B.assessments.find((x) => x.criterion_id === k.id) || {}; return [k.id.toUpperCase(), st[a.status] || 'nd', st[b.status] || 'nd', a.observation || '', b.observation || '', a.limits || '', conf(Math.min(a.confidence ?? 0, b.confidence ?? 0)), B.strongest_objection || '', st[(q.merged || {})[k.id]] || 'nd']; }) : [];
    const own = evs.filter((e) => e.payload && e.payload.submission === q.id).map((e) => [fmtT(e.at), e.type.replace('PROOF_REJECTED_REUSED', 'PROOF_REJECTED'), e.type === 'PROOF_SUBMITTED' ? (q.media_ids || []).length + ' file(s) received.' : q.rule, '#' + e.seq]);
    const aiMissing = q.ai_called && !(A && B);
    return { id: q.id, label: 'Proof ' + (i + 1) + ' · ' + (m0 && m0.mime.startsWith('video') ? 'clip' : 'photo'), time: fmtT(q.created_at), gps: gpsOf(m0), dist: '–', hash: short(m0 && m0.sha256), clip: !!(m0 && m0.mime.startsWith('video')), clipLen: '', img: img(m0), mime: m0 && m0.mime, v: ['#CBD5E1', '#F5E3B5', '#64748B', false, 0, 0, null, 0, ''], gates, hard, assess, aiMissing,
      verdict: [vk[q.verdict] || 'hum', q.rule, q.next_evidence || []], tl: own, models: q.models || {}, latency: q.latency_ms, ai: q.ai_called };
  });
  const cr = C.closeRequestStatus;
  const citizen = [cr === 'reopened' ? (l === 'hi' ? 'नागरिक ने शिकायत दोबारा खोली।' : 'The citizen reopened the complaint.') : cr === 'confirmed' ? (l === 'hi' ? 'नागरिक ने पुष्टि की।' : 'The citizen confirmed.') : cr === 'requested' ? (l === 'hi' ? 'नागरिक का उत्तर बाकी है।' : 'The citizen has not answered yet.') : (l === 'hi' ? 'अभी नागरिक से पुष्टि नहीं माँगी गई।' : 'The citizen has not been asked yet.'), l === 'hi' ? 'नागरिक का कोई प्रति-प्रमाण नहीं।' : 'No counter-evidence from the citizen.'];
  const last = subs[subs.length - 1]; const mdl = last ? last.models : {};
  const health = [last && last.ai ? [mdl.examiner, mdl.cross].filter(Boolean).join(' / ') || '—' : '—', last && last.latency ? Math.round(last.latency / 100) / 10 + ' s' : '—', last && mdl.examiner && mdl.cross && mdl.examiner === mdl.cross ? 'Same model used for both passes' : 'No', 'Off'];
  return {
    code: C.code, cat: nm(C.category.names), dept: nm(C.department), area: [C.area ? nm(C.area) : '', C.city ? nm(C.city) : ''].filter(Boolean).join(', '), status: C.status.replace(/_/g, ' ').toLowerCase(), sla: fmtT(C.slaDueAt),
    claim: cc ? cc.claim : '', created: contract ? fmtT(contract.created_at) : '', source: contract ? contract.source : 'template', hash: contract ? short(contract.sha256) : '', hashFull: contract ? contract.sha256 : '', intact: contract ? contract.intact : false, version: contract ? contract.version : 1,
    criteria: cc ? cc.criteria.map((k) => [k.id.toUpperCase(), kind[k.type] || 'identity', k.requirement, (k.required_evidence || []).join(', ').replace(/_/g, ' '), (k.insufficient_if || []).join(', ').replace(/_/g, ' ') || '–', !!k.needs_darkness]) : [],
    complaint, subs, citizen, health, hasContract: !!cc, citizenAvailable: d.citizenAvailable, createdIso: contract ? contract.created_at : null, events: evs,
  };
}
renderVals() {
const s = this.state; const l = s.lang; const t = this.T[l]; const L = l === 'hi' ? 1 : 0; const ro = this.ROLES[s.role] || Object.values(this.ROLES)[0]; const rc = ro[5];
const sc = this.build() || { code: '', cat: '', dept: '', area: '', status: '', sla: '', claim: '', created: '', source: 'template', hash: '', version: 1, criteria: [], complaint: { label: 'Complaint photo', time: '–', gps: '–', dist: '–', hash: '–', v: ['#BFD9C5', '#F5E3B5', '#4B6B55', false, 0, 0, null, 0, ''] }, subs: [], citizen: ['', ''], health: ['—', '—', '—', 'Off'], hasContract: false, events: [] }; const subs = s.mode === 'replay' ? sc.subs.slice(0, s.rshown) : sc.subs; const cur = subs[Math.min(s.sel, Math.max(0, subs.length - 1))] || null;
const nav = this.NAVD.filter((n) => n[3].indexOf(rc) >= 0).map((n) => ({ href: n[0], label: n[1 + L], cls: n[0] === '/queue' ? 'on' : '', cur: n[0] === '/queue' ? 'page' : 'false' }));
const items = [Object.assign({ key: 'c' }, sc.complaint)].concat(subs.map((q, i) => Object.assign({ key: 's' + i }, q)));
const thumbs = items.map((q, i) => ({ label: i === 0 ? (L ? 'शिकायत की फ़ोटो' : q.label) : q.label.replace('Proof', L ? 'प्रमाण' : 'Proof'), time: q.time, v: this.vis(q.v), img: q.img, on: i === 0 ? false : (cur && s.sel === i - 1), pick: () => this.setState({ sel: Math.max(0, i - 1) }) }));
const selIdx = Math.min(s.sel, Math.max(0, subs.length - 1));
const mkV = (q, label) => Object.assign({ label, img: q.img, clip: !!q.clip, clipLen: q.clipLen || '' }, this.vis(q.v), { time: q.time, gps: q.gps, dist: q.dist, hash: q.hash });
let viewers = [];
if (!cur) viewers = [mkV(sc.complaint, t.zoom && (L ? 'शिकायत की फ़ोटो' : 'Complaint photo'))];
else if (s.cmp) viewers = [mkV(sc.complaint, L ? 'शिकायत की फ़ोटो' : 'Complaint photo'), mkV(cur, cur.label)];
else viewers = [mkV(cur, cur.label)];
const gt = this.GATEN[l];
const lastSub = subs[subs.length - 1]; const pst = !sc.hasContract ? 'nocontract' : (lastSub && lastSub.aiMissing ? 'aidown' : 'normal'); const normal = pst === 'normal';
const gates = cur && cur.gates ? cur.gates.map((g) => ({ name: gt[g[0]], sym: this.GRES[g[1]][0], text: this.GRES[g[1]][1 + L], style: this.GRES[g[1]][3], reason: g[2] })) : [];
const aiDown = pst === 'aidown';
const assess = (cur && !aiDown ? cur.assess : []).map((a) => { const crit = sc.criteria.find((k) => k[0] === a[0]); const st = (k) => this.CST[k]; return { id: a[0], req: crit ? crit[2] : '', mSym: st(a[8])[0], mText: st(a[8])[1 + L], mStyle: st(a[8])[3], aText: st(a[1])[1 + L], aStyle: st(a[1])[3], bText: st(a[2])[1 + L], bStyle: st(a[2])[3], aObs: a[3], bObs: a[4], cannot: a[5], conf: a[6], objection: a[7] }; });
let vd = cur ? this.VER[cur.verdict[0]] : null; let rule = cur ? cur.verdict[1] : '—'; let nextEv = cur ? cur.verdict[2] : [];
if (aiDown) { vd = this.VER.hum; rule = 'R6: AI unavailable → needs human review'; nextEv = []; }
if (!cur) { vd = this.VER.more; rule = '—'; nextEv = [L ? 'पहला प्रमाण जमा करें।' : 'Submit the first proof.']; }
const frozen = sc.hasContract ? [[sc.created, 'PROOF_CONTRACT_FROZEN', 'Contract v' + sc.version + ' frozen (' + sc.source + ').', sc.hash]] : []; const tlAll = frozen.concat(subs.reduce((acc, q) => acc.concat(q.tl.map((e) => [e[0], e[1], e[2], e[3]])), []));
const contractSrc = sc.source === 'template' ? ['template', 'background:#FEF3C7;color:#78350F;', L ? 'टेम्पलेट (AI अनुपलब्ध)' : 'Template (AI unavailable)'] : sc.source === 'gemini' ? ['gemini', 'background:#DBEAFE;color:#1E3A8A;', 'Gemini'] : ['template', 'background:#FEF3C7;color:#78350F;', L ? 'टेम्पलेट (AI अनुपलब्ध)' : 'Template (AI unavailable)'];
return {
t, nav, role: s.role, roleOpts: Object.keys(this.ROLES).map((k) => ({ v: k, l: this.ROLES[k][3 + L] })), onRole: (e) => this.setRole(e.target.value), isEn: l === 'en', isHi: l === 'hi', setEn: () => this.setLang('en'), setHi: () => this.setLang('hi'), user: ro[0], scope: ro[1 + L], isNational: !!(s.data && s.data.demoControls) && s.mode === 'live',
c: { code: sc.code, cat: sc.cat, dept: sc.dept, area: sc.area, status: sc.status, sla: sc.sla, demo: false },
isLive: s.mode === 'live', isReplay: s.mode === 'replay', setLive: () => this.setState({ mode: 'live' }), setReplay: () => this.setState({ mode: 'replay', rshown: 0 }), replayStep: () => this.replayStep(), replayLabel: (L ? 'अगला कदम' : 'Next step') + ' (' + s.rshown + '/' + sc.subs.length + ')', modeWord: s.mode === 'live' ? t.live : t.replay,
scenarios: [['A', L ? 'A · गड्ढा' : 'A · Pothole'], ['B', L ? 'B · नाली' : 'B · Drain'], ['C', L ? 'C · स्ट्रीटलाइट' : 'C · Streetlight']].map((x) => ({ label: x[1], on: (s.scn || 'A') === x[0], pick: () => this.setState({ scn: x[0] }) })),
shownN: sc.subs.length, totalN: 3, nextFixture: () => this.nextFixture(),
pstate: pst, onPstate: () => {}, stateOpts: [],
tabContract: s.tab === 'contract', tabTimeline: s.tab === 'timeline', showContract: () => this.setState({ tab: 'contract' }), showTimeline: () => this.setState({ tab: 'timeline' }),
noContract: pst === 'nocontract', hasContract: pst !== 'nocontract',
contract: { claim: sc.claim, version: sc.version, created: sc.created + ' IST', hash: sc.hash, srcText: contractSrc[2], srcStyle: contractSrc[1], criteria: sc.criteria.map((k) => ({ id: k[0], typeText: this.TYPES[k[1]], req: k[2], ev: k[3], insuff: k[4], dark: k[5] })) },
verifyHash: () => this.setState(sc.intact ? { hashOk: true, hashBad: false } : { hashOk: false, hashBad: true }), hashOk: s.hashOk, hashBad: s.hashBad, verifyChain: () => { const v = this.state.data && this.state.data.view; this.setState(v && v.ledger && v.ledger.intact ? { chainOk: true, chainBad: false } : { chainOk: false, chainBad: true }); }, chainOk: s.chainOk, chainBad: s.chainBad,
timeline: tlAll.map((e) => ({ when: e[0], type: e[1], text: e[2], hash: e[3] })),
thumbs, viewers, zoom: s.zoom, zoomScale: s.zoom / 100, onZoom: (e) => this.setState({ zoom: parseInt(e.target.value, 10) }), compare: s.cmp, toggleCompare: () => this.setState({ cmp: !this.state.cmp }),
sel: { label: cur ? cur.label : '' }, gates, showGates: true, hardFail: !!(cur && cur.hard), pending: false, badvideo: s.chErr === 'too_big',
verdict: { sym: vd[0], text: vd[1 + L], style: vd[3], box: vd[4], rule }, showNext: nextEv.length > 0, nextEv, aiDown, showAssess: assess.length > 0, assess,
citizen: { text: sc.citizen[0], counter: sc.citizen[1] }, health: { models: aiDown ? '—' : sc.health[0], latency: aiDown ? L ? 'समय सीमा पार' : 'timed out' : sc.health[1], fallback: sc.health[2], degraded: aiDown ? (L ? 'चालू: व्यक्ति की समीक्षा' : 'On: human review') : (L ? 'बंद' : 'Off') },
ms: { contract: s.ms, sub: s.ms, verdict: s.ms }, toast: s.toast, bad: s.bad, none: s.none, citizenDown: !!(s.data && !s.data.citizenAvailable), canSubmit: !!(s.data && s.data.demoControls), challengeText: s.chResult ? (this.VER[{ REJECTED: 'rej', FAILED: 'fail', NEEDS_HUMAN_REVIEW: 'hum', NEEDS_MORE_EVIDENCE: 'more', EVIDENCE_PASSED: 'pass' }[s.chResult.verdict] || 'hum'][1 + L]) + ' · ' + s.chResult.rule + (s.chResult.nextEvidence && s.chResult.nextEvidence.length ? ' — ' + s.chResult.nextEvidence.join('; ') : '') : (s.chErr ? (L ? 'अपलोड नहीं हो सका।' : 'The upload did not work.') : ''),
modalSubmit: s.modal === 'submit', modalChallenge: s.modal === 'challenge', openSubmit: () => this.setState({ modal: 'submit', uploading: false }), openChallenge: () => this.setState({ modal: 'challenge', chDone: false }), closeModal: () => this.setState({ modal: '' }),
pickFile: () => { this._chal = false; this._input.click(); }, uploading: s.uploading, uploadPct: s.upPct, uploadStep: s.upPct < 40 ? (L ? 'नियम-जाँच' : 'rule checks') : s.upPct < 90 ? (L ? 'दो AI आकलन' : 'two AI assessments') : (L ? 'निर्णय तालिका' : 'rules table'),
runChallenge: () => { this._chal = true; this.setState({ chDone: false, chResult: null }); this._input.click(); }, challengeDone: s.chDone, doPrint: () => { try { window.print(); } catch (e) {} }
};
}
}

ClosureCourtLogic.prototype.view = function view(__v) {
  const { replayStep, replayLabel, toast, bad, none, citizenDown, canSubmit, challengeText, hashBad, chainBad, a, aiDown, assess, badvideo, c, chainOk, challengeDone, citizen, closeModal, compare, contract, doPrint, e, g, gates, h, hardFail, hasContract, hashOk, health, isEn, isHi, isLive, isNational, isReplay, k, modalChallenge, modalSubmit, modeWord, ms, n, nav, nextEv, nextFixture, noContract, o, onPstate, onRole, onZoom, openChallenge, openSubmit, pending, pickFile, pstate, resetDemo, role, roleOpts, runChallenge, s, scenarios, scope, sel, setEn, setHi, setLive, setReplay, showAssess, showContract, showGates, showNext, showTimeline, shownN, stateOpts, t, tabContract, tabTimeline, thumbs, timeline, toggleCompare, totalN, uploadPct, uploadStep, uploading, user, v, verdict, verifyChain, verifyHash, viewers, zoom, zoomScale } = __v;
  return (
    <div className="sc-court" style={{ position: "relative", width: "100%", height: "100vh", minHeight: "780px", overflow: "hidden", display: "flex", flexDirection: "column", background: "#FFFFFF", color: "#111827", fontFamily: "'Noto Sans','Noto Sans Devanagari',system-ui,sans-serif", fontSize: "14px", lineHeight: "1.4" }}>
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
      <section style={{ margin: "8px 14px 0", background: "#fff", border: "0", borderTop: "3px solid #1F2937", borderRadius: "0", padding: "7px 12px", display: "flex", alignItems: "center", gap: "12px", flex: "none", flexWrap: "wrap" }}>
        <TLink to="/queue" className="btn sm">
          ← {t.queue}
        </TLink>
        <b style={{ fontFamily: "ui-monospace, Menlo, monospace", fontSize: "17px" }}>
          {c.code}
        </b>
        <span style={{ fontWeight: "600" }}>
          {c.cat}
        </span>
        <span style={{ color: "#4B5563" }}>
          {c.dept} · {c.area}
        </span>
        <span className="chip" style={{ background: "#E0E7FF", color: "#312E81" }}>
          {c.status}
        </span>
        <span style={{ color: "#4B5563", fontSize: "12.5px" }}>
          SLA: {c.sla}
        </span>
        <TLink to="/complaints" className="btn sm">
          {t.open_drawer}
        </TLink>
        <span style={{ flex: "1" }}>
        </span>
        <span className="seg" role="group" aria-label={t.mode}>
          <button type="button" aria-pressed={isLive} onClick={setLive}>
            {t.live}
          </button>
          <button type="button" aria-pressed={isReplay} onClick={setReplay}>
            {t.replay}
          </button>
        </span>
        <button type="button" className="btn" onClick={openSubmit}>
          {t.submit}
        </button>
        {!!(c.demo) && (
          <>
          <button type="button" className="btn" onClick={openChallenge}>
            {t.challenge}
          </button>
          </>
        )}
        <button type="button" className="btn" onClick={doPrint}>
          {t.print}
        </button>
      </section>
      {!!(isReplay) && (
        <>
        <div role="status" style={{ margin: "6px 14px 0", padding: "5px 12px", background: "#FEF3C7", border: "1px solid #F59E0B", borderRadius: "6px", fontWeight: "700", color: "#78350F", fontSize: "13px", flex: "none" }}>
          {t.replay_banner}{' '}<button type="button" className="btn sm" onClick={replayStep}>{replayLabel}</button>
        </div>
        </>
      )}
      {!!(isNational) && (
        <>
        <section aria-label={t.demo} style={{ margin: "6px 14px 0", padding: "5px 12px", background: "#FFFBEB", border: "1px dashed #B45309", borderRadius: "6px", display: "flex", alignItems: "center", gap: "10px", flex: "none", fontSize: "12.5px" }}>
          <b style={{ color: "#78350F" }}>
            {t.demo} ({t.gen_tag})
          </b>
          <span className="seg" role="group" aria-label={t.scenario}>
            {scenarios.map((s, __i) => (
              <React.Fragment key={__i}>
              <button type="button" aria-pressed={s.on} onClick={s.pick}>
                {s.label}
              </button>
              </React.Fragment>
            ))}
          </span>
          <button type="button" className="btn sm" onClick={nextFixture}>
            {t.next_fixture} ({shownN})
          </button>
        </section>
        </>
      )}
      {(!!bad || !!none || !!citizenDown || !!toast) && (<div role="alert" style={{ margin: "6px 14px 0", padding: "8px 12px", background: "#FEF3C7", border: "1px solid #F59E0B", borderRadius: "6px", color: "#78350F", fontWeight: "600" }}>{toast || (none ? (isHi ? "अभी कोई प्रमाण-जाँच वाली शिकायत नहीं है। शिकायतों में किसी शिकायत के लिए प्रमाण जमा करें।" : "No complaint has repair proof yet. Open a complaint in Complaints and submit proof.") : citizenDown ? (isHi ? "नागरिक ऐप से संपर्क नहीं हो सका, इसलिए विवरण उपलब्ध नहीं।" : "The citizen app could not be reached, so details are unavailable.") : (isHi ? "यह पृष्ठ लोड नहीं हो सका।" : "This page could not be loaded."))}</div>)}
      <main style={{ flex: "1", minHeight: "0", padding: "8px 14px 4px", display: "grid", gridTemplateColumns: "340px minmax(0, 1fr) 470px", gap: "10px" }}>
        <section className="panel" aria-label={t.contract}>
          <div style={{ display: "flex", alignItems: "center", padding: "6px 8px", borderBottom: "1px solid #E5E7EB", gap: "6px" }}>
            <span className="seg" role="group" aria-label={t.contract}>
              <button type="button" aria-pressed={tabContract} onClick={showContract}>
                {t.contract}
              </button>
              <button type="button" aria-pressed={tabTimeline} onClick={showTimeline}>
                {t.timeline}
              </button>
            </span>
          </div>
          <div className="scroll" style={{ padding: "8px 10px", display: "flex", flexDirection: "column", gap: "8px" }}>
            {!!(tabContract) && (
              <>
              {!!(noContract) && (
                <>
                <div style={{ padding: "20px", textAlign: "center", color: "#374151", border: "1px dashed #9CA3AF", borderRadius: "6px" }}>
                  {t.no_contract}
                </div>
                </>
              )}
              {!!(hasContract) && (
                <>
                <div style={{ fontSize: "12px", color: "#4B5563" }}>
                  {t.claim}
                </div>
                <div style={{ fontWeight: "700", fontSize: "14px" }}>
                  {contract.claim}
                </div>
                <dl className="kvr">
                  <dt>
                    {t.version}
                  </dt>
                  <dd>
                    v{contract.version} · {t.frozen}
                  </dd>
                  <dt>
                    {t.source}
                  </dt>
                  <dd>
                    <span className="chip" style={css(contract.srcStyle)}>
                      {contract.srcText}
                    </span>
                  </dd>
                  <dt>
                    {t.created}
                  </dt>
                  <dd>
                    {contract.created}
                  </dd>
                  <dt>
                    {t.hash}
                  </dt>
                  <dd style={{ fontFamily: "ui-monospace, Menlo, monospace", fontSize: "11px" }}>
                    {contract.hash}
                  </dd>
                </dl>
                <div style={{ display: "flex", gap: "6px", alignItems: "center" }}>
                  <button type="button" className="btn sm" onClick={verifyHash}>
                    {t.verify_hash}
                  </button>
                  {!!(hashOk) && (
                    <>
                    <span className="chip" style={{ background: "#DCFCE7", color: "#14532D" }}>
                      ✓ {t.hash_ok}
                    </span>
                    </>
                  )}
                  <a href="#ledger" className="btn sm">
                    {t.ledger_link}
                  </a>
                </div>
                {contract.criteria.map((k, __i) => (
                  <React.Fragment key={__i}>
                  <div className="crit">
                    <div style={{ display: "flex", gap: "6px", alignItems: "center", flexWrap: "wrap" }}>
                      <span className="chip" style={{ background: "#111827", color: "#fff" }}>
                        {k.id}
                      </span>
                      <span className="chip" style={{ background: "#E5E7EB", color: "#1F2937" }}>
                        {k.typeText}
                      </span>
                      {!!(k.dark) && (
                        <>
                        <span className="chip" style={{ background: "#1E293B", color: "#fff" }}>
                          {t.night}
                        </span>
                        </>
                      )}
                    </div>
                    <div style={{ fontWeight: "600" }}>
                      {k.req}
                    </div>
                    <div style={{ fontSize: "12px" }}>
                      <b>
                        {t.needs_ev}:
                      </b>
                      {' '}{k.ev}
                    </div>
                    <div style={{ fontSize: "12px", color: "#7F1D1D" }}>
                      <b>
                        {t.insuff}:
                      </b>
                      {' '}{k.insuff}
                    </div>
                  </div>
                  </React.Fragment>
                ))}
                </>
              )}
              </>
            )}
            {!!(tabTimeline) && (
              <>
              <div id="ledger" style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                <b>
                  {t.ledger}
                </b>
                <button type="button" className="btn sm" onClick={verifyChain}>
                  {t.verify_chain}
                </button>
                {!!(chainOk) && (
                  <>
                  <span className="chip" style={{ background: "#DCFCE7", color: "#14532D" }}>
                    ✓ {t.chain_ok}
                  </span>
                  </>
                )}
              </div>
              <ol style={{ listStyle: "none", margin: "0", padding: "0", display: "flex", flexDirection: "column", gap: "8px" }}>
                {timeline.map((e, __i) => (
                  <React.Fragment key={__i}>
                  <li style={{ display: "grid", gridTemplateColumns: "78px 1fr", gap: "8px", fontSize: "12.5px" }}>
                    <span style={{ color: "#4B5563" }}>
                      {e.when}
                    </span>
                    <span>
                      <b style={{ fontFamily: "ui-monospace, Menlo, monospace", fontSize: "11.5px" }}>
                        {e.type}
                      </b>
                      <span style={{ display: "block" }}>
                        {e.text}
                      </span>
                      <span style={{ display: "block", fontSize: "11px", color: "#4B5563", fontFamily: "ui-monospace, Menlo, monospace" }}>
                        {e.hash}
                      </span>
                    </span>
                  </li>
                  </React.Fragment>
                ))}
              </ol>
              </>
            )}
          </div>
          <div style={{ padding: "4px 10px 6px", fontSize: "11px", color: "#4B5563", borderTop: "1px solid #F3F4F6" }}>
            {t.src}: court/contract · {ms.contract} ms · {modeWord}
          </div>
        </section>
        <section className="panel" aria-label={t.evidence}>
          <div style={{ display: "flex", alignItems: "center", gap: "8px", padding: "6px 10px", borderBottom: "1px solid #E5E7EB" }}>
            <b>
              {t.evidence}
            </b>
            <span style={{ flex: "1" }}>
            </span>
            <label style={{ fontSize: "12px", display: "flex", alignItems: "center", gap: "5px" }}>
              <input type="checkbox" checked={compare} onChange={toggleCompare} />
              {' '}{t.compare}
            </label>
            <label style={{ fontSize: "12px", display: "flex", alignItems: "center", gap: "5px" }}>
              {t.zoom}
              <input type="range" min="100" max="300" value={zoom} onChange={onZoom} style={{ width: "90px" }} aria-label={t.zoom} />
            </label>
          </div>
          <div style={{ display: "flex", gap: "6px", padding: "6px 10px", overflowX: "auto", flex: "none", alignItems: "stretch" }}>
            {thumbs.map((h, __i) => (
              <React.Fragment key={__i}>
              <button type="button" className="thumb" aria-pressed={h.on} onClick={h.pick}>
                <div style={{ height: "46px", overflow: "hidden", borderRadius: "3px", background: "#E5E7EB" }}>
                  {!!h.img && (<img src={h.img} alt={h.label} style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} />)}
                  {!h.img && (<svg viewBox="0 0 160 100" preserveAspectRatio="xMidYMid slice" style={{ width: "100%", height: "100%", display: "block" }}>
                    <rect width="160" height="100" fill={h.v.sky} />
                    <circle cx="130" cy="20" r="9" fill={h.v.sun} />
                    <rect y="70" width="160" height="30" fill={h.v.ground} />
                    <g style={css(h.v.poleStyle)}>
                      <rect x="78" y="14" width="5" height="60" fill="#38523F" />
                      <path d="M82 16q-2-12 22-12" stroke="#38523F" strokeWidth="4" fill="none" />
                      <circle cx="106" cy="8" r={h.v.glow} fill="#FDE047" opacity="0.8" />
                    </g>
                    <ellipse cx="80" cy="84" rx="22" ry="7" fill={h.v.hole} style={css(h.v.holeStyle)} />
                    <rect x="40" y="76" width="80" height="10" fill="#334155" style={css(h.v.drainStyle)} />
                  </svg>)}
                </div>
                <div style={{ fontSize: "11px", fontWeight: "700" }}>
                  {h.label}
                </div>
                <div style={{ fontSize: "10.5px", color: "#4B5563" }}>
                  {h.time}
                </div>
              </button>
              </React.Fragment>
            ))}
          </div>
          <div style={{ display: "flex", gap: "8px", padding: "0 10px", flex: "none" }}>
            {viewers.map((v, __i) => (
              <React.Fragment key={__i}>
              <div style={{ flex: "1", minWidth: "0", display: "flex", flexDirection: "column", gap: "4px" }}>
                <div style={{ height: "210px", overflow: "hidden", border: "1px solid #9CA3AF", borderRadius: "6px", background: "#E5E7EB", position: "relative" }}>
                  <div style={css(`width: 100%; height: 100%; transform-origin: 50% 70%; transform: scale(${zoomScale});`)}>
                    {!!v.img && !v.clip && (<img src={v.img} alt={v.label} style={{ width: "100%", height: "100%", objectFit: "contain", display: "block" }} />)}
                    {!!v.img && !!v.clip && (<video src={v.img} controls style={{ width: "100%", height: "100%", objectFit: "contain", display: "block" }} />)}
                    {!v.img && (<svg viewBox="0 0 160 100" preserveAspectRatio="xMidYMid meet" role="img" aria-label={v.label} style={{ width: "100%", height: "100%", display: "block" }}>
                      <rect width="160" height="100" fill={v.sky} />
                      <circle cx="130" cy="20" r="9" fill={v.sun} />
                      <rect y="70" width="160" height="30" fill={v.ground} />
                      <g style={css(v.poleStyle)}>
                        <rect x="78" y="14" width="5" height="60" fill="#38523F" />
                        <path d="M82 16q-2-12 22-12" stroke="#38523F" strokeWidth="4" fill="none" />
                        <circle cx="106" cy="8" r={v.glow} fill="#FDE047" opacity="0.8" />
                        <rect x="40" y="60" width="80" height="12" fill="#FDE047" opacity={v.roadGlow} />
                      </g>
                      <ellipse cx="80" cy="84" rx="22" ry="7" fill={v.hole} style={css(v.holeStyle)} />
                      <rect x="40" y="76" width="80" height="10" fill="#334155" style={css(v.drainStyle)} />
                    </svg>)}
                  </div>
                  <span style={{ position: "absolute", left: "6px", top: "6px", background: "rgba(17,24,39,.75)", color: "#fff", fontSize: "11px", padding: "1px 6px", borderRadius: "3px" }}>
                    {v.label}
                  </span>
                  {!!(v.clip) && (
                    <>
                    <span style={{ position: "absolute", right: "6px", top: "6px", background: "#1D4ED8", color: "#fff", fontSize: "11px", padding: "1px 6px", borderRadius: "3px" }}>
                      {v.clipLen}
                    </span>
                    </>
                  )}
                </div>
                <dl className="kvr">
                  <dt>
                    {t.taken}
                  </dt>
                  <dd>
                    {v.time}
                  </dd>
                  <dt>
                    GPS
                  </dt>
                  <dd>
                    {v.gps}
                  </dd>
                  <dt>
                    {t.distance}
                  </dt>
                  <dd>
                    {v.dist}
                  </dd>
                  <dt>
                    {t.filehash}
                  </dt>
                  <dd style={{ fontFamily: "ui-monospace, Menlo, monospace", fontSize: "11px" }}>
                    {v.hash}
                  </dd>
                </dl>
              </div>
              </React.Fragment>
            ))}
          </div>
          <div style={{ padding: "4px 10px 2px", fontSize: "11px", color: "#78350F", flex: "none" }}>
            {t.sample_img}
          </div>
          <div className="scroll" style={{ borderTop: "1px solid #E5E7EB", marginTop: "4px" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "8px", padding: "6px 10px 0" }}>
              <b>
                {t.gates}
              </b>
              <span style={{ color: "#4B5563", fontSize: "12px" }}>
                {sel.label}
              </span>
            </div>
            {!!(pending) && (
              <>
              <div style={{ margin: "8px 10px", padding: "14px", border: "1px dashed #9CA3AF", borderRadius: "6px", color: "#374151" }}>
                {t.pending}
              </div>
              </>
            )}
            {!!(badvideo) && (
              <>
              <div role="alert" style={{ margin: "8px 10px", padding: "12px", border: "1px solid #FCA5A5", background: "#FEF2F2", borderRadius: "6px", color: "#7F1D1D", fontWeight: "600" }}>
                ✕ {t.bad_video}
              </div>
              </>
            )}
            {!!(showGates) && (
              <>
              <table>
                <thead>
                  <tr>
                    <th scope="col">
                      {t.gate}
                    </th>
                    <th scope="col">
                      {t.result}
                    </th>
                    <th scope="col">
                      {t.reason}
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {gates.map((g, __i) => (
                    <React.Fragment key={__i}>
                    <tr>
                      <td style={{ fontWeight: "600" }}>
                        {g.name}
                      </td>
                      <td>
                        <span className="chip" style={css(g.style)}>
                          {g.sym} {g.text}
                        </span>
                      </td>
                      <td>
                        {g.reason}
                      </td>
                    </tr>
                    </React.Fragment>
                  ))}
                </tbody>
              </table>
              {!!(hardFail) && (
                <>
                <div style={{ margin: "8px 10px", padding: "8px 12px", background: "#F3F4F6", border: "1px solid #6B7280", borderRadius: "6px", fontWeight: "700" }}>
                  ✕ {t.no_ai}
                </div>
                </>
              )}
              </>
            )}
          </div>
          <div style={{ padding: "4px 10px 6px", fontSize: "11px", color: "#4B5563", borderTop: "1px solid #F3F4F6" }}>
            {t.src}: court/submissions · {ms.sub} ms · {modeWord}
          </div>
        </section>
        <section className="panel" aria-label={t.verdict}>
          <div style={css(`padding: 8px 12px; border-bottom: 1px solid #E5E7EB; display: flex; flex-direction: column; gap: 5px; ${verdict.box}`)}>
            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
              <b style={{ fontSize: "12.5px" }}>
                {t.verdict}
              </b>
              <span className="chip" style={css(`${verdict.style}; font-size: 14px; padding: 3px 12px;`)}>
                {verdict.sym} {verdict.text}
              </span>
            </div>
            <div style={{ fontSize: "12px" }}>
              {t.rule}:{' '}
              <b>
                {verdict.rule}
              </b>
            </div>
            <div style={{ fontSize: "12px", fontWeight: "700" }}>
              {t.not_close}
            </div>
          </div>
          <div className="scroll" style={{ padding: "8px 10px", display: "flex", flexDirection: "column", gap: "8px" }}>
            {!!(showNext) && (
              <>
              <div style={{ border: "1px solid #F59E0B", background: "#FFFBEB", borderRadius: "6px", padding: "7px 10px" }}>
                <b style={{ fontSize: "12.5px" }}>
                  {t.next_ev}
                </b>
                <ul style={{ margin: "3px 0 0", paddingLeft: "18px" }}>
                  {nextEv.map((n, __i) => (
                    <React.Fragment key={__i}>
                    <li>
                      {n}
                    </li>
                    </React.Fragment>
                  ))}
                </ul>
              </div>
              </>
            )}
            {!!(aiDown) && (
              <>
              <div role="alert" style={{ border: "1px solid #FCA5A5", background: "#FEF2F2", borderRadius: "6px", padding: "8px 10px", fontWeight: "600", color: "#7F1D1D" }}>
                {t.ai_down}
              </div>
              </>
            )}
            {!!(showAssess) && (
              <>
              <b style={{ fontSize: "12.5px" }}>
                {t.per_crit}
              </b>
              {assess.map((a, __i) => (
                <React.Fragment key={__i}>
                <div className="crit">
                  <div style={{ display: "flex", alignItems: "center", gap: "6px", flexWrap: "wrap" }}>
                    <span className="chip" style={{ background: "#111827", color: "#fff" }}>
                      {a.id}
                    </span>
                    <b style={{ fontSize: "12.5px", flex: "1", minWidth: "0" }}>
                      {a.req}
                    </b>
                    <span className="chip" style={css(a.mStyle)}>
                      {a.mSym} {a.mText}
                    </span>
                  </div>
                  <div className="ab">
                    <div>
                      <b>
                        {t.pass_a}
                      </b>
                      :{' '}
                      <span className="chip" style={css(a.aStyle)}>
                        {a.aText}
                      </span>
                      <div>
                        {a.aObs}
                      </div>
                    </div>
                    <div>
                      <b>
                        {t.pass_b}
                      </b>
                      :{' '}
                      <span className="chip" style={css(a.bStyle)}>
                        {a.bText}
                      </span>
                      <div>
                        {a.bObs}
                      </div>
                    </div>
                  </div>
                  <div style={{ fontSize: "12px" }}>
                    <b>
                      {t.cannot}:
                    </b>
                    {' '}{a.cannot}
                  </div>
                  <div style={{ fontSize: "12px" }}>
                    <b>
                      {t.conf}:
                    </b>
                    {' '}{a.conf} ·{' '}
                    <b>
                      {t.objection}:
                    </b>
                    {' '}{a.objection}
                  </div>
                </div>
                </React.Fragment>
              ))}
              </>
            )}
            <div className="crit" style={{ background: "#F9FAFB" }}>
              <b style={{ fontSize: "12.5px" }}>
                {t.citizen}
              </b>
              <div style={{ fontSize: "12.5px" }}>
                {citizen.text}
              </div>
              <div style={{ fontSize: "12px", color: "#374151" }}>
                {citizen.counter}
              </div>
            </div>
          </div>
          <div style={{ padding: "4px 10px 6px", fontSize: "11px", color: "#4B5563", borderTop: "1px solid #F3F4F6" }}>
            {t.src}: court/verdict · {ms.verdict} ms · {modeWord}
          </div>
        </section>
      </main>
      <footer style={{ margin: "0 14px 6px", padding: "5px 12px", background: "#fff", border: "0", borderTop: "3px solid #1F2937", borderRadius: "0", display: "flex", alignItems: "center", gap: "16px", fontSize: "12px", flex: "none" }}>
        <b>
          {t.ai_health}
        </b>
        <span>
          {t.models}:{' '}
          <b>
            {health.models}
          </b>
        </span>
        <span>
          {t.latency}:{' '}
          <b>
            {health.latency}
          </b>
        </span>
        <span>
          {t.fallback}:{' '}
          <b>
            {health.fallback}
          </b>
        </span>
        <span>
          {t.degraded}:{' '}
          <b>
            {health.degraded}
          </b>
        </span>
        <span style={{ flex: "1" }}>
        </span>
        <TLink to="/health">
          {t.health_link}
        </TLink>
        <span style={{ color: "#4B5563" }}>
          {t.proto_short}
        </span>
      </footer>
      {!!(modalSubmit) && (
        <>
        <div className="modal-bg" onClick={closeModal}>
        </div>
        <div className="modal" role="dialog" aria-modal="true" aria-label={t.submit}>
          <h2 style={{ margin: "0", fontSize: "18px" }}>
            {t.submit} · {c.code}
          </h2>
          <div className="drop">
            {t.drop}
            <div style={{ marginTop: "6px" }}>
              <button type="button" className="btn" onClick={pickFile}>
                {t.choose_files}
              </button>
            </div>
          </div>
          {!!(uploading) && (
            <>
            <div role="status" style={{ padding: "8px 12px", background: "#EFF6FF", border: "1px solid #93C5FD", borderRadius: "6px" }}>
              {t.uploading}: {uploadPct}% — {uploadStep}
            </div>
            </>
          )}
          <div style={{ fontSize: "12px", color: "#4B5563" }}>
            {t.limits}
          </div>
          <div style={{ display: "flex", gap: "8px", justifyContent: "flex-end" }}>
            <button type="button" className="btn" onClick={closeModal}>
              {t.cancel}
            </button>
          </div>
        </div>
        </>
      )}
      {!!(modalChallenge) && (
        <>
        <div className="modal-bg" onClick={closeModal}>
        </div>
        <div className="modal" role="dialog" aria-modal="true" aria-label={t.challenge}>
          <h2 style={{ margin: "0", fontSize: "18px" }}>
            {t.challenge}
          </h2>
          <p style={{ margin: "0" }}>
            {t.challenge_help}
          </p>
          <div className="drop">
            {t.drop_one}
            <div style={{ marginTop: "6px" }}>
              <button type="button" className="btn" onClick={runChallenge}>
                {t.choose_image}
              </button>
            </div>
          </div>
          {!!(challengeDone) && (
            <>
            <div style={{ border: "1px solid #6B7280", borderRadius: "6px", padding: "10px 12px", background: "#F9FAFB" }}>
              <b>
                {t.challenge_result}
              </b>
              <div>
                {challengeText}
              </div>
            </div>
            </>
          )}
          <div style={{ display: "flex", gap: "8px", justifyContent: "flex-end" }}>
            <button type="button" className="btn" onClick={closeModal}>
              {t.close}
            </button>
          </div>
        </div>
        </>
      )}
    </div>
  );
};

export default ClosureCourtLogic;
