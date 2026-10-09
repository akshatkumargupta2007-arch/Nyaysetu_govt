import React from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import { useAuth } from './auth.jsx';
import { useI18n } from './i18n/index.jsx';
import Login from './pages/Login.jsx';
import Dashboard from './pages/Dashboard.jsx';
import Audit from './pages/Audit.jsx';

function Guard({ children, national = false }) {
  const { user, ready } = useAuth();
  const { t } = useI18n();
  if (!ready) return <div className="empty">{t('app.loading')}</div>;
  if (!user) return <Navigate to="/login" replace />;
  if (national && user.role !== 'NATIONAL') return <Navigate to="/" replace />; // the server enforces this too
  return children;
}

export default function App() {
  const { user, ready } = useAuth();
  return (
    <Routes>
      <Route path="/login" element={ready && user ? <Navigate to="/" replace /> : <Login />} />
      <Route path="/" element={<Guard><Dashboard /></Guard>} />
      <Route path="/audit" element={<Guard national><Audit /></Guard>} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
