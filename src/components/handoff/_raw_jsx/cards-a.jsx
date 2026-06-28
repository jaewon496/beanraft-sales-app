/* cards-a.jsx — Cards 01-07
   SnowUI Dashboard tone: pastel stat tiles + dark cards + clean charts.
   Each card: CardShell header + body + sources footer. */

/* ============================================================
   Card 01 — 상권 분석 리포트
   Hero KPI 350개 매장, 도넛 카페 비율, 6박스 그리드, 임대시세 3박스, 분기 라인 3개
   ============================================================ */
function Card01({ body = {} }) {
  const cafeCount = body.cafeCount ?? 350;
  return (
    <CardShell n="01" id="01"
      title="상권 분석 리포트"
      sub="반경 500m 매장 구성과 임대 시세"
      sources={["소상공인진흥공단", "나이스비즈맵", "한국부동산원 (KOSIS 408)"]}
      headerRight={window.MapTriggerButton ? <window.MapTriggerButton/> : null}>
      {/* Top: hero + donut */}
      <div className="bc-grid-4" style={{gap:16, marginBottom:16}}>
        <StatTile id="c1.tile1" tone="blue"  label="총 매장 수"     value={String(cafeCount)} unit="개" delta="6.7" deltaPositive hero/>
        <StatTile id="c1.tile2" tone="lilac" label="카페 수"        value="126"               unit="개" delta="4.1" deltaPositive/>
        <StatTile id="c1.tile3" tone="mint"  label="평당 월세"      value="42"                unit="만원" delta="2.8" deltaPositive/>
        <StatTile id="c1.tile4" tone="rose"  label="공실률"         value="4.2"               unit="%"   delta="0.6" deltaPositive={false}/>
      </div>

      <div style={{display:"grid", gridTemplateColumns:"1fr 1fr", gap:16}}>
        {/* Left: 6-box composition */}
        <div className="bc-box" style={{padding:18}}>
          <div style={{fontSize:15, fontWeight:600, marginBottom:12}}>매장</div>
          <div className="bc-grid-3" style={{gap:10}}>
            {[
              ["카페", "126", "blue"],
              ["프랜차이즈", "47", "lilac"],
              ["개인 카페", "71", "mint"],
              ["베이커리", "8", "cream"],
              ["신규 (1년)", "5", "mint"],
              ["폐업 (1년)", "8", "rose"],
            ].map(([l, v, t]) => (
              <div key={l} className={`bc-tile tone-${t}`} style={{padding:"14px 16px", minHeight:72, gap:4}}>
                <div className="label" style={{fontSize:15}}>{l}</div>
                <div className="value" style={{fontSize:22}}>{v}<span className="unit" style={{fontSize:15}}>개</span></div>
              </div>
            ))}
          </div>
        </div>

        {/* Right: donut */}
        <div className="bc-box" style={{padding:18}}>
          <div style={{fontSize:15, fontWeight:600, marginBottom:12}}>카페 비율</div>
          <div style={{display:"flex", alignItems:"center", gap:18, justifyContent:"center"}}>
            <Donut id="c1.donut" size={200} segments={[
              {value:56, color:"#4C7BE4", label:"개인 카페"},
              {value:37, color:"#FFFFFF", label:"프랜차이즈"},
              {value:7,  color:"#7a7a7a", label:"베이커리"},
            ]} centerLabel="126" centerSub="카페 매장"/>
            <DonutLegend segments={[
              {value:56, color:"#4C7BE4", label:"개인", text:"56%"},
              {value:37, color:"#FFFFFF", label:"프랜차이즈", text:"37%"},
              {value:7,  color:"#7a7a7a", label:"베이커리", text:"7%"},
            ]}/>
          </div>
        </div>
      </div>

      {/* Lower: 3 quarter trends */}
      <div className="bc-grid-3" style={{gap:12, marginTop:16}}>
        {[
          { l:"평당 월세", v:"42만원", d:"+8.0", color:"#FFFFFF", data:[34,35,35,36,37,38,38,39,40,41,42,42] },
          { l:"공실률",   v:"4.2%",   d:"-2.2", color:"#FFFFFF", data:[6.4,6.0,5.5,5.2,5.0,4.8,4.7,4.5,4.4,4.3,4.2,4.2] },
          { l:"신규 개업", v:"5개",     d:"+25",  color:"#4C7BE4", data:[3,4,3,5,4,6,5,5] },
        ].map((t, i) => (
          <div key={i} className="bc-box" style={{padding:18}}>
            <div style={{display:"flex", justifyContent:"space-between", alignItems:"baseline", marginBottom:10}}>
              <span style={{fontSize:14, color:"var(--matte-fg-3)", fontWeight:500}}>{t.l}</span>
              <span style={{fontSize:14, color: t.color === "#4C7BE4" ? "#4C7BE4" : "var(--matte-fg-2)", fontWeight:600, fontVariantNumeric:"tabular-nums"}}>{t.d}%</span>
            </div>
            <div style={{fontSize:24, fontWeight:700, marginBottom:14, fontVariantNumeric:"tabular-nums", letterSpacing:"-0.01em"}}>{t.v}</div>
            <Sparkline data={t.data} height={56} color={t.color}/>
          </div>
        ))}
      </div>
    </CardShell>
  );
}

/* ============================================================
   Card 02 — 고객 분석
   ============================================================ */
