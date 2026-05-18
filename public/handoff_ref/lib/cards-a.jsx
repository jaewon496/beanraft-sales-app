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
  const cafeCount = body.cafeCount ?? 350;
  const franchise = body.franchise ?? 47;
  const individual = body.individual ?? 71;
  const bakery = body.bakery ?? 8;
  const newOpen = body.newOpen ?? 5;
  const closed = body.closed ?? 8;
  const rentPerPyeong = body.rentPerPyeong ?? 42;
  const vacancyRate = body.vacancyRate;
  const vacancyDisplay = vacancyRate != null && vacancyRate > 0 ? Number(vacancyRate).toFixed(1) : "4.2";
  const totalStores = cafeCount + bakery;
  const donutTotal = individual + franchise + bakery;
  const indiePct = donutTotal > 0 ? Math.round((individual / donutTotal) * 100) : 56;
  const franPct = donutTotal > 0 ? Math.round((franchise / donutTotal) * 100) : 37;
  const bakPct = donutTotal > 0 ? Math.max(0, 100 - indiePct - franPct) : 7;
  const rentFallback = [34,35,35,36,37,38,38,39,40,41,42,42];
  const vacancyFallback = [6.4,6.0,5.5,5.2,5.0,4.8,4.7,4.5,4.4,4.3,4.2,4.2];
  const rentSeriesRaw = (Array.isArray(body.rentSeries) && body.rentSeries.length > 0)
    ? body.rentSeries.map(s => Math.round((Number(s?.value) || 0) / 10000)).filter(v => v > 0)
    : [];
  const rentSeries = rentSeriesRaw.length >= 2 ? rentSeriesRaw : rentFallback;
  const vacancySeriesRaw = (Array.isArray(body.vacancySeries) && body.vacancySeries.length > 0)
    ? body.vacancySeries.map(s => Number(s?.value) || 0).filter(v => v > 0)
    : [];
  const vacancySeries = vacancySeriesRaw.length >= 2 ? vacancySeriesRaw : vacancyFallback;
  const priceChange = body.priceChange;
  return (
    <CardShell n="01" id="01"
      title="상권 분석 리포트"
      sub="반경 500m 매장 구성과 임대 시세"
      sources={["소상공인진흥공단", "나이스비즈맵", "한국부동산원 (KOSIS 408)"]}
      headerRight={window.MapTriggerButton ? <window.MapTriggerButton/> : null}>
      {/* Top: hero + donut */}
      <div className="bc-grid-4" style={{gap:16, marginBottom:16}}>
        <StatTile id="c1.tile1" tone="blue"  label="카페 수"        value={String(totalStores)} unit="개" delta="6.7" deltaPositive hero/>
        <StatTile id="c1.tile2" tone="lilac" label="프랜차이즈"     value={String(franchise)}    unit="개" delta="4.1" deltaPositive/>
        <StatTile id="c1.tile3" tone="mint"  label="평당 월세"      value={String(rentPerPyeong)}                unit="만원" delta={priceChange != null && Number(priceChange) !== 0 ? String(Math.abs(Number(priceChange)).toFixed(1)) : null} deltaPositive={priceChange == null || Number(priceChange) >= 0}/>
        <StatTile id="c1.tile4" tone="rose"  label="공실률"         value={vacancyDisplay}               unit="%"   delta="0.6" deltaPositive={false}/>
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
          <div style={{display:"flex", alignItems:"center", gap:18, justifyContent:"center"}}>
            <Donut id="c1.donut" size={200} segments={[
              {value:indiePct, color:"#4C7BE4", label:"개인 카페"},
              {value:franPct, color:"#FFFFFF", label:"프랜차이즈"},
              {value:bakPct,  color:"#7a7a7a", label:"베이커리"},
            ]} centerLabel={String(cafeCount)} centerSub="카페 매장"/>
            <DonutLegend segments={[
              {value:indiePct, color:"#4C7BE4", label:"개인", text:`${indiePct}%`},
              {value:franPct, color:"#FFFFFF", label:"프랜차이즈", text:`${franPct}%`},
              {value:bakPct,  color:"#7a7a7a", label:"베이커리", text:`${bakPct}%`},
            ]}/>
          </div>
        </div>
      </div>

      {/* Lower: 3 quarter trends */}
      <div className="bc-grid-3" style={{gap:12, marginTop:16}}>
        {[
          { l:"평당 월세", v:`${rentPerPyeong}만원`, d: priceChange != null && Number(priceChange) !== 0 ? `${Number(priceChange) > 0 ? '+' : ''}${Number(priceChange).toFixed(1)}` : null, color:"#FFFFFF", data: rentSeries },
          { l:"공실률",   v:`${vacancyDisplay}%`,   d:"-2.2", color:"#FFFFFF", data: vacancySeries },
          { l:"신규 개업", v:`${newOpen}개`,     d: closed > 0 ? `${newOpen > closed ? '+' : ''}${Math.round(((newOpen - closed) / Math.max(1, closed)) * 100)}` : "+25",  color:"#4C7BE4", data:[Math.max(0, newOpen - closed), newOpen] },
        ].map((t, i) => (
          <div key={i} className="bc-box" style={{padding:18}}>
            <div style={{display:"flex", justifyContent:"space-between", alignItems:"baseline", marginBottom:10}}>
              <span style={{fontSize:14, color:"var(--matte-fg-3)", fontWeight:500}}>{t.l}</span>
              {t.d != null && <span style={{fontSize:14, color: t.color === "#4C7BE4" ? "#4C7BE4" : "var(--matte-fg-2)", fontWeight:600, fontVariantNumeric:"tabular-nums"}}>{t.d}%</span>}
            </div>
            <div style={{fontSize:24, fontWeight:700, marginBottom:14, fontVariantNumeric:"tabular-nums", letterSpacing:"-0.01em"}}>{t.v}</div>
            <Sparkline data={t.data} height={56} color={t.color}/>
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
  const topAge = body.topAge || bd.topAge || "30대";
  const maleRatio = body.maleRatio ?? bd.male ?? cd.male ?? 51;
  const femaleRatio = body.femaleRatio ?? bd.female ?? cd.female ?? 49;
  const regularPct = bd.regular ?? 38;
  const newCustomerPct = bd.newCustomer ?? 62;
  const weekdayPct = body.weekdayPct ?? bd.weekdayPct ?? cd.weekdayPct ?? 77;
  const weekendPct = body.weekendPct ?? bd.weekendPct ?? cd.weekendPct ?? 23;
  const peakHour = body.peakHour || bd.peakHour || cd.peakHour || "12 ~ 18시";
  const ageGroups = (Array.isArray(cd.ageGroups) && cd.ageGroups.length > 0)
    ? cd.ageGroups.map(g => ({ l: g?.name || "-", v: Number(g?.pct) || 0, t: `${Number(g?.pct) || 0}%` }))
    : [
        {l:"20대", v:24, t:"24%"},
        {l:"30대", v:34, t:"34%"},
        {l:"40대", v:23, t:"23%"},
        {l:"50대+", v:19, t:"19%"},
      ];
  const topAgeIdx = ageGroups.findIndex(g => g.l === topAge);
  const earn = bd.customerYrEarn || null;
  const maleIncome = Number(earn?.male) || 0;
  const femaleIncome = Number(earn?.female) || 0;
  const maleMonthly = maleIncome > 0 ? Math.round(maleIncome / 12) : 487;
  const femaleMonthly = femaleIncome > 0 ? Math.round(femaleIncome / 12) : 412;
  const parseLifeStr = (s) => {
    if (!s || typeof s !== "string") return null;
    const items = s.split(",").map(t => {
      const m = t.trim().match(/^(.+?)\s*\(([\d.]+)%\)$/);
      return m ? m[1].trim() : t.trim();
    }).filter(Boolean).slice(0, 5);
    return items.length > 0 ? items : null;
  };
  const femaleKw = parseLifeStr(bd.femaleLifestyle) || ["브런치", "SNS 인증", "미팅", "디저트 카페", "포토존"];
  const maleKw = parseLifeStr(bd.maleLifestyle) || ["업무", "스터디", "퇴근 후", "회의", "혼카페"];
  return (
    <CardShell n="02" id="02"
      title="고객 분석"
      sub="방문 고객 특성"
      sources={["나이스비즈맵", "통계청 인구주택총조사"]}>
      {/* 4-up KPI */}
      <div className="bc-grid-4" style={{gap:16, marginBottom:16}}>
        <StatTile id="c2.tile1" tone="blue"  label="주요 연령대"   value={String(topAge)}     delta="34" deltaPositive hero accent/>
        <StatTile id="c2.tile2" tone="lilac" label="성비 (여:남)" value={`${femaleRatio} : ${maleRatio}`}/>
        <StatTile id="c2.tile3" tone="mint"  label="재방문율" value={String(regularPct)} unit="%" delta="6.0" deltaPositive/>
        <StatTile id="c2.tile4" tone="cream" label="신규 비율" value={String(newCustomerPct)} unit="%"/>
      </div>

      <div style={{display:"grid", gridTemplateColumns:"1.2fr 1fr", gap:16}}>
        {/* 연령대 + 소득 */}
        <div className="bc-box" style={{padding:24}}>
          <div style={{fontSize:16, fontWeight:600, marginBottom:18}}>연령대 분포</div>
          <VBars id="c2.bars" accent={topAgeIdx >= 0 ? topAgeIdx : 1} barW={48} gap={28} height={200} items={ageGroups}/>
          <div style={{marginTop:24, paddingTop:20, borderTop:"1px solid var(--matte-line)"}}>
            <div style={{fontSize:14, color:"var(--matte-fg-3)", fontWeight:500, marginBottom:14}}>평균 소득 (월)</div>
            <div style={{display:"flex", flexDirection:"column", gap:14}}>
              {[
                ["남성", maleMonthly, Math.max(600, maleMonthly, femaleMonthly), "#FFFFFF"],
                ["여성", femaleMonthly, Math.max(600, maleMonthly, femaleMonthly), "#FFFFFF"],
              ].map(([who, v, max, c]) => (
                <div key={who} style={{display:"grid", gridTemplateColumns:"60px 1fr 90px", gap:14, alignItems:"center"}}>
                  <span style={{fontSize:15, color:"var(--matte-fg-2)", fontWeight:500}}>{who}</span>
                  <div className="bc-bar" style={{height:14, background:"rgba(255,255,255,0.05)"}}>
                    <div style={{width:`${(v/max)*100}%`, background:c, height:"100%", borderRadius:"inherit"}}></div>
                  </div>
                  <span style={{textAlign:"right", fontSize:17, fontWeight:700, fontVariantNumeric:"tabular-nums"}}>{v}<span style={{fontSize:13, color:"var(--matte-fg-3)", fontWeight:500, marginLeft:3}}>만원</span></span>
                </div>
              ))}
            </div>
          </div>

          <div style={{marginTop:18, paddingTop:14, borderTop:"1px solid var(--matte-line)"}}>
            <div style={{display:"flex", justifyContent:"space-between", alignItems:"baseline", marginBottom:8, fontSize:13}}>
              <span style={{color:"var(--matte-fg-3)", fontWeight:500}}>방문 목적</span>
              <span style={{color:"var(--matte-fg-3)"}}>업무·미팅 <strong style={{color:"#4C7BE4", fontWeight:700}}>38%</strong> 최다</span>
            </div>
            <div style={{display:"flex", height:10, borderRadius:5, overflow:"hidden"}}>
              {[
                ["업무·미팅", 38, "#4C7BE4"],
                ["식사·디저트", 26, "#FFFFFF"],
                ["스터디", 19, "#A9C2F4"],
                ["휴식·산책", 17, "#7a7a7a"],
              ].map(([l, v, c]) => (
                <div key={l} style={{width:`${v}%`, background:c}}></div>
              ))}
            </div>
          </div>
        </div>

        {/* 라이프스타일 */}
        <div className="bc-box" style={{padding:24}}>
          <div style={{fontSize:16, fontWeight:600, marginBottom:20}}>라이프스타일 키워드</div>
          <div style={{display:"flex", flexDirection:"column", gap:16}}>
            {[
              ["여성", `${femaleRatio}%`, femaleKw],
              ["남성", `${maleRatio}%`, maleKw],
            ].map(([who, ratio, keywords]) => (
              <div key={who} style={{padding:"20px 22px", background:"rgba(255,255,255,0.03)", borderRadius:12, border:"1px solid var(--matte-line)"}}>
                <div style={{display:"flex", justifyContent:"space-between", alignItems:"baseline", marginBottom:14}}>
                  <span style={{fontSize:16, fontWeight:700, color:"#fff"}}>{who}</span>
                  <span style={{fontSize:14, color:"var(--matte-fg-3)", fontWeight:600, fontVariantNumeric:"tabular-nums"}}>{ratio}</span>
                </div>
                <window.DrStagger id="c2.chips" delay={50} style={{display:"flex", gap:8, flexWrap:"wrap"}}>
                  {keywords.map(k => (
                    <span key={k} style={{padding:"7px 14px", background:"rgba(255,255,255,0.06)", border:"1px solid var(--matte-line)", borderRadius:8, fontSize:14, color:"var(--matte-fg-2)", fontWeight:500}}>#{k}</span>
                  ))}
                </window.DrStagger>
              </div>
            ))}
            <div style={{paddingTop:16, borderTop:"1px solid var(--matte-line)", display:"grid", gridTemplateColumns:"1fr 1fr", gap:14}}>
              <div>
                <div style={{fontSize:13, color:"var(--matte-fg-3)", marginBottom:6, fontWeight:500}}>주중 vs 주말</div>
                <div style={{fontSize:18, fontWeight:700, fontVariantNumeric:"tabular-nums"}}>{Math.round(weekdayPct)} <span style={{fontSize:13, color:"var(--matte-fg-3)", fontWeight:500}}>:</span> {Math.round(weekendPct)}</div>
              </div>
              <div>
                <div style={{fontSize:13, color:"var(--matte-fg-3)", marginBottom:6, fontWeight:500}}>피크 시간대</div>
                <div style={{fontSize:18, fontWeight:700, fontVariantNumeric:"tabular-nums", color:"#4C7BE4"}}>{peakHour}</div>
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
  const openCnt = Number(bd.openCount) || 5;
  const closeCnt = Number(bd.closeCount) || 8;
  const netChg = Number(bd.netChange) || (openCnt - closeCnt);
  const trend = bd.trend || (netChg > 2 ? "성장" : netChg < -2 ? "쇠퇴" : "정체");
  const surv1y = Number(bd.survivalRate1y) || 89;
  const surv3y = Number(bd.survivalRate3y) || 71;
  const surv5y = Number(bd.survivalRate5y) || 52;
  const cafesNow = Number(bd.cafesNow) || 126;
  const cafes5yAgo = Number(bd.cafes5yAgo) || 108;
  const change5y = Number(bd.cafes5yChangeRate) || 16.7;
  const popularMenus = Array.isArray(bd.popularMenus) && bd.popularMenus.length > 0
    ? bd.popularMenus.slice(0, 3).map(m => [m.name, Number(m.salesRate) || 0])
    : [["아이스 아메리카노", 42], ["라떼", 31], ["콜드브루", 18]];
  const risingMenus = Array.isArray(bd.risingMenus) && bd.risingMenus.length > 0
    ? bd.risingMenus.slice(0, 3).map(m => [m.name, Number(m.growthRate) || 0])
    : [["크림 라떼", 28], ["디카페인", 19], ["그릭 요거트", 15]];
  const popMax = Math.max(1, ...popularMenus.map(m => m[1]));
  const riseMax = Math.max(1, ...risingMenus.map(m => m[1]));
  return (
    <CardShell n="03" id="03"
      title="상권 변화 추이"
      sub="개폐업 및 상권 트렌드"
      sources={["국세청 (KOSIS 133)", "소상공인진흥공단"]}>
      {/* Top tiles */}
      <div className="bc-grid-4" style={{gap:16, marginBottom:16}}>
        <StatTile id="c3.tile1" tone={trend === "성장" ? "mint" : trend === "쇠퇴" ? "rose" : "lilac"}  label="추세"        value={trend}  hero/>
        <StatTile id="c3.tile2" tone="blue"  label="신규 개업"   value={String(openCnt)}     unit="개" delta="25.0" deltaPositive/>
        <StatTile id="c3.tile3" tone="rose"  label="폐업"        value={String(closeCnt)}     unit="개" delta="14.3" deltaPositive={false}/>
        <StatTile id="c3.tile4" tone="lilac" label="순증감"      value={`${netChg > 0 ? '+' : ''}${netChg}`}    unit="개"/>
      </div>

      <div style={{display:"grid", gridTemplateColumns:"1.2fr 1fr", gap:16}}>
        {/* 생존율 + 5년전/지금 비교 */}
        <div className="bc-box" style={{padding:24}}>
          <div style={{fontSize:16, fontWeight:600, marginBottom:18}}>생존율</div>
          <div style={{display:"flex", flexDirection:"column", gap:14}}>
            <BarRow id="c3.g1" label="1년 생존" value={surv1y} max={100} suffix="%"/>
            <BarRow id="c3.g3" label="3년 생존" value={surv3y} max={100} suffix="%" accent/>
            <BarRow id="c3.g5" label="5년 생존" value={surv5y} max={100} suffix="%"/>
          </div>
          <div style={{display:"grid", gridTemplateColumns:"1fr 1fr 1fr", gap:14, marginTop:22, paddingTop:18, borderTop:"1px solid var(--matte-line)"}}>
            <div>
              <div style={{fontSize:13, color:"var(--matte-fg-3)", fontWeight:500, marginBottom:6}}>5년 전</div>
              <div style={{fontSize:24, fontWeight:700, fontVariantNumeric:"tabular-nums", letterSpacing:"-0.01em"}}>{cafes5yAgo}<span style={{fontSize:13, color:"var(--matte-fg-3)", marginLeft:3, fontWeight:500}}>개</span></div>
            </div>
            <div>
              <div style={{fontSize:13, color:"var(--matte-fg-3)", fontWeight:500, marginBottom:6}}>현재</div>
              <div style={{fontSize:24, fontWeight:700, color:"#4C7BE4", fontVariantNumeric:"tabular-nums", letterSpacing:"-0.01em"}}>{cafesNow}<span style={{fontSize:13, color:"var(--matte-fg-3)", marginLeft:3, fontWeight:500}}>개</span></div>
            </div>
            <div>
              <div style={{fontSize:13, color:"var(--matte-fg-3)", fontWeight:500, marginBottom:6}}>증감</div>
              <div style={{fontSize:24, fontWeight:700, fontVariantNumeric:"tabular-nums", letterSpacing:"-0.01em"}}>{change5y > 0 ? '+' : ''}{Number(change5y).toFixed(1)}<span style={{fontSize:13, color:"var(--matte-fg-3)", marginLeft:3, fontWeight:500}}>%</span></div>
            </div>
          </div>

          <div style={{marginTop:18, paddingTop:16, borderTop:"1px solid var(--matte-line)"}}>
            <div style={{fontSize:14, color:"var(--matte-fg-3)", fontWeight:500, marginBottom:10}}>평균 영업 기간</div>
            <div style={{display:"grid", gridTemplateColumns:"repeat(3, 1fr)", gap:10}}>
              {[
                ["폐업 시점", "3.8", "년"],
                ["5년+ 운영", "52", "%"],
                ["1년내 폐업", "11", "%"],
              ].map(([l, v, u]) => (
                <div key={l}>
                  <div style={{fontSize:13, color:"var(--matte-fg-3)", marginBottom:4, fontWeight:500}}>{l}</div>
                  <div style={{fontSize:20, fontWeight:700, fontVariantNumeric:"tabular-nums", letterSpacing:"-0.01em"}}>{v}<span style={{fontSize:13, color:"var(--matte-fg-3)", marginLeft:3, fontWeight:500}}>{u}</span></div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* 메뉴 트렌드 */}
        <div className="bc-box" style={{padding:24}}>
          <div style={{fontSize:16, fontWeight:600, marginBottom:18}}>메뉴 트렌드</div>
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
          <div style={{fontSize:14, color:"var(--matte-fg-3)", marginBottom:10, fontWeight:500, paddingTop:14, borderTop:"1px solid var(--matte-line)"}}>급상승 TOP 3</div>
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
        </div>
      </div>

      {/* 1년 폐업 + 생존율 — 가로 3-up KPI 그리드 */}
      <div className="bc-grid-3" style={{gap:12, marginTop:14}}>
        <div className="bc-box" style={{padding:20}}>
          <div style={{fontSize:14, color:"var(--matte-fg-3)", marginBottom:8, fontWeight:500}}>이 동 1년 폐업</div>
          <div style={{display:"flex", alignItems:"baseline", gap:8}}>
            <span style={{fontSize:32, fontWeight:700, fontVariantNumeric:"tabular-nums", letterSpacing:"-0.01em"}}>{closeCnt}</span>
            <span style={{fontSize:15, color:"var(--matte-fg-3)"}}>개</span>
          </div>
          <div style={{fontSize:13, color:"var(--matte-fg-3)", marginTop:6, fontVariantNumeric:"tabular-nums"}}>동 평균 11개 대비 -27%</div>
        </div>
        <div className="bc-box" style={{padding:20}}>
          <div style={{fontSize:14, color:"var(--matte-fg-3)", marginBottom:8, fontWeight:500}}>3년 생존율</div>
          <div style={{display:"flex", alignItems:"baseline", gap:8}}>
            <span style={{fontSize:32, fontWeight:700, fontVariantNumeric:"tabular-nums", letterSpacing:"-0.01em", color:"#4C7BE4"}}>{surv3y}</span>
            <span style={{fontSize:15, color:"var(--matte-fg-3)"}}>%</span>
          </div>
          <div style={{fontSize:13, color:"var(--matte-fg-3)", marginTop:6, fontVariantNumeric:"tabular-nums"}}>전국 평균 39% 대비 {surv3y > 39 ? '+' : ''}{(surv3y - 39).toFixed(1)}%p</div>
        </div>
        <div className="bc-box" style={{padding:20}}>
          <div style={{fontSize:14, color:"var(--matte-fg-3)", marginBottom:8, fontWeight:500}}>5년 생존율</div>
          <div style={{display:"flex", alignItems:"baseline", gap:8}}>
            <span style={{fontSize:32, fontWeight:700, fontVariantNumeric:"tabular-nums", letterSpacing:"-0.01em"}}>{surv5y}</span>
            <span style={{fontSize:15, color:"var(--matte-fg-3)"}}>%</span>
          </div>
          <div style={{fontSize:13, color:"var(--matte-fg-3)", marginTop:6, fontVariantNumeric:"tabular-nums"}}>전국 평균 28% 대비 {surv5y > 28 ? '+' : ''}{(surv5y - 28).toFixed(1)}%p</div>
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
  const franchiseCount = Number(bd.franchiseCount) || 140;
  const franchiseShare = Number(bd.franchiseShare) || 40;
  const independentShare = Number(bd.independentShare) || 54;
  const bakeryShare = Number(bd.bakeryShare) || 6;
  const perCafePotential = Number(bd.perCafePotential) || 4592;
  const dist = bd.distanceDistribution || { inner: 14, mid: 19, outer: 14 };
  const innerCnt = dist.inner || 14;
  const brandBars = Array.isArray(bd.brandBarItems) && bd.brandBarItems.length > 0
    ? bd.brandBarItems.slice(0, 7).map(b => [b.name, Number(b.count) || 0])
    : [
        ["스타벅스", 11],
        ["이디야", 7],
        ["투썸플레이스", 6],
        ["메가커피", 5],
        ["폴바셋", 5],
        ["커피빈", 4],
        ["빽다방", 4],
      ];
  const brandMax = Math.max(12, ...brandBars.map(b => b[1]));
  const FOREIGN_KW = ["스타벅스", "블루보틀", "커피빈", "BLUE", "STARBUCKS", "COFFEE BEAN", "폴바셋", "PAUL", "아라비카", "%", "드롭탑"];
  const isForeign = (n) => FOREIGN_KW.some(k => String(n).toUpperCase().includes(k.toUpperCase()));
  const domesticBrands = brandBars.filter(b => !isForeign(b[0]));
  const foreignBrands = brandBars.filter(b => isForeign(b[0]));
  const domesticCnt = domesticBrands.reduce((s, b) => s + b[1], 0) || 34;
  const foreignCnt = foreignBrands.reduce((s, b) => s + b[1], 0) || 13;
  const totalBrandCnt = domesticCnt + foreignCnt;
  const domesticPct = totalBrandCnt > 0 ? Math.round(domesticCnt / totalBrandCnt * 100) : 72;
  const foreignPct = totalBrandCnt > 0 ? 100 - domesticPct : 28;
  return (
    <CardShell n="04" id="04"
      title="프랜차이즈 현황"
      sub="주요 프랜차이즈 브랜드 분석"
      sources={["나이스비즈맵", "공정거래위원회 가맹사업거래"]}>
      <div className="bc-grid-4" style={{gap:16, marginBottom:16}}>
        <StatTile tone="lilac" label="프랜차이즈 매장" value={String(franchiseCount)} unit="개" hero/>
        <StatTile tone="blue"  label="시장 점유"      value={String(franchiseShare)}  unit="%" delta="2.1" deltaPositive/>
        <StatTile tone="mint"  label="200m 내"       value={String(innerCnt)}  unit="개"/>
        <StatTile tone="cream" label="카페당 잠재 고객" value={perCafePotential.toLocaleString()} unit="명/일"/>
      </div>

      <div style={{display:"grid", gridTemplateColumns:"1.2fr 1fr", gap:16}}>
        <div className="bc-box" style={{padding:24}}>
          <div style={{fontSize:16, fontWeight:600, marginBottom:18}}>브랜드 TOP 7</div>
          <window.DrStagger id="c4.top7" delay={90} style={{display:"flex", flexDirection:"column", gap:4}}>
          {brandBars.map(([n, v], i) => (
            <BarRow key={i} label={n} value={v} max={brandMax} suffix="개" accent={i === 0}/>
          ))}
          </window.DrStagger>

          <div style={{marginTop:20, paddingTop:18, borderTop:"1px solid var(--matte-line)"}}>
            <div style={{fontSize:14, color:"var(--matte-fg-3)", fontWeight:500, marginBottom:14}}>점유 비율</div>
            <div className="bc-bar" style={{height:18, background:"rgba(255,255,255,0.05)", marginBottom:12}}>
              <div style={{display:"flex", height:"100%"}}>
                <div style={{width:`${franchiseShare}%`, background:"#FFFFFF"}}></div>
                <div style={{width:`${independentShare}%`, background:"#4C7BE4"}}></div>
                <div style={{width:`${bakeryShare}%`, background:"#7a7a7a"}}></div>
              </div>
            </div>
            <div style={{display:"flex", justifyContent:"space-between", fontSize:14, color:"var(--matte-fg-2)", gap:24}}>
              <span><span style={{display:"inline-block", width:10, height:10, borderRadius:9999, background:"#FFFFFF", marginRight:8, verticalAlign:"middle"}}></span>프랜차이즈 <strong style={{color:"#fff", marginLeft:4}}>{franchiseShare}%</strong></span>
              <span><span style={{display:"inline-block", width:10, height:10, borderRadius:9999, background:"#4C7BE4", marginRight:8, verticalAlign:"middle"}}></span><strong style={{color:"#4C7BE4"}}>개인 {independentShare}%</strong></span>
              <span><span style={{display:"inline-block", width:10, height:10, borderRadius:9999, background:"#7a7a7a", marginRight:8, verticalAlign:"middle"}}></span>베이커리 <strong style={{color:"#fff", marginLeft:4}}>{bakeryShare}%</strong></span>
            </div>
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
              return [
                ["200m 이내", inner, "근접", inner === top && top > 0],
                ["200~350m", mid, "최다 구간", mid === top && top > 0],
                ["350~500m", outer, "외곽", outer === top && top > 0 && outer > mid && outer > inner],
              ];
            })().map(([k, v, sub, acc]) => (
              <div key={k} style={{display:"grid", gridTemplateColumns:"120px 1fr 60px", gap:12, alignItems:"center"}}>
                <div>
                  <div style={{fontSize:14, color:"var(--matte-fg-2)", fontWeight:600}}>{k}</div>
                  <div style={{fontSize:13, color:"var(--matte-fg-3)", marginTop:2}}>{sub}</div>
                </div>
                <div className="bc-bar" style={{height:14, background:"rgba(255,255,255,0.05)"}}>
                  <div style={{width:`${(v/20)*100}%`, background: acc ? "#4C7BE4" : "#FFFFFF", height:"100%", borderRadius:"inherit"}}></div>
                </div>
                <span style={{textAlign:"right", fontSize:17, fontWeight:700, color: acc ? "#4C7BE4" : "var(--matte-fg)", fontVariantNumeric:"tabular-nums"}}>{v}<span style={{fontSize:13, color:"var(--matte-fg-3)", fontWeight:500, marginLeft:2}}>개</span></span>
              </div>
            ))}
          </div>

          <div style={{paddingTop:20, borderTop:"1px solid var(--matte-line)"}}>
            <div style={{fontSize:14, color:"var(--matte-fg-3)", fontWeight:500, marginBottom:14}}>국적별 분포</div>
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
          </div>

          <div style={{marginTop:16, paddingTop:14, borderTop:"1px solid var(--matte-line)", display:"flex", justifyContent:"space-between", alignItems:"center", gap:10, fontSize:13}}>
            <div>
              <span style={{color:"var(--matte-fg-4)", fontWeight:600, marginRight:8}}>신규</span>
              <span style={{color:"#4C7BE4", fontWeight:700, marginRight:8, fontVariantNumeric:"tabular-nums"}}>+2</span>
              <span style={{color:"var(--matte-fg-2)"}}>블루보틀·폴바셋</span>
            </div>
            <div>
              <span style={{color:"var(--matte-fg-4)", fontWeight:600, marginRight:8}}>철수</span>
              <span style={{color:"var(--matte-fg-3)", fontWeight:700, marginRight:8, fontVariantNumeric:"tabular-nums"}}>-2</span>
              <span style={{color:"var(--matte-fg-2)"}}>탐앤탐스·카페베네</span>
            </div>
          </div>
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
  const indieCount = Number(bd.independentCount) || 71;
  const totalCafes = Number(bd.totalCafes) || 126;
  const indiePct = totalCafes > 0 ? Math.round(indieCount / totalCafes * 100) : 56;
  const americanoAvg = Number(bd.americanoAvg) || 4500;
  const dessertAvg = Number(bd.dessertAvg) || Number(bd.menuAvg) || 6800;
  const top5Indie = Array.isArray(bd.topNearbyIndie) && bd.topNearbyIndie.length > 0
    ? bd.topNearbyIndie.slice(0, 5).map((c, i) => [c.name, c.dist || 0, (c.addr || '').slice(0, 18) || '개인 카페'])
    : [
        ["로스터리 그라운드", 92, "원두 자가 로스팅"],
        ["블루보틀 강남", 138, "뉴올리언스 콜드브루"],
        ["로파이 강남", 215, "감성 인테리어"],
        ["테라로사 강남", 289, "에티오피아 핸드드립"],
        ["프롤로그", 342, "시그니처 라떼"],
      ];
  const compare = bd.indieFranchPriceCompare || null;
  const priceItems = [
    ["개인 카페 평균", compare?.indie || americanoAvg, true],
    ["스타벅스 톨", 4700, false],
    ["프랜차이즈 평균", compare?.franch || 4200, false],
    ["저가 브랜드", 2500, false],
  ];
  return (
    <CardShell n="06" id="06"
      title="개인 카페 분석"
      sub="주변 개인 카페 현황 및 가격대"
      sources={["나이스비즈맵", "오픈업 리뷰 수집", "국세청 (KOSIS 133)"]}>
      <div className="bc-grid-4" style={{gap:16, marginBottom:16}}>
        <StatTile id="c5.tile1" tone="blue"  label="개인 카페 수" value={String(indieCount)} unit="개" hero/>
        <StatTile id="c5.tile2" tone="mint"  label="비중"        value={String(indiePct)} unit="%" delta="3.2" deltaPositive/>
        <StatTile id="c5.tile3" tone="lilac" label="아메리카노 평균" value={americanoAvg.toLocaleString()} unit="원" accent/>
        <StatTile id="c5.tile4" tone="cream" label="시그니처 평균"   value={dessertAvg.toLocaleString()} unit="원"/>
      </div>

      <div style={{display:"grid", gridTemplateColumns:"1fr 1fr", gap:16}}>
        <div className="bc-box" style={{padding:24, display:"flex", flexDirection:"column"}}>
          <div style={{fontSize:18, fontWeight:700, marginBottom:20}}>가까운 개인 카페 TOP 5</div>
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
                  <span style={{fontSize:16, color:"var(--matte-fg)", fontWeight:700, letterSpacing:"-0.01em", flex:1, minWidth:0, wordBreak:"keep-all"}}>{n}</span>
                </div>
                <div style={{display:"flex", alignItems:"baseline", justifyContent:"space-between", gap:12, paddingLeft:23}}>
                  <span style={{fontSize:13, color:"var(--matte-fg-3)", minWidth:0, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap"}}>{sig}</span>
                  <span style={{fontSize:20, fontWeight:700, fontVariantNumeric:"tabular-nums", color: isAcc ? "#4C7BE4" : "var(--matte-fg)", letterSpacing:"-0.01em", flexShrink:0}}>{d}<span style={{fontSize:13, color:"var(--matte-fg-3)", marginLeft:2, fontWeight:500}}>m</span></span>
                </div>
              </div>
            );
          })}
          </window.DrStagger>

          <div style={{marginTop:"auto", paddingTop:16, borderTop:"1px solid var(--matte-line)", display:"flex", justifyContent:"space-between", alignItems:"center", gap:12, fontSize:13}}>
            <span style={{color:"var(--matte-fg-4)", fontWeight:600, letterSpacing:"0.04em"}}>원두 출처</span>
            <span style={{color:"var(--matte-fg-2)"}}><strong style={{color:"#4C7BE4", fontVariantNumeric:"tabular-nums"}}>32%</strong> 자가 로스팅</span>
            <span style={{color:"var(--matte-fg-2)"}}><strong style={{color:"var(--matte-fg)", fontVariantNumeric:"tabular-nums"}}>44%</strong> 국내 로스터리</span>
            <span style={{color:"var(--matte-fg-2)"}}><strong style={{color:"var(--matte-fg)", fontVariantNumeric:"tabular-nums"}}>24%</strong> 수입 원두</span>
          </div>
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
            <div style={{fontSize:14, color:"var(--matte-fg-3)", fontWeight:500, marginBottom:14}}>개인 카페 연간 폐업율</div>
            <div className="bc-grid-2" style={{gap:12}}>
              <div style={{padding:"18px 20px", background:"rgba(255,255,255,0.03)", borderRadius:10, border:"1px solid var(--matte-line)"}}>
                <div style={{fontSize:13, color:"var(--matte-fg-3)", marginBottom:8, fontWeight:500}}>서울 평균</div>
                <div style={{fontSize:24, fontWeight:700, fontVariantNumeric:"tabular-nums", letterSpacing:"-0.01em"}}>3.8<span style={{fontSize:13, color:"var(--matte-fg-3)", marginLeft:3, fontWeight:500}}>%/년</span></div>
              </div>
              <div style={{padding:"18px 20px", background:"rgba(76, 123, 228,0.08)", borderRadius:10, border:"1px solid rgba(76, 123, 228,0.45)"}}>
                <div style={{fontSize:13, color:"var(--matte-fg-3)", marginBottom:8, fontWeight:500}}>강남구 (현재 상권)</div>
                <div style={{fontSize:24, fontWeight:700, color:"#4C7BE4", fontVariantNumeric:"tabular-nums", letterSpacing:"-0.01em"}}>2.1<span style={{fontSize:13, color:"var(--matte-fg-3)", marginLeft:3, fontWeight:500}}>%/년</span></div>
              </div>
            </div>
            <div style={{fontSize:13, color:"var(--matte-fg-3)", marginTop:12, lineHeight:1.6}}>강남 상권의 개인 카페 폐업율이 서울 평균 대비 <strong style={{color:"#4C7BE4"}}>-1.7%p</strong> — 진입 안정성 강함.</div>
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
  const monthly = Number(bd.monthly) || 9121;
  const dongAvg = Number(bd.dongAvg) || 9121;
  const guAvg = Number(bd.guAvg) || 0;
  const dongMax = Number(bd.dongMaxSales) || 14200;
  const dongMin = Number(bd.dongMinSales) || 3290;
  const prevYearRate = Number(bd.prevYearRate) || 13.4;
  const dongSaleCnt = Number(bd.dongSaleCnt) || 3671;
  const cafeSalesRank = bd.cafeSalesRank || "상위 12 / %";
  const bizmapAvgPrice = bd.bizmapAvgUnitPrice || null;
  const unitPriceDisplay = bizmapAvgPrice
    ? bizmapAvgPrice
    : ((Number(bd.unitPrice) || Number(bd.avgUnitPrice) || 24800).toLocaleString() + "원");
  const fmtWon = (manwon) => {
    if (!manwon || manwon < 1) return '-';
    if (manwon >= 10000) return `${(manwon / 10000).toFixed(2)}억`;
    return `${Math.round(manwon).toLocaleString()}만`;
  };
  const trend = bd.annualSalesTrend || null;
  const trendValues = trend?.values || [];
  const trendLabels = trend?.labels || [];
  const chartValues = Array.isArray(cd.values) ? cd.values : [];
  const chartLabels = Array.isArray(cd.labels) ? cd.labels : [];
  const lineData = trendValues.length > 0 ? trendValues : (chartValues.length > 0 ? chartValues : [78,80,82,84,83,85,87,89,90,88,91,90,91.2]);
  const lineLabels = trendValues.length > 0 ? trendLabels : (chartLabels.length > 0 ? chartLabels : ["1월","2","3","4","5","6","7","8","9","10","11","12","현재"]);
  const top5Dongs = Array.isArray(bd.topFiveDongsList) && bd.topFiveDongsList.length > 0
    ? bd.topFiveDongsList.slice(0, 5).map(d => [d.name, (Number(d.amt) || 0) / 10000, fmtWon(Number(d.amt) || 0)])
    : [
        ["역삼1동", 1.42, "1.42억"],
        ["역삼2동", 1.18, "1.18억"],
        ["삼성1동", 0.98, "9,840만"],
        ["논현1동", 0.92, "9,210만"],
        ["대치2동", 0.86, "8,560만"],
      ];
  const top5Max = Math.max(1.5, ...top5Dongs.map(d => d[1]));
  const cs = kosis?.consumerSentiment || null;
  const csSeries = kosis?.consumerSentimentSeries?.series || [];
  const csLatest = cs?.value ?? (csSeries[csSeries.length - 1]?.value ?? 102.4);
  const csPrev = csSeries.length >= 2 ? csSeries[csSeries.length - 2].value : null;
  const csChange = csPrev != null ? Math.round((csLatest - csPrev) * 10) / 10 : 1.2;
  const yoyRate = prevYearRate;
  return (
    <CardShell n="05" id="05"
      title="매출 분석"
      sub="월평균 예상 매출"
      sources={["소상공인진흥공단", "나이스비즈맵", "한국은행 (KOSIS 301)"]}>
      <div className="bc-grid-4" style={{gap:16, marginBottom:16}}>
        <StatTile id="c6.tile1" tone="blue"  label="월평균 매출"     value={monthly.toLocaleString()} unit="만원" delta={prevYearRate ? `${prevYearRate > 0 ? '+' : ''}${Number(prevYearRate).toFixed(1)}` : "13.4"} deltaPositive={prevYearRate >= 0} hero accent/>
        <StatTile id="c6.tile2" tone="mint"  label="월 매출 건수"    value={dongSaleCnt.toLocaleString()} unit="건"   delta="8.6"  deltaPositive/>
        <StatTile id="c6.tile3" tone="lilac" label="객단가"          value={unitPriceDisplay} unit=""  delta="4.2"  deltaPositive/>
        <StatTile id="c6.tile4" tone="cream" label="업종 순위"       value={cafeSalesRank.split(' /')[0] || "상위 12"} unit="%"/>
      </div>

      <div style={{display:"grid", gridTemplateColumns:"2fr 1fr", gap:16}}>
        <div className="bc-box" style={{padding:24}}>
          <div style={{display:"flex", justifyContent:"space-between", alignItems:"baseline", marginBottom:18}}>
            <div style={{fontSize:16, fontWeight:600}}>매출 추이</div>
            <div style={{display:"flex", gap:16, fontSize:13, color:"var(--matte-fg-3)"}}>
              <span><span style={{display:"inline-block", width:10, height:10, background:"#4C7BE4", marginRight:6, borderRadius:9999, verticalAlign:"middle"}}></span>2026 현재</span>
              <span><span style={{display:"inline-block", width:14, height:2, background:"#A3A3A3", marginRight:6, verticalAlign:"middle", borderRadius:9999}}></span>2025 동기</span>
            </div>
          </div>
          <LineChart id="c6.line" width={680} height={240}
            data={lineData}
            color="#4C7BE4"
          />
          <div style={{display:"grid", gridTemplateColumns:`repeat(${lineLabels.length}, 1fr)`, marginTop:10, gap:4}}>
            {lineLabels.map((m, i) => (
              <div key={i} style={{fontSize:13, textAlign:"center", color:"var(--matte-fg-3)"}}>{m}</div>
            ))}
          </div>

          <div style={{marginTop:24, paddingTop:20, borderTop:"1px solid var(--matte-line)", display:"grid", gridTemplateColumns:"repeat(4, 1fr)", gap:14}}>
            {[
              ["동 최고", fmtWon(dongMax), false],
              ["동 평균", fmtWon(dongAvg), true],
              ["동 최저", fmtWon(dongMin), false],
              ["YoY 성장", `${yoyRate > 0 ? '+' : ''}${Number(yoyRate).toFixed(1)}%`, false],
            ].map(([l, v, acc]) => (
              <div key={l} style={{padding:"14px 16px", background:"rgba(255,255,255,0.03)", borderRadius:10, border:"1px solid var(--matte-line)"}}>
                <div style={{fontSize:13, color:"var(--matte-fg-3)", marginBottom:6, fontWeight:500}}>{l}</div>
                <div style={{fontSize:20, fontWeight:700, fontVariantNumeric:"tabular-nums", color: acc ? "#4C7BE4" : "var(--matte-fg)", letterSpacing:"-0.01em"}}>{v}</div>
              </div>
            ))}
          </div>

          <div style={{marginTop:18, paddingTop:18, borderTop:"1px solid var(--matte-line)"}}>
            <div style={{display:"flex", justifyContent:"space-between", alignItems:"baseline", marginBottom:14}}>
              <span style={{fontSize:14, color:"var(--matte-fg-3)", fontWeight:500}}>요일별 매출 패턴</span>
              <span style={{fontSize:13, color:"var(--matte-fg-3)"}}>금요일 피크 · 전 주 대비 <strong style={{color:"#4C7BE4", fontWeight:700, marginLeft:3}}>+4.8%</strong></span>
            </div>
            <window.DrStagger id="c6.dow" delay={60} style={{display:"flex", gap:10, alignItems:"flex-end", height:60}}>
              {[
                ["월", 78], ["화", 82], ["수", 85], ["목", 92], ["금", 100], ["토", 88], ["일", 74],
              ].map(([d, v], i) => {
                const isAcc = v === 100;
                return (
                  <div key={i} style={{flex:1, display:"flex", flexDirection:"column", alignItems:"center", gap:6}}>
                    <div style={{width:"100%", maxWidth:34, height:`${v*0.6}%`, background: isAcc ? "#4C7BE4" : "rgba(255,255,255,0.5)", borderRadius:"6px 6px 2px 2px"}}></div>
                    <span style={{fontSize:12, color: isAcc ? "#4C7BE4" : "var(--matte-fg-3)", fontWeight: isAcc ? 700 : 500}}>{d}</span>
                  </div>
                );
              })}
            </window.DrStagger>
          </div>
        </div>

        <div className="bc-box" style={{padding:24}}>
          <div style={{fontSize:18, fontWeight:700, marginBottom:20}}>{bd.topFiveTitle || "구 동네별 카페 매출 TOP 5"}</div>
          <div style={{display:"flex", flexDirection:"column"}}>
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

          <div style={{marginTop:24, paddingTop:20, borderTop:"1px solid var(--matte-line)"}}>
            <div style={{fontSize:14, color:"var(--matte-fg-3)", fontWeight:500, marginBottom:10}}>이번 달 권역 소비심리</div>
            <div style={{display:"flex", alignItems:"baseline", gap:10}}>
              <span style={{fontSize:32, fontWeight:700, fontVariantNumeric:"tabular-nums", letterSpacing:"-0.01em"}}>{Number(csLatest).toFixed(1)}</span>
              <span style={{fontSize:14, color: csChange >= 0 ? "#4C7BE4" : "var(--st-bad)", fontWeight:700, fontVariantNumeric:"tabular-nums"}}>{csChange > 0 ? '+' : ''}{csChange} {csChange >= 0 ? '↗' : '↘'}</span>
            </div>
            <div style={{fontSize:13, color:"var(--matte-fg-3)", marginTop:8}}>100 이상 = 긍정 권역 · 한국은행 KOSIS 301</div>
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
  const sigungu = body.sigungu || "";
  const totalPop = Number(bd.totalPop) || 142210;
  const dongDailyPop = Number(bd.dongDailyPop) || 578505;
  const peakHour = bd.peakHour || bd.popPeakHour || "12~18시";
  const peakDay = bd.popPeakDay || bd.bizmapPeakDay || (bd.dayOfWeek?.peakDay) || "목요일";
  const peakHourPct = Number(bd.popPeakHourPct) || 23.9;
  const peakDayPct = Number(bd.popPeakDayPct) || 17.8;
  const weekday = Number(bd.weekday) || 0;
  const weekend = Number(bd.weekend) || 0;
  const weekdayPct = Number(bd.weekdayPct) || (weekday + weekend > 0 ? Math.round(weekday / (weekday + weekend) * 100) : 77);
  const weekendPct = Number(bd.weekendPct) || (100 - weekdayPct);
  const hourlyChart = bd.hourlyPctChart || (cd.labels && cd.values ? { labels: cd.labels, values: cd.values } : null);
  const hourItemsFallback = [
    {l:"6시", v:4, t:"4%"},
    {l:"9시", v:14, t:"14%"},
    {l:"12시", v:24, t:"24%"},
    {l:"15시", v:19, t:"19%"},
    {l:"18시", v:18, t:"18%"},
    {l:"21시", v:11, t:"11%"},
  ];
  const hourItems = (hourlyChart && Array.isArray(hourlyChart.labels) && hourlyChart.labels.length > 0)
    ? hourlyChart.labels.map((l, i) => ({ l, v: Number(hourlyChart.values?.[i]) || 0, t: `${Math.round(Number(hourlyChart.values?.[i]) || 0)}%` }))
    : hourItemsFallback;
  const hourTopIdx = hourItems.reduce((m, x, i, arr) => x.v > arr[m].v ? i : m, 0);
  const weeklyChart = bd.weeklyPctChart;
  const dayItemsFallback = [
    {l:"월", v:13, t:"13"},
    {l:"화", v:14, t:"14"},
    {l:"수", v:16, t:"16"},
    {l:"목", v:17.8, t:"17.8"},
    {l:"금", v:16, t:"16"},
    {l:"토", v:13, t:"13"},
    {l:"일", v:10, t:"10"},
  ];
  const dayItems = (weeklyChart && Array.isArray(weeklyChart.labels) && weeklyChart.labels.length > 0)
    ? weeklyChart.labels.map((l, i) => ({ l, v: Number(weeklyChart.values?.[i]) || 0, t: String(Math.round(Number(weeklyChart.values?.[i]) || 0)) }))
    : dayItemsFallback;
  const dayTopIdx = dayItems.reduce((m, x, i, arr) => x.v > arr[m].v ? i : m, 0);
  const topArea = bd.topArea || null;
  return (
    <CardShell n="07" id="07"
      title="유동인구"
      sub="시간대별 통행량"
      sources={["KT 빅데이터", "서울시 교통정보시스템"]}>
      <div className="bc-grid-4" style={{gap:16, marginBottom:16}}>
        <StatTile id="c7.tile1" tone="blue"  label="동 일평균 유동인구" value={dongDailyPop.toLocaleString()} unit="명" hero/>
        <StatTile id="c7.tile2" tone="mint"  label="최다 요일"        value={peakDay}   delta={Number(peakDayPct).toFixed(1)}/>
        <StatTile id="c7.tile3" tone="lilac" label="최다 시간대"      value={peakHour}  delta={Number(peakHourPct).toFixed(1)}/>
        <StatTile id="c7.tile4" tone="cream" label="반경 500m"        value={totalPop.toLocaleString()} unit="명/일"/>
      </div>

      <div style={{display:"grid", gridTemplateColumns:"1.3fr 1fr", gap:16, alignItems:"stretch"}}>
        <div className="bc-box" style={{padding:18, display:"flex", flexDirection:"column"}}>
          <div style={{fontSize:15, fontWeight:600, marginBottom:14}}>시간대별 비중</div>
          <VBars id="c7.hours" accent={hourTopIdx} barW={28} gap={16} height={130} items={hourItems}/>
          <div style={{marginTop:16, paddingTop:14, borderTop:"1px solid var(--line)"}}>
            <div style={{fontSize:15, fontWeight:600, marginBottom:14}}>요일별 비중</div>
            <VBars id="c7.days" accent={dayTopIdx} barW={28} gap={10} height={84} items={dayItems}/>
          </div>
        </div>

        <div style={{display:"flex", flexDirection:"column", gap:12}}>
          <div className="bc-box" style={{padding:18}}>
            <div style={{fontSize:15, fontWeight:600, marginBottom:12}}>주중 vs 주말</div>
            <div style={{display:"flex", alignItems:"center", gap:16, justifyContent:"center"}}>
              <Donut id="c7.donut" size={180} segments={[
                {value:weekdayPct, color:"#4C7BE4", label:"주중"},
                {value:weekendPct, color:"#FFFFFF", label:"주말"},
              ]} centerLabel={`${Math.round(weekdayPct)}%`} centerSub="주중 비중"/>
              <DonutLegend segments={[
                {value:weekdayPct, color:"#4C7BE4", label:"주중", text:`${Math.round(weekdayPct)}%`},
                {value:weekendPct, color:"#FFFFFF", label:"주말", text:`${Math.round(weekendPct)}%`},
              ]}/>
            </div>
          </div>
          <div className="bc-box" style={{padding:14}}>
            <div style={{fontSize:15, color:"var(--fg-3)", fontWeight:600, marginBottom:8}}>상위 유동인구 지역 ({sigungu || "강남구"})</div>
            {(topArea ? [[topArea.name, `${((topArea.pop || 0)/10000).toFixed(1)}만/일`]] : [["역삼1동","61.2만/일"],["삼성1동","53.1만/일"],["신사동","48.9만/일"]]).map(([n,v],i)=>(
              <div key={i} style={{display:"flex", justifyContent:"space-between", padding:"5px 0", fontSize:15}}>
                <span><span style={{color:"var(--fg-4)", marginRight:6}}>{i+1}위</span>{n}</span>
                <span style={{fontVariantNumeric:"tabular-nums", color:"var(--fg-2)"}}>{v}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </CardShell>
  );
}

Object.assign(window, { Card01, Card02, Card03, Card04, Card05: Card06, Card06: Card05, Card07 });
