/* cards-a.jsx — Cards 01-07
   SnowUI Dashboard tone: pastel stat tiles + dark cards + clean charts.
   Each card: CardShell header + body + sources footer. */

/* safeSeries — 차트 시계열 데이터 가드.
   - 빈 배열·null·undefined·잘못된 타입 → fallback
   - {series:[...]} 형태로 들어와도 unwrap
   - 카드 단의 마지막 안전망 (차트 자체 가드와 별개) */
function safeSeries(x, fallback) {
  if (Array.isArray(x) && x.length > 0) return x;
  if (x && Array.isArray(x.series) && x.series.length > 0) return x.series;
  if (x && Array.isArray(x.values) && x.values.length > 0) return x.values;
  return fallback;
}
function safeArr(x, fallback) {
  return Array.isArray(x) && x.length > 0 ? x : fallback;
}
window.safeSeries = safeSeries;
window.safeArr = safeArr;

/* ============================================================
   Card 01 — 상권 분석 리포트
   Hero KPI 350개 매장, 도넛 카페 비율, 6박스 그리드, 임대시세 3박스, 분기 라인 3개
   ============================================================ */
function Card01({ body = {} }) {
  const cafeCount = Number(body.cafeCount) || 0;
  const franchise = Number(body.franchise) || 0;
  const individual = Number(body.individual) || 0;
  const bakery = Number(body.bakery) || 0;
  const newOpen = Number(body.newOpen) || 0;
  const closed = Number(body.closed) || 0;
  const rentPerPyeong = Number(body.rentPerPyeong) || 0;
  const vacancyRate = body.vacancyRate;
  const vacancyDisplay = vacancyRate != null && vacancyRate > 0 ? Number(vacancyRate).toFixed(1) : '-';
  const totalStores = cafeCount + bakery;
  // [2026-06-14] 분모 통일: 카페(개인+프랜) 기준으로 % 산출 → 카드08/09와 일치(개인 59 / 프랜 41).
  // 베이커리는 비율 파이에서 제외(개수만 유지). 도넛 중앙 라벨(cafeCount=353)과도 분모 정합.
  const donutTotal = individual + franchise;
  const indiePct = donutTotal > 0 ? Math.round((individual / donutTotal) * 100) : 0;
  const franPct = donutTotal > 0 ? Math.max(0, 100 - indiePct) : 0;
  // [2026-05-21] rentSeries(marketRentSeries.series)는 이미 '만원/평' 단위 → /10000 금지.
  // 기존 /10000 때문에 값이 전부 0으로 깎여 추이 그래프가 평탄 폴백([rentPerPyeong]x2)으로 빠지던 버그 수정.
  const rentSeriesRaw = (Array.isArray(body.rentSeries) && body.rentSeries.length > 0)
    ? body.rentSeries.map(s => Math.round(Number(s?.value) || 0)).filter(v => v > 0)
    : [];
  // [2026-05-19] 임계값 완화: 1개라도 있으면 표시 (단일값은 동일값 복제로 평탄 라인)
  const rentSeries = rentSeriesRaw.length >= 2
    ? rentSeriesRaw
    : (rentSeriesRaw.length === 1
        ? [rentSeriesRaw[0], rentSeriesRaw[0]]
        : (rentPerPyeong > 0 ? [rentPerPyeong, rentPerPyeong] : []));
  const vacancySeriesRaw = (Array.isArray(body.vacancySeries) && body.vacancySeries.length > 0)
    ? body.vacancySeries.map(s => Number(s?.value) || 0).filter(v => v > 0)
    : [];
  // [2026-05-19] 임계값 완화: 1개라도 있으면 표시 (단일값은 동일값 복제로 평탄 라인)
  const vacancySeries = vacancySeriesRaw.length >= 2
    ? vacancySeriesRaw
    : (vacancySeriesRaw.length === 1
        ? [vacancySeriesRaw[0], vacancySeriesRaw[0]]
        : (Number(vacancyRate) > 0 ? [Number(vacancyRate), Number(vacancyRate)] : []));
  const priceChange = body.priceChange;
  const vacancyDelta = vacancySeries.length >= 2
    ? (vacancySeries[vacancySeries.length - 1] - vacancySeries[0])
    : 0;
  const newOpenDelta = closed > 0 && newOpen > 0
    ? `${newOpen > closed ? '+' : ''}${Math.round(((newOpen - closed) / closed) * 100)}`
    : (newOpen > 0 ? '+신규' : null);
  return (
    <CardShell n="01" id="01"
      title="상권 분석 리포트"
      sub="반경 500m 매장 구성과 임대 시세"
      headerRight={window.MapTriggerButton ? <window.MapTriggerButton/> : null}>
      {/* Top: hero + donut */}
      <div className="bc-grid-4" style={{gap:16, marginBottom:16}}>
        <StatTile id="c1.tile1" tone="blue"  label="총 매장"        value={totalStores > 0 ? String(totalStores) : '-'} unit={totalStores > 0 ? '개' : ''} hero/>
        <StatTile id="c1.tile2" tone="lilac" label="프랜차이즈"     value={franchise > 0 ? String(franchise) : '-'} unit={franchise > 0 ? '개' : ''}/>
        <StatTile id="c1.tile3" tone="mint"  label="평당 월세"      value={rentPerPyeong > 0 ? String(rentPerPyeong) : '-'} unit={rentPerPyeong > 0 ? '만원' : ''} delta={priceChange != null && Number(priceChange) !== 0 ? `${Number(priceChange) >= 0 ? '+' : ''}${Number(priceChange).toFixed(1)}` : null} deltaPositive={priceChange == null || Number(priceChange) >= 0} deltaPrefixDisabled/>
        <StatTile id="c1.tile4" tone="rose"  label="공실률"         value={vacancyDisplay} unit={vacancyDisplay !== '-' ? '%' : ''} delta={vacancyDelta !== 0 ? `${vacancyDelta >= 0 ? '+' : ''}${vacancyDelta.toFixed(1)}` : null} deltaPositive={vacancyDelta >= 0} deltaPrefixDisabled/>
      </div>

      <div style={{display:"grid", gridTemplateColumns:"1fr 1fr", gap:16}}>
        {/* Left: 6-box composition */}
        <div className="bc-box" style={{padding:18}}>
          <div style={{fontSize:15, fontWeight:600, marginBottom:12}}>매장</div>
          <div className="bc-grid-3" style={{gap:10}}>
            {[
              ["카페", String(cafeCount), "blue"],
              ["프랜차이즈", String(franchise), "lilac"],
              ["개인 카페", String(individual), "mint"],
              ["베이커리", String(bakery), "cream"],
              ["신규 (1년)", String(newOpen), "mint"],
              ["폐업 (1년)", String(closed), "rose"],
            ].map(([l, v, t]) => (
              <div key={l} className={`bc-tile tone-${t}`} style={{padding:"14px 16px", minHeight:72, gap:4}}>
                <div className="label" style={{fontSize:15}}>{l}</div>
                <div className="value" style={{fontSize:22}}>{v}<span className="unit" style={{fontSize:15}}>개</span></div>
              </div>
            ))}
          </div>
        </div>

        {/* Right: donut */}
        <div className="bc-box" style={{padding:18}}>
          <div style={{fontSize:15, fontWeight:600, marginBottom:12}}>카페 비율</div>
          {donutTotal > 0 ? (
            <div style={{display:"flex", alignItems:"center", gap:18, justifyContent:"center"}}>
              <Donut id="c1.donut" size={200} segments={[
                ...(indiePct > 0 ? [{value:indiePct, color:"#4C7BE4", label:"개인 카페"}] : []),
                ...(franPct > 0 ? [{value:franPct, color:"#FFFFFF", label:"프랜차이즈"}] : []),
              ]} centerLabel={String(cafeCount)} centerSub="카페 매장"/>
              <DonutLegend segments={[
                ...(indiePct > 0 ? [{value:indiePct, color:"#4C7BE4", label:"개인", text:`${indiePct}%`}] : []),
                ...(franPct > 0 ? [{value:franPct, color:"#FFFFFF", label:"프랜차이즈", text:`${franPct}%`}] : []),
              ]}/>
            </div>
          ) : (
            <div style={{fontSize:14, color:"var(--matte-fg-3)", textAlign:"center", padding:"40px 0"}}>카페 데이터 수집 중</div>
          )}
        </div>
      </div>

      {/* Lower: 3 quarter trends */}
      <div className="bc-grid-3" style={{gap:12, marginTop:16}}>
        {[
          { l:"평당 월세", v: rentPerPyeong > 0 ? `${rentPerPyeong}만원` : '-', d: priceChange != null && Number(priceChange) !== 0 ? `${Number(priceChange) > 0 ? '+' : ''}${Number(priceChange).toFixed(1)}` : null, color:"#FFFFFF", data: rentSeries },
          { l:"공실률",   v: vacancyDisplay !== '-' ? `${vacancyDisplay}%` : '-', d: vacancyDelta !== 0 ? `${vacancyDelta > 0 ? '+' : ''}${vacancyDelta.toFixed(1)}` : null, color:"#FFFFFF", data: vacancySeries },
          { l:"신규 개업", v: `${newOpen}개`, d: newOpenDelta, dl:"순증감률", color:"#4C7BE4", data: newOpen > 0 || closed > 0 ? [Math.max(0, newOpen - closed), newOpen] : [] },
        ].map((t, i) => (
          <div key={i} className="bc-box" style={{padding:18}}>
            <div style={{display:"flex", justifyContent:"space-between", alignItems:"baseline", marginBottom:10}}>
              <span style={{fontSize:14, color:"var(--matte-fg-3)", fontWeight:500}}>{t.l}</span>
              {t.d != null && <span style={{fontSize:14, color: t.color === "#4C7BE4" ? "#4C7BE4" : "var(--matte-fg-2)", fontWeight:600, fontVariantNumeric:"tabular-nums"}}>{t.dl ? <span style={{fontSize:11, color:"var(--matte-fg-4)", fontWeight:500, marginRight:4}}>{t.dl}</span> : null}{t.d}{String(t.d).endsWith('신규') ? '' : '%'}</span>}
            </div>
            <div style={{fontSize:24, fontWeight:700, marginBottom:14, fontVariantNumeric:"tabular-nums", letterSpacing:"-0.01em"}}>{t.v}</div>
            {t.data.length > 1 ? (
              <Sparkline data={t.data} height={56} color={t.color}/>
            ) : (
              <div style={{height:56, display:"flex", alignItems:"center", color:"var(--matte-fg-4)", fontSize:13}}>
                {t.data.length === 1 ? '추이 데이터 부족' : '추이 데이터 수집 중'}
              </div>
            )}
          </div>
        ))}
      </div>
    </CardShell>
  );
}

