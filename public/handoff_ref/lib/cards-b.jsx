/* cards-b.jsx — Cards 08-12 */

/* ============================================================
   Card 08 — 임대/창업 (simulator + KOSIS 4박스)
   ============================================================ */
function Card08({ body = {} }) {
  const bd = body.bodyData || {};
  const cd = body.chartData || {};
  const kosis = body.kosisBoxData || {};
  // [2026-05-18] integratedRent.unit이 '만원/평'이면 그대로, '원/평'이면 /10000
  // UnifiedLayout이 bd.rentPerPyeongManwon으로 미리 만원 단위 주입했으면 그걸 우선 사용
  const _ir = kosis?.integratedRent;
  const _irManwon = _ir?.value
    ? (typeof _ir.unit === 'string' && _ir.unit.indexOf('만원') >= 0
        ? Math.round(_ir.value)
        : Math.round(_ir.value / 10000))
    : 0;
  const rentPerPyeong = Number(bd.rentPerPyeongManwon) || _irManwon || Number(bd.rentPerPyeong) || 0;
  // [2026-05-18] depositManwon: UnifiedLayout에서 정규화한 값 우선
  const depositManwon = Number(bd.depositManwon) || Number(bd.deposit) || 0;
  const premium = cd.premium || bd.premium || null;
  const premiumValue = Number(premium?.value) || Number(bd.premiumCost) || 0;
  // premium.value는 원 단위, premiumCost(폴백)는 만원 단위 → 단위 통일 (만원)
  const premiumManwon = premiumValue > 0 ? (premium?.value ? premiumValue / 10000 : premiumValue) : 0;
  // [2026-05-18] totalStartupCost: UnifiedLayout에서 정규화한 totalStartupCostManwon 우선
  const totalStartupCost = Number(bd.totalStartupCostManwon) || Number(bd.totalStartupCost) || 0;
  const marketRent = kosis?.marketRent?.value ? Math.round(kosis.marketRent.value / 10000) : 0;
  const conversionRate = Number(kosis?.conversionRate?.value) || 0;
  const yieldRate = Number(kosis?.yieldRate?.value) || 0;
  const netIncome = Number(kosis?.netIncome?.value) || 0;
  const netIncomePct = Number(kosis?.netIncome?.noiPct) || 0;
  const netIncomeUnit = kosis?.netIncome?.unit || '원/평/년';
  const kosisPeriod = kosis?.marketRent?.period || kosis?.yieldRate?.period || '';
  const kosisRegion = kosis?.marketRent?.region || '';
  const kc = cd.kosisCafe || null;
  const [pyeong, setPyeong] = React.useState(15);
  const monthly = rentPerPyeong > 0 ? Math.round(pyeong * rentPerPyeong) : 0;
  const depositPerPy = depositManwon > 0 ? depositManwon / 15 : 0;
  const deposit = depositPerPy > 0 ? pyeong * depositPerPy : 0;
  const interiorPerPy = kc?.interiorPerPyeong > 0 ? kc.interiorPerPyeong : 0;
  const interior = interiorPerPy > 0 ? pyeong * interiorPerPy : 0;
  // total: 시뮬레이터 - totalStartupCost 또는 deposit+interior+premium 합산
  const total = totalStartupCost > 0
    ? (totalStartupCost * pyeong / 15)
    : ((deposit + interior + premiumManwon) > 0 ? deposit + interior + premiumManwon : 0);
  return (
    <CardShell n="08" id="08"
      title="임대/창업 정보"
      sub="상가 시세 및 창업 비용">
      <div className="bc-grid-4" style={{gap:16, marginBottom:16}}>
        <StatTile id="c8.tile1" tone="blue"  label="통합 평당 월세" value={rentPerPyeong > 0 ? String(rentPerPyeong) : '-'} unit={rentPerPyeong > 0 ? '만원' : ''} hero/>
        <StatTile id="c8.tile2" tone="lilac" label="평균 보증금"   value={depositPerPy > 0 ? Math.round(depositPerPy).toLocaleString() : '-'} unit={depositPerPy > 0 ? '만/평' : ''}/>
        <StatTile id="c8.tile3" tone="mint"  label="총 창업 (15평)" value={total > 0 ? (total >= 10000 ? (total / 10000).toFixed(1) : Math.round(total).toLocaleString()) : '-'} unit={total > 0 ? (total >= 10000 ? '억' : '만') : ''}/>
        <StatTile id="c8.tile4" tone="rose"  label="권리금"  value={premiumManwon > 0 ? (premiumManwon >= 10000 ? (premiumManwon / 10000).toFixed(1) : Math.round(premiumManwon).toLocaleString()) : '-'} unit={premiumManwon > 0 ? (premiumManwon >= 10000 ? '억' : '만원') : ''}/>
      </div>

      <div style={{display:"grid", gridTemplateColumns:"1fr 1fr", gap:16}}>
        <div className="bc-box" style={{padding:18}}>
          <div style={{fontSize:15, fontWeight:600, marginBottom:12}}>임대 시세 4종</div>
          <div className="bc-grid-2" style={{gap:10}}>
            <Box label="평당 월세" value={marketRent > 0 ? String(marketRent) : '-'} unit={marketRent > 0 ? '만' : ''} sub={kosisRegion || ''} src={kosisPeriod}/>
            <Box label="전환율"   value={conversionRate > 0 ? Number(conversionRate).toFixed(1) : '-'} unit={conversionRate > 0 ? '%' : ''} src={kosisPeriod}/>
            <Box label="수익률"   value={yieldRate > 0 ? Number(yieldRate).toFixed(1) : '-'} unit={yieldRate > 0 ? '%' : ''} sub="순영업소득 기준" src={kosisPeriod}/>
            <Box label="순영업소득"
                 value={
                   netIncomeUnit === '%' && netIncomePct > 0
                     ? netIncomePct.toFixed(1)
                     : (netIncome > 0
                         ? (netIncome >= 10000
                             ? Math.round(netIncome / 10000).toLocaleString()
                             : Math.round(netIncome).toLocaleString())
                         : '-')
                 }
                 unit={
                   netIncomeUnit === '%' && netIncomePct > 0
                     ? '%'
                     : (netIncome > 0 ? (netIncome >= 10000 ? '만/평/년' : '원/평/년') : '')
                 }
                 sub={netIncomeUnit === '%' ? '임대수입 대비' : ''}
                 src={kosisPeriod}/>
          </div>
        </div>

        <div className="bc-box" style={{padding:18}}>
          <div style={{fontSize:15, fontWeight:600, marginBottom:12}}>전국 카페 평균</div>
          {kc ? (
            <>
              {/* [2026-05-19] 인테리어비 폴백: interiorAvg 없으면 interiorPerPyeong × avgAreaPyeong, 그것도 없으면 전국 카페 평균(약 5,250만원) */}
              <div className="bc-grid-3" style={{gap:8}}>
                {(() => {
                  const _interiorFallback = (kc?.interiorPerPyeong > 0 && kc?.avgAreaPyeong > 0)
                    ? Math.round(kc.interiorPerPyeong * kc.avgAreaPyeong)
                    : 5250; // 외식업체경영실태조사 카페 전국 평균
                  const _interiorShown = kc?.interiorAvg > 0 ? kc.interiorAvg : _interiorFallback;
                  return <Box label="인테리어비" value={_interiorShown.toLocaleString()} unit="만원"/>;
                })()}
                <Box label="총 투자비"  value={kc?.startupInvestAvg > 0 ? (kc.startupInvestAvg / 10000).toFixed(2) : '-'} unit={kc?.startupInvestAvg > 0 ? '억' : ''}/>
                <Box label="평수"       value={kc?.avgAreaPyeong > 0 ? kc.avgAreaPyeong.toFixed(1) : '-'} unit={kc?.avgAreaPyeong > 0 ? '평' : ''}/>
                <Box label="월 매출"    value={kc?.salesAvg > 0 ? kc.salesAvg.toLocaleString() : '-'} unit={kc?.salesAvg > 0 ? '만원' : ''}/>
                <Box label="객단가"     value={kc?.unitPriceAvg > 0 ? kc.unitPriceAvg.toLocaleString() : '-'} unit={kc?.unitPriceAvg > 0 ? '원' : ''}/>
                <Box label="이익률"     value={kc?.profitMargin > 0 ? kc.profitMargin.toFixed(1) : '-'} unit={kc?.profitMargin > 0 ? '%' : ''}/>
              </div>
            </>
          ) : (
            <div style={{fontSize:13, color:"var(--matte-fg-4)", padding:"20px 0"}}>카페 평균 데이터 수집 중</div>
          )}
        </div>
      </div>

      <div style={{display:"grid", gridTemplateColumns:"1fr 1fr", gap:16, marginTop:16}}>
        <div className="bc-box" style={{padding:24}}>
          <div style={{fontSize:16, fontWeight:600, marginBottom:18}}>인테리어 비용 분포 <span style={{fontSize:13, color:"var(--matte-fg-3)", fontWeight:500, marginLeft:8}}>{pyeong}평 기준</span></div>
          <div style={{display:"flex", flexDirection:"column", gap:10}}>
          {(() => {
            const perPy = kc?.interiorPerPyeong > 0 ? kc.interiorPerPyeong : 350;
            const tiers = [
              ["셀프", perPy * 0.4 * pyeong, false],
              ["최소 시공", perPy * 0.7 * pyeong, false],
              ["평균 시공", perPy * 1.0 * pyeong, true],
              ["고급 시공", perPy * 1.5 * pyeong, false],
              ["프리미엄", perPy * 2.5 * pyeong, false],
            ];
            const tMax = Math.max(...tiers.map(t => t[1]));
            return tiers.map(([l, v, acc]) => {
              const valStr = v >= 10000 ? `${(v / 10000).toFixed(2)}억` : `${Math.round(v).toLocaleString()}만`;
              const pct = Math.round((v / tMax) * 100);
              return (
                <div key={l} style={{display:"grid", gridTemplateColumns:"110px 1fr 90px", gap:12, alignItems:"center"}}>
                  <span style={{fontSize:14, color: acc ? "#4C7BE4" : "var(--matte-fg-2)", fontWeight: acc ? 700 : 500}}>{l}</span>
                  <div className="bc-bar" style={{height:12, background:"rgba(255,255,255,0.05)"}}><div style={{width:`${pct}%`, background: acc ? "#4C7BE4" : "#FFFFFF", height:"100%", borderRadius:"inherit"}}></div></div>
                  <span style={{fontSize:14, textAlign:"right", fontVariantNumeric:"tabular-nums", color: acc ? "#4C7BE4" : "var(--matte-fg)", fontWeight:700}}>{valStr}</span>
                </div>
              );
            });
          })()}
          </div>
          <div style={{fontSize:13, color:"var(--matte-fg-3)", marginTop:16, paddingTop:14, borderTop:"1px solid var(--matte-line)"}}>평균 시공 권장 — 평당 {kc?.interiorPerPyeong > 0 ? kc.interiorPerPyeong.toLocaleString() : '~350'}만원 기준</div>
        </div>

        <div className="bc-box" style={{padding:24, background:"linear-gradient(135deg, rgba(76, 123, 228,0.10), transparent 60%)", border:"1px solid rgba(76, 123, 228,0.45)"}}>
          <div style={{display:"flex", justifyContent:"space-between", alignItems:"baseline", marginBottom:14}}>
            <div style={{fontSize:16, fontWeight:700, color:"#4C7BE4"}}>내 카페 시뮬레이터</div>
            <div style={{fontSize:14, color:"var(--matte-fg-2)", fontWeight:600}}><strong style={{fontSize:18, color:"#fff"}}>{pyeong}</strong> 평</div>
          </div>
          <input type="range" min="5" max="60" value={pyeong} onChange={e=>setPyeong(+e.target.value)} style={{width:"100%", accentColor:"#4C7BE4"}}/>
          <div style={{display:"flex", justifyContent:"space-between", fontSize:13, color:"var(--matte-fg-4)", marginTop:6}}>
            <span>5평</span><span>15</span><span>30</span><span>45</span><span>60평</span>
          </div>
          <div className="bc-grid-3" style={{gap:12, marginTop:20}}>
            <div style={{padding:"16px 18px", background:"rgba(255,255,255,0.03)", borderRadius:10, border:"1px solid var(--matte-line)"}}>
              <div style={{fontSize:13, color:"var(--matte-fg-3)", marginBottom:6, fontWeight:500}}>월 임대료</div>
              <div style={{fontSize:22, fontWeight:700, fontVariantNumeric:"tabular-nums", letterSpacing:"-0.01em"}}>{monthly > 0 ? monthly.toLocaleString() : '-'}<span style={{fontSize:13, color:"var(--matte-fg-3)", marginLeft:3, fontWeight:500}}>{monthly > 0 ? '만' : ''}</span></div>
            </div>
            <div style={{padding:"16px 18px", background:"rgba(255,255,255,0.03)", borderRadius:10, border:"1px solid var(--matte-line)"}}>
              <div style={{fontSize:13, color:"var(--matte-fg-3)", marginBottom:6, fontWeight:500}}>보증금</div>
              <div style={{fontSize:22, fontWeight:700, fontVariantNumeric:"tabular-nums", letterSpacing:"-0.01em"}}>{deposit > 0 ? (deposit >= 10000 ? (deposit/10000).toFixed(2) : Math.round(deposit).toLocaleString()) : '-'}<span style={{fontSize:13, color:"var(--matte-fg-3)", marginLeft:3, fontWeight:500}}>{deposit > 0 ? (deposit >= 10000 ? '억' : '만') : ''}</span></div>
            </div>
            <div style={{padding:"16px 18px", background:"rgba(76, 123, 228,0.10)", borderRadius:10, border:"1px solid rgba(76, 123, 228,0.45)"}}>
              <div style={{fontSize:13, color:"var(--matte-fg-3)", marginBottom:6, fontWeight:500}}>총 창업비</div>
              <div style={{fontSize:22, fontWeight:700, color:"#4C7BE4", fontVariantNumeric:"tabular-nums", letterSpacing:"-0.01em"}}>{total > 0 ? (total >= 10000 ? (total/10000).toFixed(2) : Math.round(total).toLocaleString()) : '-'}<span style={{fontSize:13, color:"var(--matte-fg-3)", marginLeft:3, fontWeight:500}}>{total > 0 ? (total >= 10000 ? '억' : '만') : ''}</span></div>
            </div>
          </div>

          {premiumManwon > 0 && kosisRegion && (
            <div style={{marginTop:14, fontSize:13, color:"var(--matte-fg-3)"}}>{kosisRegion} 기준 권리금 평균 {premiumManwon.toLocaleString()}만원 포함</div>
          )}
        </div>
      </div>
    </CardShell>
  );
}

