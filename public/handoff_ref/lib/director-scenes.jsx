/* director-scenes.jsx — AI 디렉터 PPT 슬라이드 렌더러
   ─────────────────────────────────────────────────────────────
   디렉터가 말하는 한 마디 == 화면에 뜨는 한 장의 깔끔한 PPT 슬라이드.
   리포트 원본 카드(Card01..14)는 그대로 두고, 디렉터 모달의 우측 무대만
   이 SceneView 로 교체한다.

   각 씬: { id, card, template, data, narration, clientQLen, audioBase64 }
     template ∈ percentRing / ratioSplitBar / trendArea / compareValue /
                rankingList / kpiQuad / radar5 / statement
     data    = 그 템플릿이 그릴 숫자/비율/시계열 (부모에서 실데이터로 결정)

   설계 원칙(사용자 최우선): 정확한 비율, 오버플로우 0, 프리미엄 룩.
   - 큰 초점 숫자/시각요소 1개.
   - 긴 한글 금액(예: "1억 153만원")은 keep-all + clamp 로 줄바꿈 대신 축소.
   - 링/레이더는 고정 크기 SVG → 절대 안 깨짐. 텍스트만 wrap.
   - 캡처 안전: dashoffset 애니메이션은 짧은 진입(0.9s)만, area 차트는 정적 fill.
*/

const DS_ACCENT = "#4C7BE4";

/* 숫자 안전 변환 */
function _dsNum(v) {
  const n = Number(v);
  return (typeof n === "number" && isFinite(n)) ? n : 0;
}
function _dsClampPct(v) {
  let n = _dsNum(v);
  if (n < 0) n = 0;
  if (n > 100) n = 100;
  return n;
}

/* ── percentRing — 하나의 퍼센트를 주인공으로 (점유율/비중/생존율/긍정률) ── */
function DSPercentRing({ data }) {
  const value = _dsClampPct(data && data.value);
  const label = (data && data.label) || "";
  const sub = (data && data.sub) || "";
  const accent = (data && data.accent) || DS_ACCENT;
  const r = 42;                       // viewBox 100x100, stroke 9 → r 42 여유
  const circ = 2 * Math.PI * r;
  const offset = circ * (1 - value / 100);
  return (
    <div className="ds-scene ds-ring">
      {label ? <div className="ds-ring__label">{label}</div> : null}
      <div className="ds-ring__wrap">
        <svg viewBox="0 0 100 100" className="ds-ring__svg" aria-hidden="true">
          <circle cx="50" cy="50" r={r} className="ds-ring__track" />
          <circle
            cx="50" cy="50" r={r}
            className="ds-ring__prog"
            style={{
              stroke: accent,
              strokeDasharray: circ.toFixed(2),
              strokeDashoffset: offset.toFixed(2),
            }}
          />
        </svg>
        <div className="ds-ring__center">
          <span className="ds-ring__num">{Math.round(value)}<span className="ds-ring__pct">%</span></span>
        </div>
      </div>
      {sub ? <div className="ds-ring__sub">{sub}</div> : null}
    </div>
  );
}

/* ── ratioSplitBar — 둘로 나뉜 한 덩어리 (남:여 / 프랜:개인 / 주중:주말 / 긍정:부정) ── */
function DSRatioSplitBar({ data }) {
  const a = (data && data.a) || { label: "", value: 0 };
  const b = (data && data.b) || { label: "", value: 0 };
  const unit = (data && data.unit) || "";
  const note = (data && data.note) || "";
  const av = Math.max(0, _dsNum(a.value));
  const bv = Math.max(0, _dsNum(b.value));
  const sum = av + bv || 1;
  let aw = (av / sum) * 100;
  let bw = (bv / sum) * 100;
  // 한쪽이 '있지만 아주 작을' 때만 최소 6% 로 보이게 (비례 유지·깨짐 방지).
  // 진짜 0 이면 색 조각을 그리지 않는다 — "0%" 숫자 아래 색 띠가 보이는 모순 방지.
  if (av > 0 && aw < 6) { aw = 6; bw = 100 - aw; }
  if (bv > 0 && bw < 6) { bw = 6; aw = 100 - bw; }
  const fmt = (v) => Math.round(v) + (unit ? unit : "");
  return (
    <div className="ds-scene ds-split">
      <div className="ds-split__row">
        <div className="ds-split__col">
          <span className="ds-split__lbl">{a.label}</span>
          <span className="ds-split__val ds-split__val--a">{fmt(av)}</span>
        </div>
        <div className="ds-split__col ds-split__col--right">
          <span className="ds-split__lbl">{b.label}</span>
          <span className="ds-split__val ds-split__val--b">{fmt(bv)}</span>
        </div>
      </div>
      <div className="ds-split__bar">
        <div className="ds-split__seg ds-split__seg--a" style={{ width: aw.toFixed(2) + "%" }} />
        <div className="ds-split__seg ds-split__seg--b" style={{ width: bw.toFixed(2) + "%" }} />
      </div>
      {note ? <div className="ds-split__note">{note}</div> : null}
    </div>
  );
}

