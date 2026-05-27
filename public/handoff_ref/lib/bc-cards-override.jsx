/* bc-cards-override.jsx
   영업관리 앱이 iframe으로 시안을 로드할 때, 우리 14개 카드 컴포넌트를
   window.Card01~Card14로 덮어쓴다.
   - 시안 lib/cards-a/b/c.jsx의 mock 전용 카드를 무력화
   - 시안 App.jsx renderCard가 그대로 window.Card{n}을 호출하므로 자연스럽게 우리 카드 사용
   - body = window.__BC_DATA__.cards[i].body (UnifiedLayout이 주입)
   카드 본체 코드는 src/components/handoff/cards/Card{N}.jsx와 동일.
   import 만 제거 (window.* 글로벌 사용). */

const { useState, useEffect, useMemo } = React;
const { CardShell, StatTile, Box, CountUp } = window;
const { Donut, DonutLegend, Sparkline, VBars, BarRow, LineChart, ScoreGauge, Radar } = window;
const { DrStagger } = window;
const MapTriggerButton = window.MapTriggerButton;

/* body 헬퍼 — iframe에 주입된 __BC_DATA__.cards[n].body 읽기 */
function bcBodyOf(n) {
  try {
    const idx = parseInt(n, 10) - 1;
    return (window.__BC_DATA__ && window.__BC_DATA__.cards && window.__BC_DATA__.cards[idx] && window.__BC_DATA__.cards[idx].body) || {};
  } catch (e) {
    return {};
  }
}

/* ============================================================
   Card01 — 상권 분석 리포트
   ============================================================ */
function BCCard01({ body: bodyProp }) {
  const body = bodyProp && Object.keys(bodyProp).length > 0 ? bodyProp : bcBodyOf('01');
  const kbd = body.kosisBoxData || {};
  const cafeCount = Number(body.cafeCount) || 0;
  const franchise = Number(body.franchise) || 0;
  const individual = Number(body.individual) || 0;
  const bakery = Number(body.bakery) || 0;
  const newOpen = Number(body.newOpen) || 0;
  const closed = Number(body.closed) || 0;
  const rentRaw = Number(body.rentPerPyeong) || (kbd.integratedRent?.value ? Math.round(kbd.integratedRent.value / 10000) : 0) || (kbd.marketRent?.value ? Math.round(kbd.marketRent.value / 10000) : 0);
  const rentPerPyeong = rentRaw;
  const vacancyRate = Number(body.vacancyRate) || Number(kbd.vacancy?.value) || 0;
  const priceChange = Number(body.priceChange) || Number(kbd.priceChange?.value) || 0;
  const rentSeries = Array.isArray(body.rentSeries) ? body.rentSeries : (kbd.marketRentSeries?.series || null);
  const vacancySeries = Array.isArray(body.vacancySeries) ? body.vacancySeries : (kbd.vacancySeries?.series || null);
  const priceSeries = Array.isArray(body.priceSeries) ? body.priceSeries : (kbd.priceIndexSeries?.series || null);
  const onMapClick = body.onMapClick;

  const donutSegments = (() => {
    const segs = [];
    const total = individual + franchise + bakery;
    if (total === 0) return [];
    if (individual > 0) segs.push({ value: Math.round(individual / total * 100), color: '#4C7BE4', label: '개인 카페' });
    if (franchise > 0) segs.push({ value: Math.round(franchise / total * 100), color: '#FFFFFF', label: '프랜차이즈' });
    if (bakery > 0) segs.push({ value: Math.round(bakery / total * 100), color: '#7a7a7a', label: '베이커리' });
    return segs;
  })();
  const indiePct = donutSegments.find(s => s.label === '개인 카페')?.value ?? 0;
  const fcPct = donutSegments.find(s => s.label === '프랜차이즈')?.value ?? 0;
  const bkPct = donutSegments.find(s => s.label === '베이커리')?.value ?? 0;

  const rentDelta = priceChange ? `${priceChange > 0 ? '+' : ''}${priceChange.toFixed(1)}` : '0';
  const vacancyDelta = (() => {
    if (!vacancySeries || vacancySeries.length < 2) return '0';
    const last = vacancySeries[vacancySeries.length - 1]?.value ?? vacancyRate;
    const prev = vacancySeries[0]?.value ?? vacancyRate;
    const d = last - prev;
    return `${d > 0 ? '+' : ''}${d.toFixed(1)}`;
  })();
  const newOpenDelta = closed > 0 && newOpen > 0
    ? `${newOpen > closed ? '+' : ''}${Math.round(((newOpen - closed) / closed) * 100)}`
    : (newOpen > 0 ? '+신규' : '0');

  const rentSpark = rentSeries
    ? rentSeries.map(s => Math.round((s.value || 0) / 10000)).filter(v => v > 0)
    : (rentPerPyeong > 0 ? [rentPerPyeong] : []);
  const vacancySpark = vacancySeries
    ? vacancySeries.map(s => s.value || 0).filter(v => v > 0)
    : (vacancyRate > 0 ? [vacancyRate] : []);
  const priceSpark = priceSeries
    ? priceSeries.map(s => s.value || 0).filter(v => v > 0)
    : [];

  return (
    <CardShell n="01" id="01"
      title="상권 분석 리포트"
      sub="반경 500m 매장 구성과 임대 시세"
      sources={["오픈업/카카오/네이버", "한국부동산원 (KOSIS 408)"]}
      headerRight={MapTriggerButton ? <MapTriggerButton onClick={onMapClick}/> : null}>
      <div className="bc-grid-4" style={{gap:16, marginBottom:16}}>
        <StatTile id="c1.tile1" tone="blue"  label="총 카페 수"   value={String(cafeCount)} unit="개" hero/>
        <StatTile id="c1.tile2" tone="lilac" label="프랜차이즈"   value={String(franchise)} unit="개"/>
        <StatTile id="c1.tile3" tone="mint"  label="평당 월세"    value={rentPerPyeong > 0 ? String(rentPerPyeong) : '-'} unit={rentPerPyeong > 0 ? '만원' : ''} delta={rentPerPyeong > 0 ? rentDelta : undefined} deltaPositive={priceChange >= 0}/>
        <StatTile id="c1.tile4" tone="rose"  label="공실률"       value={vacancyRate > 0 ? vacancyRate.toFixed(1) : '-'} unit={vacancyRate > 0 ? '%' : ''} delta={vacancyRate > 0 ? vacancyDelta : undefined} deltaPositive={false}/>
      </div>

      <div style={{display:"grid", gridTemplateColumns:"1fr 1fr", gap:16}}>
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

        <div className="bc-box" style={{padding:18}}>
          <div style={{fontSize:15, fontWeight:600, marginBottom:12}}>카페 비율</div>
          {donutSegments.length > 0 ? (
            <div style={{display:"flex", alignItems:"center", gap:18, justifyContent:"center"}}>
              <Donut id="c1.donut" size={200} segments={donutSegments} centerLabel={String(cafeCount)} centerSub="카페 매장"/>
              <DonutLegend segments={[
                ...(indiePct > 0 ? [{value:indiePct, color:"#4C7BE4", label:"개인", text:`${indiePct}%`}] : []),
                ...(fcPct > 0 ? [{value:fcPct, color:"#FFFFFF", label:"프랜차이즈", text:`${fcPct}%`}] : []),
                ...(bkPct > 0 ? [{value:bkPct, color:"#7a7a7a", label:"베이커리", text:`${bkPct}%`}] : []),
              ]}/>
            </div>
          ) : (
            <div style={{fontSize:14, color:"var(--matte-fg-3)", textAlign:"center", padding:"40px 0"}}>카페 데이터 수집 중</div>
          )}
        </div>
      </div>

      <div className="bc-grid-3" style={{gap:12, marginTop:16}}>
        {[
          { l:"평당 월세", v: rentPerPyeong > 0 ? `${rentPerPyeong}만원` : '-', d: rentDelta + '%', color:"#FFFFFF", data: rentSpark },
          { l:"공실률",   v: vacancyRate > 0 ? `${vacancyRate.toFixed(1)}%` : '-', d: vacancyDelta + '%p', color:"#FFFFFF", data: vacancySpark },
          { l:"신규 개업", v: `${newOpen}개`, d: newOpenDelta + '%', color:"#4C7BE4", data: priceSpark.length > 0 ? priceSpark : [Math.max(0, newOpen - closed), newOpen] },
        ].map((t, i) => (
          <div key={i} className="bc-box" style={{padding:18}}>
            <div style={{display:"flex", justifyContent:"space-between", alignItems:"baseline", marginBottom:10}}>
              <span style={{fontSize:14, color:"var(--matte-fg-3)", fontWeight:500}}>{t.l}</span>
              <span style={{fontSize:14, color: t.color === "#4C7BE4" ? "#4C7BE4" : "var(--matte-fg-2)", fontWeight:600, fontVariantNumeric:"tabular-nums"}}>{t.d}</span>
            </div>
            <div style={{fontSize:24, fontWeight:700, marginBottom:14, fontVariantNumeric:"tabular-nums", letterSpacing:"-0.01em"}}>{t.v}</div>
            {t.data.length > 1 ? (
              <Sparkline data={t.data} height={56} color={t.color}/>
            ) : (
              <div style={{height:56, display:"flex", alignItems:"center", color:"var(--matte-fg-4)", fontSize:13}}>
                {t.data.length === 1 ? '추이 데이터 부족' : '전기 대비 변동 없음'}
              </div>
            )}
          </div>
        ))}
      </div>
    </CardShell>
  );
}

/* ============================================================
   Card02 — 고객 분석
   ============================================================ */
function BCCard02({ body: bodyProp }) {
  const body = bodyProp && Object.keys(bodyProp).length > 0 ? bodyProp : bcBodyOf('02');
  const bodyData = body.bodyData || {};
  const chartData = body.chartData || {};
  const topAge = body.topAge || bodyData.topAge || '-';
  const maleRatio = Number(body.maleRatio ?? chartData.male) || 0;
  const femaleRatio = Number(body.femaleRatio ?? chartData.female) || 0;
  const newCustomerPct = Number(bodyData.newCustomer) || 0;
  const regularPct = Number(bodyData.regular) || 0;
  const weekdayPct = Math.round(Number(body.weekdayPct) || 0);
  const weekendPct = (weekdayPct > 0 || Number(body.weekendPct) > 0) ? (100 - weekdayPct) : 0;
  const peakHour = body.peakHour || '-';

  const ageGroups = Array.isArray(chartData.ageGroups) && chartData.ageGroups.length > 0 ? chartData.ageGroups : [];

  const parseLifeStr = (s) => {
    if (!s || typeof s !== 'string') return [];
    return s.split(',').map(t => {
      const m = t.trim().match(/^(.+?)\s*\(([\d.]+)%\)$/);
      return m ? m[1].trim() : t.trim();
    }).filter(Boolean).slice(0, 5);
  };
  const maleKw = parseLifeStr(bodyData.maleLifestyle);
  const femaleKw = parseLifeStr(bodyData.femaleLifestyle);

  const earn = bodyData.customerYrEarn || null;
  const maleIncome = Number(earn?.male) || 0;
  const femaleIncome = Number(earn?.female) || 0;
  const maleMonthly = maleIncome > 0 ? Math.round(maleIncome / 12) : 0;
  const femaleMonthly = femaleIncome > 0 ? Math.round(femaleIncome / 12) : 0;
  const incomeMax = Math.max(maleMonthly, femaleMonthly, 100);

  return (
    <CardShell n="02" id="02"
      title="고객 분석"
      sub="방문 고객 특성"
      sources={["나이스비즈맵", "오픈업", "소상공인진흥공단"]}>
      <div className="bc-grid-4" style={{gap:16, marginBottom:16}}>
        <StatTile id="c2.tile1" tone="blue"  label="주요 연령대"   value={topAge} hero accent/>
        <StatTile id="c2.tile2" tone="lilac" label="성비 (남:여)" value={maleRatio > 0 ? `${maleRatio} : ${femaleRatio}` : '-'}/>
        <StatTile id="c2.tile3" tone="mint"  label="단골" value={regularPct > 0 ? regularPct.toFixed(1) : '-'} unit={regularPct > 0 ? '%' : ''}/>
        <StatTile id="c2.tile4" tone="cream" label="신규" value={newCustomerPct > 0 ? newCustomerPct.toFixed(1) : '-'} unit={newCustomerPct > 0 ? '%' : ''}/>
      </div>

      <div style={{display:"grid", gridTemplateColumns:"1.2fr 1fr", gap:16}}>
        <div className="bc-box" style={{padding:24}}>
          <div style={{fontSize:16, fontWeight:600, marginBottom:18}}>연령대 분포</div>
          {ageGroups.length > 0 ? (
            <VBars id="c2.bars" accent={ageGroups.findIndex(g => g.name === topAge)} barW={48} gap={28} height={200} items={ageGroups.map(g => ({
              l: g.name, v: g.pct, t: `${g.pct}%`
            }))}/>
          ) : (
            <div style={{fontSize:14, color:"var(--matte-fg-3)", textAlign:"center", padding:"40px 0"}}>연령대 데이터 수집 중</div>
          )}
          <div style={{marginTop:24, paddingTop:20, borderTop:"1px solid var(--matte-line)"}}>
            <div style={{fontSize:14, color:"var(--matte-fg-3)", fontWeight:500, marginBottom:14}}>방문 손님 평균 소득 (월 환산)</div>
            {(maleMonthly > 0 || femaleMonthly > 0) ? (
              <div style={{display:"flex", flexDirection:"column", gap:14}}>
                {[
                  ["남성", maleMonthly],
                  ["여성", femaleMonthly],
                ].filter(([, v]) => v > 0).map(([who, v]) => (
                  <div key={who} style={{display:"grid", gridTemplateColumns:"60px 1fr 90px", gap:14, alignItems:"center"}}>
                    <span style={{fontSize:15, color:"var(--matte-fg-2)", fontWeight:500}}>{who}</span>
                    <div className="bc-bar" style={{height:14, background:"rgba(255,255,255,0.05)"}}>
                      <div style={{width:`${(v/incomeMax)*100}%`, background:"#FFFFFF", height:"100%", borderRadius:"inherit"}}></div>
                    </div>
                    <span style={{textAlign:"right", fontSize:17, fontWeight:700, fontVariantNumeric:"tabular-nums"}}>{v.toLocaleString()}<span style={{fontSize:13, color:"var(--matte-fg-3)", fontWeight:500, marginLeft:3}}>만원</span></span>
                  </div>
                ))}
              </div>
            ) : (
              <div style={{fontSize:13, color:"var(--matte-fg-4)"}}>{bodyData.earnAmt || '소득 데이터 없음'}</div>
            )}
          </div>
        </div>

        <div className="bc-box" style={{padding:24}}>
          <div style={{fontSize:16, fontWeight:600, marginBottom:20}}>라이프스타일 키워드</div>
          <div style={{display:"flex", flexDirection:"column", gap:16}}>
            {[
              ["여성", femaleRatio > 0 ? `${femaleRatio}%` : '', femaleKw],
              ["남성", maleRatio > 0 ? `${maleRatio}%` : '', maleKw],
            ].filter(([, , kws]) => kws.length > 0).map(([who, ratio, keywords]) => (
              <div key={who} style={{padding:"20px 22px", background:"rgba(255,255,255,0.03)", borderRadius:12, border:"1px solid var(--matte-line)"}}>
                <div style={{display:"flex", justifyContent:"space-between", alignItems:"baseline", marginBottom:14}}>
                  <span style={{fontSize:16, fontWeight:700, color:"#fff"}}>{who}</span>
                  {ratio && <span style={{fontSize:14, color:"var(--matte-fg-3)", fontWeight:600, fontVariantNumeric:"tabular-nums"}}>{ratio}</span>}
                </div>
                <DrStagger id={`c2.chips.${who}`} delay={50} style={{display:"flex", gap:8, flexWrap:"wrap"}}>
                  {keywords.map(k => (
                    <span key={k} style={{padding:"7px 14px", background:"rgba(255,255,255,0.06)", border:"1px solid var(--matte-line)", borderRadius:8, fontSize:14, color:"var(--matte-fg-2)", fontWeight:500}}>#{k}</span>
                  ))}
                </DrStagger>
              </div>
            ))}
            {(maleKw.length === 0 && femaleKw.length === 0) && (
              <div style={{fontSize:13, color:"var(--matte-fg-4)", padding:"20px"}}>라이프스타일 데이터 수집 중</div>
            )}
            <div style={{paddingTop:16, borderTop:"1px solid var(--matte-line)", display:"flex", flexDirection:"column", gap:18}}>
              <div>
                <div style={{fontSize:15, color:"var(--matte-fg-3)", marginBottom:10, fontWeight:500}}>주중 vs 주말</div>
                <div style={{fontSize:36, fontWeight:700, fontVariantNumeric:"tabular-nums", lineHeight:1.1}}>
                  {weekdayPct > 0 || weekendPct > 0
                    ? <>{weekdayPct} <span style={{fontSize:22, color:"var(--matte-fg-3)", fontWeight:500}}>:</span> {weekendPct}</>
                    : '-'}
                </div>
              </div>
              <div>
                <div style={{fontSize:15, color:"var(--matte-fg-3)", marginBottom:10, fontWeight:500}}>피크 시간대</div>
                <div style={{fontSize:36, fontWeight:700, fontVariantNumeric:"tabular-nums", color:"#4C7BE4", lineHeight:1.1}}>{peakHour !== '-' ? peakHour : '-'}</div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </CardShell>
  );
}

