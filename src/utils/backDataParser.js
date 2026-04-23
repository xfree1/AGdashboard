/**
 * backDataParser.js
 * 엑셀 백데이터 탭 → Supabase weekly_data INSERT용 배열로 변환
 */

import * as XLSX from 'xlsx';
import { satToWeekId } from './weekUtils';
import { DRUGS } from '../config/drugs';

/**
 * 주차 라벨 파싱 → canonical week_id
 * 지원 형식:
 *   "2026년 06주(02.01 ~ 02.07)"
 *   "합계 : 2024년 40주(09.29 ~ 10.05)"
 */
function parseWeekLabel(raw) {
  if (!raw) return null;
  const s = String(raw);

  // 연-주차 + 날짜 범위: "2026년 06주(02.01 ~ 02.07)"
  const mAr = s.match(/(\d{4})년\s*(\d{1,2})주\s*\((\d{1,2})\.(\d{1,2})\s*~\s*(\d{1,2})\.(\d{1,2})\)/);
  if (mAr) {
    const labelYear = parseInt(mAr[1], 10);
    const startMon  = parseInt(mAr[3], 10);
    const endMon    = parseInt(mAr[5], 10);
    const endDay    = parseInt(mAr[6], 10);
    const endYear   = endMon < startMon ? labelYear + 1 : labelYear;
    return satToWeekId(new Date(endYear, endMon - 1, endDay));
  }

  return null;
}

/* 탭 이름 → drug_id 매핑 */
const SHEET_TO_DRUG_ID = {
  '레보텐션backdata':           'levo_tension',
  '레보살탄backdata':           'levo_saltan',
  '페바로젯backdata':           'eze_pita',
  '시네츄라backdata':           'sinectura',
  '루파핀backdata':             'rupafin',
  '애니코프backdata':           'anycof',
  '레토프라backdata_PCAB포함':  'retopra_pcab',
  '레토프라backdata_PCAB불포함':'retopra_npcab',
  '폴락스backdata':             'polax',
};

/* ── 공통 시트 파서 ────────────────────────────────────────── */

/**
 * 백데이터 시트 파싱
 * 구조: 1행=처방건수/처방량 타입, 2행=헤더(성분·제품·제조사·주차...), 3행~=데이터
 */
function parseSheet(ws, sheetName, drugId) {
  const raw = XLSX.utils.sheet_to_json(ws, { header: 1, defval: null });
  if (raw.length < 3) return null;

  const typeRow   = raw[0];
  const headerRow = raw[1];
  const dataRows  = raw.slice(2).filter(r => r.some(v => v != null));

  // 제조사(또는 판매사) 컬럼 탐색
  const vendorIdx = headerRow.findIndex(h => {
    const s = String(h || '').trim();
    return s === '제조사' || s === '판매사';
  });
  if (vendorIdx < 0) return null;

  // 주차 컬럼 탐색 (타입별 분리)
  const rxCols  = [];
  const qtyCols = [];
  headerRow.forEach((h, i) => {
    const weekId = parseWeekLabel(h);
    if (!weekId) return;
    const type = String(typeRow[i] || '');
    if (type.includes('처방건수')) rxCols.push({ idx: i, weekId });
    else if (type.includes('처방량')) qtyCols.push({ idx: i, weekId });
  });

  if (rxCols.length === 0 && qtyCols.length === 0) return null;

  // 제조사별 집계
  const vendorMap = {};
  for (const row of dataRows) {
    const vendor = String(row[vendorIdx] || '').trim();
    if (!vendor || vendor === '기타') continue;

    if (!vendorMap[vendor]) vendorMap[vendor] = {};

    rxCols.forEach(({ idx, weekId }) => {
      const v = row[idx];
      vendorMap[vendor][`rx_${weekId}`] = (vendorMap[vendor][`rx_${weekId}`] || 0) + (typeof v === 'number' ? v : 0);
    });
    qtyCols.forEach(({ idx, weekId }) => {
      const v = row[idx];
      vendorMap[vendor][`qty_${weekId}`] = (vendorMap[vendor][`qty_${weekId}`] || 0) + (typeof v === 'number' ? v : 0);
    });
  }

  // 전체 주차 목록
  const allWeeks = [...new Set([
    ...rxCols.map(c => c.weekId),
    ...qtyCols.map(c => c.weekId),
  ])];

  // Supabase upsert용 rows 생성
  const rows = [];
  for (const [vendor, data] of Object.entries(vendorMap)) {
    for (const weekId of allWeeks) {
      rows.push({
        drug_id:   drugId,
        product:   '',   // 백데이터 탭 형식은 제품명 없음
        vendor,
        week_id:   weekId,
        rx_value:  data[`rx_${weekId}`]  ?? 0,
        qty_value: data[`qty_${weekId}`] ?? 0,
      });
    }
  }

  return { drugId, sheetName, rows };
}


