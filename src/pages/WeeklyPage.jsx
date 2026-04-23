import React, { useState, useMemo, useCallback, useEffect, useRef } from 'react';
import { useParams } from 'react-router-dom';
import { DRUGS } from '../config/drugs';
import { WEEKLY_SECTION_CONFIG, WEEKLY_PRODUCT_FILTER } from '../config/weeklyConfig';
import { loadWeeklyRaw } from '../utils/supabaseLoader';
import { weekIdToYearMonth } from '../utils/weekUtils';
import MainLayout from '../components/MainLayout';
import './WeeklyPage.css';


/* ────────────────────────────────────────────────
   weekly_data → WeeklyPage 포맷 변환 (M/S 계산 포함)
──────────────────────────────────────────────── */
function buildRowsFromWeeklyData(rawData, drug, sectionConfig, productFilter) {
  const grouped    = {};  // `product||vendor` → week_id → { qty, rx }
  const weekTotals = {};  // week_id → { qty, rx } (전체 시장 합계 — Others 계산에 필요)

  for (const row of rawData) {
    const product  = (row.product || '').trim();
    const vendor   = (row.vendor  || '').trim();
    const weekId   = row.week_id;
    const key      = `${product}||${vendor}`;

    if (!grouped[key])          grouped[key]          = {};
    if (!grouped[key][weekId])  grouped[key][weekId]  = { qty: 0, rx: 0 };
    grouped[key][weekId].qty += row.qty_value ?? 0;
    grouped[key][weekId].rx  += row.rx_value  ?? 0;

    if (!weekTotals[weekId]) weekTotals[weekId] = { qty: 0, rx: 0 };
    weekTotals[weekId].qty += row.qty_value ?? 0;
    weekTotals[weekId].rx  += row.rx_value  ?? 0;
  }

  // 표시할 제품 목록 (필터 없으면 전체)
  const filterSet = productFilter ? new Set(productFilter) : null;

  const rows = [];

  for (const cfg of sectionConfig) {
    const metricKey = cfg.metric === 'rx_cnt' ? 'rx' : 'qty';

    // closedMarket: 필터된 제품 합계를 분모로 사용 (Others/전체 행 없음)
    if (cfg.closedMarket && filterSet) {
      const filteredTotals = {};
      for (const [pvKey, weeks] of Object.entries(grouped)) {
        const product = pvKey.slice(0, pvKey.indexOf('||'));
        if (!filterSet.has(product)) continue;
        for (const [weekId, vals] of Object.entries(weeks)) {
          if (!filteredTotals[weekId]) filteredTotals[weekId] = { qty: 0, rx: 0 };
          filteredTotals[weekId].qty += vals.qty;
          filteredTotals[weekId].rx  += vals.rx;
        }
      }
      for (const [pvKey, weeks] of Object.entries(grouped)) {
        const sepIdx       = pvKey.indexOf('||');
        const product      = pvKey.slice(0, sepIdx);
        const manufacturer = pvKey.slice(sepIdx + 2);
        if (!filterSet.has(product)) continue;
        for (const [weekId, vals] of Object.entries(weeks)) {
          const total = filteredTotals[weekId]?.[metricKey] ?? 0;
          const val   = vals[metricKey] ?? 0;
          rows.push({
            drug_id: drug.id, market_scope: cfg.scope, metric: cfg.metric,
            value_type: cfg.valueType, product, manufacturer, week_id: weekId,
            value: cfg.valueType === 'ms' ? (total > 0 ? val / total : 0) : val,
          });
        }
      }
      // 전체 행 — 4개 합계 기준
      for (const [weekId, totals] of Object.entries(filteredTotals)) {
        rows.push({
          drug_id: drug.id, market_scope: cfg.scope, metric: cfg.metric,
          value_type: cfg.valueType, product: '전체', manufacturer: '',
          week_id: weekId,
          value: cfg.valueType === 'ms' ? 1.0 : totals[metricKey],
        });
      }
      continue;
    }

    // 일반: 전체 시장 합계를 분모로 사용
    for (const [pvKey, weeks] of Object.entries(grouped)) {
      const sepIdx       = pvKey.indexOf('||');
      const product      = pvKey.slice(0, sepIdx);
      const manufacturer = pvKey.slice(sepIdx + 2);
      // product가 없는 경우(판매사 기준 집계) vendor 이름으로도 필터 매칭
      const filterKey = product || manufacturer;
      if (filterSet && !filterSet.has(filterKey)) continue;
      for (const [weekId, vals] of Object.entries(weeks)) {
        const total = weekTotals[weekId]?.[metricKey] ?? 0;
        const val   = vals[metricKey] ?? 0;
        rows.push({
          drug_id: drug.id, market_scope: cfg.scope, metric: cfg.metric,
          value_type: cfg.valueType, product, manufacturer, week_id: weekId,
          value: cfg.valueType === 'ms' ? (total > 0 ? val / total : 0) : val,
        });
      }
    }

    // Others = 전체 - 지정 제품 합계 (필터 적용 시에만)
    if (filterSet) {
      const listedTotals = {};
      for (const [pvKey, weeks] of Object.entries(grouped)) {
        const si = pvKey.indexOf('||');
        const product = pvKey.slice(0, si);
        const mfr     = pvKey.slice(si + 2);
        const filterKey = product || mfr;
        if (!filterSet.has(filterKey)) continue;
        for (const [weekId, vals] of Object.entries(weeks)) {
          if (!listedTotals[weekId]) listedTotals[weekId] = { qty: 0, rx: 0 };
          listedTotals[weekId].qty += vals.qty;
          listedTotals[weekId].rx  += vals.rx;
        }
      }
      for (const [weekId, totals] of Object.entries(weekTotals)) {
        const listed = listedTotals[weekId]?.[metricKey] ?? 0;
        const others = totals[metricKey] - listed;
        const total  = totals[metricKey];
        rows.push({
          drug_id: drug.id, market_scope: cfg.scope, metric: cfg.metric,
          value_type: cfg.valueType, product: 'Others', manufacturer: '',
          week_id: weekId,
          value: cfg.valueType === 'ms' ? (total > 0 ? others / total : 0) : others,
        });
      }
    }

    for (const [weekId, totals] of Object.entries(weekTotals)) {
      rows.push({
        drug_id: drug.id, market_scope: cfg.scope, metric: cfg.metric,
        value_type: cfg.valueType, product: '전체', manufacturer: '',
        week_id: weekId,
        value: cfg.valueType === 'ms' ? 1.0 : totals[metricKey],
      });
    }
  }

  return rows;
}