/* ============================================================
   Card03 — 상권 변화 추이
   ============================================================ */
function BCCard03({ body: bodyProp }) {
  const body = bodyProp && Object.keys(bodyProp).length > 0 ? bodyProp : bcBodyOf('03');
  const bodyData = body.bodyData || {};
  const sigungu = body.sigungu || '';
  const kosis = body.kosisBoxData || {};

  const openCnt = Number(bodyData.openCount) || 0;
  const closeCnt = Number(bodyData.closeCount) || 0;
  const netChg = Number(bodyData.netChange) || (openCnt - closeCnt);
  const trend = bodyData.trend || (netChg > 2 ? '성장' : netChg < -2 ? '쇠퇴' : '정체');

  const surv1y = Number(bodyData.survivalRate1y) || 0;
  const surv3y = Number(bodyData.survivalRate3y) || 0;
  const surv5y = Number(bodyData.survivalRate5y) || 0;

  const cafesNow = Number(bodyData.cafesNow) || 0;
  const cafes5yAgo = Number(bodyData.cafes5yAgo) || 0;
  const change5y = Number(bodyData.cafes5yChangeRate) || 0;

  const popularMenus = Array.isArray(bodyData.popularMenus) ? bodyData.popularMenus.slice(0, 3) : [];
  const risingMenus = Array.isArray(bodyData.risingMenus) ? bodyData.risingMenus.slice(0, 3) : [];

  const popMaxRate = Math.max(1, ...popularMenus.map(m => Number(m.salesRate) || 0));
  const riseMaxRate = Math.max(1, ...risingMenus.map(m => Number(m.growthRate) || 0));

  const regionClosure = kosis?.regionClosure?.value || 0;

  return (
    <CardShell n="03" id="03"
      title="상권 변화 추이"
      sub="개폐업 및 상권 트렌드"
      sources={["국세청 (KOSIS 133)", "지방행정인허가데이터", "비즈맵"]}>
      <div className="bc-grid-4" style={{gap:16, marginBottom:16}}>
        <StatTile id="c3.tile1" tone={trend === '성장' ? 'mint' : trend === '쇠퇴' ? 'rose' : 'lilac'} label="추세" value={trend} hero/>
        <StatTile id="c3.tile2" tone="blue"  label="신규 개업"   value={String(openCnt)} unit="개"/>
        <StatTile id="c3.tile3" tone="rose"  label="폐업"        value={String(closeCnt)} unit="개"/>
        <StatTile id="c3.tile4" tone="lilac" label="순증감"      value={`${netChg > 0 ? '+' : ''}${netChg}`} unit="개"/>
      </div>

      <div style={{display:"grid", gridTemplateColumns:"1.2fr 1fr", gap:16, alignItems:"start"}}>
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
              <div style={{fontSize:24, fontWeight:700, fontVariantNumeric:"tabular-nums", letterSpacing:"-0.01em"}}>{cafes5yAgo > 0 ? cafes5yAgo : '-'}{cafes5yAgo > 0 && <span style={{fontSize:13, color:"var(--matte-fg-3)", marginLeft:3, fontWeight:500}}>개</span>}</div>
            </div>
            <div>
              <div style={{fontSize:13, color:"var(--matte-fg-3)", fontWeight:500, marginBottom:6}}>현재</div>
              <div style={{fontSize:24, fontWeight:700, color:"#4C7BE4", fontVariantNumeric:"tabular-nums", letterSpacing:"-0.01em"}}>{cafesNow > 0 ? cafesNow : '-'}{cafesNow > 0 && <span style={{fontSize:13, color:"var(--matte-fg-3)", marginLeft:3, fontWeight:500}}>개</span>}</div>
            </div>
            <div>
              <div style={{fontSize:13, color:"var(--matte-fg-3)", fontWeight:500, marginBottom:6}}>증감</div>
              <div style={{fontSize:24, fontWeight:700, fontVariantNumeric:"tabular-nums", letterSpacing:"-0.01em"}}>{change5y !== 0 ? `${change5y > 0 ? '+' : ''}${change5y}` : '-'}{change5y !== 0 && <span style={{fontSize:13, color:"var(--matte-fg-3)", marginLeft:3, fontWeight:500}}>%</span>}</div>
            </div>
          </div>
        </div>

        <div className="bc-box" style={{padding:24}}>
          <div style={{fontSize:16, fontWeight:600, marginBottom:18}}>메뉴 트렌드</div>
          <div style={{fontSize:14, color:"var(--matte-fg-3)", marginBottom:10, fontWeight:500}}>인기 TOP 3</div>
          {popularMenus.length > 0 ? (
            <div style={{display:"flex", flexDirection:"column", gap:10, marginBottom:18}}>
              {popularMenus.map((m, i) => {
                const rate = Number(m.salesRate) || 0;
                const w = Math.max(10, Math.round((rate / popMaxRate) * 100));
                return (
                  <div key={m.name} style={{display:"grid", gridTemplateColumns:"24px 1fr 70px", gap:10, alignItems:"center"}}>
                    <span style={{fontSize:13, color:"var(--matte-fg-4)", fontWeight:600, fontVariantNumeric:"tabular-nums"}}>{i+1}</span>
                    <div>
                      <div style={{fontSize:14, color:"var(--matte-fg-2)", fontWeight:600, marginBottom:4}}>{m.name}</div>
                      <div className="bc-bar" style={{height:6, background:"rgba(255,255,255,0.04)"}}>
                        <div style={{width:`${w}%`, background: i === 0 ? "#4C7BE4" : "#FFFFFF", height:"100%", borderRadius:"inherit"}}></div>
                      </div>
                    </div>
                    <span style={{textAlign:"right", fontSize:13, fontWeight:700, fontVariantNumeric:"tabular-nums", color: i === 0 ? "#4C7BE4" : "var(--matte-fg)"}}>{m.avgPrice > 0 ? `${m.avgPrice.toLocaleString()}원` : (rate > 0 ? `${rate.toFixed(1)}%` : '-')}</span>
                  </div>
                );
              })}
            </div>
          ) : (
            <div style={{fontSize:13, color:"var(--matte-fg-4)", marginBottom:18}}>인기 메뉴 데이터 수집 중</div>
          )}
          <div style={{fontSize:14, color:"var(--matte-fg-3)", marginBottom:10, fontWeight:500, paddingTop:14, borderTop:"1px solid var(--matte-line)"}}>급상승 TOP 3</div>
          {risingMenus.length > 0 ? (
            <div style={{display:"flex", flexDirection:"column", gap:10}}>
              {risingMenus.map((m, i) => {
                const rate = Number(m.growthRate) || 0;
                const w = Math.max(10, Math.round((rate / riseMaxRate) * 100));
                return (
                  <div key={m.name} style={{display:"grid", gridTemplateColumns:"24px 1fr 60px", gap:10, alignItems:"center"}}>
                    <span style={{fontSize:13, color:"var(--matte-fg-4)", fontWeight:600, fontVariantNumeric:"tabular-nums"}}>{i+1}</span>
                    <div>
                      <div style={{fontSize:14, color:"var(--matte-fg-2)", fontWeight:600, marginBottom:4}}>{m.name}</div>
                      <div className="bc-bar" style={{height:6, background:"rgba(255,255,255,0.04)"}}>
                        <div style={{width:`${w}%`, background: i === 0 ? "#4C7BE4" : "#FFFFFF", height:"100%", borderRadius:"inherit"}}></div>
                      </div>
                    </div>
                    <span style={{textAlign:"right", fontSize:14, fontWeight:700, fontVariantNumeric:"tabular-nums", color: i === 0 ? "#4C7BE4" : "var(--matte-fg)"}}>{rate > 0 ? `+${rate.toFixed(0)}%` : '-'}</span>
                  </div>
                );
              })}
            </div>
          ) : (
            <div style={{fontSize:13, color:"var(--matte-fg-4)"}}>급상승 메뉴 데이터 수집 중</div>
          )}
        </div>
      </div>

      <div className="bc-grid-3" style={{gap:12, marginTop:14}}>
        <div className="bc-box" style={{padding:20}}>
          <div style={{fontSize:14, color:"var(--matte-fg-3)", marginBottom:8, fontWeight:500}}>이 동 1년 폐업</div>
          <div style={{display:"flex", alignItems:"baseline", gap:8}}>
            <span style={{fontSize:32, fontWeight:700, fontVariantNumeric:"tabular-nums", letterSpacing:"-0.01em"}}>{closeCnt > 0 ? closeCnt : '-'}</span>
            {closeCnt > 0 && <span style={{fontSize:15, color:"var(--matte-fg-3)"}}>개</span>}
          </div>
          {regionClosure > 0 && (
            <div style={{fontSize:13, color:"var(--matte-fg-3)", marginTop:6, fontVariantNumeric:"tabular-nums"}}>{sigungu || '시군구'} 평균 {regionClosure}개</div>
          )}
        </div>
        <div className="bc-box" style={{padding:20}}>
          <div style={{fontSize:14, color:"var(--matte-fg-3)", marginBottom:8, fontWeight:500}}>3년 생존율</div>
          <div style={{display:"flex", alignItems:"baseline", gap:8}}>
            <span style={{fontSize:32, fontWeight:700, fontVariantNumeric:"tabular-nums", letterSpacing:"-0.01em", color:"#4C7BE4"}}>{surv3y > 0 ? surv3y : '-'}</span>
            {surv3y > 0 && <span style={{fontSize:15, color:"var(--matte-fg-3)"}}>%</span>}
          </div>
          <div style={{fontSize:13, color:"var(--matte-fg-3)", marginTop:6, fontVariantNumeric:"tabular-nums"}}>전국 평균 39%{surv3y > 0 ? ` 대비 ${surv3y > 39 ? '+' : ''}${(surv3y - 39).toFixed(1)}%p` : ''}</div>
        </div>
        <div className="bc-box" style={{padding:20}}>
          <div style={{fontSize:14, color:"var(--matte-fg-3)", marginBottom:8, fontWeight:500}}>5년 생존율</div>
          <div style={{display:"flex", alignItems:"baseline", gap:8}}>
            <span style={{fontSize:32, fontWeight:700, fontVariantNumeric:"tabular-nums", letterSpacing:"-0.01em"}}>{surv5y > 0 ? surv5y : '-'}</span>
            {surv5y > 0 && <span style={{fontSize:15, color:"var(--matte-fg-3)"}}>%</span>}
          </div>
          <div style={{fontSize:13, color:"var(--matte-fg-3)", marginTop:6, fontVariantNumeric:"tabular-nums"}}>전국 평균 28%{surv5y > 0 ? ` 대비 ${surv5y > 28 ? '+' : ''}${(surv5y - 28).toFixed(1)}%p` : ''}</div>
        </div>
      </div>
    </CardShell>
  );
}

/* ============================================================
   Card04 — 프랜차이즈 현황
   ============================================================ */
