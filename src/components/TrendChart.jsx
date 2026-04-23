import { useMemo } from 'react';
import {
  ComposedChart, Bar, Line, XAxis, YAxis, Tooltip,
  CartesianGrid, ResponsiveContainer,
} from 'recharts';
import { parseWeekParts } from '../utils/weekUtils';
import {
  COLOR_CHART_MARKET   as MARKET_COLOR,
  COLOR_CHART_MS       as MS_COLOR,
  COLOR_TEXT_3         as TEXT_3,
  FONT_SANS,
} from '../styles/tokens';
import './TrendChart.css';

const CHART_PERIODS = [
  { label: '3개월', value: '3M', weeks: 13 },
  { label: '12개월', value: '1Y', weeks: 52 },
];

function fmtCompact(v) {
  if (v >= 100000000) return `${(v / 100000000).toFixed(2)}억`;
  if (v >= 10000)     return `${(v / 10000).toFixed(1)}만`;
  if (v >= 1000)      return `${(v / 1000).toFixed(1)}천`;
  return String(v);
}

function fmtAxis(v) {
  if (v >= 100000) return `${(v / 10000).toFixed(0)}만`;
  if (v >= 10000)  return `${(v / 10000).toFixed(1)}만`;
  if (v >= 1000)   return `${(v / 1000).toFixed(0)}K`;
  return String(v);
}

function ChartTooltip({ active, payload, myVendor }) {
  if (!active || !payload?.length) return null;
  const row = payload[0]?.payload;
  if (!row) return null;

  const total = row._total ?? 0;
  const myVal = row._myVal ?? 0;
  const ms    = row.ms ?? 0;
  const topVendors = (row._vendors ?? []).slice(0, 3);

  return (
    <div className="tc-tooltip">
      <div className="tc-tooltip__date">
        {row.tooltip ?? row.label}
      </div>
      <div className="tc-tooltip__my-row">
        <span>{myVendor}</span><span>{fmtCompact(myVal)}</span>
      </div>
      {topVendors.map(v => (
        <div key={v.name} className="tc-tooltip__vendor-row">
          <span>{v.name}</span><span>{fmtCompact(v.val)}</span>
        </div>
      ))}
      <div className="tc-tooltip__divider">
        <span>전체</span><span>{fmtCompact(total)}</span>
      </div>
      <div className="tc-tooltip__ms-row">
        <span>MS</span><span>{ms.toFixed(1)}%</span>
      </div>
    </div>
  );
}

