import { useState } from 'react';
import './UbistSummary.css';
import './UbistCompanyAll.css';
import './UbistCompanyClinic.css';

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

/* ── 더미 데이터 (26년 3월 D1 UBIST 제약사별 의원) ── */
const MARKET_ROW = {
  rank: null, label: '시장 전체 (334개사)', isMarket: true,
  sales: [124830, 116340, 111240, 114520, 116010, 117490, 118980, 120470, 121960, 123450, 124940, 126430, 127920, 120980, 110420, 126340],
  ms25: null, ms26: null,
  growth: { mom: 14.4, yoy: 10.2 },
  rankMom: null, rankYoy: null,
};

const COMPANY_ROWS = [
  { rank:  1, label: '한미약품',         isAnguk: false,
    sales: [62318, 58234, 54812, 55634, 56218, 56834, 57418, 58023, 58618, 59234, 59818, 60423, 61234, 57918, 52634, 59318],
    ms25: 4.89, ms26: 4.69, growth: { mom: 12.8, yoy:   5.9 }, rankMom:  0, rankYoy:  0 },
  { rank:  2, label: '종근당',           isAnguk: false,
    sales: [49923, 45823, 43518, 44123, 44523, 44918, 45318, 45718, 46123, 46518, 46918, 47318, 47723, 43218, 39123, 45218],
    ms25: 3.87, ms26: 3.58, growth: { mom: 15.6, yoy:   2.1 }, rankMom:  0, rankYoy:  0 },
  { rank:  3, label: '유한양행',         isAnguk: false,
    sales: [37218, 35923, 32834, 33918, 34318, 34723, 35123, 35518, 35918, 36318, 36718, 37118, 37518, 34618, 32418, 36218],
    ms25: 2.96, ms26: 2.87, growth: { mom: 11.8, yoy:   7.4 }, rankMom:  1, rankYoy:  0 },
  { rank:  4, label: '대웅제약',         isAnguk: false,
    sales: [36218, 33723, 32918, 32912, 33318, 33718, 34118, 34518, 34918, 35318, 35718, 36118, 36618, 34018, 30718, 35123],
    ms25: 2.91, ms26: 2.78, growth: { mom: 14.3, yoy:   6.3 }, rankMom: -1, rankYoy:  0 },
  { rank:  5, label: '에이치케이이노엔', isAnguk: false,
    sales: [29218, 26423, 25518, 26023, 26418, 26818, 27218, 27618, 28023, 28418, 28818, 29218, 30218, 28318, 25618, 29618],
    ms25: 2.30, ms26: 2.34, growth: { mom: 15.6, yoy:  13.4 }, rankMom:  0, rankYoy:  0 },
  { rank:  6, label: '비아트리스',       isAnguk: false,
    sales: [28418, 25918, 26118, 25918, 26218, 26518, 26818, 27118, 27418, 27718, 28018, 28318, 28618, 26218, 23518, 27218],
    ms25: 2.28, ms26: 2.15, growth: { mom: 15.7, yoy:   4.2 }, rankMom: -1, rankYoy: -1 },
  { rank:  7, label: '대웅바이오',       isAnguk: false,
    sales: [27618, 25918, 25318, 26218, 26518, 26818, 27118, 27418, 27718, 28018, 28318, 28618, 29318, 27718, 25118, 28918],
    ms25: 2.29, ms26: 2.29, growth: { mom: 15.2, yoy:  10.4 }, rankMom:  1, rankYoy:  0 },
  { rank:  8, label: '노바티스',         isAnguk: false,
    sales: [26318, 23818, 24818, 24818, 25018, 25218, 25418, 25618, 25818, 26018, 26218, 26418, 26818, 24918, 23218, 26818],
    ms25: 2.19, ms26: 2.12, growth: { mom: 15.5, yoy:   7.2 }, rankMom: -2, rankYoy:  0 },
  { rank:  9, label: '대원제약',         isAnguk: false,
    sales: [31118, 30318, 23918, 24918, 25318, 25718, 26118, 26518, 26918, 27318, 27718, 28118, 28618, 26918, 24218, 26318],
    ms25: 2.19, ms26: 2.08, growth: { mom:  8.6, yoy:   5.3 }, rankMom:  1, rankYoy:  1 },
  { rank: 10, label: '릴리',             isAnguk: false,
    sales: [ 6012,  5768,  6073,  5886,  7012,  8138,  9264, 10390, 11516, 12642, 13768, 14894, 16318, 19418, 19823, 24873],
    ms25: 0.53, ms26: 1.97, growth: { mom: 25.4, yoy: 321.7 }, rankMom:  0, rankYoy: 50 },
  { rank: 11, label: '보령',             isAnguk: false,
    sales: [20618, 19318, 18918, 19418, 19718, 20018, 20318, 20618, 20918, 21218, 21518, 21818, 22218, 21118, 19318, 22218],
    ms25: 1.72, ms26: 1.76, growth: { mom: 15.0, yoy:  14.1 }, rankMom:  1, rankYoy: -3 },
  { rank: 12, label: '셀트리온제약',     isAnguk: false,
    sales: [20818, 19618, 18718, 19218, 19618, 19918, 20218, 20518, 20818, 21118, 21418, 21718, 22018, 20818, 18618, 21318],
    ms25: 1.69, ms26: 1.69, growth: { mom: 14.5, yoy:  10.8 }, rankMom: -1, rankYoy:  1 },
  { rank: 13, label: '베링거인겔하임',   isAnguk: false,
    sales: [21718, 20318, 20318, 20418, 20418, 20418, 20318, 20318, 20318, 20318, 20218, 20218, 20218, 19218, 17518, 20018],
    ms25: 1.79, ms26: 1.58, growth: { mom: 14.3, yoy:  -1.4 }, rankMom:  0, rankYoy: -2 },
  { rank: 14, label: '아스트라제네카',   isAnguk: false,
    sales: [17118, 16418, 16618, 16818, 17118, 17518, 17918, 18218, 18618, 19018, 19418, 19818, 20418, 17918, 18118, 19918],
    ms25: 1.47, ms26: 1.58, growth: { mom:  9.9, yoy:  18.3 }, rankMom:  1, rankYoy:  1 },
  { rank: 15, label: 'JW중외제약',       isAnguk: false,
    sales: [18618, 16918, 16818, 17218, 17418, 17718, 17918, 18118, 18318, 18618, 18818, 19018, 19218, 18218, 16718, 19318],
    ms25: 1.50, ms26: 1.53, growth: { mom: 15.6, yoy:  12.1 }, rankMom: -1, rankYoy:  1 },
  { rank: 16, label: '제일약품',         isAnguk: false,
    sales: [16418, 15318, 14618, 15118, 15418, 15718, 16018, 16318, 16618, 16918, 17218, 17518, 18218, 17418, 15718, 18618],
    ms25: 1.33, ms26: 1.47, growth: { mom: 18.5, yoy:  22.4 }, rankMom:  0, rankYoy: -4 },
  { rank: 17, label: '안국약품',         isAnguk: true,
    sales: [16918, 16018, 14018, 15018, 15418, 15918, 16318, 16818, 17218, 17718, 18118, 18618, 18718, 18018, 16418, 18518],
    ms25: 1.32, ms26: 1.47, growth: { mom: 12.8, yoy:  23.7 }, rankMom: -1, rankYoy:  1 },
  { rank: 18, label: '동아에스티',       isAnguk: false,
    sales: [18518, 16918, 16918, 17118, 17318, 17518, 17718, 17918, 18118, 18318, 18518, 18718, 18718, 17218, 15418, 17718],
    ms25: 1.49, ms26: 1.40, growth: { mom: 14.9, yoy:   3.1 }, rankMom:  1, rankYoy: -1 },
  { rank: 19, label: '오가논',           isAnguk: false,
    sales: [17818, 16218, 15918, 16218, 16418, 16518, 16718, 16818, 17018, 17118, 17218, 17418, 17618, 16518, 14918, 17418],
    ms25: 1.43, ms26: 1.38, growth: { mom: 16.8, yoy:   6.4 }, rankMom: -1, rankYoy: -1 },
  { rank: 20, label: '유나이티드',       isAnguk: false,
    sales: [14918, 13918, 13318, 13518, 13818, 14018, 14218, 14518, 14718, 14918, 15118, 15318, 15518, 14818, 13418, 15418],
    ms25: 1.18, ms26: 1.22, growth: { mom: 14.9, yoy:  13.5 }, rankMom:  0, rankYoy: -3 },
  { rank: 21, label: '한림제약',         isAnguk: false,
    sales: [13518, 12618, 12618, 12918, 13118, 13318, 13518, 13718, 13918, 14118, 14318, 14518, 14718, 13818, 12518, 14718],
    ms25: 1.13, ms26: 1.16, growth: { mom: 17.6, yoy:  13.6 }, rankMom:  0, rankYoy: -2 },
  { rank: 22, label: 'SK케미칼',         isAnguk: false,
    sales: [13918, 12718, 12818, 13218, 13418, 13618, 13818, 14018, 14218, 14318, 14518, 14718, 15118, 14118, 12618, 14718],
    ms25: 1.16, ms26: 1.16, growth: { mom: 16.7, yoy:  11.2 }, rankMom:  1, rankYoy:  6 },
  { rank: 23, label: '다이이찌산쿄',     isAnguk: false,
    sales: [14318, 13218, 13118, 13218, 13418, 13518, 13718, 13818, 14018, 14218, 14318, 14418, 14618, 13818, 12418, 14518],
    ms25: 1.16, ms26: 1.15, growth: { mom: 16.9, yoy:   9.4 }, rankMom:  0, rankYoy: -3 },
  { rank: 24, label: '삼진제약',         isAnguk: false,
    sales: [14218, 13118, 12718, 13118, 13218, 13318, 13418, 13518, 13618, 13818, 13918, 14018, 14118, 12918, 11818, 13918],
    ms25: 1.14, ms26: 1.10, growth: { mom: 17.8, yoy:   6.8 }, rankMom:  1, rankYoy:  1 },
  { rank: 25, label: '아주약품',         isAnguk: false,
    sales: [11418, 10718, 10418, 11018, 11218, 11518, 11718, 12018, 12218, 12518, 12718, 13018, 13118, 12618, 11718, 13618],
    ms25: 0.96, ms26: 1.08, growth: { mom: 16.2, yoy:  22.8 }, rankMom: -1, rankYoy: -2 },
];

const fmt   = (v) => v === null || v === undefined ? '-' : v.toLocaleString('ko-KR', { maximumFractionDigits: 0 });
const fmtMs = (v) => v === null || v === undefined ? '-' : v.toFixed(2) + '%';

const INITIAL_SHOW  = 20;
const STEP          = 20;
const MONTH_WINDOW  = 8;
const DEFAULT_START = MONTHLY_COLS.length - MONTH_WINDOW;

export default function UbistCompanyClinic() {
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
            26년 3월 제약사별 의원
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
