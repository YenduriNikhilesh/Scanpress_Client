import { Routes, Route, Navigate, useLocation } from 'react-router-dom';

import Login from '../pages/Login';
import Signup from '../pages/Signup';
import Home from '../pages/Home';
import Queue from '../pages/Queue';
import Shop from '../pages/Shop';
import Settings from '../pages/Settings';
import MyOrders from '../pages/MyOrders';
import Checkout from '../pages/Checkout';
import Preview from '../pages/Preview';
import PrinterDiscovery from '../pages/PrinterDiscovery';
import BottomNav from '../pages/BottomNav';

import { Toast, AlertBanner } from '../pages/Notifications';

// ── Main app pages ────────────────────────────────────────────────────────────
const APP_PATHS = ['/home', '/queue', '/settings', '/shop'];

export default function AppRoutes() {
  const { pathname } = useLocation();
  const showNav = APP_PATHS.includes(pathname);

  return (
    <>
      <Routes>
        {/* ── Auth ─────────────────────────────────────────────────────────── */}
        <Route path="/" element={<Navigate to="/login" replace />} />
        <Route path="/login" element={<Login />} />
        <Route path="/signup" element={<Signup />} />

        {/* ── Main app ─────────────────────────────────────────────────────── */}
        <Route path="/home" element={<Home />} />
        <Route path="/queue" element={<Queue />} />
        <Route path="/shop" element={<Shop />} />
        <Route path="/settings" element={<Settings />} />

        {/* ── Shop checkout ────────────────────────────────────────────────── */}
        <Route path="/checkout" element={<Checkout />} />

        {/* ── Orders ───────────────────────────────────────────────────────── */}
        <Route path="/orders" element={<MyOrders />} />

        {/* ── Other pages ──────────────────────────────────────────────────── */}
        <Route path="/preview" element={<Preview />} />
        <Route path="/printer-discovery" element={<PrinterDiscovery />} />

        {/* ── Unknown routes ───────────────────────────────────────────────── */}
        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>

      {showNav && <BottomNav />}
      <Toast />
      <AlertBanner />
    </>
  );
}