export default function TrendChart({ allWeeks, vendorsSorted, myVendor, metricLabel, period, onPeriodChange }) {
  const periodConfig = CHART_PERIODS.find(p => p.value === period);

  const chartWeeks = useMemo(
    () => allWeeks.slice(-periodConfig.weeks),
    [allWeeks, periodConfig.weeks],
  );
  const chartWeekIndices = useMemo(
    () => chartWeeks.map(w => allWeeks.indexOf(w)),
    [chartWeeks, allWeeks],
  );

  const weeklyRaw = useMemo(() =>
    chartWeeks.map((w, wi) => {
      const idx    = chartWeekIndices[wi];
      const parsed = parseWeekParts(w);
      const abs    = {};
      let total    = 0;
      vendorsSorted.forEach(v => {
        const val   = v.allByWeek[idx] ?? 0;
        abs[v.name] = val;
        total      += val;
      });
      return { parsed, abs, total };
    }),
  [chartWeeks, chartWeekIndices, vendorsSorted]);

  function makeRow(abs, total, labelStr, tooltipStr) {
    const myVal = abs[myVendor] ?? 0;
    return {
      label:    labelStr,
      tooltip:  tooltipStr,
      _total:   Math.round(total),
      _myVal:   Math.round(myVal),
      ms:       total > 0 ? myVal / total * 100 : 0,
      _vendors: vendorsSorted
        .filter(v => v.name !== myVendor)
        .map(v => ({ name: v.name, val: Math.round(abs[v.name] ?? 0) }))
        .filter(v => v.val > 0)
        .sort((a, b) => b.val - a.val),
    };
  }

  const chartData = useMemo(() => {
    if (period === '3M') {
      return weeklyRaw.map(d => {
        const full = d.parsed.satLabel ?? '';
        const lbl  = full ? full.split('.').slice(-2).join('.') : '';
        return makeRow(d.abs, d.total, lbl, full);
      });
    }
    const monthMap = new Map();
    weeklyRaw.forEach(d => {
      const { year, month } = d.parsed;
      if (year == null) return;
      const key = `${year}-${String(month).padStart(2, '0')}`;
      if (!monthMap.has(key)) monthMap.set(key, { year, month, abs: {}, total: 0 });
      const e = monthMap.get(key);
      e.total += d.total;
      Object.entries(d.abs).forEach(([k, v]) => { e.abs[k] = (e.abs[k] ?? 0) + v; });
    });
    // 마지막 달은 미완성일 수 있으므로 제외
    const sorted = [...monthMap.entries()].sort(([a], [b]) => a.localeCompare(b)).slice(0, -1);
    return sorted.map(([, e], i) => {
      const prevYear  = i > 0 ? sorted[i - 1][1].year : null;
      const isNewYear = !prevYear || prevYear !== e.year;
      const labelStr  = isNewYear ? `${String(e.year).slice(2)}.${e.month}` : String(e.month);
      return makeRow(e.abs, e.total, labelStr, `${e.year}년 ${e.month}월`);
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [weeklyRaw, period, myVendor]);

  const { msDomain, msTicks } = useMemo(() => {
    const msValues = chartData.map(d => d.ms).filter(v => v > 0);
    if (msValues.length === 0) return { msDomain: [0, 20], msTicks: [0, 5, 10, 15, 20] };
    const N = 4; // leftTicks 와 동일하게 4 intervals → 5 ticks
    const minMs = Math.min(...msValues);
    const maxMs = Math.max(...msValues);
    const range   = Math.max(maxMs - minMs, 1);
    const padding = Math.max(2, range * 0.15);
    const rawStep = (maxMs + padding - (minMs - padding)) / N;
    const mag     = Math.pow(10, Math.floor(Math.log10(rawStep)));
    const step    = Math.ceil(rawStep / mag) * mag;
    const lo      = Math.max(0,   Math.floor((minMs - padding) / step) * step);
    const hi      = Math.min(100, lo + step * N);
    const ticks   = Array.from({ length: N + 1 }, (_, i) =>
      Math.round((lo + step * i) * 10) / 10
    );
    return { msDomain: [lo, hi], msTicks: ticks };
  }, [chartData]);

  const { yLeftMax, yLeftInterval } = useMemo(() => {
    const maxVal = Math.max(...chartData.map(d => d._total), 1);
    const mag    = Math.pow(10, Math.floor(Math.log10(maxVal)));
    const step   = mag * (maxVal / mag <= 2 ? 0.5 : maxVal / mag <= 5 ? 1 : 2);
    const max    = Math.ceil(maxVal / step) * step;
    return { yLeftMax: max, yLeftInterval: max / 4 };
  }, [chartData]);

  const leftTicks = useMemo(() => {
    const ticks = [];
    for (let i = 0; i <= 4; i++) ticks.push(Math.round(yLeftInterval * i));
    return ticks;
  }, [yLeftInterval]);


  const summary = useMemo(() => {
    const half  = Math.floor(weeklyRaw.length / 2);
    const sumV  = (arr, key) => arr.reduce((s, d) => s + (d.abs[key] ?? 0), 0);
    const sumT  = (arr) => arr.reduce((s, d) => s + d.total, 0);
    const curr  = weeklyRaw.slice(half);
    const prev  = weeklyRaw.slice(0, half);
    const totalMy  = Math.round(sumV(weeklyRaw, myVendor));
    const totalMkt = Math.round(sumT(weeklyRaw));
    const gr       = (c, p) => p > 0 ? (c - p) / p * 100 : null;
    const msOf     = (arr) => { const t = sumT(arr); return t > 0 ? sumV(arr, myVendor) / t * 100 : 0; };
    return {
      totalMy, totalMkt,
      msAvg:     totalMkt > 0 ? sumV(weeklyRaw, myVendor) / sumT(weeklyRaw) * 100 : 0,
      msChgPp:   msOf(curr) - msOf(prev),
      growthMkt: gr(sumT(curr), sumT(prev)),
    };
  }, [weeklyRaw, myVendor]);

  return (
    <>

      {/* 헤더 */}
      <div className="ag-card__header">
        <div className="ag-title-row">
          <div className="ag-info-icon" data-tooltip={`전체시장 대비 ${myVendor} MS 트렌드`}>i</div>
          <div className="ag-card__title">{metricLabel} 트렌드</div>
        </div>
        <div className="ag-card__header-right">
          <div className="ag-chart-legend">
            <div className="ag-chart-legend__item">
              <svg width="16" height="12">
                <rect x="0" y="2" width="16" height="8" fill={MARKET_COLOR} rx="2" />
              </svg>
              <span>{metricLabel}</span>
            </div>
            <div className="ag-chart-legend__item">
              <svg width="24" height="12">
                <line x1="0" y1="6" x2="24" y2="6" stroke={MS_COLOR} strokeWidth="2" />
              </svg>
              <span>MS%</span>
            </div>
          </div>
          <div className="ag-period-tabs">
            {CHART_PERIODS.map(p => (
              <div key={p.value}
                className={`ag-period-tab ${period === p.value ? 'active' : ''}`}
                onClick={() => onPeriodChange(p.value)}
              >{p.label}</div>
            ))}
          </div>
        </div>
      </div>

      {/* 요약 위젯 */}
      <div className="ag-trend-summary">
        <div className="ag-trend-summary__group">
          <div className="ag-trend-summary__label">{CHART_PERIODS.find(p => p.value === period)?.label} 전체시장</div>
          <div className="ag-trend-summary__value-row">
            <span className="ag-trend-summary__number"
              title={summary.totalMkt.toLocaleString()}>
              {fmtCompact(summary.totalMkt)}
            </span>
          </div>
        </div>

        <div className="ag-trend-summary__vdiv" />

        <div className="ag-trend-summary__group">
          <div className="ag-trend-summary__label-row">
            <span className="ag-trend-summary__label">{myVendor}</span>
          </div>
          <div className="ag-trend-summary__value-row">
            <span className="ag-trend-summary__number">
              {summary.msAvg.toFixed(1)}%
            </span>
            <span className={`ag-trend-summary__badge ${summary.msChgPp >= 0 ? 'up' : 'down'}`}>
              {summary.msChgPp >= 0 ? '▲' : '▼'} {Math.abs(summary.msChgPp).toFixed(1)}%p
            </span>
          </div>
        </div>
      </div>

      {/* 콤보 차트 */}
      <div className="ag-chart-wrap">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart
            data={chartData}
            barCategoryGap="30%"
            margin={{ top: 10, right: 6, bottom: 4, left: 6 }}
          >
            <defs>
              <linearGradient id="barGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#93c5fd" />
                <stop offset="100%" stopColor="#60a5fa" />
              </linearGradient>
            </defs>
            <CartesianGrid
              vertical={false}
              yAxisId="left"
              strokeDasharray="3 3"
              stroke="rgba(148,163,184,0.5)"
            />
            <XAxis
              dataKey="label"
              axisLine={false}
              tickLine={false}
              tick={{ fill: TEXT_3, fontSize: 11, fontFamily: FONT_SANS }}
            />
            <YAxis
              yAxisId="left"
              ticks={leftTicks}
              domain={[0, yLeftMax]}
              axisLine={false}
              tickLine={false}
              tick={{ fill: TEXT_3, fontSize: 11, fontFamily: FONT_SANS }}
              tickFormatter={fmtAxis}
              width={32}
            />
            <YAxis
              yAxisId="right"
              orientation="right"
              ticks={msTicks}
              domain={[msDomain[0], msDomain[1]]}
              axisLine={false}
              tickLine={false}
              tick={{ fill: MS_COLOR, fontSize: 11, fontFamily: FONT_SANS }}
              tickFormatter={v => `${Math.round(v)}%`}
              width={32}
            />
            <Tooltip
              content={(props) => <ChartTooltip {...props} myVendor={myVendor} />}
              cursor={{ fill: 'rgba(148,163,184,0.08)' }}
            />
            <Bar
              yAxisId="left"
              dataKey="_total"
              fill="url(#barGrad)"
              maxBarSize={90}
              radius={[3, 3, 0, 0]}
              isAnimationActive={false}
            />
            <Line
              yAxisId="right"
              dataKey="ms"
              stroke={MS_COLOR}
              strokeWidth={2}
              dot={false}
              activeDot={{ r: 4, fill: MS_COLOR }}
              isAnimationActive={false}
            />
          </ComposedChart>
        </ResponsiveContainer>
      </div>
    </>
  );
}
