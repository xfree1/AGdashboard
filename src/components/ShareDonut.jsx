import { useMemo } from 'react';
import { PieChart, Pie, Cell } from 'recharts';
import { COLOR_ACCENT, DONUT_OTHER_COLORS } from '../styles/tokens';

export default function ShareDonut({ vendors, myVendor, drugName, lastWeekLabel, topN = 3 }) {
  const donutData = useMemo(() => {
    // vendors는 total 기준 내림차순 정렬
    const myEntry = vendors.find(v => v.name === myVendor);

    // "기타"로 저장된 vendor는 top N 경쟁에서 제외 → 항상 기타 합산으로
    const namedOthers = vendors.filter(v => v.name !== myVendor && v.name !== '기타');
    const etcVendors  = vendors.filter(v => v.name !== myVendor && v.name === '기타');

    // 안국약품 순위와 무관하게 경쟁사 항상 4개 고정 → 총 6개(안국+4+기타)
    const topOthers   = namedOthers.slice(0, 4);
    const othersSlice = [...namedOthers.slice(4), ...etcVendors];
    const othersTotal = othersSlice.reduce((s, v) => s + v.msTotal, 0);

    // 순서: 안국약품 > 1위 > 2위 > ... > 기타
    let otherIdx = 0;
    const data = [];

    if (myEntry) {
      data.push({
        name:  myVendor,
        value: parseFloat((myEntry.msTotal * 100).toFixed(1)),
        color: COLOR_ACCENT,
      });
    }

    topOthers.forEach(v => {
      data.push({
        name:  v.name,
        value: parseFloat((v.msTotal * 100).toFixed(1)),
        color: DONUT_OTHER_COLORS[otherIdx++ % DONUT_OTHER_COLORS.length],
      });
    });

    if (othersTotal > 0) data.push({
      name:  '기타',
      value: parseFloat((othersTotal * 100).toFixed(1)),
      color: DONUT_OTHER_COLORS[otherIdx % DONUT_OTHER_COLORS.length],
    });

    return data;
  }, [vendors, myVendor]);

  const myMs = donutData.find(d => d.name === myVendor)?.value ?? 0;

  return (
    <div className="ag-card ag-card--donut">
      <div className="ag-card__header">
        <div>
          <div className="ag-card__title">M/S 현황</div>
          <div className="ag-card__sub">{lastWeekLabel} 기준</div>
        </div>
      </div>

      {/* wrap을 PieChart와 동일한 200×200으로 고정 → 중앙 텍스트 50%/50%가 정확히 cx/cy에 일치 */}
      <div className="ag-donut-wrap">
        <div className="ag-donut-chart">
          <PieChart width={200} height={200} margin={{ top: 0, right: 0, bottom: 0, left: 0 }} style={{ pointerEvents: 'none' }}>
            <Pie
              data={donutData}
              cx={100} cy={100}
              innerRadius={68} outerRadius={88}
              dataKey="value"
              startAngle={90} endAngle={-270}
              strokeWidth={0}
              isAnimationActive={false}
            >
              {donutData.map((d, i) => (
                <Cell key={i} fill={d.color} />
              ))}
            </Pie>
          </PieChart>
          <div className="ag-donut-center">
            <div className="ag-donut-pct">{myMs.toFixed(1)}%</div>
            <div className="ag-donut-label">{myVendor}</div>
          </div>
        </div>
      </div>

      <div className="ag-donut-legend">
        {donutData.map((d) => {
          const isMe = d.name === myVendor;
          return (
            <div key={d.name} className="ag-legend-item">
              <div className="ag-legend-item__left">
                <span className="ag-legend-dot" style={{ background: d.color }} />
                <span
                  className="ag-legend-name"
                  style={isMe ? { fontWeight: 700, color: 'var(--text)' } : {}}
                >
                  {d.name}
                </span>
              </div>
              <span className="ag-legend-val" style={isMe ? { fontWeight: 700 } : {}}>
                {d.value.toFixed(1)}%
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
