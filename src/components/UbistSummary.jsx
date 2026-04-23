import './UbistSummary.css';

/* ── 증감 셀 렌더러 ── */
function DiffVal({ value, showArrow }) {
  if (!value && value !== 0) return null;
  const str = String(value);
  const isNeg = str.startsWith('-');
  const cls = isNeg ? 'ubist-diff--down' : 'ubist-diff--up';
  const arrow = isNeg ? '▼' : '▲';
  return (
    <span className={cls}>
      {showArrow && <span className="ubist-diff-arrow">{arrow}</span>}
      {str}
    </span>
  );
}

/* ── 말도안되는 더미 데이터 생성기 ── */
function fakeVal(type, colLabel) {
  if (type === '안국 순위') return `${Math.floor(Math.random() * 5) + 1}위`;
  if (type === '안국 M/S') {
    const v = (Math.random() * 30 + 5).toFixed(1);
    if (colLabel === '%' || colLabel === '전월대비' || colLabel === '전년대비') return `${(Math.random() * 6 - 3).toFixed(1)}%`;
    return `${v}%`;
  }
  if (colLabel === '%') return `${(Math.random() * 20 - 10).toFixed(1)}%`;
  if (colLabel === '전월대비' || colLabel === '전년대비') {
    const sign = Math.random() < 0.4 ? -1 : 1;
    return `${(sign * (Math.floor(Math.random() * 150000) + 80000)).toLocaleString()}`;
  }
  const base = type === '시장' ? 9000000 : 1200000;
  return Math.floor(Math.random() * base + base * 0.3).toLocaleString();
}

/* ── 컬럼 정의 ── */
const MONTHLY_COLS = [
  { label: '24년 12월', cls: '' },
  { label: '25년 1월',  cls: '' },
  { label: '25년 2월',  cls: '' },
  { label: '25년 3월',  cls: 'ubist-col--hl' },
  { label: '25년 12월', cls: 'ubist-col--cy ubist-col--gs' },
  { label: '26년 1월',  cls: 'ubist-col--cy' },
  { label: '26년 2월',  cls: 'ubist-col--cy' },
  { label: '26년 3월',  cls: 'ubist-col--cy ubist-col--hl' },
  { label: '전월대비',  cls: 'ubist-col--diff ubist-col--gs' },
  { label: '%',         cls: 'ubist-col--diff' },
  { label: '전년대비',  cls: 'ubist-col--diff' },
  { label: '%',         cls: 'ubist-col--diff' },
];

const ACC_COLS = [
  { label: '25년 누계', cls: 'ubist-col--acc ubist-col--acc-start' },
  { label: '26년 누계', cls: 'ubist-col--acc ubist-col--cy' },
  { label: '전년대비',  cls: 'ubist-col--acc ubist-col--diff' },
  { label: '%',         cls: 'ubist-col--acc ubist-col--diff' },
];

const S1_GROUPS = [
  { channel: '전체', types: ['시장', '안국실적', '안국 M/S', '안국 순위'] },
  { channel: '의원', types: ['시장', '안국실적', '안국 M/S', '안국 순위'] },
  { channel: '종병', types: ['시장', '안국실적', '안국 M/S', '안국 순위'] },
];

const S2_ROWS = ['전체', '종병(현 조직기준)', '대외'];

