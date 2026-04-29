import { supabase } from '../lib/supabase';
import { weekIdToSat, satToWeekId } from './weekUtils';

/* ── 더미 데이터 (실 데이터 교체 전 틀 유지용) ─────────────────── */
const DUMMY_WEEKS = [
  '24.40주','24.41주','24.42주','24.43주','24.44주',
  '24.45주','24.46주','24.47주','24.48주','24.49주','24.50주','24.51주','24.52주',
  '25.01주','25.02주','25.03주','25.04주','25.05주','25.06주','25.07주','25.08주',
  '25.09주','25.10주','25.11주','25.12주','25.13주','25.14주','25.15주','25.16주',
  '25.17주','25.18주','25.19주','25.20주','25.21주','25.22주',
];

const DUMMY_VENDORS = {
  levo_tension: [
    { name: '비아트리스', base: 0.268 },
    { name: '안국약품',   base: 0.101 },
    { name: '한미약품',   base: 0.097 },
    { name: '한림제약',   base: 0.056 },
    { name: '종근당',     base: 0.025 },
  ],
  levo_saltan: [
    { name: '안국약품',   base: 0.082 },
    { name: '노바티스',   base: 0.194 },
    { name: '다이이찌',   base: 0.113 },
    { name: '한미약품',   base: 0.065 },
  ],
  pevarojet: [
    { name: '안국약품',   base: 0.058 },
    { name: '종근당',     base: 0.221 },
    { name: '한미약품',   base: 0.147 },
    { name: '대웅제약',   base: 0.089 },
  ],
  sinectura: [
    { name: '안국약품',   base: 0.071 },
    { name: '한미약품',   base: 0.189 },
    { name: '동아제약',   base: 0.112 },
  ],
  rupafin: [
    { name: '안국약품',   base: 0.063 },
    { name: 'UCB',        base: 0.157 },
    { name: '경동제약',   base: 0.098 },
    { name: '종근당',     base: 0.072 },
  ],
  anycof: [
    { name: '안국약품',   base: 0.045 },
    { name: '대원제약',   base: 0.213 },
    { name: '한미약품',   base: 0.134 },
  ],
  retopra: [
    { name: '안국약품',   base: 0.088 },
    { name: '한국얀센',   base: 0.201 },
    { name: '종근당',     base: 0.143 },
  ],
  polax: [
    { name: '안국약품',   base: 0.004 },
    { name: '삼남제약',   base: 0.574 },
    { name: 'JW중외제약', base: 0.167 },
  ],
};

const DUMMY_SCALE = {
  levo_tension: 2_560_000, levo_saltan: 520_000, pevarojet: 480_000,
  sinectura: 310_000,      rupafin: 290_000,      anycof: 180_000,
  retopra: 420_000,        polax: 2_640_000,
};

export function buildDummyDrugData(drug) {
  const vendors = DUMMY_VENDORS[drug.id] ?? DUMMY_VENDORS.levo_tension;
  const scale   = DUMMY_SCALE[drug.id]   ?? 1_000_000;

  const vendorsSorted = vendors.map((v, vi) => ({
    name: v.name,
    allByWeek: DUMMY_WEEKS.map((_, wi) => {
      const noise = Math.sin(vi * 37.3 + wi * 1.7) * 0.04;
      return Math.round(v.base * scale * (1 + noise));
    }),
  }));

  return {
    drugId:        drug.id,
    drugName:      drug.name,
    myVendor:      drug.myVendor,
    allWeeks:      DUMMY_WEEKS,
    vendorsSorted,
    metric:        drug.metric,
    isDummy:       true,
  };
}

/**
 * 품목별 최신 week_id 조회 — 사이드바 업데이트 뱃지 초기 로딩에 사용
 * localStorage 미등록 품목에 한해 호출됨
 * @param {{ id: string, dbId: string }[]} drugs
 */
export async function loadLatestWeekPerDrug(drugs) {
  const results = await Promise.all(
    drugs.map(async ({ id, dbId }) => {
      const { data } = await supabase
        .from('weekly_data')
        .select('week_id')
        .eq('drug_id', dbId ?? id)
        .order('week_id', { ascending: false })
        .limit(1);
      return [id, data?.[0]?.week_id ?? null];
    })
  );
  return Object.fromEntries(results);
}

/**
 * weekly_data 테이블에서 특정 품목의 원시 주간 처방 데이터를 로드.
 * WeeklyPage에서 M/S 계산 등 가공에 사용.
 */
