import { supabase } from '../lib/supabase';
import { weekIdToSat, satToWeekId } from './weekUtils';

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

    if (error) throw new Error(`데이터 로드 실패: ${error.message}`);
    if (!data || data.length === 0) break;
    allData = allData.concat(data);
    if (data.length < PAGE) break;
    from += PAGE;
  }
  const data = allData;

  if (data.length === 0) throw new Error('데이터가 없습니다.');

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
