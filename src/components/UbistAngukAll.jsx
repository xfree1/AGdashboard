import { useState } from 'react';
import './UbistSummary.css';
import './UbistCompanyAll.css';
import './UbistAngukAll.css';

/* ── 성장률 셀 렌더러 ── */
function GrowthVal({ value }) {
  if (value === null || value === undefined || value === '-') return <span>-</span>;
  const num = parseFloat(value);
  if (isNaN(num)) return <span>{value}</span>;
  const isNeg = num < 0;
  return (
    <span className={isNeg ? 'ubist-diff--down' : 'ubist-diff--up'}>
      <span className="ubist-diff-arrow">{isNeg ? '▼' : '▲'}</span>
      {Math.abs(num).toFixed(1)}%
    </span>
  );
}

/* ── 순위 변화 셀 렌더러 ── */
function RankDelta({ value }) {
  if (value === null || value === undefined || value === 0)
    return <span className="ubist-rank--flat">-</span>;
  const isUp = value > 0;
  return (
    <span className={isUp ? 'ubist-diff--up' : 'ubist-diff--down'}>
      {isUp ? `+${value}` : value}
    </span>
  );
}

/* ── 월별 컬럼 (24년 1월 ~ 26년 3월, 27개) ── */
const MONTHLY_COLS = [
  { label: '24년 1월',  cls: '' },
  { label: '24년 2월',  cls: '' },
  { label: '24년 3월',  cls: '' },
  { label: '24년 4월',  cls: '' },
  { label: '24년 5월',  cls: '' },
  { label: '24년 6월',  cls: '' },
  { label: '24년 7월',  cls: '' },
  { label: '24년 8월',  cls: '' },
  { label: '24년 9월',  cls: '' },
  { label: '24년 10월', cls: '' },
  { label: '24년 11월', cls: '' },
  { label: '24년 12월', cls: '' },
  { label: '25년 1월',  cls: '' },
  { label: '25년 2월',  cls: '' },
  { label: '25년 3월',  cls: '' },
  { label: '25년 4월',  cls: '' },
  { label: '25년 5월',  cls: '' },
  { label: '25년 6월',  cls: '' },
  { label: '25년 7월',  cls: '' },
  { label: '25년 8월',  cls: '' },
  { label: '25년 9월',  cls: '' },
  { label: '25년 10월', cls: '' },
  { label: '25년 11월', cls: '' },
  { label: '25년 12월', cls: '' },
  { label: '26년 1월',  cls: 'ubist-col--cy' },
  { label: '26년 2월',  cls: 'ubist-col--cy' },
  { label: '26년 3월',  cls: 'ubist-col--cy ubist-col--hl' },
];

/* ── 총합계 행 ──
   sales: 백만원, growth.mom/yoy: %
── */
const TOTAL_ROW = {
  rank: null, label: '총합계 (109개 품목)', isMarket: true,
  sales: [22264.3,20224.4,20935.3,21773.2,21522.6,19590.9,22180.2,22825.3,21323.6,
          23600.3,23919.7,27115.1,25609.4,22427.1,24012.6,25455.4,24212.7,22849.0,
          24498.1,23853.4,27894.4,25343.7,27338.5,29850.0,28782.0,26191.1,29601.7],
  cont25: null, cont26: null,
  growth: { mom: 13.0, yoy: 23.3 },
  rankMom: null, rankYoy: null,
};

