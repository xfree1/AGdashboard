/**
 * weeklyConfig.js
 * 8대품목 Weekly 페이지 — 섹션 정의 및 Excel 시트 매핑
 *
 * value_type: 'ms'  = 시장점유율(0~1)
 *             'raw' = 처방량 or 처방건수 (절댓값)
 * metric:     'qty'    = 처방량
 *             'rx_cnt' = 처방건수
 * scope:      'default'  = 일반 시장
 *             'pcab_in'  = P-CAB 포함 (레토프라)
 *             'pcab_out' = P-CAB 불포함 (레토프라)
 */

export const WEEKLY_SECTION_CONFIG = {
  levo_tension: [
    {
      valueType: 'ms',
      metric: 'qty',
      scope: 'default',
      title: '(S)Amlodipione 주요경쟁품 M/S',
      note: '*처방량 대비 M/S기준',
    },
    {
      valueType: 'raw',
      metric: 'qty',
      scope: 'default',
      title: '(S)Amlodipione 주요경쟁품 처방량',
      note: '*처방량 기준',
    },
  ],

  levo_saltan: [
    {
      valueType: 'ms',
      metric: 'qty',
      scope: 'default',
      title: '(S)Amlodipione+Valsartan 주요경쟁품 M/S',
      note: '*처방량 대비 M/S기준',
    },
    {
      valueType: 'raw',
      metric: 'qty',
      scope: 'default',
      title: '(S)Amlodipione+Valsartan 주요경쟁품 처방량',
      note: '*처방량 기준',
    },
  ],

  pevarojet: [
    {
      valueType: 'ms',
      metric: 'qty',
      scope: 'default',
      title: 'Pitavastatin+Ezetimibe 주요경쟁품 M/S',
      note: '*처방량 대비 M/S기준',
    },
    {
      valueType: 'raw',
      metric: 'qty',
      scope: 'default',
      title: 'Pitavastatin+Ezetimibe 주요경쟁품 처방량',
      note: '*처방량 기준',
    },
  ],

  sinectura: [
    {
      valueType: 'ms',
      metric: 'rx_cnt',
      scope: 'default',
      closedMarket: true,  // 4개 제품 합계를 100%로 계산
      title: '진해거담제 시럽 주요경쟁품 처방건수 M/S',
      note: '*처방건수 대비 M/S기준 (시네츄라·코대원에스·코대원포르테·코푸 합산 기준)',
    },
    {
      valueType: 'raw',
      metric: 'rx_cnt',
      scope: 'default',
      closedMarket: true,
      title: '진해거담제 시럽 주요경쟁품 처방건수',
      note: '*처방건수 기준',
    },
  ],

  rupafin: [
    {
      valueType: 'ms',
      metric: 'qty',
      scope: 'default',
      title: '항히스타민제 정제 주요경쟁품 처방량 M/S',
      note: '*처방량 대비 M/S기준',
    },
    {
      valueType: 'raw',
      metric: 'qty',
      scope: 'default',
      title: '항히스타민제 정제 주요경쟁품 처방량',
      note: '*처방량 기준',
    },
  ],

  anycof: [
    {
      valueType: 'ms',
      metric: 'qty',
      scope: 'default',
      title: '진해제 정제,캡슐제 주요경쟁품 처방량 M/S',
      note: '*처방량 대비 M/S기준',
    },
    {
      valueType: 'raw',
      metric: 'qty',
      scope: 'default',
      title: '진해제 정제,캡슐제 주요경쟁품 처방량',
      note: '*처방량 기준',
    },
  ],

  polax: [
    {
      valueType: 'ms',
      metric: 'qty',
      scope: 'default',
      title: '변비치료제 주요경쟁품 M/S',
      note: '*처방량 대비 M/S기준',
    },
    {
      valueType: 'raw',
      metric: 'qty',
      scope: 'default',
      title: '변비치료제 주요경쟁품 처방량',
      note: '*처방량 기준',
    },
  ],
};

/**
 * 제품별 로드 대상 product 필터 — 미지정 시 상위 5개만 표시
 * 추가 요청 시 여기에 배열로 지정
 */
export const WEEKLY_PRODUCT_FILTER = {
  levo_tension: ['비아트리스 노바스크', '레보텐션', '아모디핀', '로디엔', '애니디핀 에스'],
  levo_saltan: ['엑스포지', '엑스원', '레보살탄', '엑스페라', '발디핀'],
  sinectura: ['시네츄라', '코대원 에스', '코대원 포르테', '코푸'],
  rupafin: ['페니라민', '동아 투리온', '씨잘', '루파핀'],
  anycof:  ['코푸', '코대원', '애니코프', '레보투스', '칼로민'],
  // 페바로젯: 제품명 없이 판매사 기준 집계 — 여기엔 vendor 명칭을 직접 나열
  pevarojet: ['JW중외제약', '안국약품', '대원제약', '보령', '동광제약', '한림제약'],
};

/**
 * Excel 시트명 → drugId 매핑 (Admin 업로드 파서에서 사용)
 * 레토프라는 구조가 달라 별도 처리 필요 — 현재 제외
 */
export const SHEET_TO_DRUG_ID = {
  '레보텐션': 'levo_tension',
  '레보살탄': 'levo_saltan',
  '페바로젯': 'pevarojet',
  '시네츄라': 'sinectura',
  '루파핀':   'rupafin',
  '애니코프': 'anycof',
  '폴락스':   'polax',
};