/* ── 로우데이터(Sheet1) 파서 ────────────────────────────────── */

function matchIngredient(ingredientStr, keywords, excludes = []) {
  if (!ingredientStr) return false;
  const ing = ingredientStr.toLowerCase();
  if (excludes.some(ex => ing.includes(ex.toLowerCase()))) return false;
  const kws = Array.isArray(keywords) ? keywords : [keywords];
  return kws.every(kw => ing.includes(kw.toLowerCase()));
}

/**
 * UBIST 로우데이터(Sheet1) 한 시트를 특정 drug config 기준으로 파싱
 * 구조: 1행=처방건수/처방량 타입, 2행=헤더(ATC·성분·판매사·제품·주차...), 3행~=데이터
 */
function parseRawSheet(ws, drug) {
  const raw = XLSX.utils.sheet_to_json(ws, { header: 1, defval: null });
  if (raw.length < 3) return null;

  const typeRow   = raw[0];
  const headerRow = raw[1];
  const dataRows  = raw.slice(2).filter(r => r.some(v => v != null));

  const ingredientIdx = headerRow.findIndex(h => String(h || '').trim() === '성분');
  const vendorIdx     = headerRow.findIndex(h => {
    const s = String(h || '').trim();
    return s === '판매사' || s === '제조사';
  });
  if (ingredientIdx < 0 || vendorIdx < 0) return null;

  const rxCols  = [];
  const qtyCols = [];
  headerRow.forEach((h, i) => {
    const weekId = parseWeekLabel(h);
    if (!weekId) return;
    const type = String(typeRow[i] || '');
    if (type.includes('처방건수')) rxCols.push({ idx: i, weekId });
    else if (type.includes('처방량')) qtyCols.push({ idx: i, weekId });
  });
  if (rxCols.length === 0 && qtyCols.length === 0) return null;

  const vendorMap = {};
  for (const row of dataRows) {
    const ing = String(row[ingredientIdx] || '');
    if (!matchIngredient(ing, drug.ingredient, drug.excludeIngredient)) continue;

    const vendor = String(row[vendorIdx] || '').trim();
    if (!vendor || vendor === '기타') continue;

    if (!vendorMap[vendor]) vendorMap[vendor] = {};

    rxCols.forEach(({ idx, weekId }) => {
      const v = row[idx];
      vendorMap[vendor][`rx_${weekId}`] = (vendorMap[vendor][`rx_${weekId}`] || 0) + (typeof v === 'number' ? v : 0);
    });
    qtyCols.forEach(({ idx, weekId }) => {
      const v = row[idx];
      vendorMap[vendor][`qty_${weekId}`] = (vendorMap[vendor][`qty_${weekId}`] || 0) + (typeof v === 'number' ? v : 0);
    });
  }

  if (Object.keys(vendorMap).length === 0) return null;

  const allWeeks = [...new Set([
    ...rxCols.map(c => c.weekId),
    ...qtyCols.map(c => c.weekId),
  ])];

  const rows = [];
  for (const [vendor, data] of Object.entries(vendorMap)) {
    for (const weekId of allWeeks) {
      rows.push({
        drug_id:   drug.dbId,
        product:   vendor,   // 제품명 없는 로우파일은 판매사명을 product로 사용
        vendor,
        week_id:   weekId,
        rx_value:  data[`rx_${weekId}`]  ?? 0,
        qty_value: data[`qty_${weekId}`] ?? 0,
      });
    }
  }

  return { drugId: drug.dbId, sheetName: `${drug.name} (로우데이터)`, rows };
}

