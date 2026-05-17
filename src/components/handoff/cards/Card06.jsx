/* Card06 — 개인 카페 분석 (주변 개인 카페 현황 + 가격대) */

import React from 'react';
import { CardShell, StatTile } from '../Shared.jsx';
import { DrStagger } from '../director/DirectorAnim.jsx';

export default function Card06({ body = {} }) {
  const bodyData = body.bodyData || {};
  const sigungu = body.sigungu || '';
  const kosis = body.kosisBoxData || {};

  const indieCount = Number(bodyData.independentCount) || 0;
  const totalCafes = Number(bodyData.totalCafes) || 0;
  const indiePct = totalCafes > 0 ? Math.round(indieCount / totalCafes * 100) : 0;
  const americanoAvg = Number(bodyData.americanoAvg) || 0;
  const dessertAvg = Number(bodyData.dessertAvg) || 0;
  const menuAvg = Number(bodyData.menuAvg) || 0;

  // 가까운 개인 카페 TOP 5
  const top5 = Array.isArray(bodyData.topNearbyIndie) ? bodyData.topNearbyIndie.slice(0, 5) : [];

  // 가격 비교 (개인 카페 vs 프랜차이즈)
  const compare = bodyData.indieFranchPriceCompare || null;
  const indieAmericano = compare?.indie || americanoAvg;
  const franchAmericano = compare?.franch || 4500;

  // KOSIS 시군구/시도 카페 폐업 (regionClosure / cafeClosure)
  const regionClose = kosis?.regionClosure?.value || 0;
  const sidoClose = kosis?.cafeClosure?.value || 0;

  // 가격 비교 막대 항목 (개인/스벅/프랜/저가)
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
    <CardShell n="06" id="06"
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
                      <span style={{fontSize:20, fontWeight:700, fontVariantNumeric:"tabular-nums", color: isAcc ? "#5478C9" : "var(--matte-fg)", letterSpacing:"-0.01em", flexShrink:0}}>{c.dist || 0}<span style={{fontSize:13, color:"var(--matte-fg-3)", marginLeft:2, fontWeight:500}}>m</span></span>
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
                  <div style={{width:`${(Number(v)/priceMax)*100}%`, background: acc ? "#5478C9" : "#FFFFFF", height:"100%", borderRadius:"inherit"}}></div>
                </div>
                <span style={{textAlign:"right", fontSize:15, fontWeight:700, color: acc ? "#5478C9" : "var(--matte-fg)", fontVariantNumeric:"tabular-nums"}}>{Number(v).toLocaleString()}<span style={{fontSize:13, color:"var(--matte-fg-3)", marginLeft:2, fontWeight:500}}>원</span></span>
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
                    <div style={{fontSize:24, fontWeight:700, color:"#5478C9", fontVariantNumeric:"tabular-nums", letterSpacing:"-0.01em"}}>{regionClose > 0 ? regionClose.toLocaleString() : '-'}<span style={{fontSize:13, color:"var(--matte-fg-3)", marginLeft:3, fontWeight:500}}>곳/년</span></div>
                  </div>
                </div>
                {(sidoClose > 0 && regionClose > 0) && (
                  <div style={{fontSize:13, color:"var(--matte-fg-3)", marginTop:12, lineHeight:1.6}}>{sigungu || '이 시군구'}는 시도 평균 대비 <strong style={{color:"#5478C9"}}>{regionClose > sidoClose ? '+' : ''}{Math.round(((regionClose - sidoClose) / sidoClose) * 100)}%</strong> 수준</div>
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
