// Who is signed in, and the "View as" preview. Every screen has the same header; this feeds it real values.
import { api, getViewAs, setViewAs } from './client.js';

let me = null;
let realRole = null;

export async function loadMe() {
  const r = await api('/api/me');
  me = r.user; realRole = r.realRole || r.user.role;
  return me;
}
export const getMe = () => me;
export const isRealNational = () => realRole === 'NATIONAL';
/** 'national' | 'state' | 'district' | 'city' | 'department' (what the portal currently shows). */
export const currentRoleKey = () => (me ? me.role.toLowerCase() : 'national');

const LABEL = { national: ['National', 'राष्ट्रीय', 'n'], state: ['State', 'राज्य', 's'], district: ['District', 'ज़िला', 't'], city: ['City', 'शहर', 'c'], department: ['Department', 'विभाग', 'd'] };
const SCOPE = (m, key) => {
  if (key === 'national') return ['National · all India', 'राष्ट्रीय · पूरा भारत'];
  if (key === 'state') return ['State · ' + (m.scopeState || ''), 'राज्य · ' + (m.scopeState || '')];
  if (key === 'district') return ['District · ' + (m.scopeDistrict || ''), 'ज़िला · ' + (m.scopeDistrict || '')];
  if (key === 'city') return ['City · ' + (m.scopeCity || ''), 'शहर · ' + (m.scopeCity || '')];
  return ['Department · ' + (m.scopeDepartment || ''), 'विभाग · ' + (m.scopeDepartment || '')];
};
/** The same object shape every screen used for its sample roles: key -> [name, scopeEn, scopeHi, labelEn, labelHi, code]. */
export function govRoles() {
  const m = me || { name: '', role: 'NATIONAL' };
  const keys = realRole === 'NATIONAL' ? Object.keys(LABEL) : [m.role.toLowerCase()];
  const out = {};
  for (const k of keys) { const sc = SCOPE(m, k); out[k] = [m.name, sc[0], sc[1], LABEL[k][0], LABEL[k][1], LABEL[k][2]]; }
  return out;
}
/** Switch the preview role (only meaningful for a real National official). Reload data afterwards. */
export function switchRole(key) { setViewAs(key); }
export { getViewAs };
