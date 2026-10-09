import React from 'react';
import { DCLogic, css } from '../lib/dc.js';
import { TLink } from '../lib/TLink.jsx';
import { govRoles, currentRoleKey, switchRole } from '../lib/gov.js';
import { logout, api, qs, download } from '../lib/client.js';
import './Complaints.css';

/* Behaviour and sample data of this screen. Replace the sample data with calls to your API (see docs/DATA.md). */
class ComplaintsLogic extends DCLogic {
state = { items: [], total: 0, ms: 0, bad: false, detail: null, lang: 'en', role: currentRoleKey(), queue: 'open', view: 'split', q: '', status: '', priority: '', verify: '', state: '', district: '', city: '', area: '', dept: '', l1: '', cat: '', from: '', to: '', groupBy: 'none', sort: 'new', more: false, sel: '', tab: 'details', modal: '', ridx: 0, rrow: '', reason: '', shown: {}, revealN: 0, revealErr: '', loadErr: false, note: '', sent: {}, toast: '', copied: false, hashOk: false, zoomTxt: '' };
ROLES = govRoles();
NAVD = [['/', 'Civic Pulse', 'सिविक पल्स', 'nstcd'], ['/complaints', 'Complaints', 'शिकायतें', 'nstcd'], ['/queue', 'Closure Court', 'क्लोज़र कोर्ट', 'nstcd'], ['/ask', 'Ask the City', 'शहर से पूछें', 'nstcd'], ['/scorecard', 'Scorecard', 'स्कोरकार्ड', 'nstc'], ['/benchmark', 'Benchmark', 'बेंचमार्क', 'n'], ['/health', 'System health', 'सिस्टम स्वास्थ्य', 'n'], ['/audit', 'Audit log', 'ऑडिट लॉग', 'n']];
T = {
en: { brand: 'NyaySetu Gov', generated: 'Generated data', legend: 'Legend', view_as: 'View as', signout: 'Sign out', proto: 'Prototype. Not an official government website. Part of the demo data is generated and labelled as such.',
nav_complaints: 'Complaints', scoped: 'Scoped to your area', view: 'View', v_split: 'Table and map', v_table: 'Table only', v_map: 'Map', gen_tag: 'Generated',
f_search: 'Search by ID, last 4 digits of mobile, or words', f_status: 'Status', f_priority: 'Priority', f_verify: 'Citizen verification', f_group: 'Group by', f_state: 'State', f_district: 'District', f_city: 'City', f_area: 'Area', f_dept: 'Department', f_catgroup: 'Category group', f_cat: 'Category', f_from: 'From date', f_to: 'To date', all: 'All', more: 'More filters', less: 'Fewer filters', f_clear: 'Clear filters', export: 'Export CSV', exported: 'Downloaded nyaysetu-complaints.csv (respects your filters and area). Mobile numbers are hidden in the file.',
c_id: 'Complaint ID', c_mobile: 'Mobile number', c_cat: 'Category', c_area: 'Area', c_dept: 'Department', c_status: 'Status', c_priority: 'Priority', c_age: 'Age', c_verify: 'Citizen verification', show: 'Show number', hide: 'Hide', overdue: 'Overdue', empty: 'No complaints match these filters.', sort: 'Sort', s_new: 'Newest first', s_old: 'Oldest first', s_pri: 'Highest priority', paging: 'Loads 50 more when you reach the end', src: 'Source', count: 'complaints',
map_levels: 'Zoomed out: city circles with counts. Zoom in: heat colour with area counts. Zoom closer: each complaint. (State shading is shown in the national view.)', approx: 'Locations are approximate (±25 m).', map_note: 'generated points are labelled',
d_tabs: 'Drawer sections', d_details: 'Details', d_proof: 'Proof', d_summary: 'Summary', d_location: 'Location', d_sla: 'Deadline (SLA)', d_received: 'Received', d_words: 'The citizen’s own words', d_reporters: 'Reporters (masked)', d_timeline: 'Timeline', call: 'Call', reveal_note: 'Every view is recorded with your reason. Numbers shown this hour:', d_contract: 'Proof contract', source: 'Source', hash: 'Hash', verify_hash: 'Verify hash', hash_ok: 'Matches the ledger', d_latest: 'Latest verdict', d_proofs: 'proof submissions', open_court: 'Open Closure Court', no_proof: 'No proof contract yet for this complaint.', not_close: 'This does not close the complaint. The citizen decides.',
close_title: 'Ask the citizen to verify', latest_verdict: 'Latest proof verdict', warn: 'The latest proof says the evidence is not enough.', can_proceed: 'You can still ask the citizen, who decides.', close_help: 'Use this once field work is done. The citizen is asked in their app whether the problem is really fixed. Only the citizen can close the complaint.', close_button: 'Request closure', close_note: 'Note for the citizen (optional)', close_send: 'Send request', close_history: 'Earlier requests', close: 'Close', cancel: 'Cancel',
m_title: 'Show mobile number', m_warn: 'Showing this number will be recorded against your name. You may show at most 30 numbers an hour.', m_reason: 'Reason (required, at least 3 characters)', sent_ok: 'Request sent. The citizen will see it in their app.',
k_received: 'Received', k_open: 'Open', k_await: 'Awaiting citizen', k_resolved: 'Resolved', k_sla: 'SLA breached', k_reop: 'Reopened', k_fix: 'Confirmed fix', k_hours: 'Avg. resolution',
h_received: 'Every complaint matching the filters', h_open: 'Not yet closed', h_await: 'Work done; citizen has not confirmed', h_resolved: 'Closed after work', h_sla: 'Share past their deadline', h_reop: 'Of finished, citizen reopened', h_fix: 'Of finished, citizen confirmed', h_hours: 'Received to work done',
g_none: 'No grouping', g_state: 'State', g_district: 'District', g_city: 'City', g_area: 'Area', g_dept: 'Department', g_l1: 'Category group', q_all: 'All', q_open: 'Open', q_over: 'Overdue', q_wait: 'Awaiting citizen', q_reop: 'Reopened' },
hi: { brand: 'न्यायसेतु शासन', generated: 'जनित डेटा', legend: 'संकेत-सूची', view_as: 'इस रूप में देखें', signout: 'लॉग आउट', proto: 'प्रोटोटाइप। आधिकारिक सरकारी वेबसाइट नहीं। कुछ डेमो डेटा जनित है और उस पर लेबल है।',
nav_complaints: 'शिकायतें', scoped: 'आपके क्षेत्र तक सीमित', view: 'दृश्य', v_split: 'तालिका और मानचित्र', v_table: 'केवल तालिका', v_map: 'मानचित्र', gen_tag: 'जनित',
f_search: 'ID, मोबाइल के अंतिम 4 अंक, या शब्द खोजें', f_status: 'स्थिति', f_priority: 'प्राथमिकता', f_verify: 'नागरिक सत्यापन', f_group: 'समूह बनाएँ', f_state: 'राज्य', f_district: 'ज़िला', f_city: 'शहर', f_area: 'क्षेत्र', f_dept: 'विभाग', f_catgroup: 'श्रेणी समूह', f_cat: 'श्रेणी', f_from: 'से तारीख', f_to: 'तक तारीख', all: 'सभी', more: 'और फ़िल्टर', less: 'कम फ़िल्टर', f_clear: 'फ़िल्टर हटाएँ', export: 'CSV निर्यात', exported: 'nyaysetu-complaints.csv डाउनलोड हुई (आपके फ़िल्टर और क्षेत्र के अनुसार)। फ़ाइल में मोबाइल नंबर छिपे हैं।',
c_id: 'शिकायत संख्या', c_mobile: 'मोबाइल नंबर', c_cat: 'श्रेणी', c_area: 'क्षेत्र', c_dept: 'विभाग', c_status: 'स्थिति', c_priority: 'प्राथमिकता', c_age: 'अवधि', c_verify: 'नागरिक सत्यापन', show: 'नंबर दिखाएँ', hide: 'छिपाएँ', overdue: 'समय-सीमा पार', empty: 'इन फ़िल्टर से कोई शिकायत नहीं मिली।', sort: 'क्रम', s_new: 'सबसे नई पहले', s_old: 'सबसे पुरानी पहले', s_pri: 'सर्वोच्च प्राथमिकता', paging: 'अंत तक पहुँचने पर 50 और लोड होंगी', src: 'स्रोत', count: 'शिकायतें',
map_levels: 'दूर से: शहर के घेरे और गिनती। पास आने पर: हीट रंग और क्षेत्र की गिनती। और पास: हर शिकायत। (राज्यों का रंग राष्ट्रीय दृश्य में दिखता है।)', approx: 'स्थान लगभग हैं (±25 मी)।', map_note: 'जनित बिंदुओं पर लेबल है',
d_tabs: 'ड्रॉअर के भाग', d_details: 'विवरण', d_proof: 'प्रमाण', d_summary: 'सारांश', d_location: 'स्थान', d_sla: 'समय-सीमा (SLA)', d_received: 'प्राप्त', d_words: 'नागरिक के अपने शब्द', d_reporters: 'शिकायतकर्ता (छिपे हुए)', d_timeline: 'घटनाक्रम', call: 'कॉल करें', reveal_note: 'हर बार देखना आपके कारण के साथ दर्ज होता है। इस घंटे देखे गए नंबर:', d_contract: 'प्रमाण अनुबंध', source: 'स्रोत', hash: 'हैश', verify_hash: 'हैश जाँचें', hash_ok: 'लेजर से मेल खाता है', d_latest: 'ताज़ा निर्णय', d_proofs: 'प्रमाण प्रस्तुतियाँ', open_court: 'क्लोज़र कोर्ट खोलें', no_proof: 'इस शिकायत का अभी कोई प्रमाण अनुबंध नहीं।', not_close: 'इससे शिकायत बंद नहीं होती। नागरिक तय करता है।',
close_title: 'नागरिक से पुष्टि का अनुरोध करें', latest_verdict: 'ताज़ा प्रमाण निर्णय', warn: 'ताज़ा प्रमाण कहता है कि सबूत काफ़ी नहीं है।', can_proceed: 'आप फिर भी नागरिक से पूछ सकते हैं, वही तय करता है।', close_help: 'फ़ील्ड का काम पूरा होने पर इसे इस्तेमाल करें। नागरिक से उनके ऐप में पूछा जाता है कि समस्या सच में ठीक हुई या नहीं। शिकायत केवल नागरिक ही बंद कर सकता है।', close_button: 'समापन का अनुरोध करें', close_note: 'नागरिक के लिए संदेश (वैकल्पिक)', close_send: 'अनुरोध भेजें', close_history: 'पहले भेजे गए अनुरोध', close: 'बंद करें', cancel: 'रद्द करें',
m_title: 'मोबाइल नंबर दिखाएँ', m_warn: 'यह नंबर देखना आपके नाम से दर्ज किया जाएगा। एक घंटे में अधिकतम 30 नंबर देख सकते हैं।', m_reason: 'कारण (ज़रूरी, कम से कम 3 अक्षर)', sent_ok: 'अनुरोध भेज दिया गया। नागरिक इसे अपने ऐप में देखेंगे।',
k_received: 'प्राप्त', k_open: 'खुली', k_await: 'नागरिक की पुष्टि बाकी', k_resolved: 'निपटाई गई', k_sla: 'समय-सीमा पार', k_reop: 'दोबारा खुली', k_fix: 'पुष्टि हुए समाधान', k_hours: 'औसत निपटान',
h_received: 'फ़िल्टर से मेल खाती सभी', h_open: 'अभी बंद नहीं', h_await: 'काम पूरा; नागरिक ने पुष्टि नहीं की', h_resolved: 'काम के बाद बंद', h_sla: 'समय-सीमा पार का हिस्सा', h_reop: 'पूरी में से नागरिक ने दोबारा खोली', h_fix: 'पूरी में से नागरिक ने पुष्टि की', h_hours: 'प्राप्ति से कार्य पूर्ण तक',
g_none: 'कोई समूह नहीं', g_state: 'राज्य', g_district: 'ज़िला', g_city: 'शहर', g_area: 'क्षेत्र', g_dept: 'विभाग', g_l1: 'श्रेणी समूह', q_all: 'सभी', q_open: 'खुली', q_over: 'समय-सीमा पार', q_wait: 'नागरिक की पुष्टि बाकी', q_reop: 'दोबारा खुली' }
};
ST = { en: { SUBMITTED: 'Received', VERIFIED: 'Verified', NEEDS_TRIAGE: 'Needs triage', ASSIGNED: 'Assigned', DISPATCHED: 'Team dispatched', WORK_DONE_PENDING_CONFIRMATION: 'Work done – awaiting citizen', CLOSED_CONFIRMED: 'Closed (citizen confirmed)', CLOSED_UNCONFIRMED: 'Closed (not confirmed)', REOPENED: 'Reopened' },
hi: { SUBMITTED: 'प्राप्त', VERIFIED: 'सत्यापित', NEEDS_TRIAGE: 'जाँच आवश्यक', ASSIGNED: 'सौंपी गई', DISPATCHED: 'टीम रवाना', WORK_DONE_PENDING_CONFIRMATION: 'कार्य पूर्ण – नागरिक की पुष्टि बाकी', CLOSED_CONFIRMED: 'बंद (नागरिक द्वारा पुष्टि)', CLOSED_UNCONFIRMED: 'बंद (पुष्टि नहीं)', REOPENED: 'पुनः खोली गई' } };
PR = { en: { Critical: 'Critical', High: 'High', Medium: 'Medium', Low: 'Low' }, hi: { Critical: 'अति गंभीर', High: 'उच्च', Medium: 'मध्यम', Low: 'कम' } };
VF = { en: { requested: 'Awaiting citizen', confirmed: 'Citizen confirmed', reopened: 'Citizen reopened', unconfirmed: 'Unconfirmed after 7 days', none: 'No request sent' }, hi: { requested: 'नागरिक की पुष्टि बाकी', confirmed: 'नागरिक ने पुष्टि की', reopened: 'नागरिक ने दोबारा खोला', unconfirmed: '7 दिन बाद भी पुष्टि नहीं', none: 'अनुरोध नहीं भेजा' } };
VCODE = { NEEDS_HUMAN_REVIEW: 'hum', NEEDS_MORE_EVIDENCE: 'more', FAILED: 'fail', REJECTED: 'rej', EVIDENCE_PASSED: 'pass' };
VERD = { hum: ['?', 'Needs human review', 'व्यक्ति की समीक्षा चाहिए', 'background:#EDE9FE;color:#4C1D95;'], more: ['＋', 'Needs more evidence', 'और प्रमाण चाहिए', 'background:#FEF3C7;color:#78350F;'], fail: ['✕', 'Failed', 'विफल', 'background:#FEE2E2;color:#7F1D1D;'], rej: ['✕', 'Rejected', 'अस्वीकृत', 'background:#E5E7EB;color:#1F2937;'], pass: ['✓', 'Evidence passed the checks', 'प्रमाण जाँच में पास', 'background:#DCFCE7;color:#14532D;'], cont: ['≠', 'Contested', 'विवादित', 'background:#EDE9FE;color:#4C1D95;'] };

get D() {
  const l = this.state.lang; const items = this.state.items || []; const now = Date.now();
  const nm = (o) => (o ? (o[l] || o.en || '') : '');
  const age = (iso) => { const m = Math.max(0, Math.round((now - new Date(iso).getTime()) / 60000)); const d = Math.floor(m / 1440), h = Math.floor((m % 1440) / 60); return d ? d + ' d' + (h ? ' ' + h + ' h' : '') : h ? h + ' h' : m + ' min'; };
  return items.map((c) => {
    const open = ['CLOSED_CONFIRMED', 'CLOSED_UNCONFIRMED', 'REJECTED_NOT_CIVIC'].indexOf(c.status) < 0;
    const hours = c.resolvedAt ? Math.round((new Date(c.resolvedAt) - new Date(c.createdAt)) / 3600000) : null;
    const pr = c.proof || {};
    return [c.code, c.status, c.priority, !!c.slaBreached && open, nm(c.category.names), nm(c.category.l1Names), nm(c.location.area && c.location.area.name) || '–', nm(c.location.city && c.location.city.name), nm(c.department && c.department.agency), age(c.createdAt),
      (c.closeRequest && c.closeRequest.status) || 'none', String(c.phoneMasked || '').replace(/X/g, '•'), c.reopenCount || 0, c.reportCount || 1, pr.verdict || '', pr.submissions || 0, pr.contractSource || '', false, hours, c.location.lat, c.location.lng, c.id];
  });
}
async loadList() {
  try { const t0 = performance.now(); const r = await api('/api/complaints' + qs({ limit: 200, sort: 'created_desc' })); this.setState({ items: r.items, total: r.total, ms: Math.round(performance.now() - t0), bad: false }); }
  catch (e) { this.setState({ bad: true }); }
}
async loadDetail(row) {
  try { const d = await api('/api/complaints/' + row[21]); this.setState({ detail: d }); } catch (e) { this.setState({ detail: null }); }
}
CLOSED = ['CLOSED_CONFIRMED', 'CLOSED_UNCONFIRMED'];
PATH = ['SUBMITTED', 'VERIFIED', 'ASSIGNED', 'DISPATCHED', 'WORK_DONE_PENDING_CONFIRMATION'];

componentDidMount() { try { const l = localStorage.getItem('gov.lang'); if (l === 'hi' || l === 'en') this.setState({ lang: l });  } catch (e) {} this.loadList(); this._li = setInterval(() => { if (!document.hidden) this.loadList(); }, 15000); setTimeout(() => this.initMap(), 300); }
componentWillUnmount() { clearInterval(this._li); }
setLang(l) { try { localStorage.setItem('gov.lang', l); } catch (e) {} this.setState({ lang: l }); }
setRole(r) { switchRole(r); window.location.reload(); }
componentDidUpdate() { this.syncMap(); }
isOpen(r) { return this.CLOSED.indexOf(r[1]) < 0; }
inScope() { return true; } // the server already limits every list to the person's own area
rowsFor(s, ignoreQueue) {
return this.D.filter((r) => {
if (!this.inScope(r)) return false;
if (!ignoreQueue) { if (s.queue === 'open' && !this.isOpen(r)) return false; if (s.queue === 'over' && !(this.isOpen(r) && r[3])) return false; if (s.queue === 'wait' && r[1] !== 'WORK_DONE_PENDING_CONFIRMATION') return false; if (s.queue === 'reop' && r[1] !== 'REOPENED') return false; }
if (s.q) { const q = s.q.toLowerCase(); if (!(r[0].toLowerCase().indexOf(q) >= 0 || r[11].indexOf(q) >= 0 || r[4].toLowerCase().indexOf(q) >= 0)) return false; }
if (s.status === 'OPEN' ? !this.isOpen(r) : (s.status && r[1] !== s.status)) return false;
if (s.priority && r[2] !== s.priority) return false; if (s.verify && r[10] !== s.verify) return false;
if (s.district && s.district !== 'Durg') return false; if (s.state && s.state !== 'CG') return false;
if (s.city && r[7] !== s.city) return false; if (s.area && r[6] !== s.area) return false; if (s.dept && r[8] !== s.dept) return false; if (s.l1 && r[5] !== s.l1) return false; if (s.cat && r[4] !== s.cat) return false;
return true;
});
}
uniq(i) { const o = []; this.D.filter((r) => this.inScope(r)).forEach((r) => { if (o.indexOf(r[i]) < 0) o.push(r[i]); }); return o.sort(); }
statusStyle(st) { const m = { SUBMITTED: 'background:#DBEAFE;color:#1E3A8A;', VERIFIED: 'background:#DBEAFE;color:#1E3A8A;', NEEDS_TRIAGE: 'background:#FEF3C7;color:#78350F;', ASSIGNED: 'background:#E0E7FF;color:#312E81;', DISPATCHED: 'background:#E0E7FF;color:#312E81;', WORK_DONE_PENDING_CONFIRMATION: 'background:#CCFBF1;color:#134E4A;', CLOSED_CONFIRMED: 'background:#DCFCE7;color:#14532D;', CLOSED_UNCONFIRMED: 'background:#E5E7EB;color:#1F2937;', REOPENED: 'background:#FEE2E2;color:#7F1D1D;' }; return m[st] || 'background:#E5E7EB;color:#1F2937;'; }
priStyle(p) { return p === 'Critical' ? 'background:#991B1B;color:#fff;' : p === 'High' ? 'background:#FFEDD5;color:#7C2D12;' : p === 'Medium' ? 'background:#E5E7EB;color:#1F2937;' : 'background:#F3F4F6;color:#374151;border:1px solid #D1D5DB;'; }
ll(a, b) { return [a, b]; }
initMap() {
try { const el = document.getElementById('cmap'); if (!el || this._map || !window.L) return; const L = window.L; const map = L.map(el, { minZoom: 11, maxZoom: 18 });
L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19, attribution: '&copy; OpenStreetMap contributors' }).addTo(map);
map.setView([21.19, 81.35], 13); this._map = map; this._mapEl = el; this._key = ''; this._lg = L.layerGroup().addTo(map); map.on('zoomend', () => this.syncMap(true)); setTimeout(() => { try { map.invalidateSize(); } catch (e) {} this.syncMap(true); }, 200); } catch (e) {}
}
syncMap(force) {
try {
const L = window.L; const el = document.getElementById('cmap'); if (!L) return; if (!el) { this._map = null; this._mapEl = null; return; } if (!this._map || this._mapEl !== el) { this._map = null; this.initMap(); return; } const map = this._map;
const s = this.state; const rows = this.rowsFor(s, false); const key = JSON.stringify([rows.map((r) => r[0]), map.getZoom()]); if (!force && this._key === key) return; this._key = key;
if (this._heat) { map.removeLayer(this._heat); this._heat = null; } this._lg.clearLayers();
const z = map.getZoom();
if (z <= 11) { const by = {}; const pos = {}; rows.forEach((r) => { by[r[7]] = (by[r[7]] || 0) + 1; pos[r[7]] = pos[r[7]] || [r[19], r[20]]; });
Object.keys(by).forEach((c) => { L.marker(pos[c], { icon: L.divIcon({ html: '<span class="cnt">' + c + ' · ' + by[c] + '</span>', className: 'lw', iconSize: [0, 0] }) }).addTo(this._lg); }); }
else if (z <= 14) { if (L.heatLayer) this._heat = L.heatLayer(rows.map((r) => { const c = this.ll(r[19], r[20]); return [c[0], c[1], 0.9]; }), { radius: 38, blur: 30, maxZoom: 14, minOpacity: 0.35, gradient: { 0.25: '#FED976', 0.5: '#FD8D3C', 0.75: '#E31A1C', 1.0: '#800026' } }).addTo(map);
const by = {}; rows.forEach((r) => { by[r[6]] = by[r[6]] || { n: 0, p: this.ll(r[19], r[20]) }; by[r[6]].n++; });
Object.keys(by).forEach((a) => { L.marker(by[a].p, { icon: L.divIcon({ html: '<span class="cnt area">' + by[a].n + '</span>', className: 'lw', iconSize: [0, 0] }) }).bindTooltip(a).addTo(this._lg); }); }
else { rows.forEach((r) => { const c = this.ll(r[19], r[20]); const col = r[2] === 'Critical' ? '#7F1D1D' : r[2] === 'High' ? '#EA580C' : r[2] === 'Medium' ? '#4B5563' : '#9CA3AF'; L.circleMarker(c, { radius: 8, weight: r[3] ? 3 : 2, color: r[3] ? '#FACC15' : '#fff', fillColor: col, fillOpacity: 1 }).bindTooltip(r[0] + ' · ' + r[4]).on('click', () => this.openRow(r[0])).addTo(this._lg); }); }
this.setState({ zoomTxt: z <= 11 ? 'city' : z <= 14 ? 'heat' : 'points' });
} catch (e) {}
}
openRow(code) { this.setState({ sel: code, tab: 'details', detail: null }); const r = this.D.find((x) => x[0] === code); if (r) this.loadDetail(r); }
renderVals() {
const s = this.state; const l = s.lang; const t = this.T[l]; const L = l === 'hi' ? 1 : 0; const ro = this.ROLES[s.role] || Object.values(this.ROLES)[0]; const pr_ = (p) => pr[p]; const rc = ro[5];
const nav = this.NAVD.filter((n) => n[3].indexOf(rc) >= 0).map((n) => ({ href: n[0], label: n[1 + L], cls: n[0] === '/complaints' ? 'on' : '', cur: n[0] === '/complaints' ? 'page' : 'false' }));
const all = this.rowsFor(s, true); const rows = this.rowsFor(s, false); const st = this.ST[l], pr = this.PR[l], vf = this.VF[l];
const cnt = (fn) => all.filter(fn).length; const open = cnt((r) => this.isOpen(r)); const over = cnt((r) => this.isOpen(r) && r[3]);
const fin = all.filter((r) => ['CLOSED_CONFIRMED', 'CLOSED_UNCONFIRMED', 'REOPENED'].indexOf(r[1]) >= 0).length; const ok = all.filter((r) => r[1] === 'CLOSED_CONFIRMED').length; const reo = all.filter((r) => r[1] === 'REOPENED').length;
const hrs = all.filter((r) => r[18] !== null); const avg = hrs.length ? Math.round(hrs.reduce((a, r) => a + r[18], 0) / hrs.length) : 0;
const kpis = [{ label: t.k_received, n: all.length, hint: t.h_received }, { label: t.k_open, n: open, hint: t.h_open }, { label: t.k_await, n: cnt((r) => r[1] === 'WORK_DONE_PENDING_CONFIRMATION'), hint: t.h_await }, { label: t.k_resolved, n: cnt((r) => this.CLOSED.indexOf(r[1]) >= 0), hint: t.h_resolved }, { label: t.k_sla, n: open ? Math.round(over / open * 100) + '%' : '–', hint: t.h_sla, style: 'color:#B91C1C;' }, { label: t.k_reop, n: fin ? Math.round(reo / fin * 100) + '%' : '–', hint: t.h_reop }, { label: t.k_fix, n: fin ? Math.round(ok / fin * 100) + '%' : '–', hint: t.h_fix }, { label: t.k_hours, n: avg + ' h', hint: t.h_hours }];
const qs = [['all', t.q_all, all.length], ['open', t.q_open, open], ['over', t.q_over, over], ['wait', t.q_wait, cnt((r) => r[1] === 'WORK_DONE_PENDING_CONFIRMATION')], ['reop', t.q_reop, reo]].map((q) => ({ label: q[1], n: q[2], on: s.queue === q[0], style: s.queue === q[0] ? 'background:#1D4ED8;color:#fff;border-color:#1D4ED8;' : '', pick: () => this.setState({ queue: q[0] }) }));
let sorted = rows.slice(); if (s.sort === 'old') sorted = sorted.reverse(); else if (s.sort === 'pri') { const o = { Critical: 0, High: 1, Medium: 2, Low: 3 }; sorted.sort((a, b) => o[a[2]] - o[b[2]]); }
const toRow = (r) => ({ code: r[0], cat: r[4], l1: r[5], area: r[6], city: r[7], dept: r[8], age: r[9], synthetic: r[17], statusText: st[r[1]], statusStyle: this.statusStyle(r[1]), priText: pr[r[2]], priStyle: this.priStyle(r[2]), over: r[3] && this.isOpen(r), verifyText: vf[r[10]], phone: r[11], phoneFull: s.shown[r[0] + ':0'] || r[11], revealed: !!s.shown[r[0] + ':0'], masked: !s.shown[r[0] + ':0'], cls: s.sel === r[0] ? 'on' : '',
open: (e) => { if (e && e.preventDefault) e.preventDefault(); this.openRow(r[0]); }, ask: (e) => { if (e && e.stopPropagation) e.stopPropagation(); this.setState({ modal: 'phone', rrow: r[0], ridx: 0, reason: '' }); }, hide: (e) => { if (e && e.stopPropagation) e.stopPropagation(); const sh = Object.assign({}, this.state.shown); delete sh[r[0] + ':0']; this.setState({ shown: sh }); } });
let groups; const gi = { area: 6, dept: 8, l1: 5, city: 7, district: 7, state: 7 }[s.groupBy];
if (s.groupBy === 'none') groups = [{ showHead: false, name: '', countText: '', rows: sorted.map(toRow) }];
else { const keys = []; sorted.forEach((r) => { const k = s.groupBy === 'state' ? 'Chhattisgarh' : s.groupBy === 'district' ? 'Durg district' : r[gi]; if (keys.indexOf(k) < 0) keys.push(k); }); groups = keys.map((k) => { const rr = sorted.filter((r) => (s.groupBy === 'state' ? 'Chhattisgarh' : s.groupBy === 'district' ? 'Durg district' : r[gi]) === k); return { showHead: true, name: k, countText: rr.length + ' ' + t.count, rows: rr.map(toRow) }; }); }
// drawer
const r = s.sel ? this.D.find((x) => x[0] === s.sel) : null; let d = null; const det = s.detail && r && s.detail.complaint && s.detail.complaint.code === r[0] ? s.detail : null;
if (r) {
const status = r[1]; const closed = this.CLOSED.indexOf(status) >= 0; const cr = det ? det.closeRequest : null; const vkey = cr && cr.status ? cr.status : r[10];
const fmtT = (iso) => (iso ? new Date(iso).toLocaleString(l === 'hi' ? 'hi-IN' : 'en-IN', { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit', timeZone: 'Asia/Kolkata' }) : '–');
const comp = det ? det.complaint : null; const loc = comp ? comp.location : null;
const nameOf = (o) => (o ? (o[l] || o.en || '') : '');
const timeline = det ? det.timeline.filter((e) => e.fromState !== e.toState || e.type === 'REPORT_CREATED' || e.type === 'CLOSE_REQUESTED_BY_GOV').map((e) => ({ when: fmtT(e.at), text: e.type === 'CLOSE_REQUESTED_BY_GOV' ? t.close_title : (e.type === 'REPORT_CREATED' ? st.SUBMITTED : (st[e.toState] || e.type)), who: e.official || (e.actor === 'CITIZEN' ? 'Citizen' : e.actor === 'SYSTEM' ? 'System' : r[8]) })) : [];
const reporters = det && comp ? comp.reporters.map((q, i) => { const k = r[0] + ':' + q.index; const shown = s.shown[k]; return { label: (L ? 'शिकायतकर्ता ' : 'Reporter ') + (i + 1), shown: shown ? shown : String(q.phoneMasked || '').replace(/X/g, '•'), masked: !shown, revealed: !!shown, ask: () => this.setState({ modal: 'phone', rrow: r[0], ridx: q.index, reason: '', revealErr: '' }), hide: () => { const sh = Object.assign({}, this.state.shown); delete sh[k]; this.setState({ shown: sh }); } }; }) : [];
const pr = det && det.proof ? det.proof : null; const vd = pr && pr.verdict ? this.VERD[this.VCODE[pr.verdict]] : null; const warn = !!pr && pr.verdict !== 'EVIDENCE_PASSED';
const canAsk = !!(cr && cr.canRequest); const blockedReason = cr && cr.reason === 'TOO_SOON' ? (L ? 'अनुरोध पहले भेजा जा चुका है। 24 घंटे बाद दोबारा भेज सकते हैं।' : 'A request was already sent. You can send another after 24 hours.') : (L ? 'केवल तब उपलब्ध जब काम पूर्ण दिखे।' : 'Available only when the work is marked done.');
d = { code: r[0], statusText: st[status], statusStyle: this.statusStyle(status), priText: pr_(r[2]), priStyle: this.priStyle(r[2]), over: r[3] && !closed, esc: comp ? comp.escalationLevel > 0 : false, escText: (L ? 'एस्केलेशन स्तर ' : 'Escalation level ') + (comp ? comp.escalationLevel : 0), merged: r[13] > 1, mergedText: r[13] + (L ? ' शिकायतें जुड़ी हैं' : ' reports merged'),
summary: comp ? comp.summary : '…', cat: r[4], l1: r[5], dept: r[8], where: loc ? [nameOf(loc.state && loc.state.name), nameOf(loc.district && loc.district.name), nameOf(loc.city && loc.city.name), nameOf(loc.area && loc.area.name)].filter(Boolean).join(' › ') : '', coords: Number(r[19]).toFixed(5) + ' N, ' + Number(r[20]).toFixed(5) + ' E', sla: comp ? fmtT(comp.slaDueAt) + (comp.slaBreached && !closed ? (L ? ' (समय-सीमा पार)' : ' (overdue)') : '') : '', received: comp ? fmtT(comp.createdAt) : '', age: r[9],
langText: comp ? (comp.originalLang === 'hi' ? 'हिन्दी' : comp.originalLang === 'en' ? 'English' : String(comp.originalLang || '').toUpperCase()) : '', langCode: comp ? comp.originalLang : 'en', original: comp ? (comp.originalText || '') : '', timeline, reporters, verifyText: vf[vkey] || vf.none,
hasProof: !!pr, noProof: !pr, claim: pr && pr.claim ? pr.claim : '', cText: pr ? (pr.contractSource === 'gemini' ? 'Gemini' : (L ? 'टेम्पलेट (AI अनुपलब्ध)' : 'Template (AI unavailable)')) : '', cStyle: pr && pr.contractSource === 'gemini' ? 'background:#DBEAFE;color:#1E3A8A;' : 'background:#FEF3C7;color:#78350F;', hash: pr && pr.sha256 ? pr.sha256.slice(0, 6) + '…' + pr.sha256.slice(-6) : '',
vSym: vd ? vd[0] : '', vText: vd ? vd[1 + L] : '', vStyle: vd ? vd[3] : '', proofs: pr ? pr.submissions : 0, warn, blocked: !canAsk, blockedText: blockedReason,
history: cr && cr.history && cr.history.length ? cr.history.map((h) => fmtT(h.at) + ' · ' + h.official).join('; ') : (L ? 'अभी तक कोई नहीं' : 'None yet') };
}
const noteCount = s.note.length; const mapBoxW = s.view === 'map' ? 'flex: 1 1 0;' : 'flex: 0 0 560px;';
const on = (k) => (e) => this.setState({ [k]: e.target.value });
return {
t, nav, role: s.role, roleOpts: Object.keys(this.ROLES).map((k) => ({ v: k, l: this.ROLES[k][3 + L] })), onRole: (e) => this.setRole(e.target.value), isEn: l === 'en', isHi: l === 'hi', setEn: () => this.setLang('en'), setHi: () => this.setLang('hi'), user: ro[0], scope: ro[1 + L],
kpis, queues: qs, groups, empty: rows.length === 0, countText: rows.length + ' ' + t.count,
q: s.q, status: s.status, priority: s.priority, verify: s.verify, state: s.state, district: s.district, city: s.city, area: s.area, dept: s.dept, l1: s.l1, cat: s.cat, from: s.from, to: s.to, groupBy: s.groupBy, sort: s.sort,
onQ: on('q'), onStatus: on('status'), onPriority: on('priority'), onVerify: on('verify'), onState: on('state'), onDistrict: on('district'), onCity: on('city'), onArea: on('area'), onDept: on('dept'), onL1: on('l1'), onCat: on('cat'), onFrom: on('from'), onTo: on('to'), onGroup: on('groupBy'), onSort: on('sort'),
statusOpts: ['OPEN', 'SUBMITTED', 'VERIFIED', 'NEEDS_TRIAGE', 'ASSIGNED', 'DISPATCHED', 'WORK_DONE_PENDING_CONFIRMATION', 'CLOSED_CONFIRMED', 'CLOSED_UNCONFIRMED', 'REOPENED'].map((v) => ({ v, l: v === 'OPEN' ? (L ? 'सभी खुली' : 'All open') : st[v] })), priorityOpts: ['Critical', 'High', 'Medium', 'Low'].map((v) => ({ v, l: pr[v] })), verifyOpts: ['requested', 'confirmed', 'reopened', 'unconfirmed', 'none'].map((v) => ({ v, l: vf[v] })),
areaOpts: this.uniq(6), deptOpts: this.uniq(8), l1Opts: this.uniq(5), catOpts: this.uniq(4), groupOpts: [['none', t.g_none], ['state', t.g_state], ['district', t.g_district], ['city', t.g_city], ['area', t.g_area], ['dept', t.g_dept], ['l1', t.g_l1]].map((a) => ({ v: a[0], l: a[1] })),
more: s.more, moreLabel: s.more ? t.less : t.more, toggleMore: () => this.setState({ more: !this.state.more }),
clear: () => this.setState({ q: '', status: '', priority: '', verify: '', state: '', district: '', city: '', area: '', dept: '', l1: '', cat: '', from: '', to: '', groupBy: 'none', queue: 'all' }),
doExport: async () => { try { await download('/api/export.csv' + qs({ q: s.q || undefined }), 'nyaysetu-complaints.csv'); this.setState({ toast: t.exported }); } catch (e) { this.setState({ toast: l === 'hi' ? 'फ़ाइल डाउनलोड नहीं हो सकी।' : 'The file could not be downloaded.' }); } setTimeout(() => this.setState({ toast: '' }), 4500); }, toast: s.toast,
vSplit: s.view === 'split', vTable: s.view === 'table', vMap: s.view === 'map', setSplit: () => this.setState({ view: 'split' }), setTable: () => this.setState({ view: 'table' }), setMap: () => this.setState({ view: 'map' }),
showTable: s.view !== 'map', showMap: s.view !== 'table', mapBox: 'background:#fff;border:1px solid #D1D5DB;border-radius:8px;overflow:hidden;' + mapBoxW,
zoomLevelText: s.zoomTxt === 'city' ? (L ? 'स्तर: शहर' : 'Level: cities') : s.zoomTxt === 'points' ? (L ? 'स्तर: हर शिकायत' : 'Level: each complaint') : (L ? 'स्तर: हीट और क्षेत्र' : 'Level: heat and areas'),
drawer: !!r, d, closeDrawer: () => this.setState({ sel: '' }), tabDetails: s.tab === 'details', tabProof: s.tab === 'proof', showDetails: () => this.setState({ tab: 'details' }), showProof: () => this.setState({ tab: 'proof' }),
copyLabel: s.copied ? (L ? 'कॉपी हुआ' : 'Copied') : (L ? 'ID कॉपी करें' : 'Copy ID'), copy: () => { try { navigator.clipboard.writeText(s.sel); } catch (e) {} this.setState({ copied: true }); setTimeout(() => this.setState({ copied: false }), 1500); },
verifyHash: () => this.setState({ hashOk: true }), hashOk: s.hashOk, revealCount: s.revealN, openCourt: () => { try { const row = this.D.find((x) => x[0] === s.sel); sessionStorage.setItem('gov.court', JSON.stringify({ code: s.sel, id: row ? row[21] : '' })); } catch (e) {} },
revealErr: s.revealErr, bad: s.bad, ms: s.ms, modalPhone: s.modal === 'phone', modalAsk: s.modal === 'ask', closeModal: () => this.setState({ modal: '' }), reason: s.reason, onReason: (e) => this.setState({ reason: e.target.value }), reasonBad: s.reason.trim().length < 3,
confirmReveal: async () => { const st0 = this.state; if (st0.reason.trim().length < 3) return; const row = this.D.find((x) => x[0] === st0.rrow); if (!row) return; try { const r1 = await api('/api/complaints/' + row[21] + '/reveal-phone', { method: 'POST', body: { reporterIndex: st0.ridx, reason: st0.reason.trim() } }); const k = st0.rrow + ':' + st0.ridx; const sh = Object.assign({}, this.state.shown); sh[k] = r1.phone; this.setState({ shown: sh, modal: '', reason: '', revealN: this.state.revealN + 1, revealErr: '' }); setTimeout(() => { const s2 = Object.assign({}, this.state.shown); delete s2[k]; this.setState({ shown: s2 }); }, 30000); } catch (e) { this.setState({ revealErr: e.code === 'REVEAL_LIMIT' ? (l === 'hi' ? 'इस घंटे की सीमा (30) पूरी हो गई।' : 'You have reached the limit of 30 numbers this hour.') : e.code === 'PHONE_ERASED' ? (l === 'hi' ? 'यह नंबर अवधारण अवधि के बाद हटा दिया गया।' : 'This number was deleted after the retention period.') : (l === 'hi' ? 'नंबर नहीं दिखाया जा सका।' : 'The number could not be shown.') }); } },
openAsk: () => this.setState({ modal: 'ask', note: '' }), note: s.note, noteCount, onNote: (e) => this.setState({ note: e.target.value.slice(0, 300) }),
sendAsk: async () => { const st0 = this.state; const row = this.D.find((x) => x[0] === st0.sel); if (!row) return; try { await api('/api/complaints/' + row[21] + '/close-request', { method: 'POST', body: st0.note.trim() ? { note: st0.note.trim() } : {} }); this.setState({ modal: '', note: '', toast: t.sent_ok }); this.loadDetail(row); this.loadList(); } catch (e) { this.setState({ modal: '', toast: e.code === 'TOO_SOON' ? (l === 'hi' ? 'पिछले 24 घंटे में अनुरोध भेजा जा चुका है।' : 'A request was already sent in the last 24 hours.') : e.code === 'WRONG_STATE' ? (l === 'hi' ? 'काम पूर्ण नहीं दिखता, इसलिए अभी पुष्टि नहीं माँगी जा सकती।' : 'The work is not marked done yet.') : (l === 'hi' ? 'अनुरोध नहीं भेजा जा सका। फिर कोशिश करें।' : 'The request could not be sent. Nothing was changed. Try again.') }); } setTimeout(() => this.setState({ toast: '' }), 5000); }
};
}
}

ComplaintsLogic.prototype.view = function view(__v) {
  const { revealErr, bad, ms, area, areaOpts, cat, catOpts, city, clear, closeDrawer, closeModal, confirmReveal, copy, copyLabel, countText, d, dept, deptOpts, district, doExport, drawer, e, empty, from, g, groupBy, groupOpts, groups, hashOk, isEn, isHi, k, kpis, l1, l1Opts, mapBox, modalAsk, modalPhone, more, moreLabel, n, nav, note, noteCount, o, onArea, onCat, onCity, onDept, onDistrict, onFrom, onGroup, onL1, onNote, onPriority, onQ, onReason, onRole, onSort, onState, onStatus, onTo, onVerify, openAsk, openCourt, p, priority, priorityOpts, q, queues, r, reason, reasonBad, revealCount, role, roleOpts, scope, sendAsk, setEn, setHi, setMap, setSplit, setTable, showDetails, showMap, showProof, showTable, sort, state, status, statusOpts, t, tabDetails, tabProof, to, toast, toggleMore, user, vMap, vSplit, vTable, verify, verifyHash, verifyOpts, zoomLevelText } = __v;
  return (
    <div className="sc-complaints" style={{ position: "relative", width: "100%", minHeight: "100vh", display: "flex", flexDirection: "column", background: "#FFFFFF", color: "#111827", fontFamily: "'Noto Sans','Noto Sans Devanagari',system-ui,sans-serif", fontSize: "14px", lineHeight: "1.4" }}>
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
      {!!bad && (<div role="alert" style={{ margin: "8px 20px 0", padding: "8px 12px", background: "#FEF3C7", border: "1px solid #F59E0B", borderRadius: "6px", color: "#78350F", fontWeight: "600" }}>{isHi ? "शिकायतों की सूची अभी लोड नहीं हो सकी।" : "The complaints list could not be loaded."}</div>)}
      <main style={{ width: "100%", maxWidth: "1560px", margin: "0 auto", padding: "12px 20px 20px", display: "flex", flexDirection: "column", gap: "10px" }}>
        <section aria-label="KPI" style={{ display: "grid", gridTemplateColumns: "repeat(8, minmax(0, 1fr))", gap: "8px" }}>
          {kpis.map((k, __i) => (
            <React.Fragment key={__i}>
            <div className="q">
              <span style={{ fontWeight: "700", color: "#111827", fontSize: "12.5px" }}>
                {k.label}
              </span>
              <b style={css(k.style)}>
                {k.n}
              </b>
              <span>
                {k.hint}
              </span>
            </div>
            </React.Fragment>
          ))}
        </section>
        <section aria-label="Filters" style={{ background: "#fff", border: "0", borderTop: "3px solid #1F2937", borderRadius: "0", padding: "10px 14px", display: "flex", flexDirection: "column", gap: "8px" }}>
          <div style={{ display: "grid", gridTemplateColumns: "minmax(0, 2.4fr) repeat(4, minmax(0, 1fr)) auto", gap: "10px", alignItems: "end" }}>
            <label className="field">
              {t.f_search}
              <input type="search" value={q} placeholder="BHI-26-004812 \u00b7 3221" onChange={onQ} />
            </label>
            <label className="field">
              {t.f_status}
              <select value={status} onChange={onStatus}>
                <option value="">
                  {t.all}
                </option>
                {statusOpts.map((o, __i) => (
                  <React.Fragment key={__i}>
                  <option value={o.v}>
                    {o.l}
                  </option>
                  </React.Fragment>
                ))}
              </select>
            </label>
            <label className="field">
              {t.f_priority}
              <select value={priority} onChange={onPriority}>
                <option value="">
                  {t.all}
                </option>
                {priorityOpts.map((o, __i) => (
                  <React.Fragment key={__i}>
                  <option value={o.v}>
                    {o.l}
                  </option>
                  </React.Fragment>
                ))}
              </select>
            </label>
            <label className="field">
              {t.f_verify}
              <select value={verify} onChange={onVerify}>
                <option value="">
                  {t.all}
                </option>
                {verifyOpts.map((o, __i) => (
                  <React.Fragment key={__i}>
                  <option value={o.v}>
                    {o.l}
                  </option>
                  </React.Fragment>
                ))}
              </select>
            </label>
            <label className="field">
              {t.f_group}
              <select value={groupBy} onChange={onGroup}>
                {groupOpts.map((o, __i) => (
                  <React.Fragment key={__i}>
                  <option value={o.v}>
                    {o.l}
                  </option>
                  </React.Fragment>
                ))}
              </select>
            </label>
            <span style={{ display: "flex", gap: "8px" }}>
              <button type="button" className="btn" onClick={toggleMore}>
                {moreLabel}
              </button>
              <button type="button" className="btn" onClick={clear}>
                {t.f_clear}
              </button>
              <button type="button" className="btn" onClick={doExport}>
                {t.export}
              </button>
            </span>
          </div>
          {!!(more) && (
            <>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(8, minmax(0, 1fr))", gap: "10px", paddingTop: "8px", borderTop: "1px solid #E5E7EB" }}>
              <label className="field">
                {t.f_state}
                <select value={state} onChange={onState}>
                  <option value="">
                    {t.all}
                  </option>
                  <option value="CG">
                    Chhattisgarh
                  </option>
                </select>
              </label>
              <label className="field">
                {t.f_district}
                <select value={district} onChange={onDistrict}>
                  <option value="">
                    {t.all}
                  </option>
                  <option value="Durg">
                    Durg
                  </option>
                </select>
              </label>
              <label className="field">
                {t.f_city}
                <select value={city} onChange={onCity}>
                  <option value="">
                    {t.all}
                  </option>
                  <option value="Bhilai">
                    Bhilai
                  </option>
                  <option value="Durg">
                    Durg
                  </option>
                </select>
              </label>
              <label className="field">
                {t.f_area}
                <select value={area} onChange={onArea}>
                  <option value="">
                    {t.all}
                  </option>
                  {areaOpts.map((o, __i) => (
                    <React.Fragment key={__i}>
                    <option value={o}>
                      {o}
                    </option>
                    </React.Fragment>
                  ))}
                </select>
              </label>
              <label className="field">
                {t.f_dept}
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
                {t.f_catgroup}
                <select value={l1} onChange={onL1}>
                  <option value="">
                    {t.all}
                  </option>
                  {l1Opts.map((o, __i) => (
                    <React.Fragment key={__i}>
                    <option value={o}>
                      {o}
                    </option>
                    </React.Fragment>
                  ))}
                </select>
              </label>
              <label className="field">
                {t.f_cat}
                <select value={cat} onChange={onCat}>
                  <option value="">
                    {t.all}
                  </option>
                  {catOpts.map((o, __i) => (
                    <React.Fragment key={__i}>
                    <option value={o}>
                      {o}
                    </option>
                    </React.Fragment>
                  ))}
                </select>
              </label>
              <span style={{ display: "flex", gap: "6px" }}>
                <label className="field">
                  {t.f_from}
                  <input type="date" value={from} onChange={onFrom} />
                </label>
                <label className="field">
                  {t.f_to}
                  <input type="date" value={to} onChange={onTo} />
                </label>
              </span>
            </div>
            </>
          )}
        </section>
        {!!(toast) && (
          <>
          <div role="status" style={{ padding: "8px 12px", background: "#DCFCE7", border: "1px solid #86EFAC", borderRadius: "6px", color: "#14532D", fontWeight: "600" }}>
            {toast}
          </div>
          </>
        )}
        <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
          <h1 style={{ margin: "0", fontSize: "20px" }}>
            {t.nav_complaints}
          </h1>
          <span style={{ color: "#4B5563" }}>
            {countText}
          </span>
          <span className="chip" style={{ background: "#E5E7EB", color: "#1F2937" }}>
            {t.scoped}: {scope}
          </span>
          <span style={{ flex: "1" }}>
          </span>
          <span className="seg" role="group" aria-label={t.view}>
            <button type="button" aria-pressed={vSplit} onClick={setSplit}>
              {t.v_split}
            </button>
            <button type="button" aria-pressed={vTable} onClick={setTable}>
              {t.v_table}
            </button>
            <button type="button" aria-pressed={vMap} onClick={setMap}>
              {t.v_map}
            </button>
          </span>
          <div style={{ display: "flex", gap: "6px", flexWrap: "wrap" }}>
            {queues.map((q, __i) => (
              <React.Fragment key={__i}>
              <button type="button" className="btn sm" aria-pressed={q.on} onClick={q.pick} style={css(q.style)}>
                {q.label} ({q.n})
              </button>
              </React.Fragment>
            ))}
          </div>
        </div>
        <div style={{ display: "flex", gap: "12px", alignItems: "flex-start" }}>
          {!!(showTable) && (
            <>
            <section style={{ flex: "1 1 0", minWidth: "0", background: "#fff", border: "0", borderTop: "3px solid #1F2937", borderRadius: "0", overflow: "hidden" }}>
              <div style={{ overflowX: "auto", maxHeight: "640px", overflowY: "auto" }}>
                <table>
                  <thead>
                    <tr>
                      <th scope="col">
                        {t.c_id}
                      </th>
                      <th scope="col">
                        {t.c_mobile}
                      </th>
                      <th scope="col">
                        {t.c_cat}
                      </th>
                      <th scope="col">
                        {t.c_area}
                      </th>
                      <th scope="col">
                        {t.c_dept}
                      </th>
                      <th scope="col">
                        {t.c_status}
                      </th>
                      <th scope="col">
                        {t.c_priority}
                      </th>
                      <th scope="col">
                        {t.c_age}
                      </th>
                      <th scope="col">
                        {t.c_verify}
                      </th>
                    </tr>
                  </thead>
                  {groups.map((g, __i) => (
                    <React.Fragment key={__i}>
                    <tbody>
                      {!!(g.showHead) && (
                        <>
                        <tr className="grp">
                          <td colspan="9">
                            {g.name} — {g.countText}
                          </td>
                        </tr>
                        </>
                      )}
                      {g.rows.map((r, __i) => (
                        <React.Fragment key={__i}>
                        <tr className={`row ${r.cls}`} onClick={r.open}>
                          <td style={{ whiteSpace: "nowrap" }}>
                            <a href="#" onClick={r.open} style={{ fontWeight: "700", fontFamily: "ui-monospace, Menlo, monospace" }}>
                              {r.code}
                            </a>
                            {!!(r.synthetic) && (
                              <>
                              <small style={{ color: "#78350F", fontWeight: "700" }}>
                                {t.gen_tag}
                              </small>
                              </>
                            )}
                          </td>
                          <td style={{ whiteSpace: "nowrap" }}>
                            {!!(r.revealed) && (
                              <>
                              <b>
                                {r.phoneFull}
                              </b>
                              <button type="button" className="btn sm" onClick={r.hide}>
                                {t.hide}
                              </button>
                              </>
                            )}
                            {!!(r.masked) && (
                              <>
                              <span>
                                {r.phone}
                              </span>
                              <button type="button" className="btn sm" onClick={r.ask}>
                                {t.show}
                              </button>
                              </>
                            )}
                          </td>
                          <td>
                            {r.cat}
                            <small>
                              {r.l1}
                            </small>
                          </td>
                          <td>
                            {r.area}
                            <small>
                              {r.city}
                            </small>
                          </td>
                          <td>
                            {r.dept}
                          </td>
                          <td>
                            <span className="chip" style={css(r.statusStyle)}>
                              {r.statusText}
                            </span>
                          </td>
                          <td>
                            <span className="chip" style={css(r.priStyle)}>
                              {r.priText}
                            </span>
                            {!!(r.over) && (
                              <>
                              <small style={{ color: "#B91C1C", fontWeight: "700" }}>
                                {t.overdue}
                              </small>
                              </>
                            )}
                          </td>
                          <td style={{ whiteSpace: "nowrap" }}>
                            {r.age}
                          </td>
                          <td>
                            {r.verifyText}
                          </td>
                        </tr>
                        </React.Fragment>
                      ))}
                    </tbody>
                    </React.Fragment>
                  ))}
                </table>
                {!!(empty) && (
                  <>
                  <div style={{ padding: "40px", textAlign: "center", color: "#4B5563" }}>
                    {t.empty}
                  </div>
                  </>
                )}
              </div>
              <div style={{ padding: "5px 12px", fontSize: "11px", color: "#4B5563", borderTop: "1px solid #F3F4F6", display: "flex", gap: "10px" }}>
                <span>
                  {t.src}: complaints · {ms} ms · {countText}
                </span>
                <span style={{ flex: "1" }}>
                </span>
                <span>
                  {t.sort}:
                </span>
                <select value={sort} onChange={onSort} style={{ height: "22px", fontSize: "12px" }}>
                  <option value="new">
                    {t.s_new}
                  </option>
                  <option value="old">
                    {t.s_old}
                  </option>
                  <option value="pri">
                    {t.s_pri}
                  </option>
                </select>
                <span>
                  {t.paging}
                </span>
              </div>
            </section>
            </>
          )}
          {!!(showMap) && (
            <>
            <section style={css(mapBox)} aria-label={t.v_map}>
              <div style={{ padding: "8px 12px", borderBottom: "1px solid #E5E7EB", display: "flex", alignItems: "center", gap: "8px" }}>
                <b>
                  {t.v_map}
                </b>
                <span style={{ flex: "1" }}>
                </span>
                <span className="chip" style={{ background: "#E5E7EB", color: "#1F2937" }}>
                  {zoomLevelText}
                </span>
              </div>
              <div style={{ position: "relative", isolation: "isolate", height: "560px", background: "#E5E7EB" }}>
                <div id="cmap" style={{ position: "absolute", inset: "0" }}>
                </div>
                <div style={{ position: "absolute", left: "8px", bottom: "8px", zIndex: "1000", background: "rgba(255,255,255,.93)", border: "1px solid #9CA3AF", borderRadius: "6px", padding: "5px 8px", fontSize: "11.5px", lineHeight: "1.45", maxWidth: "330px" }}>
                  {t.map_levels}
                  <br />
                  <b>
                    {t.approx}
                  </b>
                </div>
              </div>
              <div style={{ padding: "5px 12px", fontSize: "11px", color: "#4B5563", borderTop: "1px solid #F3F4F6" }}>
                {t.src}: complaints (map) · {t.map_note}
              </div>
            </section>
            </>
          )}
        </div>
      </main>
      <footer style={{ padding: "10px 20px", fontSize: "12px", color: "#4B5563", borderTop: "1px solid #D1D5DB", background: "#fff", marginTop: "auto" }}>
        {t.proto}
      </footer>
      {!!(drawer) && (
        <>
        <div className="scrim" onClick={closeDrawer}>
        </div>
        <aside className="drawer" role="dialog" aria-modal="true" aria-label={d.code}>
          <div style={{ padding: "12px 16px", borderBottom: "1px solid #D1D5DB", display: "flex", flexDirection: "column", gap: "6px" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
              <b style={{ fontFamily: "ui-monospace, Menlo, monospace", fontSize: "20px" }}>
                {d.code}
              </b>
              <button type="button" className="btn sm" onClick={copy}>
                {copyLabel}
              </button>
              <span style={{ flex: "1" }}>
              </span>
              <button type="button" className="btn sm" onClick={closeDrawer} aria-label={t.close}>
                ✕ {t.close}
              </button>
            </div>
            <div style={{ display: "flex", gap: "6px", flexWrap: "wrap" }}>
              <span className="chip" style={css(d.statusStyle)}>
                {d.statusText}
              </span>
              <span className="chip" style={css(d.priStyle)}>
                {d.priText}
              </span>
              {!!(d.over) && (
                <>
                <span className="chip" style={{ background: "#FEE2E2", color: "#7F1D1D" }}>
                  {t.overdue}
                </span>
                </>
              )}
              {!!(d.esc) && (
                <>
                <span className="chip" style={{ background: "#FEF3C7", color: "#78350F" }}>
                  {d.escText}
                </span>
                </>
              )}
              {!!(d.merged) && (
                <>
                <span className="chip" style={{ background: "#E5E7EB", color: "#1F2937" }}>
                  {d.mergedText}
                </span>
                </>
              )}
            </div>
            <span className="seg" role="group" aria-label={t.d_tabs} style={{ alignSelf: "flex-start" }}>
              <button type="button" aria-pressed={tabDetails} onClick={showDetails}>
                {t.d_details}
              </button>
              <button type="button" aria-pressed={tabProof} onClick={showProof}>
                {t.d_proof}
              </button>
            </span>
          </div>
          <div style={{ flex: "1", minHeight: "0", overflow: "auto", padding: "12px 16px", display: "flex", flexDirection: "column", gap: "10px" }}>
            {!!(tabDetails) && (
              <>
              <div className="sec">
                <h3>
                  {t.d_summary}
                </h3>
                <div style={{ fontSize: "15px" }}>
                  {d.summary}
                </div>
                <dl className="kv">
                  <dt>
                    {t.c_cat}
                  </dt>
                  <dd>
                    {d.cat} ({d.l1})
                  </dd>
                  <dt>
                    {t.c_dept}
                  </dt>
                  <dd>
                    {d.dept}
                  </dd>
                  <dt>
                    {t.d_location}
                  </dt>
                  <dd>
                    {d.where}
                    <small style={{ display: "block", color: "#4B5563" }}>
                      {d.coords} · {t.approx}
                    </small>
                  </dd>
                  <dt>
                    {t.d_sla}
                  </dt>
                  <dd>
                    {d.sla}
                  </dd>
                  <dt>
                    {t.d_received}
                  </dt>
                  <dd>
                    {d.received} · {t.c_age}: {d.age}
                  </dd>
                </dl>
              </div>
              <div className="sec">
                <h3>
                  {t.d_words}{' '}
                  <span className="chip" style={{ background: "#E5E7EB", color: "#1F2937" }}>
                    {d.langText}
                  </span>
                </h3>
                <div lang={d.langCode} style={{ fontSize: "16px", padding: "8px 10px", background: "#F9FAFB", borderRadius: "6px" }}>
                  {d.original}
                </div>
              </div>
              <div className="sec">
                <h3>
                  {t.d_reporters}
                </h3>
                {d.reporters.map((p, __i) => (
                  <React.Fragment key={__i}>
                  <div style={{ display: "flex", alignItems: "center", gap: "8px", padding: "3px 0" }}>
                    <span style={{ minWidth: "90px", color: "#4B5563" }}>
                      {p.label}
                    </span>
                    <span style={{ flex: "1", fontWeight: "600" }}>
                      {p.shown}
                    </span>
                    {!!(p.masked) && (
                      <>
                      <button type="button" className="btn sm" onClick={p.ask}>
                        {t.show}
                      </button>
                      </>
                    )}
                    {!!(p.revealed) && (
                      <>
                      <a href="#call" className="btn sm">
                        {t.call}
                      </a>
                      <button type="button" className="btn sm" onClick={p.hide}>
                        {t.hide}
                      </button>
                      </>
                    )}
                  </div>
                  </React.Fragment>
                ))}
                <span style={{ fontSize: "12px", color: "#4B5563" }}>
                  {t.reveal_note} {revealCount} / 30.
                </span>
              </div>
              <div className="sec">
                <h3>
                  {t.d_timeline}
                </h3>
                <ol className="tl">
                  {d.timeline.map((e, __i) => (
                    <React.Fragment key={__i}>
                    <li style={{ display: "grid", gridTemplateColumns: "104px 1fr", gap: "8px", fontSize: "13px" }}>
                      <span style={{ color: "#4B5563" }}>
                        {e.when}
                      </span>
                      <span>
                        <b>
                          {e.text}
                        </b>
                        <span style={{ display: "block", color: "#4B5563", fontSize: "12px" }}>
                          {e.who}
                        </span>
                      </span>
                    </li>
                    </React.Fragment>
                  ))}
                </ol>
              </div>
              </>
            )}
            {!!(tabProof) && (
              <>
              {!!(d.hasProof) && (
                <>
                <div className="sec">
                  <h3>
                    {t.d_contract}
                  </h3>
                  <div style={{ fontWeight: "700" }}>
                    {d.claim}
                  </div>
                  <dl className="kv">
                    <dt>
                      {t.source}
                    </dt>
                    <dd>
                      <span className="chip" style={css(d.cStyle)}>
                        {d.cText}
                      </span>
                    </dd>
                    <dt>
                      {t.hash}
                    </dt>
                    <dd style={{ fontFamily: "ui-monospace, Menlo, monospace", fontSize: "12px" }}>
                      {d.hash}{' '}
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
                    </dd>
                  </dl>
                </div>
                <div className="sec">
                  <h3>
                    {t.d_latest}
                  </h3>
                  <span className="chip" style={css(`${d.vStyle};font-size:14px;padding:3px 12px;`)}>
                    {d.vSym} {d.vText}
                  </span>
                  <div>
                    {d.proofs} {t.d_proofs}. {t.not_close}
                  </div>
                  <TLink to="/court" className="btn pri" onClick={openCourt} style={{ alignSelf: "flex-start" }}>
                    {t.open_court} →
                  </TLink>
                </div>
                </>
              )}
              {!!(d.noProof) && (
                <>
                <div className="sec">
                  <h3>
                    {t.d_contract}
                  </h3>
                  <div>
                    {t.no_proof}
                  </div>
                </div>
                </>
              )}
              </>
            )}
            <div className="sec" style={{ border: "2px solid #1D4ED8" }}>
              <h3 style={{ color: "#1E3A8A" }}>
                {t.close_title}
              </h3>
              <div>
                {t.c_verify}:{' '}
                <b>
                  {d.verifyText}
                </b>
              </div>
              {!!(d.hasProof) && (
                <>
                <div>
                  {t.latest_verdict}:{' '}
                  <span className="chip" style={css(d.vStyle)}>
                    {d.vSym} {d.vText}
                  </span>
                </div>
                </>
              )}
              {!!(d.warn) && (
                <>
                <div role="alert" style={{ padding: "7px 10px", background: "#FFFBEB", border: "1px solid #F59E0B", borderRadius: "6px", fontWeight: "600", color: "#78350F" }}>
                  {t.warn}
                </div>
                </>
              )}
              <div style={{ fontSize: "12.5px", color: "#374151" }}>
                {t.close_help}
              </div>
              <div>
                <button type="button" className="btn pri" disabled={d.blocked} onClick={openAsk}>
                  {t.close_button}
                </button>
              </div>
              {!!(d.blocked) && (
                <>
                <div style={{ fontSize: "12.5px", color: "#4B5563" }}>
                  {d.blockedText}
                </div>
                </>
              )}
              <div style={{ fontSize: "12.5px" }}>
                <b>
                  {t.close_history}
                </b>
                : {d.history}
              </div>
            </div>
          </div>
        </aside>
        </>
      )}
      {!!(modalPhone) && (
        <>
        <div className="modal-bg" onClick={closeModal}>
        </div>
        <div className="modal" role="dialog" aria-modal="true" aria-label={t.m_title}>
          <h2 style={{ margin: "0", fontSize: "19px" }}>
            {t.m_title}
          </h2>
          <p style={{ margin: "0" }}>
            {t.m_warn}
          </p>
          <label className="field">
            {t.m_reason}
            <input type="text" value={reason} onChange={onReason} maxLength="200" />
          </label>
          <div style={{ display: "flex", gap: "10px", justifyContent: "flex-end" }}>
            <button type="button" className="btn" onClick={closeModal}>
              {t.cancel}
            </button>
            {!!revealErr && (<div role="alert" style={{ color: "#7F1D1D", fontWeight: "600", marginTop: "8px" }}>{revealErr}</div>)}
            <button type="button" className="btn pri" disabled={reasonBad} onClick={confirmReveal}>
              {t.show}
            </button>
          </div>
        </div>
        </>
      )}
      {!!(modalAsk) && (
        <>
        <div className="modal-bg" onClick={closeModal}>
        </div>
        <div className="modal" role="dialog" aria-modal="true" aria-label={t.close_title}>
          <h2 style={{ margin: "0", fontSize: "19px" }}>
            {t.close_title}
          </h2>
          {!!(d.hasProof) && (
            <>
            <div style={{ padding: "8px 10px", border: "1px solid #D1D5DB", borderRadius: "6px" }}>
              {t.latest_verdict}:{' '}
              <span className="chip" style={css(d.vStyle)}>
                {d.vSym} {d.vText}
              </span>
            </div>
            </>
          )}
          {!!(d.warn) && (
            <>
            <div role="alert" style={{ padding: "7px 10px", background: "#FFFBEB", border: "1px solid #F59E0B", borderRadius: "6px", fontWeight: "600", color: "#78350F" }}>
              {t.warn} {t.can_proceed}
            </div>
            </>
          )}
          <p style={{ margin: "0" }}>
            {t.close_help}
          </p>
          <label className="field">
            {t.close_note}
            <textarea rows="4" maxLength="300" value={note} onChange={onNote}>
            </textarea>
            <span style={{ alignSelf: "flex-end", fontWeight: "400" }}>
              {noteCount}/300
            </span>
          </label>
          <div style={{ display: "flex", gap: "10px", justifyContent: "flex-end" }}>
            <button type="button" className="btn" onClick={closeModal}>
              {t.cancel}
            </button>
            <button type="button" className="btn pri" onClick={sendAsk}>
              {t.close_send}
            </button>
          </div>
        </div>
        </>
      )}
      <TLink id="goCourt" to="/court" tabIndex="-1" aria-hidden="true" style={{ display: "none" }}>
      </TLink>
    </div>
  );
};

export default ComplaintsLogic;