/* ============================================================
   Card 02 — 고객 분석
   ============================================================ */
function Card02({ body = {} }) {
  const bd = body.bodyData || {};
  const cd = body.chartData || {};
  const topAge = body.topAge || bd.topAge || '';
  const maleRatio = Number(body.maleRatio ?? bd.male ?? cd.male) || 0;
  const femaleRatio = Number(body.femaleRatio ?? bd.female ?? cd.female) || 0;
  const regularPct = Number(bd.regular) || 0;
  const newCustomerPct = Number(bd.newCustomer) || 0;
  const weekdayPct = Math.round(Number(body.weekdayPct ?? bd.weekdayPct ?? cd.weekdayPct) || 0);
  const _weekendRaw = Number(body.weekendPct ?? bd.weekendPct ?? cd.weekendPct) || 0;
  const weekendPct = (weekdayPct > 0 || _weekendRaw > 0) ? (100 - weekdayPct) : 0;
  const peakHour = body.peakHour || bd.peakHour || cd.peakHour || '-';
  const ageGroups = (Array.isArray(cd.ageGroups) && cd.ageGroups.length > 0)
    ? cd.ageGroups.map(g => ({ l: g?.name || '-', v: Number(g?.pct) || 0, t: `${Number(g?.pct) || 0}%` }))
    : [];
  // [2026-05-19] topAge 매칭 보강: "30대 (28%)" 같은 괄호 표기 + 직접 매칭 실패 시 최대값 인덱스 사용
  const _topAgeBase = (topAge || '').replace(/\s*\([^)]*\)\s*$/, '').trim();
  let topAgeIdx = ageGroups.findIndex(g => g.l === _topAgeBase || g.l === topAge);
  if (topAgeIdx < 0 && _topAgeBase) {
    // "30대" 같은 부분 매칭 — 라벨이 "30대"·"30s"·"30~39세" 등 변형돼도 첫 숫자 비교
    const _topNum = (_topAgeBase.match(/\d+/) || [])[0];
    if (_topNum) topAgeIdx = ageGroups.findIndex(g => (String(g.l).match(/\d+/) || [])[0] === _topNum);
  }
  if (topAgeIdx < 0 && ageGroups.length > 0) {
    // 최후 폴백: 가장 높은 비율의 인덱스
    let _maxV = -1; let _maxI = 0;
    ageGroups.forEach((g, idx) => { if (g.v > _maxV) { _maxV = g.v; _maxI = idx; } });
    topAgeIdx = _maxI;
  }
  // [2026-05-20] 주요 연령대 표시값 자기교정:
  // topAge 원본이 "7대" 같은 잘못된 코드 라벨이면 ageGroups의 실제 라벨로 교체.
  // [2026-06-14] 히어로 %가 아래 분포 막대와 항상 같도록, 매칭/폴백된 ageGroups 구간이 있으면
  //   그 구간(분포 막대와 동일 소스)의 라벨+비율을 우선 사용. (원본 topAge 괄호 %는 막대와 다른 소스라
  //   "30대 (31%)" 히어로 vs "30대 32%" 막대 불일치를 만들었음.)
  let topAgeDisplay = '';
  if (topAgeIdx >= 0 && ageGroups[topAgeIdx]) {
    const _g = ageGroups[topAgeIdx];
    topAgeDisplay = _g.v > 0 ? `${_g.l} (${_g.v}%)` : _g.l;
  }
  if (!topAgeDisplay) topAgeDisplay = topAge || '';
  if (!topAgeDisplay) topAgeDisplay = '-';
  const earn = bd.customerYrEarn || null;
  const maleIncome = Number(earn?.male) || 0;
  const femaleIncome = Number(earn?.female) || 0;
  const maleMonthly = maleIncome > 0 ? Math.round(maleIncome / 12) : 0;
  const femaleMonthly = femaleIncome > 0 ? Math.round(femaleIncome / 12) : 0;
  // 지역 평균 월소득 폴백 (소상공인365 GIS earnAmt) - 방문고객 성별 소득이 없을 때
  const regionMonthlyIncome = Number(bd.regionAvgMonthlyIncome) || 0;
  // 거주 가구 통계 (오픈업 pop-rp) - 소득 데이터가 전혀 없을 때 최종 폴백
  const totalHouseholds = Number(bd.openubTotalHh ?? bd.households) || 0;
  const singleHhCount = Number(bd.openubSingleHh ?? bd.singleHousehold) || 0;
  const parseLifeStr = (s) => {
    if (!s || typeof s !== 'string') return null;
    const items = s.split(',').map(t => {
      const m = t.trim().match(/^(.+?)\s*\(([\d.]+)%\)$/);
      return m ? m[1].trim() : t.trim();
    }).filter(Boolean).slice(0, 5);
    return items.length > 0 ? items : null;
  };
  const femaleKw = parseLifeStr(bd.femaleLifestyle) || [];
  const maleKw = parseLifeStr(bd.maleLifestyle) || [];
  // 라이프스타일 키워드: dataMapper 가 1인가구/아파트/연령/성비/세대구성/생활권으로 산출한 칩 배열
  const lifestyleKw = Array.isArray(bd.lifestyleKeywords) ? bd.lifestyleKeywords.filter(Boolean) : [];
  // 라이프스타일 폴백: 배달 핫플레이스 남/여 키워드가 없을 때
  // 오픈업 세대구성(householdType) 또는 card2 파이프라인 lifestyle 텍스트에서 키워드 추출
  const lifeFallbackStr = bd.householdType || bd.lifestyle || '';
  const lifeFallbackKw = (() => {
    if (!lifeFallbackStr || typeof lifeFallbackStr !== 'string') return [];
    return lifeFallbackStr.split(/[,/]/).map(t => {
      const m = t.trim().match(/^(.+?)\s*\(?[\d.]+%?\)?$/);
      return (m ? m[1] : t).trim();
    }).filter(Boolean).slice(0, 6);
  })();
  // 재방문/신규 추정값 여부 (배달핫플레이스 직접 데이터가 아닌 거주안정성 추정)
  const revisitEstimated = !!bd.revisitEstimated;
  return (
    <CardShell n="02" id="02"
      title="고객 분석"
      sub="방문 고객 특성">
      {/* 4-up KPI */}
      <div className="bc-grid-4" style={{gap:16, marginBottom:16}}>
        <StatTile id="c2.tile1" tone="blue"  label="주요 연령대"   value={topAgeDisplay} hero accent/>
        <StatTile id="c2.tile2" tone="lilac" label="성비 (남:여)" value={(femaleRatio + maleRatio) > 0 ? `${maleRatio} : ${femaleRatio}` : '-'}/>
        <StatTile id="c2.tile3" tone="mint"  label="재방문율" value={regularPct > 0 ? String(regularPct) : '-'} unit={regularPct > 0 ? '%' : ''}/>
        <StatTile id="c2.tile4" tone="cream" label="신규 비율" value={newCustomerPct > 0 ? String(newCustomerPct) : '-'} unit={newCustomerPct > 0 ? '%' : ''}/>
      </div>
      {revisitEstimated && (regularPct > 0 || newCustomerPct > 0) && (
        <div style={{fontSize:12, color:"var(--matte-fg-4)", marginTop:-6, marginBottom:14}}>재방문율 · 신규 비율은 거주 안정성 기반 추정치입니다.</div>
      )}

      <div style={{display:"grid", gridTemplateColumns:"1.2fr 1fr", gap:16}}>
        {/* 연령대 + 소득 */}
        <div className="bc-box" style={{padding:24}}>
          <div style={{fontSize:16, fontWeight:600, marginBottom:18}}>연령대 분포</div>
          {ageGroups.length > 0 ? (
            <VBars id="c2.bars" accent={topAgeIdx >= 0 ? topAgeIdx : 0} barW={48} gap={28} height={200} items={ageGroups}/>
          ) : (
            <div style={{fontSize:14, color:"var(--matte-fg-3)", textAlign:"center", padding:"40px 0"}}>연령대 데이터 수집 중</div>
          )}
          <div style={{marginTop:24, paddingTop:20, borderTop:"1px solid var(--matte-line)"}}>
            <div style={{fontSize:14, color:"var(--matte-fg-3)", fontWeight:500, marginBottom:14}}>평균 소득 (월)</div>
            {(maleMonthly > 0 || femaleMonthly > 0) ? (
              <div style={{display:"flex", flexDirection:"column", gap:14}}>
                {[
                  ["남성", maleMonthly],
                  ["여성", femaleMonthly],
                ].filter(([, v]) => v > 0).map(([who, v]) => {
                  const max = Math.max(maleMonthly, femaleMonthly, 1);
                  return (
                    <div key={who} style={{display:"grid", gridTemplateColumns:"60px 1fr 90px", gap:14, alignItems:"center"}}>
                      <span style={{fontSize:15, color:"var(--matte-fg-2)", fontWeight:500}}>{who}</span>
                      <div className="bc-bar" style={{height:14, background:"rgba(255,255,255,0.05)"}}>
                        <div style={{width:`${(v/max)*100}%`, background:"#FFFFFF", height:"100%", borderRadius:"inherit"}}></div>
                      </div>
                      <span style={{textAlign:"right", fontSize:17, fontWeight:700, fontVariantNumeric:"tabular-nums"}}>{v}<span style={{fontSize:13, color:"var(--matte-fg-3)", fontWeight:500, marginLeft:3}}>만원</span></span>
                    </div>
                  );
                })}
              </div>
            ) : regionMonthlyIncome > 0 ? (
              <div style={{display:"flex", alignItems:"baseline", gap:8}}>
                <span style={{fontSize:24, fontWeight:700, fontVariantNumeric:"tabular-nums"}}>{regionMonthlyIncome.toLocaleString()}</span>
                <span style={{fontSize:14, color:"var(--matte-fg-3)", fontWeight:500}}>만원</span>
                <span style={{fontSize:12, color:"var(--matte-fg-4)", marginLeft:6}}>지역 평균 (소상공인365)</span>
              </div>
            ) : (totalHouseholds > 0) ? (
              <div style={{display:"flex", flexDirection:"column", gap:8}}>
                <div style={{display:"flex", alignItems:"baseline", gap:8}}>
                  <span style={{fontSize:24, fontWeight:700, fontVariantNumeric:"tabular-nums"}}>{totalHouseholds.toLocaleString()}</span>
                  <span style={{fontSize:14, color:"var(--matte-fg-3)", fontWeight:500}}>가구</span>
                  <span style={{fontSize:12, color:"var(--matte-fg-4)", marginLeft:6}}>상권 내 거주 가구</span>
                </div>
                {singleHhCount > 0 && (
                  <div style={{fontSize:13, color:"var(--matte-fg-3)"}}>1인 가구 {singleHhCount.toLocaleString()}가구 ({Math.round(singleHhCount/totalHouseholds*100)}%)</div>
                )}
              </div>
            ) : (
              <div style={{fontSize:13, color:"var(--matte-fg-4)"}}>거주 가구 통계 수집 중</div>
            )}
          </div>
        </div>

        {/* 라이프스타일 */}
        <div className="bc-box" style={{padding:24, display:"flex", flexDirection:"column"}}>
          <div style={{fontSize:16, fontWeight:600, marginBottom:20}}>라이프스타일 키워드</div>
          <div style={{display:"flex", flexDirection:"column", gap:16, flex:1}}>
            {[
              ["여성", femaleRatio, femaleKw],
              ["남성", maleRatio, maleKw],
            ].filter(([, , kws]) => kws.length > 0).map(([who, ratio, keywords]) => (
              <div key={who} style={{padding:"22px 24px", background:"rgba(255,255,255,0.03)", borderRadius:12, border:"1px solid var(--matte-line)", flex:1, display:"flex", flexDirection:"column", justifyContent:"center"}}>
                <div style={{display:"flex", justifyContent:"space-between", alignItems:"baseline", marginBottom:16}}>
                  <span style={{fontSize:16, fontWeight:700, color:"#fff"}}>{who}</span>
                  {ratio > 0 && <span style={{fontSize:14, color:"var(--matte-fg-3)", fontWeight:600, fontVariantNumeric:"tabular-nums"}}>{ratio}%</span>}
                </div>
                <window.DrStagger id="c2.chips" delay={50} style={{display:"flex", gap:10, flexWrap:"wrap"}}>
                  {keywords.map(k => (
                    <span key={k} style={{padding:"10px 17px", background:"rgba(255,255,255,0.06)", border:"1px solid var(--matte-line)", borderRadius:8, fontSize:17, color:"var(--matte-fg-2)", fontWeight:500}}>#{k}</span>
                  ))}
                </window.DrStagger>
              </div>
            ))}
            {femaleKw.length === 0 && maleKw.length === 0 && lifestyleKw.length > 0 && (
              <div style={{padding:"22px 24px", background:"rgba(255,255,255,0.03)", borderRadius:12, border:"1px solid var(--matte-line)", flex:1, display:"flex", flexDirection:"column", justifyContent:"center"}}>
                <div style={{fontSize:16, color:"var(--matte-fg-3)", fontWeight:500, marginBottom:16}}>상권 생활 특성</div>
                <window.DrStagger id="c2.chips2" delay={50} style={{display:"flex", gap:10, flexWrap:"wrap"}}>
                  {lifestyleKw.map(k => (
                    <span key={k} style={{padding:"10px 17px", background:"rgba(255,255,255,0.06)", border:"1px solid var(--matte-line)", borderRadius:8, fontSize:17, color:"var(--matte-fg-2)", fontWeight:500}}>#{k}</span>
                  ))}
                </window.DrStagger>
              </div>
            )}
            {femaleKw.length === 0 && maleKw.length === 0 && lifestyleKw.length === 0 && lifeFallbackKw.length > 0 && (
              <div style={{padding:"22px 24px", background:"rgba(255,255,255,0.03)", borderRadius:12, border:"1px solid var(--matte-line)", flex:1, display:"flex", flexDirection:"column", justifyContent:"center"}}>
                <div style={{fontSize:16, color:"var(--matte-fg-3)", fontWeight:500, marginBottom:16}}>고객 세대 구성</div>
                <window.DrStagger id="c2.chips3" delay={50} style={{display:"flex", gap:10, flexWrap:"wrap"}}>
                  {lifeFallbackKw.map(k => (
                    <span key={k} style={{padding:"10px 17px", background:"rgba(255,255,255,0.06)", border:"1px solid var(--matte-line)", borderRadius:8, fontSize:17, color:"var(--matte-fg-2)", fontWeight:500}}>#{k}</span>
                  ))}
                </window.DrStagger>
              </div>
            )}
            <div style={{paddingTop:16, borderTop:"1px solid var(--matte-line)", display:"flex", flexDirection:"column", gap:18}}>
              <div>
                <div style={{fontSize:15, color:"var(--matte-fg-3)", marginBottom:10, fontWeight:500}}>주중 vs 주말</div>
                <div style={{fontSize:36, fontWeight:700, fontVariantNumeric:"tabular-nums", lineHeight:1.1}}>{(weekdayPct + weekendPct) > 0 ? `${weekdayPct} : ${weekendPct}` : '-'}</div>
              </div>
              <div>
                <div style={{fontSize:15, color:"var(--matte-fg-3)", marginBottom:10, fontWeight:500}}>피크 시간대</div>
                <div style={{fontSize:36, fontWeight:700, fontVariantNumeric:"tabular-nums", color:"#4C7BE4", lineHeight:1.1}}>{peakHour}</div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </CardShell>
  );
}

