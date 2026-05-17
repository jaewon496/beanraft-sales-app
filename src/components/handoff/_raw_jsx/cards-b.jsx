/* cards-b.jsx — Cards 08-12 */

/* ============================================================
   Card 08 — 임대/창업 (simulator + KOSIS 4박스)
   ============================================================ */
function Card08({ body = {} }) {
  const [pyeong, setPyeong] = React.useState(15);
  const monthly = Math.round(pyeong * 42);
  const deposit = pyeong * 1200;
  const interior = pyeong * 350;
  const total = deposit + interior + 3000;
  return (
    <CardShell n="08" id="08"
      title="임대/창업 정보"
      sub="상가 시세 및 창업 비용"
      sources={["한국부동산원 (KOSIS 408)", "농림축산식품부 (KOSIS 114)", "중소벤처기업부 (KOSIS 142)", "자체 수집기"]}>
      <div className="bc-grid-4" style={{gap:16, marginBottom:16}}>
        <StatTile id="c8.tile1" tone="blue"  label="통합 평당 월세" value="42" unit="만원" hero/>
        <StatTile id="c8.tile2" tone="lilac" label="평균 보증금"   value="1.2" unit="억/평"/>
        <StatTile id="c8.tile3" tone="mint"  label="총 창업 (15평)" value="2.1" unit="억"/>
        <StatTile id="c8.tile4" tone="rose"  label="권리금"  value="1.8" unit="억" delta="114" deltaPositive/>
      </div>

      <div style={{display:"grid", gridTemplateColumns:"1fr 1fr", gap:16}}>
        <div className="bc-box" style={{padding:18}}>
          <div style={{fontSize:15, fontWeight:600, marginBottom:12}}>한국부동산원 임대 4종</div>
          <div className="bc-grid-2" style={{gap:10}}>
            <Box label="평당 월세" value="42" unit="만" sub="강남 평균 38만 대비 +10.5%" src="2025 Q1"/>
            <Box label="전환율"   value="5.8" unit="%" src="2025 Q1"/>
            <Box label="수익률"   value="4.1" unit="%" sub="순영업소득 기준" src="2025 Q1"/>
            <Box label="순영업소득" value="296" unit="만/년" src="2025 Q1"/>
          </div>
        </div>

        <div className="bc-box" style={{padding:18}}>
          <div style={{fontSize:15, fontWeight:600, marginBottom:12}}>전국 카페 평균 (KOSIS 114)</div>
          <div className="bc-grid-3" style={{gap:8}}>
            <Box label="인테리어비" value="3,800" unit="만"/>
            <Box label="총 투자비"  value="1.4"   unit="억"/>
            <Box label="평수"       value="11.2" unit="평"/>
            <Box label="월 매출"    value="4,210" unit="만"/>
            <Box label="객단가"     value="8,200" unit="원"/>
            <Box label="평당 매출"  value="376"   unit="만"/>
          </div>
          <div style={{fontSize:15, color:"var(--fg-4)", marginTop:8}}>농림축산식품부 외식업체경영실태조사 2024</div>
        </div>
      </div>

      <div style={{display:"grid", gridTemplateColumns:"1fr 1fr", gap:16, marginTop:16}}>
        <div className="bc-box" style={{padding:24}}>
          <div style={{fontSize:16, fontWeight:600, marginBottom:18}}>인테리어 비용 분포 <span style={{fontSize:13, color:"var(--matte-fg-3)", fontWeight:500, marginLeft:8}}>15평 기준</span></div>
          <div style={{display:"flex", flexDirection:"column", gap:10}}>
          {[["셀프","1,500만",30,false],["최소 시공","3,500만",55,false],["평균 시공","5,250만",75,true],["고급 시공","7,800만",92,false],["프리미엄","1.2억",100,false]].map(([l,v,p,acc],i)=>(
            <div key={l} style={{display:"grid", gridTemplateColumns:"110px 1fr 80px", gap:12, alignItems:"center"}}>
              <span style={{fontSize:14, color: acc ? "#5478C9" : "var(--matte-fg-2)", fontWeight: acc ? 700 : 500}}>{l}</span>
              <div className="bc-bar" style={{height:12, background:"rgba(255,255,255,0.05)"}}><div style={{width:`${p}%`, background: acc ? "#5478C9" : "#FFFFFF", height:"100%", borderRadius:"inherit"}}></div></div>
              <span style={{fontSize:14, textAlign:"right", fontVariantNumeric:"tabular-nums", color: acc ? "#5478C9" : "var(--matte-fg)", fontWeight:700}}>{v}</span>
            </div>
          ))}
          </div>
          <div style={{fontSize:13, color:"var(--matte-fg-3)", marginTop:16, paddingTop:14, borderTop:"1px solid var(--matte-line)"}}>평균 시공 (5,250만)을 권장 — 회수 28개월 시나리오 적용</div>
        </div>

        <div className="bc-box" style={{padding:24, background:"linear-gradient(135deg, rgba(84,120,201,0.10), transparent 60%)", border:"1px solid rgba(84,120,201,0.45)"}}>
          <div style={{display:"flex", justifyContent:"space-between", alignItems:"baseline", marginBottom:14}}>
            <div style={{fontSize:16, fontWeight:700, color:"#5478C9"}}>내 카페 시뮬레이터</div>
            <div style={{fontSize:14, color:"var(--matte-fg-2)", fontWeight:600}}><strong style={{fontSize:18, color:"#fff"}}>{pyeong}</strong> 평</div>
          </div>
          <input type="range" min="5" max="60" value={pyeong} onChange={e=>setPyeong(+e.target.value)} style={{width:"100%", accentColor:"#5478C9"}}/>
          <div style={{display:"flex", justifyContent:"space-between", fontSize:13, color:"var(--matte-fg-4)", marginTop:6}}>
            <span>5평</span><span>15</span><span>30</span><span>45</span><span>60평</span>
          </div>
          <div className="bc-grid-3" style={{gap:12, marginTop:20}}>
            <div style={{padding:"16px 18px", background:"rgba(255,255,255,0.03)", borderRadius:10, border:"1px solid var(--matte-line)"}}>
              <div style={{fontSize:13, color:"var(--matte-fg-3)", marginBottom:6, fontWeight:500}}>월 임대료</div>
              <div style={{fontSize:22, fontWeight:700, fontVariantNumeric:"tabular-nums", letterSpacing:"-0.01em"}}>{monthly.toLocaleString()}<span style={{fontSize:13, color:"var(--matte-fg-3)", marginLeft:3, fontWeight:500}}>만</span></div>
            </div>
            <div style={{padding:"16px 18px", background:"rgba(255,255,255,0.03)", borderRadius:10, border:"1px solid var(--matte-line)"}}>
              <div style={{fontSize:13, color:"var(--matte-fg-3)", marginBottom:6, fontWeight:500}}>보증금</div>
              <div style={{fontSize:22, fontWeight:700, fontVariantNumeric:"tabular-nums", letterSpacing:"-0.01em"}}>{(deposit/10000).toFixed(2)}<span style={{fontSize:13, color:"var(--matte-fg-3)", marginLeft:3, fontWeight:500}}>억</span></div>
            </div>
            <div style={{padding:"16px 18px", background:"rgba(84,120,201,0.10)", borderRadius:10, border:"1px solid rgba(84,120,201,0.45)"}}>
              <div style={{fontSize:13, color:"var(--matte-fg-3)", marginBottom:6, fontWeight:500}}>총 창업비</div>
              <div style={{fontSize:22, fontWeight:700, color:"#5478C9", fontVariantNumeric:"tabular-nums", letterSpacing:"-0.01em"}}>{(total/10000).toFixed(2)}<span style={{fontSize:13, color:"var(--matte-fg-3)", marginLeft:3, fontWeight:500}}>억</span></div>
            </div>
          </div>
        </div>
      </div>
    </CardShell>
  );
}

