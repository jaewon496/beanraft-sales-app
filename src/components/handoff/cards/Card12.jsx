/* Card12 — 날씨 영향 분석 (연간 기상 분포 + 매출 영향) */

import React from 'react';
import { CardShell, StatTile, Box } from '../Shared.jsx';
import { DrStagger } from '../director/DirectorAnim.jsx';

export default function Card12({ body = {} }) {
  const bodyData = body.bodyData || {};
  const chartData = body.chartData || {};

  // 연간 분포 (yearlyDistribution)
  const yd = bodyData.yearlyDistribution || null;
  const sunnyDays = (() => {
    const it = chartData.items?.find(i => i.label === '맑음' || i.label === '맑음');
    return Number(it?.value) || 0;
  })();
  const cloudyDays = (() => {
    const it = chartData.items?.find(i => i.label === '흐림' || i.label === '흐림');
    return Number(it?.value) || 0;
  })();
  const rainDays = (() => {
    const it = chartData.items?.find(i => i.label === '비' || i.label === '비');
    return Number(it?.value) || 0;
  })();
  const snowDays = (() => {
    const it = chartData.items?.find(i => i.label === '눈' || i.label === '눈');
    return Number(it?.value) || 0;
  })();

  // 월별 캘린더 (monthlyCalendar = [{month, rainDays, snowDays, avgTemp, days}, ...])
  const monthlyCal = Array.isArray(bodyData.monthlyCalendar) ? bodyData.monthlyCalendar : [];
  const months = monthlyCal.length === 12
    ? monthlyCal.map(m => `${m.month}월`)
    : ["1월","2월","3월","4월","5월","6월","7월","8월","9월","10월","11월","12월"];
  const days = monthlyCal.length === 12 ? monthlyCal.map(m => (m.rainDays || 0) + (m.snowDays || 0)) : new Array(12).fill(0);
  const temps = monthlyCal.length === 12 ? monthlyCal.map(m => Number(m.avgTemp) || 0) : new Array(12).fill(0);
  const tempMax = Math.max(...temps, 1);
  const tempMin = Math.min(...temps, 0);
  const tempRange = Math.max(1, tempMax - tempMin);

  // 매출 영향 (sunnyEffect/cloudyEffect/rainyEffect/snowEffect = "+5%" "−15%" 형태)
  const parsePct = (s) => {
    if (!s) return null;
    const m = String(s).match(/([+-]?\d+(?:\.\d+)?)/);
    return m ? parseFloat(m[1]) : null;
  };
  const sunnyEffect = parsePct(bodyData.sunnyEffect);
  const cloudyEffect = parsePct(bodyData.cloudyEffect);
  const rainyEffect = parsePct(bodyData.rainyEffect);
  const snowEffect = parsePct(bodyData.snowEffect);

  // 계절별 평균
  const seasonAvg = (() => {
    if (temps.length !== 12 || temps.every(t => t === 0)) return [null, null, null, null];
    const spring = Math.round(temps.slice(2, 5).reduce((s, v) => s + v, 0) / 3);
    const summer = Math.round(temps.slice(5, 8).reduce((s, v) => s + v, 0) / 3);
    const fall = Math.round(temps.slice(8, 11).reduce((s, v) => s + v, 0) / 3);
    const winter = Math.round((temps[11] + temps[0] + temps[1]) / 3);
    return [spring, summer, fall, winter];
  })();

  // 계절별 매출 (rainyEffect/sunnyEffect 기반 추정)
  const seasonSales = [
    { name: '봄 (3~5월)', value: sunnyEffect != null ? `${sunnyEffect > 0 ? '+' : ''}${(sunnyEffect * 0.5).toFixed(0)}%` : '-', tag: '안정' },
    { name: '여름 (6~8월)', value: rainyEffect != null ? `${rainyEffect > 0 ? '+' : ''}${rainyEffect.toFixed(0)}%` : '-', tag: rainyEffect > 0 ? '성수기' : '비수기', acc: rainyEffect > 0 },
    { name: '가을 (9~11월)', value: sunnyEffect != null ? `${sunnyEffect > 0 ? '+' : ''}${(sunnyEffect * 0.4).toFixed(0)}%` : '-', tag: '안정' },
    { name: '겨울 (12~2월)', value: snowEffect != null ? `${snowEffect > 0 ? '+' : ''}${snowEffect.toFixed(0)}%` : '-', tag: '비수기' },
  ];

  return (
    <CardShell n="12" id="12"
      title="날씨 영향 분석"
      sub="연간 기상 분포와 매출 영향"
      sources={["기상청 종관기상관측 (Open-Meteo ERA5)", "소상공인진흥공단 자체 매출 매핑"]}>
      <div className="bc-grid-4" style={{gap:16, marginBottom:16}}>
        <StatTile id="c12.tile1" tone="cream" label="맑음" value={sunnyDays > 0 ? String(sunnyDays) : '-'} unit={sunnyDays > 0 ? '일/년' : ''} hero/>
        <StatTile id="c12.tile2" tone="lilac" label="흐림" value={cloudyDays > 0 ? String(cloudyDays) : '-'} unit={cloudyDays > 0 ? '일/년' : ''}/>
        <StatTile id="c12.tile3" tone="blue"  label="비"   value={rainDays > 0 ? String(rainDays) : '-'} unit={rainDays > 0 ? '일/년' : ''}/>
        <StatTile id="c12.tile4" tone="mint"  label="눈"   value={snowDays > 0 ? String(snowDays) : '-'} unit={snowDays > 0 ? '일/년' : ''}/>
      </div>

      <div style={{display:"grid", gridTemplateColumns:"1.4fr 1fr", gap:16, alignItems:"start"}}>
        <div className="bc-box" style={{padding:24}}>
          <div style={{display:"flex", justifyContent:"space-between", alignItems:"baseline", marginBottom:18}}>
            <span style={{fontSize:16, fontWeight:600}}>월별 비/눈 일수 + 평균 기온</span>
            {yd && yd.avgTemp != null && (
              <span style={{fontSize:13, color:"var(--matte-fg-3)"}}>연평균 <strong style={{color:"var(--matte-fg)", fontWeight:700, fontSize:15, marginLeft:4}}>{yd.avgTemp}°C</strong></span>
            )}
          </div>
          {monthlyCal.length === 12 ? (
            <>
              <DrStagger id="c12.cal" delay={50} style={{display:"grid", gridTemplateColumns:"repeat(12, 1fr)", gap:6, alignItems:"flex-end", height:220}}>
                {months.map((m, i) => {
                  const tH = Math.max(8, ((temps[i] - tempMin) / tempRange) * 180);
                  const isHotMax = temps[i] === tempMax && tempMax > 0;
                  const color = isHotMax ? "#4C7BE4" : "#FFFFFF";
                  return (
                    <div key={m} style={{display:"flex", flexDirection:"column", alignItems:"center", gap:6, height:"100%", justifyContent:"flex-end"}}>
                      <div style={{fontSize:13, fontWeight:600, color: isHotMax ? "#4C7BE4" : "var(--matte-fg-2)", fontVariantNumeric:"tabular-nums"}}>{days[i]}</div>
                      <div style={{width:"100%", height: tH, background: color, borderRadius:"4px 4px 0 0", opacity: isHotMax ? 1 : 0.85}}></div>
                    </div>
                  );
                })}
              </DrStagger>
              <div style={{display:"grid", gridTemplateColumns:"repeat(12, 1fr)", gap:6, marginTop:10}}>
                {months.map(m => <div key={m} style={{fontSize:13, textAlign:"center", color:"var(--matte-fg-3)"}}>{m}</div>)}
              </div>
            </>
          ) : (
            <div style={{height:220, display:"flex", alignItems:"center", justifyContent:"center", color:"var(--matte-fg-4)"}}>월별 기상 데이터 수집 중</div>
          )}

          <div style={{marginTop:24, paddingTop:20, borderTop:"1px solid var(--matte-line)"}}>
            <div style={{fontSize:14, color:"var(--matte-fg-3)", fontWeight:500, marginBottom:14}}>계절별 매출 변동 (추정)</div>
            <div style={{display:"grid", gridTemplateColumns:"repeat(4, 1fr)", gap:10}}>
              {seasonSales.map(s => (
                <div key={s.name} style={{padding:"16px 16px", background:"rgba(255,255,255,0.03)", borderRadius:10, border:"1px solid var(--matte-line)"}}>
                  <div style={{fontSize:13, color:"var(--matte-fg-3)", marginBottom:8, fontWeight:500}}>{s.name}</div>
                  <div style={{fontSize:24, fontWeight:700, fontVariantNumeric:"tabular-nums", color: s.acc ? "#4C7BE4" : "var(--matte-fg)", letterSpacing:"-0.01em"}}>{s.value}</div>
                  <div style={{fontSize:13, color:"var(--matte-fg-3)", marginTop:6}}>{s.tag}</div>
                </div>
              ))}
            </div>
          </div>

          <div style={{fontSize:13, color:"var(--matte-fg-4)", marginTop:14}}>막대 높이 = 평균 기온 · 상단 숫자 = 비/눈 일수</div>
        </div>

        <div>
          <div className="bc-box" style={{padding:22, marginBottom:12}}>
            <div style={{fontSize:16, fontWeight:600, marginBottom:16}}>날씨별 매출 영향</div>
            <div style={{display:"flex", flexDirection:"column", gap:12}}>
              {[
                ['맑음', sunnyEffect, '#FFFFFF'],
                ['비', rainyEffect, '#4C7BE4'],
                ['눈', snowEffect, '#FFFFFF'],
                ['흐림', cloudyEffect, '#FFFFFF'],
              ].map(([k, v, color]) => {
                const acc = v != null && v > 0;
                const valStr = v != null ? `${v > 0 ? '+' : ''}${v}%` : '-';
                const w = v != null ? Math.min(100, Math.max(20, 50 + v)) : 0;
                return (
                  <div key={k} style={{display:"grid", gridTemplateColumns:"60px 1fr 80px", gap:12, alignItems:"center"}}>
                    <span style={{fontSize:15, color:"var(--matte-fg-2)", fontWeight:500}}>{k}</span>
                    <div className="bc-bar" style={{height:12, background:"rgba(255,255,255,0.05)"}}>
                      <div style={{width:`${w}%`, background: acc ? "#4C7BE4" : color, height:"100%", borderRadius:"inherit"}}></div>
                    </div>
                    <span style={{textAlign:"right", fontSize:14, fontWeight:700, color: acc ? "#4C7BE4" : "var(--matte-fg)", fontVariantNumeric:"tabular-nums"}}>{valStr}</span>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="bc-box" style={{padding:20, marginBottom:12}}>
            <div style={{fontSize:14, color:"var(--matte-fg-3)", fontWeight:500, marginBottom:10}}>운영 인사이트</div>
            <div style={{fontSize:15, lineHeight:1.65, color:"var(--matte-fg-2)"}}>
              {bodyData.weatherSummary || (rainyEffect != null
                ? `비 오는 날 매출 ${rainyEffect > 0 ? '+' : ''}${rainyEffect}% ${rainyEffect > 0 ? '상승' : '하락'}.`
                : '운영 인사이트 데이터 수집 중')}
            </div>
          </div>

          <div className="bc-grid-2" style={{gap:10}}>
            <Box label="연평균 기온" value={yd?.avgTemp != null ? yd.avgTemp.toFixed(1) : '-'} unit={yd?.avgTemp != null ? '°C' : ''}/>
            <Box label="여름 최고"  value={yd?.summerMax != null ? yd.summerMax.toFixed(1) : '-'} unit={yd?.summerMax != null ? '°C' : ''}/>
            <Box label="겨울 최저"  value={yd?.winterMin != null ? yd.winterMin.toFixed(1) : '-'} unit={yd?.winterMin != null ? '°C' : ''}/>
            <Box label="강수일/연"  value={rainDays > 0 ? String(rainDays) : '-'} unit={rainDays > 0 ? '일' : ''} sub={yd?.relativePosition || ''}/>
          </div>
        </div>
      </div>
    </CardShell>
  );
}
