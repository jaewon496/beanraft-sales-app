/* director.jsx — AI 디렉터 라이브 대시보드 모달
   ─────────────────────────────────────────────────────────────
   - 3탭 (시장 / 경쟁 / 생존) — 각 탭은 라이브 대시보드 스테이지
   - 디렉터 캐릭터 + 음성 파형 + 자막
   - 컨트롤 바: 이전 / 재생 / 다음 / 종료 + 자막 토글 + 0.75x/1x/1.5x
   - 단축키: ← → Space Esc
   - 라인이 진행될 때마다 SeqCtx의 trigger 카운터가 증가 →
     각 KPI/Chart/Gauge가 자기 id의 카운터 변화를 감지해 애니메이션
*/

function DirectorAvatar({ playing, size = 96 }) {
  const inner = size * 0.58;
  return (
    <div style={{
      position:"relative",
      width: size, height: size, borderRadius:"50%",
      background:"radial-gradient(circle at 30% 30%, #2a3b5c 0%, #14182a 80%)",
      border:"2px solid rgba(125,187,255,0.45)",
      display:"grid", placeItems:"center",
      boxShadow: playing ? "0 0 0 6px rgba(125,187,255,0.14), 0 0 0 12px rgba(125,187,255,0.06)" : "none",
      transition:"box-shadow 0.4s var(--ease)",
      flexShrink:0,
    }}>
      <svg width={inner} height={inner} viewBox="0 0 64 64" fill="none">
        <circle cx="32" cy="24" r="11" fill="rgba(125,187,255,0.85)"/>
        <path d="M12 56c0-11 9-18 20-18s20 7 20 18" fill="rgba(125,187,255,0.55)"/>
        <circle cx="28" cy="22" r="1.4" fill="#0d1014"/>
        <circle cx="36" cy="22" r="1.4" fill="#0d1014"/>
        <path d="M28 27c1.4 1.5 2.8 1.5 4 0" stroke="#0d1014" strokeWidth="1.2" strokeLinecap="round" fill="none"/>
      </svg>
      {playing && (
        <div style={{position:"absolute", bottom:-2, right:-2, width: size*0.22, height: size*0.22, borderRadius:"50%", background:"var(--st-good)", display:"grid", placeItems:"center", border:"3px solid #14182a"}}>
          <i className="ph-fill ph-play" style={{fontSize: size*0.09, color:"#fff"}}></i>
        </div>
      )}
    </div>
  );
}

function WaveBars({ active, count = 40 }) {
  // sin 기반 정적 패턴 — 활성 시 살짝 더 큰 진폭
  return (
    <div style={{display:"flex", alignItems:"center", gap:3, height:28}}>
      {Array.from({length: count}).map((_, i) => {
        const baseH = active
          ? (5 + Math.abs(Math.sin(i * 0.55 + Math.cos(i*0.3)) * 18))
          : (4 + (i % 5) * 1.5);
        return (
          <div key={i} style={{
            width: 3, height: `${baseH}px`,
            background: active ? "var(--snow-blue-light)" : "rgba(255,255,255,0.18)",
            borderRadius: 2,
            transition: "height 0.3s var(--ease), background 0.2s var(--ease)",
          }}></div>
        );
      })}
    </div>
  );
}

const TABS = [
  { id: "market", label: "시장",     icon: "ph-storefront" },
  { id: "comp",   label: "경쟁",     icon: "ph-target" },
  { id: "surv",   label: "생존 / 방향", icon: "ph-shield-check" },
];

