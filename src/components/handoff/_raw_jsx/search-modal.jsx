/* search-modal.jsx — "다시 검색하기" 버튼이 띄우는 검색 UI
   다크 톤(#0d1014), 주소/지하철역 검색 + 반경 + 최근 검색 + 분석 시작 */

(function() {
  const { useState, useEffect, useMemo, useRef } = React;

  /* 더미 추천 데이터셋 — 검색어 매칭 */
  const POI_DATASET = [
    { name: "강남역 1번 출구",   meta: "서울 강남구 · 지하철 출구",  cafes: 350, kind: "subway" },
    { name: "강남역 2번 출구",   meta: "서울 강남구 · 지하철 출구",  cafes: 318, kind: "subway" },
    { name: "강남역 11번 출구",  meta: "서울 강남구 · 지하철 출구",  cafes: 412, kind: "subway" },
    { name: "역삼역 4번 출구",   meta: "서울 강남구 · 지하철 출구",  cafes: 264, kind: "subway" },
    { name: "선릉역 5번 출구",   meta: "서울 강남구 · 지하철 출구",  cafes: 198, kind: "subway" },
    { name: "삼성역 6번 출구",   meta: "서울 강남구 · 지하철 출구",  cafes: 224, kind: "subway" },
    { name: "신논현역 6번 출구", meta: "서울 강남구 · 지하철 출구",  cafes: 287, kind: "subway" },
    { name: "양재역 9번 출구",   meta: "서울 서초구 · 지하철 출구",  cafes: 156, kind: "subway" },
    { name: "교대역 8번 출구",   meta: "서울 서초구 · 지하철 출구",  cafes: 174, kind: "subway" },
    { name: "한티역 1번 출구",   meta: "서울 강남구 · 지하철 출구",  cafes: 142, kind: "subway" },
    { name: "강남대로 396",      meta: "서울 강남구 역삼동",         cafes: 305, kind: "addr" },
    { name: "테헤란로 152",      meta: "서울 강남구 역삼동",         cafes: 271, kind: "addr" },
    { name: "성수동 카페거리",   meta: "서울 성동구 성수동",         cafes: 412, kind: "area" },
    { name: "연남동 경의선숲길", meta: "서울 마포구 연남동",         cafes: 386, kind: "area" },
    { name: "이태원역 3번 출구", meta: "서울 용산구 · 지하철 출구",  cafes: 248, kind: "subway" },
  ];

  /* 최근 검색 — localStorage 기반 */
  const RECENT_KEY = "bc.recent.searches";
  function readRecent() {
    try {
      const raw = localStorage.getItem(RECENT_KEY);
      const arr = raw ? JSON.parse(raw) : null;
      if (Array.isArray(arr) && arr.length) return arr.slice(0, 5);
    } catch (e) {}
    // 기본 최근 검색
    return [
      { name: "강남역 1번 출구", radius: 500, ts: "방금" },
      { name: "성수동 카페거리", radius: 300, ts: "어제" },
      { name: "역삼역 4번 출구", radius: 500, ts: "3일 전" },
    ];
  }
  function writeRecent(item) {
    try {
      const cur = readRecent().filter(r => r.name !== item.name);
      cur.unshift({ ...item, ts: "방금" });
      localStorage.setItem(RECENT_KEY, JSON.stringify(cur.slice(0, 5)));
    } catch (e) {}
  }

  /* 아이콘 헬퍼 */
  function KindIcon({ kind }) {
    const map = {
      subway: "ph-train",
      addr:   "ph-map-pin",
      area:   "ph-map-trifold",
    };
    return <i className={`ph ${map[kind] || "ph-map-pin"}`} style={{fontSize:16, color:"var(--matte-fg-3)"}}></i>;
  }

  /* 메인 모달 */
  function SearchModal({ open, onClose }) {
    const [query, setQuery] = useState("");
    const [radius, setRadius] = useState(500);
    const [highlight, setHighlight] = useState(0);
    const [loading, setLoading] = useState(false);
    const [selected, setSelected] = useState(null);
    const inputRef = useRef(null);
    const recent = useMemo(() => readRecent(), [open]);

    /* 검색 매칭 */
    const matches = useMemo(() => {
      const q = query.trim();
      if (!q) return [];
      return POI_DATASET
        .filter(p => p.name.includes(q) || p.meta.includes(q))
        .slice(0, 6);
    }, [query]);

    /* open/close 처리 */
    useEffect(() => {
      if (!open) return;
      setQuery("");
      setHighlight(0);
      setLoading(false);
      setSelected(null);
      setTimeout(() => inputRef.current?.focus(), 80);
      document.body.style.overflow = "hidden";
      const onKey = (e) => {
        if (e.key === "Escape") onClose?.();
      };
      window.addEventListener("keydown", onKey);
      return () => {
        window.removeEventListener("keydown", onKey);
        document.body.style.overflow = "";
      };
    }, [open, onClose]);

    /* 키보드 네비게이션 */
    const onKeyDown = (e) => {
      if (!matches.length) return;
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setHighlight(h => (h + 1) % matches.length);
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        setHighlight(h => (h - 1 + matches.length) % matches.length);
      } else if (e.key === "Enter") {
        e.preventDefault();
        const pick = matches[highlight];
        if (pick) handleSelect(pick);
      }
    };

    const handleSelect = (poi) => {
      setSelected(poi);
      setQuery(poi.name);
    };

    const handleSubmit = () => {
      const target = selected || (matches[highlight] || POI_DATASET.find(p => p.name === query.trim()));
      if (!target) return;
      setLoading(true);
      writeRecent({ name: target.name, radius });
      // 분석 진행 시뮬레이션
      setTimeout(() => {
        setLoading(false);
        onClose?.();
        // 페이지 상단 스크롤로 결과 새로 봤다는 인상
        window.scrollTo({ top: 0, behavior: "smooth" });
      }, 1400);
    };

    const handleRecentClick = (r) => {
      setQuery(r.name);
      const poi = POI_DATASET.find(p => p.name === r.name) || { name: r.name, meta: "", cafes: 0, kind: "addr" };
      setSelected(poi);
      setRadius(r.radius || 500);
    };

    if (!open) return null;

    const canSubmit = !!(selected || matches.length > 0 || POI_DATASET.find(p => p.name === query.trim()));

    return (
      <div
        onClick={onClose}
        style={{
          position:"fixed", inset:0,
          background:"rgba(7,9,12,0.82)",
          backdropFilter:"blur(12px)",
          WebkitBackdropFilter:"blur(12px)",
          display:"grid", placeItems:"center",
          zIndex:130,
          animation:"bc-fade-in 200ms ease both",
        }}
        role="dialog"
        aria-modal="true"
        aria-label="새 위치 검색"
      >
        <div
          onClick={e => e.stopPropagation()}
          style={{
            position:"relative",
            width:"min(720px, 92vw)",
            maxHeight:"86vh",
            background:"#0d1014",
            border:"1px solid rgba(255,255,255,0.10)",
            borderRadius:16,
            boxShadow:"0 24px 80px rgba(0,0,0,0.7)",
            display:"flex",
            flexDirection:"column",
            overflow:"hidden",
          }}
        >
          {/* 헤더 */}
          <div style={{
            display:"flex",
            alignItems:"center",
            justifyContent:"space-between",
            padding:"20px 24px 14px",
            borderBottom:"1px solid rgba(255,255,255,0.06)",
          }}>
            <div>
              <div style={{fontSize:18, color:"#FFFFFF", fontWeight:700, letterSpacing:"-0.01em"}}>새 위치로 검색</div>
              <div style={{fontSize:13, color:"#A3A3A3", marginTop:4}}>지하철 출구, 주소, 상권명으로 찾기</div>
            </div>
            <button
              onClick={onClose}
              aria-label="닫기"
              style={{
                width:36, height:36,
                background:"rgba(255,255,255,0.04)",
                border:"1px solid rgba(255,255,255,0.10)",
                borderRadius:10,
                color:"#FFFFFF",
                cursor:"pointer",
                display:"grid", placeItems:"center",
                transition:"all 160ms",
              }}
              onMouseEnter={e => { e.currentTarget.style.background = "rgba(255,255,255,0.08)"; }}
              onMouseLeave={e => { e.currentTarget.style.background = "rgba(255,255,255,0.04)"; }}
            >
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                <path d="M 2 2 L 12 12 M 12 2 L 2 12" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"/>
              </svg>
            </button>
          </div>

          {/* 검색 인풋 */}
          <div style={{padding:"18px 24px 0"}}>
            <div style={{
              position:"relative",
              display:"flex",
              alignItems:"center",
              background:"rgba(255,255,255,0.04)",
              border: `1px solid ${query ? "rgba(76, 123, 228,0.55)" : "rgba(255,255,255,0.10)"}`,
              borderRadius:12,
              padding:"0 14px",
              transition:"border-color 160ms",
            }}>
              <i className="ph ph-magnifying-glass" style={{fontSize:18, color:"#A3A3A3", marginRight:10}}></i>
              <input
                ref={inputRef}
                type="text"
                value={query}
                onChange={e => { setQuery(e.target.value); setSelected(null); setHighlight(0); }}
                onKeyDown={onKeyDown}
                placeholder="예: 강남역 1번 출구, 성수동 카페거리"
                style={{
                  flex:1,
                  background:"transparent",
                  border:0,
                  outline:0,
                  color:"#FFFFFF",
                  fontSize:16,
                  fontWeight:500,
                  padding:"14px 0",
                  letterSpacing:"-0.005em",
                }}
              />
              {query && (
                <button
                  onClick={() => { setQuery(""); setSelected(null); inputRef.current?.focus(); }}
                  aria-label="입력 지우기"
                  style={{
                    background:"transparent",
                    border:0,
                    color:"#A3A3A3",
                    cursor:"pointer",
                    padding:6,
                    display:"grid", placeItems:"center",
                  }}
                >
                  <svg width="12" height="12" viewBox="0 0 12 12"><path d="M 2 2 L 10 10 M 10 2 L 2 10" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"/></svg>
                </button>
              )}
            </div>
          </div>

          {/* 본문: 결과 or 최근검색 */}
          <div style={{
            flex:1,
            overflowY:"auto",
            padding:"14px 12px 4px",
            minHeight:200,
          }}>
            {/* 검색 결과 */}
            {query && matches.length > 0 && (
              <div>
                <div style={{padding:"6px 14px 8px", fontSize:11, color:"#6a6a6a", fontWeight:600, letterSpacing:"0.06em", textTransform:"uppercase"}}>검색 결과</div>
                {matches.map((m, i) => (
                  <button
                    key={m.name}
                    onClick={() => handleSelect(m)}
                    onMouseEnter={() => setHighlight(i)}
                    style={{
                      display:"flex",
                      alignItems:"center",
                      gap:12,
                      width:"100%",
                      padding:"12px 14px",
                      background: highlight === i ? "rgba(76, 123, 228,0.12)" : "transparent",
                      border:"1px solid",
                      borderColor: highlight === i ? "rgba(76, 123, 228,0.30)" : "transparent",
                      borderRadius:10,
                      cursor:"pointer",
                      textAlign:"left",
                      transition:"all 120ms",
                      color:"#FFFFFF",
                      marginBottom:2,
                    }}
                  >
                    <span style={{
                      width:34, height:34,
                      display:"grid", placeItems:"center",
                      background:"rgba(255,255,255,0.04)",
                      border:"1px solid rgba(255,255,255,0.08)",
                      borderRadius:8,
                      flexShrink:0,
                    }}>
                      <KindIcon kind={m.kind}/>
                    </span>
                    <div style={{flex:1, minWidth:0}}>
                      <div style={{fontSize:14, fontWeight:600, color:"#FFFFFF", letterSpacing:"-0.005em"}}>{m.name}</div>
                      <div style={{fontSize:12, color:"#A3A3A3", marginTop:2}}>{m.meta}</div>
                    </div>
                    <span style={{
                      fontSize:12, color:"#A3A3A3",
                      fontVariantNumeric:"tabular-nums",
                      flexShrink:0,
                    }}>매장 {m.cafes}</span>
                  </button>
                ))}
              </div>
            )}

            {/* 결과 없음 */}
            {query && matches.length === 0 && (
              <div style={{padding:"40px 14px", textAlign:"center"}}>
                <div style={{fontSize:14, color:"#A3A3A3", marginBottom:6}}>일치하는 위치를 찾지 못했습니다</div>
                <div style={{fontSize:12, color:"#6a6a6a"}}>지하철역, 도로명, 상권명으로 다시 시도해 보세요</div>
              </div>
            )}

            {/* 최근 검색 */}
            {!query && (
              <div>
                <div style={{padding:"6px 14px 8px", fontSize:11, color:"#6a6a6a", fontWeight:600, letterSpacing:"0.06em", textTransform:"uppercase"}}>최근 검색</div>
                {recent.map((r) => (
                  <button
                    key={r.name}
                    onClick={() => handleRecentClick(r)}
                    style={{
                      display:"flex",
                      alignItems:"center",
                      gap:12,
                      width:"100%",
                      padding:"12px 14px",
                      background:"transparent",
                      border:"1px solid transparent",
                      borderRadius:10,
                      cursor:"pointer",
                      textAlign:"left",
                      transition:"all 120ms",
                      color:"#FFFFFF",
                      marginBottom:2,
                    }}
                    onMouseEnter={e => { e.currentTarget.style.background = "rgba(255,255,255,0.04)"; }}
                    onMouseLeave={e => { e.currentTarget.style.background = "transparent"; }}
                  >
                    <span style={{
                      width:34, height:34,
                      display:"grid", placeItems:"center",
                      background:"rgba(255,255,255,0.04)",
                      border:"1px solid rgba(255,255,255,0.08)",
                      borderRadius:8,
                      flexShrink:0,
                    }}>
                      <i className="ph ph-clock-counter-clockwise" style={{fontSize:15, color:"#A3A3A3"}}></i>
                    </span>
                    <div style={{flex:1, minWidth:0}}>
                      <div style={{fontSize:14, fontWeight:600, color:"#FFFFFF", letterSpacing:"-0.005em"}}>{r.name}</div>
                      <div style={{fontSize:12, color:"#A3A3A3", marginTop:2}}>반경 {r.radius}m</div>
                    </div>
                    <span style={{fontSize:12, color:"#6a6a6a", flexShrink:0}}>{r.ts}</span>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* 반경 슬라이더 */}
          <div style={{
            padding:"14px 24px",
            borderTop:"1px solid rgba(255,255,255,0.06)",
            background:"rgba(255,255,255,0.015)",
          }}>
            <div style={{display:"flex", justifyContent:"space-between", alignItems:"baseline", marginBottom:8}}>
              <span style={{fontSize:12, color:"#A3A3A3", fontWeight:500, letterSpacing:"0.02em"}}>분석 반경</span>
              <span style={{fontSize:18, color:"#FFFFFF", fontWeight:700, fontVariantNumeric:"tabular-nums", letterSpacing:"-0.01em"}}>
                {radius >= 1000 ? `${(radius/1000).toFixed(1)}km` : `${radius}m`}
              </span>
            </div>
            <input
              type="range"
              min={100}
              max={1000}
              step={50}
              value={radius}
              onChange={e => setRadius(parseInt(e.target.value, 10))}
              className="bc-map-slider"
              style={{width:"100%", display:"block"}}
            />
            <div style={{display:"flex", justifyContent:"space-between", marginTop:4, fontSize:11, color:"#6a6a6a", fontVariantNumeric:"tabular-nums"}}>
              <span>100m</span>
              <span>500m</span>
              <span>1km</span>
            </div>
          </div>

          {/* 푸터: 분석 시작 */}
          <div style={{
            padding:"16px 24px 20px",
            borderTop:"1px solid rgba(255,255,255,0.06)",
            display:"flex",
            alignItems:"center",
            justifyContent:"space-between",
            gap:14,
          }}>
            <div style={{fontSize:12, color:"#6a6a6a", letterSpacing:"-0.005em"}}>
              <kbd style={{
                background:"rgba(255,255,255,0.06)",
                border:"1px solid rgba(255,255,255,0.10)",
                borderRadius:4,
                padding:"2px 6px",
                fontSize:11,
                fontFamily:"inherit",
                marginRight:6,
              }}>Enter</kbd>
              로 빠른 분석
            </div>
            <button
              onClick={handleSubmit}
              disabled={!canSubmit || loading}
              style={{
                display:"flex", alignItems:"center", gap:8,
                background: canSubmit ? "#FFFFFF" : "rgba(255,255,255,0.08)",
                border:0,
                borderRadius:10,
                padding:"11px 22px",
                color: canSubmit ? "#0d1014" : "#6a6a6a",
                fontSize:14,
                fontWeight:700,
                cursor: canSubmit && !loading ? "pointer" : "not-allowed",
                letterSpacing:"-0.005em",
                transition:"all 160ms",
                opacity: loading ? 0.8 : 1,
              }}
            >
              {loading ? (
                <>
                  <span style={{
                    width:14, height:14,
                    border:"2px solid rgba(13,16,20,0.3)",
                    borderTopColor:"#0d1014",
                    borderRadius:"50%",
                    animation:"bc-spin 700ms linear infinite",
                    display:"inline-block",
                  }}></span>
                  분석 중
                </>
              ) : (
                <>
                  분석 시작
                  <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                    <path d="M 3 7 L 11 7 M 7 3 L 11 7 L 7 11" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    );
  }

  /* 글로벌 호스트 — bc:research 이벤트를 듣고 모달을 띄움 */
  function SearchModalHost() {
    const [open, setOpen] = useState(false);
    useEffect(() => {
      const onEvt = () => setOpen(true);
      window.addEventListener("bc:research", onEvt);
      return () => window.removeEventListener("bc:research", onEvt);
    }, []);
    return <SearchModal open={open} onClose={() => setOpen(false)}/>;
  }

  Object.assign(window, { SearchModal, SearchModalHost });
})();