/* 시계열 → SVG 면(area) + 선(polyline). 정적(캡처 안전). */
function _dsAreaPaths(values, w, h, pad) {
  const vals = (Array.isArray(values) ? values : []).map(_dsNum);
  if (vals.length < 2) return null;
  const min = Math.min.apply(null, vals);
  const max = Math.max.apply(null, vals);
  const span = (max - min) || 1;
  const innerW = w - pad * 2;
  const innerH = h - pad * 2;
  const pts = vals.map((v, i) => {
    const x = pad + (innerW * i) / (vals.length - 1);
    const y = pad + innerH * (1 - (v - min) / span);
    return [x, y];
  });
  const line = pts.map((p) => p[0].toFixed(1) + "," + p[1].toFixed(1)).join(" ");
  const area = "M" + pad.toFixed(1) + "," + (h - pad).toFixed(1) + " L" +
    pts.map((p) => p[0].toFixed(1) + "," + p[1].toFixed(1)).join(" L") +
    " L" + (w - pad).toFixed(1) + "," + (h - pad).toFixed(1) + " Z";
  const last = pts[pts.length - 1];
  return { line, area, last };
}

/* ── trendArea — 시계열 + 헤드라인 숫자 (매출/점포수/배달/공실률 추이) ── */
function DSTrendArea({ data }) {
  const value = (data && data.value) || "";
  const label = (data && data.label) || "";
  const deltaText = (data && data.deltaText) || "";
  const positive = (data && data.deltaPositive !== false);
  const values = (data && data.values) || [];
  const W = 600, H = 150, PAD = 10;
  const paths = _dsAreaPaths(values, W, H, PAD);
  const gid = "ds-grad-" + ((data && data.id) || Math.round(value.length * 7 + values.length));
  return (
    <div className="ds-scene ds-trend">
      <div className="ds-trend__head">
        {label ? <div className="ds-trend__label">{label}</div> : null}
        <div className="ds-trend__value">{value}</div>
        {deltaText ? (
          <span className={"ds-pill " + (positive ? "ds-pill--up" : "ds-pill--down")}>{deltaText}</span>
        ) : null}
      </div>
      {paths ? (
        <svg viewBox={"0 0 " + W + " " + H} className="ds-trend__svg" preserveAspectRatio="none" aria-hidden="true">
          <defs>
            <linearGradient id={gid} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={DS_ACCENT} stopOpacity="0.28" />
              <stop offset="100%" stopColor={DS_ACCENT} stopOpacity="0" />
            </linearGradient>
          </defs>
          <path d={paths.area} fill={"url(#" + gid + ")"} />
          <polyline points={paths.line} fill="none" stroke={DS_ACCENT} strokeWidth="2"
            strokeLinejoin="round" strokeLinecap="round" vectorEffect="non-scaling-stroke" />
          <circle cx={paths.last[0]} cy={paths.last[1]} r="4" fill={DS_ACCENT} />
        </svg>
      ) : null}
    </div>
  );
}

