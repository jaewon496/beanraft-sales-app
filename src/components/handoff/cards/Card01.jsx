/* Card01 — 상권 분석 리포트 (반경 500m 카페 현황 + 임대 시세) */

import React from 'react';
import { CardShell, StatTile } from '../Shared.jsx';
import { Donut, DonutLegend, Sparkline } from '../Charts.jsx';
import { MapTriggerButton } from '../MapModal.jsx';

export default function Card01({ body = {} }) {
  const kbd = body.kosisBoxData || {};
  const cafeCount = Number(body.cafeCount) || 0;
  const franchise = Number(body.franchise) || 0;
  const individual = Number(body.individual) || 0;
  const bakery = Number(body.bakery) || 0;
  const newOpen = Number(body.newOpen) || 0;
  const closed = Number(body.closed) || 0;
  // 평당 월세: body.rentPerPyeong 우선 → kosisBoxData fallback (integratedRent → marketRent)
  // [unit-safe] integratedRent.unit이 '만원/평'이면 그대로, '원/평'이면 /10000. marketRent는 항상 '원/평'.
  const _ir = kbd.integratedRent;
  const _irManwon = _ir?.value
    ? (typeof _ir.unit === 'string' && _ir.unit.indexOf('만원') >= 0
        ? Math.round(_ir.value)
        : Math.round(_ir.value / 10000))
    : 0;
  const rentRaw = Number(body.rentPerPyeong) || _irManwon || (kbd.marketRent?.value ? Math.round(kbd.marketRent.value / 10000) : 0);
  const rentPerPyeong = rentRaw;
  // 공실률: body.vacancyRate 우선 → kosisBoxData.vacancy.value fallback
  const vacancyRate = Number(body.vacancyRate) || Number(kbd.vacancy?.value) || 0;
  // 임대가격지수 전년대비
  const priceChange = Number(body.priceChange) || Number(kbd.priceChange?.value) || 0;
  const rentSeries = Array.isArray(body.rentSeries) ? body.rentSeries : (kbd.marketRentSeries?.series || null);
  const vacancySeries = Array.isArray(body.vacancySeries) ? body.vacancySeries : (kbd.vacancySeries?.series || null);
  const priceSeries = Array.isArray(body.priceSeries) ? body.priceSeries : (kbd.priceIndexSeries?.series || null);
  const onMapClick = body.onMapClick;

  // 도넛 비율 (개인/프랜차이즈/베이커리)
  const donutSegments = (() => {
    const segs = [];
    const total = individual + franchise + bakery;
    if (total === 0) return [];
    if (individual > 0) segs.push({ value: Math.round(individual / total * 100), color: '#4C7BE4', label: '개인 카페' });
    if (franchise > 0) segs.push({ value: Math.round(franchise / total * 100), color: '#FFFFFF', label: '프랜차이즈' });
    if (bakery > 0) segs.push({ value: Math.round(bakery / total * 100), color: '#7a7a7a', label: '베이커리' });
    return segs;
  })();
  const indiePct = donutSegments.find(s => s.label === '개인 카페')?.value ?? 0;
  const fcPct = donutSegments.find(s => s.label === '프랜차이즈')?.value ?? 0;
  const bkPct = donutSegments.find(s => s.label === '베이커리')?.value ?? 0;

  // YoY 표시 (KOSIS 임대가격지수 변화율)
  const rentDelta = priceChange ? `${priceChange > 0 ? '+' : ''}${priceChange.toFixed(1)}` : '0';
  const vacancyDelta = (() => {
    if (!vacancySeries || vacancySeries.length < 2) return '0';
    const last = vacancySeries[vacancySeries.length - 1]?.value ?? vacancyRate;
    const prev = vacancySeries[0]?.value ?? vacancyRate;
    const d = last - prev;
    return `${d > 0 ? '+' : ''}${d.toFixed(1)}`;
  })();
  const newOpenDelta = closed > 0 && newOpen > 0
    ? `${newOpen > closed ? '+' : ''}${Math.round(((newOpen - closed) / closed) * 100)}`
    : (newOpen > 0 ? '+신규' : '0');

  // mini 차트 (있으면 KOSIS 시계열, 없으면 균등)
  // [unit-safe] marketRentSeries.series는 이미 '만원/평' 단위(dataMapper extractMarketRentSeries)
  const rentSpark = rentSeries
    ? rentSeries.map(s => Math.round(s.value || 0)).filter(v => v > 0)
    : (rentPerPyeong > 0 ? [rentPerPyeong] : []);
  const vacancySpark = vacancySeries
    ? vacancySeries.map(s => s.value || 0).filter(v => v > 0)
    : (vacancyRate > 0 ? [vacancyRate] : []);
  const priceSpark = priceSeries
    ? priceSeries.map(s => s.value || 0).filter(v => v > 0)
    : [];

  return (
    <CardShell n="01" id="01"
      title="상권 분석 리포트"
      sub="반경 500m 매장 구성과 임대 시세"
      sources={["오픈업/카카오/네이버", "한국부동산원 (KOSIS 408)"]}
      headerRight={onMapClick ? <MapTriggerButton onClick={onMapClick}/> : <MapTriggerButton/>}>
      <div className="bc-grid-4" style={{gap:16, marginBottom:16}}>
        <StatTile id="c1.tile1" tone="blue"  label="총 카페 수"   value={String(cafeCount)} unit="개" hero/>
        <StatTile id="c1.tile2" tone="lilac" label="프랜차이즈"   value={String(franchise)} unit="개"/>
        <StatTile id="c1.tile3" tone="mint"  label="평당 월세"    value={rentPerPyeong > 0 ? String(rentPerPyeong) : '-'} unit={rentPerPyeong > 0 ? '만원' : ''} delta={rentPerPyeong > 0 ? rentDelta : undefined} deltaPositive={priceChange >= 0} deltaPrefixDisabled/>
        <StatTile id="c1.tile4" tone="rose"  label="공실률"       value={vacancyRate > 0 ? vacancyRate.toFixed(1) : '-'} unit={vacancyRate > 0 ? '%' : ''} delta={vacancyRate > 0 ? vacancyDelta : undefined} deltaPositive={(() => { const last = vacancySeries?.[vacancySeries.length-1]?.value ?? vacancyRate; const prev = vacancySeries?.[0]?.value ?? vacancyRate; return (last - prev) <= 0; })()} deltaPrefixDisabled/>
      </div>

      <div style={{display:"grid", gridTemplateColumns:"1fr 1fr", gap:16}}>
        <div className="bc-box" style={{padding:18}}>
          <div style={{fontSize:15, fontWeight:600, marginBottom:12}}>매장</div>
          <div className="bc-grid-3" style={{gap:10}}>
            {[
              ["카페", String(cafeCount), "blue"],
              ["프랜차이즈", String(franchise), "lilac"],
              ["개인 카페", String(individual), "mint"],
              ["베이커리", String(bakery), "cream"],
              ["신규 (1년)", String(newOpen), "mint"],
              ["폐업 (1년)", String(closed), "rose"],
            ].map(([l, v, t]) => (
              <div key={l} className={`bc-tile tone-${t}`} style={{padding:"14px 16px", minHeight:72, gap:4}}>
                <div className="label" style={{fontSize:15}}>{l}</div>
                <div className="value" style={{fontSize:22}}>{v}<span className="unit" style={{fontSize:15}}>개</span></div>
              </div>
            ))}
          </div>
        </div>

        <div className="bc-box" style={{padding:18}}>
          <div style={{fontSize:15, fontWeight:600, marginBottom:12}}>카페 비율</div>
          {donutSegments.length > 0 ? (
            <div style={{display:"flex", alignItems:"center", gap:18, justifyContent:"center"}}>
              <Donut id="c1.donut" size={200} segments={donutSegments} centerLabel={String(cafeCount)} centerSub="카페 매장"/>
              <DonutLegend segments={[
                ...(indiePct > 0 ? [{value:indiePct, color:"#4C7BE4", label:"개인", text:`${indiePct}%`}] : []),
                ...(fcPct > 0 ? [{value:fcPct, color:"#FFFFFF", label:"프랜차이즈", text:`${fcPct}%`}] : []),
                ...(bkPct > 0 ? [{value:bkPct, color:"#7a7a7a", label:"베이커리", text:`${bkPct}%`}] : []),
              ]}/>
            </div>
          ) : (
            <div style={{fontSize:14, color:"var(--matte-fg-3)", textAlign:"center", padding:"40px 0"}}>카페 데이터 수집 중</div>
          )}
        </div>
      </div>

      <div className="bc-grid-3" style={{gap:12, marginTop:16}}>
        {[
          { l:"평당 월세", v: rentPerPyeong > 0 ? `${rentPerPyeong}만원` : '-', d: rentDelta + '%', color:"#FFFFFF", data: rentSpark },
          { l:"공실률",   v: vacancyRate > 0 ? `${vacancyRate.toFixed(1)}%` : '-', d: vacancyDelta + '%p', color:"#FFFFFF", data: vacancySpark },
          { l:"신규 개업", v: `${newOpen}개`, d: newOpenDelta + '%', color:"#4C7BE4", data: priceSpark.length > 0 ? priceSpark : [Math.max(0, newOpen - closed), newOpen] },
        ].map((t, i) => (
          <div key={i} className="bc-box" style={{padding:18}}>
            <div style={{display:"flex", justifyContent:"space-between", alignItems:"baseline", marginBottom:10}}>
              <span style={{fontSize:14, color:"var(--matte-fg-3)", fontWeight:500}}>{t.l}</span>
              <span style={{fontSize:14, color: t.color === "#4C7BE4" ? "#4C7BE4" : "var(--matte-fg-2)", fontWeight:600, fontVariantNumeric:"tabular-nums"}}>{t.d}</span>
            </div>
            <div style={{fontSize:24, fontWeight:700, marginBottom:14, fontVariantNumeric:"tabular-nums", letterSpacing:"-0.01em"}}>{t.v}</div>
            {t.data.length > 1 ? (
              <Sparkline data={t.data} height={56} color={t.color}/>
            ) : (
              <div style={{height:56, display:"flex", alignItems:"center", color:"var(--matte-fg-4)", fontSize:13}}>
                {t.data.length === 1 ? '추이 데이터 부족' : '전기 대비 변동 없음'}
              </div>
            )}
          </div>
        ))}
      </div>
    </CardShell>
  );
}
