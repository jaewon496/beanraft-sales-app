/* Card02 — 고객 분석 (방문 고객 특성) */

import React from 'react';
import { CardShell, StatTile } from '../Shared.jsx';
import { VBars } from '../Charts.jsx';
import { DrStagger } from '../director/DirectorAnim.jsx';

export default function Card02({ body = {} }) {
  const bodyData = body.bodyData || {};
  const chartData = body.chartData || {};
  const topAge = body.topAge || bodyData.topAge || '-';
  const maleRatio = Number(body.maleRatio ?? chartData.male) || 0;
  const femaleRatio = Number(body.femaleRatio ?? chartData.female) || 0;
  const newCustomerPct = Number(bodyData.newCustomer) || 0;
  const regularPct = Number(bodyData.regular) || 0;
  const weekdayPct = Number(body.weekdayPct) || 0;
  const weekendPct = Number(body.weekendPct) || 0;
  const peakHour = body.peakHour || '-';

  // ageGroups: chartData.ageGroups = [{name, pct}, ...] (4 buckets)
  const ageGroups = Array.isArray(chartData.ageGroups) && chartData.ageGroups.length > 0
    ? chartData.ageGroups
    : [];

  // 라이프스타일 키워드 (bodyData.maleLifestyle/femaleLifestyle = "키워드(20.5%), ..." 형태)
  const parseLifeStr = (s) => {
    if (!s || typeof s !== 'string') return [];
    return s.split(',').map(t => {
      const m = t.trim().match(/^(.+?)\s*\(([\d.]+)%\)$/);
      return m ? m[1].trim() : t.trim();
    }).filter(Boolean).slice(0, 5);
  };
  const maleKw = parseLifeStr(bodyData.maleLifestyle);
  const femaleKw = parseLifeStr(bodyData.femaleLifestyle);

  // 평균 소득 (bodyData.customerYrEarn = {male, female} 또는 bodyData.earnAmt 문자열)
  const earn = bodyData.customerYrEarn || null;
  const maleIncome = Number(earn?.male) || 0;       // 만원/년 단위 → 월로 환산: ÷12
  const femaleIncome = Number(earn?.female) || 0;
  const maleMonthly = maleIncome > 0 ? Math.round(maleIncome / 12) : 0;
  const femaleMonthly = femaleIncome > 0 ? Math.round(femaleIncome / 12) : 0;
  const incomeMax = Math.max(maleMonthly, femaleMonthly, 100);

  return (
    <CardShell n="02" id="02"
      title="고객 분석"
      sub="방문 고객 특성"
      sources={["나이스비즈맵", "오픈업", "소상공인진흥공단"]}>
      <div className="bc-grid-4" style={{gap:16, marginBottom:16}}>
        <StatTile id="c2.tile1" tone="blue"  label="주요 연령대"   value={topAge} hero accent/>
        <StatTile id="c2.tile2" tone="lilac" label="성비 (남:여)" value={maleRatio > 0 ? `${maleRatio} : ${femaleRatio}` : '-'}/>
        <StatTile id="c2.tile3" tone="mint"  label="단골" value={regularPct > 0 ? regularPct.toFixed(1) : '-'} unit={regularPct > 0 ? '%' : ''}/>
        <StatTile id="c2.tile4" tone="cream" label="신규" value={newCustomerPct > 0 ? newCustomerPct.toFixed(1) : '-'} unit={newCustomerPct > 0 ? '%' : ''}/>
      </div>

      <div style={{display:"grid", gridTemplateColumns:"1.2fr 1fr", gap:16}}>
        <div className="bc-box" style={{padding:24}}>
          <div style={{fontSize:16, fontWeight:600, marginBottom:18}}>연령대 분포</div>
          {ageGroups.length > 0 ? (() => {
            // [2026-05-19] topAge 매칭 보강: "30대 (28%)" 같은 괄호 표기 + 직접 매칭 실패 시 최대값 인덱스 사용
            const _topBase = (topAge || '').replace(/\s*\([^)]*\)\s*$/, '').trim();
            let _accIdx = ageGroups.findIndex(g => g.name === _topBase || g.name === topAge);
            if (_accIdx < 0 && _topBase) {
              const _topNum = (_topBase.match(/\d+/) || [])[0];
              if (_topNum) _accIdx = ageGroups.findIndex(g => (String(g.name).match(/\d+/) || [])[0] === _topNum);
            }
            if (_accIdx < 0) {
              let _maxV = -1, _maxI = 0;
              ageGroups.forEach((g, idx) => { const v = Number(g.pct) || 0; if (v > _maxV) { _maxV = v; _maxI = idx; } });
              _accIdx = _maxI;
            }
            return (
              <VBars id="c2.bars" accent={_accIdx} barW={48} gap={28} height={200} items={ageGroups.map(g => ({
                l: g.name, v: g.pct, t: `${g.pct}%`
              }))}/>
            );
          })() : (
            <div style={{fontSize:14, color:"var(--matte-fg-3)", textAlign:"center", padding:"40px 0"}}>연령대 데이터 수집 중</div>
          )}
          <div style={{marginTop:24, paddingTop:20, borderTop:"1px solid var(--matte-line)"}}>
            <div style={{fontSize:14, color:"var(--matte-fg-3)", fontWeight:500, marginBottom:14}}>방문 손님 평균 소득 (월 환산)</div>
            {(maleMonthly > 0 || femaleMonthly > 0) ? (
              <div style={{display:"flex", flexDirection:"column", gap:14}}>
                {[
                  ["남성", maleMonthly],
                  ["여성", femaleMonthly],
                ].filter(([, v]) => v > 0).map(([who, v]) => (
                  <div key={who} style={{display:"grid", gridTemplateColumns:"60px 1fr 90px", gap:14, alignItems:"center"}}>
                    <span style={{fontSize:15, color:"var(--matte-fg-2)", fontWeight:500}}>{who}</span>
                    <div className="bc-bar" style={{height:14, background:"rgba(255,255,255,0.05)"}}>
                      <div style={{width:`${(v/incomeMax)*100}%`, background:"#FFFFFF", height:"100%", borderRadius:"inherit"}}></div>
                    </div>
                    <span style={{textAlign:"right", fontSize:17, fontWeight:700, fontVariantNumeric:"tabular-nums"}}>{v.toLocaleString()}<span style={{fontSize:13, color:"var(--matte-fg-3)", fontWeight:500, marginLeft:3}}>만원</span></span>
                  </div>
                ))}
              </div>
            ) : (
              <div style={{fontSize:13, color:"var(--matte-fg-4)"}}>{bodyData.earnAmt || '소득 데이터 없음'}</div>
            )}
          </div>
        </div>

        <div className="bc-box" style={{padding:24}}>
          <div style={{fontSize:16, fontWeight:600, marginBottom:20}}>라이프스타일 키워드</div>
          <div style={{display:"flex", flexDirection:"column", gap:16}}>
            {[
              ["여성", femaleRatio > 0 ? `${femaleRatio}%` : '', femaleKw],
              ["남성", maleRatio > 0 ? `${maleRatio}%` : '', maleKw],
            ].filter(([, , kws]) => kws.length > 0).map(([who, ratio, keywords]) => (
              <div key={who} style={{padding:"20px 22px", background:"rgba(255,255,255,0.03)", borderRadius:12, border:"1px solid var(--matte-line)"}}>
                <div style={{display:"flex", justifyContent:"space-between", alignItems:"baseline", marginBottom:14}}>
                  <span style={{fontSize:16, fontWeight:700, color:"#fff"}}>{who}</span>
                  {ratio && <span style={{fontSize:14, color:"var(--matte-fg-3)", fontWeight:600, fontVariantNumeric:"tabular-nums"}}>{ratio}</span>}
                </div>
                <DrStagger id={`c2.chips.${who}`} delay={50} style={{display:"flex", gap:8, flexWrap:"wrap"}}>
                  {keywords.map(k => (
                    <span key={k} style={{padding:"7px 14px", background:"rgba(255,255,255,0.06)", border:"1px solid var(--matte-line)", borderRadius:8, fontSize:14, color:"var(--matte-fg-2)", fontWeight:500}}>#{k}</span>
                  ))}
                </DrStagger>
              </div>
            ))}
            {(maleKw.length === 0 && femaleKw.length === 0) && (
              <div style={{fontSize:13, color:"var(--matte-fg-4)", padding:"20px"}}>라이프스타일 데이터 수집 중</div>
            )}
            <div style={{paddingTop:16, borderTop:"1px solid var(--matte-line)", display:"grid", gridTemplateColumns:"1fr 1fr", gap:14}}>
              <div>
                <div style={{fontSize:13, color:"var(--matte-fg-3)", marginBottom:6, fontWeight:500}}>주중 vs 주말</div>
                <div style={{fontSize:18, fontWeight:700, fontVariantNumeric:"tabular-nums"}}>
                  {weekdayPct > 0 || weekendPct > 0
                    ? <>{Math.round(weekdayPct)} <span style={{fontSize:13, color:"var(--matte-fg-3)", fontWeight:500}}>:</span> {Math.round(weekendPct)}</>
                    : '-'}
                </div>
              </div>
              <div>
                <div style={{fontSize:13, color:"var(--matte-fg-3)", marginBottom:6, fontWeight:500}}>피크 시간대</div>
                <div style={{fontSize:18, fontWeight:700, fontVariantNumeric:"tabular-nums", color:"#4C7BE4"}}>{peakHour !== '-' ? peakHour : '-'}</div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </CardShell>
  );
}
