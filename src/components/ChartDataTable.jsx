import { useMemo } from 'react';
import { parseWeekParts } from '../utils/weekUtils';
import './ChartDataTable.css';

function fmtQty(v) {
  if (v == null || v === 0) return '—';
  if (v >= 10000) return `${(v / 10000).toFixed(1)}만`;
  if (v >= 1000)  return `${(v / 1000).toFixed(1)}천`;
  return Math.round(v).toLocaleString();
}

export default function ChartDataTable({ monthGroups, me, mktByWeek, lcKey, metricLabel, period, allWeeks }) {
  const cols = useMemo(() => {
    if (period === '3M') {
      const sliced = allWeeks.slice(-13);
      return sliced.map((w, si) => {
        const globalIdx = allWeeks.length - 13 + si;
        const { satLabel } = parseWeekParts(w);
        const label  = satLabel ? satLabel.split('.').slice(-2).join('.') : w;
        const qty    = me?.byWeek[globalIdx] ?? 0;
        const mkt    = mktByWeek[globalIdx] ?? 0;
        const ms     = mkt > 0 ? qty / mkt * 100 : null;
        const isCurr = si === sliced.length - 1;
        return { key: w, label, qty, ms, isCurr };
      });
    }
    // 1Y: 최근 52주를 월별로 집계 (차트와 동일 기준)
    const sliced52 = allWeeks.slice(-52);
    const monthMap = new Map();
    sliced52.forEach((w, si) => {
      const globalIdx = allWeeks.length - 52 + si;
      const { year, month } = parseWeekParts(w);
      if (year == null) return;
      const key = `${year}-${String(month).padStart(2, '0')}`;
      if (!monthMap.has(key)) monthMap.set(key, { year, month, qty: 0, mkt: 0 });
      const e = monthMap.get(key);
      e.qty += me?.byWeek[globalIdx] ?? 0;
      e.mkt += mktByWeek[globalIdx] ?? 0;
    });
    // 마지막 달은 미완성일 수 있으므로 제외
    return [...monthMap.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .slice(0, -1)
      .map(([key, { year, month, qty, mkt }]) => {
        const ms = mkt > 0 ? qty / mkt * 100 : null;
        return { key, label: `${String(year).slice(2)}.${month}`, qty, ms, isCurr: key === lcKey };
      });
  }, [period, allWeeks, me, mktByWeek, lcKey]);

  return (
    <div className="cdt-wrap">
      <div className="cdt-scroll">
        <table className="cdt-table ag-table">
          <thead>
            <tr>
              <th className="cdt-th-label" />
              {cols.map(c => (
                <th key={c.key} className={`cdt-th${c.isCurr ? ' cdt-curr' : ''}`}>
                  {c.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            <tr>
              <td className="cdt-row-label">{metricLabel}</td>
              {cols.map(c => (
                <td key={c.key} className={`cdt-val${c.isCurr ? ' cdt-curr' : ''}`}>
                  {fmtQty(c.qty)}
                </td>
              ))}
            </tr>
            <tr className="cdt-tr-last ag-tr--zebra">
              <td className="cdt-row-label">MS%</td>
              {cols.map(c => (
                <td key={c.key} className={`cdt-val${c.isCurr ? ' cdt-curr' : ''}`}>
                  {c.ms != null ? `${c.ms.toFixed(1)}%` : '—'}
                </td>
              ))}
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}