/* ============================================================
   Card 09 — 카페 기회 (공실률)
   ============================================================ */
function Card09({ body = {} }) {
  const vacancy = body.vacancy ?? 6.9;
  const tone = vacancy >= 10 ? "bad" : vacancy >= 5 ? "mid" : "good";
  return (
    <CardShell n="09" id="09"
      title="카페 기회"
      sub="이 동네 카페 데이터 발견"
      sources={["한국부동산원 (KOSIS 408)", "소상공인진흥공단"]}>
      {/* 4-up KPI */}
      <div className="bc-grid-4" style={{gap:16, marginBottom:16}}>
        <StatTile id="c9.hero" tone="mint" label="공실률" value={String(vacancy)} unit="%" delta="0.5" deltaPositive hero accent/>
        <StatTile tone="blue" label="동 평균 대비" value="+0.5" unit="%p"/>
        <StatTile tone="lilac" label="1년 신규" value="5" unit="개"/>
        <StatTile tone="cream" label="1년 폐업" value="8" unit="개"/>
      </div>

      <div style={{display:"grid", gridTemplateColumns:"1fr 1.4fr", gap:16, alignItems:"stretch"}}>
        <div className="bc-box" style={{padding:24, display:"flex", flexDirection:"column"}}>
          <div style={{display:"flex", justifyContent:"space-between", alignItems:"baseline", marginBottom:16}}>
            <span style={{fontSize:16, fontWeight:600}}>최근 1년 공실률 추이</span>
          </div>
          <div style={{flex:1, display:"flex", alignItems:"center", minHeight:200}}>
            <LineChart id="c9.line" width={460} height={260}
              data={[6.4,6.0,5.5,5.8,6.2,6.5,6.7,6.6,6.8,6.9,6.8,6.9]}
              yLabels={[5, 6, 7]} color="#5478C9"/>
          </div>
          <div style={{marginTop:20, paddingTop:18, borderTop:"1px solid var(--matte-line)", display:"grid", gridTemplateColumns:"1fr 1fr 1fr", gap:14}}>
            {[
              ["최저", "5.5", "%", "2023.Q3"],
              ["최고", "6.9", "%", "현재"],
              ["변동폭", "1.4", "%p", "안정"],
            ].map(([l, v, u, sub]) => (
              <div key={l}>
                <div style={{fontSize:13, color:"var(--matte-fg-3)", marginBottom:6, fontWeight:500}}>{l}</div>
                <div style={{fontSize:22, fontWeight:700, fontVariantNumeric:"tabular-nums", letterSpacing:"-0.01em"}}>{v}<span style={{fontSize:13, color:"var(--matte-fg-3)", marginLeft:2, fontWeight:500}}>{u}</span></div>
                <div style={{fontSize:13, color:"var(--matte-fg-3)", marginTop:4}}>{sub}</div>
              </div>
            ))}
          </div>
        </div>

        <div className="bc-box" style={{padding:24}}>
          <div style={{fontSize:16, fontWeight:600, marginBottom:18}}>핵심 발견</div>
          <window.DrStagger id="c9.list" delay={120} style={{display:"flex", flexDirection:"column", gap:14}}>
          {[
            ["시장 매력도", "월매출 9,121만 — 강남구 평균 +16%", 0.85, true],
            ["경쟁 환경",   "개인 카페 56% — 차별화 여지", 0.7, false],
            ["시장 변화",   "신규 5 / 폐업 8 — 자연 회전 정상권", 0.6, false],
            ["생존 기반",   "3년 생존율 71% — 상위 12%", 0.8, false],
            ["비용 부담",   "권리금 1.8억 — 시도 평균 +114%", 0.25, false],
          ].map(([axis, t, ratio, acc], i) => (
            <div key={i} style={{padding:"16px 18px", background:"rgba(255,255,255,0.03)", borderRadius:10, border:"1px solid var(--matte-line)"}}>
              <div style={{display:"flex", justifyContent:"space-between", alignItems:"baseline", marginBottom:8}}>
                <span style={{fontSize:15, fontWeight:700, color: acc ? "#5478C9" : "var(--matte-fg)"}}>{axis}</span>
                <span style={{fontSize:13, color: ratio >= 0.6 ? "var(--matte-fg-2)" : "var(--matte-fg-3)", fontWeight:600, fontVariantNumeric:"tabular-nums"}}>{ratio >= 0.7 ? "강점" : ratio >= 0.4 ? "보통" : "주의"}</span>
              </div>
              <div style={{fontSize:14, color:"var(--matte-fg-2)", marginBottom:10, lineHeight:1.5}}>{t}</div>
              <div className="bc-bar" style={{height:8, background:"rgba(255,255,255,0.04)"}}>
                <div style={{width:`${ratio*100}%`, background: acc ? "#5478C9" : "#FFFFFF", height:"100%", borderRadius:"inherit"}}></div>
              </div>
            </div>
          ))}
          </window.DrStagger>
        </div>
      </div>
    </CardShell>
  );
}

