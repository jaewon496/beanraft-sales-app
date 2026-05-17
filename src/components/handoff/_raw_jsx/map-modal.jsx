/* map-modal.jsx — Card 01 "지도로 보기" 모달
   다크 톤(#0d1014), placeholder 지도(SVG), 마커/핀/범례/반경 슬라이더 */

(function() {
  const { useState, useEffect, useMemo, useRef } = React;

  /* ──────────────────────────────────────────────
     마커 데이터 — 결정론적 배치 (시드 기반)
     ────────────────────────────────────────────── */
  // 단순 시드 PRNG (mulberry32 변형)
  function makeRng(seed) {
    let s = seed >>> 0;
    return () => {
      s = (s + 0x6D2B79F5) >>> 0;
      let t = s;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  // 카페 마커 생성: 반경 안에 골고루 분산
  function buildMarkers() {
    const list = [];
    const types = [
      { kind: "프랜차이즈", color: "#3B82F6", count: 12, seed: 11 },
      { kind: "개인 카페",  color: "#10B981", count: 14, seed: 22 },
      { kind: "베이커리",   color: "#F59E0B", count: 4,  seed: 33 },
    ];
    types.forEach(t => {
      const rng = makeRng(t.seed);
      for (let i = 0; i < t.count; i++) {
        // 균등 분포: sqrt(u) * R 로 면적 균등화
        const u = rng();
        const a = rng() * Math.PI * 2;
        // 중심 너무 가까이는 피함 (60m 이상)
        const dist = 60 + Math.sqrt(u) * 420; // 60~480m
        list.push({
          kind: t.kind,
          color: t.color,
          distance: Math.round(dist),
          angle: a,
        });
      }
    });
    return list;
  }

  /* ──────────────────────────────────────────────
     배경 지도 SVG — 도로/공원 실루엣
     ────────────────────────────────────────────── */
  function MapBackground() {
    // 1000x1000 좌표계, 중심 (500,500)
    return (
      <svg viewBox="0 0 1000 1000" preserveAspectRatio="xMidYMid slice" style={{position:"absolute", inset:0, width:"100%", height:"100%"}}>
        <defs>
          <radialGradient id="map-vignette" cx="50%" cy="50%" r="62%">
            <stop offset="0%" stopColor="#11161c" stopOpacity="0"/>
            <stop offset="100%" stopColor="#0a0d11" stopOpacity="0.85"/>
          </radialGradient>
          <pattern id="map-grid" width="40" height="40" patternUnits="userSpaceOnUse">
            <path d="M 40 0 L 0 0 0 40" fill="none" stroke="rgba(255,255,255,0.025)" strokeWidth="1"/>
          </pattern>
        </defs>

        {/* 베이스 */}
        <rect width="1000" height="1000" fill="#0d1014"/>
        <rect width="1000" height="1000" fill="url(#map-grid)"/>

        {/* 공원 실루엣 — 부드러운 다각형 두 개 */}
        <path d="M 70 720 Q 130 660 220 680 Q 290 700 280 780 Q 250 870 160 860 Q 80 840 70 720 Z"
              fill="#0f1a17" stroke="rgba(16,185,129,0.10)" strokeWidth="1"/>
        <path d="M 760 140 Q 850 110 910 170 Q 940 240 880 290 Q 800 310 750 250 Q 720 190 760 140 Z"
              fill="#0f1a17" stroke="rgba(16,185,129,0.10)" strokeWidth="1"/>

        {/* 주요 도로 — 사선 대로 + 가로/세로 격자 */}
        <g stroke="#1a2028" strokeWidth="22" fill="none" strokeLinecap="round">
          {/* 대각선 대로 */}
          <line x1="-40" y1="380" x2="1040" y2="540"/>
          <line x1="120" y1="-40" x2="640" y2="1040"/>
        </g>
        <g stroke="#161b22" strokeWidth="12" fill="none">
          <line x1="0" y1="180" x2="1000" y2="180"/>
          <line x1="0" y1="780" x2="1000" y2="780"/>
          <line x1="180" y1="0" x2="180" y2="1000"/>
          <line x1="820" y1="0" x2="820" y2="1000"/>
        </g>
        {/* 도로 중심선 */}
        <g stroke="#252b34" strokeWidth="1" fill="none" strokeDasharray="6 6">
          <line x1="-40" y1="380" x2="1040" y2="540"/>
          <line x1="120" y1="-40" x2="640" y2="1040"/>
          <line x1="0" y1="180" x2="1000" y2="180"/>
          <line x1="0" y1="780" x2="1000" y2="780"/>
          <line x1="180" y1="0" x2="180" y2="1000"/>
          <line x1="820" y1="0" x2="820" y2="1000"/>
        </g>

        {/* 보조 골목 */}
        <g stroke="#141821" strokeWidth="5" fill="none">
          <line x1="0" y1="320" x2="1000" y2="360"/>
          <line x1="0" y1="600" x2="1000" y2="640"/>
          <line x1="380" y1="0" x2="400" y2="1000"/>
          <line x1="620" y1="0" x2="640" y2="1000"/>
        </g>

        {/* 동심원 격자 — 100m 단위 */}
        <g fill="none" stroke="rgba(255,255,255,0.04)" strokeWidth="1">
          <circle cx="500" cy="500" r="80"/>
          <circle cx="500" cy="500" r="160"/>
          <circle cx="500" cy="500" r="240"/>
          <circle cx="500" cy="500" r="320"/>
          <circle cx="500" cy="500" r="400"/>
        </g>

        {/* 비네팅 */}
        <rect width="1000" height="1000" fill="url(#map-vignette)"/>
      </svg>
    );
  }

  /* ──────────────────────────────────────────────
     반경 슬라이더 패널
     ────────────────────────────────────────────── */
  function RadiusPanel({ radius, setRadius }) {
    return (
      <div style={{
        position:"absolute", top:20, right:80,
        background:"rgba(13,16,20,0.82)",
        backdropFilter:"blur(14px)",
        WebkitBackdropFilter:"blur(14px)",
        border:"1px solid rgba(255,255,255,0.08)",
        borderRadius:12,
        padding:"14px 18px",
        minWidth:240,
        zIndex:3,
      }}>
        <div style={{display:"flex", justifyContent:"space-between", alignItems:"baseline", marginBottom:10}}>
          <span style={{fontSize:12, color:"#A3A3A3", fontWeight:500, letterSpacing:"0.02em"}}>반경</span>
          <span style={{fontSize:22, color:"#FFFFFF", fontWeight:700, fontVariantNumeric:"tabular-nums", letterSpacing:"-0.01em"}}>
            {radius}<span style={{fontSize:14, color:"#A3A3A3", marginLeft:2, fontWeight:500}}>m</span>
          </span>
        </div>
        <input
          type="range"
          min={100}
          max={500}
          step={50}
          value={radius}
          onChange={e => setRadius(parseInt(e.target.value, 10))}
          className="bc-map-slider"
          style={{width:"100%", display:"block"}}
        />
        <div style={{display:"flex", justifyContent:"space-between", marginTop:6, fontSize:11, color:"#6a6a6a", fontVariantNumeric:"tabular-nums"}}>
          <span>100m</span>
          <span>500m</span>
        </div>
      </div>
    );
  }

  /* ──────────────────────────────────────────────
     좌측 상단 범례
     ────────────────────────────────────────────── */
  function Legend({ counts }) {
    const rows = [
      { color:"#3B82F6", label:"프랜차이즈", count: counts.프랜차이즈 },
      { color:"#10B981", label:"개인 카페",  count: counts["개인 카페"] },
      { color:"#F59E0B", label:"베이커리",   count: counts.베이커리 },
    ];
    return (
      <div style={{
        position:"absolute", top:20, left:20,
        background:"rgba(13,16,20,0.82)",
        backdropFilter:"blur(14px)",
        WebkitBackdropFilter:"blur(14px)",
        border:"1px solid rgba(255,255,255,0.08)",
        borderRadius:12,
        padding:"14px 18px",
        minWidth:220,
        zIndex:3,
      }}>
        <div style={{fontSize:12, color:"#A3A3A3", fontWeight:500, letterSpacing:"0.02em", marginBottom:10}}>범례</div>
        <div style={{display:"flex", flexDirection:"column", gap:8}}>
          {rows.map(r => (
            <div key={r.label} style={{display:"flex", alignItems:"center", justifyContent:"space-between", gap:14}}>
              <div style={{display:"flex", alignItems:"center", gap:10}}>
                <span style={{width:10, height:10, borderRadius:"50%", background:r.color, boxShadow:`0 0 0 2px rgba(13,16,20,0.6), 0 0 8px ${r.color}55`}}></span>
                <span style={{fontSize:13, color:"#FFFFFF", fontWeight:500}}>{r.label}</span>
              </div>
              <span style={{fontSize:13, color:"#FFFFFF", fontWeight:700, fontVariantNumeric:"tabular-nums"}}>{r.count}</span>
            </div>
          ))}
        </div>
        <div style={{height:1, background:"rgba(255,255,255,0.08)", margin:"12px 0"}}></div>
        <div style={{display:"flex", alignItems:"center", gap:10}}>
          <svg width="14" height="16" viewBox="0 0 14 16">
            <path d="M 3 1 L 3 15" stroke="#FFFFFF" strokeWidth="1.4" strokeLinecap="round"/>
            <path d="M 3 1 L 12 3 L 8 5.5 L 12 8 L 3 8 Z" fill="#FFFFFF"/>
          </svg>
          <span style={{fontSize:13, color:"#FFFFFF", fontWeight:500}}>검색 위치</span>
        </div>
      </div>
    );
  }

  /* ──────────────────────────────────────────────
     중앙 깃발 핀
     ────────────────────────────────────────────── */
  function CenterPin() {
    return (
      <div style={{
        position:"absolute", left:"50%", top:"50%",
        transform:"translate(-50%, -100%)",
        display:"flex", flexDirection:"column", alignItems:"flex-start",
        pointerEvents:"none",
        zIndex:2,
      }}>
        {/* 깃발 + 라벨 */}
        <div style={{
          display:"flex", alignItems:"center", gap:8,
          background:"rgba(13,16,20,0.92)",
          border:"1px solid rgba(255,255,255,0.18)",
          borderRadius:8,
          padding:"6px 12px",
          marginBottom:6,
          marginLeft:14,
          boxShadow:"0 6px 20px rgba(0,0,0,0.5)",
        }}>
          <span style={{width:6, height:6, borderRadius:"50%", background:"#FFFFFF"}}></span>
          <span style={{fontSize:13, color:"#FFFFFF", fontWeight:600, letterSpacing:"-0.005em", whiteSpace:"nowrap"}}>강남역 1번 출구</span>
        </div>
        {/* 깃대 + 깃발 */}
        <svg width="32" height="44" viewBox="0 0 32 44" style={{marginLeft:6, display:"block", filter:"drop-shadow(0 4px 8px rgba(0,0,0,0.6))"}}>
          <line x1="6" y1="2" x2="6" y2="44" stroke="#FFFFFF" strokeWidth="2.2" strokeLinecap="round"/>
          <path d="M 6 2 L 28 5 L 22 10 L 28 15 L 6 15 Z" fill="#FFFFFF"/>
          <circle cx="6" cy="44" r="3.2" fill="#FFFFFF"/>
        </svg>
      </div>
    );
  }

  /* ──────────────────────────────────────────────
     카페 마커 — 반경 안에 픽셀로 환산하여 절대배치
     ────────────────────────────────────────────── */
  function CafeMarkers({ markers, radius, mapPx }) {
    // 지도 영역: 500m = mapPx.r 픽셀
    const pxPerM = mapPx.r / 500;
    return (
      <>
        {markers.map((m, i) => {
          if (m.distance > radius) return null;
          const dx = Math.cos(m.angle) * m.distance * pxPerM;
          const dy = Math.sin(m.angle) * m.distance * pxPerM;
          return (
            <div key={i} style={{
              position:"absolute",
              left:"50%", top:"50%",
              transform:`translate(calc(-50% + ${dx}px), calc(-50% + ${dy}px))`,
              width:14, height:14,
              borderRadius:"50%",
              background:m.color,
              border:"2px solid rgba(13,16,20,0.9)",
              boxShadow:`0 2px 8px rgba(0,0,0,0.6), 0 0 0 1px ${m.color}33`,
              pointerEvents:"none",
              zIndex:1,
            }}></div>
          );
        })}
      </>
    );
  }

  /* ──────────────────────────────────────────────
     반경 원 (시각화)
     ────────────────────────────────────────────── */
  function RadiusCircle({ radius, mapPx }) {
    const px = (radius / 500) * mapPx.r * 2;
    return (
      <div style={{
        position:"absolute",
        left:"50%", top:"50%",
        transform:"translate(-50%, -50%)",
        width:px, height:px,
        borderRadius:"50%",
        background:"rgba(255,255,255,0.05)",
        border:"1px solid rgba(255,255,255,0.22)",
        pointerEvents:"none",
        transition:"width 240ms cubic-bezier(.4,0,.2,1), height 240ms cubic-bezier(.4,0,.2,1)",
        zIndex:1,
      }}>
        <span style={{
          position:"absolute",
          left:"50%", top:0,
          transform:"translate(-50%, -50%)",
          background:"#0d1014",
          border:"1px solid rgba(255,255,255,0.18)",
          padding:"2px 10px",
          borderRadius:999,
          fontSize:11,
          color:"#C9C9C9",
          fontWeight:600,
          letterSpacing:"0.02em",
          whiteSpace:"nowrap",
          fontVariantNumeric:"tabular-nums",
        }}>{radius}m</span>
      </div>
    );
  }

  /* ──────────────────────────────────────────────
     하단 출처 + 안내
     ────────────────────────────────────────────── */
  function FooterBar() {
    const chips = ["카카오 로컬", "네이버 플레이스", "자체 수집기"];
    return (
      <div style={{
        position:"absolute", left:20, right:20, bottom:18,
        display:"flex", justifyContent:"space-between", alignItems:"center", gap:18,
        zIndex:3,
      }}>
        <div style={{display:"flex", gap:8, flexWrap:"wrap"}}>
          {chips.map(c => (
            <span key={c} style={{
              background:"rgba(13,16,20,0.82)",
              backdropFilter:"blur(10px)",
              WebkitBackdropFilter:"blur(10px)",
              border:"1px solid rgba(255,255,255,0.10)",
              borderRadius:999,
              padding:"5px 12px",
              fontSize:12,
              color:"#C9C9C9",
              fontWeight:500,
              letterSpacing:"-0.005em",
            }}>{c}</span>
          ))}
        </div>
        <div style={{
          background:"rgba(13,16,20,0.82)",
          backdropFilter:"blur(10px)",
          WebkitBackdropFilter:"blur(10px)",
          border:"1px solid rgba(255,255,255,0.08)",
          borderRadius:10,
          padding:"6px 14px",
          fontSize:12,
          color:"#A3A3A3",
          letterSpacing:"-0.005em",
        }}>
          신규 오픈 및 폐업 매장은 등록 절차에 따라 반영이 지연될 수 있습니다.
        </div>
      </div>
    );
  }

  /* ──────────────────────────────────────────────
     메인 모달
     ────────────────────────────────────────────── */
  function MapModal({ open, onClose }) {
    const [radius, setRadius] = useState(500);
    const markers = useMemo(() => buildMarkers(), []);
    const mapRef = useRef(null);
    // mapPx.r = 지도 영역에서 500m에 해당하는 픽셀 반경 (높이/너비의 절반보다 약간 작게)
    const [mapPx, setMapPx] = useState({ r: 360 });

    useEffect(() => {
      if (!open) return;
      const onKey = (e) => { if (e.key === "Escape") onClose?.(); };
      window.addEventListener("keydown", onKey);
      document.body.style.overflow = "hidden";
      return () => {
        window.removeEventListener("keydown", onKey);
        document.body.style.overflow = "";
      };
    }, [open, onClose]);

    useEffect(() => {
      if (!open || !mapRef.current) return;
      const update = () => {
        if (!mapRef.current) return;
        const w = mapRef.current.clientWidth;
        const h = mapRef.current.clientHeight;
        // 500m 원의 직경이 짧은 변의 80% 정도 차지
        const r = Math.min(w, h) * 0.42;
        setMapPx({ r });
      };
      update();
      const ro = new ResizeObserver(update);
      ro.observe(mapRef.current);
      return () => ro.disconnect();
    }, [open]);

    const counts = useMemo(() => {
      const c = { "프랜차이즈":0, "개인 카페":0, "베이커리":0 };
      markers.forEach(m => { if (m.distance <= radius) c[m.kind] = (c[m.kind]||0) + 1; });
      return c;
    }, [markers, radius]);

    if (!open) return null;

    return (
      <div
        onClick={onClose}
        style={{
          position:"fixed", inset:0,
          background:"rgba(7,9,12,0.78)",
          backdropFilter:"blur(10px)",
          WebkitBackdropFilter:"blur(10px)",
          display:"grid", placeItems:"center",
          zIndex:120,
          animation:"bc-fade-in 200ms ease both",
        }}
        role="dialog"
        aria-modal="true"
        aria-label="주변 카페 지도"
      >
        <div
          onClick={e => e.stopPropagation()}
          ref={mapRef}
          style={{
            position:"relative",
            width:"90vw", height:"90vh",
            background:"#0d1014",
            border:"1px solid rgba(255,255,255,0.08)",
            borderRadius:16,
            overflow:"hidden",
            boxShadow:"0 24px 80px rgba(0,0,0,0.7)",
          }}
        >
          {/* 배경 지도 */}
          <MapBackground/>

          {/* 반경 원 */}
          <RadiusCircle radius={radius} mapPx={mapPx}/>

          {/* 카페 마커 */}
          <CafeMarkers markers={markers} radius={radius} mapPx={mapPx}/>

          {/* 중앙 핀 */}
          <CenterPin/>

          {/* 좌측 상단 범례 */}
          <Legend counts={counts}/>

          {/* 우측 상단 반경 슬라이더 */}
          <RadiusPanel radius={radius} setRadius={setRadius}/>

          {/* 닫기 버튼 */}
          <button
            onClick={onClose}
            aria-label="닫기"
            style={{
              position:"absolute", top:20, right:20,
              width:44, height:44,
              background:"rgba(13,16,20,0.82)",
              backdropFilter:"blur(14px)",
              WebkitBackdropFilter:"blur(14px)",
              border:"1px solid rgba(255,255,255,0.10)",
              borderRadius:12,
              color:"#FFFFFF",
              cursor:"pointer",
              display:"grid", placeItems:"center",
              zIndex:4,
              transition:"all 160ms",
            }}
            onMouseEnter={e => { e.currentTarget.style.background = "rgba(30,36,44,0.92)"; }}
            onMouseLeave={e => { e.currentTarget.style.background = "rgba(13,16,20,0.82)"; }}
          >
            <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
              <path d="M 3 3 L 15 15 M 15 3 L 3 15" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/>
            </svg>
          </button>

          {/* 하단 출처 + 안내 */}
          <FooterBar/>
        </div>
      </div>
    );
  }

  /* ──────────────────────────────────────────────
     트리거 버튼 — Card01 헤더 우측에 배치
     ────────────────────────────────────────────── */
  function MapTriggerButton() {
    const [open, setOpen] = useState(false);
    return (
      <>
        <button
          type="button"
          onClick={() => setOpen(true)}
          style={{
            display:"inline-flex", alignItems:"center", gap:8,
            background:"rgba(255,255,255,0.04)",
            border:"1px solid var(--matte-line)",
            borderRadius:10,
            padding:"8px 14px",
            color:"var(--matte-fg)",
            fontSize:13,
            fontWeight:600,
            cursor:"pointer",
            letterSpacing:"-0.005em",
            transition:"all 160ms",
          }}
          onMouseEnter={e => { e.currentTarget.style.background = "rgba(255,255,255,0.08)"; e.currentTarget.style.borderColor = "var(--matte-line-2)"; }}
          onMouseLeave={e => { e.currentTarget.style.background = "rgba(255,255,255,0.04)"; e.currentTarget.style.borderColor = "var(--matte-line)"; }}
        >
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none" style={{flexShrink:0}}>
            <path d="M 7 1.5 C 4.5 1.5 2.5 3.4 2.5 5.8 C 2.5 8.8 7 12.5 7 12.5 C 7 12.5 11.5 8.8 11.5 5.8 C 11.5 3.4 9.5 1.5 7 1.5 Z" stroke="currentColor" strokeWidth="1.3" fill="none"/>
            <circle cx="7" cy="5.8" r="1.6" stroke="currentColor" strokeWidth="1.3" fill="none"/>
          </svg>
          지도로 보기
        </button>
        <MapModal open={open} onClose={() => setOpen(false)}/>
      </>
    );
  }

  Object.assign(window, { MapModal, MapTriggerButton });
})();
