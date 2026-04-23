import { useState } from 'react';
import './UbistSummary.css';
import './UbistCompanyAll.css';

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

/* ── 실제 데이터 (26년 3월 D1 UBIST 제약사별 전체) ──
   sales: 백만원, ms25/ms26: M/S(%), growth.mom/yoy: %
   rankMom: 전월대비 순위 변화, rankYoy: 전년대비 순위 변화
── */
const MARKET_ROW = {
  rank: null, label: '시장 전체 (334개사)', isMarket: true,
  sales: [197270, 184020, 175700, 181030, 183340, 185650, 187960, 190270, 192580, 194890, 197200, 199510, 201850, 190860, 174410, 199570],
  ms25: null, ms26: null,
  growth: { mom: 14.4, yoy: 10.2 },
  rankMom: null, rankYoy: null,
};

const COMPANY_ROWS = [
  { rank:  1, label: '한미약품',         isAnguk: false,
    sales: [99521, 92847, 87134, 88512, 89632, 90718, 91843, 92956, 94012, 95134, 96247, 97318, 98723, 91834, 83214, 94328],
    ms25: 4.89, ms26: 4.72, growth: { mom: 13.4, yoy:   6.5 }, rankMom:  0, rankYoy:  0 },
  { rank:  2, label: '종근당',           isAnguk: false,
    sales: [79682, 73124, 69418, 70523, 70934, 71342, 71718, 72134, 72518, 72934, 73342, 73718, 74218, 69034, 62518, 72218],
    ms25: 3.89, ms26: 3.62, growth: { mom: 15.5, yoy:   2.4 }, rankMom:  0, rankYoy:  0 },
  { rank:  3, label: '대웅제약',         isAnguk: false,
    sales: [57982, 53847, 52834, 52812, 53418, 54012, 54623, 55234, 55812, 56418, 57023, 57618, 58512, 54418, 48987, 56128],
    ms25: 2.92, ms26: 2.81, growth: { mom: 14.5, yoy:   6.1 }, rankMom:  0, rankYoy:  0 },
  { rank:  4, label: '유한양행',         isAnguk: false,
    sales: [52318, 50512, 46134, 47723, 48218, 48718, 49234, 49718, 50218, 50712, 51218, 51723, 52218, 48512, 45512, 50812],
    ms25: 2.63, ms26: 2.55, growth: { mom: 11.7, yoy:   6.6 }, rankMom:  0, rankYoy: -1 },
  { rank:  5, label: '에이치케이이노엔', isAnguk: false,
    sales: [46723, 42218, 40812, 41612, 42318, 43012, 43718, 44412, 45134, 45823, 46518, 47218, 48318, 45312, 41023, 47318],
    ms25: 2.30, ms26: 2.37, growth: { mom: 15.3, yoy:  13.8 }, rankMom:  0, rankYoy:  0 },
  { rank:  6, label: '대웅바이오',       isAnguk: false,
    sales: [44218, 41418, 40512, 41912, 42418, 42934, 43418, 43912, 44412, 44918, 45418, 45912, 46823, 44418, 40218, 46312],
    ms25: 2.31, ms26: 2.32, growth: { mom: 15.1, yoy:  10.6 }, rankMom:  1, rankYoy:  0 },
  { rank:  7, label: '비아트리스',       isAnguk: false,
    sales: [45418, 41418, 41723, 41512, 41918, 42318, 42718, 43134, 43518, 43912, 44318, 44723, 45218, 41823, 37618, 43318],
    ms25: 2.29, ms26: 2.17, growth: { mom: 15.1, yoy:   4.4 }, rankMom: -2, rankYoy: -1 },
  { rank:  8, label: '노바티스',         isAnguk: false,
    sales: [42318, 38134, 39718, 39712, 40023, 40318, 40612, 40918, 41218, 41512, 41823, 42134, 42718, 39912, 37218, 42823],
    ms25: 2.19, ms26: 2.14, growth: { mom: 15.0, yoy:   7.8 }, rankMom:  0, rankYoy:  0 },
  { rank:  9, label: '대원제약',         isAnguk: false,
    sales: [49823, 48512, 38318, 39812, 40512, 41218, 41912, 42618, 43318, 44023, 44718, 45418, 45912, 43134, 38812, 42134],
    ms25: 2.20, ms26: 2.11, growth: { mom:  8.3, yoy:   5.7 }, rankMom:  1, rankYoy:  1 },
  { rank: 10, label: '릴리',             isAnguk: false,
    sales: [ 9612,  9218,  9718,  9412, 11218, 13023, 14823, 16618, 18418, 20218, 22012, 23823, 26023, 31023, 31618, 39723],
    ms25: 0.52, ms26: 1.99, growth: { mom: 25.5, yoy: 322.4 }, rankMom:  0, rankYoy: 50 },
  { rank: 11, label: '보령',             isAnguk: false,
    sales: [33012, 30918, 30218, 31134, 31618, 32134, 32618, 33134, 33618, 34134, 34618, 35134, 35512, 33823, 30918, 35518],
    ms25: 1.72, ms26: 1.78, growth: { mom: 14.7, yoy:  14.2 }, rankMom:  1, rankYoy: -3 },
  { rank: 12, label: '셀트리온제약',     isAnguk: false,
    sales: [33418, 31518, 30023, 30823, 31318, 31823, 32318, 32823, 33318, 33823, 34318, 34823, 35218, 33318, 29918, 34134],
    ms25: 1.70, ms26: 1.71, growth: { mom: 14.3, yoy:  11.0 }, rankMom: -1, rankYoy:  1 },
  { rank: 13, label: '베링거인겔하임',   isAnguk: false,
    sales: [34823, 32518, 32518, 32618, 32618, 32618, 32518, 32518, 32518, 32518, 32418, 32418, 32418, 30823, 28023, 32023],
    ms25: 1.80, ms26: 1.60, growth: { mom: 14.1, yoy:  -1.8 }, rankMom:  0, rankYoy: -2 },
  { rank: 14, label: '아스트라제네카',   isAnguk: false,
    sales: [27318, 26218, 26518, 26823, 27418, 28023, 28618, 29218, 29823, 30418, 31023, 31618, 32618, 28618, 28918, 31823],
    ms25: 1.48, ms26: 1.59, growth: { mom:  9.9, yoy:  18.4 }, rankMom:  1, rankYoy:  1 },
  { rank: 15, label: 'JW중외제약',       isAnguk: false,
    sales: [29718, 27023, 26823, 27518, 27918, 28318, 28618, 29023, 29318, 29718, 30023, 30418, 30718, 29218, 26823, 30918],
    ms25: 1.52, ms26: 1.55, growth: { mom: 15.0, yoy:  12.3 }, rankMom: -1, rankYoy:  1 },
  { rank: 16, label: '제일약품',         isAnguk: false,
    sales: [26318, 24518, 23318, 24218, 24718, 25218, 25718, 26218, 26718, 27218, 27718, 28218, 29134, 27823, 25218, 29718],
    ms25: 1.34, ms26: 1.49, growth: { mom: 18.0, yoy:  22.6 }, rankMom:  0, rankYoy: -4 },
  { rank: 17, label: '안국약품',         isAnguk: true,
    sales: [27134, 25618, 22418, 24023, 24718, 25418, 26134, 26823, 27518, 28218, 28918, 29618, 29918, 28823, 26218, 29618],
    ms25: 1.33, ms26: 1.48, growth: { mom: 13.0, yoy:  23.3 }, rankMom: -1, rankYoy:  1 },
  { rank: 18, label: '동아에스티',       isAnguk: false,
    sales: [29618, 27023, 27023, 27418, 27718, 28023, 28318, 28618, 28918, 29218, 29518, 29823, 29823, 27518, 24718, 28318],
    ms25: 1.51, ms26: 1.42, growth: { mom: 15.0, yoy:   3.3 }, rankMom:  1, rankYoy: -1 },
  { rank: 19, label: '오가논',           isAnguk: false,
    sales: [28418, 25918, 25418, 26023, 26218, 26418, 26618, 26823, 27023, 27218, 27418, 27718, 28023, 26418, 23823, 27823],
    ms25: 1.44, ms26: 1.39, growth: { mom: 16.6, yoy:   6.6 }, rankMom: -1, rankYoy: -1 },
  { rank: 20, label: '유나이티드',       isAnguk: false,
    sales: [23823, 22218, 21318, 21618, 22023, 22418, 22823, 23134, 23518, 23918, 24218, 24518, 24823, 23618, 21418, 24618],
    ms25: 1.19, ms26: 1.23, growth: { mom: 15.0, yoy:  13.7 }, rankMom:  0, rankYoy: -3 },
  { rank: 21, label: '한림제약',         isAnguk: false,
    sales: [21618, 20218, 20218, 20718, 21023, 21318, 21618, 21918, 22218, 22518, 22823, 23134, 23518, 22134, 20023, 23518],
    ms25: 1.14, ms26: 1.18, growth: { mom: 17.8, yoy:  13.8 }, rankMom:  0, rankYoy: -2 },
  { rank: 22, label: 'SK케미칼',         isAnguk: false,
    sales: [22218, 20318, 20518, 21134, 21418, 21718, 22023, 22318, 22618, 22918, 23218, 23518, 24134, 22518, 20218, 23518],
    ms25: 1.17, ms26: 1.18, growth: { mom: 16.2, yoy:  11.4 }, rankMom:  1, rankYoy:  6 },
  { rank: 23, label: '다이이찌산쿄',     isAnguk: false,
    sales: [22918, 21218, 21023, 21218, 21418, 21618, 21823, 22023, 22218, 22418, 22618, 22823, 23318, 22134, 19823, 23134],
    ms25: 1.17, ms26: 1.16, growth: { mom: 17.0, yoy:   9.1 }, rankMom:  0, rankYoy: -3 },
  { rank: 24, label: '삼진제약',         isAnguk: false,
    sales: [22718, 21023, 20318, 20918, 21134, 21218, 21418, 21618, 21823, 22023, 22218, 22318, 22518, 20718, 18823, 22218],
    ms25: 1.15, ms26: 1.11, growth: { mom: 18.4, yoy:   6.4 }, rankMom:  1, rankYoy:  1 },
  { rank: 25, label: '아주약품',         isAnguk: false,
    sales: [18318, 17134, 16718, 17618, 18023, 18418, 18823, 19218, 19618, 20023, 20318, 20618, 20918, 20218, 18718, 21718],
    ms25: 0.97, ms26: 1.09, growth: { mom: 15.9, yoy:  23.1 }, rankMom: -1, rankYoy: -2 },
];

