/* Card11 — SNS 트렌드 (소셜미디어 카페 분위기) */

import React, { useMemo } from 'react';
import { CardShell, StatTile } from '../Shared.jsx';
import { DrStagger } from '../director/DirectorAnim.jsx';

/* 키워드 떠다니는 효과 — 사용자 명시 요청으로 보존 (기존 ChartWordCloud 이식)
   원본: src/components/client-mode/UnifiedLayout.jsx ~L1326 */
function FloatingKeywordCloud({ keywords, height = 220 }) {
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

export default function Card11({ body = {} }) {
  const bodyData = body.bodyData || {};
  const chartData = body.chartData || {};

  const positivePct = Number(bodyData.positiveRatio) || Number(chartData.sentimentPos) || 0;
  const negativePct = Number(bodyData.negativeRatio) || (positivePct > 0 ? 100 - positivePct : 0);
  const blogMentions = Number(bodyData.blogMentions) || 0;

  // 키워드 (12개)
  const keywords = Array.isArray(bodyData.keywords) ? bodyData.keywords.slice(0, 12) : [];
  // 가중치 부여 (인덱스 작을수록 큰 글자)
  const wcItems = keywords.map((k, i) => ({
    text: k,
    size: Math.max(11, Math.round(28 - i * 1.5)),
  }));

  // 검색 유입 경로
  const intents = Array.isArray(bodyData.searchIntents) ? bodyData.searchIntents.slice(0, 7) : [];
  // 주의 키워드
  const negativeKw = Array.isArray(bodyData.negativeKeywords) ? bodyData.negativeKeywords.slice(0, 5) : [];

  // 후기 좋은 매장 TOP 5 [{name, menu, reason}]
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
            <FloatingKeywordCloud
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
