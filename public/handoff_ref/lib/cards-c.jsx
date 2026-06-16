/* cards-c.jsx — Card 13 (5-axis decomposition) + Card 14 (radar + signals)
   [2026-05-19] 정답지: 모든 mock fallback 제거. 데이터 없으면 '데이터 수집 중' 표시. */

/* ============================================================
   Card 13 — 상권 경쟁 분석 (5축 분해 종합 평가)
   ============================================================ */
function Card13({ body = {} }) {
  const total = Number(body.totalScore) || 0;
  // 정답지 5단계 등급 매핑 (카드 14와 일치)
  const grade = total >= 80 ? "매우 좋음" : total >= 60 ? "좋음" : total >= 40 ? "보통" : total >= 20 ? "주의" : "낮음";
  const survival3y = Number(body.survival3y) || 0;
  const cafeSales = Number(body.cafeSales) || 0;
  const guAvg = Number(body.guAvg) || 0;
  const sigungu = body.sigungu || "";
  const cafeCount = Number(body.cafeCount) || 0;
  const individualCount = Number(body.individualCount) || 0;
  const avgRent = Number(body.avgRent) || 0;
  // premiumCost: dataMapper에서 만원 단위. 억 단위 변환은 ÷10000 한번만.
  const premiumManwon = Number(body.premiumCost) || 0;
  const premiumEok = premiumManwon > 0 ? (premiumManwon / 10000).toFixed(1) : null;
  const risingMenu = body.risingMenu || null;
  const popularMenuTop = body.popularMenuTop || null;
  const popularMenuCount = Number(body.popularMenuCount) || 0;
  const weatherLabel = body.weatherLabel || "";
  const weatherScore = Number(body.weatherScore) || 0;
  const externalIndicators = body.externalIndicators || null;

  const axes = [
    {
      key: "market",
      label: "시장 매력도",
      max: 20,
      score: Number(body.scoreMarket) || 0,
      headline: cafeSales > 0 && guAvg > 0
        ? `월매출 ${window.bcFmtMan(cafeSales) || (cafeSales.toLocaleString() + '만원')} — ${sigungu || '시군구'} 평균 ${cafeSales > guAvg ? '+' : ''}${Math.round((cafeSales / guAvg - 1) * 100)}%`
        : (cafeSales > 0 ? `월매출 ${window.bcFmtMan(cafeSales) || (cafeSales.toLocaleString() + '만원')}` : '시장 데이터 수집 중'),
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
        // [2026-05-19] 메뉴 데이터 없을 때 신규/폐업 비율 폴백 (메모리 규칙: '데이터 수집 중' 금지)
        const _openCnt = Number(body.openCount) || Number(body.newOpen) || 0;
        const _closeCnt = Number(body.closeCount) || Number(body.closed) || 0;
        if (_openCnt > 0 || _closeCnt > 0) {
          const _net = _openCnt - _closeCnt;
          const _label = _net > 0 ? '확장 국면' : _net < 0 ? '수축 국면' : '균형 회전';
          return `신규 ${_openCnt}개 / 폐업 ${_closeCnt}개 — ${_label}`;
        }
        if (cafeCount > 0) {
          return `매장수 ${cafeCount}개 — ${cafeCount > 80 ? '포화' : cafeCount > 40 ? '경쟁' : '여유'}`;
        }
        return '시장 변화 신호 없음';
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
        ? `평당 월세 ${avgRent.toLocaleString()}만원${premiumEok ? ` · 권리금 ${premiumEok}억` : ''}`
        : '임대료 데이터 수집 중',
    },
  ];

  const strengths = axes.filter(a => a.score / a.max >= 0.6).sort((a, b) => (b.score/b.max) - (a.score/a.max));
  const weaknesses = axes.filter(a => a.score / a.max < 0.6).sort((a, b) => (a.score/a.max) - (b.score/b.max));
  const maxRatio = axes.reduce((m, a) => Math.max(m, a.score/a.max), 0);

  // [2026-06-14] 우리 5축 점수 비율 → 우리 자체 등급 (외부 95점/외부 A등급 대체)
  //   85%↑ 우수 / 65%↑ 양호 / 45%↑ 보통 / 25%↑ 주의 / 그 미만 취약
  const axisGrade = (ratio) => {
    if (!(ratio > 0)) return '취약';
    if (ratio >= 0.85) return '우수';
    if (ratio >= 0.65) return '양호';
    if (ratio >= 0.45) return '보통';
    if (ratio >= 0.25) return '주의';
    return '취약';
  };
  // KPI 3번째 타일에 노출할 우리 축: 가장 약한 축(없으면 가장 강한 축) — 자리 판단에 가장 중요
  const focusAxis = weaknesses[0] || strengths[0] || axes[0];
  const focusRatio = focusAxis ? (focusAxis.max > 0 ? focusAxis.score / focusAxis.max : 0) : 0;

  // 한 줄 요약 (점수·축 기반 동적 생성)
  const headline = (() => {
    if (total === 0) return '데이터 수집 중';
    const strongest = strengths[0];
    // weaknesses는 비율 오름차순 정렬 → [0]이 가장 약한 축(최약점). 강점 strongest[0](최강)과 대칭.
    const weakest = weaknesses[0];
    if (strongest && weakest) {
      return `${strongest.label}는 강하지만 ${weakest.label}이 ${grade === '좋음' || grade === '매우 좋음' ? '함께 큰' : '부담인'} 자리.`;
    }
    return `${grade} 등급 상권.`;
  })();

  // [2026-06-14] "빈크래프트 종합 진단" — 전적으로 우리 5축 점수 기반.
  //   외부 창업기상도(95점)·외부 상권지도 A등급·외부 매출지수는 우리 종합 58점(보통)과
  //   기준·스케일이 달라 모순을 일으키므로 화면 노출 제거(점수 보너스로는 이미 내부 반영됨).
  //   여기서는 경쟁력 종합 점수(앵커) + 우리 5축을 점수 비율순으로 우리 등급으로만 표기.
  const diagnosisCards = (() => {
    const items = [];
    // 1) 우리 자체 종합 (5축 합산 점수 = total)
    const _gradeKr = total >= 80 ? '매우 좋음' : total >= 60 ? '좋음' : total >= 40 ? '보통' : total >= 20 ? '조정 필요' : '신중';
    if (total > 0) items.push(['경쟁력 종합', `${total}점 · ${_gradeKr}`, true]);
    // 2) 우리 5축을 점수 비율 내림차순으로 → 우리 등급(우수/양호/보통/주의/취약)으로 표기
    if (total > 0) {
      const ranked = [...axes].sort((a, b) => (b.score/b.max) - (a.score/a.max));
      ranked.forEach(a => {
        if (items.length < 6) {
          const _r = a.max > 0 ? a.score / a.max : 0;
          items.push([a.label, axisGrade(_r), false]);
        }
      });
    }
    return items.slice(0, 6);
  })();

  return (
    <CardShell n="13" id="13"
      bruSummary={body.bruSummary}
      title="상권 경쟁 분석"
      sub="경쟁력 종합 평가 (100점 만점)">

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
              ["3년 생존", survival3y > 0 ? String(survival3y) : '-', survival3y > 0 ? '%' : '', survival3y > 0 ? `전국 평균 대비 ${survival3y >= 39 ? '+' : ''}${(survival3y - 39).toFixed(1)}%${survival3y >= 39 ? '↑' : '↓'}` : '', survival3y >= 60],
              ["월매출", cafeSales > 0 ? (window.bcFmtMan(cafeSales) || cafeSales.toLocaleString() + '만원') : '-', '', cafeSales > 0 && guAvg > 0 ? `${sigungu || '시군구'} 평균 대비 ${cafeSales > guAvg ? '+' : ''}${Math.round((cafeSales/guAvg-1)*100)}%` : '', false],
              [focusAxis ? focusAxis.label : '핵심 지표', total > 0 && focusAxis ? axisGrade(focusRatio) : '-', '', total > 0 && focusAxis ? `우리 분석 ${focusAxis.score}/${focusAxis.max}점 (${Math.round(focusRatio*100)}%)` : '', focusRatio >= 0.65],
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

      {/* 5축 분해 */}
      <div className="bc-box" style={{padding:32}}>
        <div style={{display:"flex", justifyContent:"space-between", alignItems:"baseline", marginBottom:24}}>
          <div style={{fontSize:20, fontWeight:700, letterSpacing:"-0.01em"}}>한눈에 보기</div>
          <div style={{fontSize:14, color:"var(--matte-fg-3)"}}>항목 점수 합 = 종합 <strong style={{color:"var(--matte-fg)", fontSize:17, marginLeft:4}}>{total}</strong>점</div>
        </div>

        <window.DrStagger id="c13.axes" delay={140} style={{display:"flex", flexDirection:"column"}}>
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
        </window.DrStagger>
      </div>

      {/* 강점 / 약점 — 자동 분류 (mock 활용/대응 박스 제거) */}
      <div style={{display:"grid", gridTemplateColumns:"1fr 1fr", gap:16, marginTop:16}}>
        <div className="bc-box" style={{padding:28, border:"1px solid rgba(76, 123, 228,0.35)", background:"linear-gradient(180deg, rgba(76, 123, 228,0.06), transparent 70%)", display:"flex", flexDirection:"column"}}>
          <div style={{display:"flex", alignItems:"baseline", justifyContent:"space-between", marginBottom:18}}>
            <div style={{fontSize:18, fontWeight:700, color:"#4C7BE4", letterSpacing:"-0.01em"}}>강점</div>
            <div style={{fontSize:14, color:"var(--matte-fg-3)", fontWeight:600}}>{strengths.length}개</div>
          </div>
          {strengths.length > 0 ? (
            <div style={{display:"flex", flexDirection:"column", gap:14, flex:1}}>
              {strengths.map(a => (
                <div key={a.key} style={{padding:"20px 22px", background:"rgba(255,255,255,0.03)", borderRadius:10, border:"1px solid var(--matte-line)", flex:1, display:"flex", flexDirection:"column", justifyContent:"center"}}>
                  <div style={{display:"flex", justifyContent:"space-between", alignItems:"baseline", marginBottom:10}}>
                    <span style={{fontSize:18, fontWeight:700, color:"#fff", letterSpacing:"-0.005em"}}>{a.label}</span>
                    <span style={{fontSize:20, fontWeight:700, fontVariantNumeric:"tabular-nums", color:"#4C7BE4", letterSpacing:"-0.01em"}}>{a.score}<span style={{fontSize:14, color:"var(--matte-fg-3)", marginLeft:3, fontWeight:500}}>/{a.max}</span></span>
                  </div>
                  <div style={{fontSize:15, color:"var(--matte-fg-2)", lineHeight:1.55}}>{a.headline}</div>
                </div>
              ))}
            </div>
          ) : (
            <div style={{fontSize:13, color:"var(--matte-fg-4)", padding:"20px 0"}}>강점 없음</div>
          )}
        </div>

        <div className="bc-box" style={{padding:28, display:"flex", flexDirection:"column"}}>
          <div style={{display:"flex", alignItems:"baseline", justifyContent:"space-between", marginBottom:18}}>
            <div style={{fontSize:18, fontWeight:700, letterSpacing:"-0.01em"}}>약점</div>
            <div style={{fontSize:14, color:"var(--matte-fg-3)", fontWeight:600}}>{weaknesses.length}개</div>
          </div>
          {weaknesses.length > 0 ? (
            <div style={{display:"flex", flexDirection:"column", gap:14, flex:1}}>
              {weaknesses.map(a => (
                <div key={a.key} style={{padding:"20px 22px", background:"rgba(255,255,255,0.03)", borderRadius:10, border:"1px solid var(--matte-line)", flex:1, display:"flex", flexDirection:"column", justifyContent:"center"}}>
                  <div style={{display:"flex", justifyContent:"space-between", alignItems:"baseline", marginBottom:10}}>
                    <span style={{fontSize:18, fontWeight:700, color:"#fff", letterSpacing:"-0.005em"}}>{a.label}</span>
                    <span style={{fontSize:20, fontWeight:700, fontVariantNumeric:"tabular-nums", color:"var(--matte-fg)", letterSpacing:"-0.01em"}}>{a.score}<span style={{fontSize:14, color:"var(--matte-fg-3)", marginLeft:3, fontWeight:500}}>/{a.max}</span></span>
                  </div>
                  <div style={{fontSize:15, color:"var(--matte-fg-2)", lineHeight:1.55}}>{a.headline}</div>
                </div>
              ))}
            </div>
          ) : (
            <div style={{fontSize:13, color:"var(--matte-fg-4)", padding:"20px 0"}}>약점 없음</div>
          )}
        </div>
      </div>

      {/* 빈크래프트 종합 진단 — 우리 5축 점수 기반 (외부 지표 노출 제거) */}
      {diagnosisCards.length > 0 && (
        <div className="bc-box" style={{padding:"24px 32px", marginTop:16, display:"flex", justifyContent:"space-between", flexWrap:"wrap", gap:24, alignItems:"center"}}>
          <div style={{display:"flex", flexDirection:"column", gap:2}}>
            <div style={{fontSize:13, color:"var(--matte-fg)", fontWeight:700, letterSpacing:"0.04em"}}>빈크래프트 종합 진단</div>
            <div style={{fontSize:11, color:"var(--matte-fg-4)", fontWeight:500}}>우리 5축 분석 기준</div>
          </div>
          {diagnosisCards.map(([l, v, isOurs], i) => (
            <div key={i} style={{display:"flex", flexDirection:"column", alignItems:"flex-start", gap:4}}>
              <div style={{fontSize:13, color:"var(--matte-fg-3)", fontWeight:500}}>{l}</div>
              <div style={{fontSize:18, color: isOurs ? "#4C7BE4" : "var(--matte-fg)", fontWeight:700, fontVariantNumeric:"tabular-nums", letterSpacing:"-0.005em"}}>{v}</div>
            </div>
          ))}
        </div>
      )}
    </CardShell>
  );
}