/* ── compareValue — 벤치마크 대비 한 값 (월매출 vs 구평균 / 평당월세 vs 전국 등) ── */
function DSCompareValue({ data }) {
  const value = (data && data.value) || "";
  const label = (data && data.label) || "";
  const deltaText = (data && data.deltaText) || "";
  const positive = (data && data.deltaPositive !== false);
  const base = (data && data.base) || { label: "", value: 0 };
  const mine = (data && data.mine) || { value: 0 };
  const mineV = Math.max(0, _dsNum(mine.value));
  const baseV = Math.max(0, _dsNum(base.value));
  const max = Math.max(mineV, baseV) || 1;
  const mineW = (mineV / max) * 100;
  const baseW = (baseV / max) * 100;
  const mineCap = (data && data.mineCaption) || "";
  const baseCap = (data && data.baseCaption) || "";
  return (
    <div className="ds-scene ds-cmp">
      <div className="ds-cmp__head">
        {label ? <div className="ds-cmp__label">{label}</div> : null}
        <div className="ds-cmp__value">{value}</div>
        {deltaText ? (
          <span className={"ds-pill " + (positive ? "ds-pill--up" : "ds-pill--down")}>{deltaText}</span>
        ) : null}
      </div>
      <div className="ds-cmp__bars">
        <div className="ds-cmp__row">
          <span className="ds-cmp__name">내 자리</span>
          <span className="ds-cmp__track"><i className="ds-cmp__fill ds-cmp__fill--mine" style={{ width: mineW.toFixed(1) + "%" }} /></span>
          {mineCap ? <span className="ds-cmp__cap">{mineCap}</span> : null}
        </div>
        <div className="ds-cmp__row">
          <span className="ds-cmp__name">{base.label || "평균"}</span>
          <span className="ds-cmp__track"><i className="ds-cmp__fill ds-cmp__fill--base" style={{ width: baseW.toFixed(1) + "%" }} /></span>
          {baseCap ? <span className="ds-cmp__cap">{baseCap}</span> : null}
        </div>
      </div>
    </div>
  );
}