/* ── 시장 파일 파서 ────────────────────────────────────────────
   지원 포맷:
   A) 표준(2행): row0=타입, row1=헤더(컬럼명·주차), row2+=데이터
   B) 단일행:    row0=헤더(타입+주차 결합, 예: "처방건수 2024년 40주(...)"), row1+=데이터
   식별: drug.name 또는 drug.marketProduct가 제품 컬럼에 존재 (전방 일치)
   필터: drug.excludeDosage 기준 제형 제외
──────────────────────────────────────────────────────────────── */
function matchProductName(cellVal, name) {
  const p = String(cellVal || '').trim();
  return p === name || p.startsWith(name + ' ');
}

function parseMarketSheet(ws, drug) {
  const raw = XLSX.utils.sheet_to_json(ws, { header: 1, defval: null });
  if (raw.length < 2) return null;

  // 포맷 감지: row0에 주차 라벨이 있으면 단일행 포맷
  const singleRow = raw[0].some(cell => parseWeekLabel(cell) !== null);

  const headerRow = singleRow ? raw[0] : raw[1];
  const dataRows  = (singleRow ? raw.slice(1) : raw.slice(2)).filter(r => r.some(v => v != null));
  // typeRow: 표준=raw[0], 단일행=headerRow 자체 (타입이 주차와 결합)
  const typeRow   = singleRow ? raw[0] : raw[0];

  if (dataRows.length === 0) return null;

  // 제조사 우선, 없으면 판매사
  const mfgIdx     = headerRow.findIndex(h => String(h||'').trim() === '제조사');
  const sellerIdx  = headerRow.findIndex(h => String(h||'').trim() === '판매사');
  const vendorIdx  = mfgIdx >= 0 ? mfgIdx : sellerIdx;
  const productIdx = headerRow.findIndex(h => String(h||'').trim() === '제품');
  const dosageIdx  = headerRow.findIndex(h => String(h||'').trim() === '제형');

  if (vendorIdx < 0 || productIdx < 0) return null;

  // drug.name 또는 marketProduct 행이 있어야 시장 파일로 인식 (전방 일치)
  const hasMyProduct     = dataRows.some(r => matchProductName(r[productIdx], drug.name));
  const hasMarketProduct = drug.marketProduct
    ? dataRows.some(r => matchProductName(r[productIdx], drug.marketProduct))
    : false;
  if (!hasMyProduct && !hasMarketProduct) return null;

  const rxCols  = [];
  const qtyCols = [];
  headerRow.forEach((h, i) => {
    const weekId = parseWeekLabel(h);
    if (!weekId) return;
    // 단일행: 타입이 같은 셀에 포함됨 / 표준: typeRow에서 별도 추출
    const typeCell = String(singleRow ? h : typeRow[i] || '');
    if (typeCell.includes('처방건수')) rxCols.push({ idx: i, weekId });
    else if (typeCell.includes('처방량')) qtyCols.push({ idx: i, weekId });
  });

  if (rxCols.length === 0 && qtyCols.length === 0) return null;

  const excludeDosage = drug.excludeDosage ?? [];

  const map = {};
  for (const row of dataRows) {
    const dosage = dosageIdx >= 0 ? String(row[dosageIdx] || '').trim() : '';
    if (dosage && excludeDosage.length > 0) {
      if (excludeDosage.some(ex => dosage.includes(ex))) continue;
    }

    const vendor      = String(row[vendorIdx]  || '').trim();
    const rawProduct  = String(row[productIdx] || '').trim();
    // drug.name 전방 일치면 canonical 이름으로 정규화 ("애니코프 캡슐 300mg" → "애니코프")
    const product     = matchProductName(rawProduct, drug.name) ? drug.name : rawProduct;
    if (!product || !vendor) continue;

    const key = `${product}||${vendor}`;
    if (!map[key]) map[key] = { product, vendor, dosage_forms: new Set() };
    if (dosage) map[key].dosage_forms.add(dosage);

    rxCols.forEach(({ idx, weekId }) => {
      const v = row[idx];
      map[key][`rx_${weekId}`] = (map[key][`rx_${weekId}`] || 0) + (typeof v === 'number' ? v : 0);
    });
    qtyCols.forEach(({ idx, weekId }) => {
      const v = row[idx];
      map[key][`qty_${weekId}`] = (map[key][`qty_${weekId}`] || 0) + (typeof v === 'number' ? v : 0);
    });
  }

  if (Object.keys(map).length === 0) return null;

  const allWeeks = [...new Set([...rxCols.map(c => c.weekId), ...qtyCols.map(c => c.weekId)])];

  const rows = [];
  for (const data of Object.values(map)) {
    const dosage_form = [...data.dosage_forms].join('/');
    for (const weekId of allWeeks) {
      rows.push({
        drug_id:     drug.dbId,
        product:     data.product,
        vendor:      data.vendor,
        week_id:     weekId,
        rx_value:    data[`rx_${weekId}`]  ?? 0,
        qty_value:   data[`qty_${weekId}`] ?? 0,
        dosage_form,   // 확인 페이지 표시용 — DB에는 저장하지 않음
      });
    }
  }

  return { drugId: drug.dbId, sheetName: `${drug.name} (시장 데이터)`, rows };
}

