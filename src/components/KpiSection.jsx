import './KPICard.css';

const toMan = (n) => {
  if (n == null) return null;
  return n >= 10000 ? `${Math.floor(n / 10000)}만` : n.toLocaleString();
};

function KpiCard({ label, value, icon, rateText, rateUp, prevText }) {
  return (
    <div className="kpi-card">
      <div className="kpi-header">
        <span className="kpi-label">{label}</span>
        {icon && <div className="kpi-icon">{icon}</div>}
      </div>
      <div className="kpi-main">
        <span className="kpi-value">{value}</span>
      </div>
      {(rateText || prevText) && (
        <p className="kpi-sub">
          {rateText && (
            <span className={rateUp ? 'sub-rate-up' : 'sub-rate-down'}>{rateText}</span>
          )}
          {rateText && prevText && <span className="sub-divider">·</span>}
          {prevText && <span className="sub-prev">{prevText}</span>}
        </p>
      )}
    </div>
  );
}

const toEok = (n) => {
  if (n == null) return null;
  if (n >= 100000000) return `${(n / 100000000).toFixed(1)}억`;
  if (n >= 10000)     return `${Math.floor(n / 10000)}만`;
  return n.toLocaleString();
};

export default function KpiSection({
  myRxCurr, myRxPrev, myRxLy,
  mktRxCurr, mktRxPrev,
  salesCurr, salesPrev,
  currLabel,
  metricLabel, showGR,
}) {
  const myRxPct   = myRxPrev != null && myRxPrev > 0 ? (myRxCurr - myRxPrev) / myRxPrev * 100 : null;
  const mktPct    = mktRxPrev != null && mktRxPrev > 0 ? (mktRxCurr - mktRxPrev) / mktRxPrev * 100 : null;
  const salesPct  = salesPrev != null && salesPrev > 0 ? (salesCurr - salesPrev) / salesPrev * 100 : null;
  const yoyPct    = myRxLy != null && myRxLy > 0 ? (myRxCurr - myRxLy) / myRxLy * 100 : null;

  const fmtPct = (pct) => pct != null ? `${pct >= 0 ? '↑' : '↓'} ${Math.abs(pct).toFixed(1)}%` : null;

  return (
    <div className="kpi-row">

      {/* 카드 0: 매출액 */}
      <KpiCard
        label={`${currLabel} 매출액`}
        value={salesCurr != null ? toEok(salesCurr) : '-'}
        icon="i"
        rateText={fmtPct(salesPct)}
        rateUp={salesPct >= 0}
        prevText={salesPrev != null ? `전월 ${toEok(salesPrev)}` : null}
      />

      {/* 카드 1: 시장 전체 */}
      {showGR && (
        <KpiCard
          label={`${currLabel} 전체 시장`}
          value={mktRxCurr?.toLocaleString() ?? '-'}
          icon="i"
          rateText={fmtPct(mktPct)}
          rateUp={mktPct >= 0}
          prevText={mktRxPrev != null ? `지난달 ${toMan(mktRxPrev)}` : null}
        />
      )}

      {/* 카드 2: 내 처방건수/처방량 */}
      <KpiCard
        label={`${currLabel} ${metricLabel}`}
        value={myRxCurr?.toLocaleString() ?? '-'}
        icon="i"
        rateText={fmtPct(myRxPct)}
        rateUp={myRxPct >= 0}
        prevText={myRxPrev != null ? `지난달 ${toMan(myRxPrev)}` : null}
      />

      {/* 카드 3: QoQ */}
      <KpiCard
        label={`${currLabel} ${metricLabel} QoQ`}
        value={yoyPct != null ? `${yoyPct >= 0 ? '+' : ''}${yoyPct.toFixed(1)}%` : '-'}
        icon="i"
        rateText={null}
        rateUp={yoyPct >= 0}
        prevText={myRxLy != null ? `3개월 전 ${toMan(myRxLy)}` : null}
      />

    </div>
  );
}
