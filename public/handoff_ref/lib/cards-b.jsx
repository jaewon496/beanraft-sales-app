/* cards-b.jsx — Cards 08-12 */

/* ============================================================
   Card 08 — 임대/창업 (simulator + KOSIS 4박스)
   ============================================================ */
function Card08({ body = {} }) {
  const bd = body.bodyData || {};
  const cd = body.chartData || {};
  const kosis = body.kosisBoxData || {};
  // [2026-06-26] 추정 배지 약속 — bodyData._estimated 에 추정/폴백 값 필드명. 그 값에만 회색 '추정' 배지.
  const _estSet = (window.bcEstSet ? window.bcEstSet(bd) : new Set());
  const _isEst = (...keys) => (window.bcIsEst ? window.bcIsEst(_estSet, ...keys) : false);
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
  // [2026-06-29 사장님 확정] 총 창업비 합계 표기 폐기 → totalStartupCost(미사용) 제거.
  const marketRent = kosis?.marketRent?.value ? Math.round(kosis.marketRent.value / 10000) : 0;
  const conversionRate = Number(kosis?.conversionRate?.value) || 0;
  const yieldRate = Number(kosis?.yieldRate?.value) || 0;
  const netIncome = Number(kosis?.netIncome?.value) || 0;
  const netIncomePct = Number(kosis?.netIncome?.noiPct) || 0;
  const netIncomeUnit = kosis?.netIncome?.unit || '원/평/년';
  const kosisPeriod = kosis?.marketRent?.period || kosis?.yieldRate?.period || '';
  const kosisRegion = kosis?.marketRent?.region || '';
  const kc = cd.kosisCafe || null;
  // [2026-06-29 예언 제거] 평수 슬라이더 폐기 → 슬라이더로 평수를 곱해 '내 카페 월임대료/보증금/총창업비'를
  //   단정하던 예측 UI를 제거. 대신 15평 기준 단일 참고값 + 창업비 가이드(단계/범위)로 보여준다.
  const REF_PY = 15; // 창업비 가이드 기준 평수(고정 참고값)
  const depositPerPy = depositManwon > 0 ? depositManwon / 15 : 0;
  const deposit = depositPerPy > 0 ? REF_PY * depositPerPy : 0;   // 15평 기준 보증금(참고)
  const interiorPerPy = kc?.interiorPerPyeong > 0 ? kc.interiorPerPyeong : 0;
  const interior = interiorPerPy > 0 ? REF_PY * interiorPerPy : 0; // 15평 평균시공 인테리어(참고)
  // [2026-06-29 사장님 확정] 시설·장비 3단계(만원) — 단일 숫자 예언 대신 단계/범위로.
  //   저가형(바·커피+간단 쿠키) 약 1,000만 / 평균(베이커리 여유) 약 2,000만 / 고급(빵집 수준) 2,500~3,000만.
  const FACILITY_TIERS = [
    { key: 'low',  label: '저가형', desc: '바·커피 + 간단 쿠키', min: 1000, max: 1000 },
    { key: 'avg',  label: '평균',   desc: '베이커리 여유',       min: 2000, max: 2000 },
    { key: 'high', label: '고급',   desc: '빵집 수준',           min: 2500, max: 3000 },
  ];
  // [2026-06-29 사장님 확정] '총 창업비 합계'(roiTotalStartupMin/Max 범위) 표기 폐기 — 합계가 동네별로 안 변해 무의미.
  //   → totalBase/totalMin/totalMax 합산 변수 제거. 항목별 참고(인테리어·권리금·시설장비 단계)만 남긴다.
  const _roiInterior = Number(bd.roiInteriorCost) || 0;  // ROI 엔진 인테리어(만원) — 가이드 표시도 같은 값 사용
  const _roiPremium = Number(bd.roiPremiumCost) || 0;    // ROI 엔진 권리금(만원)
  // 가이드 내 인테리어·권리금 항목은 단일 출처(ROI 엔진)를 우선 표시.
  const interiorShown = _roiInterior > 0 ? _roiInterior : interior;
  const premiumShown = _roiPremium > 0 ? _roiPremium : premiumManwon;
  // 보증금 안내: 월세(15평 기준) 기반 — 통상 월세의 약 10배가 보증금 관행.
  const rentMonthly15 = rentPerPyeong > 0 ? Math.round(rentPerPyeong * REF_PY) : 0;
  const depositGuide = rentMonthly15 > 0 ? rentMonthly15 * 10 : 0; // 월세의 약 10배(안내)
  // [2026-06-29 사장님 확정] 총 창업비 '합계'는 동네별로 안 변해(권리금=광역평균·인테리어=전국단가·시설장비=컨셉) 무의미 → 합계 표기 폐기.
  //   대신 KPI 자리는 '평균 대비 위/아래' 정성 가이드로 채운다.
  //   [2026-06-29 버그수정] 비교 기준 = 그 지역 시도(서울/부산 등) 평당월세 평균(kosis.sidoRentAvg, 한국부동산원).
  //     ★전국 카페 평균(kc.rentPerPyeong=8.8만/평) 폴백 제거 — prime 상권(강남 41)과 비교하면 +366% 과장이 남.
  //     시도 기준 못 구하면 '-'(비교 기준 없음)로 정직 표기(가짜 baseline 금지).
  //     비교값 = 통합 평당월세(rentPerPyeong, 옆 타일과 동일) ÷ 시도 평균. 임계 ±15%.
  //     출처(기관명)는 화면에 절대 표기하지 않음(라벨은 "서울 평균 대비"처럼 지역명만).
  const _sidoRent = kosis?.sidoRentAvg || null;
  let _avgRentPerPy = 0, _avgBaseLabel = '';
  if (_sidoRent && Number(_sidoRent.value) > 0) {
    _avgRentPerPy = Number(_sidoRent.value);
    _avgBaseLabel = _sidoRent.region ? `${_sidoRent.region} 평균` : '시도 평균';
  }
  const _rentVsAvgPct = (_avgRentPerPy > 0 && rentPerPyeong > 0)
    ? Math.round(((rentPerPyeong - _avgRentPerPy) / _avgRentPerPy) * 100)
    : null;
  const _rentVsAvgText = (_rentVsAvgPct == null)
    ? '-'
    : (_rentVsAvgPct >= 15 ? '비쌈' : _rentVsAvgPct <= -15 ? '저렴' : '평균');
  const _rentVsAvgSub = (_rentVsAvgPct == null)
    ? '비교 기준 없음'
    : `${_avgBaseLabel} ${_rentVsAvgPct >= 0 ? '+' : ''}${_rentVsAvgPct}%`;
  return (
    <CardShell n="08" id="08"
      bruSummary={body.bruSummary}
      title="임대/창업 정보"
      sub="상가 시세 및 창업 비용">
      <div className="bc-grid-4" style={{gap:16, marginBottom:16}}>
        <StatTile id="c8.tile1" tone="blue"  label="통합 평당 월세" value={rentPerPyeong > 0 ? String(rentPerPyeong) : '-'} unit={rentPerPyeong > 0 ? '만원' : ''} hero/>
        <StatTile id="c8.tile2" tone="lilac" label="평균 보증금"   value={depositPerPy > 0 ? Math.round(depositPerPy).toLocaleString() : '-'} unit={depositPerPy > 0 ? '만/평' : ''}/>
        <StatTile id="c8.tile3" tone="mint"  label="평당 월세 (평균 대비)" value={_rentVsAvgText} sub={_rentVsAvgSub}/>
        <StatTile id="c8.tile4" tone="rose"  label="권리금"  value={premiumShown > 0 ? (premiumShown >= 10000 ? (premiumShown / 10000).toFixed(1) : Math.round(premiumShown).toLocaleString()) : '-'} unit={premiumShown > 0 ? (premiumShown >= 10000 ? '억' : '만원') : ''}/>
      </div>

      <div style={{display:"grid", gridTemplateColumns:"1fr 1fr", gap:16}}>
        {/* [2026-07-02] 4종 값이 전부 없으면 제목만 남은 빈 박스 → 박스 자체를 렌더하지 않음 */}
        {(marketRent > 0 || conversionRate > 0 || yieldRate > 0 || (netIncomeUnit === '%' && netIncomePct > 0) || netIncome > 0) && (
        <div className="bc-box" style={{padding:18}}>
          <div style={{fontSize:15, fontWeight:600, marginBottom:12}}>임대 시세 4종</div>
          <div className="bc-grid-2" style={{gap:10}}>
            {/* [2026-07-02] "-" 금지 → 값 없는 박스는 자체 숨김 (전국 카페 평균 박스와 동일 패턴) */}
            {marketRent > 0 && <Box label="평당 월세" value={String(marketRent)} unit="만원" sub={kosisRegion || ''} src={kosisPeriod}/>}
            {conversionRate > 0 && <Box label="전환율" value={window.bcFmtPct ? window.bcFmtPct(conversionRate) : Number(conversionRate).toFixed(1)} unit="%" src={kosisPeriod}/>}
            {yieldRate > 0 && <Box label="수익률" value={window.bcFmtPct ? window.bcFmtPct(yieldRate) : Number(yieldRate).toFixed(1)} unit="%" sub="순영업소득 기준" src={kosisPeriod}/>}
            {((netIncomeUnit === '%' && netIncomePct > 0) || netIncome > 0) && (
              <Box label="순영업소득"
                   value={
                     netIncomeUnit === '%' && netIncomePct > 0
                       ? (window.bcFmtPct ? window.bcFmtPct(netIncomePct) : netIncomePct.toFixed(1))
                       : (netIncome >= 10000
                           ? Math.round(netIncome / 10000).toLocaleString()
                           : Math.round(netIncome).toLocaleString())
                   }
                   unit={
                     netIncomeUnit === '%' && netIncomePct > 0
                       ? '%'
                       : (netIncome >= 10000 ? '만/평/년' : '원/평/년')
                   }
                   sub={netIncomeUnit === '%' ? '임대수입 대비' : ''}
                   src={kosisPeriod}/>
            )}
          </div>
        </div>
        )}

        <div className="bc-box" style={{padding:18, display:"flex", flexDirection:"column"}}>
          <div style={{fontSize:15, fontWeight:600, marginBottom:12}}>전국 카페 평균</div>
          {kc ? (
            <>
              {/* [2026-05-19] 인테리어비 폴백: interiorAvg 없으면 interiorPerPyeong × avgAreaPyeong, 그것도 없으면 전국 카페 평균(약 5,250만원) */}
              {/* [2026-05-19] 메모리 절대 규칙: "-" 표시 금지 → NULL 박스 자체 숨김 */}
              <div className="bc-grid-3 c8-kc" style={{gap:14, flex:1, alignContent:"center"}}>
                {(() => {
                  const _interiorFallback = (kc?.interiorPerPyeong > 0 && kc?.avgAreaPyeong > 0)
                    ? Math.round(kc.interiorPerPyeong * kc.avgAreaPyeong)
                    : 0;
                  const _interiorShown = kc?.interiorAvg > 0 ? Math.round(kc.interiorAvg) : _interiorFallback;
                  return _interiorShown > 0 ? <Box label="인테리어비" value={_interiorShown.toLocaleString()} unit="만원"/> : null;
                })()}
                {kc?.startupInvestAvg > 0 && <Box label="총 투자비"  value={(kc.startupInvestAvg / 10000).toFixed(1)} unit="억"/>}
                {kc?.avgAreaPyeong > 0 && <Box label="평수"       value={kc.avgAreaPyeong.toFixed(1)} unit="평"/>}
                {kc?.salesAvg > 0 && <Box label="연 매출"    value={kc.salesAvg >= 10000 ? (kc.salesAvg/10000).toFixed(1) : Math.round(kc.salesAvg).toLocaleString()} unit={kc.salesAvg >= 10000 ? "억" : "만원"}/>}
                {kc?.unitPriceAvg > 0 && <Box label="객단가"     value={kc.unitPriceAvg.toLocaleString()} unit="원" est={_isEst('unitPriceAvg', 'avgPrice', '객단가')}/>}
                {kc?.profitMargin > 0 && <Box label="이익률"     value={window.bcFmtPct ? window.bcFmtPct(kc.profitMargin) : kc.profitMargin.toFixed(1)} unit="%" est={_isEst('profitMargin', 'opProfitPct', 'costRate', '이익률')}/>}
              </div>
            </>
          ) : (
            <div style={{fontSize:13, color:"var(--matte-fg-4)", padding:"20px 0"}}>카페 평균 데이터 수집 중</div>
          )}
        </div>
      </div>

      {/* [2026-06-29 창업비 가이드] 평수 슬라이더(예언 UI) 제거 → 15평 기준 인테리어 분포 + 창업비 가이드(단계/범위) */}
      <div style={{display:"grid", gridTemplateColumns:"1fr 1fr", gap:16, marginTop:16}}>
        <div className="bc-box" style={{padding:24, display:"flex", flexDirection:"column"}}>
          <div style={{fontSize:16, fontWeight:600, marginBottom:18}}>인테리어 비용 분포 <span style={{fontSize:13, color:"var(--matte-fg-3)", fontWeight:500, marginLeft:8}}>{REF_PY}평 기준</span></div>
          <div style={{display:"flex", flexDirection:"column", gap:10, flex:1, justifyContent:"space-around"}}>
          {(() => {
            const perPy = kc?.interiorPerPyeong > 0 ? kc.interiorPerPyeong : 350;
            const tiers = [
              ["셀프", perPy * 0.4 * REF_PY, false],
              ["최소 시공", perPy * 0.7 * REF_PY, false],
              ["평균 시공", perPy * 1.0 * REF_PY, true],
              ["고급 시공", perPy * 1.5 * REF_PY, false],
              ["프리미엄", perPy * 2.5 * REF_PY, false],
            ];
            const tMax = Math.max(...tiers.map(t => t[1]));
            return tiers.map(([l, v, acc]) => {
              const valStr = window.bcFmtMan(v) || `${Math.round(v).toLocaleString()}만원`;
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

        <div className="bc-box" style={{padding:24, background:"linear-gradient(135deg, rgba(76, 123, 228,0.10), transparent 60%)", border:"1px solid rgba(76, 123, 228,0.45)", display:"flex", flexDirection:"column"}}>
          <div style={{fontSize:16, fontWeight:700, color:"#4C7BE4", marginBottom:6}}>창업비 가이드</div>
          <div style={{fontSize:13, color:"var(--matte-fg-3)", marginBottom:18}}>{REF_PY}평 기준 · 보증금 별도</div>

          {/* ① 인테리어 (15평 평균시공) */}
          <div style={{display:"flex", justifyContent:"space-between", alignItems:"baseline", padding:"12px 0", borderTop:"1px solid var(--matte-line)"}}>
            <span style={{fontSize:14, color:"var(--matte-fg-2)", fontWeight:600, display:"flex", alignItems:"center", gap:6}}>인테리어 <span style={{fontSize:12, color:"var(--matte-fg-4)", fontWeight:400}}>평균 시공</span>{_isEst('interiorPerPyeong', 'interiorAvg') && window.EstBadge ? <window.EstBadge/> : null}</span>
            <span style={{fontSize:16, color:"var(--matte-fg)", fontWeight:700, fontVariantNumeric:"tabular-nums"}}>{interiorShown > 0 ? (window.bcFmtMan(interiorShown) || `${Math.round(interiorShown).toLocaleString()}만원`) : '왼쪽 분포 참고'}</span>
          </div>

          {/* ② 권리금 (지역 실측값) */}
          <div style={{display:"flex", justifyContent:"space-between", alignItems:"baseline", padding:"12px 0", borderTop:"1px solid var(--matte-line)"}}>
            <span style={{fontSize:14, color:"var(--matte-fg-2)", fontWeight:600, display:"flex", alignItems:"center", gap:6}}>권리금 {kosisRegion ? <span style={{fontSize:12, color:"var(--matte-fg-4)", fontWeight:400}}>{kosisRegion} 평균</span> : null}{_isEst('premiumCost', 'premium') && window.EstBadge ? <window.EstBadge/> : null}</span>
            <span style={{fontSize:16, color:"var(--matte-fg)", fontWeight:700, fontVariantNumeric:"tabular-nums"}}>{premiumShown > 0 ? (window.bcFmtMan(premiumShown) || `${Math.round(premiumShown).toLocaleString()}만원`) : '자리마다 상이'}</span>
          </div>

          {/* ③ 보증금 (월세 기준 안내 — 통상 월세의 약 10배) */}
          <div style={{display:"flex", justifyContent:"space-between", alignItems:"baseline", padding:"12px 0", borderTop:"1px solid var(--matte-line)"}}>
            <span style={{fontSize:14, color:"var(--matte-fg-2)", fontWeight:600, display:"flex", alignItems:"center", gap:6}}>보증금 <span style={{fontSize:12, color:"var(--matte-fg-4)", fontWeight:400}}>월세의 약 10배</span></span>
            <span style={{fontSize:16, color:"var(--matte-fg)", fontWeight:700, fontVariantNumeric:"tabular-nums"}}>{depositGuide > 0 ? ('약 ' + (window.bcFmtMan(depositGuide) || `${Math.round(depositGuide).toLocaleString()}만원`)) : (deposit > 0 ? (window.bcFmtMan(deposit) || `${Math.round(deposit).toLocaleString()}만원`) : '월세 기준 산정')}</span>
          </div>

          {/* ④ 시설·장비 3단계 (사장님 실무 확정값) */}
          <div style={{marginTop:6, paddingTop:14, borderTop:"1px solid var(--matte-line)"}}>
            <div style={{fontSize:13, color:"var(--matte-fg-3)", fontWeight:600, marginBottom:10}}>시설·장비 <span style={{fontSize:12, color:"var(--matte-fg-4)", fontWeight:400}}>운영 컨셉에 따라</span></div>
            <div style={{display:"flex", flexDirection:"column", gap:8}}>
              {FACILITY_TIERS.map((ft, i) => {
                const rangeTxt = ft.min === ft.max
                  ? `약 ${(window.bcFmtMan(ft.min) || `${ft.min.toLocaleString()}만원`)}`
                  : `${(window.bcFmtMan(ft.min) || `${ft.min.toLocaleString()}만원`)} ~ ${(window.bcFmtMan(ft.max) || `${ft.max.toLocaleString()}만원`)}`;
                const isAvg = ft.key === 'avg';
                return (
                  <div key={ft.key} style={{display:"flex", justifyContent:"space-between", alignItems:"center", padding:"10px 12px", background: isAvg ? "rgba(76, 123, 228,0.10)" : "rgba(255,255,255,0.03)", borderRadius:8, border: isAvg ? "1px solid rgba(76, 123, 228,0.40)" : "1px solid var(--matte-line)"}}>
                    <span style={{display:"flex", alignItems:"baseline", gap:8, minWidth:0}}>
                      <span style={{fontSize:14, fontWeight:700, color: isAvg ? "#4C7BE4" : "var(--matte-fg)"}}>{ft.label}</span>
                      <span style={{fontSize:12, color:"var(--matte-fg-4)", overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap"}}>{ft.desc}</span>
                    </span>
                    <span style={{fontSize:14, fontWeight:700, fontVariantNumeric:"tabular-nums", color: isAvg ? "#4C7BE4" : "var(--matte-fg)", flexShrink:0, marginLeft:10}}>{rangeTxt}</span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* [2026-06-29 사장님 확정] '총 창업비 합계' 줄 삭제 — 동네별로 안 변해 무의미.
              위 항목별 참고(인테리어/권리금/보증금/시설·장비 3단계)로 '평균 위/아래'만 안내한다. */}

          {/* 하단 작은 글씨 면책 + 브랜드 멘트 (정확히 지정 문구) */}
          <div style={{marginTop:14, fontSize:12, color:"var(--matte-fg-4)", lineHeight:1.6}}>
            예상 견적은 참고용이며 컨셉·기획에 따라 차이가 큽니다. 빈크래프트는 정해진 창업 예산 안에서 최적 설계를 찾아드립니다.
          </div>
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
  // [2026-06-14] 헤드라인 변화는 카드01과 동일 산식(공실률 시계열 기간 처음→끝 변화)으로 통일.
  //   같은 공실률 6.9%인데 카드01=-3.4%(처음→끝)·카드12=-1.7%(평균 대비)로 갈려 혼동 → 헤드라인만 처음→끝으로.
  //   소스도 카드01과 동일(0% 분기 제외 = vacPositive). '평균 대비' 줄은 그대로 vacavgDelta 유지.
  const vacancyDelta = vacPositive.length >= 2
    ? Math.round((vacPositive[vacPositive.length - 1] - vacPositive[0]) * 10) / 10
    : 0;
  // [정합] 추이 그래프 Y축이 최저/최고/변동폭 표기와 같은 분기를 쓰도록 동일 소스(vacPositive)로 통일.
  //   (예전엔 그래프=vacValues(0% 분기 포함)·최저최고=vacPositive(0% 제외)로 갈려 축과 최저/최고가 안 맞아 보였음)
  const lineData = vacPositive.length >= 2 ? vacPositive : [];
  return (
    <CardShell n="09" id="09"
      bruSummary={body.bruSummary}
      title="카페 기회"
      sub="이 동네 카페 데이터 발견">
      {/* 4-up KPI */}
      <div className="bc-grid-4" style={{gap:16, marginBottom:16}}>
        <StatTile id="c9.hero" tone="mint" label="공실률" value={vacancy > 0 ? (window.bcFmtPct ? window.bcFmtPct(vacancy) : Number(vacancy).toFixed(1)) : '-'} unit={vacancy > 0 ? '%' : ''} delta={vacancyDelta !== 0 ? `${vacancyDelta >= 0 ? '+' : ''}${window.bcFmtPct ? window.bcFmtPct(vacancyDelta) : vacancyDelta.toFixed(1)}` : undefined} deltaPositive={vacancyDelta >= 0} deltaPrefixDisabled hero accent/>
        <StatTile tone="blue" label="평균 대비" value={vacavgDelta !== 0 ? `${vacavgDelta > 0 ? '+' : ''}${vacavgDelta}` : '-'} unit={vacavgDelta !== 0 ? '%' : ''}/>
        <StatTile tone="lilac" label="1년 신규" value={String(newOpen)} unit="개"/>
        <StatTile tone="cream" label="1년 폐업" value={String(closed)} unit="개"/>
      </div>

      <div style={{display:"grid", gridTemplateColumns:"1fr 1.4fr", gap:16, alignItems:"stretch"}}>
        <div className="bc-box" style={{padding:24, display:"flex", flexDirection:"column"}}>
          <div style={{display:"flex", justifyContent:"space-between", alignItems:"baseline", marginBottom:16}}>
            <span style={{fontSize:16, fontWeight:600}}>최근 공실률 추이</span>
            <span style={{fontSize:13, color:"var(--matte-fg-3)"}}>{vacValues.length > 0 ? `${vacValues.length}분기` : ''}</span>
          </div>
          <div style={{flex:1, display:"flex", alignItems:"center", minHeight:200}}>
            {lineData.length >= 2 ? (
              <LineChart id="c9.line" width={460} height={260} data={lineData} color="#4C7BE4"/>
            ) : (
              <div style={{width:"100%", textAlign:"center", color:"var(--matte-fg-4)", fontSize:13}}>공실률 추이 데이터 수집 중</div>
            )}
          </div>
          {/* [2026-07-02] "-" 금지 → 공실률 시계열 2점 미만이면 최저/최고/변동폭 줄 전체 숨김
              (1점뿐이면 변동폭 0.0% 같은 무의미 통계라 그래프의 '수집 중' 안내와 맞춤) */}
          {vacPositive.length >= 2 && (
          <div style={{marginTop:20, paddingTop:18, borderTop:"1px solid var(--matte-line)", display:"grid", gridTemplateColumns:"1fr 1fr 1fr", gap:14}}>
            {[
              ["최저", window.bcFmtPct ? window.bcFmtPct(vacMin) : Number(vacMin).toFixed(1), "%"],
              ["최고", window.bcFmtPct ? window.bcFmtPct(vacMax) : Number(vacMax).toFixed(1), "%"],
              ["변동폭", window.bcFmtPct ? window.bcFmtPct(vacRange) : Number(vacRange).toFixed(1), "%"],
            ].map(([l, v, u]) => (
              <div key={l}>
                <div style={{fontSize:13, color:"var(--matte-fg-3)", marginBottom:6, fontWeight:500}}>{l}</div>
                <div style={{fontSize:22, fontWeight:700, fontVariantNumeric:"tabular-nums", letterSpacing:"-0.01em"}}>{v}<span style={{fontSize:13, color:"var(--matte-fg-3)", marginLeft:2, fontWeight:500}}>{u}</span></div>
              </div>
            ))}
          </div>
          )}
        </div>

        <div className="bc-box" style={{padding:24}}>
          <div style={{fontSize:16, fontWeight:600, marginBottom:18}}>핵심 발견</div>
          <window.DrStagger id="c9.list" delay={120} style={{display:"flex", flexDirection:"column", gap:14}}>
          {(() => {
            // [2026-06-30 매출 한 저울] 비즈맵 월매출 vs 소상공인 구평균(guAvg)은 저울이 달라 비교 금지(강남 -68% 왜곡). 월매출 값만 표시.
            return [
              ["시장 매력도",
                cafeMonthly > 0 ? `월매출 ${window.bcFmtMan(cafeMonthly)}` : '매출 데이터 수집 중',
                0.5,
                false],
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
                vacancy > 0 ? `공실률 ${window.bcFmtPct ? window.bcFmtPct(vacancy) : Number(vacancy).toFixed(1)}% — ${vacancy < 5 ? '안정' : vacancy < 8 ? '보통' : '주의'}` : '공실률 데이터 수집 중',
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
  // [2026-06-26] 추정 배지 약속 — bodyData._estimated 의 필드만 회색 '추정' 배지.
  const _estSet10 = (window.bcEstSet ? window.bcEstSet(bd) : new Set());
  const _isEst10 = (...keys) => (window.bcIsEst ? window.bcIsEst(_estSet10, ...keys) : false);
  const searchAvgPrice = Number(bd.searchAvgPrice) || 0;
  const searchSales = Number(bd.searchSales) || 0;
  const searchOrders = Number(bd.searchOrders) || 0;
  const cafeRank = Number(bd.cafeRankInDelivery ?? body.cafeRankInDelivery) || 0;
  const topDelivCats = Array.isArray(body.topDeliveryCategories) ? body.topDeliveryCategories
                     : (Array.isArray(bd.topDeliveryCategories) ? bd.topDeliveryCategories : []);
  const totalBiz = Number(bd.totalDeliveryBiz ?? body.totalDeliveryBiz) || topDelivCats.length || 0;
  /* 업종 순위 타일: 카페가 배달 상위권이면 카페 순위, 아니면 배달 1위 업종명 노출 */
  const rankTile = (() => {
    if (cafeRank > 0) {
      return { value: String(cafeRank), unit: '위', sub: totalBiz > 0 ? `/ ${totalBiz}개 업종` : undefined };
    }
    const top = topDelivCats[0];
    if (top && top.name) {
      return { value: String(top.name), unit: '', sub: totalBiz > 0 ? `배달 1위 / ${totalBiz}개 업종` : '배달 1위' };
    }
    if (totalBiz > 0) {
      return { value: String(totalBiz), unit: '개 업종', sub: '배달 운영' };
    }
    return { value: '카페', unit: '', sub: '배달 운영 업종' };
  })();
  // 순위 타일 '실데이터' 여부: 마지막 폴백 문구('카페')만 남는 경우는 데이터 없음으로 취급
  const rankTileHasData = cafeRank > 0 || !!(topDelivCats[0] && topDelivCats[0].name) || totalBiz > 0;
  const cafeDelivery = Number(bd.cafeDeliveryAmount) || 0;
  const monthlyTrendArr = Array.isArray(bd.monthlyTrend) ? bd.monthlyTrend.slice(-12) : [];
  const monthlyValues = monthlyTrendArr.map(m => Number(m.value) || 0).filter(v => v > 0);
  const lineDataM = monthlyValues.length >= 2 ? monthlyValues : [];
  const yoyPct = monthlyValues.length >= 2 && monthlyValues[0] > 0
    ? Math.round(((monthlyValues[monthlyValues.length - 1] - monthlyValues[0]) / monthlyValues[0]) * 100)
    : 0;
  const weekdaySales = Array.isArray(bd.weekdaySales) ? bd.weekdaySales : [];
  // [2026-06-14] 요일별 배달 = 매출 비중(%)으로 환산해 의미를 명확히. amount 합 대비 각 요일 비중.
  const weekdayTotal = weekdaySales.reduce((s, d) => s + (Number(d.amount) || 0), 0);
  const dayItemsM = (() => {
    if (!(weekdaySales.length > 0 && weekdayTotal > 0)) return [];
    // 최대잔차(largest remainder)로 합을 정확히 100%에 맞춤 (요일별 독립 반올림 시 99/101 어긋남 방지)
    const parts = weekdaySales.map(d => {
      const raw = (Number(d.amount) || 0) / weekdayTotal * 100;
      const fl = Math.floor(raw);
      return { l: d.day, fl, frac: raw - fl };
    });
    let diff = 100 - parts.reduce((s, p) => s + p.fl, 0);
    const order = parts.map((p, i) => i).sort((a, b) => parts[b].frac - parts[a].frac);
    for (let k = 0; k < order.length && diff > 0; k++, diff--) parts[order[k]].fl += 1;
    for (let k = order.length - 1; k >= 0 && diff < 0; k--, diff++) parts[order[k]].fl -= 1;
    return parts.map(p => ({ l: p.l, v: p.fl, t: `${p.fl}%` }));
  })();
  const dayTopIdxM = dayItemsM.length > 0 ? dayItemsM.reduce((m, x, i, arr) => x.v > arr[m].v ? i : m, 0) : 0;
  const kd = bd.kosisDelivery || null;
  const kdActiveRatio = kd ? Math.round(Number(kd.overallUsePct) || 0) : null;
  const kdInactiveRatio = kdActiveRatio != null ? 100 - kdActiveRatio : null;
  const kdAppUsePct = kd ? Math.round(Number(kd.app?.usePct) || 0) : 0;
  const kdAgencyUsePct = kd ? Math.round(Number(kd.agency?.usePct) || 0) : 0;
  // KOSIS 특성: 배달앱/배달대행 사용률은 동일 값 (배달 운영 매장 전체 비율)
  // 같은 값 두 번 표시를 피하기 위해 50만원 이상 고비용 운영 비율로 대체 (배달앱 6% vs 배달대행 71%로 차별성 큼)
  const kdSameUsePct = kd?.sameUsePct === true || (kdAppUsePct > 0 && kdAppUsePct === kdAgencyUsePct);
  const kdAppHighCostPct = kd ? Math.round(Number(kd.app?.highCostPct) || 0) : 0;
  const kdAgencyHighCostPct = kd ? Math.round(Number(kd.agency?.highCostPct) || 0) : 0;
  const kdSalesAvg = kd ? Math.round(Number(kd.salesAvg) || 0) : 0;
  const kdYear = kd?.year || '';
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
      bruSummary={body.bruSummary}
      title="배달 객단가"
      sub="이 동네 배달 객단가">
      {/* [2026-07-02] "-" 금지 → 넷(객단가/매출/건수/순위) 중 하나라도 있으면 줄 표시,
          각 타일은 자기 값 있을 때만 렌더 (격자 자동배치라 홀수여도 안 깨짐) */}
      {(searchAvgPrice > 0 || searchSales > 0 || searchOrders > 0 || rankTileHasData) && (
      <div className="bc-grid-4" style={{gap:16, marginBottom:16}}>
        {searchAvgPrice > 0 && <StatTile id="c10.tile1" tone="blue"  label="동 객단가 (배달)" value={searchAvgPrice.toLocaleString()} unit="원" hero est={_isEst10('searchAvgPrice', 'avgPrice', '객단가')}/>}
        {searchSales > 0 && <StatTile id="c10.tile2" tone="mint"  label="월 배달 매출"   value={searchSales.toLocaleString()} unit="만원"/>}
        {searchOrders > 0 && <StatTile id="c10.tile3" tone="lilac" label="월 배달 건수"   value={searchOrders.toLocaleString()} unit="건" delta={yoyPct ? String(Math.abs(yoyPct)) : undefined} deltaPositive={yoyPct >= 0}/>}
        {rankTileHasData && <StatTile id="c10.tile4" tone="cream" label="업종 순위"      value={rankTile.value} unit={rankTile.unit} sub={rankTile.sub}/>}
      </div>
      )}

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
            <div style={{display:"flex", justifyContent:"space-between", alignItems:"baseline", marginBottom:12}}>
              <span style={{fontSize:15, fontWeight:600}}>요일별 배달 매출 비중</span>
              <span style={{fontSize:12, color:"var(--matte-fg-4)", fontWeight:500}}>한 주 매출 100% 기준</span>
            </div>
            {dayItemsM.length > 0 ? (
              <VBars id="c10.days" accent={dayTopIdxM} height={80} barW={24} items={dayItemsM}/>
            ) : (
              <div style={{fontSize:13, color:"var(--matte-fg-4)"}}>요일 데이터 수집 중</div>
            )}
          </div>
        </div>

        <div style={{display:"flex", flexDirection:"column", gap:14}}>
          <div className="bc-box" style={{padding:24}}>
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

          <div className="bc-box" style={{padding:22, display:"flex", flexDirection:"column", flex:1, minHeight:0}}>
            <div style={{fontSize:18, fontWeight:700, marginBottom:14}}>전국 카페 배달 운영</div>
            {kdActiveRatio != null ? (
              <>
                <div style={{display:"flex", alignItems:"center", justifyContent:"center", gap:20, paddingBlock:6}}>
                  <Donut id="c10.donut" size={200} thickness={22} segments={[
                    {value:kdActiveRatio, color:"#4C7BE4", label:"운영"},
                    {value:kdInactiveRatio, color:"#FFFFFF", label:"미운영"},
                  ]} centerLabel={`${kdActiveRatio}%`} centerSub="배달 운영"/>
                  <DonutLegend segments={[
                    {value:kdActiveRatio, color:"#4C7BE4", label:"운영", text:`${kdActiveRatio}%`},
                    {value:kdInactiveRatio, color:"#FFFFFF", label:"미운영", text:`${kdInactiveRatio}%`},
                  ]}/>
                </div>
                <div style={{flex:1, marginTop:18, paddingTop:18, borderTop:"1px solid var(--matte-line)", display:"flex", flexDirection:"column", justifyContent:"space-around", gap:16, minHeight:0}}>
                  {(kdAppUsePct > 0 || kdAgencyUsePct > 0) && (() => {
                    // KOSIS 특성: 두 사용률이 같으면 (배달 운영 매장 전체 비율 동일 보고)
                    // → "월 비용 50만원 이상" 고비용 운영 비율로 대체 (배달앱 6% vs 배달대행 71%로 차별성 명확)
                    if (kdSameUsePct && (kdAppHighCostPct > 0 || kdAgencyHighCostPct > 0)) {
                      return (
                        <div>
                          <div style={{fontSize:12, color:"var(--matte-fg-4)", marginBottom:10, fontWeight:500, letterSpacing:"-0.005em"}}>월 50만원 이상 고비용 운영 비율</div>
                          <div style={{display:"grid", gridTemplateColumns:"1fr 1fr", gap:14}}>
                            <div>
                              <div style={{fontSize:16, color:"var(--matte-fg-3)", marginBottom:8, fontWeight:500}}>배달앱</div>
                              <div style={{fontSize:40, fontWeight:700, color:"#4C7BE4", fontVariantNumeric:"tabular-nums", lineHeight:1.05, letterSpacing:"-0.01em"}}>{kdAppHighCostPct}<span style={{fontSize:20, color:"var(--matte-fg-3)", fontWeight:500, marginLeft:4}}>%</span></div>
                            </div>
                            <div>
                              <div style={{fontSize:16, color:"var(--matte-fg-3)", marginBottom:8, fontWeight:500}}>배달대행</div>
                              <div style={{fontSize:40, fontWeight:700, fontVariantNumeric:"tabular-nums", lineHeight:1.05, letterSpacing:"-0.01em"}}>{kdAgencyHighCostPct}<span style={{fontSize:20, color:"var(--matte-fg-3)", fontWeight:500, marginLeft:4}}>%</span></div>
                            </div>
                          </div>
                        </div>
                      );
                    }
                    // KOSIS가 실제로 다른 값을 줄 경우(향후 개정 대비): 기존 방식으로 사용률 표시
                    const showApp = kdAppUsePct > 0;
                    const showAgency = kdAgencyUsePct > 0;
                    const cols = (showApp && showAgency) ? "1fr 1fr" : "1fr";
                    return (
                      <div style={{display:"grid", gridTemplateColumns:cols, gap:14}}>
                        {showApp && (
                          <div>
                            <div style={{fontSize:16, color:"var(--matte-fg-3)", marginBottom:8, fontWeight:500}}>배달앱 사용</div>
                            <div style={{fontSize:40, fontWeight:700, color:"#4C7BE4", fontVariantNumeric:"tabular-nums", lineHeight:1.05, letterSpacing:"-0.01em"}}>{kdAppUsePct}<span style={{fontSize:20, color:"var(--matte-fg-3)", fontWeight:500, marginLeft:4}}>%</span></div>
                          </div>
                        )}
                        {showAgency && (
                          <div>
                            <div style={{fontSize:16, color:"var(--matte-fg-3)", marginBottom:8, fontWeight:500}}>배달대행 사용</div>
                            <div style={{fontSize:40, fontWeight:700, fontVariantNumeric:"tabular-nums", lineHeight:1.05, letterSpacing:"-0.01em"}}>{kdAgencyUsePct}<span style={{fontSize:20, color:"var(--matte-fg-3)", fontWeight:500, marginLeft:4}}>%</span></div>
                          </div>
                        )}
                      </div>
                    );
                  })()}
                  {kdSalesAvg > 0 && (
                    <div style={{paddingTop:16, borderTop:"1px solid var(--matte-line)", display:"flex", justifyContent:"space-between", alignItems:"baseline"}}>
                      <span style={{fontSize:16, color:"var(--matte-fg-3)", fontWeight:500}}>전국 카페 평균 연 매출</span>
                      <span style={{fontSize:26, fontWeight:700, fontVariantNumeric:"tabular-nums", letterSpacing:"-0.01em"}}>{window.bcFmtMan(kdSalesAvg) || `${kdSalesAvg.toLocaleString()}만원`}</span>
                    </div>
                  )}
                </div>
              </>
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
    ? bd.keywords.slice(0, 12).map((k, i) => [k, Math.max(16, 34 - i * 1.6)])
    : [];
  const intents = Array.isArray(bd.searchIntents) && bd.searchIntents.length > 0 ? bd.searchIntents.slice(0, 7) : [];
  const negKw = Array.isArray(bd.negativeKeywords) && bd.negativeKeywords.length > 0 ? bd.negativeKeywords.slice(0, 5) : [];
  const topShops = Array.isArray(bd.topShops) && bd.topShops.length > 0
    ? bd.topShops.slice(0, 5).map(s => [s.name, s.menu || '시그니처', s.reason || ''])
    : [];
  return (
    <CardShell n="11" id="11"
      bruSummary={body.bruSummary}
      title="SNS 트렌드"
      sub="소셜미디어 카페 분위기 분석">
      {/* [2026-07-02] "-" 금지 → SNS 데이터가 통째로 비면(AI 응답 없음) 4타일 전부 '-'/'0'이라 KPI 줄 자체 숨김 */}
      {(positivePct > 0 || negativePct > 0 || blogMentions > 0 || kwArr.length > 0) && (
      <div className="bc-grid-4" style={{gap:16, marginBottom:16}}>
        <StatTile id="c11.tile1" tone="mint"  label="긍정 비율"      value={positivePct > 0 ? String(positivePct) : '-'} unit={positivePct > 0 ? '%' : ''} hero/>
        <StatTile id="c11.tile2" tone="rose"  label="부정 비율"      value={negativePct > 0 ? String(negativePct) : '-'} unit={negativePct > 0 ? '%' : ''} deltaPositive={false}/>
        <StatTile id="c11.tile3" tone="blue"  label="총 키워드"     value={String(kwArr.length)}/>
        <StatTile id="c11.tile4" tone="cream" label="블로그 언급"   value={blogMentions > 0 ? blogMentions.toLocaleString() : '-'} unit={blogMentions > 0 ? '건' : ''}/>
      </div>
      )}

      <div style={{display:"grid", gridTemplateColumns:"1.3fr 1fr", gap:16, alignItems:"stretch"}}>
        <div className="bc-box" style={{padding:20, display:"flex", flexDirection:"column"}}>
          <div style={{fontSize:15, fontWeight:600, marginBottom:12, flexShrink:0}}>SNS 키워드 클라우드</div>
          {kwArr.length > 0 ? (
            <window.DrStagger id="c11.cloud" delay={60} style={{flex:1, display:"flex", flexWrap:"wrap", gap:"14px 18px", alignItems:"baseline", alignContent:"center", padding:"16px 0"}}>
              {kwArr.map(([k, s], i) => (
                <span key={i} style={{fontSize:s, color: s>=26 ? "#FFFFFF" : s>=20 ? "#C9C9C9" : "#A3A3A3", fontWeight: s>22 ? 700 : 600, lineHeight:1.25}}>#{k}</span>
              ))}
            </window.DrStagger>
          ) : (
            <div style={{flex:1, display:"flex", alignItems:"center", fontSize:13, color:"var(--matte-fg-4)", padding:"30px 0"}}>SNS 키워드 데이터 수집 중</div>
          )}

          <div style={{marginTop:18, paddingTop:18, borderTop:"1px solid var(--line)", flexShrink:0}}>
            <div style={{fontSize:15, color:"var(--fg-3)", marginBottom:10, fontWeight:600}}>검색 유입 경로</div>
            {intents.length > 0 ? (
              <div style={{display:"flex", flexWrap:"wrap", gap:8, marginBottom:20}}>
                {intents.map(k => <span key={k} className="bc-pill">{k}</span>)}
              </div>
            ) : (
              <div style={{fontSize:13, color:"var(--matte-fg-4)", marginBottom:20}}>검색 유입 데이터 수집 중</div>
            )}
            <div style={{fontSize:15, color:"var(--fg-3)", marginBottom:10, fontWeight:600}}>주의 키워드</div>
            {negKw.length > 0 ? (
              <div style={{display:"flex", gap:8, flexWrap:"wrap"}}>
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
            <div style={{fontSize:13, color:"var(--matte-fg-4)", padding:"30px 0", lineHeight:1.6}}>블로그 후기 기반 추천 매장을 찾지 못했어요. 후기가 적은 지역이거나 일시적 오류일 수 있어요 (다시 검색하면 채워질 수 있습니다).</div>
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
      bruSummary={body.bruSummary}
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
                {(() => {
                // [2026-06-24] 계절↔날씨효과 매핑 교정.
                //   근본 오류: 여름이 rainyEffect(비 효과, 음수)에 매핑돼 "여름 -30% 비수기"로 나옴.
                //   카페 여름 = 아이스음료 성수기라 맑음/폭염(sunnyEffect, 양수)이 지배적 효과 → 여름=sunnyEffect.
                //   봄·가을 = 완만(맑음 효과 일부), 겨울 = 한파/눈(snowEffect, 음수)이 지배적.
                //   dataMapper가 계절별 올바른 효과 필드(seasonEffects 등)를 주면 그걸 우선 사용.
                const _se = bd.seasonEffects || null;
                const _seVal = (key, fallback) => {
                  if (!_se) return fallback;
                  const raw = _se[key];
                  if (raw == null) return fallback;
                  const p = parsePct(raw);
                  return p != null ? Math.round(p) : fallback;
                };
                const seasons = [
                  ["봄", "3~5월", _seVal('spring', sunnyEffect != null ? Math.round(sunnyEffect * 0.5) : null)],
                  ["여름", "6~8월", _seVal('summer', sunnyEffect != null ? Math.round(sunnyEffect) : null)],
                  ["가을", "9~11월", _seVal('autumn', sunnyEffect != null ? Math.round(sunnyEffect * 0.4) : null)],
                  ["겨울", "12~2월", _seVal('winter', snowEffect)],
                ];
                // 최대 양수값이 여럿이면 첫 칸 하나만 강조 (동일 최대값 동시 강조 방지)
                const vals = seasons.map(([,, v]) => v).filter(v => v != null && v > 0);
                const peak = vals.length ? Math.max(...vals) : null;
                const accentIdx = peak != null ? seasons.findIndex(([,, v]) => v === peak) : -1;
                return seasons.map(([k, mon, v], i) => {
                  if (v == null) return null;
                  // 태그를 값 부호 기준으로 통일: 큰 양수=성수기 / 음수=비수기 / 소폭=안정 (부호-라벨 모순 방지)
                  const t = v > 10 ? '성수기' : (v < 0 ? '비수기' : '안정');
                  const vStr = `${v > 0 ? '+' : ''}${v}`;
                  const accent = i === accentIdx;
                  return (
                    <div key={k} style={{padding:"16px 16px", background:"rgba(255,255,255,0.03)", borderRadius:10, border:"1px solid var(--matte-line)"}}>
                      <div style={{marginBottom:8}}>
                        <div style={{fontSize:14, color:"var(--matte-fg-2)", fontWeight:600}}>{k}</div>
                        <div style={{fontSize:12, color:"var(--matte-fg-3)", fontWeight:500, marginTop:2}}>{mon}</div>
                      </div>
                      <div style={{fontSize:24, fontWeight:700, fontVariantNumeric:"tabular-nums", color: accent ? "#4C7BE4" : "var(--matte-fg)", letterSpacing:"-0.01em"}}>{vStr}<span style={{fontSize:13, color:"var(--matte-fg-3)", marginLeft:2, fontWeight:500}}>%</span></div>
                      <div style={{fontSize:13, color:"var(--matte-fg-3)", marginTop:6}}>{t}</div>
                    </div>
                  );
                });
                })()}
              </div>
            </div>
          )}
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
                      <span style={{textAlign:"right", fontSize:14, fontWeight:700, color: acc ? "#4C7BE4" : "var(--matte-fg)", fontVariantNumeric:"tabular-nums"}}>{v > 0 ? '+' : ''}{window.bcFmtPct ? window.bcFmtPct(v) : v}%</span>
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

          {/* [2026-07-02] "-" 금지 → 값 없는 박스는 자체 숨김 (카드08 전국 카페 평균 박스와 동일 패턴) */}
          {(avgTempYr != null || summerMax != null || winterMin != null || rainDays > 0) && (
          <div className="bc-grid-2" style={{gap:10}}>
            {avgTempYr != null && <Box label="연평균 기온" value={avgTempYr} unit="°C"/>}
            {summerMax != null && <Box label="여름 최고" value={summerMax} unit="°C"/>}
            {winterMin != null && <Box label="겨울 최저" value={winterMin} unit="°C"/>}
            {rainDays > 0 && <Box label="강수일/연" value={String(rainDays)} unit="일" sub={yd?.relativePosition || ''}/>}
          </div>
          )}
        </div>
      </div>
    </CardShell>
  );
}

Object.assign(window, { Card08, Card09, Card10, Card11, Card12 });