function DirectorModal({ open, onClose, initial = "market" }) {
  const nar = window.useNarration ? window.useNarration() : null;
  const [manualTab, setManualTab] = React.useState(initial);

  // 활성 탭 = 나레이션이 명시한 탭 (수동 클릭 시에도 따라감)
  const activeTab = nar?.cur?.tab || manualTab;

  React.useEffect(() => { if (open) nar?.restart(); }, [open]);
  React.useEffect(() => {
    if (!open) return;
    const onKey = (e) => {
      if (e.key === "Escape") onClose?.();
      else if (e.key === "ArrowRight") nar?.next();
      else if (e.key === "ArrowLeft")  nar?.prev();
      else if (e.key === " ") { e.preventDefault(); nar?.toggle(); }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, nar?.step]);

  if (!open || !nar) return null;

  const ctxValue = { seq: nar.seq, tab: activeTab, speed: nar.speed };
  const SeqCtx = window.SeqCtx;
  const MarketStage = window.MarketStage;
  const CompStage = window.CompStage;
  const SurvStage = window.SurvStage;

  const progress = ((nar.step + 1) / nar.total) * 100;

  // 점프 시 탭도 따라가게
  const onTabClick = (id) => {
    // 해당 탭의 첫 라인으로 이동
    const idx = window.NARRATION.findIndex(l => l.tab === id);
    if (idx >= 0) nar.goto(idx);
    setManualTab(id);
  };

  return (
    <SeqCtx.Provider value={ctxValue}>
      <div className="bc-modal-backdrop dr-backdrop" onClick={onClose}>
        <div className="dr-modal" onClick={e => e.stopPropagation()}>

          {/* ── Top bar ── */}
          <header className="dr-top">
            <div className="dr-top__brand">
              <span className="dr-pulse-dot"></span>
              <span className="dr-top__title">AI 디렉터 · 라이브 대시보드</span>
              <span className="dr-top__addr">강남역 1번 출구 · 반경 500m</span>
            </div>
            <div className="dr-top__tabs">
              {TABS.map(t => (
                <button
                  key={t.id}
                  className={"dr-tab " + (activeTab === t.id ? "on" : "")}
                  onClick={() => onTabClick(t.id)}
                >
                  <i className={"ph " + t.icon}></i>
                  <span>{t.label}</span>
                </button>
              ))}
            </div>
            <button className="dr-top__close" onClick={onClose} title="닫기 (Esc)">
              <i className="ph ph-x"></i>
            </button>
          </header>

          {/* ── Stage ── */}
          <main className="dr-body">
            <div key={activeTab} className={"dr-tab-wrap " + activeTab}>
              {activeTab === "market" && <MarketStage/>}
              {activeTab === "comp"   && <CompStage/>}
              {activeTab === "surv"   && <SurvStage/>}
            </div>
          </main>

          {/* ── Subtitle row (typing) ── */}
          {nar.subtitleOn && (
            <div className="dr-subtitle">
              <DirectorAvatar playing={nar.playing} size={56}/>
              <div className="dr-subtitle__text">
                <span className="dr-subtitle__beat">{nar.cur.beat || "·"}</span>
                <window.TypingText text={nar.cur.text} speedMs={32 / nar.speed} on={nar.playing}/>
              </div>
            </div>
          )}

          {/* ── Control bar ── */}
          <footer className="dr-controls">
            <div className="dr-controls__progress">
              <div className="dr-controls__progress-bar" style={{width: `${progress}%`}}></div>
              <div className="dr-controls__progress-ticks">
                {window.NARRATION.map((l, i) => (
                  <button
                    key={i}
                    className={"tick " + (i === nar.step ? "on " : i < nar.step ? "done " : "") + l.tab}
                    style={{left: `${(i / (nar.total - 1)) * 100}%`}}
                    onClick={() => nar.goto(i)}
                    title={`${i+1}. ${l.text.slice(0, 28)}…`}
                  ></button>
                ))}
              </div>
            </div>

            <div className="dr-controls__row">
              <div className="dr-controls__left">
                <WaveBars active={nar.playing}/>
                <span className="dr-controls__step">{nar.step + 1} / {nar.total}</span>
              </div>

              <div className="dr-controls__center">
                <button onClick={nar.prev} disabled={nar.step === 0} title="이전 (←)">
                  <i className="ph ph-skip-back"></i>
                </button>
                <button onClick={nar.toggle} className="primary" title={nar.playing ? "일시정지 (Space)" : "재생 (Space)"}>
                  <i className={nar.playing ? "ph-fill ph-pause" : "ph-fill ph-play"}></i>
                </button>
                <button onClick={nar.next} disabled={nar.step >= nar.total - 1} title="다음 (→)">
                  <i className="ph ph-skip-forward"></i>
                </button>
                <button onClick={nar.restart} title="처음부터">
                  <i className="ph ph-arrow-counter-clockwise"></i>
                </button>
              </div>

              <div className="dr-controls__right">
                <div className="dr-speed">
                  {[0.75, 1, 1.5].map(s => (
                    <button
                      key={s}
                      className={nar.speed === s ? "on" : ""}
                      onClick={() => nar.setSpeed(s)}
                    >{s}x</button>
                  ))}
                </div>
                <button
                  className={"dr-toggle " + (nar.subtitleOn ? "on" : "")}
                  onClick={() => nar.setSubtitleOn(v => !v)}
                  title="자막"
                >
                  <i className="ph ph-closed-captioning"></i>
                </button>
              </div>
            </div>
          </footer>
        </div>
      </div>
    </SeqCtx.Provider>
  );
}

Object.assign(window, { DirectorModal, DirectorAvatar, WaveBars });
