import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { api, qs } from '../api/client.js';

/** Keys that are API filters. (groupBy and sort live in the URL too but are not filters.) */
export const FILTER_KEYS = ['state', 'district', 'city', 'area', 'department', 'category_l1', 'status', 'priority', 'close_request_status', 'from', 'to', 'q'];

/** The whole filter bar lives in the URL, so a view can be shared or refreshed. */
export function useFilters() {
  const [params, setParams] = useSearchParams();
  const values = useMemo(() => {
    const v = { groupBy: params.get('groupBy') || 'none', sort: params.get('sort') || 'created_desc' };
    for (const k of FILTER_KEYS) v[k] = params.get(k) || '';
    return v;
  }, [params]);

  const setMany = useCallback((patch) => {
    setParams((prev) => {
      const next = new URLSearchParams(prev);
      for (const [k, val] of Object.entries(patch)) {
        if (val === '' || val === undefined || val === null || (k === 'groupBy' && val === 'none') || (k === 'sort' && val === 'created_desc')) next.delete(k);
        else next.set(k, val);
      }
      return next;
    }, { replace: true });
  }, [setParams]);

  const set = useCallback((key, val) => {
    // Choosing a state clears the narrower levels under it, and so on down.
    const cascade = { state: ['district', 'city', 'area'], district: ['city', 'area'], city: ['area'] };
    const patch = { [key]: val };
    for (const k of cascade[key] || []) patch[k] = '';
    setMany(patch);
  }, [setMany]);

  const clear = useCallback(() => setParams(new URLSearchParams(), { replace: true }), [setParams]);

  /** Just the filters the API understands, as a query-string object. */
  const apiFilters = useMemo(() => {
    const o = {};
    for (const k of FILTER_KEYS) if (values[k]) o[k] = values[k];
    return o;
  }, [values]);

  const active = FILTER_KEYS.some((k) => values[k]);
  return { values, set, setMany, clear, apiFilters, active };
}

/** GET a path (or null to skip). Ignores answers that arrive after the inputs changed. */
export function useFetch(path) {
  const [state, setState] = useState({ data: null, loading: !!path, error: null });
  const seq = useRef(0);
  const [tick, setTick] = useState(0);
  useEffect(() => {
    if (!path) { setState({ data: null, loading: false, error: null }); return undefined; }
    const my = ++seq.current;
    setState((s) => ({ data: s.data, loading: true, error: null }));
    api(path).then(
      (data) => { if (my === seq.current) setState({ data, loading: false, error: null }); },
      (error) => { if (my === seq.current) setState({ data: null, loading: false, error }); },
    );
    return () => { seq.current += 1; };
  }, [path, tick]);
  return { ...state, reload: () => setTick((n) => n + 1) };
}

export { qs };
