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
  pevarozet_low: [
    {
      valueType: 'ms',
      metric: 'qty',
      scope: 'default',
      title: 'Pitavastatin(저용량)+Ezetimibe 주요경쟁품 M/S',
      note: '*처방량 대비 M/S기준',
    },
    {
      valueType: 'raw',
      metric: 'qty',
      scope: 'default',
      title: 'Pitavastatin(저용량)+Ezetimibe 주요경쟁품 처방량',
      note: '*처방량 기준',
    },
  ],

  levotension: [
    {
      valueType: 'ms',
      metric: 'qty',
      scope: 'default',
      title: '(S)Amlodipine 주요경쟁품 M/S',
      note: '*처방량 대비 M/S기준',
    },
    {
      valueType: 'raw',
      metric: 'qty',
      scope: 'default',
      title: '(S)Amlodipine 주요경쟁품 처방량',
      note: '*처방량 기준',
    },
  ],

  levosartan: [
    {
      valueType: 'ms',
      metric: 'qty',
      scope: 'default',
      title: '(S)Amlodipine+Valsartan 주요경쟁품 M/S',
      note: '*처방량 대비 M/S기준',
    },
    {
      valueType: 'raw',
      metric: 'qty',
      scope: 'default',
      title: '(S)Amlodipine+Valsartan 주요경쟁품 처방량',
      note: '*처방량 기준',
    },
  ],

  pevarozet: [
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

  synatura: [
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

  anycough: [
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

  forlax: [
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

  letopra: [
    {
      valueType: 'ms',
      metric: 'qty',
      scope: 'pcab_in',
      title: '프로톤 펌프 억제제 시장(P-CAB 포함) M/S',
      note: '*P-CAB 포함 전체 시장 처방량 대비 M/S기준',
    },
    {
      valueType: 'raw',
      metric: 'qty',
      scope: 'pcab_in',
      title: '프로톤 펌프 억제제 시장(P-CAB 포함) 처방량',
      note: '*처방량 기준',
    },
    {
      valueType: 'ms',
      metric: 'qty',
      scope: 'pcab_out',
      title: '프로톤 펌프 억제제 시장(P-CAB 불포함) M/S',
      note: '*P-CAB 제외 처방량 대비 M/S기준',
    },
    {
      valueType: 'raw',
      metric: 'qty',
      scope: 'pcab_out',
      title: '프로톤 펌프 억제제 시장(P-CAB 불포함) 처방량',
      note: '*P-CAB 제외 처방량 기준',
    },
  ],
};

/**
 * pcab_out 섹션 전용 DB ID — 해당 drug_id에서 PPI 전용 데이터를 로드
 * 파서가 성분 컬럼의 "prazan" 여부로 자동 분리해서 저장
 */
export const PCAB_NPCAB_DB_ID = {
  letopra: 'letopra_npcab',
};

/**
 * 제품명 별칭 — key를 value(대표명)로 합산
 * ex) '놀텍 플러스' → '놀텍' 으로 묶어서 집계
 */
export const WEEKLY_PRODUCT_ALIAS = {
  pevarozet: {
    'JW중외제약': '리바로젯',
    '안국약품':   '페바로젯',
    '대원제약':   '타바로젯',
    '보령':       '엘제로젯',
    '동광제약':   '피제트정',
    '한림제약':   '스타젯',
  },
};

/**
 * 제품별 로드 대상 product 필터 — 미지정 시 상위 5개만 표시
 * 추가 요청 시 여기에 배열로 지정
 */
/** 임시 컷오프 — 이 날짜 이후 주차는 WeeklyPage에서 숨김. 해제 시 이 줄만 삭제 */
export const WEEKLY_CUTOFF_WEEK_ID = '26.15주';

export const WEEKLY_PRODUCT_FILTER = {
  pevarozet_low: ['바로에젯', '피타큐젯', '피에젯타', '스타젯 정 1/10mg', '페바로젯 저용량'],  // 출시 후 '페바로젯 저용량' 데이터 자동 반영
  levotension: ['비아트리스 노바스크', '레보텐션', '아모디핀', '로디엔', '애니디핀 에스'],
  levosartan: ['엑스포지', '엑스원', '레보살탄', '엑스페라', '발디핀'],
  synatura: ['시네츄라', '코대원 에스', '코대원 포르테', '코푸'],
  rupafin: ['페니라민', '동아 투리온', '씨잘', '루파핀'],
  anycough: ['코푸', '코대원', '코대원 플러스', '애니코프', '레보투스', '칼로민'],
  pevarozet: ['리바로젯', '페바로젯', '타바로젯', '엘제로젯', '피제트정', '스타젯'],
  forlax: ['마그밀', '듀락칸', '실콘', '아기오', '폴락스', '둘코락스', '종근당 이지퀵'],
  letopra: ['케이캡', '펙수클루', '자큐보', '에소메졸', '에스코텐', '판토록', '레토프라'],
  letopra_npcab: ['에소메졸', '에스코텐', '놀텍', '라비에트', '라베미니', '판토록', '레토프라'],
};
