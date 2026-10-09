// GD2-GD5: one map, five levels of detail (Bible 9.3):
//   zoom < 7   India outline shaded by state + a circle per city (no street tiles, so no tile-provider borders)
//   7 - 10     city circles + heat layer
//   10+        street tiles fade in
//   11 - 14    ward / sector outlines with counts (approximate outlines are dashed)
//   15+        individual complaints, clustered
// It uses the same filters and role scope as the table.
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { esc } from '../lib/escape.js';
import { CircleMarker, GeoJSON, MapContainer, Pane, TileLayer, Tooltip, useMap, useMapEvents } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet.heat';
import 'leaflet.markercluster';
import { feature } from 'topojson-client';
import { api, qs } from '../api/client.js';
import { useI18n } from '../i18n/index.jsx';
import { useFetch } from '../lib/hooks.js';
import { num } from '../lib/format.js';

const INDIA_BOUNDS = [[6.5, 67.5], [37.5, 98]];
const RAMP = ['#ffe9a8', '#fdc65a', '#f9a03f', '#e0502d', '#a92222', '#6e1212'];
const NEUTRAL = '#e4e8ef';
const L1_COLORS = { SOLID_WASTE: '#7a5c2e', WATER_SUPPLY: '#1f6feb', SEWERAGE_DRAINAGE: '#5b4bb7', ROADS_FOOTPATHS: '#555d6b', STREETLIGHTS: '#d9a400', ELECTRICITY: '#e0502d', PUBLIC_HEALTH: '#1e7b34', TRAFFIC_TRANSPORT: '#0e7c86', PARKS_RECREATION: '#2f9e44', BUILDING_PLANNING: '#8a5a44', PUBLIC_AMENITIES: '#c2418d', ANIMAL_CONTROL: '#9c5700', OTHER: '#6b7686' };

/** count -> colour on a log scale, so one big city does not wash out the rest. Zero stays neutral grey. */
export function heatColor(count, max) {
  if (!count) return NEUTRAL;
  const t = max <= 1 ? 1 : Math.log(1 + count) / Math.log(1 + max);
  return RAMP[Math.min(RAMP.length - 1, Math.floor(t * RAMP.length))];
}

function Watcher({ onView }) {
  const map = useMap();
  const report = () => onView({ zoom: map.getZoom(), bounds: map.getBounds(), center: map.getCenter() });
  useMapEvents({ zoomend: report, moveend: report });
  useEffect(() => { map.fitBounds(INDIA_BOUNDS, { animate: false }); report(); }, []); // eslint-disable-line react-hooks/exhaustive-deps
  return null;
}

/** Heat layer from the complaint points in view. */
function HeatLayer({ points }) {
  const map = useMap();
  useEffect(() => {
    if (!points.length) return undefined;
    const layer = L.heatLayer(points.map((p) => [p.lat, p.lng, 1]), { radius: 26, blur: 22, maxZoom: 13, minOpacity: 0.35 }).addTo(map);
    return () => { map.removeLayer(layer); };
  }, [points, map]);
  return null;
}

/** Individual complaints as clustered dots; a click opens the detail. */
function PointsLayer({ points, onOpen }) {
  const map = useMap();
  useEffect(() => {
    const group = L.markerClusterGroup({ showCoverageOnHover: false, maxClusterRadius: 45 });
    for (const p of points) {
      const m = L.circleMarker([p.lat, p.lng], { radius: 8, weight: 2, color: '#fff', fillColor: L1_COLORS[p.l1] || '#6b7686', fillOpacity: 0.95 });
      m.bindTooltip(esc(p.code), { direction: 'top' });
      m.on('click', () => onOpen(p.id));
      group.addLayer(m);
    }
    map.addLayer(group);
    return () => { map.removeLayer(group); };
  }, [points, map, onOpen]);
  return null;
}

