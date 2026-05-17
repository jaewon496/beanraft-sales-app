/**
 * competitionScore.js
 * 상권 경쟁 분석 카드(trafficCompetition, Card 12)의 점수화 로직.
 *
 * 설계:
 *   5개 축(카페 밀도, 프랜차이즈 비율, 카페당 잠재 고객, 개폐업 추세, 매출-임대 여유)을
 *   각각 0~100으로 정규화하고, 동일 가중 평균으로 종합 점수를 만든다.
 *
 * 반환 구조는 dataMapper/UnifiedLayout이 그대로 렌더링할 수 있도록 axes/score/tier 를
 *   한 번에 담는다.
 *
 * 외부 AI 호출 없음 — 순수 함수.
 */

// 축별 정규화 상수 (한 곳에 모아둬서 튜닝하기 쉽게)
export const COMPETITION_SCORE_RANGES = {
  // 카페 밀도: km²당 0~20개 기준. 20 이상 = 0점, 0 = 100점 (낮을수록 좋음)
  density: { min: 0, max: 20 },
  // 프랜차이즈 비율: 0~1. 0 = 100점, 1 = 0점 (낮을수록 좋음)
  franchiseRatio: { min: 0, max: 1 },
  // 카페당 잠재 고객: 0~50,000명. 50,000 이상 = 100점
  potentialPerStore: { min: 0, max: 50000 },
  // 개폐업 추세: (신규-폐업)/전체. -0.2 ~ +0.2. +0.2 = 100점, -0.2 = 0점
  openCloseTrend: { min: -0.2, max: 0.2 },
  // 매출-임대 여유: 1 - (월 임대료 / 월 매출). 0 ~ 1. 1 = 100점, 0 = 0점
  salesRentMargin: { min: 0, max: 1 },
};

// 구간 정의 (종합 점수 → 등급)
const TIERS = [
  { min: 80, key: 'advantage', label: '우위', color: '#1E3A8A', template: '이 지역은 상대적으로 경쟁 여유가 있는 구간입니다.' },
  { min: 60, key: 'good', label: '양호', color: '#FBBF24', template: '이 지역은 경쟁이 있는 편이지만 차별화 여지가 있습니다.' },
  { min: 40, key: 'competitive', label: '경쟁', color: '#F59E0B', template: '이 지역은 경쟁이 치열한 구간입니다.' },
  { min: 0,  key: 'saturated', label: '포화', color: '#F04452', template: '이 지역은 포화 상태에 가깝습니다.' },
];

function clamp(n, a, b) { return Math.max(a, Math.min(b, n)); }

// 값이 높을수록 점수가 높다 (value → 0~100)
function normalizeHigherBetter(value, min, max) {
  if (value == null || isNaN(value)) return null;
  if (max === min) return 50;
  const t = (value - min) / (max - min);
  return Math.round(clamp(t, 0, 1) * 100);
}

// 값이 낮을수록 점수가 높다 (value → 0~100)
function normalizeLowerBetter(value, min, max) {
  if (value == null || isNaN(value)) return null;
  if (max === min) return 50;
  const t = (value - min) / (max - min);
  return Math.round((1 - clamp(t, 0, 1)) * 100);
}

function resolveTier(score) {
  for (const t of TIERS) {
    if (score >= t.min) return t;
  }
  return TIERS[TIERS.length - 1];
}

/**
 * 5개 축 정규화 + 종합 점수 계산.
 *
 * @param {object} input
 * @param {number} input.cafeCount        전체 카페 수
 * @param {number} input.radius           수집 반경 (m)
 * @param {number} input.franchiseCount   프랜차이즈 카페 수
 * @param {number} input.dailyPopulation  일 유동인구
 * @param {number} input.newOpenings      최근 신규 개업 수
 * @param {number} input.closures         최근 폐업 수
 * @param {number} input.monthlyRent      월 임대료 (원)
 * @param {number} input.monthlySales     점포당 월 매출 (원)
 * @returns {{
 *   overallScore: number,
 *   tier: string,
 *   tierLabel: string,
 *   tierColor: string,
 *   templateText: string,
 *   axes: object
 * }}
 */
