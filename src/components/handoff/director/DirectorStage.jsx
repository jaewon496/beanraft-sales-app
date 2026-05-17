/* DirectorStage.jsx — 3탭 대시보드 본문 */

import React from 'react';
import {
  DrKpiTile, DrLineChart, DrBarChart, DrDonut, DrPulse, DrRadar, DrLiveCountUp, DrGauge,
} from './DirectorAnim.jsx';

/* ============================================================
   MarketStage — 시장 탭
   ============================================================ */
export function MarketStage() {
  const salesData = [8120, 8240, 8380, 8510, 8640, 8780, 8910, 9020, 9080, 9150, 9180, 9121];
  const hourData = [4, 3, 2, 2, 3, 8, 22, 38, 42, 36, 30, 28, 32, 30, 28, 30, 36, 48, 44, 36, 28, 22, 14, 8];
  const hourLabels = ["0","","","3","","","6","","","9","","","12","","","15","","","18","","","21","","23"];
  const rentData = [36, 37, 37.5, 38, 39, 40, 41, 42];

  return (
    <div className="dr-stage">
      <div className="dr-grid-4" style={{marginBottom: 14}}>
        <DrKpiTile id="m.cafeCount" label="반경 500m 카페" value={126} suffix="개" tone="blue" hero src="소상공인진흥공단 2025.Q1"/>
        <DrKpiTile id="m.salesAvg"  label="월평균 매출"     value={9121} suffix="만원" tone="mint" hero src="국세청 카드매출 2024" delta={16.3} deltaPositive/>
        <DrKpiTile id="m.foot"      label="일평균 유동인구"  value={578505} tone="lilac" hero src="KT 빅데이터 2025.04"/>
        <DrKpiTile id="m.rent"      label="평당 월세"        value={42} suffix="만원" tone="cream" hero src="한국부동산원 2025.Q1" delta={10.1} deltaPositive={false}/>
      </div>

      <div className="dr-grid-2-3" style={{marginBottom: 14}}>
        <div className="dr-panel">
          <div className="dr-panel__title">월매출 추이 <span>강남구 평균 7,840만 대비 +16%</span></div>
          <DrLineChart id="m.salesLine" data={salesData} color="#FFFFFF" w={520} h={150} fill/>
          <div className="dr-line__foot">2024.06 → 2025.05 · 국세청 KOSIS</div>
        </div>
        <div className="dr-panel">
          <div className="dr-panel__title">시간대별 통행량 <span>피크: 18시</span></div>
          <DrBarChart id="m.hourBar" data={hourData} labels={hourLabels} color="#5478C9" h={150} highlightIdx={18}/>
          <div className="dr-line__foot">KT 빅데이터 2025.04</div>
        </div>
      </div>

      <div className="dr-grid-2-3">
        <div className="dr-panel">
          <div className="dr-panel__title">
            분기별 평당 월세 <span>최근 8분기</span>
            <DrPulse id="m.rentDelta" color="#9a9a9a">
              <span className="dr-chip bad">+10.1% / 1y</span>
            </DrPulse>
          </div>
          <DrLineChart id="m.rentLine" data={rentData} color="#FFFFFF" w={520} h={130} fill/>
          <div className="dr-line__foot">한국부동산원 분기 자료</div>
        </div>
        <div className="dr-panel">
          <div className="dr-panel__title">카페 유형 구성</div>
          <DrDonut
            id="m.cafeDonut"
            size={150}
            data={[
              { label: "개인 카페", value: 79, color: "#FFFFFF" },
              { label: "프랜차이즈", value: 47, color: "#7a7a7a" },
            ]}
            centerValue="126" centerLabel="총 매장"
          />
        </div>
      </div>
    </div>
  );
}

/* ============================================================
   CompStage — 경쟁 탭
   ============================================================ */
