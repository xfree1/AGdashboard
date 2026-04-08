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
        vendor,
        week_id:   weekId,
        rx_value:  Math.round(data[`rx_${weekId}`]  ?? 0),
        qty_value: Math.round(data[`qty_${weekId}`] ?? 0),
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
        vendor,
        week_id:   weekId,
        rx_value:  Math.round(data[`rx_${weekId}`]  ?? 0),
        qty_value: Math.round(data[`qty_${weekId}`] ?? 0),
      });
    }
  }

  return { drugId: drug.dbId, sheetName: `${drug.name} (로우데이터)`, rows };
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
            for (const drug of DRUGS) {
              const parsed = parseRawSheet(firstSheet, drug);
              if (parsed && parsed.rows.length > 0) results.push(parsed);
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

        // 백데이터 탭 없으면 → 로우데이터(Sheet1) 폴백
        if (results.length === 0) {
          const firstSheet = wb.Sheets[wb.SheetNames[0]];
          if (firstSheet) {
            for (const drug of DRUGS) {
              const parsed = parseRawSheet(firstSheet, drug);
              if (parsed && parsed.rows.length > 0) results.push(parsed);
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
