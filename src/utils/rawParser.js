/**
 * rawParser.js — UBIST 로우파일 파서
 *
 * 처리 방식:
 * - 헤더 이름으로 컬럼 탐색 (위치 고정 X)
 * - 처방건수 / 처방량 자동 구분 (1행 타입 기준)
 * - 성분명 부분 매칭 (keywords AND 조건)
 * - 판매사별 집계 후 M/S 계산
 */

import * as XLSX from 'xlsx';

/* ─── 주차 라벨 파싱: "2026년 06주(02.01 ~ 02.07)" → "26.06주" ─── */
function parseWeekLabel(raw) {
  if (!raw) return null;
  const s = String(raw);
  const m = s.match(/(\d{4})년\s*(\d{1,2})주/);
  if (!m) return null;
  const yy = m[1].slice(2);
  const ww = String(m[2]).padStart(2, '0');
  return `${yy}.${ww}주`;
}

/* ─── 성분 매칭 ─── */
function matchIngredient(ingredientStr, keywords, excludes = []) {
  if (!ingredientStr) return false;
  const ing = ingredientStr.toLowerCase();

  // exclude 체크
  if (excludes.some(ex => ing.includes(ex.toLowerCase()))) return false;

  // include 체크 (AND 조건)
  const includes = Array.isArray(keywords) ? keywords : [keywords];
  return includes.every(kw => ing.includes(kw.toLowerCase()));
}

/* ─── 메인 파서 ─── */
export async function parseRawFile(file, drugConfig) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target.result);
        const wb = XLSX.read(data, { type: 'array' });
        const ws = wb.Sheets[wb.SheetNames[0]];
        const raw = XLSX.utils.sheet_to_json(ws, { header: 1, defval: null });

        if (raw.length < 3) throw new Error('데이터가 부족합니다.');

        const typeRow   = raw[0];  // 처방건수 / 처방량
        const headerRow = raw[1];  // 컬럼명
        const dataRows  = raw.slice(2).filter(r => r.some(v => v != null));

        // ── 컬럼 인덱스 탐색 ──
        const colIdx = {
          atc:       headerRow.findIndex(h => String(h || '').trim() === 'ATC'),
          ingredient:headerRow.findIndex(h => String(h || '').trim() === '성분'),
          vendor:    headerRow.findIndex(h => String(h || '').trim() === '판매사'),
          product:   headerRow.findIndex(h => String(h || '').trim() === '제품'),
        };

        if (colIdx.ingredient < 0 || colIdx.vendor < 0) {
          throw new Error('성분/판매사 컬럼을 찾을 수 없습니다. 파일을 확인해주세요.');
        }

        // ── 주차 컬럼 탐색 (처방건수 / 처방량 분리) ──
        const rxCols  = [];
        const qtyCols = [];

        headerRow.forEach((h, i) => {
          const label = parseWeekLabel(h);
          if (!label) return;
          const type = String(typeRow[i] || '');
          if (type.includes('처방건수')) rxCols.push({ idx: i, label });
          else if (type.includes('처방량')) qtyCols.push({ idx: i, label });
        });

        if (rxCols.length === 0 && qtyCols.length === 0) {
          throw new Error('주차 데이터 컬럼을 찾을 수 없습니다.');
        }

        // ── 사용할 컬럼 결정 (metric 설정에 따라) ──
        const metric = drugConfig.metric || 'rx';
        const useCols = metric === 'qty' ? qtyCols
                      : metric === 'both' ? rxCols  // 'both'일 때 기본은 rx, qty 별도 제공
                      : rxCols;

        const weeks = useCols.map(c => c.label);

        // ── 성분 필터링 + 판매사별 집계 ──
        const vendorMap = {};  // { vendor: { byWeek: [n, n, ...] } }

        for (const row of dataRows) {
          const ing = String(row[colIdx.ingredient] || '');
          if (!matchIngredient(ing, drugConfig.ingredient, drugConfig.excludeIngredient)) continue;

          const vendor = String(row[colIdx.vendor] || '').trim();
          if (!vendor) continue;

          if (!vendorMap[vendor]) {
            vendorMap[vendor] = { byWeek: new Array(useCols.length).fill(0) };
          }

          useCols.forEach(({ idx }, wi) => {
            const v = row[idx];
            if (typeof v === 'number') vendorMap[vendor].byWeek[wi] += v;
          });
        }

        if (Object.keys(vendorMap).length === 0) {
          throw new Error(`"${drugConfig.name}" 성분 데이터를 찾을 수 없습니다. 성분 키워드를 확인해주세요.`);
        }

        // ── 주차별 전체 시장 합계 ──
        const marketByWeek = new Array(weeks.length).fill(0);
        Object.values(vendorMap).forEach(({ byWeek }) => {
          byWeek.forEach((v, i) => { marketByWeek[i] += v; });
        });

        // ── 판매사별 요약 ──
        const vendors = Object.entries(vendorMap).map(([name, { byWeek }]) => {
          const total     = byWeek.reduce((s, v) => s + v, 0);
          const mktTotal  = marketByWeek.reduce((s, v) => s + v, 0);
          const msPerWeek = byWeek.map((v, i) => marketByWeek[i] > 0 ? v / marketByWeek[i] : 0);
          const msTotal   = mktTotal > 0 ? total / mktTotal : 0;
          return { name, byWeek, total, msPerWeek, msTotal, isMe: name === drugConfig.myVendor };
        }).sort((a, b) => b.total - a.total);

        // ── M/S 차트 데이터 (주차별) ──
        const msChartData = weeks.map((week, wi) => {
          const obj = { week };
          vendors.forEach(v => { obj[v.name] = parseFloat((v.msPerWeek[wi] * 100).toFixed(2)); });
          return obj;
        });

        // ── 처방량도 필요한 경우 별도 계산 ──
        let qtyData = null;
        if (metric === 'both' && qtyCols.length > 0) {
          const qtyVendorMap = {};
          for (const row of dataRows) {
            const ing = String(row[colIdx.ingredient] || '');
            if (!matchIngredient(ing, drugConfig.ingredient, drugConfig.excludeIngredient)) continue;
            const vendor = String(row[colIdx.vendor] || '').trim();
            if (!vendor) continue;
            if (!qtyVendorMap[vendor]) qtyVendorMap[vendor] = { byWeek: new Array(qtyCols.length).fill(0) };
            qtyCols.forEach(({ idx }, wi) => {
              const v = row[idx];
              if (typeof v === 'number') qtyVendorMap[vendor].byWeek[wi] += v;
            });
          }
          qtyData = {
            weeks: qtyCols.map(c => c.label),
            vendorMap: qtyVendorMap,
          };
        }

        resolve({
          drugId:       drugConfig.id,
          drugName:     drugConfig.name,
          myVendor:     drugConfig.myVendor,
          metric,
          weeks,
          vendors,          // 전체 판매사 배열 (정렬됨)
          marketByWeek,
          msChartData,
          qtyData,
          fileName:     file.name,
          parsedAt:     new Date().toISOString(),
        });

      } catch (err) {
        reject(err);
      }
    };

    reader.onerror = () => reject(new Error('파일을 읽을 수 없습니다.'));
    reader.readAsArrayBuffer(file);
  });
}
