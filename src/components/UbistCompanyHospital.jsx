import { useState } from 'react';
import './UbistSummary.css';
import './UbistCompanyAll.css';
import './UbistCompanyHospital.css';

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

const MONTHLY_COLS = [
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

/* ── 더미 데이터 (26년 3월 D1 UBIST 제약사별 종병) ── */
const MARKET_ROW = {
  rank: null, label: '시장 전체 (334개사)', isMarket: true,
  sales: [72440, 67680, 64460, 66510, 67330, 68160, 68980, 69800, 70620, 71440, 72260, 73080, 73930, 69880, 63990, 73230],
  ms25: null, ms26: null,
  growth: { mom: 14.4, yoy: 10.2 },
  rankMom: null, rankYoy: null,
};

const COMPANY_ROWS = [
  { rank:  1, label: '한미약품',         isAnguk: false,
    sales: [37203, 34613, 32322, 32878, 33414, 33884, 34425, 34933, 35394, 35900, 36429, 36895, 37489, 33916, 30580, 35010],
    ms25: 4.90, ms26: 4.78, growth: { mom: 14.5, yoy:   7.2 }, rankMom:  0, rankYoy:  0 },
  { rank:  2, label: '노바티스',         isAnguk: false,
    sales: [16000, 14316, 14879, 14879, 15005, 15085, 15192, 15299, 15382, 15494, 15605, 15716, 15900, 14994, 13980, 16005],
    ms25: 2.19, ms26: 2.18, growth: { mom: 14.5, yoy:   8.5 }, rankMom:  1, rankYoy:  2 },
  { rank:  3, label: '종근당',           isAnguk: false,
    sales: [29759, 27301, 25900, 26400, 26411, 26424, 26399, 26416, 26395, 26416, 26424, 26418, 26495, 25816, 23395, 26000],
    ms25: 3.89, ms26: 3.55, growth: { mom: 11.1, yoy:   3.8 }, rankMom: -1, rankYoy:  0 },
  { rank:  4, label: '대웅제약',         isAnguk: false,
    sales: [21764, 20124, 19916, 19916, 20100, 20292, 20492, 20682, 20882, 21084, 21305, 21482, 21894, 20380, 18272, 21005],
    ms25: 2.92, ms26: 2.87, growth: { mom: 14.9, yoy:   6.0 }, rankMom:  1, rankYoy:  0 },
  { rank:  5, label: '비아트리스',       isAnguk: false,
    sales: [17000, 15500, 15609, 15597, 15701, 15805, 15909, 16016, 16100, 16201, 16300, 16405, 16600, 15605, 14100, 16100],
    ms25: 2.28, ms26: 2.20, growth: { mom: 14.2, yoy:   4.5 }, rankMom: -2, rankYoy: -1 },
  { rank:  6, label: '릴리',             isAnguk: false,
    sales: [ 3600,  3450,  3645,  3528,  4206,  4884,  5562,  6240,  6918,  7596,  8274,  8929,  9705, 11605, 11798, 14850],
    ms25: 0.51, ms26: 2.03, growth: { mom: 25.9, yoy: 321.9 }, rankMom:  3, rankYoy: 50 },
  { rank:  7, label: '에이치케이이노엔', isAnguk: false,
    sales: [17505, 15799, 15294, 15589, 15900, 16194, 16502, 16800, 17111, 17411, 17700, 18002, 18100, 16994, 15405, 17700],
    ms25: 2.30, ms26: 2.42, growth: { mom: 14.9, yoy:  14.4 }, rankMom: -1, rankYoy:  0 },
  { rank:  8, label: '대웅바이오',       isAnguk: false,
    sales: [16600, 15500, 15194, 15701, 15900, 16100, 16300, 16502, 16694, 16900, 17100, 17300, 17505, 16700, 15100, 17394],
    ms25: 2.30, ms26: 2.37, growth: { mom: 15.2, yoy:  11.0 }, rankMom:  1, rankYoy:  0 },
  { rank:  9, label: '대원제약',         isAnguk: false,
    sales: [18705, 18194, 14399, 14901, 15194, 15502, 15801, 16100, 16400, 16705, 17001, 17300, 17294, 16216, 14594, 15816],
    ms25: 2.20, ms26: 2.16, growth: { mom:  8.4, yoy:   6.1 }, rankMom: -1, rankYoy:  1 },
  { rank: 10, label: '베링거인겔하임',   isAnguk: false,
    sales: [13105, 12207, 12207, 12202, 12208, 12218, 12193, 12207, 12207, 12207, 12161, 12202, 12202, 11611, 10505, 12023],
    ms25: 1.79, ms26: 1.64, growth: { mom: 14.4, yoy:  -1.6 }, rankMom:  0, rankYoy: -2 },
  { rank: 11, label: '아스트라제네카',   isAnguk: false,
    sales: [10200, 9804, 9894, 10011, 10300, 10505, 10700, 11000, 11200, 11400, 11605, 11802, 12202, 10700, 10807, 11905],
    ms25: 1.48, ms26: 1.63, growth: { mom: 10.2, yoy:  18.5 }, rankMom:  1, rankYoy:  2 },
  { rank: 12, label: '보령',             isAnguk: false,
    sales: [12394, 11601, 11302, 11716, 11902, 12107, 12302, 12500, 12700, 12907, 13101, 13316, 13294, 12705, 11601, 13300],
    ms25: 1.72, ms26: 1.82, growth: { mom: 14.5, yoy:  14.3 }, rankMom:  2, rankYoy: -2 },
  { rank: 13, label: 'JW중외제약',       isAnguk: false,
    sales: [11079, 10107, 10005, 10293, 10500, 10605, 10707, 10907, 11000, 11094, 11202, 11400, 11489, 10974, 10107, 11591],
    ms25: 1.51, ms26: 1.58, growth: { mom: 14.7, yoy:  12.7 }, rankMom: -1, rankYoy:  1 },
  { rank: 14, label: '셀트리온제약',     isAnguk: false,
    sales: [12600, 11897, 11305, 11611, 11801, 11907, 12107, 12310, 12500, 12701, 12907, 13107, 13204, 12500, 11299, 12816],
    ms25: 1.70, ms26: 1.75, growth: { mom: 13.4, yoy:  11.3 }, rankMom:  1, rankYoy:  1 },
  { rank: 15, label: '다이이찌산쿄',     isAnguk: false,
    sales: [ 8607,  7959,  7882,  7958,  8023,  8109,  8175,  8253,  8332,  8406,  8482,  8557,  8707,  8291,  7433,  8616],
    ms25: 1.17, ms26: 1.18, growth: { mom: 15.9, yoy:   9.4 }, rankMom:  0, rankYoy: -2 },
  { rank: 16, label: '제일약품',         isAnguk: false,
    sales: [ 9900,  9207,  8700,  9100,  9300,  9500,  9700,  9900, 10100, 10300, 10500, 10700, 10916, 10405,  9500, 11100],
    ms25: 1.34, ms26: 1.52, growth: { mom: 17.1, yoy:  22.9 }, rankMom:  1, rankYoy: -3 },
  { rank: 17, label: '오가논',           isAnguk: false,
    sales: [10600,  9700,  9500,  9800,  9900,  9900, 10000, 10100, 10100, 10200, 10200, 10300, 10400,  9900,  8900, 10400],
    ms25: 1.43, ms26: 1.42, growth: { mom: 16.9, yoy:   6.8 }, rankMom: -2, rankYoy: -1 },
  { rank: 18, label: '안국약품',         isAnguk: true,
    sales: [10216,  9602,  8400,  9007,  9300,  9502,  9800, 10005, 10300, 10502, 10800, 11002, 11202, 10805,  9800, 11100],
    ms25: 1.32, ms26: 1.52, growth: { mom: 13.3, yoy:  22.9 }, rankMom:  0, rankYoy:  2 },
  { rank: 19, label: '동아에스티',       isAnguk: false,
    sales: [11082, 10107, 10107, 10300, 10407, 10502, 10605, 10700, 10801, 10900, 11007, 11107, 11107, 10300,  9300, 10600],
    ms25: 1.51, ms26: 1.45, growth: { mom: 14.0, yoy:   3.5 }, rankMom:  1, rankYoy: -1 },
  { rank: 20, label: '유나이티드',       isAnguk: false,
    sales: [ 8905,  8300,  7995,  8105,  8300,  8400,  8600,  8700,  8800,  9000,  9100,  9200,  9305,  8818,  8000,  9200],
    ms25: 1.18, ms26: 1.26, growth: { mom: 15.0, yoy:  14.0 }, rankMom:  0, rankYoy: -2 },
  { rank: 21, label: 'SK케미칼',         isAnguk: false,
    sales: [ 8300,  7600,  7702,  7916,  8030,  8100,  8205,  8318,  8408,  8500,  8700,  8818,  9023,  8407,  7600,  8800],
    ms25: 1.16, ms26: 1.20, growth: { mom: 15.8, yoy:  11.5 }, rankMom:  1, rankYoy:  7 },
  { rank: 22, label: '한림제약',         isAnguk: false,
    sales: [ 8100,  7584,  7584,  7791,  7918,  7988,  8100,  8200,  8318,  8408,  8508,  8616,  8800,  8316,  7484,  8800],
    ms25: 1.14, ms26: 1.20, growth: { mom: 17.1, yoy:  14.0 }, rankMom: -1, rankYoy: -1 },
  { rank: 23, label: '삼진제약',         isAnguk: false,
    sales: [ 8509,  7894,  7612,  7895,  7982,  7900,  8012,  8107,  8200,  8300,  8300,  8400,  8407,  7789,  7012,  8300],
    ms25: 1.14, ms26: 1.13, growth: { mom: 18.4, yoy:   6.3 }, rankMom:  1, rankYoy:  1 },
  { rank: 24, label: '아스텔라스',       isAnguk: false,
    sales: [ 8200,  7795,  7400,  7716,  7800,  7916,  8016,  8107,  8200,  8300,  8418,  8500,  8718,  7900,  7200,  8200],
    ms25: 1.12, ms26: 1.12, growth: { mom: 13.9, yoy:   7.1 }, rankMom:  0, rankYoy: -1 },
  { rank: 25, label: '아주약품',         isAnguk: false,
    sales: [ 6900,  6416,  6300,  6600,  6800,  6902,  7100,  7200,  7400,  7502,  7600,  7700,  7800,  7584,  7002,  8100],
    ms25: 0.97, ms26: 1.11, growth: { mom: 15.7, yoy:  23.4 }, rankMom: -1, rankYoy: -1 },
];

const fmt   = (v) => v === null || v === undefined ? '-' : v.toLocaleString('ko-KR', { maximumFractionDigits: 0 });
const fmtMs = (v) => v === null || v === undefined ? '-' : v.toFixed(2) + '%';

const INITIAL_SHOW  = 20;
const STEP          = 20;
const MONTH_WINDOW  = 8;
const DEFAULT_START = MONTHLY_COLS.length - MONTH_WINDOW;

export default function UbistCompanyHospital() {
  const [showCount,  setShowCount]  = useState(INITIAL_SHOW);
  const [startIdx,   setStartIdx]   = useState(DEFAULT_START);
  const [growthMode, setGrowthMode] = useState('mom');
  const [rankMode,   setRankMode]   = useState('mom');

  const displayedRows = COMPANY_ROWS.slice(0, showCount);
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
      row.isAnguk  ? 'ubist-tr--anguk'  : '',
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
        <td className="ubist-td ubist-td--num ubist-col--acc-start ubist-cmp-sticky ubist-cmp-l1">
          {fmtMs(row.ms25)}
        </td>
        <td className="ubist-td ubist-td--num ubist-cmp-sticky ubist-cmp-l2">
          {fmtMs(row.ms26)}
        </td>
        <td className="ubist-td ubist-td--num ubist-col--gs ubist-cmp-sticky ubist-cmp-l3">
          <GrowthVal value={growthMode === 'mom' ? row.growth?.mom : row.growth?.yoy} />
        </td>
        <td className="ubist-td ubist-td--num ubist-col--gs ubist-cmp-sticky ubist-cmp-l4 ubist-cmp-last">
          <RankDelta value={rankMode === 'mom' ? row.rankMom : row.rankYoy} />
        </td>
        {visibleMonths.map((col) => (
          <td key={`m${col.origIdx}`} className={`ubist-td ubist-td--num ${col.cls}`}>
            {fmt(row.sales[col.origIdx])}
          </td>
        ))}
      </tr>
    );
  };

  return (
    <div className="ubist-wrap ubist-wrap--company-all">
      <div className="ubist-section-group">
        <div className="ubist-section-title">
          <span className="ubist-title-text">
            26년 3월 제약사별 종병
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
            <table className="ubist-table ag-table ubist-table--company">
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
                <tr className="ubist-thead-groups">
                  <th rowSpan={2} className="ubist-th ubist-th--rank">순위</th>
                  <th rowSpan={2} className="ubist-th ubist-th--company">제약사</th>
                  <th colSpan={2} className="ubist-th ubist-th--group-label ubist-col--acc-start ubist-cmp-sticky ubist-cmp-l1">
                    M/S
                  </th>
                  <th className="ubist-th ubist-th--group-label ubist-col--gs ubist-cmp-sticky ubist-cmp-l3">
                    성장률
                  </th>
                  <th className="ubist-th ubist-th--group-label ubist-col--gs ubist-cmp-sticky ubist-cmp-l4 ubist-cmp-last">
                    순위
                  </th>
                  {visibleMonths.map((col) => {
                    const anguk = COMPANY_ROWS.find(r => r.isAnguk);
                    const ms = anguk && MARKET_ROW.sales[col.origIdx]
                      ? (anguk.sales[col.origIdx] / MARKET_ROW.sales[col.origIdx] * 100).toFixed(2) + '%'
                      : '-';
                    return (
                      <th key={`ms${col.origIdx}`} className={`ubist-th ubist-th--group-spacer ubist-th--anguk-ms ${col.cls}`}>
                        {ms}
                      </th>
                    );
                  })}
                </tr>
                <tr className="ubist-thead-cols">
                  <th className="ubist-th ubist-th--data ubist-col--acc-start ubist-cmp-sticky ubist-cmp-l1">25년 3월</th>
                  <th className="ubist-th ubist-th--data ubist-cmp-sticky ubist-cmp-l2">26년 3월</th>
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
                {renderRow(MARKET_ROW, 'market', false)}
              </tbody>
            </table>
          </div>
          {showCount < COMPANY_ROWS.length && (
            <div className="ubist-more-wrap">
              <button
                className="ubist-more-btn"
                onClick={() => setShowCount(c => Math.min(c + STEP, COMPANY_ROWS.length))}
              >
                더보기 ({Math.min(STEP, COMPANY_ROWS.length - showCount)}개 더)
              </button>
            </div>
          )}
          {showCount >= COMPANY_ROWS.length && COMPANY_ROWS.length > INITIAL_SHOW && (
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
