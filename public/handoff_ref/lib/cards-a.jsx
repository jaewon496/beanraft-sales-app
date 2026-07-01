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
  const vacancyDisplay = vacancyRate != null && vacancyRate > 0 ? (window.bcFmtPct ? window.bcFmtPct(Number(vacancyRate)) : Number(vacancyRate).toFixed(1)) : '-';
  const totalStores = cafeCount + bakery;
  // [2026-06-29 §3-C] 반경 라벨 = 검색 반경 변수 기반(하드코딩 500 제거). body.radius 없으면 500 폴백(카드07과 동일 패턴).
  const _radiusM = (typeof body.radius === 'number' && body.radius > 0) ? body.radius : 500;
  // [2026-06-14] 분모 통일: 카페(개인+프랜) 기준으로 % 산출 → 카드08/09와 일치(개인 59 / 프랜 41).
  // 베이커리는 비율 파이에서 제외(개수만 유지). 도넛 중앙 라벨(cafeCount=353)과도 분모 정합.
  const donutTotal = individual + franchise;
  const indiePct = donutTotal > 0 ? Math.round((individual / donutTotal) * 100) : 0;
  const franPct = donutTotal > 0 ? Math.max(0, 100 - indiePct) : 0;
  // [2026-05-21] rentSeries(marketRentSeries.series)는 이미 '만원/평' 단위 → /10000 금지.
  // 기존 /10000 때문에 값이 전부 0으로 깎여 추이 그래프가 평탄 폴백([rentPerPyeong]x2)으로 빠지던 버그 수정.
  const rentSeriesRaw = (Array.isArray(body.rentSeries) && body.rentSeries.length > 0)
    ? body.rentSeries.map(s => Math.round((Number(s?.value) || 0) * 10) / 10).filter(v => v > 0)
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
  // [2026-06-24] '순증감률 -70%'(=net/폐업 비율)는 무엇의 비율인지 모호 → 신규-폐업 순증감을 '개수'로 직관 표기.
  //   예) 신규 3·폐업 10 → "신규-폐업 -7개". 폐업 데이터 없으면 신규만 표시.
  const newOpenNet = newOpen - closed;
  const newOpenDelta = (newOpen > 0 || closed > 0)
    ? `${newOpenNet > 0 ? '+' : ''}${newOpenNet}개`
    : null;
  // [2026-06-26 MED-A] 신규 개업 스파크라인 방향을 순증감 부호에 맞춤.
  //   기존 [max(0,신규-폐업), 신규]는 순감(예 신규3·폐업10=-7)에도 [0,3] 우상향이 돼 방향이 모순됐음.
  //   순감→하락 / 순증→상승 / 0→평탄. 시작점은 폐업, 끝점은 신규를 앵커로 써 실제 값에서 결정적으로 그린다.
  const newOpenSeries = (newOpen > 0 || closed > 0)
    ? (newOpenNet === 0
        ? [newOpen, newOpen]                       // 0 → 평탄
        : [closed, newOpen])                        // 순감(폐업>신규)→하락, 순증(신규>폐업)→상승
    : [];
  return (
    <CardShell n="01" id="01"
      bruSummary={body.bruSummary}
      title="상권 분석 리포트"
      sub={`반경 ${_radiusM}m 매장 구성과 임대 시세`}
      headerRight={window.MapTriggerButton ? <window.MapTriggerButton/> : null}>
      {/* Top: hero + donut */}
      <div className="bc-grid-4" style={{gap:16, marginBottom:16}}>
        <StatTile id="c1.tile1" tone="blue"  label="총 매장"        value={totalStores > 0 ? String(totalStores) : '-'} unit={totalStores > 0 ? '개' : ''} hero/>
        <StatTile id="c1.tile2" tone="lilac" label="프랜차이즈"     value={franchise > 0 ? String(franchise) : '-'} unit={franchise > 0 ? '개' : ''}/>
        <StatTile id="c1.tile3" tone="mint"  label="평당 월세"      value={rentPerPyeong > 0 ? String(rentPerPyeong) : '-'} unit={rentPerPyeong > 0 ? '만원' : ''} delta={priceChange != null && Number(priceChange) !== 0 ? `${Number(priceChange) >= 0 ? '+' : ''}${window.bcFmtPct ? window.bcFmtPct(Number(priceChange)) : Number(priceChange).toFixed(1)}` : null} deltaPositive={priceChange == null || Number(priceChange) >= 0} deltaPrefixDisabled/>
        <StatTile id="c1.tile4" tone="rose"  label="공실률"         value={vacancyDisplay} unit={vacancyDisplay !== '-' ? '%' : ''} delta={vacancyDelta !== 0 ? `${vacancyDelta >= 0 ? '+' : ''}${window.bcFmtPct ? window.bcFmtPct(vacancyDelta) : vacancyDelta.toFixed(1)}` : null} deltaPositive={vacancyDelta >= 0} deltaPrefixDisabled/>
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
              ]} centerLabel={String(cafeCount)} centerSub="카페 매장(베이커리 제외)"/>
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
          { l:"평당 월세", v: rentPerPyeong > 0 ? `${rentPerPyeong}만원` : '-', d: priceChange != null && Number(priceChange) !== 0 ? `${Number(priceChange) > 0 ? '+' : ''}${window.bcFmtPct ? window.bcFmtPct(Number(priceChange)) : Number(priceChange).toFixed(1)}` : null, color:"#FFFFFF", data: rentSeries },
          { l:"공실률",   v: vacancyDisplay !== '-' ? `${vacancyDisplay}%` : '-', d: vacancyDelta !== 0 ? `${vacancyDelta > 0 ? '+' : ''}${window.bcFmtPct ? window.bcFmtPct(vacancyDelta) : vacancyDelta.toFixed(1)}` : null, color:"#FFFFFF", data: vacancySeries },
          { l:"신규 개업", v: `${newOpen}개`, d: newOpenDelta, dl:"신규-폐업", color:"#4C7BE4", data: newOpenSeries },
        ].map((t, i) => (
          <div key={i} className="bc-box" style={{padding:18}}>
            <div style={{display:"flex", justifyContent:"space-between", alignItems:"baseline", marginBottom:10}}>
              <span style={{fontSize:14, color:"var(--matte-fg-3)", fontWeight:500}}>{t.l}</span>
              {t.d != null && <span style={{fontSize:14, color: t.color === "#4C7BE4" ? "#4C7BE4" : "var(--matte-fg-2)", fontWeight:600, fontVariantNumeric:"tabular-nums"}}>{t.dl ? <span style={{fontSize:11, color:"var(--matte-fg-4)", fontWeight:500, marginRight:4}}>{t.dl}</span> : null}{t.d}{(String(t.d).endsWith('신규') || String(t.d).endsWith('개')) ? '' : '%'}</span>}
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
  // [2026-06-26] 추정 배지 약속 — bodyData._estimated 의 필드만 회색 '추정' 배지.
  const _estSet = (window.bcEstSet ? window.bcEstSet(bd) : new Set());
  const _isEst = (...keys) => (window.bcIsEst ? window.bcIsEst(_estSet, ...keys) : false);
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
  // [2026-06-29 정보분산 패스4 §3-C] 렌더 자기교정 폐지.
  //   주요 연령대 표시값은 데이터층(dataMapper)이 이미 막대 버킷(_card2AgeGroups)과
  //   같은 %로 맞춰 내려준 bd.topAge("30대 (31%)")를 '그대로' 쓴다.
  //   (기존: 렌더에서 ageGroups를 다시 매칭/재포맷 → 데이터층과 갈리는 두번째 출처가 됐음.)
  //   topAgeIdx 는 어느 막대를 강조할지 '위치'만 정하는 용도라 그대로 유지.
  let topAgeDisplay = topAge || '';
  // 데이터층 값이 통째로 비었을 때만(폴백) 막대 버킷 라벨로 최소 표시.
  if (!topAgeDisplay && topAgeIdx >= 0 && ageGroups[topAgeIdx]) {
    const _g = ageGroups[topAgeIdx];
    topAgeDisplay = _g.v > 0 ? `${_g.l} (${_g.v}%)` : _g.l;
  }
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
  // [2026-06-29 연령충돌] '주요 연령대'(=단일 최다 구간 topAgeDisplay)와 '50대 이상 누적'(50대+60대+)은
  //   서로 다른 지표. 같은 '주요 연령대' 이름으로 두 값이 안 나오게, 누적은 별도 보조 텍스트로만 표시.
  //   단일 최다 구간이 이미 50대 이상이면(예: 50대가 최다) 누적과 거의 같으므로 보조 표기를 생략.
  const age50PlusPct = Number(bd.age50PlusPct) || 0;
  const _topAgeNumForNote = Number((String(topAgeDisplay).match(/\d+/) || [])[0]) || 0;
  const showAge50PlusNote = age50PlusPct > 0 && _topAgeNumForNote > 0 && _topAgeNumForNote < 50;
  return (
    <CardShell n="02" id="02"
      bruSummary={body.bruSummary}
      title="고객 분석"
      sub="방문 고객 특성">
      {/* 4-up KPI */}
      <div className="bc-grid-4" style={{gap:16, marginBottom:16}}>
        <StatTile id="c2.tile1" tone="blue"  label="주요 연령대"   value={topAgeDisplay} hero accent/>
        <StatTile id="c2.tile2" tone="lilac" label="성비 (남:여)" value={(femaleRatio + maleRatio) > 0 ? `${maleRatio} : ${femaleRatio}` : '-'} est={(femaleRatio + maleRatio) > 0 && _isEst('genderRatio', 'male', 'female', '성비')}/>
        <StatTile id="c2.tile3" tone="mint"  label="재방문율" value={regularPct > 0 ? String(regularPct) : '-'} unit={regularPct > 0 ? '%' : ''} est={regularPct > 0 && (revisitEstimated || _isEst('regular', 'revisit', '재방문율'))}/>
        <StatTile id="c2.tile4" tone="cream" label="신규 비율" value={newCustomerPct > 0 ? String(newCustomerPct) : '-'} unit={newCustomerPct > 0 ? '%' : ''} est={newCustomerPct > 0 && (revisitEstimated || _isEst('newCustomer', '신규비율'))}/>
      </div>
      {revisitEstimated && (regularPct > 0 || newCustomerPct > 0) && (
        <div style={{fontSize:12, color:"var(--matte-fg-4)", marginTop:-6, marginBottom:14}}>재방문율 · 신규 비율은 거주 안정성 기반 추정치입니다.</div>
      )}
      {/* [2026-06-29] '주요 연령대'(단일 최다 구간)와 구분되는 '50대 이상 누적' 보조 표기 */}
      {showAge50PlusNote && (
        <div style={{display:"flex", alignItems:"center", gap:8, marginTop:-6, marginBottom:14}}>
          <span style={{fontSize:13, color:"var(--matte-fg-3)", fontWeight:500}}>50대 이상 비중</span>
          <span style={{padding:"2px 10px", background:"rgba(255,255,255,0.06)", border:"1px solid var(--matte-line)", borderRadius:6, fontSize:13, fontWeight:700, color:"var(--matte-fg-2)", fontVariantNumeric:"tabular-nums"}}>{age50PlusPct}%</span>
        </div>
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
            {/* [2026-06-24] 평균 소득(월): 실측 소득(bd.incomeIsReal && bd.avgIncomeMonthly>0)일 때만 소득값 표시.
                남/여 실측 소득·지역 평균 소득(소상공인365)은 기존대로 실데이터로 유지. 어느 쪽도 없으면 '-'.
                ★가구수는 이 타일에 절대 표시 금지 (소득 자리에 가구통계를 넣지 않음). */}
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
            ) : (bd.incomeIsReal && Number(bd.avgIncomeMonthly) > 0) ? (
              <div style={{display:"flex", alignItems:"baseline", gap:8}}>
                <span style={{fontSize:24, fontWeight:700, fontVariantNumeric:"tabular-nums"}}>{Number(bd.avgIncomeMonthly).toLocaleString()}</span>
                <span style={{fontSize:14, color:"var(--matte-fg-3)", fontWeight:500}}>만원</span>
                {/* [2026-06-24] 소득 출처 라벨: 시도 폴백(KOSIS 1인당 개인소득)이면 시도 단위임을 명시. */}
                <span style={{fontSize:12, color:"var(--matte-fg-4)", marginLeft:6}}>{bd.incomeScope === 'sido' ? '시도 1인당 개인소득' : '상권 평균 소득'}</span>
              </div>
            ) : regionMonthlyIncome > 0 ? (
              <div style={{display:"flex", alignItems:"baseline", gap:8}}>
                <span style={{fontSize:24, fontWeight:700, fontVariantNumeric:"tabular-nums"}}>{regionMonthlyIncome.toLocaleString()}</span>
                <span style={{fontSize:14, color:"var(--matte-fg-3)", fontWeight:500}}>만원</span>
                <span style={{fontSize:12, color:"var(--matte-fg-4)", marginLeft:6}}>지역 평균 (소상공인365)</span>
              </div>
            ) : (
              <div style={{fontSize:24, fontWeight:700, color:"var(--matte-fg-3)"}}>-</div>
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
  // [2026-06-26] 추정 배지 약속 — bodyData._estimated 의 필드만 회색 '추정' 배지.
  const _estSet = (window.bcEstSet ? window.bcEstSet(bd) : new Set());
  const _isEst = (...keys) => (window.bcIsEst ? window.bcIsEst(_estSet, ...keys) : false);
  const openCnt = Number(bd.openCount) || 0;
  const closeCnt = Number(bd.closeCount) || 0;
  const netChg = Number(bd.netChange) || (openCnt - closeCnt);
  const trend = bd.trend || (netChg > 2 ? '성장' : netChg < -2 ? '감소세' : '정체');
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
      bruSummary={body.bruSummary}
      title="상권 변화 추이"
      sub="개폐업 및 상권 트렌드">
      {/* Top tiles */}
      <div className="bc-grid-4" style={{gap:16, marginBottom:16}}>
        <StatTile id="c3.tile1" tone={trend === '성장' ? 'mint' : trend === '감소세' ? 'rose' : 'lilac'} label="추세" value={trend} hero/>
        <StatTile id="c3.tile2" tone="blue"  label="신규 개업"   value={String(openCnt)} unit="개" est={openCnt > 0 && _isEst('openCount', 'newOpen', '신규')}/>
        <StatTile id="c3.tile3" tone="rose"  label="폐업"        value={String(closeCnt)} unit="개" est={closeCnt > 0 && _isEst('closeCount', 'closed', '폐업')}/>
        <StatTile id="c3.tile4" tone="lilac" label="순증감"      value={`${netChg > 0 ? '+' : ''}${netChg}`} unit="개"/>
      </div>

      <div style={{display:"grid", gridTemplateColumns:"1.2fr 1fr", gap:16}}>
        {/* 생존율 + 5년전/지금 비교 */}
        <div className="bc-box" style={{padding:24, display:"flex", flexDirection:"column"}}>
          <div style={{display:"flex", alignItems:"center", gap:8, marginBottom:18}}>
            <div style={{fontSize:16, fontWeight:600}}>생존율</div>
            {/* [2026-06-15] 공간단위 태그: 지역 실데이터면 자치구 기준, 전국 폴백이면 전국 카페 기준 */}
            <window.UnitTag text={survRegional ? (sigungu || '자치구 기준') : '전국 카페 기준'}/>
            {/* [2026-06-26] 전국 폴백(지역 실데이터 아님)이거나 _estimated 표기 시 '추정' 배지 */}
            {window.EstBadge ? <window.EstBadge when={(surv1y > 0 || surv3y > 0 || surv5y > 0) && (!survRegional || _isEst('survivalRate1y', 'survival1y', 'survivalRate3y', 'survival3y', 'survival', 'survivalRate5y', 'survival5y'))}/> : null}
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
              {/* [2026-06-24] 변화 0(예: 1→1)일 때 '-'(빈값처럼 보임) → 양쪽 개수가 다 있으면 "0%"로 표기. 개수 자체가 없을 때만 '-'. */}
              {/* [2026-06-26 HIGH-2 소표본 억제] 美 Census 식: 표본(점포수) 임계 미만이면 증감%는 통계적으로 불안정(1→2=+100%) → "표본 부족"으로 표기하고 % 숨김. */}
              {(() => {
                const _hasBoth = cafes5yAgo > 0 && cafesNow > 0;
                const _SMALL_N = 30; // 카드5 '30개 미만' 규칙과 동일 임계
                const _smallSample = _hasBoth && (cafes5yAgo < _SMALL_N || cafesNow < _SMALL_N);
                if (_smallSample) {
                  return <div style={{fontSize:13, fontWeight:600, color:"var(--matte-fg-4)", letterSpacing:"-0.005em", lineHeight:1.3, marginTop:4}} title={`표본(점포 ${Math.min(cafes5yAgo, cafesNow)}개)이 적어 증감률을 표기하지 않습니다`}>표본 부족</div>;
                }
                if (change5y === 0 && !_hasBoth) {
                  return <div style={{fontSize:24, fontWeight:700, fontVariantNumeric:"tabular-nums", letterSpacing:"-0.01em"}}>-</div>;
                }
                return <div style={{fontSize:24, fontWeight:700, fontVariantNumeric:"tabular-nums", letterSpacing:"-0.01em"}}>{`${change5y > 0 ? '+' : ''}${window.bcFmtPct ? window.bcFmtPct(Number(change5y)) : Number(change5y).toFixed(1)}`}<span style={{fontSize:13, color:"var(--matte-fg-3)", marginLeft:3, fontWeight:500}}>%</span></div>;
              })()}
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
                    <span style={{textAlign:"right", fontSize:14, fontWeight:700, fontVariantNumeric:"tabular-nums", color: i === 0 ? "#4C7BE4" : "var(--matte-fg)"}}>{window.bcFmtPct ? window.bcFmtPct(Number(p)) : Number(p).toFixed(1)}%</span>
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
          <div style={{fontSize:13, color:"var(--matte-fg-3)", marginTop:6, fontVariantNumeric:"tabular-nums"}}>{(survRegional && surv3y > 0) ? `전국 평균 39% 대비 ${surv3y >= 39 ? '+' : ''}${window.bcFmtPct ? window.bcFmtPct(surv3y - 39) : (surv3y - 39).toFixed(1)}%${surv3y >= 39 ? '↑' : '↓'}` : '전국 카페업 평균 (추정)'}</div>
        </div>
        <div className="bc-box" style={{padding:20}}>
          <div style={{fontSize:14, color:"var(--matte-fg-3)", marginBottom:8, fontWeight:500}}>5년 생존율</div>
          <div style={{display:"flex", alignItems:"baseline", gap:8}}>
            <span style={{fontSize:32, fontWeight:700, fontVariantNumeric:"tabular-nums", letterSpacing:"-0.01em"}}>{surv5y > 0 ? surv5y : '-'}</span>
            {surv5y > 0 && <span style={{fontSize:15, color:"var(--matte-fg-3)"}}>%</span>}
          </div>
          <div style={{fontSize:13, color:"var(--matte-fg-3)", marginTop:6, fontVariantNumeric:"tabular-nums"}}>{(survRegional && surv5y > 0) ? `전국 평균 28% 대비 ${surv5y >= 28 ? '+' : ''}${window.bcFmtPct ? window.bcFmtPct(surv5y - 28) : (surv5y - 28).toFixed(1)}%${surv5y >= 28 ? '↑' : '↓'}` : '전국 카페업 평균 (추정)'}</div>
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
      bruSummary={body.bruSummary}
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
  // [신폐 단일 해소계층 §3] (2026-06-29) 이 칸은 '개인 카페 신규 진입'(개념이 카드01·11·13의
  //   '전체 카페 신규'와 다름)이므로 단일값을 쓰지 않고 라벨을 '개인 카페 신규'로 분리한다.
  //   1순위: newIndieList(반경 내 isNewOpen 개인 카페 실집계). 2순위: areaNewOpen(개인 한정으로 주입된 값).
  //   둘 다 없을 때만 전국 평균(개인수×1.5%, 최소 1)으로 떨어지며 그 경우 '추정' 배지를 붙인다.
  const _newIndieRealCount = Array.isArray(bd.newIndieList) ? bd.newIndieList.length : 0;
  const areaNewOpen = Number(bd.areaNewOpen) || 0;
  const _newOpenReal = _newIndieRealCount > 0 ? _newIndieRealCount : areaNewOpen;
  const newOpenEstimated = _newOpenReal <= 0; // 실집계 없음 → 전국 평균 추정
  const newOpenDisplay = _newOpenReal > 0
    ? _newOpenReal
    : (indieCount > 0 ? Math.max(1, Math.round(indieCount * 0.015)) : 1);
  const avgMonthlySales = Number(bd.avgMonthlySales) || 0; // 만원 단위
  return (
    <CardShell n="06" id="06"
      bruSummary={body.bruSummary}
      title="개인 카페 분석"
      sub="주변 개인 카페 현황 및 가격대">
      <div className="bc-grid-4" style={{gap:16, marginBottom:16}}>
        <StatTile id="c5.tile1" tone="blue"  label="개인 카페 수" value={String(indieCount)} unit="개" hero/>
        <StatTile id="c5.tile2" tone="mint"  label="비중"        value={indiePct > 0 ? String(indiePct) : '-'} unit={indiePct > 0 ? '%' : ''}/>
        <StatTile id="c5.tile3" tone="lilac" label="아메리카노 평균" value={americanoAvg > 0 ? americanoAvg.toLocaleString() : '-'} unit={americanoAvg > 0 ? '원' : ''} accent/>
        <StatTile id="c5.tile4" tone="cream" label="대표메뉴 평균"   value={dessertAvg > 0 ? dessertAvg.toLocaleString() : '-'} unit={dessertAvg > 0 ? '원' : ''}/>
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
                <div style={{display:"flex", alignItems:"center", gap:6, marginBottom:8}}>
                  <div style={{fontSize:13, color:"var(--matte-fg-3)", fontWeight:500}}>개인 카페 신규</div>
                  {newOpenEstimated && window.EstBadge ? <window.EstBadge/> : null}
                </div>
                <div style={{fontSize:24, fontWeight:700, color:"#4C7BE4", fontVariantNumeric:"tabular-nums", letterSpacing:"-0.01em"}}>{newOpenDisplay.toLocaleString()}<span style={{fontSize:13, color:"var(--matte-fg-3)", marginLeft:3, fontWeight:500}}>곳</span></div>
                <div style={{fontSize:12, color:"var(--matte-fg-4)", marginTop:6}}>반경 500m 개인 카페 신규 진입</div>
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
   Card 06 — 매출 분석 : 구간 분위 블록 (커피만 / 커피+베이커리 공통 소부품)
   [2026-06-30] coffeeQuant·cafeBakeryQuant 두 번 렌더. 큰 글씨=상위20%(accent),
   작은 글씨=보통(중위), 보조 무채색 타일=평균·하위20%. 평균은 절대 헤드라인에 안 둔다.
   ============================================================ */
function SalesSegment({ title, q, fmtWon, accent, accentVal, grayAvg, grayBtm, qChart }) {
  if (!q || !q.topStr) return null;   // 상위20%가 있어야 구간 노출(가짜값 금지)
  const ACC = accent, ACC_VAL = accentVal, GRAY_AVG = grayAvg, GRAY_BTM = grayBtm;
  // 보조 무채색 타일: 평균 / 하위20% (값 있는 것만)
  const subTiles = [];
  if (q.avgStr) subTiles.push(["평균", q.avgStr]);
  if (q.btmStr) subTiles.push(["하위 20%", q.btmStr]);
  return (
    <div style={{display:"flex", flexDirection:"column", gap:14}}>
      {/* 구간 헤더 */}
      <div style={{fontSize:15, fontWeight:700, color:"var(--matte-fg-2)", letterSpacing:"-0.005em"}}>{title}</div>

      {/* 큰 글씨 = 잘되는 카페(상위20%) + 작은 글씨 = 보통 카페(중위) */}
      <div style={{
        padding:"24px 26px", borderRadius:14,
        border:"1px solid rgba(76,123,228,0.5)",
        background:"linear-gradient(135deg, rgba(76,123,228,0.10), rgba(76,123,228,0.03))",
        display:"flex", flexWrap:"wrap", alignItems:"flex-end", justifyContent:"space-between", gap:20,
      }}>
        {/* 상위20% — HERO */}
        <div>
          <div style={{display:"flex", justifyContent:"flex-start", alignItems:"center", gap:10, marginBottom:12, flexWrap:"wrap"}}>
            <span style={{fontSize:14.5, color:"var(--matte-fg-2)", fontWeight:600}}>잘되는 카페 (상위 20%)</span>
            <span style={{fontSize:12, fontWeight:700, color:ACC, padding:"4px 10px", borderRadius:999, border:"1px solid rgba(76,123,228,0.45)", background:"rgba(76,123,228,0.08)", whiteSpace:"nowrap"}}>상위 기준</span>
          </div>
          <div style={{display:"flex", alignItems:"baseline", gap:8}}>
            <span style={{fontSize:52, fontWeight:800, color:ACC_VAL, fontVariantNumeric:"tabular-nums", letterSpacing:"-0.02em", lineHeight:1}}>{q.topStr}</span>
            <span style={{fontSize:17, color:"var(--matte-fg-3)", fontWeight:600}}>/월</span>
          </div>
        </div>
        {/* 중위 — 보통 카페(작은 글씨) */}
        {q.midStr && (
          <div style={{textAlign:"right"}}>
            <div style={{fontSize:13.5, color:"var(--matte-fg-3)", fontWeight:500, marginBottom:8}}>보통 카페 (중위)</div>
            <div style={{display:"flex", alignItems:"baseline", gap:6, justifyContent:"flex-end"}}>
              <span style={{fontSize:24, fontWeight:700, color:"#fff", fontVariantNumeric:"tabular-nums", letterSpacing:"-0.01em"}}>{q.midStr}</span>
              <span style={{fontSize:13, color:"var(--matte-fg-4)", fontWeight:600}}>/월</span>
            </div>
          </div>
        )}
      </div>

      {/* 보조 무채색 타일 — 평균 / 하위20% */}
      {subTiles.length > 0 && (
        <div style={{display:"grid", gridTemplateColumns:`repeat(${subTiles.length}, 1fr)`, gap:14}}>
          {subTiles.map(([l, v]) => (
            <div key={l} style={{padding:"16px 18px", background:"var(--matte-bg-2, #1d1d1d)", border:"1px solid var(--matte-line)", borderRadius:14}}>
              <div style={{fontSize:13, color:"#A3A3A3", fontWeight:500, marginBottom:9}}>{l}</div>
              <div style={{fontSize:20, fontWeight:700, color:"#fff", fontVariantNumeric:"tabular-nums", letterSpacing:"-0.01em"}}>{v}</div>
            </div>
          ))}
        </div>
      )}

      {/* 6개월 분위 추이(3선) — 커피 구간만 전달(qChart 있을 때). 베이커리는 분위 3숫자만. */}
      {qChart && (
        <div className="bc-box" style={{padding:"20px 22px"}}>
          <div style={{display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:16, flexWrap:"wrap", gap:8}}>
            <div style={{fontSize:15, fontWeight:600}}>최근 6개월 매출 분위 추이</div>
            <div style={{display:"flex", gap:16}}>
              {[["상위 20%", ACC],["평균", GRAY_AVG],["하위 20%", GRAY_BTM]].map(([lg, c]) => (
                <span key={lg} style={{display:"inline-flex", alignItems:"center", gap:6, fontSize:13, color:"var(--matte-fg-3)"}}>
                  <span style={{width:14, height:3, borderRadius:2, background:c, display:"inline-block"}}></span>{lg}
                </span>
              ))}
            </div>
          </div>
          <svg width="100%" height={qChart.H} viewBox={`0 0 ${qChart.W} ${qChart.H}`} preserveAspectRatio="none" style={{display:"block"}}>
            {qChart.ticks.map((t, i) => (
              <g key={i}>
                <line x1={qChart.padL} y1={t.y} x2={qChart.W - qChart.padR} y2={t.y} stroke="rgba(255,255,255,0.05)"/>
                <text x={qChart.padL - 10} y={t.y + 4} fontSize="13" fill="#A3A3A3" textAnchor="end" style={{fontVariantNumeric:"tabular-nums"}}>{t.label}</text>
              </g>
            ))}
            {[...qChart.series].reverse().map(s => (
              s.pts.length >= 2 ? (
                <path key={s.key} d={qChart.pathSmooth(s.pts)} fill="none" stroke={s.color} strokeWidth={s.w} strokeLinecap="round" vectorEffect="non-scaling-stroke" opacity={s.key === 'top' ? 1 : 0.85}/>
              ) : null
            ))}
            {(() => {
              const top = qChart.series.find(s => s.key === 'top');
              if (!top || top.pts.length === 0) return null;
              const last = top.pts[top.pts.length - 1];
              return <circle cx={last[0]} cy={last[1]} r="5" fill={ACC}/>;
            })()}
            {qChart.labels.map((m, i) => (
              <text key={i} x={qChart.xPos(i)} y={qChart.H - 8} fontSize="13" fill="#A3A3A3" textAnchor="middle">{m}</text>
            ))}
          </svg>
        </div>
      )}
    </div>
  );
}

/* ============================================================
   Card 06 — 매출 분석
   ============================================================ */
function Card06({ body = {} }) {
  const bd = body.bodyData || {};
  const cd = body.chartData || {};
  const kosis = body.kosisBoxData || {};
  // [2026-06-26] 추정 배지 약속 — bodyData._estimated 의 필드만 회색 '추정' 배지.
  const _estSet = (window.bcEstSet ? window.bcEstSet(bd) : new Set());
  const _isEst = (...keys) => (window.bcIsEst ? window.bcIsEst(_estSet, ...keys) : false);
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
  // [2026-06-24] 시장 규모(상권 카페 전체 매출 규모) — dataMapper bizmapMarketSize(이미 '1억 4,424만원' 형태 문자열). 변동률은 bizmapMarketTrend.
  //   비즈맵 분위 미수집 지역은 빈 문자열 → 행 자체 숨김(가짜값 금지).
  const marketSizeStr = (typeof bd.bizmapMarketSize === 'string' && bd.bizmapMarketSize.trim()) ? bd.bizmapMarketSize.trim() : '';
  const marketTrendStr = (typeof bd.bizmapMarketTrend === 'string' && bd.bizmapMarketTrend.trim()) ? bd.bizmapMarketTrend.trim() : '';
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

  // ── [2026-06-30 매출 한 저울] 비즈맵 매출 분위를 두 구간(커피만 / 커피+베이커리)으로 분리 노출 ──
  //   dataMapper가 card5.bodyData에 coffeeQuant·cafeBakeryQuant 를 같은 구조로 채워줌.
  //   각 { topNum,topStr, avgNum,avgStr, midNum,midStr, btmNum,btmStr, trend:{labels,top,avg,bottom} }.
  //   상위20%(topStr)가 있어야 그 구간 노출. cafeBakeryQuant 없으면 베이커리 블록 자체 숨김(가짜값 금지).
  const ACC = "#4C7BE4";          // 강조(accent) — 상위20% 전용
  const ACC_VAL = "#5e93ec";      // HERO 큰 숫자용 밝은 accent
  const GRAY_AVG = "#8a8a8a";     // 평균선
  const GRAY_BTM = "#5a5a5a";     // 하위선
  const coffeeQuant = bd.coffeeQuant || null;
  const cafeBakeryQuant = bd.cafeBakeryQuant || null;
  const hasQuantile = !!(coffeeQuant && coffeeQuant.topStr) || !!(cafeBakeryQuant && cafeBakeryQuant.topStr);
  // [2026-06-30] 전국 제과점 평균(정직 표시 전용) — 평균 한 값만. 구간(상위20%/중위) 절대 만들지 않음.
  //   값 없으면(null) 블록 자체 미노출(빈칸/가짜 금지). 단위는 커피 분위와 같은 만원/월.
  const bakeryNationalAvg = (typeof bd.bakeryNationalAvgManwon === 'number' && bd.bakeryNationalAvgManwon > 0) ? bd.bakeryNationalAvgManwon : null;
  const bakeryNationalStores = (typeof bd.bakeryNationalStores === 'number' && bd.bakeryNationalStores > 0) ? bd.bakeryNationalStores : null;
  const bakeryNationalPeriodRaw = (typeof bd.bakeryNationalPeriod === 'string' && bd.bakeryNationalPeriod.trim()) ? bd.bakeryNationalPeriod.trim() : null;
  // 기준월 YYYYMM → YYYY.MM 표기 (그 외 형식은 원문 유지)
  const bakeryNationalPeriodFmt = bakeryNationalPeriodRaw
    ? (/^\d{6}$/.test(bakeryNationalPeriodRaw) ? `${bakeryNationalPeriodRaw.slice(0,4)}.${bakeryNationalPeriodRaw.slice(4,6)}` : bakeryNationalPeriodRaw)
    : null;

  // 6개월 추이 인라인 SVG 좌표 계산 (3선 — 상위/평균/하위). 커피 구간 trend만 사용(데이터량 고려).
  const buildQChart = (trend) => {
    if (!trend || !Array.isArray(trend.labels) || trend.labels.length < 2) return null;
    const labels = trend.labels;
    const series = [
      { key: 'top', arr: trend.top, color: ACC, w: 2.8, dot: true },
      { key: 'avg', arr: trend.avg, color: GRAY_AVG, w: 1.6, dot: false },
      { key: 'bottom', arr: trend.bottom, color: GRAY_BTM, w: 1.6, dot: false },
    ];
    // 만원 → 표시 단위(억/만원 자동). y 도메인은 모든 유효값 기준.
    const allVals = series.flatMap(s => (s.arr || []).filter(v => v != null && isFinite(v)));
    if (allVals.length < 2) return null;
    const rawMax = Math.max(...allVals), rawMin = Math.min(...allVals);
    const span = (rawMax - rawMin) || 1;
    const max = rawMax + span * 0.1;
    const min = Math.max(0, rawMin - span * 0.1);
    const range = (max - min) || 1;
    // [2026-06-25] 좌측 거터 확대(52→82): "2,448만원" 등 긴 Y라벨 앞자리 잘림 방지.
    const W = 700, H = 220, padL = 82, padR = 16, padT = 16, padB = 30;
    const innerW = W - padL - padR, innerH = H - padT - padB;
    const n = labels.length;
    const xPos = (i) => padL + (n <= 1 ? 0 : (i / (n - 1)) * innerW);
    const yPos = (v) => padT + innerH - ((v - min) / range) * innerH;
    const ptsOf = (arr) => (arr || []).map((v, i) => (v != null && isFinite(v)) ? [xPos(i), yPos(v), v, i] : null).filter(Boolean);
    const pathSmooth = (pts) => {
      if (pts.length < 2) return '';
      let d = `M${pts[0][0].toFixed(1)},${pts[0][1].toFixed(1)}`;
      for (let i = 0; i < pts.length - 1; i++) {
        const [x1, y1] = pts[i], [x2, y2] = pts[i + 1];
        const mx = (x1 + x2) / 2;
        d += ` C${mx.toFixed(1)},${y1.toFixed(1)} ${mx.toFixed(1)},${y2.toFixed(1)} ${x2.toFixed(1)},${y2.toFixed(1)}`;
      }
      return d;
    };
    // y축 눈금 4개 (만원 → 억/만원 라벨)
    const ticks = Array.from({ length: 4 }, (_, i) => min + (range / 3) * i).map(v => ({ y: yPos(v), label: fmtWon(v) }));
    return { W, H, padL, padR, padB, labels, series: series.map(s => ({ ...s, pts: ptsOf(s.arr) })), pathSmooth, ticks, xPos };
  };
  const coffeeQChart = buildQChart(coffeeQuant?.trend);
  // 6개월 표 행 (상위20%/평균/하위20%) — 커피 trend 기준, 만원→억/만원 표기
  const coffeeTrend = coffeeQuant?.trend || null;
  const bakeryTrend = cafeBakeryQuant?.trend || null;
  const qTableRows = coffeeTrend ? [
    { label: '상위 20%', arr: coffeeTrend.top, accent: true },
    { label: '평균', arr: coffeeTrend.avg, accent: false },
    { label: '하위 20%', arr: coffeeTrend.bottom, accent: false },
  ] : [];
  // 제과(베이커리) 6개월 표 행 — cafeBakeryQuant.trend 기준. 데이터 없으면 빈 배열.
  const bTableRows = bakeryTrend ? [
    { label: '상위 20%', arr: bakeryTrend.top, accent: true },
    { label: '평균', arr: bakeryTrend.avg, accent: false },
    { label: '하위 20%', arr: bakeryTrend.bottom, accent: false },
  ] : [];

  // ── [2026-07-01 커피+제과 합산] 잠재 매출(전체) 대표 숫자 + 합산 추이 3계열 차트 ──
  const combinedAvgStr = (typeof bd.combinedAvgStr === 'string' && bd.combinedAvgStr) ? bd.combinedAvgStr : null;
  const combinedTop20Str = (typeof bd.combinedTop20Str === 'string' && bd.combinedTop20Str) ? bd.combinedTop20Str : null;
  const regionLabel = (typeof bd.regionLabel === 'string' && bd.regionLabel.trim()) ? bd.regionLabel.trim() : null;
  const hasCoffee = !!(coffeeQuant && (coffeeQuant.avgStr || coffeeQuant.topStr));
  const hasBakery = !!(cafeBakeryQuant && (cafeBakeryQuant.avgStr || cafeBakeryQuant.topStr));
  const isCombined = hasCoffee && hasBakery; // 둘 다 있을 때만 '합산'이라고 명시

  // 합산 매출 추이 차트 (파란선=합산, 흰선2=커피/제과 각 평균). metric=trend.avg.
  //   3계열 모두 '월별 평균(avg)'을 그린다. buildQChart 와 같은 좌표계·톤을 재사용.
  const CWHITE = "#e8e8e8", CWHITE2 = "#9a9a9a"; // 흰 선(커피/제과)
  const buildCombinedChart = () => {
    const cAvg = bd.coffeeTrendAvg || null;   // {labels, values}
    const bAvg = bd.bakeryTrendAvg || null;   // {labels, values}
    const comb = bd.combinedTrend || null;    // {labels, values}
    // 우선 합산(comb) 라벨을 x축 기준으로. comb 없으면 커피만.
    const base = comb || cAvg || bAvg || null;
    if (!base || !Array.isArray(base.labels) || base.labels.length < 2) return null;
    const labels = base.labels;
    // 라벨→값 매핑 헬퍼(월 라벨 기준 정렬 대응)
    const mapOf = (obj) => {
      const m = new Map();
      if (obj && Array.isArray(obj.labels)) obj.labels.forEach((lb, i) => { m.set(lb, obj.values ? obj.values[i] : null); });
      return m;
    };
    const combM = mapOf(comb), coffM = mapOf(cAvg), bakM = mapOf(bAvg);
    const pick = (m) => labels.map(lb => { const v = m.get(lb); return (v != null && isFinite(v)) ? v : null; });
    const series = [];
    // 합산(파랑) — 둘 다 있을 때만 별도 선. 하나뿐이면 그 업종 선이 곧 전체라 합산선 생략.
    if (isCombined && comb) series.push({ key: 'combined', arr: pick(combM), color: ACC, w: 2.8, dot: true });
    if (hasCoffee && cAvg) series.push({ key: 'coffee', arr: pick(coffM), color: CWHITE, w: 1.8, dot: false });
    if (hasBakery && bAvg) series.push({ key: 'bakery', arr: pick(bakM), color: CWHITE2, w: 1.8, dot: false });
    const allVals = series.flatMap(s => (s.arr || []).filter(v => v != null && isFinite(v)));
    if (allVals.length < 2) return null;
    const rawMax = Math.max(...allVals), rawMin = Math.min(...allVals);
    const span = (rawMax - rawMin) || 1;
    const max = rawMax + span * 0.1;
    const min = Math.max(0, rawMin - span * 0.1);
    const range = (max - min) || 1;
    // [2026-07-01] 오른쪽 끝 월 라벨/마지막 dot 잘림 방지 → padR 여유 확보(dot r=5 + 라벨 반쪽).
    const W = 700, H = 220, padL = 82, padR = 34, padB = 30, padT = 16;
    const innerW = W - padL - padR, innerH = H - padT - padB;
    const n = labels.length;
    const xPos = (i) => padL + (n <= 1 ? 0 : (i / (n - 1)) * innerW);
    const yPos = (v) => padT + innerH - ((v - min) / range) * innerH;
    const ptsOf = (arr) => (arr || []).map((v, i) => (v != null && isFinite(v)) ? [xPos(i), yPos(v), v, i] : null).filter(Boolean);
    const pathSmooth = (pts) => {
      if (pts.length < 2) return '';
      let d = `M${pts[0][0].toFixed(1)},${pts[0][1].toFixed(1)}`;
      for (let i = 0; i < pts.length - 1; i++) {
        const [x1, y1] = pts[i], [x2, y2] = pts[i + 1];
        const mx = (x1 + x2) / 2;
        d += ` C${mx.toFixed(1)},${y1.toFixed(1)} ${mx.toFixed(1)},${y2.toFixed(1)} ${x2.toFixed(1)},${y2.toFixed(1)}`;
      }
      return d;
    };
    const ticks = Array.from({ length: 4 }, (_, i) => min + (range / 3) * i).map(v => ({ y: yPos(v), label: fmtWon(v) }));
    // 범례: 합산(파랑) + 있는 업종만 흰 선
    const legend = [];
    if (isCombined) legend.push(['합산', ACC]);
    if (hasCoffee) legend.push(['커피', CWHITE]);
    if (hasBakery) legend.push(['제과', CWHITE2]);
    return { W, H, padL, padR, padB, labels, series: series.map(s => ({ ...s, pts: ptsOf(s.arr) })), pathSmooth, ticks, xPos, legend };
  };
  const combinedChart = buildCombinedChart();

  return (
    <CardShell n="05" id="05"
      bruSummary={body.bruSummary}
      title="매출 분석"
      sub="동네 월평균 매출"
      date={null}>
      {/* [2026-06-30] 헤드라인 '월평균 매출'(소상공인 1억) hero 타일 제거 — 매출 큰숫자 스토리는 아래 두 구간(커피/베이커리) 분위가 대신함. KPI는 보조 3칸만. */}
      <div style={{display:"grid", gridTemplateColumns:"repeat(3, 1fr)", gap:16, marginBottom:16}}>
        {/* [2026-06-24] 월 매출 건수 = 진짜 월 이용건수(bd.bizmapAvgUsageCnt, 이미 "23,605건" 형태 문자열). 없으면 dongSaleCnt 폴백. */}
        {(() => {
          const _usageStr = (typeof bd.bizmapAvgUsageCnt === 'string' && bd.bizmapAvgUsageCnt.trim()) ? bd.bizmapAvgUsageCnt.trim() : '';
          const _usageNum = Number(bd.bizmapAvgUsageCnt) || 0;
          if (_usageStr) {
            return <StatTile id="c6.tile2" tone="mint"  label="월 매출 건수"    value={_usageStr}/>;
          }
          if (_usageNum > 0) {
            return <StatTile id="c6.tile2" tone="mint"  label="월 매출 건수"    value={_usageNum.toLocaleString()} unit="건"/>;
          }
          return <StatTile id="c6.tile2" tone="mint"  label="월 매출 건수"    value={dongSaleCnt > 0 ? dongSaleCnt.toLocaleString() : '-'} unit={dongSaleCnt > 0 ? '건' : ''}/>;
        })()}
        <StatTile id="c6.tile3" tone="lilac" label="객단가"          value={unitPriceDisplay} est={unitPriceDisplay !== '-' && _isEst('unitPrice', 'avgPrice', 'avgUnitPrice')}/>
        <StatTile id="c6.tile4" tone="cream" label="매출 순위"       value={cafeSalesRank ? String(cafeSalesRank).split(' /')[0] : '-'}/>
      </div>

      {/* ── [2026-07-01 커피+제과 합산 매출] 빈크래프트는 커피+베이커리를 함께 판다 ──
          전체매출 = 커피 평균 + 제과 평균(같은 비즈맵 저울). 둘 다 있을 때만 '합산' 명시. */}
      {hasQuantile && (
        <div style={{marginBottom:16, display:"flex", flexDirection:"column", gap:24}}>

          {/* 0. 전체매출 대표 숫자 (커피+베이커리 합산) — 카드 상단 헤드라인 */}
          {(combinedAvgStr || combinedTop20Str) && (
            <div style={{
              padding:"26px 28px", borderRadius:16,
              border:"1px solid rgba(76,123,228,0.55)",
              background:"linear-gradient(135deg, rgba(76,123,228,0.14), rgba(76,123,228,0.04))",
              display:"flex", flexWrap:"wrap", alignItems:"flex-end", justifyContent:"space-between", gap:20,
            }}>
              <div>
                <div style={{display:"flex", alignItems:"center", gap:10, marginBottom:12, flexWrap:"wrap"}}>
                  <span style={{fontSize:15, color:"var(--matte-fg-2)", fontWeight:700}}>전체 매출 (잠재)</span>
                  <span style={{fontSize:12, fontWeight:700, color:ACC, padding:"4px 10px", borderRadius:999, border:"1px solid rgba(76,123,228,0.45)", background:"rgba(76,123,228,0.08)", whiteSpace:"nowrap"}}>
                    {isCombined ? '커피 + 베이커리 합산' : (hasBakery ? '베이커리' : '커피 전문점')}
                  </span>
                </div>
                <div style={{display:"flex", alignItems:"baseline", gap:8}}>
                  <span style={{fontSize:54, fontWeight:800, color:ACC_VAL, fontVariantNumeric:"tabular-nums", letterSpacing:"-0.02em", lineHeight:1}}>{combinedAvgStr || '-'}</span>
                  <span style={{fontSize:17, color:"var(--matte-fg-3)", fontWeight:600}}>/월</span>
                </div>
                <div style={{marginTop:8, fontSize:13, color:"var(--matte-fg-3)"}}>
                  {isCombined ? '커피 평균 + 제과 평균' : (hasBakery ? '제과 평균' : '커피 평균')}
                </div>
              </div>
              {combinedTop20Str && (
                <div style={{textAlign:"right"}}>
                  <div style={{fontSize:13.5, color:"var(--matte-fg-3)", fontWeight:500, marginBottom:8}}>
                    상위 20% {isCombined ? '합산' : ''}
                  </div>
                  <div style={{display:"flex", alignItems:"baseline", gap:6, justifyContent:"flex-end"}}>
                    <span style={{fontSize:26, fontWeight:700, color:"#fff", fontVariantNumeric:"tabular-nums", letterSpacing:"-0.01em"}}>{combinedTop20Str}</span>
                    <span style={{fontSize:13, color:"var(--matte-fg-4)", fontWeight:600}}>/월</span>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* 1. 커피 전문점 구간 — 상위20/중위/평균/하위(각자). 추이는 아래 합산 차트로 통합해 여기선 생략. */}
          <SalesSegment
            title="커피 전문점"
            q={coffeeQuant}
            fmtWon={fmtWon}
            accent={ACC} accentVal={ACC_VAL} grayAvg={GRAY_AVG} grayBtm={GRAY_BTM}
            qChart={null}
          />

          {/* 2. {검색 동} · 베이커리 구간 — 검색 동의 제과 분위(cafeBakeryQuant). 상위20/중위/평균/하위(각자).
               cafeBakeryQuant 없으면 SalesSegment가 null → 아래 전국평균 폴백 블록만 노출. */}
          <SalesSegment
            title={`${regionLabel ? regionLabel + ' · ' : ''}베이커리`}
            q={cafeBakeryQuant}
            fmtWon={fmtWon}
            accent={ACC} accentVal={ACC_VAL} grayAvg={GRAY_AVG} grayBtm={GRAY_BTM}
            qChart={null}
          />

          {/* [2026-07-01] 베이커리 전국 평균 폴백 (정직 블록) — 검색 동 제과 분위가 null일 때만.
              라벨에 '전국 평균' 정직 표기. 값 없으면(null) 미노출(가짜값 금지). */}
          {!(cafeBakeryQuant && cafeBakeryQuant.topStr) && bakeryNationalAvg && (
            <div className="bc-box" style={{padding:"18px 20px"}}>
              <div style={{display:"flex", alignItems:"baseline", justifyContent:"space-between", flexWrap:"wrap", gap:8}}>
                <div style={{fontSize:14, color:"#A3A3A3", fontWeight:600}}>베이커리 · 전국 평균</div>
                <div style={{fontSize:12.5, color:"#777"}}>점포당 월평균</div>
              </div>
              <div style={{marginTop:8, fontSize:26, fontWeight:700, color:ACC_VAL, fontVariantNumeric:"tabular-nums"}}>
                월 {fmtWon(bakeryNationalAvg)}
              </div>
              <div style={{marginTop:6, fontSize:12.5, color:"var(--matte-fg-3)", lineHeight:1.5}}>
                {bakeryNationalStores ? `전국 ${bakeryNationalStores.toLocaleString()}개 점포` : '전국 제과점'}
                {bakeryNationalPeriodFmt ? ` · 기준월 ${bakeryNationalPeriodFmt}` : ''}
              </div>
            </div>
          )}

          {/* 3. 매출 추이 (파란선=합산 · 흰선=커피/제과 각 평균). metric=trend.avg. 월 라벨 정렬. */}
          {combinedChart && (
            <div className="bc-box" style={{padding:"20px 22px"}}>
              <div style={{display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:16, flexWrap:"wrap", gap:8}}>
                <div style={{fontSize:15, fontWeight:600}}>매출 추이 (월별 평균)</div>
                <div style={{display:"flex", gap:16}}>
                  {combinedChart.legend.map(([lg, c]) => (
                    <span key={lg} style={{display:"inline-flex", alignItems:"center", gap:6, fontSize:13, color:"var(--matte-fg-3)"}}>
                      <span style={{width:14, height:3, borderRadius:2, background:c, display:"inline-block"}}></span>{lg}
                    </span>
                  ))}
                </div>
              </div>
              <svg width="100%" height={combinedChart.H} viewBox={`0 0 ${combinedChart.W} ${combinedChart.H}`} preserveAspectRatio="none" style={{display:"block"}}>
                {combinedChart.ticks.map((t, i) => (
                  <g key={i}>
                    <line x1={combinedChart.padL} y1={t.y} x2={combinedChart.W - combinedChart.padR} y2={t.y} stroke="rgba(255,255,255,0.05)"/>
                    <text x={combinedChart.padL - 10} y={t.y + 4} fontSize="13" fill="#A3A3A3" textAnchor="end" style={{fontVariantNumeric:"tabular-nums"}}>{t.label}</text>
                  </g>
                ))}
                {[...combinedChart.series].reverse().map(s => (
                  s.pts.length >= 2 ? (
                    <path key={s.key} d={combinedChart.pathSmooth(s.pts)} fill="none" stroke={s.color} strokeWidth={s.w} strokeLinecap="round" vectorEffect="non-scaling-stroke" opacity={s.key === 'combined' ? 1 : 0.85}/>
                  ) : null
                ))}
                {(() => {
                  const lead = combinedChart.series.find(s => s.key === 'combined') || combinedChart.series[0];
                  if (!lead || lead.pts.length === 0) return null;
                  const last = lead.pts[lead.pts.length - 1];
                  return <circle cx={last[0]} cy={last[1]} r="5" fill={lead.color}/>;
                })()}
                {combinedChart.labels.map((m, i) => {
                  // [2026-07-01] 첫/끝 라벨은 start/end 로 붙여 좌우 넘침 방지, 중간은 가운데.
                  const _anchor = i === 0 ? "start" : (i === combinedChart.labels.length - 1 ? "end" : "middle");
                  return (
                    <text key={i} x={combinedChart.xPos(i)} y={combinedChart.H - 8} fontSize="13" fill="#A3A3A3" textAnchor={_anchor}>{m}</text>
                  );
                })}
              </svg>
            </div>
          )}

          {/* 4. 분위 표 — 커피 + 제과 둘 다 행으로(각 업종 상위20/중위/평균/하위 + 기준월) */}
          {(coffeeTrend || bakeryTrend) && (
            <div className="bc-box" style={{padding:"18px 20px", overflowX:"auto"}}>
              {[
                { seg: '커피 전문점', trend: coffeeTrend, rows: qTableRows },
                { seg: `${regionLabel ? regionLabel + ' · ' : ''}베이커리`, trend: bakeryTrend, rows: bTableRows },
              ].filter(t => t.trend).map((tbl, ti) => (
                <table key={ti} style={{width:"100%", borderCollapse:"collapse", fontVariantNumeric:"tabular-nums", marginTop: ti > 0 ? 20 : 0}}>
                  <thead>
                    <tr>
                      <th style={{textAlign:"left", fontSize:13, color:"#A3A3A3", fontWeight:600, padding:"8px 10px", whiteSpace:"nowrap"}}>{tbl.seg}</th>
                      {tbl.trend.labels.map((m, i) => (
                        <th key={i} style={{textAlign:"right", fontSize:13, color:"#A3A3A3", fontWeight:600, padding:"8px 10px", whiteSpace:"nowrap"}}>{m}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {tbl.rows.map((row, ri) => (
                      <tr key={ri} style={row.accent ? {background:"rgba(76,123,228,0.06)"} : undefined}>
                        <td style={{textAlign:"left", fontSize:13.5, fontWeight:row.accent?700:500, color:row.accent?ACC:"var(--matte-fg-2)", padding:"10px 10px", whiteSpace:"nowrap", borderTop:"1px solid var(--matte-line)"}}>{row.label}</td>
                        {(row.arr || []).map((v, ci) => {
                          const isLast = ci === (row.arr.length - 1);
                          const txt = (v != null && isFinite(v)) ? fmtWon(v) : '-';
                          return (
                            <td key={ci} style={{textAlign:"right", fontSize:13.5, fontWeight:(row.accent && isLast)?700:500, color:(row.accent && isLast)?ACC:(row.accent?"var(--matte-fg)":"var(--matte-fg-3)"), padding:"10px 10px", whiteSpace:"nowrap", borderTop:"1px solid var(--matte-line)"}}>{txt}</td>
                          );
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              ))}
            </div>
          )}
        </div>
      )}

      <div style={{display:"grid", gridTemplateColumns:"2fr 1fr", gap:16}}>
        <div className="bc-box" style={{padding:24, display:"flex", flexDirection:"column"}}>
          <div style={{display:"flex", justifyContent:"space-between", alignItems:"baseline", marginBottom:18}}>
            <div style={{fontSize:16, fontWeight:600}}>매출 추이</div>
            <div style={{fontSize:13, color:"var(--matte-fg-3)"}}>{lineLabels.length > 0 ? '최근 1년' : ''}</div>
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

          {/* [2026-06-30 매출 한 저울] 동 최고/평균/최저 전부 '비즈맵 커피 분위'(coffeeQuant) 한 저울로 통일.
              · 동 최고 = coffeeQuant.topNum(상위20%) · 동 평균 = coffeeQuant.avgNum(분위 평균) · 동 최저 = coffeeQuant.btmNum(하위20%)
              위 '커피 전문점' 구간(상위/평균/하위)과 같은 출처라 같은라벨≠다른값 충돌이 원천적으로 없음(소상공인 1086 잔재 제거).
              분위가 다 있으면 셋 다 양수 → '-' 안 나옴. 정렬 보장(최저≤평균≤최고)으로 clamp.
              분위가 전부 없을 때만(비수도권 등) 소상공인 동최고/최저로 폴백, 그것도 0이면 그 항목은 '추정' 배지+가능한 값, 정 안 되면 라벨 자체를 숨긴다(단독 '-' 금지). */}
          {(() => {
            const _qTopN = Number(coffeeQuant?.topNum) || 0;     // 상위20%(만원)
            const _qAvgN = Number(coffeeQuant?.avgNum) || 0;     // 분위 평균(만원)
            const _qBtmN = Number(coffeeQuant?.btmNum) || 0;     // 하위20%(만원)
            const _hasQuantile = _qTopN > 0 && _qBtmN > 0;        // 분위 최고·최저 둘 다 있으면 분위 모드

            // 값 + 추정여부 결정. estTrue = 1순위 소스(비즈맵 커피 분위)가 없어 폴백으로 채운 경우.
            let _maxN, _avgN, _minN, _maxEst = false, _avgEst = false, _minEst = false;
            if (_hasQuantile) {
              // [2026-06-30] 최고/평균/최저 셋 다 비즈맵 커피 분위(이미 정렬) 그대로 — 위 커피 구간과 동일 저울.
              _maxN = _qTopN;
              _avgN = (_qAvgN > 0 ? _qAvgN : Math.round((_qTopN + _qBtmN) / 2));
              _minN = _qBtmN;
            } else {
              // 폴백: 소상공인 동최고/최저(0이면 추정 배지로 표시). 평균은 동 카페 평균.
              const _cafeAvgRaw = (Number(bd.dongCafeAvgStable) > 0 ? Number(bd.dongCafeAvgStable) : (Number(bd.monthly) || 0));
              _maxN = dongMax; _maxEst = !(dongMax > 0);
              _minN = dongMin; _minEst = !(dongMin > 0);
              _avgN = _cafeAvgRaw; _avgEst = !(_cafeAvgRaw > 0);
            }
            // 정렬 보장(최저 ≤ 평균 ≤ 최고). 평균이 범위 밖이면 clamp.
            if (_maxN > 0 && _minN > 0 && _avgN > 0) {
              const lo = Math.min(_maxN, _minN), hi = Math.max(_maxN, _minN);
              _avgN = Math.min(hi, Math.max(lo, _avgN));
            }
            // 폴백에서 값이 0이면 가능한 다른 카페 값으로 메워 단독 '-' 방지. 그래도 0이면 라벨 숨김.
            if (!_hasQuantile) {
              if (!(_maxN > 0) && _avgN > 0) { _maxN = _avgN; _maxEst = true; }
              if (!(_minN > 0) && _avgN > 0) { _minN = _avgN; _minEst = true; }
            }
            const _cells = [];
            if (_maxN > 0) _cells.push(["동 최고", fmtWon(_maxN), false, _maxEst]);
            if (_avgN > 0) _cells.push(["동 평균", fmtWon(_avgN), true, _avgEst]);
            if (_minN > 0) _cells.push(["동 최저", fmtWon(_minN), false, _minEst]);
            _cells.push(["전년 대비", yoyRate ? `${yoyRate > 0 ? '+' : ''}${window.bcFmtPct ? window.bcFmtPct(Number(yoyRate)) : Number(yoyRate).toFixed(1)}%` : '-', false, false]);
            const _cols = _cells.length;
            return (
          <div style={{marginTop:"auto", paddingTop:20, borderTop:"1px solid var(--matte-line)", display:"grid", gridTemplateColumns:`repeat(${_cols}, 1fr)`, gap:14}}>
            {_cells.map(([l, v, acc, est]) => (
              <div key={l} style={{padding:"14px 16px", background:"rgba(255,255,255,0.03)", borderRadius:10, border:"1px solid var(--matte-line)"}}>
                <div style={{fontSize:13, color:"var(--matte-fg-3)", marginBottom:6, fontWeight:500, display:"flex", alignItems:"center", gap:6}}>
                  {l}
                  {est && <span style={{fontSize:10, fontWeight:600, color:"var(--matte-fg-4)", border:"1px solid var(--matte-line)", borderRadius:4, padding:"1px 5px", lineHeight:1.3}}>추정</span>}
                </div>
                <div style={{fontSize:20, fontWeight:700, fontVariantNumeric:"tabular-nums", color: acc ? "#4C7BE4" : "var(--matte-fg)", letterSpacing:"-0.01em"}}>{v}</div>
              </div>
            ))}
          </div>
            );
          })()}
          {marketSizeStr && (
            <div style={{marginTop:14, padding:"14px 16px", background:"rgba(76,123,228,0.06)", borderRadius:10, border:"1px solid var(--matte-line)", display:"flex", justifyContent:"space-between", alignItems:"baseline", gap:12}}>
              <span style={{fontSize:13, color:"var(--matte-fg-3)", fontWeight:500}}>상권 시장 규모<span style={{fontSize:12, color:"var(--matte-fg-4)", marginLeft:6, fontWeight:500}}>(이 동네 카페 매출 합계)</span></span>
              <span style={{display:"flex", alignItems:"baseline", gap:10}}>
                <span style={{fontSize:20, fontWeight:700, fontVariantNumeric:"tabular-nums", color:"#4C7BE4", letterSpacing:"-0.01em"}}>{marketSizeStr}</span>
                {marketTrendStr && <span style={{fontSize:13, color:"var(--matte-fg-3)", fontWeight:600}}>{marketTrendStr}</span>}
              </span>
            </div>
          )}
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
  // [2026-06-15] 공간단위 태그 — 큰 숫자의 범위 표시(라벨만, 값/계산 무변경)
  //   동 라벨: 데이터에 있으면 사용(우리 동 = top3Dongs/ topArea 첫 항목·역할상 우리 동), 없으면 생략(빈 태그 금지)
  const _dongName = (typeof bd.dongName === 'string' && bd.dongName.trim())
    || (typeof body.dongName === 'string' && body.dongName.trim())
    || (top3Dongs[0] && typeof top3Dongs[0].name === 'string' && top3Dongs[0].name.trim())
    || (topArea && typeof topArea.name === 'string' && topArea.name.trim())
    || '';
  const _dongTag = _dongName || '우리 동';
  const _radiusM = (typeof body.radius === 'number' && body.radius > 0) ? `반경 ${body.radius}m` : '반경 500m';
  return (
    <CardShell n="07" id="07"
      bruSummary={body.bruSummary}
      title="유동인구"
      sub="시간대별 통행량">
      <div className="bc-grid-4" style={{gap:16, marginBottom:16}}>
        <StatTile id="c7.tile1" tone="blue"  label="동 월간 유동인구" tag={_dongTag} value={dongDailyPop > 0 ? dongDailyPop.toLocaleString() : (totalPop > 0 ? totalPop.toLocaleString() : '-')} unit={(dongDailyPop > 0 || totalPop > 0) ? '명' : ''} hero/>
        <StatTile id="c7.tile2" tone="mint"  label="최다 요일"        value={peakDay !== '-' ? peakDay : '-'} sub={peakDayPct > 0 ? `주간 통행의 ${window.bcFmtPct ? window.bcFmtPct(Number(peakDayPct)) : Number(peakDayPct).toFixed(1)}%` : undefined}/>
        <StatTile id="c7.tile3" tone="lilac" label="최다 시간대"      value={peakHour !== '-' ? peakHour : '-'} sub={peakHourPct > 0 ? `통행의 ${window.bcFmtPct ? window.bcFmtPct(Number(peakHourPct)) : Number(peakHourPct).toFixed(1)}%` : undefined}/>
        <StatTile id="c7.tile4" tone="cream" label="유동인구"          tag={_radiusM} value={totalPop > 0 ? totalPop.toLocaleString() : '-'} unit={totalPop > 0 ? '명/일' : ''}/>
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
                  <span style={{fontVariantNumeric:"tabular-nums", color:"var(--fg-2)"}}>{(() => {
                    const _p = Number(d.pop) || 0;
                    // [2026-06-30] '10.1만/일' 축약 폐기 → 우리 동(2,823명/일)과 같은 전체 콤마 표기로 통일(보기 좋게).
                    return _p > 0 ? `${_p.toLocaleString()}명/일` : '-';
                  })()}</span>
                </div>
                );
              })}
              {/* [2026-06-25] 우리 동이 자치구 전체에서 차지하는 비중(%). 화면에 이미 뜨는 두 값만 재사용:
                  우리동=topAreaList[0].pop, 자치구=role '자치구 전체'로 잡힌 항목의 pop. 자치구 값 없으면 줄 생략(0 나누기 방지). */}
              {(() => {
                const _myPop = Number(topAreaList[0] && topAreaList[0].pop) || 0;
                const _guItem = topAreaList.find((d, i) => {
                  if (i === 0) return false;
                  const nm = String(d.name || '').trim();
                  return (sigungu && nm === sigungu) || /(구|군|시)$/.test(nm);
                });
                const _guPop = Number(_guItem && _guItem.pop) || 0;
                if (_myPop <= 0 || _guPop <= 0) return null;
                const _share = (_myPop / _guPop) * 100;
                return (
                  <div style={{marginTop:10, paddingTop:10, borderTop:"1px solid var(--line)", display:"flex", justifyContent:"flex-end"}}>
                    <span style={{fontSize:13, color:"var(--fg-3)"}}>자치구 전체의 약 </span>
                    <span style={{fontSize:15, fontWeight:700, color:"#4C7BE4", fontVariantNumeric:"tabular-nums", marginLeft:4}}>{_share.toFixed(1)}%</span>
                  </div>
                );
              })()}
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