export function calculateCompetitionScore(input) {
  const {
    cafeCount = 0,
    radius = 500,
    franchiseCount = 0,
    dailyPopulation = 0,
    newOpenings = 0,
    closures = 0,
    monthlyRent = 0,
    monthlySales = 0,
  } = input || {};

  // === 축 1: 카페 밀도 (개/km²) ===
  // 반경(m) → km 환산 후 면적 계산. 원의 면적 = π × r²
  const radiusKm = (Number(radius) || 500) / 1000;
  const areaKm2 = Math.PI * radiusKm * radiusKm;
  const densityRaw = cafeCount > 0 && areaKm2 > 0 ? cafeCount / areaKm2 : 0;
  const densityScore = normalizeLowerBetter(densityRaw, COMPETITION_SCORE_RANGES.density.min, COMPETITION_SCORE_RANGES.density.max) ?? 50;

  // === 축 2: 프랜차이즈 비율 ===
  const franchiseRatioRaw = cafeCount > 0 ? franchiseCount / cafeCount : 0;
  const franchiseRatioScore = normalizeLowerBetter(franchiseRatioRaw, COMPETITION_SCORE_RANGES.franchiseRatio.min, COMPETITION_SCORE_RANGES.franchiseRatio.max) ?? 50;

  // === 축 3: 카페당 잠재 고객 ===
  const potentialPerStoreRaw = cafeCount > 0 ? Math.round(dailyPopulation / cafeCount) : 0;
  const potentialPerStoreScore = normalizeHigherBetter(potentialPerStoreRaw, COMPETITION_SCORE_RANGES.potentialPerStore.min, COMPETITION_SCORE_RANGES.potentialPerStore.max) ?? 0;

  // === 축 4: 개폐업 추세 ===
  // 데이터가 없으면 0(중립) — 점수는 50점
  const openCloseDenom = cafeCount > 0 ? cafeCount : (newOpenings + closures);
  const openCloseTrendRaw = openCloseDenom > 0 ? (newOpenings - closures) / openCloseDenom : 0;
  const openCloseTrendScore = normalizeHigherBetter(openCloseTrendRaw, COMPETITION_SCORE_RANGES.openCloseTrend.min, COMPETITION_SCORE_RANGES.openCloseTrend.max) ?? 50;

  // === 축 5: 매출-임대 여유 ===
  // 매출이 0이면 계산 불가 → 중립 50점
  let salesRentMarginRaw = 0;
  let salesRentScore = 50;
  if (monthlySales > 0 && monthlyRent >= 0) {
    salesRentMarginRaw = 1 - (monthlyRent / monthlySales);
    // clamp before scoring so 음수/과대값도 커버
    const clamped = clamp(salesRentMarginRaw, COMPETITION_SCORE_RANGES.salesRentMargin.min, COMPETITION_SCORE_RANGES.salesRentMargin.max);
    salesRentScore = normalizeHigherBetter(clamped, COMPETITION_SCORE_RANGES.salesRentMargin.min, COMPETITION_SCORE_RANGES.salesRentMargin.max) ?? 50;
  }

  // 종합 점수 = 5축 평균
  const sum = densityScore + franchiseRatioScore + potentialPerStoreScore + openCloseTrendScore + salesRentScore;
  const overallScore = Math.round(sum / 5);

  const tier = resolveTier(overallScore);

  const axes = {
    density: {
      value: Math.round(densityRaw * 10) / 10,
      score: densityScore,
      unit: '개/km²',
      label: '카페 밀도',
      direction: 'lower',
      hint: '낮을수록 포화도 낮음',
    },
    franchiseRatio: {
      value: Math.round(franchiseRatioRaw * 100),
      score: franchiseRatioScore,
      unit: '%',
      label: '프랜차이즈 비율',
      direction: 'lower',
      hint: '낮을수록 개인카페 기회',
    },
    potentialPerStore: {
      value: potentialPerStoreRaw,
      score: potentialPerStoreScore,
      unit: '명',
      label: '카페당 잠재 고객',
      direction: 'higher',
      hint: '높을수록 고객 확보 여유',
    },
    openCloseTrend: {
      value: Math.round(openCloseTrendRaw * 100) / 100,
      score: openCloseTrendScore,
      unit: '비율',
      label: '개폐업 추세',
      direction: 'higher',
      hint: '양수일수록 상권 성장',
    },
    salesRentMargin: {
      value: Math.round(salesRentMarginRaw * 100) / 100,
      score: salesRentScore,
      unit: '비율',
      label: '매출-임대 여유',
      direction: 'higher',
      hint: '1에 가까울수록 수익 구조 안정',
    },
  };

  return {
    overallScore,
    tier: tier.key,
    tierLabel: tier.label,
    tierColor: tier.color,
    templateText: tier.template,
    axes,
  };
}

export default calculateCompetitionScore;