/* 메인: 특정 drug만 파싱 (개별 업로드용) */
export async function parseBackDataFileForDrug(file, drugDbId) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target.result);
        const wb = XLSX.read(data, { type: 'array' });

        const results = [];
        const skipped  = [];

        wb.SheetNames.forEach(sheetName => {
          const sheetDrugId = SHEET_TO_DRUG_ID[sheetName];
          // exact match 또는 접두사 match (retopra → retopra_pcab, retopra_npcab)
          if (!sheetDrugId) return;
          if (sheetDrugId !== drugDbId && !sheetDrugId.startsWith(drugDbId + '_')) return;

          const ws = wb.Sheets[sheetName];
          const parsed = parseSheet(ws, sheetName, sheetDrugId);
          if (parsed && parsed.rows.length > 0) {
            results.push(parsed);
          } else {
            skipped.push(sheetName);
          }
        });

        if (results.length === 0) {
          const allSheets = wb.SheetNames.join(', ');
          reject(new Error(`"${drugDbId}" 에 해당하는 백데이터 탭을 찾을 수 없습니다.\n포함된 탭: ${allSheets}`));
          return;
        }

        resolve({ results, skipped });
      } catch (err) {
        reject(err);
      }
    };

    reader.onerror = () => reject(new Error('파일을 읽을 수 없습니다.'));
    reader.readAsArrayBuffer(file);
  });
}

/* ── 월 라벨 파싱: "2024년 1월" → "2024-01" ── */
function parseMonthLabel(raw) {
  if (!raw) return null;
  const s = String(raw);
  const m = s.match(/(\d{4})년\s*(\d{1,2})월/);
  if (!m) return null;
  return `${m[1]}-${String(m[2]).padStart(2, '0')}`;
}

/* ── 매출 로우파일 판별 ── */
function isSalesFile(wb) {
  const ws = wb.Sheets[wb.SheetNames[0]];
  const raw = XLSX.utils.sheet_to_json(ws, { header: 1, defval: null });
  return Array.isArray(raw[0]) && raw[0].some(v => String(v || '').includes('처방조제액'));
}

/* ── 매출 로우파일 파서 ── */
function parseSalesRawFile(wb) {
  const ws = wb.Sheets[wb.SheetNames[0]];
  const raw = XLSX.utils.sheet_to_json(ws, { header: 1, defval: null });
  if (raw.length < 3) throw new Error('데이터가 부족합니다.');

  const typeRow      = raw[0];
  const headerRow    = raw[1];
  const dataRows     = raw.slice(2).filter(r => r.some(v => v != null));

  const bedIdx    = headerRow.findIndex(h => String(h || '').trim() === '병상');
  const vendorIdx = headerRow.findIndex(h => String(h || '').trim() === '판매사');
  const prodIdx   = headerRow.findIndex(h => String(h || '').trim() === '제품');

  if (bedIdx < 0 || vendorIdx < 0 || prodIdx < 0) {
    throw new Error('필수 컬럼(병상/판매사/제품)을 찾을 수 없습니다.');
  }

  // 처방조제액 컬럼 목록 (0행 타입 = 처방조제액(원), 1행 = 월)
  const salesCols = [];
  headerRow.forEach((h, i) => {
    const monthId = parseMonthLabel(h);
    if (!monthId) return;
    if (String(typeRow[i] || '').includes('처방조제액')) {
      salesCols.push({ idx: i, monthId });
    }
  });

  if (salesCols.length === 0) throw new Error('처방조제액 컬럼을 찾을 수 없습니다.');

  // 약품 × 월 매출 집계 (종병 + 안국약품만)
  const drugSalesMap = {};  // dbId → { monthId → sales }

  for (const row of dataRows) {
    if (String(row[bedIdx] || '').trim() !== '(+) 종병') continue;
    if (String(row[vendorIdx] || '').trim() !== '안국약품') continue;

    const prod = String(row[prodIdx] || '').trim();

    for (const drug of DRUGS) {
      if (prod !== drug.name) continue;
      if (!drugSalesMap[drug.dbId]) drugSalesMap[drug.dbId] = {};

      salesCols.forEach(({ idx, monthId }) => {
        const v = row[idx];
        if (typeof v === 'number') {
          drugSalesMap[drug.dbId][monthId] = (drugSalesMap[drug.dbId][monthId] || 0) + v;
        }
      });
    }
  }

  if (Object.keys(drugSalesMap).length === 0) {
    throw new Error('안국약품 + 종병 조건에 맞는 데이터를 찾을 수 없습니다.');
  }

  const results = Object.entries(drugSalesMap).map(([drugId, monthMap]) => ({
    drugId,
    rows: Object.entries(monthMap).map(([month_id, sales]) => ({
      drug_id: drugId,
      month_id,
      sales:   Math.round(sales),
    })),
  }));

  return { type: 'sales', results };
}

