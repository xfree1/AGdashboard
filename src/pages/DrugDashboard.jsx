import { useMemo, useState, useEffect } from 'react';
import { DRUGS } from '../config/drugs';
import { weekIdToYearMonth, fmtWeekLabel } from '../utils/weekUtils';
import { loadMonthlySales } from '../utils/supabaseLoader';
import KpiSection      from '../components/KpiSection';
import TrendChart      from '../components/TrendChart';
import ShareDonut      from '../components/ShareDonut';
import VendorTable     from '../components/VendorTable';
import Sidebar        from '../components/Sidebar';
import ChartDataTable from '../components/ChartDataTable';
import './DrugDashboard.css';

function ymKey(y, m) { return `${y}-${String(m).padStart(2, '0')}`; }

function prevYM(year, month) {
  return month === 1 ? { year: year - 1, month: 12 } : { year, month: month - 1 };
}

function prevNM(year, month, n) {
  let y = year, m = month - n;
  while (m <= 0) { m += 12; y -= 1; }
  return { year: y, month: m };
}

export default function DrugDashboard({ result }) {
  const { drugName, drugId, myVendor, allWeeks, vendorsSorted, metric } = result;
  const metricLabel = metric === 'qty' ? '처방량' : '처방건수';
  const [chartPeriod, setChartPeriod] = useState('3M');
  const currentDrug = DRUGS.find(d => d.id === drugId) || DRUGS.find(d => d.name === drugName) || DRUGS[0];

  // 전체 주차 기준으로 vendors 계산 (TrendChart, ShareDonut, VendorTable용)
  const { vendors, mktByWeek } = useMemo(() => {
    const mktByWeek = allWeeks.map((_, wi) =>
      vendorsSorted.reduce((s, v) => s + (v.allByWeek[wi] ?? 0), 0)
    );
    const mktTotal = mktByWeek.reduce((a, b) => a + b, 0);
    const vendors = vendorsSorted.map(v => {
      const byWeek    = v.allByWeek;
      const total     = byWeek.reduce((a, b) => a + b, 0);
      const msPerWeek = byWeek.map((val, wi) => mktByWeek[wi] > 0 ? val / mktByWeek[wi] : 0);
      const msTotal   = mktTotal > 0 ? total / mktTotal : 0;
      return { name: v.name, byWeek, total, msPerWeek, msTotal };
    }).sort((a, b) => b.total - a.total);
    return { vendors, mktByWeek };
  }, [vendorsSorted, allWeeks]);


  const me            = vendors.find(v => v.name === myVendor);
  const lastWeekLabel = fmtWeekLabel(allWeeks[allWeeks.length - 1]);

  // ── 매출 데이터 ──────────────────────────────────────────
  const [salesData, setSalesData] = useState([]);  // [{ month_id, sales }]
  useEffect(() => {
    const dbId = DRUGS.find(d => d.id === drugId)?.dbId;
    if (!dbId) return;
    loadMonthlySales(dbId)
      .then(setSalesData)
      .catch(() => setSalesData([]));
  }, [drugId]);

  // ── 월별 그룹 ──────────────────────────────────────────
  const monthGroups = useMemo(() => {
    const groups = {};
    allWeeks.forEach((w, i) => {
      const ym = weekIdToYearMonth(w);
      if (!ym) return;
      const key = ymKey(ym.year, ym.month);
      if (!groups[key]) groups[key] = { year: ym.year, month: ym.month, indices: [] };
      groups[key].indices.push(i);
    });
    return groups;
  }, [allWeeks]);

  // 마지막 업로드 데이터 기준 "직전 완성 월"과 "전전 월" 결정
  // 마지막 주가 속한 달은 미완성일 수 있으므로, 그 이전 달을 완성 월로 사용
  const { lcKey, pmKey, lyKey, lcLabel, pmLabel } = useMemo(() => {
    const lastYM = weekIdToYearMonth(allWeeks[allWeeks.length - 1]);
    const raw = lastYM ?? { year: new Date().getFullYear(), month: new Date().getMonth() + 1 };
    const lc = prevYM(raw.year, raw.month); // 마지막 주 달의 직전 달 = 마지막 완성 월
    const pm = prevYM(lc.year, lc.month);
    return {
      lcKey:   ymKey(lc.year, lc.month),
      pmKey:   ymKey(pm.year, pm.month),
      lyKey:   (() => { const q = prevNM(lc.year, lc.month, 3); return ymKey(q.year, q.month); })(),  // 3개월 전 (QoQ)
      lcLabel: `${lc.month}월`,
      pmLabel: `${pm.month}월`,
    };
  }, [allWeeks]);

  // 월별 MS 계산 (ShareDonut용 — 마지막 완성 월 기준)
  const monthlyVendors = useMemo(() => {
    const lcIndices = monthGroups[lcKey]?.indices ?? [];
    const mktMonth  = lcIndices.reduce((s, i) => s + (mktByWeek[i] ?? 0), 0);
    return vendors.map(v => {
      const monthTotal = lcIndices.reduce((s, i) => s + (v.byWeek[i] ?? 0), 0);
      const msMonthly  = mktMonth > 0 ? monthTotal / mktMonth : 0;
      return { ...v, msTotal: msMonthly };
    });
  }, [vendors, monthGroups, lcKey, mktByWeek]);

  // 월 합산 KPI 계산
  const kpi = useMemo(() => {
    const lcIdx = monthGroups[lcKey]?.indices ?? [];
    const pmIdx = monthGroups[pmKey]?.indices ?? [];
    const hasPm = pmIdx.length > 0;

    const sumV   = (v, idxs) => idxs.reduce((s, i) => s + (v?.byWeek[i] ?? 0), 0);
    const sumMkt = (idxs)    => idxs.reduce((s, i) => s + (mktByWeek[i] ?? 0), 0);

    const lyIdx = monthGroups[lyKey]?.indices ?? [];

    const myRxCurr = Math.round(sumV(me, lcIdx));
    const myRxPrev = hasPm ? Math.round(sumV(me, pmIdx)) : null;
    const myRxLy   = lyIdx.length > 0 ? Math.round(sumV(me, lyIdx)) : null;

    const mktCurr  = sumMkt(lcIdx);
    const mktPrev  = hasPm ? sumMkt(pmIdx) : null;

    const myMsCurr = me && mktCurr > 0 ? sumV(me, lcIdx) / mktCurr * 100 : 0;
    const myMsPrev = me && mktPrev !== null && mktPrev > 0
      ? sumV(me, pmIdx) / mktPrev * 100 : null;

    const mktRxCurr = Math.round(mktCurr);
    const mktRxPrev = mktPrev !== null ? Math.round(mktPrev) : null;

    return { myRxCurr, myRxPrev, myRxLy, myMsCurr, myMsPrev, mktRxCurr, mktRxPrev };
  }, [me, mktByWeek, monthGroups, lcKey, pmKey, lyKey]);

  // 월별 매출 KPI
  const salesKpi = useMemo(() => {
    const byMonth = {};
    salesData.forEach(({ month_id, sales }) => { byMonth[month_id] = sales; });
    const salesCurr = byMonth[lcKey] ?? null;
    const salesPrev = byMonth[pmKey] ?? null;
    return { salesCurr, salesPrev };
  }, [salesData, lcKey, pmKey]);

  return (
    <div className="ag-root">

      {/* ── Sidebar ── */}
      <Sidebar />

      {/* ── Main ── */}
      <div className="ag-main">

        <div className="ag-content">

          {/* Product header */}
          <div className="ag-product-header-wrap">
            <div>
              <div className="ag-product-name">
                <span className="ag-product-name__period">{lcKey.split('-')[0].slice(2)}년 {lcLabel} </span>{drugName}
              </div>
              <div className="ag-product-updated">최종 업데이트: {lastWeekLabel}</div>
            </div>
          </div>

          {/* ── Middle grid: 左 차트+테이블 / 右 KPI+Donut ── */}
          <div className="ag-mid-grid">

            {/* 左: 처방량 트렌드 + 월별 수치 테이블 (같은 카드) */}
            <div className="ag-mid-left">
              <div className="ag-card ag-combined-card">
                <TrendChart
                  allWeeks={allWeeks}
                  vendorsSorted={vendorsSorted}
                  myVendor={myVendor}
                  metricLabel={metricLabel}
                  period={chartPeriod}
                  onPeriodChange={setChartPeriod}
                />
                <ChartDataTable
                  monthGroups={monthGroups}
                  me={me}
                  mktByWeek={mktByWeek}
                  lcKey={lcKey}
                  metricLabel={metricLabel}
                  period={chartPeriod}
                  allWeeks={allWeeks}
                />
              </div>
            </div>

            {/* 右: KPI 2×2 + M/S 현황 도넛 */}
            <div className="ag-mid-right">
              <KpiSection
                {...kpi}
                {...salesKpi}
                currLabel={lcLabel}
                prevLabel={pmLabel}
                metricLabel={metricLabel}
                showGR={currentDrug.showGR}
              />
              {currentDrug.showDonut && (
                <ShareDonut
                  vendors={monthlyVendors}
                  myVendor={myVendor}
                  drugName={drugName}
                  lastWeekLabel={lcLabel}
                  topN={currentDrug.topN}
                />
              )}
            </div>

          </div>

          {/* ── 판매사 순위 ── */}
          <VendorTable
            vendorsSorted={vendorsSorted}
            allWeeks={allWeeks}
            myVendor={myVendor}
            metricLabel={metricLabel}
            totalVendorCount={vendorsSorted.length}
          />

        </div>
      </div>
    </div>
  );
}