/* ============================================================
   Card 10 — 배달 객단가
   ============================================================ */
function Card10({ body = {} }) {
  return (
    <CardShell n="10" id="10"
      title="배달 객단가"
      sub="이 동네 배달 객단가"
      sources={["배민/쿠팡이츠 (자체 수집)", "통계청 서비스업동향"]}>
      <div className="bc-grid-4" style={{gap:16, marginBottom:16}}>
        <StatTile id="c10.tile1" tone="blue"  label="동 객단가 (배달)" value="20,851" unit="원" delta="8.2" deltaPositive hero/>
        <StatTile id="c10.tile2" tone="mint"  label="월 배달 매출"   value="1,420" unit="만"/>
        <StatTile id="c10.tile3" tone="lilac" label="월 배달 건수"   value="681"   unit="건" delta="12.0" deltaPositive/>
        <StatTile id="c10.tile4" tone="cream" label="업종 순위"      value="12위"  delta="2.0" deltaPositive/>
      </div>

      <div style={{display:"grid", gridTemplateColumns:"1.4fr 1fr", gap:16, alignItems:"stretch"}}>
        <div className="bc-box" style={{padding:18, display:"flex", flexDirection:"column"}}>
          <div style={{display:"flex", justifyContent:"space-between", marginBottom:12}}>
            <div style={{fontSize:15, fontWeight:600}}>월별 배달 주문건수 (12개월)</div>
            <span style={{fontSize:15, color:"#5478C9", fontWeight:700}}>+62% (yoy)</span>
          </div>
          <div style={{flex:1, display:"flex", alignItems:"center", minHeight:180}}>
            <LineChart id="c10.line" width={520} height={240} data={[420,440,460,490,510,540,580,610,640,650,670,681]} color="#5478C9"/>
          </div>
          <div style={{marginTop:18, paddingTop:14, borderTop:"1px solid var(--line)"}}>
            <div style={{fontSize:15, fontWeight:600, marginBottom:12}}>요일별 배달 주문</div>
            <VBars id="c10.days" accent={4} height={80} barW={24} items={[
              {l:"월", v:12, t:"12"},{l:"화", v:14, t:"14"},{l:"수", v:16, t:"16"},
              {l:"목", v:17, t:"17"},{l:"금", v:19, t:"19"},{l:"토", v:11, t:"11"},{l:"일", v:8, t:"8"},
            ]}/>
          </div>
        </div>

        <div>
          <div className="bc-box" style={{padding:24, marginBottom:14}}>
            <div style={{fontSize:18, fontWeight:700, marginBottom:18}}>운영 옵션별 월 비용</div>
            <div style={{display:"flex", flexDirection:"column"}}>
            {[
              ["배민/쿠팡이츠", "21만원", "#FFFFFF"],
              ["바로고/부릉",   "96만원", "#7a7a7a"],
              ["둘 다 운영",    "117만원", "#5478C9"],
            ].map(([l, v, c], i) => (
              <div key={i} style={{display:"flex", justifyContent:"space-between", alignItems:"center", padding:"16px 0", borderBottom: i<2 ? "1px solid var(--matte-line)" : "none"}}>
                <div style={{display:"flex", alignItems:"center", gap:12}}>
                  <span style={{width:12, height:12, borderRadius:9999, background:c, flexShrink:0}}></span>
                  <span style={{fontSize:16, fontWeight: i===2 ? 700 : 600, color: i===2 ? "#5478C9" : "var(--matte-fg)", letterSpacing:"-0.005em"}}>{l}</span>
                </div>
                <span style={{fontSize:20, fontWeight:700, fontVariantNumeric:"tabular-nums", color: i===2 ? "#5478C9" : "var(--matte-fg)", letterSpacing:"-0.01em"}}>{v}</span>
              </div>
            ))}
            </div>
          </div>

          <div className="bc-box" style={{padding:18}}>
            <div style={{fontSize:15, fontWeight:600, marginBottom:10}}>전국 카페 배달 운영</div>
            <div style={{display:"flex", alignItems:"center", gap:16}}>
              <Donut id="c10.donut" size={180} thickness={20} segments={[
                {value:62, color:"#5478C9", label:"운영"},
                {value:38, color:"#FFFFFF", label:"미운영"},
              ]} centerLabel="62%" centerSub="배달 운영"/>
              <DonutLegend segments={[
                {value:62, color:"#5478C9", label:"운영", text:"62%"},
                {value:38, color:"#FFFFFF", label:"미운영", text:"38%"},
              ]}/>
            </div>
          </div>
        </div>
      </div>
    </CardShell>
  );
}