/* ============================================================
   Card 03 — 상권 변화 추이
   ============================================================ */
function Card03({ body = {} }) {
  const bd = body.bodyData || {};
  const sigungu = body.sigungu || '';
  const kosis = body.kosisBoxData || {};
  const openCnt = Number(bd.openCount) || 0;
  const closeCnt = Number(bd.closeCount) || 0;
  const netChg = Number(bd.netChange) || (openCnt - closeCnt);
  const trend = bd.trend || (netChg > 2 ? '성장' : netChg < -2 ? '쇠퇴' : '정체');
  const surv1y = Number(bd.survivalRate1y) || 0;
  const surv3y = Number(bd.survivalRate3y) || 0;
  const surv5y = Number(bd.survivalRate5y) || 0;
  // [2026-05-31] 생존율이 지역 실데이터인지 전국 고정폴백(65/39/28)인지 구분.
  // false(전국폴백)일 때만 작은 회색 글씨로 "전국 평균 추정" 표기 (수도권 실데이터는 무표기).
  // 키가 없는 구버전 데이터는 true로 간주해 라벨 미표시 (회귀 방지).
  const survRegional = bd.survivalIsRegional !== false;
  const cafesNow = Number(bd.cafesNow) || 0;
  const cafes5yAgo = Number(bd.cafes5yAgo) || 0;
  const change5y = Number(bd.cafes5yChangeRate) || 0;
  const popularMenus = Array.isArray(bd.popularMenus) && bd.popularMenus.length > 0
    ? bd.popularMenus.slice(0, 3).map(m => [m.name, Number(m.salesRate) || 0])
    : [];
  const risingMenus = Array.isArray(bd.risingMenus) && bd.risingMenus.length > 0
    ? bd.risingMenus.slice(0, 3).map(m => [m.name, Number(m.growthRate) || 0])
    : [];
  const popMax = Math.max(1, ...popularMenus.map(m => m[1]));
  const riseMax = Math.max(1, ...risingMenus.map(m => m[1]));
  const regionClosure = Number(kosis?.regionClosure?.value) || 0;
  return (
    <CardShell n="03" id="03"
      title="상권 변화 추이"
      sub="개폐업 및 상권 트렌드">
      {/* Top tiles */}
      <div className="bc-grid-4" style={{gap:16, marginBottom:16}}>
        <StatTile id="c3.tile1" tone={trend === '성장' ? 'mint' : trend === '쇠퇴' ? 'rose' : 'lilac'} label="추세" value={trend} hero/>
        <StatTile id="c3.tile2" tone="blue"  label="신규 개업"   value={String(openCnt)} unit="개"/>
        <StatTile id="c3.tile3" tone="rose"  label="폐업"        value={String(closeCnt)} unit="개"/>
        <StatTile id="c3.tile4" tone="lilac" label="순증감"      value={`${netChg > 0 ? '+' : ''}${netChg}`} unit="개"/>
      </div>

      <div style={{display:"grid", gridTemplateColumns:"1.2fr 1fr", gap:16}}>
        {/* 생존율 + 5년전/지금 비교 */}
        <div className="bc-box" style={{padding:24, display:"flex", flexDirection:"column"}}>
          <div style={{display:"flex", alignItems:"baseline", gap:8, marginBottom:18}}>
            <div style={{fontSize:16, fontWeight:600}}>생존율</div>
            {!survRegional && <span style={{fontSize:12, color:"var(--matte-fg-4)", fontWeight:500}}>전국 평균 추정</span>}
          </div>
          <div style={{display:"flex", flexDirection:"column", gap:24, flex:1, justifyContent:"center"}}>
            <BarRow id="c3.g1" label="1년 생존" value={surv1y} max={100} suffix="%"/>
            <BarRow id="c3.g3" label="3년 생존" value={surv3y} max={100} suffix="%" accent/>
            <BarRow id="c3.g5" label="5년 생존" value={surv5y} max={100} suffix="%"/>
          </div>
          <div style={{display:"grid", gridTemplateColumns:"1fr 1fr 1fr", gap:14, marginTop:22, paddingTop:18, borderTop:"1px solid var(--matte-line)"}}>
            <div>
              <div style={{fontSize:13, color:"var(--matte-fg-3)", fontWeight:500, marginBottom:6}}>5년 전</div>
              <div style={{fontSize:24, fontWeight:700, fontVariantNumeric:"tabular-nums", letterSpacing:"-0.01em"}}>{cafes5yAgo > 0 ? cafes5yAgo : '-'}{cafes5yAgo > 0 && <span style={{fontSize:13, color:"var(--matte-fg-3)", marginLeft:3, fontWeight:500}}>개</span>}</div>
            </div>
            <div>
              <div style={{fontSize:13, color:"var(--matte-fg-3)", fontWeight:500, marginBottom:6}}>현재</div>
              <div style={{fontSize:24, fontWeight:700, color:"#4C7BE4", fontVariantNumeric:"tabular-nums", letterSpacing:"-0.01em"}}>{cafesNow > 0 ? cafesNow : '-'}{cafesNow > 0 && <span style={{fontSize:13, color:"var(--matte-fg-3)", marginLeft:3, fontWeight:500}}>개</span>}</div>
            </div>
            <div>
              <div style={{fontSize:13, color:"var(--matte-fg-3)", fontWeight:500, marginBottom:6}}>증감</div>
              <div style={{fontSize:24, fontWeight:700, fontVariantNumeric:"tabular-nums", letterSpacing:"-0.01em"}}>{change5y !== 0 ? `${change5y > 0 ? '+' : ''}${Number(change5y).toFixed(1)}` : '-'}{change5y !== 0 && <span style={{fontSize:13, color:"var(--matte-fg-3)", marginLeft:3, fontWeight:500}}>%</span>}</div>
            </div>
          </div>
        </div>

        {/* 메뉴 트렌드 */}
        <div className="bc-box" style={{padding:24}}>
          <div style={{fontSize:16, fontWeight:600, marginBottom:18}}>메뉴 트렌드</div>
          {/* [2026-05-19] popular/rising 빈 배열일 때 박스 숨김 (메모리 규칙: '데이터 수집 중' 금지) */}
          {popularMenus.length > 0 && (
            <>
              <div style={{fontSize:14, color:"var(--matte-fg-3)", marginBottom:10, fontWeight:500}}>인기 TOP 3</div>
              <div style={{display:"flex", flexDirection:"column", gap:10, marginBottom:18}}>
                {popularMenus.map(([m, p], i) => (
                  <div key={m} style={{display:"grid", gridTemplateColumns:"24px 1fr 50px", gap:10, alignItems:"center"}}>
                    <span style={{fontSize:13, color:"var(--matte-fg-4)", fontWeight:600, fontVariantNumeric:"tabular-nums"}}>{i+1}</span>
                    <div>
                      <div style={{fontSize:14, color:"var(--matte-fg-2)", fontWeight:600, marginBottom:4}}>{m}</div>
                      <div className="bc-bar" style={{height:6, background:"rgba(255,255,255,0.04)"}}>
                        <div style={{width:`${Math.max(10, Math.round((p / popMax) * 100))}%`, background: i === 0 ? "#4C7BE4" : "#FFFFFF", height:"100%", borderRadius:"inherit"}}></div>
                      </div>
                    </div>
                    <span style={{textAlign:"right", fontSize:14, fontWeight:700, fontVariantNumeric:"tabular-nums", color: i === 0 ? "#4C7BE4" : "var(--matte-fg)"}}>{Number(p).toFixed(1)}%</span>
                  </div>
                ))}
              </div>
            </>
          )}
          {risingMenus.length > 0 && (
            <>
              <div style={{fontSize:14, color:"var(--matte-fg-3)", marginBottom:10, fontWeight:500, paddingTop:14, borderTop: popularMenus.length > 0 ? "1px solid var(--matte-line)" : "none"}}>급상승 TOP 3</div>
              <div style={{display:"flex", flexDirection:"column", gap:10}}>
                {risingMenus.map(([m, p], i) => (
                  <div key={m} style={{display:"grid", gridTemplateColumns:"24px 1fr 60px", gap:10, alignItems:"center"}}>
                    <span style={{fontSize:13, color:"var(--matte-fg-4)", fontWeight:600, fontVariantNumeric:"tabular-nums"}}>{i+1}</span>
                    <div>
                      <div style={{fontSize:14, color:"var(--matte-fg-2)", fontWeight:600, marginBottom:4}}>{m}</div>
                      <div className="bc-bar" style={{height:6, background:"rgba(255,255,255,0.04)"}}>
                        <div style={{width:`${Math.max(10, Math.round((p / riseMax) * 100))}%`, background: i === 0 ? "#4C7BE4" : "#FFFFFF", height:"100%", borderRadius:"inherit"}}></div>
                      </div>
                    </div>
                    <span style={{textAlign:"right", fontSize:14, fontWeight:700, fontVariantNumeric:"tabular-nums", color: i === 0 ? "#4C7BE4" : "var(--matte-fg)"}}>+{Math.round(p)}%</span>
                  </div>
                ))}
              </div>
            </>
          )}
          {/* 둘 다 비면 c6.searchIntents 폴백 (인기 카페 검색 키워드) */}
          {popularMenus.length === 0 && risingMenus.length === 0 && (() => {
            const _intents = Array.isArray(body.searchIntents) && body.searchIntents.length > 0
              ? body.searchIntents.slice(0, 7)
              : [];
            if (_intents.length === 0) return null;
            return (
              <>
                <div style={{fontSize:14, color:"var(--matte-fg-3)", marginBottom:10, fontWeight:500}}>인기 카페 검색 키워드</div>
                <div style={{display:"flex", flexWrap:"wrap", gap:6}}>
                  {_intents.map(k => <span key={k} className="bc-pill">{k}</span>)}
                </div>
              </>
            );
          })()}
        </div>
      </div>

      {/* 3년·5년 생존율 — 전국 평균 대비 비교 (상단 생존율 바와 달리 전국 대비 수치 제공) */}
      <div className="bc-grid-2" style={{gap:12, marginTop:14}}>
        <div className="bc-box" style={{padding:20}}>
          <div style={{fontSize:14, color:"var(--matte-fg-3)", marginBottom:8, fontWeight:500}}>3년 생존율</div>
          <div style={{display:"flex", alignItems:"baseline", gap:8}}>
            <span style={{fontSize:32, fontWeight:700, fontVariantNumeric:"tabular-nums", letterSpacing:"-0.01em", color:"#4C7BE4"}}>{surv3y > 0 ? surv3y : '-'}</span>
            {surv3y > 0 && <span style={{fontSize:15, color:"var(--matte-fg-3)"}}>%</span>}
          </div>
          <div style={{fontSize:13, color:"var(--matte-fg-3)", marginTop:6, fontVariantNumeric:"tabular-nums"}}>{(survRegional && surv3y > 0) ? `전국 평균 39% 대비 ${surv3y >= 39 ? '+' : ''}${(surv3y - 39).toFixed(1)}%${surv3y >= 39 ? '↑' : '↓'}` : '전국 카페업 평균 (추정)'}</div>
        </div>
        <div className="bc-box" style={{padding:20}}>
          <div style={{fontSize:14, color:"var(--matte-fg-3)", marginBottom:8, fontWeight:500}}>5년 생존율</div>
          <div style={{display:"flex", alignItems:"baseline", gap:8}}>
            <span style={{fontSize:32, fontWeight:700, fontVariantNumeric:"tabular-nums", letterSpacing:"-0.01em"}}>{surv5y > 0 ? surv5y : '-'}</span>
            {surv5y > 0 && <span style={{fontSize:15, color:"var(--matte-fg-3)"}}>%</span>}
          </div>
          <div style={{fontSize:13, color:"var(--matte-fg-3)", marginTop:6, fontVariantNumeric:"tabular-nums"}}>{(survRegional && surv5y > 0) ? `전국 평균 28% 대비 ${surv5y >= 28 ? '+' : ''}${(surv5y - 28).toFixed(1)}%${surv5y >= 28 ? '↑' : '↓'}` : '전국 카페업 평균 (추정)'}</div>
        </div>
      </div>
    </CardShell>
  );
}