export default function MapPanel({ filters, onSelectState, onSelectCity, onSelectArea, onOpenComplaint, version }) {
  const { t, pick } = useI18n();
  const [view, setView] = useState({ zoom: 4, bounds: null, center: null });
  const f = qs({ ...filters, _v: version });

  const india = useFetch('/api/geo/india');
  const states = useFetch(`/api/map/states${f}`);
  const cities = useFetch(`/api/map/cities${f}`);

  const outline = useMemo(() => (india.data ? feature(india.data, india.data.objects.states) : null), [india.data]);
  const stateCount = useMemo(() => Object.fromEntries((states.data?.states || []).map((s) => [s.code, s])), [states.data]);
  const maxState = states.data?.max || 0;
  const maxCity = cities.data?.max || 0;

  const zoom = view.zoom;
  const showPoints = zoom >= 15;
  const showAreas = zoom >= 11 && zoom < 15;
  const showHeat = zoom >= 7 && zoom < 11;
  const showTiles = zoom >= 10;

  // complaint points inside the visible rectangle (for the heat layer and the dots)
  const [points, setPoints] = useState({ list: [], truncated: false });
  const lastBox = useRef('');
  useEffect(() => {
    if (!(showHeat || showPoints) || !view.bounds) { setPoints({ list: [], truncated: false }); return undefined; }
    const b = view.bounds;
    const bbox = [b.getWest(), b.getSouth(), b.getEast(), b.getNorth()].map((n) => Math.max(-180, Math.min(180, n)).toFixed(4)).join(',');
    const key = `${bbox}|${f}`;
    lastBox.current = key;
    const id = setTimeout(() => {
      api(`/api/map/points${qs({ ...filters, bbox, _v: version })}`).then((r) => {
        if (lastBox.current === key) setPoints({ list: r.points, truncated: r.truncated });
      }).catch(() => {});
    }, 250);
    return () => clearTimeout(id);
  }, [showHeat, showPoints, view.bounds, f]); // eslint-disable-line react-hooks/exhaustive-deps

  // ward / sector outlines for the city we are looking at
  const nearestCity = useMemo(() => {
    if (!view.center || !cities.data?.cities?.length) return null;
    let best = null;
    for (const c of cities.data.cities) {
      const d = Math.hypot(c.lat - view.center.lat, c.lng - view.center.lng);
      if (d < 0.6 && (!best || d < best.d)) best = { c, d };
    }
    return best?.c || null;
  }, [view.center, cities.data]);
  const areas = useFetch(showAreas && nearestCity ? `/api/map/areas${qs({ ...filters, cityId: nearestCity.id, _v: version })}` : null);
  const maxArea = areas.data?.max || 0;

  const legendMax = showAreas ? maxArea : maxState || maxCity;

  return (
    <section className="panel" aria-label={t('map.title')}>
      <div className="panel__head">{t('map.title')}</div>
      <div className="mapwrap">
        <MapContainer
          center={[22.5, 80]}
          zoom={4}
          minZoom={4}
          maxZoom={18}
          maxBounds={[[0, 55], [45, 110]]}
          maxBoundsViscosity={0.8}
          zoomSnap={0.5}
          zoomDelta={0.5}
          worldCopyJump={false}
          attributionControl={showTiles}
          style={{ height: '100%', width: '100%' }}
        >
          <Watcher onView={setView} />
          {showTiles && <TileLayer url="https://tile.openstreetmap.org/{z}/{x}/{y}.png" attribution="© OpenStreetMap contributors" maxZoom={19} opacity={Math.min(1, (zoom - 9.5) * 2)} />}

          {outline && (
            <Pane name="india" style={{ zIndex: 300 }}>
              <GeoJSON
                key={`${states.data ? maxState : 0}-${JSON.stringify(Object.values(stateCount).map((s) => s.count))}`}
                data={outline}
                style={(feat) => {
                  const c = stateCount[feat.properties.code]?.count || 0;
                  return { fillColor: heatColor(c, maxState), fillOpacity: showTiles ? 0.18 : 0.95, color: '#8b97a8', weight: 0.8 };
                }}
                onEachFeature={(feat, layer) => {
                  const s = stateCount[feat.properties.code];
                  layer.bindTooltip(esc(`${s ? pick(s.name) : feat.properties.name}: ${num(s?.count || 0)}`), { sticky: true });
                  layer.on('click', () => s && onSelectState(feat.properties.code));
                }}
              />
            </Pane>
          )}

          {zoom < 11 && (cities.data?.cities || []).map((c) => (
            <CircleMarker
              key={c.id}
              center={[c.lat, c.lng]}
              radius={c.count ? Math.min(34, 8 + 3.2 * Math.sqrt(c.count)) : 5}
              pathOptions={{ color: '#fff', weight: 1.5, fillColor: c.count ? heatColor(c.count, maxCity) : '#aeb8c6', fillOpacity: c.count ? 0.85 : 0.6 }}
              eventHandlers={{ click: (e) => { e.target._map.flyTo([c.lat, c.lng], 12.5, { duration: 0.8 }); onSelectCity(c.id); } }}
            >
              <Tooltip>{pick(c.name)}: {t('map.complaints', { n: num(c.count) })}</Tooltip>
            </CircleMarker>
          ))}

          {showHeat && <HeatLayer points={points.list} />}

          {showAreas && areas.data && (
            <GeoJSON
              key={`${nearestCity?.id}-${areas.data.features.map((a) => a.properties.count).join(',')}`}
              data={areas.data}
              style={(feat) => ({
                fillColor: heatColor(feat.properties.count, maxArea), fillOpacity: 0.55,
                color: '#1f3a5f', weight: 1.6, dashArray: feat.properties.approximate ? '6 5' : undefined,
              })}
              onEachFeature={(feat, layer) => {
                const p = feat.properties;
                layer.bindTooltip(esc(`${pick(p.name)}: ${num(p.count)}${p.approximate ? ` · ${t('map.approxArea')}` : ''}`), { sticky: true });
                layer.on('click', () => onSelectArea(p.id));
              }}
            />
          )}

          {showPoints && <PointsLayer points={points.list} onOpen={onOpenComplaint} />}
        </MapContainer>

        <div className="maplabel">{t('map.approx')}</div>
        {zoom < 11 && <div className="maphint">{t('map.zoomHint')}</div>}
        {points.truncated && <div className="maphint maphint--warn" style={{ top: 44 }}>{t('map.truncated')}</div>}
        <div className="maplegend" aria-label={t('map.legend')}>
          <div>{t('map.legend')}</div>
          <div className="bar" />
          <div className="ends"><span>{t('map.zero')} / 1</span><span>{num(legendMax)}</span></div>
        </div>
      </div>
    </section>
  );
}
