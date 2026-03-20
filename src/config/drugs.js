/**
 * drugs.js — 약 설정 파일
 *
 * 새 약 추가할 때 이 파일에만 항목 추가하면 됩니다.
 * 코드 수정 불필요.
 *
 * ingredient: 로우파일 성분명에 포함된 키워드 (소문자, 부분 매칭)
 *   - 여러 키워드를 AND 조건으로 쓰려면 배열로: ['ezetimibe', 'pitavastatin']
 *   - 단일 키워드: 'amlodipine'
 *
 * excludeIngredient: 이 키워드가 포함된 성분은 제외
 *   - 예: fenofibrate 복합제 제외
 *
 * myVendor: 안국약품 (우리 회사 판매사명, 로우파일 기준)
 *
 * metric: 'rx' = 처방건수, 'qty' = 처방량, 'both' = 둘 다
 *
 * topN: 경쟁사 상위 몇 개까지 차트에 표시할지
 */

export const DRUGS = [
  {
    id: 'pevarojet',
    name: '페바로젯',
    ingredient: ['ezetimibe', 'pitavastatin'],
    excludeIngredient: ['fenofibrate', 'fenofibric'],
    myVendor: '안국약품',
    metric: 'rx',
    topN: 5,
  },

  // ── 추가 예시 (주석 해제 후 사용) ──────────────────────
  // {
  //   id: 'levotension',
  //   name: '레보텐션',
  //   ingredient: ['amlodipine'],
  //   excludeIngredient: ['valsartan', 'olmesartan', 'losartan'],
  //   myVendor: '안국약품',
  //   metric: 'qty',
  //   topN: 5,
  // },
  // {
  //   id: 'levosaltan',
  //   name: '레보살탄',
  //   ingredient: ['amlodipine', 'valsartan'],
  //   excludeIngredient: [],
  //   myVendor: '안국약품',
  //   metric: 'qty',
  //   topN: 5,
  // },
];

export const MY_VENDOR = '안국약품';
