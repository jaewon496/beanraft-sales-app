/* Card10 — 배달 객단가 (이 동네 배달 객단가) */

import React from 'react';
import { CardShell, StatTile } from '../Shared.jsx';
import { LineChart, VBars, Donut, DonutLegend } from '../Charts.jsx';

export default function Card10({ body = {} }) {
  const bodyData = body.bodyData || {};

  const searchAvgPrice = Number(bodyData.searchAvgPrice) || 0;     // 객단가 (원)
  const searchSales = Number(bodyData.searchSales) || 0;            // 월매출 (만원)
  const searchOrders = Number(bodyData.searchOrders) || 0;          // 월주문 (건)
  const cafeRank = Number(bodyData.cafeRankInDelivery) || 0;
  const totalBiz = Number(bodyData.totalDeliveryBiz) || 0;
  const cafeDelivery = Number(bodyData.cafeDeliveryAmount) || 0;    // 배달 한정 카페 매출 (만원)

  // 월별 추이 [{label, value}]
  const monthlyTrend = Array.isArray(bodyData.monthlyTrend) ? bodyData.monthlyTrend.slice(-12) : [];
  const monthlyValues = monthlyTrend.map(m => Number(m.value) || 0).filter(v => v > 0);
  const yoyPct = monthlyValues.length >= 2 && monthlyValues[0] > 0
    ? Math.round(((monthlyValues[monthlyValues.length - 1] - monthlyValues[0]) / monthlyValues[0]) * 100)
    : 0;

  // 요일별 매출 [{day, amount, isTop, isLow}]
  const weekdaySales = Array.isArray(bodyData.weekdaySales) ? bodyData.weekdaySales : [];
  const dayItems = weekdaySales.map(d => ({
    l: d.day, v: Number(d.amount) || 0, t: String(Math.round(Number(d.amount) || 0))
  }));
  const dayTopIdx = dayItems.findIndex((_, i) => weekdaySales[i]?.isTop);

  // KOSIS 배달 운영 통계 (kosisDelivery = { app: {usePct, avgManwon}, agency: {...}, bothMonthlyManwon, overallUsePct })
  const kd = bodyData.kosisDelivery || null;
  const kdActiveRatio = kd ? Math.round(Number(kd.overallUsePct) || 0) : null;
  const kdInactiveRatio = kdActiveRatio != null ? 100 - kdActiveRatio : null;

  // 운영 옵션별 월 비용 (KOSIS app/agency avgManwon)
  const kdMonthlyCost = (() => {
    if (!kd) return [];
    const items = [];
    const appAvg = Number(kd.app?.avgManwon) || 0;
    const agencyAvg = Number(kd.agency?.avgManwon) || 0;
    if (appAvg > 0) items.push(['배민/쿠팡이츠', `${appAvg.toLocaleString()}만원`, '#FFFFFF']);
    if (agencyAvg > 0) items.push(['바로고/부릉', `${agencyAvg.toLocaleString()}만원`, '#7a7a7a']);
    if (appAvg > 0 && agencyAvg > 0) items.push(['둘 다 운영', `${(appAvg + agencyAvg).toLocaleString()}만원`, '#4C7BE4']);
    return items;
  })();

  // 데이터 유무 판정 (없으면 박스 자체를 숨김 — "수집 중"/"-" 표기 금지)
  const hasMonthly = monthlyValues.length >= 2;
  const hasWeekday = dayItems.length > 0;
  const hasTrendBox = hasMonthly || hasWeekday;
  const hasCafeRank = cafeRank > 0;

  // 상단 통계 타일: 값 있는 것만 노출
  const statTiles = [
    { id: 'c10.tile1', tone: 'blue',  label: '동 객단가 (배달)', value: searchAvgPrice, unit: '원',  hero: true,  ok: searchAvgPrice > 0 },
    { id: 'c10.tile2', tone: 'mint',  label: '월 배달 매출',     value: searchSales,    unit: '만원', hero: false, ok: searchSales > 0 },
    { id: 'c10.tile3', tone: 'lilac', label: '월 배달 건수',     value: searchOrders,   unit: '건',   hero: false, ok: searchOrders > 0 },
  ].filter(t => t.ok);
  if (hasCafeRank) {
    statTiles.push({
      id: 'c10.tile4', tone: 'cream', label: '배달 카페 순위',
      value: cafeRank, unit: totalBiz > 0 ? `위 / ${totalBiz}개 업종` : '위', hero: false, ok: true,
    });
  }
  const tileGridClass = statTiles.length >= 4 ? 'bc-grid-4'
    : statTiles.length === 3 ? 'bc-grid-3'
    : statTiles.length === 2 ? 'bc-grid-2' : '';

  return (
    <CardShell n="10" id="10"
      title="배달 객단가"
      sub="이 동네 배달 객단가"
      sources={["소상공인진흥공단 delivery", "배민/쿠팡이츠 핫플레이스", "KOSIS 외식업체경영실태조사"]}>
      {statTiles.length > 0 && (
        <div className={tileGridClass} style={tileGridClass
          ? {gap:16, marginBottom:16}
          : {display:'grid', gridTemplateColumns:'repeat(1, 1fr)', gap:16, marginBottom:16}}>
          {statTiles.map(t => (
            <StatTile key={t.id} id={t.id} tone={t.tone} label={t.label}
              value={t.value.toLocaleString()} unit={t.unit} hero={t.hero}/>
          ))}
        </div>
      )}

      <div style={{display:"grid", gridTemplateColumns: hasTrendBox ? "1.4fr 1fr" : "1fr", gap:16, alignItems:"stretch"}}>
        {hasTrendBox && (
        <div className="bc-box" style={{padding:18, display:"flex", flexDirection:"column"}}>
          {hasMonthly && (
            <>
              <div style={{display:"flex", justifyContent:"space-between", marginBottom:12}}>
                <div style={{fontSize:15, fontWeight:600}}>월별 배달 주문건수 ({monthlyValues.length}개월)</div>
                {yoyPct !== 0 && <span style={{fontSize:15, color: yoyPct >= 0 ? "#4C7BE4" : "var(--st-bad)", fontWeight:700}}>{yoyPct > 0 ? '+' : ''}{yoyPct}% (추세)</span>}
              </div>
              <div style={{flex:1, display:"flex", alignItems:"center", minHeight:180}}>
                <LineChart id="c10.line" width={520} height={240} data={monthlyValues} color="#4C7BE4"/>
              </div>
            </>
          )}
          {hasWeekday && (
            <div style={{marginTop: hasMonthly ? 18 : 0, paddingTop: hasMonthly ? 14 : 0, borderTop: hasMonthly ? "1px solid var(--matte-line)" : "none"}}>
              <div style={{fontSize:15, fontWeight:600, marginBottom:12}}>요일별 배달 주문</div>
              <VBars id="c10.days" accent={dayTopIdx >= 0 ? dayTopIdx : 0} height={80} barW={24} items={dayItems}/>
            </div>
          )}
        </div>
        )}

        <div>
          <div className="bc-box" style={{padding:24, marginBottom:14}}>
            <div style={{fontSize:18, fontWeight:700, marginBottom:18}}>운영 옵션별 월 비용</div>
            {kdMonthlyCost.length > 0 ? (
              <div style={{display:"flex", flexDirection:"column"}}>
                {kdMonthlyCost.map(([l, v, c], i) => (
                  <div key={i} style={{display:"flex", justifyContent:"space-between", alignItems:"center", padding:"16px 0", borderBottom: i < kdMonthlyCost.length - 1 ? "1px solid var(--matte-line)" : "none"}}>
                    <div style={{display:"flex", alignItems:"center", gap:12}}>
                      <span style={{width:12, height:12, borderRadius:9999, background:c, flexShrink:0}}></span>
                      <span style={{fontSize:16, fontWeight: i===kdMonthlyCost.length-1 ? 700 : 600, color: i===kdMonthlyCost.length-1 ? "#4C7BE4" : "var(--matte-fg)", letterSpacing:"-0.005em"}}>{l}</span>
                    </div>
                    <span style={{fontSize:20, fontWeight:700, fontVariantNumeric:"tabular-nums", color: i===kdMonthlyCost.length-1 ? "#4C7BE4" : "var(--matte-fg)", letterSpacing:"-0.01em"}}>{v}</span>
                  </div>
                ))}
              </div>
            ) : (
              <div style={{fontSize:13, color:"var(--matte-fg-4)", padding:"20px 0"}}>KOSIS 운영 비용 데이터 수집 중</div>
            )}
          </div>

          <div className="bc-box" style={{padding:18}}>
            <div style={{fontSize:15, fontWeight:600, marginBottom:10}}>전국 카페 배달 운영</div>
            {kdActiveRatio != null ? (
              <div style={{display:"flex", alignItems:"center", gap:16}}>
                <Donut id="c10.donut" size={180} thickness={20} segments={[
                  {value: kdActiveRatio, color:"#4C7BE4", label:"운영"},
                  {value: kdInactiveRatio, color:"#FFFFFF", label:"미운영"},
                ]} centerLabel={`${kdActiveRatio}%`} centerSub="배달 운영"/>
                <DonutLegend segments={[
                  {value: kdActiveRatio, color:"#4C7BE4", label:"운영", text:`${kdActiveRatio}%`},
                  {value: kdInactiveRatio, color:"#FFFFFF", label:"미운영", text:`${kdInactiveRatio}%`},
                ]}/>
              </div>
            ) : (
              <div style={{fontSize:13, color:"var(--matte-fg-4)", padding:"30px 0", textAlign:"center"}}>KOSIS 배달 운영 비중 수집 중</div>
            )}
          </div>
        </div>
      </div>
    </CardShell>
  );
}