export async function loadWeeklyRaw(drugId) {
  const PAGE = 1000;

  const { count, error: countErr } = await supabase
    .from('weekly_data')
    .select('*', { count: 'exact', head: true })
    .eq('drug_id', drugId)
    .neq('product', '');

  if (countErr) {
    console.error(`[loadWeeklyRaw] ${drugId} count 쿼리 실패:`, countErr);
    return [];
  }
  if (!count) return [];

  const pages = Math.ceil(count / PAGE);
  console.debug(`[loadWeeklyRaw] ${drugId}: 총 ${count}행, ${pages}페이지 로드 시작`);

  const results = await Promise.all(
    Array.from({ length: pages }, (_, i) =>
      supabase
        .from('weekly_data')
        .select('product, vendor, week_id, rx_value, qty_value')
        .eq('drug_id', drugId)
        .neq('product', '')
        // ★ 3-key 정렬: week_id만 쓰면 동일 week_id 내 순서가 쿼리마다 달라져
        //   병렬 페이지 요청 시 경계 로우가 누락·중복될 수 있다.
        .order('week_id', { ascending: true })
        .order('product',  { ascending: true, nullsFirst: false })
        .order('vendor',   { ascending: true, nullsFirst: false })
        .range(i * PAGE, (i + 1) * PAGE - 1)
    )
  );

  const rows = results.flatMap(({ data, error }) => {
    if (error) console.error(`[loadWeeklyRaw] ${drugId} 페이지 쿼리 실패:`, error);
    return data ?? [];
  });

  if (rows.length !== count) {
    console.warn(`[loadWeeklyRaw] ${drugId}: count=${count} 인데 실제 수신=${rows.length} — 페이지 누락 의심`);
  } else {
    console.debug(`[loadWeeklyRaw] ${drugId}: ${rows.length}행 정상 수신`);
  }

  return rows;
}

export async function loadMonthlySales(drugId) {
  const { data, error } = await supabase
    .from('monthly_sales')
    .select('month_id, sales')
    .eq('drug_id', drugId)
    .order('month_id', { ascending: true });
  if (error) throw new Error(error.message);
  return data ?? [];
}

export async function loadDrugData(drug) {
  if (!drug.dbId) throw new Error(`약 설정에 dbId가 없습니다: ${drug.name}`);

  // Supabase 서버 max-rows=1000 제한 우회: 페이지네이션으로 전체 로드
  const PAGE = 1000;
  let allData = [];
  let from = 0;
  while (true) {
    const { data, error } = await supabase
      .from('weekly_data')
      .select('vendor, week_id, rx_value, qty_value')
      .eq('drug_id', drug.dbId)
      .order('week_id', { ascending: true })
      .range(from, from + PAGE - 1);

    if (error || !data || data.length === 0) break;
    allData = allData.concat(data);
    if (data.length < PAGE) break;
    from += PAGE;
  }
  const data = allData;

  if (data.length === 0) return buildDummyDrugData(drug);

  // 토요일 기준 canonical week_id로 변환 후 중복 병합
  // (예: "25.53주"와 "26.01주"가 같은 토요일 → "26.01주"로 통합)
  const mergedMap = {};
  data.forEach(row => {
    const sat    = weekIdToSat(row.week_id);
    const weekId = sat ? satToWeekId(sat) : row.week_id;
    const vendor = (row.vendor || '').normalize('NFC').trim();
    const key    = `${vendor}||${weekId}`;
    if (!mergedMap[key]) {
      mergedMap[key] = { vendor, week_id: weekId, rx_value: 0, qty_value: 0 };
    }
    mergedMap[key].rx_value  += row.rx_value  ?? 0;
    mergedMap[key].qty_value += row.qty_value ?? 0;
  });
  const merged = Object.values(mergedMap);

  const allWeeks = [...new Set(merged.map(r => r.week_id))].sort();
  const valueKey = drug.metric === 'qty' ? 'qty_value' : 'rx_value';

  // 판매사별로 전체 주차 데이터 집계
  const vendorMap = {};
  merged.forEach(row => {
    if (row.vendor === '기타') return;
    if (!vendorMap[row.vendor]) {
      vendorMap[row.vendor] = {};
      allWeeks.forEach(w => { vendorMap[row.vendor][w] = 0; });
    }
    vendorMap[row.vendor][row.week_id] = row[valueKey] ?? 0;
  });

  // 전체 기간 기준 총합으로 정렬 — total을 미리 계산하여 sort 내부 중복 계산 방지
  const vendorsSorted = Object.entries(vendorMap)
    .map(([name, weekData]) => {
      const allByWeek = allWeeks.map(w => weekData[w] ?? 0);
      const total     = allByWeek.reduce((s, v) => s + v, 0);
      return { name, allByWeek, total };
    })
    .sort((a, b) => b.total - a.total)
    .map(({ total: _total, ...v }) => v); // total은 정렬용 임시값, 외부에 노출 안 함

  return {
    drugId:   drug.id,
    drugName: drug.name,
    myVendor: drug.myVendor,
    allWeeks,       // 전체 주차 목록
    vendorsSorted,  // 전체 주차 데이터 포함
    metric: drug.metric,
  };
}
