/* Card03 — 상권 변화 추이 (개폐업 + 메뉴 트렌드) */

import React from 'react';
import { CardShell, StatTile } from '../Shared.jsx';
import { BarRow } from '../Charts.jsx';

export default function Card03({ body = {} }) {
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

  // 인기 메뉴 / 급상승 메뉴 (비즈맵)
  const popularMenus = Array.isArray(bodyData.popularMenus) ? bodyData.popularMenus.slice(0, 3) : [];
  const risingMenus = Array.isArray(bodyData.risingMenus) ? bodyData.risingMenus.slice(0, 3) : [];

  // 메뉴 막대 비율 정규화 (가격대 기준 상대값)
  const popMaxPrice = Math.max(1, ...popularMenus.map(m => Number(m.avgPrice) || 0));
  const popMaxRate = Math.max(1, ...popularMenus.map(m => Number(m.salesRate) || 0));
  const riseMaxRate = Math.max(1, ...risingMenus.map(m => Number(m.growthRate) || 0));

  // KOSIS 시군구 폐업자 (regionClosure, 전체 개인사업자 폐업자 수 - 카페 한정 X) - 시군구 비교
  const regionClosure = kosis?.regionClosure?.value || 0;
  const regionClosureScope = kosis?.regionClosure?.scope || '';  // '시군구' or '전국평균'

  // KOSIS 카페 폐업 시계열 (cafeClosureSeries) - 시도 추세
  const closureSeries = kosis?.cafeClosureSeries?.series || [];

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
            <div style={{fontSize:13, color:"var(--matte-fg-3)", marginTop:6, fontVariantNumeric:"tabular-nums"}}>
              {regionClosureScope === '시군구' ? (sigungu || '시군구') : '전국 시군구 평균'} 전체 업종 폐업 {regionClosure.toLocaleString()}곳/년
            </div>
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
