// 빠른 검증용 스크립트 — node src/tests/competitionScore.test.mjs
import { calculateCompetitionScore } from '../utils/competitionScore.js';

const cases = [
  {
    name: '강남역 1번 출구 (초과밀 상권, 대표 샘플)',
    input: {
      cafeCount: 80,
      radius: 500,
      franchiseCount: 28,
      dailyPopulation: 180000,
      newOpenings: 7,
      closures: 5,
      monthlyRent: 6500000,   // 월 650만원
      monthlySales: 28000000, // 월 2,800만원
    },
  },
  {
    name: '청주 (중간 규모 지방 상권)',
    input: {
      cafeCount: 22,
      radius: 500,
      franchiseCount: 6,
      dailyPopulation: 18000,
      newOpenings: 2,
      closures: 1,
      monthlyRent: 1200000,  // 월 120만원
      monthlySales: 8500000, // 월 850만원
    },
  },
  {
    name: '정봉동 (외곽/저밀도 상권)',
    input: {
      cafeCount: 4,
      radius: 500,
      franchiseCount: 1,
      dailyPopulation: 4800,
      newOpenings: 1,
      closures: 0,
      monthlyRent: 600000,   // 월 60만원
      monthlySales: 6500000, // 월 650만원
    },
  },
];

for (const c of cases) {
  const r = calculateCompetitionScore(c.input);
  console.log('========================================');
  console.log(c.name);
  console.log('  입력:', c.input);
  console.log(`  종합 점수: ${r.overallScore}점  →  ${r.tierLabel}(${r.tier})`);
  console.log(`  템플릿:    ${r.templateText}`);
  for (const [k, a] of Object.entries(r.axes)) {
    console.log(`    - ${a.label.padEnd(14)} value=${a.value} ${a.unit}  score=${a.score}점  (${a.hint})`);
  }
}
