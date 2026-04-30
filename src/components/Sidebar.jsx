import { useState, useEffect } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { DRUGS } from '../config/drugs';
import { loadLatestWeekPerDrug } from '../utils/supabaseLoader';
import { fmtWeekDate } from '../utils/weekUtils';
import './Sidebar.css';

/* ── Icons ── */
function IconGrid() {
  return (
    <svg width="24" height="24" viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <rect x="1.5" y="1.5" width="5.5" height="5.5" rx="1.5" fill="currentColor" />
      <rect x="9" y="1.5" width="5.5" height="5.5" rx="1.5" fill="currentColor" />
      <rect x="1.5" y="9" width="5.5" height="5.5" rx="1.5" fill="currentColor" />
      <rect x="9" y="9" width="5.5" height="5.5" rx="1.5" fill="currentColor" />
    </svg>
  );
}

function IconBox() {
  return (
    <svg width="24" height="24" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" aria-hidden="true">
      <path d="M2 5.5 8 2.5l6 3v5l-6 3-6-3v-5z" />
      <path d="M8 2.5v11" />
      <path d="M2 5.5l6 3 6-3" />
    </svg>
  );
}

function IconHeadset() {
  return (
    <svg width="24" height="24" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" aria-hidden="true">
      <path d="M2.5 9V7.5a5.5 5.5 0 0111 0V9" />
      <rect x="1.5" y="9" width="3" height="4" rx="1.2" />
      <rect x="11.5" y="9" width="3" height="4" rx="1.2" />
    </svg>
  );
}

function IconTable() {
  return (
    <svg width="24" height="24" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="1.5" y="1.5" width="13" height="13" rx="1.5" />
      <line x1="1.5" y1="5.5" x2="14.5" y2="5.5" />
      <line x1="6"   y1="5.5" x2="6"   y2="14.5" />
    </svg>
  );
}

function IconWeekly() {
  return (
    <svg width="24" height="24" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="1.5" y="2.5" width="13" height="11" rx="1.5" />
      <line x1="1.5" y1="6" x2="14.5" y2="6" />
      <line x1="5" y1="2.5" x2="5" y2="4.5" />
      <line x1="11" y1="2.5" x2="11" y2="4.5" />
      <polyline points="3.5,10 6,8 8.5,9.5 12.5,7.5" />
    </svg>
  );
}


