import React, { useState, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { DRUGS } from '../config/drugs';
import { supabase } from '../lib/supabase';
import { fmtWeekLabel } from '../utils/weekUtils';
import AdminLayout from '../components/AdminLayout';
import './UploadConfirm.css';

/* ── 상수 ────────────────────────────────────────────── */
const DRUG_ROWS = DRUGS.map(d => ({
  id:                 d.dbId,
  name:               d.name,
  ingredient:         d.ingredient,
  exclude_ingredient: d.excludeIngredient,
  my_vendor:          d.myVendor,
}));

const BATCH_SIZE   = 500;
const COLS_PER_PAGE = 8;

/* ── 헬퍼 ────────────────────────────────────────────── */

/** drugId → DRUGS 항목 */
function findDrug(drugId) {
  return DRUGS.find(d => d.dbId === drugId || drugId.startsWith(d.dbId + '_'));
}

/** drugId → 탭 레이블 */
function makeTabLabel(drugId) {
  const drug = findDrug(drugId);
  if (!drug) return drugId;
  if (drugId === 'retopra_pcab')  return `${drug.name} PCAB포함`;
  if (drugId === 'retopra_npcab') return `${drug.name} PCAB불포함`;
  const metricLabel = drug.metric === 'rx' ? '처방건수' : '처방량';
  return `${drug.name} ${metricLabel}`;
}

/** Supabase에서 해당 drugId의 기존 데이터 전체 조회 */
async function fetchExisting(drugId) {
  const PAGE = 1000;
  let allData = [];
  let from = 0;

  while (true) {
    const { data, error } = await supabase
      .from('weekly_data')
      .select('vendor, week_id, rx_value, qty_value')
      .eq('drug_id', drugId)
      .range(from, from + PAGE - 1);

    if (error) throw new Error(error.message);
    if (!data || data.length === 0) break;
    allData = allData.concat(data);
    if (data.length < PAGE) break;
    from += PAGE;
  }

  const existingMap = {};   // vendor → week_id → { rx, qty }
  const existingWeeks = new Set();

  for (const row of allData) {
    existingWeeks.add(row.week_id);
    if (!existingMap[row.vendor]) existingMap[row.vendor] = {};
    existingMap[row.vendor][row.week_id] = {
      rx:  row.rx_value  ?? 0,
      qty: row.qty_value ?? 0,
    };
  }

  return { existingMap, existingWeeks };
}

/** 파싱된 rows → vendor × week 집계 맵 */
function aggregate(rows) {
  const vendorMap = {};
  const weekSet   = new Set();

  for (const row of rows) {
    weekSet.add(row.week_id);
    if (!vendorMap[row.vendor]) vendorMap[row.vendor] = {};
    if (!vendorMap[row.vendor][row.week_id])
      vendorMap[row.vendor][row.week_id] = { rx: 0, qty: 0 };
    vendorMap[row.vendor][row.week_id].rx  += row.rx_value  ?? 0;
    vendorMap[row.vendor][row.week_id].qty += row.qty_value ?? 0;
  }

  return {
    weeks:     [...weekSet].sort(),
    vendors:   Object.keys(vendorMap),
    vendorMap,
  };
}

/** 신규 주차 / 변경값 분석 */
function analyze(parsedAgg, existingMap, existingWeeks, metric) {
  const { weeks, vendors, vendorMap } = parsedAgg;

  const newWeeks     = new Set(weeks.filter(w => !existingWeeks.has(w)));
  const overlapWeeks = weeks.filter(w => existingWeeks.has(w));
  const changes      = [];

  for (const vendor of vendors) {
    for (const weekId of overlapWeeks) {
      const newVal = vendorMap[vendor]?.[weekId]?.[metric] ?? 0;
      const oldVal = existingMap[vendor]?.[weekId]?.[metric] ?? 0;
      if (newVal !== oldVal) {
        changes.push({ vendor, weekId, oldVal, newVal });
      }
    }
  }

  return { newWeeks, overlapWeeks, changes };
}

/* ── 컴포넌트 ─────────────────────────────────────────── */

export default function UploadConfirm() {
  const location = useLocation();
  const navigate  = useNavigate();

  const { parsed, fileName } = location.state ?? {};

  const isSales = parsed?.type === 'sales';

  const tabs = parsed?.results?.map(r => ({
    drugId: r.drugId,
    rows:   r.rows,
    label:  isSales
      ? `${findDrug(r.drugId)?.name ?? r.drugId} 매출`
      : makeTabLabel(r.drugId),
  })) ?? [];

  /* ── state ── */
  const [activeIdx, setActiveIdx] = useState(0);
  const [saving,    setSaving]    = useState(false);
  const [saveError, setSaveError] = useState('');
  const [tabState,  setTabState]  = useState({});
  const [colEndMap, setColEndMap] = useState({});

  /* ── 리다이렉트: 상태 없이 진입 ── */
  useEffect(() => {
    if (!parsed) navigate('/admin', { replace: true });
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  /* ── 탭 변경 시 기존 데이터 로드 ── */
  const activeTab = tabs[activeIdx] ?? null;

  useEffect(() => {
    if (!activeTab) return;
    const { drugId } = activeTab;
    if (tabState[drugId]) return; // 이미 로드됨

    setTabState(prev => ({
      ...prev,
      [drugId]: { loading: true, existingMap: {}, existingWeeks: new Set(), error: '' },
    }));

    fetchExisting(drugId)
      .then(({ existingMap, existingWeeks }) => {
        setTabState(prev => ({
          ...prev,
          [drugId]: { loading: false, existingMap, existingWeeks, error: '' },
        }));
      })
      .catch(e => {
        setTabState(prev => ({
          ...prev,
          [drugId]: { loading: false, existingMap: {}, existingWeeks: new Set(), error: e.message },
        }));
      });
  }, [activeIdx, activeTab?.drugId]); // eslint-disable-line react-hooks/exhaustive-deps

  /* ── 저장 ── */
  const handleSave = async () => {
    setSaving(true);
    setSaveError('');
    try {
      const now = new Date().toISOString();

      if (parsed.type === 'sales') {
        // 매출 로우파일 → monthly_sales 테이블
        for (const { rows } of parsed.results) {
          for (let i = 0; i < rows.length; i += BATCH_SIZE) {
            const batch = rows.slice(i, i + BATCH_SIZE);
            const { error: err } = await supabase
              .from('monthly_sales')
              .upsert(batch, { onConflict: 'drug_id,month_id' });
            if (err) throw new Error(err.message);
          }
        }
        // localStorage 매출 dot 업데이트
        const affectedIds = new Set(parsed.results.map(r => findDrug(r.drugId)?.id ?? r.drugId));
        for (const id of affectedIds) {
          localStorage.setItem(`ag_upload_${id}_매출`, now);
        }
      } else {
        // 처방 백데이터 → weekly_data 테이블
        const { error: drugErr } = await supabase
          .from('drugs')
          .upsert(DRUG_ROWS, { onConflict: 'id' });
        if (drugErr) throw new Error(`약 정보 등록 실패: ${drugErr.message}`);

        for (const { rows } of parsed.results) {
          for (let i = 0; i < rows.length; i += BATCH_SIZE) {
            const batch = rows.slice(i, i + BATCH_SIZE);
            const { error: err } = await supabase
              .from('weekly_data')
              .upsert(batch, { onConflict: 'drug_id,vendor,week_id' });
            if (err) throw new Error(err.message);
          }
        }
        // localStorage 처방 dot 업데이트
        const affectedIds = new Set(parsed.results.map(r => findDrug(r.drugId)?.id ?? r.drugId));
        for (const id of affectedIds) {
          localStorage.setItem(`ag_upload_${id}_처방`, now);
        }
      }

      navigate('/admin');
    } catch (e) {
      setSaveError(e.message);
      setSaving(false);
    }
  };

  /* ── heading ── */
  const heading = (
    <div className="preview-heading">
      <nav className="preview-breadcrumb">
        <button className="preview-bc-link" onClick={() => navigate('/admin')}>
          관리자 페이지
        </button>
        <span className="preview-bc-sep">›</span>
        <span className="preview-bc-current">{isSales ? '매출 데이터 업데이트' : '처방 데이터 업데이트'}</span>
      </nav>
      <div className="uc-title-row">
        <h1 className="preview-page-title preview-page-title--static">
          {isSales ? '매출 데이터 업데이트' : '처방 데이터 업데이트'}
        </h1>
        <div className="uc-actions">
          <button
            className="admin-action-btn admin-action-btn--secondary admin-action-btn--lg"
            onClick={() => navigate('/admin')}
            disabled={saving}
          >
            취소
          </button>
          <button
            className="admin-action-btn admin-action-btn--primary admin-action-btn--lg"
            onClick={handleSave}
            disabled={saving}
          >
            {saving ? (
              <>
                <span className="upload-spinner upload-spinner--white" />
                저장 중…
              </>
            ) : '저장'}
          </button>
        </div>
      </div>
    </div>
  );

  /* ── 매출 파일 탭 콘텐츠 ── */
  const renderSalesContent = () => {
    if (!activeTab) return null;
    const { drugId, rows } = activeTab;
    const drug = findDrug(drugId);
    const sorted = [...rows].sort((a, b) => a.month_id.localeCompare(b.month_id));
    const fmtSales = v => Math.round(v ?? 0).toLocaleString();
    return (
      <>
        <div className="uc-stats">
          <div className="uc-stat uc-stat--new">
            <span className="uc-stat__num">{rows.length}</span>
            <span className="uc-stat__label">월 데이터</span>
          </div>
          <div className="uc-stat uc-stat--ok">
            <span className="uc-stat__num">{drug?.name ?? drugId}</span>
            <span className="uc-stat__label">안국약품 · 종병</span>
          </div>
        </div>
        {fileName && <div className="uc-col-nav-wrap"><span className="uc-filename">{fileName}</span></div>}
        <div className="preview-table-wrap">
          <table className="preview-table">
            <thead>
              <tr>
                <th className="preview-th preview-th--vendor">월</th>
                <th className="preview-th preview-th--week" style={{ textAlign: 'right' }}>처방조제액(원)</th>
              </tr>
            </thead>
            <tbody>
              {sorted.map(({ month_id, sales }) => (
                <tr key={month_id} className="preview-row preview-row--mine">
                  <td className="preview-td preview-td--vendor">{month_id}</td>
                  <td className="preview-td preview-td--value">{fmtSales(sales)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {saveError && <div className="admin-error">{saveError}</div>}
      </>
    );
  };

  /* ── 탭 콘텐츠 렌더링 ── */
  const renderContent = () => {
    if (isSales) return renderSalesContent();
    if (!activeTab) return null;

    const { drugId, rows } = activeTab;
    const state = tabState[drugId];

    if (!state || state.loading) {
      return (
        <div className="admin-loading">
          <span className="admin-spinner" />
          <span>기존 데이터 불러오는 중...</span>
        </div>
      );
    }

    if (state.error) {
      return <div className="admin-error">{state.error}</div>;
    }

    const drug     = findDrug(drugId);
    const metric   = drug?.metric ?? 'qty';
    const myVendor = drug?.myVendor ?? '';

    const parsedAgg                     = aggregate(rows);
    const { weeks, vendors, vendorMap } = parsedAgg;
    const { newWeeks, overlapWeeks, changes } = analyze(
      parsedAgg, state.existingMap, state.existingWeeks, metric
    );

    const colEnd   = colEndMap[drugId] ?? weeks.length;
    const startIdx = Math.max(0, colEnd - COLS_PER_PAGE);
    const visibleWeeks = weeks.slice(startIdx, colEnd);

    const fmt = v => (v ?? 0).toLocaleString();

    const sortedVendors = [...vendors].sort((a, b) => {
      if (a === myVendor) return -1;
      if (b === myVendor) return 1;
      const totA = weeks.reduce((s, w) => s + (vendorMap[a]?.[w]?.[metric] ?? 0), 0);
      const totB = weeks.reduce((s, w) => s + (vendorMap[b]?.[w]?.[metric] ?? 0), 0);
      return totB - totA;
    });

    // 변경값 빠른 검색용 맵: "vendor::weekId" → change
    const changeMap = {};
    for (const c of changes) changeMap[`${c.vendor}::${c.weekId}`] = c;

    return (
      <>
        {/* 통계 바 */}
        <div className="uc-stats">
          <div className="uc-stat uc-stat--new">
            <span className="uc-stat__num">{newWeeks.size}</span>
            <span className="uc-stat__label">신규 주차 추가</span>
          </div>
          <div className={`uc-stat uc-stat--changed${changes.length > 0 ? ' uc-stat--has' : ''}`}>
            <span className="uc-stat__num">{changes.length}</span>
            <span className="uc-stat__label">기존값 변경</span>
          </div>
          <div className="uc-stat uc-stat--ok">
            <span className="uc-stat__num">{overlapWeeks.length}</span>
            <span className="uc-stat__label">기존 주차 확인</span>
          </div>
        </div>

        {/* 변경값 경고 패널 */}
        {changes.length > 0 && (
          <div className="uc-warning">
            <div className="uc-warning__header">
              <svg className="uc-warning__icon" width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
                <path d="M8 1.5L14.5 13H1.5L8 1.5Z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round"/>
                <path d="M8 6v3.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
                <circle cx="8" cy="11.5" r="0.75" fill="currentColor"/>
              </svg>
              <span className="uc-warning__title">
                기존 데이터와 다른 값이 {changes.length}개 있습니다
              </span>
            </div>
            <div className="uc-warning__list">
              {changes.slice(0, 12).map((c, i) => (
                <div key={i} className="uc-warning__item">
                  <span className="uc-warning__vendor">{c.vendor}</span>
                  <span className="uc-warning__week">{fmtWeekLabel(c.weekId)}</span>
                  <span className="uc-warning__diff">
                    <span className="uc-warning__old">{fmt(c.oldVal)}</span>
                    <span className="uc-warning__arrow">→</span>
                    <span className="uc-warning__new">{fmt(c.newVal)}</span>
                    {c.newVal > c.oldVal
                      ? <span className="uc-badge uc-badge--up">▲</span>
                      : <span className="uc-badge uc-badge--down">▼</span>
                    }
                  </span>
                </div>
              ))}
              {changes.length > 12 && (
                <div className="uc-warning__more">외 {changes.length - 12}건 더...</div>
              )}
            </div>
          </div>
        )}

        {/* 컬럼 페이지네이션 */}
        <div className="uc-col-nav-wrap">
          {fileName && <span className="uc-filename">{fileName}</span>}
          <div className="preview-col-nav">
            <button
              className="preview-col-btn"
              onClick={() =>
                setColEndMap(prev => ({
                  ...prev,
                  [drugId]: Math.max(COLS_PER_PAGE, colEnd - COLS_PER_PAGE),
                }))
              }
              disabled={startIdx === 0}
            >← 이전</button>
            <button
              className="preview-col-btn"
              onClick={() =>
                setColEndMap(prev => ({
                  ...prev,
                  [drugId]: Math.min(weeks.length, colEnd + COLS_PER_PAGE),
                }))
              }
              disabled={colEnd >= weeks.length}
            >다음 →</button>
          </div>
        </div>

        {/* 데이터 테이블 */}
        <div className="preview-table-wrap">
          <table className="preview-table">
            <thead>
              <tr>
                <th className="preview-th preview-th--vendor">제조사</th>
                {visibleWeeks.map(w => (
                  <th
                    key={w}
                    className={`preview-th preview-th--week${newWeeks.has(w) ? ' uc-th--new' : ''}`}
                  >
                    {newWeeks.has(w) && <span className="uc-new-badge">NEW</span>}
                    <span>{fmtWeekLabel(w)}</span>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {sortedVendors.map(vendor => (
                <tr
                  key={vendor}
                  className={`preview-row${vendor === myVendor ? ' preview-row--mine' : ''}`}
                >
                  <td className="preview-td preview-td--vendor">{vendor}</td>
                  {visibleWeeks.map(w => {
                    const val    = vendorMap[vendor]?.[w]?.[metric] ?? 0;
                    const isNew  = newWeeks.has(w);
                    const change = !isNew ? changeMap[`${vendor}::${w}`] : null;

                    let cls = 'preview-td preview-td--value';
                    if (isNew)   cls += ' uc-td--new';
                    else if (change) cls += ' uc-td--changed';
                    else if (val === 0) cls += ' preview-td--zero';

                    return (
                      <td
                        key={w}
                        className={cls}
                        title={change
                          ? `기존: ${fmt(change.oldVal)}  →  신규: ${fmt(change.newVal)}`
                          : undefined}
                      >
                        {fmt(val)}
                        {change && (
                          <span className={`uc-cell-arrow${change.newVal > change.oldVal ? ' uc-cell-arrow--up' : ' uc-cell-arrow--down'}`}>
                            {change.newVal > change.oldVal ? '▲' : '▼'}
                          </span>
                        )}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {saveError && (
          <div className="admin-error">
            {saveError}
          </div>
        )}
      </>
    );
  };

  if (!parsed) return null;

  return (
    <AdminLayout heading={heading}>
      {/* 탭 바 */}
      <div className="preview-tabbar">
        <div className="preview-tabs">
          {tabs.map((tab, idx) => (
            <button
              key={tab.drugId}
              className={`preview-tab${idx === activeIdx ? ' preview-tab--active' : ''}`}
              onClick={() => setActiveIdx(idx)}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {renderContent()}
    </AdminLayout>
  );
}