/* ============================================================
   Card 11 — SNS 트렌드
   ============================================================ */
function Card11({ body = {} }) {
  return (
    <CardShell n="11" id="11"
      title="SNS 트렌드"
      sub="소셜미디어 카페 분위기 분석"
      sources={["인스타그램 해시태그", "네이버 카페 후기", "오픈업"]}>
      <div className="bc-grid-4" style={{gap:16, marginBottom:16}}>
        <StatTile id="c11.tile1" tone="mint"  label="긍정 비율"      value="78" unit="%" delta="4.2" deltaPositive hero/>
        <StatTile id="c11.tile2" tone="rose"  label="부정 비율"      value="22" unit="%" delta="1.8" deltaPositive={false}/>
        <StatTile id="c11.tile3" tone="blue"  label="총 키워드"     value="12"/>
        <StatTile id="c11.tile4" tone="cream" label="총 리뷰"       value="4,820" unit="건"/>
      </div>

      <div style={{display:"grid", gridTemplateColumns:"1.3fr 1fr", gap:16}}>
        <div className="bc-box" style={{padding:18}}>
          <div style={{fontSize:15, fontWeight:600, marginBottom:12}}>SNS 키워드 클라우드</div>
          <window.DrStagger id="c11.cloud" delay={60} style={{display:"flex", flexWrap:"wrap", gap:10, alignItems:"baseline", padding:"8px 0"}}>
            {[
              ["강남카페", 26],
              ["분위기", 22],
              ["디저트맛집", 20],
              ["인스타감성", 17],
              ["조용한", 16],
              ["퇴근후", 15],
              ["커피맛집", 14],
              ["미팅장소", 13],
              ["혼카페", 12],
              ["크림라떼", 12],
              ["로스터리", 11],
              ["넓은", 10],
            ].map(([k, s], i) => (
              <span key={i} style={{fontSize:s, color: s>=20 ? "#FFFFFF" : s>=14 ? "#C9C9C9" : "#A3A3A3", fontWeight: s>18 ? 700 : 600, lineHeight:1.1}}>#{k}</span>
            ))}
          </window.DrStagger>
          <div style={{marginTop:14, paddingTop:14, borderTop:"1px solid var(--line)"}}>
            <div style={{fontSize:15, color:"var(--fg-3)", marginBottom:8, fontWeight:600}}>검색 유입 경로</div>
            <div style={{display:"flex", flexWrap:"wrap", gap:6, marginBottom:12}}>
              {["강남역 카페","근처 카페","미팅 카페","조용한 카페","공부 카페","주차 카페","2층 카페"].map(k => <span key={k} className="bc-pill">{k}</span>)}
            </div>
            <div style={{fontSize:15, color:"var(--fg-3)", marginBottom:8, fontWeight:600}}>주의 키워드</div>
            <div style={{display:"flex", gap:6, flexWrap:"wrap"}}>
              {["시끄러움","비좁음","대기긺","웨이팅"].map(k => <span key={k} className="bc-pill">{k}</span>)}
            </div>
          </div>
        </div>

        <div className="bc-box" style={{padding:24}}>
          <div style={{fontSize:18, fontWeight:700, marginBottom:20}}>후기 좋은 매장 TOP 5</div>
          <window.DrStagger id="c11.top5" delay={100} style={{display:"flex", flexDirection:"column", gap:8}}>
          {[
            ["로스터리 그라운드", "콜드브루 토닉", "원두 자가 로스팅"],
            ["블루보틀 강남",   "뉴올리언스",     "넓고 조용한 2층"],
            ["테라로사 강남",   "에티오피아 핸드드립", "원두 셀렉션 강점"],
            ["프롤로그",       "시그니처 라떼",   "감성 인테리어"],
            ["오월의 종",      "버터 크로와상",   "베이커리 동반"],
          ].map(([n, m, d], i) => {
            const isAcc = i === 0;
            return (
              <div key={i} style={{
                padding:"14px 18px",
                background: isAcc ? "rgba(84,120,201,0.10)" : "rgba(255,255,255,0.03)",
                border: isAcc ? "1px solid rgba(84,120,201,0.45)" : "1px solid var(--matte-line)",
                borderRadius:10,
              }}>
                <div style={{display:"flex", alignItems:"baseline", justifyContent:"space-between", gap:12, marginBottom:6}}>
                  <div style={{display:"flex", alignItems:"baseline", gap:10, minWidth:0}}>
                    <span style={{fontSize:13, color:"var(--matte-fg-4)", fontVariantNumeric:"tabular-nums", fontWeight:700, flexShrink:0}}>{String(i+1).padStart(2,"0")}</span>
                    <span style={{fontSize:17, fontWeight:700, letterSpacing:"-0.01em", color: isAcc ? "#5478C9" : "var(--matte-fg)", overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap"}}>{n}</span>
                  </div>
                  <span style={{fontSize:14, color: isAcc ? "#5478C9" : "var(--matte-fg-2)", fontWeight:700, flexShrink:0}}>{m}</span>
                </div>
                <div style={{fontSize:13, color:"var(--matte-fg-3)", paddingLeft:30}}>{d}</div>
              </div>
            );
          })}
          </window.DrStagger>
        </div>
      </div>
    </CardShell>
  );
}

/* ============================================================
   Card 12 — 날씨 영향 분석
   ============================================================ */
function Card12({ body = {} }) {
  const months = ["1월","2월","3월","4월","5월","6월","7월","8월","9월","10월","11월","12월"];
  const days = [2,2,4,5,7,9,15,12,7,4,3,2];
  const temps = [-2,1,7,14,19,23,26,27,22,15,8,1];

  return (
    <CardShell n="12" id="12"
      title="날씨 영향 분석"
      sub="연간 기상 분포와 매출 영향"
      sources={["기상청 종관기상관측", "자체 매출 매핑"]}>
      <div className="bc-grid-4" style={{gap:16, marginBottom:16}}>
        <StatTile id="c12.tile1" tone="cream" label="맑음" value="148" unit="일/년" hero/>
        <StatTile id="c12.tile2" tone="lilac" label="흐림" value="146" unit="일/년"/>
        <StatTile id="c12.tile3" tone="blue"  label="비"   value="61"  unit="일/년"/>
        <StatTile id="c12.tile4" tone="mint"  label="눈"   value="10"  unit="일/년"/>
      </div>

      <div style={{display:"grid", gridTemplateColumns:"1.4fr 1fr", gap:16, alignItems:"start"}}>
        <div className="bc-box" style={{padding:24}}>
          <div style={{display:"flex", justifyContent:"space-between", alignItems:"baseline", marginBottom:18}}>
            <span style={{fontSize:16, fontWeight:600}}>월별 비/눈 일수 + 평균 기온</span>
            <span style={{fontSize:13, color:"var(--matte-fg-3)"}}>연평균 <strong style={{color:"var(--matte-fg)", fontWeight:700, fontSize:15, marginLeft:4}}>13.0°C</strong></span>
          </div>
          <window.DrStagger id="c12.cal" delay={50} style={{display:"grid", gridTemplateColumns:"repeat(12, 1fr)", gap:6, alignItems:"flex-end", height:220}}>
            {months.map((m, i) => {
              const tH = ((temps[i] + 5) / 35) * 180;
              const isHotMax = temps[i] === Math.max(...temps);
              const color = isHotMax ? "#5478C9" : "#FFFFFF";
              return (
                <div key={m} style={{display:"flex", flexDirection:"column", alignItems:"center", gap:6, height:"100%", justifyContent:"flex-end"}}>
                  <div style={{fontSize:13, fontWeight:600, color: isHotMax ? "#5478C9" : "var(--matte-fg-2)", fontVariantNumeric:"tabular-nums"}}>{days[i]}</div>
                  <div style={{width:"100%", height: tH, background: color, borderRadius:"4px 4px 0 0", opacity: isHotMax ? 1 : 0.85}}></div>
                </div>
              );
            })}
          </window.DrStagger>
          <div style={{display:"grid", gridTemplateColumns:"repeat(12, 1fr)", gap:6, marginTop:10}}>
            {months.map(m => <div key={m} style={{fontSize:13, textAlign:"center", color:"var(--matte-fg-3)"}}>{m}</div>)}
          </div>

          {/* 계절별 매출 변동 */}
          <div style={{marginTop:24, paddingTop:20, borderTop:"1px solid var(--matte-line)"}}>
            <div style={{fontSize:14, color:"var(--matte-fg-3)", fontWeight:500, marginBottom:14}}>계절별 매출 변동</div>
            <div style={{display:"grid", gridTemplateColumns:"repeat(4, 1fr)", gap:10}}>
              {[
                ["봄 (3~5월)", "+8", "안정"],
                ["여름 (6~8월)", "+14", "성수기"],
                ["가을 (9~11월)", "+6", "안정"],
                ["겨울 (12~2월)", "-12", "비수기"],
              ].map(([k, v, t]) => {
                const isPos = v.startsWith("+");
                const accent = v === "+14";
                return (
                  <div key={k} style={{padding:"16px 16px", background:"rgba(255,255,255,0.03)", borderRadius:10, border:"1px solid var(--matte-line)"}}>
                    <div style={{fontSize:13, color:"var(--matte-fg-3)", marginBottom:8, fontWeight:500}}>{k}</div>
                    <div style={{fontSize:24, fontWeight:700, fontVariantNumeric:"tabular-nums", color: accent ? "#5478C9" : "var(--matte-fg)", letterSpacing:"-0.01em"}}>{v}<span style={{fontSize:13, color:"var(--matte-fg-3)", marginLeft:2, fontWeight:500}}>%</span></div>
                    <div style={{fontSize:13, color:"var(--matte-fg-3)", marginTop:6}}>{t}</div>
                  </div>
                );
              })}
            </div>
          </div>

          <div style={{fontSize:13, color:"var(--matte-fg-4)", marginTop:14}}>막대 높이 = 평균 기온 · 상단 숫자 = 비/눈 일수</div>
        </div>

        <div>
          <div className="bc-box" style={{padding:22, marginBottom:12}}>
            <div style={{fontSize:16, fontWeight:600, marginBottom:16}}>날씨별 매출 영향</div>
            <div style={{display:"flex", flexDirection:"column", gap:12}}>
              {[
                ["맑음", 100, "기준값", false],
                ["비", 114, "+14%", true],
                ["눈", 78, "-22%", false],
                ["폭염", 91, "-9%", false],
              ].map(([k, v, sub, acc]) => (
                <div key={k} style={{display:"grid", gridTemplateColumns:"60px 1fr 80px", gap:12, alignItems:"center"}}>
                  <span style={{fontSize:15, color:"var(--matte-fg-2)", fontWeight:500}}>{k}</span>
                  <div className="bc-bar" style={{height:12, background:"rgba(255,255,255,0.05)"}}>
                    <div style={{width:`${(v/120)*100}%`, background: acc ? "#5478C9" : "#FFFFFF", height:"100%", borderRadius:"inherit"}}></div>
                  </div>
                  <span style={{textAlign:"right", fontSize:14, fontWeight:700, color: acc ? "#5478C9" : "var(--matte-fg)", fontVariantNumeric:"tabular-nums"}}>{sub}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="bc-box" style={{padding:20, marginBottom:12}}>
            <div style={{fontSize:14, color:"var(--matte-fg-3)", fontWeight:500, marginBottom:10}}>운영 인사이트</div>
            <div style={{fontSize:15, lineHeight:1.65, color:"var(--matte-fg-2)"}}>비 오는 날 매출 <strong style={{color:"#5478C9"}}>+14%</strong> 상승. 미팅 체류 수요. 폭염·폭설 시 -22%까지 빠짐 — 배달 채널이 완충.</div>
          </div>

          <div className="bc-grid-2" style={{gap:10}}>
            <Box label="연평균 기온" value="13.0" unit="°C"/>
            <Box label="여름 최고"  value="34.7" unit="°C"/>
            <Box label="겨울 최저"  value="-15.8" unit="°C"/>
            <Box label="강수일/연"  value="61" unit="일" sub="전국 평균 +7일"/>
          </div>
        </div>
      </div>
    </CardShell>
  );
}

Object.assign(window, { Card08, Card09, Card10, Card11, Card12 });