/* ============================================================
   Card 14 — AI 종합 분석 (레이더 + 시그널 + 디렉터 버튼)
   ============================================================ */
function Card14({ body = {}, onOpenDirector }) {
  const total = Number(body.totalScore) || 0;
  const opportunities = Number(body.opportunities) || 0;
  const risks = Number(body.risks) || 0;
  const recommendation = body.recommendation || (total >= 80 ? '매우 좋음' : total >= 60 ? '좋음' : total >= 40 ? '보통' : total >= 20 ? '주의' : '낮음');
  const grade = total >= 80 ? 'A' : total >= 70 ? 'A-' : total >= 60 ? 'B+' : total >= 50 ? 'B' : total >= 40 ? 'C+' : 'C';
  const axesArr = Array.isArray(body.axes) ? body.axes : [];
  const radarAxes = axesArr.length === 5
    ? axesArr.map(a => ({ label: a?.label || '-', max: Number(a?.max) > 0 ? Number(a.max) : 1 }))
    : [];
  const radarValues = axesArr.length === 5
    ? axesArr.map(a => Number(a?.score) || 0)
    : [];
  const allSignals = Array.isArray(body.signals) ? body.signals : [];
  const positiveSignals = allSignals.filter(s => s.type === 'positive').map(s => s.text);
  const negativeSignals = allSignals.filter(s => s.type === 'negative').map(s => s.text);
  const tags = Array.isArray(body.tags) ? body.tags : [];
  const trustScore = (() => {
    let score = 50;
    if (axesArr.length === 5 && axesArr.every(a => a.score > 0)) score += 30;
    if (allSignals.length >= 5) score += 10;
    if (tags.length >= 8) score += 10;
    return Math.min(100, score);
  })();

  // [2026-06-15] "한 장 요약" 병합 — 상단 배너 제거 후 본 카드로 흡수.
  const _sum = (typeof window !== 'undefined' && window.__BC_DATA__ && window.__BC_DATA__.summary) || {};
  const _st = _sum.stats || {};

  return (
    <CardShell n="14" id="14"
      bruSummary={body.bruSummary}
      title="AI 종합 분석"
      sub="AI 에이전트 종합 피드백"
      headerRight={
        <button onClick={onOpenDirector} className="bc-btn" style={{height:32, padding:"0 14px", fontSize:15}}>
          <i className="ph ph-sparkle"></i> AI 디렉터
        </button>
      }>

      {/* [2026-06-15] 한 장 요약 — 상단 배너에서 병합. 카드 톤(파랑/매트)으로 통일, CTA·아이콘·주황 없음. */}
      {(_sum.verdict || _sum.verdictLine || (_sum.reasons && _sum.reasons.length) || _sum.riskLine ||
        _st.monthlyText || _st.bepSalesText || _st.paybackMonths || _st.totalStartupText) && (
        <>
          <div className="bc-box" style={{padding:18, borderLeft:"3px solid #4C7BE4", marginBottom:16}}>
            {_sum.verdict && (
              <span style={{color:"#4C7BE4", fontWeight:700, fontSize:13, letterSpacing:"0.04em"}}>{_sum.verdict}</span>
            )}
            {_sum.verdictLine && (
              <div style={{color:"var(--matte-fg)", fontSize:17, fontWeight:600, lineHeight:1.4, marginTop:6}}>{_sum.verdictLine}</div>
            )}
            {Array.isArray(_sum.reasons) && _sum.reasons.length > 0 && (
              <div style={{display:"flex", flexWrap:"wrap", gap:8, marginTop:12}}>
                {_sum.reasons.map((r, i) => <span key={i} className="bc-pill">{r}</span>)}
              </div>
            )}
            {_sum.riskLine && (
              <div style={{color:"var(--matte-fg-3)", fontSize:14, marginTop:10}}>핵심 리스크 — {_sum.riskLine}</div>
            )}
          </div>

          <div className="bc-grid-4" style={{gap:16, marginBottom:16}}>
            <StatTile id="c14.sum1" tone="blue"  label="예상 월매출" value={_st.monthlyText || '-'} hero/>
            <StatTile id="c14.sum2" tone="mint"  label="손익분기"   value={_st.bepSalesText || '-'} sub={_st.bepCups ? ('하루 약 ' + _st.bepCups + '잔') : ''}/>
            <StatTile id="c14.sum3" tone="lilac" label="회수기간"   value={_st.paybackMonths ? ('약 ' + _st.paybackMonths + '개월') : '-'}/>
            <StatTile id="c14.sum4" tone="cream" label="총 창업비"  value={_st.totalStartupText || '-'} sub="15평 기준"/>
          </div>
          <div style={{fontSize:12, color:"var(--matte-fg-4)", lineHeight:1.65, marginBottom:4}}>
            손익분기는 ‘매달 이만큼(하루 잔 수) 팔면 본전’이 되는 매출, 회수기간은 목표 매출이 나왔을 때 투자금을 되찾는 데 걸리는 예상 기간이에요. (목표 매출 기준 추정이라 실제론 더 걸릴 수 있어요.)
          </div>
        </>
      )}

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

        <div className="bc-grid-3 c14-kpi" style={{gap:12}}>
          <StatTile id="c14.kpi1" tone="mint"  label="기회"    value={String(opportunities)} unit="건" hero/>
          <StatTile id="c14.kpi2" tone="rose"  label="리스크"  value={String(risks)} unit="건" deltaPositive={false} hero/>
          <StatTile id="c14.kpi3" tone="cream" label="신뢰 점수" value={String(trustScore)} unit="/100"/>
        </div>
      </div>

      <div style={{display:"grid", gridTemplateColumns:"1fr 1fr", gap:24}}>
        <div className="bc-box" style={{padding:18, display:"flex", flexDirection:"column"}}>
          <div style={{fontSize:15, fontWeight:600, marginBottom:8}}>한눈에 보기</div>
          {radarAxes.length === 5 && radarValues.some(v => v > 0) ? (
            <>
              <div style={{display:"flex", justifyContent:"center"}}>
                <Radar
                  id="c14.radar"
                  size={320}
                  accent
                  axes={radarAxes}
                  values={radarValues}
                />
              </div>
              <div style={{flex:1, display:"flex", flexDirection:"column", justifyContent:"space-between", gap:12, marginTop:16, paddingTop:16, borderTop:"1px solid var(--matte-line)"}}>
                {axesArr.map((a, idx) => {
                  const mx = Number(a?.max) > 0 ? Number(a.max) : 1;
                  const sc = Number(a?.score) || 0;
                  const pct = Math.round((sc / mx) * 100);
                  return (
                    <div key={idx}>
                      <div style={{display:"flex", justifyContent:"space-between", alignItems:"baseline", marginBottom:6}}>
                        <span style={{fontSize:14, color:"var(--matte-fg-2)", fontWeight:600, letterSpacing:"-0.01em"}}>{a?.label || '-'}</span>
                        <span style={{fontSize:14, color:"var(--matte-fg)", fontWeight:700, fontVariantNumeric:"tabular-nums"}}>{sc}<span style={{fontSize:12, color:"var(--matte-fg-3)", fontWeight:500}}> / {mx}</span></span>
                      </div>
                      <div className="bc-bar" style={{height:8, background:"rgba(255,255,255,0.08)"}}>
                        <div style={{width:`${pct}%`, background:"#4C7BE4", height:"100%", borderRadius:"inherit", transition:"width 0.9s var(--ease)"}}></div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </>
          ) : (
            <div style={{flex:1, display:"flex", alignItems:"center", justifyContent:"center", padding:"60px 0", color:"var(--matte-fg-4)", fontSize:13}}>점수 데이터 수집 중</div>
          )}
        </div>

        <div>
          <div className="bc-box" style={{padding:16, marginBottom:12}}>
            <div style={{fontSize:15, color:"var(--matte-fg)", fontWeight:700, marginBottom:10, letterSpacing:"0.04em"}}>긍정 시그널 ({positiveSignals.length})</div>
            {positiveSignals.length > 0 ? (
              <window.DrStagger id="c14.signal.pos" delay={80} style={{display:"flex", flexDirection:"column", gap:10}}>
                {positiveSignals.map((t, i) => (
                  <div key={i} style={{display:"grid", gridTemplateColumns:"22px 1fr", gap:6, fontSize:14, color:"var(--matte-fg-2)", lineHeight:1.5}}>
                    <span style={{fontSize:13, color:"var(--matte-fg-4)", fontVariantNumeric:"tabular-nums", fontWeight:600}}>{String(i+1).padStart(2,"0")}</span>
                    <span>{t}</span>
                  </div>
                ))}
              </window.DrStagger>
            ) : (
              <div style={{fontSize:13, color:"var(--matte-fg-4)"}}>개인 카페 비중을 살린 차별화 콘셉트면 비집고 들어갈 자리가 있습니다.</div>
            )}
          </div>
          <div className="bc-box" style={{padding:16}}>
            <div style={{fontSize:15, color:"var(--matte-fg-2)", fontWeight:700, marginBottom:10, letterSpacing:"0.04em"}}>부정 시그널 ({negativeSignals.length})</div>
            {negativeSignals.length > 0 ? (
              <window.DrStagger id="c14.signal.neg" delay={100} style={{display:"flex", flexDirection:"column", gap:10}}>
                {negativeSignals.map((t, i) => (
                  <div key={i} style={{display:"grid", gridTemplateColumns:"22px 1fr", gap:6, fontSize:14, color:"var(--matte-fg-2)", lineHeight:1.5}}>
                    <span style={{fontSize:13, color:"var(--matte-fg-4)", fontVariantNumeric:"tabular-nums", fontWeight:600}}>{String(i+1).padStart(2,"0")}</span>
                    <span>{t}</span>
                  </div>
                ))}
              </window.DrStagger>
            ) : (
              <div style={{fontSize:13, color:"var(--matte-fg-4)"}}>부정 시그널 없음</div>
            )}
          </div>
          {/* [2026-06-14] 디렉터 설계 방향 — 냉정한 진단을 "그래서 이렇게 풀면 됩니다"로 전환. [2026-06-15] 우측 컬럼 높이를 채우기 위해 부정 시그널 아래(우측 셀 내부)로 복귀 */}
          {(() => {
            const dd = body.designDirection;
            const ddItems = Array.isArray(dd)
              ? dd.filter(x => typeof x === 'string' && x.trim().length > 0)
              : (typeof dd === 'string' && dd.trim().length > 0 ? [dd.trim()] : []);
            if (ddItems.length === 0) return null;
            return (
              <div className="bc-box" style={{padding:18, marginTop:12, background:"rgba(76, 123, 228,0.08)", border:"1px solid rgba(76, 123, 228,0.40)"}}>
                <div style={{display:"flex", alignItems:"center", gap:8, marginBottom:12}}>
                  <i className="ph ph-compass-tool" style={{fontSize:18, color:"#4C7BE4"}}></i>
                  <span style={{fontSize:15, color:"#4C7BE4", fontWeight:700, letterSpacing:"0.02em"}}>이렇게 설계하면 됩니다</span>
                </div>
                <window.DrStagger id="c14.design" delay={90} style={{display:"flex", flexDirection:"column", gap:11}}>
                  {ddItems.map((t, i) => (
                    <div key={i} style={{display:"grid", gridTemplateColumns:"22px 1fr", gap:8, fontSize:14, color:"var(--matte-fg)", lineHeight:1.55}}>
                      <span style={{fontSize:13, color:"#4C7BE4", fontVariantNumeric:"tabular-nums", fontWeight:700}}>{String(i+1).padStart(2,"0")}</span>
                      <span>{t}</span>
                    </div>
                  ))}
                </window.DrStagger>
              </div>
            );
          })()}
        </div>
      </div>

      <button onClick={onOpenDirector} className="bc-btn bc-btn--lg" style={{marginTop:20, width:"100%", justifyContent:"center"}}>
        <i className="ph-fill ph-sparkle"></i>
        AI 디렉터
      </button>
    </CardShell>
  );
}

Object.assign(window, { Card13, Card14 });
