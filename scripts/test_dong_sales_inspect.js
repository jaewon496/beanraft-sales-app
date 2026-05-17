// 22개 동 응답에서 실제 매출 필드가 채워지는지 전수 확인
const GANGNAM_DONGS = [
  { code8: '11680510', name: '신사동' },
  { code8: '11680521', name: '논현1동' },
  { code8: '11680531', name: '논현2동' },
  { code8: '11680545', name: '압구정동' },
  { code8: '11680565', name: '청담동' },
  { code8: '11680580', name: '삼성1동' },
  { code8: '11680590', name: '삼성2동' },
  { code8: '11680600', name: '대치1동' },
  { code8: '11680610', name: '대치2동' },
  { code8: '11680630', name: '대치4동' },
  { code8: '11680640', name: '역삼1동' },
  { code8: '11680660', name: '역삼2동' },
  { code8: '11680670', name: '도곡1동' },
  { code8: '11680680', name: '도곡2동' },
  { code8: '11680690', name: '개포1동' },
  { code8: '11680700', name: '개포2동' },
  { code8: '11680720', name: '개포4동' },
  { code8: '11680730', name: '세곡동' },
  { code8: '11680731', name: '일원본동' },
  { code8: '11680740', name: '일원1동' },
  { code8: '11680750', name: '일원2동' },
  { code8: '11680760', name: '수서동' }
];

const BASE = 'http://localhost:8888';

async function inspectAll() {
  console.log('=== 비즈맵 응답 매출 필드 전수 점검 ===\n');
  const promises = GANGNAM_DONGS.map(async d => {
    try {
      const res = await fetch(`${BASE}/.netlify/functions/nicebizmap-proxy?admiCd=${d.code8}&upjong3Cd=Q13007`);
      const j = await res.json();
      const inner = j?.data?.data || {};
      return {
        name: d.name,
        code: d.code8,
        avgSalesListCount: (inner.averageSalesList || []).length,
        usageTrendCount: (inner.usageAndPaymentTrendList || []).length,
        marketSizeCount: (inner.marketSizeTrendList || []).length,
        risingMenuCount: (inner.risingMenuList || []).length,
        popularMenuCount: (inner.popularMenuList || []).length,
        storeCountTrendList: (inner.storeCountTrendList || []).length,
        // 가능한 매출 후보값
        firstAvgSale: inner.averageSalesList?.[0],
        firstUsage: inner.usageAndPaymentTrendList?.[0],
        firstMarket: inner.marketSizeTrendList?.[0]
      };
    } catch (e) {
      return { name: d.name, error: e.message };
    }
  });
  const results = await Promise.all(promises);
  for (const r of results) {
    if (r.error) {
      console.log(`${r.name}: ERROR ${r.error}`);
      continue;
    }
    console.log(`${r.name}(${r.code}): avgSales=${r.avgSalesListCount} usage=${r.usageTrendCount} market=${r.marketSizeCount} rising=${r.risingMenuCount} popular=${r.popularMenuCount} storeTrend=${r.storeCountTrendList}`);
    if (r.firstAvgSale) console.log(`   avgSales[0]: ${JSON.stringify(r.firstAvgSale).substring(0, 200)}`);
    if (r.firstUsage) console.log(`   usage[0]: ${JSON.stringify(r.firstUsage).substring(0, 200)}`);
    if (r.firstMarket) console.log(`   market[0]: ${JSON.stringify(r.firstMarket).substring(0, 200)}`);
  }

  // 어디든 매출 데이터가 채워진 동이 있는지 요약
  const withAvg = results.filter(r => r.avgSalesListCount > 0).length;
  const withUsage = results.filter(r => r.usageTrendCount > 0).length;
  const withMarket = results.filter(r => r.marketSizeCount > 0).length;
  console.log(`\n[요약] 22개 중 매출 채워진 동:`);
  console.log(`  averageSalesList: ${withAvg}개`);
  console.log(`  usageAndPaymentTrendList: ${withUsage}개`);
  console.log(`  marketSizeTrendList: ${withMarket}개`);
}

inspectAll();