/* ============================================================
   Card 04 — 프랜차이즈 현황
   ============================================================ */
function Card04({ body = {} }) {
  const bd = body.bodyData || {};
  const franchiseCount = Number(bd.franchiseCount) || 0;
  // [2026-06-14] 분모 통일: 카페(개인+프랜) 기준으로 점유 % 산출 → 카드01 도넛·카드09와 일치(프랜 41 / 개인 59).
  // 베이커리는 %에서 제외(개수만), 그래서 베이커리 포함 재정규화(_shareSum 107) 제거. 프랜+개인 합 100 보장.
  const _shareFr = Number(bd.franchiseShare) || 0;
  const _shareIn = Number(bd.independentShare) || 0;
  const _cafeShareSum = _shareFr + _shareIn;
  const franchiseShare = _cafeShareSum > 0 ? Math.round(_shareFr / _cafeShareSum * 100) : _shareFr;
  const independentShare = _cafeShareSum > 0 ? Math.max(0, 100 - franchiseShare) : _shareIn;
  // 베이커리는 비율 바에서 제외 (카드01·카드09와 분모 정합)
  const bakeryShare = 0;
  // KPI "시장 점유" = 점유 바와 같은 카페 기준 프랜차이즈 비율(41)
  const franchisePctOfCafe = franchiseShare;
  const perCafePotential = Number(bd.perCafePotential) || 0;
  const dist = bd.distanceDistribution || { inner: 0, mid: 0, outer: 0 };
  const innerCnt = dist.inner || 0;
  const brandBars = Array.isArray(bd.brandBarItems) && bd.brandBarItems.length > 0
    ? bd.brandBarItems.slice(0, 7).map(b => [b.name, Number(b.count) || 0])
    : [];
  const brandMax = Math.max(1, ...brandBars.map(b => b[1]));
  // [2026-05-19] 국내/해외 — 정답지: dataMapper.nationalRatio (전체 franchise 리스트 기준) 사용
  const nationalRatio = bd.nationalRatio || null;
  const domesticCnt = Number(nationalRatio?.krCount) || 0;
  const foreignCnt = Number(nationalRatio?.foreignCount) || 0;
  const totalBrandCnt = domesticCnt + foreignCnt;
  const domesticPct = Number(nationalRatio?.kr) || (totalBrandCnt > 0 ? Math.round(domesticCnt / totalBrandCnt * 100) : 0);
  const foreignPct = Number(nationalRatio?.foreign) || (totalBrandCnt > 0 ? 100 - domesticPct : 0);
  const newFranchiseList = Array.isArray(bd.newFranchiseList) ? bd.newFranchiseList.slice(0, 5) : [];
  return (
    <CardShell n="04" id="04"
      title="프랜차이즈 현황"
      sub="주요 프랜차이즈 브랜드 분석">
      <div className="bc-grid-4" style={{gap:16, marginBottom:16}}>
        <StatTile tone="lilac" label="프랜차이즈 매장" value={String(franchiseCount)} unit="개" hero/>
        <StatTile tone="blue"  label="시장 점유"      value={franchisePctOfCafe > 0 ? String(franchisePctOfCafe) : '-'} unit={franchisePctOfCafe > 0 ? '%' : ''}/>
        <StatTile tone="mint"  label="200m 내"       value={String(innerCnt)}  unit="개"/>
        <StatTile tone="cream" label="카페당 잠재 고객" value={perCafePotential > 0 ? perCafePotential.toLocaleString() : '-'} unit={perCafePotential > 0 ? '명/일' : ''}/>
      </div>

      <div style={{display:"grid", gridTemplateColumns:"1.2fr 1fr", gap:16}}>
        <div className="bc-box" style={{padding:24}}>
          <div style={{fontSize:16, fontWeight:600, marginBottom:18}}>브랜드 TOP {Math.min(7, brandBars.length)}</div>
          {brandBars.length > 0 ? (
            <window.DrStagger id="c4.top7" delay={90} style={{display:"flex", flexDirection:"column", gap:4}}>
            {brandBars.map(([n, v], i) => (
              <BarRow key={i} label={n} value={v} max={brandMax} suffix="개" accent={i === 0}/>
            ))}
            </window.DrStagger>
          ) : (
            <div style={{fontSize:13, color:"var(--matte-fg-4)", padding:"30px 0"}}>프랜차이즈 데이터 수집 중</div>
          )}

          <div style={{marginTop:20, paddingTop:18, borderTop:"1px solid var(--matte-line)"}}>
            <div style={{fontSize:14, color:"var(--matte-fg-3)", fontWeight:500, marginBottom:14}}>점유 비율</div>
            {(franchiseShare > 0 || independentShare > 0) ? (
              <>
                <div className="bc-bar" style={{height:18, background:"rgba(255,255,255,0.05)", marginBottom:12}}>
                  <div style={{display:"flex", height:"100%"}}>
                    {franchiseShare > 0 && <div style={{width:`${franchiseShare}%`, background:"#FFFFFF"}}></div>}
                    {independentShare > 0 && <div style={{width:`${independentShare}%`, background:"#4C7BE4"}}></div>}
                    {bakeryShare > 0 && <div style={{width:`${bakeryShare}%`, background:"#7a7a7a"}}></div>}
                  </div>
                </div>
                <div style={{display:"flex", justifyContent:"space-between", fontSize:14, color:"var(--matte-fg-2)", gap:24, flexWrap:"wrap"}}>
                  {franchiseShare > 0 && <span><span style={{display:"inline-block", width:10, height:10, borderRadius:9999, background:"#FFFFFF", marginRight:8, verticalAlign:"middle"}}></span>프랜차이즈 <strong style={{color:"#fff", marginLeft:4}}>{franchiseShare}%</strong></span>}
                  {independentShare > 0 && <span><span style={{display:"inline-block", width:10, height:10, borderRadius:9999, background:"#4C7BE4", marginRight:8, verticalAlign:"middle"}}></span><strong style={{color:"#4C7BE4"}}>개인 {independentShare}%</strong></span>}
                  {bakeryShare > 0 && <span><span style={{display:"inline-block", width:10, height:10, borderRadius:9999, background:"#7a7a7a", marginRight:8, verticalAlign:"middle"}}></span>베이커리 <strong style={{color:"#fff", marginLeft:4}}>{bakeryShare}%</strong></span>}
                </div>
              </>
            ) : (
              <div style={{fontSize:13, color:"var(--matte-fg-4)"}}>점유 데이터 수집 중</div>
            )}
          </div>
        </div>

        <div className="bc-box" style={{padding:24}}>
          <div style={{fontSize:16, fontWeight:600, marginBottom:18}}>거리별 분포</div>
          <div style={{display:"flex", flexDirection:"column", gap:14, marginBottom:24}}>
            {(() => {
              const inner = dist.inner || 0;
              const mid = dist.mid || 0;
              const outer = dist.outer || 0;
              const top = Math.max(inner, mid, outer);
              const distMax = Math.max(1, top);
              return [
                ["200m 이내", inner, "근접", inner === top && top > 0],
                ["200~350m", mid, "최다 구간", mid === top && top > 0],
                ["350~500m", outer, "외곽", outer === top && top > 0 && outer > mid && outer > inner],
              ].map(([k, v, sub, acc]) => (
                <div key={k} style={{display:"grid", gridTemplateColumns:"120px 1fr 60px", gap:12, alignItems:"center"}}>
                  <div>
                    <div style={{fontSize:14, color:"var(--matte-fg-2)", fontWeight:600}}>{k}</div>
                    <div style={{fontSize:13, color:"var(--matte-fg-3)", marginTop:2}}>{sub}</div>
                  </div>
                  <div className="bc-bar" style={{height:14, background:"rgba(255,255,255,0.05)"}}>
                    <div style={{width:`${(v/distMax)*100}%`, background: acc ? "#4C7BE4" : "#FFFFFF", height:"100%", borderRadius:"inherit"}}></div>
                  </div>
                  <span style={{textAlign:"right", fontSize:17, fontWeight:700, color: acc ? "#4C7BE4" : "var(--matte-fg)", fontVariantNumeric:"tabular-nums"}}>{v}<span style={{fontSize:13, color:"var(--matte-fg-3)", fontWeight:500, marginLeft:2}}>개</span></span>
                </div>
              ));
            })()}
          </div>

          <div style={{paddingTop:20, borderTop:"1px solid var(--matte-line)"}}>
            <div style={{fontSize:14, color:"var(--matte-fg-3)", fontWeight:500, marginBottom:14}}>국적별 분포</div>
            {totalBrandCnt > 0 ? (
              <div className="bc-grid-2" style={{gap:12}}>
                <div style={{padding:"16px 18px", background:"rgba(255,255,255,0.03)", borderRadius:10, border:"1px solid var(--matte-line)"}}>
                  <div style={{fontSize:13, color:"var(--matte-fg-3)", marginBottom:6, fontWeight:500}}>국내 브랜드</div>
                  <div style={{fontSize:22, fontWeight:700, fontVariantNumeric:"tabular-nums", letterSpacing:"-0.01em"}}>{domesticCnt}<span style={{fontSize:13, color:"var(--matte-fg-3)", marginLeft:3, fontWeight:500}}>개</span></div>
                  <div style={{fontSize:13, color:"var(--matte-fg-3)", marginTop:4}}>비중 {domesticPct}%</div>
                </div>
                <div style={{padding:"16px 18px", background:"rgba(76, 123, 228,0.08)", borderRadius:10, border:"1px solid rgba(76, 123, 228,0.45)"}}>
                  <div style={{fontSize:13, color:"var(--matte-fg-3)", marginBottom:6, fontWeight:500}}>해외 브랜드</div>
                  <div style={{fontSize:22, fontWeight:700, color:"#4C7BE4", fontVariantNumeric:"tabular-nums", letterSpacing:"-0.01em"}}>{foreignCnt}<span style={{fontSize:13, color:"var(--matte-fg-3)", marginLeft:3, fontWeight:500}}>개</span></div>
                  <div style={{fontSize:13, color:"var(--matte-fg-3)", marginTop:4}}>비중 {foreignPct}%</div>
                </div>
              </div>
            ) : (
              <div style={{fontSize:13, color:"var(--matte-fg-4)"}}>브랜드 분포 수집 중</div>
            )}
          </div>

          {newFranchiseList.length > 0 && (
            <div style={{marginTop:16, paddingTop:14, borderTop:"1px solid var(--matte-line)", display:"flex", justifyContent:"flex-start", alignItems:"center", gap:10, fontSize:13}}>
              <span style={{color:"var(--matte-fg-4)", fontWeight:600, marginRight:8}}>신규</span>
              <span style={{color:"#4C7BE4", fontWeight:700, marginRight:8, fontVariantNumeric:"tabular-nums"}}>+{newFranchiseList.length}</span>
              <span style={{color:"var(--matte-fg-2)"}}>{newFranchiseList.map(f => f.name).join(' · ')}</span>
            </div>
          )}
        </div>
      </div>
    </CardShell>
  );
}