/* ────────────────────────────────────────────────
   데이터 변환
──────────────────────────────────────────────── */
function buildSections(rawRows, sectionConfig, maxProducts, productFilter) {
  const sectionMap = {};
  rawRows.forEach(row => {
    const key = `${row.market_scope}|${row.value_type}|${row.metric}`;
    if (!sectionMap[key]) sectionMap[key] = [];
    sectionMap[key].push(row);
  });
  return sectionConfig.map(cfg => {
    const key         = `${cfg.scope}|${cfg.valueType}|${cfg.metric}`;
    const sectionRows = sectionMap[key] ?? [];
    const productMap  = {};
    const weekSet     = new Set();
    sectionRows.forEach(row => {
      const pKey = `${row.product}||${row.manufacturer}`;
      if (!productMap[pKey]) {
        productMap[pKey] = { product: row.product, manufacturer: row.manufacturer, values: {} };
      }
      productMap[pKey].values[row.week_id] = row.value;
      weekSet.add(row.week_id);
    });
    const orderMap = productFilter
      ? Object.fromEntries(productFilter.map((p, i) => [p, i]))
      : null;
    const sorted = Object.values(productMap).sort((a, b) => {
      const rank = r => r.product === '전체' ? 2 : r.product === 'Others' ? 1 : 0;
      const ra = rank(a), rb = rank(b);
      if (ra !== rb) return ra - rb;
      if (orderMap) {
        const oa = orderMap[a.product] ?? orderMap[a.manufacturer] ?? 999;
        const ob = orderMap[b.product] ?? orderMap[b.manufacturer] ?? 999;
        if (oa !== ob) return oa - ob;
      }
      const sum = r => Object.values(r.values).reduce((s, v) => s + (v ?? 0), 0);
      return sum(b) - sum(a);
    });
    // 필터 미지정 시 상위 N개만 표시 (전체/Others 제외 후 슬라이스)
    const rows = maxProducts
      ? [
          ...sorted.filter(r => r.product !== '전체' && r.product !== 'Others').slice(0, maxProducts),
          ...sorted.filter(r => r.product === 'Others' || r.product === '전체'),
        ]
      : sorted;
    return { ...cfg, weeks: [...weekSet].sort(), rows };
  });
}

