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
 *   null이면 차트 영역에 "데이터 없음" 표시
 */

const fmt = (n) => {
  if (n === null || n === undefined || isNaN(n)) return '-';
  return Math.round(n).toLocaleString('ko-KR');
};

const fmtWon = (n) => {
  if (!n || isNaN(n)) return '-';
  const v = Math.round(n);
  if (v >= 10000) return `${(v / 10000).toFixed(1).replace(/\.0$/, '')}억원`;
  if (v >= 1) return `${fmt(v)}만원`;
  return `${fmt(v)}만원`;
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

  const card1ChartItems = [
    { label: '전체 카페', value: totalCafes },
    { label: '프랜차이즈', value: franchiseCount },
    { label: '개인카페', value: independentCount },
  ].filter(d => d.value > 0);

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
    chartType: 'horizontal-bar',
    metaInfo: '카페 현황',
    chartData: card1ChartItems.length > 0
      ? { items: card1ChartItems }
      : null,
    bodyData: {
      cafes: totalCafes,
      franchise: franchiseCount,
      individual: independentCount,
      bakery: bakeryCount,
      newOpen: newOpenCount,
      '일 유동인구': card1DailyPop > 0 ? `${fmt(card1DailyPop)}명` : '-',
      '방문고객': card1DailyVisitors > 0 ? `${fmt(card1DailyVisitors)}명` : '-',
      '폐업 매장': card1Closed,
    },
  };

  // ── Card 2: 고객 분석 (방문 연령 분포) ──
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

  let card2ChartData = null;
  if (ageSegments.length >= 2) {
    const barLabels = ageSegments.map(s => s.name);
    const barValues = ageSegments.map(s => s.pct);
    card2ChartData = { labels: barLabels, values: barValues };
  } else if (femaleRatio !== 50 || maleRatio !== 50) {
    card2ChartData = { labels: ['여성', '남성'], values: [femaleRatio, maleRatio] };
  }

  // Extract cafe delivery count from baemin data
  let cafeDeliveryCount = 0;
  const baeminRawData = apis.baeminTpbiz?.data;
  if (Array.isArray(baeminRawData)) {
    const cafeBaemin = baeminRawData.find(d => d?.tpbizNm?.includes('카페') || d?.tpbizNm?.includes('음료') || d?.baeminTpbizClsfNm?.includes('카페') || d?.baeminTpbizClsfNm?.includes('음료'));
    cafeDeliveryCount = cafeBaemin?.orderCnt || cafeBaemin?.slsCnt || 0;
  }

  const card2 = {
    title: '고객 분석',
    subtitle: '방문 고객 특성',
    date: dateStr,
    source: '소상공인365',
    bruSummary: aiData?.consumers?.bruSummary || null,
    aiSummary: aiData?.consumers?.bruFeedback
      || (topAge
      ? `${topAge} 고객 비중이 가장 높으며, ${femaleRatio > maleRatio ? '여성' : '남성'} 고객 비율이 높습니다.`
      : '고객 데이터를 수집 중입니다.'),
    chartType: 'bar',
    metaInfo: '고객',
    chartData: card2ChartData,
    bodyData: {
      male: maleRatio,
      female: femaleRatio,
      genderRatio: `남성 ${maleRatio}% / 여성 ${femaleRatio}%`,
      newCustomer: 0,
      regular: 0,
      topAge: topAge || '-',
      peakTime: aiData?.consumers?.peakTime || cd?.population?.peak || null,
      cafeDeliveryCount: cafeDeliveryCount,
    },
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
    chartType: 'donut',
    metaInfo: '프랜차이즈',
    chartData: franchiseSegments.length > 0 ? { segments: franchiseSegments } : null,
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

  const indieBarItems = [];
  if (indieCount > 0) indieBarItems.push({ label: '개인카페', value: indieCount });
  if (franchiseCount > 0) indieBarItems.push({ label: '프랜차이즈', value: franchiseCount });
  if (avgMonthlySales > 0) indieBarItems.push({ label: '월매출(만)', value: avgMonthlySales });

  const card4 = {
    title: '개인 카페 분석',
    subtitle: '주변 개인 카페 현황',
    date: dateStr,
    source: '오픈업/카카오',
    bruSummary: aiData?.indieCafe?.bruSummary || null,
    aiSummary: aiData?.indieCafe?.bruFeedback
      || (indieCount > 0
        ? `반경 500m 내 개인카페 ${indieCount}개.${avgMonthlySales > 0 ? ` 점포당 월평균 매출 ${avgMonthlySales.toLocaleString()}만원.` : ''}`
        : '개인카페 데이터를 수집 중입니다.'),
    chartType: 'horizontal-bar',
    metaInfo: '개인카페',
    chartData: indieBarItems.length > 0
      ? { items: indieBarItems }
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
    const cafeVal = Math.round(cafeSales / 10000) || 0;
    const dongVal = dongAvg ? Math.round(dongAvg / 10000) : 0;
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
    chartType: salesChartType,
    metaInfo: '매출',
    chartData: salesChartItems.length > 0
      ? { labels: salesChartItems.map(d => d.label), values: salesChartItems.map(d => d.value) }
      : null,
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
    chartType: 'area',
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
      avgStay: aiData?.consumers?.avgStay || null,
      residentPop: aiData?.overview?.residentPop || null,
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
    chartType: 'horizontal-bar',
    metaInfo: '임대',
    chartData: rentBarItems.length > 0 ? { items: rentBarItems } : null,
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
    chartType: null,
    metaInfo: '기회/리스크',
    chartData: null,
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
    chartType: 'horizontal-bar',
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

  const card10 = {
    title: 'SNS 트렌드',
    subtitle: '소셜미디어 키워드 분석',
    date: dateStr,
    source: '네이버/소상공인365',
    bruSummary: aiData?.snsTrend?.bruSummary || null,
    aiSummary: aiData?.snsTrend?.bruFeedback
      || (snsKeywords.length > 0
        ? `주요 키워드: ${(Array.isArray(snsKeywords) ? snsKeywords.slice(0, 5).join(', ') : String(snsKeywords))}.${blogMentions > 0 ? ` 블로그 언급 ${fmt(blogMentions)}건.` : ''}`
        : blogMentions > 0
          ? `네이버 블로그 언급 ${fmt(blogMentions)}건.`
          : 'SNS 트렌드 데이터를 수집 중입니다.'),
    chartType: null,
    metaInfo: 'SNS',
    chartData: null,
    bodyData: {
      keywords: snsKeywords,
      sentiment: snsSentiment,
      summary: snsSummary,
      blogMentions: blogMentions,
    },
    tag: 'SNS',
  };

  // ── Card 11: 날씨 영향 분석 ──
  const card11Weather = {
    title: '날씨 영향 분석',
    subtitle: '기상 조건별 매출 영향도',
    date: dateStr,
    bruSummary: aiData?.weatherImpact?.bruSummary || null,
    chartType: null, // text-based card
    chartData: null,
    bodyData: {
      regionType: aiData?.weatherImpact?.regionType || cd?.apis?.weatherIndex?.data?.regionType || null,
      sunnyEffect: aiData?.weatherImpact?.effects?.sunny || null,
      cloudyEffect: aiData?.weatherImpact?.effects?.cloudy || null,
      rainyEffect: aiData?.weatherImpact?.effects?.rain || null,
      snowEffect: aiData?.weatherImpact?.effects?.snow || null,
      description: aiData?.weatherImpact?.description || null,
    },
    aiSummary: aiData?.weatherImpact?.bruFeedback || aiData?.weatherImpact?.description || '날씨 영향 데이터를 수집 중입니다.',
    source: '기상청/소상공인365',
    tag: '날씨',
  };

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

  const card11 = {
    title: '상권 경쟁 분석',
    subtitle: '상권 내 경쟁 수준',
    date: dateStr,
    source: '오픈업/카카오',
    bruSummary: aiData?.indieCafe?.bruSummary || aiData?.franchise?.[0]?.bruSummary || null,
    aiSummary: aiData?.indieCafe?.bruFeedback || aiData?.franchise?.[0]?.feedback
      || (totalCafes > 0
      ? `반경 500m 내 카페 ${totalCafes}개, 경쟁 강도 "${competLevel}". 프랜차이즈 비율 ${franchRatio}%.`
      : '경쟁 데이터를 수집 중입니다.'),
    chartType: 'donut',
    metaInfo: '경쟁',
    chartData: totalCafes > 0
      ? { segments: [{ name: '프랜차이즈', pct: franchRatio }, { name: '개인', pct: 100 - franchRatio }] }
      : null,
    bodyData: {
      level: competLevel,
      cafePerKm2: cafePerKm2,
      franchiseRatio: franchRatio,
      avgLifespan: '-',
    },
  };

  // ── Card 12: 상권 변화 추이 ──
  const stcarData = apis.stcarSttus?.data;
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
    const mixedLabels = ['종합'];
    const mixedValues = [overallScore];
    if (opportunityCount > 0) { mixedLabels.push('기회'); mixedValues.push(opportunityCount * 15); }
    if (riskCount > 0) { mixedLabels.push('리스크'); mixedValues.push(riskCount * 15); }
    if (totalCafes > 0) {
      const competScore = totalCafes > 80 ? 30 : totalCafes > 40 ? 50 : totalCafes > 15 ? 70 : 90;
      mixedLabels.push('경쟁');
      mixedValues.push(competScore);
    }
    card13ChartData = { labels: mixedLabels, values: mixedValues };
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
    chartType: 'mixed',
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

  return [card1, card2, card3, card4, card5, card6, card7, card8, card9, card10, card11Weather, card11, card12, card13];
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
