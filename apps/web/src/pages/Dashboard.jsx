import React, { useCallback, useState } from 'react';
import { useI18n } from '../i18n/index.jsx';
import { useFilters } from '../lib/hooks.js';
import Header from '../components/Header.jsx';
import Kpis from '../components/Kpis.jsx';
import Filters from '../components/Filters.jsx';
import ComplaintsTable from '../components/ComplaintsTable.jsx';
import MapPanel from '../components/MapPanel.jsx';
import DetailDrawer from '../components/DetailDrawer.jsx';

export default function Dashboard() {
  const { t } = useI18n();
  const flt = useFilters();
  const [selected, setSelected] = useState(null);
  const [version, setVersion] = useState(0); // bumped after something changes, so the table, numbers and map refresh
  const refresh = useCallback(() => setVersion((v) => v + 1), []);
  const closeDrawer = useCallback(() => setSelected(null), []);

  return (
    <div className="page">
      <Header />
      <main className="page__body">
        <Kpis filters={flt.apiFilters} version={version} />
        <Filters filters={flt.values} onSet={flt.set} onSetMany={flt.setMany} onClear={flt.clear} active={flt.active} />
        <div className="main">
          <MapPanel
            filters={flt.apiFilters}
            version={version}
            onSelectState={(code) => flt.set('state', flt.values.state === code ? '' : code)}
            onSelectCity={(id) => flt.set('city', id)}
            onSelectArea={(id) => flt.set('area', flt.values.area === id ? '' : id)}
            onOpenComplaint={setSelected}
          />
          <ComplaintsTable
            filters={flt.values}
            apiFilters={flt.apiFilters}
            version={version}
            selectedId={selected}
            onOpen={setSelected}
            onSortChange={(s) => flt.set('sort', s)}
          />
        </div>
      </main>
      <footer className="foot">{t('app.prototype')}</footer>
      {selected && <DetailDrawer key={selected} id={selected} onClose={closeDrawer} onChanged={refresh} />}
    </div>
  );
}
