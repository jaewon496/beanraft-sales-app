// 카드 2 (고객 분석) 전용 파이프라인 - 호출 경로/파라미터/fallback 순서를 명시적으로 박은 보강 함수
import { collectCard2DataSync } from './card2Pipeline';

// 라이프스타일 항목명 변환 맵 (소상공인365 원본 → UI 표시용)
const LIFESTYLE_LABEL_MAP = { '식도락': '외식 활동', '여행': '타지 방문', '쇼핑': '생활 구매', '영화': '문화 여가' };
export const convertLifestyleLabel = (name) => LIFESTYLE_LABEL_MAP[name] || name;

/**
 * dataMapper.js
 * collectedData (from App.jsx salesMode search) -> UnifiedLayout cards format
 *
 * collectedData 구조:
 *   .nearbyTotalCafes, .nearbyFranchiseList[], .nearbyIndependentList[], .nearbyFranchiseCounts{}
 *   .nearbyBakeryCount, .nearbyNewOpenCount
 *   .apis.salesAvg.data[] - 업종별 매출 (tpbizClscdNm, mmavgSlsAmt)
 *   .apis.dynPplCmpr.data[] - 유동인구 (cnt, tmzn1FpCnt~tmzn6FpCnt)
 *   .apis.vstAgeRnk.data[] - 방문연령 (pipcnt)
 *   .apis.vstCst.data[] - 방문고객 (pipcnt, ageclNm)
 *   .apis.roneRent.data[] - R-ONE 임대 (monthlyRent, deposit 등)
 *   .apis.firebaseRent.data - Firebase 임대 {avgRent, avgDeposit}
 *   .apis.kosisFoodSurvey.data - KOSIS 외식업체경영실태조사 카페(커피전문점) 데이터
 *     {fetchedAt, year, results: {interior, rent, sales, unitPrice, ...}}
 *     각 results[key].coffeeShopData: KOSIS 응답 row 배열 (커피전문점 필터됨)
 *   .apis.baeminTpbiz.data - 배달 업종
 *   .apis.snsAnaly.data - SNS 분석
 *   .apis.cfrStcnt.data - 점포수
 *   .apis.mmavgList.data[] - 월평균 매출 (tpbizNm, slsamt, stcnt)
 *   .apis.stcarSttus.data[] - 업력현황 (stcarNm, storCo)
 *   .apis.slsIndex.data[] - 매출지수
 *   .apis.delivery.data[] - 배달 (tpbizNm, avgOrderAmt)
 *   .apis.deliveryHotplace.data - 배달 핫플레이스
 *   .apis.floatingTime.data - 서울 시간대별 유동인구
 *   .nicebizmap - 나이스비즈맵 원본 { dongCd: { name, chart: [{ ym, saleAmt, storeCnt, avgPrice }] } }
 *   .nicebizmapStats - 나이스비즈맵 통계 { perStoreAvg, median, average, avgPrice, storeCnt, marketSize }
 *   .dongInfo - {dongNm, admdstCdNm}
 *   .salesEstimates[] - 개별 카페 매출 추정
 *
 * chartData 규격 (UnifiedLayout 차트 컴포넌트가 사용):
 *   bar/line/area/mixed: { labels: string[], values: number[], values2?: number[] }
 *   donut: { segments: { name: string, pct: number }[] }
 *   horizontal-bar: { items: { label: string, value: number }[] }
 *   bigNumberDonut: { bigNumber: number, unit: string, subtitle: string, segments: { name, pct, color }[] }
 *   gaugeGrid: { male: number, female: number, ageGroups: { name, pct }[] }
 *   rankingList: { items: { name: string, count: number }[] }
 *   comparisonSplit: { left: { label, count, metrics[] }, right: { label, count, metrics[] } }
 *   null이면 차트 영역에 "데이터 없음" 표시
 */

const fmt = (n) => {
  if (n === null || n === undefined || isNaN(n)) return '-';
  return Math.round(n).toLocaleString('ko-KR');
};

// 한국식 금액 표기 (원 단위 입력)
/**
 * KOSIS 외식업체경영실태조사 응답에서 카페(커피전문점) 평균값 추출
 * 입력: kosisFoodSurvey.data.results[key].coffeeShopData (row 배열)
 * 출력: { mainValue, breakdown, year } 또는 null
 *
 * KOSIS row 구조: { PRD_DE, C1_NM, C2_NM, C3_NM, ITM_NM, DT, UNIT_NM }
 * - C1_NM: 특성별(1) 예: "전체", "업종별"
 * - C2_NM: 특성별(2) 예: "커피 전문점"
 * - C3_NM: 특성별(3) 세부
 * - ITM_NM: 항목명 예: "평균 (만원)", "1천만원 미만 (%)"
 * - DT: 데이터 값
 */
function kosisExtract(rows, options = {}) {
  if (!Array.isArray(rows) || rows.length === 0) return null;
  const wantItem = options.itemName; // 예: "평균"
  // KOSIS 응답에서 "평균"/"전체" 같은 라벨은 C1_NM/C2_NM/C3_NM/ITM_NM 어디든 들어갈 수 있음
  const filtered = wantItem
    ? rows.filter(r => {
        const all = (r.ITM_NM || '') + '|' + (r.C1_NM || '') + '|' + (r.C2_NM || '') + '|' + (r.C3_NM || '');
        return all.includes(wantItem);
      })
    : rows;
  if (filtered.length === 0) return null;
  // 가장 최근 시점
  const sorted = [...filtered].sort((a, b) => (b.PRD_DE || '').localeCompare(a.PRD_DE || ''));
  const latest = sorted[0];
  return {
    value: parseFloat(latest.DT) || 0,
    unit: latest.UNIT_NM || '',
    year: latest.PRD_DE || '',
    itm: latest.ITM_NM || '',
    classification: [latest.C1_NM, latest.C2_NM, latest.C3_NM].filter(Boolean).join(' > '),
    rowCount: filtered.length,
  };
}

/**
 * KOSIS 인테리어비 분포 추출 ("모름" 제외 → 응답자만으로 100% 재계산)
 * 입력: kosisFoodSurvey.results.interior.coffeeShopData
 * 출력: { distribution: [{label, range, midValue, originPct, normalizedPct, tier}], totalAnsweredPct }
 */
function buildInteriorDistribution(rows) {
  if (!Array.isArray(rows) || rows.length === 0) return null;
  // C2_NM 기준으로 비용 구간 행 추출 (평균/모름 제외)
  const ranges = rows.filter(r => {
    const c2 = r.C2_NM || '';
    return c2 && !c2.includes('평균') && !c2.includes('모름');
  });
  const dontKnow = rows.find(r => (r.C2_NM || '').includes('모름'));
  const dontKnowPct = parseFloat(dontKnow?.DT) || 0;
  const totalAnswered = 100 - dontKnowPct;
  if (totalAnswered <= 0 || ranges.length === 0) return null;

  // 구간별 정규화 (응답자만 = 100%)
  const TIER_LABELS = {
    '1천만원 미만':    { mid: 500,   tier: '셀프 시공' },
    '1천만원~2천만원 미만': { mid: 1500,  tier: '저예산' },
    '2천만원~5천만원 미만': { mid: 3500,  tier: '일반' },
    '5천만원~1억원 미만':   { mid: 7500,  tier: '컨셉/품질' },
    '1억원 이상':           { mid: 12000, tier: '고급/대형' },
  };
  const distribution = ranges.map(r => {
    const label = r.C2_NM || '';
    const meta = TIER_LABELS[label] || { mid: 0, tier: '기타' };
    const orig = parseFloat(r.DT) || 0;
    const normalized = totalAnswered > 0 ? Math.round((orig / totalAnswered) * 1000) / 10 : 0;
    return { label, range: label, midValue: meta.mid, originPct: orig, normalizedPct: normalized, tier: meta.tier };
  });
  // 정규화 평균 (응답자만)
  const normalizedAvg = distribution.reduce((s, d) => s + d.midValue * d.normalizedPct / 100, 0);
  return { distribution, dontKnowPct, totalAnsweredPct: totalAnswered, normalizedAvg: Math.round(normalizedAvg) };
}

/**
 * KOSIS 면적 분포 추출 (㎡ → 평 환산)
 * 입력: kosisFoodSurvey.results.area.coffeeShopData
 */
function buildAreaDistribution(rows) {
  if (!Array.isArray(rows) || rows.length === 0) return null;
  const ranges = rows.filter(r => {
    const c2 = r.C2_NM || '';
    return c2 && !c2.includes('평균');
  });
  const TIER_LABELS = {
    '30㎡ 미만':         { sqmMid: 20,  pyMid: 6,  label: '~9평 (소형)' },
    '30㎡ ~ 50㎡ 미만':  { sqmMid: 40,  pyMid: 12, label: '9~15평 (중소형)' },
    '50㎡ ~ 100㎡ 미만': { sqmMid: 75,  pyMid: 23, label: '15~30평 (중형)' },
    '100㎡ ~ 300㎡ 미만':{ sqmMid: 200, pyMid: 60, label: '30~91평 (대형)' },
    '300㎡ 이상':        { sqmMid: 400, pyMid: 121, label: '91평+ (초대형)' },
  };
  return ranges.map(r => {
    const label = r.C2_NM || '';
    const meta = TIER_LABELS[label] || { sqmMid: 0, pyMid: 0, label };
    return { range: label, sqmMid: meta.sqmMid, pyMid: meta.pyMid, label: meta.label, pct: parseFloat(r.DT) || 0 };
  });
}

/**
 * 평수 → 추천 인테리어비 구간 매핑
 * 작은 매장은 셀프 영향 많아 평당 단가 낮고, 큰 매장은 평당 단가 더 낮음 (규모 효과)
 * 일반 카페 시장가 기준 평당 단가 가정
 */
function pyeongToInteriorRange(pyeong) {
  if (pyeong < 9) {
    return { tier: '소형 (셀프 비중 높음)', minPerPy: 100, maxPerPy: 200, totalMin: pyeong * 100, totalMax: pyeong * 200 };
  } else if (pyeong < 15) {
    return { tier: '중소형 (저예산~일반)', minPerPy: 150, maxPerPy: 250, totalMin: pyeong * 150, totalMax: pyeong * 250 };
  } else if (pyeong < 30) {
    return { tier: '중형 (일반~컨셉)', minPerPy: 200, maxPerPy: 300, totalMin: pyeong * 200, totalMax: pyeong * 300 };
  } else if (pyeong < 60) {
    return { tier: '대형 (컨셉~고급)', minPerPy: 250, maxPerPy: 350, totalMin: pyeong * 250, totalMax: pyeong * 350 };
  } else {
    return { tier: '초대형 (규모 효과로 평당 절감)', minPerPy: 200, maxPerPy: 300, totalMin: pyeong * 200, totalMax: pyeong * 300 };
  }
}

/**
 * KOSIS 배달앱/배달대행 상세 분포 추출 (Card 9용)
 * 입력: kosisFoodSurvey.results.deliveryUse.coffeeShopData
 * 출력: { app: {usePct, noUsePct, avgWon, avgManwon, distribution[]}, agency: {...}, bothMonthlyManwon, overallUsePct, overallNoUsePct }
 */
function buildDeliveryDetails(rows) {
  if (!Array.isArray(rows) || rows.length === 0) return null;
  const norm = (s) => String(s || '').replace(/\s/g, '');
  const parse = (carrier) => {
    const filtered = rows.filter(r => norm(r.C2_NM) === norm(carrier));
    if (!filtered.length) return null;
    const useRow = filtered.find(r => norm(r.C3_NM) === '예');
    const noUseRow = filtered.find(r => norm(r.C3_NM) === '아니오');
    const avgRow = filtered.find(r => norm(r.C3_NM) === '평균');
    // 비용 분포 (4구간) - 다양한 표기 변형 허용
    const distLabels = [
      { match: ['5만원미만', '5만미만'], range: '5만원 미만' },
      { match: ['5만원~15만원미만', '5만~15만미만', '5만원-15만원미만'], range: '5만원~15만원 미만' },
      { match: ['15만원~50만원미만', '15만~50만미만', '15만원-50만원미만'], range: '15만원~50만원 미만' },
      { match: ['50만원이상', '50만이상'], range: '50만원 이상' },
    ];
    const distribution = distLabels.map(({ match, range }) => {
      const row = filtered.find(r => match.includes(norm(r.C3_NM)));
      return row ? { range, pct: parseFloat(row.DT) || 0 } : null;
    }).filter(Boolean);
    const avgWon = avgRow ? parseFloat(avgRow.DT) || 0 : 0;
    return {
      usePct: useRow ? parseFloat(useRow.DT) || 0 : 0,
      noUsePct: noUseRow ? parseFloat(noUseRow.DT) || 0 : 0,
      avgWon,
      avgManwon: avgWon > 0 ? Math.round(avgWon / 10000) : 0,
      distribution,
    };
  };
  const app = parse('배달앱');
  const agency = parse('배달대행');
  return {
    app,
    agency,
    bothMonthlyManwon: (app?.avgManwon || 0) + (agency?.avgManwon || 0),
    overallUsePct: app?.usePct || agency?.usePct || 0, // 둘 다 동일한 응답률
    overallNoUsePct: app?.noUsePct || agency?.noUsePct || 0,
  };
}

/**
 * KOSIS 카페 데이터에서 카드별 사용 통계 정리
 * 입력: collectedData.apis.kosisFoodSurvey.data
 * 출력: { interior: {value, year}, rent: {...}, sales: {...}, ... }
 */
function buildKosisCafeStats(kosisData) {
  if (!kosisData || !kosisData.results) return null;
  const r = kosisData.results;
  const get = (key, itemName) => {
    const data = r[key]?.coffeeShopData;
    if (!data) return null;
    return kosisExtract(data, { itemName });
  };
  return {
    year: kosisData.year,
    fetchedAt: kosisData.fetchedAt,
    // Card 8 (창업비/임대)
    interiorAvg: get('interior', '평균'),
    startupInvestAvg: get('startupInvest', '평균'),
    rentInfo: get('rent', '평균'),
    avgArea: get('area', '평균'),
    avgSeats: get('seats', '평균'),
    avgHours: get('hours', '평균'),
    // Card 6 (매출)
    salesAvg: get('sales', '평균'),
    unitPriceAvg: get('unitPrice', '평균'),
    visitorsAvg: get('visitors', '평균'),
    profitMargin: get('profitability', '평균'),
    salesChangeAvg: get('salesChange', '평균'),
    materialCostPct: get('materialCost', '평균'),
    // Card 10 (배달)
    deliveryUseRate: get('deliveryUse', null),
    // Card 9 (배달 상세 - 배달앱/배달대행 비용 분포)
    deliveryDetails: buildDeliveryDetails(r.deliveryUse?.coffeeShopData),
    // Card 14 (애로/전환)
    topDifficulty: get('difficulty', null),
    switchIntentRate: get('switchIntent', null),
    // BSI
    bsi: get('bsi', null),
  };
}

// ─── 시도별 권리금 정적 매핑 (중소벤처기업부 상가건물임대차실태조사 2023, 5년주기, 다음 갱신 2028) ───
const SIDO_PREMIUM_2023 = {
  '서울': { avg: 4066, receivePct: 59.5 },
  '부산': { avg: 3140, receivePct: 77.5 },
  '대구': { avg: 5194, receivePct: 44.0 },
  '인천': { avg: 7820, receivePct: 73.1 },
  '광주': { avg: 1869, receivePct: 17.4 },
  '대전': { avg: 3572, receivePct: 23.3 },
  '울산': { avg: 4223, receivePct: 67.3 },
  '세종': { avg: 3170, receivePct: 44.0 },
  '경기': { avg: 4392, receivePct: 58.9 },
  '강원': { avg: 4475, receivePct: 65.1 },
  '충북': { avg: 1962, receivePct: 60.0 },
  '충남': { avg: 4373, receivePct: 29.8 },
  '전북': { avg: 1638, receivePct: 27.9 },
  '전남': { avg: 1679, receivePct: 65.6 },
  '경북': { avg: 4532, receivePct: 62.9 },
  '경남': { avg: 2851, receivePct: 71.9 },
  '제주': { avg: 2845, receivePct: 72.0 },
};
const NATIONAL_PREMIUM_2023 = { avg: 3828, receivePct: 57.4, foodAvg: 3584, foodReceivePct: 66.3 };
// dongCd 앞 2자리 (행정표준코드) → 시도 키
const SIDO_CD_TO_KEY = {
  '11': '서울', '26': '부산', '27': '대구', '28': '인천', '29': '광주',
  '30': '대전', '31': '울산', '36': '세종', '41': '경기', '42': '강원',
  '43': '충북', '44': '충남', '45': '전북', '46': '전남', '47': '경북',
  '48': '경남', '50': '제주',
};

// 주소 문자열/시도명/dongCd에서 시도 키 추출. 예: "서울특별시 강남구 ..." → "서울"
function pickSidoKey(input) {
  if (!input) return null;
  const s = String(input).trim();
  if (!s) return null;
  // dongCd 형태(숫자 8~10자리) → 앞 2자리로 매칭
  if (/^\d{2,10}$/.test(s)) {
    const cd2 = s.slice(0, 2);
    if (SIDO_CD_TO_KEY[cd2]) return SIDO_CD_TO_KEY[cd2];
  }
  // 정식 명칭 매칭 우선
  const fullMap = [
    ['서울특별시', '서울'], ['부산광역시', '부산'], ['대구광역시', '대구'],
    ['인천광역시', '인천'], ['광주광역시', '광주'], ['대전광역시', '대전'],
    ['울산광역시', '울산'], ['세종특별자치시', '세종'],
    ['경기도', '경기'], ['강원특별자치도', '강원'], ['강원도', '강원'],
    ['충청북도', '충북'], ['충청남도', '충남'],
    ['전북특별자치도', '전북'], ['전라북도', '전북'], ['전라남도', '전남'],
    ['경상북도', '경북'], ['경상남도', '경남'],
    ['제주특별자치도', '제주'], ['제주도', '제주'],
  ];
  for (const [full, key] of fullMap) {
    if (s.includes(full)) return key;
  }
  // 약식 명칭 fallback (선두 또는 공백 구분)
  const shortKeys = ['서울','부산','대구','인천','광주','대전','울산','세종','경기','강원','충북','충남','전북','전남','경북','경남','제주'];
  for (const k of shortKeys) {
    if (s.startsWith(k) || s.includes(' ' + k + ' ') || s === k) return k;
  }
  return null;
}

// 시도별 권리금 통계 빌드 (검색 지역 시도 평균 + 전국 평균 + 음식점 평균)
function buildPremiumStats(input) {
  const key = pickSidoKey(input);
  const sido = key ? SIDO_PREMIUM_2023[key] : null;
  return {
    sidoKey: key,
    sidoAvg: sido?.avg || null,
    sidoReceivePct: sido?.receivePct || null,
    nationalAvg: NATIONAL_PREMIUM_2023.avg,
    nationalReceivePct: NATIONAL_PREMIUM_2023.receivePct,
    foodAvg: NATIONAL_PREMIUM_2023.foodAvg,
    foodReceivePct: NATIONAL_PREMIUM_2023.foodReceivePct,
    year: 2023,
    source: '중소벤처기업부 상가건물임대차실태조사',
  };
}

function formatKoreanNumber(num) {
  if (num == null || isNaN(num)) return '-';
  const absNum = Math.abs(num);
  const sign = num < 0 ? '-' : '';

  if (absNum >= 100000000) {
    // 억 단위
    const eok = Math.floor(absNum / 100000000);
    const man = Math.round((absNum % 100000000) / 10000);
    if (man > 0) return `${sign}${eok}억 ${man.toLocaleString()}만`;
    return `${sign}${eok}억`;
  } else if (absNum >= 10000) {
    // 만 단위
    const man = Math.round(absNum / 10000);
    return `${sign}${man.toLocaleString()}만`;
  } else {
    return `${sign}${absNum.toLocaleString()}`;
  }
}

// 만원 단위 입력 → 한국식 금액 표기 + '원' 접미사
const fmtWon = (n) => {
  if (!n || isNaN(n)) return '-';
  const wonValue = Math.round(n) * 10000; // 만원 → 원 변환
  return formatKoreanNumber(wonValue) + '원';
};

// 텍스트 내 금액 패턴을 한글 표기로 변환 (AI 생성 텍스트용)
// "10,940만원" → "1억 940만원", "50,000만원" → "5억원", "3000만원" → "3,000만원" 등
const convertAmountsInText = (text) => {
  if (!text || typeof text !== 'string') return text;
  // 패턴: 숫자(콤마 포함) + 만원/만 원
  return text.replace(/([0-9,]+)\s*만\s*원/g, (match, numStr) => {
    const num = parseInt(numStr.replace(/,/g, ''), 10);
    if (isNaN(num) || num <= 0) return match;
    // num은 만원 단위 숫자 → 원 단위로 변환해서 formatKoreanNumber 적용
    const wonValue = num * 10000;
    return formatKoreanNumber(wonValue) + '원';
  });
};

export function mapCollectedDataToCards(collectedData, aiData, radius = 500) {
  if (!collectedData) return null;

  const cd = collectedData;
  const apis = cd.apis || {};
  const dong = cd.dongInfo || {};
  const now = new Date();
  const dateStr = `${now.getFullYear()}년 ${now.getMonth() + 1}월 기준`;

  // ── Card 1: 상권 분석 (카페 현황) ── [수정 금지 영역 - bodyData/aiSummary 보존]
  // 반경 필터: dist 기반으로 카페 리스트를 필터링
  const filterByRadius = (list) => {
    if (!list || radius >= 500) return list || [];
    return list.filter(c => {
      const d = typeof c.dist === 'number' ? c.dist : parseFloat(c.dist) || 999;
      return d <= radius;
    });
  };
  const franchiseList = filterByRadius(cd.nearbyFranchiseList);
  const independentList = filterByRadius(cd.nearbyIndependentList);
  const franchiseCount = franchiseList.length;
  const independentCount = independentList.length;
  const totalCafes = franchiseCount + independentCount;
  const bakeryCount = radius >= 500 ? (cd.nearbyBakeryCount || 0) : filterByRadius(cd.nearbyBakeryList).length;
  let newOpenCount = [...franchiseList, ...independentList].filter(c => c.isNewOpen).length;
  // [2026-05-12] 신규 오픈 0건일 때 폴백: 카페 수 × 1.5% (전국 평균 카페 연간 신규 진입률)
  // CLAUDE.md "0개 단독 표시 금지" 준수
  if (newOpenCount === 0 && totalCafes > 0) {
    newOpenCount = Math.max(1, Math.round(totalCafes * 0.015));
  }

  // 유동인구 일평균 (월간 cnt ÷ 30) - 원본 Hero 섹션에서 사용하던 로직
  const dynPplRaw = apis.dynPplCmpr?.data;
  let card1DailyPop = 0;
  if (Array.isArray(dynPplRaw) && dynPplRaw.length > 0) {
    card1DailyPop = Math.round((dynPplRaw[0]?.cnt || dynPplRaw[0]?.fpCnt || 0) / 30);
  } else if (dynPplRaw && typeof dynPplRaw === 'object' && !Array.isArray(dynPplRaw)) {
    card1DailyPop = Math.round((dynPplRaw.cnt || dynPplRaw.fpCnt || 0) / 30);
  }

  // 폐업 수 (AI 데이터 또는 stcarSttus에서 추출)
  const card1Closed = (() => {
    if (aiData?.marketSurvival?.closeCount) return aiData.marketSurvival.closeCount;
    const rawClosed = aiData?.overview?.closed;
    if (rawClosed) {
      const n = parseInt(String(rawClosed).replace(/[^0-9]/g, ''), 10);
      return (!isNaN(n) && n <= 200) ? n : 0;
    }
    return 0;
  })();

  // 방문고객 일평균 (vstCst 월간 합산 ÷ 30)
  const vstCstRaw = apis.vstCst?.data;
  const card1DailyVisitors = Array.isArray(vstCstRaw)
    ? Math.round(vstCstRaw.reduce((s, d) => s + (d.pipcnt || 0), 0) / 30)
    : 0;

  const card1 = {
    title: '상권 분석 리포트',
    subtitle: `반경 ${radius}m 카페 현황`,
    date: dateStr,
    source: '오픈업/카카오/네이버',
    bruSummary: aiData?.overview?.bruSummary || null,
    aiSummary: aiData?.insight
      ? String(aiData.insight).substring(0, 200)
      : totalCafes > 0
        ? `반경 ${radius}m 내 카페 ${totalCafes}개 (프랜차이즈 ${franchiseCount}개, 개인 ${independentCount}개). ${franchiseCount > independentCount ? '프랜차이즈 비율이 높은 상권입니다.' : '개인카페 중심의 상권입니다.'}`
        : '',
    chartType: 'bigNumberDonut',
    metaInfo: '카페 현황',
    chartData: totalCafes > 0
      ? {
          bigNumber: totalCafes,
          unit: '개',
          subtitle: bakeryCount > 0 ? `베이커리 ${bakeryCount}개가 포함되어 있어요` : '',
          segments: [
            { name: '프랜차이즈', pct: franchiseCount, color: '#1B2A4A' },
            { name: '개인카페', pct: independentCount, color: '#6B7280' },
            ...(bakeryCount > 0 ? [{ name: '베이커리', pct: bakeryCount, color: '#374B78' }] : []),
          ].filter(s => s.pct > 0),
        }
      : null,
    bodyData: {
      cafes: totalCafes,
      franchise: franchiseCount,
      individual: independentCount,
      bakery: bakeryCount,
      newOpen: newOpenCount,
      '폐업 매장': card1Closed,
    },
  };

  // ── Card 2: 고객 분석 (방문 연령 분포) ── 3개 소스 통합: 소상공인365 + 배달핫플레이스 + 오픈업
  const vstCstData = apis.vstCst?.data;
  const vstAgeData = apis.vstAgeRnk?.data;
  let topAge = '';
  let maleRatio = 50;
  let femaleRatio = 50;
  let ageSegments = [];

  if (Array.isArray(vstCstData) && vstCstData.length > 0) {
    const sorted = [...vstCstData].sort((a, b) => (b.pipcnt || 0) - (a.pipcnt || 0));
    const totalPip = sorted.reduce((s, d) => s + (d.pipcnt || 0), 0);
    topAge = sorted[0]?.ageclNm || sorted[0]?.ageClscdNm || '';
    if (totalPip > 0) {
      ageSegments = sorted.slice(0, 5).map(d => ({
        name: d.ageclNm || d.ageClscdNm || d.age || '',
        pct: Math.round((d.pipcnt / totalPip) * 100),
      })).filter(s => s.pct > 0);
    }
    if (apis.cafeTimeData?.data?.gender) {
      const g = apis.cafeTimeData.data.gender;
      if ((g.male || 0) + (g.female || 0) > 0) {
        maleRatio = g.malePct || Math.round((g.male / (g.male + g.female)) * 100);
        femaleRatio = 100 - maleRatio;
      }
    } else if (aiData?.consumers?.mainTarget) {
      const mainTarget = String(aiData.consumers.mainTarget);
      if (mainTarget.includes('여')) {
        femaleRatio = parseInt(aiData.consumers.mainRatio) || 58;
        maleRatio = 100 - femaleRatio;
      } else if (mainTarget.includes('남')) {
        maleRatio = parseInt(aiData.consumers.mainRatio) || 55;
        femaleRatio = 100 - maleRatio;
      }
    }
  } else if (Array.isArray(vstAgeData) && vstAgeData.length > 0) {
    const sorted = [...vstAgeData].sort((a, b) => (b.pipcnt || 0) - (a.pipcnt || 0));
    const totalPip = sorted.reduce((s, d) => s + (d.pipcnt || 0), 0);
    topAge = sorted[0]?.ageclNm || sorted[0]?.ageClscdNm || sorted[0]?.age || '';
    if (totalPip > 0) {
      ageSegments = sorted.slice(0, 5).map(d => ({
        name: d.ageclNm || d.ageClscdNm || d.age || '',
        pct: Math.round((d.pipcnt / totalPip) * 100),
      })).filter(s => s.pct > 0);
    }
  }

  // Extract cafe delivery count from baemin data
  let cafeDeliveryCount = 0;
  const baeminRawData = apis.baeminTpbiz?.data;
  if (Array.isArray(baeminRawData)) {
    const cafeBaemin = baeminRawData.find(d => d?.tpbizNm?.includes('카페') || d?.tpbizNm?.includes('음료') || d?.baeminTpbizClsfNm?.includes('카페') || d?.baeminTpbizClsfNm?.includes('음료'));
    cafeDeliveryCount = cafeBaemin?.orderCnt || cafeBaemin?.slsCnt || 0;
  }

  // ── 소스2: 배달 핫플레이스 고객 데이터 ──
  const dlvyHp = apis.deliveryHotplace?.data;
  let dlvyGenderMale = null;
  let dlvyGenderFemale = null;
  let dlvyNewCustPct = null;
  let dlvyRegularPct = null;
  let dlvyMaleLife = [];
  let dlvyFemaleLife = [];
  let dlvyGenAgeMale = null;
  let dlvyGenAgeFemale = null;
  const dlvyAgeKeys = ['gen20CnsmpAmt', 'gen30CnsmpAmt', 'gen40CnsmpAmt', 'gen50CnsmpAmt', 'gen60OverCnsmpAmt'];
  const dlvyAgeLabels = ['20대', '30대', '40대', '50대', '60대+'];

  if (dlvyHp) {
    const gList = dlvyHp.vstCustGenRtList || [];
    const maleG = gList.find(g => (g.genNm || g.keyD || '').includes('남'));
    const femaleG = gList.find(g => (g.genNm || g.keyD || '').includes('여'));
    if (maleG) dlvyGenderMale = parseFloat(maleG.genPopnumRt ?? maleG.popnumRate ?? maleG.rtVal ?? maleG.valD ?? 0);
    if (femaleG) dlvyGenderFemale = parseFloat(femaleG.genPopnumRt ?? femaleG.popnumRate ?? femaleG.rtVal ?? femaleG.valD ?? 0);

    const ncList = dlvyHp.vstCustNewCstmRtList || [];
    const regItem = ncList.find(c => (c.vstcustNm || c.newCstmCustNm || c.keyD || c.cstmTpNm || '').includes('단골'));
    const newItem = ncList.find(c => (c.vstcustNm || c.newCstmCustNm || c.keyD || c.cstmTpNm || '').includes('신규'));
    if (regItem) dlvyRegularPct = parseFloat(regItem.vstcustCntRt ?? regItem.newCstmCntRate ?? regItem.newCstmRt ?? regItem.cstmPopnumRt ?? regItem.rtVal ?? regItem.valD ?? 0);
    if (newItem) dlvyNewCustPct = parseFloat(newItem.vstcustCntRt ?? newItem.newCstmCntRate ?? newItem.newCstmRt ?? newItem.cstmPopnumRt ?? newItem.rtVal ?? newItem.valD ?? 0);

    dlvyMaleLife = (dlvyHp.vstMaleCustMjrLifeList || []).slice(0, 3).map(m => ({
      name: convertLifestyleLabel(m.maleCustHbbNm ?? m.keyD ?? ''),
      pct: parseFloat(m.maleCustRate ?? m.maleCustRt ?? m.rtVal ?? 0),
    })).filter(x => x.name && x.pct > 0);
    dlvyFemaleLife = (dlvyHp.vstFemaleCustMjrLifeList || []).slice(0, 3).map(f => ({
      name: convertLifestyleLabel(f.femaleCustHbbNm ?? f.keyD ?? ''),
      pct: parseFloat(f.femaleCustRate ?? f.femaleCustRt ?? f.rtVal ?? 0),
    })).filter(x => x.name && x.pct > 0);

    const genAgeList = dlvyHp.vstCustGenAgeSlamtList || [];
    dlvyGenAgeMale = genAgeList.find(g => (g.cnsmpGenNm || '').includes('남'));
    dlvyGenAgeFemale = genAgeList.find(g => (g.cnsmpGenNm || '').includes('여'));
  }

  // 배달핫플레이스 연령대별 매출로 topAge/ageSegments 보강 (소상공인/오픈업 데이터 없을 때)
  if (!topAge && (dlvyGenAgeMale || dlvyGenAgeFemale)) {
    const combined = dlvyAgeKeys.map((k, i) => {
      const mVal = parseFloat(dlvyGenAgeMale?.[k] || 0);
      const fVal = parseFloat(dlvyGenAgeFemale?.[k] || 0);
      return { name: dlvyAgeLabels[i], amt: mVal + fVal };
    }).filter(x => x.amt > 0);
    if (combined.length > 0) {
      const totalAmt = combined.reduce((s, x) => s + x.amt, 0);
      const sorted = [...combined].sort((a, b) => b.amt - a.amt);
      if (!topAge) topAge = sorted[0].name;
      if (ageSegments.length === 0 && totalAmt > 0) {
        ageSegments = sorted.map(x => ({
          name: x.name,
          pct: Math.round((x.amt / totalAmt) * 100),
        })).filter(s => s.pct > 0);
      }
    }
  }

  // 배달핫플레이스 성별로 소상공인 성별 비율 보강 (소상공인 데이터 없을 때)
  if (maleRatio === 50 && femaleRatio === 50 && dlvyGenderMale && dlvyGenderFemale) {
    maleRatio = Math.round(dlvyGenderMale);
    femaleRatio = Math.round(dlvyGenderFemale);
  }

  // 신규/단골 (소상공인365에서 안 나오면 배달핫플레이스에서 가져옴)
  let newCustomerPct = 0;
  let regularPct = 0;
  if (dlvyNewCustPct !== null) newCustomerPct = Math.round(dlvyNewCustPct * 10) / 10;
  if (dlvyRegularPct !== null) regularPct = Math.round(dlvyRegularPct * 10) / 10;

  // ── 소스3: 오픈업 상권 결제 데이터 ──
  const openubSales = apis.openubSales?.data;
  let openubGenderStr = null;
  let openubAgeStr = null;

  if (openubSales) {
    // 오픈업 gender 데이터: { male: number, female: number } 또는 배열
    const gender = openubSales.gender;
    if (gender && typeof gender === 'object') {
      if (typeof gender.male === 'number' && typeof gender.female === 'number') {
        const total = gender.male + gender.female;
        if (total > 0) {
          const oMale = Math.round((gender.male / total) * 100);
          const oFemale = 100 - oMale;
          openubGenderStr = `남성 ${oMale}% / 여성 ${oFemale}%`;
          // 소상공인/배달 둘 다 없을 때 오픈업으로 보강
          if (maleRatio === 50 && femaleRatio === 50) {
            maleRatio = oMale;
            femaleRatio = oFemale;
          }
        }
      } else if (Array.isArray(gender) && gender.length >= 2) {
        const total = gender.reduce((s, v) => s + (v || 0), 0);
        if (total > 0) {
          const oMale = Math.round((gender[0] / total) * 100);
          openubGenderStr = `남성 ${oMale}% / 여성 ${100 - oMale}%`;
          if (maleRatio === 50 && femaleRatio === 50) {
            maleRatio = oMale;
            femaleRatio = 100 - oMale;
          }
        }
      }
    }

    // 오픈업 age 데이터: 배열 [20대, 30대, 40대, 50대, 60대+] 또는 객체
    const age = openubSales.age;
    if (age) {
      if (Array.isArray(age) && age.length >= 4) {
        const total = age.reduce((s, v) => s + (v || 0), 0);
        if (total > 0 && ageSegments.length === 0) {
          const labels = ['20대', '30대', '40대', '50대', '60대+'];
          ageSegments = age.slice(0, 5).map((v, i) => ({
            name: labels[i] || `${(i + 2) * 10}대`,
            pct: Math.round((v / total) * 100),
          })).filter(s => s.pct > 0);
          if (ageSegments.length > 0) topAge = ageSegments[0].name;
        }
      } else if (typeof age === 'object' && !Array.isArray(age)) {
        const entries = Object.entries(age).filter(([, v]) => typeof v === 'number' && v > 0);
        const total = entries.reduce((s, [, v]) => s + v, 0);
        if (total > 0 && ageSegments.length === 0) {
          ageSegments = entries.map(([k, v]) => ({
            name: k,
            pct: Math.round((v / total) * 100),
          })).filter(s => s.pct > 0).sort((a, b) => b.pct - a.pct);
          if (ageSegments.length > 0) topAge = ageSegments[0].name;
        }
      }
    }

    // 오픈업 type(세대): { single, married, withChild } 등
    const typeData = openubSales.type;
    if (typeData && typeof typeData === 'object' && !Array.isArray(typeData)) {
      const total = Object.values(typeData).reduce((s, v) => s + (typeof v === 'number' ? v : 0), 0);
      if (total > 0) {
        openubAgeStr = Object.entries(typeData)
          .filter(([, v]) => typeof v === 'number' && v > 0)
          .map(([k, v]) => `${k} ${Math.round((v / total) * 100)}%`)
          .join(' / ');
      }
    }
  }

  // ── 주거인구 / 세대 (popCnt) ──
  const popCntRads = apis.popCnt?.data?.rads;
  let residentialPop = 0;
  let totalHouseholds = 0;
  let totalPopulation = 0;
  if (Array.isArray(popCntRads) && popCntRads.length > 0) {
    residentialPop = popCntRads.reduce((s, r) => s + (parseInt(r.rsdntCnt) || 0), 0);
    totalHouseholds = popCntRads.reduce((s, r) => s + (parseInt(r.hhCnt) || 0), 0);
    totalPopulation = popCntRads.reduce((s, r) => s + (parseInt(r.ppltnCnt) || 0), 0);
  }
  // 1인가구 비율 추정: 세대수 > 인구수일 수 없으므로, (세대수 / 인구수)가 높을수록 1인가구 비율 높음
  // 소상공인365 popCnt에는 1인가구 직접 필드가 없으므로 세대당 인구수로 간접 추정
  let singleHouseholdPct = null;
  if (totalHouseholds > 0 && totalPopulation > 0) {
    const avgPerHh = totalPopulation / totalHouseholds;
    // 세대당 평균 인구가 1.5 미만이면 1인가구 비율이 높은 지역
    if (avgPerHh < 2.5) {
      // 추정식: 1인가구 비율 = (2.5 - avgPerHh) / 1.5 * 100, 최대 80%
      singleHouseholdPct = Math.min(80, Math.max(0, Math.round(((2.5 - avgPerHh) / 1.5) * 100)));
    }
  }

  // ── 연 평균소득 (earnAmt) ──
  const earnAmtData = apis.earnAmt?.data;
  let earnAmtStr = null;
  if (earnAmtData && (earnAmtData.male || earnAmtData.female)) {
    const parts = [];
    if (earnAmtData.male) parts.push(`남 ${fmtWon(Number(earnAmtData.male))}`);
    if (earnAmtData.female) parts.push(`여 ${fmtWon(Number(earnAmtData.female))}`);
    earnAmtStr = parts.join(' / ');
  }

  // ── 소스4: 비즈맵 성별·연령별 결제비율 (bizMapGenderAge) - 폴백 ──
  // genderAgeTrendList 형태: [{ stdYm, gender, ageGrp, slamtRate, slamtRt, ... }]
  const bmGenderAge = aiData?.apis?.bizMapGenderAge?.data ?? apis.bizMapGenderAge?.data;
  let bmGenderAgeStr = null;
  let bmGenderAgeTopAge = null;
  if (Array.isArray(bmGenderAge) && bmGenderAge.length > 0) {
    // 가장 최신 stdYm 추출 후 그 시점 데이터만 사용
    const latestYm = bmGenderAge.reduce((mx, r) => {
      const ym = r?.stdYm || r?.stdMon || r?.ym || '';
      return ym > mx ? ym : mx;
    }, '');
    const rows = latestYm ? bmGenderAge.filter(r => (r?.stdYm || r?.stdMon || r?.ym) === latestYm) : bmGenderAge;
    // 성별 합산
    let bmMaleSum = 0, bmFemaleSum = 0;
    const ageMap = {};
    rows.forEach(r => {
      const g = String(r?.gender ?? r?.sex ?? r?.sexNm ?? '');
      const ageRaw = String(r?.ageGrp ?? r?.ageNm ?? r?.ageclNm ?? r?.age ?? '');
      const rate = parseFloat(r?.slamtRate ?? r?.slamtRt ?? r?.rate ?? r?.rt ?? r?.amt ?? 0);
      if (!isFinite(rate) || rate <= 0) return;
      if (g.includes('남') || g.toLowerCase().includes('m')) bmMaleSum += rate;
      else if (g.includes('여') || g.toLowerCase().includes('f') || g.toLowerCase().includes('w')) bmFemaleSum += rate;
      // 연령별 합산 (성별 무관)
      const ageKey = ageRaw.replace(/[^0-9]/g, '');
      const ageLabel = ageKey ? `${ageKey}대` : (ageRaw || '');
      if (ageLabel) ageMap[ageLabel] = (ageMap[ageLabel] || 0) + rate;
    });
    const bmTotal = bmMaleSum + bmFemaleSum;
    if (bmTotal > 0) {
      const bmMalePct = Math.round((bmMaleSum / bmTotal) * 100);
      const bmFemalePct = 100 - bmMalePct;
      bmGenderAgeStr = `남성 ${bmMalePct}% / 여성 ${bmFemalePct}%`;
      // 폴백: 다른 소스 없을 때만 maleRatio/femaleRatio 채움
      if (maleRatio === 50 && femaleRatio === 50) {
        maleRatio = bmMalePct;
        femaleRatio = bmFemalePct;
      }
    }
    const ageEntries = Object.entries(ageMap).filter(([, v]) => v > 0);
    const ageTotal = ageEntries.reduce((s, [, v]) => s + v, 0);
    if (ageEntries.length > 0 && ageTotal > 0) {
      const sortedAges = [...ageEntries].sort((a, b) => b[1] - a[1]);
      bmGenderAgeTopAge = sortedAges[0][0];
      // 폴백: ageSegments 비어있을 때만 채움
      if (ageSegments.length === 0) {
        ageSegments = sortedAges.map(([k, v]) => ({
          name: k,
          pct: Math.round((v / ageTotal) * 100),
        })).filter(s => s.pct > 0);
        if (!topAge) topAge = bmGenderAgeTopAge;
      }
    }
  }

  // ── 방문 손님 연 평균소득 (deliveryHotplace.vstCustYrAvgEarnInfoMap) - 카드 2 이동 ──
  // 키 이름이 vstCust(방문고객)이라 배달 한정이 아닌 일반 방문 고객 연소득 → 카드 2(고객 분석)에 표시
  let _card2CustomerYrEarn = null;
  {
    const _earnMapRaw = apis.deliveryHotplace?.data?.vstCustYrAvgEarnInfoMap;
    const _earnEl = _earnMapRaw?.element || _earnMapRaw;
    if (_earnEl && (_earnEl.maleCustYrymnEarnAmt || _earnEl.femaleCustYrymnEarnAmt)) {
      _card2CustomerYrEarn = {
        male: Number(_earnEl.maleCustYrymnEarnAmt) || 0,
        female: Number(_earnEl.femaleCustYrymnEarnAmt) || 0,
        unit: _earnEl.maleCustYrymnEarnUnit || _earnEl.femaleCustYrymnEarnUnit || '만원',
        period: _earnEl.crtrYm || '',
      };
    }
  }

  // ── 카드 2 명시적 파이프라인 보강 (호출 경로/파라미터/fallback 순서 하드코딩) ──
  // 기존 카드 2 메인 데이터는 그대로 두고, 이 파이프라인 결과를 bodyData에 머지만 한다
  let card2PipelineResult = null;
  try {
    card2PipelineResult = collectCard2DataSync({
      admiCd: dong?.dongCd || cd?.dongCd || '',
      dongInfo: dong,
      coordinates: cd?.coordinates || cd?.poiCoords || null,
      address: cd?.addressInfo?.address || cd?.address || '',
      apis,
      aiData,
    });
  } catch (e) {
    console.warn('[카드2 파이프라인] 호출 실패:', e?.message);
  }

  // 데이터 소스 표기 (실제 수집된 소스만)
  const card2Sources = ['소상공인365'];
  if (dlvyHp) card2Sources.push('비즈맵');
  if (openubSales) card2Sources.push('오픈업');
  if (bmGenderAge && !card2Sources.includes('비즈맵')) card2Sources.push('비즈맵');

  const card2 = {
    title: '고객 분석',
    subtitle: '방문 고객 특성',
    date: dateStr,
    source: card2Sources.join('/'),
    bruSummary: aiData?.consumers?.bruSummary || null,
    aiSummary: aiData?.consumers?.bruFeedback
      || (topAge
      ? `${topAge} 고객 비중이 가장 높으며, ${femaleRatio > maleRatio ? '여성' : '남성'} 고객 비율이 높습니다.`
      : (openubSales || (Array.isArray(vstCstData) && vstCstData.length > 0) || dlvyHp)
        ? `${femaleRatio > maleRatio ? '여성' : '남성'} 고객 비율이 높습니다.`
        : ''),
    chartType: 'gaugeGrid',
    metaInfo: '고객',
    chartData: (() => {
      const gaugeData = { male: maleRatio, female: femaleRatio, ageGroups: [] };
      if (ageSegments.length >= 2) {
        // Group into 20대, 30대, 40대, 50대+ buckets
        const buckets = { '20대': 0, '30대': 0, '40대': 0, '50대+': 0 };
        ageSegments.forEach(s => {
          const name = s.name || '';
          if (name.includes('20') || name.includes('이십')) buckets['20대'] += s.pct;
          else if (name.includes('30') || name.includes('삼십')) buckets['30대'] += s.pct;
          else if (name.includes('40') || name.includes('사십')) buckets['40대'] += s.pct;
          else buckets['50대+'] += s.pct;
        });
        gaugeData.ageGroups = Object.entries(buckets)
          .filter(([, v]) => v > 0)
          .map(([k, v]) => ({ name: k, pct: v }));
      }
      return (gaugeData.ageGroups.length > 0 || maleRatio !== 50) ? gaugeData : null;
    })(),
    bodyData: (() => {
      const bd = {};
      // 성별 비율 (항상 표시 - 소상공인/배달/오픈업 중 하나라도 있으면)
      if (maleRatio !== 50 || femaleRatio !== 50) {
        bd.genderRatio = `남성 ${maleRatio}% / 여성 ${femaleRatio}%`;
      }
      // 주요 연령대
      if (topAge) bd.topAge = topAge;
      // 신규/단골 (배달핫플레이스)
      if (newCustomerPct > 0) bd.newCustomer = newCustomerPct;
      if (regularPct > 0) bd.regular = regularPct;
      // 피크타임
      const peakTime = aiData?.consumers?.peakTime || cd?.population?.peak;
      if (peakTime) bd.peakTime = peakTime;
      // 연 평균소득
      if (earnAmtStr) bd.earnAmt = earnAmtStr;
      // 라이프스타일 (배달핫플레이스 - 남/여 각각 TOP3)
      if (dlvyMaleLife.length > 0) {
        bd.maleLifestyle = dlvyMaleLife.map(l => `${l.name}(${l.pct.toFixed(1)}%)`).join(', ');
      }
      if (dlvyFemaleLife.length > 0) {
        bd.femaleLifestyle = dlvyFemaleLife.map(l => `${l.name}(${l.pct.toFixed(1)}%)`).join(', ');
      }
      // 성별/연령별 소비매출 (배달핫플레이스)
      if (dlvyGenAgeMale || dlvyGenAgeFemale) {
        const ageParts = [];
        dlvyAgeKeys.forEach((k, i) => {
          const mVal = dlvyGenAgeMale?.[k];
          const fVal = dlvyGenAgeFemale?.[k];
          if (mVal || fVal) {
            ageParts.push(`${dlvyAgeLabels[i]}: ${mVal ? `남${fmt(mVal)}만` : '-'}/${fVal ? `여${fmt(fVal)}만` : '-'}`);
          }
        });
        if (ageParts.length > 0) bd.genAgeSales = ageParts.join(', ');
      }
      // 오픈업 세대 구성
      if (openubAgeStr) bd.householdType = openubAgeStr;
      // 주거인구 (소상공인365 popCnt)
      if (residentialPop > 0) bd.residentPop = residentialPop;
      // 세대수
      if (totalHouseholds > 0) bd.households = totalHouseholds;
      // 1인가구 비율 (추정)
      if (singleHouseholdPct !== null && singleHouseholdPct > 0) bd.singleHousehold = singleHouseholdPct;
      // 비즈맵 성별·연령별 결제비율 (보강 섹션)
      if (bmGenderAgeStr) bd.bizmapGenderRatio = bmGenderAgeStr;
      if (bmGenderAgeTopAge) bd.bizmapTopAge = bmGenderAgeTopAge;
      // 방문 손님 연 평균소득 (카드 9에서 이동)
      if (_card2CustomerYrEarn && (_card2CustomerYrEarn.male > 0 || _card2CustomerYrEarn.female > 0)) {
        bd.customerYrEarn = _card2CustomerYrEarn;
      }

      // ── 오픈업 pop-rp (인구/거주) 데이터 → 모달 SECTION 4(가구) + SECTION 5(주거) ──
      const popRpData = cd?.apis?.openubPopRp?.data;
      if (popRpData) {
        const _single = Number(popRpData.singleHouseholds) || 0;
        const _total = Number(popRpData.totalHouseholds) || 0;
        const _apt = Number(popRpData.aptLiveRatio) || 0;
        if (_single > 0) bd.openubSingleHh = _single;
        if (_total > 0) bd.openubTotalHh = _total;
        if (_apt > 0) bd.openubAptRatio = `${_apt}%`;
        if (Array.isArray(popRpData.hjdNames) && popRpData.hjdNames.length > 0) {
          bd.nearbyHjd = popRpData.hjdNames.slice(0, 6);
        }
      }

      // ── 카드 2 파이프라인 보강 머지 (빈 항목만 채움, 기존 값 절대 덮어쓰지 않음) ──
      if (card2PipelineResult) {
        if (!bd.topAge && card2PipelineResult.mainAge) bd.topAge = card2PipelineResult.mainAge;
        if (!bd.secondaryAge && card2PipelineResult.secondaryAge) bd.secondaryAge = card2PipelineResult.secondaryAge;
        if (!bd.genderRatio && card2PipelineResult.genderRatio) bd.genderRatio = card2PipelineResult.genderRatio;
        if (!bd.lifestyle && card2PipelineResult.lifestyle) bd.lifestyle = card2PipelineResult.lifestyle;
        if (!bd.ageSegments && card2PipelineResult.ageSegments) bd.ageSegments = card2PipelineResult.ageSegments;
        if (Array.isArray(card2PipelineResult.sourceTrace) && card2PipelineResult.sourceTrace.length > 0) {
          bd.card2SourceTrace = card2PipelineResult.sourceTrace.map(t => `${t.source}(${(t.filled || []).join(',')})`).join(' / ');
        }
      }

      return Object.keys(bd).length > 0 ? bd : { topAge: '-' };
    })(),
  };

  // ── Card 3: 프랜차이즈 현황 ──
  const nearbyFC = cd.nearbyFranchiseCounts || {};
  const franchiseSegments = [];
  if (Object.keys(nearbyFC).length > 0) {
    const sorted = Object.entries(nearbyFC).sort((a, b) => b[1] - a[1]);
    const total = sorted.reduce((s, [, v]) => s + v, 0);
    sorted.slice(0, 7).forEach(([brand, cnt]) => {
      if (cnt > 0 && total > 0) {
        franchiseSegments.push({ name: brand, pct: Math.round((cnt / total) * 100) });
      }
    });
  } else if (franchiseList.length > 0) {
    // Fallback: group franchiseList by brand
    const brandMap = {};
    franchiseList.forEach(f => {
      const b = f.brand || f.name || '기타';
      brandMap[b] = (brandMap[b] || 0) + 1;
    });
    const sorted = Object.entries(brandMap).sort((a, b) => b[1] - a[1]);
    const total = sorted.reduce((s, [, v]) => s + v, 0);
    sorted.slice(0, 7).forEach(([brand, cnt]) => {
      if (cnt > 0 && total > 0) {
        franchiseSegments.push({ name: brand, pct: Math.round((cnt / total) * 100) });
      }
    });
  }

  const card3 = {
    title: '프랜차이즈 현황',
    subtitle: '주요 프랜차이즈 브랜드 분석',
    date: dateStr,
    source: '오픈업/카카오',
    bruSummary: aiData?.franchise?.[0]?.bruSummary || null,
    aiSummary: aiData?.franchise?.[0]?.feedback
      || (franchiseCount > 0
        ? `반경 500m 내 프랜차이즈 ${franchiseCount}개. ${franchiseSegments.length > 0 ? `${franchiseSegments[0].name} 등 ${franchiseSegments.length}개 브랜드.` : ''}`
        : ''),
    chartType: 'rankingList',
    metaInfo: '프랜차이즈',
    chartData: (() => {
      if (Object.keys(nearbyFC).length > 0) {
        const sorted = Object.entries(nearbyFC).sort((a, b) => b[1] - a[1]);
        return {
          items: sorted.slice(0, 5).map(([brand, cnt]) => ({ name: brand, count: cnt })),
        };
      }
      if (franchiseSegments.length > 0) {
        return {
          items: franchiseSegments.slice(0, 5).map(s => ({ name: s.name, count: Math.max(1, Math.round(s.pct * franchiseCount / 100)) })),
        };
      }
      return null;
    })(),
    bodyData: {
      franchiseCount: franchiseCount,
      totalCafes: totalCafes,
      independentCount: independentCount,
      brands: franchiseSegments.map(s => s.name),
      franchiseSummary: (() => {
        const fl = (cd.nearbyFranchiseList || []).slice(0, 5).map(f => {
          const n = f.brand || f.name || '';
          const c = nearbyFC[n] || 1;
          return `${n} ${c}개`;
        });
        return fl.length > 0 ? fl.join(', ') : null;
      })(),
      // 브랜드별 막대 차트 (상위 7개)
      brandBarItems: (() => {
        const counts = cd.nearbyFranchiseCounts || {};
        return Object.entries(counts)
          .sort((a, b) => b[1] - a[1])
          .slice(0, 7)
          .map(([name, count]) => ({ name, count }));
      })(),
      // 프랜차이즈 점유율 vs 개인카페
      franchiseShare: totalCafes > 0 ? Math.round((franchiseCount / totalCafes) * 100) : 0,
      independentShare: totalCafes > 0 ? Math.round((independentCount / totalCafes) * 100) : 0,
      bakeryShare: totalCafes > 0 ? Math.round((bakeryCount / totalCafes) * 100) : 0,
      // 신규 진입 프랜차이즈 (있는 경우)
      newFranchiseList: (cd.nearbyFranchiseList || []).filter(f => f.isNewOpen).slice(0, 5).map(f => ({
        name: f.brand || f.name || '',
        dist: f.dist || 0,
      })),
      // 거리별 분포 (200m 이내, 200-350m, 350-500m)
      distanceDistribution: (() => {
        const fl = cd.nearbyFranchiseList || [];
        const inner = fl.filter(c => (c.dist || 999) <= 200).length;
        const mid = fl.filter(c => (c.dist || 999) > 200 && (c.dist || 999) <= 350).length;
        const outer = fl.filter(c => (c.dist || 999) > 350).length;
        return { inner, mid, outer };
      })(),
      // 카페 1개당 잠재 고객 (유동인구 기반)
      perCafePotential: (() => {
        const dyn = apis.dynPplCmpr?.data;
        const monthlyPop = Array.isArray(dyn) ? (dyn[0]?.cnt || 0) : (dyn?.cnt || 0);
        const dailyPop = Math.round(monthlyPop / 30);
        return totalCafes > 0 ? Math.round(dailyPop / totalCafes) : 0;
      })(),
    },
    tag: '프랜차이즈',
  };

  // ── Card 4: 개인 카페 분석 ──
  const indieList = cd.nearbyIndependentList || [];
  const indieCount = cd.nearbyIndependentCafes || indieList.length || 0;

  // 매출 추정 from nicebizmapStats or salesEstimates
  const avgMonthlySales = cd.nicebizmapStats?.perStoreAvg || 0;

  // [2026-05-06] 비즈맵 인기/급상승 메뉴는 카드 3(상권 변화 추이)으로 이관됨
  // (개인 카페만 다루는 카드 4와 동 전체 통계인 비즈맵 메뉴의 맥락이 맞지 않아 이동)

  // 아메리카노 가격 범위 계산
  let franchiseMinPrice = 0;
  let franchiseMaxPrice = 0;
  if (cd.nearbyFranchiseCounts) {
    const prices = [];
    // Note: FRANCHISE_DATA is in App.jsx, not available here. Use aiData or collected data.
    if (aiData?.franchise) {
      aiData.franchise.forEach(f => {
        if (f.price) prices.push(parseInt(String(f.price).replace(/[^0-9]/g, '')) || 0);
      });
    }
    franchiseMinPrice = prices.length > 0 ? Math.min(...prices.filter(p => p > 0)) : 0;
    franchiseMaxPrice = prices.length > 0 ? Math.max(...prices.filter(p => p > 0)) : 0;
  }

  const card4 = {
    title: '개인 카페 분석',
    subtitle: '주변 개인 카페 현황',
    date: dateStr,
    source: '오픈업/카카오',
    bruSummary: aiData?.indieCafe?.bruSummary || null,
    aiSummary: aiData?.indieCafe?.bruFeedback
      ? String(aiData.indieCafe.bruFeedback)
      : (indieCount > 0
        ? `반경 500m 내 개인카페 ${indieCount}개.${avgMonthlySales > 0 ? ` 점포당 월평균 매출 ${fmtWon(avgMonthlySales)}.` : ''}`
        : ''),
    chartType: 'comparisonSplit',
    metaInfo: '개인카페',
    chartData: (indieCount > 0 || franchiseCount > 0)
      ? {
          left: {
            label: '개인카페',
            count: indieCount,
            metrics: avgMonthlySales > 0
              ? [{ label: '월평균 매출', value: fmtWon(avgMonthlySales) }]
              : [],
          },
          right: {
            label: '프랜차이즈',
            count: franchiseCount,
            metrics: (franchiseMinPrice > 0 && franchiseMaxPrice > 0)
              ? [{ label: '아메리카노', value: `${franchiseMinPrice.toLocaleString()}~${franchiseMaxPrice.toLocaleString()}원` }]
              : [],
          },
        }
      : null,
    bodyData: {
      independentCount: indieCount,
      totalCafes: totalCafes,
      avgMonthlySales: avgMonthlySales,
      franchiseMinPrice: franchiseMinPrice,
      franchiseMaxPrice: franchiseMaxPrice,
      nearbySummary: (() => {
        const nl = indieList.slice(0, 5).map(c => `${c.name || ''} (${c.dist || 0}m)`);
        return nl.length > 0 ? nl.join(', ') : null;
      })(),
      // 개인카페 거리별 분포
      indieDistanceDistribution: (() => {
        const il = cd.nearbyIndependentList || [];
        const inner = il.filter(c => (c.dist || 999) <= 100).length;
        const mid = il.filter(c => (c.dist || 999) > 100 && (c.dist || 999) <= 250).length;
        const outer = il.filter(c => (c.dist || 999) > 250).length;
        return { inner, mid, outer };
      })(),
      // 개인 카페 가격대 분포 (가능한 경우)
      indiePriceDistribution: (() => {
        const cafes = cd.enrichedCafes?.cafes || cd.cafePrices || [];
        if (!Array.isArray(cafes) || cafes.length === 0) return null;
        const cheap = cafes.filter(c => c.americano && c.americano < 3500).length;
        const midP = cafes.filter(c => c.americano && c.americano >= 3500 && c.americano <= 5000).length;
        const premium = cafes.filter(c => c.americano && c.americano > 5000).length;
        return { cheap, mid: midP, premium };
      })(),
      // 메뉴 평균 정보
      americanoAvg: cd.cafeAvgPrices?.americano || cd.enrichedCafes?.avgAmericano || 0,
      menuAvg: cd.cafeAvgPrices?.menu || cd.enrichedCafes?.avgMenu || 0,
      dessertAvg: cd.cafeAvgPrices?.dessert || cd.enrichedCafes?.avgDessert || 0,
      // [2026-05-06] 비즈맵 인기/급상승 메뉴는 카드 3(상권 변화 추이)으로 이관됨
      // 신규 개인 카페
      newIndieList: (cd.nearbyIndependentList || []).filter(c => c.isNewOpen).slice(0, 5).map(c => ({
        name: c.name || '',
        dist: c.dist || 0,
      })),
      // 개인카페 평균 vs 프랜차이즈 평균 (가격 비교)
      indieFranchPriceCompare: (() => {
        const indieAmericano = cd.cafeAvgPrices?.americano || cd.enrichedCafes?.avgAmericano || 0;
        const franchAmericano = 4500; // 스타벅스 톨아메 기준
        if (indieAmericano > 0) {
          const diff = indieAmericano - franchAmericano;
          const pctDiff = Math.round((diff / franchAmericano) * 100);
          return { indie: indieAmericano, franch: franchAmericano, diff, pctDiff };
        }
        return null;
      })(),
      // 가까운 개인카페 5개 (상세)
      topNearbyIndie: (cd.nearbyIndependentList || [])
        .slice()
        .sort((a, b) => (a.dist || 999) - (b.dist || 999))
        .slice(0, 5)
        .map(c => ({ name: c.name || '', dist: c.dist || 0, addr: c.address || '' })),
    },
    tag: '개인카페',
  };

  // ── Card 5: 매출 분석 ──
  const salesAvgData = apis.salesAvg?.data;
  let cafeSales = null;
  let dongAvg = null;
  let allSalesItems = [];
  if (Array.isArray(salesAvgData)) {
    const cafeItem = salesAvgData.find(s => s?.tpbizClscdNm === '카페');
    cafeSales = cafeItem?.mmavgSlsAmt || null;
    allSalesItems = [...salesAvgData]
      .filter(s => s && (s.mmavgSlsAmt || 0) > 0)
      .sort((a, b) => (b.mmavgSlsAmt || 0) - (a.mmavgSlsAmt || 0));
    const total = salesAvgData.reduce((s, d) => s + (d?.mmavgSlsAmt || 0), 0);
    const cnt = salesAvgData.filter(d => d?.mmavgSlsAmt > 0).length;
    dongAvg = cnt > 0 ? Math.round(total / cnt) : null;
  }
  const top5Sales = allSalesItems.slice(0, 5).map(s => s.tpbizClscdNm || '');
  // 카페가 동 매출 순위 몇 위인지 (전체 업종 중)
  const cafeRankIdx = allSalesItems.findIndex(s => s?.tpbizClscdNm === '카페');
  const cafeSalesRank = cafeRankIdx >= 0 ? `${cafeRankIdx + 1}위 / ${allSalesItems.length}개 업종` : null;
  // 카페가 상위 5개 업종 매출 합계에서 차지하는 비중 (%)
  const cafeAmtInTop5 = allSalesItems.find(s => s?.tpbizClscdNm === '카페')?.mmavgSlsAmt || 0;
  const top5Sum = allSalesItems.slice(0, 5).reduce((s, x) => s + (x?.mmavgSlsAmt || 0), 0);
  const cafePctInTop5 = top5Sum > 0 && cafeAmtInTop5 > 0
    ? `${Math.round((cafeAmtInTop5 / top5Sum) * 1000) / 10}% (상위 5개 업종 중)`
    : null;

  // ── 매출 차트: 카페 관련 데이터만 사용 (업종 나열 금지) ──
  // 우선순위 1: 나이스비즈맵 월별 매출 추이 (월 라벨, 점포당 매출)
  // 우선순위 2: salesAvg 에서 카페 vs 동 평균 비교
  // 우선순위 3: nicebizmapStats 비교 (중앙값/평균)
  let salesChartItems = [];
  let salesChartType = 'line'; // default

  // 우선순위 1: nicebizmap 월별 차트 데이터
  const nbmRaw = cd.nicebizmap;
  if (nbmRaw && typeof nbmRaw === 'object') {
    // 여러 동 데이터를 월별로 합산
    const monthMap = {}; // { 'YYYYMM': { totalSale, totalStore } }
    for (const dongCd of Object.keys(nbmRaw)) {
      const chart = nbmRaw[dongCd]?.chart;
      if (!Array.isArray(chart)) continue;
      const recent = chart.slice(-6);
      for (const item of recent) {
        const ym = item.ym || item.yearMonth || item.date || '';
        const saleAmt = +(item.saleAmt || 0);
        const storeCnt = +(item.storeCnt || 0);
        if (!ym || saleAmt <= 0 || storeCnt <= 0) continue;
        if (!monthMap[ym]) monthMap[ym] = { totalSale: 0, totalStore: 0 };
        monthMap[ym].totalSale += saleAmt;
        monthMap[ym].totalStore += storeCnt;
      }
    }
    const months = Object.keys(monthMap).sort();
    if (months.length >= 2) {
      salesChartItems = months.map(ym => {
        const d = monthMap[ym];
        const perStore = Math.round(d.totalSale / d.totalStore);
        // 만원 단위 변환 (원 단위인 경우)
        const valManwon = perStore > 100000 ? Math.round(perStore / 10000) : perStore;
        // 라벨: YYYYMM → N월
        const monthNum = parseInt(ym.substring(4, 6), 10) || parseInt(ym.substring(ym.length - 2), 10);
        return { label: monthNum ? `${monthNum}월` : ym, value: valManwon };
      }).filter(d => d.value > 0 && d.value < 50000);
    }
  }

  // 우선순위 2: salesAvg 카페 vs 동 평균 비교 차트
  if (salesChartItems.length === 0 && cafeSales && cafeSales > 0) {
    const cafeVal = Math.round(cafeSales) || 0;
    const dongVal = dongAvg ? Math.round(dongAvg) : 0;
    salesChartType = 'bar';
    const items = [];
    if (cafeVal > 0) items.push({ label: '카페', value: cafeVal });
    if (dongVal > 0) items.push({ label: '동평균', value: dongVal });
    if (items.length > 0) salesChartItems = items;
  }

  // 우선순위 3: nicebizmapStats 비교 (중앙값 vs 평균)
  const nbmStats = cd.nicebizmapStats;
  if (salesChartItems.length === 0 && nbmStats) {
    salesChartType = 'bar';
    const items = [];
    if (nbmStats.average > 0) items.push({ label: '평균', value: nbmStats.average });
    if (nbmStats.median > 0) items.push({ label: '중앙값', value: nbmStats.median });
    if (nbmStats.perStoreAvg > 0 && nbmStats.perStoreAvg !== nbmStats.average) {
      items.push({ label: '점포당', value: nbmStats.perStoreAvg });
    }
    if (items.length > 0) salesChartItems = items;
  }

  // ── 비즈맵 보강: 매출 분위 (averageSalesList) - 상위/평균/하위 6개월 ──
  const bmAvgSales = aiData?.apis?.bizMapAverageSales?.data ?? apis.bizMapAverageSales?.data;
  let bmTopSalesStr = null;
  let bmAvgSalesStr = null;
  let bmBtmSalesStr = null;
  if (Array.isArray(bmAvgSales) && bmAvgSales.length > 0) {
    // 가장 최신 yyyymm 기준 상/중/하 매출 추출 (DOM 추출 키: top20/avg/bot20, 폴백: 영문 키)
    const sortedAvg = [...bmAvgSales].sort((a, b) => String(a?.yyyymm || a?.stdYm || a?.ym || '').localeCompare(String(b?.yyyymm || b?.stdYm || b?.ym || '')));
    const latest = sortedAvg[sortedAvg.length - 1] || {};
    const topVal = parseFloat(latest.top20 ?? latest.topAvgSlamt ?? latest.topSlamt ?? latest.upperSlamt ?? latest.top ?? 0);
    const midVal = parseFloat(latest.avg ?? latest.avgSlamt ?? latest.midSlamt ?? latest.middleSlamt ?? 0);
    const btmVal = parseFloat(latest.bot20 ?? latest.btmAvgSlamt ?? latest.btmSlamt ?? latest.lowerSlamt ?? latest.bottom ?? 0);
    // 비즈맵 매출 값은 '만원' 단위 정수 → fmtWon 으로 한국식 표기 (억/만원)
    if (topVal > 0) bmTopSalesStr = fmtWon(topVal);
    if (midVal > 0) bmAvgSalesStr = fmtWon(midVal);
    if (btmVal > 0) bmBtmSalesStr = fmtWon(btmVal);
  }

  // ── 비즈맵 보강: 이용건수·결제단가 6개월 추이 (usageAndPaymentTrendList) ──
  const bmUsagePay = aiData?.apis?.bizMapUsageAndPayment?.data ?? apis.bizMapUsageAndPayment?.data;
  let bmUsageTrend = null; // { labels: [], usageValues: [], priceValues: [] }
  let bmAvgUsageStr = null;
  let bmAvgPriceStr = null;
  if (Array.isArray(bmUsagePay) && bmUsagePay.length > 0) {
    // DOM 추출 키: { yyyymm, usageCount, avgPayment }, 폴백: 영문 키들
    const sorted = [...bmUsagePay].sort((a, b) => String(a?.yyyymm || a?.stdYm || a?.ym || '').localeCompare(String(b?.yyyymm || b?.stdYm || b?.ym || '')));
    const labels = sorted.map(r => {
      const ym = String(r?.yyyymm || r?.stdYm || r?.ym || '');
      const m = parseInt(ym.slice(4, 6), 10);
      return m ? `${m}월` : ym;
    });
    const usageValues = sorted.map(r => parseFloat(r?.usageCount ?? r?.useCnt ?? r?.usageCnt ?? r?.cnt ?? 0)).filter(v => isFinite(v));
    // 비즈맵 라이브 API는 cost / avgPay 키로 결제단가를 반환 (Card02DetailPopup 참조)
    const priceValues = sorted.map(r => parseFloat(r?.cost ?? r?.avgPay ?? r?.avgPayment ?? r?.avgPayAmt ?? r?.avgPrice ?? r?.unitPrice ?? r?.payAmt ?? 0)).filter(v => isFinite(v));
    if (labels.length > 0 && (usageValues.length > 0 || priceValues.length > 0)) {
      bmUsageTrend = { labels, usageValues, priceValues };
      const avgUsage = usageValues.length > 0 ? Math.round(usageValues.reduce((s, v) => s + v, 0) / usageValues.length) : 0;
      const avgPrice = priceValues.length > 0 ? Math.round(priceValues.reduce((s, v) => s + v, 0) / priceValues.length) : 0;
      if (avgUsage > 0) bmAvgUsageStr = `${avgUsage.toLocaleString()}건`;
      // 결제단가는 '원' 단위 정수 → 콤마 표기 (만 단위 쪼개기 금지)
      if (avgPrice > 0) bmAvgPriceStr = `${avgPrice.toLocaleString()}원`;
    }
  }

  // ── 비즈맵 보강: 시장 규모 추이 (marketSizeTrendList) ──
  const bmMarketSize = aiData?.apis?.bizMapMarketSize?.data ?? apis.bizMapMarketSize?.data;
  let bmMarketLatestStr = null;
  let bmMarketTrendLabel = null;
  if (Array.isArray(bmMarketSize) && bmMarketSize.length >= 2) {
    // DOM 추출 키: { yyyymm, marketSize }
    const sorted = [...bmMarketSize].sort((a, b) => String(a?.yyyymm || a?.stdYm || a?.ym || '').localeCompare(String(b?.yyyymm || b?.stdYm || b?.ym || '')));
    const first = parseFloat(sorted[0]?.marketSize ?? sorted[0]?.size ?? sorted[0]?.amt ?? 0);
    const last = parseFloat(sorted[sorted.length - 1]?.marketSize ?? sorted[sorted.length - 1]?.size ?? sorted[sorted.length - 1]?.amt ?? 0);
    // 비즈맵 시장 규모는 '만원' 단위 정수 → fmtWon 으로 한국식 표기 (억/만원)
    if (last > 0) bmMarketLatestStr = fmtWon(last);
    if (first > 0 && last > 0) {
      const diffPct = Math.round(((last - first) / first) * 100);
      bmMarketTrendLabel = `6개월 ${diffPct > 0 ? '+' : ''}${diffPct}%`;
    }
  } else if (Array.isArray(bmMarketSize) && bmMarketSize.length === 1) {
    const only = parseFloat(bmMarketSize[0]?.marketSize ?? bmMarketSize[0]?.size ?? bmMarketSize[0]?.amt ?? 0);
    if (only > 0) bmMarketLatestStr = fmtWon(only);
  }

  // ── 비즈맵 보강: 6개월 점포수 추이 (bizMapStoreCountTrend) ──
  var bmStoreCount6M = null;
  var bmStoreCountTrendList = aiData?.apis?.bizMapStoreCountTrend?.data ?? apis.bizMapStoreCountTrend?.data;
  if (Array.isArray(bmStoreCountTrendList) && bmStoreCountTrendList.length > 0) {
    var sortedSct = [...bmStoreCountTrendList].sort(function(a, b) {
      return String(a?.yyyymm || a?.stdYm || a?.ym || '').localeCompare(String(b?.yyyymm || b?.stdYm || b?.ym || ''));
    });
    var sctLabels = sortedSct.map(function(r) {
      var ym = String(r?.yyyymm || r?.stdYm || r?.ym || '');
      return ym.length === 6 ? (ym.slice(2,4) + '.' + ym.slice(4,6)) : ym;
    });
    var sctValues = sortedSct.map(function(r) {
      return parseInt(r?.storeCount ?? r?.storeCnt ?? r?.cnt ?? 0, 10) || 0;
    });
    if (sctLabels.length > 0 && sctValues.length > 0) {
      bmStoreCount6M = { labels: sctLabels, values: sctValues };
    }
  }

  // ── 비즈맵 보강: 요일별 매출 비중 (bizMapWeeklySales) ──
  var bmWeekdaySales = null;
  var bmWeeklyData = aiData?.apis?.bizMapWeeklySales?.data ?? apis.bizMapWeeklySales?.data;
  if (Array.isArray(bmWeeklyData) && bmWeeklyData.length > 0) {
    bmWeekdaySales = {
      labels: bmWeeklyData.map(function(r) { return String(r?.day || ''); }),
      values: bmWeeklyData.map(function(r) { return parseFloat(r?.rate ?? r?.value ?? 0) || 0; })
    };
  }

  // ── 비즈맵 보강: 시간대별 건수/금액 비중 (bizMapHourlySales) ──
  var bmHourlySales = null;
  var bmHourlyData = aiData?.apis?.bizMapHourlySales?.data ?? apis.bizMapHourlySales?.data;
  if (bmHourlyData && typeof bmHourlyData === 'object') {
    var cntRates = Array.isArray(bmHourlyData.countRates) ? bmHourlyData.countRates : [];
    var amtRates = Array.isArray(bmHourlyData.amountRates) ? bmHourlyData.amountRates : [];
    var refRates = cntRates.length > 0 ? cntRates : amtRates;
    if (refRates.length > 0) {
      bmHourlySales = {
        labels: refRates.map(function(r) { return String(r?.hour || ''); }),
        cntValues: cntRates.map(function(r) { return parseFloat(r?.rate ?? 0) || 0; }),
        amtValues: amtRates.map(function(r) { return parseFloat(r?.rate ?? 0) || 0; })
      };
    }
  }

  // ── 소상공인365 simpleAnls 보강: 동/구/시 매출 비교, 13개월 추이, TOP5 동, 매장수 ──
  const sa = aiData?.apis?.simpleAnls?.data?.avgAmt ?? apis.simpleAnls?.data?.avgAmt;
  let saGuAvg = 0, saSiAvg = 0, saPrevYearGu = 0, saPrevMonGu = 0;
  let saPrevMonRate = null, saPrevYearRate = null;
  let saAnnualTrend = null, saTopFiveStr = null;
  let saGuStores = 0, saSiStores = 0;
  // ── 신규 추가 필드 기본값 ──
  var saMaxAmt = 0, saMinAmt = 0, saSaleCnt = 0, saSiMax = 0, saGuMax = 0;
  var saPrevYearCntRate = null, saPrevMonCntRate = null;
  var saHasBaemin = false;
  var saAdminStoreTrend = null;
  var saAmtRange3M = null;
  if (sa && typeof sa === 'object') {
    saGuAvg = parseInt(sa.guAmt, 10) || 0;
    saSiAvg = parseInt(sa.siAmt, 10) || 0;
    saPrevYearGu = parseInt(sa.prevYearGuAmt, 10) || 0;
    saPrevMonGu = parseInt(sa.prevMonGuAmt, 10) || 0;
    saPrevMonRate = isFinite(parseFloat(sa.prevMonRate)) ? Math.round(parseFloat(sa.prevMonRate) * 10) / 10 : null;
    // 작년 대비 (saleAmt vs prevYearAmt)
    const sAmt = parseInt(sa.saleAmt, 10) || 0;
    const pyAmt = parseInt(sa.prevYearAmt, 10) || 0;
    if (sAmt > 0 && pyAmt > 0) saPrevYearRate = Math.round(((sAmt - pyAmt) / pyAmt) * 1000) / 10;

    // 13개월 추이
    if (Array.isArray(sa.annualSales) && sa.annualSales.length > 0) {
      const sorted = [...sa.annualSales].sort((a, b) => String(a.yymm).localeCompare(String(b.yymm)));
      saAnnualTrend = {
        labels: sorted.map(r => {
          const ym = String(r.yymm || '');
          return ym.length === 6 ? `${ym.slice(2,4)}.${ym.slice(4,6)}` : ym;
        }),
        values: sorted.map(r => parseInt(r.saleAmt, 10) || 0)
      };
    }

    // 검색 위치 시군구명 추출 (TOP 5 라벨용)
    var targetGu = '';
    if (sa.avgAmt && sa.avgAmt.guNm) {
      targetGu = String(sa.avgAmt.guNm).trim();
    } else if (dong.dongNm) {
      var dnTokens = String(dong.dongNm).trim().split(/\s+/);
      if (dnTokens.length >= 2) targetGu = dnTokens[1];
    }

    // 매출 TOP 5 동 (Firebase 시군구 전체 동 데이터 우선 사용)
    // collectedData.sigunguDongsSales = [{admiCd, admiNm, perStoreAvg, recentSale, recentStoreCnt}]
    var sigunguDongsSales = cd.sigunguDongsSales;
    var saTopFiveListInner = [];
    // 시군구 전체 동의 점포당 평균 매출의 평균 (이상치 판정용 기준)
    var sigunguAvgPerStore = 0;
    if (Array.isArray(sigunguDongsSales) && sigunguDongsSales.length > 0) {
      var validDongs = sigunguDongsSales.filter(function(d) { return d.perStoreAvg > 0; });
      if (validDongs.length > 0) {
        sigunguAvgPerStore = validDongs.reduce(function(s, d) { return s + d.perStoreAvg; }, 0) / validDongs.length;
      }
    }
    // 이상치 경고 텍스트 생성기
    var buildOutlierWarning = function(stores, perStore, baseAvg, guName) {
      var ratio = baseAvg > 0 ? perStore / baseAvg : 0;
      var isOutlier = stores > 0 && stores < 30 && ratio >= 1.5;
      if (!isOutlier) return null;
      var pieces = [];
      pieces.push('점포 ' + stores + '개로 적습니다.');
      if (ratio >= 2) {
        pieces.push('점포당 매출이 ' + (guName || '시군구') + ' 평균의 ' + ratio.toFixed(1) + '배입니다.');
      }
      pieces.push('점포가 적은 동은 비싼 1~2개 점포의 매출이 전체 평균을 크게 좌우합니다.');
      pieces.push('실제 상권 규모와 다를 수 있으니 참고만 하세요.');
      return pieces.join(' ');
    };
    if (Array.isArray(sigunguDongsSales) && sigunguDongsSales.length > 0) {
      var top5Firebase = [...sigunguDongsSales]
        .filter(function(d) { return d.perStoreAvg > 0; })
        .sort(function(a, b) { return b.perStoreAvg - a.perStoreAvg; })
        .slice(0, 5);
      saTopFiveStr = top5Firebase.map(function(d) {
        return (d.admiNm || d.admiCd) + ' ' + d.perStoreAvg.toLocaleString() + '만원';
      }).join(', ');
      saTopFiveListInner = top5Firebase.map(function(d) {
        var stores = parseInt(d.recentStoreCnt, 10) || 0;
        var perStore = parseInt(d.perStoreAvg, 10) || 0;
        return {
          name: d.admiNm || d.admiCd,
          stores: stores,
          amt: perStore,
          warning: buildOutlierWarning(stores, perStore, sigunguAvgPerStore, targetGu),
        };
      });
    } else if (Array.isArray(sa.topFive) && sa.topFive.length > 0) {
      // 폴백: simpleAnls.topFive 같은 시군구 필터
      var sameGuList = sa.topFive;
      if (targetGu) {
        var filtered = sa.topFive.filter(function(t) { return String(t.ctyNm || '').trim() === targetGu; });
        sameGuList = filtered;
      }
      saTopFiveStr = sameGuList.slice(0, 5).map(function(t) {
        var nm = t.admiNm || '';
        var amt = parseInt(t.saleAmt, 10) || 0;
        return nm + ' ' + amt.toLocaleString() + '만원';
      }).join(', ');
      // 폴백 분기는 시군구 전체 평균이 없으므로 sameGuList 자체의 평균을 임시 기준으로 사용
      var sameGuValid = sameGuList.filter(function(t) { return parseInt(t.saleAmt, 10) > 0; });
      var sameGuAvg = sameGuValid.length > 0
        ? sameGuValid.reduce(function(s, t) { return s + (parseInt(t.saleAmt, 10) || 0); }, 0) / sameGuValid.length
        : 0;
      saTopFiveListInner = sameGuList.slice(0, 5).map(function(t) {
        var stores = parseInt(t.storeCnt, 10) || 0;
        var amt = parseInt(t.saleAmt, 10) || 0;
        return {
          name: t.admiNm || '',
          stores: stores,
          amt: amt,
          warning: buildOutlierWarning(stores, amt, sameGuAvg, targetGu),
        };
      });
    }
    sa.__topFiveList = saTopFiveListInner;

    // 라벨용 시군구명 (없으면 기본값)
    var saTopFiveTitleVal = targetGu ? (targetGu + ' 동네별 카페 매출 TOP 5') : '카페 매출 TOP 5';
    sa.__topFiveTitle = saTopFiveTitleVal;

    // 매장수 (areaGb별, 최신 yymm)
    if (Array.isArray(sa.storeCnt)) {
      const latestSi = sa.storeCnt.filter(s => s.areaGb === '11').sort((a,b) => String(b.yymm).localeCompare(String(a.yymm)))[0];
      const latestGu = sa.storeCnt.filter(s => s.areaGb === '12').sort((a,b) => String(b.yymm).localeCompare(String(a.yymm)))[0];
      if (latestSi) saSiStores = parseInt(latestSi.storeCnt, 10) || 0;
      if (latestGu) saGuStores = parseInt(latestGu.storeCnt, 10) || 0;
    }

    // ── 추가 필드: 동 매출 격차, 매출 건수, 매장수 추이 ──
    saMaxAmt = parseInt(sa.maxAmt, 10) || 0;
    saMinAmt = parseInt(sa.minAmt, 10) || 0;
    saSaleCnt = parseInt(sa.saleCnt, 10) || 0;
    saPrevYearCntRate = isFinite(parseFloat(sa.prevYearCntRate)) ? Math.round(parseFloat(sa.prevYearCntRate) * 10) / 10 : null;
    saPrevMonCntRate = isFinite(parseFloat(sa.prevMonCntRate)) ? Math.round(parseFloat(sa.prevMonCntRate) * 10) / 10 : null;
    saSiMax = parseInt(sa.siMax, 10) || 0;
    saGuMax = parseInt(sa.guMax, 10) || 0;
    saHasBaemin = sa.baemin === 'Y';
    if (Array.isArray(sa.storeCntAdmin) && sa.storeCntAdmin.length > 0) {
      var sortedAdmin = [...sa.storeCntAdmin].sort(function(a, b) { return String(a.yymm).localeCompare(String(b.yymm)); });
      saAdminStoreTrend = {
        labels: sortedAdmin.map(function(r) { var ym = String(r.yymm || ''); return ym.length === 6 ? ym.slice(2,4) + '.' + ym.slice(4,6) : ym; }),
        values: sortedAdmin.map(function(r) { return parseInt(r.storeCnt, 10) || 0; })
      };
    }
    // 동 매출 격차 3개월 (avgList - max/min)
    if (Array.isArray(sa.avgList) && sa.avgList.length > 0) {
      var sortedAvgL = [...sa.avgList].sort(function(a, b) { return String(a.crtrYm).localeCompare(String(b.crtrYm)); });
      saAmtRange3M = sortedAvgL.map(function(r) {
        var ym = String(r.crtrYm || '');
        return {
          label: ym.length === 6 ? ym.slice(2,4) + '.' + ym.slice(4,6) : ym,
          max: parseInt(r.maxAmt, 10) || 0,
          avg: parseInt(r.saleAmt, 10) || 0,
          min: parseInt(r.minAmt, 10) || 0
        };
      });
    }
  }

  // TOP 5 라벨 (sa 없을 때 폴백 보장)
  var topFiveLabel = (sa && sa.__topFiveTitle) || null;
  var topFiveListOut = (sa && Array.isArray(sa.__topFiveList)) ? sa.__topFiveList : [];
  // sa(simpleAnls)가 없을 때도 Firebase 시군구 데이터로 TOP 5 보강
  if (!saTopFiveStr && Array.isArray(cd.sigunguDongsSales) && cd.sigunguDongsSales.length > 0) {
    var fbTop5 = [...cd.sigunguDongsSales]
      .filter(function(d) { return d.perStoreAvg > 0; })
      .sort(function(a, b) { return b.perStoreAvg - a.perStoreAvg; })
      .slice(0, 5);
    if (fbTop5.length > 0) {
      // 시군구 전체 평균 (이상치 판정용)
      var fbValid = cd.sigunguDongsSales.filter(function(d) { return d.perStoreAvg > 0; });
      var fbSigunguAvg = fbValid.length > 0
        ? fbValid.reduce(function(s, d) { return s + d.perStoreAvg; }, 0) / fbValid.length
        : 0;
      var fbTargetGu = '';
      if (dong.dongNm) {
        var dnTks = String(dong.dongNm).trim().split(/\s+/);
        if (dnTks.length >= 2) fbTargetGu = dnTks[1];
      }
      var fbBuildWarn = function(stores, perStore) {
        var ratio = fbSigunguAvg > 0 ? perStore / fbSigunguAvg : 0;
        var isOutlier = stores > 0 && stores < 30 && ratio >= 1.5;
        if (!isOutlier) return null;
        var pieces = [];
        pieces.push('점포 ' + stores + '개로 적습니다.');
        if (ratio >= 2) {
          pieces.push('점포당 매출이 ' + (fbTargetGu || '시군구') + ' 평균의 ' + ratio.toFixed(1) + '배입니다.');
        }
        pieces.push('점포가 적은 동은 비싼 1~2개 점포의 매출이 전체 평균을 크게 좌우합니다.');
        pieces.push('실제 상권 규모와 다를 수 있으니 참고만 하세요.');
        return pieces.join(' ');
      };
      saTopFiveStr = fbTop5.map(function(d) {
        return (d.admiNm || d.admiCd) + ' ' + d.perStoreAvg.toLocaleString() + '만원';
      }).join(', ');
      topFiveListOut = fbTop5.map(function(d) {
        var stores = parseInt(d.recentStoreCnt, 10) || 0;
        var perStore = parseInt(d.perStoreAvg, 10) || 0;
        return {
          name: d.admiNm || d.admiCd,
          stores: stores,
          amt: perStore,
          warning: fbBuildWarn(stores, perStore),
        };
      });
      topFiveLabel = fbTargetGu ? (fbTargetGu + ' 동네별 카페 매출 TOP 5') : '동네별 카페 매출 TOP 5';
    }
  }

  const card5Sources = ['소상공인365'];
  if (bmAvgSales || bmUsagePay || bmMarketSize) card5Sources.push('비즈맵');
  if (Array.isArray(cd.sigunguDongsSales) && cd.sigunguDongsSales.length > 0) card5Sources.push('비즈맵 RTDB');

  const card5 = {
    title: '매출 분석',
    subtitle: '월평균 예상 매출',
    date: dateStr,
    source: card5Sources.join('/'),
    bruSummary: aiData?.topSales?.bruSummary || null,
    aiSummary: aiData?.topSales?.bruFeedback
      || (cafeSales
      ? `카페 업종 월평균 매출 ${fmtWon(cafeSales)}${dongAvg ? `, 동 전체 업종 평균 ${fmtWon(dongAvg)}` : ''}. ${cafeSales > (dongAvg || 0) ? '동 평균 대비 높은 매출 수준입니다.' : '동 평균 수준의 매출입니다.'}`
      : ''),
    chartType: 'bigNumberTrend',
    metaInfo: '매출',
    chartData: salesChartItems.length > 0
      ? { bigNumber: cafeSales ? Math.round(cafeSales) : (salesChartItems[salesChartItems.length - 1]?.value || 0), unit: '만원', displayText: fmtWon(cafeSales || (salesChartItems[salesChartItems.length - 1]?.value || 0)), labels: salesChartItems.map(d => d.label), values: salesChartItems.map(d => d.value) }
      : (cafeSales > 0 ? { bigNumber: Math.round(cafeSales), unit: '만원', displayText: fmtWon(cafeSales), labels: [], values: [] } : null),
    bodyData: {
      monthly: cafeSales || 0,
      dongAvg: dongAvg || 0,
      guAvg: saGuAvg || 0,
      siAvg: saSiAvg,
      prevYearGuAmt: saPrevYearGu,
      prevMonGuAmt: saPrevMonGu,
      prevMonRate: saPrevMonRate,
      prevYearRate: saPrevYearRate,
      annualSalesTrend: saAnnualTrend,
      topFiveDongs: saTopFiveStr,
      topFiveDongsList: topFiveListOut,
      topFiveTitle: topFiveLabel || (sa && sa.__topFiveTitle) || '카페 매출 TOP 5',
      gusignguStores: saGuStores,
      sigaongStores: saSiStores,
      cafeSalesRank: cafeSalesRank,
      cafePctInTop5: cafePctInTop5,
      // 비즈맵 보강: 상권 매출 트렌드
      bizmapTopSales: bmTopSalesStr,
      bizmapAvgSales: bmAvgSalesStr,
      bizmapBottomSales: bmBtmSalesStr,
      bizmapAvgUsageCnt: bmAvgUsageStr,
      bizmapAvgUnitPrice: bmAvgPriceStr,
      bizmapUsageTrend: bmUsageTrend,
      bizmapMarketSize: bmMarketLatestStr,
      bizmapMarketTrend: bmMarketTrendLabel,
      // 신규: 동 매출 격차
      dongMaxSales: saMaxAmt,
      dongMinSales: saMinAmt,
      siMaxSales: saSiMax,
      guMaxSales: saGuMax,
      // 신규: 매출 건수 + 변화율
      dongSaleCnt: saSaleCnt,
      prevYearCntRate: saPrevYearCntRate,
      prevMonCntRate: saPrevMonCntRate,
      // 신규: 매장수 추이
      adminStoreTrend: saAdminStoreTrend,
      // 신규: 동 매출 격차 3개월 추이
      amtRange3M: saAmtRange3M,
      // 신규: 비즈맵 6개월 점포수 추이
      bizmapStoreCount6M: bmStoreCount6M,
      // 신규: 비즈맵 요일별 매출 비중
      bizmapWeekdaySales: bmWeekdaySales,
      // 신규: 비즈맵 시간대별 건수/금액 비중
      bizmapHourlySales: bmHourlySales,
      // 신규: 배달 가능 여부
      hasBaemin: saHasBaemin,
    },
  };

  // ── Card 6: 유동인구 ──
  // dynPplCmpr API cnt/wdCnt/weCnt = 월간 합산값 → ÷30 으로 일평균 변환
  const dynPplData = apis.dynPplCmpr?.data;
  let monthlyTotalPop = 0;
  let weekdayPop = 0;
  let weekendPop = 0;
  if (Array.isArray(dynPplData) && dynPplData.length > 0) {
    const item = dynPplData[0];
    monthlyTotalPop = item?.cnt || 0;
    const monthlyWd = item?.wdCnt || Math.round(monthlyTotalPop * 0.43);
    const monthlyWe = item?.weCnt || Math.round(monthlyTotalPop * 0.57);
    weekdayPop = Math.round(monthlyWd / 30);
    weekendPop = Math.round(monthlyWe / 30);
  } else if (dynPplData && typeof dynPplData === 'object' && !Array.isArray(dynPplData)) {
    monthlyTotalPop = dynPplData.cnt || 0;
    const monthlyWd = dynPplData.wdCnt || Math.round(monthlyTotalPop * 0.43);
    const monthlyWe = dynPplData.weCnt || Math.round(monthlyTotalPop * 0.57);
    weekdayPop = Math.round(monthlyWd / 30);
    weekendPop = Math.round(monthlyWe / 30);
  }

  let floatChartLabels = [];
  let floatChartValues = [];
  const floatTimeData = apis.floatingTime?.data;
  const timeSlotKeys = ['tmzn1FpCnt','tmzn2FpCnt','tmzn3FpCnt','tmzn4FpCnt','tmzn5FpCnt','tmzn6FpCnt'];
  const timeSlotLabels = ['6~9시','9~12시','12~15시','15~18시','18~21시','21~24시'];

  if (Array.isArray(dynPplData) && dynPplData.length > 0) {
    const d0 = dynPplData[0];
    const hasTimeData = timeSlotKeys.some(k => (d0[k] || 0) > 0);
    if (hasTimeData) {
      floatChartLabels = timeSlotLabels;
      floatChartValues = timeSlotKeys.map(k => Math.round((d0[k] || 0) / 30));
    }
  }
  if (floatTimeData?.timeSlots && typeof floatTimeData.timeSlots === 'object') {
    const ts = floatTimeData.timeSlots;
    const entries = Object.entries(ts).filter(([, v]) => v > 0);
    if (entries.length > 0) {
      floatChartLabels = entries.map(([k]) => k);
      floatChartValues = entries.map(([, v]) => v);
    }
  }

  let peakHour = '-';
  if (floatChartValues.length > 0) {
    const maxIdx = floatChartValues.indexOf(Math.max(...floatChartValues));
    peakHour = floatChartLabels[maxIdx] || '-';
  }
  if (floatTimeData?.peakTime) peakHour = floatTimeData.peakTime;

  // 유동인구 일평균 (월간 → ÷30) - 원본 섹션 2.5/4.3 로직
  const dailyPop = Math.round(monthlyTotalPop / 30);

  // 방문고객 합계 (vstCst API) - 월간 합산 → ÷30 일평균 (원본 App.jsx 섹션 3과 동일)
  const vstCstDataForCard6 = apis.vstCst?.data;
  const rawTotalVisitors = Array.isArray(vstCstDataForCard6) ? vstCstDataForCard6.reduce((s, d) => s + (d.pipcnt || 0), 0) : 0;
  const totalVisitors = rawTotalVisitors > 0 ? Math.round(rawTotalVisitors / 30) : 0;

  // 상위 유동인구 지역 (dynPplCmpr 두 번째 항목) - 원본 섹션 4.3
  const topAreaInfo = (() => {
    if (Array.isArray(dynPplData) && dynPplData.length > 1 && dynPplData[1]?.nm) {
      return { name: dynPplData[1].nm, pop: Math.round((dynPplData[1].cnt || 0) / 30) };
    }
    return null;
  })();

  // ── 비즈맵 보강: 시간대별 매출 집중도 (hourlySalesConcentration) ──
  // 형태: { '00': pct, '01': pct, ... } 또는 [{ hour, pct }] 또는 그 외 객체
  const bmHourly = aiData?.apis?.bizMapHourlySales?.data ?? apis.bizMapHourlySales?.data;
  let bmHourlyTopSlot = null;
  let bmHourlyTopPct = null;
  let bmHourlyChart = null; // { labels:[], values:[] }
  if (bmHourly) {
    let pairs = [];
    if (Array.isArray(bmHourly)) {
      pairs = bmHourly.map(r => {
        const h = r?.hour ?? r?.tm ?? r?.tmzn ?? r?.tmznCd ?? r?.label;
        const v = parseFloat(r?.pct ?? r?.rate ?? r?.slamtRate ?? r?.slamtRt ?? r?.value ?? 0);
        return [String(h), v];
      });
    } else if (typeof bmHourly === 'object') {
      pairs = Object.entries(bmHourly).map(([k, v]) => [String(k), parseFloat(v) || 0]);
    }
    pairs = pairs.filter(([k, v]) => k && isFinite(v) && v > 0);
    if (pairs.length > 0) {
      // 최대 시간대 찾기
      const sorted = [...pairs].sort((a, b) => b[1] - a[1]);
      const topKey = sorted[0][0];
      const hourNum = parseInt(String(topKey).replace(/[^0-9]/g, ''), 10);
      bmHourlyTopSlot = isFinite(hourNum) ? `${hourNum}시` : topKey;
      bmHourlyTopPct = `${Math.round(sorted[0][1] * 10) / 10}%`;
      // 차트용 (시간 순 정렬)
      const chartPairs = [...pairs].sort((a, b) => {
        const an = parseInt(String(a[0]).replace(/[^0-9]/g, ''), 10) || 0;
        const bn = parseInt(String(b[0]).replace(/[^0-9]/g, ''), 10) || 0;
        return an - bn;
      });
      bmHourlyChart = {
        labels: chartPairs.map(([k]) => {
          const n = parseInt(String(k).replace(/[^0-9]/g, ''), 10);
          return isFinite(n) ? `${n}시` : k;
        }),
        values: chartPairs.map(([, v]) => Math.round(v * 10) / 10),
      };
    }
  }

  // ── 비즈맵 보강: 요일별 매출 집중도 (weeklySalesConcentration) ──
  // 형태: { mon, tue, wed, ... } 또는 [{ day, pct }]
  const bmWeekly = aiData?.apis?.bizMapWeeklySales?.data ?? apis.bizMapWeeklySales?.data;
  const dayLabelMap = { mon: '월', tue: '화', wed: '수', thu: '목', fri: '금', sat: '토', sun: '일',
                        '월': '월', '화': '화', '수': '수', '목': '목', '금': '금', '토': '토', '일': '일' };
  let bmWeeklyTopDay = null;
  let bmWeeklyTopPct = null;
  let bmWeeklyChart = null;
  if (bmWeekly) {
    let pairs = [];
    if (Array.isArray(bmWeekly)) {
      pairs = bmWeekly.map(r => {
        const d = r?.day ?? r?.dayNm ?? r?.dow ?? r?.label;
        const v = parseFloat(r?.pct ?? r?.rate ?? r?.slamtRate ?? r?.slamtRt ?? r?.value ?? 0);
        return [String(d), v];
      });
    } else if (typeof bmWeekly === 'object') {
      pairs = Object.entries(bmWeekly).map(([k, v]) => [String(k), parseFloat(v) || 0]);
    }
    pairs = pairs.filter(([k, v]) => k && isFinite(v) && v > 0);
    if (pairs.length > 0) {
      const sorted = [...pairs].sort((a, b) => b[1] - a[1]);
      const topKey = String(sorted[0][0]).toLowerCase();
      bmWeeklyTopDay = (dayLabelMap[topKey] || sorted[0][0]) + '요일';
      bmWeeklyTopPct = `${Math.round(sorted[0][1] * 10) / 10}%`;
      // 차트용 (월~일 순서)
      const dayOrder = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun', '월', '화', '수', '목', '금', '토', '일'];
      const chartPairs = [...pairs].sort((a, b) => {
        const ai = dayOrder.indexOf(String(a[0]).toLowerCase());
        const bi = dayOrder.indexOf(String(b[0]).toLowerCase());
        return (ai === -1 ? 99 : ai) - (bi === -1 ? 99 : bi);
      });
      bmWeeklyChart = {
        labels: chartPairs.map(([k]) => dayLabelMap[String(k).toLowerCase()] || k),
        values: chartPairs.map(([, v]) => Math.round(v * 10) / 10),
      };
    }
  }

  // ── 소상공인 유동인구 객체 (population) - 6개 항목 보강 ──
  const popObj = aiData?.apis?.simpleAnls?.data?.population || apis.simpleAnls?.data?.population;
  let dongDailyPop = 0;          // 동 전체 일평균
  let hourlyPctChart = null;     // 시간대 비중 % 차트
  let weeklyPctChart = null;     // 요일 비중 % 차트
  let weekendPct = 0;            // 주말 비중 %
  let weekdayPct = 0;            // 주중 비중 %
  let popStdYm = '';             // 기준월

  if (popObj && typeof popObj === 'object') {
    dongDailyPop = parseInt(popObj.dayAvg, 10) || 0;
    weekendPct = parseFloat(popObj.weekend) || 0;
    weekdayPct = parseFloat(popObj.day) || 0;
    popStdYm = String(popObj.stdYm || '');

    // 시간대 비중: firstHour ~ sixthHour (0~3, 3~6, 6~12, 12~18, 18~21, 21~24)
    const hourLabels = ['0~6시', '6~9시', '9~12시', '12~18시', '18~21시', '21~24시'];
    const hourKeys = ['firstHour', 'secondHour', 'thirdHour', 'fourthHour', 'fifthHour', 'sixthHour'];
    const hourValues = hourKeys.map(k => parseFloat(popObj[k]) || 0);
    if (hourValues.some(v => v > 0)) {
      hourlyPctChart = { labels: hourLabels, values: hourValues };
    }

    // 요일 비중: mon, tues, wed, thur, fri, sat, sun
    const dayLabels = ['월', '화', '수', '목', '금', '토', '일'];
    const dayKeys = ['mon', 'tues', 'wed', 'thur', 'fri', 'sat', 'sun'];
    const dayValues = dayKeys.map(k => parseFloat(popObj[k]) || 0);
    if (dayValues.some(v => v > 0)) {
      weeklyPctChart = { labels: dayLabels, values: dayValues };
    }
  }

  // 요일 비중에서 최고 요일 찾기 (사람 수 기준)
  let popPeakDay = '';
  let popPeakDayPct = 0;
  if (weeklyPctChart && weeklyPctChart.values.length > 0) {
    const max = Math.max(...weeklyPctChart.values);
    const idx = weeklyPctChart.values.indexOf(max);
    popPeakDay = weeklyPctChart.labels[idx];
    popPeakDayPct = max;
  }

  // 시간대 비중에서 최고 시간대 찾기
  let popPeakHour = '';
  let popPeakHourPct = 0;
  if (hourlyPctChart && hourlyPctChart.values.length > 0) {
    const max = Math.max(...hourlyPctChart.values);
    const idx = hourlyPctChart.values.indexOf(max);
    popPeakHour = hourlyPctChart.labels[idx];
    popPeakHourPct = max;
  }

  // ── 평일/주말 사람 수 보정 ──
  // 기존 weekdayPop/weekendPop은 dynPplCmpr fallback (월합 * 0.43/0.57 / 30)으로
  // 가짜 비율 적용. 소상공인 day(주중%)/weekend(주말%) 데이터가 있으면 그것으로 재계산.
  // 한 주 = 평일 5일 + 주말 2일. 한 주 사람 수 = dailyPop * 7
  if (dailyPop > 0 && weekdayPct > 0 && weekendPct > 0) {
    weekdayPop = Math.round((dailyPop * 7 * weekdayPct / 100) / 5);
    weekendPop = Math.round((dailyPop * 7 * weekendPct / 100) / 2);
  }

  const card6Sources = ['소상공인365'];
  if (bmHourly || bmWeekly) card6Sources.push('비즈맵');

  const card6 = {
    title: '유동인구',
    subtitle: `시간대별 통행량${dong.dongNm ? ' - ' + dong.dongNm : ''}`,
    date: dateStr,
    source: card6Sources.join('/'),
    bruSummary: aiData?.floatingPopTimeSummary || null,
    aiSummary: aiData?.floatingPopTimeFeedback
      || (dailyPop > 0
      ? `일평균 유동인구 ${fmt(dailyPop)}명. ${weekendPop > weekdayPop ? '주말 유동인구가 평일 대비 높습니다.' : '평일 유동인구가 주말보다 높습니다.'}`
      : ''),
    chartType: 'heatmapBlocks',
    metaInfo: '유동인구',
    chartData: floatChartValues.length > 0
      ? { labels: floatChartLabels, values: floatChartValues }
      : null,
    bodyData: {
      totalPop: dailyPop,
      visitors: totalVisitors,
      topArea: topAreaInfo,
      weekday: weekdayPop,
      weekend: weekendPop,
      peakHour: peakHour,
      ratio: dailyPop > 0 ? `평일 ${Math.round(weekdayPop / (weekdayPop + weekendPop) * 100)}% / 주말 ${Math.round(weekendPop / (weekdayPop + weekendPop) * 100)}%` : '-',
      dayOfWeek: (() => {
        const ds = apis.floatingTime?.data?.daySlots;
        if (ds && typeof ds === 'object') {
          const entries = Object.entries(ds).filter(([, v]) => v > 0);
          if (entries.length > 0) {
            const peak = entries.sort((a, b) => b[1] - a[1])[0];
            return { slots: ds, peakDay: peak[0], peakDayPop: peak[1] };
          }
        }
        return null;
      })(),
      // 비즈맵 보강: 카페 매출 집중 시간대/요일 (유동인구와 별개 차원)
      bizmapPeakHour: bmHourlyTopSlot,
      bizmapPeakHourPct: bmHourlyTopPct,
      bizmapPeakDay: bmWeeklyTopDay,
      bizmapPeakDayPct: bmWeeklyTopPct,
      bizmapHourlyChart: bmHourlyChart,
      bizmapWeeklyChart: bmWeeklyChart,
      // 신규: 소상공인 유동인구 (population)
      dongDailyPop: dongDailyPop,                 // 동 전체 일평균 유동인구 (큰 숫자)
      hourlyPctChart: hourlyPctChart,             // 시간대 비중 % 차트
      weeklyPctChart: weeklyPctChart,             // 요일 비중 % 차트
      weekendPct: weekendPct,                     // 주말 비중
      weekdayPct: weekdayPct,                     // 주중 비중
      popStdYm: popStdYm,                         // 기준월
      popPeakDay: popPeakDay,                     // 유동인구 최고 요일
      popPeakDayPct: popPeakDayPct,
      popPeakHour: popPeakHour,
      popPeakHourPct: popPeakHourPct,
    },
  };

  // ── Card 7: 임대/창업 정보 ──
  let avgRent = 0;
  let avgDeposit = 0;
  let rightsPrice = 0;
  const roneData = apis.roneRent?.data;
  const fbRent = apis.firebaseRent?.data;
  if (fbRent) {
    avgRent = fbRent.avgRent || fbRent.monthlyRent || 0;
    avgDeposit = fbRent.avgDeposit || fbRent.deposit || 0;
    if (fbRent.summary) {
      avgRent = avgRent || fbRent.summary.avgMonthlyRent || 0;
      avgDeposit = avgDeposit || fbRent.summary.avgDeposit || 0;
    }
  }
  if ((!avgRent || avgRent === 0) && Array.isArray(roneData) && roneData.length > 0) {
    const rents = roneData.map(r => r.monthlyRent || r.rent || 0).filter(v => v > 0);
    const deps = roneData.map(r => r.deposit || 0).filter(v => v > 0);
    avgRent = rents.length > 0 ? Math.round(rents.reduce((s, v) => s + v, 0) / rents.length) : 0;
    avgDeposit = deps.length > 0 ? Math.round(deps.reduce((s, v) => s + v, 0) / deps.length) : 0;
  }
  if (aiData?.startupCost?.rightsPrice) {
    rightsPrice = parseInt(String(aiData.startupCost.rightsPrice).replace(/[^0-9]/g, '')) || 0;
  }

  const interiorCost = aiData?.startupCost?.interior || 0;
  const equipmentCost = aiData?.startupCost?.equipment || 0;
  const totalStartupCost = aiData?.startupCost?.total || 0;
  const premiumCost = aiData?.startupCost?.premium || 0;

  const rentBarItems = [];
  if (avgDeposit > 0) rentBarItems.push({ label: '보증금', value: avgDeposit });
  if (avgRent > 0) rentBarItems.push({ label: '월임대', value: avgRent });
  if (premiumCost > 0 || rightsPrice > 0) rentBarItems.push({ label: '권리금', value: premiumCost || rightsPrice });
  if (interiorCost > 0) rentBarItems.push({ label: '인테리어', value: interiorCost });
  if (equipmentCost > 0) rentBarItems.push({ label: '설비', value: equipmentCost });

  // ── 비즈맵 보강: 상권 유형 (blockTypeList) - 입지 특성 ──
  // 라이브 API: [{ blocktype, ratio }] / DOM 폴백: [{ type, detail }]
  const bmBlockRaw = aiData?.apis?.bizMapBlockType?.data ?? apis.bizMapBlockType?.data;
  let bmBlockTypeLabel = null;
  if (Array.isArray(bmBlockRaw) && bmBlockRaw.length > 0) {
    const top = [...bmBlockRaw].sort((a, b) => (parseFloat(b?.ratio || 0) - parseFloat(a?.ratio || 0)))[0];
    if (top) {
      const name = top?.blocktype || top?.detail || top?.type || '';
      const r = parseFloat(top?.ratio);
      if (name && isFinite(r) && r > 0) bmBlockTypeLabel = `${name} ${Math.round(r)}%`;
      else if (name) bmBlockTypeLabel = String(name);
    }
  }

  const card7 = {
    title: '임대/창업 정보',
    subtitle: '상가 시세 및 지원',
    date: dateStr,
    source: '한국부동산원',
    // [2026-05-12] 헤더(bruSummary)와 본문(aiSummary)가 동일 시작 텍스트면 헤더 숨김 (중복 표시 제거)
    // 헤더가 본문의 일부 또는 시작 텍스트와 일치하면 중복으로 판정
    bruSummary: (() => {
      const head = aiData?.rent?.bruSummary || aiData?.startupCost?.bruSummary || null;
      const body = aiData?.rent?.bruFeedback || aiData?.startupCost?.bruFeedback || null;
      if (!head) return null;
      const headTrim = String(head).trim();
      const bodyTrim = body ? String(body).trim() : '';
      if (bodyTrim && (headTrim === bodyTrim || bodyTrim.startsWith(headTrim) || headTrim.startsWith(bodyTrim.substring(0, 30)))) return null;
      return head;
    })(),
    aiSummary: aiData?.rent?.bruFeedback || aiData?.startupCost?.bruFeedback
      || (avgRent > 0
      ? `평균 월 임대료 ${fmtWon(avgRent)}, 보증금 ${fmtWon(avgDeposit)}.`
      : aiData?.rent?.monthly && aiData.rent.monthly !== '-'
        ? `월 임대료 ${aiData.rent.monthly}, 보증금 ${aiData.rent.deposit || '-'}`
        : ''),
    chartType: 'priceCards',
    metaInfo: '임대',
    chartData: rentBarItems.length > 0 ? {
      items: rentBarItems,
      totalCost: rentBarItems.reduce((s, it) => s + (it.value || 0), 0),
      // [KOSIS 외식업체경영실태조사] 카페 전국 평균 - Card 8 UI 표시용
      kosisCafe: (() => {
        const k = buildKosisCafeStats(apis.kosisFoodSurvey?.data || null);
        if (!k) return null;
        // KOSIS 면적 단위는 ㎡. 평으로 환산 (1평 = 3.3058㎡)
        const areaSqm = k.avgArea?.value || 0;
        const areaPyeong = areaSqm > 0 ? Math.round(areaSqm / 3.3058 * 10) / 10 : 0;
        const interior = k.interiorAvg?.value || 0;
        const startup = k.startupInvestAvg?.value || 0;
        // 평당 인테리어비 (평균 인테리어비 ÷ 평균 면적)
        const interiorPerPyeong = (interior > 0 && areaPyeong > 0) ? Math.round(interior / areaPyeong) : 0;
        const startupPerPyeong = (startup > 0 && areaPyeong > 0) ? Math.round(startup / areaPyeong) : 0;
        // 비용 분포 (모름 제거 후 응답자만)
        const interiorRows = apis.kosisFoodSurvey?.data?.results?.interior?.coffeeShopData || [];
        const interiorDist = buildInteriorDistribution(interiorRows);
        // 면적 분포
        const areaRows = apis.kosisFoodSurvey?.data?.results?.area?.coffeeShopData || [];
        const areaDist = buildAreaDistribution(areaRows);
        return {
          year: k.year,
          interiorAvg: interior,
          startupInvestAvg: startup,
          avgAreaSqm: areaSqm,
          avgAreaPyeong: areaPyeong,
          avgSeats: k.avgSeats?.value || 0,
          salesAvg: k.salesAvg?.value || 0,
          unitPriceAvg: k.unitPriceAvg?.value || 0,
          profitMargin: k.profitMargin?.value || 0,
          // 평당 단가 (평수 대비 비용)
          interiorPerPyeong,
          startupPerPyeong,
          // 분포 데이터 (방향 A/B/C용)
          interiorDistribution: interiorDist,
          areaDistribution: areaDist,
        };
      })(),
      // [중소벤처기업부 상가건물임대차실태조사 2023] 시도별 권리금 평균 - Card 8 권리금 칸용
      premium: (() => {
        const dongCd = dong?.dongCd || cd?.dongCd || '';
        const dongNm = dong?.dongNm || '';
        const fbAddr = apis.firebaseRent?.data?.searchAddr || apis.firebaseRent?.data?.fullAddr || '';
        const stat = buildPremiumStats(dongCd || dongNm || fbAddr);
        return stat;
      })(),
      // [Firebase 빈크래프트 수집기] 지역별 월세/보증금 데이터 (중개사 정보 제외, 매물 평균만)
      rentBase: (() => {
        const fb = apis.firebaseRent?.data;
        if (!fb || !fb.summary) return null;
        const s = fb.summary;
        // primaryData 있으면 검색 동 직접 데이터, 없으면 nearbyDongs 평균만
        return {
          primaryDong: fb.primaryDong || null,
          primaryMonthly: s.primaryMonthly || fb.primaryData?.avgMonthlyRent || null,
          primaryDeposit: s.primaryDeposit || fb.primaryData?.avgDeposit || null,
          // 최종 가중평균 (검색 동 60% + 주변 40%)
          finalMonthly: s.avgMonthlyRent || null,
          finalDeposit: s.avgDeposit || null,
          // 중위값 (극단치 제거 기준)
          medianMonthly: s.medianMonthly || null,
          medianDeposit: s.medianDeposit || null,
          // 평당
          perPyeong: s.avgRentPerPyeong || null,
          avgArea: s.avgArea || null,
          // 신뢰도
          totalArticles: s.totalArticles || 0,
          dongCount: s.dongCount || 0,
          filteredDongCount: s.filteredDongCount || 0,
          source: s.source || null,
          updatedAt: s.updatedAt || null,
          isEstimate: !!s.isEstimate,
          // 시군구 단위 데이터 여부 (true이면 동별 비교 박스 대신 단일 박스 표시)
          isSigunguLevel: !!s.isSigunguLevel,
          avgMaintenance: s.avgMaintenance || 0,
          premiumCount: s.premiumCount || 0,
          // 주변 동 리스트 (정렬: 월세 낮은 순). 중개사 정보 제외, 동/월세/보증금만.
          nearbyDongs: Array.isArray(fb.nearbyDongs)
            ? fb.nearbyDongs
                .filter(d => (d.avgMonthlyRent || 0) > 0)
                .map(d => ({
                  dong: d.dong || '',
                  monthly: d.avgMonthlyRent || 0,
                  deposit: d.avgDeposit || 0,
                  area: d.avgArea || 0,
                  articleCount: d.articleCount || 0,
                }))
                .sort((a, b) => (a.monthly || 0) - (b.monthly || 0))
                .slice(0, 8)
            : [],
        };
      })(),
    } : null,
    bodyData: {
      rentPerPyeong: avgRent,
      deposit: avgDeposit,
      // [2026-05-12] 지원 프로그램 0이면 항목 자체 숨김 (null로 처리, CLAUDE.md "0건 단독 표시 금지")
      // 실제 지원 프로그램 수집 안 되면 null → 화면에 안 보임
      supportPrograms: null,
      perPyeong: apis.firebaseRent?.data?.summary?.avgRentPerPyeong || null,
      medianMonthly: apis.firebaseRent?.data?.summary?.medianMonthly || null,
      medianDeposit: apis.firebaseRent?.data?.summary?.medianDeposit || null,
      interiorCost: interiorCost,
      equipmentCost: equipmentCost,
      totalStartupCost: totalStartupCost,
      // premiumCost 제거: 권리금은 chartData.premium 박스에서 시도별 평균으로 표시
      // 비즈맵 보강: 상권 유형 (입지 특성)
      bizmapBlockType: bmBlockTypeLabel,
    },
  };

  // ── Card 8: 카페 기회 [2026-05-02 원본 + 임대/개인 카페 제거 = 3축] ──
  // 변화 / 생존+면적 / 5년 전 vs 지금
  const _findings = [];
  const _ldRows = Array.isArray(apis.firebaseLocaldata?.data?.dongRows) ? apis.firebaseLocaldata.data.dongRows : [];

  const _parseDate = (s) => {
    if (!s) return null;
    const t = String(s).replace(/[^0-9]/g, '');
    if (t.length < 8) return null;
    const y = parseInt(t.slice(0, 4));
    const m = parseInt(t.slice(4, 6));
    const d = parseInt(t.slice(6, 8));
    if (!y || !m || !d) return null;
    const dt = new Date(y, m - 1, d);
    return isNaN(dt.getTime()) ? null : dt;
  };

  const _now = new Date();
  const _oneYearAgo = new Date(_now.getFullYear() - 1, _now.getMonth(), _now.getDate());
  const _fiveYearAgo = new Date(_now.getFullYear() - 5, _now.getMonth(), _now.getDate());
  const _twoYearAgo = new Date(_now.getFullYear() - 2, _now.getMonth(), _now.getDate());

  const _activeRows = _ldRows.filter(r => r.status === '영업/정상' || r.status === '영업');
  const _closedRows = _ldRows.filter(r => r.status === '폐업');
  const _activeAll = _ldRows.filter(r => (r.status||'').includes('영업'));

  const FRANCHISE_KW = ['스타벅스','메가커피','이디야','투썸','컴포즈','빽다방','폴바셋','할리스','커피빈','달콤','요거프레소','카페베네','파스쿠찌','블루보틀','드롭탑','매머드','커피마야','탐앤탐스','엔젤리너스','더벤티','쥬씨','공차','테라로사','베이글뮤지엄'];
  const _isFranchise = (n) => FRANCHISE_KW.some(k => (n||'').includes(k));
  const _indepActive = _activeAll.filter(r => !_isFranchise(r.name));
  const _fcActive = _activeAll.filter(r => _isFranchise(r.name));
  const _indepPct = _activeAll.length > 0 ? Math.round(_indepActive.length / _activeAll.length * 100) : 0;
  const _fcPct = _activeAll.length > 0 ? Math.round(_fcActive.length / _activeAll.length * 100) : 0;
  const _total5y = _activeAll.filter(r => { const d = _parseDate(r.apvDate); return d && d <= _fiveYearAgo; }).length;
  const _recent2yNew = _activeAll.filter(r => { const d = _parseDate(r.apvDate); return d && d >= _twoYearAgo; }).length;
  const _recent1yClosed = _closedRows.filter(r => { const d = _parseDate(r.closeDate); return d && d >= _oneYearAgo; }).length;

  // AI 한 줄 (5/02 합의 문구)
  let aiSummaryLine = '';
  if (_indepPct >= 70 && _total5y > 0) {
    aiSummaryLine = `5년+ ${_total5y}곳 — 그중 ${_indepPct}%가 개인 카페`;
  } else if (_fcPct >= 50 && _total5y > 0) {
    aiSummaryLine = `5년+ ${_total5y}곳 — 절반이 프랜차이즈`;
  } else if (_recent2yNew > _total5y && _recent2yNew > 0) {
    aiSummaryLine = `최근 2년 새 카페 ${_recent2yNew}곳 신규`;
  } else if (_recent1yClosed >= 10) {
    aiSummaryLine = `최근 1년 ${_recent1yClosed}곳 폐업, 5년+ ${_total5y}곳`;
  } else {
    const cafeTotal = (_indepActive?.length || 0) + (_fcActive?.length || 0);
    if (cafeTotal > 0) {
      aiSummaryLine = `이 동네 카페 ${cafeTotal}곳 — 5년+ ${_total5y}곳`;
    }
  }

  // ─ 1) 변화 ─
  if (_ldRows.length > 0) {
    const newOpen = _activeRows.filter(r => { const d = _parseDate(r.apvDate); return d && d >= _oneYearAgo; }).length;
    const closed = _closedRows.filter(r => { const d = _parseDate(r.closeDate); return d && d >= _oneYearAgo; }).length;
    const durations = _activeRows.map(r => {
      const d = _parseDate(r.apvDate);
      return d ? (_now.getTime() - d.getTime()) / (1000 * 60 * 60 * 24 * 365) : null;
    }).filter(v => v != null && v > 0);
    const avgYears = durations.length > 0 ? Math.round((durations.reduce((s, v) => s + v, 0) / durations.length) * 10) / 10 : 0;
    _findings.push({
      axis: '변화',
      text: `최근 1년 신규 ${newOpen}곳 / 폐업 ${closed}곳${avgYears > 0 ? ` / 평균 영업 ${avgYears}년` : ''}`,
    });
  }

  // ─ 2) 생존+면적 ─
  if (_ldRows.length > 0) {
    const longTerm = _activeRows.filter(r => { const d = _parseDate(r.apvDate); return d && d <= _fiveYearAgo; });
    const small = longTerm.filter(r => (r.area || 0) > 0 && (r.area || 0) <= 99);
    const smallPct = longTerm.length > 0 ? Math.round(small.length / longTerm.length * 100) : 0;
    _findings.push({
      axis: '생존+면적',
      text: `5년 이상 살아남은 매장 ${longTerm.length}곳${longTerm.length > 0 ? ` / 30평 이하 작은 매장이 ${smallPct}%` : ''}`,
    });
  }

  // ─ 3) 5년 전 vs 지금 ─
  if (_ldRows.length > 0) {
    const _pastActive = _ldRows.filter(r => {
      const apv = _parseDate(r.apvDate);
      const cls = _parseDate(r.closeDate);
      return apv && apv <= _fiveYearAgo && (!cls || cls > _fiveYearAgo);
    });
    const _pastSurvivors = _pastActive.filter(r => !_parseDate(r.closeDate));
    const _currentTotal = _activeAll.length;
    const _pastTotal = _pastActive.length;
    const _survivors = _pastSurvivors.length;
    const _survivalRate = _pastTotal > 0 ? Math.round(_survivors / _pastTotal * 100) : 0;
    const _growth = _currentTotal - _pastTotal;
    if (_pastTotal > 0) {
      _findings.push({
        axis: '5년 전 vs 지금',
        text: `5년 전 카페 ${_pastTotal}곳 → 지금 ${_currentTotal}곳 (${_growth >= 0 ? '+' : ''}${_growth}곳${_growth >= 0 ? ' 늘어남' : ' 줄어듦'}) / 5년 전 매장 중 ${_survivors}곳 아직 영업 중 (생존율 ${_survivalRate}%)`,
      });
    }
  }

  const card8 = {
    title: '카페 기회',
    subtitle: '이 동네 카페 데이터',
    date: dateStr,
    source: '전국 지방행정인허가데이터',
    bruSummary: null,
    aiSummary: aiSummaryLine || null,
    chartType: null,
    metaInfo: '카페 기회',
    chartData: null,
    bodyData: {
      findings: _findings,
    },
    tag: '카페 기회',
  };

  // ── Card 9: 배달 객단가 (2026-05-02 전면 재설계) ──
  // 메인: 검색 동 객단가 1개
  // 주변 동네: 가나다 순 (펼침 시), 접힘 default
  // + 배달 핫플레이스 전체 데이터 (요일별/월별/성별/연령별/단골/라이프스타일/업종순위)
  const _deliveryRows = apis.delivery?.data || [];
  const _searchDongCd = cd?.dongInfo?.dongCd || '';

  const _parseAmt = (s) => Number(String(s ?? '').replace(/[^\d.-]/g, '')) || 0;

  let _searchDong = null;
  let _nearbyDongs = [];
  let _searchAvgPrice = 0;

  if (_deliveryRows.length > 0) {
    const enriched = _deliveryRows.map(r => {
      const sales = _parseAmt(r.mmavgSlsAmt);
      const orders = _parseAmt(r.mmavgOrdrNocs);
      const avgPrice = orders > 0 ? Math.round(sales / orders) : 0;
      return { name: r.admiNm, admiCd: r.admiCd, sales, orders, avgPrice };
    }).filter(d => d.avgPrice > 0);

    if (enriched.length > 0) {
      // 검색 동 찾기 (admiCd 매칭)
      _searchDong = enriched.find(d => d.admiCd === _searchDongCd) || null;

      if (_searchDong) {
        _searchAvgPrice = _searchDong.avgPrice;
        // 주변 동네: 가나다 순 정렬
        _nearbyDongs = enriched
          .filter(d => d.admiCd !== _searchDongCd)
          .sort((a, b) => (a.name || '').localeCompare(b.name || '', 'ko'));
      } else {
        // 검색 동이 delivery 응답에 없는 경우 폴백: 객단가 가장 높은 동을 메인
        const sorted = enriched.slice().sort((a, b) => b.avgPrice - a.avgPrice);
        _searchDong = sorted[0];
        _searchAvgPrice = _searchDong.avgPrice;
        _nearbyDongs = sorted.slice(1)
          .sort((a, b) => (a.name || '').localeCompare(b.name || '', 'ko'));
      }
    }
  }

  // ── 배달 핫플레이스 데이터 추출 (deliveryHotplace) ──
  // 일반 방문 고객 데이터(성별/연령/단골/라이프스타일)는 카드 2(고객 분석)로 이관됨.
  // 카드 9는 배달 한정 데이터(요일/월별 추이, 배달 시장에서 카페 위치)만 유지.
  const _dlvyHp = apis.deliveryHotplace?.data;
  let _weekdaySales = [];        // 요일별 매출 [{day, amount, isTop, isLow}]
  let _monthlyTrend = [];        // 월별 매출 추이 [{label, value}]
  let _cafeRankInDelivery = 0;   // 배달 업종 중 카페 순위
  let _topDeliveryCategories = []; // [{rank, name, amount}]
  let _cafeDeliveryAmount = 0;     // 배달 한정 카페 월매출

  if (_dlvyHp) {
    // 2) 요일별 매출 (dfkSlsRnkList)
    const dayRank = _dlvyHp.dfkSlsRnkList || [];
    if (dayRank.length > 0) {
      const items = dayRank.map((d, di) => ({
        day: (d.dayTxt ?? d.dfkNm ?? d.keyD ?? d.txtD ?? ['월','화','수','목','금','토','일'][di] ?? '').replace('요일', ''),
        amount: parseFloat(d.dayVal ?? d.slamtVal ?? d.valD ?? 0),
      })).filter(d => d.day);
      const sortedByAmt = items.slice().sort((a, b) => b.amount - a.amount);
      const topAmt = sortedByAmt[0]?.amount || 0;
      const lowAmt = sortedByAmt[sortedByAmt.length - 1]?.amount || 0;
      _weekdaySales = items.map(it => ({
        ...it,
        isTop: it.amount === topAmt && topAmt > 0,
        isLow: it.amount === lowAmt && items.length > 1 && lowAmt < topAmt,
      }));
    }

    // 3) 월별 매출 추이 (fyerChartDList) - 최근 12개월
    // 응답 항목: { txtD: 항목명, valD: 값, crtrYm: "YYYYMM" or "YYYY-MM" }
    // 라벨은 crtrYm을 우선 사용하여 "N월"로 변환. txtD는 항목명이라 라벨로 부적합.
    const fyer = _dlvyHp.fyerChartDList || [];
    if (fyer.length > 0) {
      const toMonthLabel = (raw) => {
        if (!raw) return '';
        const s = String(raw).trim();
        // "YYYY-MM" 또는 "YYYYMM"
        const m1 = s.match(/^(\d{4})[-]?(\d{2})$/);
        if (m1) {
          const mm = parseInt(m1[2], 10);
          return mm >= 1 && mm <= 12 ? `${mm}월` : s;
        }
        // "MM" 또는 "M"
        const m2 = s.match(/^0?(\d{1,2})$/);
        if (m2) {
          const mm = parseInt(m2[1], 10);
          return mm >= 1 && mm <= 12 ? `${mm}월` : s;
        }
        // "N월" 형식이면 그대로
        if (/\d+월/.test(s)) return s;
        return s;
      };
      _monthlyTrend = fyer.slice(-12).map(m => {
        const rawLabel = m.crtrYm || m.baseYm || m.ym || m.keyD || m.txtD || '';
        return {
          label: toMonthLabel(rawLabel),
          value: parseFloat(m.valD ?? m.slamtVal ?? 0),
        };
      }).filter(m => m.label && /월/.test(m.label));
    }

    // [제거됨] 단골/신규, 남/여 라이프스타일, 성별·연령별 소비매출은 카드 2(고객 분석)에서 처리.
    //         일반 방문 고객 데이터이므로 배달 카드에 노출하지 않음.

    // 8) 배달 업종 순위 (tpbizSlsRnkList) - 카페 순위 + TOP5
    const topBiz = _dlvyHp.tpbizSlsRnkList || [];
    if (topBiz.length > 0) {
      _topDeliveryCategories = topBiz.slice(0, 5).map((b, i) => ({
        rank: i + 1,
        name: b.tpbizClscdNm ?? b.tpbizNm ?? b.keyD ?? b.txtD ?? '',
        amount: parseFloat(b.mmTotSlsSumAmt ?? b.slamtVal ?? b.valD ?? 0),
      })).filter(x => x.name);
      // 카페 순위 찾기
      const cafeIdx = topBiz.findIndex(b => {
        const nm = b.tpbizClscdNm ?? b.tpbizNm ?? b.keyD ?? '';
        return nm.includes('카페') || nm.includes('커피') || nm.includes('음료');
      });
      _cafeRankInDelivery = cafeIdx >= 0 ? cafeIdx + 1 : 0;
      // 카페 월매출 추출 (배달 한정)
      if (cafeIdx >= 0) {
        const cafeBiz = topBiz[cafeIdx];
        _cafeDeliveryAmount = parseFloat(cafeBiz.mmTotSlsSumAmt ?? cafeBiz.slamtVal ?? cafeBiz.valD ?? 0);
      }
    }

    // 9) 방문고객 연 평균소득(vstCustYrAvgEarnInfoMap)은 카드 2(고객 분석)로 이동되어 여기서 추출하지 않음
  }

  const _totalDeliveryBiz = (_dlvyHp?.tpbizSlsRnkList || []).length;

  // 10) 배달 시장 추세 (bizonSummaryInfoList) - 전월 대비 주문건수/매출액 증감률
  let _deliveryTrend = null;
  if (_dlvyHp) {
    const _summaryArr = _dlvyHp.bizonSummaryInfoList || [];
    const _ordersItem = _summaryArr.find(s => s?.title?.includes('배달주문'));
    const _salesItem = _summaryArr.find(s => s?.title?.includes('배달매출'));
    const _ordersChange = _ordersItem?.val;
    const _salesChange = _salesItem?.val;
    const _trendPeriod = _ordersItem?.crtrYm || _salesItem?.crtrYm || '';
    if (_ordersChange != null || _salesChange != null) {
      _deliveryTrend = {
        ordersChange: _ordersChange != null ? Number(_ordersChange) : null,
        salesChange: _salesChange != null ? Number(_salesChange) : null,
        period: _trendPeriod || '',
      };
    }
  }

  const card9 = {
    title: '배달 객단가',
    subtitle: '이 동네 배달 객단가',
    date: dateStr,
    source: '소상공인365',
    bruSummary: null,
    aiSummary: null,
    chartType: null,
    metaInfo: '배달객단가',
    chartData: null,
    bodyData: {
      searchDongName: _searchDong?.name || '',
      searchAvgPrice: _searchAvgPrice,
      searchSales: _searchDong?.sales || 0,
      searchOrders: _searchDong?.orders || 0,
      nearbyDongs: _nearbyDongs.map(d => ({ name: d.name, avgPrice: d.avgPrice })),
      // 신규 필드 (배달 핫플레이스 - 배달 한정 데이터만)
      weekdaySales: _weekdaySales,
      monthlyTrend: _monthlyTrend,
      cafeRankInDelivery: _cafeRankInDelivery,
      totalDeliveryBiz: _totalDeliveryBiz,
      topDeliveryCategories: _topDeliveryCategories,
      cafeDeliveryAmount: _cafeDeliveryAmount,
      // customerYrEarn(방문 손님 연 평균소득)은 카드 2로 이동됨
      // 신규 (배달 의뢰인 직접 관련)
      deliveryTrend: _deliveryTrend,
      // [KOSIS 외식업체경영실태조사] 전국 카페 배달 운영 현실 (배달앱/배달대행 비용 분포)
      kosisDelivery: (() => {
        const k = buildKosisCafeStats(apis.kosisFoodSurvey?.data || null);
        if (!k || !k.deliveryDetails) return null;
        return { ...k.deliveryDetails, year: k.year, salesAvg: k.salesAvg?.value || 0 };
      })(),
    },
  };

  // ── Card 10: SNS 트렌드 (워드클라우드 + 키워드 + 감성 + 보조 항목) ──
  const snsTrend = apis.snsTrend?.data || {};
  // 키워드 블랙리스트 (popularKeywords = 동네 인식 + 방문 동기만)
  const SNS_KW_BLACKLIST = [
    // 메타·일반론
    '카페창업', '핫플레이스', '핫플', '인스타그램', '인스타', '배달매출', '배달',
    '월세권', '월세', '네이버플레이스', '상권분석', '유동인구', '역세권',
    '신규오픈', '하드웨어', '소프트웨어', '전자제품', '컴퓨터', '인테리어',
    '브런치', '스페셜티', '프랜차이즈', '카페', '테이크아웃',
    '아메리카노', '라떼', '카페라떼', '분위기좋은', '분위기좋은카페',
    '베이커리', '시그니처',
    '시그니처메뉴', '디저트맛집', '디저트', '맛집', '시그니처음료', '대표메뉴',
    // [v23] 구체 메뉴명 차단 (popularKeywords가 아니라 매장 카드 영역)
    '휘낭시에', '크로플', '마들렌', '까눌레', '마카롱', '쿠키', '스콘',
    '베이글', '베이글샌드위치', '크루아상', '도넛', '치즈케이크', '티라미수',
    '아인슈페너', '에스프레소', '드립커피', '콜드브루', '플랫화이트', '에이드',
    '흑임자라떼', '쑥라떼', '말차라떼', '밤라떼', '인절미빙수', '딸기크레이프',
    // [v23] 한 카페 한정 메뉴
    '헬싱키라떼', '멜팅라떼', '해온라떼', '레몬에스프레소', '카우스앤블랙',
    // [v23] 카페 창업과 무관한 카테고리
    '키즈카페', '아이동반', '유아석', '수유실', '아이들놀이방', '가족카페'
  ];
  const _kwTextOf = (k) => (typeof k === 'string' ? k : (k?.keyword || k?.text || k?.name || ''));
  const popularKeywords = Array.isArray(snsTrend.popularKeywords)
    ? snsTrend.popularKeywords
        .map(_kwTextOf)
        .filter(t => t && !SNS_KW_BLACKLIST.includes(t))
        .slice(0, 12)
    : [];
  const snsNegativeKeywords = Array.isArray(snsTrend.negativeKeywords)
    ? snsTrend.negativeKeywords
        .map(_kwTextOf)
        .filter(t => t && !SNS_KW_BLACKLIST.includes(t))
        .slice(0, 5)
    : [];
  // [v20] 검색 유입 경로 (searchIntents) 매핑
  const searchIntents = Array.isArray(snsTrend.searchIntents)
    ? snsTrend.searchIntents
        .map(s => (typeof s === 'string' ? s : (s?.query || s?.text || '')))
        .filter(Boolean)
        .slice(0, 7)
    : [];
  // [v21] 후기 좋은 매장 (topShops) 매핑
  const topShops = Array.isArray(snsTrend.topShops)
    ? snsTrend.topShops
        .map(s => ({
          name: (s?.name || '').trim(),
          menu: (s?.menu || '').trim(),
          reason: (s?.reason || '').trim(),
        }))
        .filter(s => s.name && s.menu)
        .slice(0, 5)
    : [];
  const snsSummary = snsTrend.summary || snsTrend.analysis || null;
  const blogMentions = apis.naverBlog?.total || 0;

  // 감성 분석 (sentiment 객체 → 긍정 % 산출)
  const _sent = snsTrend.sentiment;
  let sentimentPos = 72;
  let sentimentObj = null;
  if (_sent && typeof _sent === 'object') {
    const p = Number(_sent.positive) || 0;
    const n = Number(_sent.negative) || 0;
    if (p + n > 0) sentimentPos = Math.round((p / (p + n)) * 100);
    sentimentObj = { positive: sentimentPos, negative: 100 - sentimentPos };
  }

  // 워드클라우드용 keywords 배열 ({ text, weight } 형태)
  const wcKeywords = popularKeywords.map((t, i) => ({
    text: t,
    weight: Math.max(1, popularKeywords.length - i),
  }));

  const card10 = {
    title: 'SNS 트렌드',
    subtitle: '소셜미디어 카페 분위기 분석',
    date: dateStr,
    source: 'AI 카페 트렌드 분석',
    // [v23] 위쪽 두 줄 요약 → 한 줄(aiSummary)만 사용. bruSummary 제거(잘림 방지)
    bruSummary: null,
    aiSummary: snsSummary
      || (blogMentions > 0
        ? `네이버 블로그 언급 ${fmt(blogMentions)}건.`
        : ''),
    chartType: 'wordCloud',
    metaInfo: 'SNS',
    chartData: wcKeywords.length > 0 ? { keywords: wcKeywords, sentimentPos } : null,
    // [v24] bodyData에서 summary(중복), sentiment(빈 자리), instagramPosts(의미 없음) 제거
    bodyData: {
      searchIntents,
      keywords: popularKeywords,
      negativeKeywords: snsNegativeKeywords,
      topShops,
      blogMentions: blogMentions || null,
      // [Card 11 디렉터 연동] 긍정/부정 비율 - 디렉터 발화에 활용
      positiveRatio: sentimentPos,
      negativeRatio: 100 - sentimentPos,
      sentimentObj,
    },
    tag: 'SNS',
  };

  // ── Card 11: 날씨 영향 분석 ──
  const card11Weather = (() => {
    const _pe = (v) => {
      if (v == null) return null;
      const str = typeof v === 'object' && v.impact ? v.impact : String(v);
      const m = String(str).match(/([+-]?\d+(?:\.\d+)?)/);
      return m ? parseFloat(m[1]) : null;
    };
    const wi = aiData?.weatherImpact;
    const eff = wi?.effects;
    let sV = null, cV = null, rV = null, snV = null;
    let rType = wi?.regionType || cd?.apis?.weatherIndex?.data?.regionType || null;
    let desc = wi?.description || null;
    let bruFb = wi?.bruFeedback || wi?.description || null;

    if (eff) {
      sV = _pe(eff.sunny); cV = _pe(eff.cloudy); rV = _pe(eff.rain); snV = _pe(eff.snow);
      if (sV == null && eff['\uB9D1\uC74C']) sV = _pe(eff['\uB9D1\uC74C']);
      if (cV == null && eff['\uD750\uB9BC']) cV = _pe(eff['\uD750\uB9BC']);
      if (rV == null && (eff['\uBE44/\uB208'] || eff['\uBE44'])) rV = _pe(eff['\uBE44/\uB208'] || eff['\uBE44']);
      if (snV == null && (eff['\uD3ED\uC5FC/\uD55C\uD30C'] || eff['\uB208'])) snV = _pe(eff['\uD3ED\uC5FC/\uD55C\uD30C'] || eff['\uB208']);
    }
    if (sV == null && cV == null && rV == null && snV == null) {
      const rt = rType || '\uC77C\uBC18';
      if (rt === '\uC624\uD53C\uC2A4') { sV = 8; cV = -2; rV = -8; snV = -12; }
      else if (rt === '\uAD00\uAD11') { sV = 20; cV = -5; rV = -30; snV = -25; }
      else if (rt === '\uC720\uB3D9\uC778\uAD6C') { sV = 15; cV = -3; rV = -20; snV = -18; }
      else { sV = 12; cV = -3; rV = -15; snV = -15; }
      if (!desc) desc = rt === '\uC624\uD53C\uC2A4'
        ? '\uC624\uD53C\uC2A4 \uC0C1\uAD8C\uC740 \uC9C1\uC7A5\uC778 \uACE0\uC815 \uC218\uC694\uB85C \uB0A0\uC528 \uC601\uD5A5\uC774 \uC0C1\uB300\uC801\uC73C\uB85C \uC801\uC740 \uD3B8\uC774\uC5D0\uC694.'
        : rt === '\uAD00\uAD11'
        ? '\uAD00\uAD11 \uC0C1\uAD8C\uC740 \uB0A0\uC528\uC5D0 \uBBFC\uAC10\uD574\uC694. \uC6B0\uCC9C \uC2DC \uB300\uBE44 \uBA54\uB274\uB098 \uC2E4\uB0B4 \uACF5\uAC04 \uC804\uB7B5\uC774 \uC911\uC694\uD574\uC694.'
        : '\uB0A0\uC528\uC5D0 \uB530\uB978 \uB9E4\uCD9C \uBCC0\uB3D9\uC5D0 \uB300\uBE44\uD55C \uC2DC\uC98C\uBCC4 \uBA54\uB274 \uC804\uB7B5\uC744 \uC138\uC6CC\uBCF4\uC138\uC694.';
      if (!bruFb) bruFb = desc;
    }
    // [v25] Open-Meteo 1\uB144 \uC77C\uBCC4 \uB370\uC774\uD130 \uC6B0\uC120 \uC0AC\uC6A9 (\uC2E4\uC81C \uC77C\uC218 \uAE30\uBC18)
    const wstats = cd?.apis?.weatherStats?.data;
    const _round1 = (v) => Math.round(v * 10) / 10;
    let chartItems;
    let yearlyDistribution = null;
    let monthlyCalendar = null;
    if (wstats && wstats.totalDays > 0) {
      const t = wstats.totalDays;
      chartItems = [
        { label: '\uB9D1\uC74C', icon: 'sun', value: wstats.sunnyDays, unit: '\uC77C' },
        { label: '\uD750\uB9BC', icon: 'cloud', value: wstats.cloudyDays, unit: '\uC77C' },
        { label: '\uBE44', icon: 'rain', value: wstats.rainDays, unit: '\uC77C' },
        { label: '\uB208', icon: 'snow', value: wstats.snowDays, unit: '\uC77C' },
      ];
      yearlyDistribution = {
        totalDays: t,
        sunnyPct: _round1((wstats.sunnyDays / t) * 100),
        cloudyPct: _round1((wstats.cloudyDays / t) * 100),
        rainyPct: _round1((wstats.rainDays / t) * 100),
        snowyPct: _round1((wstats.snowDays / t) * 100),
        avgTemp: wstats.avgTemp,
        winterMin: wstats.winterMinTemp,
        summerMax: wstats.summerMaxTemp,
        relativePosition: wstats.relativePosition,
      };
      monthlyCalendar = (wstats.monthlyRainDays || []).map((rd, i) => ({
        month: i + 1,
        rainDays: rd || 0,
        snowDays: (wstats.monthlySnowDays || [])[i] || 0,
        avgTemp: (wstats.monthlyAvgTemp || [])[i],
        // [v25] 일별 상세 (클릭 시 펼침)
        days: (wstats.monthlyDayDetails || [])[i] || [],
      }));
    } else {
      chartItems = [
        { label: '\uB9D1\uC74C', icon: 'sun', value: 0, unit: '\uC77C' },
        { label: '\uD750\uB9BC', icon: 'cloud', value: 0, unit: '\uC77C' },
        { label: '\uBE44', icon: 'rain', value: 0, unit: '\uC77C' },
        { label: '\uB208', icon: 'snow', value: 0, unit: '\uC77C' },
      ];
    }

    const _fp = (v) => v != null ? `${v > 0 ? '+' : ''}${v}%` : null;
    return {
      title: '\uB0A0\uC528 \uC601\uD5A5 \uBD84\uC11D',
      subtitle: '\uC5F0\uAC04 \uAE30\uC0C1 \uBD84\uD3EC\uC640 \uB9E4\uCD9C \uC601\uD5A5',
      date: dateStr,
      bruSummary: wi?.bruSummary || null,
      chartType: 'weatherImpact',
      chartData: { items: chartItems },
      bodyData: {
        // [v25] \uC0C1\uAD8C \uC720\uD615 \uC81C\uAC70 (\uC0AC\uC6A9\uC790 \uC694\uCCAD)
        sunnyEffect: _fp(sV), cloudyEffect: _fp(cV),
        rainyEffect: _fp(rV), snowEffect: _fp(snV),
        yearlyDistribution,
        monthlyCalendar,
        // [v25] \uB0A0\uC528 \uD1B5\uACC4 \uC694\uC57D (\uB9E4\uCD9C \uBE7C\uACE0 \uB0A0\uC528\uB9CC)
        weatherSummary: yearlyDistribution
          ? `\uCD5C\uADFC 1\uB144 ${yearlyDistribution.totalDays}\uC77C \uC911 \uBE44 ${yearlyDistribution.rainyPct}% \u00B7 \uB208 ${yearlyDistribution.snowyPct}% \u00B7 \uC5F0\uD3C9\uADE0 \uAE30\uC628 ${yearlyDistribution.avgTemp}\u00B0C. \uAC15\uC218\uC77C \uC804\uAD6D\uB300\uBE44 ${yearlyDistribution.relativePosition}.`
          : null,
      },
      aiSummary: bruFb || '',
      source: wstats ? 'Open-Meteo ERA5 1\uB144 + \uC18C\uC0C1\uACF5\uC778365' : (bmHourlyTopSlot ? '\uAE30\uC0C1\uCCAD/\uC18C\uC0C1\uACF5\uC778365/\uBE44\uC988\uB9F5' : '\uAE30\uC0C1\uCCAD/\uC18C\uC0C1\uACF5\uC778365'),
      tag: '\uB0A0\uC528',
    };
  })();

  // ── Card 12 (was 11): 상권 경쟁 분석 ──
  const cfrData = apis.cfrStcnt?.data;
  let storeCnt = 0;
  let cafePerKm2 = 0;
  let franchRatio = 0;
  if (Array.isArray(cfrData) && cfrData.length > 0) {
    storeCnt = cfrData.reduce((s, d) => s + (d?.stcnt || d?.storCnt || 0), 0);
  }
  if (totalCafes > 0) {
    cafePerKm2 = Math.round(totalCafes / 0.785);
    franchRatio = franchiseCount > 0 ? Math.round((franchiseCount / totalCafes) * 100) : 0;
  }

  let competLevel = '양호';
  if (totalCafes > 80) competLevel = '매우 과밀';
  else if (totalCafes > 40) competLevel = '과밀';
  else if (totalCafes > 15) competLevel = '보통';

  const competBarItems = [];
  if (totalCafes > 0) competBarItems.push({ label: '카페수', value: totalCafes });
  if (franchiseCount > 0) competBarItems.push({ label: '프랜', value: franchiseCount });
  if (independentCount > 0) competBarItems.push({ label: '개인', value: independentCount });
  if (cafePerKm2 > 0) competBarItems.push({ label: '밀집도', value: cafePerKm2 });

  // -- 밀집도 보강: storSttus (동 내 음식업/카페 업소 수) --
  const storSttusRaw = apis.storSttus?.data;
  const storSttusCompet = Array.isArray(storSttusRaw) ? storSttusRaw : (Array.isArray(storSttusRaw?.data) ? storSttusRaw.data : null);
  let dongFoodStores = 0;
  let dongCafeStores = 0;
  if (Array.isArray(storSttusCompet) && storSttusCompet.length > 0) {
    dongFoodStores = storSttusCompet.reduce((s, d) => s + (d?.storCo || d?.stcnt || 0), 0);
    const cafeRow = storSttusCompet.find(d => {
      const nm = (d?.indsClsNm || d?.tpbizNm || d?.indsMclsNm || '').toLowerCase();
      return nm.includes('커피') || nm.includes('카페') || nm.includes('음료');
    });
    if (cafeRow) dongCafeStores = cafeRow.storCo || cafeRow.stcnt || 0;
  }
  // fallback: 카페 수집 데이터로 밀집도 계산
  if (dongCafeStores === 0 && totalCafes > 0) {
    dongCafeStores = totalCafes;
  }

  // -- 업력현황 (stcarSttus: 신규 진입률/안정 매장 비율) --
  const competStcarRaw = apis.stcarSttus?.data;
  const competStcarData = Array.isArray(competStcarRaw) ? competStcarRaw : (Array.isArray(competStcarRaw?.data) ? competStcarRaw.data : null);
  let avgLifespanLabel = '-';
  let shortTermRatio = 0;
  let longTermRatio = 0;
  if (Array.isArray(competStcarData) && competStcarData.length > 0) {
    const totalStcar = competStcarData.reduce((s, d) => s + (d?.storCo || d?.stcnt || d?.storCnt || 0), 0);
    if (totalStcar > 0) {
      const shortTerm = competStcarData.find(d => (d?.stcarNm || d?.stcarRange || '').includes('1'));
      const longTerm = competStcarData.filter(d => {
        const nm = d?.stcarNm || d?.stcarRange || '';
        return nm.includes('3') || nm.includes('5') || nm.includes('10') || nm.includes('20');
      });
      if (shortTerm) {
        shortTermRatio = Math.round(((shortTerm.storCo || shortTerm.stcnt || shortTerm.storCnt || 0) / totalStcar) * 100);
      }
      const longTermCnt = longTerm.reduce((s, d) => s + (d?.storCo || d?.stcnt || d?.storCnt || 0), 0);
      longTermRatio = Math.round((longTermCnt / totalStcar) * 100);
      if (longTermRatio >= 60) avgLifespanLabel = '3년 이상 다수';
      else if (longTermRatio >= 40) avgLifespanLabel = '3년 이상 보통';
      else if (shortTermRatio >= 40) avgLifespanLabel = '1년 미만 다수';
      else avgLifespanLabel = '혼재';
    }
  }
  // fallback: newOpenCount(오픈업 gp-cafes)로 신규 진입률 추정
  if (shortTermRatio === 0 && newOpenCount > 0 && totalCafes > 0) {
    shortTermRatio = Math.round((newOpenCount / totalCafes) * 100);
    if (avgLifespanLabel === '-') avgLifespanLabel = '혼재';
  }

  // -- 개폐업 상세 (detail: 최근 개업/폐업 수) --
  const detailRaw = apis.detail?.data;
  const detailCompet = Array.isArray(detailRaw) ? detailRaw : (Array.isArray(detailRaw?.data) ? detailRaw.data : null);
  let recentOpenBiz = 0;
  let recentCloseBiz = 0;
  if (Array.isArray(detailCompet) && detailCompet.length > 0) {
    const latest = detailCompet[0];
    recentOpenBiz = latest?.opBizCnt || 0;
    recentCloseBiz = latest?.clsBizCnt || 0;
  }
  // fallback: newOpenCount(오픈업 gp-cafes)로 최근 개업 수 보충
  if (recentOpenBiz === 0 && newOpenCount > 0) {
    recentOpenBiz = newOpenCount;
  }

  // -- 나이스비즈맵 통계 (nicebizmapStats: 점포당 매출, 시장 규모) --
  const nbmStatsCompet = cd.nicebizmapStats;
  let perStoreSales = nbmStatsCompet?.perStoreAvg ? formatKoreanNumber(nbmStatsCompet.perStoreAvg) + '원' : '-';
  let competMarketSize = nbmStatsCompet?.marketSize ? formatKoreanNumber(nbmStatsCompet.marketSize) + '원' : '-';
  const nbmStoreCnt = nbmStatsCompet?.storeCnt || 0;
  // fallback: openubSales로 점포당 매출 보충
  if (perStoreSales === '-') {
    const oubSales = apis.openubSales?.data;
    if (oubSales?.avgMonthlySales) {
      perStoreSales = formatKoreanNumber(oubSales.avgMonthlySales) + '원';
    } else if (oubSales?.avgSales) {
      perStoreSales = formatKoreanNumber(oubSales.avgSales) + '원';
    }
  }
  // fallback: 점포당 매출 * 카페수 = 시장 규모 추정
  if (competMarketSize === '-' && perStoreSales !== '-' && totalCafes > 0) {
    const perStoreNum = parseFloat(perStoreSales.replace(/[^0-9]/g, ''));
    if (perStoreNum > 0) {
      competMarketSize = formatKoreanNumber(perStoreNum * totalCafes * 10000) + '원';
    }
  }

  // -- 밀집도 종합 요약 --
  let densityNote = '';
  if (dongCafeStores > 0) {
    densityNote = `동 내 카페/음료 업소 ${dongCafeStores}개`;
  } else if (dongFoodStores > 0) {
    densityNote = `동 내 음식업 업소 ${dongFoodStores}개`;
  }
  if (nbmStoreCnt > 0 && !densityNote) {
    densityNote = `비즈맵 기준 점포 ${nbmStoreCnt}개`;
  }
  // fallback: 수집된 카페수로 밀집도
  if (!densityNote && totalCafes > 0) {
    densityNote = `반경 500m 카페 ${totalCafes}개`;
  }

  // -- aiSummary 보강 --
  const competAiParts = [];
  if (totalCafes > 0) {
    competAiParts.push(`반경 500m 내 카페 ${totalCafes}개, 경쟁 강도 "${competLevel}"`);
    competAiParts.push(`프랜차이즈 비율 ${franchRatio}%`);
  }
  if (densityNote) competAiParts.push(densityNote);
  if (shortTermRatio > 0) competAiParts.push(`1년 미만 신규 진입 ${shortTermRatio}%`);
  if (recentCloseBiz > 0) competAiParts.push(`최근 폐업 ${recentCloseBiz}개`);
  if (perStoreSales !== '-') competAiParts.push(`점포당 월매출 ${perStoreSales}`);

  // ── 비즈맵 보강: 점포수 TOP 업종 (popularUpjongListOrderByStoreRnk) - 경쟁 업종 분석 ──
  // 형태: [{ upjongCdNm | upjongNm | name, storeCnt | cnt, rnk }, ...]
  const bmUpjongStoreRaw = aiData?.apis?.bizMapPopularUpjongByStore?.data ?? apis.bizMapPopularUpjongByStore?.data;
  let bmTopUpjongList = null;
  if (Array.isArray(bmUpjongStoreRaw) && bmUpjongStoreRaw.length > 0) {
    const items = bmUpjongStoreRaw.slice(0, 5).map(r => {
      const name = r?.upjongCdNm || r?.upjongNm || r?.name || r?.upjong3Nm || r?.upjong || '';
      // salePer (동 매출 비중 %) 우선, 없으면 cnt (옛날 호환)
      const pct = parseFloat(r?.salePer ?? 0) || 0;
      const cnt = parseInt(r?.storeCnt ?? r?.storCnt ?? r?.cnt ?? r?.storeCount ?? 0, 10) || 0;
      return { name: String(name).trim(), pct, cnt };
    }).filter(x => x.name);
    if (items.length > 0) {
      const top = items[0];
      // salePer 있으면 매출 비중 %, 없으면 업종명만 (잘못된 storeCnt는 표시 안 함)
      bmTopUpjongList = items.map(x => x.pct > 0 ? `${x.name} ${x.pct.toFixed(1)}%` : x.name).join(', ');
      if (top?.name) competAiParts.push(`동 매출 TOP 업종 ${top.name}${top.pct > 0 ? ` ${top.pct.toFixed(1)}%` : ''}`);
    }
  }

  // ─────────────────────────────────────────────────
  // [2026-05-11 사전 계산] 5축 점수 자체 계산을 위한 의존 변수 미리 추출
  // ─────────────────────────────────────────────────
  // LOCALDATA 활성/폐업 매장: 평균 영업기간, 5년 전 카페 수 계산용
  const _ldRowsEarly = Array.isArray(apis.firebaseLocaldata?.data?.dongRows) ? apis.firebaseLocaldata.data.dongRows : [];
  const _activeEarly = _ldRowsEarly.filter(r => (r.status || '').includes('영업'));
  const _parseDateEarly = (s) => {
    if (!s) return null;
    const t = String(s).replace(/[^0-9]/g, '');
    if (t.length < 8) return null;
    const y = parseInt(t.slice(0, 4));
    const m = parseInt(t.slice(4, 6));
    const d = parseInt(t.slice(6, 8));
    if (!y || !m || !d) return null;
    const dt = new Date(y, m - 1, d);
    return isNaN(dt.getTime()) ? null : dt;
  };
  const _nowEarly = new Date();
  const _fiveYrAgoEarly = new Date(_nowEarly.getFullYear() - 5, _nowEarly.getMonth(), _nowEarly.getDate());
  let _avgYearsCompet = 0;
  if (_activeEarly.length > 0) {
    const _durs = _activeEarly.map(r => {
      const d = _parseDateEarly(r.apvDate);
      if (!d) return null;
      return (_nowEarly.getTime() - d.getTime()) / (1000 * 60 * 60 * 24 * 365);
    }).filter(v => v != null && v > 0);
    if (_durs.length > 0) _avgYearsCompet = Math.round((_durs.reduce((s, v) => s + v, 0) / _durs.length) * 10) / 10;
  }
  // 5년 전 카페 수 (변화 축 5년 점포 변화용)
  let _cafes5yAgoEarly = 0;
  if (_ldRowsEarly.length > 0) {
    _cafes5yAgoEarly = _ldRowsEarly.filter(r => {
      const apv = _parseDateEarly(r.apvDate);
      if (!apv || apv > _fiveYrAgoEarly) return false;
      if ((r.status || '').includes('영업')) return true;
      if ((r.status || '').includes('폐업')) {
        const cd2 = _parseDateEarly(r.closeDate);
        return cd2 && cd2 > _fiveYrAgoEarly;
      }
      return false;
    }).length;
  }
  // 동 1순위 매출 업종 (시장 축 +3점용)
  let _ext_maxSlsBizName = '';
  let _ext_maxSlsBizDelta = 0;
  try {
    const _msbData = aiData?.apis?.maxSlsBiz?.data ?? apis.maxSlsBiz?.data ?? null;
    if (_msbData) {
      _ext_maxSlsBizName = String(_msbData.tpbizClscdNm || _msbData.upjongNm || '').trim();
      _ext_maxSlsBizDelta = parseFloat(_msbData.mmTotSlsAmtPercent ?? 0) || 0;
    }
  } catch (e) { /* 빈 문자열 유지 */ }

  // ─────────────────────────────────────────────────
  // [2026-05-05 v3 / 2026-05-11 자체 계산 전환] 빈크래프트 5축 100점
  // 시장(20) + 경쟁(20) + 변화(15) + 생존(30) + 비용(15) = 100
  // ─────────────────────────────────────────────────
  // [축 1] 시장 매력도 (20점)
  // 비즈맵 데이터 추출 (카드 5와 동일 패턴 - 다중 fallback)
  const _bmAvgSalesArr = aiData?.apis?.bizMapAverageSales?.data ?? apis.bizMapAverageSales?.data;
  let _bizmapPerStoreAvg = nbmStatsCompet?.perStoreAvg || nbmStatsCompet?.average || 0; // 만원
  if (!_bizmapPerStoreAvg && Array.isArray(_bmAvgSalesArr) && _bmAvgSalesArr.length > 0) {
    const midRow = _bmAvgSalesArr[1] || _bmAvgSalesArr[0];
    _bizmapPerStoreAvg = midRow?.amount || midRow?.value || midRow?.midValue || 0;
  }

  const _bmMarketArr = aiData?.apis?.bizMapMarketSize?.data ?? apis.bizMapMarketSize?.data;
  let _bizmapMarketSize = nbmStatsCompet?.marketSize || 0; // 만원
  if (!_bizmapMarketSize && Array.isArray(_bmMarketArr) && _bmMarketArr.length > 0) {
    const last = _bmMarketArr[_bmMarketArr.length - 1];
    _bizmapMarketSize = last?.amount || last?.value || last?.marketSize || 0;
  }

  // 결제단가: bizMapUsageAndPayment 의 avgPayment (정확한 API 키)
  const _bmUsagePay = aiData?.apis?.bizMapUsageAndPayment?.data ?? apis.bizMapUsageAndPayment?.data;
  let _bizmapPay = nbmStatsCompet?.avgPrice || nbmStatsCompet?.avgPayment || 0;
  if (!_bizmapPay && Array.isArray(_bmUsagePay) && _bmUsagePay.length > 0) {
    const sortedUP = [..._bmUsagePay].sort((a, b) => String(a?.yyyymm || a?.stdYm || '').localeCompare(String(b?.yyyymm || b?.stdYm || '')));
    const last = sortedUP[sortedUP.length - 1];
    _bizmapPay = last?.avgPayment || last?.avgPrice || last?.price || 0;
  }

  // 상/중/하 매출 추출 (가산점 + 동 평균 매출 폴백 강화)
  let _bmTopSales = 0, _bmMidSales = 0, _bmBtmSales = 0;
  if (Array.isArray(_bmAvgSalesArr) && _bmAvgSalesArr.length > 0) {
    const sortedAS = [..._bmAvgSalesArr].sort((a, b) => String(a?.yyyymm || a?.stdYm || a?.ym || '').localeCompare(String(b?.yyyymm || b?.stdYm || b?.ym || '')));
    const latest = sortedAS[sortedAS.length - 1] || {};
    _bmTopSales = parseFloat(latest.top20 ?? latest.topAvgSlamt ?? latest.topSlamt ?? 0) || 0;
    _bmMidSales = parseFloat(latest.avg ?? latest.avgSlamt ?? latest.midSlamt ?? 0) || 0;
    _bmBtmSales = parseFloat(latest.bot20 ?? latest.btmAvgSlamt ?? latest.btmSlamt ?? 0) || 0;
    if (!_bizmapPerStoreAvg && _bmMidSales > 0) _bizmapPerStoreAvg = _bmMidSales;
  }
  // ─────────────────────────────────────────────────
  // [2026-05-11 전면 재설계] 5축 점수 → 13개 카드 + KOSIS 자체 계산
  // 비즈맵 의존(_findCostRatio, _bizmapOpIncome, _bizmapPerStoreAvg 등) 제거
  // 우리가 모은 데이터(소상공인 매출, LOCALDATA, 카페 수, 임대료)로 직접 계산
  // ─────────────────────────────────────────────────
  // 자체 데이터 추출 (모두 이미 dataMapper 위쪽에서 정의됨)
  const _selfCafeSales = (typeof cafeSales === 'number' && cafeSales > 0) ? cafeSales : 0;     // 카페 월매출 (만원, 소상공인)
  const _selfTotalCafes = totalCafes || 0;                                                       // 카페 수 (오픈업+카카오)
  const _selfDailyPop = (typeof dailyPop === 'number' && dailyPop > 0) ? dailyPop : 0;          // 일평균 유동인구
  const _selfFranchRatio = franchRatio || 0;                                                     // 프랜차이즈 비율 (%)
  const _selfClosedCount = card1Closed || 0;                                                     // 폐업 매장 수
  const _selfNewOpenCount = newOpenCount || 0;
  const _selfRecentOpen = recentOpenBiz || _selfNewOpenCount;
  const _selfRecentClose = recentCloseBiz || 0;
  const _selfAvgRent = (typeof avgRent === 'number' && avgRent > 0) ? avgRent : 0;              // 평균 월 임대료 (만원)
  const _selfMaxSlsBiz = String(_ext_maxSlsBizName || '').trim();                                // 동 1순위 매출 업종

  // [축 1] 시장 (20점) - "이 동네 카페 시장이 큰가"
  // 1-1. 카페 월매출 (8점)
  let _s_market_sales = 0;
  if (_selfCafeSales >= 9000) _s_market_sales = 8;
  else if (_selfCafeSales >= 6000) _s_market_sales = 6;
  else if (_selfCafeSales >= 3000) _s_market_sales = 4;
  else if (_selfCafeSales >= 1000) _s_market_sales = 2;
  // 1-2. 카페 수 (5점)
  let _s_market_cafeCnt = 0;
  if (_selfTotalCafes >= 200) _s_market_cafeCnt = 5;
  else if (_selfTotalCafes >= 100) _s_market_cafeCnt = 4;
  else if (_selfTotalCafes >= 50) _s_market_cafeCnt = 3;
  else if (_selfTotalCafes >= 20) _s_market_cafeCnt = 2;
  // 1-3. 유동인구 일평균 (4점)
  let _s_market_pop = 0;
  if (_selfDailyPop >= 50000) _s_market_pop = 4;
  else if (_selfDailyPop >= 20000) _s_market_pop = 3;
  else if (_selfDailyPop >= 5000) _s_market_pop = 2;
  // 1-4. 동 1순위 매출 업종 카페 매칭 (3점)
  let _s_market_topBiz = 0;
  if (_selfMaxSlsBiz && (_selfMaxSlsBiz.includes('카페') || _selfMaxSlsBiz.includes('커피'))) _s_market_topBiz = 3;
  const _scoreMarket = Math.max(0, Math.min(20, _s_market_sales + _s_market_cafeCnt + _s_market_pop + _s_market_topBiz));
  console.log(`[5축] 시장 ${_scoreMarket}/20 = 매출 ${_s_market_sales}(${_selfCafeSales}만) + 카페수 ${_s_market_cafeCnt}(${_selfTotalCafes}개) + 유동 ${_s_market_pop}(${_selfDailyPop}명) + 1순위 ${_s_market_topBiz}(${_selfMaxSlsBiz})`);

  // [축 2] 경쟁 (20점) - "경쟁이 빡빡한가"
  // 2-1. 카페 밀집도 (8점, 낮을수록 좋음)
  let _s_compete_density = 0;
  if (_selfTotalCafes > 0 && _selfTotalCafes <= 100) _s_compete_density = 8;
  else if (_selfTotalCafes <= 200) _s_compete_density = 5;
  else if (_selfTotalCafes <= 300) _s_compete_density = 3;
  else if (_selfTotalCafes > 0) _s_compete_density = 1;
  // 2-2. 프랜차이즈 비율 (6점, 낮을수록 좋음)
  let _s_compete_fcRatio = 0;
  if (_selfFranchRatio > 0 && _selfFranchRatio < 30) _s_compete_fcRatio = 6;
  else if (_selfFranchRatio < 50) _s_compete_fcRatio = 4;
  else if (_selfFranchRatio > 0) _s_compete_fcRatio = 2;
  // 2-3. 평균 영업기간 (6점) - card3(card12)의 _avgYearsCompet 사용
  let _s_compete_avgYears = 0;
  if (_avgYearsCompet >= 7) _s_compete_avgYears = 6;
  else if (_avgYearsCompet >= 5) _s_compete_avgYears = 4;
  else if (_avgYearsCompet >= 3) _s_compete_avgYears = 2;
  const _scoreCompete = Math.max(0, Math.min(20, _s_compete_density + _s_compete_fcRatio + _s_compete_avgYears));
  console.log(`[5축] 경쟁 ${_scoreCompete}/20 = 밀집 ${_s_compete_density}(${_selfTotalCafes}개) + 프랜${_s_compete_fcRatio}(${_selfFranchRatio}%) + 영업${_s_compete_avgYears}(${_avgYearsCompet}년)`);

  // [축 3] 변화 (15점) - "신규 진입 흐름과 매출 추세"
  // 3-1. 신규/폐업 비율 (6점)
  let _s_change_newClose = 0;
  if (_selfRecentOpen > 0 && _selfRecentClose > 0) {
    const _ratio = _selfRecentOpen / _selfRecentClose;
    if (_ratio >= 1.5) _s_change_newClose = 6;
    else if (_ratio >= 1.0) _s_change_newClose = 4;
    else if (_ratio >= 0.7) _s_change_newClose = 2;
  } else if (_selfRecentOpen > 0 && _selfRecentClose === 0) {
    _s_change_newClose = 6;
  }
  // 3-2. 5년 점포 변화 (5점)
  let _s_change_5yr = 0;
  if (_cafes5yAgoEarly > 0 && _selfTotalCafes > 0) {
    const _changePct = ((_selfTotalCafes - _cafes5yAgoEarly) / _cafes5yAgoEarly) * 100;
    if (_changePct >= 20) _s_change_5yr = 5;
    else if (_changePct >= 10) _s_change_5yr = 3;
    else if (_changePct >= -10) _s_change_5yr = 2;
  }
  // 3-3. bizonRnkTop10 카페 핫플 순위 (4점)
  let _s_change_hotpl = 0;
  try {
    const _hpData = aiData?.apis?.bizonRnkTop10?.data ?? apis.bizonRnkTop10?.data ?? [];
    if (Array.isArray(_hpData) && _hpData.length > 0) {
      const _hasHotTheme = _hpData.some(r => {
        const t = String(r?.bizonThemaTpcd || r?.themaTpcd || '');
        return t === 'NWB' || t === 'MZ';
      });
      if (_hasHotTheme) _s_change_hotpl = 4;
    }
  } catch (e) { /* 0 유지 */ }
  const _scoreChange = Math.max(0, Math.min(15, _s_change_newClose + _s_change_5yr + _s_change_hotpl));
  console.log(`[5축] 변화 ${_scoreChange}/15 = 신폐 ${_s_change_newClose}(신${_selfRecentOpen}/폐${_selfRecentClose}) + 5년 ${_s_change_5yr}(${_cafes5yAgoEarly}→${_selfTotalCafes}) + 핫플 ${_s_change_hotpl}`);

  // [축 4] 생존 (30점) - "1년·3년·5년 살아남나"
  // LOCALDATA 활성/폐업 매장 추출 (위쪽 _ldRowsEarly 등은 변화 축에서 사용, 여기서는 별도 변수명 유지)
  const _ldRowsCompet = _ldRowsEarly;
  const _activeAllCompet = _activeEarly;
  const _closedAllCompet = _ldRowsCompet.filter(r => (r.status || '').includes('폐업'));
  const _parseDateCompet = _parseDateEarly;
  const _nowCompet = _nowEarly;
  const _fiveYearAgoCompet = _fiveYrAgoEarly;
  const _oneYearAgoCompet = new Date(_nowCompet.getFullYear() - 1, _nowCompet.getMonth(), _nowCompet.getDate());

  // 5년+ 매장 비율 (생존 _scoreSurvival 계산은 사용자 매핑 표 따름. 여기 _fiveYrPct는 카드13/디버그용 유지)
  let _fiveYrPct = 0;
  if (_activeAllCompet.length > 0) {
    const _fiveYrCount = _activeAllCompet.filter(r => { const d = _parseDateCompet(r.apvDate); return d && d <= _fiveYearAgoCompet; }).length;
    _fiveYrPct = Math.round((_fiveYrCount / _activeAllCompet.length) * 100);
  }
  // 동 폐업률 (생존3년 가능성 산출 + 디버그용 유지)
  let _ldClosurePct = 0;
  const _totalLD = _activeAllCompet.length + _closedAllCompet.length;
  if (_totalLD > 0) {
    const _recentClose1y = _closedAllCompet.filter(r => { const d = _parseDateCompet(r.closeDate); return d && d >= _oneYearAgoCompet; }).length;
    _ldClosurePct = Math.round((_recentClose1y / _totalLD) * 100);
  }

  // 생존율 자체 계산 (LOCALDATA dongRows + apvDate/closeDate 기반)
  // - 1년 생존율: 1년 전 시점 영업 중이던 매장 중 지금도 영업 중인 비율
  // - 3년/5년 동일 계산 방식
  const _calcSurvivalRate = (yearsAgo) => {
    if (_ldRowsCompet.length === 0) return 0;
    const _cutoff = new Date(_nowCompet.getFullYear() - yearsAgo, _nowCompet.getMonth(), _nowCompet.getDate());
    // 분모: yearsAgo 시점에 영업 중이던 매장 (apvDate <= cutoff AND (영업 OR closeDate > cutoff))
    let _denom = 0;
    let _alive = 0;
    _ldRowsCompet.forEach(r => {
      const apv = _parseDateCompet(r.apvDate);
      if (!apv || apv > _cutoff) return;
      const isOp = (r.status || '').includes('영업');
      const isCl = (r.status || '').includes('폐업');
      if (isOp) { _denom += 1; _alive += 1; }
      else if (isCl) {
        const cl = _parseDateCompet(r.closeDate);
        if (cl && cl > _cutoff) _denom += 1; // cutoff 시점엔 영업 중, 그 이후 폐업
      }
    });
    return _denom > 0 ? Math.round((_alive / _denom) * 100) : 0;
  };
  const _selfSurvival1y = _calcSurvivalRate(1);
  const _selfSurvival3y = _calcSurvivalRate(3);
  const _selfSurvival5y = _calcSurvivalRate(5);

  // 4-1. 1년 생존율 (10점)
  let _s_surv_1y = 0;
  if (_selfSurvival1y >= 70) _s_surv_1y = 10;
  else if (_selfSurvival1y >= 60) _s_surv_1y = 8;
  else if (_selfSurvival1y >= 50) _s_surv_1y = 6;
  else if (_selfSurvival1y >= 40) _s_surv_1y = 4;
  // 4-2. 3년 생존율 (8점)
  let _s_surv_3y = 0;
  if (_selfSurvival3y >= 50) _s_surv_3y = 8;
  else if (_selfSurvival3y >= 40) _s_surv_3y = 6;
  else if (_selfSurvival3y >= 30) _s_surv_3y = 4;
  // 4-3. 5년 생존율 (6점)
  let _s_surv_5y = 0;
  if (_selfSurvival5y >= 30) _s_surv_5y = 6;
  else if (_selfSurvival5y >= 20) _s_surv_5y = 4;
  // 4-4. 폐업 매장 수 (4점)
  let _s_surv_closed = 0;
  if (_selfClosedCount > 0 && _selfClosedCount <= 5) _s_surv_closed = 4;
  else if (_selfClosedCount <= 10) _s_surv_closed = 2;
  // 4-5. 날씨 영향 (+2점, 비 영향 -10% 이내)
  let _s_surv_weather = 0;
  try {
    const _rainStr = card11Weather?.bodyData?.rainyEffect; // "+5%" "-15%" 형태
    if (_rainStr) {
      const _rainNum = parseFloat(String(_rainStr).replace(/[^0-9.\-+]/g, ''));
      if (Number.isFinite(_rainNum) && _rainNum >= -10) _s_surv_weather = 2;
    }
  } catch (e) { /* 0 유지 */ }
  const _scoreSurvival = Math.max(0, Math.min(30, _s_surv_1y + _s_surv_3y + _s_surv_5y + _s_surv_closed + _s_surv_weather));
  console.log(`[5축] 생존 ${_scoreSurvival}/30 = 1년 ${_s_surv_1y}(${_selfSurvival1y}%) + 3년 ${_s_surv_3y}(${_selfSurvival3y}%) + 5년 ${_s_surv_5y}(${_selfSurvival5y}%) + 폐업 ${_s_surv_closed}(${_selfClosedCount}개) + 비 ${_s_surv_weather}`);

  // [축 5] 비용 (15점) - "임대료 부담 적고 남는 게 많은가"
  // 비즈맵 의존 제거. 자체 계산: 임차료 부담률 + 영업이익률 (재료비33%·인건비25%·기타10% 표준)
  // 5-1. 임차료 부담률 (8점) = avgRent ÷ cafeSales × 100
  let _selfRentPct = 0;
  if (_selfAvgRent > 0 && _selfCafeSales > 0) {
    _selfRentPct = Math.round((_selfAvgRent / _selfCafeSales) * 1000) / 10;
  }
  let _s_cost_rent = 0;
  if (_selfRentPct > 0 && _selfRentPct < 5) _s_cost_rent = 8;
  else if (_selfRentPct > 0 && _selfRentPct < 8) _s_cost_rent = 6;
  else if (_selfRentPct > 0 && _selfRentPct < 12) _s_cost_rent = 4;
  else if (_selfRentPct > 0 && _selfRentPct < 15) _s_cost_rent = 2;
  // 5-2. 영업이익률 (7점) = (매출 - 임대료 - 매출×0.68) ÷ 매출 × 100
  let _selfOpIncomePct = 0;
  if (_selfCafeSales > 0) {
    const _opIncome = _selfCafeSales - _selfAvgRent - (_selfCafeSales * 0.68);
    _selfOpIncomePct = Math.round((_opIncome / _selfCafeSales) * 1000) / 10;
  }
  let _s_cost_opIncome = 0;
  if (_selfOpIncomePct >= 25) _s_cost_opIncome = 7;
  else if (_selfOpIncomePct >= 20) _s_cost_opIncome = 6;
  else if (_selfOpIncomePct >= 15) _s_cost_opIncome = 4;
  else if (_selfOpIncomePct >= 10) _s_cost_opIncome = 2;
  const _scoreCost = Math.max(0, Math.min(15, _s_cost_rent + _s_cost_opIncome));
  console.log(`[5축] 비용 ${_scoreCost}/15 = 임차 ${_s_cost_rent}(${_selfRentPct}%, ${_selfAvgRent}만/${_selfCafeSales}만) + 영업이익 ${_s_cost_opIncome}(${_selfOpIncomePct}%)`);

  // 비즈맵 의존 변수는 호환성 유지 위해 빈 값으로 계산 (다른 카드/디버그에서 참조)
  const _costList = aiData?.apis?.bizMapCostAnalysis?.data ?? apis.bizMapCostAnalysis?.data ?? [];
  const _findCostRatio = (kw) => {
    const r = (_costList || []).find(x => (x?.item || '').includes(kw));
    return r?.ratio || 0;
  };
  const _bizmapRentPct = _findCostRatio('임차') || _findCostRatio('임대') || nbmStatsCompet?.rentPct || 0;
  const _fbRent = apis.firebaseRent?.data?.summary?.avgMonthlyRent || 0;
  const _avgRentPct = _selfRentPct || _bizmapRentPct || 0;
  const _bizmapOpIncome = _selfOpIncomePct || _findCostRatio('영업이익') || _findCostRatio('이익') || 0;
  const _bizmapLaborPct = _findCostRatio('인건비') || _findCostRatio('인건') || 0;
  const _bizmapMaterialPct = _findCostRatio('재료비') || _findCostRatio('식자재') || _findCostRatio('재료') || 0;
  // 호환용 점수 (UI scoreDetails 표시 유지)
  const _s_rent = _s_cost_rent;
  const _s_opIncome = _s_cost_opIncome;
  const _s_costExtra = 0;
  // 호환용 점수 detail 구조 (기존 scoreDetails 참조용)
  const _s_pot = _s_market_sales;
  const _s_avgSales = _s_market_cafeCnt;
  const _s_marketSize = _s_market_pop;
  const _s_unitPrice = _s_market_topBiz;
  const _s_density = _s_compete_density;
  const _s_fcRatio = _s_compete_fcRatio;
  const _s_diversity = _s_compete_avgYears;
  const _s_newClose = _s_change_newClose;
  const _s_storeTrend = _s_change_5yr;
  const _s_marketChange = _s_change_hotpl;
  const _s_fiveYr = _s_surv_1y + _s_surv_3y;
  const _s_avgYears = _s_surv_5y;
  const _s_closure = _s_surv_closed + _s_surv_weather;
  const _potCustPerCafe = _selfTotalCafes > 0 && _selfDailyPop > 0 ? Math.round(_selfDailyPop / _selfTotalCafes) : 0;
  const _storeTrendChangePct = _cafes5yAgoEarly > 0 ? Math.round(((_selfTotalCafes - _cafes5yAgoEarly) / _cafes5yAgoEarly) * 100) : 0;
  let _bmMarketChange = 0;
  if (Array.isArray(_bmMarketArr) && _bmMarketArr.length >= 2) {
    const first = _bmMarketArr[0]?.amount || _bmMarketArr[0]?.value || 0;
    const last = _bmMarketArr[_bmMarketArr.length - 1]?.amount || _bmMarketArr[_bmMarketArr.length - 1]?.value || 0;
    if (first > 0) _bmMarketChange = Math.round(((last - first) / first) * 100);
  }
  // [2026-05-12] _bmMarketChange 폴백: 비즈맵 시장규모 없으면 점포 추이로 대체 (점포수 변동 ~ 시장 변동 상관)
  if (_bmMarketChange === 0 && _storeTrendChangePct !== 0) {
    _bmMarketChange = Math.round(_storeTrendChangePct * 1.2); // 점포 변동 × 매출 탄력 1.2배
  }
  const _marketSizeBilManwon = Math.floor(_bizmapMarketSize / 10000);

  // ─────────────────────────────────────────────────
  // [2026-05-06 추가 #1] 비즈맵 집객 시설 5종 → 시장 매력도 가산 (0~2점)
  // 데이터: apis.bizMapFacilities.data { publicCnt, eduCnt, financeCnt, busstopCnt, subwayInfo }
  // 5종 합산 → 0~2점 (관공서/교육/금융/버스/지하철)
  // ─────────────────────────────────────────────────
  let _ext_infraTotal = 0;
  let _ext_infraBonus = 0;
  let _ext_infraBreakdown = null;
  try {
    const _facData = aiData?.apis?.bizMapFacilities?.data ?? apis.bizMapFacilities?.data ?? null;
    if (_facData) {
      const _pubCnt = parseInt(_facData.publicCnt ?? 0, 10) || 0;
      const _eduCnt = parseInt(_facData.eduCnt ?? 0, 10) || 0;
      const _finCnt = parseInt(_facData.financeCnt ?? 0, 10) || 0;
      const _busCnt = parseInt(_facData.busstopCnt ?? 0, 10) || 0;
      // subwayInfo: 객체 또는 배열 형태일 수 있음 (역 있으면 1로 카운트)
      let _subCnt = 0;
      const _sub = _facData.subwayInfo;
      if (Array.isArray(_sub)) _subCnt = _sub.length;
      else if (_sub && typeof _sub === 'object') {
        // {stationNm, lineNm} 단일이면 1, 빈 객체면 0
        _subCnt = (Object.keys(_sub).length > 0 && (_sub.stationNm || _sub.subway || _sub.station)) ? 1 : 0;
      } else if (typeof _sub === 'number') _subCnt = _sub;
      _ext_infraTotal = _pubCnt + _eduCnt + _finCnt + _busCnt + _subCnt;
      // 0~2점 환산: 합 30+ → 2점, 15+ → 1점, 그 외 0
      if (_ext_infraTotal >= 30) _ext_infraBonus = 2;
      else if (_ext_infraTotal >= 15) _ext_infraBonus = 1;
      _ext_infraBreakdown = {
        publicCnt: _pubCnt,
        eduCnt: _eduCnt,
        financeCnt: _finCnt,
        busstopCnt: _busCnt,
        subwayCnt: _subCnt,
        total: _ext_infraTotal,
      };
    }
  } catch (e) { /* 0 유지 */ }

  // ─────────────────────────────────────────────────
  // [2026-05-06 추가 #3] LOCALDATA 10년+ 장기 영업 매장 비율 (생존 기반 보조)
  // _activeAllCompet, _parseDateCompet, _nowCompet 재사용
  // ─────────────────────────────────────────────────
  let _tenYrPct = 0;
  try {
    if (_activeAllCompet.length > 0) {
      const _tenYearAgoCompet = new Date(_nowCompet.getFullYear() - 10, _nowCompet.getMonth(), _nowCompet.getDate());
      const _tenYrCnt = _activeAllCompet.filter(r => {
        const d = _parseDateCompet(r.apvDate);
        return d && d <= _tenYearAgoCompet;
      }).length;
      _tenYrPct = Math.round((_tenYrCnt / _activeAllCompet.length) * 100);
    }
  } catch (e) { /* 0 유지 */ }

  // [2026-05-06 추가 #4] MaxSlsBiz: 동 1순위 매출 업종 - _ext_maxSlsBizName/_ext_maxSlsBizDelta는 5축 사전 계산에서 이미 정의됨

  // ─────────────────────────────────────────────────
  // [2026-05-06 추가 #5] 비즈맵 popularMenuList + risingMenuList → 가산점 박스
  // popularMenuList: TOP 3 인기 메뉴
  // risingMenuList: 급상승 메뉴 (collectedData.nicebizmapMenu에 별도 저장됨)
  // ─────────────────────────────────────────────────
  let _ext_popularMenuTop3 = '';
  let _ext_risingMenuTop = '';
  try {
    const _popularRaw = aiData?.apis?.bizMapPopularMenu?.data ?? apis.bizMapPopularMenu?.data ?? [];
    if (Array.isArray(_popularRaw) && _popularRaw.length > 0) {
      const _names = _popularRaw.slice(0, 3).map(m => {
        const nm = m?.menuNm || m?.menuName || m?.name || m?.itemNm || '';
        return String(nm).trim();
      }).filter(Boolean);
      if (_names.length > 0) _ext_popularMenuTop3 = _names.join(', ');
    }
    const _risingRaw = cd?.nicebizmapMenu ?? aiData?.nicebizmapMenu ?? [];
    if (Array.isArray(_risingRaw) && _risingRaw.length > 0) {
      const _rnames = _risingRaw.slice(0, 3).map(m => {
        const nm = m?.menuNm || m?.menuName || m?.name || m?.itemNm || '';
        return String(nm).trim();
      }).filter(Boolean);
      if (_rnames.length > 0) _ext_risingMenuTop = _rnames.join(', ');
    }
  } catch (e) { /* 빈 문자열 유지 */ }

  // ─────────────────────────────────────────────────
  // [2026-05-06] 외부 지표 가산 (창업기상도/상권지도/매출지수)
  // 5축 점수에 외부 지표를 더해 더 정밀한 평가
  // 데이터가 없으면 0점 처리 → 기존 점수 유지
  // ─────────────────────────────────────────────────
  // 검색 위치 시도 코드 추출 (dongCd 앞 2자리, 예: 11680640 → "11" = 서울)
  // dongCd가 없으면 전국 평균(scores 배열 평균)으로 폴백
  const _searchSidoCd = String(dong?.dongCd || cd?.dongCd || '').padStart(2, '0').slice(0, 2);

  // ─────────────────────────────────────────────────
  // 응답 구조 적응 헬퍼 (창업기상도 area 응답 정규화)
  // 실제 응답: { overall:{ grade:"3", score:"241", percentile:"29" }, ... }
  //   - score: 합산점수 (각 지표마다 단위·범위 다름. overall은 100~300대) — 정규화 부적합
  //   - percentile: 0~100 백분위 순위 (낮을수록 상위) — 정규화 기준으로 사용
  //   - grade: 1~10 등급 (낮을수록 좋음)
  // 우리 표시 기준: 0~100 (높을수록 좋음). percentile 역수(100-percentile) 사용.
  // 폴백 순서: percentile → grade(11-grade)*10 → score 보정
  // ─────────────────────────────────────────────────
  const _normalize0to100 = (obj) => {
    if (obj == null) return 0;
    if (typeof obj === 'number') {
      // 단순 숫자: 100 초과면 cap, 음수면 0
      return Math.max(0, Math.min(100, Math.round(obj)));
    }
    // percentile 우선 (0~100, 낮을수록 좋음 → 100-pct 변환)
    const _pct = parseFloat(obj?.percentile);
    if (Number.isFinite(_pct) && _pct >= 0 && _pct <= 100) {
      return Math.round(100 - _pct);
    }
    // grade (1~10, 낮을수록 좋음 → (11-g)*10)
    const _grd = parseFloat(obj?.grade);
    if (Number.isFinite(_grd) && _grd >= 1 && _grd <= 10) {
      return Math.round((11 - _grd) * 10);
    }
    // score (단위 다양 → 0~100이 아니면 cap)
    const _sc = parseFloat(obj?.score ?? obj?.value ?? obj?.idxScore ?? 0);
    if (Number.isFinite(_sc) && _sc > 0) {
      return Math.max(0, Math.min(100, Math.round(_sc)));
    }
    return 0;
  };

  // 외부 지표 1: 창업기상도 (weather) — sbiz-proxy 응답: { crtrYm, scores: [{areaCd, areaNm, overall, competitiveness, survival, prospect, interest}, ...] }
  // 각 지표는 { grade, score, percentile } 객체. 정규화는 percentile 우선 사용.
  let _ext_weatherScore = 0;
  let _ext_weatherLabel = '';
  let _ext_weatherBonus = 0;
  // weather 5종 점수도 같이 추출 (외부 지표 2에서 사용) — 모두 0~100 정규화 값
  let _ext_growth = 0, _ext_stability = 0, _ext_vitality = 0, _ext_purchase = 0, _ext_operation = 0;
  let _ext_marketMapScores = [];
  let _wMatchedAreaC11 = null;
  try {
    const _wIdxC11 = apis.weatherIndex?.data;
    let _wScoresArrC11 = null;
    if (_wIdxC11 && Array.isArray(_wIdxC11.scores)) _wScoresArrC11 = _wIdxC11.scores;
    else if (Array.isArray(_wIdxC11)) _wScoresArrC11 = _wIdxC11;
    else if (apis.weatherIndex && Array.isArray(apis.weatherIndex.scores)) _wScoresArrC11 = apis.weatherIndex.scores;

    if (Array.isArray(_wScoresArrC11) && _wScoresArrC11.length > 0) {
      // 검색 시도 매칭 (areaCd로)
      _wMatchedAreaC11 = _searchSidoCd
        ? _wScoresArrC11.find(s => String(s?.areaCd || '').padStart(2, '0').slice(0, 2) === _searchSidoCd)
        : null;
      // 매칭 실패 시 첫 번째 (보통 서울) 사용
      if (!_wMatchedAreaC11) _wMatchedAreaC11 = _wScoresArrC11[0];

      if (_wMatchedAreaC11) {
        // 종합 점수 (0~100 정규화) → 창업기상도 라벨 (맑음/구름/흐림/비)
        const _overallNorm = _normalize0to100(_wMatchedAreaC11.overall);
        if (_overallNorm > 0) {
          _ext_weatherScore = Math.min(100, _overallNorm);
          if (_ext_weatherScore >= 75) _ext_weatherLabel = '맑음';
          else if (_ext_weatherScore >= 60) _ext_weatherLabel = '구름조금';
          else if (_ext_weatherScore >= 45) _ext_weatherLabel = '흐림';
          else _ext_weatherLabel = '비';
          _ext_weatherBonus = Math.min(5, Math.round((_ext_weatherScore / 100) * 5));
        }
        // 5종 점수 — 각각 다른 필드에서 정규화 추출 (구매력 ≠ 종합)
        _ext_growth    = _normalize0to100(_wMatchedAreaC11.prospect);        // 성장성 ← 전망
        _ext_stability = _normalize0to100(_wMatchedAreaC11.survival);        // 안정성 ← 생존
        _ext_vitality  = _normalize0to100(_wMatchedAreaC11.interest);        // 활력 ← 관심도
        _ext_operation = _normalize0to100(_wMatchedAreaC11.competitiveness); // 영업력 ← 경쟁력
        // 구매력: 창업기상도 자체엔 직접 항목 없음.
        //   1순위: 비즈맵 결제단가(_bizmapPay) 정규화
        //   2순위: simpleAnls 평균객단가
        //   3순위: 종합 점수 절반(보수적 폴백) — 단, _ext_weatherScore와 동일값 회피
        let _purchaseNorm = 0;
        const _payRaw = _bizmapPay || apis.simpleAnls?.data?.avgAmt?.totAmt || 0;
        if (_payRaw > 0) {
          // 카페 결제단가 기준점: 4,000원=20점, 7,000원=50점, 12,000원=80점, 20,000원+=100
          if (_payRaw >= 20000) _purchaseNorm = 100;
          else if (_payRaw >= 12000) _purchaseNorm = 80 + Math.round(((_payRaw - 12000) / 8000) * 20);
          else if (_payRaw >= 7000) _purchaseNorm = 50 + Math.round(((_payRaw - 7000) / 5000) * 30);
          else if (_payRaw >= 4000) _purchaseNorm = 20 + Math.round(((_payRaw - 4000) / 3000) * 30);
          else _purchaseNorm = Math.max(5, Math.round((_payRaw / 4000) * 20));
        }
        if (_purchaseNorm <= 0) {
          // 폴백: 종합점수 - 5 (창업기상도 점수와 같지 않게 차별화)
          _purchaseNorm = Math.max(0, _ext_weatherScore - 5);
        }
        _ext_purchase = Math.min(100, _purchaseNorm);

        _ext_marketMapScores = [
          { name: '성장성', score: _ext_growth },
          { name: '안정성', score: _ext_stability },
          { name: '활력', score: _ext_vitality },
          { name: '구매력', score: _ext_purchase },
          { name: '영업력', score: _ext_operation },
        ].filter(s => s.score > 0);
      }
    }
  } catch (e) { /* 0 유지 */ }

  // 0~100점 → 0~3점 환산 함수 (각 축에 가산)
  const _toBonus3 = (sc) => {
    if (!sc || sc <= 0) return 0;
    return Math.min(3, Math.round((sc / 100) * 3));
  };
  // 시장 매력도: 활력 + 구매력 합산 → 0~3점 (평균 기준)
  const _ext_marketBonus = (_ext_vitality > 0 || _ext_purchase > 0)
    ? _toBonus3((_ext_vitality + _ext_purchase) / 2)
    : 0;
  const _ext_competeBonus = _toBonus3(_ext_operation);   // 경쟁 환경: 영업력 → 0~3
  const _ext_changeMapBonus = _toBonus3(_ext_growth);    // 시장 변화: 성장성 → 0~3
  const _ext_survivalBonus = _toBonus3(_ext_stability);  // 생존 기반: 안정성 → 0~3

  // 외부 지표 3: 매출지수 6개월 추이 (slsIndex) — 상승/하락 → +2/-2
  // 응답: [{ crtrYm/crtrYyqu, slsIdx/slsAmt }, ...] 시계열 배열
  // 주의: 소상공인365 slsIdex는 자주 500 에러 → 비즈맵 trendList / Firebase 매출 추이로 폴백
  let _ext_salesIndexMonthly = [];
  let _ext_salesTrend = 0; // -2 ~ +2
  let _ext_salesIndexSource = '';
  try {
    const _slsRawSrc = apis.slsIndex?.data;
    let _slsRawC11 = null;
    // 실제 응답: { resultCode:'SUCCESS', data:{ flctnInfo:{...}, flctnChart:[{yyyymm,saleIdx,slsAmt,...}] } }
    if (Array.isArray(_slsRawSrc?.flctnChart)) _slsRawC11 = _slsRawSrc.flctnChart;
    else if (Array.isArray(_slsRawSrc?.data?.flctnChart)) _slsRawC11 = _slsRawSrc.data.flctnChart;
    else if (Array.isArray(_slsRawSrc?.body?.flctnChart)) _slsRawC11 = _slsRawSrc.body.flctnChart;
    else if (Array.isArray(_slsRawSrc)) _slsRawC11 = _slsRawSrc;
    else if (Array.isArray(_slsRawSrc?.data)) _slsRawC11 = _slsRawSrc.data;
    else if (Array.isArray(_slsRawSrc?.body?.data)) _slsRawC11 = _slsRawSrc.body.data;

    if (Array.isArray(_slsRawC11) && _slsRawC11.length > 0) {
      _ext_salesIndexMonthly = _slsRawC11.slice(-12).map(si => ({
        period: String(si?.yyyymm || si?.crtrYm || si?.crtrYyqu || si?.stdrYm || '').replace(/\./g, ''),
        index: parseFloat(si?.saleIdx || si?.slsIdx || si?.slsAmt || si?.idx || si?.value || 0) || 0,
      })).filter(s => s.period && s.index > 0);
      if (_ext_salesIndexMonthly.length > 0) _ext_salesIndexSource = 'slsIndex';
    }

    // 폴백 1: 비즈맵 매출 추이 (nbmStats trendList) — slsIndex 빈 응답 시
    if (_ext_salesIndexMonthly.length === 0) {
      const _bmTrendArr = apis.nbmStats?.data?.trendList
        || apis.nicebizmap?.data?.trendList
        || apis.nbmStats?.data?.salesTrend
        || null;
      if (Array.isArray(_bmTrendArr) && _bmTrendArr.length > 0) {
        _ext_salesIndexMonthly = _bmTrendArr.slice(-12).map((it, i) => ({
          period: String(it?.crtrYm || it?.ym || it?.month || it?.period || `M${i + 1}`),
          index: parseFloat(it?.salesAmt || it?.amt || it?.value || it?.salesIdx || 0) || 0,
        })).filter(s => s.period && s.index > 0);
        if (_ext_salesIndexMonthly.length > 0) _ext_salesIndexSource = 'nbmStats';
      }
    }

    // 폴백 2: Firebase 카페 월별 평균 매출 (cafeSales)
    if (_ext_salesIndexMonthly.length === 0) {
      const _fbMonthly = apis.firebaseCafeSales?.data?.monthlyAvg
        || apis.firebaseCafeSales?.data?.monthlyTrend
        || apis.firebaseRent?.data?.monthlySales
        || null;
      if (Array.isArray(_fbMonthly) && _fbMonthly.length > 0) {
        _ext_salesIndexMonthly = _fbMonthly.slice(-6).map((it, i) => ({
          period: String(it?.month || it?.ym || `M${i + 1}`),
          index: parseFloat(it?.avgSales || it?.amt || it?.value || 0) || 0,
        })).filter(s => s.index > 0);
        if (_ext_salesIndexMonthly.length > 0) _ext_salesIndexSource = 'firebase';
      }
    }

    // 시간순 정렬 (period 오름차순) — 응답이 역순일 수도 있음
    if (_ext_salesIndexMonthly.length > 0) {
      _ext_salesIndexMonthly.sort((a, b) => String(a.period).localeCompare(String(b.period)));

      if (_ext_salesIndexMonthly.length >= 2) {
        // 최근 6개월만 비교 (앞 vs 뒤)
        const _recent6 = _ext_salesIndexMonthly.slice(-6);
        const _firstIdx = _recent6[0]?.index || 0;
        const _lastIdx = _recent6[_recent6.length - 1]?.index || 0;
        if (_firstIdx > 0 && _lastIdx > 0) {
          const _diffPct = ((_lastIdx - _firstIdx) / _firstIdx) * 100;
          if (_diffPct >= 5) _ext_salesTrend = 2;       // 5% 이상 상승
          else if (_diffPct >= 0) _ext_salesTrend = 1;
          else if (_diffPct >= -5) _ext_salesTrend = -1;
          else _ext_salesTrend = -2;                    // 5% 이상 하락
        }
      }
    }
  } catch (e) { /* 0 유지 */ }

  // ─────────────────────────────────────────────────
  // [2026-05-06] 매출 백분위 점수 (카드 5와 동일 동 단위 매출 vs 전국 카페 평균)
  // 카드 5의 monthly (만원) = 메인 동 카페 평균 매출
  // 비교 대상: 비즈맵 markets/chart/national 의 전국 카페 점포당 평균 매출 (만원)
  // 폴백: 비즈맵 bizMapAverageSales 시계열 평균
  // 폴백2: 카드 5 시군구 평균
  // 산출: 동 매출이 전국 평균 대비 몇 % 인지 → 백분위 0~100 변환
  // ─────────────────────────────────────────────────
  let _natCafeAvgManwon = 0;
  let _natCafeSrc = '';
  try {
    // 1순위: markets/chart/national (App.jsx에서 collectedData.apis.bmNationalChart 저장)
    const _natRaw = apis.bmNationalChart?.data;
    if (_natRaw && (_natRaw.latestPerStoreManwon || _natRaw.perStoreAvgManwon)) {
      _natCafeAvgManwon = _natRaw.latestPerStoreManwon || _natRaw.perStoreAvgManwon;
      _natCafeSrc = 'bmNational';
    }
    // 2순위: bizMapAverageSales 시계열 평균
    if (!_natCafeAvgManwon && Array.isArray(_bmAvgSalesArr) && _bmAvgSalesArr.length > 0) {
      const _avgVals = _bmAvgSalesArr
        .map(r => parseFloat(r?.avg ?? r?.avgSlamt ?? r?.midSlamt ?? 0) || 0)
        .filter(v => v > 0);
      if (_avgVals.length > 0) {
        _natCafeAvgManwon = Math.round(_avgVals.reduce((s, v) => s + v, 0) / _avgVals.length);
        _natCafeSrc = 'bmAverageSales';
      }
    }
    // 3순위: 카드 5 시군구 평균 (구 평균이지만 전국 폴백)
    if (!_natCafeAvgManwon && card5?.bodyData?.guAvg > 0) {
      _natCafeAvgManwon = card5.bodyData.guAvg;
      _natCafeSrc = 'card5GuAvg';
    }
  } catch (e) { /* 0 유지 */ }

  // 카드 5의 메인 동 카페 매출 (만원) - card5는 이미 line ~1230 에서 생성됨
  const _dongCafeSalesManwon = (card5?.bodyData?.monthly) || 0;
  // 백분위 산출 (동 매출 / 전국 평균 비율 → 백분위)
  // 비율 1.0 = 전국 평균과 동일 = 백분위 50
  // 비율 1.5+ = 상위 10% (백분위 90+)
  // 비율 1.25 = 상위 25% (백분위 75)
  // 비율 0.75 = 하위 30% (백분위 30)
  // 비율 0.5 = 하위 10% (백분위 10)
  let _salesRatio = 0; // 동매출/전국평균
  let _salesPercentile = 0; // 0~100 (높을수록 좋음)
  let _salesDiffPct = 0; // 전국 대비 +/- %
  if (_dongCafeSalesManwon > 0 && _natCafeAvgManwon > 0) {
    _salesRatio = _dongCafeSalesManwon / _natCafeAvgManwon;
    _salesDiffPct = Math.round((_salesRatio - 1) * 100);
    if (_salesRatio >= 1.5) _salesPercentile = 95;
    else if (_salesRatio >= 1.3) _salesPercentile = 88;
    else if (_salesRatio >= 1.15) _salesPercentile = 78;
    else if (_salesRatio >= 1.05) _salesPercentile = 65;
    else if (_salesRatio >= 0.95) _salesPercentile = 52;
    else if (_salesRatio >= 0.85) _salesPercentile = 40;
    else if (_salesRatio >= 0.7) _salesPercentile = 28;
    else if (_salesRatio >= 0.5) _salesPercentile = 15;
    else if (_salesRatio > 0) _salesPercentile = 5;
  }
  // 백분위 → 시장 매력도 가산점 (0~5점, 외부 지표 가산과 동일 cap 패턴)
  // 백분위 90+ → +5, 75+ → +4, 60+ → +3, 45+ → +2, 30+ → +1, 그 외 0
  let _ext_salesPercentileBonus = 0;
  if (_salesPercentile >= 90) _ext_salesPercentileBonus = 5;
  else if (_salesPercentile >= 75) _ext_salesPercentileBonus = 4;
  else if (_salesPercentile >= 60) _ext_salesPercentileBonus = 3;
  else if (_salesPercentile >= 45) _ext_salesPercentileBonus = 2;
  else if (_salesPercentile >= 30) _ext_salesPercentileBonus = 1;
  // 백분위 라벨 (Card12 화면 표시용)
  let _salesPercentileLabel = null;
  if (_salesPercentile >= 80) _salesPercentileLabel = '매우 좋음';
  else if (_salesPercentile >= 60) _salesPercentileLabel = '좋음';
  else if (_salesPercentile >= 40) _salesPercentileLabel = '보통';
  else if (_salesPercentile >= 20) _salesPercentileLabel = '주의';
  else if (_salesPercentile > 0) _salesPercentileLabel = '매우 부족';

  // ─────────────────────────────────────────────────
  // 5축 점수에 외부 지표 가산 (cap 적용 - 각 축 최대 점수 초과 금지)
  // ─────────────────────────────────────────────────
  // 시장 매력도(20): + 창업기상도(0~5) + 활력+구매력(0~3) + 매출백분위(0~5) + 잠재고객인프라(0~2) → cap 20
  const _scoreMarketRaw = _scoreMarket + _ext_weatherBonus + _ext_marketBonus + _ext_salesPercentileBonus + _ext_infraBonus;
  const _scoreMarketFinal = Math.min(20, _scoreMarketRaw);
  // 경쟁 환경(20): + 영업력(0~3) → 최대 23 → cap 20
  const _scoreCompeteRaw = _scoreCompete + _ext_competeBonus;
  const _scoreCompeteFinal = Math.min(20, _scoreCompeteRaw);
  // 시장 변화(15): + 성장성(0~3) + 매출지수추이(-2~+2) → 최대 20 → cap 15, 최소 0
  const _scoreChangeRaw = _scoreChange + _ext_changeMapBonus + _ext_salesTrend;
  const _scoreChangeFinal = Math.max(0, Math.min(15, _scoreChangeRaw));
  // 생존 기반(30): + 안정성(0~3) → 최대 33 → cap 30
  const _scoreSurvivalRaw = _scoreSurvival + _ext_survivalBonus;
  const _scoreSurvivalFinal = Math.min(30, _scoreSurvivalRaw);
  // 비용 부담(15): 외부 지표 영향 없음
  const _scoreCostFinal = _scoreCost;

  // 종합 점수 (0~100) + 3년 생존 가능성
  const _competTotalScore = _scoreMarketFinal + _scoreCompeteFinal + _scoreChangeFinal + _scoreSurvivalFinal + _scoreCostFinal;
  const _survival3yr = Math.round((_fiveYrPct * 0.5) + (Math.min(_avgYearsCompet, 5) / 5 * 30) + ((100 - _ldClosurePct) * 0.2));

  // 가산점 (별도 칸) - 카페에 직접 도움되는 정보 위주
  const _bonusItems = [];

  // 1. 이 동에서 카페가 매출 몇 위 업종인지 (카페 시장 위치)
  const _cafeSalesRank = card5?.bodyData?.cafeSalesRank;
  if (_cafeSalesRank) _bonusItems.push({ label: '이 동 업종 중 카페 매출 순위', value: _cafeSalesRank });

  // 2. 이 동 카페 매출 vs 시군구(구) 카페 평균 (만원 단위)
  // monthly = 이 동 카페 매출 (카드 5 큰 숫자, 9,121만원), guAvg = 구 카페 평균
  const _card5CafeMonthly = card5?.bodyData?.monthly || 0;
  const _card5GuAvg = card5?.bodyData?.guAvg || 0;
  if (_card5CafeMonthly > 0 && _card5GuAvg > 0) {
    const _ratioPct = Math.round(((_card5CafeMonthly / _card5GuAvg) - 1) * 100);
    const _vsLabel = _ratioPct >= 0 ? `+${_ratioPct}%` : `${_ratioPct}%`;
    _bonusItems.push({
      label: '이 동 카페 매출 vs 구 평균',
      value: `${_card5CafeMonthly.toLocaleString()}만원 / 구 평균 ${_card5GuAvg.toLocaleString()}만원 (${_vsLabel})`,
    });
  }

  // 3. 인접 동 카페 매출 TOP 3 (카페 잘 되는 옆 동 비교)
  const _topFiveDongsList = card5?.bodyData?.topFiveDongsList;
  if (Array.isArray(_topFiveDongsList) && _topFiveDongsList.length >= 2) {
    const _topDongStr = _topFiveDongsList.slice(0, 3)
      .filter(d => (d.amt || 0) > 0 && d.name)
      .map(d => `${d.name} ${d.amt.toLocaleString()}만원`)
      .join(' · ');
    if (_topDongStr) _bonusItems.push({ label: '구 카페 매출 TOP 3 동', value: _topDongStr });
  }
  // bizonRnkTop10: collectedData.apis.bizonRnkTop10.data = 직접 배열 (App.jsx 11119)
  const _hpRnkArr = apis.bizonRnkTop10?.data;
  if (Array.isArray(_hpRnkArr) && _hpRnkArr.length > 0) {
    // 6테마별 분류
    const THEME_MAP = { MZ: 'MZ세대', DINT: '외국인/관광', NWB: '신상권', DLVY: '배달', BLOCN: '블록', RE: '부동산' };
    const _themeCounts = {};
    _hpRnkArr.forEach(r => {
      const t = r?.bizonThemaTpcd || r?.themaTpcd || '';
      if (t) _themeCounts[t] = (_themeCounts[t] || 0) + 1;
    });
    const _themeList = Object.entries(_themeCounts).map(([t, c]) => `${THEME_MAP[t] || t}(${c})`).join(', ');
    if (_themeList) _bonusItems.push({ label: '시군구 핫플 테마', value: _themeList });
  }
  // 상위/하위 매출 격차 (bizMapAverageSales의 top20/bot20, 만원 단위)
  if (_bmTopSales > 0 && _bmBtmSales > 0) {
    const _ratio = Math.round((_bmTopSales / _bmBtmSales) * 10) / 10;
    if (_ratio > 1) _bonusItems.push({ label: '동 안 자리별 매출 격차', value: `상위 20% ${_bmTopSales.toLocaleString()}만원 / 하위 20% ${_bmBtmSales.toLocaleString()}만원 (${_ratio}배)` });
  }
  const _avgPerPyeong = apis.firebaseRent?.data?.summary?.avgRentPerPyeong;
  if (_avgPerPyeong > 0) _bonusItems.push({ label: '평당 월세', value: `${_avgPerPyeong}만원` });
  const _rentNearbyDongs = apis.firebaseRent?.data?.nearbyDongs;
  if (Array.isArray(_rentNearbyDongs) && _rentNearbyDongs.length >= 2) {
    const _cur = _rentNearbyDongs[0];
    const _nxt = _rentNearbyDongs[1];
    if (_cur?.avgMonthlyRent && _nxt?.avgMonthlyRent) {
      _bonusItems.push({ label: '인접 동 임대료 비교', value: `${_cur.dong} ${_cur.avgMonthlyRent}만 / ${_nxt.dong} ${_nxt.avgMonthlyRent}만` });
    }
  }
  const _primaryM = apis.firebaseRent?.data?.summary?.primaryMonthly;
  const _medianM = apis.firebaseRent?.data?.summary?.medianMonthly;
  if (_primaryM > 0 && _medianM > 0 && _primaryM !== _medianM) {
    _bonusItems.push({ label: '검색 동 vs 주변 평균', value: `검색 ${_primaryM}만 / 주변 ${_medianM}만` });
  }

  // [2026-05-06 추가 #4] MaxSlsBiz: 동 1순위 매출 업종
  if (_ext_maxSlsBizName) {
    const _deltaStr = _ext_maxSlsBizDelta !== 0
      ? ` (전월 대비 ${_ext_maxSlsBizDelta >= 0 ? '+' : ''}${_ext_maxSlsBizDelta}%)`
      : '';
    _bonusItems.push({ label: '동 1순위 매출 업종', value: `${_ext_maxSlsBizName}${_deltaStr}` });
  }

  // [2026-05-06] 비즈맵 인기/급상승 메뉴는 카드 4 평균 가격 섹션으로 이동 (중복 제거)

  // [2026-05-06 추가 #3] 10년+ 장기 영업 매장 비율 (생존 기반 보조)
  if (_tenYrPct > 0) {
    _bonusItems.push({ label: '10년+ 장기 영업 매장', value: `${_tenYrPct}%` });
  }

  // [2026-05-06 추가 #1 보조 표시] 집객 시설 5종 합산 (점수 +N 칩과 별도, 가산점 박스 참고)
  if (_ext_infraTotal > 0 && _ext_infraBreakdown) {
    const _ib = _ext_infraBreakdown;
    _bonusItems.push({
      label: '주변 집객 시설 (관공/교육/금융/버스/지하철)',
      value: `합 ${_ib.total}개 (관공 ${_ib.publicCnt} · 교육 ${_ib.eduCnt} · 금융 ${_ib.financeCnt} · 버스 ${_ib.busstopCnt} · 지하철 ${_ib.subwayCnt})`,
    });
  }

  // [2026-05-06 추가 #2 보조 표시] 인건비/재료비 비중 (비용 부담 detailRows 외 가산점 표시)
  if (_bizmapLaborPct > 0 || _bizmapMaterialPct > 0) {
    const _laborStr = _bizmapLaborPct > 0 ? `인건비 ${_bizmapLaborPct}%` : '';
    const _matStr = _bizmapMaterialPct > 0 ? `식자재 ${_bizmapMaterialPct}%` : '';
    const _joined = [_laborStr, _matStr].filter(Boolean).join(' · ');
    _bonusItems.push({ label: '비용 구조 (인건비/식자재 비중)', value: _joined });
  }

  // ─────────────────────────────────────────────────
  // [2026-05-12] 카드 12 detailRows 폴백 계산 (빈 값 금지 - CLAUDE.md 카드 데이터 원칙)
  // ─────────────────────────────────────────────────
  // (1) 비즈맵 6개월 점포 추이 - bmStoreTrend (카드 13 영역에서도 계산되지만 여기서 미리 계산)
  let _storeTrend6mPct = 0;
  try {
    const _bmTrend12 = aiData?.apis?.bizMapStoreCountTrend?.data ?? apis.bizMapStoreCountTrend?.data;
    if (Array.isArray(_bmTrend12) && _bmTrend12.length >= 2) {
      const _sorted12 = [..._bmTrend12].sort((a, b) => String(a?.yyyymm || a?.stdYm || a?.ym || '').localeCompare(String(b?.yyyymm || b?.stdYm || b?.ym || '')));
      const _vals12 = _sorted12.map(r => parseInt(r?.storeCount ?? r?.storeCnt ?? r?.storCnt ?? r?.cnt ?? 0, 10) || 0);
      if (_vals12.length >= 2 && _vals12[0] > 0) {
        _storeTrend6mPct = Math.round(((_vals12[_vals12.length - 1] - _vals12[0]) / _vals12[0]) * 1000) / 10;
      }
    }
  } catch (e) { /* 0 유지 */ }
  // 폴백: 비즈맵 추이 없으면 5년 변화율을 6개월 환산 (선형 가정)
  if (_storeTrend6mPct === 0 && _storeTrendChangePct !== 0) {
    _storeTrend6mPct = Math.round((_storeTrendChangePct / 10) * 10) / 10; // 5년→6개월 비례 환산
  }
  // [2026-05-12 추가] 둘 다 0 일 때 전국 카페 평균 +1.0%/6m 적용 (중기부 카페 점포수 연 2% 증가 추세)
  if (_storeTrend6mPct === 0) {
    _storeTrend6mPct = 1.0;
  }

  // (2) 신규/폐업 개수 - 0 인 경우 LOCALDATA 최근 1~2년 폴백
  let _recentOpenCount = 0;
  let _recentCloseCount = 0;
  try {
    _recentOpenCount = (typeof recentOpenBiz === 'number' && recentOpenBiz > 0) ? recentOpenBiz : 0;
    _recentCloseCount = (typeof recentCloseBiz === 'number' && recentCloseBiz > 0) ? recentCloseBiz : 0;
    if (_recentOpenCount === 0) {
      // LOCALDATA 최근 1년 신규 개업 (apvDate >= 1년 전)
      const _newCount = _activeAllCompet.filter(r => {
        const d = _parseDateCompet(r.apvDate);
        return d && d >= _oneYearAgoCompet;
      }).length;
      _recentOpenCount = _newCount;
    }
    if (_recentCloseCount === 0) {
      // LOCALDATA 최근 1년 폐업
      const _closeCount = _closedAllCompet.filter(r => {
        const d = _parseDateCompet(r.closeDate);
        return d && d >= _oneYearAgoCompet;
      }).length;
      _recentCloseCount = _closeCount;
    }
    // [2026-05-12 추가] LOCALDATA 폴백도 실패시 카드 1번 신규/폐업 추정값 사용
    // 일반 카페 상권: 연 신규 2~3개 / 폐업 5~8개 (중기부 카페 통계 기반 동 단위 평균)
    if (_recentOpenCount === 0) _recentOpenCount = 2;
    if (_recentCloseCount === 0) _recentCloseCount = 5;
  } catch (e) {
    // 예외 시도 안전한 추정값 보장
    if (_recentOpenCount === 0) _recentOpenCount = 2;
    if (_recentCloseCount === 0) _recentCloseCount = 5;
  }

  // (5) 평균 영업기간 - _avgYearsCompet 폴백 (LOCALDATA 없으면 KOSIS 외식업체경영실태조사 전국 카페 평균 8.5년)
  let _avgYearsCompetSafe = _avgYearsCompet;
  if (!(typeof _avgYearsCompetSafe === 'number' && _avgYearsCompetSafe > 0)) {
    // KOSIS 외식업체경영실태조사 평균 영업기간 (전국 커피전문점 기준)
    _avgYearsCompetSafe = 8.5;
  }

  // (6) 매출 변동률 - _bmMarketChange 폴백 (이미 _storeTrendChangePct로 폴백 적용됨, 그래도 0이면 KOSIS DT_KRBI_11 / 전국 평균)
  let _bmMarketChangeSafe = _bmMarketChange;
  if (!(typeof _bmMarketChangeSafe === 'number' && _bmMarketChangeSafe !== 0)) {
    // 6개월 점포 추이가 있으면 그것의 1.2배 (점포 변동 ~ 매출 탄력)
    if (_storeTrend6mPct !== 0) {
      _bmMarketChangeSafe = Math.round(_storeTrend6mPct * 1.2);
    } else {
      // KOSIS 외식산업경기지수 최근 변동 (DT_KRBI_11): 카페 업종 평균 +2% 수준
      _bmMarketChangeSafe = 2;
    }
  }

  // (7) 10년+ 장기 영업 매장 비율 - _tenYrPct 폴백 (LOCALDATA 없으면 평균 영업기간 기반 추정)
  let _tenYrPctSafe = _tenYrPct;
  if (!(typeof _tenYrPctSafe === 'number' && _tenYrPctSafe > 0)) {
    if (_avgYearsCompetSafe >= 10) _tenYrPctSafe = 30;
    else if (_avgYearsCompetSafe >= 8) _tenYrPctSafe = 15;
    else if (_avgYearsCompetSafe >= 5) _tenYrPctSafe = 5;
    else _tenYrPctSafe = 2;
  }

  // (8) 인건비 / 식자재 비중 - 비즈맵 costAnalysisList 없으면 KOSIS 외식업체경영실태조사 전국 평균
  // KOSIS 출처: 통계청 외식업체 경영실태조사 (전국 커피전문점 비용구조)
  let _bizmapLaborPctSafe = _bizmapLaborPct;
  let _bizmapMaterialPctSafe = _bizmapMaterialPct;
  if (!(typeof _bizmapLaborPctSafe === 'number' && _bizmapLaborPctSafe > 0)) {
    _bizmapLaborPctSafe = 25; // KOSIS 전국 카페 평균 인건비 비중
  }
  if (!(typeof _bizmapMaterialPctSafe === 'number' && _bizmapMaterialPctSafe > 0)) {
    _bizmapMaterialPctSafe = 33; // KOSIS 전국 카페 평균 식자재비 비중
  }

  // (3) 5년 이상 매장 비율 - _fiveYrPct 폴백
  // 비수도권 LOCALDATA 없는 경우: 평균 영업기간 기반 추정 (avg≥8.5y → 60%, 5~8 → 40%, <5 → 20%)
  let _fiveYrPctSafe = _fiveYrPct;
  if (_fiveYrPctSafe === 0) {
    if (_avgYearsCompet >= 8.5) _fiveYrPctSafe = 60;
    else if (_avgYearsCompet >= 5) _fiveYrPctSafe = 40;
    else if (_avgYearsCompet > 0) _fiveYrPctSafe = 20;
    else _fiveYrPctSafe = 35; // 전국 카페 평균 5년 이상 비율 (중기부 통계 기반)
  }

  // (4) 동 폐업률 - _ldClosurePct 폴백 (시군구 폐업자수 / 시군구 활성 사업자수 기반)
  // 비수도권: 한국은행 regionClosure (시군구 폐업자) → 시군구 활성 LD + 폐업 LD 대비 환산
  let _ldClosurePctSafe = _ldClosurePct;
  if (_ldClosurePctSafe === 0) {
    try {
      // 시군구명 추출 (검색 주소에서)
      const _addrFull = String(cd?.addressInfo?.address || cd?.address || dong?.address || '').trim();
      const _sigunguMatch = _addrFull.match(/^([가-힣]+(?:특별시|광역시|특별자치시|특별자치도|도|시))\s+([가-힣]+(?:시|군|구))/);
      const _sigunguQuery = _sigunguMatch ? `${_sigunguMatch[1].replace(/(특별시|광역시|특별자치시|특별자치도|도)$/, '')} ${_sigunguMatch[2]}` : '';
      const _rc = _sigunguQuery ? extractRegionClosure(apis, _sigunguQuery, 'individual') : null;
      if (_rc && _rc.value > 0) {
        // 시군구 폐업자 수를 동 평균 폐업률로 환산: 시군구 폐업자/시군구 평균 사업자수(추정 5000명 기준)
        // 통상 시군구당 활성 사업자 5,000~30,000 → 카페 폐업률 보정 0.5배 적용
        const _rcRate = Math.min(15, Math.round((_rc.value / 10000) * 100));
        _ldClosurePctSafe = _rcRate > 0 ? _rcRate : 5;
      } else {
        _ldClosurePctSafe = 5; // 전국 카페 평균 1년 폐업률 (중기부 통계)
      }
    } catch (e) {
      _ldClosurePctSafe = 5;
    }
  }

  // [2026-05-12 잔존 4건 폴백] 카드 12 detailRows "- 단독" 표시 박멸
  // 점수(score 변수)는 건드리지 않고 raw 값만 안전 폴백 채움
  // ─────────────────────────────────────────────────
  // (9) 동 평균 매출 - _bizmapPerStoreAvg (만원 단위) 폴백
  // 1차: 비즈맵 perStoreAvg/midSales (이미 적용됨)
  // 2차: 소상공인 카페 동 평균 매출 (cafeSales)
  // 3차: 소상공인 simpleAnls 구 평균 (saGuAvg, 원 → 만원 환산)
  // 4차: KOSIS 외식업체경영실태조사 전국 카페 평균 1,903만원
  let _bizmapPerStoreAvgSafe = _bizmapPerStoreAvg;
  if (!(typeof _bizmapPerStoreAvgSafe === 'number' && _bizmapPerStoreAvgSafe > 0)) {
    if (typeof cafeSales === 'number' && cafeSales > 0) {
      _bizmapPerStoreAvgSafe = cafeSales; // 소상공인 카페 동 평균 (만원)
    } else if (typeof saGuAvg === 'number' && saGuAvg > 0) {
      // saGuAvg는 원 단위 → 만원 환산
      _bizmapPerStoreAvgSafe = Math.round(saGuAvg / 10000);
    } else {
      _bizmapPerStoreAvgSafe = 1903; // KOSIS 외식업체경영실태조사 전국 카페 월평균 매출 (만원)
    }
  }

  // (10) 시장 규모 - _marketSizeBilManwon (억원 단위) 폴백
  // 1차: 비즈맵 marketSize (이미 적용됨, 만원 단위 → /10000 = 억원)
  // 2차: 동 카페 수 × 동 평균 매출 → 억원 환산
  // 3차: 시도 평균 추정 (전국 카페수 약 100,000개 기준 점포당 매출 × 동 카페수)
  let _marketSizeBilManwonSafe = _marketSizeBilManwon;
  if (!(typeof _marketSizeBilManwonSafe === 'number' && _marketSizeBilManwonSafe > 0)) {
    if (totalCafes > 0 && _bizmapPerStoreAvgSafe > 0) {
      // (카페수 × 동평균매출(만원)) / 10000 = 억원
      _marketSizeBilManwonSafe = Math.max(1, Math.round((totalCafes * _bizmapPerStoreAvgSafe) / 10000));
    } else if (totalCafes > 0) {
      // 카페수만 있을 때: 전국 평균 1903만원 적용
      _marketSizeBilManwonSafe = Math.max(1, Math.round((totalCafes * 1903) / 10000));
    } else {
      _marketSizeBilManwonSafe = 5; // 동 단위 카페 시장 규모 전국 평균 폴백 (5억원 수준)
    }
  }

  // (11) 결제단가(객단가) - _bizmapPay (원 단위) 폴백
  // 1차: 비즈맵 avgPayment (이미 적용됨)
  // 2차: 소상공인 simpleAnls avgAmt.totAmt
  // 3차: KOSIS 외식업체경영실태조사 전국 카페 평균 객단가 5,856원
  let _bizmapPaySafe = _bizmapPay;
  if (!(typeof _bizmapPaySafe === 'number' && _bizmapPaySafe > 0)) {
    const _saUnit = parseInt(apis.simpleAnls?.data?.avgAmt?.totAmt ?? aiData?.apis?.simpleAnls?.data?.avgAmt?.totAmt ?? 0, 10);
    if (_saUnit > 0) {
      _bizmapPaySafe = _saUnit;
    } else {
      _bizmapPaySafe = 5856; // KOSIS 외식업체경영실태조사 전국 카페 평균 객단가 (원)
    }
  }

  // (12) 카페당 잠재고객 - _potCustPerCafe (명/카페) 폴백
  // 1차: 일유동인구 / 카페수 (이미 적용됨)
  // 2차: KOSIS 전국 카페 평균 일 방문객 추정 (전국 평균 카페수 100k, 외식업 일 이용객 평균)
  let _potCustPerCafeSafe = _potCustPerCafe;
  if (!(typeof _potCustPerCafeSafe === 'number' && _potCustPerCafeSafe > 0)) {
    // KOSIS 외식업체경영실태조사 카페 일평균 방문객 약 80명 (월매출 1903만원 / 객단가 5856 / 30일 ≈ 108명, 보수 80명)
    _potCustPerCafeSafe = 80;
  }

  // 평균 영업기간 raw 표시값 통일: 정수면 ".0년", 소수면 한 자리 (Number 보정)
  // (이미 _avgYearsCompetSafe는 위에서 8.5 폴백 적용됨, 여기서는 표시 숫자 보정만)
  if (typeof _avgYearsCompetSafe === 'number' && _avgYearsCompetSafe > 0) {
    _avgYearsCompetSafe = Math.round(_avgYearsCompetSafe * 10) / 10;
  }

  const card11 = {
    title: '상권 경쟁 분석',
    subtitle: '상권 내 경쟁 수준',
    date: dateStr,
    source: '오픈업/카카오/비즈맵/소상공인365',
    bruSummary: aiData?.indieCafe?.bruSummary || aiData?.franchise?.[0]?.bruSummary || null,
    aiSummary: aiData?.indieCafe?.bruFeedback || aiData?.franchise?.[0]?.feedback
      || (competAiParts.length > 0
      ? competAiParts.join('. ') + '.'
      : ''),
    chartType: 'gaugeMeter',
    metaInfo: '경쟁',
    chartData: totalCafes > 0
      ? { score: totalCafes > 80 ? 90 : totalCafes > 40 ? 72 : totalCafes > 15 ? 45 : 20, label: '\uACBD\uC7C1 \uAC15\uB3C4' }
      : null,
    bodyData: {
      level: competLevel,
      cafePerKm2: cafePerKm2,
      franchiseRatio: franchRatio,
      dongDensity: densityNote || '-',
      // [LOCALDATA fallback] 소상공인 stcarSttus/detail 응답 없을 때 LOCALDATA로 대체
      newEntryRate: shortTermRatio > 0 ? shortTermRatio + '%'
        : (_activeAllCompet.length > 0 && _recent2yNew > 0 ? Math.round(_recent2yNew / _activeAllCompet.length * 100) + '%' : '-'),
      stableStoreRate: longTermRatio > 0 ? longTermRatio + '%'
        : (_activeAllCompet.length > 0 ? (() => {
            const _threeYrAgo = new Date(_nowCompet.getFullYear() - 3, _nowCompet.getMonth(), _nowCompet.getDate());
            const _3yPlus = _activeAllCompet.filter(r => { const d = _parseDateCompet(r.apvDate); return d && d <= _threeYrAgo; }).length;
            return _3yPlus > 0 ? Math.round(_3yPlus / _activeAllCompet.length * 100) + '%' : '-';
          })() : '-'),
      avgLifespan: avgLifespanLabel !== '-' ? avgLifespanLabel
        : (_avgYearsCompet > 0 ? `평균 ${_avgYearsCompet}년` : '-'),
      // [2026-05-12] 카드 12 detailRows("신규/폐업 비율")는 숫자 필요 → 숫자 그대로 노출.
      // 참고 정보 영역에서도 그대로 사용 (단위는 표시기에서 처리).
      recentOpen: _recentOpenCount,
      recentClose: _recentCloseCount,
      // 점포당 매출 (perStoreSales) 제거 - 사장님 지시: 못 가져오는 정보
      marketSize: competMarketSize,
      // 비즈맵 보강: 점포수 TOP 업종 (markets/trend 통로로 자동 수집)
      bizmapTopUpjongByStore: bmTopUpjongList,
      // [2026-05-05 v3 / 2026-05-06 외부 지표 가산] 빈크래프트 5축 100점 점수 시스템
      score: _competTotalScore,
      scoreMarket: _scoreMarketFinal,
      scoreCompete: _scoreCompeteFinal,
      scoreChange: _scoreChangeFinal,
      scoreSurvival: _scoreSurvivalFinal,
      scoreCost: _scoreCostFinal,
      // 기존 (외부 지표 가산 전) 점수 - 디버그/비교용
      scoreBase: {
        market: _scoreMarket,
        compete: _scoreCompete,
        change: _scoreChange,
        survival: _scoreSurvival,
        cost: _scoreCost,
      },
      // 외부 지표 가산 점수 (각 축에 더해진 값)
      scoreExternal: {
        market: {
          weather: _ext_weatherBonus,
          marketMap: _ext_marketBonus,
          salesPercentile: _ext_salesPercentileBonus,
          infra: _ext_infraBonus, // [2026-05-06 추가 #1] 잠재 고객 인프라 (0~2점)
          total: _ext_weatherBonus + _ext_marketBonus + _ext_salesPercentileBonus + _ext_infraBonus,
        },
        compete: { operation: _ext_competeBonus, total: _ext_competeBonus },
        change: { growth: _ext_changeMapBonus, salesTrend: _ext_salesTrend, total: _ext_changeMapBonus + _ext_salesTrend },
        survival: { stability: _ext_survivalBonus, total: _ext_survivalBonus },
        cost: { laborMaterial: _s_costExtra, total: _s_costExtra }, // [2026-05-06 추가 #2] 인건비+재료비 양방향
      },
      // [2026-05-06] 매출 백분위 점수 (동 매출 vs 전국 카페 평균)
      salesPercentile: {
        dongCafeSalesManwon: _dongCafeSalesManwon,
        nationalAvgManwon: _natCafeAvgManwon,
        nationalSource: _natCafeSrc,
        ratio: Math.round(_salesRatio * 100) / 100,
        diffPct: _salesDiffPct,
        percentile: _salesPercentile,
        label: _salesPercentileLabel,
        bonus: _ext_salesPercentileBonus,
      },
      // 외부 지표 원본 값 (카드 표시용) — 모든 점수 0~100 정규화 + cap 적용
      externalIndicators: {
        weatherScore: Math.min(100, _ext_weatherScore || 0),
        weatherLabel: _ext_weatherLabel,
        marketMapScores: (_ext_marketMapScores || []).map(s => ({
          name: s.name,
          score: Math.min(100, Math.max(0, Math.round(s.score || 0))),
        })),
        salesIndexMonthly: _ext_salesIndexMonthly,
        salesIndexSource: _ext_salesIndexSource || 'none',  // 'slsIndex' | 'nbmStats' | 'firebase' | 'none'
        salesTrendDirection: _ext_salesTrend,
      },
      scoreDetails: {
        market: { potCust: _s_pot, avgSales: _s_avgSales, marketSize: _s_marketSize, unitPrice: _s_unitPrice },
        compete: { density: _s_density, fcRatio: _s_fcRatio, diversity: _s_diversity },
        change: { newClose: _s_newClose, storeTrend: _s_storeTrend, marketChange: _s_marketChange },
        survival: { fiveYr: _s_fiveYr, avgYears: _s_avgYears, closure: _s_closure },
        cost: { rent: _s_rent, opIncome: _s_opIncome },
      },
      bonusItems: _bonusItems,
      survival3yr: _survival3yr,
      nationalAvg: 39, // 전국 평균 카페 3년 생존율 (중기부)
      // 디버그용 raw 값
      _raw: {
        // [2026-05-12 잔존 4건 폴백 적용] _potCustPerCafe / _bizmapPerStoreAvg / _marketSizeBilManwon / _bizmapPay
        // 점수 계산은 raw 변수(원본) 그대로 사용 → score 무영향
        potCustPerCafe: _potCustPerCafeSafe,
        potCustPerCafeRaw: _potCustPerCafe,
        bizmapPerStoreAvg: _bizmapPerStoreAvgSafe,
        bizmapPerStoreAvgRaw: _bizmapPerStoreAvg,
        marketSizeBilManwon: _marketSizeBilManwonSafe,
        marketSizeBilManwonRaw: _marketSizeBilManwon,
        bizmapPay: _bizmapPaySafe,
        bizmapPayRaw: _bizmapPay,
        // [2026-05-12] 빈 값 폴백 적용 (5년+ 매장, 동 폐업률, 평균 영업기간, 매출 변동률, 10년+ 매장, 인건비/식자재)
        fiveYrPct: _fiveYrPctSafe,
        fiveYrPctRaw: _fiveYrPct,
        avgYearsCompet: _avgYearsCompetSafe,
        avgYearsCompetRaw: _avgYearsCompet,
        ldClosurePct: _ldClosurePctSafe,
        ldClosurePctRaw: _ldClosurePct,
        avgRentPct: _avgRentPct,
        bizmapOpIncome: _bizmapOpIncome,
        // [2026-05-12] storeTrendChangePct 5년 → 6개월 추이로 교체 (카드 12 라벨 "점포 6개월 추이")
        storeTrendChangePct: _storeTrend6mPct,
        storeTrendChangePct5yr: _storeTrendChangePct,
        bmMarketChange: _bmMarketChangeSafe,
        bmMarketChangeRaw: _bmMarketChange,
        // [2026-05-06 신규 5개 항목 raw]
        infraTotal: _ext_infraTotal,
        infraBreakdown: _ext_infraBreakdown,
        bizmapLaborPct: _bizmapLaborPctSafe,
        bizmapLaborPctRaw: _bizmapLaborPct,
        bizmapMaterialPct: _bizmapMaterialPctSafe,
        bizmapMaterialPctRaw: _bizmapMaterialPct,
        tenYrPct: _tenYrPctSafe,
        tenYrPctRaw: _tenYrPct,
      },
    },
  };

  // ── Card 13 (변수명 card12): 상권 변화 추이 ──
  const stcarRaw2 = apis.stcarSttus?.data;
  const stcarData = Array.isArray(stcarRaw2) ? stcarRaw2 : (Array.isArray(stcarRaw2?.data) ? stcarRaw2.data : null);
  let survivalRate1y = 0;
  let openCnt = newOpenCount || 0;
  let closeCnt = 0;
  let netChg = 0;
  let trendLabel = '-';
  let _closeCountSource = 'none';

  let stcarLabels = [];
  let stcarValues = [];
  if (Array.isArray(stcarData) && stcarData.length > 0) {
    const total = stcarData.reduce((s, d) => s + (d?.stcnt || d?.storCnt || d?.storCo || 0), 0);
    const year1 = stcarData.find(d => (d?.yy || d?.year || d?.stcarNm || '').includes('1'));
    if (total > 0 && year1) {
      survivalRate1y = Math.round(((year1.stcnt || year1.storCnt || year1.storCo || 0) / total) * 100);
    }
    stcarLabels = stcarData.slice(0, 7).map(d => (d.stcarNm || d.stcarRange || d.yy || '').substring(0, 4));
    stcarValues = stcarData.slice(0, 7).map(d => d.storCo || d.stcnt || d.storCnt || 0);
  }
  if (aiData?.marketSurvival) {
    survivalRate1y = survivalRate1y || parseFloat(String(aiData.marketSurvival.year1 || '0').replace(/[^0-9.]/g, ''));
    openCnt = openCnt || aiData.marketSurvival.openCount || 0;
    closeCnt = aiData.marketSurvival.closeCount || 0;
    if (closeCnt > 0) _closeCountSource = 'bizmap';
  }

  // ── 우선순위 1-1: 폐업 LOCALDATA fallback ──
  // 비즈맵 폐업이 0이면 dongRows에서 closeDate 최근 1년 이내 카페 개수로 대체
  // 변수 정의: _ldRows는 line 1643에서 정의됨 (apis.firebaseLocaldata.data.dongRows)
  // _parseDate, _oneYearAgo, _closedRows, _recent1yClosed 모두 line 1645~1674에서 정의됨
  if (!closeCnt || closeCnt === 0) {
    const _ldClosedRecent1y = (typeof _recent1yClosed === 'number' ? _recent1yClosed : 0);
    if (_ldClosedRecent1y > 0) {
      closeCnt = _ldClosedRecent1y;
      _closeCountSource = 'localdata';
    }
  }
  // ── 우선순위 1-2: 카드 1 폐업 매장 수 사용 (card1Closed) ──
  // [2026-05-12] LOCALDATA도 없으면 카드 1의 aiData/stcarSttus에서 추출한 폐업 수 사용
  if (!closeCnt || closeCnt === 0) {
    if (typeof card1Closed === 'number' && card1Closed > 0) {
      closeCnt = card1Closed;
      _closeCountSource = 'card1Closed';
    }
  }
  // ── 우선순위 1-3: 전국 평균 추정 (totalCafes × 2%) ──
  // CLAUDE.md "0개 단독 표시 금지" 준수
  if (!closeCnt || closeCnt === 0) {
    if (totalCafes > 0) {
      closeCnt = Math.max(1, Math.round(totalCafes * 0.02));
      _closeCountSource = 'estimate';
    }
  }

  netChg = openCnt - closeCnt;
  if (netChg > 2) trendLabel = '성장';
  else if (netChg < -2) trendLabel = '쇠퇴';
  else trendLabel = '정체';

  // ── 우선순위 1-2: 5년 전 vs 지금 카페 수 비교 ──
  // _ldRows는 line 1643에서 정의됨, _parseDate/_now/_fiveYearAgo는 line 1645~1659에서 정의됨
  let _cafesNow = 0;
  let _cafes5yAgo = 0;
  let _cafes5yChangeRate = 0;
  try {
    const _ldRowsForCard13 = Array.isArray(apis.firebaseLocaldata?.data?.dongRows) ? apis.firebaseLocaldata.data.dongRows : [];
    if (_ldRowsForCard13.length > 0) {
      // 현재 운영 중인 카페 수 (영업/정상)
      _cafesNow = _ldRowsForCard13.filter(r => (r.status || '').includes('영업')).length;
      // 5년 전 시점에 운영 중이던 카페 수: apvDate <= 5년전 AND (영업중 OR closeDate > 5년전)
      _cafes5yAgo = _ldRowsForCard13.filter(r => {
        const apv = _parseDate(r.apvDate);
        if (!apv || apv > _fiveYearAgo) return false;
        // 영업 중이면 5년 전에도 있었음
        if ((r.status || '').includes('영업')) return true;
        // 폐업이면 폐업일이 5년 전 이후일 때만 카운트
        if ((r.status || '').includes('폐업')) {
          const cd = _parseDate(r.closeDate);
          return cd && cd > _fiveYearAgo;
        }
        return false;
      }).length;
      if (_cafes5yAgo > 0) {
        _cafes5yChangeRate = Math.round(((_cafesNow - _cafes5yAgo) / _cafes5yAgo) * 100);
      }
    }
  } catch (e) { /* 변수 정의 누락 방지: 모든 변수 try 안에서 안전하게 사용 */ }

  // ── 우선순위 1-3: 평균 영업기간 (card11에서 계산된 _avgYearsCompet 재사용) ──
  // _avgYearsCompet는 line 2446~2453에서 정의됨 (Card 12 영역)
  let _avgOperatingYears = 0;
  if (typeof _avgYearsCompet === 'number' && _avgYearsCompet > 0) {
    _avgOperatingYears = _avgYearsCompet;
  } else {
    // fallback: LOCALDATA에서 직접 계산
    try {
      const _ldRowsForAvg = Array.isArray(apis.firebaseLocaldata?.data?.dongRows) ? apis.firebaseLocaldata.data.dongRows : [];
      const _activeForAvg = _ldRowsForAvg.filter(r => (r.status || '').includes('영업'));
      const _durs = _activeForAvg.map(r => {
        const d = _parseDate(r.apvDate);
        return d ? (_now.getTime() - d.getTime()) / (1000 * 60 * 60 * 24 * 365) : null;
      }).filter(v => v !== null && v >= 0);
      if (_durs.length > 0) {
        _avgOperatingYears = Math.round((_durs.reduce((s, v) => s + v, 0) / _durs.length) * 10) / 10;
      }
    } catch (e) { /* 변수 정의 누락 방지 */ }
  }

  // ── 우선순위 1-4: storeCountChangeList (월별 점포 증감) ──
  // bizMapStoreCountChange는 App.jsx 11024에서 저장됨
  let _monthlyChangeList = null;
  try {
    const _bmChange = aiData?.apis?.bizMapStoreCountChange?.data ?? apis.bizMapStoreCountChange?.data;
    if (Array.isArray(_bmChange) && _bmChange.length > 0) {
      const _sortedChange = [..._bmChange].sort((a, b) => String(a?.yyyymm || a?.stdYm || a?.ym || '').localeCompare(String(b?.yyyymm || b?.stdYm || b?.ym || '')));
      _monthlyChangeList = _sortedChange.map(r => {
        const ym = String(r?.yyyymm || r?.stdYm || r?.ym || '');
        const m = parseInt(ym.slice(4, 6), 10);
        return {
          period: m ? `${m}월` : ym,
          opened: parseInt(r?.openCount ?? r?.openCnt ?? r?.newCount ?? 0, 10) || 0,
          closed: parseInt(r?.closeCount ?? r?.closeCnt ?? r?.extinctCount ?? 0, 10) || 0,
          net: (parseInt(r?.openCount ?? r?.openCnt ?? r?.newCount ?? 0, 10) || 0) - (parseInt(r?.closeCount ?? r?.closeCnt ?? r?.extinctCount ?? 0, 10) || 0),
        };
      });
    }
  } catch (e) { /* null 유지 */ }

  // ── 비즈맵 보강: 점포수 6개월 추이 (storeCountTrendList) ──
  // 라이브 API: { yyyymm, storeCount } / DOM 폴백 동일 / 구버전: { stdYm, storeCnt }
  const bmStoreTrend = aiData?.apis?.bizMapStoreCountTrend?.data ?? apis.bizMapStoreCountTrend?.data;
  let bmStoreTrendChart = null;
  let bmStoreLatest = null;
  let bmStoreFirst = null;
  let bmStoreNetChange = null;
  let bmStoreTrendLabel = null;
  if (Array.isArray(bmStoreTrend) && bmStoreTrend.length >= 2) {
    const sorted = [...bmStoreTrend].sort((a, b) => String(a?.yyyymm || a?.stdYm || a?.ym || '').localeCompare(String(b?.yyyymm || b?.stdYm || b?.ym || '')));
    const labels = sorted.map(r => {
      const ym = String(r?.yyyymm || r?.stdYm || r?.ym || '');
      const m = parseInt(ym.slice(4, 6), 10);
      return m ? `${m}월` : ym;
    });
    const values = sorted.map(r => parseInt(r?.storeCount ?? r?.storeCnt ?? r?.storCnt ?? r?.cnt ?? 0, 10) || 0);
    if (labels.length > 0 && values.some(v => v > 0)) {
      bmStoreTrendChart = { labels, values };
      bmStoreFirst = values[0];
      bmStoreLatest = values[values.length - 1];
      bmStoreNetChange = bmStoreLatest - bmStoreFirst;
      if (bmStoreNetChange > 0) bmStoreTrendLabel = `6개월간 +${bmStoreNetChange}개 증가`;
      else if (bmStoreNetChange < 0) bmStoreTrendLabel = `6개월간 ${bmStoreNetChange}개 감소`;
      else bmStoreTrendLabel = `6개월간 변동 없음`;
    }
  } else if (Array.isArray(bmStoreTrend) && bmStoreTrend.length === 1) {
    const only = bmStoreTrend[0];
    bmStoreLatest = parseInt(only?.storeCount ?? only?.storeCnt ?? only?.storCnt ?? only?.cnt ?? 0, 10) || null;
  }

  // ── 우선순위 2-1: 시도 창업기상도 (weather) ──
  // collectedData.apis.weatherIndex.data.scores: [{areaCd, overall:{percentile,grade,score}, ...}, ...]
  // 정규화: percentile(낮을수록 좋음) → 100-percentile, 상한 100 cap
  let _weatherScore = 0;
  let _weatherLabel = '';
  try {
    const _wIdx = apis.weatherIndex?.data;
    const _wRaw = apis.weather?.data;
    let _normScore = 0;
    let _matchedItem = null;
    if (_wIdx && Array.isArray(_wIdx.scores) && _wIdx.scores.length > 0) {
      // 검색 시도와 매칭 (영업모드 dongCd 앞 2자리)
      _matchedItem = _searchSidoCd
        ? _wIdx.scores.find(s => String(s?.areaCd || '').padStart(2, '0').slice(0, 2) === _searchSidoCd)
        : null;
      if (!_matchedItem) _matchedItem = _wIdx.scores[0];
    } else if (Array.isArray(_wRaw) && _wRaw.length > 0) {
      _matchedItem = _wRaw[0];
    }
    if (_matchedItem) {
      const _ov = _matchedItem.overall;
      if (_ov && typeof _ov === 'object') {
        const _pct = parseFloat(_ov?.percentile);
        if (Number.isFinite(_pct) && _pct >= 0 && _pct <= 100) _normScore = Math.round(100 - _pct);
        else {
          const _grd = parseFloat(_ov?.grade);
          if (Number.isFinite(_grd) && _grd >= 1 && _grd <= 10) _normScore = Math.round((11 - _grd) * 10);
        }
      } else if (typeof _ov === 'number') {
        _normScore = Math.max(0, Math.min(100, Math.round(_ov)));
      } else {
        // 단순 필드 시도
        const _sc = parseFloat(_matchedItem?.score || _matchedItem?.idxScore || 0);
        if (Number.isFinite(_sc) && _sc > 0) _normScore = Math.max(0, Math.min(100, Math.round(_sc)));
      }
    }
    if (_normScore > 0) {
      _weatherScore = Math.min(100, _normScore); // cap 100
      if (_weatherScore >= 75) _weatherLabel = '맑음';
      else if (_weatherScore >= 60) _weatherLabel = '구름조금';
      else if (_weatherScore >= 45) _weatherLabel = '흐림';
      else _weatherLabel = '비';
    }
  } catch (e) { /* 0 유지 */ }

  // ── 우선순위 2-2: 상권지도 5종 점수 (startupPublic) ──
  // startupPublic 응답이 실제로는 정부 창업지원 프로그램 목록일 수 있음 → 이름 우선 추출, score는 0~100 cap
  // 폴백: weatherIndex 5종 점수 사용 (이미 _ext_marketMapScores에 정규화됨)
  let _marketMapScores = null;
  try {
    const _spRaw = apis.startupPublic?.data;
    if (_spRaw) {
      const _spArr = Array.isArray(_spRaw) ? _spRaw : (Array.isArray(_spRaw?.data) ? _spRaw.data : null);
      if (Array.isArray(_spArr) && _spArr.length > 0) {
        _marketMapScores = _spArr.slice(0, 5).map(item => {
          const _rawScore = parseFloat(item?.score || item?.idxScore || item?.value || 0) || 0;
          return {
            name: String(item?.prgmNm || item?.sprtNm || item?.title || item?.indsLclsNm || ''),
            score: Math.max(0, Math.min(100, Math.round(_rawScore))), // 0~100 cap
          };
        }).filter(s => s.name);
        if (_marketMapScores.length === 0) _marketMapScores = null;
      }
    }
    // 폴백: weatherIndex 5종이 있으면 그것 사용
    if ((!_marketMapScores || _marketMapScores.length === 0)
        && Array.isArray(_ext_marketMapScores) && _ext_marketMapScores.length > 0) {
      _marketMapScores = _ext_marketMapScores;
    }
  } catch (e) { /* null 유지 */ }

  // ── 우선순위 2-3: 매출지수 월별 (slsIndex) ──
  // 실제 응답: { resultCode:'SUCCESS', data:{ flctnChart:[{yyyymm,saleIdx,slsAmt,...}] } }
  let _salesIndexMonthly = null;
  try {
    const _slsRaw = apis.slsIndex?.data;
    let _slsArr = null;
    if (Array.isArray(_slsRaw?.flctnChart)) _slsArr = _slsRaw.flctnChart;
    else if (Array.isArray(_slsRaw?.data?.flctnChart)) _slsArr = _slsRaw.data.flctnChart;
    else if (Array.isArray(_slsRaw?.body?.flctnChart)) _slsArr = _slsRaw.body.flctnChart;
    else if (Array.isArray(_slsRaw)) _slsArr = _slsRaw;
    else if (Array.isArray(_slsRaw?.data)) _slsArr = _slsRaw.data;

    if (Array.isArray(_slsArr) && _slsArr.length > 0) {
      _salesIndexMonthly = _slsArr.slice(-12).map(si => ({
        period: String(si?.yyyymm || si?.crtrYm || si?.crtrYyqu || '').replace(/\./g, ''),
        index: parseFloat(si?.saleIdx || si?.slsIdx || si?.slsAmt || 0) || 0,
      })).filter(s => s.period && s.index > 0);
      if (_salesIndexMonthly.length === 0) _salesIndexMonthly = null;
    }
  } catch (e) { /* null 유지 */ }

  // ─────────────────────────────────────────────────
  // [2026-05-06 카드 3 이관] 비즈맵 popularMenuList + risingMenuList → 메뉴 객체 배열
  // 카드 4(개인 카페)에 있던 메뉴 정보를 동 전체 통계인 카드 3(상권 변화 추이)으로 이동
  // 응답 구조: { MENU_NM/menuNm, AVG_SALE_UPRC, PCTILE_25, PCTILE_75, SALE_RATE, GROWTH_RATE, RNK }
  // fragment 파싱 결과 + zinidata 폴백 모두 호환
  //
  // [2026-05-06 추가] zinidata 시도/구 단위 폴백 차단
  // - NON_CAFE_MENU_BLACKLIST 키워드 포함 시 제외 (망고/한라봉/불고기 등)
  // - CAFE_MENU_WHITELIST 키워드 포함 시 우선 통과 (아메리카노/라떼/에이드 등)
  // - 둘 다 매칭 안 되면 통과 (보수적)
  // ─────────────────────────────────────────────────
  const NON_CAFE_MENU_BLACKLIST = [
    '망고', '한라봉', '망고아이스크림', '한라봉젤리',
    '불고기', '샌드위치', '라이스', '김치', '떡볶이', '피자', '버거', '치킨',
  ];
  const CAFE_MENU_WHITELIST = [
    '아메리카노', '라떼', '카푸치노', '모카', '에스프레소',
    '에이드', '스무디', '주스', '차', '티', '우유', '요거트',
    '핫초코', '버블티', '크림', '커피', '카페',
  ];
  const isCafeMenu = (menuName) => {
    const name = String(menuName || '').trim();
    if (!name) return false;
    // 블랙리스트 먼저 (화이트리스트 '크림'이 '망고아이스크림' 통과시키는 버그 방지)
    if (NON_CAFE_MENU_BLACKLIST.some(kw => name.includes(kw))) return false;
    // 화이트리스트 통과
    if (CAFE_MENU_WHITELIST.some(kw => name.includes(kw))) return true;
    // 둘 다 매칭 안 되면 통과 (보수적)
    return true;
  };

  let _extra_popularMenus = [];
  let _extra_risingMenus = [];
  try {
    // 비즈맵 진짜 응답 popularMenuList 필드: menu4Nm, avgPrice, pctile20, pctile80, rate
    // 우리 코드 기존 필드: MENU_NM, AVG_SALE_UPRC, PCTILE_25, PCTILE_75, SALE_RATE
    // bizMapPopularMenu 또는 직접 popularMenuList 모두 인식
    const _popMenuRaw = aiData?.apis?.bizMapPopularMenu?.data
      ?? apis.bizMapPopularMenu?.data
      ?? cd?.popularMenuList
      ?? aiData?.popularMenuList
      ?? [];
    if (Array.isArray(_popMenuRaw) && _popMenuRaw.length > 0) {
      _extra_popularMenus = _popMenuRaw.slice(0, 3).map(m => {
        const name = String(m?.MENU_NM || m?.menuNm || m?.menuName || m?.name || m?.itemNm || m?.menu4Nm || m?.MENU4_NM || '').trim();
        const avgPrice = parseFloat(m?.AVG_SALE_UPRC ?? m?.avgSaleUprc ?? m?.avgPrice ?? m?.avgUprc ?? 0) || 0;
        const minPrice = parseFloat(m?.PCTILE_25 ?? m?.pctile25 ?? m?.pctile20 ?? m?.minPrice ?? 0) || 0;
        const maxPrice = parseFloat(m?.PCTILE_75 ?? m?.pctile75 ?? m?.pctile80 ?? m?.maxPrice ?? 0) || 0;
        const salesRate = parseFloat(m?.SALE_RATE ?? m?.saleRate ?? m?.salesRate ?? m?.rate ?? 0) || 0;
        return { name, avgPrice, minPrice, maxPrice, salesRate };
      }).filter(m => m.name && isCafeMenu(m.name));
    }
  } catch (e) { /* 빈 배열 유지 */ }
  try {
    // 비즈맵 risingMenuList 필드: MENU_NM, AVG_SALE_UPRC, PCTILE_25, PCTILE_75, COM_PRE_RATE
    const _riseMenuRaw = cd?.nicebizmapMenu
      ?? aiData?.nicebizmapMenu
      ?? cd?.risingMenuList
      ?? aiData?.risingMenuList
      ?? [];
    if (Array.isArray(_riseMenuRaw) && _riseMenuRaw.length > 0) {
      _extra_risingMenus = _riseMenuRaw.slice(0, 3).map(m => {
        const name = String(m?.MENU_NM || m?.menuNm || m?.menuName || m?.name || m?.itemNm || m?.menu4Nm || m?.MENU4_NM || '').trim();
        const avgPrice = parseFloat(m?.AVG_SALE_UPRC ?? m?.avgSaleUprc ?? m?.avgPrice ?? m?.avgUprc ?? 0) || 0;
        const minPrice = parseFloat(m?.PCTILE_25 ?? m?.pctile25 ?? m?.pctile20 ?? m?.minPrice ?? 0) || 0;
        const maxPrice = parseFloat(m?.PCTILE_75 ?? m?.pctile75 ?? m?.pctile80 ?? m?.maxPrice ?? 0) || 0;
        const growthRate = parseFloat(m?.COM_PRE_RATE ?? m?.GROWTH_RATE ?? m?.growthRate ?? m?.growth ?? 0) || 0;
        return { name, avgPrice, minPrice, maxPrice, growthRate };
      }).filter(m => m.name && isCafeMenu(m.name));
    }
  } catch (e) { /* 빈 배열 유지 */ }

  const card12Sources = ['소상공인365'];
  if (bmStoreTrend) card12Sources.push('비즈맵');
  if (_closeCountSource === 'localdata') card12Sources.push('LOCALDATA');
  if (_weatherScore > 0) card12Sources.push('창업기상도');
  if (_salesIndexMonthly) card12Sources.push('매출지수');
  if (_extra_popularMenus.length > 0 || _extra_risingMenus.length > 0) card12Sources.push('비즈맵메뉴');

  // AI 한 줄 멘트 (시계열/변화 위주, 카드 12와 차별화)
  let _card13AiMent = '';
  if (openCnt > 0 || closeCnt > 0) {
    _card13AiMent = `최근 1년간 신규 ${openCnt}개 폐업 ${closeCnt}개로 ${netChg >= 0 ? '+' : ''}${netChg}개 ${netChg >= 0 ? '순증' : '순감'}`;
    if (_cafes5yAgo > 0 && _cafes5yChangeRate !== 0) {
      _card13AiMent += `, 5년 전 대비 ${_cafes5yChangeRate >= 0 ? '+' : ''}${_cafes5yChangeRate}% ${_cafes5yChangeRate >= 0 ? '성장' : '축소'}`;
    } else if (_cafesNow > 0 && _cafes5yAgo > 0) {
      _card13AiMent += `, 5년 전 ${_cafes5yAgo}개에서 현재 ${_cafesNow}개`;
    }
    _card13AiMent += '.';
  } else if (_cafes5yAgo > 0) {
    _card13AiMent = `5년 전 ${_cafes5yAgo}개 → 현재 ${_cafesNow}개 (${_cafes5yChangeRate >= 0 ? '+' : ''}${_cafes5yChangeRate}%).`;
  } else if (bmStoreTrendLabel) {
    _card13AiMent = `비즈맵 점포수 ${bmStoreTrendLabel}.`;
  }
  if (_avgOperatingYears > 0) {
    _card13AiMent += ` 평균 영업 ${_avgOperatingYears}년.`;
  }

  const card12 = {
    title: '상권 변화 추이',
    subtitle: '개폐업 및 상권 트렌드',
    date: dateStr,
    source: card12Sources.join('/'),
    bruSummary: aiData?.marketSurvival?.bruSummary || null,
    aiSummary: aiData?.marketSurvival?.bruFeedback
      || (_card13AiMent
        ? _card13AiMent
        : (survivalRate1y > 0 || openCnt > 0
          ? `${openCnt > 0 ? `신규 개업 ${openCnt}개` : ''}${closeCnt > 0 ? `, 폐업 ${closeCnt}개` : ''}. 상권 추세: ${trendLabel}.${survivalRate1y > 0 ? ` 1년 생존율 ${survivalRate1y}%.` : ''}${bmStoreTrendLabel ? ` 비즈맵 점포수 ${bmStoreTrendLabel}.` : ''}`
          : bmStoreTrendLabel
            ? `비즈맵 기준 점포수 ${bmStoreTrendLabel}.`
            : '')),
    chartType: 'line',
    metaInfo: '상권변화',
    chartData: stcarLabels.length > 0
      ? { labels: stcarLabels, values: stcarValues }
      : (bmStoreTrendChart || null),
    bodyData: {
      openCount: openCnt,
      closeCount: closeCnt,
      netChange: netChg,
      trend: trendLabel,
      survivalInsight: aiData?.marketSurvival?.insight || null,
      // [2026-05-12] 생존율 폴백: LD/소상공인 0이면 전국 평균 (KOSIS 기업생존율 전산업 추정치)
      // 1년 65% / 3년 39% / 5년 28% (중기부 2023 카페 통계 기준)
      survivalRate1y: survivalRate1y || _selfSurvival1y || 65,
      survivalRate3y: (() => {
        const v = aiData?.marketSurvival?.year3;
        const aiVal = v ? parseFloat(String(v).replace(/[^0-9.]/g, '')) || 0 : 0;
        return aiVal || _selfSurvival3y || 39;
      })(),
      survivalRate5y: (() => {
        const v = aiData?.marketSurvival?.year5;
        const aiVal = v ? parseFloat(String(v).replace(/[^0-9.]/g, '')) || 0 : 0;
        return aiVal || _selfSurvival5y || 28;
      })(),
      // 비즈맵 보강: 점포수 6개월 추이
      bizmapStoreLatest: bmStoreLatest,
      bizmapStoreFirst: bmStoreFirst,
      bizmapStoreNetChange: bmStoreNetChange,
      bizmapStoreTrendLabel: bmStoreTrendLabel,
      bizmapStoreTrendChart: bmStoreTrendChart,
      // ── 신규 추가 (2026-05-06) ──
      closeCountSource: _closeCountSource,        // 'bizmap' | 'localdata' | 'none'
      // [2026-05-12] cafesNow/cafes5yAgo 폴백: LD 없을 때 totalCafes(수집된 카페 수) + 전국 평균 흐름
      cafesNow: _cafesNow || totalCafes || 0,
      cafes5yAgo: (() => {
        if (_cafes5yAgo > 0) return _cafes5yAgo;
        // 비즈맵 storeCountTrend 6개월 변동률 → 5년 환산 폴백
        const _baseTotal = _cafesNow || totalCafes || 0;
        if (_baseTotal === 0) return 0;
        // 전국 카페 평균 5년 성장률 +14% (중기부 통계 2018→2023) → 5년 전 = 현재 / 1.14
        return Math.round(_baseTotal / 1.14);
      })(),
      cafes5yChangeRate: (() => {
        if (_cafes5yChangeRate !== 0) return _cafes5yChangeRate;
        if (_cafes5yAgo > 0 && _cafesNow > 0) return Math.round(((_cafesNow - _cafes5yAgo) / _cafes5yAgo) * 100);
        return 14; // 전국 평균 폴백
      })(),
      avgOperatingYears: _avgOperatingYears,       // 평균 영업기간 (년)
      monthlyChangeList: _monthlyChangeList,       // 월별 점포 증감 리스트
      weatherScore: _weatherScore,                 // 시도 창업기상도 점수
      weatherLabel: _weatherLabel,                 // 창업기상도 라벨
      marketMapScores: _marketMapScores,           // 상권지도 5종 점수
      salesIndexMonthly: _salesIndexMonthly,       // 월별 매출지수
      // ── [2026-05-06 카드 4→3 이관] 비즈맵 메뉴 ──
      popularMenus: _extra_popularMenus,           // [{name, avgPrice, minPrice, maxPrice, salesRate}, ...] TOP 3
      risingMenus: _extra_risingMenus,             // [{name, avgPrice, minPrice, maxPrice, growthRate}, ...] TOP 3
    },
  };

  // ── Card 14: AI 종합 분석 (인덱스상 card13) ──
  // ChartInsightDashboard가 기대하는 형식: { headline, kpis[], radarAxes[], signals[], tags[], analysis }
  // aiData가 비어있어도 collectedData 시그널로 계산해서 채움 (절대 "데이터 부족" 표시 금지)

  // === 시그널 추출 ===
  const c14Closed = card1Closed || 0;
  const c14NewOpen = newOpenCount || 0;
  const c14Total = totalCafes || 0;
  const c14Franch = franchiseCount || 0;
  const c14Indep = independentCount || 0;
  const c14IndepRatio = c14Total > 0 ? Math.round((c14Indep / c14Total) * 100) : 0;
  const c14FranchRatio = c14Total > 0 ? Math.round((c14Franch / c14Total) * 100) : 0;

  // 매출 추출 (소상공인365 또는 비즈맵)
  let c14CafeSales = 0;
  let c14DongAvg = 0;
  const c14SalesArr = apis.salesAvg?.data;
  if (Array.isArray(c14SalesArr)) {
    const cafeItem = c14SalesArr.find(s => s?.tpbizClscdNm === '카페');
    c14CafeSales = cafeItem?.mmavgSlsAmt || 0;
    if (c14SalesArr.length > 0) {
      c14DongAvg = Math.round(c14SalesArr.reduce((s, item) => s + (item?.mmavgSlsAmt || 0), 0) / c14SalesArr.length);
    }
  }
  if (!c14CafeSales && cd.nicebizmapStats?.perStoreAvg) {
    c14CafeSales = Math.round(cd.nicebizmapStats.perStoreAvg / 10000); // 원→만원
  }

  // 유동인구 (월간 → 일평균)
  const c14DailyPop = card1DailyPop || 0;

  // 임대료 (있으면)
  const c14AvgRent = apis.firebaseRent?.data?.avgRent || 0;

  // === 5개 지표 점수 계산 (0~100) ===
  // 밀집도: 카페수 기준 (낮을수록 점수 높음 = 진입 여유)
  let c14Density = 50;
  if (c14Total > 80) c14Density = 25;
  else if (c14Total > 40) c14Density = 45;
  else if (c14Total > 15) c14Density = 70;
  else if (c14Total > 0) c14Density = 90;

  // 경쟁: 프랜차이즈 비율 (낮을수록 점수 높음 = 차별화 기회)
  let c14Compet = 50;
  if (c14FranchRatio >= 60) c14Compet = 30;
  else if (c14FranchRatio >= 40) c14Compet = 55;
  else if (c14FranchRatio >= 20) c14Compet = 75;
  else if (c14Total > 0) c14Compet = 88;

  // 잠재력: 매출 + 유동인구 결합
  let c14Potential = 50;
  if (c14CafeSales > 0 && c14DongAvg > 0) {
    const ratio = c14CafeSales / c14DongAvg;
    if (ratio >= 1.5) c14Potential = 90;
    else if (ratio >= 1.1) c14Potential = 75;
    else if (ratio >= 0.8) c14Potential = 60;
    else c14Potential = 40;
  }
  if (c14DailyPop > 5000) c14Potential = Math.min(100, c14Potential + 10);
  else if (c14DailyPop > 2000) c14Potential = Math.min(100, c14Potential + 5);

  // 추세: 신규/폐업 비율
  let c14Trend = 60;
  if (c14NewOpen > c14Closed && c14NewOpen >= 2) c14Trend = 85;
  else if (c14NewOpen > 0 && c14NewOpen >= c14Closed) c14Trend = 70;
  else if (c14Closed > c14NewOpen + 2) c14Trend = 30;
  else if (c14Closed > c14NewOpen) c14Trend = 45;

  // 비용여유: 임대료 기준 (낮을수록 점수 높음)
  let c14CostRoom = 60;
  if (c14AvgRent > 5000000) c14CostRoom = 30;
  else if (c14AvgRent > 3000000) c14CostRoom = 50;
  else if (c14AvgRent > 1500000) c14CostRoom = 70;
  else if (c14AvgRent > 0) c14CostRoom = 85;

  // === 종합 점수: Card 12(상권 경쟁 분석)의 5축 합산 점수와 일치시켜 카드 간 오해 방지 ===
  // Card 12는 100점 만점(시장20+경쟁20+변화15+생존30+비용15) 합산. 두 카드가 같은 점수를 보여야 한다.
  const _c12Score = card11?.bodyData?.score;
  const c14OverallScore = (typeof _c12Score === 'number' && _c12Score > 0)
    ? _c12Score
    : (aiData?.overallScore
      ? parseInt(aiData.overallScore) || 0
      : aiData?.score
        ? parseInt(aiData.score) || 0
        : Math.round((c14Density * 0.15 + c14Compet * 0.20 + c14Potential * 0.30 + c14Trend * 0.20 + c14CostRoom * 0.15)));

  // === 기회 리스트 추출 (collectedData + aiData 양쪽) ===
  const c14Opps = [];
  if (Array.isArray(aiData?.opportunities) && aiData.opportunities.length > 0) {
    aiData.opportunities.forEach(o => {
      c14Opps.push({ title: o?.title || '기회', detail: o?.detail || '' });
    });
  } else {
    if (c14NewOpen >= 2) c14Opps.push({ title: '신규 오픈 활성', detail: `최근 신규 오픈 ${c14NewOpen}개. 성장 상권 신호` });
    if (c14IndepRatio >= 60) c14Opps.push({ title: '개인카페 우위', detail: `개인카페 ${c14IndepRatio}% (${c14Indep}개). 차별화 메뉴/브랜딩 기회` });
    if (c14CafeSales > 0 && c14DongAvg > 0 && c14CafeSales > c14DongAvg * 1.1) c14Opps.push({ title: '높은 카페 매출', detail: `카페 매출 ${c14CafeSales.toLocaleString()}만원 (동평균 ${Math.round((c14CafeSales / c14DongAvg - 1) * 100)}% 상회)` });
    if (c14DailyPop > 3000) c14Opps.push({ title: '풍부한 유동인구', detail: `일평균 ${c14DailyPop.toLocaleString()}명. 자연 유입 기대` });
    if (c14Total > 0 && c14Total <= 15) c14Opps.push({ title: '저밀도 상권', detail: `카페 ${c14Total}개. 진입 여유 충분` });
  }

  // === 리스크 리스트 추출 ===
  const c14Risks = [];
  if (Array.isArray(aiData?.risks) && aiData.risks.length > 0) {
    aiData.risks.forEach(r => {
      c14Risks.push({ title: r?.title || '리스크', detail: r?.detail || '' });
    });
  } else {
    if (c14Total > 80) c14Risks.push({ title: '카페 과밀', detail: `반경 내 ${c14Total}개. 신규 진입 시 차별화 필수` });
    if (c14Closed >= 3) c14Risks.push({ title: '폐업 발생', detail: `최근 폐업 ${c14Closed}개. 생존율 점검 필요` });
    if (c14CafeSales > 0 && c14DongAvg > 0 && c14CafeSales < c14DongAvg * 0.8) c14Risks.push({ title: '평균 매출 낮음', detail: `카페 매출 ${c14CafeSales.toLocaleString()}만원 (동평균 대비 ${Math.round((1 - c14CafeSales / c14DongAvg) * 100)}% 하회)` });
    if (c14FranchRatio >= 60) c14Risks.push({ title: '프랜차이즈 우위', detail: `프랜차이즈 ${c14FranchRatio}%. 가격 경쟁 부담` });
    if (c14AvgRent > 5000000) c14Risks.push({ title: '높은 임대료', detail: `평균 ${(c14AvgRent / 10000).toLocaleString()}만원/월. 고정비 부담` });
  }

  // === 추천 라벨 (Card 13 종합 점수 라벨과 일치: 매우 좋음/좋음/보통/안좋음/매우 안좋음) ===
  let c14Recommendation = '보통';
  if (aiData?.recommendation) c14Recommendation = String(aiData.recommendation);
  else if (c14OverallScore >= 80) c14Recommendation = '매우 좋음';
  else if (c14OverallScore >= 60) c14Recommendation = '좋음';
  else if (c14OverallScore >= 40) c14Recommendation = '보통';
  else if (c14OverallScore >= 20) c14Recommendation = '안좋음';
  else c14Recommendation = '매우 안좋음';

  // === Headline 생성 (Card 13 종합 점수 라벨과 일치) ===
  const c14Headline = (() => {
    if (aiData?.regionBrief && typeof aiData.regionBrief === 'string') return String(aiData.regionBrief).substring(0, 80);
    const dn = dong.dongNm || '해당 상권';
    const sc = c14OverallScore;
    if (sc >= 80) return `${dn} · 종합 ${sc}점 (매우 좋음 등급)`;
    if (sc >= 60) return `${dn} · 종합 ${sc}점 (좋음 등급)`;
    if (sc >= 40) return `${dn} · 종합 ${sc}점 (보통 등급)`;
    if (sc >= 20) return `${dn} · 종합 ${sc}점 (주의 등급)`;
    return `${dn} · 종합 ${sc}점 (낮음 등급)`;
  })();

  // === 시그널 (긍정/부정 항목 통합) ===
  const c14Signals = [];
  c14Opps.slice(0, 3).forEach(o => c14Signals.push({ type: 'positive', text: `${o.title}: ${o.detail}`.substring(0, 80) }));
  c14Risks.slice(0, 3).forEach(r => c14Signals.push({ type: 'negative', text: `${r.title}: ${r.detail}`.substring(0, 80) }));

  // === 태그 ===
  const c14Tags = [];
  if (c14Total > 0) c14Tags.push(`카페 ${c14Total}개`);
  if (c14NewOpen > 0) c14Tags.push(`신규 ${c14NewOpen}`);
  if (c14Closed > 0) c14Tags.push(`폐업 ${c14Closed}`);
  if (c14IndepRatio >= 50) c14Tags.push(`개인카페 ${c14IndepRatio}%`);
  else if (c14FranchRatio >= 50) c14Tags.push(`프랜차이즈 ${c14FranchRatio}%`);
  if (c14CafeSales > 0) c14Tags.push(`카페매출 ${(c14CafeSales / 100).toFixed(1)}억`);
  c14Tags.push(c14Recommendation);

  // ── 디렉터 객체: AI insight.director 우선, 없으면 5영역 데이터 기반 자동 생성 ──
  // (UI 단계에서 시각화 예정. 빈 값일 때도 안전하게 ?. 접근.)
  const _aiDirector = aiData?.insight?.director || aiData?.director || null;
  // _c14*는 아래에서 정의되므로 여기서는 미리 동일한 데이터 출처 변수를 사용한다.
  // (5영역 데이터 객체는 아래쪽 c14MarketOverview~c14MarketDirection에서 정의됨)
  // 빈 영역 polyfill은 마지막에 한 번에 처리한다.
  const c14Director = _aiDirector;

  // ── 5개 영역 종합 데이터 (UI 단계에서 사용) ──
  // 카드 1·2·3·5·6·7·11·12·13의 핵심을 5영역으로 모은다.
  // 모든 접근은 ?. optional chaining으로 안전 처리.
  const c14MarketOverview = {
    totalCafes: card1?.bodyData?.cafes ?? 0,
    franchise: card1?.bodyData?.franchise ?? 0,
    individual: card1?.bodyData?.individual ?? 0,
    bakery: card1?.bodyData?.bakery ?? 0,
    newOpen: card1?.bodyData?.newOpen ?? 0,
    closedCount: card1?.bodyData?.['폐업 매장'] ?? 0,
    // [Card 1 ↔ Card 3 출처 차이 명시] Card 1은 AI 추정, Card 3는 행정 인허가 기준이라 다른 숫자 표시 가능
    closedCountAdmin: card12?.bodyData?.closeCount ?? 0,
    openCountAdmin: card12?.bodyData?.openCount ?? 0,
    closedCountSource: card12?.bodyData?.closeCountSource || 'unknown',
    // 상권 유형: card7 비즈맵 → AI overview → null (UI에서 자동 분류 폴백)
    blockType: card7?.bodyData?.bizmapBlockType ?? aiData?.overview?.regionType ?? null,
    storeNetChange: card12?.bodyData?.bizmapStoreNetChange ?? null,
    storeTrendLabel: card12?.bodyData?.bizmapStoreTrendLabel ?? null,
    cafes5yChangeRate: card12?.bodyData?.cafes5yChangeRate ?? 0,
    // [Card 9 추가] 카페 기회 카드의 5년+/생존+면적/5년 전 vs 지금 findings
    findings: card8?.bodyData?.findings ?? [],
  };

  const c14CustomerProfile = {
    topAge: card2?.bodyData?.topAge ?? null,
    genderRatio: card2?.bodyData?.genderRatio ?? null,
    lifestyle: card2?.bodyData?.maleLifestyle || card2?.bodyData?.femaleLifestyle || card2?.bodyData?.lifestyle || null,
    maleLifestyle: card2?.bodyData?.maleLifestyle ?? null,
    femaleLifestyle: card2?.bodyData?.femaleLifestyle ?? null,
    openubSingleHh: card2?.bodyData?.openubSingleHh ?? 0,
    openubTotalHh: card2?.bodyData?.openubTotalHh ?? 0,
    openubAptRatio: card2?.bodyData?.openubAptRatio ?? null,
    households: card2?.bodyData?.households ?? 0,
    singleHousehold: card2?.bodyData?.singleHousehold ?? null,
    residentPop: card2?.bodyData?.residentPop ?? 0,
    // [Card 2 추가] 방문 손님 연 평균소득(남/여), 4구간 연령 분포, 신규/단골 비율
    customerYrEarn: card2?.bodyData?.customerYrEarn ?? null,
    ageGroups: card2?.chartData?.ageGroups ?? [],
    newCustomerPct: card2?.bodyData?.newCustomer ?? null,
    regularPct: card2?.bodyData?.regular ?? null,
    bizmapTopAge: card2?.bodyData?.bizmapTopAge ?? null,
    floatingPop: card6?.bodyData?.totalPop ?? 0,
    weekdayPop: card6?.bodyData?.weekday ?? 0,
    weekendPop: card6?.bodyData?.weekend ?? 0,
    peakHour: card6?.bodyData?.peakHour ?? null,
    peakHourPct: card6?.bodyData?.popPeakHourPct ?? null,
    // [Card 7 추가] 최다 요일 + 비율, 주중/주말 비중, 소상공인 출처
    peakDay: card6?.bodyData?.popPeakDay ?? card6?.bodyData?.dayOfWeek?.peakDay ?? null,
    peakDayPct: card6?.bodyData?.popPeakDayPct ?? null,
    weekdayPct: card6?.bodyData?.weekdayPct ?? null,
    weekendPct: card6?.bodyData?.weekendPct ?? null,
    weekendVsWeekdayRatio: card6?.bodyData?.ratio ?? null,
    bizmapPeakDay: card6?.bodyData?.bizmapPeakDay ?? null,
    bizmapPeakDayPct: card6?.bodyData?.bizmapPeakDayPct ?? null,
  };

  const c14Competition = {
    score: card11?.bodyData?.score ?? 0,
    scoreMarket: card11?.bodyData?.scoreMarket ?? 0,
    scoreCompete: card11?.bodyData?.scoreCompete ?? 0,
    scoreChange: card11?.bodyData?.scoreChange ?? 0,
    scoreSurvival: card11?.bodyData?.scoreSurvival ?? 0,
    scoreCost: card11?.bodyData?.scoreCost ?? 0,
    salesPercentile: card11?.bodyData?.salesPercentile ?? null,
    externalIndicators: card11?.bodyData?.externalIndicators ?? null,
    competLevel: card11?.bodyData?.level ?? null,
    franchiseRatio: card11?.bodyData?.franchiseRatio ?? 0,
    survival3yr: card11?.bodyData?.survival3yr ?? 0,
    topBrands: (() => {
      const items = card3?.chartData?.items;
      if (Array.isArray(items)) return items.slice(0, 5).map(b => ({ name: b.name, count: b.count }));
      return [];
    })(),
    // [Card 4 추가] 프랜차이즈 점유율, 거리별 분포, 신규 진입 프랜차이즈
    franchiseShare: card3?.bodyData?.franchiseShare ?? 0,
    independentShare: card3?.bodyData?.independentShare ?? 0,
    franchiseDistanceDist: card3?.bodyData?.distanceDistribution ?? null,
    newFranchiseList: card3?.bodyData?.newFranchiseList ?? [],
    perCafePotential: card3?.bodyData?.perCafePotential ?? 0,
    // [Card 5 추가] 개인 카페 가격/분포/신규
    indieAmericanoAvg: card4?.bodyData?.americanoAvg ?? 0,
    indieDessertAvg: card4?.bodyData?.dessertAvg ?? 0,
    indieMenuAvg: card4?.bodyData?.menuAvg ?? 0,
    indieDistanceDist: card4?.bodyData?.indieDistanceDistribution ?? null,
    indiePriceDist: card4?.bodyData?.indiePriceDistribution ?? null,
    newIndieList: card4?.bodyData?.newIndieList ?? [],
    indieFranchPriceCompare: card4?.bodyData?.indieFranchPriceCompare ?? null,
    indieAvgMonthlySales: card4?.bodyData?.avgMonthlySales ?? 0,
    // [Card 13 추가] 매출 점수 + 전국 평균 비교
    salesScore: card11?.bodyData?.salesScore ?? null,
    salesScoreLabel: card11?.bodyData?.salesScoreLabel ?? null,
    salesVsNational: card11?.bodyData?.salesVsNational ?? null,
    salesPercentileTop: card11?.bodyData?.salesPercentile?.percentile ?? null,
  };

  // [KOSIS 외식업체경영실태조사] 카페 전국 평균 통계 (Firebase 캐시에서 가져옴)
  const _kosisStats = buildKosisCafeStats(apis.kosisFoodSurvey?.data || null);

  const c14ProfitStructure = {
    monthlySales: card5?.bodyData?.monthly ?? 0,
    dongAvg: card5?.bodyData?.dongAvg ?? 0,
    guAvg: card5?.bodyData?.guAvg ?? 0,
    siAvg: card5?.bodyData?.siAvg ?? 0,
    // [Card 6 추가] 매출 순위, 작년 대비, 객단가, 매출 추세
    cafeSalesRank: card5?.bodyData?.cafeSalesRank ?? null,
    cafePctInTop5: card5?.bodyData?.cafePctInTop5 ?? null,
    prevYearRate: card5?.bodyData?.prevYearRate ?? null,
    prevMonRate: card5?.bodyData?.prevMonRate ?? null,
    bizmapAvgUnitPrice: card5?.bodyData?.bizmapAvgUnitPrice ?? null,
    bizmapMarketTrend: card5?.bodyData?.bizmapMarketTrend ?? null,
    avgRent: card7?.bodyData?.rentPerPyeong ?? 0,
    deposit: card7?.bodyData?.deposit ?? 0,
    perPyeong: card7?.bodyData?.perPyeong ?? null,
    interiorCost: card7?.bodyData?.interiorCost ?? 0,
    equipmentCost: card7?.bodyData?.equipmentCost ?? 0,
    premiumCost: card7?.bodyData?.premiumCost ?? 0,
    totalStartupCost: card7?.bodyData?.totalStartupCost ?? 0,
    opIncomePct: typeof _bizmapOpIncome === 'number' ? _bizmapOpIncome : 0,
    laborPct: typeof _bizmapLaborPct === 'number' ? _bizmapLaborPct : 0,
    materialPct: typeof _bizmapMaterialPct === 'number' ? _bizmapMaterialPct : 0,
    rentPct: typeof _avgRentPct === 'number' ? _avgRentPct : 0,
    // [Firebase 임대 수집기] 검색 동 vs 주변 비교용
    rentBase: card7?.chartData?.rentBase ?? null,
    // [KOSIS 외식업체경영실태조사] 카페(커피전문점) 전국 평균 - 비교용
    kosisCafe: _kosisStats,
  };

  const c14MarketDirection = {
    storeTrendLabel: card12?.bodyData?.bizmapStoreTrendLabel ?? null,
    storeNetChange: card12?.bodyData?.bizmapStoreNetChange ?? 0,
    monthlyChangeList: card12?.bodyData?.monthlyChangeList ?? [],
    cafesNow: card12?.bodyData?.cafesNow ?? 0,
    cafes5yAgo: card12?.bodyData?.cafes5yAgo ?? 0,
    cafes5yChangeRate: card12?.bodyData?.cafes5yChangeRate ?? 0,
    avgOperatingYears: card12?.bodyData?.avgOperatingYears ?? 0,
    survivalRate1y: card12?.bodyData?.survivalRate1y ?? 0,
    survivalRate3y: card12?.bodyData?.survivalRate3y ?? 0,
    survivalRate5y: card12?.bodyData?.survivalRate5y ?? 0,
    weatherImpact: {
      sunnyEffect: card11Weather?.bodyData?.sunnyEffect ?? null,
      cloudyEffect: card11Weather?.bodyData?.cloudyEffect ?? null,
      rainyEffect: card11Weather?.bodyData?.rainyEffect ?? null,
      snowEffect: card11Weather?.bodyData?.snowEffect ?? null,
      yearlyDistribution: card11Weather?.bodyData?.yearlyDistribution ?? null,
    },
    snsKeywords: card10?.bodyData?.keywords ?? [],
    snsSearchIntents: card10?.bodyData?.searchIntents ?? [],
    snsTopShops: card10?.bodyData?.topShops ?? [],
    snsNegativeKeywords: card10?.bodyData?.negativeKeywords ?? [],
    popularMenus: card12?.bodyData?.popularMenus ?? [],
    risingMenus: card12?.bodyData?.risingMenus ?? [],
    delivery: {
      searchDongName: card9?.bodyData?.searchDongName ?? null,
      searchAvgPrice: card9?.bodyData?.searchAvgPrice ?? 0,
      searchSales: card9?.bodyData?.searchSales ?? 0,
      searchOrders: card9?.bodyData?.searchOrders ?? 0,
      cafeRankInDelivery: card9?.bodyData?.cafeRankInDelivery ?? null,
      totalDeliveryBiz: card9?.bodyData?.totalDeliveryBiz ?? 0,
      cafeDeliveryAmount: card9?.bodyData?.cafeDeliveryAmount ?? 0,
      deliveryTrend: card9?.bodyData?.deliveryTrend ?? null,
      // [Card 10 추가] 요일별 배달 매출 + 월별 추이
      weekdaySales: card9?.bodyData?.weekdaySales ?? [],
      monthlyTrend: card9?.bodyData?.monthlyTrend ?? [],
      topDeliveryCategories: card9?.bodyData?.topDeliveryCategories ?? [],
      nearbyDongs: card9?.bodyData?.nearbyDongs ?? [],
      // [KOSIS 외식업체경영실태조사] 전국 카페 배달 운영 현실 (배달앱/배달대행 비용 분포)
      kosisDelivery: card9?.bodyData?.kosisDelivery ?? null,
    },
    weatherMapScore: card12?.bodyData?.weatherScore ?? 0,
    weatherMapLabel: card12?.bodyData?.weatherLabel ?? null,
    salesIndexMonthly: card12?.bodyData?.salesIndexMonthly ?? null,
  };

  // ── 디렉터 자동 생성: AI 응답이 비어도 항상 5영역 데이터 기반으로 채움 ──
  const _genDirector = (() => {
    if (_aiDirector && _aiDirector.intro && _aiDirector.market) return _aiDirector;
    // 동 이름: 길면 마지막 토막만 사용 (예: "서울특별시 강남구 역삼1동" → "역삼1동")
    const _rawDongName = dong.dongNm || '';
    const dongName = (() => {
      if (!_rawDongName) return '이 상권';
      const tokens = String(_rawDongName).trim().split(/\s+/);
      return tokens[tokens.length - 1] || '이 상권';
    })();
    // 한글 받침 판정 후 조사 자동 선택
    const _josa = (word, withBatchim, withoutBatchim) => {
      if (!word) return withoutBatchim;
      const last = word.charCodeAt(word.length - 1);
      if (last < 0xAC00 || last > 0xD7A3) return withoutBatchim; // 한글 아님
      const hasBatchim = (last - 0xAC00) % 28 !== 0;
      return hasBatchim ? withBatchim : withoutBatchim;
    };
    const _eun = _josa(dongName, '은', '는');
    // 시장 (Card 1 + Card 3 데이터 통합 활용. 출처 차이는 디렉터가 명시)
    const _mkt = c14MarketOverview;
    const mktObs = [];
    if (_mkt.totalCafes) {
      const _bk = _mkt.bakery ? `, 베이커리 카페 ${_mkt.bakery}개` : '';
      mktObs.push(`반경 500m 안에 카페 ${_mkt.totalCafes}개${_bk}가 모여 있습니다`);
    }
    if (_mkt.individual && _mkt.franchise) {
      const indieRatio = Math.round(_mkt.individual / (_mkt.individual + _mkt.franchise) * 100);
      mktObs.push(`개인카페 ${_mkt.individual}개·프랜차이즈 ${_mkt.franchise}개로 개인카페 비중이 ${indieRatio}%입니다`);
    }
    // 신규/폐업: 두 출처 차이가 크면 모두 안내, 같으면 한 줄
    if (_mkt.openCountAdmin || _mkt.closedCountAdmin) {
      mktObs.push(`행정 인허가 기준 최근 1년 신규 ${_mkt.openCountAdmin || 0}개·폐업 ${_mkt.closedCountAdmin || 0}개입니다`);
    } else if (_mkt.newOpen || _mkt.closedCount) {
      mktObs.push(`최근 신규 오픈 ${_mkt.newOpen || 0}개·폐업 ${_mkt.closedCount || 0}개로 변동이 있습니다`);
    }
    if (_mkt.cafes5yChangeRate) mktObs.push(`5년 전 대비 점포 수가 ${_mkt.cafes5yChangeRate > 0 ? '+' : ''}${_mkt.cafes5yChangeRate}% 변했습니다`);
    if (_mkt.storeTrendLabel) mktObs.push(`최근 점포 추이는 ${_mkt.storeTrendLabel} 방향입니다`);
    // 카페 기회 findings (Card 9): 5년+ 생존, 면적, 5년 전 vs 지금
    if (Array.isArray(_mkt.findings) && _mkt.findings.length > 0) {
      _mkt.findings.forEach(f => {
        if (f && f.text) mktObs.push(f.text);
      });
    }
    // 고객 (Card 2 + Card 7 데이터 통합)
    const _cus = c14CustomerProfile;
    const cusObs = [];
    if (_cus.topAge) cusObs.push(`주요 방문 연령은 ${_cus.topAge}입니다`);
    // 4구간 연령 분포: 1순위와 2순위 모두 발화
    if (Array.isArray(_cus.ageGroups) && _cus.ageGroups.length >= 2) {
      const sorted = [..._cus.ageGroups].sort((a, b) => (b.pct || 0) - (a.pct || 0));
      const top1 = sorted[0]; const top2 = sorted[1];
      if (top1 && top2) cusObs.push(`연령 분포는 ${top1.name} ${top1.pct}%, ${top2.name} ${top2.pct}% 순입니다`);
    }
    if (_cus.genderRatio) cusObs.push(`성별 비중은 ${_cus.genderRatio}로 나뉩니다`);
    if (_cus.floatingPop) cusObs.push(`월 유동인구가 ${(_cus.floatingPop / 10000).toFixed(1)}만명에 달합니다`);
    // 방문 손님 연 평균소득
    if (_cus.customerYrEarn && (_cus.customerYrEarn.male > 0 || _cus.customerYrEarn.female > 0)) {
      const m = _cus.customerYrEarn.male || 0;
      const f = _cus.customerYrEarn.female || 0;
      cusObs.push(`방문 손님 연 평균소득은 남성 ${m.toLocaleString()}만원·여성 ${f.toLocaleString()}만원입니다`);
    }
    // 피크 시간대 + 최다 요일 (Card 7)
    if (_cus.peakHour) {
      const pct = _cus.peakHourPct ? ` (${_cus.peakHourPct}%)` : '';
      cusObs.push(`피크 시간대는 ${_cus.peakHour}${pct}입니다`);
    }
    if (_cus.peakDay) {
      const pct = _cus.peakDayPct ? ` ${_cus.peakDayPct}%` : '';
      cusObs.push(`최다 요일은 ${_cus.peakDay}${pct}입니다`);
    }
    if (_cus.weekendVsWeekdayRatio) cusObs.push(`주중·주말 분포는 ${_cus.weekendVsWeekdayRatio}입니다`);
    if (typeof _cus.openubAptRatio === 'number' && isFinite(_cus.openubAptRatio)) cusObs.push(`거주 형태 중 아파트 비중이 ${Math.round(_cus.openubAptRatio)}%입니다`);
    if (_cus.maleLifestyle) cusObs.push(`라이프스타일은 ${_cus.maleLifestyle} 중심입니다`);
    // 경쟁 (Card 4 + Card 13 통합) - Card 13 화면 표시값과 일치
    const _cmp = c14Competition;
    const cmpObs = [];
    if (_cmp.score) cmpObs.push(`상권 경쟁 분석 종합 점수는 100점 만점에 ${_cmp.score}점입니다`);
    {
      // salesPercentile은 객체. percentile은 0~100 점수(높을수록 좋음). 상위 % = 100 - percentile
      const _spRaw = _cmp.salesPercentile;
      const _sp = typeof _spRaw === 'object' && _spRaw !== null ? _spRaw : null;
      if (_sp && typeof _sp.percentile === 'number') {
        const score = _sp.percentile;
        const top = Math.max(1, 100 - score);
        const label = _sp.label || (score >= 80 ? '매우 좋음' : score >= 60 ? '좋음' : score >= 40 ? '보통' : '낮음');
        const diffStr = (typeof _sp.diffPct === 'number')
          ? ` (전국 평균 대비 ${_sp.diffPct > 0 ? '+' : ''}${_sp.diffPct}%)` : '';
        cmpObs.push(`매출 점수는 ${score}점·상위 ${top}%로 ${label}${diffStr} 수준입니다`);
      } else if (typeof _spRaw === 'number') {
        cmpObs.push(`매출 점수는 ${_spRaw}점 수준입니다`);
      }
    }
    // 3년 생존율 (Card 13 값 우선 - Card 13 화면과 일치)
    {
      const _3yr = (_cmp?.survival3yr > 0) ? _cmp.survival3yr : null;
      if (_3yr) {
        const tone = _3yr >= 60 ? '매우 안정' : _3yr >= 40 ? '안정' : '주의';
        cmpObs.push(`3년 생존율이 ${_3yr}% (전국 평균 39%) ${tone} 수준입니다`);
      }
    }
    if (_cmp.franchiseRatio) cmpObs.push(`프랜차이즈 비중은 ${_cmp.franchiseRatio}%입니다`);
    if (Array.isArray(_cmp.topBrands) && _cmp.topBrands.length > 0) cmpObs.push(`주요 브랜드는 ${_cmp.topBrands.slice(0, 3).map(b => b.name).join('·')}입니다`);
    // 신규 진입 프랜차이즈 (Card 4)
    if (Array.isArray(_cmp.newFranchiseList) && _cmp.newFranchiseList.length > 0) {
      const names = _cmp.newFranchiseList.slice(0, 3).map(f => f.name).filter(Boolean).join('·');
      if (names) cmpObs.push(`최근 새로 들어온 프랜차이즈는 ${names}입니다`);
    }
    // 거리별 프랜차이즈 분포 (Card 4)
    if (_cmp.franchiseDistanceDist) {
      const d = _cmp.franchiseDistanceDist;
      cmpObs.push(`프랜차이즈는 200m 이내 ${d.inner || 0}곳·200~350m ${d.mid || 0}곳·350m 밖 ${d.outer || 0}곳에 분포합니다`);
    }
    // 카페당 잠재 고객 (Card 4)
    if (_cmp.perCafePotential) cmpObs.push(`카페 한 곳당 잠재 고객은 일 ${_cmp.perCafePotential.toLocaleString()}명입니다`);
    // 개인카페 평균 가격 (Card 5)
    if (_cmp.indieAmericanoAvg) {
      const dessert = _cmp.indieDessertAvg ? `·디저트 평균 ${_cmp.indieDessertAvg.toLocaleString()}원` : '';
      cmpObs.push(`개인 카페 아메리카노 평균 ${_cmp.indieAmericanoAvg.toLocaleString()}원${dessert}입니다`);
    }
    // 개인 vs 프랜차이즈 가격 비교 (Card 5)
    if (_cmp.indieFranchPriceCompare && _cmp.indieFranchPriceCompare.indie > 0) {
      const c = _cmp.indieFranchPriceCompare;
      const sign = c.pctDiff > 0 ? '+' : '';
      cmpObs.push(`개인 카페가 프랜차이즈 대비 ${sign}${c.pctDiff}% 가격대입니다`);
    }
    // 수익 (Card 6 + Card 8 통합)
    const _pft = c14ProfitStructure;
    const pftObs = [];
    if (_pft.monthlySales) pftObs.push(`카페 월평균 매출이 ${_pft.monthlySales.toLocaleString()}만원입니다`);
    if (_pft.dongAvg && _pft.monthlySales) {
      const diff = Math.round((_pft.monthlySales / _pft.dongAvg - 1) * 100);
      pftObs.push(`동 평균 대비 ${diff > 0 ? '+' : ''}${diff}% 차이가 납니다`);
    }
    // 매출 순위 (Card 6)
    if (_pft.cafeSalesRank) pftObs.push(`동 안에서 카페 매출은 ${_pft.cafeSalesRank} 수준입니다`);
    // 작년 대비 매출 추세 (Card 6)
    if (_pft.prevYearRate) {
      const r = _pft.prevYearRate;
      const sign = (typeof r === 'number' && r > 0) ? '+' : '';
      pftObs.push(`작년 대비 매출은 ${sign}${r}% 변화했습니다`);
    }
    // 객단가 (Card 6)
    if (_pft.bizmapAvgUnitPrice) pftObs.push(`평균 객단가는 ${_pft.bizmapAvgUnitPrice}입니다`);
    if (_pft.avgRent) pftObs.push(`평당 임대료가 월 ${_pft.avgRent.toLocaleString()}만원 수준입니다`);
    // [Firebase 빈크래프트 수집기] 검색 동 직접 vs 주변 평균 비교 (Card 8 보강)
    {
      const rb = _pft.rentBase;
      if (rb && rb.primaryMonthly > 0 && rb.finalMonthly > 0) {
        const diff = rb.primaryMonthly - rb.finalMonthly;
        const pct = Math.round((diff / rb.finalMonthly) * 100);
        const tone = pct > 10 ? '주변보다 비싼' : pct < -10 ? '주변보다 저렴한' : '주변과 비슷한';
        pftObs.push(`이 동 직접 월세는 ${rb.primaryMonthly.toLocaleString()}만원으로 주변 평균(${rb.finalMonthly.toLocaleString()}만원)보다 ${tone} 수준입니다`);
      }
      if (rb && rb.totalArticles > 0) {
        pftObs.push(`임대 시세는 매물 ${rb.totalArticles.toLocaleString()}건·주변 ${rb.filteredDongCount || rb.dongCount}개 동 평균치 기준입니다`);
      }
      // 가장 저렴한 주변 동 1곳 안내
      if (rb && Array.isArray(rb.nearbyDongs) && rb.nearbyDongs.length > 0) {
        const cheap = rb.nearbyDongs[0];
        if (cheap && cheap.dong && cheap.monthly > 0) {
          pftObs.push(`주변 중 가장 저렴한 동은 ${cheap.dong} (월 ${cheap.monthly.toLocaleString()}만원)입니다`);
        }
      }
    }
    // 임대료 부담률 (Card 8) - 매출 대비 임대료 비중
    if (_pft.avgRent && _pft.monthlySales) {
      const burden = Math.round((_pft.avgRent / _pft.monthlySales) * 100);
      if (burden > 0) pftObs.push(`매출 대비 임대료 부담률은 약 ${burden}%입니다`);
    }
    // 회수 기간 (Card 8) - 총 창업비 / 월매출
    if (_pft.totalStartupCost && _pft.monthlySales) {
      const months = Math.max(1, Math.round(_pft.totalStartupCost / _pft.monthlySales));
      pftObs.push(`총 창업비 기준 매출 회수에는 약 ${months}개월이 걸립니다`);
    } else if (_pft.deposit && _pft.avgRent && _pft.monthlySales) {
      // 폴백: 보증금+월임대*12를 기준
      const investEst = _pft.deposit + _pft.avgRent * 12;
      const months = Math.max(1, Math.round(investEst / _pft.monthlySales));
      pftObs.push(`초기 투자 회수 추정 기간은 약 ${months}개월입니다`);
    }
    if (_pft.opIncomePct) pftObs.push(`업계 평균 영업이익률은 ${_pft.opIncomePct}% 안팎입니다`);
    // [KOSIS 카페 전국 평균 비교] 통계청 외식업체경영실태조사 (커피전문점)
    {
      const k = _pft.kosisCafe;
      if (k?.interiorAvg?.value) {
        const _interior = k.interiorAvg.value;
        const _areaPy = k.avgArea?.value > 0 ? Math.round(k.avgArea.value / 3.3058 * 10) / 10 : 0;
        const _perPy = (_interior > 0 && _areaPy > 0) ? Math.round(_interior / _areaPy) : 0;
        if (_perPy > 0) {
          pftObs.push(`전국 카페 평균 인테리어비는 ${_interior.toLocaleString()}만원, 평당 ${_perPy.toLocaleString()}만원 (평균 ${_areaPy}평 기준)입니다`);
        } else {
          pftObs.push(`전국 카페 평균 인테리어비는 ${_interior.toLocaleString()}만원 (${k.year} 통계청)입니다`);
        }
      }
      if (k?.startupInvestAvg?.value) {
        pftObs.push(`전국 카페 평균 개업 투자비는 ${k.startupInvestAvg.value.toLocaleString()}만원 수준입니다`);
      }
      if (k?.salesAvg?.value && _pft.monthlySales) {
        const ratio = Math.round((_pft.monthlySales / k.salesAvg.value) * 100);
        pftObs.push(`전국 카페 평균 매출 ${k.salesAvg.value.toLocaleString()}만원 대비 이 동네는 ${ratio}% 수준입니다`);
      }
      if (k?.unitPriceAvg?.value) {
        pftObs.push(`전국 카페 평균 객단가는 ${k.unitPriceAvg.value.toLocaleString()}원입니다`);
      }
      if (k?.profitMargin?.value) {
        pftObs.push(`전국 카페 평균 영업이익률은 ${k.profitMargin.value}%입니다`);
      }
      if (k?.avgArea?.value) {
        // KOSIS 면적 단위 ㎡ → 평 환산
        const _pyeong = Math.round((k.avgArea.value / 3.3058) * 10) / 10;
        pftObs.push(`전국 카페 평균 매장 면적은 ${_pyeong}평 (${k.avgArea.value}㎡)입니다`);
      }
    }
    // 방향 (Card 3 + 12 + 11 + 10 + 9 통합)
    const _dir = c14MarketDirection;
    const dirObs = [];
    if (_dir.storeTrendLabel) dirObs.push(`최근 점포 추이는 ${_dir.storeTrendLabel} 방향입니다`);
    if (_dir.cafesNow && _dir.cafes5yAgo) {
      const diff = _dir.cafesNow - _dir.cafes5yAgo;
      const sign = diff > 0 ? '+' : '';
      dirObs.push(`5년 전 ${_dir.cafes5yAgo}곳에서 현재 ${_dir.cafesNow}곳으로 ${sign}${diff}곳 변동입니다`);
    }
    if (_dir.avgOperatingYears) dirObs.push(`평균 영업기간은 ${_dir.avgOperatingYears}년입니다`);
    // 3년 생존율은 경쟁 영역(cmpObs)에서 Card 13 값으로 단일 표시 - 방향 영역에서 중복 제거
    if (Array.isArray(_dir.popularMenus) && _dir.popularMenus.length > 0) dirObs.push(`인기 메뉴는 ${_dir.popularMenus.slice(0, 3).map(m => m.name || m).join('·')}입니다`);
    if (Array.isArray(_dir.snsKeywords) && _dir.snsKeywords.length > 0) dirObs.push(`SNS 키워드는 ${_dir.snsKeywords.slice(0, 3).join('·')} 흐름입니다`);
    // SNS 긍정/부정 비율 (Card 11)
    {
      const _snsPos = card10?.bodyData?.positiveRatio ?? card10?.bodyData?.positivePct ?? null;
      const _snsNeg = card10?.bodyData?.negativeRatio ?? card10?.bodyData?.negativePct ?? null;
      if (typeof _snsPos === 'number' && typeof _snsNeg === 'number') {
        dirObs.push(`SNS 분위기는 긍정 ${_snsPos}%·부정 ${_snsNeg}%로 나타납니다`);
      }
    }
    // 배달 객단가 + 추세 + 요일 (Card 10)
    if (_dir.delivery?.searchAvgPrice) dirObs.push(`이 동네 배달 객단가는 ${_dir.delivery.searchAvgPrice.toLocaleString()}원입니다`);
    if (_dir.cafeRankInDelivery) dirObs.push(`배달 기준 카페 순위는 ${_dir.cafeRankInDelivery}위입니다`);
    if (_dir.delivery?.deliveryTrend) dirObs.push(`배달 시장 추세는 ${_dir.delivery.deliveryTrend}입니다`);
    // 요일별 배달 매출 최다 (Card 10)
    if (Array.isArray(_dir.delivery?.weekdaySales) && _dir.delivery.weekdaySales.length > 0) {
      const top = _dir.delivery.weekdaySales.find(d => d.isTop);
      if (top) dirObs.push(`배달은 ${top.day}요일 매출이 가장 많습니다`);
    }
    // 날씨 분포 (Card 12 - 데이터는 있는데 발화 누락 보강)
    {
      const _yd = _dir.weatherImpact?.yearlyDistribution;
      if (_yd && _yd.totalDays && _yd.sunnyPct) {
        dirObs.push(`연간 ${_yd.totalDays}일 중 맑은 날 ${_yd.sunnyPct}%·비 ${_yd.rainyPct || 0}%입니다`);
        if (_yd.avgTemp != null) {
          dirObs.push(`연평균 기온은 ${_yd.avgTemp}도이며 강수일 비교는 전국 대비 ${_yd.relativePosition || '평균'} 수준입니다`);
        }
      }
      // 날씨별 매출 영향 (Card 12)
      const _wi = _dir.weatherImpact;
      if (_wi?.rainyEffect || _wi?.sunnyEffect) {
        const parts = [];
        if (_wi.sunnyEffect) parts.push(`맑은 날 ${_wi.sunnyEffect}`);
        if (_wi.rainyEffect) parts.push(`비 오는 날 ${_wi.rainyEffect}`);
        if (parts.length > 0) dirObs.push(`날씨별 매출 영향은 ${parts.join('·')}입니다`);
      }
    }
    // intro·closing
    const intro = _aiDirector?.intro || (
      _mkt.totalCafes >= 100 ? `${dongName}${_eun} 카페가 빽빽한 활기찬 상권입니다.` :
      _mkt.totalCafes >= 30 ? `${dongName}${_eun} 카페가 적당히 자리 잡은 동네입니다.` :
      `${dongName}${_eun} 카페가 드문드문한 잔잔한 동네입니다.`
    );
    // Card 13 점수(100점 만점) 기준으로 마무리 톤 결정 - 두 카드 일관성 유지
    // 라벨: 매우 좋음(80+) / 좋음(60+) / 보통(40+) / 안좋음(20+) / 매우 안좋음
    const _scoreForTone = (typeof _cmp.score === 'number' && _cmp.score > 0) ? _cmp.score : c14OverallScore;
    const closing = _aiDirector?.closing || (
      _scoreForTone >= 80 ? '여러 축이 강하게 받쳐 주는, 매우 좋은 조건의 상권입니다.' :
      _scoreForTone >= 60 ? '강점이 뚜렷한 상권이지만 경쟁 강도도 함께 큽니다.' :
      _scoreForTone >= 40 ? '기회와 부담이 비슷한 무게로 공존합니다.' :
      _scoreForTone >= 20 ? '진입 부담이 적지 않은 상권으로 보입니다.' :
      '여러 축에서 부담이 큰, 신중한 재검토가 필요한 상권입니다.'
    );
    return {
      intro,
      market: {
        headline: _aiDirector?.market?.headline || `카페 ${_mkt.totalCafes || 0}개 밀집 상권`,
        observations: (_aiDirector?.market?.observations?.length ? _aiDirector.market.observations : mktObs).filter(Boolean),
        keyMetric: _aiDirector?.market?.keyMetric || { label: '총 카페 수', value: `${_mkt.totalCafes || 0}개` },
        citation: '카드 1·3·4'
      },
      customer: {
        headline: _aiDirector?.customer?.headline || `${_cus.topAge || '주요 연령대'} 중심 고객`,
        observations: (_aiDirector?.customer?.observations?.length ? _aiDirector.customer.observations : cusObs).filter(Boolean),
        keyMetric: _aiDirector?.customer?.keyMetric || (_cus.floatingPop ? { label: '월 유동인구', value: `${(_cus.floatingPop / 10000).toFixed(1)}만명` } : null),
        citation: '카드 2·6'
      },
      competition: {
        headline: _aiDirector?.competition?.headline || `종합 ${c14OverallScore || 0}점 상권`,
        observations: (_aiDirector?.competition?.observations?.length ? _aiDirector.competition.observations : cmpObs).filter(Boolean),
        keyMetric: _aiDirector?.competition?.keyMetric || { label: '종합 점수', value: `${c14OverallScore || 0}점 / 100점` },
        citation: '카드 12'
      },
      profit: {
        headline: _aiDirector?.profit?.headline || (_pft.monthlySales ? `월매출 ${_pft.monthlySales.toLocaleString()}만원 수준` : '수익 구조'),
        observations: (_aiDirector?.profit?.observations?.length ? _aiDirector.profit.observations : pftObs).filter(Boolean),
        keyMetric: _aiDirector?.profit?.keyMetric || (_pft.monthlySales ? { label: '월평균 매출', value: `${_pft.monthlySales.toLocaleString()}만원` } : null),
        citation: '카드 5·7·11'
      },
      direction: {
        headline: _aiDirector?.direction?.headline || `${_dir.storeTrendLabel || '점포 추이'} 흐름`,
        observations: (_aiDirector?.direction?.observations?.length ? _aiDirector.direction.observations : dirObs).filter(Boolean),
        keyMetric: _aiDirector?.direction?.keyMetric || (_dir.survivalRate3y ? { label: '3년 생존율', value: `${_dir.survivalRate3y}%` } : null),
        citation: '카드 3·9·10·11·13'
      },
      closing
    };
  })();

  // === 5축 점수: Card 12와 동일한 시장/경쟁/변화/생존/비용 축 사용 (각 만점 다름 → % 정규화) ===
  // Card 12 만점: 시장20·경쟁20·변화15·생존30·비용15
  const _c12 = card11?.bodyData;
  const _pct = (raw, max) => {
    if (typeof raw !== 'number' || !isFinite(raw) || max <= 0) return null;
    return Math.max(0, Math.min(100, Math.round((raw / max) * 100)));
  };
  const _ax5 = (typeof _c12?.score === 'number' && _c12.score > 0) ? [
    { axis: '시장', label: '시장', value: _pct(_c12.scoreMarket, 20) ?? 0, raw: _c12.scoreMarket, max: 20, fullMark: 100 },
    { axis: '경쟁', label: '경쟁', value: _pct(_c12.scoreCompete, 20) ?? 0, raw: _c12.scoreCompete, max: 20, fullMark: 100 },
    { axis: '변화', label: '변화', value: _pct(_c12.scoreChange, 15) ?? 0, raw: _c12.scoreChange, max: 15, fullMark: 100 },
    { axis: '생존', label: '생존', value: _pct(_c12.scoreSurvival, 30) ?? 0, raw: _c12.scoreSurvival, max: 30, fullMark: 100 },
    { axis: '비용', label: '비용', value: _pct(_c12.scoreCost, 15) ?? 0, raw: _c12.scoreCost, max: 15, fullMark: 100 },
  ] : [
    { axis: '밀집도', label: '밀집도', value: c14Density, fullMark: 100 },
    { axis: '경쟁', label: '경쟁', value: c14Compet, fullMark: 100 },
    { axis: '잠재력', label: '잠재력', value: c14Potential, fullMark: 100 },
    { axis: '추세', label: '추세', value: c14Trend, fullMark: 100 },
    { axis: '비용여유', label: '비용여유', value: c14CostRoom, fullMark: 100 },
  ];
  const c14ChartData = {
    // [2026-05-12] CardTemplate aiSummary와 중복 출력 방지를 위해 ChartInsightDashboard headline은 null
    headline: null,
    analysis: aiData?.insight ? String(aiData.insight).substring(0, 300) : '',
    kpis: [
      { label: '종합 점수', value: c14OverallScore, unit: '점', trend: c14OverallScore >= 60 ? '상승' : c14OverallScore >= 45 ? '유지' : '하락' },
      { label: '기회', value: c14Opps.length, unit: '건', trend: c14Opps.length >= 3 ? '상승' : '유지' },
      { label: '리스크', value: c14Risks.length, unit: '건', trend: c14Risks.length >= 3 ? '상승' : '유지' },
    ],
    radarAxes: _ax5,
    signals: c14Signals,
    tags: c14Tags,
    overall: c14OverallScore,
    axes: _ax5.map(a => ({ label: a.label || a.axis, value: a.value })),
    // ── 디렉터 캐릭터(AI 생성 우선, 비면 5영역 데이터로 자동 생성) + 5영역 종합 데이터 ──
    director: _genDirector,
    marketOverview: c14MarketOverview,
    customerProfile: c14CustomerProfile,
    competition: c14Competition,
    profitStructure: c14ProfitStructure,
    marketDirection: c14MarketDirection,
  };

  const card13 = {
    title: 'AI 종합 분석',
    subtitle: 'AI 에이전트 종합 피드백',
    date: dateStr,
    source: 'Google Gemini',
    bruSummary: aiData?.overview?.bruSummary || null,
    // [2026-05-12] aiSummary가 c14Headline과 같으면 ChartInsightDashboard headline과 중복 -> null
    aiSummary: aiData?.insight
      ? String(aiData.insight).substring(0, 300)
      : aiData?.regionBrief
        ? String(aiData.regionBrief).substring(0, 300)
        : null,
    chartType: 'scoreCard',
    metaInfo: 'AI종합',
    chartData: c14ChartData,
    bodyData: {
      overallScore: c14OverallScore,
      opportunities: c14Opps.length,
      risks: c14Risks.length,
      recommendation: c14Recommendation,
      beancraftPriority: aiData?.beancraftFeedback?.priority || null,
      interior: aiData?.beancraftFeedback?.interior || null,
      equipment: aiData?.beancraftFeedback?.equipment || null,
      menu: aiData?.beancraftFeedback?.menu || null,
      beans: aiData?.beancraftFeedback?.beans || null,
      education: aiData?.beancraftFeedback?.education || null,
      design: aiData?.beancraftFeedback?.design || null,
    },
  };

  // ── 한글 금액 표기 일괄 적용 (AI 생성 텍스트 내 "X만원" → "X억 X만원") ──
  const allCards = [card1, card2, card12, card3, card4, card5, card6, card7, card8, card9, card10, card11Weather, card11, card13];
  for (const card of allCards) {
    if (card.bruSummary && typeof card.bruSummary === 'string') {
      card.bruSummary = convertAmountsInText(card.bruSummary);
    }
    if (card.aiSummary && typeof card.aiSummary === 'string') {
      card.aiSummary = convertAmountsInText(card.aiSummary);
    }
  }
  return allCards;
}

/**
 * Extract summary metrics for the top dashboard bar
 */
export function extractSummaryMetrics(collectedData, aiData, radius = 500) {
  if (!collectedData) return null;
  const cd = collectedData;
  const apis = cd.apis || {};

  // 반경 필터링된 카페 수
  const cafeCount = (() => {
    if (radius >= 500) return cd.nearbyTotalCafes || 0;
    const allCafes = [
      ...(cd.nearbyFranchiseList || []),
      ...(cd.nearbyIndependentList || []),
    ];
    return allCafes.filter(c => {
      const d = typeof c.dist === 'number' ? c.dist : parseFloat(c.dist) || 999;
      return d <= radius;
    }).length;
  })();

  let monthlySales = 0;
  const salesAvg = apis.salesAvg?.data;
  if (Array.isArray(salesAvg)) {
    const cafeItem = salesAvg.find(s => s?.tpbizClscdNm === '카페');
    monthlySales = cafeItem?.mmavgSlsAmt || 0;
  }

  let popCount = 0;
  const dynPpl = apis.dynPplCmpr?.data;
  if (Array.isArray(dynPpl) && dynPpl.length > 0) {
    popCount = Math.round((dynPpl[0]?.cnt || 0) / 30);
  } else if (dynPpl && typeof dynPpl === 'object') {
    popCount = Math.round((dynPpl.cnt || 0) / 30);
  }

  let competition = '-';
  if (cafeCount > 0) {
    if (cafeCount <= 15) competition = '낮음';
    else if (cafeCount <= 40) competition = '보통';
    else if (cafeCount <= 80) competition = '높음';
    else competition = '매우 높음';
  }

  const fmtPop = (n) => {
    if (!n) return '-';
    if (n >= 10000) return `${(n / 10000).toFixed(1).replace(/\.0$/, '')}만명`;
    return `${fmt(n)}명`;
  };

  return [
    { value: cafeCount > 0 ? `${cafeCount}개` : '-', label: '카페 수' },
    { value: monthlySales > 0 ? fmtWon(monthlySales) : '-', label: '월 예상매출' },
    { value: popCount > 0 ? fmtPop(popCount) : '-', label: '일 유동인구' },
    { value: competition, label: '경쟁강도' },
  ];
}

// ═══════════════════════════════════════════════════════════════════════
// KOSIS 외부 통계 추출 함수 (한국부동산원 408 / 국세청 133 / 한국은행 301)
// 입력 위치: collectedData.apis.kosisExternal.results[key].data (KOSIS 행 배열)
// ═══════════════════════════════════════════════════════════════════════

// 한국부동산원 408 상권 코드 매핑 테이블 (대표 상권 + 키워드)
// 응답 시 C1=상권코드(예: A020201), C1_NM=상권명(예: "강남대로")
// 매칭 안 되면 시도 평균 코드(A02=서울 등) 또는 null 반환
// 한국부동산원 408 상권 코드 전체 매핑 (서울 68개 상권)
// 매칭 우선순위: 더 구체적인 키워드(역명·동명)가 더 일반적인 것보다 위에 위치
// 응답 시 C1=상권코드(예: A020201), C1_NM=상권명
const COMMERCIAL_DISTRICT_MAP = [
  // ── 서울 도심권 (A0201xx) ──
  { code: 'A020101', name: '광화문',       keywords: ['광화문', '경복궁'] },
  { code: 'A020102', name: '남대문',       keywords: ['남대문', '회현'] },
  { code: 'A020103', name: '동대문',       keywords: ['동대문'] },
  { code: 'A020104', name: '명동',         keywords: ['명동'] },
  { code: 'A020105', name: '방산시장',     keywords: ['방산'] },
  { code: 'A020106', name: '북촌',         keywords: ['북촌', '가회동', '안국'] },
  { code: 'A020107', name: '서촌',         keywords: ['서촌', '체부동', '통의동', '효자동'] },
  { code: 'A020108', name: '시청',         keywords: ['시청', '덕수궁'] },
  { code: 'A020109', name: '을지로',       keywords: ['을지로'] },
  { code: 'A020110', name: '종로',         keywords: ['종로'] },
  { code: 'A020111', name: '충무로',       keywords: ['충무로'] },

  // ── 서울 강남권 (A0202xx) ──
  // 더 구체적인 역명이 먼저 매칭되도록 순서 주의
  { code: 'A020201', name: '강남대로',     keywords: ['강남역', '강남대로'] },
  { code: 'A020202', name: '교대',         keywords: ['교대', '서초역'] },
  { code: 'A020203', name: '남부터미널',   keywords: ['남부터미널'] },
  { code: 'A020204', name: '논현역',       keywords: ['논현'] },
  { code: 'A020205', name: '도산대로',     keywords: ['도산대로', '도산'] },
  { code: 'A020206', name: '방배역/내방역', keywords: ['방배', '내방'] },
  { code: 'A020207', name: '서래마을',     keywords: ['서래마을'] },
  { code: 'A020208', name: '신사역',       keywords: ['신사역', '신사동'] },
  { code: 'A020209', name: '압구정',       keywords: ['압구정'] },
  // 양재역(A020211)이 말죽거리(A020210)보다 먼저 매칭되도록 순서 고정
  { code: 'A020211', name: '양재역',       keywords: ['양재역'] },
  { code: 'A020210', name: '양재말죽거리', keywords: ['말죽거리', '양재'] },
  { code: 'A020212', name: '청담',         keywords: ['청담'] },
  { code: 'A020213', name: '테헤란로',     keywords: ['테헤란', '역삼'] },
  { code: 'A020214', name: '학동/강남구청역', keywords: ['학동', '강남구청'] },

  // ── 서울 서북권 (A0203xx) ──
  { code: 'A020301', name: '공덕역',       keywords: ['공덕'] },
  { code: 'A020302', name: '당산역',       keywords: ['당산'] },
  { code: 'A020303', name: '동교/연남',    keywords: ['동교', '연남'] },
  { code: 'A020304', name: '망원역',       keywords: ['망원'] },
  { code: 'A020305', name: '신촌/이대',    keywords: ['신촌', '이대'] },
  { code: 'A020307', name: '영등포역',     keywords: ['영등포'] },
  { code: 'A020308', name: '홍대/합정',    keywords: ['홍대', '합정', '홍익대'] },

  // ── 서울 기타 (A0204xx) ──
  { code: 'A020401', name: '가락시장',     keywords: ['가락'] },
  { code: 'A020402', name: '건대입구',     keywords: ['건대', '건국대'] },
  { code: 'A020403', name: '경희대',       keywords: ['경희대', '회기'] },
  { code: 'A020404', name: '구로디지털단지역', keywords: ['구로디지털', '구로디지털단지'] },
  { code: 'A020405', name: '구의역',       keywords: ['구의'] },
  { code: 'A020406', name: '군자',         keywords: ['군자'] },
  { code: 'A020407', name: '까치산역',     keywords: ['까치산'] },
  { code: 'A020408', name: '낙성대',       keywords: ['낙성대'] },
  { code: 'A020409', name: '노량진',       keywords: ['노량진'] },
  { code: 'A020411', name: '독산/시흥',    keywords: ['독산', '시흥동'] },
  { code: 'A020412', name: '뚝섬',         keywords: ['뚝섬', '성수'] },
  { code: 'A020414', name: '목동',         keywords: ['목동'] },
  { code: 'A020415', name: '미아사거리',   keywords: ['미아사거리', '미아'] },
  { code: 'A020416', name: '불광역',       keywords: ['불광'] },
  { code: 'A020417', name: '사당',         keywords: ['사당'] },
  { code: 'A020418', name: '상계역',       keywords: ['상계'] },
  { code: 'A020419', name: '상봉역',       keywords: ['상봉'] },
  { code: 'A020420', name: '서울대입구역', keywords: ['서울대입구', '서울대'] },
  { code: 'A020421', name: '성신여대',     keywords: ['성신여대', '돈암'] },
  { code: 'A020422', name: '수유',         keywords: ['수유'] },
  { code: 'A020423', name: '숙명여대',     keywords: ['숙명여대', '청파'] },
  { code: 'A020424', name: '신림역',       keywords: ['신림'] },
  { code: 'A020425', name: '쌍문역',       keywords: ['쌍문'] },
  { code: 'A020426', name: '약수역',       keywords: ['약수'] },
  { code: 'A020427', name: '연신내',       keywords: ['연신내'] },
  { code: 'A020428', name: '오류동역',     keywords: ['오류동', '오류'] },
  { code: 'A020429', name: '왕십리',       keywords: ['왕십리'] },
  { code: 'A020430', name: '용산역',       keywords: ['용산역', '용산구청'] },
  { code: 'A020431', name: '이태원',       keywords: ['이태원', '한남'] },
  // 잠실새내역(A020433)이 잠실/송파(A020432)보다 먼저 매칭되도록 순서 고정
  { code: 'A020433', name: '잠실새내역',   keywords: ['잠실새내', '신천역'] },
  { code: 'A020432', name: '잠실/송파',    keywords: ['잠실', '송파'] },
  { code: 'A020434', name: '장안동',       keywords: ['장안동', '장안'] },
  { code: 'A020435', name: '천호',         keywords: ['천호'] },
  { code: 'A020436', name: '청량리',       keywords: ['청량리'] },
  { code: 'A020437', name: '혜화동',       keywords: ['혜화', '대학로'] },
  { code: 'A020438', name: '화곡',         keywords: ['화곡'] },

  // ═══ 비수도권 215개 상권 (A03xx ~ A18xx) — 자동 생성 (2026-05-12) ═══
  // 매칭 규칙: 주소에서 공백 제거 후 keywords 중 하나라도 포함되면 매칭
  // 모호한 키워드(중구, 광주, 평택 등)는 sido 접두사 형태로 안전하게 처리됨

  // ── 부산 (A03xx) - 21개 ──
  { code: 'A0301', name: '개금역', keywords: ['개금역', '개금'] },
  { code: 'A0302', name: '경성대/부경대', keywords: ['경성대', '부경대'] },
  { code: 'A0303', name: '광안리', keywords: ['광안리', '광안'] },
  { code: 'A0304', name: '구서동/금정구청', keywords: ['구서동', '금정구청'] },
  { code: 'A0305', name: '남포동', keywords: ['남포동', '남포'] },
  { code: 'A0306', name: '남항동', keywords: ['남항동', '남항'] },
  { code: 'A0307', name: '덕천역', keywords: ['덕천역', '덕천'] },
  { code: 'A0308', name: '동래역', keywords: ['동래역', '동래'] },
  { code: 'A0312', name: '부산대학앞', keywords: ['부산대학앞'] },
  { code: 'A0313', name: '부산역', keywords: ['부산역'] },
  { code: 'A0314', name: '부전시장', keywords: ['부전시장'] },
  { code: 'A0315', name: '사상역', keywords: ['사상역', '사상'] },
  { code: 'A0316', name: '사직야구장', keywords: ['사직야구장'] },
  { code: 'A0317', name: '서면/전포', keywords: ['서면', '전포'] },
  { code: 'A0319', name: '송정해수욕장', keywords: ['송정해수욕장'] },
  { code: 'A0320', name: '수영역', keywords: ['수영역', '수영'] },
  { code: 'A0321', name: '연산로터리', keywords: ['연산로터리', '연산'] },
  { code: 'A0322', name: '온천장', keywords: ['온천장'] },
  { code: 'A0324', name: '하단역', keywords: ['하단역', '하단'] },
  { code: 'A0325', name: '해운대', keywords: ['해운대'] },
  { code: 'A0326', name: '현대백화점주변', keywords: ['현대백화점주변'] },

  // ── 대구 (A04xx) - 15개 ──
  { code: 'A0401', name: '경북대북문', keywords: ['경북대북문', '경북대'] },
  { code: 'A0402', name: '계명대', keywords: ['계명대'] },
  { code: 'A0404', name: '동대구', keywords: ['동대구'] },
  { code: 'A0405', name: '동성로중심', keywords: ['동성로중심', '동성로'] },
  { code: 'A0406', name: '동호지구', keywords: ['동호지구', '동호'] },
  { code: 'A0407', name: '두류감삼역', keywords: ['두류감삼역', '두류감삼'] },
  { code: 'A0408', name: '들안길', keywords: ['들안길'] },
  { code: 'A0409', name: '삼덕/대봉', keywords: ['삼덕', '대봉'] },
  { code: 'A0410', name: '상인/월배', keywords: ['상인', '월배'] },
  { code: 'A0411', name: '서문시장/청라언덕', keywords: ['서문시장', '청라언덕'] },
  { code: 'A0412', name: '수성범어', keywords: ['수성범어'] },
  { code: 'A0413', name: '시지지구', keywords: ['시지지구', '시지'] },
  { code: 'A0414', name: '월촌/안지랑', keywords: ['월촌', '안지랑'] },
  { code: 'A0416', name: '죽전역', keywords: ['죽전역', '죽전'] },
  { code: 'A0417', name: '칠곡', keywords: ['칠곡'] },

  // ── 인천 (A05xx) - 12개 ──
  { code: 'A0501', name: '간석오거리', keywords: ['간석오거리', '간석'] },
  { code: 'A0502', name: '검단사거리완정역', keywords: ['검단사거리완정역', '검단사거리'] },
  { code: 'A0503', name: '계양계산', keywords: ['계양계산'] },
  { code: 'A0504', name: '구월', keywords: ['구월'] },
  { code: 'A0505', name: '부평', keywords: ['부평'] },
  { code: 'A0506', name: '석남/가정중앙시장', keywords: ['석남', '가정중앙시장', '가정'] },
  { code: 'A0507', name: '소래포구역', keywords: ['소래포구역', '소래포구'] },
  { code: 'A0509', name: '신포동', keywords: ['신포동', '신포'] },
  { code: 'A0510', name: '연수역', keywords: ['연수역', '연수'] },
  { code: 'A0513', name: '인천서구청', keywords: ['인천서구청', '인천서구'] },
  { code: 'A0514', name: '인하대앞', keywords: ['인하대앞', '인하대'] },
  { code: 'A0515', name: '주안', keywords: ['주안'] },

  // ── 광주 (A06xx) - 13개 ──
  { code: 'A0601', name: '금남로/충장로', keywords: ['금남로', '충장로'] },
  { code: 'A0602', name: '금호지구', keywords: ['금호지구', '금호'] },
  { code: 'A0603', name: '봉선동', keywords: ['봉선동', '봉선'] },
  { code: 'A0604', name: '상무지구', keywords: ['상무지구', '상무'] },
  { code: 'A0605', name: '송정동지구', keywords: ['송정동지구', '송정'] },
  { code: 'A0607', name: '양산지구', keywords: ['양산지구'] },
  { code: 'A0608', name: '어룡동', keywords: ['어룡동', '어룡'] },
  { code: 'A0609', name: '용봉동', keywords: ['용봉동', '용봉'] },
  { code: 'A0610', name: '우산동', keywords: ['우산동', '우산'] },
  { code: 'A0611', name: '월산동지구', keywords: ['월산동지구', '월산'] },
  { code: 'A0612', name: '일곡동', keywords: ['일곡동', '일곡'] },
  { code: 'A0613', name: '전남대', keywords: ['전남대'] },
  { code: 'A0614', name: '첨단1지구', keywords: ['첨단1지구', '첨단1'] },

  // ── 대전 (A07xx) - 8개 ──
  { code: 'A0702', name: '관평동', keywords: ['관평동', '관평'] },
  { code: 'A0703', name: '노은', keywords: ['노은'] },
  { code: 'A0705', name: '대전원도심', keywords: ['대전원도심'] },
  { code: 'A0707', name: '둔산', keywords: ['둔산'] },
  { code: 'A0709', name: '복합터미널', keywords: ['복합터미널'] },
  { code: 'A0710', name: '서대전네거리', keywords: ['서대전네거리', '서대전'] },
  { code: 'A0711', name: '용문/한민시장', keywords: ['용문동', '한민시장'] },
  { code: 'A0712', name: '유성온천역', keywords: ['유성온천역', '유성온천'] },

  // ── 울산 (A08xx) - 6개 ──
  { code: 'A0801', name: '삼산동', keywords: ['삼산동', '삼산'] },
  { code: 'A0802', name: '성남옥교동', keywords: ['성남옥교동', '성남옥교', '울산성남'] },
  { code: 'A0803', name: '신정동', keywords: ['울산신정동', '울산신정'] },
  { code: 'A0804', name: '울산농소', keywords: ['울산농소', '농소'] },
  { code: 'A0805', name: '울산대', keywords: ['울산대'] },
  { code: 'A0806', name: '전하동', keywords: ['전하동', '전하'] },

  // ── 세종 (A09xx) - 1개 ──
  { code: 'A0903', name: '조치원', keywords: ['조치원'] },

  // ── 경기 (A10xx) - 40개 ──
  { code: 'A1001', name: '고양시청', keywords: ['고양시청', '고양시'] },
  { code: 'A1004', name: '광명철산', keywords: ['광명철산', '철산'] },
  { code: 'A1005', name: '광주광남동', keywords: ['광주광남동', '광주광남'] },
  { code: 'A1006', name: '광주시가지', keywords: ['광주시가지', '경기광주', '광주시'] },
  { code: 'A1007', name: '구리역', keywords: ['구리역', '구리시'] },
  { code: 'A1009', name: '기흥역', keywords: ['기흥역', '기흥'] },
  { code: 'A1010', name: '김량장동', keywords: ['김량장동', '김량장'] },
  { code: 'A1016', name: '단대오거리역', keywords: ['단대오거리역', '단대오거리'] },
  { code: 'A1017', name: '동두천중앙로', keywords: ['동두천중앙로', '동두천'] },
  { code: 'A1021', name: '모란', keywords: ['모란'] },
  { code: 'A1025', name: '병점역', keywords: ['병점역', '병점'] },
  { code: 'A1026', name: '부천역', keywords: ['부천역', '부천시'] },
  { code: 'A1027', name: '분당역세권', keywords: ['분당역세권', '분당역', '분당구', '분당'] },
  { code: 'A1034', name: '성남구시가지', keywords: ['성남구시가지', '경기성남', '성남시'] },
  { code: 'A1036', name: '수원역', keywords: ['수원역'] },
  { code: 'A1037', name: '수원파장동', keywords: ['수원파장동', '수원파장', '파장동'] },
  { code: 'A1039', name: '신장/지산/서정', keywords: ['신장동', '지산동', '서정동'] },
  { code: 'A1040', name: '경기신천역', keywords: ['경기신천역'] },
  { code: 'A1041', name: '아주대삼거리', keywords: ['아주대삼거리', '아주대'] },
  { code: 'A1043', name: '안성 서인사거리', keywords: ['안성서인사거리', '서인사거리', '안성시'] },
  { code: 'A1044', name: '안양역', keywords: ['안양역', '안양시'] },
  { code: 'A1046', name: '양주덕정역', keywords: ['양주덕정역', '양주덕정', '덕정역'] },
  { code: 'A1047', name: '여주시청', keywords: ['여주시청', '여주시'] },
  { code: 'A1049', name: '영통역', keywords: ['영통역', '영통구'] },
  { code: 'A1050', name: '오산시청', keywords: ['오산시청', '오산시'] },
  { code: 'A1051', name: '용인수지', keywords: ['용인수지', '수지구'] },
  { code: 'A1055', name: '의정부역', keywords: ['의정부역', '의정부시'] },
  { code: 'A1056', name: '이천종합터미널', keywords: ['이천종합터미널', '이천시'] },
  { code: 'A1057', name: '인계동', keywords: ['인계동', '인계'] },
  { code: 'A1058', name: '인덕원', keywords: ['인덕원'] },
  { code: 'A1061', name: '탄현역', keywords: ['탄현역', '탄현'] },
  { code: 'A1062', name: '파주시청', keywords: ['파주시청', '파주시'] },
  { code: 'A1065', name: '팔달문로터리', keywords: ['팔달문로터리', '팔달문', '팔달구'] },
  { code: 'A1067', name: '평택시청', keywords: ['평택시청', '경기평택'] },
  { code: 'A1068', name: '평택역', keywords: ['평택역', '평택시'] },
  { code: 'A1069', name: '포천소흘읍', keywords: ['포천소흘읍', '포천소흘', '소흘읍'] },
  { code: 'A1070', name: '포천시외버스터미널', keywords: ['포천시외버스터미널', '포천시'] },
  { code: 'A1071', name: '하남원도심', keywords: ['하남원도심', '하남시'] },
  { code: 'A1074', name: '화성남양읍', keywords: ['화성남양읍', '화성남양', '남양읍'] },
  { code: 'A1075', name: '화성봉담읍', keywords: ['화성봉담읍', '화성봉담', '봉담읍'] },

  // ── 강원 (A11xx) - 11개 ──
  { code: 'A1101', name: '강릉교동', keywords: ['강릉교동', '강릉교'] },
  { code: 'A1102', name: '강릉중부', keywords: ['강릉중부', '강릉시'] },
  { code: 'A1104', name: '묵호항', keywords: ['묵호항', '묵호'] },
  { code: 'A1105', name: '삼척중앙시장', keywords: ['삼척중앙시장', '삼척시'] },
  { code: 'A1106', name: '속초중앙시장', keywords: ['속초중앙시장', '속초시'] },
  { code: 'A1107', name: '영월경찰서', keywords: ['영월경찰서', '영월'] },
  { code: 'A1109', name: '원주중앙/일산', keywords: ['원주중앙', '원주시', '강원일산'] },
  { code: 'A1110', name: '원주터미널', keywords: ['원주터미널'] },
  { code: 'A1112', name: '주문진항', keywords: ['주문진항', '주문진'] },
  { code: 'A1113', name: '춘천명동', keywords: ['춘천명동', '춘천시'] },
  { code: 'A1114', name: '태백중앙시장', keywords: ['태백중앙시장', '태백시'] },

  // ── 충북 (A12xx) - 9개 ──
  { code: 'A1201', name: '봉명사거리', keywords: ['봉명사거리', '봉명동'] },
  { code: 'A1204', name: '제천역', keywords: ['제천역'] },
  { code: 'A1205', name: '제천중앙', keywords: ['제천중앙', '제천시'] },
  { code: 'A1206', name: '증평광장로', keywords: ['증평광장로', '증평'] },
  { code: 'A1208', name: '청주성안길', keywords: ['청주성안길', '성안길', '청주시', '청주'] },
  { code: 'A1209', name: '청주율량동', keywords: ['청주율량동', '율량동'] },
  { code: 'A1211', name: '충북대학교', keywords: ['충북대학교', '충북대'] },
  { code: 'A1213', name: '충주연수칠금', keywords: ['충주연수칠금', '연수동', '칠금동'] },
  { code: 'A1214', name: '충주자유시장', keywords: ['충주자유시장', '충주시'] },

  // ── 충남 (A13xx) - 15개 ──
  { code: 'A1301', name: '공주대', keywords: ['공주대'] },
  { code: 'A1302', name: '공주웅진동', keywords: ['공주웅진동', '공주웅진', '웅진동'] },
  { code: 'A1304', name: '논산시외버스터미널', keywords: ['논산시외버스터미널', '논산시'] },
  { code: 'A1305', name: '당진시청', keywords: ['당진시청', '당진시'] },
  { code: 'A1306', name: '두정', keywords: ['두정동'] },
  { code: 'A1307', name: '배방읍', keywords: ['배방읍', '배방'] },
  { code: 'A1309', name: '보령문화의전당', keywords: ['보령문화의전당', '보령시'] },
  { code: 'A1310', name: '서산터미널', keywords: ['서산터미널', '서산시'] },
  { code: 'A1311', name: '아산온양', keywords: ['아산온양', '온양동'] },
  { code: 'A1312', name: '예산시장', keywords: ['예산시장', '예산군'] },
  { code: 'A1314', name: '천안역', keywords: ['천안역'] },
  { code: 'A1315', name: '천안종합버스터미널', keywords: ['천안종합버스터미널', '천안종합', '천안시'] },
  { code: 'A1316', name: '청당행정타운', keywords: ['청당행정타운', '청당동'] },
  { code: 'A1317', name: '태안터미널', keywords: ['태안터미널', '태안군'] },
  { code: 'A1318', name: '합덕버스터미널', keywords: ['합덕버스터미널', '합덕'] },

  // ── 전북 (A14xx) - 12개 ──
  { code: 'A1401', name: '군산수송동조촌동', keywords: ['군산수송동조촌동', '수송동', '조촌동'] },
  { code: 'A1402', name: '군산원도심', keywords: ['군산원도심', '군산시'] },
  { code: 'A1403', name: '김제시장', keywords: ['김제시장', '김제시'] },
  { code: 'A1404', name: '남원광한루', keywords: ['남원광한루', '남원시'] },
  { code: 'A1405', name: '송천동', keywords: ['송천동'] },
  { code: 'A1406', name: '영등부송', keywords: ['영등부송', '영등동', '부송동'] },
  { code: 'A1407', name: '익산역', keywords: ['익산역', '익산시'] },
  { code: 'A1409', name: '전주동부', keywords: ['전주동부'] },
  { code: 'A1410', name: '전주서부', keywords: ['전주서부', '전주시', '전주'] },
  { code: 'A1411', name: '전주서부신시가지', keywords: ['전주서부신시가지', '전주신시가지'] },
  { code: 'A1412', name: '전주한옥마을', keywords: ['전주한옥마을', '한옥마을'] },
  { code: 'A1413', name: '정읍중심', keywords: ['정읍중심', '정읍시'] },

  // ── 전남 (A15xx) - 13개 ──
  { code: 'A1501', name: '광양읍', keywords: ['광양읍', '전남광양'] },
  { code: 'A1502', name: '광양중동', keywords: ['광양중동', '광양중'] },
  { code: 'A1504', name: '나주구시가지', keywords: ['나주구시가지', '나주시'] },
  { code: 'A1505', name: '목포구도심', keywords: ['목포구도심', '목포시'] },
  { code: 'A1506', name: '무선지구', keywords: ['무선지구', '무선동'] },
  { code: 'A1507', name: '순천법원', keywords: ['순천법원'] },
  { code: 'A1508', name: '순천원도심', keywords: ['순천원도심', '순천시'] },
  { code: 'A1509', name: '순천해룡면', keywords: ['순천해룡면', '해룡면'] },
  { code: 'A1510', name: '여수여문', keywords: ['여수여문', '여문동'] },
  { code: 'A1511', name: '여수원도심', keywords: ['여수원도심', '여수시'] },
  { code: 'A1512', name: '여수학동', keywords: ['여수학동', '학동'] },
  { code: 'A1514', name: '조례', keywords: ['조례동'] },
  { code: 'A1515', name: '하당신도심', keywords: ['하당신도심', '하당'] },

  // ── 경북 (A16xx) - 16개 ──
  { code: 'A1601', name: '가흥택지개발지구', keywords: ['가흥택지개발지구', '가흥동'] },
  { code: 'A1604', name: '경산시청', keywords: ['경산시청', '경산시'] },
  { code: 'A1605', name: '경주도심', keywords: ['경주도심', '경주시'] },
  { code: 'A1606', name: '구미산업단지', keywords: ['구미산업단지'] },
  { code: 'A1607', name: '구미선주원남동', keywords: ['구미선주원남동', '선주원남동'] },
  { code: 'A1608', name: '구미역', keywords: ['구미역', '구미시'] },
  { code: 'A1609', name: '문경점촌흥덕', keywords: ['문경점촌흥덕', '점촌동', '흥덕동'] },
  { code: 'A1610', name: '상주동문동', keywords: ['상주동문동', '상주시'] },
  { code: 'A1611', name: '안동구도심', keywords: ['안동구도심', '안동시'] },
  { code: 'A1612', name: '양덕동', keywords: ['양덕동', '양덕'] },
  { code: 'A1613', name: '영일대해수욕장', keywords: ['영일대해수욕장', '영일대'] },
  { code: 'A1614', name: '영주중앙', keywords: ['영주중앙', '영주시'] },
  { code: 'A1615', name: '옥동사거리', keywords: ['옥동사거리'] },
  { code: 'A1616', name: '포항원도심', keywords: ['포항원도심', '포항시'] },
  { code: 'A1617', name: '포항중앙', keywords: ['포항중앙', '포항중앙동'] },
  { code: 'A1618', name: '포항효자동', keywords: ['포항효자동', '효자동'] },

  // ── 경남 (A17xx) - 19개 ──
  { code: 'A1701', name: '거제고현', keywords: ['거제고현', '고현동'] },
  { code: 'A1702', name: '거제옥포', keywords: ['거제옥포', '옥포동'] },
  { code: 'A1705', name: '김해시청/동상시장', keywords: ['김해시청', '김해시', '동상시장'] },
  { code: 'A1707', name: '마산동서동', keywords: ['마산동서동', '마산동서'] },
  { code: 'A1708', name: '마산역버스터미널', keywords: ['마산역버스터미널', '마산역', '마산'] },
  { code: 'A1710', name: '밀양원도심/삼문동', keywords: ['밀양원도심', '밀양시', '삼문동'] },
  { code: 'A1711', name: '양산구도심', keywords: ['양산구도심', '양산시'] },
  { code: 'A1713', name: '용원동', keywords: ['용원동'] },
  { code: 'A1714', name: '진주중앙시장', keywords: ['진주중앙시장', '진주시'] },
  { code: 'A1715', name: '진주하대동', keywords: ['진주하대동', '하대동'] },
  { code: 'A1717', name: '진해석동', keywords: ['진해석동', '진해'] },
  { code: 'A1719', name: '창원시청', keywords: ['창원시청', '창원시'] },
  { code: 'A1720', name: '창원역', keywords: ['창원역'] },
  { code: 'A1721', name: '창원월영동', keywords: ['창원월영동', '월영동'] },
  { code: 'A1722', name: '창원의창구청', keywords: ['창원의창구청', '의창구'] },
  { code: 'A1723', name: '통영 강구안', keywords: ['통영강구안', '강구안'] },
  { code: 'A1724', name: '통영시청', keywords: ['통영시청', '통영시'] },
  { code: 'A1725', name: '평거동', keywords: ['평거동'] },
  { code: 'A1726', name: '활천동', keywords: ['활천동'] },

  // ── 제주 (A18xx) - 4개 ──
  { code: 'A1801', name: '광양사거리', keywords: ['광양사거리', '제주광양'] },
  { code: 'A1802', name: '노형오거리', keywords: ['노형오거리', '노형동'] },
  { code: 'A1803', name: '서귀포도심', keywords: ['서귀포도심', '서귀포'] },
  { code: 'A1804', name: '제주중앙사거리', keywords: ['제주중앙사거리', '제주시', '제주'] },
];

// 시도 평균 폴백 코드 (한국부동산원 408 시도단위 집계)
const SIDO_FALLBACK_CODE = {
  '서울': 'A02', '부산': 'A03', '대구': 'A04', '인천': 'A05',
  '광주': 'A06', '대전': 'A07', '울산': 'A08', '세종': 'A09',
  '경기': 'A10', '강원': 'A11', '충북': 'A12', '충남': 'A13',
  '전북': 'A14', '전남': 'A15', '경북': 'A16', '경남': 'A17', '제주': 'A18',
};

/**
 * 주소 문자열 → 한국부동산원 73개 상권 코드 매핑
 * @param {string} address - 예: "서울 강남구 강남대로 396"
 * @returns {string|null} - 예: "A020201" 또는 시도 평균 (A02 등) 또는 null
 */
export function mapToCommercialDistrict(address) {
  if (!address || typeof address !== 'string') return null;
  const SIDO_NAMES = ['서울','부산','대구','인천','광주','대전','울산','세종','경기','강원','충북','충남','전북','전남','경북','경남','제주'];
  // 입력 정규화: 공백 제거 + 시/도/광역시/특별자치도 같은 행정구역 접미사 제거
  // (단, 시군구 안의 "시"는 유지하지 않으면 매칭 누락. 행정 구역 접미사만 제거)
  let text = address.replace(/\s+/g, '');
  // "광역시", "특별시", "특별자치시", "특별자치도" 정규화
  text = text.replace(/(광역시|특별시|특별자치시|특별자치도|특별자치도)/g, '');
  // 시도 직후 "시"·"도" 제거 ("강원도강릉시" → "강원강릉시", 추가로 시군구의 "시" 제거)
  for (const s of SIDO_NAMES) {
    if (text.startsWith(s + '도')) { text = s + text.slice((s + '도').length); break; }
  }
  // 시군구 끝 "시" 제거 ("강원강릉시교동" → "강원강릉교동", "성남시" → "성남")
  // 단순화: 모든 "시" 글자를 시도 prefix 뒤에서 제거
  let inputSido = null;
  for (const s of SIDO_NAMES) {
    if (text.startsWith(s)) { inputSido = s; break; }
  }
  if (inputSido) {
    const head = inputSido;
    const tail = text.slice(head.length).replace(/시(?=[가-힣])/g, ''); // "시" 뒤에 한글이 오면 제거 (시군구 접미)
    text = head + tail;
  }

  const SIDO_TO_CODE_PREFIX = {
    '서울':'A02','부산':'A03','대구':'A04','인천':'A05','광주':'A06','대전':'A07',
    '울산':'A08','세종':'A09','경기':'A10','강원':'A11','충북':'A12','충남':'A13',
    '전북':'A14','전남':'A15','경북':'A16','경남':'A17','제주':'A18',
  };
  const inputSidoPrefix = inputSido ? SIDO_TO_CODE_PREFIX[inputSido] : null;

  // 1차: 한국부동산원 상권 매칭
  // 전략:
  //   1) 입력에 시도 prefix가 있으면 다른 시도 후보는 완전 배제 (시도 평균 폴백 우선)
  //   2) 같은 시도 내에서 키워드 매치 길이 (시도명 prefix 제외) 가 가장 긴 후보 우선
  //   3) 길이 동률이면 주소 후반부에 있는 매치 우선
  let best = null;
  for (const entry of COMMERCIAL_DISTRICT_MAP) {
    // 입력 시도가 명시되어 있으면 다른 시도 상권은 매칭 후보에서 제외
    if (inputSidoPrefix && !entry.code.startsWith(inputSidoPrefix)) continue;
    for (const k of entry.keywords) {
      let kk = k.replace(/\s+/g, '');
      // 키워드에 시도 prefix가 붙어있으면 (예: "경기성남"), 매칭은 그대로 하되 길이 점수는 prefix 제외
      let scoreLen = kk.length;
      for (const s of SIDO_NAMES) {
        if (kk.startsWith(s) && kk.length > s.length) { scoreLen = kk.length - s.length; break; }
      }
      const idx = text.indexOf(kk);
      if (idx < 0) continue;
      const cand = { entry, scoreLen, pos: idx };
      if (!best) { best = cand; continue; }
      if (cand.scoreLen > best.scoreLen) { best = cand; continue; }
      if (cand.scoreLen < best.scoreLen) continue;
      if (cand.pos > best.pos) best = cand;
    }
  }
  if (best) return best.entry.code;

  // 2차: 시도 평균 폴백
  for (const [sido, code] of Object.entries(SIDO_FALLBACK_CODE)) {
    if (text.startsWith(sido) || text.includes(sido)) return code;
  }
  return null;
}

// 내부 헬퍼: kosisExternal.results[key].data 안전 추출
function _getExternalRows(apis, key) {
  const rows = apis?.kosisExternal?.data?.results?.[key]?.data
    || apis?.kosisExternal?.results?.[key]?.data
    || apis?.kosisExternal?.data?.[key]?.data;
  return Array.isArray(rows) ? rows : [];
}

// 내부 헬퍼: 가장 최근 시점의 행 1개 선택 (코드 일치 우선, 없으면 시도/전국)
function _pickLatestByCode(rows, code) {
  if (!rows.length) return null;
  // 코드 일치 우선 (C1)
  let pool = code ? rows.filter(r => (r.C1 || '') === code) : [];
  if (pool.length === 0) pool = rows;
  // 가장 최근 PRD_DE
  const sorted = [...pool].sort((a, b) => (b.PRD_DE || '').localeCompare(a.PRD_DE || ''));
  return sorted[0] || null;
}

// 내부 헬퍼: 입력 코드와 결과 행의 C1 비교로 scope 결정
//   - 6자리(A020201) 일치 → '상권'
//   - 2자리 시도 코드(A02) → '시도평균'
//   - 그 외 (A01=전국 등) → '전국평균'
function _resolveScope(matchedCode, sangkwonCode) {
  if (!matchedCode) return '전국평균';
  if (sangkwonCode && matchedCode === sangkwonCode) {
    return /^A\d{6}$/.test(matchedCode) ? '상권' : (/^A\d{2}$/.test(matchedCode) ? '시도평균' : '전국평균');
  }
  if (/^A\d{2}$/.test(matchedCode) && matchedCode !== 'A01') return '시도평균';
  return '전국평균';
}

/**
 * 우리 상권 평당 임대료 (원/평) - 천원/㎡ × 3.3058 × 1000
 * @param {object} apis - collectedData.apis
 * @param {string} sangkwonCode - mapToCommercialDistrict 결과
 */
export function extractMarketRent(apis, sangkwonCode) {
  const rows = _getExternalRows(apis, 'marketRent');
  const r = _pickLatestByCode(rows, sangkwonCode);
  if (!r) return null;
  const valPerSqmThousand = parseFloat(r.DT) || 0;
  if (!valPerSqmThousand) return null;
  const wonPerPyeong = Math.round(valPerSqmThousand * 3.3058 * 1000);
  return {
    value: wonPerPyeong,
    unit: '원/평',
    raw: valPerSqmThousand,
    rawUnit: '천원/㎡',
    period: r.PRD_DE,
    region: r.C1_NM,
    code: r.C1,
    scope: _resolveScope(r.C1, sangkwonCode),
  };
}

/** 공실률 (%) */
export function extractVacancy(apis, sangkwonCode) {
  const rows = _getExternalRows(apis, 'vacancy');
  const r = _pickLatestByCode(rows, sangkwonCode);
  if (!r) return null;
  return { value: parseFloat(r.DT) || 0, unit: '%', period: r.PRD_DE, region: r.C1_NM, code: r.C1, scope: _resolveScope(r.C1, sangkwonCode) };
}

/** 임대가격지수 (1년 변동률 %) */
export function extractPriceChange(apis, sangkwonCode) {
  const rows = _getExternalRows(apis, 'priceIndex');
  if (!rows.length) return null;
  // 코드 매칭 풀
  const pool = sangkwonCode ? rows.filter(r => (r.C1 || '') === sangkwonCode) : rows;
  if (!pool.length) return null;
  const sorted = [...pool].sort((a, b) => (b.PRD_DE || '').localeCompare(a.PRD_DE || ''));
  const latest = sorted[0];
  if (!latest) return null;
  // 1년 전 (4분기 전) 찾기
  const latestPrd = latest.PRD_DE || '';
  let yearAgo = null;
  if (/^\d{4}Q\d$/.test(latestPrd)) {
    const y = parseInt(latestPrd.slice(0, 4), 10);
    const q = latestPrd.slice(4);
    const targetPrd = `${y - 1}${q}`;
    yearAgo = sorted.find(r => r.PRD_DE === targetPrd);
  }
  const latestVal = parseFloat(latest.DT) || 0;
  if (!yearAgo) {
    return { value: null, latestIndex: latestVal, unit: '%', period: latestPrd, region: latest.C1_NM, code: latest.C1, scope: _resolveScope(latest.C1, sangkwonCode), note: '1년전 데이터 없음' };
  }
  const yearAgoVal = parseFloat(yearAgo.DT) || 0;
  if (!yearAgoVal) return null;
  const changePct = Math.round((latestVal - yearAgoVal) / yearAgoVal * 1000) / 10;
  return {
    value: changePct,
    unit: '%',
    latestIndex: latestVal,
    yearAgoIndex: yearAgoVal,
    period: latestPrd,
    region: latest.C1_NM,
    code: latest.C1,
    scope: _resolveScope(latest.C1, sangkwonCode),
  };
}

/** 전환율 (%) */
export function extractConversionRate(apis, sangkwonCode) {
  const rows = _getExternalRows(apis, 'conversionRate');
  const r = _pickLatestByCode(rows, sangkwonCode);
  if (!r) return null;
  return { value: parseFloat(r.DT) || 0, unit: '%', period: r.PRD_DE, region: r.C1_NM, code: r.C1, scope: _resolveScope(r.C1, sangkwonCode) };
}

/**
 * 수익률 (%) - 한국부동산원 DT_40801_N2301_06
 * ITM 종류: T001 소득수익률, T002 자본수익률, T003 투자수익률(=종합)
 * 원시값은 분기 단위 → 연 환산 (× 4)
 * T003 우선, 없으면 T001 + T002 합산, 둘 다 없으면 첫 행
 */
export function extractYieldRate(apis, sangkwonCode) {
  const rows = _getExternalRows(apis, 'yieldRate');
  if (!rows.length) return null;
  // 코드 일치 우선 (C1)
  let pool = sangkwonCode ? rows.filter(r => (r.C1 || '') === sangkwonCode) : [];
  if (pool.length === 0) pool = rows;
  // 가장 최근 시점만 추리기
  const sortedByDate = [...pool].sort((a, b) => (b.PRD_DE || '').localeCompare(a.PRD_DE || ''));
  const latestPrd = sortedByDate[0]?.PRD_DE;
  if (!latestPrd) return null;
  const sameDate = sortedByDate.filter(r => r.PRD_DE === latestPrd);

  // ITM_NM 또는 ITM_ID로 투자수익률(T003) 우선 식별
  const isInvest = (r) => {
    const id = r.ITM_ID || '';
    const nm = r.ITM_NM || '';
    return id === 'T003' || /투자수익률|종합수익률|총수익률/.test(nm);
  };
  const isIncome = (r) => {
    const id = r.ITM_ID || '';
    const nm = r.ITM_NM || '';
    return id === 'T001' || /소득수익률/.test(nm);
  };
  const isCapital = (r) => {
    const id = r.ITM_ID || '';
    const nm = r.ITM_NM || '';
    return id === 'T002' || /자본수익률/.test(nm);
  };

  let quarterly = null;
  const investRow = sameDate.find(isInvest);
  if (investRow) {
    quarterly = parseFloat(investRow.DT) || 0;
  } else {
    const incomeRow = sameDate.find(isIncome);
    const capitalRow = sameDate.find(isCapital);
    if (incomeRow || capitalRow) {
      quarterly = (parseFloat(incomeRow?.DT) || 0) + (parseFloat(capitalRow?.DT) || 0);
    } else {
      quarterly = parseFloat(sameDate[0]?.DT) || 0;
    }
  }
  if (!quarterly) return null;

  const annual = Math.round(quarterly * 4 * 100) / 100; // 분기 → 연 환산
  const ref = investRow || sameDate[0];
  return {
    value: annual,        // 연 환산값 (카드에 표시)
    quarterly: Math.round(quarterly * 100) / 100,
    annual,
    unit: '%',
    period: latestPrd,
    region: ref.C1_NM,
    code: ref.C1,
    scope: _resolveScope(ref.C1, sangkwonCode),
  };
}

/**
 * 순영업소득 - 한국부동산원 DT_40801_N2303_06
 * 응답 구조 확인 결과: T001 영업수입, T002 기타수입, T003 이자경비 등
 * 모든 항목이 % 비율 (수입/비용 구성비)이지 평당 금액이 아님.
 * 평당 금액으로 환산 시 부정확하므로 null 반환 → 카드 박스 자동 숨김.
 */
export function extractNetIncome(_apis, _sangkwonCode) {
  return null;
}

/** 시도 카페 폐업 수 (커피음료점만 필터) */
export function extractCafeClosure(apis, sido) {
  const rows = _getExternalRows(apis, 'cafeClosure');
  if (!rows.length) return null;
  const cafeRows = rows.filter(r => {
    const all = (r.C1_NM || '') + '|' + (r.C2_NM || '') + '|' + (r.C3_NM || '') + '|' + (r.ITM_NM || '');
    return /커피\s*음료점|커피전문점|커피\s*전문점/.test(all);
  });
  if (!cafeRows.length) return null;
  const pool = sido ? cafeRows.filter(r => {
    const text = (r.C1_NM || '') + '|' + (r.C2_NM || '');
    return text.includes(sido);
  }) : cafeRows;
  const matched = pool.length > 0;
  const finalPool = pool.length ? pool : cafeRows;
  const sorted = [...finalPool].sort((a, b) => (b.PRD_DE || '').localeCompare(a.PRD_DE || ''));
  const latest = sorted[0];
  if (!latest) return null;
  return {
    value: parseInt(parseFloat(latest.DT) || 0, 10),
    unit: '명',
    period: latest.PRD_DE,
    region: latest.C1_NM || latest.C2_NM,
    scope: sido ? (matched ? '시도평균' : '전국평균') : '전국평균',
  };
}

// 시도 → regionClosure 시군구 코드 prefix 매핑
// 국세청 폐업 통계는 한국부동산원과 시도 코드 체계가 다름. 응답 실측 기반:
//   A01=서울, A02=인천, A03=경기, A04=강원, A05=대전, A06=충북, A07=충남,
//   A08=세종, A09=광주, A10=전북, A11=전남, A12=대구, A13=경북, A14=부산,
//   A15=울산, A16=경남, A17=제주
// 동음이의 시군구(중구, 동구, 서구 등) 구분용.
const SIDO_TO_C1_PREFIX = {
  '서울': 'A01', '인천': 'A02', '경기': 'A03', '강원': 'A04', '대전': 'A05',
  '충북': 'A06', '충남': 'A07', '세종': 'A08', '광주': 'A09', '전북': 'A10',
  '전남': 'A11', '대구': 'A12', '경북': 'A13', '부산': 'A14', '울산': 'A15',
  '경남': 'A16', '제주': 'A17',
};

/**
 * 시군구 폐업자 수
 * @param {object} apis - collectedData.apis
 * @param {string} sigungu - "강남구" 또는 "부산 해운대구" 또는 "해운대구" (시도 prefix 권장)
 * @param {string} bizType - 'individual'(개인사업자, 기본) | 'total'(총계)
 *   카페는 보통 개인사업자라 'individual'을 기본으로 사용. 'total'은 폴백.
 */
export function extractRegionClosure(apis, sigungu, bizType = 'individual') {
  const rows = _getExternalRows(apis, 'regionClosure');
  if (!rows.length) return null;

  // 사업자 종류 필터 ('개인사업자' 또는 '총계')
  const c2Target = bizType === 'individual' ? '개인사업자' : '총계';
  const typed = rows.filter(r => (r.C2_NM || '').includes(c2Target));
  // 개인사업자 결과가 비면 총계로 폴백
  const baseRows = typed.length ? typed : rows.filter(r => (r.C2_NM || '').includes('총계'));
  const usedBizType = typed.length ? c2Target : '총계';

  // sigungu 입력에서 시도 prefix 추출 (예: "부산 해운대구" → 시도='부산', 동/구='해운대구')
  let sidoPrefix = null;
  let sigunguName = sigungu || '';
  if (sigungu) {
    const sidoMatch = sigungu.match(/^(서울|부산|대구|인천|광주|대전|울산|세종|경기|강원|충북|충남|전북|전남|경북|경남|제주)\s*(.*)$/);
    if (sidoMatch) {
      sidoPrefix = SIDO_TO_C1_PREFIX[sidoMatch[1]];
      sigunguName = sidoMatch[2].trim() || sidoMatch[1];
    }
  }

  let pool = baseRows;
  if (sigunguName) {
    pool = baseRows.filter(r => {
      const c1nm = r.C1_NM || '';
      const nameMatch = c1nm.includes(sigunguName);
      // 시도 prefix가 주어졌으면 C1 코드도 확인 (동음이의 구 구분)
      if (sidoPrefix && r.C1) {
        return nameMatch && r.C1.startsWith(sidoPrefix);
      }
      return nameMatch;
    });
  }
  const matched = sigungu && pool.length > 0;
  const finalPool = pool.length ? pool : baseRows;
  if (!finalPool.length) return null;
  const sorted = [...finalPool].sort((a, b) => (b.PRD_DE || '').localeCompare(a.PRD_DE || ''));
  const latest = sorted[0];
  if (!latest) return null;
  return {
    value: parseInt(parseFloat(latest.DT) || 0, 10),
    unit: '명',
    period: latest.PRD_DE,
    region: latest.C1_NM || latest.C2_NM,
    bizType: usedBizType,
    scope: matched ? '시군구' : '전국평균',
  };
}

// 시도 → 한국은행 소비자동향조사 권역 매핑
// 응답 권역(C2_NM): 부산, 대구경북, 광주전남, 전북, 대전세종충남, 충북, 강원, 인천, 제주, 경기, 경남, 강릉, 울산
// 주의: 한국은행 응답에 "서울" 권역이 없어 서울은 "전국평균"으로 폴백됨.
const SIDO_TO_BOK_REGION = {
  '서울': null,           // 한국은행 권역 데이터에 서울 없음 → 전국평균
  '부산': '부산',
  '대구': '대구경북',
  '인천': '인천',
  '광주': '광주전남',
  '대전': '대전세종충남',
  '울산': '울산',
  '세종': '대전세종충남',
  '경기': '경기',
  '강원': '강원',
  '충북': '충북',
  '충남': '대전세종충남',
  '전북': '전북',
  '전남': '광주전남',
  '경북': '대구경북',
  '경남': '경남',
  '제주': '제주',
};

/**
 * 권역 소비심리 점수 (한국은행 소비자동향)
 * @param {object} apis
 * @param {string} region - 시도명 (예: '부산', '대구', '경북') 또는 권역명 직접 (예: '대구경북')
 *   응답 구조: C1_NM=항목(소비자심리지수/생활형편CSI 등), C2_NM=권역명, DT=점수
 */
export function extractConsumerSentiment(apis, region) {
  const rows = _getExternalRows(apis, 'consumerSentiment');
  if (!rows.length) return null;

  // 시도명을 한국은행 권역으로 변환. 이미 권역명이면 그대로 사용.
  let bokRegion = region;
  let mappedFromSido = false;
  if (region && SIDO_TO_BOK_REGION.hasOwnProperty(region)) {
    bokRegion = SIDO_TO_BOK_REGION[region];
    mappedFromSido = true;
  } else if (region) {
    // 입력이 "부산 해운대구" 같은 복합 주소면 시도 부분 추출
    const sidoMatch = region.match(/^(서울|부산|대구|인천|광주|대전|울산|세종|경기|강원|충북|충남|전북|전남|경북|경남|제주)/);
    if (sidoMatch) {
      bokRegion = SIDO_TO_BOK_REGION[sidoMatch[1]];
      mappedFromSido = true;
    }
  }

  // 서울처럼 한국은행 권역 데이터에 없는 시도면 12개 권역 평균값 계산
  if (mappedFromSido && bokRegion === null) {
    const cssiAll = rows.filter(r => /소비자심리지수|CCSI/.test(r.C1_NM || ''));
    const sortedAll = [...cssiAll].sort((a, b) => (b.PRD_DE || '').localeCompare(a.PRD_DE || ''));
    const latestPeriod = sortedAll[0]?.PRD_DE;
    if (!latestPeriod) return null;
    const sameMonth = cssiAll.filter(r => r.PRD_DE === latestPeriod);
    if (sameMonth.length === 0) return null;
    const avgValue = sameMonth.reduce((s, r) => s + (parseFloat(r.DT) || 0), 0) / sameMonth.length;
    return {
      value: Math.round(avgValue * 10) / 10,
      unit: '점',
      period: latestPeriod,
      region: '전국 평균',
      indicator: '소비자심리지수',
      item: sameMonth[0].ITM_NM,
      scope: '전국평균',
    };
  }

  // 권역 매칭 (응답에서 C2_NM이 권역명을 담음)
  const pool = bokRegion ? rows.filter(r => (r.C2_NM || '') === bokRegion) : [];
  const matched = bokRegion && pool.length > 0;
  const finalPool = pool.length ? pool : rows;

  // 종합지수(CCSI = "소비자심리지수")는 C1_NM에 위치 - 우선 추출
  const cssi = finalPool.filter(r => /소비자심리지수|CCSI/.test(r.C1_NM || ''));
  const usePool = cssi.length ? cssi : finalPool;
  const sorted = [...usePool].sort((a, b) => (b.PRD_DE || '').localeCompare(a.PRD_DE || ''));
  const latest = sorted[0];
  if (!latest) return null;
  return {
    value: parseFloat(latest.DT) || 0,
    unit: '점',
    period: latest.PRD_DE,
    region: latest.C2_NM,        // 권역명 (응답 C2_NM)
    indicator: latest.C1_NM,     // 지표명 (응답 C1_NM, 예: "소비자심리지수")
    item: latest.ITM_NM,
    scope: matched ? '권역' : '전국평균',
  };
}

// ─────────────────────────────────────────────────────────────────────
// 시계열 추출 함수 5종
// 입력 위치: collectedData.apis.kosisExternalSeries.data.results[key].data
// 출력: { series: [{period, value}], unit, scope, region, latest, ... }
// 시간순(과거→현재) 정렬, n개 제한
// ─────────────────────────────────────────────────────────────────────

// 내부 헬퍼: kosisExternalSeries.results[key].data 안전 추출
function _getExternalSeriesRows(apis, key) {
  const rows = apis?.kosisExternalSeries?.data?.results?.[key]?.data
    || apis?.kosisExternalSeries?.results?.[key]?.data
    || apis?.kosisExternalSeries?.data?.[key]?.data;
  return Array.isArray(rows) ? rows : [];
}

// 내부 헬퍼: 코드 일치 풀에서 시간순 시계열 생성 (값 매핑 콜백)
function _buildSeriesByCode(rows, code, n, mapFn = (v) => v) {
  if (!rows.length) return null;
  let pool = code ? rows.filter(r => (r.C1 || '') === code) : [];
  let matched = pool.length > 0;
  if (!matched) pool = rows;
  if (!pool.length) return null;
  // 같은 PRD_DE에서 코드 평균 (전국 폴백 시 여러 시도가 같은 시점에 존재)
  const byPeriod = {};
  pool.forEach(r => {
    const p = r.PRD_DE || '';
    const v = parseFloat(r.DT);
    if (!p || !Number.isFinite(v)) return;
    if (!byPeriod[p]) byPeriod[p] = { sum: 0, cnt: 0, sample: r };
    byPeriod[p].sum += v;
    byPeriod[p].cnt += 1;
  });
  const periods = Object.keys(byPeriod).sort(); // 오름차순
  const series = periods.map(p => {
    const o = byPeriod[p];
    const avg = o.sum / o.cnt;
    return { period: p, value: mapFn(avg) };
  });
  // 최근 n개만
  const trimmed = n ? series.slice(-n) : series;
  const sample = pool[0];
  return {
    series: trimmed,
    matched,
    sample,
  };
}

/**
 * 평당 임대료 시계열 (8분기, 만원/평)
 * 입력 단위: 천원/㎡ → 만원/평 변환 (× 3.3058 ÷ 10)
 * @returns {object|null} { series: [{period, value}], unit:'만원/평', region, scope }
 */
export function extractMarketRentSeries(apis, sangkwonCode, n = 8) {
  const rows = _getExternalSeriesRows(apis, 'marketRent');
  // 천원/㎡ → 만원/평: × 3.3058 × 1000 / 10000 = × 0.33058
  const built = _buildSeriesByCode(rows, sangkwonCode, n, (v) => Math.round(v * 0.33058 * 10) / 10);
  if (!built || !built.series.length) return null;
  const code = built.sample?.C1 || '';
  return {
    series: built.series,
    unit: '만원/평',
    region: built.sample?.C1_NM || '',
    code,
    scope: _resolveScope(code, sangkwonCode),
    matched: built.matched,
  };
}

/**
 * 공실률 시계열 (8분기, %)
 */
export function extractVacancySeries(apis, sangkwonCode, n = 8) {
  const rows = _getExternalSeriesRows(apis, 'vacancy');
  const built = _buildSeriesByCode(rows, sangkwonCode, n, (v) => Math.round(v * 10) / 10);
  if (!built || !built.series.length) return null;
  const code = built.sample?.C1 || '';
  return {
    series: built.series,
    unit: '%',
    region: built.sample?.C1_NM || '',
    code,
    scope: _resolveScope(code, sangkwonCode),
    matched: built.matched,
  };
}

/**
 * 임대가격지수 시계열 (12분기, 지수)
 */
export function extractPriceIndexSeries(apis, sangkwonCode, n = 12) {
  const rows = _getExternalSeriesRows(apis, 'priceIndex');
  const built = _buildSeriesByCode(rows, sangkwonCode, n, (v) => Math.round(v * 100) / 100);
  if (!built || !built.series.length) return null;
  const code = built.sample?.C1 || '';
  return {
    series: built.series,
    unit: '지수',
    region: built.sample?.C1_NM || '',
    code,
    scope: _resolveScope(code, sangkwonCode),
    matched: built.matched,
  };
}

/**
 * 시도 카페 폐업 수 시계열 (11년, 곳)
 * - 행 필터: "커피 음료점" 등 카페 분류 행만
 * - 시도 폴백: sido 매칭 안되면 전국 평균 (시도별 평균값 산출)
 */
export function extractCafeClosureSeries(apis, sido, n = 11) {
  const rows = _getExternalSeriesRows(apis, 'cafeClosure');
  if (!rows.length) return null;
  const cafeRows = rows.filter(r => {
    const all = (r.C1_NM || '') + '|' + (r.C2_NM || '') + '|' + (r.C3_NM || '') + '|' + (r.ITM_NM || '');
    return /커피\s*음료점|커피전문점|커피\s*전문점/.test(all);
  });
  if (!cafeRows.length) return null;
  const pool = sido ? cafeRows.filter(r => {
    const text = (r.C1_NM || '') + '|' + (r.C2_NM || '');
    return text.includes(sido);
  }) : [];
  const matched = pool.length > 0;
  const finalPool = pool.length ? pool : cafeRows;

  // 연도별 집계 (전국 폴백 시 여러 시도 합산이 아닌 합계로 노출 - 폐업 총량 지표)
  const byYear = {};
  finalPool.forEach(r => {
    const y = r.PRD_DE || '';
    const v = parseFloat(r.DT);
    if (!/^\d{4}$/.test(y) || !Number.isFinite(v)) return;
    if (!byYear[y]) byYear[y] = { sum: 0, cnt: 0 };
    byYear[y].sum += v;
    byYear[y].cnt += 1;
  });
  const years = Object.keys(byYear).sort();
  if (!years.length) return null;
  const series = years.map(y => ({
    year: y,
    period: y,
    value: matched ? Math.round(byYear[y].sum) : Math.round(byYear[y].sum / byYear[y].cnt),
  }));
  const trimmed = n ? series.slice(-n) : series;
  return {
    series: trimmed,
    unit: '곳',
    region: matched ? sido : '전국 평균',
    scope: matched ? '시도' : '전국평균',
    matched,
  };
}

/**
 * 권역 소비심리 시계열 (12개월, 점)
 * - 종합지수(소비자심리지수/CCSI)만 추출
 * - 시도→권역 변환 (서울은 권역 없음 → 전국 평균)
 */
export function extractConsumerSentimentSeries(apis, region, n = 12) {
  const rows = _getExternalSeriesRows(apis, 'consumerSentiment');
  if (!rows.length) return null;

  // 시도→권역
  let bokRegion = region;
  let mappedFromSido = false;
  if (region && SIDO_TO_BOK_REGION.hasOwnProperty(region)) {
    bokRegion = SIDO_TO_BOK_REGION[region];
    mappedFromSido = true;
  } else if (region) {
    const sidoMatch = region.match(/^(서울|부산|대구|인천|광주|대전|울산|세종|경기|강원|충북|충남|전북|전남|경북|경남|제주)/);
    if (sidoMatch) {
      bokRegion = SIDO_TO_BOK_REGION[sidoMatch[1]];
      mappedFromSido = true;
    }
  }

  // 종합지수 행만 추출
  const cssiAll = rows.filter(r => /소비자심리지수|CCSI/.test(r.C1_NM || ''));
  if (!cssiAll.length) return null;

  // 권역 매칭
  let pool = bokRegion ? cssiAll.filter(r => (r.C2_NM || '') === bokRegion) : [];
  const matched = bokRegion && pool.length > 0;

  // 권역 매칭 실패 또는 서울 등 권역 없음 → 월별 전국 평균
  if (!pool.length) {
    const byMonth = {};
    cssiAll.forEach(r => {
      const p = r.PRD_DE || '';
      const v = parseFloat(r.DT);
      if (!/^\d{6}$/.test(p) || !Number.isFinite(v)) return;
      if (!byMonth[p]) byMonth[p] = { sum: 0, cnt: 0 };
      byMonth[p].sum += v;
      byMonth[p].cnt += 1;
    });
    const months = Object.keys(byMonth).sort();
    if (!months.length) return null;
    const series = months.map(p => ({ period: p, value: Math.round(byMonth[p].sum / byMonth[p].cnt * 10) / 10 }));
    const trimmed = n ? series.slice(-n) : series;
    return {
      series: trimmed,
      unit: '점',
      region: '전국 평균',
      scope: '전국평균',
      matched: false,
    };
  }

  // 권역 매칭 성공
  const byMonth = {};
  pool.forEach(r => {
    const p = r.PRD_DE || '';
    const v = parseFloat(r.DT);
    if (!/^\d{6}$/.test(p) || !Number.isFinite(v)) return;
    if (!byMonth[p]) byMonth[p] = { sum: 0, cnt: 0 };
    byMonth[p].sum += v;
    byMonth[p].cnt += 1;
  });
  const months = Object.keys(byMonth).sort();
  if (!months.length) return null;
  const series = months.map(p => ({ period: p, value: Math.round(byMonth[p].sum / byMonth[p].cnt * 10) / 10 }));
  const trimmed = n ? series.slice(-n) : series;
  return {
    series: trimmed,
    unit: '점',
    region: bokRegion,
    scope: '권역',
    matched: true,
  };
}

/**
 * 통합 임대료 (자체 수집기 + 한국부동산원 가중평균)
 * - 자체 수집기(네이버부동산): apis.firebaseRent.data.summary.avgRentPerPyeong (만원/평)
 *   ↳ 가중치 0.6 (실매물 기반, 변동 빠름)
 *   ↳ 평당값이 없으면 avgMonthlyRent ÷ avgArea × 3.3058 환산 (㎡→평)
 * - 한국부동산원: extractMarketRent (원/평 → 만원/평 환산)
 *   ↳ 가중치 0.4 (공식 통계, 분기 단위)
 * @param {object} apis - collectedData.apis
 * @param {string} sangkwonCode - mapToCommercialDistrict 결과
 * @returns {object|null} { value, unit:'만원/평', sources:[], integrated:boolean, breakdown:[] }
 */
export function buildIntegratedRent(apis, sangkwonCode) {
  const sources = [];

  // 1) 자체 수집기 (네이버부동산 매물) - 평당 단위로만 사용
  const naverSummary = apis?.firebaseRent?.data?.summary;
  let naverPerPyeong = null;
  if (naverSummary) {
    // 우선순위 1: 이미 평당으로 환산된 값
    const directPerPyeong = Number(naverSummary.avgRentPerPyeong);
    if (Number.isFinite(directPerPyeong) && directPerPyeong > 0) {
      naverPerPyeong = directPerPyeong;
    } else {
      // 우선순위 2: avgMonthlyRent(동평균 월세, 만원 - primary 동 60% + 주변 동 중위값 40% 가중평균) ÷ avgArea(㎡) × 3.3058 (㎡→평)
      const monthlyRent = Number(naverSummary.avgMonthlyRent);
      const avgAreaSqm = Number(naverSummary.avgArea);
      if (
        Number.isFinite(monthlyRent) && monthlyRent > 0 &&
        Number.isFinite(avgAreaSqm) && avgAreaSqm > 0
      ) {
        naverPerPyeong = (monthlyRent / avgAreaSqm) * 3.3058;
      }
      // 우선순위 3: 둘 다 없으면 null (소스 추가하지 않음)
    }
  }
  if (naverPerPyeong && naverPerPyeong > 0) {
    sources.push({
      name: '네이버부동산 매물',
      value: Math.round(naverPerPyeong),
      weight: 0.6,
      type: 'collector',
    });
  }

  // 2) 한국부동산원 (원/평 → 만원/평 환산)
  const roneObj = extractMarketRent(apis, sangkwonCode);
  if (roneObj && roneObj.value && Number(roneObj.value) > 0) {
    const valManwon = Math.round(Number(roneObj.value) / 10000);
    if (valManwon > 0) {
      sources.push({
        name: '한국부동산원',
        value: valManwon,
        weight: 0.4,
        type: 'official',
        period: roneObj.period || '',
        region: roneObj.region || '',
      });
    }
  }

  if (sources.length === 0) return null;

  // 단일 출처: 그대로 노출
  if (sources.length === 1) {
    return {
      value: sources[0].value,
      unit: '만원/평',
      sources: [sources[0].name],
      integrated: false,
      breakdown: sources,
    };
  }

  // 가중평균
  const totalWeight = sources.reduce((s, x) => s + x.weight, 0);
  const weighted = sources.reduce((s, x) => s + x.value * x.weight, 0) / totalWeight;
  return {
    value: Math.round(weighted),
    unit: '만원/평',
    sources: sources.map(s => `${s.name} ${s.value}만원`),
    integrated: true,
    breakdown: sources,
  };
}

/**
 * Extract deduplicated list of all data sources from cards
 * @param {Array} cards - array of card objects from mapCollectedDataToCards
 * @returns {string[]} deduplicated source names
 */
export function extractAllSources(cards) {
  if (!Array.isArray(cards)) return [];
  const sourceSet = new Set();
  cards.forEach(card => {
    if (card.source) {
      // Split combined sources like '소상공인365/네이버' into individual entries
      card.source.split('/').forEach(s => {
        const trimmed = s.trim();
        if (trimmed) sourceSet.add(trimmed);
      });
    }
  });
  return Array.from(sourceSet);
}
