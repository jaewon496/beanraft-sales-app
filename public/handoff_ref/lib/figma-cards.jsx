/* figma-cards.jsx — Liquid Glass (iOS 26) 미니멀 카드
   원본 figma 의 3-row 구조를 그대로 따라감:
   - Row 1 (hero): 둥근 알약, 라이트 그라데이션 bg + 흰색 글로우
   - Row 2,3: bg 없음, 부드러운 drop shadow 만 (글래스 통과해서 비침)
   각 row 는 [아이콘] [라벨]    [숫자] 의 단순 구성.
*/

function FigmaRow({ icon, label, value, unit, hero }) {
  return (
    <div className={`fg-row ${hero ? "fg-row--hero" : ""}`}>
      <div className="fg-row__head">
        <span className="fg-row__icon">
          <GlassIcon name={icon} size={hero ? 38 : 32} stroke={2}/>
        </span>
        <span className="fg-row__label">{label}</span>
      </div>
      <div className="fg-row__value">
        <span className="num">{value}</span>
        {unit && <span className="unit">{unit}</span>}
      </div>
    </div>
  );
}

function FigmaCard({ rows }) {
  return (
    <article className="fg-card">
      <div className="fg-card__shell">
        {rows.map((r, i) => (
          <FigmaRow key={i} hero={i === 0} {...r}/>
        ))}
      </div>
    </article>
  );
}

window.FigmaCard = FigmaCard;
window.FigmaRow = FigmaRow;