/* ── Sidebar ── */
export default function Sidebar() {
  const navigate       = useNavigate();
  const { pathname }   = useLocation();

  const panelFromPath = pathname.startsWith('/weekly/') ? 'weekly' : null;

  const [openPanel,   setOpenPanel]   = useState(panelFromPath);
  const [latestWeeks, setLatestWeeks] = useState(() => {
    const map = {};
    for (const drug of DRUGS) {
      const v = localStorage.getItem(`ag_weekly_latest_${drug.id}`);
      if (v) map[drug.id] = v;
    }
    return map;
  });

  // 브라우저 뒤로가기/앞으로가기 시 패널 동기화
  useEffect(() => {
    setOpenPanel(panelFromPath);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname]);

  // localStorage 미등록 품목은 Supabase에서 1회 조회 후 캐시
  useEffect(() => {
    const missing = DRUGS.filter(
      d => !localStorage.getItem(`ag_weekly_latest_${d.id}`)
    );
    if (missing.length === 0) return;
    loadLatestWeekPerDrug(missing).then(result => {
      const updates = {};
      for (const [id, week] of Object.entries(result)) {
        if (!week) continue;
        localStorage.setItem(`ag_weekly_latest_${id}`, week);
        updates[id] = week;
      }
      if (Object.keys(updates).length > 0) {
        setLatestWeeks(prev => ({ ...prev, ...updates }));
      }
    }).catch(() => {});
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const toggle = (key) => setOpenPanel(prev => prev === key ? null : key);

  const isWeeklyActive = pathname.startsWith('/weekly/');
  const isAdminActive  = pathname.startsWith('/admin');

  return (
    <>
      {/* ── Icon Rail ── */}
      <nav className="sb__rail">
        <div className="sb__rail-logo">AG</div>

        <div className="sb__rail-nav">
          {/* 대시보드 */}
          <div
            className={`sb__rail-item${openPanel === 'dashboard' ? ' active' : ''}`}
            onClick={() => toggle('dashboard')}
            title="대시보드"
          >
            <IconGrid />
          </div>

          {/* 8대품목 Weekly */}
          <div
            className={`sb__rail-item${isWeeklyActive || openPanel === 'weekly' ? ' active' : ''}`}
            onClick={() => toggle('weekly')}
            title="8대품목 Weekly"
          >
            <IconWeekly />
          </div>

          {/* 8대품목 Monthly */}
          <div
            className={`sb__rail-item${openPanel === '8dae' ? ' active' : ''}`}
            onClick={() => toggle('8dae')}
            title="8대품목 Monthly"
          >
            <IconBox />
          </div>

          {/* 유비스트 요약 */}
          <div
            className={`sb__rail-item${openPanel === 'ubist' ? ' active' : ''}`}
            onClick={() => toggle('ubist')}
            title="유비스트 요약"
          >
            <IconTable />
          </div>

          {/* CSD */}
          <div
            className={`sb__rail-item${openPanel === 'csd' ? ' active' : ''}`}
            onClick={() => toggle('csd')}
            title="CSD"
          >
            <IconHeadset />
          </div>
        </div>

        <div className="sb__rail-footer">
          <Link to="/admin" className={`sb__rail-admin${isAdminActive ? ' active' : ''}`} onClick={() => setOpenPanel(null)} title="Admin" aria-label="Admin">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <circle cx="12" cy="12" r="3" />
              <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
            </svg>
          </Link>
        </div>
      </nav>

      {/* ── Slide Panel ── */}
      <div className={`sb__panel${openPanel ? '' : ' sb__panel--hidden'}`}>

        {/* 대시보드 패널 */}
        {openPanel === 'dashboard' && (
          <>
            <div className="sb__panel-header">
              <span>대시보드</span>
              <button className="sb__panel-close" onClick={() => setOpenPanel(null)} aria-label="닫기">✕</button>
            </div>
            <div className="sb__panel-body sb__panel-body--empty">
              <span>준비 중</span>
            </div>
          </>
        )}

        {/* 8대품목 Weekly 패널 */}
        {openPanel === 'weekly' && (
          <>
            <div className="sb__panel-header">
              <span>8대품목 Weekly</span>
              <button className="sb__panel-close" onClick={() => setOpenPanel(null)} aria-label="닫기">✕</button>
            </div>
            <div className="sb__panel-body">
              {DRUGS.map((drug) => (
                <div
                  key={drug.id}
                  className={`sb__panel-subitem${pathname === '/weekly/' + drug.id ? ' active' : ''}`}
                  onClick={() => navigate('/weekly/' + drug.id)}
                >
                  {drug.name}
                  {latestWeeks[drug.id] && (
                    <span className="sb__panel-update-badge">{fmtWeekDate(latestWeeks[drug.id])}</span>
                  )}
                </div>
              ))}
            </div>
          </>
        )}

        {/* 8대품목 Monthly 패널 */}
        {openPanel === '8dae' && (
          <>
            <div className="sb__panel-header">
              <span>8대품목 Monthly</span>
              <button className="sb__panel-close" onClick={() => setOpenPanel(null)} aria-label="닫기">✕</button>
            </div>
            <div className="sb__panel-body">
              {DRUGS.map((drug) => (
                <div
                  key={drug.id}
                  className="sb__panel-subitem sb__panel-subitem--soon"
                >
                  {drug.name}
                  <span className="sb__panel-soon-badge">준비 중</span>
                </div>
              ))}
            </div>
          </>
        )}

        {/* 유비스트 패널 */}
        {openPanel === 'ubist' && (
          <>
            <div className="sb__panel-header">
              <span>유비스트 요약</span>
              <button className="sb__panel-close" onClick={() => setOpenPanel(null)} aria-label="닫기">✕</button>
            </div>
            <div className="sb__panel-body">
              {[
                '3월 D1 요약',
                '제약사별 전체',
                '제약사별 의원',
                '제약사별 종병',
                '순위그래프 (안국)',
                '순위그래프 (종병300↑↓)',
                '안국 전체',
                '안국 의원',
                '안국 종병',
                '집중품목',
                '포트폴리오',
              ].map((label) => (
                <div
                  key={label}
                  className="sb__panel-subitem sb__panel-subitem--soon"
                >
                  {label}
                  <span className="sb__panel-soon-badge">준비 중</span>
                </div>
              ))}
            </div>
          </>
        )}

        {/* CSD 패널 */}
        {openPanel === 'csd' && (
          <>
            <div className="sb__panel-header">
              <span>CSD</span>
              <button className="sb__panel-close" onClick={() => setOpenPanel(null)} aria-label="닫기">✕</button>
            </div>
            <div className="sb__panel-body sb__panel-body--empty">
              <span>준비 중</span>
            </div>
          </>
        )}

      </div>
    </>
  );
}