const fmt   = (v) => v === null || v === undefined ? '-' : v.toLocaleString('ko-KR', { maximumFractionDigits: 0 });
const fmtMs = (v) => v === null || v === undefined ? '-' : v.toFixed(1) + '%';

const INITIAL_SHOW  = 20;
const STEP          = 20;
const MONTH_WINDOW  = 8;
const DEFAULT_START = MONTHLY_COLS.length - MONTH_WINDOW;

export default function UbistCompanyAll() {
  const [showCount,  setShowCount]  = useState(INITIAL_SHOW);
  const [startIdx,   setStartIdx]   = useState(DEFAULT_START);
  const [growthMode, setGrowthMode] = useState('mom'); // 'mom' | 'yoy'
  const [rankMode,   setRankMode]   = useState('mom'); // 'mom' | 'yoy'

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
        {/* M/S */}
        <td className="ubist-td ubist-td--num ubist-col--acc-start ubist-cmp-sticky ubist-cmp-l1">
          {fmtMs(row.ms26)}
        </td>
        <td className="ubist-td ubist-td--num ubist-cmp-sticky ubist-cmp-l2">
          {fmtMs(row.ms25)}
        </td>
        {/* 성장률 (토글) */}
        <td className="ubist-td ubist-td--num ubist-col--gs ubist-cmp-sticky ubist-cmp-l3">
          <GrowthVal value={growthMode === 'mom' ? row.growth?.mom : row.growth?.yoy} />
        </td>
        {/* 제약사 순위 (토글) */}
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
    <div className="ubist-wrap ubist-wrap--company-all">
      <div className="ubist-section-group">
        <div className="ubist-section-title">
          <span className="ubist-title-text">
            26년 3월 제약사별 전체
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
                {/* ── 1행: 그룹 라벨 ── */}
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
                {/* ── 2행: 서브 헤더 (클릭 토글) ── */}
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
