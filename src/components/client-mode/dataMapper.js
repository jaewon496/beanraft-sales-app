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
    const regItem = ncList.find(c => (c.newCstmCustNm || c.keyD || c.cstmTpNm || '').includes('단골'));
    const newItem = ncList.find(c => (c.newCstmCustNm || c.keyD || c.cstmTpNm || '').includes('신규'));
    if (regItem) dlvyRegularPct = parseFloat(regItem.newCstmCntRate ?? regItem.newCstmRt ?? regItem.cstmPopnumRt ?? regItem.rtVal ?? regItem.valD ?? 0);
    if (newItem) dlvyNewCustPct = parseFloat(newItem.newCstmCntRate ?? newItem.newCstmRt ?? newItem.cstmPopnumRt ?? newItem.rtVal ?? newItem.valD ?? 0);

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

  // 데이터 소스 표기 (실제 수집된 소스만)
  const card2Sources = ['소상공인365'];
  if (dlvyHp) card2Sources.push('비즈맵');
  if (openubSales) card2Sources.push('오픈업');

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
    },
    tag: '프랜차이즈',
  };

  // ── Card 4: 개인 카페 분석 ──
  const indieList = cd.nearbyIndependentList || [];
  const indieCount = cd.nearbyIndependentCafes || indieList.length || 0;

  // 매출 추정 from nicebizmapStats or salesEstimates
  const avgMonthlySales = cd.nicebizmapStats?.perStoreAvg || 0;

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
      avgMonthlySales: avgMonthlySales,
      franchiseMinPrice: franchiseMinPrice,
      franchiseMaxPrice: franchiseMaxPrice,
      nearbySummary: (() => {
        const nl = indieList.slice(0, 5).map(c => `${c.name || ''} (${c.dist || 0}m)`);
        return nl.length > 0 ? nl.join(', ') : null;
      })(),
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

  const card5 = {
    title: '매출 분석',
    subtitle: '월평균 예상 매출',
    date: dateStr,
    source: '소상공인365',
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
      guAvg: 0,
      top5: top5Sales,
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

  const card6 = {
    title: '유동인구',
    subtitle: `시간대별 통행량${dong.dongNm ? ' - ' + dong.dongNm : ''}`,
    date: dateStr,
    source: '소상공인365',
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
    },
  };

  // ── Card 8: 기회 & 리스크 ──
  const baeminData = apis.baeminTpbiz?.data;
  let deliveryRatio = 0;
  if (baeminData) {
    if (Array.isArray(baeminData)) {
      const cafeDelivery = baeminData.find(d => d?.tpbizNm?.includes('카페') || d?.tpbizNm?.includes('음료'));
      deliveryRatio = cafeDelivery?.ratio || cafeDelivery?.slsRatio || 0;
    } else if (typeof baeminData === 'object') {
      deliveryRatio = baeminData.ratio || baeminData.cafeRatio || 0;
    }
  }

  const opportunitiesList = Array.isArray(aiData?.opportunities) ? aiData.opportunities : [];
  const risksList = Array.isArray(aiData?.risks) ? aiData.risks : [];

  const card8 = {
    title: '기회 & 리스크',
    subtitle: '상권 기회 요인과 리스크 분석',
    date: dateStr,
    source: 'Google Gemini',
    bruSummary: aiData?.opportunities?.[0]?.bruSummary || aiData?.risks?.[0]?.bruSummary || null,
    aiSummary: aiData?.opportunities?.[0]?.bruFeedback || aiData?.risks?.[0]?.bruFeedback
      || (opportunitiesList.length > 0
        ? opportunitiesList[0]?.detail || opportunitiesList[0]?.title || ''
        : risksList.length > 0
          ? risksList[0]?.detail || risksList[0]?.title || ''
          : '기회/리스크 분석 데이터를 수집 중입니다.'),
    chartType: 'splitList',
    metaInfo: '기회/리스크',
    chartData: (opportunitiesList.length > 0 || risksList.length > 0)
      ? {
          opportunities: opportunitiesList.map(o => ({ title: o?.title || '', detail: o?.detail || '' })),
          risks: risksList.map(r => ({ title: r?.title || '', detail: r?.detail || '' })),
        }
      : null,
    bodyData: {
      opportunities: opportunitiesList.map(o => ({ title: o?.title || '', detail: o?.detail || '' })),
      risks: risksList.map(r => ({ title: r?.title || '', detail: r?.detail || '' })),
      opportunityCount: opportunitiesList.length,
      riskCount: risksList.length,
    },
    tag: '기회/리스크',
  };

  // ── Card 9: 배달 분석 ──
  const deliveryData = apis.delivery?.data;
  const deliveryHpData = apis.deliveryHotplace?.data;
  let cafeDeliveryRank = 0;
  let avgDeliveryOrder = 0;
  let topDeliveryCategory = '-';

  if (Array.isArray(deliveryData) && deliveryData.length > 0) {
    const cafeItem = deliveryData.find(d => d?.tpbizNm?.includes('카페') || d?.tpbizNm?.includes('음료'));
    cafeDeliveryRank = cafeItem ? deliveryData.indexOf(cafeItem) + 1 : 0;
    topDeliveryCategory = deliveryData[0]?.tpbizNm || '-';
    avgDeliveryOrder = cafeItem?.avgOrderAmt || 0;
  }
  if (deliveryHpData) {
    avgDeliveryOrder = avgDeliveryOrder || deliveryHpData.avgOrderAmt || deliveryHpData.avgPrice || 0;
  }

  let deliveryBarItems = [];
  if (Array.isArray(deliveryData) && deliveryData.length > 0) {
    deliveryBarItems = deliveryData.slice(0, 5).map(d => ({
      label: (d.tpbizNm || '').substring(0, 4),
      value: d.slsRatio || d.ratio || d.orderCnt || 0,
    })).filter(d => d.value > 0);
  } else if (Array.isArray(baeminData) && baeminData.length > 0) {
    deliveryBarItems = baeminData.slice(0, 5).map(d => ({
      label: (d.baeminTpbizClsfNm || d.tpbizNm || '').substring(0, 4),
      value: d.slsRatio || d.ratio || d.orderCnt || 0,
    })).filter(d => d.value > 0);
  }

  const card9 = {
    title: '배달 분석',
    subtitle: '배달 업종 현황',
    date: dateStr,
    source: '소상공인365',
    bruSummary: aiData?.deliverySummary || null,
    aiSummary: aiData?.deliveryFeedback
      || (deliveryRatio > 0 || cafeDeliveryRank > 0
      ? `카페/음료 배달 매출 비중 ${deliveryRatio || '-'}%.${cafeDeliveryRank > 0 ? ` 배달 업종 내 ${cafeDeliveryRank}위.` : ''}`
      : '배달 데이터를 수집 중입니다.'),
    chartType: 'circularProgress',
    metaInfo: '배달',
    chartData: deliveryBarItems.length > 0 ? { items: deliveryBarItems } : null,
    bodyData: {
      deliveryRatio: Math.round(deliveryRatio),
      cafeDeliveryRank: cafeDeliveryRank || 0,
      avgDeliveryOrder: avgDeliveryOrder || 0,
      topCategory: topDeliveryCategory,
    },
  };

  // ── Card 10: SNS 트렌드 ──
  const snsData = apis.snsAnaly?.data;
  const snsKeywords = snsData?.popularKeywords || snsData?.keywords || [];
  const snsSentiment = snsData?.sentiment || null;
  const snsSummary = snsData?.summary || snsData?.analysis || null;
  const blogMentions = apis.naverBlog?.total || 0;

  // 나이스비즈맵 인기메뉴/뜨는메뉴
  const nbmMenuRaw = cd.nicebizmapMenu || [];
  const trendMenus = Array.isArray(nbmMenuRaw)
    ? nbmMenuRaw.map(m => ({
        name: m.MENU_NM || m.menuNm || m.name || (typeof m === 'string' ? m : ''),
        rank: m.RANK || m.rank || 0,
        ratio: m.RATIO || m.ratio || 0,
      })).filter(m => m.name)
    : [];

  const card10 = {
    title: 'SNS 트렌드',
    subtitle: '소셜미디어 키워드 분석',
    date: dateStr,
    source: trendMenus.length > 0 ? '네이버/소상공인365/나이스비즈맵' : '네이버/소상공인365',
    bruSummary: aiData?.snsTrend?.bruSummary || null,
    aiSummary: aiData?.snsTrend?.bruFeedback
      || (snsKeywords.length > 0
        ? `주요 키워드: ${(Array.isArray(snsKeywords) ? snsKeywords.slice(0, 5).join(', ') : String(snsKeywords))}.${blogMentions > 0 ? ` 블로그 언급 ${fmt(blogMentions)}건.` : ''}${trendMenus.length > 0 ? ` 인기메뉴: ${trendMenus.slice(0, 3).map(m => m.name).join(', ')}.` : ''}`
        : trendMenus.length > 0
          ? `인기메뉴: ${trendMenus.slice(0, 5).map(m => m.name).join(', ')}.${blogMentions > 0 ? ` 블로그 언급 ${fmt(blogMentions)}건.` : ''}`
          : blogMentions > 0
            ? `네이버 블로그 언급 ${fmt(blogMentions)}건.`
            : 'SNS 트렌드 데이터를 수집 중입니다.'),
    chartType: 'wordCloud',
    metaInfo: 'SNS',
    chartData: (() => {
      if (Array.isArray(snsKeywords) && snsKeywords.length > 0) {
        const kwList = snsKeywords.slice(0, 20).map((kw, i) => ({
          text: typeof kw === 'string' ? kw : (kw.text || kw.keyword || ''),
          weight: typeof kw === 'object' && kw.weight ? kw.weight : Math.max(100 - i * 5, 15),
        }));
        const posRatio = snsSentiment === '\uAE0D\uC815' ? 72 : snsSentiment === '\uBD80\uC815' ? 28 : 50;
        return { keywords: kwList, sentimentPos: posRatio };
      }
      return null;
    })(),
    bodyData: {
      keywords: snsKeywords,
      sentiment: snsSentiment,
      summary: snsSummary,
      blogMentions: blogMentions,
      trendMenus: trendMenus,
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
    const _s = (v) => (v != null ? v : 0);
    const _fp = (v) => v != null ? `${v > 0 ? '+' : ''}${v}%` : null;
    return {
      title: '\uB0A0\uC528 \uC601\uD5A5 \uBD84\uC11D',
      subtitle: '\uAE30\uC0C1 \uC870\uAC74\uBCC4 \uB9E4\uCD9C \uC601\uD5A5\uB3C4',
      date: dateStr,
      bruSummary: wi?.bruSummary || null,
      chartType: 'weatherImpact',
      chartData: {
        items: [
          { label: '\uB9D1\uC74C', icon: 'sun', value: _s(sV) },
          { label: '\uD750\uB9BC', icon: 'cloud', value: _s(cV) },
          { label: '\uBE44', icon: 'rain', value: _s(rV) },
          { label: '\uB208', icon: 'snow', value: _s(snV) },
        ],
      },
      bodyData: {
        regionType: rType,
        sunnyEffect: _fp(sV), cloudyEffect: _fp(cV),
        rainyEffect: _fp(rV), snowEffect: _fp(snV),
        description: desc,
      },
      aiSummary: bruFb || '\uB0A0\uC528 \uC601\uD5A5 \uB370\uC774\uD130\uB97C \uC218\uC9D1 \uC911\uC785\uB2C8\uB2E4.',
      source: '\uAE30\uC0C1\uCCAD/\uC18C\uC0C1\uACF5\uC778365',
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
      newEntryRate: shortTermRatio > 0 ? shortTermRatio + '%' : '-',
      stableStoreRate: longTermRatio > 0 ? longTermRatio + '%' : '-',
      avgLifespan: avgLifespanLabel,
      recentOpen: recentOpenBiz > 0 ? recentOpenBiz + '개' : '-',
      recentClose: recentCloseBiz > 0 ? recentCloseBiz + '개' : '-',
      perStoreSales: perStoreSales,
      marketSize: competMarketSize,
    },
  };

  // ── Card 12: 상권 변화 추이 ──
  const stcarRaw2 = apis.stcarSttus?.data;
  const stcarData = Array.isArray(stcarRaw2) ? stcarRaw2 : (Array.isArray(stcarRaw2?.data) ? stcarRaw2.data : null);
  let survivalRate1y = 0;
  let openCnt = newOpenCount || 0;
  let closeCnt = 0;
  let netChg = 0;
  let trendLabel = '-';

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
  }
  netChg = openCnt - closeCnt;
  if (netChg > 2) trendLabel = '성장';
  else if (netChg < -2) trendLabel = '쇠퇴';
  else trendLabel = '정체';

  const card12 = {
    title: '상권 변화 추이',
    subtitle: '개폐업 및 상권 트렌드',
    date: dateStr,
    source: '소상공인365',
    bruSummary: aiData?.marketSurvival?.bruSummary || null,
    aiSummary: aiData?.marketSurvival?.bruFeedback
      || (survivalRate1y > 0 || openCnt > 0
      ? `${openCnt > 0 ? `신규 개업 ${openCnt}개` : ''}${closeCnt > 0 ? `, 폐업 ${closeCnt}개` : ''}. 상권 추세: ${trendLabel}.${survivalRate1y > 0 ? ` 1년 생존율 ${survivalRate1y}%.` : ''}`
      : '상권 변화 데이터를 수집 중입니다.'),
    chartType: 'line',
    metaInfo: '상권변화',
    chartData: stcarLabels.length > 0
      ? { labels: stcarLabels, values: stcarValues }
      : null,
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
    },
  };

  // ── Card 13: AI 종합 분석 ──
  let overallScore = 0;
  let opportunityCount = 0;
  let riskCount = 0;
  let recommendation = '-';

  if (aiData?.overallScore) {
    overallScore = parseInt(aiData.overallScore) || 0;
  } else if (aiData?.score) {
    overallScore = parseInt(aiData.score) || 0;
  }
  if (Array.isArray(aiData?.opportunities)) {
    opportunityCount = aiData.opportunities.length;
  }
  if (Array.isArray(aiData?.risks)) {
    riskCount = aiData.risks.length;
  }
  if (aiData?.recommendation) {
    recommendation = String(aiData.recommendation);
  } else if (overallScore >= 70) {
    recommendation = '진입 추천';
  } else if (overallScore >= 50) {
    recommendation = '조건부 추천';
  } else if (overallScore > 0) {
    recommendation = '신중 검토';
  }

  let card13ChartData = null;
  if (overallScore > 0) {
    const opportunityScore = opportunityCount > 0 ? Math.min(opportunityCount * 20, 100) : 50;
    const riskScore = riskCount > 0 ? Math.min(riskCount * 20, 100) : 30;
    const competScore = totalCafes > 80 ? 30 : totalCafes > 40 ? 50 : totalCafes > 15 ? 70 : 90;
    const salesScore = overallScore; // proxy
    const locationScore = Math.round((overallScore + competScore) / 2);
    card13ChartData = {
      overall: overallScore,
      axes: [
        { label: '\uAE30\uD68C', value: opportunityScore },
        { label: '\uB9AC\uC2A4\uD06C', value: riskScore },
        { label: '\uACBD\uC7C1', value: competScore },
        { label: '\uB9E4\uCD9C', value: salesScore },
        { label: '\uC785\uC9C0', value: locationScore },
      ],
    };
  }

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
        : 'AI 분석 데이터를 수집 중입니다.',
    chartType: 'scoreCard',
    metaInfo: 'AI종합',
    chartData: card13ChartData,
    bodyData: {
      overallScore: overallScore || 0,
      opportunities: opportunityCount,
      risks: riskCount,
      recommendation: recommendation,
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
  const allCards = [card1, card2, card3, card4, card5, card6, card7, card8, card9, card10, card11Weather, card11, card12, card13];
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