export function CompStage() {
  const radarData = [
    { axis: "입지",    value: 78 },
    { axis: "고객",    value: 68 },
    { axis: "경쟁강도", value: 28 },
    { axis: "진입비용", value: 22 },
    { axis: "매출",    value: 72 },
  ];
  const openClose = [
    { m: "06", o: 1, c: 0 }, { m: "07", o: 0, c: 1 }, { m: "08", o: 1, c: 1 },
    { m: "09", o: 0, c: 0 }, { m: "10", o: 1, c: 1 }, { m: "11", o: 0, c: 1 },
    { m: "12", o: 1, c: 0 }, { m: "01", o: 0, c: 1 }, { m: "02", o: 0, c: 1 },
    { m: "03", o: 1, c: 0 }, { m: "04", o: 0, c: 1 }, { m: "05", o: 0, c: 1 },
  ];

  return (
    <div className="dr-stage">
      <div className="dr-grid-2-3" style={{marginBottom: 14}}>
        <div className="dr-panel" style={{minHeight: 280}}>
          <div className="dr-panel__title">5축 종합 평가 <span>만점 100</span></div>
          <div style={{display:"flex", gap:24, alignItems:"center"}}>
            <DrRadar id="c.radar" data={radarData} size={240} color="#5478C9"/>
            <div style={{flex:1}}>
              <div className="dr-bigscore">
                <div className="dr-bigscore__lbl">종합 점수</div>
                <div className="dr-bigscore__val">
                  <DrLiveCountUp id="c.score" value={53}/>
                  <span className="u">/100</span>
                </div>
                <div className="dr-bigscore__grade">신중 검토</div>
              </div>
              <div className="dr-bigscore__bars">
                {radarData.map((d, i) => (
                  <div key={i} className="dr-mini-bar">
                    <div className="lab">{d.axis}</div>
                    <div className="track"><div style={{width: `${d.value}%`}}></div></div>
                    <div className="v">{d.value}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
        <div className="dr-panel">
          <div className="dr-panel__title">유형 구성</div>
          <DrDonut
            id="c.compDonut"
            size={140}
            data={[
              { label: "개인",        value: 79, color: "#FFFFFF" },
              { label: "프랜차이즈",   value: 47, color: "#7a7a7a" },
            ]}
            centerValue="56%" centerLabel="개인 비중"
          />
        </div>
      </div>

      <div className="dr-grid-4" style={{marginBottom: 14}}>
        <DrKpiTile id="c.franchise" label="프랜차이즈" value={47} suffix="개" tone="lilac" src="공정거래위 정보공개"/>
        <DrKpiTile id="c.indie"     label="개인 카페"   value={79} suffix="개" tone="blue" src="나이스비즈맵" delta={3.9} deltaPositive/>
        <DrKpiTile id="c.openClose" label="1년 신규 / 폐업" value={5} suffix=" / 8개" tone="cream" src="국세청 KOSIS"/>
        <DrKpiTile id="c.closeRate" label="강남구 폐업률" value={2.1} decimals={1} suffix="%" tone="mint" src="국세청 2024" delta={1.7} deltaPositive/>
      </div>

      <div className="dr-panel">
        <div className="dr-panel__title">월별 신규 / 폐업 <span>최근 12개월</span></div>
        <div className="dr-oc-bar">
          {openClose.map((d, i) => (
            <div key={i} className="dr-oc-bar__col">
              <DrBarChart id="c.openClose" data={[d.o, d.c]} h={70} color="#FFFFFF"/>
              <div className="dr-oc-bar__tick">{d.m}</div>
            </div>
          ))}
        </div>
        <div className="dr-line__foot">국세청 사업자등록 통계</div>
      </div>
    </div>
  );
}

/* ============================================================
   SurvStage — 생존 탭
   ============================================================ */
export function SurvStage() {
  const rec = [-210, -195, -178, -158, -138, -118, -98, -78, -58, -38, -18, 0, 22, 44, 66, 88, 110, 130, 150, 168, 184, 198, 210, 222, 232, 240, 248, 254, 260, 266, 272, 278, 284, 290, 296, 302];

  return (
    <div className="dr-stage">
      <div className="dr-panel" style={{marginBottom: 14}}>
        <div className="dr-panel__title">생존 곡선 <span>강남구 카페 코호트 분석</span></div>
        <div className="dr-grid-3" style={{gap: 18}}>
          <div className="dr-gauge-wrap">
            <DrGauge id="s.g1" value={100} label="1년 생존율" thresholds={[40, 70]}/>
            <div className="dr-gauge-cap">신규 100개 중 100개 운영</div>
          </div>
          <div className="dr-gauge-wrap">
            <DrGauge id="s.g3" value={71} label="3년 생존율" thresholds={[40, 70]}/>
            <div className="dr-gauge-cap">강남 평균 65% 대비 +6%p</div>
          </div>
          <div className="dr-gauge-wrap">
            <DrGauge id="s.g5" value={52} label="5년 생존율" thresholds={[40, 70]}/>
            <div className="dr-gauge-cap">서울 평균 38% 대비 +14%p</div>
          </div>
        </div>
      </div>

      <div className="dr-grid-4" style={{marginBottom: 14}}>
        <DrKpiTile id="s.deposit"  label="권리금"        value={1.8} decimals={1} suffix="억" tone="rose" src="중기부 KOSIS 142" delta={114} deltaPositive={false}/>
        <DrKpiTile id="s.total"    label="총 창업 (15평)" value={2.1} decimals={1} suffix="억" tone="cream" hero/>
        <DrKpiTile id="s.recovery" label="회수 (예상)"    value={28} suffix="개월" tone="mint" hero/>
        <DrKpiTile id="s.recovery2" label="강남 평균 회수" value={31} suffix="개월" tone="lilac" src="자체 모델"/>
      </div>

      <div className="dr-panel">
        <div className="dr-panel__title">누적 손익 곡선 <span>0선 통과 = 손익분기</span></div>
        <DrLineChart id="s.recoveryLine" data={rec} color="#FFFFFF" w={780} h={170} fill/>
        <div className="dr-line__foot">월차 0 → 36 · 자체 시뮬레이션</div>
      </div>
    </div>
  );
}