/* ── rankingList — Top-N 목록 (브랜드/동네매출/후기매장/유입경로/키워드) ── */
function DSRankingList({ data }) {
  const label = (data && data.label) || "";
  let items = (data && Array.isArray(data.items)) ? data.items.slice(0, 5) : [];
  const maxVal = items.reduce((m, it) => Math.max(m, _dsNum(it.value)), 0) || 1;
  const hasBars = items.some((it) => _dsNum(it.value) > 0);
  return (
    <div className="ds-scene ds-rank">
      {label ? <div className="ds-rank__label">{label}</div> : null}
      <div className="ds-rank__list">
        {items.map((it, i) => {
          const v = _dsNum(it.value);
          const w = hasBars ? (v / maxVal) * 100 : 0;
          return (
            <div className="ds-rank__row" key={i}>
              <span className="ds-rank__chip">{i + 1}</span>
              <div className="ds-rank__main">
                <div className="ds-rank__line">
                  <span className="ds-rank__name">{it.name}</span>
                  {it.valueText ? <span className="ds-rank__val">{it.valueText}</span> : null}
                </div>
                {hasBars ? (
                  <div className="ds-rank__bar"><i style={{ width: w.toFixed(1) + "%" }} /></div>
                ) : null}
                {it.sub ? <div className="ds-rank__sub">{it.sub}</div> : null}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ── kpiQuad — 2~4개 통계 한눈에 (매장/카페/프랜/개인 등) ── */
function DSKpiQuad({ data }) {
  const label = (data && data.label) || "";
  let stats = (data && Array.isArray(data.stats)) ? data.stats.slice(0, 4) : [];
  const cols = stats.length >= 4 ? 2 : (stats.length === 3 ? 3 : (stats.length === 2 ? 2 : 1));
  return (
    <div className="ds-scene ds-kpi">
      {label ? <div className="ds-kpi__label">{label}</div> : null}
      <div className={"ds-kpi__grid ds-kpi__grid--" + cols}>
        {stats.map((s, i) => (
          <div className="ds-kpi__tile" key={i}>
            <span className="ds-kpi__name">{s.name}</span>
            <span className="ds-kpi__val">{s.value}{s.unit ? <span className="ds-kpi__unit">{s.unit}</span> : null}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ── radar5 — 5축 경쟁력 (경쟁/AI 종합 전용) ── */
function DSRadar5({ data }) {
  const label = (data && data.label) || "";
  let axes = (data && Array.isArray(data.axes)) ? data.axes.slice(0, 5) : [];
  const totalText = (data && data.totalText) || "";
  const size = 320;
  const cx = size / 2, cy = size / 2;
  const R = size * 0.36;
  const m = size * 0.14;
  const N = Math.max(axes.length, 3);
  // 각 꼭짓점 좌표
  const ptAt = (i, rad) => {
    const ang = (-90 + (360 / N) * i) * Math.PI / 180;
    return [cx + rad * Math.cos(ang), cy + rad * Math.sin(ang)];
  };
  const rings = [0.34, 0.67, 1].map((f) =>
    axes.map((_, i) => ptAt(i, R * f).map((n) => n.toFixed(1)).join(",")).join(" ")
  );
  const dataPts = axes.map((a, i) => {
    const max = _dsNum(a.max) || 1;
    const sc = Math.max(0, Math.min(1, _dsNum(a.score) / max));
    return ptAt(i, R * sc);
  });
  const dataPoly = dataPts.map((p) => p[0].toFixed(1) + "," + p[1].toFixed(1)).join(" ");
  return (
    <div className="ds-scene ds-radar">
      {label ? <div className="ds-radar__label">{label}</div> : null}
      <svg viewBox={(-m).toFixed(0) + " " + (-m).toFixed(0) + " " + (size + 2 * m).toFixed(0) + " " + (size + 2 * m).toFixed(0)}
        className="ds-radar__svg" aria-hidden="true">
        {rings.map((pts, i) => (
          <polygon key={i} points={pts} className="ds-radar__ring" />
        ))}
        {axes.map((_, i) => {
          const p = ptAt(i, R);
          return <line key={i} x1={cx} y1={cy} x2={p[0].toFixed(1)} y2={p[1].toFixed(1)} className="ds-radar__spoke" />;
        })}
        <polygon points={dataPoly} className="ds-radar__data" style={{ fill: "rgba(76,123,228,0.22)", stroke: DS_ACCENT }} />
        {dataPts.map((p, i) => (
          <circle key={i} cx={p[0].toFixed(1)} cy={p[1].toFixed(1)} r="3" fill={DS_ACCENT} />
        ))}
        {axes.map((a, i) => {
          const p = ptAt(i, R * 1.18);
          const px = p[0], py = p[1];
          let anchor = "middle";
          if (px < cx - 4) anchor = "end";
          else if (px > cx + 4) anchor = "start";
          return (
            <text key={i} x={px.toFixed(1)} y={py.toFixed(1)} textAnchor={anchor} className="ds-radar__axislbl">
              <tspan x={px.toFixed(1)} dy="0">{a.name}</tspan>
              <tspan x={px.toFixed(1)} dy="14">{Math.round(_dsNum(a.score))}/{Math.round(_dsNum(a.max))}</tspan>
            </text>
          );
        })}
      </svg>
      {totalText ? <div className="ds-radar__total">{totalText}</div> : null}
    </div>
  );
}

/* ── statement — 단일 차트 숫자가 없는 결론/추천 (종합 의견, 추천 등급) ── */
function DSStatement({ data }) {
  const label = (data && data.label) || "";
  const verdict = (data && data.verdict) || "";
  const scoreText = (data && data.scoreText) || "";
  const chips = (data && Array.isArray(data.chips)) ? data.chips.filter(Boolean) : [];
  return (
    <div className="ds-scene ds-stmt">
      {label ? <div className="ds-stmt__label">{label}</div> : null}
      {verdict ? <div className="ds-stmt__verdict">{verdict}</div> : null}
      {scoreText ? <div className="ds-stmt__score">{scoreText}</div> : null}
      {chips.length ? (
        <div className="ds-stmt__chips">
          {chips.map((c, i) => <span className="ds-stmt__chip" key={i}>{c}</span>)}
        </div>
      ) : null}
    </div>
  );
}

/* 템플릿 → 컴포넌트 */
const DS_TEMPLATES = {
  percentRing: DSPercentRing,
  ratioSplitBar: DSRatioSplitBar,
  trendArea: DSTrendArea,
  compareValue: DSCompareValue,
  rankingList: DSRankingList,
  kpiQuad: DSKpiQuad,
  radar5: DSRadar5,
  statement: DSStatement,
};

/* SceneView — 한 씬을 받아 해당 템플릿으로 렌더 */
function SceneView({ scene }) {
  if (!scene) return null;
  const Tmpl = DS_TEMPLATES[scene.template] || DSStatement;
  const data = scene.data || {};
  return (
    <div className="ds-stage" key={scene.id || (scene.card + "-" + scene.template)}>
      <Tmpl data={data} />
    </div>
  );
}

Object.assign(window, { SceneView, DS_TEMPLATES });
