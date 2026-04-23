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
      .select('product, vendor, week_id, rx_value, qty_value')
      .eq('drug_id', drugId)
      .range(from, from + PAGE - 1);

    if (error) throw new Error(error.message);
    if (!data || data.length === 0) break;
    allData = allData.concat(data);
    if (data.length < PAGE) break;
    from += PAGE;
  }

  const existingMap   = {};  // `product||vendor` → week_id → { rx, qty }
  const existingWeeks = new Set();

  for (const row of allData) {
    existingWeeks.add(row.week_id);
    const key = `${row.product || ''}||${row.vendor || ''}`;
    if (!existingMap[key]) existingMap[key] = {};
    existingMap[key][row.week_id] = {
      rx:  row.rx_value  ?? 0,
      qty: row.qty_value ?? 0,
    };
  }

  return { existingMap, existingWeeks };
}

/** 파싱된 rows → (product||vendor) × week 집계 맵 */
function aggregate(rows) {
  const vendorMap  = {};  // key(`product||vendor`) → week_id → { rx, qty }
  const metaMap    = {};  // key → { product, vendor, dosageForm }
  const dosageSets = {};  // key → Set<string>
  const weekSet    = new Set();

  for (const row of rows) {
    weekSet.add(row.week_id);
    const key = `${row.product || ''}||${row.vendor || ''}`;
    if (!vendorMap[key]) {
      vendorMap[key]  = {};
      metaMap[key]    = { product: row.product || '', vendor: row.vendor || '', dosageForm: '' };
      dosageSets[key] = new Set();
    }
    if (row.dosage_form) dosageSets[key].add(row.dosage_form);
    if (!vendorMap[key][row.week_id])
      vendorMap[key][row.week_id] = { rx: 0, qty: 0 };
    vendorMap[key][row.week_id].rx  += row.rx_value  ?? 0;
    vendorMap[key][row.week_id].qty += row.qty_value ?? 0;
  }

  for (const key of Object.keys(metaMap)) {
    metaMap[key].dosageForm = [...dosageSets[key]].join('/');
  }

  return {
    weeks:   [...weekSet].sort(),
    vendors: Object.keys(vendorMap),
    vendorMap,
    metaMap,
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

/** 시장 합계 기준 10% 이상 차이 주차 감지 (최신 1주 제외) */
function checkAnomalies(parsedAgg, existingMap, existingWeeks, metric) {
  if (existingWeeks.size === 0) return [];
  const { weeks, vendors, vendorMap } = parsedAgg;
  const overlapWeeks = weeks.filter(w => existingWeeks.has(w));
  const checkWeeks   = overlapWeeks.slice(0, -1); // 최신 1주 제외
  if (checkWeeks.length === 0) return [];

  const anomalies = [];
  for (const weekId of checkWeeks) {
    const newTotal = vendors.reduce(
      (s, v) => s + (vendorMap[v]?.[weekId]?.[metric] ?? 0), 0
    );
    const existingTotal = Object.values(existingMap).reduce(
      (s, weekMap) => s + (weekMap[weekId]?.[metric] ?? 0), 0
    );
    if (existingTotal === 0) continue;
    const diff = Math.abs(newTotal - existingTotal) / existingTotal;
    if (diff > 0.10) anomalies.push({ weekId, newTotal, existingTotal, diff });
  }
  return anomalies;
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
  const [activeIdx,    setActiveIdx]    = useState(0);
  const [saving,       setSaving]       = useState(false);
  const [saveError,    setSaveError]    = useState('');
  const [tabState,     setTabState]     = useState({});
  const [colEndMap,    setColEndMap]    = useState({});
  const [checkedDrugs, setCheckedDrugs] = useState(
    () => new Set(parsed?.results?.map(r => r.drugId) ?? [])
  );

  const toggleDrug = (drugId) => {
    setCheckedDrugs(prev => {
      const next = new Set(prev);
      next.has(drugId) ? next.delete(drugId) : next.add(drugId);
      return next;
    });
  };

  /* ── 리다이렉트: 상태 없이 진입 ── */
  useEffect(() => {
    if (!parsed) navigate('/admin', { replace: true });
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const activeTab = tabs[activeIdx] ?? null;

  /* ── 마운트 시 모든 탭 데이터 로드 + 이상 감지 ── */
  useEffect(() => {
    if (isSales || !parsed?.results) return;
    parsed.results.forEach(({ drugId, rows }) => {
      setTabState(prev => ({
        ...prev,
        [drugId]: { loading: true, existingMap: {}, existingWeeks: new Set(), error: '', anomalies: [] },
      }));
      const drug   = findDrug(drugId);
      const metric = drug?.metric ?? 'qty';
      fetchExisting(drugId)
        .then(({ existingMap, existingWeeks }) => {
          const parsedAgg = aggregate(rows);
          const anomalies = checkAnomalies(parsedAgg, existingMap, existingWeeks, metric);
          setTabState(prev => ({
            ...prev,
            [drugId]: { loading: false, existingMap, existingWeeks, error: '', anomalies },
          }));
        })
        .catch(e => {
          setTabState(prev => ({
            ...prev,
            [drugId]: { loading: false, existingMap: {}, existingWeeks: new Set(), error: e.message, anomalies: [] },
          }));
        });
    });
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

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

        for (const { drugId, rows } of parsed.results) {
          if (!checkedDrugs.has(drugId)) continue; // 체크 해제된 품목 스킵
          for (let i = 0; i < rows.length; i += BATCH_SIZE) {
            const batch = rows.slice(i, i + BATCH_SIZE).map(
              ({ drug_id, product, vendor, week_id, rx_value, qty_value }) =>
                ({ drug_id, product, vendor, week_id, rx_value, qty_value })
            );
            const { error: err } = await supabase
              .from('weekly_data')
              .upsert(batch, { onConflict: 'drug_id,product,vendor,week_id' });
            if (err) throw new Error(err.message);
          }
        }
        for (const { drugId, rows } of parsed.results) {
          if (!checkedDrugs.has(drugId)) continue;
          const drug       = findDrug(drugId);
          if (!drug) continue;
          const latestWeek = rows.map(r => r.week_id).filter(Boolean).sort().at(-1);
          if (latestWeek) localStorage.setItem(`ag_weekly_latest_${drug.id}`, latestWeek);
          localStorage.setItem(`ag_upload_${drug.id}_처방`, now);
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
            disabled={saving || (!isSales && checkedDrugs.size === 0)}
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
          <table className="preview-table ag-table">
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

    const anomalies = state.anomalies ?? [];

    const drug     = findDrug(drugId);
    const metric   = drug?.metric ?? 'qty';
    const myVendor = drug?.myVendor ?? '';

    const parsedAgg                              = aggregate(rows);
    const { weeks, vendors, vendorMap, metaMap } = parsedAgg;
    const { newWeeks, overlapWeeks, changes }    = analyze(
      parsedAgg, state.existingMap, state.existingWeeks, metric
    );

    const colEnd   = colEndMap[drugId] ?? weeks.length;
    const startIdx = Math.max(0, colEnd - COLS_PER_PAGE);
    const visibleWeeks = weeks.slice(startIdx, colEnd);

    const fmt = v => (v ?? 0).toLocaleString();

    const sortedVendors = [...vendors].sort((a, b) => {
      const aIsMe = metaMap[a]?.vendor === myVendor;
      const bIsMe = metaMap[b]?.vendor === myVendor;
      if (aIsMe) return -1;
      if (bIsMe) return 1;
      const totA = weeks.reduce((s, w) => s + (vendorMap[a]?.[w]?.[metric] ?? 0), 0);
      const totB = weeks.reduce((s, w) => s + (vendorMap[b]?.[w]?.[metric] ?? 0), 0);
      return totB - totA;
    });

    // 표시 행: 안국약품 포함 상위 20개
    const myRows      = sortedVendors.filter(k => metaMap[k]?.vendor === myVendor);
    const topOther    = sortedVendors
      .filter(k => metaMap[k]?.vendor !== myVendor)
      .slice(0, Math.max(0, 20 - myRows.length));
    const displayVendors = [...myRows, ...topOther];

    // 변경값 빠른 검색용 맵: "key::weekId" → change
    const changeMap = {};
    for (const c of changes) changeMap[`${c.vendor}::${c.weekId}`] = c;

    return (
      <>
        {/* 이상 감지 블록 */}
        {anomalies.length > 0 && (
          <div className="uc-anomaly">
            <svg className="uc-anomaly__icon" width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
              <path d="M8 1.5L14.5 13H1.5L8 1.5Z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round"/>
              <path d="M8 6v3.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
              <circle cx="8" cy="11.5" r="0.75" fill="currentColor"/>
            </svg>
            <div className="uc-anomaly__body">
              <strong className="uc-anomaly__title">데이터 이상 감지 — 확인 후 저장 가능</strong>
              <p className="uc-anomaly__desc">기존 데이터 대비 10% 이상 차이나는 주차가 있습니다. 파일을 확인해주세요.</p>
              <div className="uc-anomaly__list">
                {anomalies.map(a => (
                  <span key={a.weekId} className="uc-anomaly__item">
                    {fmtWeekLabel(a.weekId)}: {(a.diff * 100).toFixed(1)}% 차이
                    ({Math.round(a.existingTotal).toLocaleString()} → {Math.round(a.newTotal).toLocaleString()})
                  </span>
                ))}
              </div>
            </div>
          </div>
        )}

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
              {changes.slice(0, 12).map((c, i) => {
                const wMeta  = metaMap[c.vendor] ?? { product: '', vendor: c.vendor };
                const wLabel = wMeta.product ? `${wMeta.product} (${wMeta.vendor})` : wMeta.vendor;
                return (
                  <div key={i} className="uc-warning__item">
                    <span className="uc-warning__vendor">{wLabel}</span>
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
                );
              })}
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

        {/* 주차별 상세 테이블 */}
        <div className="preview-table-wrap">
          <table className="preview-table ag-table">
            <thead>
              <tr>
                <th className="preview-th preview-th--vendor">제품명</th>
                <th className="preview-th preview-th--vendor2">제조사</th>
                <th className="preview-th preview-th--form">제형</th>
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
              {displayVendors.map(key => {
                const meta = metaMap[key] ?? { product: '', vendor: key, dosageForm: '' };
                const isMe = meta.vendor === myVendor;
                return (
                  <tr
                    key={key}
                    className={`preview-row${isMe ? ' preview-row--mine' : ''}`}
                  >
                    <td className="preview-td preview-td--vendor">{meta.product || '—'}</td>
                    <td className="preview-td preview-td--vendor2">{meta.vendor}</td>
                    <td className="preview-td preview-td--form">{meta.dosageForm || '—'}</td>
                    {visibleWeeks.map(w => {
                      const val    = vendorMap[key]?.[w]?.[metric] ?? 0;
                      const isNew  = newWeeks.has(w);
                      const change = !isNew ? changeMap[`${key}::${w}`] : null;

                      let cls = 'preview-td preview-td--value';
                      if (isNew)        cls += ' uc-td--new';
                      else if (change)  cls += ' uc-td--changed';
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
                );
              })}
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
          {tabs.map((tab, idx) => {
            const hasAnomaly = (tabState[tab.drugId]?.anomalies?.length ?? 0) > 0;
            return (
              <button
                key={tab.drugId}
                className={`preview-tab${idx === activeIdx ? ' preview-tab--active' : ''}${hasAnomaly ? ' preview-tab--anomaly' : ''}`}
                onClick={() => setActiveIdx(idx)}
              >
                {!isSales && (
                  <input
                    type="checkbox"
                    className="uc-tab-check"
                    checked={checkedDrugs.has(tab.drugId)}
                    disabled={false}
                    onChange={() => {}}
                    onClick={e => { e.stopPropagation(); if (!hasAnomaly) toggleDrug(tab.drugId); }}
                  />
                )}
                {tab.label}
                {hasAnomaly && <span className="uc-tab-warn">⚠</span>}
              </button>
            );
          })}
        </div>
      </div>

      {renderContent()}
    </AdminLayout>
  );
}