/* ============================================================
   Card 09 — 카페 기회 (공실률)
   ============================================================ */
function Card09({ body = {} }) {
  const bd = body.bodyData || {};
  const kosis = body.kosisBoxData || {};
  const vacancy = Number(body.vacancy) || Number(kosis?.vacancy?.value) || 0;
  const newOpen = Number(body.newOpen) || Number(bd.recentOpen) || Number(bd.openCount) || 0;
  const closed = Number(body.closed) || Number(bd.recentClose) || Number(bd.closeCount) || 0;
  const cafeMonthly = Number(body.cafeMonthly) || 0;
  const guAvg = Number(body.guAvg) || 0;
  const sigungu = body.sigungu || '';
  const individualPct = Number(body.individualPct) || 0;
  const survival3y = Number(body.survival3y) || 0;
  const vacSeries = body.vacancySeries || kosis?.vacancySeries?.series || null;
  // [정답지] 0% 값도 유효 분기로 유지 (KOSIS 응답 길이만큼 표시). 숫자가 아닌 항목만 제외.
  const vacValues = Array.isArray(vacSeries)
    ? vacSeries.map(s => Number(s.value)).filter(v => Number.isFinite(v))
    : [];
  // 최저/최고는 0% 분기를 제외해 의미 있는 분기 기반으로 계산
  const vacPositive = vacValues.filter(v => v > 0);
  const vacMin = vacPositive.length > 0 ? Math.min(...vacPositive) : 0;
  const vacMax = vacPositive.length > 0 ? Math.max(...vacPositive) : 0;
  const vacRange = vacMax > 0 ? Math.round((vacMax - vacMin) * 10) / 10 : 0;
  const vacavgDelta = (() => {
    if (vacValues.length < 2) return 0;
    const avg = vacValues.reduce((s, v) => s + v, 0) / vacValues.length;
    return Math.round((vacancy - avg) * 10) / 10;
  })();
  const lineData = vacValues.length >= 2 ? vacValues : [];
  return (
    <CardShell n="09" id="09"
      title="카페 기회"
      sub="이 동네 카페 데이터 발견">
      {/* 4-up KPI */}
      <div className="bc-grid-4" style={{gap:16, marginBottom:16}}>
        <StatTile id="c9.hero" tone="mint" label="공실률" value={vacancy > 0 ? Number(vacancy).toFixed(1) : '-'} unit={vacancy > 0 ? '%' : ''} delta={vacavgDelta !== 0 ? `${vacavgDelta >= 0 ? '+' : ''}${vacavgDelta}` : undefined} deltaPositive={vacavgDelta <= 0} deltaPrefixDisabled hero accent/>
        <StatTile tone="blue" label="평균 대비" value={vacavgDelta !== 0 ? `${vacavgDelta > 0 ? '+' : ''}${vacavgDelta}` : '-'} unit={vacavgDelta !== 0 ? '%p' : ''}/>
        <StatTile tone="lilac" label="1년 신규" value={String(newOpen)} unit="개"/>
        <StatTile tone="cream" label="1년 폐업" value={String(closed)} unit="개"/>
      </div>

      <div style={{display:"grid", gridTemplateColumns:"1fr 1.4fr", gap:16, alignItems:"stretch"}}>
        <div className="bc-box" style={{padding:24, display:"flex", flexDirection:"column"}}>
          <div style={{display:"flex", justifyContent:"space-between", alignItems:"baseline", marginBottom:16}}>
            <span style={{fontSize:16, fontWeight:600}}>최근 1년 공실률 추이</span>
            <span style={{fontSize:13, color:"var(--matte-fg-3)"}}>{vacValues.length > 0 ? `${vacValues.length}분기` : ''}</span>
          </div>
          <div style={{flex:1, display:"flex", alignItems:"center", minHeight:200}}>
            {lineData.length >= 2 ? (
              <LineChart id="c9.line" width={460} height={260} data={lineData} color="#4C7BE4"/>
            ) : (
              <div style={{width:"100%", textAlign:"center", color:"var(--matte-fg-4)", fontSize:13}}>공실률 추이 데이터 수집 중</div>
            )}
          </div>
          <div style={{marginTop:20, paddingTop:18, borderTop:"1px solid var(--matte-line)", display:"grid", gridTemplateColumns:"1fr 1fr 1fr", gap:14}}>
            {[
              ["최저", vacMin > 0 ? Number(vacMin).toFixed(1) : '-', "%"],
              ["최고", vacMax > 0 ? Number(vacMax).toFixed(1) : '-', "%"],
              ["변동폭", vacRange > 0 ? Number(vacRange).toFixed(1) : '-', "%p"],
            ].map(([l, v, u]) => (
              <div key={l}>
                <div style={{fontSize:13, color:"var(--matte-fg-3)", marginBottom:6, fontWeight:500}}>{l}</div>
                <div style={{fontSize:22, fontWeight:700, fontVariantNumeric:"tabular-nums", letterSpacing:"-0.01em"}}>{v}{v !== '-' && <span style={{fontSize:13, color:"var(--matte-fg-3)", marginLeft:2, fontWeight:500}}>{u}</span>}</div>
              </div>
            ))}
          </div>
        </div>

        <div className="bc-box" style={{padding:24}}>
          <div style={{fontSize:16, fontWeight:600, marginBottom:18}}>핵심 발견</div>
          <window.DrStagger id="c9.list" delay={120} style={{display:"flex", flexDirection:"column", gap:14}}>
          {(() => {
            const cafeAvgRatio = (cafeMonthly > 0 && guAvg > 0) ? (cafeMonthly / guAvg) : 0;
            return [
              ["시장 매력도",
                cafeMonthly > 0 && guAvg > 0
                  ? `월매출 ${cafeMonthly.toLocaleString()}만 — ${sigungu || '시군구'} 평균 ${cafeAvgRatio > 1 ? '+' : ''}${Math.round((cafeAvgRatio - 1) * 100)}%`
                  : (cafeMonthly > 0 ? `월매출 ${cafeMonthly.toLocaleString()}만` : '매출 데이터 수집 중'),
                cafeAvgRatio > 1 ? Math.min(0.95, cafeAvgRatio - 0.5) : 0.5,
                cafeAvgRatio > 1.1],
              ["경쟁 환경",
                individualPct > 0 ? `개인 카페 ${individualPct}% — 차별화 여지` : '경쟁 데이터 수집 중',
                individualPct / 100, false],
              ["시장 변화",
                (newOpen > 0 || closed > 0) ? `신규 ${newOpen} / 폐업 ${closed} — ${newOpen >= closed ? '자연 회전 정상권' : '구조조정 진행'}` : '변화 데이터 수집 중',
                newOpen + closed > 0 ? Math.min(0.9, newOpen / Math.max(1, newOpen + closed) + 0.2) : 0.5,
                false],
              ["생존 기반",
                survival3y > 0 ? `3년 생존율 ${survival3y}% — ${survival3y >= 60 ? '상위' : survival3y >= 40 ? '평균' : '주의'}` : '생존율 데이터 수집 중',
                survival3y / 100,
                survival3y >= 60],
              ["비용 부담",
                vacancy > 0 ? `공실률 ${Number(vacancy).toFixed(1)}% — ${vacancy < 5 ? '안정' : vacancy < 8 ? '보통' : '주의'}` : '공실률 데이터 수집 중',
                vacancy > 0 ? Math.max(0.1, 1 - vacancy / 12) : 0.5,
                false],
            ];
          })().map(([axis, t, ratio, acc], i) => (
            <div key={i} style={{padding:"16px 18px", background:"rgba(255,255,255,0.03)", borderRadius:10, border:"1px solid var(--matte-line)"}}>
              <div style={{display:"flex", justifyContent:"space-between", alignItems:"baseline", marginBottom:8}}>
                <span style={{fontSize:15, fontWeight:700, color: acc ? "#4C7BE4" : "var(--matte-fg)"}}>{axis}</span>
                <span style={{fontSize:13, color: ratio >= 0.6 ? "var(--matte-fg-2)" : "var(--matte-fg-3)", fontWeight:600, fontVariantNumeric:"tabular-nums"}}>{ratio >= 0.7 ? "강점" : ratio >= 0.4 ? "보통" : "주의"}</span>
              </div>
              <div style={{fontSize:14, color:"var(--matte-fg-2)", marginBottom:10, lineHeight:1.5}}>{t}</div>
              <div className="bc-bar" style={{height:8, background:"rgba(255,255,255,0.04)"}}>
                <div style={{width:`${ratio*100}%`, background: acc ? "#4C7BE4" : "#FFFFFF", height:"100%", borderRadius:"inherit"}}></div>
              </div>
            </div>
          ))}
          </window.DrStagger>
        </div>
      </div>
    </CardShell>
  );
}