/* ── 자동 감지 + 파싱 (Admin Import 진입점) ── */
export async function detectAndParse(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target.result);
        const wb   = XLSX.read(data, { type: 'array' });

        if (isSalesFile(wb)) {
          resolve(parseSalesRawFile(wb));
          return;
        }

        // 백데이터 처리 (기존 parseBackDataFile 내부 로직)
        const results = [];
        const skipped = [];

        wb.SheetNames.forEach(sheetName => {
          const drugId = SHEET_TO_DRUG_ID[sheetName];
          if (!drugId) {
            if (sheetName.toLowerCase().includes('backdata')) skipped.push(sheetName);
            return;
          }
          const ws     = wb.Sheets[sheetName];
          const parsed = parseSheet(ws, sheetName, drugId);
          if (parsed && parsed.rows.length > 0) results.push(parsed);
          else skipped.push(sheetName);
        });

        if (results.length === 0) {
          const firstSheet = wb.Sheets[wb.SheetNames[0]];
          if (firstSheet) {
            // 1차: 제품명 기반 시장 파일 (경쟁사 포함 전체 데이터)
            for (const drug of DRUGS) {
              const parsed = parseMarketSheet(firstSheet, drug);
              if (parsed && parsed.rows.length > 0) results.push(parsed);
            }
            // 2차: 성분 기반 로우데이터 (시장 파일이 아닌 경우)
            if (results.length === 0) {
              for (const drug of DRUGS) {
                const parsed = parseRawSheet(firstSheet, drug);
                if (parsed && parsed.rows.length > 0) results.push(parsed);
              }
            }
          }
        }

        if (results.length === 0) {
          const hint = skipped.length > 0 ? `\n파싱 실패 탭: ${skipped.join(', ')}` : '';
          reject(new Error(`파일 형식을 인식할 수 없습니다.${hint}`));
          return;
        }

        resolve({ type: 'prescription', results, skipped });
      } catch (err) {
        reject(err);
      }
    };

    reader.onerror = () => reject(new Error('파일을 읽을 수 없습니다.'));
    reader.readAsArrayBuffer(file);
  });
}

/**
 * 다중 파일 파싱 — 애니코프 전용 (시장 파일 + 단독 파일 동시 업로드)
 * 그 외 약품이 여러 파일로 들어오면 에러
 */
