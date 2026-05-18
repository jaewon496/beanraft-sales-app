/* Card14 — AI 종합 분석 (5축 레이더 + 시그널 + 디렉터 버튼) */

import React from 'react';
import { CardShell, StatTile, CountUp } from '../Shared.jsx';
import { Radar } from '../Charts.jsx';
import { DrStagger } from '../director/DirectorAnim.jsx';

export default function Card14({ body = {}, onOpenDirector }) {
  const total = Number(body.totalScore) || 0;
  const opportunities = Number(body.opportunities) || 0;
  const risks = Number(body.risks) || 0;
  const recommendation = body.recommendation || (total >= 80 ? '매우 좋음' : total >= 60 ? '좋음' : total >= 40 ? '보통' : '주의');
  const grade = total >= 80 ? 'A' : total >= 70 ? 'A-' : total >= 60 ? 'B+' : total >= 50 ? 'B' : total >= 40 ? 'C+' : 'C';

  // 5축 (axes = [{label, max, score}, ...]) - card11(상권경쟁)에서 가져옴
  const axes = Array.isArray(body.axes) ? body.axes : [];
  const radarLabels = axes.length > 0 ? axes.map(a => ({ label: a.label, max: a.max })) : [];
  const radarValues = axes.length > 0 ? axes.map(a => Number(a.score) || 0) : [];

  // 시그널 (chartData.signals = [{type, text}, ...])
  const allSignals = Array.isArray(body.signals) ? body.signals : [];
  const positiveSignals = allSignals.filter(s => s.type === 'positive');
  const negativeSignals = allSignals.filter(s => s.type === 'negative');

  // 외부 신호 태그 (chartData.tags = [...])
  const tags = Array.isArray(body.tags) ? body.tags : [];

  // 신뢰 점수 (수집된 데이터의 충실도 기반 - 100점 만점)
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
            <Radar
              id="c14.radar"
              size={340}
              accent
              axes={radarLabels}
              values={radarValues}
            />
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