/* ── 품목 데이터 (26년 3월 D1 UBIST 안국 전체)
   sales: 백만원 (24년 1월~26년 3월, 27개)
   cont25/cont26: 기여도 비율 (소수, e.g. 0.1373 = 13.7%)
   growth.mom/yoy: % (e.g. 23.7)
   isFocus: 집중품목 여부
── */
const PRODUCT_ROWS = [
  { rank:  1, label: '페바로젯',        isFocus: false,
    sales: [287.0,462.2,590.4,647.0,776.6,813.3,1010.8,1086.6,1149.7,1320.1,1467.8,1661.8,
            1594.8,1700.7,1852.2,2089.3,2135.5,2230.1,2496.4,2567.1,3059.8,2878.5,3066.9,3481.7,3427.2,3284.3,4064.1],
    cont25: 0.0771, cont26: 0.1373, growth: { mom: 23.7, yoy: 119.4 }, rankMom:  1, rankYoy:  2 },
  { rank:  2, label: '시네츄라',        isFocus: false,
    sales: [5196.9,4076.2,4013.7,4012.4,3673.0,2947.2,3512.2,4231.1,3100.4,3581.5,4032.9,5244.4,
            5074.4,2881.6,3327.7,3577.5,2914.2,2284.6,2295.2,2278.1,2869.8,2756.1,3821.3,3872.7,3814.6,3431.5,3539.2],
    cont25: 0.1386, cont26: 0.1196, growth: { mom:  3.1, yoy:   6.4 }, rankMom: -1, rankYoy: -1 },
  { rank:  3, label: '레보텐션',        isFocus: false,
    sales: [1979.7,1891.0,1884.1,1956.5,2023.1,1879.9,2058.4,2070.7,1999.5,2133.1,2043.7,2170.3,
            2086.4,2076.6,2079.2,2185.4,2128.2,2069.0,2204.8,2054.0,2377.3,2089.0,2120.0,2331.4,2262.5,2056.5,2301.6],
    cont25: 0.0866, cont26: 0.0778, growth: { mom: 11.9, yoy:  10.7 }, rankMom:  0, rankYoy: -1 },
  { rank:  4, label: '슈바젯',          isFocus: false,
    sales: [940.8,958.5,1032.3,1049.6,1049.6,1042.4,1172.5,1169.0,1174.4,1322.7,1291.7,1384.3,
            1271.3,1299.5,1430.9,1412.7,1445.9,1408.1,1469.7,1498.6,1700.5,1543.9,1447.0,1574.7,1555.5,1494.9,1688.1],
    cont25: 0.0596, cont26: 0.0570, growth: { mom: 12.9, yoy:  18.0 }, rankMom:  0, rankYoy:  0 },
  { rank:  5, label: '레보살탄',        isFocus: false,
    sales: [1265.1,1243.4,1265.7,1341.1,1350.9,1237.0,1409.2,1408.6,1372.7,1422.1,1356.0,1445.7,
            1387.4,1378.6,1391.4,1421.8,1419.4,1364.0,1435.0,1367.2,1585.3,1372.3,1354.4,1611.7,1455.3,1357.9,1497.3],
    cont25: 0.0579, cont26: 0.0506, growth: { mom: 10.3, yoy:   7.6 }, rankMom:  0, rankYoy:  0 },
  { rank:  6, label: '페바로 에프',     isFocus: false,
    sales: [912.6,849.8,928.6,932.9,989.0,956.7,1089.8,989.3,1044.7,1105.1,1066.7,1099.5,
            1062.4,1068.8,1098.1,1103.2,1110.1,1103.2,1239.9,1137.3,1282.0,1119.6,1121.6,1294.8,1299.0,1200.4,1299.9],
    cont25: 0.0457, cont26: 0.0439, growth: { mom:  8.3, yoy:  18.4 }, rankMom:  0, rankYoy:  0 },
  { rank:  7, label: '리포젯',          isFocus: false,
    sales: [772.6,734.4,757.1,779.5,762.9,764.3,883.7,807.7,849.3,908.1,878.4,938.9,
            910.9,895.9,918.8,996.9,977.7,958.6,1029.3,1028.8,1162.5,1045.9,929.2,1066.9,1060.2,949.1,1031.6],
    cont25: 0.0383, cont26: 0.0348, growth: { mom:  8.7, yoy:  12.3 }, rankMom:  0, rankYoy:  0 },
  { rank:  8, label: '리포액틴',        isFocus: false,
    sales: [848.1,774.4,810.2,814.6,862.4,790.4,885.0,866.1,841.0,876.5,842.2,879.0,
            819.0,784.1,830.4,943.2,936.6,882.1,984.2,951.3,1080.6,932.1,931.9,1021.4,982.6,870.8,1023.8],
    cont25: 0.0346, cont26: 0.0346, growth: { mom: 17.6, yoy:  23.3 }, rankMom:  0, rankYoy:  1 },
  { rank:  9, label: '레토프라',        isFocus: false,
    sales: [793.0,717.9,780.0,815.7,767.7,730.1,875.6,847.7,810.3,875.7,883.0,995.0,
            865.9,878.0,876.2,932.0,849.5,881.5,937.4,846.7,963.1,796.1,823.1,966.7,855.9,741.1,900.0],
    cont25: 0.0365, cont26: 0.0304, growth: { mom: 21.4, yoy:   2.7 }, rankMom:  0, rankYoy: -1 },
  { rank: 10, label: '슈스타',          isFocus: false,
    sales: [580.3,561.8,564.2,607.7,613.3,608.8,711.8,741.7,703.5,778.1,728.5,782.4,
            720.6,732.7,737.6,751.0,764.1,740.7,768.5,739.0,861.3,734.4,729.9,804.5,775.3,688.0,782.5],
    cont25: 0.0307, cont26: 0.0264, growth: { mom: 13.7, yoy:   6.1 }, rankMom:  0, rankYoy:  0 },
  { rank: 11, label: '페바로',          isFocus: false,
    sales: [164.9,112.9,180.3,199.3,231.9,222.5,252.1,276.8,292.0,319.4,339.4,375.5,
            356.6,356.9,397.4,413.5,452.7,445.4,480.0,506.1,599.4,542.5,562.9,662.7,621.3,573.6,709.9],
    cont25: 0.0165, cont26: 0.0240, growth: { mom: 23.8, yoy:  78.6 }, rankMom:  0, rankYoy:  1 },
  { rank: 12, label: '애니펜',          isFocus: false,
    sales: [462.0,373.5,300.3,221.4,185.5,173.8,257.5,335.9,264.5,279.6,317.3,489.7,
            486.3,282.9,359.6,396.7,358.1,299.8,325.7,336.4,433.4,421.1,638.7,567.8,557.4,492.5,528.9],
    cont25: 0.0150, cont26: 0.0179, growth: { mom:  7.4, yoy:  47.1 }, rankMom:  1, rankYoy:  1 },
  { rank: 13, label: '라베톤',          isFocus: false,
    sales: [331.6,286.2,277.5,342.6,351.2,280.3,182.4,107.8,134.4,215.5,247.2,274.7,
            266.4,281.9,337.1,375.2,391.2,402.5,477.8,476.0,528.6,492.8,540.5,625.6,577.4,542.8,486.4],
    cont25: 0.0140, cont26: 0.0164, growth: { mom: -10.4, yoy:  44.3 }, rankMom: -1, rankYoy:  3 },
  { rank: 14, label: '클로펙트',        isFocus: false,
    sales: [382.1,354.6,355.5,393.7,382.0,363.3,402.8,421.7,411.2,415.1,384.3,421.9,
            411.0,411.7,421.1,427.6,410.6,432.9,413.9,412.9,497.1,407.5,413.8,448.2,458.0,407.5,465.3],
    cont25: 0.0175, cont26: 0.0157, growth: { mom: 14.2, yoy:  10.5 }, rankMom:  0, rankYoy: -3 },
  { rank: 15, label: '하루큐어',        isFocus: false,
    sales: [192.7,176.5,196.1,201.3,197.1,177.8,230.3,224.4,230.4,282.9,299.4,291.5,
            285.2,288.7,324.5,316.2,336.2,326.9,357.0,291.8,395.8,355.9,361.1,410.3,388.2,349.7,429.6],
    cont25: 0.0135, cont26: 0.0145, growth: { mom: 22.8, yoy:  32.4 }, rankMom:  2, rankYoy:  3 },
  { rank: 16, label: '애니틴',          isFocus: false,
    sales: [284.7,286.9,271.1,298.8,289.9,281.9,310.7,329.3,327.2,363.5,339.0,356.6,
            330.7,339.9,349.1,347.0,367.5,353.9,380.2,367.7,422.2,383.3,373.1,432.2,413.5,366.4,424.8],
    cont25: 0.0145, cont26: 0.0144, growth: { mom: 15.9, yoy:  21.7 }, rankMom: -1, rankYoy: -1 },
  { rank: 17, label: '안국 레바미피드', isFocus: false,
    sales: [194.8,165.4,177.5,197.9,190.5,174.3,208.1,227.5,204.3,237.0,247.4,309.3,
            316.7,243.5,271.5,283.7,262.3,245.9,271.7,271.8,322.4,317.5,372.9,390.2,391.3,355.9,391.7],
    cont25: 0.0113, cont26: 0.0132, growth: { mom: 10.1, yoy:  44.3 }, rankMom: -1, rankYoy:  5 },
  { rank: 18, label: '큐로스트',        isFocus: false,
    sales: [315.3,283.8,333.1,341.4,305.4,266.3,275.8,281.5,294.9,336.3,372.2,414.6,
            338.8,289.4,353.0,391.4,324.6,269.6,256.8,246.0,339.9,333.7,378.7,377.7,339.9,301.6,384.7],
    cont25: 0.0147, cont26: 0.0130, growth: { mom: 27.6, yoy:   9.0 }, rankMom:  4, rankYoy: -4 },
  { rank: 19, label: '잘트린 엑스엘',  isFocus: false,
    sales: [120.6,134.6,168.0,185.0,197.1,178.7,197.5,208.0,197.2,219.4,182.5,178.5,
            162.6,190.0,204.4,228.5,227.6,240.6,264.1,298.9,363.7,329.9,318.0,361.4,334.0,316.1,365.3],
    cont25: 0.0085, cont26: 0.0123, growth: { mom: 15.6, yoy:  78.7 }, rankMom:  1, rankYoy:  9 },
  { rank: 20, label: '루파핀',          isFocus: false,
    sales: [288.4,261.1,262.8,286.5,293.6,249.7,280.6,287.2,293.4,319.0,303.6,318.4,
            298.1,284.5,302.9,316.0,299.7,279.0,289.3,261.2,321.4,288.3,316.0,333.9,314.2,309.2,356.9],
    cont25: 0.0126, cont26: 0.0121, growth: { mom: 15.4, yoy:  17.8 }, rankMom:  1, rankYoy:  1 },
  { rank: 21, label: '애니코프',        isFocus: false,
    sales: [304.3,266.5,263.8,293.6,293.5,245.6,279.4,326.3,281.9,329.0,368.9,449.8,
            491.8,335.4,323.0,355.1,303.9,254.4,247.5,240.5,294.9,280.4,339.5,374.3,353.7,326.7,343.3],
    cont25: 0.0135, cont26: 0.0116, growth: { mom:  5.1, yoy:   6.3 }, rankMom: -2, rankYoy: -2 },
  { rank: 22, label: '휴메가',          isFocus: false,
    sales: [277.7,235.4,277.2,298.6,309.5,302.7,323.3,315.6,306.2,330.4,315.3,331.3,
            322.2,329.9,334.5,359.5,346.8,327.9,366.3,375.8,367.7,352.2,356.3,370.0,336.2,328.9,333.2],
    cont25: 0.0139, cont26: 0.0113, growth: { mom:  1.3, yoy:  -0.4 }, rankMom: -4, rankYoy: -5 },
  { rank: 23, label: '에이테넬엠',      isFocus: false,
    sales: [168.9,147.3,164.8,184.1,185.8,179.2,199.5,188.7,182.7,213.5,211.1,206.8,
            220.1,207.5,217.8,238.2,249.1,251.8,264.6,273.6,307.7,295.6,263.6,324.0,328.6,282.8,331.0],
    cont25: 0.0091, cont26: 0.0112, growth: { mom: 17.0, yoy:  52.0 }, rankMom:  1, rankYoy:  2 },
  { rank: 24, label: '폴락스',          isFocus: false,
    sales: [297.7,265.1,268.5,309.2,275.9,265.6,278.4,279.9,292.8,248.6,253.5,293.5,
            277.7,281.1,303.8,328.9,275.5,289.8,332.6,300.8,330.4,295.3,270.4,325.5,324.8,286.9,325.4],
    cont25: 0.0127, cont26: 0.0110, growth: { mom: 13.4, yoy:   7.1 }, rankMom: -1, rankYoy: -4 },
  { rank: 25, label: '콕스투 플러스',   isFocus: false,
    sales: [53.7,55.4,73.0,80.8,115.5,118.9,127.9,138.2,149.6,158.6,175.2,197.0,
            197.1,182.4,208.3,209.9,203.5,190.7,221.4,247.7,243.0,214.8,229.4,245.3,232.4,222.6,292.6],
    cont25: 0.0087, cont26: 0.0099, growth: { mom: 31.5, yoy:  40.5 }, rankMom:  1, rankYoy:  2 },
];

