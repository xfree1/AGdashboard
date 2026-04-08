/* VendorTable.jsx — 월별 집계 (최근 6개월) */
import { weekIdToYearMonth } from '../utils/weekUtils';

const pctClass = (v) => (v > 0 ? 'pos' : v < 0 ? 'neg' : '');

export default function VendorTable({ vendorsSorted, allWeeks, myVendor, metricLabel, totalVendorCount }) {
  const monthGroupMap = {};
  allWeeks.forEach((wk, idx) => {
    const r = weekIdToYearMonth(wk);
    if (!r) return;
    const key = `${r.year}-${String(r.month).padStart(2, '0')}`;
    if (!monthGroupMap[key]) monthGroupMap[key] = { year: r.year, month: r.month, indices: [] };
    monthGroupMap[key].indices.push(idx);
  });

  const last6 = Object.keys(monthGroupMap)
    .sort()
    .slice(-6)
    .map(k => monthGroupMap[k]);

  if (last6.length === 0) return null;

  const marketByMonth = last6.map(({ indices }) =>
    vendorsSorted.reduce((sum, v) => {
      const avg = indices.reduce((a, i) => a + (v.allByWeek[i] ?? 0), 0) / indices.length;
      return sum + avg;
    }, 0)
  );

  const allVendors = vendorsSorted
    .map(v => {
      const monthlyAvg = last6.map(({ indices }) =>
        indices.reduce((a, i) => a + (v.allByWeek[i] ?? 0), 0) / indices.length
      );
      const msPerMonth = monthlyAvg.map((val, mi) =>
        marketByMonth[mi] > 0 ? val / marketByMonth[mi] : 0
      );
      const lastMs  = msPerMonth[msPerMonth.length - 1] * 100;
      const prevMs  = msPerMonth.length >= 2 ? msPerMonth[msPerMonth.length - 2] * 100 : null;
      const gr      = prevMs != null ? lastMs - prevMs : null;
      const rankVal = monthlyAvg[monthlyAvg.length - 1];
      return { name: v.name, monthlyAvg, lastMs, gr, rankVal };
    })
    .sort((a, b) => b.rankVal - a.rankVal);

  // 안국약품 순위 기준으로 10위 단위 브래킷 결정
  const myIdx      = allVendors.findIndex(v => v.name === myVendor);
  const bracketIdx = myIdx >= 0 ? Math.floor(myIdx / 10) : 0;
  const rangeStart = bracketIdx * 10;       // 0-based
  const rangeEnd   = rangeStart + 10;       // exclusive

  const above   = allVendors.slice(0, rangeStart);
  const bracket = allVendors.slice(rangeStart, rangeEnd);
  const below   = allVendors.slice(rangeEnd);

  const makeEtcRow = (label, list) => list.length === 0 ? null : {
    name: label,
    monthlyAvg: last6.map((_, mi) => list.reduce((s, v) => s + v.monthlyAvg[mi], 0)),
    lastMs: list.reduce((s, v) => s + v.lastMs, 0),
    gr: null,
    rankVal: null,
    isEtc: true,
  };

  const belowRow = makeEtcRow('기타', below);

  const vendors = [
    ...bracket,
    ...(belowRow ? [belowRow] : []),
  ];

  // 브래킷 표시용 (1-based)
  const bracketLabel = `${rangeStart + 1}위 ~ ${Math.min(rangeEnd, allVendors.length)}위`;

  const lastMonth = last6[last6.length - 1];
  const msHeader  = `${lastMonth.month}월 M/S`;
  const grHeader  = '증감(%p)';

  const mktLast = marketByMonth[marketByMonth.length - 1];
  const mktPrev = marketByMonth.length >= 2 ? marketByMonth[marketByMonth.length - 2] : null;
  const mktGR   = mktPrev != null && mktPrev > 0
    ? (mktLast - mktPrev) / mktPrev * 100
    : null;

  const sepMonthIdx = last6.length - 2;

  const monthCls = (i) => {
    const cur = i === last6.length - 1 ? 'col-cur' : '';
    const sep = i === sepMonthIdx      ? 'grp-sep' : '';
    return `val ${cur} ${sep}`.trim();
  };

  return (
    <div className="ag-card">
      <div className="ag-card__header">
        <div>
          <div className="ag-card__title">판매사 순위</div>
          <div className="ag-card__sub">{metricLabel} 기준 · {bracketLabel} · 전체 {totalVendorCount ?? vendorsSorted.length}개사</div>
        </div>
      </div>

      <div className="dd-table-wrap dd-table-wrap--noscroll">
        <table className="dd-table dd-table--fixed">
          <colgroup>
            <col className="col-rank" />
            <col className="col-name" />
            {last6.map((_, i) => (
              <col key={i} className={i === last6.length - 1 ? 'col-month col-cur' : 'col-month'} />
            ))}
            <col className="col-ms" />
            <col className="col-gr" />
          </colgroup>
          <thead>
            <tr>
              <th className="rank">순위</th>
              <th>판매사</th>
              {last6.map(({ year, month }, i) => (
                <th key={`${year}-${month}`} className={monthCls(i)}>{month}월</th>
              ))}
              <th className="val col-cur">{msHeader}</th>
              <th className="val col-cur">{grHeader}</th>
            </tr>
          </thead>
          <tbody>
            {vendors.map((v, idx) => {
              const isMe  = v.name === myVendor;
              const isEtc = v.isEtc;
              const rankNum = isEtc ? null : rangeStart + idx + 1;
              return (
                <tr key={v.name} className={isMe ? 'dd-table__my-row' : ''}>
                  <td className="rank">{rankNum ?? ''}</td>
                  <td className="name">{v.name}</td>
                  {v.monthlyAvg.map((val, mi) => (
                    <td key={mi} className={monthCls(mi)}>
                      {Math.round(val).toLocaleString()}
                    </td>
                  ))}
                  <td className="val col-cur">{v.lastMs.toFixed(1)}%</td>
                  <td className={`val col-cur ${v.gr != null ? pctClass(v.gr) : ''}`}>
                    {v.gr != null
                      ? `${v.gr >= 0 ? '+' : ''}${v.gr.toFixed(2)}%p`
                      : '—'}
                  </td>
                </tr>
              );
            })}

            {/* Total 행 */}
            <tr className="dd-table__total-row">
              <td className="rank total"></td>
              <td className="name total">Total</td>
              {marketByMonth.map((val, mi) => (
                <td key={mi} className={`${monthCls(mi)} total`}>
                  {Math.round(val).toLocaleString()}
                </td>
              ))}
              <td colSpan={2} className="val col-cur total mkt-gr-cell">
                시장 전월 대비{' '}
                <span className="mkt-gr-value">
                  {mktGR != null ? `${mktGR >= 0 ? '+' : ''}${mktGR.toFixed(1)}%` : '—'}
                </span>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}
