/* Card07 — 유동인구 (시간대별 + 요일별 + 주중/주말) */

import React from 'react';
import { CardShell, StatTile } from '../Shared.jsx';
import { Donut, DonutLegend, VBars } from '../Charts.jsx';

export default function Card07({ body = {} }) {
  const bodyData = body.bodyData || {};
  const chartData = body.chartData || {};
  const sigungu = body.sigungu || '';

  const totalPop = Number(bodyData.totalPop) || 0;          // 일평균 (전체)
  const dongDailyPop = Number(bodyData.dongDailyPop) || 0;  // 동 전체 일평균
  const weekday = Number(bodyData.weekday) || 0;
  const weekend = Number(bodyData.weekend) || 0;
  const weekdayPct = Number(bodyData.weekdayPct) || (weekday + weekend > 0 ? Math.round(weekday / (weekday + weekend) * 100) : 0);
  const weekendPct = Number(bodyData.weekendPct) || (100 - weekdayPct);
  const peakHour = bodyData.peakHour || bodyData.popPeakHour || '-';
  const peakDay = bodyData.popPeakDay || bodyData.bizmapPeakDay || (bodyData.dayOfWeek?.peakDay) || '-';
  const peakHourPct = Number(bodyData.popPeakHourPct) || 0;
  const peakDayPct = Number(bodyData.popPeakDayPct) || 0;

  // 시간대별 차트 (hourlyPctChart 우선, chartData 폴백)
  const hourlyChart = bodyData.hourlyPctChart || (chartData.labels && chartData.values ? { labels: chartData.labels, values: chartData.values } : null);
  const hourItems = hourlyChart && hourlyChart.labels ? hourlyChart.labels.map((l, i) => ({
    l, v: hourlyChart.values[i] || 0, t: `${(hourlyChart.values[i] || 0).toFixed(0)}%`
  })) : [];
  const hourTopIdx = hourItems.length > 0 ? hourItems.reduce((m, x, i, arr) => x.v > arr[m].v ? i : m, 0) : 0;

  // 요일별 차트 (weeklyPctChart)
  const weeklyChart = bodyData.weeklyPctChart;
  const dayItems = weeklyChart && weeklyChart.labels ? weeklyChart.labels.map((l, i) => ({
    l, v: weeklyChart.values[i] || 0, t: `${(weeklyChart.values[i] || 0).toFixed(0)}`
  })) : [];
  const dayTopIdx = dayItems.length > 0 ? dayItems.reduce((m, x, i, arr) => x.v > arr[m].v ? i : m, 0) : 0;

  // topArea (인근 동 비교, dynPplCmpr 두 번째 항목)
  const topArea = bodyData.topArea || null;

  return (
    <CardShell n="07" id="07"
      title="유동인구"
      sub="시간대별 통행량"
      sources={["소상공인진흥공단 dynPplCmpr", "비즈맵"]}>
      <div className="bc-grid-4" style={{gap:16, marginBottom:16}}>
        <StatTile id="c7.tile1" tone="blue"  label="동 일평균 유동인구" value={dongDailyPop > 0 ? dongDailyPop.toLocaleString() : (totalPop > 0 ? totalPop.toLocaleString() : '-')} unit="명" hero/>
        <StatTile id="c7.tile2" tone="mint"  label="최다 요일"        value={peakDay !== '-' ? peakDay : '-'} delta={peakDayPct > 0 ? peakDayPct.toFixed(1) : undefined}/>
        <StatTile id="c7.tile3" tone="lilac" label="최다 시간대"      value={peakHour !== '-' ? peakHour : '-'} delta={peakHourPct > 0 ? peakHourPct.toFixed(1) : undefined}/>
        <StatTile id="c7.tile4" tone="cream" label="반경 500m 일평균" value={totalPop > 0 ? totalPop.toLocaleString() : '-'} unit={totalPop > 0 ? '명/일' : ''}/>
      </div>

      <div style={{display:"grid", gridTemplateColumns:"1.3fr 1fr", gap:16}}>
        <div className="bc-box" style={{padding:18}}>
          <div style={{fontSize:15, fontWeight:600, marginBottom:14}}>시간대별 비중</div>
          {hourItems.length > 0 ? (
            <VBars id="c7.hours" accent={hourTopIdx} barW={28} gap={16} height={160} items={hourItems}/>
          ) : (
            <div style={{fontSize:13, color:"var(--matte-fg-4)", padding:"30px 0"}}>시간대 데이터 수집 중</div>
          )}
          <div style={{marginTop:18, paddingTop:14, borderTop:"1px solid var(--matte-line)"}}>
            <div style={{fontSize:15, fontWeight:600, marginBottom:14}}>요일별 비중</div>
            {dayItems.length > 0 ? (
              <VBars id="c7.days" accent={dayTopIdx} barW={28} gap={10} height={100} items={dayItems}/>
            ) : (
              <div style={{fontSize:13, color:"var(--matte-fg-4)", padding:"20px 0"}}>요일 데이터 수집 중</div>
            )}
          </div>
        </div>

        <div>
          <div className="bc-box" style={{padding:18, marginBottom:12}}>
            <div style={{fontSize:15, fontWeight:600, marginBottom:12}}>주중 vs 주말</div>
            {(weekdayPct > 0 || weekendPct > 0) ? (
              <div style={{display:"flex", alignItems:"center", gap:16, justifyContent:"center"}}>
                <Donut id="c7.donut" size={180} segments={[
                  {value: weekdayPct, color:"#4C7BE4", label:"주중"},
                  {value: weekendPct, color:"#FFFFFF", label:"주말"},
                ]} centerLabel={`${weekdayPct.toFixed(0)}%`} centerSub="주중 비중"/>
                <DonutLegend segments={[
                  {value: weekdayPct, color:"#4C7BE4", label:"주중", text:`${weekdayPct.toFixed(0)}%`},
                  {value: weekendPct, color:"#FFFFFF", label:"주말", text:`${weekendPct.toFixed(0)}%`},
                ]}/>
              </div>
            ) : (
              <div style={{fontSize:13, color:"var(--matte-fg-4)", padding:"30px 0", textAlign:"center"}}>주중/주말 데이터 수집 중</div>
            )}
          </div>
          <div className="bc-box" style={{padding:14}}>
            <div style={{fontSize:15, color:"var(--matte-fg-3)", fontWeight:600, marginBottom:8}}>인접 비교 ({sigungu || '시군구'})</div>
            {topArea ? (
              <div style={{display:"flex", justifyContent:"space-between", padding:"5px 0", fontSize:15}}>
                <span><span style={{color:"var(--matte-fg-4)", marginRight:6}}>인근</span>{topArea.name}</span>
                <span style={{fontVariantNumeric:"tabular-nums", color:"var(--matte-fg-2)"}}>{(topArea.pop || 0).toLocaleString()}명/일</span>
              </div>
            ) : dongDailyPop > 0 ? (
              <div style={{display:"flex", justifyContent:"space-between", padding:"5px 0", fontSize:15}}>
                <span><span style={{color:"var(--matte-fg-4)", marginRight:6}}>이 동</span>{sigungu ? `${sigungu}` : '동 전체'}</span>
                <span style={{fontVariantNumeric:"tabular-nums", color:"var(--matte-fg-2)"}}>{dongDailyPop.toLocaleString()}명/일</span>
              </div>
            ) : (
              <div style={{fontSize:13, color:"var(--matte-fg-4)"}}>인접 비교 데이터 수집 중</div>
            )}
          </div>
        </div>
      </div>
    </CardShell>
  );
}