export async function detectAndParseMultiple(files) {
  const fileArray = Array.from(files);

  // 각 파일 개별 파싱
  const allParsed = await Promise.all(fileArray.map(f => detectAndParse(f)));

  // 타입 일관성 확인
  const types = new Set(allParsed.map(p => p.type));
  if (types.size > 1) throw new Error('처방 파일과 매출 파일을 함께 올릴 수 없습니다. 하나씩 올려주세요.');

  // drugId별로 결과 집계 (어느 파일 몇 개에서 나왔는지)
  const drugFileCount = {};
  for (const parsed of allParsed) {
    for (const r of parsed.results) {
      drugFileCount[r.drugId] = (drugFileCount[r.drugId] || 0) + 1;
    }
  }

  // anycof 외 약품이 여러 파일에서 나오면 차단
  const nonAnycofMulti = Object.entries(drugFileCount)
    .filter(([id, cnt]) => id !== 'anycof' && cnt > 1);
  if (nonAnycofMulti.length > 0) {
    throw new Error('애니코프 외 품목은 파일을 하나씩 올려주세요.');
  }

  // anycof가 없는데 여러 파일이면 차단
  if (!drugFileCount['anycof']) {
    throw new Error('여러 파일 업로드는 애니코프 전용입니다. 다른 품목은 하나씩 올려주세요.');
  }

  // anycof rows 병합
  const mergedMap = {};
  const skipped   = [];
  for (const parsed of allParsed) {
    for (const r of parsed.results) {
      if (!mergedMap[r.drugId]) mergedMap[r.drugId] = { drugId: r.drugId, rows: [] };
      mergedMap[r.drugId].rows.push(...r.rows);
    }
    skipped.push(...(parsed.skipped ?? []));
  }

  // anycof 검증: 시장 데이터 + 단독 데이터 둘 다 있어야 함
  const anycof = mergedMap['anycof'];
  if (anycof) {
    const hasMarket     = anycof.rows.some(r => r.product && r.product !== '애니코프');
    const hasStandalone = anycof.rows.some(r => r.product === '애니코프');
    if (!hasMarket)     throw new Error('애니코프 시장 파일을 찾을 수 없습니다. (칼로민이 포함된 파일을 함께 올려주세요)');
    if (!hasStandalone) throw new Error('애니코프 단독 데이터 파일을 찾을 수 없습니다. (애니코프 행이 있는 파일을 함께 올려주세요)');

    // 최신 주차 일치 확인
    const latestMarket = anycof.rows
      .filter(r => r.product && r.product !== '애니코프')
      .map(r => r.week_id).sort().at(-1);
    const latestStandalone = anycof.rows
      .filter(r => r.product === '애니코프')
      .map(r => r.week_id).sort().at(-1);
    if (latestMarket !== latestStandalone) {
      throw new Error(`애니코프 두 파일의 최신 주차가 다릅니다. (시장: ${latestMarket}, 단독: ${latestStandalone})`);
    }
  }

  return { type: [...types][0], results: Object.values(mergedMap), skipped };
}

/* 메인: 엑셀 파일 → 전체 파싱 결과 */
export async function parseBackDataFile(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target.result);
        const wb = XLSX.read(data, { type: 'array' });

        const results = [];
        const skipped = [];

        wb.SheetNames.forEach(sheetName => {
          const drugId = SHEET_TO_DRUG_ID[sheetName];
          if (!drugId) {
            if (sheetName.toLowerCase().includes('backdata')) {
              skipped.push(sheetName);
            }
            return;
          }

          const ws = wb.Sheets[sheetName];
          const parsed = parseSheet(ws, sheetName, drugId);
          if (parsed && parsed.rows.length > 0) {
            results.push(parsed);
          } else {
            skipped.push(sheetName);
          }
        });

        // 백데이터 탭 없으면 → 시장파일 → 로우데이터 순서로 폴백
        if (results.length === 0) {
          const firstSheet = wb.Sheets[wb.SheetNames[0]];
          if (firstSheet) {
            for (const drug of DRUGS) {
              const parsed = parseMarketSheet(firstSheet, drug);
              if (parsed && parsed.rows.length > 0) results.push(parsed);
            }
            if (results.length === 0) {
              for (const drug of DRUGS) {
                const parsed = parseRawSheet(firstSheet, drug);
                if (parsed && parsed.rows.length > 0) results.push(parsed);
              }
            }
          }
        }

        if (results.length === 0) {
          const hint = skipped.length > 0 ? `\n파싱 실패 탭: ${skipped.join(', ')}` : '';
          reject(new Error(`백데이터 탭을 파싱할 수 없습니다.${hint}`));
          return;
        }

        resolve({ results, skipped });
      } catch (err) {
        reject(err);
      }
    };

    reader.onerror = () => reject(new Error('파일을 읽을 수 없습니다.'));
    reader.readAsArrayBuffer(file);
  });
}
