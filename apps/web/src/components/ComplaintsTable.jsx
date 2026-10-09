import React, { useCallback, useEffect, useRef, useState } from 'react';
import { api, qs } from '../api/client.js';
import { useI18n } from '../i18n/index.jsx';
import { age, num } from '../lib/format.js';
import { StatusChip, VerifyChip, Priority } from './Chips.jsx';
import PhoneReveal from './PhoneReveal.jsx';

const SORTS = ['created_desc', 'created_asc', 'priority'];
// which filter a group's key belongs to, so expanding a group is "the same list, filtered to that group"
const GROUP_FILTER = { state: 'state', district: 'district', city: 'city', area: 'area', department: 'department', category_l1: 'category_l1' };

/** Loads one page at a time and appends ("Load more"). Starts over whenever the query changes. */
function usePagedList(query, enabled = true) {
  const [items, setItems] = useState([]);
  const [total, setTotal] = useState(null);
  const [cursor, setCursor] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const seq = useRef(0);
  const key = JSON.stringify(query);

  const load = useCallback(async (after) => {
    const my = ++seq.current;
    setLoading(true);
    setError(null);
    try {
      const r = await api(`/api/complaints${qs({ ...query, limit: 50, cursor: after || undefined })}`);
      if (my !== seq.current) return;
      setItems((prev) => (after ? [...prev, ...r.items] : r.items));
      if (!after) setTotal(r.total);
      setCursor(r.nextCursor);
    } catch (e) {
      if (my === seq.current) setError(e);
    } finally {
      if (my === seq.current) setLoading(false);
    }
  }, [key]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!enabled) return undefined;
    setItems([]); setCursor(null); setTotal(null);
    load(null);
    return () => { seq.current += 1; };
  }, [load, enabled]);

  return { items, total, cursor, loading, error, more: () => load(cursor) };
}

function Rows({ items, selectedId, onOpen }) {
  const { t, pick, lang } = useI18n();
  return (
    <table className="tbl">
      <thead>
        <tr>
          <th scope="col">{t('col.id')}</th>
          <th scope="col">{t('col.mobile')}</th>
          <th scope="col">{t('col.category')}</th>
          <th scope="col">{t('col.area')}</th>
          <th scope="col">{t('col.department')}</th>
          <th scope="col">{t('col.status')}</th>
          <th scope="col">{t('col.priority')}</th>
          <th scope="col">{t('col.age')}</th>
          <th scope="col">{t('col.verify')}</th>
        </tr>
      </thead>
      <tbody>
        {items.map((c) => (
          <tr
            key={c.id}
            className={`row ${c.id === selectedId ? 'is-active' : ''}`}
            tabIndex={0}
            onClick={() => onOpen(c.id)}
            onKeyDown={(e) => { if (e.key === 'Enter') onOpen(c.id); }}
          >
            <td className="code">{c.code}</td>
            <td><PhoneReveal ticketId={c.id} masked={c.phoneMasked} compact /></td>
            <td>
              {pick(c.category.names)}
              <div className="sub">{pick(c.category.l1Names)}</div>
            </td>
            <td>
              {pick(c.location.city.name)}
              <div className="sub">{c.location.area ? pick(c.location.area.name) : '–'}</div>
            </td>
            <td>{c.department ? pick(c.department.agency) : '–'}</td>
            <td><StatusChip status={c.status} />{c.reopenCount > 0 && <div className="sub">↻ {c.reopenCount}</div>}</td>
            <td><Priority band={c.priority} breached={c.slaBreached} /></td>
            <td className="sub" style={{ whiteSpace: 'nowrap' }}>{age(c.createdAt, lang)}</td>
            <td><VerifyChip status={c.closeRequest?.status} /></td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function ListBlock({ query, selectedId, onOpen, onTotal }) {
  const { t } = useI18n();
  const list = usePagedList(query);
  useEffect(() => { if (onTotal && list.total !== null) onTotal(list.total); }, [list.total]); // eslint-disable-line react-hooks/exhaustive-deps
  if (list.error) return <div className="empty">{t('app.error')} <button className="btn btn--sm" onClick={() => list.more()}>{t('app.retry')}</button></div>;
  if (!list.loading && list.items.length === 0) return <div className="empty">{t('app.empty')}</div>;
  return (
    <>
      <Rows items={list.items} selectedId={selectedId} onOpen={onOpen} />
      {list.loading && <div className="empty">{t('app.loading')}</div>}
      {list.cursor && !list.loading && <div className="more"><button type="button" className="btn" onClick={list.more}>{t('table.more')}</button></div>}
    </>
  );
}

function Group({ group, groupBy, baseQuery, selectedId, onOpen, defaultOpen }) {
  const { t, pick } = useI18n();
  const [open, setOpen] = useState(defaultOpen);
  const filterKey = GROUP_FILTER[groupBy];
  return (
    <div className="group">
      <button type="button" className="group__head" aria-expanded={open} onClick={() => setOpen((o) => !o)}>
        <span className="chev" aria-hidden="true">▸</span>
        {pick(group.name)}
        <span className="n">{t('table.complaintsIn', { n: num(group.count) })}{group.awaitingCitizen ? ` · ⏳ ${num(group.awaitingCitizen)}` : ''}</span>
      </button>
      {open && <ListBlock query={{ ...baseQuery, [filterKey]: group.key }} selectedId={selectedId} onOpen={onOpen} />}
    </div>
  );
}

export default function ComplaintsTable({ filters, apiFilters, selectedId, onOpen, onSortChange, version }) {
  const { t } = useI18n();
  const { groupBy, sort } = filters;
  const [total, setTotal] = useState(null);
  const baseQuery = { ...apiFilters, sort, _v: version };

  // groups: the same filters, counted per group
  const [groups, setGroups] = useState(null);
  const [groupError, setGroupError] = useState(false);
  const gkey = JSON.stringify({ groupBy, apiFilters, version });
  useEffect(() => {
    if (groupBy === 'none') { setGroups(null); return undefined; }
    let alive = true;
    setGroups(null); setGroupError(false);
    api(`/api/complaints/groups${qs({ ...apiFilters, groupBy, _v: version })}`).then(
      (r) => { if (alive) { setGroups(r.groups); setTotal(r.total); } },
      () => { if (alive) setGroupError(true); },
    );
    return () => { alive = false; };
  }, [gkey]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <section className="panel" aria-label="Complaints">
      <div className="panel__head">
        {t('table.title')}
        <small>{total !== null ? t('table.total', { n: num(total) }) : ''}</small>
        <span style={{ flex: 1 }} />
        <label className="field" style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
          <span>{t('table.sort')}</span>
          <select style={{ height: 28 }} value={sort} onChange={(e) => onSortChange(e.target.value)}>
            {SORTS.map((s) => <option key={s} value={s}>{t(`sort.${s}`)}</option>)}
          </select>
        </label>
      </div>
      <div className="panel__body">
        {groupBy === 'none' ? (
          <ListBlock query={baseQuery} selectedId={selectedId} onOpen={onOpen} onTotal={setTotal} />
        ) : groupError ? (
          <div className="empty">{t('app.error')}</div>
        ) : groups === null ? (
          <div className="empty">{t('app.loading')}</div>
        ) : groups.length === 0 ? (
          <div className="empty">{t('app.empty')}</div>
        ) : (
          groups.map((g, i) => (
            <Group key={`${groupBy}:${g.key}`} group={g} groupBy={groupBy} baseQuery={baseQuery} selectedId={selectedId} onOpen={onOpen} defaultOpen={groups.length === 1 || i === 0} />
          ))
        )}
      </div>
    </section>
  );
}
