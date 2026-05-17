/* Card09 — 카페 기회 (공실률 + 핵심 발견) */

import React from 'react';
import { CardShell, StatTile } from '../Shared.jsx';
import { LineChart } from '../Charts.jsx';
import { DrStagger } from '../director/DirectorAnim.jsx';

export default function Card09({ body = {} }) {
  const bodyData = body.bodyData || {};
  const kosis = body.kosisBoxData || {};

  const vacancy = Number(body.vacancy) || 0;
  const newOpen = Number(body.newOpen) || 0;
  const closed = Number(body.closed) || 0;
  const cafeMonthly = Number(body.cafeMonthly) || 0;
  const guAvg = Number(body.guAvg) || 0;
  const sigungu = body.sigungu || '';
  const individualPct = Number(body.individualPct) || 0;
  const survival3y = Number(body.survival3y) || 0;

  // 공실률 시계열 (kosisBoxData.vacancySeries.series = [{period, value}, ...])
  const vacSeries = body.vacancySeries || kosis?.vacancySeries?.series || null;
  const vacValues = Array.isArray(vacSeries) ? vacSeries.map(s => Number(s.value) || 0).filter(v => v > 0) : [];
  const vacMin = vacValues.length > 0 ? Math.min(...vacValues) : 0;
  const vacMax = vacValues.length > 0 ? Math.max(...vacValues) : 0;
  const vacRange = vacMax > 0 ? Math.round((vacMax - vacMin) * 10) / 10 : 0;

  // 동 평균 vs 현재
  const vacavgDelta = (() => {
    if (vacValues.length < 2) return 0;
    const avg = vacValues.reduce((s, v) => s + v, 0) / vacValues.length;
    return Math.round((vacancy - avg) * 10) / 10;
  })();

  // 핵심 발견 5축 (시장/경쟁/변화/생존/비용)
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

  // 동에서 발견한 LOCALDATA 인사이트 (bodyData.findings = [{axis, text}])
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
              <LineChart id="c9.line" width={460} height={260}
                data={vacValues}
                color="#5478C9"/>
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
                <span style={{fontSize:15, fontWeight:700, color: f.acc ? "#5478C9" : "var(--matte-fg)"}}>{f.axis}</span>
                <span style={{fontSize:13, color: f.ratio >= 0.6 ? "var(--matte-fg-2)" : "var(--matte-fg-3)", fontWeight:600, fontVariantNumeric:"tabular-nums"}}>{f.ratio >= 0.7 ? "강점" : f.ratio >= 0.4 ? "보통" : "주의"}</span>
              </div>
              <div style={{fontSize:14, color:"var(--matte-fg-2)", marginBottom:10, lineHeight:1.5}}>{f.text}</div>
              <div className="bc-bar" style={{height:8, background:"rgba(255,255,255,0.04)"}}>
                <div style={{width:`${f.ratio*100}%`, background: f.acc ? "#5478C9" : "#FFFFFF", height:"100%", borderRadius:"inherit"}}></div>
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