function groupWeeksByMonth(weeks) {
  const monthMap = {};
  weeks.forEach(weekId => {
    const ym = weekIdToYearMonth(weekId);
    if (!ym) return;
    const key = `${ym.year}-${String(ym.month).padStart(2, '0')}`;
    if (!monthMap[key]) {
      monthMap[key] = {
        key, year: ym.year, month: ym.month,
        label: `${String(ym.year).slice(2)}년 ${ym.month}월`,
        weeks: [],
      };
    }
    monthMap[key].weeks.push(weekId);
  });
  return Object.values(monthMap).sort((a, b) => a.key.localeCompare(b.key));
}

function monthAvg(row, mo) {
  const vals = mo.weeks.map(w => row.values[w]).filter(v => v != null);
  if (!vals.length) return null;
  return vals.reduce((s, v) => s + v, 0) / vals.length;
}

function calcWoWGrowth(row, weeks) {
  if (weeks.length < 2) return null;
  const cur  = row.values[weeks[weeks.length - 1]];
  const prev = row.values[weeks[weeks.length - 2]];
  if (cur == null || prev == null || prev === 0) return null;
  return (cur / prev - 1) * 100;
}

function calcMoMGrowth(row, allMonths) {
  if (allMonths.length < 2) return null;
  const cur  = monthAvg(row, allMonths[allMonths.length - 1]);
  const prev = monthAvg(row, allMonths[allMonths.length - 2]);
  if (cur == null || prev == null || prev === 0) return null;
  return (cur / prev - 1) * 100;
}

/* ────────────────────────────────────────────────
   포맷 헬퍼
──────────────────────────────────────────────── */
function weekLabel(weekId) {
  const m = String(weekId || '').match(/(\d{2})\.(\d{2})주/);
  if (!m) return weekId;
  const year     = 2000 + parseInt(m[1], 10);
  const weekNum  = parseInt(m[2], 10);
  const jan4     = new Date(year, 0, 4);
  const dow      = jan4.getDay() || 7;
  const week1Mon = new Date(jan4);
  week1Mon.setDate(jan4.getDate() - (dow - 1));
  const sat = new Date(week1Mon);
  sat.setDate(week1Mon.getDate() + (weekNum - 1) * 7 + 5);
  const mm = String(sat.getMonth() + 1).padStart(2, '0');
  const dd = String(sat.getDate()).padStart(2, '0');
  return `${mm}.${dd}`;
}

const fmtMs  = v => v == null ? '-' : v >= 1 ? '100.0%' : (v * 100).toFixed(1) + '%';
const fmtRaw = v => v == null ? '-' : Math.round(v).toLocaleString();
const fmtVal = (v, t) => t === 'ms' ? fmtMs(v) : fmtRaw(v);

const fmtGrowth  = v => v == null ? '-' : `${v >= 0 ? '+' : ''}${v.toFixed(1)}%`;
const growthClass = v => v == null ? '' : v > 0 ? 'wt-diff--up' : v < 0 ? 'wt-diff--down' : '';