function Card02({ body = {} }) {
  return (
    <CardShell n="02" id="02"
      title="고객 분석"
      sub="방문 고객 특성"
      sources={["나이스비즈맵", "통계청 인구주택총조사"]}>
      {/* 4-up KPI */}
      <div className="bc-grid-4" style={{gap:16, marginBottom:16}}>
        <StatTile id="c2.tile1" tone="blue"  label="주요 연령대"   value="30대"     delta="34" deltaPositive hero accent/>
        <StatTile id="c2.tile2" tone="lilac" label="성비 (여:남)" value="49 : 51"/>
        <StatTile id="c2.tile3" tone="mint"  label="재방문율" value="38" unit="%" delta="6.0" deltaPositive/>
        <StatTile id="c2.tile4" tone="cream" label="신규 비율" value="62" unit="%"/>
      </div>

      <div style={{display:"grid", gridTemplateColumns:"1.2fr 1fr", gap:16}}>
        {/* 연령대 + 소득 */}
        <div className="bc-box" style={{padding:24}}>
          <div style={{fontSize:16, fontWeight:600, marginBottom:18}}>연령대 분포</div>
          <VBars id="c2.bars" accent={1} barW={48} gap={28} height={200} items={[
            {l:"20대", v:24, t:"24%"},
            {l:"30대", v:34, t:"34%"},
            {l:"40대", v:23, t:"23%"},
            {l:"50대+", v:19, t:"19%"},
          ]}/>
          <div style={{marginTop:24, paddingTop:20, borderTop:"1px solid var(--matte-line)"}}>
            <div style={{fontSize:14, color:"var(--matte-fg-3)", fontWeight:500, marginBottom:14}}>평균 소득 (월)</div>
            <div style={{display:"flex", flexDirection:"column", gap:14}}>
              {[
                ["남성", 487, 600, "#FFFFFF"],
                ["여성", 412, 600, "#FFFFFF"],
              ].map(([who, v, max, c]) => (
                <div key={who} style={{display:"grid", gridTemplateColumns:"60px 1fr 90px", gap:14, alignItems:"center"}}>
                  <span style={{fontSize:15, color:"var(--matte-fg-2)", fontWeight:500}}>{who}</span>
                  <div className="bc-bar" style={{height:14, background:"rgba(255,255,255,0.05)"}}>
                    <div style={{width:`${(v/max)*100}%`, background:c, height:"100%", borderRadius:"inherit"}}></div>
                  </div>
                  <span style={{textAlign:"right", fontSize:17, fontWeight:700, fontVariantNumeric:"tabular-nums"}}>{v}<span style={{fontSize:13, color:"var(--matte-fg-3)", fontWeight:500, marginLeft:3}}>만원</span></span>
                </div>
              ))}
            </div>
          </div>

          <div style={{marginTop:18, paddingTop:14, borderTop:"1px solid var(--matte-line)"}}>
            <div style={{display:"flex", justifyContent:"space-between", alignItems:"baseline", marginBottom:8, fontSize:13}}>
              <span style={{color:"var(--matte-fg-3)", fontWeight:500}}>방문 목적</span>
              <span style={{color:"var(--matte-fg-3)"}}>업무·미팅 <strong style={{color:"#4C7BE4", fontWeight:700}}>38%</strong> 최다</span>
            </div>
            <div style={{display:"flex", height:10, borderRadius:5, overflow:"hidden"}}>
              {[
                ["업무·미팅", 38, "#4C7BE4"],
                ["식사·디저트", 26, "#FFFFFF"],
                ["스터디", 19, "#A9C2F4"],
                ["휴식·산책", 17, "#7a7a7a"],
              ].map(([l, v, c]) => (
                <div key={l} style={{width:`${v}%`, background:c}}></div>
              ))}
            </div>
          </div>
        </div>

        {/* 라이프스타일 */}
        <div className="bc-box" style={{padding:24}}>
          <div style={{fontSize:16, fontWeight:600, marginBottom:20}}>라이프스타일 키워드</div>
          <div style={{display:"flex", flexDirection:"column", gap:16}}>
            {[
              ["여성", "51%", ["브런치", "SNS 인증", "미팅", "디저트 카페", "포토존"]],
              ["남성", "49%", ["업무", "스터디", "퇴근 후", "회의", "혼카페"]],
            ].map(([who, ratio, keywords]) => (
              <div key={who} style={{padding:"20px 22px", background:"rgba(255,255,255,0.03)", borderRadius:12, border:"1px solid var(--matte-line)"}}>
                <div style={{display:"flex", justifyContent:"space-between", alignItems:"baseline", marginBottom:14}}>
                  <span style={{fontSize:16, fontWeight:700, color:"#fff"}}>{who}</span>
                  <span style={{fontSize:14, color:"var(--matte-fg-3)", fontWeight:600, fontVariantNumeric:"tabular-nums"}}>{ratio}</span>
                </div>
                <window.DrStagger id="c2.chips" delay={50} style={{display:"flex", gap:8, flexWrap:"wrap"}}>
                  {keywords.map(k => (
                    <span key={k} style={{padding:"7px 14px", background:"rgba(255,255,255,0.06)", border:"1px solid var(--matte-line)", borderRadius:8, fontSize:14, color:"var(--matte-fg-2)", fontWeight:500}}>#{k}</span>
                  ))}
                </window.DrStagger>
              </div>
            ))}
            <div style={{paddingTop:16, borderTop:"1px solid var(--matte-line)", display:"grid", gridTemplateColumns:"1fr 1fr", gap:14}}>
              <div>
                <div style={{fontSize:13, color:"var(--matte-fg-3)", marginBottom:6, fontWeight:500}}>주중 vs 주말</div>
                <div style={{fontSize:18, fontWeight:700, fontVariantNumeric:"tabular-nums"}}>77 <span style={{fontSize:13, color:"var(--matte-fg-3)", fontWeight:500}}>:</span> 23</div>
              </div>
              <div>
                <div style={{fontSize:13, color:"var(--matte-fg-3)", marginBottom:6, fontWeight:500}}>피크 시간대</div>
                <div style={{fontSize:18, fontWeight:700, fontVariantNumeric:"tabular-nums", color:"#4C7BE4"}}>12 <span style={{fontSize:13, color:"var(--matte-fg-3)", fontWeight:500}}>~ 18시</span></div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </CardShell>
  );
}

/* ============================================================
   Card 03 — 상권 변화 추이
   ============================================================ */
