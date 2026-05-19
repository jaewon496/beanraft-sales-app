/* Card05 — 매출 분석 (월평균 예상 매출) */

import React from 'react';
import { CardShell, StatTile } from '../Shared.jsx';
import { LineChart } from '../Charts.jsx';

export default function Card05({ body = {} }) {
  const bodyData = body.bodyData || {};
  const chartData = body.chartData || {};
  const kosis = body.kosisBoxData || {};

  const monthly = Number(bodyData.monthly) || 0;       // 카페 월매출 (만원)
  const dongAvg = Number(bodyData.dongAvg) || 0;
  const guAvg = Number(bodyData.guAvg) || 0;
  const dongMax = Number(bodyData.dongMaxSales) || 0;
  const dongMin = Number(bodyData.dongMinSales) || 0;
  const prevYearRate = Number(bodyData.prevYearRate) || 0;
  const prevMonRate = Number(bodyData.prevMonRate) || 0;
  const dongSaleCnt = Number(bodyData.dongSaleCnt) || 0;
  const bizmapAvgPrice = bodyData.bizmapAvgUnitPrice || null;   // "X,XXX원" 문자열
  const cafeSalesRank = bodyData.cafeSalesRank || null;          // "X위 / Y개 업종"
  const cafePctInTop5 = bodyData.cafePctInTop5 || null;

  // 13개월 추이 (annualSalesTrend.values + labels)
  const trend = bodyData.annualSalesTrend || null;
  const trendLabels = trend?.labels || [];
  const trendValues = trend?.values || [];

  // chartData.values (폴백) - 비즈맵 6개월 추이
  const chartValues = Array.isArray(chartData.values) && chartData.values.length > 0 ? chartData.values : [];
  const chartLabels = Array.isArray(chartData.labels) ? chartData.labels : [];

  const lineData = trendValues.length > 0 ? trendValues : chartValues;
  const lineLabels = trendValues.length > 0 ? trendLabels : chartLabels;

  // 동네별 카페 매출 TOP 5
  const top5 = Array.isArray(bodyData.topFiveDongsList) ? bodyData.topFiveDongsList.slice(0, 5) : [];
  const top5Title = bodyData.topFiveTitle || '동네별 카페 매출 TOP 5';
  const top5Max = Math.max(1, ...top5.map(d => Number(d.amt) || 0));

  // 권역 소비심리 (kosisBoxData.consumerSentiment / consumerSentimentSeries)
  const cs = kosis?.consumerSentiment || null;
  const csSeries = kosis?.consumerSentimentSeries?.series || [];
  const csLatest = cs?.value ?? (csSeries[csSeries.length - 1]?.value ?? null);
  const csPrev = csSeries.length >= 2 ? csSeries[csSeries.length - 2].value : null;
  const csChange = csLatest != null && csPrev != null ? Math.round((csLatest - csPrev) * 10) / 10 : null;
  const csRegion = kosis?.consumerSentiment?.region || kosis?.consumerSentimentSeries?.region || '전국 평균';

  // 객단가 폴백 체인 (정답지 카드 06)
  //   1. bizmapAvgUnitPrice (UnifiedLayout i===5에서 bizmapAvgPayment도 흡수)
  //   2. bodyData.unitPrice / avgUnitPrice (명시 키)
  //   3. card 03 popularMenus 가중평균 (Σ(avgPrice × salesRate) / Σ(salesRate))
  //      - 비즈맵 popularMenuList 들어왔을 때만 사용 가능
  const unitPrice = (() => {
    if (bizmapAvgPrice) {
      // 문자열("X,XXX원") 또는 숫자 둘 다 허용
      if (typeof bizmapAvgPrice === 'string') return bizmapAvgPrice;
      const n = Number(bizmapAvgPrice) || 0;
      if (n > 0) return `${Math.round(n).toLocaleString()}원`;
    }
    const explicit = Number(bodyData.unitPrice) || Number(bodyData.avgUnitPrice) || 0;
    if (explicit > 0 && explicit < 100000) {
      return `${Math.round(explicit).toLocaleString()}원`;
    }
    // popularMenus 가중평균 폴백 (body.popularMenuWeightedAvg 또는 body.bodyData.popularMenuWeightedAvg)
    const wAvg = Number(bodyData.popularMenuWeightedAvg) || Number(body.popularMenuWeightedAvg) || 0;
    if (wAvg > 0) return `${Math.round(wAvg).toLocaleString()}원`;
    return '-';
  })();

  // 한국식 금액 표기 (X,XXX만 → 1.2억)
  const fmtWon = (manwon) => {
    if (!manwon || manwon < 1) return '-';
    if (manwon >= 10000) return `${(manwon / 10000).toFixed(2)}억`;
    return `${Math.round(manwon).toLocaleString()}만`;
  };

  return (
    <CardShell n="06" id="06"
      title="매출 분석"
      sub="월평균 예상 매출"
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
              <LineChart id="c5.line" width={680} height={240}
                data={lineData}
                color="#4C7BE4"
              />
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
