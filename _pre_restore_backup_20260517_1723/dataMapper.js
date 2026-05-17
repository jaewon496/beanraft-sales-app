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
  const newOpenCount = [...franchiseList, ...independentList].filter(c => c.isNewOpen).length;

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
        : '카페 데이터를 수집 중입니다.',
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
        : '고객 데이터를 수집 중입니다.'),
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
        : '프랜차이즈 데이터를 수집 중입니다.'),
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
        : '개인카페 데이터를 수집 중입니다.'),
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
      : '매출 데이터를 수집 중입니다.'),
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
      : '유동인구 데이터를 수집 중입니다.'),
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
    bruSummary: aiData?.rent?.bruSummary || aiData?.startupCost?.bruSummary || null,
    aiSummary: aiData?.rent?.bruFeedback || aiData?.startupCost?.bruFeedback
      || (avgRent > 0
      ? `평균 월 임대료 ${fmtWon(avgRent)}, 보증금 ${fmtWon(avgDeposit)}.`
      : aiData?.rent?.monthly && aiData.rent.monthly !== '-'
        ? `월 임대료 ${aiData.rent.monthly}, 보증금 ${aiData.rent.deposit || '-'}`
        : '임대 데이터를 수집 중입니다.'),
    chartType: 'priceCards',
    metaInfo: '임대',
    chartData: rentBarItems.length > 0 ? { items: rentBarItems, totalCost: rentBarItems.reduce((s, it) => s + (it.value || 0), 0) } : null,
    bodyData: {
      rentPerPyeong: avgRent,
      deposit: avgDeposit,
      supportPrograms: 0,
      perPyeong: apis.firebaseRent?.data?.summary?.avgRentPerPyeong || null,
      medianMonthly: apis.firebaseRent?.data?.summary?.medianMonthly || null,
      medianDeposit: apis.firebaseRent?.data?.summary?.medianDeposit || null,
      interiorCost: interiorCost,
      equipmentCost: equipmentCost,
      totalStartupCost: totalStartupCost,
      premiumCost: premiumCost || rightsPrice,
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
        : '동네 카페 SNS 분위기를 정리하고 있습니다.'),
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
      aiSummary: bruFb || '\uB0A0\uC528 \uC601\uD5A5 \uB370\uC774\uD130\uB97C \uC218\uC9D1 \uC911\uC785\uB2C8\uB2E4.',
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
  // [2026-05-05 v3] 빈크래프트 5축 100점 점수 시스템
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
  const _dynPplCompet = apis.dynPplCmpr?.data;
  const _dailyPopCompet = Array.isArray(_dynPplCompet) ? Math.round((_dynPplCompet[0]?.cnt || 0) / 30) : Math.round((_dynPplCompet?.cnt || 0) / 30);
  const _potCustPerCafe = totalCafes > 0 && _dailyPopCompet > 0 ? Math.round(_dailyPopCompet / totalCafes) : 0;
  // 1-1. 카페당 잠재 고객 (8점)
  let _s_pot = 0;
  if (_potCustPerCafe >= 500) _s_pot = 8;
  else if (_potCustPerCafe >= 300) _s_pot = 6;
  else if (_potCustPerCafe >= 150) _s_pot = 4;
  else if (_potCustPerCafe >= 80) _s_pot = 2;
  else if (_potCustPerCafe > 0) _s_pot = 1;
  // 1-2. 동 평균 매출 (6점, 만원)
  let _s_avgSales = 0;
  if (_bizmapPerStoreAvg >= 1500) _s_avgSales = 6;
  else if (_bizmapPerStoreAvg >= 1000) _s_avgSales = 5;
  else if (_bizmapPerStoreAvg >= 600) _s_avgSales = 3;
  else if (_bizmapPerStoreAvg >= 400) _s_avgSales = 2;
  else if (_bizmapPerStoreAvg > 0) _s_avgSales = 1;
  // 1-3. 동 시장 규모 (3점)
  const _marketSizeBilManwon = Math.floor(_bizmapMarketSize / 10000); // 만원→억
  let _s_marketSize = 0;
  if (_marketSizeBilManwon >= 50) _s_marketSize = 3;
  else if (_marketSizeBilManwon >= 20) _s_marketSize = 2;
  else if (_marketSizeBilManwon >= 5) _s_marketSize = 1;
  // 1-4. 객단가 (3점, 원)
  let _s_unitPrice = 0;
  if (_bizmapPay >= 8000) _s_unitPrice = 3;
  else if (_bizmapPay >= 5000) _s_unitPrice = 2;
  else if (_bizmapPay >= 3000) _s_unitPrice = 1;
  const _scoreMarket = _s_pot + _s_avgSales + _s_marketSize + _s_unitPrice; // 0~20

  // [축 2] 경쟁 환경 (20점)
  // 2-1. 카페 밀도 (8점, 낮을수록 좋음)
  let _s_density = 0;
  if (totalCafes > 0 && totalCafes < 30) _s_density = 8;
  else if (totalCafes < 80) _s_density = 6;
  else if (totalCafes < 120) _s_density = 4;
  else if (totalCafes < 160) _s_density = 2;
  // 2-2. 프랜차이즈 비율 (7점, 낮을수록 좋음)
  let _s_fcRatio = 0;
  if (franchRatio > 0 && franchRatio < 20) _s_fcRatio = 7;
  else if (franchRatio < 30) _s_fcRatio = 6;
  else if (franchRatio < 50) _s_fcRatio = 4;
  else if (franchRatio < 70) _s_fcRatio = 2;
  // 2-3. 점포수 TOP 업종 다양성 (5점) - 비즈맵 popularUpjong 또는 markets/trend (App.jsx에서 fallback)
  const _topUpjongCount = Array.isArray(bmUpjongStoreRaw) ? bmUpjongStoreRaw.length : 0;
  let _s_diversity = 0;
  if (_topUpjongCount >= 5) _s_diversity = 5;
  else if (_topUpjongCount >= 3) _s_diversity = 3;
  else if (_topUpjongCount >= 1) _s_diversity = 1;
  const _scoreCompete = _s_density + _s_fcRatio + _s_diversity; // 0~20

  // [축 3] 시장 변화 (15점)
  // 3-1. 신규/폐업 비율 (5점)
  const _newCloseRatio = recentCloseBiz > 0 ? recentOpenBiz / recentCloseBiz : (recentOpenBiz > 0 ? 99 : 0);
  let _s_newClose = 0;
  if (_newCloseRatio >= 2.0) _s_newClose = 5;
  else if (_newCloseRatio >= 1.5) _s_newClose = 4;
  else if (_newCloseRatio >= 1.0) _s_newClose = 3;
  else if (_newCloseRatio >= 0.5) _s_newClose = 1;
  // 3-2. 점포수 6개월 추이 (5점, 비즈맵 storeCountTrend)
  const _bmStoreTrendSrc = aiData?.apis?.bizMapStoreCountTrend?.data ?? apis.bizMapStoreCountTrend?.data;
  let _storeTrendChangePct = 0;
  if (Array.isArray(_bmStoreTrendSrc) && _bmStoreTrendSrc.length >= 2) {
    const first = _bmStoreTrendSrc[0]?.storeCount ?? _bmStoreTrendSrc[0]?.storeCnt ?? 0;
    const last = _bmStoreTrendSrc[_bmStoreTrendSrc.length - 1]?.storeCount ?? _bmStoreTrendSrc[_bmStoreTrendSrc.length - 1]?.storeCnt ?? 0;
    if (first > 0) _storeTrendChangePct = Math.round(((last - first) / first) * 100);
  }
  let _s_storeTrend = 0;
  if (_storeTrendChangePct >= 5) _s_storeTrend = 5;
  else if (_storeTrendChangePct >= 0) _s_storeTrend = 3;
  else if (_storeTrendChangePct >= -5) _s_storeTrend = 2;
  else if (_storeTrendChangePct >= -10) _s_storeTrend = 1;
  // 3-3. 매출 변동률 (5점) - bizMapMarketSize 6개월 추이의 첫 vs 마지막 차이
  let _bmMarketChange = nbmStatsCompet?.marketChange || nbmStatsCompet?.marketSizeChange || 0;
  if (!_bmMarketChange && Array.isArray(_bmMarketArr) && _bmMarketArr.length >= 2) {
    const first = _bmMarketArr[0]?.amount || _bmMarketArr[0]?.value || 0;
    const last = _bmMarketArr[_bmMarketArr.length - 1]?.amount || _bmMarketArr[_bmMarketArr.length - 1]?.value || 0;
    if (first > 0) _bmMarketChange = Math.round(((last - first) / first) * 100);
  }
  let _s_marketChange = 0;
  if (_bmMarketChange >= 10) _s_marketChange = 5;
  else if (_bmMarketChange >= 0) _s_marketChange = 3;
  else if (_bmMarketChange >= -10) _s_marketChange = 2;
  else if (_bmMarketChange >= -20) _s_marketChange = 1;
  const _scoreChange = _s_newClose + _s_storeTrend + _s_marketChange; // 0~15

  // [축 4] 생존 기반 (30점) - LOCALDATA dongRows 분석
  const _ldRowsCompet = Array.isArray(apis.firebaseLocaldata?.data?.dongRows) ? apis.firebaseLocaldata.data.dongRows : [];
  const _activeAllCompet = _ldRowsCompet.filter(r => (r.status || '').includes('영업'));
  const _closedAllCompet = _ldRowsCompet.filter(r => r.status === '폐업');
  const _parseDateCompet = (s) => {
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
  const _nowCompet = new Date();
  const _fiveYearAgoCompet = new Date(_nowCompet.getFullYear() - 5, _nowCompet.getMonth(), _nowCompet.getDate());
  const _oneYearAgoCompet = new Date(_nowCompet.getFullYear() - 1, _nowCompet.getMonth(), _nowCompet.getDate());
  // 4-1. 5년+ 매장 비율 (12점)
  let _fiveYrPct = 0;
  if (_activeAllCompet.length > 0) {
    const _fiveYrCount = _activeAllCompet.filter(r => { const d = _parseDateCompet(r.apvDate); return d && d <= _fiveYearAgoCompet; }).length;
    _fiveYrPct = Math.round((_fiveYrCount / _activeAllCompet.length) * 100);
  }
  let _s_fiveYr = 0;
  if (_fiveYrPct >= 50) _s_fiveYr = 12;
  else if (_fiveYrPct >= 35) _s_fiveYr = 9;
  else if (_fiveYrPct >= 25) _s_fiveYr = 6;
  else if (_fiveYrPct >= 15) _s_fiveYr = 3;
  // 4-2. 평균 영업기간 (12점)
  let _avgYearsCompet = 0;
  if (_activeAllCompet.length > 0) {
    const _durs = _activeAllCompet.map(r => {
      const d = _parseDateCompet(r.apvDate);
      if (!d) return null;
      return (_nowCompet.getTime() - d.getTime()) / (1000 * 60 * 60 * 24 * 365);
    }).filter(v => v != null && v > 0);
    if (_durs.length > 0) _avgYearsCompet = Math.round((_durs.reduce((s, v) => s + v, 0) / _durs.length) * 10) / 10;
  }
  let _s_avgYears = 0;
  if (_avgYearsCompet >= 5) _s_avgYears = 12;
  else if (_avgYearsCompet >= 4) _s_avgYears = 10;
  else if (_avgYearsCompet >= 2.5) _s_avgYears = 7;
  else if (_avgYearsCompet >= 1.5) _s_avgYears = 3;
  // 4-3. 동 폐업률 (6점, 낮을수록 좋음)
  let _ldClosurePct = 0;
  const _totalLD = _activeAllCompet.length + _closedAllCompet.length;
  if (_totalLD > 0) {
    const _recentClose1y = _closedAllCompet.filter(r => { const d = _parseDateCompet(r.closeDate); return d && d >= _oneYearAgoCompet; }).length;
    _ldClosurePct = Math.round((_recentClose1y / _totalLD) * 100);
  }
  let _s_closure = 0;
  if (_totalLD > 0) {
    if (_ldClosurePct < 8) _s_closure = 6;
    else if (_ldClosurePct < 14) _s_closure = 4;
    else if (_ldClosurePct < 20) _s_closure = 2;
  }
  const _scoreSurvival = _s_fiveYr + _s_avgYears + _s_closure; // 0~30

  // [축 5] 비용 부담 (15점) - 비즈맵 costAnalysisList에서 ratio 추출
  const _costList = aiData?.apis?.bizMapCostAnalysis?.data ?? apis.bizMapCostAnalysis?.data ?? [];
  const _findCostRatio = (kw) => {
    const r = _costList.find(x => (x.item || '').includes(kw));
    return r?.ratio || 0;
  };
  // 5-1. 임차료 부담률 (8점) - 비즈맵 임차료% + firebaseRent÷매출 교차 검증
  const _bizmapRentPct = _findCostRatio('임차') || _findCostRatio('임대') || nbmStatsCompet?.rentPct || 0;
  const _fbRent = apis.firebaseRent?.data?.summary?.avgMonthlyRent || 0;
  let _myCalcRentPct = 0;
  if (_fbRent > 0 && _bizmapPerStoreAvg > 0) {
    _myCalcRentPct = Math.round((_fbRent / _bizmapPerStoreAvg) * 1000) / 10;
  }
  let _avgRentPct = 0;
  if (_bizmapRentPct > 0 && _myCalcRentPct > 0) _avgRentPct = Math.round(((_bizmapRentPct + _myCalcRentPct) / 2) * 10) / 10;
  else _avgRentPct = _bizmapRentPct || _myCalcRentPct || 0;
  let _s_rent = 0;
  if (_avgRentPct > 0 && _avgRentPct < 8) _s_rent = 8;
  else if (_avgRentPct > 0 && _avgRentPct < 12) _s_rent = 6;
  else if (_avgRentPct > 0 && _avgRentPct < 15) _s_rent = 4;
  else if (_avgRentPct > 0 && _avgRentPct < 20) _s_rent = 2;
  // 5-2. 영업이익률 (7점) - 비즈맵 costAnalysisList "영업이익"
  const _bizmapOpIncome = _findCostRatio('영업이익') || _findCostRatio('이익') || nbmStatsCompet?.opIncomePct || 0;
  let _s_opIncome = 0;
  if (_bizmapOpIncome >= 25) _s_opIncome = 7;
  else if (_bizmapOpIncome >= 20) _s_opIncome = 5;
  else if (_bizmapOpIncome >= 15) _s_opIncome = 3;
  else if (_bizmapOpIncome >= 10) _s_opIncome = 1;
  // [2026-05-06 추가 #2] 비즈맵 costAnalysisList: 인건비/재료비 비중 추출 + 비용 부담 양방향 가감
  let _bizmapLaborPct = 0;
  let _bizmapMaterialPct = 0;
  let _s_costExtra = 0;     // -2 ~ +2 (양방향 가감, cap에서 합산)
  try {
    _bizmapLaborPct = _findCostRatio('인건비') || _findCostRatio('인건') || _findCostRatio('급여') || 0;
    _bizmapMaterialPct = _findCostRatio('재료비') || _findCostRatio('식자재') || _findCostRatio('원재료') || _findCostRatio('재료') || 0;
    const _laborMatSum = (_bizmapLaborPct || 0) + (_bizmapMaterialPct || 0);
    // 카페 업종 적정: 인건비 20~30%, 재료비 25~35% → 합 45~65%가 정상
    if (_laborMatSum > 0) {
      if (_laborMatSum >= 45 && _laborMatSum <= 65) _s_costExtra = 2;
      else if (_laborMatSum >= 40 && _laborMatSum <= 70) _s_costExtra = 1;
      else if (_laborMatSum >= 75) _s_costExtra = -2;
      else if (_laborMatSum >= 70) _s_costExtra = -1;
    }
  } catch (e) { /* 0 유지 */ }
  const _scoreCost = Math.max(0, Math.min(15, _s_rent + _s_opIncome + _s_costExtra)); // 0~15

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

  // ─────────────────────────────────────────────────
  // [2026-05-06 추가 #4] MaxSlsBiz: 동 1순위 매출 업종 (가산점 박스 표시)
  // ─────────────────────────────────────────────────
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
  let _salesPercentileLabel = '데이터 부족';
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

  const card11 = {
    title: '상권 경쟁 분석',
    subtitle: '상권 내 경쟁 수준',
    date: dateStr,
    source: '오픈업/카카오/비즈맵/소상공인365',
    bruSummary: aiData?.indieCafe?.bruSummary || aiData?.franchise?.[0]?.bruSummary || null,
    aiSummary: aiData?.indieCafe?.bruFeedback || aiData?.franchise?.[0]?.feedback
      || (competAiParts.length > 0
      ? competAiParts.join('. ') + '.'
      : '경쟁 데이터를 수집 중입니다.'),
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
      recentOpen: recentOpenBiz > 0 ? recentOpenBiz + '개'
        : (_recent2yNew > 0 ? `최근 2년 ${_recent2yNew}개` : '-'),
      recentClose: recentCloseBiz > 0 ? recentCloseBiz + '개'
        : (_recent1yClosed > 0 ? `최근 1년 ${_recent1yClosed}개` : '-'),
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
        potCustPerCafe: _potCustPerCafe,
        bizmapPerStoreAvg: _bizmapPerStoreAvg,
        marketSizeBilManwon: _marketSizeBilManwon,
        bizmapPay: _bizmapPay,
        fiveYrPct: _fiveYrPct,
        avgYearsCompet: _avgYearsCompet,
        ldClosurePct: _ldClosurePct,
        avgRentPct: _avgRentPct,
        bizmapOpIncome: _bizmapOpIncome,
        storeTrendChangePct: _storeTrendChangePct,
        bmMarketChange: _bmMarketChange,
        // [2026-05-06 신규 5개 항목 raw]
        infraTotal: _ext_infraTotal,
        infraBreakdown: _ext_infraBreakdown,
        bizmapLaborPct: _bizmapLaborPct,
        bizmapMaterialPct: _bizmapMaterialPct,
        tenYrPct: _tenYrPct,
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
            : '상권 변화 데이터를 수집 중입니다.')),
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
      survivalRate1y: survivalRate1y || 0,
      survivalRate3y: (() => {
        const v = aiData?.marketSurvival?.year3;
        return v ? parseFloat(String(v).replace(/[^0-9.]/g, '')) || 0 : 0;
      })(),
      survivalRate5y: (() => {
        const v = aiData?.marketSurvival?.year5;
        return v ? parseFloat(String(v).replace(/[^0-9.]/g, '')) || 0 : 0;
      })(),
      // 비즈맵 보강: 점포수 6개월 추이
      bizmapStoreLatest: bmStoreLatest,
      bizmapStoreFirst: bmStoreFirst,
      bizmapStoreNetChange: bmStoreNetChange,
      bizmapStoreTrendLabel: bmStoreTrendLabel,
      bizmapStoreTrendChart: bmStoreTrendChart,
      // ── 신규 추가 (2026-05-06) ──
      closeCountSource: _closeCountSource,        // 'bizmap' | 'localdata' | 'none'
      cafesNow: _cafesNow,                         // 현재 운영 중인 카페 수
      cafes5yAgo: _cafes5yAgo,                     // 5년 전 시점 운영 중이던 카페 수
      cafes5yChangeRate: _cafes5yChangeRate,       // 5년 전 대비 변화율 (%)
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

  // === 종합 점수 (5개 지표 가중 평균) ===
  const c14OverallScore = aiData?.overallScore
    ? parseInt(aiData.overallScore) || 0
    : aiData?.score
      ? parseInt(aiData.score) || 0
      : Math.round((c14Density * 0.15 + c14Compet * 0.20 + c14Potential * 0.30 + c14Trend * 0.20 + c14CostRoom * 0.15));

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

  // === 추천 라벨 ===
  let c14Recommendation = '신중 검토';
  if (aiData?.recommendation) c14Recommendation = String(aiData.recommendation);
  else if (c14OverallScore >= 75) c14Recommendation = '진입 추천';
  else if (c14OverallScore >= 60) c14Recommendation = '조건부 추천';
  else if (c14OverallScore >= 45) c14Recommendation = '신중 검토';
  else c14Recommendation = '재검토 권장';

  // === Headline 생성 ===
  const c14Headline = (() => {
    if (aiData?.regionBrief && typeof aiData.regionBrief === 'string') return String(aiData.regionBrief).substring(0, 80);
    if (c14OverallScore >= 75) return `${dong.dongNm || '해당 상권'} 카페 진입 매력 높음`;
    if (c14OverallScore >= 60) return `${dong.dongNm || '해당 상권'} 조건부 진입 가능`;
    if (c14OverallScore >= 45) return `${dong.dongNm || '해당 상권'} 신중한 검토 필요`;
    return `${dong.dongNm || '해당 상권'} 진입 부담 존재`;
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

  const c14ChartData = {
    headline: c14Headline,
    analysis: aiData?.insight ? String(aiData.insight).substring(0, 300) : '',
    kpis: [
      { label: '종합 점수', value: c14OverallScore, unit: '점', trend: c14OverallScore >= 60 ? '상승' : c14OverallScore >= 45 ? '유지' : '하락' },
      { label: '기회', value: c14Opps.length, unit: '건', trend: c14Opps.length >= 3 ? '상승' : '유지' },
      { label: '리스크', value: c14Risks.length, unit: '건', trend: c14Risks.length >= 3 ? '상승' : '유지' },
    ],
    radarAxes: [
      { axis: '밀집도', value: c14Density, fullMark: 100 },
      { axis: '경쟁', value: c14Compet, fullMark: 100 },
      { axis: '잠재력', value: c14Potential, fullMark: 100 },
      { axis: '추세', value: c14Trend, fullMark: 100 },
      { axis: '비용여유', value: c14CostRoom, fullMark: 100 },
    ],
    signals: c14Signals,
    tags: c14Tags,
    overall: c14OverallScore,
    axes: [
      { label: '밀집도', value: c14Density },
      { label: '경쟁', value: c14Compet },
      { label: '잠재력', value: c14Potential },
      { label: '추세', value: c14Trend },
      { label: '비용여유', value: c14CostRoom },
    ],
  };

  const card13 = {
    title: 'AI 종합 분석',
    subtitle: 'AI 에이전트 종합 피드백',
    date: dateStr,
    source: 'Google Gemini',
    bruSummary: aiData?.overview?.bruSummary || null,
    aiSummary: aiData?.insight
      ? String(aiData.insight).substring(0, 300)
      : aiData?.regionBrief
        ? String(aiData.regionBrief).substring(0, 300)
        : c14Headline,
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

// === Stubs added after encoding accident (lost real impl) ===
export function mapToCommercialDistrict() { return null; }
export function extractMarketRent() { return null; }
export function extractVacancy() { return null; }
export function extractPriceChange() { return null; }
export function extractConversionRate() { return null; }
export function extractYieldRate() { return null; }
export function extractNetIncome() { return null; }
export function extractCafeClosure() { return null; }
export function extractRegionClosure() { return null; }
export function extractConsumerSentiment() { return null; }
export function extractMarketRentSeries() { return null; }
export function extractVacancySeries() { return null; }
export function extractPriceIndexSeries() { return null; }
export function extractCafeClosureSeries() { return null; }
export function extractConsumerSentimentSeries() { return null; }