function Card03({ body = {} }) {
  return (
    <CardShell n="03" id="03"
      title="상권 변화 추이"
      sub="개폐업 및 상권 트렌드"
      sources={["국세청 (KOSIS 133)", "소상공인진흥공단"]}>
      {/* Top tiles */}
      <div className="bc-grid-4" style={{gap:16, marginBottom:16}}>
        <StatTile id="c3.tile1" tone="mint"  label="추세"        value="성장"  hero/>
        <StatTile id="c3.tile2" tone="blue"  label="신규 개업"   value="5"     unit="개" delta="25.0" deltaPositive/>
        <StatTile id="c3.tile3" tone="rose"  label="폐업"        value="8"     unit="개" delta="14.3" deltaPositive={false}/>
        <StatTile id="c3.tile4" tone="lilac" label="순증감"      value="-3"    unit="개"/>
      </div>

      <div style={{display:"grid", gridTemplateColumns:"1.2fr 1fr", gap:16}}>
        {/* 생존율 + 5년전/지금 비교 */}
        <div className="bc-box" style={{padding:24}}>
          <div style={{fontSize:16, fontWeight:600, marginBottom:18}}>생존율</div>
          <div style={{display:"flex", flexDirection:"column", gap:14}}>
            <BarRow id="c3.g1" label="1년 생존" value={89} max={100} suffix="%"/>
            <BarRow id="c3.g3" label="3년 생존" value={71} max={100} suffix="%" accent/>
            <BarRow id="c3.g5" label="5년 생존" value={52} max={100} suffix="%"/>
          </div>
          <div style={{display:"grid", gridTemplateColumns:"1fr 1fr 1fr", gap:14, marginTop:22, paddingTop:18, borderTop:"1px solid var(--matte-line)"}}>
            <div>
              <div style={{fontSize:13, color:"var(--matte-fg-3)", fontWeight:500, marginBottom:6}}>5년 전</div>
              <div style={{fontSize:24, fontWeight:700, fontVariantNumeric:"tabular-nums", letterSpacing:"-0.01em"}}>108<span style={{fontSize:13, color:"var(--matte-fg-3)", marginLeft:3, fontWeight:500}}>개</span></div>
            </div>
            <div>
              <div style={{fontSize:13, color:"var(--matte-fg-3)", fontWeight:500, marginBottom:6}}>현재</div>
              <div style={{fontSize:24, fontWeight:700, color:"#4C7BE4", fontVariantNumeric:"tabular-nums", letterSpacing:"-0.01em"}}>126<span style={{fontSize:13, color:"var(--matte-fg-3)", marginLeft:3, fontWeight:500}}>개</span></div>
            </div>
            <div>
              <div style={{fontSize:13, color:"var(--matte-fg-3)", fontWeight:500, marginBottom:6}}>증감</div>
              <div style={{fontSize:24, fontWeight:700, fontVariantNumeric:"tabular-nums", letterSpacing:"-0.01em"}}>+16.7<span style={{fontSize:13, color:"var(--matte-fg-3)", marginLeft:3, fontWeight:500}}>%</span></div>
            </div>
          </div>

          <div style={{marginTop:18, paddingTop:16, borderTop:"1px solid var(--matte-line)"}}>
            <div style={{fontSize:14, color:"var(--matte-fg-3)", fontWeight:500, marginBottom:10}}>평균 영업 기간</div>
            <div style={{display:"grid", gridTemplateColumns:"repeat(3, 1fr)", gap:10}}>
              {[
                ["폐업 시점", "3.8", "년"],
                ["5년+ 운영", "52", "%"],
                ["1년내 폐업", "11", "%"],
              ].map(([l, v, u]) => (
                <div key={l}>
                  <div style={{fontSize:13, color:"var(--matte-fg-3)", marginBottom:4, fontWeight:500}}>{l}</div>
                  <div style={{fontSize:20, fontWeight:700, fontVariantNumeric:"tabular-nums", letterSpacing:"-0.01em"}}>{v}<span style={{fontSize:13, color:"var(--matte-fg-3)", marginLeft:3, fontWeight:500}}>{u}</span></div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* 메뉴 트렌드 */}
        <div className="bc-box" style={{padding:24}}>
          <div style={{fontSize:16, fontWeight:600, marginBottom:18}}>메뉴 트렌드</div>
          <div style={{fontSize:14, color:"var(--matte-fg-3)", marginBottom:10, fontWeight:500}}>인기 TOP 3</div>
          <div style={{display:"flex", flexDirection:"column", gap:10, marginBottom:18}}>
            {[["아이스 아메리카노", 42], ["라떼", 31], ["콜드브루", 18]].map(([m, p], i) => (
              <div key={m} style={{display:"grid", gridTemplateColumns:"24px 1fr 50px", gap:10, alignItems:"center"}}>
                <span style={{fontSize:13, color:"var(--matte-fg-4)", fontWeight:600, fontVariantNumeric:"tabular-nums"}}>{i+1}</span>
                <div>
                  <div style={{fontSize:14, color:"var(--matte-fg-2)", fontWeight:600, marginBottom:4}}>{m}</div>
                  <div className="bc-bar" style={{height:6, background:"rgba(255,255,255,0.04)"}}>
                    <div style={{width:`${p*2}%`, background: i === 0 ? "#4C7BE4" : "#FFFFFF", height:"100%", borderRadius:"inherit"}}></div>
                  </div>
                </div>
                <span style={{textAlign:"right", fontSize:14, fontWeight:700, fontVariantNumeric:"tabular-nums", color: i === 0 ? "#4C7BE4" : "var(--matte-fg)"}}>{p}%</span>
              </div>
            ))}
          </div>
          <div style={{fontSize:14, color:"var(--matte-fg-3)", marginBottom:10, fontWeight:500, paddingTop:14, borderTop:"1px solid var(--matte-line)"}}>급상승 TOP 3</div>
          <div style={{display:"flex", flexDirection:"column", gap:10}}>
            {[["크림 라떼", 28], ["디카페인", 19], ["그릭 요거트", 15]].map(([m, p], i) => (
              <div key={m} style={{display:"grid", gridTemplateColumns:"24px 1fr 60px", gap:10, alignItems:"center"}}>
                <span style={{fontSize:13, color:"var(--matte-fg-4)", fontWeight:600, fontVariantNumeric:"tabular-nums"}}>{i+1}</span>
                <div>
                  <div style={{fontSize:14, color:"var(--matte-fg-2)", fontWeight:600, marginBottom:4}}>{m}</div>
                  <div className="bc-bar" style={{height:6, background:"rgba(255,255,255,0.04)"}}>
                    <div style={{width:`${(p/30)*100}%`, background: i === 0 ? "#4C7BE4" : "#FFFFFF", height:"100%", borderRadius:"inherit"}}></div>
                  </div>
                </div>
                <span style={{textAlign:"right", fontSize:14, fontWeight:700, fontVariantNumeric:"tabular-nums", color: i === 0 ? "#4C7BE4" : "var(--matte-fg)"}}>+{p}%</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* 1년 폐업 + 생존율 — 가로 3-up KPI 그리드 */}
      <div className="bc-grid-3" style={{gap:12, marginTop:14}}>
        <div className="bc-box" style={{padding:20}}>
          <div style={{fontSize:14, color:"var(--matte-fg-3)", marginBottom:8, fontWeight:500}}>이 동 1년 폐업</div>
          <div style={{display:"flex", alignItems:"baseline", gap:8}}>
            <span style={{fontSize:32, fontWeight:700, fontVariantNumeric:"tabular-nums", letterSpacing:"-0.01em"}}>8</span>
            <span style={{fontSize:15, color:"var(--matte-fg-3)"}}>개</span>
          </div>
          <div style={{fontSize:13, color:"var(--matte-fg-3)", marginTop:6, fontVariantNumeric:"tabular-nums"}}>동 평균 11개 대비 -27%</div>
        </div>
        <div className="bc-box" style={{padding:20}}>
          <div style={{fontSize:14, color:"var(--matte-fg-3)", marginBottom:8, fontWeight:500}}>3년 생존율</div>
          <div style={{display:"flex", alignItems:"baseline", gap:8}}>
            <span style={{fontSize:32, fontWeight:700, fontVariantNumeric:"tabular-nums", letterSpacing:"-0.01em", color:"#4C7BE4"}}>71</span>
            <span style={{fontSize:15, color:"var(--matte-fg-3)"}}>%</span>
          </div>
          <div style={{fontSize:13, color:"var(--matte-fg-3)", marginTop:6, fontVariantNumeric:"tabular-nums"}}>강남 평균 65% 대비 +6%p</div>
        </div>
        <div className="bc-box" style={{padding:20}}>
          <div style={{fontSize:14, color:"var(--matte-fg-3)", marginBottom:8, fontWeight:500}}>5년 생존율</div>
          <div style={{display:"flex", alignItems:"baseline", gap:8}}>
            <span style={{fontSize:32, fontWeight:700, fontVariantNumeric:"tabular-nums", letterSpacing:"-0.01em"}}>52</span>
            <span style={{fontSize:15, color:"var(--matte-fg-3)"}}>%</span>
          </div>
          <div style={{fontSize:13, color:"var(--matte-fg-3)", marginTop:6, fontVariantNumeric:"tabular-nums"}}>서울 평균 38% 대비 +14%p</div>
        </div>
      </div>
    </CardShell>
  );
}

/* ============================================================
   Card 04 — 프랜차이즈 현황
   ============================================================ */
function Card04({ body = {} }) {
  return (
    <CardShell n="04" id="04"
      title="프랜차이즈 현황"
      sub="주요 프랜차이즈 브랜드 분석"
      sources={["나이스비즈맵", "공정거래위원회 가맹사업거래"]}>
      <div className="bc-grid-4" style={{gap:16, marginBottom:16}}>
        <StatTile tone="lilac" label="프랜차이즈 매장" value="140" unit="개" hero/>
        <StatTile tone="blue"  label="시장 점유"      value="40"  unit="%" delta="2.1" deltaPositive/>
        <StatTile tone="mint"  label="200m 내"       value="14"  unit="개"/>
        <StatTile tone="cream" label="카페당 잠재 고객" value="4,592" unit="명/일"/>
      </div>

      <div style={{display:"grid", gridTemplateColumns:"1.2fr 1fr", gap:16}}>
        <div className="bc-box" style={{padding:24}}>
          <div style={{fontSize:16, fontWeight:600, marginBottom:18}}>브랜드 TOP 7</div>
          <window.DrStagger id="c4.top7" delay={90} style={{display:"flex", flexDirection:"column", gap:4}}>
          {[
            ["스타벅스", 11],
            ["이디야", 7],
            ["투썸플레이스", 6],
            ["메가커피", 5],
            ["폴바셋", 5],
            ["커피빈", 4],
            ["빽다방", 4],
          ].map(([n, v], i) => (
            <BarRow key={i} label={n} value={v} max={12} suffix="개" accent={i === 0}/>
          ))}
          </window.DrStagger>

          <div style={{marginTop:20, paddingTop:18, borderTop:"1px solid var(--matte-line)"}}>
            <div style={{fontSize:14, color:"var(--matte-fg-3)", fontWeight:500, marginBottom:14}}>점유 비율</div>
            <div className="bc-bar" style={{height:18, background:"rgba(255,255,255,0.05)", marginBottom:12}}>
              <div style={{display:"flex", height:"100%"}}>
                <div style={{width:"40%", background:"#FFFFFF"}}></div>
                <div style={{width:"54%", background:"#4C7BE4"}}></div>
                <div style={{width:"6%", background:"#7a7a7a"}}></div>
              </div>
            </div>
            <div style={{display:"flex", justifyContent:"space-between", fontSize:14, color:"var(--matte-fg-2)", gap:24}}>
              <span><span style={{display:"inline-block", width:10, height:10, borderRadius:9999, background:"#FFFFFF", marginRight:8, verticalAlign:"middle"}}></span>프랜차이즈 <strong style={{color:"#fff", marginLeft:4}}>40%</strong></span>
              <span><span style={{display:"inline-block", width:10, height:10, borderRadius:9999, background:"#4C7BE4", marginRight:8, verticalAlign:"middle"}}></span><strong style={{color:"#4C7BE4"}}>개인 54%</strong></span>
              <span><span style={{display:"inline-block", width:10, height:10, borderRadius:9999, background:"#7a7a7a", marginRight:8, verticalAlign:"middle"}}></span>베이커리 <strong style={{color:"#fff", marginLeft:4}}>6%</strong></span>
            </div>
          </div>
        </div>

        <div className="bc-box" style={{padding:24}}>
          <div style={{fontSize:16, fontWeight:600, marginBottom:18}}>거리별 분포</div>
          <div style={{display:"flex", flexDirection:"column", gap:14, marginBottom:24}}>
            {[
              ["200m 이내", 14, "근접", false],
              ["200~350m", 19, "최다 구간", true],
              ["350~500m", 14, "외곽", false],
            ].map(([k, v, sub, acc]) => (
              <div key={k} style={{display:"grid", gridTemplateColumns:"120px 1fr 60px", gap:12, alignItems:"center"}}>
                <div>
                  <div style={{fontSize:14, color:"var(--matte-fg-2)", fontWeight:600}}>{k}</div>
                  <div style={{fontSize:13, color:"var(--matte-fg-3)", marginTop:2}}>{sub}</div>
                </div>
                <div className="bc-bar" style={{height:14, background:"rgba(255,255,255,0.05)"}}>
                  <div style={{width:`${(v/20)*100}%`, background: acc ? "#4C7BE4" : "#FFFFFF", height:"100%", borderRadius:"inherit"}}></div>
                </div>
                <span style={{textAlign:"right", fontSize:17, fontWeight:700, color: acc ? "#4C7BE4" : "var(--matte-fg)", fontVariantNumeric:"tabular-nums"}}>{v}<span style={{fontSize:13, color:"var(--matte-fg-3)", fontWeight:500, marginLeft:2}}>개</span></span>
              </div>
            ))}
          </div>

          <div style={{paddingTop:20, borderTop:"1px solid var(--matte-line)"}}>
            <div style={{fontSize:14, color:"var(--matte-fg-3)", fontWeight:500, marginBottom:14}}>국적별 분포</div>
            <div className="bc-grid-2" style={{gap:12}}>
              <div style={{padding:"16px 18px", background:"rgba(255,255,255,0.03)", borderRadius:10, border:"1px solid var(--matte-line)"}}>
                <div style={{fontSize:13, color:"var(--matte-fg-3)", marginBottom:6, fontWeight:500}}>국내 브랜드</div>
                <div style={{fontSize:22, fontWeight:700, fontVariantNumeric:"tabular-nums", letterSpacing:"-0.01em"}}>34<span style={{fontSize:13, color:"var(--matte-fg-3)", marginLeft:3, fontWeight:500}}>개</span></div>
                <div style={{fontSize:13, color:"var(--matte-fg-3)", marginTop:4}}>비중 72%</div>
              </div>
              <div style={{padding:"16px 18px", background:"rgba(76, 123, 228,0.08)", borderRadius:10, border:"1px solid rgba(76, 123, 228,0.45)"}}>
                <div style={{fontSize:13, color:"var(--matte-fg-3)", marginBottom:6, fontWeight:500}}>해외 브랜드</div>
                <div style={{fontSize:22, fontWeight:700, color:"#4C7BE4", fontVariantNumeric:"tabular-nums", letterSpacing:"-0.01em"}}>13<span style={{fontSize:13, color:"var(--matte-fg-3)", marginLeft:3, fontWeight:500}}>개</span></div>
                <div style={{fontSize:13, color:"var(--matte-fg-3)", marginTop:4}}>비중 28%</div>
              </div>
            </div>
          </div>

          <div style={{marginTop:16, paddingTop:14, borderTop:"1px solid var(--matte-line)", display:"flex", justifyContent:"space-between", alignItems:"center", gap:10, fontSize:13}}>
            <div>
              <span style={{color:"var(--matte-fg-4)", fontWeight:600, marginRight:8}}>신규</span>
              <span style={{color:"#4C7BE4", fontWeight:700, marginRight:8, fontVariantNumeric:"tabular-nums"}}>+2</span>
              <span style={{color:"var(--matte-fg-2)"}}>블루보틀·폴바셋</span>
            </div>
            <div>
              <span style={{color:"var(--matte-fg-4)", fontWeight:600, marginRight:8}}>철수</span>
              <span style={{color:"var(--matte-fg-3)", fontWeight:700, marginRight:8, fontVariantNumeric:"tabular-nums"}}>-2</span>
              <span style={{color:"var(--matte-fg-2)"}}>탐앤탐스·카페베네</span>
            </div>
          </div>
        </div>
      </div>
    </CardShell>
  );
}

/* ============================================================
   Card 05 — 개인 카페 분석
   ============================================================ */
function Card05({ body = {} }) {
  return (
    <CardShell n="06" id="06"
      title="개인 카페 분석"
      sub="주변 개인 카페 현황 및 가격대"
      sources={["나이스비즈맵", "오픈업 리뷰 수집", "국세청 (KOSIS 133)"]}>
      <div className="bc-grid-4" style={{gap:16, marginBottom:16}}>
        <StatTile id="c5.tile1" tone="blue"  label="개인 카페 수" value="71" unit="개" hero/>
        <StatTile id="c5.tile2" tone="mint"  label="비중"        value="56" unit="%" delta="3.2" deltaPositive/>
        <StatTile id="c5.tile3" tone="lilac" label="아메리카노 평균" value="4,500" unit="원" accent/>
        <StatTile id="c5.tile4" tone="cream" label="대표메뉴 평균"   value="6,800" unit="원"/>
      </div>

      <div style={{display:"grid", gridTemplateColumns:"1fr 1fr", gap:16}}>
        <div className="bc-box" style={{padding:24, display:"flex", flexDirection:"column"}}>
          <div style={{fontSize:18, fontWeight:700, marginBottom:20}}>가까운 개인 카페 TOP 5</div>
          <window.DrStagger id="c5.top5" delay={80} style={{display:"grid", gridTemplateColumns:"repeat(2, minmax(0, 1fr))", gap:10}}>
          {[
            ["로스터리 그라운드", 92, "원두 자가 로스팅"],
            ["블루보틀 강남", 138, "뉴올리언스 콜드브루"],
            ["로파이 강남", 215, "감성 인테리어"],
            ["테라로사 강남", 289, "에티오피아 핸드드립"],
            ["프롤로그", 342, "시그니처 라떼"],
          ].map(([n, d, sig], i) => {
            const isAcc = i === 0;
            return (
              <div key={i} style={{
                padding:"16px 18px",
                background: isAcc ? "rgba(76, 123, 228,0.10)" : "rgba(255,255,255,0.03)",
                border: isAcc ? "1px solid rgba(76, 123, 228,0.45)" : "1px solid var(--matte-line)",
                borderRadius:10,
                gridColumn: i === 4 ? "span 2" : "auto",
              }}>
                <div style={{display:"flex", alignItems:"baseline", gap:10, marginBottom:6, minWidth:0}}>
                  <span style={{fontSize:13, color:"var(--matte-fg-4)", fontVariantNumeric:"tabular-nums", fontWeight:700, flexShrink:0}}>{String(i+1).padStart(2,"0")}</span>
                  <span style={{fontSize:16, color:"var(--matte-fg)", fontWeight:700, letterSpacing:"-0.01em", flex:1, minWidth:0, wordBreak:"keep-all"}}>{n}</span>
                </div>
                <div style={{display:"flex", alignItems:"baseline", justifyContent:"space-between", gap:12, paddingLeft:23}}>
                  <span style={{fontSize:13, color:"var(--matte-fg-3)", minWidth:0, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap"}}>{sig}</span>
                  <span style={{fontSize:20, fontWeight:700, fontVariantNumeric:"tabular-nums", color: isAcc ? "#4C7BE4" : "var(--matte-fg)", letterSpacing:"-0.01em", flexShrink:0}}>{d}<span style={{fontSize:13, color:"var(--matte-fg-3)", marginLeft:2, fontWeight:500}}>m</span></span>
                </div>
              </div>
            );
          })}
          </window.DrStagger>

          <div style={{marginTop:"auto", paddingTop:16, borderTop:"1px solid var(--matte-line)", display:"flex", justifyContent:"space-between", alignItems:"center", gap:12, fontSize:13}}>
            <span style={{color:"var(--matte-fg-4)", fontWeight:600, letterSpacing:"0.04em"}}>원두 출처</span>
            <span style={{color:"var(--matte-fg-2)"}}><strong style={{color:"#4C7BE4", fontVariantNumeric:"tabular-nums"}}>32%</strong> 자가 로스팅</span>
            <span style={{color:"var(--matte-fg-2)"}}><strong style={{color:"var(--matte-fg)", fontVariantNumeric:"tabular-nums"}}>44%</strong> 국내 로스터리</span>
            <span style={{color:"var(--matte-fg-2)"}}><strong style={{color:"var(--matte-fg)", fontVariantNumeric:"tabular-nums"}}>24%</strong> 수입 원두</span>
          </div>
        </div>

        <div className="bc-box" style={{padding:24}}>
          <div style={{fontSize:16, fontWeight:600, marginBottom:18}}>아메리카노 가격 비교</div>
          <div style={{display:"flex", flexDirection:"column", gap:14, marginBottom:24}}>
            {[
              ["개인 카페 평균", 4500, true],
              ["스타벅스 톨", 4700, false],
              ["프랜차이즈 평균", 4200, false],
              ["저가 브랜드", 2500, false],
            ].map(([who, v, acc]) => (
              <div key={who} style={{display:"grid", gridTemplateColumns:"110px 1fr 80px", gap:12, alignItems:"center"}}>
                <span style={{fontSize:14, color:"var(--matte-fg-2)", fontWeight:500}}>{who}</span>
                <div className="bc-bar" style={{height:14, background:"rgba(255,255,255,0.05)"}}>
                  <div style={{width:`${(v/5000)*100}%`, background: acc ? "#4C7BE4" : "#FFFFFF", height:"100%", borderRadius:"inherit"}}></div>
                </div>
                <span style={{textAlign:"right", fontSize:15, fontWeight:700, color: acc ? "#4C7BE4" : "var(--matte-fg)", fontVariantNumeric:"tabular-nums"}}>{v.toLocaleString()}<span style={{fontSize:13, color:"var(--matte-fg-3)", marginLeft:2, fontWeight:500}}>원</span></span>
              </div>
            ))}
          </div>

          <div style={{paddingTop:20, borderTop:"1px solid var(--matte-line)"}}>
            <div style={{fontSize:14, color:"var(--matte-fg-3)", fontWeight:500, marginBottom:14}}>개인 카페 연간 폐업율</div>
            <div className="bc-grid-2" style={{gap:12}}>
              <div style={{padding:"18px 20px", background:"rgba(255,255,255,0.03)", borderRadius:10, border:"1px solid var(--matte-line)"}}>
                <div style={{fontSize:13, color:"var(--matte-fg-3)", marginBottom:8, fontWeight:500}}>서울 평균</div>
                <div style={{fontSize:24, fontWeight:700, fontVariantNumeric:"tabular-nums", letterSpacing:"-0.01em"}}>3.8<span style={{fontSize:13, color:"var(--matte-fg-3)", marginLeft:3, fontWeight:500}}>%/년</span></div>
              </div>
              <div style={{padding:"18px 20px", background:"rgba(76, 123, 228,0.08)", borderRadius:10, border:"1px solid rgba(76, 123, 228,0.45)"}}>
                <div style={{fontSize:13, color:"var(--matte-fg-3)", marginBottom:8, fontWeight:500}}>강남구 (현재 상권)</div>
                <div style={{fontSize:24, fontWeight:700, color:"#4C7BE4", fontVariantNumeric:"tabular-nums", letterSpacing:"-0.01em"}}>2.1<span style={{fontSize:13, color:"var(--matte-fg-3)", marginLeft:3, fontWeight:500}}>%/년</span></div>
              </div>
            </div>
            <div style={{fontSize:13, color:"var(--matte-fg-3)", marginTop:12, lineHeight:1.6}}>강남 상권의 개인 카페 폐업율이 서울 평균 대비 <strong style={{color:"#4C7BE4"}}>-1.7%p</strong> — 진입 안정성 강함.</div>
          </div>
        </div>
      </div>
    </CardShell>
  );
}

/* ============================================================
   Card 06 — 매출 분석
   ============================================================ */
function Card06({ body = {} }) {
  return (
    <CardShell n="05" id="05"
      title="매출 분석"
      sub="월평균 예상 매출"
      sources={["소상공인진흥공단", "나이스비즈맵", "한국은행 (KOSIS 301)"]}>
      <div className="bc-grid-4" style={{gap:16, marginBottom:16}}>
        <StatTile id="c6.tile1" tone="blue"  label="월평균 매출"     value="9,121" unit="만원" delta="13.4" deltaPositive hero accent/>
        <StatTile id="c6.tile2" tone="mint"  label="월 매출 건수"    value="3,671" unit="건"   delta="8.6"  deltaPositive/>
        <StatTile id="c6.tile3" tone="lilac" label="객단가"          value="24,800" unit="원"  delta="4.2"  deltaPositive/>
        <StatTile id="c6.tile4" tone="cream" label="업종 순위"       value="상위 12" unit="%"/>
      </div>

      <div style={{display:"grid", gridTemplateColumns:"2fr 1fr", gap:16}}>
        <div className="bc-box" style={{padding:24}}>
          <div style={{display:"flex", justifyContent:"space-between", alignItems:"baseline", marginBottom:18}}>
            <div style={{fontSize:16, fontWeight:600}}>매출 추이</div>
            <div style={{display:"flex", gap:16, fontSize:13, color:"var(--matte-fg-3)"}}>
              <span><span style={{display:"inline-block", width:10, height:10, background:"#4C7BE4", marginRight:6, borderRadius:9999, verticalAlign:"middle"}}></span>2026 현재</span>
              <span><span style={{display:"inline-block", width:14, height:2, background:"#A3A3A3", marginRight:6, verticalAlign:"middle", borderRadius:9999}}></span>2025 동기</span>
            </div>
          </div>
          <LineChart id="c6.line" width={680} height={240}
            data={[78,80,82,84,83,85,87,89,90,88,91,90,91.2]}
            comparison={[68,71,73,72,74,76,79,81,82,80,81,82,80]}
            color="#4C7BE4"
          />
          <div style={{display:"grid", gridTemplateColumns:"repeat(13, 1fr)", marginTop:10, gap:4}}>
            {["1월","2","3","4","5","6","7","8","9","10","11","12","현재"].map(m => (
              <div key={m} style={{fontSize:13, textAlign:"center", color:"var(--matte-fg-3)"}}>{m}</div>
            ))}
          </div>

          <div style={{marginTop:24, paddingTop:20, borderTop:"1px solid var(--matte-line)", display:"grid", gridTemplateColumns:"repeat(4, 1fr)", gap:14}}>
            {[
              ["동 최고", "1.42억", false],
              ["동 평균", "9,121만", true],
              ["동 최저", "3,290만", false],
              ["YoY 성장", "+16.4%", false],
            ].map(([l, v, acc]) => (
              <div key={l} style={{padding:"14px 16px", background:"rgba(255,255,255,0.03)", borderRadius:10, border:"1px solid var(--matte-line)"}}>
                <div style={{fontSize:13, color:"var(--matte-fg-3)", marginBottom:6, fontWeight:500}}>{l}</div>
                <div style={{fontSize:20, fontWeight:700, fontVariantNumeric:"tabular-nums", color: acc ? "#4C7BE4" : "var(--matte-fg)", letterSpacing:"-0.01em"}}>{v}</div>
              </div>
            ))}
          </div>

          <div style={{marginTop:18, paddingTop:18, borderTop:"1px solid var(--matte-line)"}}>
            <div style={{display:"flex", justifyContent:"space-between", alignItems:"baseline", marginBottom:14}}>
              <span style={{fontSize:14, color:"var(--matte-fg-3)", fontWeight:500}}>요일별 매출 패턴</span>
              <span style={{fontSize:13, color:"var(--matte-fg-3)"}}>금요일 피크 · 전 주 대비 <strong style={{color:"#4C7BE4", fontWeight:700, marginLeft:3}}>+4.8%</strong></span>
            </div>
            <window.DrStagger id="c6.dow" delay={60} style={{display:"flex", gap:10, alignItems:"flex-end", height:60}}>
              {[
                ["월", 78], ["화", 82], ["수", 85], ["목", 92], ["금", 100], ["토", 88], ["일", 74],
              ].map(([d, v], i) => {
                const isAcc = v === 100;
                return (
                  <div key={i} style={{flex:1, display:"flex", flexDirection:"column", alignItems:"center", gap:6}}>
                    <div style={{width:"100%", maxWidth:34, height:`${v*0.6}%`, background: isAcc ? "#4C7BE4" : "rgba(255,255,255,0.5)", borderRadius:"6px 6px 2px 2px"}}></div>
                    <span style={{fontSize:12, color: isAcc ? "#4C7BE4" : "var(--matte-fg-3)", fontWeight: isAcc ? 700 : 500}}>{d}</span>
                  </div>
                );
              })}
            </window.DrStagger>
          </div>
        </div>

        <div className="bc-box" style={{padding:24}}>
          <div style={{fontSize:18, fontWeight:700, marginBottom:20}}>구 동네별 카페 매출 TOP 5</div>
          <div style={{display:"flex", flexDirection:"column"}}>
            {[
              ["역삼1동", 1.42, "1.42억"],
              ["역삼2동", 1.18, "1.18억"],
              ["삼성1동", 0.98, "9,840만"],
              ["논현1동", 0.92, "9,210만"],
              ["대치2동", 0.86, "8,560만"],
            ].map(([n, v, label], i) => (
              <div key={i} style={{display:"grid", gridTemplateColumns:"36px 1fr auto", gap:14, alignItems:"center", padding:"14px 0", borderBottom: i<4 ? "1px solid var(--matte-line)" : "none"}}>
                <span style={{fontSize:15, color:"var(--matte-fg-4)", fontWeight:700, fontVariantNumeric:"tabular-nums"}}>{String(i+1).padStart(2,"0")}</span>
                <div>
                  <div style={{fontSize:16, color:"var(--matte-fg)", fontWeight:700, marginBottom:8, letterSpacing:"-0.005em"}}>{n}</div>
                  <div className="bc-bar" style={{height:8, background:"rgba(255,255,255,0.04)"}}>
                    <div style={{width:`${(v/1.5)*100}%`, background: i === 0 ? "#4C7BE4" : "#FFFFFF", height:"100%", borderRadius:"inherit"}}></div>
                  </div>
                </div>
                <span style={{fontSize:18, fontWeight:700, fontVariantNumeric:"tabular-nums", color: i === 0 ? "#4C7BE4" : "var(--matte-fg)", letterSpacing:"-0.01em"}}>{label}</span>
              </div>
            ))}
          </div>

          <div style={{marginTop:24, paddingTop:20, borderTop:"1px solid var(--matte-line)"}}>
            <div style={{fontSize:14, color:"var(--matte-fg-3)", fontWeight:500, marginBottom:10}}>이번 달 권역 소비심리</div>
            <div style={{display:"flex", alignItems:"baseline", gap:10}}>
              <span style={{fontSize:32, fontWeight:700, fontVariantNumeric:"tabular-nums", letterSpacing:"-0.01em"}}>102.4</span>
              <span style={{fontSize:14, color:"#4C7BE4", fontWeight:700, fontVariantNumeric:"tabular-nums"}}>+1.2 ↗</span>
            </div>
            <div style={{fontSize:13, color:"var(--matte-fg-3)", marginTop:8}}>100 이상 = 긍정 권역 · 한국은행 KOSIS 301</div>
          </div>
        </div>
      </div>
    </CardShell>
  );
}

/* ============================================================
   Card 07 — 유동인구
   ============================================================ */
function Card07({ body = {} }) {
  return (
    <CardShell n="07" id="07"
      title="유동인구"
      sub="시간대별 통행량"
      sources={["KT 빅데이터", "서울시 교통정보시스템"]}>
      <div className="bc-grid-4" style={{gap:16, marginBottom:16}}>
        <StatTile id="c7.tile1" tone="blue"  label="동 일평균 유동인구" value="578,505" unit="명" hero/>
        <StatTile id="c7.tile2" tone="mint"  label="최다 요일"        value="목요일"   delta="17.8"/>
        <StatTile id="c7.tile3" tone="lilac" label="최다 시간대"      value="12~18시"  delta="23.9"/>
        <StatTile id="c7.tile4" tone="cream" label="반경 500m"        value="142,210" unit="명/일"/>
      </div>

      <div style={{display:"grid", gridTemplateColumns:"1.3fr 1fr", gap:16, alignItems:"stretch"}}>
        <div className="bc-box" style={{padding:18, display:"flex", flexDirection:"column"}}>
          <div style={{fontSize:15, fontWeight:600, marginBottom:14}}>시간대별 비중</div>
          <VBars id="c7.hours" accent={2} barW={28} gap={16} height={130} items={[
            {l:"6시", v:4, t:"4%"},
            {l:"9시", v:14, t:"14%"},
            {l:"12시", v:24, t:"24%"},
            {l:"15시", v:19, t:"19%"},
            {l:"18시", v:18, t:"18%"},
            {l:"21시", v:11, t:"11%"},
          ]}/>
          <div style={{marginTop:16, paddingTop:14, borderTop:"1px solid var(--line)"}}>
            <div style={{fontSize:15, fontWeight:600, marginBottom:14}}>요일별 비중</div>
            <VBars id="c7.days" accent={3} barW={28} gap={10} height={84} items={[
              {l:"월", v:13, t:"13"},
              {l:"화", v:14, t:"14"},
              {l:"수", v:16, t:"16"},
              {l:"목", v:17.8, t:"17.8"},
              {l:"금", v:16, t:"16"},
              {l:"토", v:13, t:"13"},
              {l:"일", v:10, t:"10"},
            ]}/>
          </div>
        </div>

        <div style={{display:"flex", flexDirection:"column", gap:12}}>
          <div className="bc-box" style={{padding:18}}>
            <div style={{fontSize:15, fontWeight:600, marginBottom:12}}>주중 vs 주말</div>
            <div style={{display:"flex", alignItems:"center", gap:16, justifyContent:"center"}}>
              <Donut id="c7.donut" size={180} segments={[
                {value:77, color:"#4C7BE4", label:"주중"},
                {value:23, color:"#FFFFFF", label:"주말"},
              ]} centerLabel="77%" centerSub="주중 비중"/>
              <DonutLegend segments={[
                {value:77, color:"#4C7BE4", label:"주중", text:"77%"},
                {value:23, color:"#FFFFFF", label:"주말", text:"23%"},
              ]}/>
            </div>
          </div>
          <div className="bc-box" style={{padding:14}}>
            <div style={{fontSize:15, color:"var(--fg-3)", fontWeight:600, marginBottom:8}}>상위 유동인구 지역 (강남구)</div>
            {[["역삼1동","61.2만/일"],["삼성1동","53.1만/일"],["신사동","48.9만/일"]].map(([n,v],i)=>(
              <div key={i} style={{display:"flex", justifyContent:"space-between", padding:"5px 0", fontSize:15}}>
                <span><span style={{color:"var(--fg-4)", marginRight:6}}>{i+1}위</span>{n}</span>
                <span style={{fontVariantNumeric:"tabular-nums", color:"var(--fg-2)"}}>{v}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </CardShell>
  );
}

Object.assign(window, { Card01, Card02, Card03, Card04, Card05: Card06, Card06: Card05, Card07 });