function UbistTable({ groups, simpleRows, hasType, mainTitle, mainNote, accTitle, accNote }) {
  const leftSpan = hasType ? 2 : 1;

  return (
    <div className="ubist-scroll">
      <table className="ubist-table ag-table">
        {/* colgroup 필수: table-layout:fixed는 첫 행 colSpan 때문에 th width를 무시함.
            col 요소로 직접 지정해야 두 테이블 레이블 열 너비가 일치함.
            테이블1 구분(44)+실적분류(66) = 테이블2 구분(110) — 데이터 열은 나머지 균등 분배 */}
        <colgroup>
          {hasType
            ? <><col className="ubist-col-chan" /><col className="ubist-col-type" /></>
            : <col className="ubist-col-chan-wide" />
          }
          {MONTHLY_COLS.map((col, i) => {
            const isDiff = col.cls.includes('ubist-col--diff');
            return <col key={`mc${i}`} className={isDiff ? (col.label === '%' ? 'ubist-col-pct' : 'ubist-col-diff') : 'ubist-col-data'} />;
          })}
          {ACC_COLS.map((col, i) => {
            const isDiff = col.cls.includes('ubist-col--diff');
            return <col key={`ac${i}`} className={isDiff ? (col.label === '%' ? 'ubist-col-pct' : 'ubist-col-diff') : 'ubist-col-data'} />;
          })}
        </colgroup>
        <thead>
          {/* ── 1행: 타이틀 ── */}
          <tr className="ubist-thead-title">
            <th colSpan={leftSpan + MONTHLY_COLS.length} className="ubist-th ubist-th--title-left">
              {mainTitle}
              {mainNote && <span className="ubist-th-note">{mainNote}</span>}
            </th>
            <th colSpan={ACC_COLS.length} className="ubist-th ubist-th--title-right">
              {accTitle}
              {accNote && <span className="ubist-th-note">{accNote}</span>}
            </th>
          </tr>
          {/* ── 2행: 컬럼명 ── */}
          <tr className="ubist-thead-cols">
            {hasType
              ? <><th className="ubist-th ubist-th--chan">구분</th>
                  <th className="ubist-th ubist-th--type">실적분류</th></>
              : <th className="ubist-th ubist-th--chan ubist-th--chan-wide">구분</th>
            }
            {MONTHLY_COLS.map((col, i) => (
              <th key={`m${i}`} className={`ubist-th ubist-th--data ${col.cls}`}>{col.label}</th>
            ))}
            {ACC_COLS.map((col, i) => (
              <th key={`a${i}`} className={`ubist-th ubist-th--data ${col.cls}`}>{col.label}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {groups && S1_GROUPS.map((group, gi) =>
            group.types.map((type, ti) => (
              <tr
                key={`${gi}-${ti}`}
                className={[
                  'ubist-tr',
                  (gi * group.types.length + ti) % 2 === 1 ? 'ubist-tr--zebra' : '',
                  type === '안국실적' ? 'ubist-tr--vendor' : '',
                  type === '안국 M/S' || type === '안국 순위' ? 'ubist-tr--sub' : '',
                  ti === 0 && gi > 0 ? 'ubist-tr--group-start' : '',
                ].join(' ')}
              >
                {ti === 0 && (
                  <td rowSpan={group.types.length} className="ubist-td ubist-td--chan">{group.channel}</td>
                )}
                <td className="ubist-td ubist-td--type">{type}</td>
                {MONTHLY_COLS.map((col, i) => {
                  const isSub = type === '안국 M/S' || type === '안국 순위';
                  const isDiff = col.cls.includes('ubist-col--diff');
                  const val = isSub && isDiff ? '' : fakeVal(type, col.label);
                  return (
                    <td key={`m${i}`} className={`ubist-td ubist-td--num ${col.cls}`}>
                      {isDiff && val ? <DiffVal value={val} showArrow={col.label === '%'} /> : val}
                    </td>
                  );
                })}
                {ACC_COLS.map((col, i) => {
                  const isSub = type === '안국 M/S' || type === '안국 순위';
                  const isDiff = col.cls.includes('ubist-col--diff');
                  const val = isSub ? '' : fakeVal(type, col.label);
                  return (
                    <td key={`a${i}`} className={`ubist-td ubist-td--num ${col.cls}`}>
                      {isDiff && val ? <DiffVal value={val} showArrow={col.label === '%'} /> : val}
                    </td>
                  );
                })}
              </tr>
            ))
          )}
          {simpleRows && simpleRows.map((row, i) => (
            <tr key={i} className={`ubist-tr${i % 2 === 1 ? ' ubist-tr--zebra' : ''}`}>
              <td className="ubist-td ubist-td--chan ubist-td--chan-wide">{row}</td>
              {MONTHLY_COLS.map((col, ci) => {
                const isDiff = col.cls.includes('ubist-col--diff');
                const val = fakeVal('안국실적', col.label);
                return (
                  <td key={`m${ci}`} className={`ubist-td ubist-td--num ${col.cls}`}>
                    {isDiff && val ? <DiffVal value={val} showArrow={col.label === '%'} /> : val}
                  </td>
                );
              })}
              {ACC_COLS.map((col, ci) => {
                const isDiff = col.cls.includes('ubist-col--diff');
                const val = fakeVal('안국실적', col.label);
                return (
                  <td key={`a${ci}`} className={`ubist-td ubist-td--num ${col.cls}`}>
                    {isDiff && val ? <DiffVal value={val} showArrow={col.label === '%'} /> : val}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default function UbistSummary() {
  return (
    <div className="ubist-wrap">

      <div className="ubist-section-group">
        <div className="ubist-section">
          <UbistTable
            groups hasType
            mainTitle="26년 3월 D1 UBIST (채널별)" mainNote="금액: 백만원"
            accTitle="1~3월 실적" accNote="금액: 백만원"
          />
        </div>
      </div>

      <div className="ubist-section-group">
        <div className="ubist-section">
          <UbistTable
            simpleRows={S2_ROWS} hasType={false}
            mainTitle="26년 2월 EDI (채널별)" mainNote="금액: 백만원"
            accTitle="1~2월 실적" accNote="금액: 백만원"
          />
        </div>
      </div>


    </div>
  );
}
