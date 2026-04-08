import { useState } from 'react';
import { Link } from 'react-router-dom';
import './Sidebar.css';

/* ── Flat SVG Icons ── */
function IconGrid() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <rect x="1.5" y="1.5" width="5.5" height="5.5" rx="1.5" fill="currentColor" />
      <rect x="9" y="1.5" width="5.5" height="5.5" rx="1.5" fill="currentColor" />
      <rect x="1.5" y="9" width="5.5" height="5.5" rx="1.5" fill="currentColor" />
      <rect x="9" y="9" width="5.5" height="5.5" rx="1.5" fill="currentColor" />
    </svg>
  );
}

function IconBox() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" aria-hidden="true">
      <path d="M2 5.5 8 2.5l6 3v5l-6 3-6-3v-5z" />
      <path d="M8 2.5v11" />
      <path d="M2 5.5l6 3 6-3" />
    </svg>
  );
}

function IconHeadset() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" aria-hidden="true">
      <path d="M2.5 9V7.5a5.5 5.5 0 0111 0V9" />
      <rect x="1.5" y="9" width="3" height="4" rx="1.2" />
      <rect x="11.5" y="9" width="3" height="4" rx="1.2" />
    </svg>
  );
}

function IconChevron({ open }) {
  return (
    <svg
      width="12" height="12" viewBox="0 0 12 12"
      fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"
      style={{ transform: open ? 'rotate(90deg)' : 'rotate(0deg)', transition: 'transform var(--transition-base)' }}
      aria-hidden="true"
    >
      <path d="M4 2l4 4-4 4" />
    </svg>
  );
}

/* ── Sidebar ── */
export default function Sidebar({ drugs = [], currentDrug, onDrugChange, activeSection, onDashboardClick }) {
  const [open8dae, setOpen8dae] = useState(true);

  const isDashActive = activeSection === 'dashboard';

  return (
    <nav className="sb">
      {/* Logo */}
      <div className="sb__logo">AG <em>Board</em></div>

      {/* Nav */}
      <div className="sb__nav">

        {/* 대시보드 */}
        <div className={`sb__item${isDashActive ? ' active' : ''}`} onClick={onDashboardClick}>
          <span className="sb__icon"><IconGrid /></span>
          <span>대시보드</span>
        </div>

        {/* 8대품목 */}
        <div className="sb__item" onClick={() => setOpen8dae(v => !v)}>
          <span className="sb__icon"><IconBox /></span>
          <span className="sb__item-label">8대품목</span>
          <span className="sb__chevron"><IconChevron open={open8dae} /></span>
        </div>

        {open8dae && (
          <div className="sb__submenu">
            {drugs.map((drug) => (
              <div
                key={drug.id}
                className={`sb__subitem${!isDashActive && drug.id === currentDrug?.id ? ' active' : ''}`}
                onClick={() => onDrugChange && onDrugChange(drug)}
              >
                {drug.name}
              </div>
            ))}
          </div>
        )}

        {/* CSD */}
        <div className="sb__item">
          <span className="sb__icon"><IconHeadset /></span>
          <span>CSD</span>
        </div>

      </div>

      {/* Admin */}
      <div className="sb__footer">
        <Link to="/admin" className={`sb__help${activeSection === 'admin' ? ' sb__help--active' : ''}`}>Admin</Link>
      </div>
    </nav>
  );
}