function BCCard04({ body: bodyProp }) {
  const body = bodyProp && Object.keys(bodyProp).length > 0 ? bodyProp : bcBodyOf('04');
  const bodyData = body.bodyData || {};

  const franchiseCount = Number(bodyData.franchiseCount) || 0;
  const independentCount = Number(bodyData.independentCount) || 0;
  const franchiseShare = Number(bodyData.franchiseShare) || 0;
  const independentShare = Number(bodyData.independentShare) || 0;
  const bakeryShare = Number(bodyData.bakeryShare) || 0;
  const perCafePotential = Number(bodyData.perCafePotential) || 0;

  const brandBars = Array.isArray(bodyData.brandBarItems) ? bodyData.brandBarItems.slice(0, 7) : [];
  const brandMax = Math.max(1, ...brandBars.map(b => Number(b.count) || 0));

  const dist = bodyData.distanceDistribution || { inner: 0, mid: 0, outer: 0 };
  const distMax = Math.max(1, dist.inner || 0, dist.mid || 0, dist.outer || 0);
  const distTopKey = (dist.inner >= dist.mid && dist.inner >= dist.outer) ? 'inner'
    : (dist.mid >= dist.outer ? 'mid' : 'outer');

  const innerCnt = dist.inner || 0;

  const FOREIGN_KW = ['스타벅스', '블루보틀', '커피빈', 'BLUE', 'STARBUCKS', 'COFFEE BEAN', '폴바셋', 'PAUL', '아라비카', '%', '드롭탑', 'CRINNI'];
  const isForeign = (n) => FOREIGN_KW.some(k => String(n).toUpperCase().includes(k.toUpperCase()));
  const foreignBrands = brandBars.filter(b => isForeign(b.name));
  const domesticBrands = brandBars.filter(b => !isForeign(b.name));
  const domesticCnt = domesticBrands.reduce((s, b) => s + (Number(b.count) || 0), 0);
  const foreignCnt = foreignBrands.reduce((s, b) => s + (Number(b.count) || 0), 0);
  const totalBrandCnt = domesticCnt + foreignCnt;
  const domesticPct = totalBrandCnt > 0 ? Math.round(domesticCnt / totalBrandCnt * 100) : 0;
  const foreignPct = totalBrandCnt > 0 ? 100 - domesticPct : 0;

  return (
    <CardShell n="04" id="04"
      title="프랜차이즈 현황"
      sub="주요 프랜차이즈 브랜드 분석"
      sources={["오픈업/카카오", "공정거래위원회 가맹사업거래"]}>
      <div className="bc-grid-4" style={{gap:16, marginBottom:16}}>
        <StatTile tone="lilac" label="프랜차이즈 매장" value={String(franchiseCount)} unit="개" hero/>
        <StatTile tone="blue"  label="시장 점유"      value={franchiseShare > 0 ? String(franchiseShare) : '-'} unit={franchiseShare > 0 ? '%' : ''}/>
        <StatTile tone="mint"  label="200m 이내"     value={String(innerCnt)} unit="개"/>
        <StatTile tone="cream" label="카페당 잠재 고객" value={perCafePotential > 0 ? perCafePotential.toLocaleString() : '-'} unit={perCafePotential > 0 ? '명/일' : ''}/>
      </div>

      <div style={{display:"grid", gridTemplateColumns:"1.2fr 1fr", gap:16, alignItems:"start"}}>
        <div className="bc-box" style={{padding:24}}>
          <div style={{fontSize:16, fontWeight:600, marginBottom:18}}>브랜드 TOP {Math.min(7, brandBars.length)}</div>
          {brandBars.length > 0 ? (
            <DrStagger id="c4.top7" delay={90} style={{display:"flex", flexDirection:"column", gap:4}}>
              {brandBars.map((b, i) => (
                <BarRow key={b.name + i} label={b.name} value={Number(b.count) || 0} max={brandMax} suffix="개" accent={i === 0}/>
              ))}
            </DrStagger>
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
            {[
              ["200m 이내", dist.inner || 0, "근접", 'inner'],
              ["200~350m", dist.mid || 0, "중간", 'mid'],
              ["350~500m", dist.outer || 0, "외곽", 'outer'],
            ].map(([k, v, sub, key]) => {
              const acc = key === distTopKey && (dist.inner + dist.mid + dist.outer) > 0;
              return (
                <div key={k} style={{display:"grid", gridTemplateColumns:"120px 1fr 60px", gap:12, alignItems:"center"}}>
                  <div>
                    <div style={{fontSize:14, color:"var(--matte-fg-2)", fontWeight:600}}>{k}</div>
                    <div style={{fontSize:13, color:"var(--matte-fg-3)", marginTop:2}}>{acc ? '최다 구간' : sub}</div>
                  </div>
                  <div className="bc-bar" style={{height:14, background:"rgba(255,255,255,0.05)"}}>
                    <div style={{width:`${(v/distMax)*100}%`, background: acc ? "#4C7BE4" : "#FFFFFF", height:"100%", borderRadius:"inherit"}}></div>
                  </div>
                  <span style={{textAlign:"right", fontSize:17, fontWeight:700, color: acc ? "#4C7BE4" : "var(--matte-fg)", fontVariantNumeric:"tabular-nums"}}>{v}<span style={{fontSize:13, color:"var(--matte-fg-3)", fontWeight:500, marginLeft:2}}>개</span></span>
                </div>
              );
            })}
          </div>

          <div style={{paddingTop:20, borderTop:"1px solid var(--matte-line)"}}>
            <div style={{fontSize:14, color:"var(--matte-fg-3)", fontWeight:500, marginBottom:14}}>국내/해외 브랜드</div>
            {totalBrandCnt > 0 ? (
              <div className="bc-grid-2" style={{gap:12}}>
                <div style={{padding:"16px 18px", background:"rgba(255,255,255,0.03)", borderRadius:10, border:"1px solid var(--matte-line)"}}>
                  <div style={{fontSize:13, color:"var(--matte-fg-3)", marginBottom:6, fontWeight:500}}>국내 브랜드</div>
                  <div style={{fontSize:22, fontWeight:700, fontVariantNumeric:"tabular-nums", letterSpacing:"-0.01em"}}>{domesticCnt}<span style={{fontSize:13, color:"var(--matte-fg-3)", marginLeft:3, fontWeight:500}}>개</span></div>
                  <div style={{fontSize:13, color:"var(--matte-fg-3)", marginTop:4}}>비중 {domesticPct}%</div>
                </div>
                <div style={{padding:"16px 18px", background:"rgba(84,120,201,0.08)", borderRadius:10, border:"1px solid rgba(84,120,201,0.45)"}}>
                  <div style={{fontSize:13, color:"var(--matte-fg-3)", marginBottom:6, fontWeight:500}}>해외 브랜드</div>
                  <div style={{fontSize:22, fontWeight:700, color:"#4C7BE4", fontVariantNumeric:"tabular-nums", letterSpacing:"-0.01em"}}>{foreignCnt}<span style={{fontSize:13, color:"var(--matte-fg-3)", marginLeft:3, fontWeight:500}}>개</span></div>
                  <div style={{fontSize:13, color:"var(--matte-fg-3)", marginTop:4}}>비중 {foreignPct}%</div>
                </div>
              </div>
            ) : (
              <div style={{fontSize:13, color:"var(--matte-fg-4)"}}>브랜드 분포 수집 중</div>
            )}
          </div>
        </div>
      </div>
    </CardShell>
  );
}

/* ============================================================
   Card05 — 개인 카페 분석 (handoff Card06 본체와 동일)
   ============================================================ */
function BCCard05({ body: bodyProp }) {
  const body = bodyProp && Object.keys(bodyProp).length > 0 ? bodyProp : bcBodyOf('05');
  const bodyData = body.bodyData || {};
  const sigungu = body.sigungu || '';
  const kosis = body.kosisBoxData || {};

  const indieCount = Number(bodyData.independentCount) || 0;
  const totalCafes = Number(bodyData.totalCafes) || 0;
  const indiePct = totalCafes > 0 ? Math.round(indieCount / totalCafes * 100) : 0;
  const americanoAvg = Number(bodyData.americanoAvg) || 0;
  const dessertAvg = Number(bodyData.dessertAvg) || 0;
  const menuAvg = Number(bodyData.menuAvg) || 0;

  const top5 = Array.isArray(bodyData.topNearbyIndie) ? bodyData.topNearbyIndie.slice(0, 5) : [];

  const compare = bodyData.indieFranchPriceCompare || null;
  const indieAmericano = compare?.indie || americanoAvg;
  const franchAmericano = compare?.franch || 4500;

  const regionClose = kosis?.regionClosure?.value || 0;
  const sidoClose = kosis?.cafeClosure?.value || 0;

  const priceItems = (() => {
    const items = [];
    if (indieAmericano > 0) items.push(['개인 카페 평균', indieAmericano, true]);
    items.push(['스타벅스 톨', 4700, false]);
    if (franchAmericano > 0) items.push(['프랜차이즈 평균', franchAmericano, false]);
    items.push(['저가 브랜드', 2500, false]);
    return items;
  })();
  const priceMax = Math.max(...priceItems.map(([, v]) => Number(v) || 0), 5000);

  return (
    <CardShell n="05" id="05"
      title="개인 카페 분석"
      sub="주변 개인 카페 현황 및 가격대"
      sources={["오픈업/카카오", "국세청 (KOSIS 133)"]}>
      <div className="bc-grid-4" style={{gap:16, marginBottom:16}}>
        <StatTile id="c6.tile1" tone="blue"  label="개인 카페 수"    value={String(indieCount)} unit="개" hero/>
        <StatTile id="c6.tile2" tone="mint"  label="비중"            value={indiePct > 0 ? String(indiePct) : '-'} unit={indiePct > 0 ? '%' : ''}/>
        <StatTile id="c6.tile3" tone="lilac" label="아메리카노 평균" value={americanoAvg > 0 ? americanoAvg.toLocaleString() : '-'} unit={americanoAvg > 0 ? '원' : ''} accent/>
        <StatTile id="c6.tile4" tone="cream" label="디저트 평균"     value={dessertAvg > 0 ? dessertAvg.toLocaleString() : (menuAvg > 0 ? menuAvg.toLocaleString() : '-')} unit={(dessertAvg > 0 || menuAvg > 0) ? '원' : ''}/>
      </div>

      <div style={{display:"grid", gridTemplateColumns:"1fr 1fr", gap:16, alignItems:"start"}}>
        <div className="bc-box" style={{padding:24}}>
          <div style={{fontSize:18, fontWeight:700, marginBottom:20}}>가까운 개인 카페 TOP {Math.min(5, top5.length)}</div>
          {top5.length > 0 ? (
            <DrStagger id="c6.top5" delay={80} style={{display:"grid", gridTemplateColumns:"repeat(2, minmax(0, 1fr))", gap:10}}>
              {top5.map((c, i) => {
                const isAcc = i === 0;
                return (
                  <div key={i} style={{
                    padding:"16px 18px",
                    background: isAcc ? "rgba(84,120,201,0.10)" : "rgba(255,255,255,0.03)",
                    border: isAcc ? "1px solid rgba(84,120,201,0.45)" : "1px solid var(--matte-line)",
                    borderRadius:10,
                    gridColumn: i === 4 ? "span 2" : "auto",
                  }}>
                    <div style={{display:"flex", alignItems:"baseline", gap:10, marginBottom:6, minWidth:0}}>
                      <span style={{fontSize:13, color:"var(--matte-fg-4)", fontVariantNumeric:"tabular-nums", fontWeight:700, flexShrink:0}}>{String(i+1).padStart(2,"0")}</span>
                      <span style={{fontSize:16, color:"var(--matte-fg)", fontWeight:700, letterSpacing:"-0.01em", flex:1, minWidth:0, wordBreak:"keep-all"}}>{c.name}</span>
                    </div>
                    <div style={{display:"flex", alignItems:"baseline", justifyContent:"space-between", gap:12, paddingLeft:23}}>
                      <span style={{fontSize:13, color:"var(--matte-fg-3)", minWidth:0, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap"}}>{(c.addr || '').slice(0, 18)}</span>
                      <span style={{fontSize:20, fontWeight:700, fontVariantNumeric:"tabular-nums", color: isAcc ? "#4C7BE4" : "var(--matte-fg)", letterSpacing:"-0.01em", flexShrink:0}}>{c.dist || 0}<span style={{fontSize:13, color:"var(--matte-fg-3)", marginLeft:2, fontWeight:500}}>m</span></span>
                    </div>
                  </div>
                );
              })}
            </DrStagger>
          ) : (
            <div style={{fontSize:13, color:"var(--matte-fg-4)", padding:"30px 0"}}>가까운 개인 카페 데이터 수집 중</div>
          )}
        </div>

        <div className="bc-box" style={{padding:24}}>
          <div style={{fontSize:16, fontWeight:600, marginBottom:18}}>아메리카노 가격 비교</div>
          <div style={{display:"flex", flexDirection:"column", gap:14, marginBottom:24}}>
            {priceItems.map(([who, v, acc]) => (
              <div key={who} style={{display:"grid", gridTemplateColumns:"110px 1fr 80px", gap:12, alignItems:"center"}}>
                <span style={{fontSize:14, color:"var(--matte-fg-2)", fontWeight:500}}>{who}</span>
                <div className="bc-bar" style={{height:14, background:"rgba(255,255,255,0.05)"}}>
                  <div style={{width:`${(Number(v)/priceMax)*100}%`, background: acc ? "#4C7BE4" : "#FFFFFF", height:"100%", borderRadius:"inherit"}}></div>
                </div>
                <span style={{textAlign:"right", fontSize:15, fontWeight:700, color: acc ? "#4C7BE4" : "var(--matte-fg)", fontVariantNumeric:"tabular-nums"}}>{Number(v).toLocaleString()}<span style={{fontSize:13, color:"var(--matte-fg-3)", marginLeft:2, fontWeight:500}}>원</span></span>
              </div>
            ))}
          </div>

          <div style={{paddingTop:20, borderTop:"1px solid var(--matte-line)"}}>
            <div style={{fontSize:14, color:"var(--matte-fg-3)", fontWeight:500, marginBottom:14}}>카페 폐업 (KOSIS)</div>
            {(sidoClose > 0 || regionClose > 0) ? (
              <>
                <div className="bc-grid-2" style={{gap:12}}>
                  <div style={{padding:"18px 20px", background:"rgba(255,255,255,0.03)", borderRadius:10, border:"1px solid var(--matte-line)"}}>
                    <div style={{fontSize:13, color:"var(--matte-fg-3)", marginBottom:8, fontWeight:500}}>시도 평균</div>
                    <div style={{fontSize:24, fontWeight:700, fontVariantNumeric:"tabular-nums", letterSpacing:"-0.01em"}}>{sidoClose > 0 ? sidoClose.toLocaleString() : '-'}<span style={{fontSize:13, color:"var(--matte-fg-3)", marginLeft:3, fontWeight:500}}>곳/년</span></div>
                  </div>
                  <div style={{padding:"18px 20px", background:"rgba(84,120,201,0.08)", borderRadius:10, border:"1px solid rgba(84,120,201,0.45)"}}>
                    <div style={{fontSize:13, color:"var(--matte-fg-3)", marginBottom:8, fontWeight:500}}>{sigungu || '시군구'}</div>
                    <div style={{fontSize:24, fontWeight:700, color:"#4C7BE4", fontVariantNumeric:"tabular-nums", letterSpacing:"-0.01em"}}>{regionClose > 0 ? regionClose.toLocaleString() : '-'}<span style={{fontSize:13, color:"var(--matte-fg-3)", marginLeft:3, fontWeight:500}}>곳/년</span></div>
                  </div>
                </div>
                {(sidoClose > 0 && regionClose > 0) && (
                  <div style={{fontSize:13, color:"var(--matte-fg-3)", marginTop:12, lineHeight:1.6}}>{sigungu || '이 시군구'}는 시도 평균 대비 <strong style={{color:"#4C7BE4"}}>{regionClose > sidoClose ? '+' : ''}{Math.round(((regionClose - sidoClose) / sidoClose) * 100)}%</strong> 수준</div>
                )}
              </>
            ) : (
              <div style={{fontSize:13, color:"var(--matte-fg-4)"}}>KOSIS 폐업 데이터 수집 중</div>
            )}
          </div>
        </div>
      </div>
    </CardShell>
  );
}

/* ============================================================
   Card06 — 매출 분석 (handoff Card05 본체와 동일)
   ============================================================ */
function BCCard06({ body: bodyProp }) {
  const body = bodyProp && Object.keys(bodyProp).length > 0 ? bodyProp : bcBodyOf('06');
  const bodyData = body.bodyData || {};
  const chartData = body.chartData || {};
  const kosis = body.kosisBoxData || {};

  const monthly = Number(bodyData.monthly) || 0;
  const dongAvg = Number(bodyData.dongAvg) || 0;
  const guAvg = Number(bodyData.guAvg) || 0;
  const dongMax = Number(bodyData.dongMaxSales) || 0;
  const dongMin = Number(bodyData.dongMinSales) || 0;
  const prevYearRate = Number(bodyData.prevYearRate) || 0;
  const prevMonRate = Number(bodyData.prevMonRate) || 0;
  const dongSaleCnt = Number(bodyData.dongSaleCnt) || 0;
  const bizmapAvgPrice = bodyData.bizmapAvgUnitPrice || null;
  const cafeSalesRank = bodyData.cafeSalesRank || null;

  const trend = bodyData.annualSalesTrend || null;
  const trendLabels = trend?.labels || [];
  const trendValues = trend?.values || [];

  const chartValues = Array.isArray(chartData.values) && chartData.values.length > 0 ? chartData.values : [];
  const chartLabels = Array.isArray(chartData.labels) ? chartData.labels : [];

  const lineData = trendValues.length > 0 ? trendValues : chartValues;
  const lineLabels = trendValues.length > 0 ? trendLabels : chartLabels;

  const top5 = Array.isArray(bodyData.topFiveDongsList) ? bodyData.topFiveDongsList.slice(0, 5) : [];
  const top5Title = bodyData.topFiveTitle || '동네별 카페 매출 TOP 5';
  const top5Max = Math.max(1, ...top5.map(d => Number(d.amt) || 0));

  const cs = kosis?.consumerSentiment || null;
  const csSeries = kosis?.consumerSentimentSeries?.series || [];
  const csLatest = cs?.value ?? (csSeries[csSeries.length - 1]?.value ?? null);
  const csPrev = csSeries.length >= 2 ? csSeries[csSeries.length - 2].value : null;
  const csChange = csLatest != null && csPrev != null ? Math.round((csLatest - csPrev) * 10) / 10 : null;
  const csRegion = kosis?.consumerSentiment?.region || kosis?.consumerSentimentSeries?.region || '전국 평균';

  const unitPrice = (() => {
    if (bizmapAvgPrice) return bizmapAvgPrice;
    const explicit = Number(bodyData.unitPrice) || Number(bodyData.avgUnitPrice) || 0;
    if (explicit > 0 && explicit < 100000) {
      return `${Math.round(explicit).toLocaleString()}원`;
    }
    return '-';
  })();

  const fmtWon = (manwon) => {
    if (!manwon || manwon < 1) return '-';
    if (manwon >= 10000) return `${(manwon / 10000).toFixed(2)}억`;
    return `${Math.round(manwon).toLocaleString()}만`;
  };

  return (
    <CardShell n="06" id="06"
      title="매출 분석"
      sub="월평균 예상 매출"
      date={null}
      sources={["소상공인진흥공단", "비즈맵", "한국은행 (KOSIS 301)"]}>
      <div className="bc-grid-4" style={{gap:16, marginBottom:16}}>
        <StatTile id="c5.tile1" tone="blue"  label="월평균 매출"   value={monthly > 0 ? monthly.toLocaleString() : '-'} unit={monthly > 0 ? '만원' : ''} delta={prevYearRate ? `${prevYearRate > 0 ? '+' : ''}${prevYearRate.toFixed(1)}` : undefined} deltaPositive={prevYearRate >= 0} hero accent/>
        <StatTile id="c5.tile2" tone="mint"  label="월 매출 건수"  value={dongSaleCnt > 0 ? dongSaleCnt.toLocaleString() : '-'} unit={dongSaleCnt > 0 ? '건' : ''}/>
        <StatTile id="c5.tile3" tone="lilac" label="객단가"        value={unitPrice}/>
        <StatTile id="c5.tile4" tone="cream" label="매출 순위"     value={cafeSalesRank ? cafeSalesRank.split(' /')[0] : '-'} delta={prevMonRate ? `${prevMonRate > 0 ? '+' : ''}${prevMonRate.toFixed(1)}` : undefined} deltaPositive={prevMonRate >= 0}/>
      </div>

      <div style={{display:"grid", gridTemplateColumns:"2fr 1fr", gap:16, alignItems:"start"}}>
        <div className="bc-box" style={{padding:24}}>
          <div style={{display:"flex", justifyContent:"space-between", alignItems:"baseline", marginBottom:18}}>
            <div style={{fontSize:16, fontWeight:600}}>매출 추이</div>
            <div style={{fontSize:13, color:"var(--matte-fg-3)"}}>{lineLabels.length > 0 ? `최근 ${lineLabels.length}개월` : ''}</div>
          </div>
          {lineData.length >= 2 ? (
            <>
              <LineChart id="c5.line" width={680} height={240} data={lineData} color="#4C7BE4"/>
              <div style={{display:"grid", gridTemplateColumns:`repeat(${lineLabels.length}, 1fr)`, marginTop:10, gap:4}}>
                {lineLabels.map((m, i) => (
                  <div key={i} style={{fontSize:13, textAlign:"center", color:"var(--matte-fg-3)"}}>{m}</div>
                ))}
              </div>
            </>
          ) : (
            <div style={{height:240, display:"flex", alignItems:"center", justifyContent:"center", color:"var(--matte-fg-4)"}}>매출 추이 데이터 수집 중</div>
          )}

          <div style={{marginTop:24, paddingTop:20, borderTop:"1px solid var(--matte-line)", display:"grid", gridTemplateColumns:"repeat(4, 1fr)", gap:14}}>
            {[
              ["동 최고", fmtWon(dongMax), false],
              ["동 평균", fmtWon(dongAvg), true],
              ["동 최저", fmtWon(dongMin), false],
              ["YoY 성장", prevYearRate ? `${prevYearRate > 0 ? '+' : ''}${prevYearRate.toFixed(1)}%` : '-', false],
            ].map(([l, v, acc]) => (
              <div key={l} style={{padding:"14px 16px", background:"rgba(255,255,255,0.03)", borderRadius:10, border:"1px solid var(--matte-line)"}}>
                <div style={{fontSize:13, color:"var(--matte-fg-3)", marginBottom:6, fontWeight:500}}>{l}</div>
                <div style={{fontSize:20, fontWeight:700, fontVariantNumeric:"tabular-nums", color: acc ? "#4C7BE4" : "var(--matte-fg)", letterSpacing:"-0.01em"}}>{v}</div>
              </div>
            ))}
          </div>
        </div>

        <div className="bc-box" style={{padding:24}}>
          <div style={{fontSize:18, fontWeight:700, marginBottom:20}}>{top5Title}</div>
          {top5.length > 0 ? (
            <div style={{display:"flex", flexDirection:"column"}}>
              {top5.map((d, i) => (
                <div key={i} style={{display:"grid", gridTemplateColumns:"36px 1fr auto", gap:14, alignItems:"center", padding:"14px 0", borderBottom: i<4 ? "1px solid var(--matte-line)" : "none"}}>
                  <span style={{fontSize:15, color:"var(--matte-fg-4)", fontWeight:700, fontVariantNumeric:"tabular-nums"}}>{String(i+1).padStart(2,"0")}</span>
                  <div>
                    <div style={{fontSize:16, color:"var(--matte-fg)", fontWeight:700, marginBottom:8, letterSpacing:"-0.005em"}} title={d.warning || ''}>{d.name}{d.warning ? ' ⚠' : ''}</div>
                    <div className="bc-bar" style={{height:8, background:"rgba(255,255,255,0.04)"}}>
                      <div style={{width:`${(d.amt / top5Max)*100}%`, background: i === 0 ? "#4C7BE4" : "#FFFFFF", height:"100%", borderRadius:"inherit"}}></div>
                    </div>
                  </div>
                  <span style={{fontSize:18, fontWeight:700, fontVariantNumeric:"tabular-nums", color: i === 0 ? "#4C7BE4" : "var(--matte-fg)", letterSpacing:"-0.01em"}}>{fmtWon(d.amt)}</span>
                </div>
              ))}
            </div>
          ) : (
            <div style={{fontSize:13, color:"var(--matte-fg-4)", padding:"20px 0"}}>동네별 매출 데이터 수집 중</div>
          )}

          <div style={{marginTop:24, paddingTop:20, borderTop:"1px solid var(--matte-line)"}}>
            <div style={{fontSize:14, color:"var(--matte-fg-3)", fontWeight:500, marginBottom:10}}>이번 달 권역 소비심리</div>
            {csLatest != null ? (
              <>
                <div style={{display:"flex", alignItems:"baseline", gap:10}}>
                  <span style={{fontSize:32, fontWeight:700, fontVariantNumeric:"tabular-nums", letterSpacing:"-0.01em"}}>{Number(csLatest).toFixed(1)}</span>
                  {csChange != null && (
                    <span style={{fontSize:14, color: csChange >= 0 ? "#4C7BE4" : "var(--st-bad)", fontWeight:700, fontVariantNumeric:"tabular-nums"}}>{csChange > 0 ? '+' : ''}{csChange} {csChange >= 0 ? '↗' : '↘'}</span>
                  )}
                </div>
                <div style={{fontSize:13, color:"var(--matte-fg-3)", marginTop:8}}>100 이상 = 긍정 · {csRegion} (한국은행 KOSIS 301)</div>
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
   Card07 — 유동인구
   ============================================================ */
function BCCard07({ body: bodyProp }) {
  const body = bodyProp && Object.keys(bodyProp).length > 0 ? bodyProp : bcBodyOf('07');
  const bodyData = body.bodyData || {};
  const chartData = body.chartData || {};
  const sigungu = body.sigungu || '';

  const totalPop = Number(bodyData.totalPop) || 0;
  const dongDailyPop = Number(bodyData.dongDailyPop) || 0;
  const weekday = Number(bodyData.weekday) || 0;
  const weekend = Number(bodyData.weekend) || 0;
  const weekdayPct = Number(bodyData.weekdayPct) || (weekday + weekend > 0 ? Math.round(weekday / (weekday + weekend) * 100) : 0);
  const weekendPct = Number(bodyData.weekendPct) || (100 - weekdayPct);
  const peakHour = bodyData.peakHour || bodyData.popPeakHour || '-';
  const peakDay = bodyData.popPeakDay || bodyData.bizmapPeakDay || (bodyData.dayOfWeek?.peakDay) || '-';
  const peakHourPct = Number(bodyData.popPeakHourPct) || 0;
  const peakDayPct = Number(bodyData.popPeakDayPct) || 0;

  const hourlyChart = bodyData.hourlyPctChart || (chartData.labels && chartData.values ? { labels: chartData.labels, values: chartData.values } : null);
  const hourItems = hourlyChart && hourlyChart.labels ? hourlyChart.labels.map((l, i) => ({
    l, v: hourlyChart.values[i] || 0, t: `${(hourlyChart.values[i] || 0).toFixed(0)}%`
  })) : [];
  const hourTopIdx = hourItems.length > 0 ? hourItems.reduce((m, x, i, arr) => x.v > arr[m].v ? i : m, 0) : 0;

  const weeklyChart = bodyData.weeklyPctChart;
  const dayItems = weeklyChart && weeklyChart.labels ? weeklyChart.labels.map((l, i) => ({
    l, v: weeklyChart.values[i] || 0, t: `${(weeklyChart.values[i] || 0).toFixed(0)}`
  })) : [];
  const dayTopIdx = dayItems.length > 0 ? dayItems.reduce((m, x, i, arr) => x.v > arr[m].v ? i : m, 0) : 0;

  const topArea = bodyData.topArea || null;

  return (
    <CardShell n="07" id="07"
      title="유동인구"
      sub="시간대별 통행량"
      sources={["소상공인진흥공단 dynPplCmpr", "비즈맵"]}>
      <div className="bc-grid-4" style={{gap:16, marginBottom:16}}>
        <StatTile id="c7.tile1" tone="blue"  label="동 일평균 유동인구" value={dongDailyPop > 0 ? dongDailyPop.toLocaleString() : (totalPop > 0 ? totalPop.toLocaleString() : '-')} unit="명" hero/>
        <StatTile id="c7.tile2" tone="mint"  label="최다 요일"        value={peakDay !== '-' ? peakDay : '-'} delta={peakDayPct > 0 ? peakDayPct.toFixed(1) : undefined}/>
        <StatTile id="c7.tile3" tone="lilac" label="최다 시간대"      value={peakHour !== '-' ? peakHour : '-'} delta={peakHourPct > 0 ? peakHourPct.toFixed(1) : undefined}/>
        <StatTile id="c7.tile4" tone="cream" label="반경 500m 일평균" value={totalPop > 0 ? totalPop.toLocaleString() : '-'} unit={totalPop > 0 ? '명/일' : ''}/>
      </div>

      <div style={{display:"grid", gridTemplateColumns:"1.3fr 1fr", gap:16}}>
        <div className="bc-box" style={{padding:18}}>
          <div style={{fontSize:15, fontWeight:600, marginBottom:14}}>시간대별 비중</div>
          {hourItems.length > 0 ? (
            <VBars id="c7.hours" accent={hourTopIdx} barW={28} gap={16} height={160} items={hourItems}/>
          ) : (
            <div style={{fontSize:13, color:"var(--matte-fg-4)", padding:"30px 0"}}>시간대 데이터 수집 중</div>
          )}
          <div style={{marginTop:18, paddingTop:14, borderTop:"1px solid var(--matte-line)"}}>
            <div style={{fontSize:15, fontWeight:600, marginBottom:14}}>요일별 비중</div>
            {dayItems.length > 0 ? (
              <VBars id="c7.days" accent={dayTopIdx} barW={28} gap={10} height={100} items={dayItems}/>
            ) : (
              <div style={{fontSize:13, color:"var(--matte-fg-4)", padding:"20px 0"}}>요일 데이터 수집 중</div>
            )}
          </div>
        </div>

        <div>
          <div className="bc-box" style={{padding:18, marginBottom:12}}>
            <div style={{fontSize:15, fontWeight:600, marginBottom:12}}>주중 vs 주말</div>
            {(weekdayPct > 0 || weekendPct > 0) ? (
              <div style={{display:"flex", alignItems:"center", gap:16, justifyContent:"center"}}>
                <Donut id="c7.donut" size={180} segments={[
                  {value: weekdayPct, color:"#4C7BE4", label:"주중"},
                  {value: weekendPct, color:"#FFFFFF", label:"주말"},
                ]} centerLabel={`${weekdayPct.toFixed(0)}%`} centerSub="주중 비중"/>
                <DonutLegend segments={[
                  {value: weekdayPct, color:"#4C7BE4", label:"주중", text:`${weekdayPct.toFixed(0)}%`},
                  {value: weekendPct, color:"#FFFFFF", label:"주말", text:`${weekendPct.toFixed(0)}%`},
                ]}/>
              </div>
            ) : (
              <div style={{fontSize:13, color:"var(--matte-fg-4)", padding:"30px 0", textAlign:"center"}}>주중/주말 데이터 수집 중</div>
            )}
          </div>
          <div className="bc-box" style={{padding:14}}>
            <div style={{fontSize:15, color:"var(--matte-fg-3)", fontWeight:600, marginBottom:8}}>인접 비교 ({sigungu || '시군구'})</div>
            {topArea ? (
              <div style={{display:"flex", justifyContent:"space-between", padding:"5px 0", fontSize:15}}>
                <span><span style={{color:"var(--matte-fg-4)", marginRight:6}}>인근</span>{topArea.name}</span>
                <span style={{fontVariantNumeric:"tabular-nums", color:"var(--matte-fg-2)"}}>{(topArea.pop || 0).toLocaleString()}명/일</span>
              </div>
            ) : dongDailyPop > 0 ? (
              <div style={{display:"flex", justifyContent:"space-between", padding:"5px 0", fontSize:15}}>
                <span><span style={{color:"var(--matte-fg-4)", marginRight:6}}>이 동</span>{sigungu ? `${sigungu}` : '동 전체'}</span>
                <span style={{fontVariantNumeric:"tabular-nums", color:"var(--matte-fg-2)"}}>{dongDailyPop.toLocaleString()}명/일</span>
              </div>
            ) : (
              <div style={{fontSize:13, color:"var(--matte-fg-4)"}}>인접 비교 데이터 수집 중</div>
            )}
          </div>
        </div>
      </div>
    </CardShell>
  );
}

/* ============================================================
   Card08 — 임대/창업 정보
   ============================================================ */
function BCCard08({ body: bodyProp }) {
  const body = bodyProp && Object.keys(bodyProp).length > 0 ? bodyProp : bcBodyOf('08');
  const bodyData = body.bodyData || {};
  const chartData = body.chartData || {};
  const kosis = body.kosisBoxData || {};

  const rentPerPyeong = Number(kosis?.integratedRent?.value) || Number(bodyData.rentPerPyeong) || 0;
  const deposit = Number(bodyData.deposit) || 0;
  const interiorCost = Number(bodyData.interiorCost) || 0;
  const totalStartupCost = Number(bodyData.totalStartupCost) || 0;

  const marketRent = kosis?.marketRent?.value ? Math.round(kosis.marketRent.value / 10000) : 0;
  const conversionRate = kosis?.conversionRate?.value || 0;
  const yieldRate = kosis?.yieldRate?.value || 0;
  const netIncome = kosis?.netIncome?.value || 0;
  const netIncomeUnit = kosis?.netIncome?.unit || '원/평/년';
  const netIncomePct = kosis?.netIncome?.noiPct || 0;
  const kosisPeriod = kosis?.marketRent?.period || kosis?.yieldRate?.period || '';
  const kosisRegion = kosis?.marketRent?.region || '';

  const kc = chartData.kosisCafe || null;

  const premium = chartData.premium || bodyData.premium || null;
  const premiumValue = Number(premium?.value) || Number(bodyData.premiumCost) || 0;
  const premiumManwon = premiumValue > 0 ? Math.round(premiumValue / 10000) : 0;
  const premiumOk = premium?.region || '';

  const [pyeong, setPyeong] = useState(15);
  const monthly = rentPerPyeong > 0 ? Math.round(pyeong * rentPerPyeong) : 0;
  const simDeposit = (deposit > 0 ? deposit : (rentPerPyeong > 0 ? rentPerPyeong * 30 : 0)) * (pyeong / 15);
  const simInterior = (interiorCost > 0 ? interiorCost : (kc?.interiorPerPyeong > 0 ? kc.interiorPerPyeong * pyeong : pyeong * 350)) * 1;
  const simTotal = simDeposit + simInterior + (premiumManwon || 3000);

  return (
    <CardShell n="08" id="08"
      title="임대/창업 정보"
      sub="상가 시세 및 창업 비용"
      sources={["한국부동산원 (KOSIS 408)", "외식업체경영실태조사", "자체 수집기"]}>
      <div className="bc-grid-4" style={{gap:16, marginBottom:16}}>
        <StatTile id="c8.tile1" tone="blue"  label="통합 평당 월세" value={rentPerPyeong > 0 ? String(rentPerPyeong) : '-'} unit={rentPerPyeong > 0 ? '만원' : ''} hero/>
        <StatTile id="c8.tile2" tone="lilac" label="평균 보증금"   value={deposit > 0 ? `${(deposit / 10000).toFixed(2)}` : '-'} unit={deposit > 0 ? '억' : ''}/>
        <StatTile id="c8.tile3" tone="mint"  label="총 창업 (15평)" value={totalStartupCost > 0 ? `${(totalStartupCost / 10000).toFixed(2)}` : (simTotal > 0 ? `${(simTotal / 10000).toFixed(2)}` : '-')} unit={(totalStartupCost > 0 || simTotal > 0) ? '억' : ''}/>
        <StatTile id="c8.tile4" tone="rose"  label="권리금"  value={premiumManwon > 0 ? `${(premiumManwon / 10000).toFixed(1)}` : '-'} unit={premiumManwon > 0 ? '억' : ''}/>
      </div>

      <div style={{display:"grid", gridTemplateColumns:"1fr 1fr", gap:16}}>
        <div className="bc-box" style={{padding:18}}>
          <div style={{fontSize:15, fontWeight:600, marginBottom:12}}>한국부동산원 임대 4종</div>
          <div className="bc-grid-2" style={{gap:10}}>
            <Box label="평당 월세" value={marketRent > 0 ? String(marketRent) : '-'} unit={marketRent > 0 ? '만' : ''} sub={kosisRegion || ''} src={kosisPeriod}/>
            <Box label="전환율"   value={conversionRate > 0 ? conversionRate.toFixed(1) : '-'} unit={conversionRate > 0 ? '%' : ''} src={kosisPeriod}/>
            <Box label="수익률"   value={yieldRate > 0 ? yieldRate.toFixed(1) : '-'} unit={yieldRate > 0 ? '%' : ''} sub="순영업소득 기준" src={kosisPeriod}/>
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
                     : (netIncome > 0 ? (netIncome >= 10000 ? '만/년' : '원/평/년') : '')
                 }
                 sub={netIncomeUnit === '%' ? '임대수입 대비' : ''}
                 src={kosisPeriod}/>
          </div>
        </div>

        <div className="bc-box" style={{padding:18}}>
          <div style={{fontSize:15, fontWeight:600, marginBottom:12}}>전국 카페 평균 (KOSIS 114)</div>
          {kc ? (
            <>
              <div className="bc-grid-3" style={{gap:8}}>
                <Box label="인테리어비" value={kc.interiorAvg > 0 ? kc.interiorAvg.toLocaleString() : '-'} unit={kc.interiorAvg > 0 ? '만' : ''}/>
                <Box label="총 투자비"  value={kc.startupInvestAvg > 0 ? `${(kc.startupInvestAvg / 10000).toFixed(2)}` : '-'} unit={kc.startupInvestAvg > 0 ? '억' : ''}/>
                <Box label="평수"       value={kc.avgAreaPyeong > 0 ? kc.avgAreaPyeong.toFixed(1) : '-'} unit={kc.avgAreaPyeong > 0 ? '평' : ''}/>
                <Box label="월 매출"    value={kc.salesAvg > 0 ? kc.salesAvg.toLocaleString() : '-'} unit={kc.salesAvg > 0 ? '만' : ''}/>
                <Box label="객단가"     value={kc.unitPriceAvg > 0 ? kc.unitPriceAvg.toLocaleString() : '-'} unit={kc.unitPriceAvg > 0 ? '원' : ''}/>
                <Box label="이익률"     value={kc.profitMargin > 0 ? kc.profitMargin.toFixed(1) : '-'} unit={kc.profitMargin > 0 ? '%' : ''}/>
              </div>
              <div style={{fontSize:13, color:"var(--matte-fg-4)", marginTop:8}}>외식업체경영실태조사 {kc.year || ''}</div>
            </>
          ) : (
            <div style={{fontSize:13, color:"var(--matte-fg-4)", padding:"20px 0"}}>KOSIS 카페 평균 데이터 수집 중</div>
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
          <div style={{fontSize:13, color:"var(--matte-fg-3)", marginTop:16, paddingTop:14, borderTop:"1px solid var(--matte-line)"}}>평균 시공 권장 — 평당 {kc?.interiorPerPyeong > 0 ? kc.interiorPerPyeong.toLocaleString() : '~350'}만원 기준 (KOSIS 외식업체경영실태조사)</div>
        </div>

        <div className="bc-box" style={{padding:24, background:"linear-gradient(135deg, rgba(84,120,201,0.10), transparent 60%)", border:"1px solid rgba(84,120,201,0.45)"}}>
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
              <div style={{fontSize:22, fontWeight:700, fontVariantNumeric:"tabular-nums", letterSpacing:"-0.01em"}}>{simDeposit > 0 ? `${(simDeposit/10000).toFixed(2)}` : '-'}<span style={{fontSize:13, color:"var(--matte-fg-3)", marginLeft:3, fontWeight:500}}>{simDeposit > 0 ? '억' : ''}</span></div>
            </div>
            <div style={{padding:"16px 18px", background:"rgba(84,120,201,0.10)", borderRadius:10, border:"1px solid rgba(84,120,201,0.45)"}}>
              <div style={{fontSize:13, color:"var(--matte-fg-3)", marginBottom:6, fontWeight:500}}>총 창업비</div>
              <div style={{fontSize:22, fontWeight:700, color:"#4C7BE4", fontVariantNumeric:"tabular-nums", letterSpacing:"-0.01em"}}>{simTotal > 0 ? `${(simTotal/10000).toFixed(2)}` : '-'}<span style={{fontSize:13, color:"var(--matte-fg-3)", marginLeft:3, fontWeight:500}}>{simTotal > 0 ? '억' : ''}</span></div>
            </div>
          </div>
          {premiumManwon > 0 && premiumOk && (
            <div style={{marginTop:14, fontSize:13, color:"var(--matte-fg-3)"}}>{premiumOk} 기준 권리금 평균 {premiumManwon.toLocaleString()}만원 포함</div>
          )}
        </div>
      </div>
    </CardShell>
  );
}

/* ============================================================
   Card09 — 카페 기회
   ============================================================ */
function BCCard09({ body: bodyProp }) {
  const body = bodyProp && Object.keys(bodyProp).length > 0 ? bodyProp : bcBodyOf('09');
  const bodyData = body.bodyData || {};
  const kosis = body.kosisBoxData || {};

  const vacancy = Number(body.vacancy) || Number(kosis?.vacancy?.value) || 0;
  const newOpen = Number(body.newOpen) || Number(bodyData.recentOpen) || Number(bodyData.openCount) || 0;
  const closed = Number(body.closed) || Number(bodyData.recentClose) || Number(bodyData.closeCount) || 0;
  const cafeMonthly = Number(body.cafeMonthly) || 0;
  const guAvg = Number(body.guAvg) || 0;
  const sigungu = body.sigungu || '';
  const individualPct = Number(body.individualPct) || 0;
  const survival3y = Number(body.survival3y) || 0;

  const vacSeries = body.vacancySeries || kosis?.vacancySeries?.series || null;
  const vacValues = Array.isArray(vacSeries) ? vacSeries.map(s => Number(s.value) || 0).filter(v => v > 0) : [];
  const vacMin = vacValues.length > 0 ? Math.min(...vacValues) : 0;
  const vacMax = vacValues.length > 0 ? Math.max(...vacValues) : 0;
  const vacRange = vacMax > 0 ? Math.round((vacMax - vacMin) * 10) / 10 : 0;

  const vacavgDelta = (() => {
    if (vacValues.length < 2) return 0;
    const avg = vacValues.reduce((s, v) => s + v, 0) / vacValues.length;
    return Math.round((vacancy - avg) * 10) / 10;
  })();

  const cafeAvgRatio = (cafeMonthly > 0 && guAvg > 0) ? (cafeMonthly / guAvg) : 0;
  const findings = [
    {
      axis: '시장 매력도',
      text: cafeMonthly > 0 && guAvg > 0
        ? `월매출 ${cafeMonthly.toLocaleString()}만 — ${sigungu || '시군구'} 평균 ${cafeAvgRatio > 1 ? '+' : ''}${Math.round((cafeAvgRatio - 1) * 100)}%`
        : (cafeMonthly > 0 ? `월매출 ${cafeMonthly.toLocaleString()}만` : '매출 데이터 수집 중'),
      ratio: cafeAvgRatio > 1 ? Math.min(0.95, cafeAvgRatio - 0.5) : 0.5,
      acc: cafeAvgRatio > 1.1,
    },
    {
      axis: '경쟁 환경',
      text: individualPct > 0 ? `개인 카페 ${individualPct}% — 차별화 여지` : '경쟁 데이터 수집 중',
      ratio: individualPct / 100,
      acc: false,
    },
    {
      axis: '시장 변화',
      text: (newOpen > 0 || closed > 0) ? `신규 ${newOpen} / 폐업 ${closed} — ${newOpen >= closed ? '자연 회전 정상권' : '구조조정 진행'}` : '변화 데이터 수집 중',
      ratio: newOpen + closed > 0 ? Math.min(0.9, newOpen / Math.max(1, newOpen + closed) + 0.2) : 0.5,
      acc: false,
    },
    {
      axis: '생존 기반',
      text: survival3y > 0 ? `3년 생존율 ${survival3y}% — ${survival3y >= 60 ? '상위' : survival3y >= 40 ? '평균' : '주의'}` : '생존율 데이터 수집 중',
      ratio: survival3y / 100,
      acc: survival3y >= 60,
    },
    {
      axis: '비용 부담',
      text: vacancy > 0 ? `공실률 ${vacancy.toFixed(1)}% — ${vacancy < 5 ? '안정' : vacancy < 8 ? '보통' : '주의'}` : '공실률 데이터 수집 중',
      ratio: vacancy > 0 ? Math.max(0.1, 1 - vacancy / 12) : 0.5,
      acc: false,
    },
  ];

  const ldFindings = Array.isArray(bodyData.findings) ? bodyData.findings : [];

  return (
    <CardShell n="09" id="09"
      title="카페 기회"
      sub="이 동네 카페 데이터 발견"
      sources={["한국부동산원 (KOSIS 408)", "지방행정인허가데이터", "소상공인진흥공단"]}>
      <div className="bc-grid-4" style={{gap:16, marginBottom:16}}>
        <StatTile id="c9.hero" tone="mint" label="공실률" value={vacancy > 0 ? vacancy.toFixed(1) : '-'} unit={vacancy > 0 ? '%' : ''} delta={vacavgDelta ? `${vacavgDelta > 0 ? '+' : ''}${vacavgDelta}` : undefined} deltaPositive={vacavgDelta <= 0} hero accent/>
        <StatTile tone="blue" label="평균 대비" value={vacavgDelta ? `${vacavgDelta > 0 ? '+' : ''}${vacavgDelta}` : '-'} unit={vacavgDelta ? '%p' : ''}/>
        <StatTile tone="lilac" label="1년 신규" value={String(newOpen)} unit="개"/>
        <StatTile tone="cream" label="1년 폐업" value={String(closed)} unit="개"/>
      </div>

      <div style={{display:"grid", gridTemplateColumns:"1fr 1.4fr", gap:16, alignItems:"stretch"}}>
        <div className="bc-box" style={{padding:24, display:"flex", flexDirection:"column"}}>
          <div style={{display:"flex", justifyContent:"space-between", alignItems:"baseline", marginBottom:16}}>
            <span style={{fontSize:16, fontWeight:600}}>공실률 추이</span>
            <span style={{fontSize:13, color:"var(--matte-fg-3)"}}>{vacValues.length > 0 ? `${vacValues.length}분기` : ''}</span>
          </div>
          <div style={{flex:1, display:"flex", alignItems:"center", minHeight:200}}>
            {vacValues.length >= 2 ? (
              <LineChart id="c9.line" width={460} height={260} data={vacValues} color="#4C7BE4"/>
            ) : (
              <div style={{width:"100%", textAlign:"center", color:"var(--matte-fg-4)", fontSize:13}}>공실률 추이 데이터 수집 중</div>
            )}
          </div>
          <div style={{marginTop:20, paddingTop:18, borderTop:"1px solid var(--matte-line)", display:"grid", gridTemplateColumns:"1fr 1fr 1fr", gap:14}}>
            {[
              ["최저", vacMin > 0 ? vacMin.toFixed(1) : '-', "%"],
              ["최고", vacMax > 0 ? vacMax.toFixed(1) : '-', "%"],
              ["변동폭", vacRange > 0 ? vacRange.toFixed(1) : '-', "%p"],
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
          <DrStagger id="c9.list" delay={120} style={{display:"flex", flexDirection:"column", gap:14}}>
          {findings.map((f, i) => (
            <div key={i} style={{padding:"16px 18px", background:"rgba(255,255,255,0.03)", borderRadius:10, border:"1px solid var(--matte-line)"}}>
              <div style={{display:"flex", justifyContent:"space-between", alignItems:"baseline", marginBottom:8}}>
                <span style={{fontSize:15, fontWeight:700, color: f.acc ? "#4C7BE4" : "var(--matte-fg)"}}>{f.axis}</span>
                <span style={{fontSize:13, color: f.ratio >= 0.6 ? "var(--matte-fg-2)" : "var(--matte-fg-3)", fontWeight:600, fontVariantNumeric:"tabular-nums"}}>{f.ratio >= 0.7 ? "강점" : f.ratio >= 0.4 ? "보통" : "주의"}</span>
              </div>
              <div style={{fontSize:14, color:"var(--matte-fg-2)", marginBottom:10, lineHeight:1.5}}>{f.text}</div>
              <div className="bc-bar" style={{height:8, background:"rgba(255,255,255,0.04)"}}>
                <div style={{width:`${f.ratio*100}%`, background: f.acc ? "#4C7BE4" : "#FFFFFF", height:"100%", borderRadius:"inherit"}}></div>
              </div>
            </div>
          ))}
          {ldFindings.length > 0 && ldFindings.map((f, i) => (
            <div key={`ld-${i}`} style={{padding:"12px 16px", background:"rgba(255,255,255,0.02)", borderRadius:10, border:"1px solid var(--matte-line)"}}>
              <div style={{fontSize:13, fontWeight:700, color:"var(--matte-fg-3)", marginBottom:4}}>{f.axis}</div>
              <div style={{fontSize:13, color:"var(--matte-fg-2)", lineHeight:1.5}}>{f.text}</div>
            </div>
          ))}
          </DrStagger>
        </div>
      </div>
    </CardShell>
  );
}

/* ============================================================
   Card10 — 배달 객단가
   ============================================================ */
function BCCard10({ body: bodyProp }) {
  const body = bodyProp && Object.keys(bodyProp).length > 0 ? bodyProp : bcBodyOf('10');
  const bodyData = body.bodyData || {};

  const searchAvgPrice = Number(bodyData.searchAvgPrice) || 0;
  const searchSales = Number(bodyData.searchSales) || 0;
  const searchOrders = Number(bodyData.searchOrders) || 0;
  const cafeRank = Number(bodyData.cafeRankInDelivery) || 0;
  const totalBiz = Number(bodyData.totalDeliveryBiz) || 0;

  const monthlyTrend = Array.isArray(bodyData.monthlyTrend) ? bodyData.monthlyTrend.slice(-12) : [];
  const monthlyValues = monthlyTrend.map(m => Number(m.value) || 0).filter(v => v > 0);
  const yoyPct = monthlyValues.length >= 2 && monthlyValues[0] > 0
    ? Math.round(((monthlyValues[monthlyValues.length - 1] - monthlyValues[0]) / monthlyValues[0]) * 100)
    : 0;

  const weekdaySales = Array.isArray(bodyData.weekdaySales) ? bodyData.weekdaySales : [];
  const dayItems = weekdaySales.map(d => ({
    l: d.day, v: Number(d.amount) || 0, t: String(Math.round(Number(d.amount) || 0))
  }));
  const dayTopIdx = dayItems.findIndex((_, i) => weekdaySales[i]?.isTop);

  const kd = bodyData.kosisDelivery || null;
  const kdActiveRatio = kd ? Math.round(Number(kd.overallUsePct) || 0) : null;
  const kdInactiveRatio = kdActiveRatio != null ? 100 - kdActiveRatio : null;

  const kdMonthlyCost = (() => {
    if (!kd) return [];
    const items = [];
    const appAvg = Number(kd.app?.avgManwon) || 0;
    const agencyAvg = Number(kd.agency?.avgManwon) || 0;
    if (appAvg > 0) items.push(['배민/쿠팡이츠', `${appAvg.toLocaleString()}만원`, '#FFFFFF']);
    if (agencyAvg > 0) items.push(['바로고/부릉', `${agencyAvg.toLocaleString()}만원`, '#7a7a7a']);
    if (appAvg > 0 && agencyAvg > 0) items.push(['둘 다 운영', `${(appAvg + agencyAvg).toLocaleString()}만원`, '#4C7BE4']);
    return items;
  })();

  return (
    <CardShell n="10" id="10"
      title="배달 객단가"
      sub="이 동네 배달 객단가"
      sources={["소상공인진흥공단 delivery", "배민/쿠팡이츠 핫플레이스", "KOSIS 외식업체경영실태조사"]}>
      <div className="bc-grid-4" style={{gap:16, marginBottom:16}}>
        <StatTile id="c10.tile1" tone="blue"  label="동 객단가 (배달)" value={searchAvgPrice > 0 ? searchAvgPrice.toLocaleString() : '-'} unit={searchAvgPrice > 0 ? '원' : ''} delta={yoyPct ? `${yoyPct > 0 ? '+' : ''}${yoyPct}` : undefined} deltaPositive={yoyPct >= 0} hero/>
        <StatTile id="c10.tile2" tone="mint"  label="월 배달 매출"   value={searchSales > 0 ? searchSales.toLocaleString() : '-'} unit={searchSales > 0 ? '만' : ''}/>
        <StatTile id="c10.tile3" tone="lilac" label="월 배달 건수"   value={searchOrders > 0 ? searchOrders.toLocaleString() : '-'} unit={searchOrders > 0 ? '건' : ''} delta={yoyPct ? `${yoyPct > 0 ? '+' : ''}${yoyPct}` : undefined} deltaPositive={yoyPct >= 0}/>
        <StatTile id="c10.tile4" tone="cream" label="업종 순위"      value={cafeRank > 0 ? `${cafeRank}위` : '-'} delta={totalBiz > 0 ? `/ ${totalBiz}개` : undefined}/>
      </div>

      <div style={{display:"grid", gridTemplateColumns:"1.4fr 1fr", gap:16, alignItems:"stretch"}}>
        <div className="bc-box" style={{padding:18, display:"flex", flexDirection:"column"}}>
          <div style={{display:"flex", justifyContent:"space-between", marginBottom:12}}>
            <div style={{fontSize:15, fontWeight:600}}>월별 배달 주문건수 ({monthlyValues.length}개월)</div>
            {yoyPct !== 0 && <span style={{fontSize:15, color: yoyPct >= 0 ? "#4C7BE4" : "var(--st-bad)", fontWeight:700}}>{yoyPct > 0 ? '+' : ''}{yoyPct}% (추세)</span>}
          </div>
          <div style={{flex:1, display:"flex", alignItems:"center", minHeight:180}}>
            {monthlyValues.length >= 2 ? (
              <LineChart id="c10.line" width={520} height={240} data={monthlyValues} color="#4C7BE4"/>
            ) : (
              <div style={{width:"100%", textAlign:"center", color:"var(--matte-fg-4)", fontSize:13}}>월별 추이 데이터 수집 중</div>
            )}
          </div>
          <div style={{marginTop:18, paddingTop:14, borderTop:"1px solid var(--matte-line)"}}>
            <div style={{fontSize:15, fontWeight:600, marginBottom:12}}>요일별 배달 주문</div>
            {dayItems.length > 0 ? (
              <VBars id="c10.days" accent={dayTopIdx >= 0 ? dayTopIdx : 0} height={80} barW={24} items={dayItems}/>
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
              <div style={{fontSize:13, color:"var(--matte-fg-4)", padding:"20px 0"}}>KOSIS 운영 비용 데이터 수집 중</div>
            )}
          </div>

          <div className="bc-box" style={{padding:18}}>
            <div style={{fontSize:15, fontWeight:600, marginBottom:10}}>전국 카페 배달 운영</div>
            {kdActiveRatio != null ? (
              <div style={{display:"flex", alignItems:"center", gap:16}}>
                <Donut id="c10.donut" size={180} thickness={20} segments={[
                  {value: kdActiveRatio, color:"#4C7BE4", label:"운영"},
                  {value: kdInactiveRatio, color:"#FFFFFF", label:"미운영"},
                ]} centerLabel={`${kdActiveRatio}%`} centerSub="배달 운영"/>
                <DonutLegend segments={[
                  {value: kdActiveRatio, color:"#4C7BE4", label:"운영", text:`${kdActiveRatio}%`},
                  {value: kdInactiveRatio, color:"#FFFFFF", label:"미운영", text:`${kdInactiveRatio}%`},
                ]}/>
              </div>
            ) : (
              <div style={{fontSize:13, color:"var(--matte-fg-4)", padding:"30px 0", textAlign:"center"}}>KOSIS 배달 운영 비중 수집 중</div>
            )}
          </div>
        </div>
      </div>
    </CardShell>
  );
}

/* ============================================================
   Card11 — SNS 트렌드
   ============================================================ */
function BCFloatingKeywordCloud({ keywords, height = 220 }) {
  const displayCount = Math.min(keywords.length, 20);
  const positions = [
    { x: 55, y: 25 }, { x: 160, y: 18 }, { x: 270, y: 28 }, { x: 100, y: 45 },
    { x: 215, y: 42 }, { x: 310, y: 50 }, { x: 35, y: 60 }, { x: 140, y: 65 },
    { x: 245, y: 62 }, { x: 70, y: 80 }, { x: 185, y: 82 }, { x: 290, y: 77 },
    { x: 120, y: 95 }, { x: 230, y: 98 }, { x: 40, y: 105 }, { x: 310, y: 100 },
    { x: 170, y: 115 }, { x: 80, y: 122 }, { x: 260, y: 118 }, { x: 150, y: 40 },
  ];
  const maxWeight = Math.max(...keywords.slice(0, displayCount).map(k => k.weight ?? 1), 1);
  const floatParams = useMemo(() => Array.from({ length: displayCount }, (_, i) => ({
    duration: 3 + (i % 7) * 0.6,
    delay: (i * 0.3) % 3,
  })), [displayCount]);
  if (keywords.length === 0) return null;
  return (
    <svg width="100%" height={height} viewBox="0 0 340 150" preserveAspectRatio="xMidYMid meet" style={{ overflow: 'visible', display: 'block' }}>
      <defs>
        <style>{`
          @keyframes hfWcFloat0 { 0%,100%{transform:translate(0,0)} 33%{transform:translate(1.5px,-2.5px)} 66%{transform:translate(-1px,2px)} }
          @keyframes hfWcFloat1 { 0%,100%{transform:translate(0,0)} 25%{transform:translate(-1.8px,2px)} 75%{transform:translate(1.2px,-2.8px)} }
          @keyframes hfWcFloat2 { 0%,100%{transform:translate(0,0)} 40%{transform:translate(2px,1.5px)} 80%{transform:translate(-1.5px,-2px)} }
          @keyframes hfWcFloat3 { 0%,100%{transform:translate(0,0)} 30%{transform:translate(-1px,-2.2px)} 60%{transform:translate(1.8px,1.8px)} }
          @keyframes hfWcFloat4 { 0%,100%{transform:translate(0,0)} 50%{transform:translate(1.2px,2.5px)} }
        `}</style>
      </defs>
      {keywords.slice(0, displayCount).map((kw, i) => {
        const pos = positions[i % positions.length];
        const sizeRatio = (kw.weight ?? (displayCount - i)) / maxWeight;
        const fontSize = 7 + sizeRatio * 11;
        const opacity = 0.45 + sizeRatio * 0.45;
        const color = sizeRatio >= 0.7 ? '#FFFFFF' : sizeRatio >= 0.4 ? '#C9C9C9' : '#A3A3A3';
        const fp = floatParams[i];
        const animName = `hfWcFloat${i % 5}`;
        return (
          <text key={i} x={pos.x} y={pos.y} textAnchor="middle"
            fill={color} fontSize={fontSize} fontWeight={sizeRatio > 0.6 ? 700 : 600}
            opacity={opacity} fontFamily="Pretendard, system-ui, sans-serif"
            style={{ animation: `${animName} ${fp.duration}s ease-in-out ${fp.delay}s infinite` }}
          >#{kw.text}</text>
        );
      })}
    </svg>
  );
}

function BCCard11({ body: bodyProp }) {
  const body = bodyProp && Object.keys(bodyProp).length > 0 ? bodyProp : bcBodyOf('11');
  const bodyData = body.bodyData || {};
  const chartData = body.chartData || {};

  const positivePct = Number(bodyData.positiveRatio) || Number(chartData.sentimentPos) || 0;
  const negativePct = Number(bodyData.negativeRatio) || (positivePct > 0 ? 100 - positivePct : 0);
  const blogMentions = Number(bodyData.blogMentions) || 0;

  const keywords = Array.isArray(bodyData.keywords) ? bodyData.keywords.slice(0, 12) : [];
  const wcItems = keywords.map((k, i) => ({
    text: k,
    size: Math.max(11, Math.round(28 - i * 1.5)),
  }));

  const intents = Array.isArray(bodyData.searchIntents) ? bodyData.searchIntents.slice(0, 7) : [];
  const negativeKw = Array.isArray(bodyData.negativeKeywords) ? bodyData.negativeKeywords.slice(0, 5) : [];

  const topShops = Array.isArray(bodyData.topShops) ? bodyData.topShops.slice(0, 5) : [];

  return (
    <CardShell n="11" id="11"
      title="SNS 트렌드"
      sub="소셜미디어 카페 분위기 분석"
      sources={["인스타그램 해시태그", "네이버 카페 후기", "Google Search"]}>
      <div className="bc-grid-4" style={{gap:16, marginBottom:16}}>
        <StatTile id="c11.tile1" tone="mint"  label="긍정 비율"      value={positivePct > 0 ? String(positivePct) : '-'} unit={positivePct > 0 ? '%' : ''} hero/>
        <StatTile id="c11.tile2" tone="rose"  label="부정 비율"      value={negativePct > 0 ? String(negativePct) : '-'} unit={negativePct > 0 ? '%' : ''} deltaPositive={false}/>
        <StatTile id="c11.tile3" tone="blue"  label="총 키워드"     value={String(keywords.length)}/>
        <StatTile id="c11.tile4" tone="cream" label="블로그 언급"   value={blogMentions > 0 ? blogMentions.toLocaleString() : '-'} unit={blogMentions > 0 ? '건' : ''}/>
      </div>

      <div style={{display:"grid", gridTemplateColumns:"1.3fr 1fr", gap:16}}>
        <div className="bc-box" style={{padding:18}}>
          <div style={{fontSize:15, fontWeight:600, marginBottom:12}}>SNS 키워드 클라우드</div>
          {wcItems.length > 0 ? (
            <BCFloatingKeywordCloud
              keywords={wcItems.map((kw, i) => ({ text: kw.text, weight: wcItems.length - i }))}
              height={220}
            />
          ) : (
            <div style={{fontSize:13, color:"var(--matte-fg-4)", padding:"30px 0"}}>SNS 키워드 데이터 수집 중</div>
          )}
          <div style={{marginTop:14, paddingTop:14, borderTop:"1px solid var(--matte-line)"}}>
            <div style={{fontSize:15, color:"var(--matte-fg-3)", marginBottom:8, fontWeight:600}}>검색 유입 경로</div>
            {intents.length > 0 ? (
              <div style={{display:"flex", flexWrap:"wrap", gap:6, marginBottom:12}}>
                {intents.map(k => <span key={k} className="bc-pill">{k}</span>)}
              </div>
            ) : (
              <div style={{fontSize:13, color:"var(--matte-fg-4)", marginBottom:12}}>검색 유입 데이터 수집 중</div>
            )}
            <div style={{fontSize:15, color:"var(--matte-fg-3)", marginBottom:8, fontWeight:600}}>주의 키워드</div>
            {negativeKw.length > 0 ? (
              <div style={{display:"flex", gap:6, flexWrap:"wrap"}}>
                {negativeKw.map(k => <span key={k} className="bc-pill">{k}</span>)}
              </div>
            ) : (
              <div style={{fontSize:13, color:"var(--matte-fg-4)"}}>부정 키워드 없음</div>
            )}
          </div>
        </div>

        <div className="bc-box" style={{padding:24}}>
          <div style={{fontSize:18, fontWeight:700, marginBottom:20}}>후기 좋은 매장 TOP {Math.min(5, topShops.length)}</div>
          {topShops.length > 0 ? (
            <DrStagger id="c11.top5" delay={100} style={{display:"flex", flexDirection:"column", gap:8}}>
              {topShops.map((s, i) => {
                const isAcc = i === 0;
                return (
                  <div key={i} style={{
                    padding:"14px 18px",
                    background: isAcc ? "rgba(84,120,201,0.10)" : "rgba(255,255,255,0.03)",
                    border: isAcc ? "1px solid rgba(84,120,201,0.45)" : "1px solid var(--matte-line)",
                    borderRadius:10,
                  }}>
                    <div style={{display:"flex", alignItems:"baseline", justifyContent:"space-between", gap:12, marginBottom:6}}>
                      <div style={{display:"flex", alignItems:"baseline", gap:10, minWidth:0}}>
                        <span style={{fontSize:13, color:"var(--matte-fg-4)", fontVariantNumeric:"tabular-nums", fontWeight:700, flexShrink:0}}>{String(i+1).padStart(2,"0")}</span>
                        <span style={{fontSize:17, fontWeight:700, letterSpacing:"-0.01em", color: isAcc ? "#4C7BE4" : "var(--matte-fg)", overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap"}}>{s.name}</span>
                      </div>
                      <span style={{fontSize:14, color: "var(--matte-fg-2)", fontWeight:700, flexShrink:0}}>{s.menu}</span>
                    </div>
                    {s.reason && <div style={{fontSize:13, color:"var(--matte-fg-3)", paddingLeft:30}}>{s.reason}</div>}
                  </div>
                );
              })}
            </DrStagger>
          ) : (
            <div style={{fontSize:13, color:"var(--matte-fg-4)", padding:"30px 0"}}>후기 좋은 매장 데이터 수집 중</div>
          )}
        </div>
      </div>
    </CardShell>
  );
}

/* ============================================================
   Card12 — 날씨 영향
   ============================================================ */
function BCCard12({ body: bodyProp }) {
  const body = bodyProp && Object.keys(bodyProp).length > 0 ? bodyProp : bcBodyOf('12');
  const bodyData = body.bodyData || {};
  const chartData = body.chartData || {};

  const yd = bodyData.yearlyDistribution || null;
  const sunnyDays = (() => {
    const it = chartData.items?.find(i => i.label === '맑음');
    return Number(it?.value) || 0;
  })();
  const cloudyDays = (() => {
    const it = chartData.items?.find(i => i.label === '흐림');
    return Number(it?.value) || 0;
  })();
  const rainDays = (() => {
    const it = chartData.items?.find(i => i.label === '비');
    return Number(it?.value) || 0;
  })();
  const snowDays = (() => {
    const it = chartData.items?.find(i => i.label === '눈');
    return Number(it?.value) || 0;
  })();

  const monthlyCal = Array.isArray(bodyData.monthlyCalendar) ? bodyData.monthlyCalendar : [];
  const months = monthlyCal.length === 12
    ? monthlyCal.map(m => `${m.month}월`)
    : ["1월","2월","3월","4월","5월","6월","7월","8월","9월","10월","11월","12월"];
  const days = monthlyCal.length === 12 ? monthlyCal.map(m => (m.rainDays || 0) + (m.snowDays || 0)) : new Array(12).fill(0);
  const temps = monthlyCal.length === 12 ? monthlyCal.map(m => Number(m.avgTemp) || 0) : new Array(12).fill(0);
  const tempMax = Math.max(...temps, 1);
  const tempMin = Math.min(...temps, 0);
  const tempRange = Math.max(1, tempMax - tempMin);

  const parsePct = (s) => {
    if (!s) return null;
    const m = String(s).match(/([+-]?\d+(?:\.\d+)?)/);
    return m ? parseFloat(m[1]) : null;
  };
  const sunnyEffect = parsePct(bodyData.sunnyEffect);
  const cloudyEffect = parsePct(bodyData.cloudyEffect);
  const rainyEffect = parsePct(bodyData.rainyEffect);
  const snowEffect = parsePct(bodyData.snowEffect);

  const seasonSales = [
    { name: '봄 (3~5월)', value: sunnyEffect != null ? `${sunnyEffect > 0 ? '+' : ''}${(sunnyEffect * 0.5).toFixed(0)}%` : '-', tag: '안정' },
    { name: '여름 (6~8월)', value: rainyEffect != null ? `${rainyEffect > 0 ? '+' : ''}${rainyEffect.toFixed(0)}%` : '-', tag: rainyEffect > 0 ? '성수기' : '비수기', acc: rainyEffect > 0 },
    { name: '가을 (9~11월)', value: sunnyEffect != null ? `${sunnyEffect > 0 ? '+' : ''}${(sunnyEffect * 0.4).toFixed(0)}%` : '-', tag: '안정' },
    { name: '겨울 (12~2월)', value: snowEffect != null ? `${snowEffect > 0 ? '+' : ''}${snowEffect.toFixed(0)}%` : '-', tag: '비수기' },
  ];

  return (
    <CardShell n="12" id="12"
      title="날씨 영향 분석"
      sub="연간 기상 분포와 매출 영향"
      sources={["기상청 종관기상관측 (Open-Meteo ERA5)", "소상공인진흥공단 자체 매출 매핑"]}>
      <div className="bc-grid-4" style={{gap:16, marginBottom:16}}>
        <StatTile id="c12.tile1" tone="cream" label="맑음" value={sunnyDays > 0 ? String(sunnyDays) : '-'} unit={sunnyDays > 0 ? '일/년' : ''} hero/>
        <StatTile id="c12.tile2" tone="lilac" label="흐림" value={cloudyDays > 0 ? String(cloudyDays) : '-'} unit={cloudyDays > 0 ? '일/년' : ''}/>
        <StatTile id="c12.tile3" tone="blue"  label="비"   value={rainDays > 0 ? String(rainDays) : '-'} unit={rainDays > 0 ? '일/년' : ''}/>
        <StatTile id="c12.tile4" tone="mint"  label="눈"   value={snowDays > 0 ? String(snowDays) : '-'} unit={snowDays > 0 ? '일/년' : ''}/>
      </div>

      <div style={{display:"grid", gridTemplateColumns:"1.4fr 1fr", gap:16, alignItems:"start"}}>
        <div className="bc-box" style={{padding:24}}>
          <div style={{display:"flex", justifyContent:"space-between", alignItems:"baseline", marginBottom:18}}>
            <span style={{fontSize:16, fontWeight:600}}>월별 비/눈 일수 + 평균 기온</span>
            {yd && yd.avgTemp != null && (
              <span style={{fontSize:13, color:"var(--matte-fg-3)"}}>연평균 <strong style={{color:"var(--matte-fg)", fontWeight:700, fontSize:15, marginLeft:4}}>{yd.avgTemp}°C</strong></span>
            )}
          </div>
          {monthlyCal.length === 12 ? (
            <>
              <DrStagger id="c12.cal" delay={50} style={{display:"grid", gridTemplateColumns:"repeat(12, 1fr)", gap:6, alignItems:"flex-end", height:220}}>
                {months.map((m, i) => {
                  const tH = Math.max(8, ((temps[i] - tempMin) / tempRange) * 180);
                  const isHotMax = temps[i] === tempMax && tempMax > 0;
                  const color = isHotMax ? "#4C7BE4" : "#FFFFFF";
                  return (
                    <div key={m} style={{display:"flex", flexDirection:"column", alignItems:"center", gap:6, height:"100%", justifyContent:"flex-end"}}>
                      <div style={{fontSize:13, fontWeight:600, color: isHotMax ? "#4C7BE4" : "var(--matte-fg-2)", fontVariantNumeric:"tabular-nums"}}>{days[i]}</div>
                      <div style={{width:"100%", height: tH, background: color, borderRadius:"4px 4px 0 0", opacity: isHotMax ? 1 : 0.85}}></div>
                    </div>
                  );
                })}
              </DrStagger>
              <div style={{display:"grid", gridTemplateColumns:"repeat(12, 1fr)", gap:6, marginTop:10}}>
                {months.map(m => <div key={m} style={{fontSize:13, textAlign:"center", color:"var(--matte-fg-3)"}}>{m}</div>)}
              </div>
            </>
          ) : (
            <div style={{height:220, display:"flex", alignItems:"center", justifyContent:"center", color:"var(--matte-fg-4)"}}>월별 기상 데이터 수집 중</div>
          )}

          <div style={{marginTop:24, paddingTop:20, borderTop:"1px solid var(--matte-line)"}}>
            <div style={{fontSize:14, color:"var(--matte-fg-3)", fontWeight:500, marginBottom:14}}>계절별 매출 변동 (추정)</div>
            <div style={{display:"grid", gridTemplateColumns:"repeat(4, 1fr)", gap:10}}>
              {seasonSales.map(s => (
                <div key={s.name} style={{padding:"16px 16px", background:"rgba(255,255,255,0.03)", borderRadius:10, border:"1px solid var(--matte-line)"}}>
                  <div style={{fontSize:13, color:"var(--matte-fg-3)", marginBottom:8, fontWeight:500}}>{s.name}</div>
                  <div style={{fontSize:24, fontWeight:700, fontVariantNumeric:"tabular-nums", color: s.acc ? "#4C7BE4" : "var(--matte-fg)", letterSpacing:"-0.01em"}}>{s.value}</div>
                  <div style={{fontSize:13, color:"var(--matte-fg-3)", marginTop:6}}>{s.tag}</div>
                </div>
              ))}
            </div>
          </div>

          <div style={{fontSize:13, color:"var(--matte-fg-4)", marginTop:14}}>막대 높이 = 평균 기온 · 상단 숫자 = 비/눈 일수</div>
        </div>

        <div>
          <div className="bc-box" style={{padding:22, marginBottom:12}}>
            <div style={{fontSize:16, fontWeight:600, marginBottom:16}}>날씨별 매출 영향</div>
            <div style={{display:"flex", flexDirection:"column", gap:12}}>
              {[
                ['맑음', sunnyEffect, '#FFFFFF'],
                ['비', rainyEffect, '#4C7BE4'],
                ['눈', snowEffect, '#FFFFFF'],
                ['흐림', cloudyEffect, '#FFFFFF'],
              ].map(([k, v, color]) => {
                const acc = v != null && v > 0;
                const valStr = v != null ? `${v > 0 ? '+' : ''}${v}%` : '-';
                const w = v != null ? Math.min(100, Math.max(20, 50 + v)) : 0;
                return (
                  <div key={k} style={{display:"grid", gridTemplateColumns:"60px 1fr 80px", gap:12, alignItems:"center"}}>
                    <span style={{fontSize:15, color:"var(--matte-fg-2)", fontWeight:500}}>{k}</span>
                    <div className="bc-bar" style={{height:12, background:"rgba(255,255,255,0.05)"}}>
                      <div style={{width:`${w}%`, background: acc ? "#4C7BE4" : color, height:"100%", borderRadius:"inherit"}}></div>
                    </div>
                    <span style={{textAlign:"right", fontSize:14, fontWeight:700, color: acc ? "#4C7BE4" : "var(--matte-fg)", fontVariantNumeric:"tabular-nums"}}>{valStr}</span>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="bc-box" style={{padding:20, marginBottom:12}}>
            <div style={{fontSize:14, color:"var(--matte-fg-3)", fontWeight:500, marginBottom:10}}>운영 인사이트</div>
            <div style={{fontSize:15, lineHeight:1.65, color:"var(--matte-fg-2)"}}>
              {bodyData.weatherSummary || (rainyEffect != null
                ? `비 오는 날 매출 ${rainyEffect > 0 ? '+' : ''}${rainyEffect}% ${rainyEffect > 0 ? '상승' : '하락'}.`
                : '운영 인사이트 데이터 수집 중')}
            </div>
          </div>

          <div className="bc-grid-2" style={{gap:10}}>
            <Box label="연평균 기온" value={yd?.avgTemp != null ? yd.avgTemp.toFixed(1) : '-'} unit={yd?.avgTemp != null ? '°C' : ''}/>
            <Box label="여름 최고"  value={yd?.summerMax != null ? yd.summerMax.toFixed(1) : '-'} unit={yd?.summerMax != null ? '°C' : ''}/>
            <Box label="겨울 최저"  value={yd?.winterMin != null ? yd.winterMin.toFixed(1) : '-'} unit={yd?.winterMin != null ? '°C' : ''}/>
            <Box label="강수일/연"  value={rainDays > 0 ? String(rainDays) : '-'} unit={rainDays > 0 ? '일' : ''} sub={yd?.relativePosition || ''}/>
          </div>
        </div>
      </div>
    </CardShell>
  );
}

/* ============================================================
   Card13 — 상권 경쟁 분석
   ============================================================ */
function BCCard13({ body: bodyProp }) {
  const body = bodyProp && Object.keys(bodyProp).length > 0 ? bodyProp : bcBodyOf('13');
  const total = Number(body.totalScore) || 0;
  const survival3y = Number(body.survival3y) || 0;
  const cafeSales = Number(body.cafeSales) || 0;
  const guAvg = Number(body.guAvg) || 0;
  const sigungu = body.sigungu || '';
  const cafeCount = Number(body.cafeCount) || 0;
  const individualCount = Number(body.individualCount) || 0;
  const avgRent = Number(body.avgRent) || 0;
  const premiumCost = body.premiumCost ? Math.round(Number(body.premiumCost) / 10000) : 0;
  const risingMenu = body.risingMenu || null;
  const popularMenuTop = body.popularMenuTop || null;
  const popularMenuCount = Number(body.popularMenuCount) || 0;
  const weatherLabel = body.weatherLabel || '';
  const weatherScore = Number(body.weatherScore) || 0;
  const externalIndicators = body.externalIndicators || null;

  const grade = total >= 80 ? "매우 좋음" : total >= 60 ? "좋음" : total >= 40 ? "보통" : total >= 20 ? "주의" : "낮음";

  const axes = [
    {
      key: "market",
      label: "시장 매력도",
      max: 20,
      score: Number(body.scoreMarket) || 0,
      headline: cafeSales > 0 && guAvg > 0
        ? `월매출 ${cafeSales.toLocaleString()}만 — ${sigungu || '시군구'} 평균 ${cafeSales > guAvg ? '+' : ''}${Math.round((cafeSales / guAvg - 1) * 100)}%`
        : cafeSales > 0 ? `월매출 ${cafeSales.toLocaleString()}만` : '시장 데이터 수집 중',
    },
    {
      key: "competition",
      label: "경쟁 환경",
      max: 20,
      score: Number(body.scoreCompete) || 0,
      headline: cafeCount > 0
        ? `카페 ${cafeCount}개 ${cafeCount > 80 ? '과밀' : cafeCount > 40 ? '보통' : '저밀도'}${individualCount > 0 ? ` — 개인 ${Math.round(individualCount/cafeCount*100)}% 차별화 여지` : ''}`
        : '경쟁 데이터 수집 중',
    },
    {
      key: "change",
      label: "시장 변화",
      max: 15,
      score: Number(body.scoreChange) || 0,
      headline: (() => {
        if (risingMenu?.name && risingMenu?.growthRate) {
          return `급상승 메뉴 ${risingMenu.name} +${Number(risingMenu.growthRate).toFixed(0)}%`;
        }
        if (popularMenuTop?.name) {
          const rate = Number(popularMenuTop.salesRate ?? popularMenuTop.rate);
          const rateTxt = isFinite(rate) && rate > 0 ? ` ${rate.toFixed(1)}%` : '';
          const diversity = popularMenuCount >= 5
            ? '메뉴 다양성 높음'
            : popularMenuCount >= 3
              ? '메뉴 다양성 보통'
              : '메뉴 다양성 낮음';
          return `인기 메뉴 ${popularMenuTop.name}${rateTxt} — ${diversity}`;
        }
        return '메뉴 트렌드 데이터 수집 중';
      })(),
    },
    {
      key: "survival",
      label: "생존 기반",
      max: 30,
      score: Number(body.scoreSurvival) || 0,
      headline: survival3y > 0
        ? `3년 생존율 ${survival3y}% — ${survival3y >= 60 ? '상위' : survival3y >= 40 ? '평균' : '주의'}`
        : '생존율 데이터 수집 중',
    },
    {
      key: "cost",
      label: "비용 부담",
      max: 15,
      score: Number(body.scoreCost) || 0,
      headline: avgRent > 0
        ? `평당 월세 ${avgRent.toLocaleString()}만원${premiumCost > 0 ? ` · 권리금 ${(premiumCost/10000).toFixed(1)}억` : ''}`
        : '임대료 데이터 수집 중',
    },
  ];

  const strengths = axes.filter(a => a.score / a.max >= 0.6).sort((a, b) => (b.score/b.max) - (a.score/a.max));
  const weaknesses = axes.filter(a => a.score / a.max < 0.6).sort((a, b) => (a.score/a.max) - (b.score/b.max));
  const maxRatio = axes.reduce((m, a) => Math.max(m, a.score/a.max), 0);

  const headline = (() => {
    if (total === 0) return '데이터 수집 중';
    const strongest = strengths[0];
    const weakest = weaknesses[weaknesses.length - 1];
    if (strongest && weakest) {
      return `${strongest.label}는 강하지만 ${weakest.label}이 ${grade === '좋음' || grade === '매우 좋음' ? '함께 큰' : '부담인'} 자리.`;
    }
    return `${grade} 등급 상권.`;
  })();

  const externalCards = (() => {
    const items = [];
    if (weatherLabel) items.push(['창업 기상도', weatherLabel]);
    else if (weatherScore > 0) items.push(['창업 기상도', `${weatherScore}점`]);

    const mm = externalIndicators?.marketMapScores || [];
    mm.slice(0, 5).forEach(s => {
      if (s.name && s.score > 0) {
        const label = s.score >= 80 ? 'A' : s.score >= 70 ? 'A-' : s.score >= 60 ? 'B+' : s.score >= 50 ? 'B' : 'C';
        items.push([s.name.length > 10 ? s.name.slice(0, 10) : s.name, label]);
      }
    });

    if (items.length < 6 && externalIndicators?.salesIndexSource) {
      items.push(['매출지수', externalIndicators.salesIndexSource]);
    }
    return items.slice(0, 6);
  })();

  return (
    <CardShell n="13" id="13"
      title="상권 경쟁 분석"
      sub="5축 분해 종합 평가 (만점 100)"
      sources={["빈크래프트 5축 점수 모델", "한국부동산원 (KOSIS 408)", "국세청 (KOSIS 133)", "소상공인 창업기상도"]}>

      <div style={{display:"grid", gridTemplateColumns:"320px 1fr", gap:32, alignItems:"center", marginBottom:24, padding:"8px 8px 16px"}}>
        <div style={{display:"flex", justifyContent:"center"}}>
          <ScoreGauge id="c13.gauge" value={total} max={100} size={300} label={grade} accent/>
        </div>
        <div>
          <div style={{fontSize:13, color:"var(--matte-fg-3)", fontWeight:600, letterSpacing:"0.10em", textTransform:"uppercase", marginBottom:14}}>한 줄 요약</div>
          <div style={{fontSize:30, fontWeight:700, lineHeight:1.35, color:"#fff", letterSpacing:"-0.015em", marginBottom:28}}>
            {headline}<br/>
            종합 등급은 <span style={{color:"#4C7BE4"}}>{grade}</span>입니다.
          </div>
          <div style={{display:"grid", gridTemplateColumns:"repeat(3, 1fr)", gap:14}}>
            {[
              ["3년 생존", survival3y > 0 ? String(survival3y) : '-', survival3y > 0 ? "%" : "", survival3y > 0 ? `${survival3y > 39 ? '+' : ''}${(survival3y - 39).toFixed(1)}%p (전국)` : '', survival3y >= 60],
              ["월매출", cafeSales > 0 ? cafeSales.toLocaleString() : '-', cafeSales > 0 ? "만" : "", cafeSales > 0 && guAvg > 0 ? `${sigungu || '시군구'} 평균 대비 ${cafeSales > guAvg ? '+' : ''}${Math.round((cafeSales/guAvg-1)*100)}%` : '', false],
              ["창업 기상도", weatherLabel || (weatherScore > 0 ? String(weatherScore) : '-'), "", weatherScore > 0 ? `${weatherScore}/100` : '', weatherScore >= 60],
            ].map(([l, v, u, sub, acc]) => (
              <div key={l} style={{padding:"20px 22px", background:"rgba(255,255,255,0.03)", borderRadius:12, border:"1px solid var(--matte-line)"}}>
                <div style={{fontSize:14, color:"var(--matte-fg-3)", marginBottom:10, fontWeight:500}}>{l}</div>
                <div style={{fontSize:32, fontWeight:700, fontVariantNumeric:"tabular-nums", letterSpacing:"-0.02em", lineHeight:1}}>{v}{u && <span style={{fontSize:14, color:"var(--matte-fg-3)", marginLeft:4, fontWeight:500}}>{u}</span>}</div>
                {sub && <div style={{fontSize:13, color: acc ? "#4C7BE4" : "var(--matte-fg-3)", marginTop:8, fontWeight:600}}>{sub}</div>}
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="bc-box" style={{padding:32}}>
        <div style={{display:"flex", justifyContent:"space-between", alignItems:"baseline", marginBottom:24}}>
          <div style={{fontSize:20, fontWeight:700, letterSpacing:"-0.01em"}}>5축 분해</div>
          <div style={{fontSize:14, color:"var(--matte-fg-3)"}}>각 축 점수 합 = 종합 <strong style={{color:"var(--matte-fg)", fontSize:17, marginLeft:4}}>{total}</strong>점</div>
        </div>

        <DrStagger id="c13.axes" delay={140} style={{display:"flex", flexDirection:"column"}}>
        {axes.map((a, idx) => {
          const pct = a.max > 0 ? a.score / a.max : 0;
          const isMax = a.max > 0 && pct === maxRatio && maxRatio > 0;
          const barColor = isMax ? "#4C7BE4" : "#FFFFFF";
          return (
            <div key={a.key} style={{padding:"20px 0", borderTop: idx > 0 ? "1px solid var(--matte-line)" : "none"}}>
              <div style={{display:"grid", gridTemplateColumns:"180px 1fr 130px", gap:20, alignItems:"center"}}>
                <div>
                  <div style={{fontSize:17, fontWeight:700, color: isMax ? "#4C7BE4" : "#fff", letterSpacing:"-0.01em", marginBottom:4}}>{a.label}</div>
                  <div style={{fontSize:13, color:"var(--matte-fg-3)", fontVariantNumeric:"tabular-nums"}}>만점 {a.max}점</div>
                </div>
                <div>
                  <div className="bc-bar" style={{height:14, background:"rgba(255,255,255,0.05)", marginBottom:10}}>
                    <div style={{width:`${pct*100}%`, background:barColor, height:"100%", borderRadius:"inherit", transition:"width 0.9s var(--ease)"}}></div>
                  </div>
                  <div style={{fontSize:14, color:"var(--matte-fg-2)", lineHeight:1.5}}>{a.headline}</div>
                </div>
                <div style={{textAlign:"right"}}>
                  <div style={{fontSize:36, fontWeight:700, color: isMax ? "#4C7BE4" : "var(--matte-fg)", fontVariantNumeric:"tabular-nums", letterSpacing:"-0.02em", lineHeight:1}}>{a.score}</div>
                  <div style={{fontSize:13, color:"var(--matte-fg-3)", marginTop:8}}>비율 <strong style={{color:"var(--matte-fg-2)", fontWeight:700}}>{Math.round(pct*100)}%</strong></div>
                </div>
              </div>
            </div>
          );
        })}
        </DrStagger>
      </div>

      <div style={{display:"grid", gridTemplateColumns:"1fr 1fr", gap:16, marginTop:16}}>
        <div className="bc-box" style={{padding:28, border:"1px solid rgba(84,120,201,0.35)", background:"linear-gradient(180deg, rgba(84,120,201,0.06), transparent 70%)"}}>
          <div style={{display:"flex", alignItems:"baseline", justifyContent:"space-between", marginBottom:18}}>
            <div style={{fontSize:18, fontWeight:700, color:"#4C7BE4", letterSpacing:"-0.01em"}}>강점</div>
            <div style={{fontSize:14, color:"var(--matte-fg-3)", fontWeight:600}}>{strengths.length}개 축</div>
          </div>
          {strengths.length > 0 ? (
            <div style={{display:"flex", flexDirection:"column", gap:12}}>
              {strengths.map(a => (
                <div key={a.key} style={{padding:"16px 20px", background:"rgba(255,255,255,0.03)", borderRadius:10, border:"1px solid var(--matte-line)"}}>
                  <div style={{display:"flex", justifyContent:"space-between", alignItems:"baseline", marginBottom:8}}>
                    <span style={{fontSize:16, fontWeight:700, color:"#fff", letterSpacing:"-0.005em"}}>{a.label}</span>
                    <span style={{fontSize:18, fontWeight:700, fontVariantNumeric:"tabular-nums", color:"#4C7BE4", letterSpacing:"-0.01em"}}>{a.score}<span style={{fontSize:13, color:"var(--matte-fg-3)", marginLeft:3, fontWeight:500}}>/{a.max}</span></span>
                  </div>
                  <div style={{fontSize:14, color:"var(--matte-fg-2)", lineHeight:1.5}}>{a.headline}</div>
                </div>
              ))}
            </div>
          ) : (
            <div style={{fontSize:13, color:"var(--matte-fg-4)", padding:"20px 0"}}>강점 축 없음</div>
          )}
        </div>

        <div className="bc-box" style={{padding:28}}>
          <div style={{display:"flex", alignItems:"baseline", justifyContent:"space-between", marginBottom:18}}>
            <div style={{fontSize:18, fontWeight:700, letterSpacing:"-0.01em"}}>약점</div>
            <div style={{fontSize:14, color:"var(--matte-fg-3)", fontWeight:600}}>{weaknesses.length}개 축</div>
          </div>
          {weaknesses.length > 0 ? (
            <div style={{display:"flex", flexDirection:"column", gap:12}}>
              {weaknesses.map(a => (
                <div key={a.key} style={{padding:"16px 20px", background:"rgba(255,255,255,0.03)", borderRadius:10, border:"1px solid var(--matte-line)"}}>
                  <div style={{display:"flex", justifyContent:"space-between", alignItems:"baseline", marginBottom:8}}>
                    <span style={{fontSize:16, fontWeight:700, color:"#fff", letterSpacing:"-0.005em"}}>{a.label}</span>
                    <span style={{fontSize:18, fontWeight:700, fontVariantNumeric:"tabular-nums", color:"var(--matte-fg)", letterSpacing:"-0.01em"}}>{a.score}<span style={{fontSize:13, color:"var(--matte-fg-3)", marginLeft:3, fontWeight:500}}>/{a.max}</span></span>
                  </div>
                  <div style={{fontSize:14, color:"var(--matte-fg-2)", lineHeight:1.5}}>{a.headline}</div>
                </div>
              ))}
            </div>
          ) : (
            <div style={{fontSize:13, color:"var(--matte-fg-4)", padding:"20px 0"}}>약점 축 없음</div>
          )}
        </div>
      </div>

      {externalCards.length > 0 && (
        <div className="bc-box" style={{padding:"24px 32px", marginTop:16, display:"flex", justifyContent:"space-between", flexWrap:"wrap", gap:24, alignItems:"center"}}>
          <div style={{fontSize:13, color:"var(--matte-fg-3)", fontWeight:700, letterSpacing:"0.08em", textTransform:"uppercase"}}>외부 지표</div>
          {externalCards.map(([l, v], i) => (
            <div key={i} style={{display:"flex", flexDirection:"column", alignItems:"flex-start", gap:4}}>
              <div style={{fontSize:13, color:"var(--matte-fg-3)", fontWeight:500}}>{l}</div>
              <div style={{fontSize:18, color:"var(--matte-fg)", fontWeight:700, fontVariantNumeric:"tabular-nums", letterSpacing:"-0.005em"}}>{v}</div>
            </div>
          ))}
        </div>
      )}
    </CardShell>
  );
}

/* ============================================================
   Card14 — AI 종합 분석
   ============================================================ */
function BCCard14({ body: bodyProp, onOpenDirector }) {
  const body = bodyProp && Object.keys(bodyProp).length > 0 ? bodyProp : bcBodyOf('14');
  const total = Number(body.totalScore) || 0;
  const opportunities = Number(body.opportunities) || 0;
  const risks = Number(body.risks) || 0;
  const recommendation = body.recommendation || (total >= 80 ? '매우 좋음' : total >= 60 ? '좋음' : total >= 40 ? '보통' : '주의');
  const grade = total >= 80 ? 'A' : total >= 70 ? 'A-' : total >= 60 ? 'B+' : total >= 50 ? 'B' : total >= 40 ? 'C+' : 'C';

  const axes = Array.isArray(body.axes) ? body.axes : [];
  const radarLabels = axes.length > 0 ? axes.map(a => ({ label: a.label, max: a.max })) : [];
  const radarValues = axes.length > 0 ? axes.map(a => Number(a.score) || 0) : [];

  const allSignals = Array.isArray(body.signals) ? body.signals : [];
  const positiveSignals = allSignals.filter(s => s.type === 'positive');
  const negativeSignals = allSignals.filter(s => s.type === 'negative');

  const tags = Array.isArray(body.tags) ? body.tags : [];

  const trustScore = (() => {
    let score = 50;
    if (axes.length === 5 && axes.every(a => a.score > 0)) score += 30;
    if (allSignals.length >= 5) score += 10;
    if (tags.length >= 8) score += 10;
    return Math.min(100, score);
  })();

  return (
    <CardShell n="14" id="14"
      title="AI 종합 분석"
      sub="AI 에이전트 종합 피드백"
      sources={["7개 AI 에이전트 종합", "위 13개 카드 데이터 통합"]}
      headerRight={
        <button onClick={onOpenDirector} className="bc-btn" style={{height:32, padding:"0 14px", fontSize:15}}>
          <i className="ph ph-sparkle"></i> AI 디렉터
        </button>
      }>

      <div style={{display:"grid", gridTemplateColumns:"260px 1fr", gap:24, marginBottom:18}}>
        <div className="bc-tile tone-blue accent" style={{padding:28, minHeight:180, display:"flex", flexDirection:"column", justifyContent:"space-between"}}>
          <div>
            <div className="label" style={{fontSize:15}}>종합 점수</div>
            <div style={{display:"flex", alignItems:"baseline", gap:8, marginTop:10}}>
              <span style={{fontSize:80, fontWeight:700, letterSpacing:"-0.03em", lineHeight:1, fontVariantNumeric:"tabular-nums", color:"#4C7BE4"}}><CountUp id="c14.score" value={String(total)}/></span>
              <span style={{fontSize:18, color:"var(--matte-fg-3)", fontWeight:500}}>/ 100점</span>
            </div>
          </div>
          <div style={{display:"flex", justifyContent:"space-between", alignItems:"center", paddingTop:14, borderTop:"1px solid var(--matte-line)"}}>
            <span style={{fontSize:15, color:"var(--matte-fg-3)"}}>등급 · {recommendation}</span>
            <span style={{fontSize:20, fontWeight:700, letterSpacing:"-0.01em", color:"#fff"}}>{grade}</span>
          </div>
        </div>

        <div className="bc-grid-3" style={{gap:12}}>
          <StatTile id="c14.kpi1" tone="mint"  label="기회"    value={String(opportunities)} unit="건" hero/>
          <StatTile id="c14.kpi2" tone="rose"  label="리스크"  value={String(risks)} unit="건" deltaPositive={false} hero/>
          <StatTile id="c14.kpi3" tone="cream" label="신뢰 점수" value={String(trustScore)} unit="/100"/>
        </div>
      </div>

      <div style={{display:"grid", gridTemplateColumns:"1fr 1fr", gap:24}}>
        <div className="bc-box" style={{padding:18, display:"flex", flexDirection:"column", alignItems:"center"}}>
          <div style={{alignSelf:"stretch", fontSize:15, fontWeight:600, marginBottom:8}}>5축 분포</div>
          {radarLabels.length === 5 && radarValues.some(v => v > 0) ? (
            <Radar id="c14.radar" size={340} accent axes={radarLabels} values={radarValues}/>
          ) : (
            <div style={{padding:"60px 0", color:"var(--matte-fg-4)", fontSize:13}}>5축 점수 데이터 수집 중</div>
          )}
        </div>

        <div>
          <div className="bc-box" style={{padding:16, marginBottom:12}}>
            <div style={{fontSize:15, color:"var(--matte-fg)", fontWeight:700, marginBottom:10, letterSpacing:"0.04em"}}>긍정 시그널 ({positiveSignals.length})</div>
            {positiveSignals.length > 0 ? (
              <DrStagger id="c14.signal.pos" delay={80} style={{display:"flex", flexDirection:"column", gap:10}}>
                {positiveSignals.map((s, i) => (
                  <div key={i} style={{display:"grid", gridTemplateColumns:"22px 1fr", gap:6, fontSize:14, color:"var(--matte-fg-2)", lineHeight:1.5}}>
                    <span style={{fontSize:13, color:"var(--matte-fg-4)", fontVariantNumeric:"tabular-nums", fontWeight:600}}>{String(i+1).padStart(2,"0")}</span>
                    <span>{s.text}</span>
                  </div>
                ))}
              </DrStagger>
            ) : (
              <div style={{fontSize:13, color:"var(--matte-fg-4)"}}>긍정 시그널 추출 중</div>
            )}
          </div>
          <div className="bc-box" style={{padding:16}}>
            <div style={{fontSize:15, color:"var(--matte-fg-2)", fontWeight:700, marginBottom:10, letterSpacing:"0.04em"}}>부정 시그널 ({negativeSignals.length})</div>
            {negativeSignals.length > 0 ? (
              <DrStagger id="c14.signal.neg" delay={100} style={{display:"flex", flexDirection:"column", gap:10}}>
                {negativeSignals.map((s, i) => (
                  <div key={i} style={{display:"grid", gridTemplateColumns:"22px 1fr", gap:6, fontSize:14, color:"var(--matte-fg-2)", lineHeight:1.5}}>
                    <span style={{fontSize:13, color:"var(--matte-fg-4)", fontVariantNumeric:"tabular-nums", fontWeight:600}}>{String(i+1).padStart(2,"0")}</span>
                    <span>{s.text}</span>
                  </div>
                ))}
              </DrStagger>
            ) : (
              <div style={{fontSize:13, color:"var(--matte-fg-4)"}}>부정 시그널 없음</div>
            )}
          </div>
        </div>
      </div>

      <div className="bc-box" style={{padding:16, marginTop:16}}>
        <div style={{fontSize:15, color:"var(--matte-fg-3)", fontWeight:600, marginBottom:10, letterSpacing:"0.04em"}}>외부 신호 (분석에 사용된 핵심 수치)</div>
        {tags.length > 0 ? (
          <div style={{display:"flex", flexWrap:"wrap", gap:6}}>
            {tags.map((t, i) => <span key={i} className="bc-pill">#{t}</span>)}
          </div>
        ) : (
          <div style={{fontSize:13, color:"var(--matte-fg-4)"}}>태그 데이터 추출 중</div>
        )}
      </div>

      <button onClick={onOpenDirector} className="bc-btn bc-btn--lg" style={{marginTop:20, width:"100%", justifyContent:"center"}}>
        <i className="ph-fill ph-sparkle"></i>
        AI 디렉터
      </button>
    </CardShell>
  );
}

/* ============================================================
   덮어쓰기 등록
   시안 cards-a/b/c.jsx가 먼저 로드된 후 이 파일이 마지막에 로드되어야 한다.
   - 시안의 Card05↔Card06 스왑은 이미 cards-a.jsx에서 처리되었으므로
     우리는 단순히 Card01~14 = 우리 카드(BCCard01~BCCard14)로 덮어쓴다.
   ============================================================ */
Object.assign(window, {
  Card01: BCCard01,
  Card02: BCCard02,
  Card03: BCCard03,
  Card04: BCCard04,
  Card05: BCCard05,
  Card06: BCCard06,
  Card07: BCCard07,
  Card08: BCCard08,
  Card09: BCCard09,
  Card10: BCCard10,
  Card11: BCCard11,
  Card12: BCCard12,
  Card13: BCCard13,
  Card14: BCCard14,
});

/* 데이터 갱신 이벤트 발신 시 강제 재렌더 */
window.addEventListener('bc-data-updated', () => {
  if (window.__bcRender) {
    try { window.__bcRender(); } catch (e) {}
  }
});
