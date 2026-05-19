/* Card08 — 임대/창업 정보 (시뮬레이터 + KOSIS 박스) */

import React, { useState } from 'react';
import { CardShell, StatTile, Box } from '../Shared.jsx';

export default function Card08({ body = {} }) {
  const bodyData = body.bodyData || {};
  const chartData = body.chartData || {};
  const kosis = body.kosisBoxData || {};

  // 통합 임대료 (kosisBoxData.integratedRent.value 만원/평) → 폴백: bodyData.rentPerPyeong
  const rentPerPyeong = Number(kosis?.integratedRent?.value) || Number(bodyData.rentPerPyeong) || 0;
  const deposit = Number(bodyData.deposit) || 0;
  const interiorCost = Number(bodyData.interiorCost) || 0;
  const equipmentCost = Number(bodyData.equipmentCost) || 0;
  const totalStartupCost = Number(bodyData.totalStartupCost) || 0;

  // KOSIS 박스 4종 (kosisBoxData)
  const marketRent = kosis?.marketRent?.value ? Math.round(kosis.marketRent.value / 10000) : 0;
  const conversionRate = kosis?.conversionRate?.value || 0;
  const yieldRate = kosis?.yieldRate?.value || 0;
  const netIncome = kosis?.netIncome?.value || 0;
  const netIncomeUnit = kosis?.netIncome?.unit || '원/평/년';
  const netIncomePct = kosis?.netIncome?.noiPct || 0;
  const kosisPeriod = kosis?.marketRent?.period || kosis?.yieldRate?.period || '';
  const kosisRegion = kosis?.marketRent?.region || '';

  // KOSIS 외식업 카페 평균 (chartData.kosisCafe)
  const kc = chartData.kosisCafe || null;

  // 권리금 (chartData.premium 우선 → bodyData.premium 폴백)
  const premium = chartData.premium || bodyData.premium || null;
  const premiumValue = Number(premium?.value) || Number(bodyData.premiumCost) || 0;          // 원 단위
  const premiumManwon = premiumValue > 0 ? Math.round(premiumValue / 10000) : 0;
  const premiumOk = premium?.region || '';

  // 시뮬레이터 (사용자가 평수 조정)
  const [pyeong, setPyeong] = useState(15);
  const monthly = rentPerPyeong > 0 ? Math.round(pyeong * rentPerPyeong) : 0;
  const simDeposit = (deposit > 0 ? deposit : (rentPerPyeong > 0 ? rentPerPyeong * 30 : 0)) * (pyeong / 15);
  const simInterior = (interiorCost > 0 ? interiorCost : (kc?.interiorPerPyeong > 0 ? kc.interiorPerPyeong * pyeong : pyeong * 350)) * 1;
  const simTotal = simDeposit + simInterior + (premiumManwon || 3000);

  return (
    <CardShell n="08" id="08"
      title="임대/창업 정보"
      sub="상가 시세 및 창업 비용"
      sources={["한국부동산원 (KOSIS 408)", "농림축산식품부 외식업체경영실태조사", "중소벤처기업부 상가건물임대차실태조사", "자체 수집기"]}>
      {/* [2026-05-19] 메모리 절대 규칙: "-" 표시 금지 → NULL 타일은 자체 숨김 */}
      <div className="bc-grid-4" style={{gap:16, marginBottom:16}}>
        {rentPerPyeong > 0 && <StatTile id="c8.tile1" tone="blue"  label="통합 평당 월세" value={String(rentPerPyeong)} unit="만원" hero/>}
        {deposit > 0 && <StatTile id="c8.tile2" tone="lilac" label="평균 보증금"   value={(deposit / 10000).toFixed(2)} unit="억"/>}
        {(totalStartupCost > 0 || simTotal > 0) && <StatTile id="c8.tile3" tone="mint"  label="총 창업 (15평)" value={totalStartupCost > 0 ? (totalStartupCost / 10000).toFixed(2) : (simTotal / 10000).toFixed(2)} unit="억"/>}
        {premiumManwon > 0 && <StatTile id="c8.tile4" tone="rose"  label="권리금"  value={(premiumManwon / 10000).toFixed(1)} unit="억"/>}
      </div>

      <div style={{display:"grid", gridTemplateColumns:"1fr 1fr", gap:16}}>
        <div className="bc-box" style={{padding:18}}>
          <div style={{fontSize:15, fontWeight:600, marginBottom:12}}>한국부동산원 임대 4종</div>
          {/* [2026-05-19] NULL 박스 숨김 (메모리 절대 규칙) */}
          <div className="bc-grid-2" style={{gap:10}}>
            {marketRent > 0 && <Box label="평당 월세" value={String(marketRent)} unit="만/평" sub={kosisRegion || ''} src={kosisPeriod}/>}
            {conversionRate > 0 && <Box label="전환율"   value={conversionRate.toFixed(1)} unit="%" src={kosisPeriod}/>}
            {yieldRate > 0 && <Box label="수익률"   value={yieldRate.toFixed(1)} unit="%" sub="순영업소득 기준" src={kosisPeriod}/>}
            {((netIncomeUnit === '%' && netIncomePct > 0) || netIncome > 0) && (
              <Box label="순영업소득"
                   value={
                     netIncomeUnit === '%' && netIncomePct > 0
                       ? netIncomePct.toFixed(1)
                       : (netIncome >= 10000
                           ? Math.round(netIncome / 10000).toLocaleString()
                           : Math.round(netIncome).toLocaleString())
                   }
                   unit={
                     netIncomeUnit === '%' && netIncomePct > 0
                       ? '%'
                       : (netIncome >= 10000 ? '만/평/년' : '원/평/년')
                   }
                   sub={netIncomeUnit === '%' ? '임대수입 대비' : ''}
                   src={kosisPeriod}/>
            )}
          </div>
        </div>

        <div className="bc-box" style={{padding:18}}>
          <div style={{fontSize:15, fontWeight:600, marginBottom:12}}>전국 카페 평균 (KOSIS 114)</div>
          {(() => {
            // [2026-05-19 회귀롤백] e8ad0a9 의 NF 폴백 일괄적용 코드가 단위/표시 망가뜨림 →
            // a7e82cd 시점 로직으로 복구하되, 메모리 절대규칙(- 표시 금지)을 지키기 위해
            // kc.* 값이 없는 칸은 박스 자체를 숨김 (조건부 렌더링).
            if (!kc) return null;
            const _interior = kc.interiorAvg > 0
              ? kc.interiorAvg
              : ((kc.interiorPerPyeong > 0 && kc.avgAreaPyeong > 0) ? Math.round(kc.interiorPerPyeong * kc.avgAreaPyeong) : 0);
            const _startupBil = kc.startupInvestAvg > 0 ? (kc.startupInvestAvg / 10000) : 0;
            const _areaPy = kc.avgAreaPyeong > 0 ? kc.avgAreaPyeong : 0;
            const _sales = kc.salesAvg > 0 ? kc.salesAvg : 0;
            const _unit = kc.unitPriceAvg > 0 ? kc.unitPriceAvg : 0;
            const _profit = kc.profitMargin > 0 ? kc.profitMargin : 0;
            const _year = kc.year || '';
            return (
              <>
                <div className="bc-grid-3" style={{gap:8}}>
                  {_interior > 0 && <Box label="인테리어비" value={_interior.toLocaleString()} unit="만원"/>}
                  {_startupBil > 0 && <Box label="총 투자비"  value={_startupBil.toFixed(2)} unit="억"/>}
                  {_areaPy > 0 && <Box label="평수"       value={_areaPy.toFixed(1)} unit="평"/>}
                  {_sales > 0 && <Box label="월 매출"    value={_sales.toLocaleString()} unit="만원"/>}
                  {_unit > 0 && <Box label="객단가"     value={_unit.toLocaleString()} unit="원"/>}
                  {_profit > 0 && <Box label="이익률"     value={_profit.toFixed(1)} unit="%"/>}
                </div>
                {_year && <div style={{fontSize:13, color:"var(--matte-fg-4)", marginTop:8}}>외식업체경영실태조사 {_year}</div>}
              </>
            );
          })()}
        </div>
      </div>

      <div style={{display:"grid", gridTemplateColumns:"1fr 1fr", gap:16, marginTop:16}}>
        <div className="bc-box" style={{padding:24}}>
          <div style={{fontSize:16, fontWeight:600, marginBottom:18}}>인테리어 비용 분포 <span style={{fontSize:13, color:"var(--matte-fg-3)", fontWeight:500, marginLeft:8}}>{pyeong}평 기준</span></div>
          <div style={{display:"flex", flexDirection:"column", gap:10}}>
          {(() => {
            // 평당 단가 기반 5단계 (KOSIS 평당 단가 ~250만원)
            const perPy = kc?.interiorPerPyeong > 0 ? kc.interiorPerPyeong : 350;
            const tiers = [
              ["셀프", perPy * 0.4 * pyeong, false],
              ["최소 시공", perPy * 0.7 * pyeong, false],
              ["평균 시공", perPy * 1.0 * pyeong, true],
              ["고급 시공", perPy * 1.5 * pyeong, false],
              ["프리미엄", perPy * 2.5 * pyeong, false],
            ];
            const tMax = Math.max(...tiers.map(t => t[1]));
            return tiers.map(([l, v, acc]) => {
              const valStr = v >= 10000 ? `${(v / 10000).toFixed(2)}억` : `${Math.round(v).toLocaleString()}만`;
              const pct = Math.round((v / tMax) * 100);
              return (
                <div key={l} style={{display:"grid", gridTemplateColumns:"110px 1fr 90px", gap:12, alignItems:"center"}}>
                  <span style={{fontSize:14, color: acc ? "#4C7BE4" : "var(--matte-fg-2)", fontWeight: acc ? 700 : 500}}>{l}</span>
                  <div className="bc-bar" style={{height:12, background:"rgba(255,255,255,0.05)"}}><div style={{width:`${pct}%`, background: acc ? "#4C7BE4" : "#FFFFFF", height:"100%", borderRadius:"inherit"}}></div></div>
                  <span style={{fontSize:14, textAlign:"right", fontVariantNumeric:"tabular-nums", color: acc ? "#4C7BE4" : "var(--matte-fg)", fontWeight:700}}>{valStr}</span>
                </div>
              );
            });
          })()}
          </div>
          <div style={{fontSize:13, color:"var(--matte-fg-3)", marginTop:16, paddingTop:14, borderTop:"1px solid var(--matte-line)"}}>평균 시공 권장 — 평당 {kc?.interiorPerPyeong > 0 ? kc.interiorPerPyeong.toLocaleString() : '~350'}만원 기준 (KOSIS 외식업체경영실태조사)</div>
        </div>

        <div className="bc-box" style={{padding:24, background:"linear-gradient(135deg, rgba(84,120,201,0.10), transparent 60%)", border:"1px solid rgba(84,120,201,0.45)"}}>
          <div style={{display:"flex", justifyContent:"space-between", alignItems:"baseline", marginBottom:14}}>
            <div style={{fontSize:16, fontWeight:700, color:"#4C7BE4"}}>내 카페 시뮬레이터</div>
            <div style={{fontSize:14, color:"var(--matte-fg-2)", fontWeight:600}}><strong style={{fontSize:18, color:"#fff"}}>{pyeong}</strong> 평</div>
          </div>
          <input type="range" min="5" max="60" value={pyeong} onChange={e=>setPyeong(+e.target.value)} style={{width:"100%", accentColor:"#4C7BE4"}}/>
          <div style={{display:"flex", justifyContent:"space-between", fontSize:13, color:"var(--matte-fg-4)", marginTop:6}}>
            <span>5평</span><span>15</span><span>30</span><span>45</span><span>60평</span>
          </div>
          {/* [2026-05-19] NULL 박스 숨김 (메모리 절대 규칙). 시뮬레이터는 보통 항상 값이 있으나 안전장치. */}
          <div className="bc-grid-3" style={{gap:12, marginTop:20}}>
            {monthly > 0 && (
              <div style={{padding:"16px 18px", background:"rgba(255,255,255,0.03)", borderRadius:10, border:"1px solid var(--matte-line)"}}>
                <div style={{fontSize:13, color:"var(--matte-fg-3)", marginBottom:6, fontWeight:500}}>월 임대료</div>
                <div style={{fontSize:22, fontWeight:700, fontVariantNumeric:"tabular-nums", letterSpacing:"-0.01em"}}>{monthly.toLocaleString()}<span style={{fontSize:13, color:"var(--matte-fg-3)", marginLeft:3, fontWeight:500}}>만</span></div>
              </div>
            )}
            {simDeposit > 0 && (
              <div style={{padding:"16px 18px", background:"rgba(255,255,255,0.03)", borderRadius:10, border:"1px solid var(--matte-line)"}}>
                <div style={{fontSize:13, color:"var(--matte-fg-3)", marginBottom:6, fontWeight:500}}>보증금</div>
                <div style={{fontSize:22, fontWeight:700, fontVariantNumeric:"tabular-nums", letterSpacing:"-0.01em"}}>{(simDeposit/10000).toFixed(2)}<span style={{fontSize:13, color:"var(--matte-fg-3)", marginLeft:3, fontWeight:500}}>억</span></div>
              </div>
            )}
            {simTotal > 0 && (
              <div style={{padding:"16px 18px", background:"rgba(84,120,201,0.10)", borderRadius:10, border:"1px solid rgba(84,120,201,0.45)"}}>
                <div style={{fontSize:13, color:"var(--matte-fg-3)", marginBottom:6, fontWeight:500}}>총 창업비</div>
                <div style={{fontSize:22, fontWeight:700, color:"#4C7BE4", fontVariantNumeric:"tabular-nums", letterSpacing:"-0.01em"}}>{(simTotal/10000).toFixed(2)}<span style={{fontSize:13, color:"var(--matte-fg-3)", marginLeft:3, fontWeight:500}}>억</span></div>
              </div>
            )}
          </div>
          {premiumManwon > 0 && premiumOk && (
            <div style={{marginTop:14, fontSize:13, color:"var(--matte-fg-3)"}}>{premiumOk} 기준 권리금 평균 {premiumManwon.toLocaleString()}만원 포함</div>
          )}
        </div>
      </div>
    </CardShell>
  );
}
