/* cards-c.jsx — Card 13 (5-axis decomposition) + Card 14 (radar + signals)
   PRD says these two are most precise. */

/* ============================================================
   Card 13 — 상권 경쟁 분석 (재설계: 한 시점 + 5축 + 강점/약점)
   ============================================================ */
function Card13({ body = {} }) {
  const total = Number(body.totalScore) || 53;
  const grade = total >= 70 ? "강한 추천" : total >= 50 ? "신중 검토" : "재고 권장";
  const survival3y = Number(body.survival3y) || 71;
  const cafeSales = Number(body.cafeSales) || 9121;
  const guAvg = Number(body.guAvg) || 0;
  const sigungu = body.sigungu || "";
  const cafeCount = Number(body.cafeCount) || 126;
  const individualCount = Number(body.individualCount) || 71;
  const avgRent = Number(body.avgRent) || 42;
  const premiumCost = body.premiumCost ? Math.round(Number(body.premiumCost) / 10000) : 18000;
  const risingMenu = body.risingMenu || null;
  const popularMenuTop = body.popularMenuTop || null;
  const popularMenuCount = Number(body.popularMenuCount) || 0;

  const axes = [
    { key: "market",      label: "시장 매력도", max: 20, score: Number(body.scoreMarket) || 13.4,
      headline: cafeSales > 0 && guAvg > 0
        ? `월매출 ${cafeSales.toLocaleString()}만 — ${sigungu || '시군구'} 평균 ${cafeSales > guAvg ? '+' : ''}${Math.round((cafeSales / guAvg - 1) * 100)}%`
        : `월매출 ${cafeSales.toLocaleString()}만 — 강남구 평균 +16%` },
    { key: "competition", label: "경쟁 환경",   max: 20, score: Number(body.scoreCompete) || 9.2,
      headline: cafeCount > 0
        ? `카페 ${cafeCount}개 ${cafeCount > 80 ? '과밀' : cafeCount > 40 ? '보통' : '저밀도'} — 개인 ${Math.round(individualCount/cafeCount*100)}% 차별화 여지`
        : "카페 126개 과밀 — 개인 56% 차별화 여지" },
    { key: "change",      label: "시장 변화",   max: 15, score: Number(body.scoreChange) || 9.8,
      headline: (() => {
        if (risingMenu?.name && risingMenu?.growthRate) return `급상승 메뉴 ${risingMenu.name} +${Number(risingMenu.growthRate).toFixed(0)}%`;
        if (popularMenuTop?.name) {
          const rate = Number(popularMenuTop.salesRate ?? popularMenuTop.rate);
          const rateTxt = isFinite(rate) && rate > 0 ? ` ${rate.toFixed(1)}%` : "";
          const diversity = popularMenuCount >= 5 ? "메뉴 다양성 높음" : popularMenuCount >= 3 ? "메뉴 다양성 보통" : "메뉴 다양성 낮음";
          return `인기 메뉴 ${popularMenuTop.name}${rateTxt} — ${diversity}`;
        }
        return "3년 성장 +18% — 크림라떼 +28%";
      })() },
    { key: "survival",    label: "생존 기반",   max: 30, score: Number(body.scoreSurvival) || 18.4,
      headline: survival3y > 0 ? `3년 생존율 ${survival3y}% — ${survival3y >= 60 ? '상위' : survival3y >= 40 ? '평균' : '주의'}` : "1년 89% · 3년 71% — 상위 12%" },
    { key: "cost",        label: "비용 부담",   max: 15, score: Number(body.scoreCost) || 2.2,
      headline: avgRent > 0 ? `평당 월세 ${avgRent.toLocaleString()}만원${premiumCost > 0 ? ` · 권리금 ${(premiumCost/10000).toFixed(1)}억` : ''}` : "권리금 1.8억 — 시도 평균 +114%" },
  ];

  const strengths = axes.filter(a => a.score / a.max >= 0.6).sort((a, b) => (b.score/b.max) - (a.score/a.max));
  const weaknesses = axes.filter(a => a.score / a.max < 0.6).sort((a, b) => (a.score/a.max) - (b.score/b.max));
  const maxRatio = axes.reduce((m, a) => Math.max(m, a.score/a.max), 0);

  return (
    <CardShell n="13" id="13"
      title="상권 경쟁 분석"
      sub="5축 분해 종합 평가 (만점 100)"
      sources={["소상공인진흥공단 창업 기상도", "한국부동산원 (KOSIS 408)", "국세청 (KOSIS 133)", "자체 분석 모델"]}>

      {/* HERO — 점수 게이지 + 한 줄 요약 + 핵심 3-KPI */}
      <div style={{display:"grid", gridTemplateColumns:"320px 1fr", gap:32, alignItems:"center", marginBottom:24, padding:"8px 8px 16px"}}>
        <div style={{display:"flex", justifyContent:"center"}}>
          <ScoreGauge id="c13.gauge" value={total} max={100} size={300} label={grade} accent/>
        </div>
        <div>
          <div style={{fontSize:13, color:"var(--matte-fg-3)", fontWeight:600, letterSpacing:"0.10em", textTransform:"uppercase", marginBottom:14}}>한 줄 요약</div>
          <div style={{fontSize:30, fontWeight:700, lineHeight:1.35, color:"#fff", letterSpacing:"-0.015em", marginBottom:28}}>
            시장은 강하지만 <span style={{color:"#4C7BE4"}}>비용 부담</span>이 큰 자리.<br/>
            자본 여력이 있다면 <span style={{color:"#4C7BE4"}}>강한 추천</span> 등급.
          </div>
          <div style={{display:"grid", gridTemplateColumns:"repeat(3, 1fr)", gap:14}}>
            {[
              ["3년 생존", String(survival3y), "%", `${survival3y > 39 ? '+' : ''}${(survival3y - 39).toFixed(1)}%p (전국)`, survival3y >= 60],
              ["매출 순위", cafeSales > 0 ? cafeSales.toLocaleString() : "상위 12", cafeSales > 0 ? "만" : "%", cafeSales > 0 && guAvg > 0 ? `${sigungu || '시군구'} 평균 대비 ${cafeSales > guAvg ? '+' : ''}${Math.round((cafeSales/guAvg-1)*100)}%` : "전국 카페", false],
              ["창업 기상도", body.weatherLabel || (Number(body.weatherScore) > 0 ? String(body.weatherScore) : "4"), Number(body.weatherScore) > 0 ? "/100" : "/ 5", body.weatherLabel || "맑음", Number(body.weatherScore) >= 60 || !body.weatherScore],
            ].map(([l, v, u, sub, acc]) => (
              <div key={l} style={{padding:"20px 22px", background:"rgba(255,255,255,0.03)", borderRadius:12, border:"1px solid var(--matte-line)"}}>
                <div style={{fontSize:14, color:"var(--matte-fg-3)", marginBottom:10, fontWeight:500}}>{l}</div>
                <div style={{fontSize:32, fontWeight:700, fontVariantNumeric:"tabular-nums", letterSpacing:"-0.02em", lineHeight:1}}>{v}<span style={{fontSize:14, color:"var(--matte-fg-3)", marginLeft:4, fontWeight:500}}>{u}</span></div>
                <div style={{fontSize:13, color: acc ? "#4C7BE4" : "var(--matte-fg-3)", marginTop:8, fontWeight:600}}>{sub}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* 5축 분해 — 깔끔한 가로 막대 + 헤드라인 (디테일 박스 제거) */}
      <div className="bc-box" style={{padding:32}}>
        <div style={{display:"flex", justifyContent:"space-between", alignItems:"baseline", marginBottom:24}}>
          <div style={{fontSize:20, fontWeight:700, letterSpacing:"-0.01em"}}>5축 분해</div>
          <div style={{fontSize:14, color:"var(--matte-fg-3)"}}>각 축 점수 합 = 종합 <strong style={{color:"var(--matte-fg)", fontSize:17, marginLeft:4}}>{total}</strong>점</div>
        </div>

        <window.DrStagger id="c13.axes" delay={140} style={{display:"flex", flexDirection:"column"}}>
        {axes.map((a, idx) => {
          const pct = a.score / a.max;
          const isMax = pct === maxRatio;
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
        </window.DrStagger>
      </div>

      {/* 강점 / 약점 — 자동 분류 */}
      <div style={{display:"grid", gridTemplateColumns:"1fr 1fr", gap:16, marginTop:16}}>
        <div className="bc-box" style={{padding:28, border:"1px solid rgba(76, 123, 228,0.35)", background:"linear-gradient(180deg, rgba(76, 123, 228,0.06), transparent 70%)", display:"flex", flexDirection:"column"}}>
          <div style={{display:"flex", alignItems:"baseline", justifyContent:"space-between", marginBottom:18}}>
            <div style={{fontSize:18, fontWeight:700, color:"#4C7BE4", letterSpacing:"-0.01em"}}>강점</div>
            <div style={{fontSize:14, color:"var(--matte-fg-3)", fontWeight:600}}>{strengths.length}개 축</div>
          </div>
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

          <div style={{marginTop:"auto", paddingTop:20}}>
            <div style={{padding:"18px 20px", background:"rgba(76, 123, 228,0.05)", borderRadius:10, border:"1px dashed rgba(76, 123, 228,0.30)"}}>
              <div style={{fontSize:12, color:"#4C7BE4", fontWeight:700, letterSpacing:"0.10em", textTransform:"uppercase", marginBottom:12}}>강점 활용 포인트</div>
              <div style={{display:"flex", flexDirection:"column", gap:10}}>
                {[
                  ["프리미엄 포지셔닝", "객단가 24,800원 — 강남 평균 +12%"],
                  ["성장 메뉴 선점", "크림라떼·디카페인 트렌드 매장 도입"],
                  ["충성 고객 확보", "3년 생존 71% — 재방문 38% 기반"],
                ].map(([k, v], i) => (
                  <div key={i} style={{display:"grid", gridTemplateColumns:"22px 1fr", gap:8, alignItems:"baseline"}}>
                    <span style={{fontSize:13, color:"#4C7BE4", fontVariantNumeric:"tabular-nums", fontWeight:700}}>{String(i+1).padStart(2,"0")}</span>
                    <div>
                      <div style={{fontSize:14, color:"var(--matte-fg)", fontWeight:700, marginBottom:2}}>{k}</div>
                      <div style={{fontSize:13, color:"var(--matte-fg-3)", lineHeight:1.5}}>{v}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        <div className="bc-box" style={{padding:28, display:"flex", flexDirection:"column"}}>
          <div style={{display:"flex", alignItems:"baseline", justifyContent:"space-between", marginBottom:18}}>
            <div style={{fontSize:18, fontWeight:700, letterSpacing:"-0.01em"}}>약점</div>
            <div style={{fontSize:14, color:"var(--matte-fg-3)", fontWeight:600}}>{weaknesses.length}개 축</div>
          </div>
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

          <div style={{marginTop:"auto", paddingTop:20}}>
            <div style={{padding:"18px 20px", background:"rgba(255,255,255,0.02)", borderRadius:10, border:"1px dashed rgba(255,255,255,0.12)"}}>
              <div style={{fontSize:12, color:"var(--matte-fg-3)", fontWeight:700, letterSpacing:"0.10em", textTransform:"uppercase", marginBottom:12}}>권장 대응 전략</div>
              <div style={{display:"flex", flexDirection:"column", gap:10}}>
                {[
                  ["권리금 절감", "이면 1블록 이동 시 -40% (1.1억 → 6,600만)"],
                  ["과밀 경쟁", "시그니처 메뉴 확보 — 크림라떼·디카페인 +28% 상승"],
                  ["수익 안정화", "배달 채널 30% 비중 확보로 폭염·우천 변동 완충"],
                ].map(([k, v], i) => (
                  <div key={i} style={{display:"grid", gridTemplateColumns:"22px 1fr", gap:8, alignItems:"baseline"}}>
                    <span style={{fontSize:13, color:"#4C7BE4", fontVariantNumeric:"tabular-nums", fontWeight:700}}>{String(i+1).padStart(2,"0")}</span>
                    <div>
                      <div style={{fontSize:14, color:"var(--matte-fg)", fontWeight:700, marginBottom:2}}>{k}</div>
                      <div style={{fontSize:13, color:"var(--matte-fg-3)", lineHeight:1.5}}>{v}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* 외부 지표 — 한 줄 인라인 요약 */}
      <div className="bc-box" style={{padding:"24px 32px", marginTop:16, display:"flex", justifyContent:"space-between", flexWrap:"wrap", gap:24, alignItems:"center"}}>
        <div style={{fontSize:13, color:"var(--matte-fg-3)", fontWeight:700, letterSpacing:"0.08em", textTransform:"uppercase"}}>외부 지표</div>
        {[
          ["창업 기상도", "맑음"],
          ["상권지도", "상위 18%"],
          ["잠재력", "B+"],
          ["안정성", "B"],
          ["성장성", "A-"],
          ["활성도", "A"],
        ].map(([l, v], i) => (
          <div key={i} style={{display:"flex", flexDirection:"column", alignItems:"flex-start", gap:4}}>
            <div style={{fontSize:13, color:"var(--matte-fg-3)", fontWeight:500}}>{l}</div>
            <div style={{fontSize:18, color:"var(--matte-fg)", fontWeight:700, fontVariantNumeric:"tabular-nums", letterSpacing:"-0.005em"}}>{v}</div>
          </div>
        ))}
      </div>
    </CardShell>
  );
}

/* ============================================================
   Card 14 — AI 종합 분석 (레이더 + 시그널 + 디렉터 버튼)
   ============================================================ */
function Card14({ body = {}, onOpenDirector }) {
  const total = Number(body.totalScore) || 53;
  const opportunities = Number(body.opportunities) || 7;
  const risks = Number(body.risks) || 3;
  const grade = total >= 70 ? "A" : total >= 60 ? "B+" : total >= 50 ? "B" : "C+";
  const axesArr = Array.isArray(body.axes) ? body.axes : [];
  const radarAxes = axesArr.length === 5
    ? axesArr.map(a => ({ label: a?.label || "-", max: Number(a?.max) > 0 ? Number(a.max) : 1 }))
    : [
        { label:"시장 매력도", max:20 },
        { label:"경쟁 환경",   max:20 },
        { label:"시장 변화",   max:15 },
        { label:"생존 기반",   max:30 },
        { label:"비용 부담",   max:15 },
      ];
  const radarValues = axesArr.length === 5 && axesArr.some(a => Number(a?.score) > 0)
    ? axesArr.map(a => Number(a?.score) || 0)
    : [13.4, 9.2, 9.8, 18.4, 2.2];
  const allSignals = Array.isArray(body.signals) ? body.signals : [];
  const positiveSignalsArr = allSignals.filter(s => s.type === 'positive').map(s => s.text);
  const negativeSignalsArr = allSignals.filter(s => s.type === 'negative').map(s => s.text);
  const positiveSignals = positiveSignalsArr.length > 0 ? positiveSignalsArr : [
    "월매출 9,121만 — 강남구 평균 +16%",
    "3년 생존율 71% — 상위 12%",
    "공실률 6.9% — 안정권",
    "권역 소비심리 102.4 — 긍정",
    "신규 메뉴 크림라떼 +28% 상승",
  ];
  const negativeSignals = negativeSignalsArr.length > 0 ? negativeSignalsArr : [
    "권리금 1.8억 — 시도 평균 +114%",
    "카페 매장 126개 — 과밀",
    "프랜차이즈 47개 + 스타벅스 11점 — 경쟁 강",
  ];
  const tags = Array.isArray(body.tags) && body.tags.length > 0 ? body.tags : [
    "카페 350개", "신규 5", "폐업 8", "개인카페 56%", "프랜차이즈 47개",
    "월매출 9,121만", "유동인구 57.8만/일", "객단가 24,800원",
    "공실률 6.9%", "평당월세 42만", "권리금 1.8억", "소비심리 102.4",
  ];
  const trustScore = (() => {
    let score = 50;
    if (axesArr.length === 5 && axesArr.every(a => a.score > 0)) score += 30;
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

      {/* HERO: total score + 3 small KPIs */}
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
            <span style={{fontSize:15, color:"var(--matte-fg-3)"}}>등급</span>
            <span style={{fontSize:20, fontWeight:700, letterSpacing:"-0.01em", color:"#fff"}}>{grade}</span>
          </div>
        </div>

        <div className="bc-grid-3" style={{gap:12}}>
          <StatTile id="c14.kpi1" tone="mint"  label="기회"    value={String(opportunities)} unit="건" delta="2 (전월 대비)" deltaPositive hero/>
          <StatTile id="c14.kpi2" tone="rose"  label="리스크"  value={String(risks)} unit="건" delta="1 (전월 대비)" deltaPositive={false} hero/>
          <StatTile id="c14.kpi3" tone="cream" label="신뢰 점수" value={String(trustScore)} unit="/100" delta="2.5" deltaPositive/>
        </div>
      </div>

      {/* RADAR + SIGNALS */}
      <div style={{display:"grid", gridTemplateColumns:"1fr 1fr", gap:24}}>
        <div className="bc-box" style={{padding:18, display:"flex", flexDirection:"column", alignItems:"center"}}>
          <div style={{alignSelf:"stretch", fontSize:15, fontWeight:600, marginBottom:8}}>5축 분포</div>
          <Radar
            id="c14.radar"
            size={340}
            accent
            axes={radarAxes}
            values={radarValues}
          />
        </div>

        <div>
          <div className="bc-box" style={{padding:16, marginBottom:12}}>
            <div style={{fontSize:15, color:"var(--st-good)", fontWeight:700, marginBottom:10, letterSpacing:"0.04em"}}>긍정 시그널 ({positiveSignals.length})</div>
            <window.DrStagger id="c14.signal" delay={80} style={{display:"flex", flexDirection:"column", gap:10}}>
              {positiveSignals.map((t, i) => (
                <div key={i} style={{display:"grid", gridTemplateColumns:"22px 1fr", gap:6, fontSize:15, color:"var(--fg-2)", lineHeight:1.5}}>
                  <span style={{fontSize:15, color:"var(--fg-4)", fontVariantNumeric:"tabular-nums", fontWeight:600}}>{String(i+1).padStart(2,"0")}</span>
                  <span>{t}</span>
                </div>
              ))}
            </window.DrStagger>
          </div>
          <div className="bc-box" style={{padding:16}}>
            <div style={{fontSize:15, color:"var(--st-bad)", fontWeight:700, marginBottom:10, letterSpacing:"0.04em"}}>부정 시그널 ({negativeSignals.length})</div>
            <window.DrStagger id="c14.signal" delay={100} style={{display:"flex", flexDirection:"column", gap:10}}>
              {negativeSignals.map((t, i) => (
                <div key={i} style={{display:"grid", gridTemplateColumns:"22px 1fr", gap:6, fontSize:15, color:"var(--fg-2)", lineHeight:1.5}}>
                  <span style={{fontSize:15, color:"var(--fg-4)", fontVariantNumeric:"tabular-nums", fontWeight:600}}>{String(i+1).padStart(2,"0")}</span>
                  <span>{t}</span>
                </div>
              ))}
            </window.DrStagger>
          </div>
        </div>
      </div>

      {/* 외부 신호 태그 */}
      <div className="bc-box" style={{padding:16, marginTop:16}}>
        <div style={{fontSize:15, color:"var(--fg-3)", fontWeight:600, marginBottom:10, letterSpacing:"0.04em"}}>외부 신호 (분석에 사용된 핵심 수치)</div>
        <div style={{display:"flex", flexWrap:"wrap", gap:6}}>
          {tags.map((t, i) => <span key={i} className="bc-pill">#{t}</span>)}
        </div>
      </div>

      {/* CTA */}
      <button onClick={onOpenDirector} className="bc-btn bc-btn--lg" style={{marginTop:20, width:"100%", justifyContent:"center"}}>
        <i className="ph-fill ph-sparkle"></i>
        AI 디렉터
      </button>
    </CardShell>
  );
}

Object.assign(window, { Card13, Card14 });
