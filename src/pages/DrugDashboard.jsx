import { useMemo, useState, useEffect } from 'react';
import { DRUGS } from '../config/drugs';
import { weekIdToYearMonth, fmtWeekLabel } from '../utils/weekUtils';
import { loadMonthlySales } from '../utils/supabaseLoader';
import KpiSection  from '../components/KpiSection';
import TrendChart  from '../components/TrendChart';
import ShareDonut  from '../components/ShareDonut';
import VendorTable from '../components/VendorTable';
import Sidebar     from '../components/Sidebar';
import './DrugDashboard.css';

function ymKey(y, m) { return `${y}-${String(m).padStart(2, '0')}`; }

function prevYM(year, month) {
  return month === 1 ? { year: year - 1, month: 12 } : { year, month: month - 1 };
}

export default function DrugDashboard({ result, onDrugChange, activeSection, onDashboardClick }) {
  const { drugName, drugId, myVendor, allWeeks, vendorsSorted, metric } = result;
  const metricLabel = metric === 'qty' ? '처방량' : '처방건수';
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
  const { lcKey, pmKey, lcLabel, pmLabel } = useMemo(() => {
    const lastYM = weekIdToYearMonth(allWeeks[allWeeks.length - 1]);
    const lc = lastYM ?? prevYM(new Date().getFullYear(), new Date().getMonth() + 1);
    const pm = prevYM(lc.year, lc.month);
    return {
      lcKey:   ymKey(lc.year, lc.month),
      pmKey:   ymKey(pm.year, pm.month),
      lcLabel: `${lc.month}월`,
      pmLabel: `${pm.month}월`,
    };
  }, [allWeeks]);

  // 월 합산 KPI 계산
  const kpi = useMemo(() => {
    const lcIdx = monthGroups[lcKey]?.indices ?? [];
    const pmIdx = monthGroups[pmKey]?.indices ?? [];
    const hasPm = pmIdx.length > 0;

    const sumV   = (v, idxs) => idxs.reduce((s, i) => s + (v?.byWeek[i] ?? 0), 0);
    const sumMkt = (idxs)    => idxs.reduce((s, i) => s + (mktByWeek[i] ?? 0), 0);

    const myRxCurr = Math.round(sumV(me, lcIdx));
    const myRxPrev = hasPm ? Math.round(sumV(me, pmIdx)) : null;

    const mktCurr  = sumMkt(lcIdx);
    const mktPrev  = hasPm ? sumMkt(pmIdx) : null;

    const myMsCurr = me && mktCurr > 0 ? sumV(me, lcIdx) / mktCurr * 100 : 0;
    const myMsPrev = me && mktPrev !== null && mktPrev > 0
      ? sumV(me, pmIdx) / mktPrev * 100 : null;

    const mktRxCurr = Math.round(mktCurr);
    const mktRxPrev = mktPrev !== null ? Math.round(mktPrev) : null;

    return { myRxCurr, myRxPrev, myMsCurr, myMsPrev, mktRxCurr, mktRxPrev };
  }, [me, mktByWeek, monthGroups, lcKey, pmKey]);

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
      <Sidebar
        drugs={DRUGS}
        currentDrug={currentDrug}
        onDrugChange={onDrugChange}
        activeSection={activeSection}
        onDashboardClick={onDashboardClick}
      />

      {/* ── Main ── */}
      <div className="ag-main">

        <div className="ag-content">

          {/* Product header */}
          <div className="ag-product-header-wrap">
            <div>
              <div className="ag-product-name">
                <span style={{ fontWeight: 400 }}>{lcKey.split('-')[0].slice(2)}년 {lcLabel} </span>{drugName}
              </div>
              <div className="ag-product-updated">최종 업데이트: {lastWeekLabel}</div>
            </div>
          </div>

          <KpiSection
            {...kpi}
            {...salesKpi}
            currLabel={lcLabel}
            prevLabel={pmLabel}
            metricLabel={metricLabel}
            showGR={currentDrug.showGR}
          />

          <div className="ag-bottom-row">
            <TrendChart
              allWeeks={allWeeks}
              vendorsSorted={vendorsSorted}
              myVendor={myVendor}
              metricLabel={metricLabel}
            />
            {currentDrug.showDonut && (
              <ShareDonut
                vendors={vendors}
                myVendor={myVendor}
                drugName={drugName}
                lastWeekLabel={lastWeekLabel}
                topN={currentDrug.topN}
              />
            )}
          </div>

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