/* ============================================================
   Card 10 — 배달 객단가
   ============================================================ */
function Card10({ body = {} }) {
  const bd = body.bodyData || {};
  const searchAvgPrice = Number(bd.searchAvgPrice) || 0;
  const searchSales = Number(bd.searchSales) || 0;
  const searchOrders = Number(bd.searchOrders) || 0;
  const cafeRank = Number(bd.cafeRankInDelivery) || 0;
  const totalBiz = Number(bd.totalDeliveryBiz) || 0;
  const cafeDelivery = Number(bd.cafeDeliveryAmount) || 0;
  const monthlyTrendArr = Array.isArray(bd.monthlyTrend) ? bd.monthlyTrend.slice(-12) : [];
  const monthlyValues = monthlyTrendArr.map(m => Number(m.value) || 0).filter(v => v > 0);
  const lineDataM = monthlyValues.length >= 2 ? monthlyValues : [];
  const yoyPct = monthlyValues.length >= 2 && monthlyValues[0] > 0
    ? Math.round(((monthlyValues[monthlyValues.length - 1] - monthlyValues[0]) / monthlyValues[0]) * 100)
    : 0;
  const weekdaySales = Array.isArray(bd.weekdaySales) ? bd.weekdaySales : [];
  const dayItemsM = weekdaySales.length > 0
    ? weekdaySales.map(d => ({ l: d.day, v: Number(d.amount) || 0, t: String(Math.round(Number(d.amount) || 0)) }))
    : [];
  const dayTopIdxM = dayItemsM.length > 0 ? dayItemsM.reduce((m, x, i, arr) => x.v > arr[m].v ? i : m, 0) : 0;
  const kd = bd.kosisDelivery || null;
  const kdActiveRatio = kd ? Math.round(Number(kd.overallUsePct) || 0) : null;
  const kdInactiveRatio = kdActiveRatio != null ? 100 - kdActiveRatio : null;
  const kdMonthlyCost = (() => {
    if (!kd) return [];
    const items = [];
    const appAvg = Number(kd.app?.avgManwon) || 0;
    const agencyAvg = Number(kd.agency?.avgManwon) || 0;
    if (appAvg > 0) items.push(["배민/쿠팡이츠", `${appAvg.toLocaleString()}만원`, "#FFFFFF"]);
    if (agencyAvg > 0) items.push(["바로고/부릉", `${agencyAvg.toLocaleString()}만원`, "#7a7a7a"]);
    if (appAvg > 0 && agencyAvg > 0) items.push(["둘 다 운영", `${(appAvg + agencyAvg).toLocaleString()}만원`, "#4C7BE4"]);
    return items;
  })();
  return (
    <CardShell n="10" id="10"
      title="배달 객단가"
      sub="이 동네 배달 객단가">
      <div className="bc-grid-4" style={{gap:16, marginBottom:16}}>
        <StatTile id="c10.tile1" tone="blue"  label="동 객단가 (배달)" value={searchAvgPrice > 0 ? searchAvgPrice.toLocaleString() : '-'} unit={searchAvgPrice > 0 ? '원' : ''} delta={yoyPct ? String(Math.abs(yoyPct)) : undefined} deltaPositive={yoyPct >= 0} hero/>
        <StatTile id="c10.tile2" tone="mint"  label="월 배달 매출"   value={searchSales > 0 ? searchSales.toLocaleString() : '-'} unit={searchSales > 0 ? '만' : ''}/>
        <StatTile id="c10.tile3" tone="lilac" label="월 배달 건수"   value={searchOrders > 0 ? searchOrders.toLocaleString() : '-'} unit={searchOrders > 0 ? '건' : ''} delta={yoyPct ? String(Math.abs(yoyPct)) : undefined} deltaPositive={yoyPct >= 0}/>
        <StatTile id="c10.tile4" tone="cream" label="업종 순위"      value={cafeRank > 0 ? String(cafeRank) : '-'} unit={cafeRank > 0 ? '위' : ''} sub={totalBiz > 0 ? `/ ${totalBiz}개 업종` : undefined}/>
      </div>

      <div style={{display:"grid", gridTemplateColumns:"1.4fr 1fr", gap:16, alignItems:"stretch"}}>
        <div className="bc-box" style={{padding:18, display:"flex", flexDirection:"column"}}>
          <div style={{display:"flex", justifyContent:"space-between", marginBottom:12}}>
            <div style={{fontSize:15, fontWeight:600}}>월별 배달 주문건수 ({lineDataM.length}개월)</div>
            {yoyPct !== 0 && <span style={{fontSize:15, color: yoyPct >= 0 ? "#4C7BE4" : "var(--st-bad)", fontWeight:700}}>{yoyPct > 0 ? '+' : ''}{yoyPct}% (추세)</span>}
          </div>
          <div style={{flex:1, display:"flex", alignItems:"center", minHeight:180}}>
            {lineDataM.length >= 2 ? (
              <LineChart id="c10.line" width={520} height={240} data={lineDataM} color="#4C7BE4"/>
            ) : (
              <div style={{width:"100%", textAlign:"center", color:"var(--matte-fg-4)", fontSize:13}}>월별 추이 데이터 수집 중</div>
            )}
          </div>
          <div style={{marginTop:18, paddingTop:14, borderTop:"1px solid var(--line)"}}>
            <div style={{fontSize:15, fontWeight:600, marginBottom:12}}>요일별 배달 주문</div>
            {dayItemsM.length > 0 ? (
              <VBars id="c10.days" accent={dayTopIdxM} height={80} barW={24} items={dayItemsM}/>
            ) : (
              <div style={{fontSize:13, color:"var(--matte-fg-4)"}}>요일 데이터 수집 중</div>
            )}
          </div>
        </div>

        <div>
          <div className="bc-box" style={{padding:24, marginBottom:14}}>
            <div style={{fontSize:18, fontWeight:700, marginBottom:18}}>운영 옵션별 월 비용</div>
            {kdMonthlyCost.length > 0 ? (
              <div style={{display:"flex", flexDirection:"column"}}>
              {kdMonthlyCost.map(([l, v, c], i) => (
                <div key={i} style={{display:"flex", justifyContent:"space-between", alignItems:"center", padding:"16px 0", borderBottom: i < kdMonthlyCost.length - 1 ? "1px solid var(--matte-line)" : "none"}}>
                  <div style={{display:"flex", alignItems:"center", gap:12}}>
                    <span style={{width:12, height:12, borderRadius:9999, background:c, flexShrink:0}}></span>
                    <span style={{fontSize:16, fontWeight: i===kdMonthlyCost.length-1 ? 700 : 600, color: i===kdMonthlyCost.length-1 ? "#4C7BE4" : "var(--matte-fg)", letterSpacing:"-0.005em"}}>{l}</span>
                  </div>
                  <span style={{fontSize:20, fontWeight:700, fontVariantNumeric:"tabular-nums", color: i===kdMonthlyCost.length-1 ? "#4C7BE4" : "var(--matte-fg)", letterSpacing:"-0.01em"}}>{v}</span>
                </div>
              ))}
              </div>
            ) : (
              <div style={{fontSize:13, color:"var(--matte-fg-4)", padding:"20px 0"}}>운영 비용 데이터 수집 중</div>
            )}
          </div>

          <div className="bc-box" style={{padding:18}}>
            <div style={{fontSize:15, fontWeight:600, marginBottom:10}}>전국 카페 배달 운영</div>
            {kdActiveRatio != null ? (
              <div style={{display:"flex", alignItems:"center", gap:16}}>
                <Donut id="c10.donut" size={180} thickness={20} segments={[
                  {value:kdActiveRatio, color:"#4C7BE4", label:"운영"},
                  {value:kdInactiveRatio, color:"#FFFFFF", label:"미운영"},
                ]} centerLabel={`${kdActiveRatio}%`} centerSub="배달 운영"/>
                <DonutLegend segments={[
                  {value:kdActiveRatio, color:"#4C7BE4", label:"운영", text:`${kdActiveRatio}%`},
                  {value:kdInactiveRatio, color:"#FFFFFF", label:"미운영", text:`${kdInactiveRatio}%`},
                ]}/>
              </div>
            ) : (
              <div style={{fontSize:13, color:"var(--matte-fg-4)", padding:"30px 0", textAlign:"center"}}>배달 운영 비중 수집 중</div>
            )}
          </div>
        </div>
      </div>
    </CardShell>
  );
}