function rowType(row, myVendor) {
  if (row.product === '전체')        return 'total';
  if (row.product === 'Others')      return 'others';
  if (row.manufacturer === myVendor) return 'ankuk';
  return 'normal';
}

/* ────────────────────────────────────────────────
   스켈레톤 로더
──────────────────────────────────────────────── */
const SKEL_COLS = [1, 2, 3, 4, 5, 6, 7, 8];
const SKEL_ROWS = [1, 2, 3, 4, 5, 6, 7, 8, 9];

function WeeklySkeleton() {
  return (
    <div className="wt-skeleton">
      {[0, 1].map(si => (
        <div key={si} className="wt-skeleton-section">
          <div className="wt-skeleton-title" />
          <div className="wt-skeleton-table">
            <div className="wt-skeleton-row wt-skeleton-row--header">
              {SKEL_COLS.map(c => <div key={c} className="wt-skeleton-cell" />)}
            </div>
            {SKEL_ROWS.map(r => (
              <div key={r} className="wt-skeleton-row">
                {SKEL_COLS.map(c => <div key={c} className="wt-skeleton-cell" />)}
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

/* ────────────────────────────────────────────────
   섹션 테이블
──────────────────────────────────────────────── */
function SectionTable({ section, visibleMonths, allMonths, expandedMonths, onToggle, myVendor, onWheelNav, sectionIdx, registerRef, currentMonthKey }) {
  const { rows, weeks, valueType } = section;
  const wrapRef = useRef(null);

  const setRef = useCallback((el) => {
    wrapRef.current = el;
    registerRef(sectionIdx, el);
  }, [registerRef, sectionIdx]);

  useEffect(() => {
    const el = wrapRef.current;
    if (!el || !onWheelNav) return;
    el.addEventListener('wheel', onWheelNav, { passive: false });
    return () => el.removeEventListener('wheel', onWheelNav);
  }, [onWheelNav]);

  return (
    <div className="wt-wrap" ref={setRef}>
      <table className="wt-table">
        <colgroup>
          <col className="wt-col-product" />
          <col className="wt-col-mfr" />
          <col className="wt-col-stat" />
          <col className="wt-col-stat" />
          {visibleMonths.map(mo =>
            expandedMonths.has(mo.key) ? (
              <React.Fragment key={mo.key}>
                {mo.weeks.map(w => <col key={w} className="wt-col-week" />)}
                <col className="wt-col-avg" />
              </React.Fragment>
            ) : (
              <col key={mo.key} className="wt-col-avg" />
            )
          )}
        </colgroup>

        <thead>
          {/* ── 단일 헤더 행 ── */}
          <tr>
            <th className="wt-th wt-th--fixed wt-th--product">제품</th>
            <th className="wt-th wt-th--fixed wt-th--mfr">제조사</th>
            <th className="wt-th wt-th--stat wt-th--stat-sticky wt-stat-s1">전주대비</th>
            <th className="wt-th wt-th--stat wt-th--stat-sticky wt-stat-s2 wt-stat-last">전월대비</th>

            {visibleMonths.map(mo => {
              const isOpen      = expandedMonths.has(mo.key);
              // weeks는 오름차순 → reverse로 최신이 왼쪽
              const weeksDesc   = [...mo.weeks].reverse();

              const isCurrent = mo.key === currentMonthKey;

              if (isOpen) {
                return (
                  <React.Fragment key={mo.key}>
                    {weeksDesc.map((w, wi) => (
                      <th
                        key={w}
                        className="wt-th wt-th--week-date wt-th--week-toggle"
                        onClick={() => onToggle(mo.key)}
                      >
                        {weekLabel(w)}
                      </th>
                    ))}
                    <th className={`wt-th wt-th--avg-label ${isCurrent ? 'wt-th--current' : ''}`}>{mo.month}월 평균</th>
                  </React.Fragment>
                );
              }

              return (
                <th
                  key={mo.key}
                  className={`wt-th wt-th--month ${isCurrent ? 'wt-th--current' : ''}`}
                  onClick={() => onToggle(mo.key)}
                >
                  {mo.label}
                  <span className="wt-month-arrow">▸</span>
                </th>
              );
            })}
          </tr>
        </thead>

        <tbody>
          {rows.map(row => {
            const type = rowType(row, myVendor);

            return (
              <tr key={`${row.product}||${row.manufacturer}`} className={`wt-tr wt-tr--${type}`}>
                {(type === 'others' || type === 'total' || row.product === row.manufacturer)
                  ? <td colSpan={2} className="wt-td wt-td--product wt-td--product-span">{row.product || row.manufacturer}</td>
                  : <><td className="wt-td wt-td--product">{row.product}</td>
                     <td className="wt-td wt-td--mfr">{row.manufacturer}</td></>
                }
                {(() => {
                  const wow = calcWoWGrowth(row, weeks);
                  const mom = calcMoMGrowth(row, allMonths);
                  return (<>
                    <td className={`wt-td wt-td--stat wt-td--stat-sticky wt-stat-s1 ${growthClass(wow)}`}>
                      {fmtGrowth(wow)}
                    </td>
                    <td className={`wt-td wt-td--stat wt-td--stat-sticky wt-stat-s2 wt-stat-last ${growthClass(mom)}`}>
                      {fmtGrowth(mom)}
                    </td>
                  </>);
                })()}

                {visibleMonths.map(mo => {
                  const isOpen    = expandedMonths.has(mo.key);
                  const weeksDesc = [...mo.weeks].reverse();
                  const avg       = monthAvg(row, mo);
                  const isCurrent = mo.key === currentMonthKey;

                  if (isOpen) {
                    return (
                      <React.Fragment key={mo.key}>
                        {weeksDesc.map(w => (
                          <td key={w} className="wt-td wt-td--week-val">
                            {fmtVal(row.values[w], valueType)}
                          </td>
                        ))}
                        <td className={`wt-td wt-td--avg ${isCurrent ? 'wt-td--current' : ''}`}>{fmtVal(avg, valueType)}</td>
                      </React.Fragment>
                    );
                  }

                  return (
                    <td key={mo.key} className={`wt-td wt-td--avg ${isCurrent ? 'wt-td--current' : ''}`}>
                      {fmtVal(avg, valueType)}
                    </td>
                  );
                })}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

/* ────────────────────────────────────────────────
   WeeklyPage
──────────────────────────────────────────────── */
export default function WeeklyPage() {
  const { drugId } = useParams();
  const drug = DRUGS.find(d => d.id === drugId);
  const sectionConfig = useMemo(() => WEEKLY_SECTION_CONFIG[drugId] ?? [], [drugId]);

  const [rawRows,        setRawRows]        = useState(null);
  const [expandedMonths, setExpandedMonths] = useState(new Set());

  const sectionWrapRefs = useRef({});

  useEffect(() => {
    if (!drugId) return;
    setRawRows(null);
    setExpandedMonths(new Set());

    loadWeeklyRaw(drug?.dbId ?? drugId)
      .then(data => {
        if (!data || data.length === 0) { setRawRows([]); return; }
        const filter = WEEKLY_PRODUCT_FILTER[drugId] ?? null;
        setRawRows(buildRowsFromWeeklyData(data, drug, sectionConfig, filter));
      })
      .catch(() => setRawRows([]));
  }, [drugId, drug, sectionConfig]);

  // 필터 미지정 약품은 상위 5개만 표시
  const maxProducts = WEEKLY_PRODUCT_FILTER[drugId] ? null : 5;

  const productFilter = WEEKLY_PRODUCT_FILTER[drugId] ?? null;

  const sections = useMemo(() => {
    if (!rawRows) return [];
    return buildSections(rawRows, sectionConfig, maxProducts, productFilter);
  }, [rawRows, sectionConfig, maxProducts, productFilter]);

  const allMonths = useMemo(() => {
    const allWeeks = new Set();
    sections.forEach(s => s.weeks.forEach(w => allWeeks.add(w)));
    return groupWeeksByMonth([...allWeeks].sort());
  }, [sections]);

  // 모든 달 표시 (최신이 왼쪽)
  const visibleMonths = useMemo(() => [...allMonths].reverse(), [allMonths]);

  // 당월: 데이터상 가장 최근 달
  const currentMonthKey = allMonths.length > 0 ? allMonths[allMonths.length - 1].key : null;

  // 데이터 로드 후 당월 자동 펼침 + 스크롤 초기화
  useEffect(() => {
    if (rawRows === null) return;
    if (currentMonthKey) {
      setExpandedMonths(new Set([currentMonthKey]));
    }
    const timer = setTimeout(() => {
      Object.values(sectionWrapRefs.current).forEach(el => {
        if (el) el.scrollLeft = 0;
      });
    }, 50);
    return () => clearTimeout(timer);
  }, [rawRows, currentMonthKey]);

  const registerRef = useCallback((idx, el) => {
    sectionWrapRefs.current[idx] = el;
  }, []);

  // 휠 → 모든 섹션 동기 가로 스크롤 (부드러운 이징)
  const scrollTargetRef = useRef(null);   // 목표 scrollLeft
  const rafRef = useRef(null);

  const handleSectionWheel = useCallback((e) => {
    const delta = Math.abs(e.deltaX) >= Math.abs(e.deltaY) ? e.deltaX : e.deltaY;
    if (Math.abs(delta) < 1) return;
    e.preventDefault();

    // 대표 엘리먼트로 현재 위치 파악
    const els = Object.values(sectionWrapRefs.current).filter(Boolean);
    if (!els.length) return;
    const lead = els[0];

    if (scrollTargetRef.current === null) scrollTargetRef.current = lead.scrollLeft;
    scrollTargetRef.current = Math.max(
      0,
      Math.min(lead.scrollWidth - lead.clientWidth, scrollTargetRef.current + delta)
    );

    if (rafRef.current) return; // 이미 애니메이션 중

    const animate = () => {
      const target = scrollTargetRef.current;
      const current = lead.scrollLeft;
      const diff = target - current;

      if (Math.abs(diff) < 0.5) {
        // 도착
        els.forEach(el => { el.scrollLeft = target; });
        scrollTargetRef.current = null;
        rafRef.current = null;
        return;
      }

      const next = current + diff * 0.18; // 이징 강도 (0.1 느림 ↔ 0.3 빠름)
      els.forEach(el => { el.scrollLeft = next; });
      rafRef.current = requestAnimationFrame(animate);
    };

    rafRef.current = requestAnimationFrame(animate);
  }, []);

  const toggleMonth = useCallback((key) => {
    setExpandedMonths(prev => {
      const next = new Set(prev);
      next.has(key) ? next.delete(key) : next.add(key);
      return next;
    });
  }, []);

  if (!drug) {
    return (
      <MainLayout tableView>
        <div className="wt-empty">존재하지 않는 품목입니다.</div>
      </MainLayout>
    );
  }

  return (
    <MainLayout tableView>
      <div className="wt-page">
        <div className="wt-header">
          <div className="wt-header-left">
            <h1 className="wt-title">{drug.name} Weekly</h1>
            <span className="wt-subtitle">종합병원 8대품목 주간 현황 (UBIST)</span>
          </div>
        </div>

        {rawRows === null && <WeeklySkeleton />}

        {rawRows !== null && sections.map((section, i) => (
          <div key={i} className="wt-section">
            <div className="wt-section-header">
              <span className="wt-section-title">
                {section.title}
                <span className="wt-section-note">{section.note}</span>
              </span>
            </div>
            <SectionTable
              section={section}
              visibleMonths={visibleMonths}
              allMonths={allMonths}
              expandedMonths={expandedMonths}
              onToggle={toggleMonth}
              myVendor={drug.myVendor}
              onWheelNav={handleSectionWheel}
              sectionIdx={i}
              registerRef={registerRef}
              currentMonthKey={currentMonthKey}
            />
          </div>
        ))}

      </div>
    </MainLayout>
  );
}