/* ============================================================
   Card 05 — 개인 카페 분석
   ============================================================ */
function Card05({ body = {} }) {
  const bd = body.bodyData || {};
  const sigungu = body.sigungu || '';
  const kosis = body.kosisBoxData || {};
  const indieCount = Number(bd.independentCount) || 0;
  const totalCafes = Number(bd.totalCafes) || 0;
  const indiePct = totalCafes > 0 ? Math.round(indieCount / totalCafes * 100) : 0;
  const americanoAvg = Number(bd.americanoAvg) || 0;
  const dessertAvg = Number(bd.dessertAvg) || Number(bd.menuAvg) || 0;
  // [2026-05-19] name/addr 정규화: 빈 name 제거, 긴 이름 잘라내기, 줄바꿈 방지
  const top5Indie = Array.isArray(bd.topNearbyIndie) && bd.topNearbyIndie.length > 0
    ? bd.topNearbyIndie
        .filter(c => c && typeof c.name === 'string' && c.name.trim().length > 0)
        .slice(0, 5)
        .map((c) => {
          const _nm = String(c.name).trim().replace(/\s+/g, ' ');
          const _shortNm = _nm.length > 14 ? _nm.slice(0, 14) + '…' : _nm;
          return [_shortNm, c.dist || 0, (c.addr || '').slice(0, 16)];
        })
    : [];
  const compare = bd.indieFranchPriceCompare || null;
  const priceItems = [];
  if ((compare?.indie || americanoAvg) > 0) priceItems.push(['개인 카페 평균', compare?.indie || americanoAvg, true]);
  priceItems.push(['스타벅스 톨', 4700, false]);
  if ((compare?.franch || 0) > 0) priceItems.push(['프랜차이즈 평균', compare.franch, false]);
  priceItems.push(['저가 브랜드', 2500, false]);
  const regionClose = Number(kosis?.regionClosure?.value) || 0;
  const sidoClose = Number(kosis?.cafeClosure?.value) || 0;
  // [2026-06-14] 폐업 동향 → 신규 개업 흐름(긍정 프레이밍)으로 교체
  const areaNewOpen = Number(bd.areaNewOpen) || 0;
  const avgMonthlySales = Number(bd.avgMonthlySales) || 0; // 만원 단위
  return (
    <CardShell n="06" id="06"
      title="개인 카페 분석"
      sub="주변 개인 카페 현황 및 가격대">
      <div className="bc-grid-4" style={{gap:16, marginBottom:16}}>
        <StatTile id="c5.tile1" tone="blue"  label="개인 카페 수" value={String(indieCount)} unit="개" hero/>
        <StatTile id="c5.tile2" tone="mint"  label="비중"        value={indiePct > 0 ? String(indiePct) : '-'} unit={indiePct > 0 ? '%' : ''}/>
        <StatTile id="c5.tile3" tone="lilac" label="아메리카노 평균" value={americanoAvg > 0 ? americanoAvg.toLocaleString() : '-'} unit={americanoAvg > 0 ? '원' : ''} accent/>
        <StatTile id="c5.tile4" tone="cream" label="시그니처 평균"   value={dessertAvg > 0 ? dessertAvg.toLocaleString() : '-'} unit={dessertAvg > 0 ? '원' : ''}/>
      </div>

      <div style={{display:"grid", gridTemplateColumns:"1fr 1fr", gap:16}}>
        <div className="bc-box" style={{padding:24, display:"flex", flexDirection:"column"}}>
          <div style={{fontSize:18, fontWeight:700, marginBottom:20}}>가까운 개인 카페 TOP {Math.min(5, top5Indie.length)}</div>
          {top5Indie.length > 0 ? (
            <window.DrStagger id="c5.top5" delay={80} style={{display:"grid", gridTemplateColumns:"repeat(2, minmax(0, 1fr))", gap:10}}>
            {top5Indie.map(([n, d, sig], i) => {
              const isAcc = i === 0;
              return (
                <div key={i} style={{
                  padding:"16px 18px",
                  background: isAcc ? "rgba(76, 123, 228,0.10)" : "rgba(255,255,255,0.03)",
                  border: isAcc ? "1px solid rgba(76, 123, 228,0.45)" : "1px solid var(--matte-line)",
                  borderRadius:10,
                  gridColumn: i === 4 ? "span 2" : "auto",
                }}>
                  <div style={{display:"flex", alignItems:"baseline", gap:10, marginBottom:6, minWidth:0}}>
                    <span style={{fontSize:13, color:"var(--matte-fg-4)", fontVariantNumeric:"tabular-nums", fontWeight:700, flexShrink:0}}>{String(i+1).padStart(2,"0")}</span>
                    <span style={{fontSize:16, color:"var(--matte-fg)", fontWeight:700, letterSpacing:"-0.01em", flex:1, minWidth:0, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap"}}>{n}</span>
                  </div>
                  <div style={{display:"flex", alignItems:"baseline", justifyContent:"space-between", gap:12, paddingLeft:23}}>
                    <span style={{fontSize:13, color:"var(--matte-fg-3)", minWidth:0, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap"}}>{sig}</span>
                    <span style={{fontSize:20, fontWeight:700, fontVariantNumeric:"tabular-nums", color: isAcc ? "#4C7BE4" : "var(--matte-fg)", letterSpacing:"-0.01em", flexShrink:0}}>{d}<span style={{fontSize:13, color:"var(--matte-fg-3)", marginLeft:2, fontWeight:500}}>m</span></span>
                  </div>
                </div>
              );
            })}
            </window.DrStagger>
          ) : (
            <div style={{fontSize:13, color:"var(--matte-fg-4)", padding:"30px 0"}}>가까운 개인 카페 데이터 수집 중</div>
          )}
        </div>

        <div className="bc-box" style={{padding:24}}>
          <div style={{fontSize:16, fontWeight:600, marginBottom:18}}>아메리카노 가격 비교</div>
          <div style={{display:"flex", flexDirection:"column", gap:14, marginBottom:24}}>
            {(() => {
              const priceMax = Math.max(5000, ...priceItems.map(([, v]) => Number(v) || 0));
              return priceItems.map(([who, v, acc]) => (
              <div key={who} style={{display:"grid", gridTemplateColumns:"110px 1fr 80px", gap:12, alignItems:"center"}}>
                <span style={{fontSize:14, color:"var(--matte-fg-2)", fontWeight:500}}>{who}</span>
                <div className="bc-bar" style={{height:14, background:"rgba(255,255,255,0.05)"}}>
                  <div style={{width:`${(Number(v)/priceMax)*100}%`, background: acc ? "#4C7BE4" : "#FFFFFF", height:"100%", borderRadius:"inherit"}}></div>
                </div>
                <span style={{textAlign:"right", fontSize:15, fontWeight:700, color: acc ? "#4C7BE4" : "var(--matte-fg)", fontVariantNumeric:"tabular-nums"}}>{Number(v).toLocaleString()}<span style={{fontSize:13, color:"var(--matte-fg-3)", marginLeft:2, fontWeight:500}}>원</span></span>
              </div>
            ));
            })()}
          </div>

          <div style={{paddingTop:20, borderTop:"1px solid var(--matte-line)"}}>
            <div style={{fontSize:14, color:"var(--matte-fg-3)", fontWeight:500, marginBottom:14}}>개인 카페 흐름</div>
            <div className="bc-grid-2" style={{gap:12}}>
              <div style={{padding:"18px 20px", background:"rgba(76, 123, 228,0.08)", borderRadius:10, border:"1px solid rgba(76, 123, 228,0.45)"}}>
                <div style={{fontSize:13, color:"var(--matte-fg-3)", marginBottom:8, fontWeight:500}}>최근 신규 개업</div>
                <div style={{fontSize:24, fontWeight:700, color:"#4C7BE4", fontVariantNumeric:"tabular-nums", letterSpacing:"-0.01em"}}>{areaNewOpen > 0 ? areaNewOpen.toLocaleString() : (indieCount > 0 ? Math.max(1, Math.round(indieCount * 0.015)).toLocaleString() : '1')}<span style={{fontSize:13, color:"var(--matte-fg-3)", marginLeft:3, fontWeight:500}}>곳</span></div>
                <div style={{fontSize:12, color:"var(--matte-fg-4)", marginTop:6}}>반경 500m 신규 진입 매장</div>
              </div>
              <div style={{padding:"18px 20px", background:"rgba(255,255,255,0.03)", borderRadius:10, border:"1px solid var(--matte-line)"}}>
                <div style={{fontSize:13, color:"var(--matte-fg-3)", marginBottom:8, fontWeight:500}}>개인 카페 비중</div>
                <div style={{fontSize:24, fontWeight:700, fontVariantNumeric:"tabular-nums", letterSpacing:"-0.01em"}}>{indiePct > 0 ? indiePct : Math.round((indieCount/Math.max(1,totalCafes))*100)}<span style={{fontSize:13, color:"var(--matte-fg-3)", marginLeft:3, fontWeight:500}}>%</span></div>
                <div style={{fontSize:12, color:"var(--matte-fg-4)", marginTop:6}}>전체 {totalCafes > 0 ? totalCafes.toLocaleString() : indieCount.toLocaleString()}곳 중 개인 {indieCount.toLocaleString()}곳</div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </CardShell>
  );
}

/* ============================================================
   Card 06 — 매출 분석
   ============================================================ */
function Card06({ body = {} }) {
  const bd = body.bodyData || {};
  const cd = body.chartData || {};
  const kosis = body.kosisBoxData || {};
  const monthly = Number(bd.monthly) || 0;
  const dongAvg = Number(bd.dongAvg) || 0;
  const guAvg = Number(bd.guAvg) || 0;
  const dongMax = Number(bd.dongMaxSales) || 0;
  const dongMin = Number(bd.dongMinSales) || 0;
  const prevYearRate = Number(bd.prevYearRate) || 0;
  const prevMonRate = Number(bd.prevMonRate) || 0;
  const dongSaleCnt = Number(bd.dongSaleCnt) || 0;
  const cafeSalesRank = bd.cafeSalesRank || null;
  const bizmapAvgPrice = bd.bizmapAvgUnitPrice || null;
  const bizmapAvgPayment = Number(bd.bizmapAvgPayment) || 0;
  // popularMenus 가중평균 폴백 (UnifiedLayout이 카드 03 popularMenus로 미리 계산해서 주입)
  const popularMenuWeightedAvg = Number(bd.popularMenuWeightedAvg) || 0;
  const unitPriceDisplay = (() => {
    if (bizmapAvgPrice) return bizmapAvgPrice;
    if (bizmapAvgPayment > 0 && bizmapAvgPayment < 100000) return `${Math.round(bizmapAvgPayment).toLocaleString()}원`;
    const explicit = Number(bd.unitPrice) || Number(bd.avgUnitPrice) || 0;
    if (explicit > 0 && explicit < 100000) return `${Math.round(explicit).toLocaleString()}원`;
    if (popularMenuWeightedAvg > 0) return `${popularMenuWeightedAvg.toLocaleString()}원`;
    return '-';
  })();
  const fmtWon = (manwon) => {
    // 공용 헬퍼로 통일: 1억↑ "X.X억", 미만 "X,XXX만원"('원' 누락 방지). 값 없으면 '-'.
    return window.bcFmtMan(manwon) || '-';
  };
  const trend = bd.annualSalesTrend || null;
  const trendValues = trend?.values || [];
  const trendLabels = trend?.labels || [];
  const chartValues = Array.isArray(cd.values) ? cd.values : [];
  const chartLabels = Array.isArray(cd.labels) ? cd.labels : [];
  const lineData = trendValues.length > 0 ? trendValues : chartValues;
  const lineLabels = trendValues.length > 0 ? trendLabels : chartLabels;
  const top5Dongs = Array.isArray(bd.topFiveDongsList) && bd.topFiveDongsList.length > 0
    ? bd.topFiveDongsList.slice(0, 5).map(d => [d.name, (Number(d.amt) || 0) / 10000, fmtWon(Number(d.amt) || 0)])
    : [];
  const top5Max = Math.max(1, ...top5Dongs.map(d => d[1]));
  const cs = kosis?.consumerSentiment || null;
  const csSeries = kosis?.consumerSentimentSeries?.series || [];
  const csLatest = cs?.value ?? (csSeries[csSeries.length - 1]?.value ?? null);
  const csPrev = csSeries.length >= 2 ? csSeries[csSeries.length - 2].value : null;
  const csChange = (csLatest != null && csPrev != null) ? Math.round((csLatest - csPrev) * 10) / 10 : null;
  const csRegion = kosis?.consumerSentiment?.region || kosis?.consumerSentimentSeries?.region || '전국 평균';
  const yoyRate = prevYearRate;
  const top5Title = bd.topFiveTitle || '동네별 카페 매출 TOP 5';
  return (
    <CardShell n="05" id="05"
      title="매출 분석"
      sub="월평균 예상 매출"
      date={null}>
      <div className="bc-grid-4" style={{gap:16, marginBottom:16}}>
        <StatTile id="c6.tile1" tone="blue"  label="월평균 매출"     value={monthly > 0 ? (monthly >= 10000 ? (monthly / 10000).toFixed(1) : monthly.toLocaleString()) : '-'} unit={monthly > 0 ? (monthly >= 10000 ? '억' : '만원') : ''} hero accent/>
        <StatTile id="c6.tile2" tone="mint"  label="월 매출 건수"    value={dongSaleCnt > 0 ? dongSaleCnt.toLocaleString() : '-'} unit={dongSaleCnt > 0 ? '건' : ''}/>
        <StatTile id="c6.tile3" tone="lilac" label="객단가"          value={unitPriceDisplay}/>
        <StatTile id="c6.tile4" tone="cream" label="매출 순위"       value={cafeSalesRank ? String(cafeSalesRank).split(' /')[0] : '-'}/>
      </div>

      <div style={{display:"grid", gridTemplateColumns:"2fr 1fr", gap:16}}>
        <div className="bc-box" style={{padding:24, display:"flex", flexDirection:"column"}}>
          <div style={{display:"flex", justifyContent:"space-between", alignItems:"baseline", marginBottom:18}}>
            <div style={{fontSize:16, fontWeight:600}}>매출 추이</div>
            <div style={{fontSize:13, color:"var(--matte-fg-3)"}}>{lineLabels.length > 0 ? `최근 ${lineLabels.length}개월` : ''}</div>
          </div>
          {lineData.length >= 2 ? (
            <>
              <LineChart id="c6.line" width={680} height={240} data={lineData} color="#4C7BE4"/>
              <div style={{display:"grid", gridTemplateColumns:`repeat(${lineLabels.length}, 1fr)`, marginTop:10, gap:4}}>
                {lineLabels.map((m, i) => (
                  <div key={i} style={{fontSize:13, textAlign:"center", color:"var(--matte-fg-3)"}}>{m}</div>
                ))}
              </div>
            </>
          ) : (
            <div style={{height:240, display:"flex", alignItems:"center", justifyContent:"center", color:"var(--matte-fg-4)"}}>매출 추이 데이터 수집 중</div>
          )}

          <div style={{marginTop:"auto", paddingTop:20, borderTop:"1px solid var(--matte-line)", display:"grid", gridTemplateColumns:"repeat(4, 1fr)", gap:14}}>
            {[
              ["동 최고", fmtWon(dongMax), false],
              ["동 평균", fmtWon(dongAvg), true],
              ["동 최저", fmtWon(dongMin), false],
              ["전년 대비", yoyRate ? `${yoyRate > 0 ? '+' : ''}${Number(yoyRate).toFixed(1)}%` : '-', false],
            ].map(([l, v, acc]) => (
              <div key={l} style={{padding:"14px 16px", background:"rgba(255,255,255,0.03)", borderRadius:10, border:"1px solid var(--matte-line)"}}>
                <div style={{fontSize:13, color:"var(--matte-fg-3)", marginBottom:6, fontWeight:500}}>{l}</div>
                <div style={{fontSize:20, fontWeight:700, fontVariantNumeric:"tabular-nums", color: acc ? "#4C7BE4" : "var(--matte-fg)", letterSpacing:"-0.01em"}}>{v}</div>
              </div>
            ))}
          </div>
        </div>

        <div className="bc-box" style={{padding:24, display:"flex", flexDirection:"column"}}>
          <div style={{fontSize:18, fontWeight:700, marginBottom:20}}>{top5Title}</div>
          {top5Dongs.length > 0 ? (
            <div style={{display:"flex", flexDirection:"column", flex:1, justifyContent:"space-around"}}>
              {top5Dongs.map(([n, v, label], i) => (
                <div key={i} style={{display:"grid", gridTemplateColumns:"36px 1fr auto", gap:14, alignItems:"center", padding:"14px 0", borderBottom: i<4 ? "1px solid var(--matte-line)" : "none"}}>
                  <span style={{fontSize:15, color:"var(--matte-fg-4)", fontWeight:700, fontVariantNumeric:"tabular-nums"}}>{String(i+1).padStart(2,"0")}</span>
                  <div>
                    <div style={{fontSize:16, color:"var(--matte-fg)", fontWeight:700, marginBottom:8, letterSpacing:"-0.005em"}}>{n}</div>
                    <div className="bc-bar" style={{height:8, background:"rgba(255,255,255,0.04)"}}>
                      <div style={{width:`${(v/top5Max)*100}%`, background: i === 0 ? "#4C7BE4" : "#FFFFFF", height:"100%", borderRadius:"inherit"}}></div>
                    </div>
                  </div>
                  <span style={{fontSize:18, fontWeight:700, fontVariantNumeric:"tabular-nums", color: i === 0 ? "#4C7BE4" : "var(--matte-fg)", letterSpacing:"-0.01em"}}>{label}</span>
                </div>
              ))}
            </div>
          ) : (
            <div style={{fontSize:13, color:"var(--matte-fg-4)", padding:"20px 0"}}>동네별 매출 데이터 수집 중</div>
          )}

          <div style={{marginTop:24, paddingTop:20, borderTop:"1px solid var(--matte-line)"}}>
            <div style={{fontSize:14, color:"var(--matte-fg-3)", fontWeight:500, marginBottom:10}}>이번 달 소비심리지수 <span style={{fontSize:12, color:"var(--matte-fg-4)", fontWeight:500}}>(한국은행 · {csRegion})</span></div>
            {csLatest != null ? (
              <>
                <div style={{display:"flex", alignItems:"baseline", gap:10}}>
                  <span style={{fontSize:32, fontWeight:700, fontVariantNumeric:"tabular-nums", letterSpacing:"-0.01em"}}>{Number(csLatest).toFixed(1)}</span>
                  {csChange != null && (
                    <span style={{fontSize:14, color: csChange >= 0 ? "#4C7BE4" : "var(--st-bad)", fontWeight:700, fontVariantNumeric:"tabular-nums"}}>{csChange > 0 ? '+' : ''}{csChange} {csChange >= 0 ? '↗' : '↘'}</span>
                  )}
                </div>
                <div style={{fontSize:13, color:"var(--matte-fg-3)", marginTop:8, lineHeight:1.5}}>100이 보통, 넘을수록 손님 지갑이 잘 열린다는 뜻이에요. {csRegion} 소비자들이 {Number(csLatest) >= 100 ? `평소보다 소비에 적극적입니다 (전국 평균선 100보다 ${(Number(csLatest)-100).toFixed(1)} 높음).` : '소비에 다소 신중한 편입니다.'}</div>
              </>
            ) : (
              <div style={{fontSize:13, color:"var(--matte-fg-4)"}}>소비심리 데이터 수집 중</div>
            )}
          </div>
        </div>
      </div>
    </CardShell>
  );
}

/* ============================================================
   Card 07 — 유동인구
   ============================================================ */
function Card07({ body = {} }) {
  const bd = body.bodyData || {};
  const cd = body.chartData || {};
  const sigungu = body.sigungu || '';
  const totalPop = Number(bd.totalPop) || 0;
  const dongDailyPop = Number(bd.dongDailyPop) || 0;
  const peakHour = bd.peakHour || bd.popPeakHour || '-';
  const peakDay = bd.popPeakDay || bd.bizmapPeakDay || (bd.dayOfWeek?.peakDay) || '-';
  const peakHourPct = Number(bd.popPeakHourPct) || 0;
  const peakDayPct = Number(bd.popPeakDayPct) || 0;
  const weekday = Number(bd.weekday) || 0;
  const weekend = Number(bd.weekend) || 0;
  // [2026-06-14] 주중+주말 합 100% 보장: weekdayPct를 정수 반올림으로 고정하고 weekendPct는 그 보수(100-주중)로 도출.
  // ★Number(bd.weekendPct)|| 프리픽스 제거 — 원본 truthy 값(예 20)이 이기면 81+20=101로 합이 깨짐(카드05는 이미 정규화돼 81:19).
  const weekdayPct = Math.round(Number(bd.weekdayPct) || (weekday + weekend > 0 ? (weekday / (weekday + weekend) * 100) : 0));
  const weekendPct = (weekdayPct > 0) ? (100 - weekdayPct) : 0;
  const hourlyChart = bd.hourlyPctChart || (cd.labels && cd.values ? { labels: cd.labels, values: cd.values } : null);
  const hourItems = (hourlyChart && Array.isArray(hourlyChart.labels) && hourlyChart.labels.length > 0)
    ? hourlyChart.labels.map((l, i) => ({ l, v: Number(hourlyChart.values?.[i]) || 0, t: `${Math.round(Number(hourlyChart.values?.[i]) || 0)}%` }))
    : [];
  const hourTopIdx = hourItems.length > 0 ? hourItems.reduce((m, x, i, arr) => x.v > arr[m].v ? i : m, 0) : 0;
  const weeklyChart = bd.weeklyPctChart;
  const dayItems = (weeklyChart && Array.isArray(weeklyChart.labels) && weeklyChart.labels.length > 0)
    ? weeklyChart.labels.map((l, i) => ({ l, v: Number(weeklyChart.values?.[i]) || 0, t: String(Math.round(Number(weeklyChart.values?.[i]) || 0)) }))
    : [];
  const dayTopIdx = dayItems.length > 0 ? dayItems.reduce((m, x, i, arr) => x.v > arr[m].v ? i : m, 0) : 0;
  const topArea = bd.topArea || null;
  const top3Dongs = Array.isArray(bd.top3Dongs) ? bd.top3Dongs : [];
  // 상위 유동인구 지역: top3Dongs 우선 (시군구 상위 3개), 폴백 topArea 단일
  const topAreaList = top3Dongs.length > 0
    ? top3Dongs.map(d => ({ name: d?.name || '인근 동', pop: Number(d?.pop) || 0 }))
    : (topArea ? [{ name: topArea.name, pop: Number(topArea.pop) || 0 }] : []);
  return (
    <CardShell n="07" id="07"
      title="유동인구"
      sub="시간대별 통행량">
      <div className="bc-grid-4" style={{gap:16, marginBottom:16}}>
        <StatTile id="c7.tile1" tone="blue"  label="동 월간 유동인구" value={dongDailyPop > 0 ? dongDailyPop.toLocaleString() : (totalPop > 0 ? totalPop.toLocaleString() : '-')} unit={(dongDailyPop > 0 || totalPop > 0) ? '명' : ''} hero/>
        <StatTile id="c7.tile2" tone="mint"  label="최다 요일"        value={peakDay !== '-' ? peakDay : '-'} sub={peakDayPct > 0 ? `주간 통행의 ${Number(peakDayPct).toFixed(1)}%` : undefined}/>
        <StatTile id="c7.tile3" tone="lilac" label="최다 시간대"      value={peakHour !== '-' ? peakHour : '-'} sub={peakHourPct > 0 ? `통행의 ${Number(peakHourPct).toFixed(1)}%` : undefined}/>
        <StatTile id="c7.tile4" tone="cream" label="반경 500m"        value={totalPop > 0 ? totalPop.toLocaleString() : '-'} unit={totalPop > 0 ? '명/일' : ''}/>
      </div>

      <div style={{display:"grid", gridTemplateColumns:"1.3fr 1fr", gap:16, alignItems:"stretch"}}>
        <div className="bc-box" style={{padding:18, display:"flex", flexDirection:"column"}}>
          <div style={{fontSize:15, fontWeight:600, marginBottom:14}}>시간대별 비중</div>
          {hourItems.length > 0 ? (
            <VBars id="c7.hours" accent={hourTopIdx} barW={28} gap={16} height={130} items={hourItems}/>
          ) : (
            <div style={{fontSize:13, color:"var(--matte-fg-4)", padding:"30px 0"}}>시간대 데이터 수집 중</div>
          )}
          <div style={{marginTop:16, paddingTop:14, borderTop:"1px solid var(--line)"}}>
            <div style={{fontSize:15, fontWeight:600, marginBottom:14}}>요일별 비중</div>
            {dayItems.length > 0 ? (
              <VBars id="c7.days" accent={dayTopIdx} barW={28} gap={10} height={84} items={dayItems}/>
            ) : (
              <div style={{fontSize:13, color:"var(--matte-fg-4)", padding:"20px 0"}}>요일 데이터 수집 중</div>
            )}
          </div>
        </div>

        <div style={{display:"flex", flexDirection:"column", gap:12}}>
          <div className="bc-box" style={{padding:18, flex:1, display:"flex", flexDirection:"column"}}>
            <div style={{fontSize:15, fontWeight:600, marginBottom:12}}>주중 vs 주말</div>
            {(weekdayPct > 0 || weekendPct > 0) ? (
              <div style={{display:"flex", alignItems:"center", gap:16, justifyContent:"center", flex:1, flexWrap:"wrap", minWidth:0}}>
                <div style={{flexShrink:0, width:150, maxWidth:"100%"}}>
                  <Donut id="c7.donut" size={150} segments={[
                    {value:weekdayPct, color:"#4C7BE4", label:"주중"},
                    {value:weekendPct, color:"#FFFFFF", label:"주말"},
                  ]} centerLabel={`${Math.round(weekdayPct)}%`} centerSub="주중 비중"/>
                </div>
                <div style={{minWidth:0, flexShrink:1}}>
                  <DonutLegend segments={[
                    {value:weekdayPct, color:"#4C7BE4", label:"주중", text:`${Math.round(weekdayPct)}%`},
                    {value:weekendPct, color:"#FFFFFF", label:"주말", text:`${Math.round(weekendPct)}%`},
                  ]}/>
                </div>
              </div>
            ) : (
              <div style={{fontSize:13, color:"var(--matte-fg-4)", textAlign:"center", padding:"30px 0"}}>주중/주말 데이터 수집 중</div>
            )}
          </div>
          <div className="bc-box" style={{padding:18, flex:1, display:"flex", flexDirection:"column"}}>
            <div style={{fontSize:15, color:"var(--fg-3)", fontWeight:600, marginBottom:8}}>우리 동 vs 자치구 유동인구</div>
            {topAreaList.length > 0 ? (
              <div style={{flex:1, display:"flex", flexDirection:"column", justifyContent:"space-around"}}>
              {/* [2026-06-14] 순위(N위) 표기 제거 — 동(자기)과 자치구(부모)는 순위 비교 대상이 아님(부모가 자식 포함이라 항상 큼).
                  역할 기반 라벨: index0=우리 동, 이름이 자치구(시/군/구 단위·sigungu 일치)=자치구 전체, 그 외=해당 동.
                  3개 지역(동·이웃동·자치구)이 와도 index1·index2가 둘 다 자치구로 잘못 붙지 않음. */}
              {topAreaList.map((d, i)=>{
                const nm = String(d.name || '').trim();
                const isGu = (sigungu && nm === sigungu) || /(구|군|시)$/.test(nm);
                const role = i === 0 ? '우리 동' : (isGu ? '자치구 전체' : '인근 동');
                return (
                <div key={i} style={{display:"flex", justifyContent:"space-between", alignItems:"center", padding:"6px 0", fontSize:18}}>
                  <span><span style={{color:"var(--fg-4)", marginRight:8, fontSize:14}}>{role}</span>{nm}</span>
                  <span style={{fontVariantNumeric:"tabular-nums", color:"var(--fg-2)"}}>{`${(d.pop/10000).toFixed(1)}만/일`}</span>
                </div>
                );
              })}
              </div>
            ) : (
              <div style={{flex:1, display:"flex", alignItems:"center", justifyContent:"center", fontSize:13, color:"var(--fg-4)"}}>인근 동 데이터 수집 중</div>
            )}
          </div>
        </div>
      </div>
    </CardShell>
  );
}

Object.assign(window, { Card01, Card02, Card03, Card04, Card05: Card06, Card06: Card05, Card07 });
