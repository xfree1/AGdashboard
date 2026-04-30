import React, { useState, useMemo, useCallback, useEffect, useRef } from 'react';
import { useParams } from 'react-router-dom';
import { DRUGS } from '../config/drugs';
import { WEEKLY_SECTION_CONFIG, WEEKLY_PRODUCT_FILTER, PCAB_NPCAB_DB_ID, WEEKLY_PRODUCT_ALIAS } from '../config/weeklyConfig';
import { loadWeeklyRaw } from '../utils/supabaseLoader';
import { weekIdToYearMonth, weekIdToSat } from '../utils/weekUtils';
import MainLayout from '../components/MainLayout';
import './WeeklyPage.css';


/* ────────────────────────────────────────────────
   weekly_data → WeeklyPage 포맷 변환 (M/S 계산 포함)
──────────────────────────────────────────────── */
function buildRowsFromWeeklyData(rawData, drug, sectionConfig, productFilter, productAlias) {
  const grouped    = {};  // `product||vendor` → week_id → { qty, rx }
  const weekTotals = {};  // week_id → { qty, rx } (전체 시장 합계 — Others 계산에 필요)

  for (const row of rawData) {
    const rawProduct = (row.product || '').trim();
    const product    = productAlias?.[rawProduct] ?? rawProduct;
    const vendor     = (row.vendor  || '').trim();
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

  // 디버그: 로드된 rawData → grouped 요약
  const allPvKeys = Object.keys(grouped);
  const weekCount = Object.keys(weekTotals).length;
  console.debug(`[buildRows] ${drug.id}: rawData=${rawData.length}행, product-vendor 조합=${allPvKeys.length}개, 주차=${weekCount}개`);

  // 표시할 제품 목록 (필터 없으면 전체)
  const filterSet = productFilter ? new Set(productFilter) : null;

  if (filterSet) {
    const passed = allPvKeys.filter(k => {
      const si = k.indexOf('||');
      const p  = k.slice(0, si);
      const v  = k.slice(si + 2);
      return filterSet.has(p || v);
    });
    const dropped = allPvKeys.filter(k => {
      const si = k.indexOf('||');
      const p  = k.slice(0, si);
      const v  = k.slice(si + 2);
      return !filterSet.has(p || v);
    });
    console.debug(`[buildRows] ${drug.id}: 필터 통과=${passed.length}개, 제외=${dropped.length}개`);
    if (dropped.length > 0 && dropped.length <= 10) {
      console.debug(`[buildRows] 제외된 키(샘플):`, dropped.slice(0, 10));
    }
  }

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

    // 누락 주차 감지 — 제품별 누락 주차 목록 수집
    const allWeekIds = [...weekSet];
    const gaps = []; // { product, manufacturer, weeks[] }
    Object.entries(productMap).forEach(([, item]) => {
      const missing = allWeekIds.filter(w => !(w in item.values));
      if (missing.length > 0) {
        gaps.push({ product: item.product, manufacturer: item.manufacturer, weeks: missing });
      }
    });
    const gapCount = gaps.reduce((s, g) => s + g.weeks.length, 0);
    const orderMap = productFilter
      ? Object.fromEntries(productFilter.map((p, i) => [p, i]))
      : null;
    const items = Object.values(productMap);
    const sumCache = new Map(items.map(r => [r, Object.values(r.values).reduce((s, v) => s + (v ?? 0), 0)]));
    const sorted = items.sort((a, b) => {
      const rank = r => r.product === '전체' ? 2 : r.product === 'Others' ? 1 : 0;
      const ra = rank(a), rb = rank(b);
      if (ra !== rb) return ra - rb;
      if (orderMap) {
        const oa = orderMap[a.product] ?? orderMap[a.manufacturer] ?? 999;
        const ob = orderMap[b.product] ?? orderMap[b.manufacturer] ?? 999;
        if (oa !== ob) return oa - ob;
      }
      return (sumCache.get(b) ?? 0) - (sumCache.get(a) ?? 0);
    });
    // 필터 미지정 시 상위 N개 + Others 자동 생성
    let rows;
    if (maxProducts) {
      const nonSpecial = sorted.filter(r => r.product !== '전체' && r.product !== 'Others');
      const topN = nonSpecial.slice(0, maxProducts);
      const rest = nonSpecial.slice(maxProducts);
      const othersValues = {};
      rest.forEach(r => {
        Object.entries(r.values).forEach(([weekId, val]) => {
          othersValues[weekId] = (othersValues[weekId] ?? 0) + (val ?? 0);
        });
      });
      rows = [
        ...topN,
        { product: 'Others', manufacturer: '', values: othersValues },
        ...sorted.filter(r => r.product === '전체'),
      ];
    } else {
      rows = sorted;
    }
    return { ...cfg, weeks: [...weekSet].sort(), rows, gapCount, gaps };
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

// MS 섹션 월평균: 주별 MS% 평균이 아닌, 처방량 절댓값 기준 가중 MS%
// pairedIdx: Map<"product||mfr", row> — 없으면 pairedRawRows 배열에서 find() 폴백
function monthAvgWeighted(row, mo, pairedRawRows, pairedIdx) {
  if (!pairedRawRows) return monthAvg(row, mo);
  const key         = `${row.product}||${row.manufacturer}`;
  const rawRow      = pairedIdx ? pairedIdx.get(key) : pairedRawRows.find(r => r.product === row.product && r.manufacturer === row.manufacturer);
  const totalRawRow = pairedIdx ? pairedIdx.get('전체||') : pairedRawRows.find(r => r.product === '전체');
  if (!rawRow || !totalRawRow) return monthAvg(row, mo);
  const sumRow   = mo.weeks.reduce((s, w) => s + (rawRow.values[w]      ?? 0), 0);
  const sumTotal = mo.weeks.reduce((s, w) => s + (totalRawRow.values[w] ?? 0), 0);
  if (sumTotal === 0) return null;
  return sumRow / sumTotal;
}

function calcWoWGrowth(row, weeks) {
  if (weeks.length < 2) return null;
  const cur  = row.values[weeks[weeks.length - 1]];
  const prev = row.values[weeks[weeks.length - 2]];
  if (cur == null || prev == null || prev === 0) return null;
  return (cur / prev - 1) * 100;
}

function calcMoMGrowth(row, allMonths, pairedRawRows, pairedIdx) {
  if (allMonths.length < 2) return null;
  const getAvg = (mo) => pairedRawRows
    ? monthAvgWeighted(row, mo, pairedRawRows, pairedIdx)
    : monthAvg(row, mo);
  const cur  = getAvg(allMonths[allMonths.length - 1]);
  const prev = getAvg(allMonths[allMonths.length - 2]);
  if (cur == null || prev == null || prev === 0) return null;
  return (cur / prev - 1) * 100;
}

/* ────────────────────────────────────────────────
   포맷 헬퍼
──────────────────────────────────────────────── */
function weekLabel(weekId) {
  const sat = weekIdToSat(weekId);
  if (!sat) return weekId;
  const sun = new Date(sat);
  sun.setDate(sat.getDate() - 6);
  const fmt = d => `${String(d.getMonth() + 1).padStart(2, '0')}.${String(d.getDate()).padStart(2, '0')}`;
  return `${fmt(sun)}~${fmt(sat)}`;
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
const SectionTable = React.memo(function SectionTable({ section, visibleMonths, expandedMonths, onToggle, myVendor, onWheelNav, sectionIdx, registerRef, currentMonthKey }) {
  const { rows, valueType, pairedRawRows } = section;
  const msRawRows = valueType === 'ms' ? pairedRawRows : null;
  const wrapRef = useRef(null);

  // pairedRawRows를 Map으로 인덱싱 — 렌더마다 find() O(n) 반복 방지
  const msRawIdx = useMemo(() => {
    if (!msRawRows) return null;
    const m = new Map();
    for (const r of msRawRows) m.set(`${r.product}||${r.manufacturer}`, r);
    return m;
  }, [msRawRows]);

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
                    {weeksDesc.map((w) => (
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
                <td className={`wt-td wt-td--stat wt-td--stat-sticky wt-stat-s1 ${growthClass(row.wowGrowth)}`}>
                  {fmtGrowth(row.wowGrowth)}
                </td>
                <td className={`wt-td wt-td--stat wt-td--stat-sticky wt-stat-s2 wt-stat-last ${growthClass(row.momGrowth)}`}>
                  {fmtGrowth(row.momGrowth)}
                </td>

                {visibleMonths.map(mo => {
                  const isOpen    = expandedMonths.has(mo.key);
                  const weeksDesc = [...mo.weeks].reverse();
                  const avg       = msRawRows
                    ? monthAvgWeighted(row, mo, msRawRows, msRawIdx)
                    : monthAvg(row, mo);
                  const isCurrent = mo.key === currentMonthKey;

                  if (isOpen) {
                    return (
                      <React.Fragment key={mo.key}>
                        {weeksDesc.map(w => (
                          <td key={w} className={`wt-td wt-td--week-val${row.values[w] == null ? ' wt-td--gap' : ''}`}>
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
});

/* ────────────────────────────────────────────────
   WeeklyPage
──────────────────────────────────────────────── */
export default function WeeklyPage() {
  const { drugId } = useParams();
  const drug = DRUGS.find(d => d.id === drugId);
  const sectionConfig = useMemo(() => WEEKLY_SECTION_CONFIG[drugId] ?? [], [drugId]);

  const [rawRows,        setRawRows]        = useState(null);
  const [expandedMonths, setExpandedMonths] = useState(new Set());
  const [openGapSection,  setOpenGapSection]  = useState(null); // 누락 상세 패널 열린 섹션 index

  const sectionWrapRefs = useRef({});

  useEffect(() => {
    if (!drugId || !drug) return;
    setRawRows(null);
    setExpandedMonths(new Set());

    let cancelled = false;

    const filter      = WEEKLY_PRODUCT_FILTER[drugId] ?? null;
    const npcabDbId   = PCAB_NPCAB_DB_ID[drugId];
    const npcabFilter = npcabDbId ? (WEEKLY_PRODUCT_FILTER[npcabDbId] ?? filter) : filter;
    const npcabAlias  = npcabDbId ? (WEEKLY_PRODUCT_ALIAS[npcabDbId] ?? null) : null;
    const pcabOutCfg  = sectionConfig.filter(s => s.scope === 'pcab_out');
    const pcabInCfg   = sectionConfig.filter(s => s.scope !== 'pcab_out');

    const loadIn  = pcabInCfg.length > 0
      ? loadWeeklyRaw(drug?.dbId ?? drugId)
      : Promise.resolve([]);
    const loadOut = pcabOutCfg.length > 0 && npcabDbId
      ? loadWeeklyRaw(npcabDbId)
      : Promise.resolve([]);

    Promise.all([loadIn, loadOut])
      .then(([allData, ppiData]) => {
        if (cancelled) return;
        console.debug(`[WeeklyPage] ${drugId}: pcabIn=${allData.length}행, pcabOut=${ppiData.length}행 수신`);
        const rows = [];
        if (pcabInCfg.length > 0 && allData.length > 0) {
          rows.push(...buildRowsFromWeeklyData(allData, drug, pcabInCfg, filter));
        }
        if (pcabOutCfg.length > 0 && ppiData.length > 0) {
          rows.push(...buildRowsFromWeeklyData(ppiData, drug, pcabOutCfg, npcabFilter, npcabAlias));
        }
        console.debug(`[WeeklyPage] ${drugId}: 최종 rawRows=${rows.length}행`);
        setRawRows(rows);
      })
      .catch((e) => {
        if (cancelled) return;
        console.error(`[WeeklyPage] ${drugId} 로드 실패:`, e);
        setRawRows([]);
      });

    return () => { cancelled = true; };
  }, [drugId, drug, sectionConfig]);

  const productFilter = WEEKLY_PRODUCT_FILTER[drugId] ?? null;
  const maxProducts   = productFilter ? null : 5;

  const sections = useMemo(() => {
    if (!rawRows) return [];
    // drugId가 바뀐 직후 rawRows에 이전 약품 데이터가 남아있을 수 있음 → 무시
    if (rawRows.length > 0 && rawRows[0].drug_id !== drugId) return [];
    const npcabDbId   = PCAB_NPCAB_DB_ID[drugId];
    const npcabFilter = npcabDbId ? (WEEKLY_PRODUCT_FILTER[npcabDbId] ?? productFilter) : productFilter;
    const pcabInCfg   = sectionConfig.filter(s => s.scope !== 'pcab_out');
    const pcabOutCfg  = sectionConfig.filter(s => s.scope === 'pcab_out');
    const pcabInRows  = rawRows.filter(r => r.market_scope !== 'pcab_out');
    const pcabOutRows = rawRows.filter(r => r.market_scope === 'pcab_out');
    const inSecs  = pcabInCfg.length  > 0 ? buildSections(pcabInRows,  pcabInCfg,  maxProducts, productFilter) : [];
    const outSecs = pcabOutCfg.length > 0 ? buildSections(pcabOutRows, pcabOutCfg, maxProducts, npcabFilter)   : [];
    const allSecs = [...inSecs, ...outSecs];

    // allMonths를 여기서 미리 계산해 growth pre-computation에 활용
    const allWeeks = new Set();
    allSecs.forEach(s => s.weeks.forEach(w => allWeeks.add(w)));
    const allMo = groupWeeksByMonth([...allWeeks].sort());

    return allSecs.map(section => {
      const pairedRawRows = section.valueType === 'ms'
        ? allSecs.find(s => s.valueType === 'raw' && s.scope === section.scope && s.metric === section.metric)?.rows ?? null
        : null;
      const pairedIdx = pairedRawRows
        ? new Map(pairedRawRows.map(r => [`${r.product}||${r.manufacturer}`, r]))
        : null;
      const isMsSection = section.valueType === 'ms';
      const rows = section.rows.map(row => {
        const isTotal = row.product === '전체';
        return {
          ...row,
          wowGrowth: (isMsSection && isTotal) ? null : calcWoWGrowth(row, section.weeks),
          momGrowth: (isMsSection && isTotal) ? null : calcMoMGrowth(row, allMo, pairedRawRows, pairedIdx),
        };
      });
      return { ...section, rows, pairedRawRows };
    });
  }, [rawRows, sectionConfig, maxProducts, productFilter, drugId]);

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

  // drugId 변경(또는 unmount) 시 진행 중인 애니메이션 강제 종료
  useEffect(() => {
    return () => {
      if (rafRef.current) {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
      }
      scrollTargetRef.current = null;
    };
  }, [drugId]);

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
      if (!lead.isConnected) {
        rafRef.current = null;
        scrollTargetRef.current = null;
        return;
      }
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

        {(rawRows === null || (rawRows.length > 0 && rawRows[0].drug_id !== drugId)) && <WeeklySkeleton />}

        {rawRows !== null && !(rawRows.length > 0 && rawRows[0].drug_id !== drugId) && sections.map((section, i) => (
            <div key={i} className="wt-section">
              <div className="wt-section-header">
                <span className="wt-section-title">
                  {section.title}
                  <span className="wt-section-note">{section.note}</span>
                  {section.gapCount > 0 && (
                    <button
                      className={`wt-section-gap-badge${openGapSection === i ? ' wt-section-gap-badge--open' : ''}`}
                      onClick={() => setOpenGapSection(v => v === i ? null : i)}
                    >
                      ⚠ 누락 {section.gapCount}셀 {openGapSection === i ? '▴' : '▾'}
                    </button>
                  )}
                </span>
              </div>
              {section.gapCount > 0 && openGapSection === i && (
                <div className="wt-gap-panel">
                  <table className="wt-gap-table">
                    <thead>
                      <tr>
                        <th>제품</th>
                        <th>제조사</th>
                        <th>누락 주차</th>
                      </tr>
                    </thead>
                    <tbody>
                      {section.gaps.map((g, gi) => (
                        <tr key={gi}>
                          <td>{g.product || '-'}</td>
                          <td>{g.manufacturer || '-'}</td>
                          <td>{g.weeks.map(weekLabel).join(', ')}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
              <SectionTable
                section={section}
                visibleMonths={visibleMonths}
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
