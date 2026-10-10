import React, { useEffect, useState } from 'react';
import { Routes, Route, Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from './lib/auth.jsx';
import { loadMe } from './lib/gov.js';
import Login from './screens/Login.jsx';
import Complaints from './screens/Complaints.jsx';
import AuditLog from './screens/AuditLog.jsx';
import Legend from './screens/Legend.jsx';

// Nothing except the sign-in page opens without a session; the server enforces everything again on every call.
function RequireLogin() {
  const { user, ready } = useAuth();
  const [loaded, setLoaded] = useState(false);
  useEffect(() => { if (user) loadMe().then(() => setLoaded(true)).catch(() => setLoaded(true)); else setLoaded(false); }, [user]);
  if (!ready || (user && !loaded)) return <div style={{ padding: 24, color: '#4B5563' }}>Loading…</div>;
  return user ? <Outlet /> : <Navigate to="/login" replace />;
}
// Pages only National officials may open (the API refuses everyone else too).
function NationalOnly() {
  const { user } = useAuth();
  return user && user.role === 'NATIONAL' ? <Outlet /> : <Navigate to="/" replace />;
}

// One screen crashing must never blank the whole portal.
class Boundary extends React.Component {
  state = { err: false };
  static getDerivedStateFromError() { return { err: true }; }
  componentDidUpdate(prev) { if (prev.k !== this.props.k && this.state.err) this.setState({ err: false }); }
  render() { return this.state.err ? <div role="alert" style={{ padding: 24, color: '#7F1D1D', fontWeight: 600 }}>This page could not be shown. <a href="/complaints">Back to Complaints</a></div> : this.props.children; }
}

export default function App() {
  const { user, ready } = useAuth();
  const loc = useLocation();
  return (
    <Boundary k={loc.pathname}>
    <Routes>
      <Route path="/login" element={ready && user ? <Navigate to="/" replace /> : <Login />} />
      <Route element={<RequireLogin />}>
        <Route path="/" element={<Navigate to="/complaints" replace />} />
        <Route path="/complaints" element={<Complaints />} />
        <Route path="/legend" element={<Legend />} />
        <Route element={<NationalOnly />}>
          <Route path="/audit" element={<AuditLog />} />
        </Route>
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
    </Boundary>
  );
}
