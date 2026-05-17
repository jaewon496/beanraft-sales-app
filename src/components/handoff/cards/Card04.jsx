/* Card04 — 프랜차이즈 현황 (반경 500m 브랜드 분석) */

import React from 'react';
import { CardShell, StatTile } from '../Shared.jsx';
import { BarRow } from '../Charts.jsx';
import { DrStagger } from '../director/DirectorAnim.jsx';

export default function Card04({ body = {} }) {
  const bodyData = body.bodyData || {};
  const chartData = body.chartData || {};

  const franchiseCount = Number(bodyData.franchiseCount) || 0;
  const totalCafes = Number(bodyData.totalCafes) || 0;
  const independentCount = Number(bodyData.independentCount) || 0;
  const franchiseShare = Number(bodyData.franchiseShare) || 0;
  const independentShare = Number(bodyData.independentShare) || 0;
  const bakeryShare = Number(bodyData.bakeryShare) || 0;
  const perCafePotential = Number(bodyData.perCafePotential) || 0;

  // brandBarItems: [{name, count}, ...]
  const brandBars = Array.isArray(bodyData.brandBarItems) ? bodyData.brandBarItems.slice(0, 7) : [];
  const brandMax = Math.max(1, ...brandBars.map(b => Number(b.count) || 0));

  // 거리별 분포 (200m / 200~350m / 350~500m)
  const dist = bodyData.distanceDistribution || { inner: 0, mid: 0, outer: 0 };
  const distMax = Math.max(1, dist.inner || 0, dist.mid || 0, dist.outer || 0);
  const distTopKey = (dist.inner >= dist.mid && dist.inner >= dist.outer) ? 'inner'
    : (dist.mid >= dist.outer ? 'mid' : 'outer');

  // 200m 내 프랜차이즈 (StatTile 3번)
  const innerCnt = dist.inner || 0;

  // 국내 vs 해외 브랜드 (간단 휴리스틱: 영문/외국 브랜드 구분)
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
                    {independentShare > 0 && <div style={{width:`${independentShare}%`, background:"#5478C9"}}></div>}
                    {bakeryShare > 0 && <div style={{width:`${bakeryShare}%`, background:"#7a7a7a"}}></div>}
                  </div>
                </div>
                <div style={{display:"flex", justifyContent:"space-between", fontSize:14, color:"var(--matte-fg-2)", gap:24, flexWrap:"wrap"}}>
                  {franchiseShare > 0 && <span><span style={{display:"inline-block", width:10, height:10, borderRadius:9999, background:"#FFFFFF", marginRight:8, verticalAlign:"middle"}}></span>프랜차이즈 <strong style={{color:"#fff", marginLeft:4}}>{franchiseShare}%</strong></span>}
                  {independentShare > 0 && <span><span style={{display:"inline-block", width:10, height:10, borderRadius:9999, background:"#5478C9", marginRight:8, verticalAlign:"middle"}}></span><strong style={{color:"#5478C9"}}>개인 {independentShare}%</strong></span>}
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
                    <div style={{width:`${(v/distMax)*100}%`, background: acc ? "#5478C9" : "#FFFFFF", height:"100%", borderRadius:"inherit"}}></div>
                  </div>
                  <span style={{textAlign:"right", fontSize:17, fontWeight:700, color: acc ? "#5478C9" : "var(--matte-fg)", fontVariantNumeric:"tabular-nums"}}>{v}<span style={{fontSize:13, color:"var(--matte-fg-3)", fontWeight:500, marginLeft:2}}>개</span></span>
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
                  <div style={{fontSize:22, fontWeight:700, color:"#5478C9", fontVariantNumeric:"tabular-nums", letterSpacing:"-0.01em"}}>{foreignCnt}<span style={{fontSize:13, color:"var(--matte-fg-3)", marginLeft:3, fontWeight:500}}>개</span></div>
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
