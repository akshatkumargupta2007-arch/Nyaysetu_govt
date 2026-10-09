import React from 'react';

// Base class used by every screen. A screen keeps its state and sample data in a small class and
// describes what to show in renderVals(); view() (generated next to the class) draws it.
export class DCLogic extends React.Component {
  render() {
    return this.view(this.renderVals());
  }
}

// Turns a CSS declaration string ("color: red; margin: 0") into a React style object.
// Used for styles that are computed at runtime (selected tabs, animated states, ...).
export function css(str) {
  const out = {};
  if (!str) return out;
  let depth = 0;
  let cur = '';
  const parts = [];
  for (const ch of str) {
    if (ch === '(') depth++;
    if (ch === ')') depth--;
    if (ch === ';' && depth === 0) {
      parts.push(cur);
      cur = '';
    } else {
      cur += ch;
    }
  }
  parts.push(cur);
  for (const d of parts) {
    const i = d.indexOf(':');
    if (i < 0) continue;
    const key = d.slice(0, i).trim();
    const val = d.slice(i + 1).trim();
    if (!key) continue;
    out[key.startsWith('--') ? key : key.replace(/-([a-z])/g, (_, c) => c.toUpperCase())] = val;
  }
  return out;
}
