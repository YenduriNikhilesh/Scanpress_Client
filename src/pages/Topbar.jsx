import { useNavigate } from 'react-router-dom';
import { useApp } from '../services/AppContext';

const PrinterIcon = () => (
  <svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round">
    <path d="M6 9V2h12v7M6 18H4a2 2 0 01-2-2v-5a2 2 0 012-2h16a2 2 0 012 2v5a2 2 0 01-2 2h-2M6 14h12v8H6v-8z"/>
  </svg>
);

const SettingsIcon = () => (
  <svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="3"/>
    <path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-4 0v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83-2.83l.06-.06A1.65 1.65 0 004.68 15a1.65 1.65 0 00-1.51-1H3a2 2 0 010-4h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06A2 2 0 012.34 4.3a2 2 0 012.83 0l.06.06A1.65 1.65 0 009 4.68a1.65 1.65 0 001-1.51V3a2 2 0 014 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 2.83l-.06.06A1.65 1.65 0 0019.4 9a1.65 1.65 0 001.51 1H21a2 2 0 010 4h-.09a1.65 1.65 0 00-1.51 1z"/>
  </svg>
);

const UserIcon = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="var(--ink2)" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2"/><circle cx="12" cy="7" r="4"/>
  </svg>
);

export default function Topbar({ variant = 'default' }) {
  const navigate  = useNavigate();
  const { shopName } = useApp();
  const isSettings = variant === 'settings';

  return (
    <div className="topbar">
      <div className="topbar-left">
        <div className="topbar-icon">
          {isSettings ? <SettingsIcon /> : <PrinterIcon />}
        </div>
        <div className="topbar-brand">
          <div className="topbar-shop">{isSettings ? 'Settings' : shopName}</div>
          <div className="topbar-sub">{isSettings ? 'Account & Pricing' : 'Smart Queue System'}</div>
        </div>
      </div>
      <div className="topbar-right">
        {isSettings
          ? <button className="signout-btn" onClick={() => navigate('/login')}>Sign out</button>
          : <button className="profile-btn" onClick={() => navigate('/settings')}><UserIcon /></button>
        }
      </div>
    </div>
  );
}
