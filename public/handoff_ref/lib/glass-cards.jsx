/* glass-cards.jsx — reimagined report cards in liquid-glass aesthetic */

const { useState, useMemo } = React;

/* ============================================================
   Card shell
   bloom: CSS gradient string for the per-card backdrop bloom
   ============================================================ */
function GlassCard({ n, title, sub, bloom, headerRight, footer, children }) {
  return (
    <article className="gl-card" id={`gl-card-${n}`}>
      <div className="gl-card__bloom" style={{ background: bloom }}/>
      <section className="gl-panel">
        <div className="gl-card__body">
          <header className="gl-card__head">
            <div>
              <span className="gl-card__badge">{`No. ${n}`}</span>
              <h2 className="gl-card__title">{title}</h2>
              {sub && <p className="gl-card__sub">{sub}</p>}
            </div>
            {headerRight && <div>{headerRight}</div>}
          </header>
          {children}
        </div>
        {footer && (
          <div className="gl-card__footer">
            {footer.map((s, i) => <span key={i}>{s}</span>)}
          </div>
        )}
      </section>
    </article>
  );
}

/* ============================================================
   Card A — 상권 분석 (commercial district)
   violet/pink bloom · hero KPI + donut + bars
   ============================================================ */
function GlassCardCommerce() {
  const [seg, setSeg] = useState("composition");
  return (
    <GlassCard
      n="01"
      title="상권 분석"
      sub="강남역 1번 출구 · 반경 500m"
      bloom="radial-gradient(60% 50% at 20% 30%, rgba(255,255,255,0.18), transparent), radial-gradient(50% 50% at 85% 70%, rgba(255,255,255,0.10), transparent)"
      headerRight={
        <div style={{display:"flex", flexDirection:"column", gap:10, alignItems:"flex-end"}}>
          <button className="gl-pill">
            <GlassIcon name="pin" size={16} stroke={2}/> 지도에서 보기
          </button>
          <div className="gl-segment">
            <button className={`gl-segment__btn ${seg==="composition" && "is-on"}`} onClick={()=>setSeg("composition")}>매장 구성</button>
            <button className={`gl-segment__btn ${seg==="rent" && "is-on"}`} onClick={()=>setSeg("rent")}>임대</button>
            <button className={`gl-segment__btn ${seg==="churn" && "is-on"}`} onClick={()=>setSeg("churn")}>유동</button>
          </div>
        </div>
      }
      footer={["출처 · 소상공인진흥공단", "나이스비즈맵", "한국부동산원 (KOSIS 408)", "2025 Q4"]}
    >
      {/* Hero row */}
      <div style={{display:"grid", gridTemplateColumns:"1.2fr 1fr", gap:24, alignItems:"stretch"}}>
        {/* Left: hero number + 4 sub KPIs */}
        <div className="gl-tile" style={{padding:"32px 36px", display:"flex", flexDirection:"column", gap:20}}>
          <div className="gl-spread">
            <div className="gl-stat__label">반경 내 매장</div>
            <span className="gl-delta gl-delta--up">▲ 6.7% YoY</span>
          </div>
          <div className="gl-stat__value" style={{fontSize:96, fontWeight:700, letterSpacing:"-0.04em"}}>
            350<span className="unit" style={{fontSize:24}}>개</span>
          </div>
          <div className="gl-grid-4" style={{gap:10}}>
            {[
              ["카페", "126", "개", "var(--gl-violet)"],
              ["프랜차이즈", "47", "개", "var(--gl-pink)"],
              ["신규(1y)", "5", "개", "var(--gl-mint)"],
              ["폐업(1y)", "8", "개", "var(--gl-rose)"],
            ].map(([l, v, u, c]) => (
              <div key={l} style={{padding:"12px 14px", borderRadius:14, background:"rgba(255,255,255,0.45)", boxShadow:"0 0 0 1px rgba(255,255,255,0.65) inset"}}>
                <div style={{fontSize:11, color:"var(--gl-fg-3)", fontWeight:500, marginBottom:6}}>{l}</div>
                <div style={{display:"flex", alignItems:"baseline", gap:4}}>
                  <span style={{fontSize:24, fontWeight:700, letterSpacing:"-0.02em", color:c, fontVariantNumeric:"tabular-nums"}}>{v}</span>
                  <span style={{fontSize:11, color:"var(--gl-fg-3)"}}>{u}</span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Right: donut breakdown */}
        <div className="gl-tile" style={{padding:"28px 30px", display:"flex", flexDirection:"column", gap:14}}>
          <div className="gl-spread">
            <div style={{font:"600 16px/1 var(--gl-font)", color:"var(--gl-fg)"}}>카페 126개 구성</div>
            <span style={{font:"500 12px/1 var(--gl-font)", color:"var(--gl-fg-4)"}}>2025.10</span>
          </div>
          <div style={{display:"flex", alignItems:"center", justifyContent:"center", gap:14, flex:1}}>
            <GlassDonut size={180} thickness={26}
              centerLabel="126" centerSub="카페"
              segments={[
                {value:71, color:"var(--gl-violet)"},
                {value:47, color:"var(--gl-pink)"},
                {value:8,  color:"var(--gl-amber)"},
              ]}/>
            <div style={{display:"flex", flexDirection:"column", gap:10, minWidth:120}}>
              {[
                ["개인 카페", "71", "56%", "var(--gl-violet)"],
                ["프랜차이즈", "47", "37%", "var(--gl-pink)"],
                ["베이커리", "8", "7%", "var(--gl-amber)"],
              ].map(([l, v, p, c]) => (
                <div key={l} style={{display:"flex", alignItems:"center", gap:8}}>
                  <span style={{width:8, height:8, borderRadius:"50%", background:c}}/>
                  <span style={{fontSize:13, color:"var(--gl-fg-2)", flex:1}}>{l}</span>
                  <span style={{fontSize:13, fontWeight:600, color:"var(--gl-fg)", fontVariantNumeric:"tabular-nums"}}>{p}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Bottom: 3 trend cells */}
      <div className="gl-grid-3" style={{marginTop:18}}>
        {[
          { l:"평당 월세", v:"42", u:"만원", d:"+8.0%", color:"var(--gl-violet)", data:[34,35,35,36,37,38,38,39,40,41,42,42] },
          { l:"공실률",   v:"4.2", u:"%",  d:"−2.2%", color:"var(--gl-amber)",  data:[6.4,6.0,5.5,5.2,5.0,4.8,4.7,4.5,4.4,4.3,4.2,4.2] },
          { l:"평균 유동", v:"38.4", u:"k", d:"+12%", color:"var(--gl-pink)", data:[28,30,29,32,33,32,34,36,35,37,38,38.4] },
        ].map((t, i) => (
          <div key={i} className="gl-tile" style={{padding:"22px 24px"}}>
            <div className="gl-spread" style={{marginBottom:10}}>
              <span style={{font:"500 13px/1 var(--gl-font)", color:"var(--gl-fg-3)"}}>{t.l}</span>
              <span style={{font:"600 12px/1 var(--gl-font)", color:t.color, fontVariantNumeric:"tabular-nums"}}>{t.d}</span>
            </div>
            <div style={{display:"flex", alignItems:"baseline", gap:4, marginBottom:12}}>
              <span style={{fontSize:30, fontWeight:700, letterSpacing:"-0.02em", color:"var(--gl-fg)", fontVariantNumeric:"tabular-nums"}}>{t.v}</span>
              <span style={{fontSize:13, color:"var(--gl-fg-3)"}}>{t.u}</span>
            </div>
            <GlassSpark data={t.data} color={t.color} height={48}/>
          </div>
        ))}
      </div>
    </GlassCard>
  );
}

/* ============================================================
   Card B — 매출 분석 (sales) — ring gauge hero + bars
   azure bloom
   ============================================================ */
function GlassCardSales() {
  return (
    <GlassCard
      n="11"
      title="매출 분석"
      sub="카테고리 평균 대비 · 최근 12주"
      bloom="radial-gradient(55% 55% at 75% 30%, rgba(255,255,255,0.18), transparent), radial-gradient(50% 50% at 20% 75%, rgba(255,255,255,0.10), transparent)"
      headerRight={
        <button className="gl-pill">
          <GlassIcon name="external" size={16} stroke={2}/> CSV 내보내기
        </button>
      }
      footer={["출처 · 빈크래프트 거래소", "코리아 BC 카드", "2025 W41-W44"]}
    >
      <div style={{display:"grid", gridTemplateColumns:"1fr 1.4fr", gap:24, alignItems:"stretch"}}>
        {/* Ring gauge hero */}
        <div className="gl-tile" style={{padding:"24px 28px", display:"flex", flexDirection:"column", alignItems:"center", gap:6, position:"relative"}}>
          <div className="gl-spread" style={{width:"100%"}}>
            <span style={{font:"500 13px/1 var(--gl-font)", color:"var(--gl-fg-3)"}}>월매출 목표 달성</span>
            <span className="gl-chip"><span className="dot" style={{color:"var(--gl-mint)"}}/>상위 12%</span>
          </div>
          <div style={{display:"grid", placeItems:"center", marginTop:4}}>
            <GlassRing
              size={240}
              thickness={20}
              rings={[
                { value: 87, color: "var(--gl-azure)" },
                { value: 64, color: "var(--gl-mint)" },
                { value: 48, color: "var(--gl-pink)" },
              ]}
              centerLabel="87%"
              centerSub="목표 대비"
            />
          </div>
          <div style={{display:"flex", gap:14, marginTop:4}}>
            {[
              ["매출", "87%", "var(--gl-azure)"],
              ["객수", "64%", "var(--gl-mint)"],
              ["객단가", "48%", "var(--gl-pink)"],
            ].map(([l, v, c]) => (
              <div key={l} style={{display:"flex", flexDirection:"column", alignItems:"center", gap:4}}>
                <span style={{width:10, height:10, borderRadius:"50%", background:c, boxShadow:`0 2px 6px ${c}66`}}/>
                <span style={{font:"500 11px/1 var(--gl-font)", color:"var(--gl-fg-3)"}}>{l}</span>
                <span style={{font:"700 16px/1 var(--gl-font)", color:"var(--gl-fg)", fontVariantNumeric:"tabular-nums", letterSpacing:"-0.01em"}}>{v}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Hour-of-day + bars */}
        <div style={{display:"flex", flexDirection:"column", gap:16}}>
          <div className="gl-tile" style={{padding:"22px 26px"}}>
            <div className="gl-spread" style={{marginBottom:14}}>
              <div>
                <div style={{font:"500 13px/1 var(--gl-font)", color:"var(--gl-fg-3)", marginBottom:6}}>시간대별 매출</div>
                <div style={{display:"flex", alignItems:"baseline", gap:6}}>
                  <span style={{font:"700 28px/0.95 var(--gl-font)", letterSpacing:"-0.02em", fontVariantNumeric:"tabular-nums"}}>4.82</span>
                  <span style={{font:"500 13px/1 var(--gl-font)", color:"var(--gl-fg-3)"}}>백만원 / 일평균</span>
                </div>
              </div>
              <div className="gl-segment">
                <button className="gl-segment__btn is-on">시간</button>
                <button className="gl-segment__btn">요일</button>
              </div>
            </div>
            <GlassVBars
              height={110}
              color="var(--gl-azure)"
              data={[12,8,6,5,8,18,42,68,52,38,46,72,88,78,52,38,42,58,72,66,54,38,24,16]}
            />
            <div className="gl-spread" style={{marginTop:8, font:"500 11px/1 var(--gl-font)", color:"var(--gl-fg-4)"}}>
              <span>00시</span><span>06시</span><span>12시</span><span>18시</span><span>24시</span>
            </div>
          </div>

          <div className="gl-tile" style={{padding:"22px 26px", display:"flex", flexDirection:"column", gap:14}}>
            <div style={{font:"500 13px/1 var(--gl-font)", color:"var(--gl-fg-3)"}}>카테고리 비중</div>
            <GlassBarRow label="아메리카노"   value={42} color="var(--gl-azure)"/>
            <GlassBarRow label="라떼/플랫화이트" value={28} color="var(--gl-mint)"/>
            <GlassBarRow label="콜드브루"     value={14} color="var(--gl-pink)"/>
            <GlassBarRow label="베이커리"     value={11} color="var(--gl-amber)"/>
            <GlassBarRow label="MD / 기타"     value={5}  color="var(--gl-violet)"/>
          </div>
        </div>
      </div>
    </GlassCard>
  );
}

/* ============================================================
   Card C — 입지 / 경쟁 (radar)
   rose/amber bloom
   ============================================================ */
function GlassCardCompetition() {
  return (
    <GlassCard
      n="10"
      title="상권 경쟁 분석"
      sub="5축 적합도 · 동일 카테고리 매장 87개와 비교"
      bloom="radial-gradient(60% 60% at 80% 30%, rgba(255,255,255,0.18), transparent), radial-gradient(55% 55% at 20% 75%, rgba(255,255,255,0.10), transparent)"
      headerRight={
        <div className="gl-pill" style={{background:"rgba(255,255,255,0.92)"}}>
          <GlassIcon name="trophy" size={16} stroke={2} style={{color:"var(--gl-rose)"}}/>
          종합 점수 <strong style={{fontVariantNumeric:"tabular-nums", marginLeft:4}}>82.4</strong>
        </div>
      }
      footer={["출처 · 자체 가중 모델", "공정 거래위", "통계청 SGIS"]}
    >
      <div style={{display:"grid", gridTemplateColumns:"1fr 1fr", gap:24, alignItems:"stretch"}}>
        {/* Radar */}
        <div className="gl-tile" style={{padding:"24px 28px", display:"flex", flexDirection:"column", alignItems:"center", gap:12}}>
          <div className="gl-spread" style={{width:"100%"}}>
            <span style={{font:"600 15px/1 var(--gl-font)"}}>5축 적합도</span>
            <span className="gl-chip"><span className="dot" style={{color:"var(--gl-rose)"}}/>이 매장</span>
          </div>
          <GlassRadar
            size={280}
            color="var(--gl-rose)"
            axes={["유동", "임대료", "경쟁밀도", "타겟적합", "성장세"]}
            values={[78, 62, 45, 88, 90]}
          />
        </div>

        {/* Score breakdown */}
        <div style={{display:"flex", flexDirection:"column", gap:16}}>
          <div className="gl-tile" style={{padding:"22px 26px", display:"flex", flexDirection:"column", gap:14}}>
            <div className="gl-spread">
              <span style={{font:"500 13px/1 var(--gl-font)", color:"var(--gl-fg-3)"}}>축별 점수 (100점)</span>
              <span style={{font:"500 12px/1 var(--gl-font)", color:"var(--gl-fg-4)"}}>가중 평균 82.4</span>
            </div>
            <GlassBarRow label="유동인구"   value={78} suffix=" 점" color="var(--gl-rose)"/>
            <GlassBarRow label="임대료 합리성" value={62} suffix=" 점" color="var(--gl-amber)"/>
            <GlassBarRow label="경쟁 밀도"   value={45} suffix=" 점" color="var(--gl-violet)" note="동일 카테고리 17개"/>
            <GlassBarRow label="타겟 적합도"  value={88} suffix=" 점" color="var(--gl-azure)"/>
            <GlassBarRow label="성장세 / 신규" value={90} suffix=" 점" color="var(--gl-mint)"/>
          </div>

          <div className="gl-tile gl-tile--dark" style={{padding:"22px 26px"}}>
            <div className="gl-spread" style={{marginBottom:14}}>
              <span style={{font:"500 13px/1 var(--gl-font)", color:"rgba(255,255,255,0.62)"}}>
                AI 종합 의견
              </span>
              <span style={{font:"600 12px/1 var(--gl-font)", color:"var(--gl-amber)"}}>매우 양호</span>
            </div>
            <p style={{margin:0, font:"500 15px/1.55 var(--gl-font)", color:"rgba(255,255,255,0.92)", letterSpacing:"-0.005em", textWrap:"pretty"}}>
              경쟁 밀도가 평균 대비 1.8배 높지만, 20-30대 직장인 비율이
              <strong style={{color:"#fff"}}> 71%</strong>로 타겟 적합도가 압도적입니다.
              인근 신축 오피스 입주가 끝나는 <strong style={{color:"#fff"}}>2026 Q2</strong>까지 매출
              <strong style={{color:"var(--gl-mint)"}}> +14% 상방</strong> 여지가 있습니다.
            </p>
            <div className="gl-chip-row" style={{marginTop:14}}>
              <span className="gl-chip" style={{background:"rgba(255,255,255,0.12)", color:"#fff", boxShadow:"0 0 0 1px rgba(255,255,255,0.20) inset"}}>+ 직장인 71%</span>
              <span className="gl-chip" style={{background:"rgba(255,255,255,0.12)", color:"#fff", boxShadow:"0 0 0 1px rgba(255,255,255,0.20) inset"}}>+ 평일 점심 피크</span>
              <span className="gl-chip" style={{background:"rgba(255,255,255,0.12)", color:"#fff", boxShadow:"0 0 0 1px rgba(255,255,255,0.20) inset"}}>− 경쟁 17개</span>
            </div>
          </div>
        </div>
      </div>
    </GlassCard>
  );
}

/* ============================================================
   Card D — 위젯 스트립 (Home-screen widget vibe)
   amber/mint bloom · multi-mini-cards inside one glass
   ============================================================ */
function GlassCardWidgets() {
  return (
    <GlassCard
      n="06"
      title="실시간 위젯"
      sub="현재 조건 · 자동 새로고침 매 15분"
      bloom="radial-gradient(55% 55% at 25% 30%, rgba(255,255,255,0.18), transparent), radial-gradient(55% 55% at 80% 75%, rgba(255,255,255,0.10), transparent)"
      headerRight={
        <div className="gl-pill gl-pill--ghost-dark">
          <GlassIcon name="dot" size={10} style={{color:"var(--gl-mint)"}}/>
          live · 14:32
        </div>
      }
      footer={["출처 · 기상청 API", "SK텔레콤 유동", "네이버 트렌드"]}
    >
      <div className="gl-grid-4">
        {/* Weather widget */}
        <div className="gl-tile gl-tile--dark" style={{padding:"24px 26px", display:"flex", flexDirection:"column", gap:12, minHeight:180, position:"relative", overflow:"hidden"}}>
          <div style={{position:"absolute", top:-30, right:-30, width:160, height:160, borderRadius:"50%", background:"radial-gradient(circle, rgba(76, 123, 228,0.45), transparent 60%)", filter:"blur(8px)"}}/>
          <div className="gl-spread">
            <span style={{font:"500 12px/1 var(--gl-font)", color:"rgba(255,255,255,0.62)"}}>강남구</span>
            <GlassIcon name="sun" size={22} stroke={2} style={{color:"var(--gl-amber)"}}/>
          </div>
          <div style={{font:"700 56px/0.95 var(--gl-font)", letterSpacing:"-0.04em", color:"#fff", marginTop:8}}>
            18°
          </div>
          <div style={{font:"500 13px/1 var(--gl-font)", color:"rgba(255,255,255,0.62)"}}>맑음 · 체감 16°</div>
          <div style={{font:"500 12px/1 var(--gl-font)", color:"var(--gl-mint)", marginTop:4}}>☕ 매출 영향 +6%</div>
        </div>

        {/* 유동인구 */}
        <div className="gl-tile" style={{padding:"24px 26px", display:"flex", flexDirection:"column", gap:10, minHeight:180}}>
          <div className="gl-spread">
            <span style={{font:"500 12px/1 var(--gl-font)", color:"var(--gl-fg-3)"}}>유동인구 · 시간당</span>
            <GlassIcon name="walk" size={20} stroke={2} style={{color:"var(--gl-violet)"}}/>
          </div>
          <div style={{display:"flex", alignItems:"baseline", gap:4, marginTop:4}}>
            <span className="gl-num" style={{fontSize:44, color:"var(--gl-fg)"}}>2.4</span>
            <span style={{fontSize:14, color:"var(--gl-fg-3)"}}>k / hr</span>
          </div>
          <GlassSpark data={[1.2,1.4,1.3,1.6,1.8,2.2,2.6,2.4,2.1,2.3,2.4]} color="var(--gl-violet)" height={56}/>
        </div>

        {/* SNS 언급 */}
        <div className="gl-tile" style={{padding:"24px 26px", display:"flex", flexDirection:"column", gap:10, minHeight:180}}>
          <div className="gl-spread">
            <span style={{font:"500 12px/1 var(--gl-font)", color:"var(--gl-fg-3)"}}>SNS 언급</span>
            <GlassIcon name="hash" size={20} stroke={2} style={{color:"var(--gl-pink)"}}/>
          </div>
          <div style={{display:"flex", alignItems:"baseline", gap:4, marginTop:4}}>
            <span className="gl-num" style={{fontSize:44, color:"var(--gl-fg)"}}>1,284</span>
          </div>
          <span className="gl-delta gl-delta--up" style={{alignSelf:"flex-start"}}>▲ +23% / WoW</span>
          <div className="gl-chip-row" style={{marginTop:"auto"}}>
            <span className="gl-chip">#강남카페</span>
            <span className="gl-chip">#오피스</span>
          </div>
        </div>

        {/* 배달 객단가 */}
        <div className="gl-tile" style={{padding:"24px 26px", display:"flex", flexDirection:"column", gap:10, minHeight:180}}>
          <div className="gl-spread">
            <span style={{font:"500 12px/1 var(--gl-font)", color:"var(--gl-fg-3)"}}>배달 객단가</span>
            <GlassIcon name="moped" size={20} stroke={2} style={{color:"var(--gl-mint)"}}/>
          </div>
          <div style={{display:"flex", alignItems:"baseline", gap:4, marginTop:4}}>
            <span className="gl-num" style={{fontSize:44, color:"var(--gl-fg)"}}>14,800</span>
            <span style={{fontSize:14, color:"var(--gl-fg-3)"}}>원</span>
          </div>
          <span className="gl-delta gl-delta--up" style={{alignSelf:"flex-start"}}>▲ +8.2% / MoM</span>
          <div style={{marginTop:"auto", display:"flex", gap:4, height:24, alignItems:"flex-end"}}>
            {[6,7,6,8,9,8,10,11,12,11,12,13].map((v,i)=>(
              <div key={i} style={{width:"100%", height:`${v*1.6}px`, borderRadius:3, background:"var(--gl-mint)", opacity:0.85}}/>
            ))}
          </div>
        </div>
      </div>
    </GlassCard>
  );
}

Object.assign(window, { GlassCard, GlassCardCommerce, GlassCardSales, GlassCardCompetition, GlassCardWidgets });