const fmt     = (v) => v === null || v === undefined ? '-' : v.toLocaleString('ko-KR', { maximumFractionDigits: 1 });
const fmtCont = (v) => v === null || v === undefined ? '-' : (v * 100).toFixed(1) + '%';

const INITIAL_SHOW  = 20;
const STEP          = 20;
const MONTH_WINDOW  = 8;
const DEFAULT_START = MONTHLY_COLS.length - MONTH_WINDOW; // 19

export default function UbistAngukAll() {
  const [showCount,  setShowCount]  = useState(INITIAL_SHOW);
  const [startIdx,   setStartIdx]   = useState(DEFAULT_START);
  const [growthMode, setGrowthMode] = useState('mom'); // 'mom' | 'yoy'
  const [rankMode,   setRankMode]   = useState('mom'); // 'mom' | 'yoy'

  const displayedRows = PRODUCT_ROWS.slice(0, showCount);
  const visibleMonths = MONTHLY_COLS
    .slice(startIdx, startIdx + MONTH_WINDOW)
    .map((col, i) => ({ ...col, origIdx: startIdx + i }))
    .reverse();
  const canPrev = startIdx > 0;
  const canNext = startIdx + MONTH_WINDOW < MONTHLY_COLS.length;

  const growthLabel = growthMode === 'mom' ? '전월대비' : '전년대비';
  const rankLabel   = rankMode   === 'mom' ? '전월대비' : '전년대비';

  const renderRow = (row, key, isZebra) => {
    const rowCls = [
      'ubist-tr',
      isZebra      ? 'ubist-tr--zebra'  : '',
      row.isFocus  ? 'ubist-tr--focus'  : '',
      row.isMarket ? 'ubist-tr--market' : '',
    ].filter(Boolean).join(' ');

    return (
      <tr key={key} className={rowCls}>
        <td className="ubist-td ubist-td--rank">
          {row.rank ? `${row.rank}위` : '-'}
        </td>
        <td className="ubist-td ubist-td--company">
          {row.label}
        </td>
        {/* 기여도 */}
        <td className="ubist-td ubist-td--num ubist-col--acc-start ubist-cmp-sticky ubist-cmp-l1">
          {fmtCont(row.cont26)}
        </td>
        <td className="ubist-td ubist-td--num ubist-cmp-sticky ubist-cmp-l2">
          {fmtCont(row.cont25)}
        </td>
        {/* 성장률 (토글) */}
        <td className="ubist-td ubist-td--num ubist-col--gs ubist-cmp-sticky ubist-cmp-l3">
          <GrowthVal value={growthMode === 'mom' ? row.growth?.mom : row.growth?.yoy} />
        </td>
        {/* 품목 순위 (토글) */}
        <td className="ubist-td ubist-td--num ubist-col--gs ubist-cmp-sticky ubist-cmp-l4 ubist-cmp-last">
          <RankDelta value={rankMode === 'mom' ? row.rankMom : row.rankYoy} />
        </td>
        {/* 월별 매출 */}
        {visibleMonths.map((col) => (
          <td key={`m${col.origIdx}`} className={`ubist-td ubist-td--num ${col.cls}`}>
            {fmt(row.sales[col.origIdx])}
          </td>
        ))}
      </tr>
    );
  };

  return (
    <div className="ubist-wrap ubist-wrap--anguk-all">
      <div className="ubist-section-group">
        <div className="ubist-section-title">
          <span className="ubist-title-text">
            26년 3월 품목별 전체
            <span className="ubist-th-note">금액: 백만원</span>
          </span>
          <span className="ubist-month-nav">
            <button
              className="ubist-nav-btn"
              disabled={!canNext}
              onClick={() => setStartIdx(s => s + 1)}
            >← 최신</button>
            <button
              className="ubist-nav-btn"
              disabled={!canPrev}
              onClick={() => setStartIdx(s => s - 1)}
            >과거 →</button>
          </span>
        </div>
        <div className="ubist-section">
          <div className="ubist-scroll">
            <table className="ubist-table ag-table ubist-table--anguk">
              <colgroup>
                <col className="ubist-col-rank" />
                <col className="ubist-col-company" />
                <col className="ubist-col-ms" />
                <col className="ubist-col-ms" />
                <col className="ubist-col-growth" />
                <col className="ubist-col-rank-chg" />
                {visibleMonths.map((col) => (
                  <col key={`mc${col.origIdx}`} className="ubist-col-data" />
                ))}
              </colgroup>
              <thead>
                {/* ── 1행: 그룹 라벨 ── */}
                <tr className="ubist-thead-groups">
                  <th rowSpan={2} className="ubist-th ubist-th--rank">순위</th>
                  <th rowSpan={2} className="ubist-th ubist-th--company">품목</th>
                  <th colSpan={2} className="ubist-th ubist-th--group-label ubist-col--acc-start ubist-cmp-sticky ubist-cmp-l1">
                    기여도
                  </th>
                  <th className="ubist-th ubist-th--group-label ubist-col--gs ubist-cmp-sticky ubist-cmp-l3">
                    성장률
                  </th>
                  <th className="ubist-th ubist-th--group-label ubist-col--gs ubist-cmp-sticky ubist-cmp-l4 ubist-cmp-last">
                    순위
                  </th>
                  {visibleMonths.map((col) => (
                    <th key={`ms${col.origIdx}`} className={`ubist-th ubist-th--group-spacer ${col.cls}`} />
                  ))}
                </tr>
                {/* ── 2행: 서브 헤더 ── */}
                <tr className="ubist-thead-cols">
                  <th className="ubist-th ubist-th--data ubist-col--acc-start ubist-cmp-sticky ubist-cmp-l1">26년 3월</th>
                  <th className="ubist-th ubist-th--data ubist-cmp-sticky ubist-cmp-l2">25년 3월</th>
                  <th
                    className="ubist-th ubist-th--data ubist-col--gs ubist-cmp-sticky ubist-cmp-l3 ubist-th--toggle"
                    onClick={() => setGrowthMode(m => m === 'mom' ? 'yoy' : 'mom')}
                  >
                    {growthLabel} ▾
                  </th>
                  <th
                    className="ubist-th ubist-th--data ubist-col--gs ubist-cmp-sticky ubist-cmp-l4 ubist-cmp-last ubist-th--toggle"
                    onClick={() => setRankMode(m => m === 'mom' ? 'yoy' : 'mom')}
                  >
                    {rankLabel} ▾
                  </th>
                  {visibleMonths.map((col) => (
                    <th key={`m${col.origIdx}`} className={`ubist-th ubist-th--data ${col.cls}`}>
                      {col.label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {displayedRows.map((row, i) => renderRow(row, i, i % 2 === 1))}
                {renderRow(TOTAL_ROW, 'total', false)}
              </tbody>
            </table>
          </div>
          {showCount < PRODUCT_ROWS.length && (
            <div className="ubist-more-wrap">
              <button
                className="ubist-more-btn"
                onClick={() => setShowCount(c => Math.min(c + STEP, PRODUCT_ROWS.length))}
              >
                더보기 ({Math.min(STEP, PRODUCT_ROWS.length - showCount)}개 더)
              </button>
            </div>
          )}
          {showCount >= PRODUCT_ROWS.length && PRODUCT_ROWS.length > INITIAL_SHOW && (
            <div className="ubist-more-wrap">
              <button className="ubist-more-btn" onClick={() => setShowCount(INITIAL_SHOW)}>
                접기
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