/* ============================================================
   Card 11 — SNS 트렌드
   ============================================================ */
function Card11({ body = {} }) {
  const bd = body.bodyData || {};
  const cd = body.chartData || {};
  const positivePct = Number(bd.positiveRatio) || Number(cd.sentimentPos) || 0;
  const negativePct = Number(bd.negativeRatio) || (positivePct > 0 ? 100 - positivePct : 0);
  const blogMentions = Number(bd.blogMentions) || 0;
  const kwArr = Array.isArray(bd.keywords) && bd.keywords.length > 0
    ? bd.keywords.slice(0, 12).map((k, i) => [k, Math.max(11, 28 - i * 1.5)])
    : [];
  const intents = Array.isArray(bd.searchIntents) && bd.searchIntents.length > 0 ? bd.searchIntents.slice(0, 7) : [];
  const negKw = Array.isArray(bd.negativeKeywords) && bd.negativeKeywords.length > 0 ? bd.negativeKeywords.slice(0, 5) : [];
  const topShops = Array.isArray(bd.topShops) && bd.topShops.length > 0
    ? bd.topShops.slice(0, 5).map(s => [s.name, s.menu || '시그니처', s.reason || ''])
    : [];
  return (
    <CardShell n="11" id="11"
      title="SNS 트렌드"
      sub="소셜미디어 카페 분위기 분석">
      <div className="bc-grid-4" style={{gap:16, marginBottom:16}}>
        <StatTile id="c11.tile1" tone="mint"  label="긍정 비율"      value={positivePct > 0 ? String(positivePct) : '-'} unit={positivePct > 0 ? '%' : ''} hero/>
        <StatTile id="c11.tile2" tone="rose"  label="부정 비율"      value={negativePct > 0 ? String(negativePct) : '-'} unit={negativePct > 0 ? '%' : ''} deltaPositive={false}/>
        <StatTile id="c11.tile3" tone="blue"  label="총 키워드"     value={String(kwArr.length)}/>
        <StatTile id="c11.tile4" tone="cream" label="블로그 언급"   value={blogMentions > 0 ? blogMentions.toLocaleString() : '-'} unit={blogMentions > 0 ? '건' : ''}/>
      </div>

      <div style={{display:"grid", gridTemplateColumns:"1.3fr 1fr", gap:16, alignItems:"stretch"}}>
        <div className="bc-box" style={{padding:18, display:"flex", flexDirection:"column"}}>
          <div style={{fontSize:15, fontWeight:600, marginBottom:12}}>SNS 키워드 클라우드</div>
          {kwArr.length > 0 ? (
            <window.DrStagger id="c11.cloud" delay={60} style={{display:"flex", flexWrap:"wrap", gap:10, alignItems:"baseline", padding:"8px 0"}}>
              {kwArr.map(([k, s], i) => (
                <span key={i} style={{fontSize:s, color: s>=20 ? "#FFFFFF" : s>=14 ? "#C9C9C9" : "#A3A3A3", fontWeight: s>18 ? 700 : 600, lineHeight:1.1}}>#{k}</span>
              ))}
            </window.DrStagger>
          ) : (
            <div style={{fontSize:13, color:"var(--matte-fg-4)", padding:"30px 0"}}>SNS 키워드 데이터 수집 중</div>
          )}

          <div style={{marginTop:14, paddingTop:14, borderTop:"1px solid var(--line)"}}>
            <div style={{fontSize:15, color:"var(--fg-3)", marginBottom:8, fontWeight:600}}>검색 유입 경로</div>
            {intents.length > 0 ? (
              <div style={{display:"flex", flexWrap:"wrap", gap:6, marginBottom:14}}>
                {intents.map(k => <span key={k} className="bc-pill">{k}</span>)}
              </div>
            ) : (
              <div style={{fontSize:13, color:"var(--matte-fg-4)", marginBottom:14}}>검색 유입 데이터 수집 중</div>
            )}
            <div style={{fontSize:15, color:"var(--fg-3)", marginBottom:8, fontWeight:600}}>주의 키워드</div>
            {negKw.length > 0 ? (
              <div style={{display:"flex", gap:6, flexWrap:"wrap"}}>
                {negKw.map(k => <span key={k} className="bc-pill">{k}</span>)}
              </div>
            ) : (
              <div style={{fontSize:13, color:"var(--matte-fg-4)"}}>부정 키워드 없음</div>
            )}
          </div>
        </div>

        <div className="bc-box" style={{padding:24}}>
          <div style={{fontSize:18, fontWeight:700, marginBottom:20}}>후기 좋은 매장 TOP {Math.min(5, topShops.length)}</div>
          {topShops.length > 0 ? (
            <window.DrStagger id="c11.top5" delay={100} style={{display:"flex", flexDirection:"column", gap:8}}>
            {topShops.map(([n, m, d], i) => {
              const isAcc = i === 0;
              return (
                <div key={i} style={{
                  padding:"14px 18px",
                  background: isAcc ? "rgba(76, 123, 228,0.10)" : "rgba(255,255,255,0.03)",
                  border: isAcc ? "1px solid rgba(76, 123, 228,0.45)" : "1px solid var(--matte-line)",
                  borderRadius:10,
                }}>
                  <div style={{display:"flex", alignItems:"baseline", justifyContent:"space-between", gap:12, marginBottom:6}}>
                    <div style={{display:"flex", alignItems:"baseline", gap:10, minWidth:0}}>
                      <span style={{fontSize:13, color:"var(--matte-fg-4)", fontVariantNumeric:"tabular-nums", fontWeight:700, flexShrink:0}}>{String(i+1).padStart(2,"0")}</span>
                      <span style={{fontSize:17, fontWeight:700, letterSpacing:"-0.01em", color: isAcc ? "#4C7BE4" : "var(--matte-fg)", overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap"}}>{n}</span>
                    </div>
                    <span style={{fontSize:14, color: isAcc ? "#4C7BE4" : "var(--matte-fg-2)", fontWeight:700, flexShrink:0}}>{m}</span>
                  </div>
                  {d && <div style={{fontSize:13, color:"var(--matte-fg-3)", paddingLeft:30}}>{d}</div>}
                </div>
              );
            })}
            </window.DrStagger>
          ) : (
            <div style={{fontSize:13, color:"var(--matte-fg-4)", padding:"30px 0"}}>후기 좋은 매장 데이터 수집 중</div>
          )}
        </div>
      </div>
    </CardShell>
  );
}

/* ============================================================
   Card 12 — 날씨 영향 분석
   ============================================================ */
function Card12({ body = {} }) {
  const bd = body.bodyData || {};
  const cd = body.chartData || {};
  const yd = bd.yearlyDistribution || null;
  const getDaysFor = (label) => {
    const it = (cd.items || []).find(i => i.label === label);
    return Number(it?.value) || 0;
  };
  const sunnyDays = getDaysFor('맑음');
  const cloudyDays = getDaysFor('흐림');
  const rainDays = getDaysFor('비');
  const snowDays = getDaysFor('눈');
  const months = ['1월','2월','3월','4월','5월','6월','7월','8월','9월','10월','11월','12월'];
  const monthlyCal = Array.isArray(bd.monthlyCalendar) && bd.monthlyCalendar.length === 12 ? bd.monthlyCalendar : null;
  const days = monthlyCal ? monthlyCal.map(m => (m.rainDays || 0) + (m.snowDays || 0)) : new Array(12).fill(0);
  const temps = monthlyCal ? monthlyCal.map(m => Number(m.avgTemp) || 0) : new Array(12).fill(0);
  const avgTempYr = yd?.avgTemp != null ? Number(yd.avgTemp).toFixed(1) : null;
  const summerMax = yd?.summerMax != null ? Number(yd.summerMax).toFixed(1) : null;
  const winterMin = yd?.winterMin != null ? Number(yd.winterMin).toFixed(1) : null;
  const parsePct = (s) => {
    if (!s) return null;
    const m = String(s).match(/([+-]?\d+(?:\.\d+)?)/);
    return m ? parseFloat(m[1]) : null;
  };
  const sunnyEffect = parsePct(bd.sunnyEffect);
  const cloudyEffect = parsePct(bd.cloudyEffect);
  const rainyEffect = parsePct(bd.rainyEffect);
  const snowEffect = parsePct(bd.snowEffect);
  const summary = bd.weatherSummary || null;

  return (
    <CardShell n="12" id="12"
      title="날씨 영향 분석"
      sub="연간 기상 분포와 매출 영향">
      <div className="bc-grid-4" style={{gap:16, marginBottom:16}}>
        <StatTile id="c12.tile1" tone="cream" label="맑음" value={sunnyDays > 0 ? String(sunnyDays) : '-'} unit={sunnyDays > 0 ? '일/년' : ''} hero/>
        <StatTile id="c12.tile2" tone="lilac" label="흐림" value={cloudyDays > 0 ? String(cloudyDays) : '-'} unit={cloudyDays > 0 ? '일/년' : ''}/>
        <StatTile id="c12.tile3" tone="blue"  label="비"   value={rainDays > 0 ? String(rainDays) : '-'} unit={rainDays > 0 ? '일/년' : ''}/>
        <StatTile id="c12.tile4" tone="mint"  label="눈"   value={snowDays > 0 ? String(snowDays) : '-'} unit={snowDays > 0 ? '일/년' : ''}/>
      </div>

      <div style={{display:"grid", gridTemplateColumns:"1.4fr 1fr", gap:16, alignItems:"stretch"}}>
        <div className="bc-box" style={{padding:24}}>
          <div style={{display:"flex", justifyContent:"space-between", alignItems:"baseline", marginBottom:18}}>
            <span style={{fontSize:16, fontWeight:600}}>월별 비/눈 일수 + 평균 기온</span>
            <span style={{fontSize:13, color:"var(--matte-fg-3)"}}>연평균 <strong style={{color:"var(--matte-fg)", fontWeight:700, fontSize:15, marginLeft:4}}>{avgTempYr}°C</strong></span>
          </div>
          <window.DrStagger id="c12.cal" delay={50} style={{display:"grid", gridTemplateColumns:"repeat(12, 1fr)", gap:6, alignItems:"flex-end", height:220}}>
            {months.map((m, i) => {
              const tH = ((temps[i] + 5) / 35) * 180;
              const isHotMax = temps[i] === Math.max(...temps);
              const color = isHotMax ? "#4C7BE4" : "#FFFFFF";
              return (
                <div key={m} style={{display:"flex", flexDirection:"column", alignItems:"center", gap:6, height:"100%", justifyContent:"flex-end"}}>
                  <div style={{fontSize:13, fontWeight:600, color: isHotMax ? "#4C7BE4" : "var(--matte-fg-2)", fontVariantNumeric:"tabular-nums"}}>{days[i]}</div>
                  <div style={{width:"100%", height: tH, background: color, borderRadius:"4px 4px 0 0", opacity: isHotMax ? 1 : 0.85}}></div>
                </div>
              );
            })}
          </window.DrStagger>
          <div style={{display:"grid", gridTemplateColumns:"repeat(12, 1fr)", gap:6, marginTop:10}}>
            {months.map(m => <div key={m} style={{fontSize:13, textAlign:"center", color:"var(--matte-fg-3)"}}>{m}</div>)}
          </div>

          {/* 계절별 매출 변동 (sunny/rainy/snow Effect 기반 추정) */}
          {(sunnyEffect != null || rainyEffect != null || snowEffect != null) && (
            <div style={{marginTop:24, paddingTop:20, borderTop:"1px solid var(--matte-line)"}}>
              <div style={{fontSize:14, color:"var(--matte-fg-3)", fontWeight:500, marginBottom:14}}>계절별 매출 변동</div>
              <div style={{display:"grid", gridTemplateColumns:"repeat(4, 1fr)", gap:10}}>
                {[
                  ["봄 (3~5월)", sunnyEffect != null ? Math.round(sunnyEffect * 0.5) : null, '안정'],
                  ["여름 (6~8월)", rainyEffect, rainyEffect > 0 ? '성수기' : '비수기'],
                  ["가을 (9~11월)", sunnyEffect != null ? Math.round(sunnyEffect * 0.4) : null, '안정'],
                  ["겨울 (12~2월)", snowEffect, '비수기'],
                ].map(([k, v, t]) => {
                  if (v == null) return null;
                  const vStr = `${v > 0 ? '+' : ''}${v}`;
                  const accent = v === Math.max(sunnyEffect != null ? Math.round(sunnyEffect * 0.5) : -999, rainyEffect != null ? rainyEffect : -999, sunnyEffect != null ? Math.round(sunnyEffect * 0.4) : -999, snowEffect != null ? snowEffect : -999) && v > 0;
                  return (
                    <div key={k} style={{padding:"16px 16px", background:"rgba(255,255,255,0.03)", borderRadius:10, border:"1px solid var(--matte-line)"}}>
                      <div style={{fontSize:13, color:"var(--matte-fg-3)", marginBottom:8, fontWeight:500}}>{k}</div>
                      <div style={{fontSize:24, fontWeight:700, fontVariantNumeric:"tabular-nums", color: accent ? "#4C7BE4" : "var(--matte-fg)", letterSpacing:"-0.01em"}}>{vStr}<span style={{fontSize:13, color:"var(--matte-fg-3)", marginLeft:2, fontWeight:500}}>%</span></div>
                      <div style={{fontSize:13, color:"var(--matte-fg-3)", marginTop:6}}>{t}</div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          <div style={{fontSize:13, color:"var(--matte-fg-4)", marginTop:14}}>막대 높이 = 평균 기온 · 상단 숫자 = 비/눈 일수</div>
        </div>

        <div style={{display:"flex", flexDirection:"column", gap:12}}>
          <div className="bc-box" style={{padding:22, flex:1, display:"flex", flexDirection:"column"}}>
            <div style={{fontSize:16, fontWeight:600, marginBottom:16}}>날씨별 매출 영향</div>
            {(sunnyEffect != null || cloudyEffect != null || rainyEffect != null || snowEffect != null) ? (
              <div style={{display:"flex", flexDirection:"column", gap:12, flex:1, justifyContent:"center"}}>
                {[
                  ['맑음', sunnyEffect],
                  ['흐림', cloudyEffect],
                  ['비', rainyEffect],
                  ['눈', snowEffect],
                ].filter(([, v]) => v != null).map(([k, v]) => {
                  const acc = v > 0;
                  const barW = Math.min(100, Math.abs(v) * 3);
                  return (
                    <div key={k} style={{display:"grid", gridTemplateColumns:"60px 1fr 80px", gap:12, alignItems:"center"}}>
                      <span style={{fontSize:15, color:"var(--matte-fg-2)", fontWeight:500}}>{k}</span>
                      <div className="bc-bar" style={{height:12, background:"rgba(255,255,255,0.05)"}}>
                        <div style={{width:`${barW}%`, background: acc ? "#4C7BE4" : "#FFFFFF", height:"100%", borderRadius:"inherit"}}></div>
                      </div>
                      <span style={{textAlign:"right", fontSize:14, fontWeight:700, color: acc ? "#4C7BE4" : "var(--matte-fg)", fontVariantNumeric:"tabular-nums"}}>{v > 0 ? '+' : ''}{v}%</span>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div style={{fontSize:13, color:"var(--matte-fg-4)", padding:"20px 0", textAlign:"center"}}>날씨 영향 데이터 수집 중</div>
            )}
          </div>

          {summary && (
            <div className="bc-box" style={{padding:20}}>
              <div style={{fontSize:14, color:"var(--matte-fg-3)", fontWeight:500, marginBottom:10}}>운영 인사이트</div>
              <div style={{fontSize:15, lineHeight:1.65, color:"var(--matte-fg-2)"}}>{summary}</div>
            </div>
          )}

          <div className="bc-grid-2" style={{gap:10}}>
            <Box label="연평균 기온" value={avgTempYr != null ? avgTempYr : '-'} unit={avgTempYr != null ? '°C' : ''}/>
            <Box label="여름 최고"  value={summerMax != null ? summerMax : '-'} unit={summerMax != null ? '°C' : ''}/>
            <Box label="겨울 최저"  value={winterMin != null ? winterMin : '-'} unit={winterMin != null ? '°C' : ''}/>
            <Box label="강수일/연"  value={rainDays > 0 ? String(rainDays) : '-'} unit={rainDays > 0 ? '일' : ''} sub={yd?.relativePosition || ''}/>
          </div>
        </div>
      </div>
    </CardShell>
  );
}

Object.assign(window, { Card08, Card09, Card10, Card11, Card12 });
