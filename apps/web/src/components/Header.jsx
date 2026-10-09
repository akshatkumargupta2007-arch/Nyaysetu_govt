import React from 'react';
import { NavLink } from 'react-router-dom';
import { useAuth } from '../auth.jsx';
import { useI18n } from '../i18n/index.jsx';
import LangSwitch from './LangSwitch.jsx';

export default function Header() {
  const { user, signOut } = useAuth();
  const { t } = useI18n();
  return (
    <header className="hdr">
      <span className="hdr__brand">{t('app.name')}</span>
      <span className="hdr__tag">Prototype</span>
      {user?.role === 'NATIONAL' && (
        <nav className="hdr__nav" aria-label="Main">
          <NavLink to="/" end>{t('nav.dashboard')}</NavLink>
          <NavLink to="/audit">{t('nav.audit')}</NavLink>
        </nav>
      )}
      <span className="hdr__spacer" />
      <LangSwitch />
      {user && (
        <>
          <div className="hdr__user">
            {user.name}
            <small>{t(`role.${user.role}`)}</small>
          </div>
          <button type="button" className="btn-ghost" onClick={signOut}>{t('nav.logout')}</button>
        </>
      )}
    </header>
  );
}
