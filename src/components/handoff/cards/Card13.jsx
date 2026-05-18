/* Card13 — 상권 경쟁 분석 (5축 분해 종합 평가, 만점 100) */

import React from 'react';
import { CardShell } from '../Shared.jsx';
import { ScoreGauge } from '../Charts.jsx';
import { DrStagger } from '../director/DirectorAnim.jsx';

export default function Card13({ body = {} }) {
  const total = Number(body.totalScore) || 0;
  const survival3y = Number(body.survival3y) || 0;
  const cafeSales = Number(body.cafeSales) || 0;
  const guAvg = Number(body.guAvg) || 0;
  const sigungu = body.sigungu || '';
  const cafeCount = Number(body.cafeCount) || 0;
  const franchiseCount = Number(body.franchiseCount) || 0;
  const individualCount = Number(body.individualCount) || 0;
  const avgRent = Number(body.avgRent) || 0;
  const premiumCost = body.premiumCost ? Math.round(Number(body.premiumCost) / 10000) : 0; // 만원 단위
  const risingMenu = body.risingMenu || null;
  const popularMenuTop = body.popularMenuTop || null;
  const popularMenuCount = Number(body.popularMenuCount) || 0;
  const weatherLabel = body.weatherLabel || '';
  const weatherScore = Number(body.weatherScore) || 0;
  const externalIndicators = body.externalIndicators || null;

  const grade = total >= 80 ? "매우 좋음" : total >= 60 ? "좋음" : total >= 40 ? "보통" : total >= 20 ? "주의" : "낮음";

  // 5축 (각 축 점수 / 만점)
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
        // 1순위: 급상승 메뉴
        if (risingMenu?.name && risingMenu?.growthRate) {
          return `급상승 메뉴 ${risingMenu.name} +${Number(risingMenu.growthRate).toFixed(0)}%`;
        }
        // 2순위: 인기 메뉴 TOP 1 + 메뉴 다양성 라벨
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

  // 한 줄 요약 (최강/최약 축 기반)
  const headline = (() => {
    if (total === 0) return '데이터 수집 중';
    const strongest = strengths[0];
    const weakest = weaknesses[weaknesses.length - 1];
    if (strongest && weakest) {
      return `${strongest.label}는 강하지만 ${weakest.label}이 ${grade === '좋음' || grade === '매우 좋음' ? '함께 큰' : '부담인'} 자리.`;
    }
    return `${grade} 등급 상권.`;
  })();

  // 외부 지표 6칸 (창업기상도/상권지도 5종)
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

    // 폴백: 매출 백분위
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
