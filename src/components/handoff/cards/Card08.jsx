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
      <div className="bc-grid-4" style={{gap:16, marginBottom:16}}>
        <StatTile id="c8.tile1" tone="blue"  label="통합 평당 월세" value={rentPerPyeong > 0 ? String(rentPerPyeong) : '-'} unit={rentPerPyeong > 0 ? '만원' : ''} hero/>
        <StatTile id="c8.tile2" tone="lilac" label="평균 보증금"   value={deposit > 0 ? `${(deposit / 10000).toFixed(2)}` : '-'} unit={deposit > 0 ? '억' : ''}/>
        <StatTile id="c8.tile3" tone="mint"  label="총 창업 (15평)" value={totalStartupCost > 0 ? `${(totalStartupCost / 10000).toFixed(2)}` : (simTotal > 0 ? `${(simTotal / 10000).toFixed(2)}` : '-')} unit={(totalStartupCost > 0 || simTotal > 0) ? '억' : ''}/>
        <StatTile id="c8.tile4" tone="rose"  label="권리금"  value={premiumManwon > 0 ? `${(premiumManwon / 10000).toFixed(1)}` : '-'} unit={premiumManwon > 0 ? '억' : ''}/>
      </div>

      <div style={{display:"grid", gridTemplateColumns:"1fr 1fr", gap:16}}>
        <div className="bc-box" style={{padding:18}}>
          <div style={{fontSize:15, fontWeight:600, marginBottom:12}}>한국부동산원 임대 4종</div>
          <div className="bc-grid-2" style={{gap:10}}>
            <Box label="평당 월세" value={marketRent > 0 ? String(marketRent) : '-'} unit={marketRent > 0 ? '만/평' : ''} sub={kosisRegion || ''} src={kosisPeriod}/>
            <Box label="전환율"   value={conversionRate > 0 ? conversionRate.toFixed(1) : '-'} unit={conversionRate > 0 ? '%' : ''} src={kosisPeriod}/>
            <Box label="수익률"   value={yieldRate > 0 ? yieldRate.toFixed(1) : '-'} unit={yieldRate > 0 ? '%' : ''} sub="순영업소득 기준" src={kosisPeriod}/>
            <Box label="순영업소득"
                 value={
                   netIncomeUnit === '%' && netIncomePct > 0
                     ? netIncomePct.toFixed(1)
                     : (netIncome > 0
                         ? (netIncome >= 10000
                             ? Math.round(netIncome / 10000).toLocaleString()
                             : Math.round(netIncome).toLocaleString())
                         : '-')
                 }
                 unit={
                   netIncomeUnit === '%' && netIncomePct > 0
                     ? '%'
                     : (netIncome > 0 ? (netIncome >= 10000 ? '만/평/년' : '원/평/년') : '')
                 }
                 sub={netIncomeUnit === '%' ? '임대수입 대비' : ''}
                 src={kosisPeriod}/>
          </div>
        </div>

        <div className="bc-box" style={{padding:18}}>
          <div style={{fontSize:15, fontWeight:600, marginBottom:12}}>전국 카페 평균 (KOSIS 114)</div>
          {kc ? (
            <>
              <div className="bc-grid-3" style={{gap:8}}>
                <Box label="인테리어비" value={kc.interiorAvg > 0 ? kc.interiorAvg.toLocaleString() : '-'} unit={kc.interiorAvg > 0 ? '만' : ''}/>
                <Box label="총 투자비"  value={kc.startupInvestAvg > 0 ? `${(kc.startupInvestAvg / 10000).toFixed(2)}` : '-'} unit={kc.startupInvestAvg > 0 ? '억' : ''}/>
                <Box label="평수"       value={kc.avgAreaPyeong > 0 ? kc.avgAreaPyeong.toFixed(1) : '-'} unit={kc.avgAreaPyeong > 0 ? '평' : ''}/>
                <Box label="월 매출"    value={kc.salesAvg > 0 ? kc.salesAvg.toLocaleString() : '-'} unit={kc.salesAvg > 0 ? '만' : ''}/>
                <Box label="객단가"     value={kc.unitPriceAvg > 0 ? kc.unitPriceAvg.toLocaleString() : '-'} unit={kc.unitPriceAvg > 0 ? '원' : ''}/>
                <Box label="이익률"     value={kc.profitMargin > 0 ? kc.profitMargin.toFixed(1) : '-'} unit={kc.profitMargin > 0 ? '%' : ''}/>
              </div>
              <div style={{fontSize:13, color:"var(--matte-fg-4)", marginTop:8}}>외식업체경영실태조사 {kc.year || ''}</div>
            </>
          ) : (
            <div style={{fontSize:13, color:"var(--matte-fg-4)", padding:"20px 0"}}>KOSIS 카페 평균 데이터 수집 중</div>
          )}
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
          <div className="bc-grid-3" style={{gap:12, marginTop:20}}>
            <div style={{padding:"16px 18px", background:"rgba(255,255,255,0.03)", borderRadius:10, border:"1px solid var(--matte-line)"}}>
              <div style={{fontSize:13, color:"var(--matte-fg-3)", marginBottom:6, fontWeight:500}}>월 임대료</div>
              <div style={{fontSize:22, fontWeight:700, fontVariantNumeric:"tabular-nums", letterSpacing:"-0.01em"}}>{monthly > 0 ? monthly.toLocaleString() : '-'}<span style={{fontSize:13, color:"var(--matte-fg-3)", marginLeft:3, fontWeight:500}}>{monthly > 0 ? '만' : ''}</span></div>
            </div>
            <div style={{padding:"16px 18px", background:"rgba(255,255,255,0.03)", borderRadius:10, border:"1px solid var(--matte-line)"}}>
              <div style={{fontSize:13, color:"var(--matte-fg-3)", marginBottom:6, fontWeight:500}}>보증금</div>
              <div style={{fontSize:22, fontWeight:700, fontVariantNumeric:"tabular-nums", letterSpacing:"-0.01em"}}>{simDeposit > 0 ? `${(simDeposit/10000).toFixed(2)}` : '-'}<span style={{fontSize:13, color:"var(--matte-fg-3)", marginLeft:3, fontWeight:500}}>{simDeposit > 0 ? '억' : ''}</span></div>
            </div>
            <div style={{padding:"16px 18px", background:"rgba(84,120,201,0.10)", borderRadius:10, border:"1px solid rgba(84,120,201,0.45)"}}>
              <div style={{fontSize:13, color:"var(--matte-fg-3)", marginBottom:6, fontWeight:500}}>총 창업비</div>
              <div style={{fontSize:22, fontWeight:700, color:"#4C7BE4", fontVariantNumeric:"tabular-nums", letterSpacing:"-0.01em"}}>{simTotal > 0 ? `${(simTotal/10000).toFixed(2)}` : '-'}<span style={{fontSize:13, color:"var(--matte-fg-3)", marginLeft:3, fontWeight:500}}>{simTotal > 0 ? '억' : ''}</span></div>
            </div>
          </div>
          {premiumManwon > 0 && premiumOk && (
            <div style={{marginTop:14, fontSize:13, color:"var(--matte-fg-3)"}}>{premiumOk} 기준 권리금 평균 {premiumManwon.toLocaleString()}만원 포함</div>
          )}
        </div>
      </div>
    </CardShell>
  );
}
