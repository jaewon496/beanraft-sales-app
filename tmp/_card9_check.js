import React, { useState } from "react";
const COLORS = {
  bg: "#1A1F2C",
  border: "#2D3748",
  text: "#E1E2EC",
  textSub: "#C2C6D6",
  textMuted: "#8B92A7",
  divider: "#4A5568",
  accent: "#10B981",
  male: "#3B82F6",
  female: "#EC4899",
  warning: "#F59E0B",
  cardBg: "#1d2027"
};
const formatWon = (n) => {
  const v = Number(n) || 0;
  return v.toLocaleString();
};
const formatKMan = (won) => {
  const v = Number(won) || 0;
  if (v >= 1e4) {
    const man = Math.round(v / 1e4);
    return `${man.toLocaleString()}\uB9CC\uC6D0`;
  }
  return `${v.toLocaleString()}\uC6D0`;
};
const formatPeriod = (raw) => {
  if (!raw) return "";
  let s = String(raw).trim();
  s = s.replace(/\s*기준\s*$/, "").trim();
  let m = s.match(/^(\d{4})[-./]?(\d{1,2})$/);
  if (m) {
    return `${m[1]}\uB144 ${parseInt(m[2], 10)}\uC6D4`;
  }
  m = s.match(/^(\d{4})년\s*(\d{1,2})월$/);
  if (m) {
    return `${m[1]}\uB144 ${parseInt(m[2], 10)}\uC6D4`;
  }
  return s;
};
const SectionTitle = ({ children }) => /* @__PURE__ */ React.createElement("div", { style: {
  fontSize: 12,
  fontWeight: 700,
  color: COLORS.textMuted,
  letterSpacing: "0.05em",
  textTransform: "uppercase",
  marginBottom: 12
} }, children);
const SectionWrap = ({ children }) => /* @__PURE__ */ React.createElement("div", { style: { padding: "20px 24px", borderTop: `1px solid ${COLORS.border}` } }, children);
const Card9DeliveryAvgPrice = ({ card }) => {
  const [showNearby, setShowNearby] = useState(false);
  if (!card) return null;
  const body = card?.bodyData || {};
  const searchDongName = body.searchDongName || "";
  const searchAvgPrice = Number(body.searchAvgPrice) || 0;
  const searchSales = Number(body.searchSales) || 0;
  const searchOrders = Number(body.searchOrders) || 0;
  const nearbyDongs = Array.isArray(body.nearbyDongs) ? body.nearbyDongs : [];
  const weekdaySales = Array.isArray(body.weekdaySales) ? body.weekdaySales : [];
  const monthlyTrend = Array.isArray(body.monthlyTrend) ? body.monthlyTrend : [];
  const genderRatio = body.genderRatio || null;
  const ageGenderSales = Array.isArray(body.ageGenderSales) ? body.ageGenderSales : [];
  const newRepeatRatio = body.newRepeatRatio || null;
  const maleLifestyle = Array.isArray(body.maleLifestyle) ? body.maleLifestyle : [];
  const femaleLifestyle = Array.isArray(body.femaleLifestyle) ? body.femaleLifestyle : [];
  const cafeRankInDelivery = Number(body.cafeRankInDelivery) || 0;
  const totalDeliveryBiz = Number(body.totalDeliveryBiz) || 0;
  const customerYrEarn = body.customerYrEarn || null;
  const deliveryTrend = body.deliveryTrend || null;
  const dateLabel = card?.date || "";
  const hasMain = searchAvgPrice > 0 && searchDongName;
  const weekdayMax = weekdaySales.reduce((m, w) => Math.max(m, w.amount || 0), 0);
  const monthlyMax = monthlyTrend.reduce((m, w) => Math.max(m, w.value || 0), 0);
  const ageMaxVal = ageGenderSales.reduce((m, a) => Math.max(m, a.male || 0, a.female || 0), 0);
  return /* @__PURE__ */ React.createElement("div", { style: {
    background: COLORS.bg,
    border: `1px solid ${COLORS.border}`,
    borderRadius: "1rem",
    overflow: "hidden",
    boxShadow: "0 25px 50px -12px rgba(0,0,0,0.25)",
    color: COLORS.text,
    fontFamily: "'Inter', 'Noto Sans KR', sans-serif",
    width: "100%"
  } }, /* @__PURE__ */ React.createElement("div", { style: { padding: "24px", borderBottom: `1px solid ${COLORS.border}` } }, /* @__PURE__ */ React.createElement("div", { style: { display: "flex", flexWrap: "wrap", alignItems: "center", gap: 8, marginBottom: 8 } }, /* @__PURE__ */ React.createElement("span", { style: {
    background: "rgba(16,185,129,0.2)",
    color: COLORS.accent,
    fontSize: 12,
    fontWeight: 700,
    padding: "2px 8px",
    borderRadius: 4,
    letterSpacing: "0.05em"
  } }, "09 \uBC30\uB2EC \uAC1D\uB2E8\uAC00"), dateLabel && /* @__PURE__ */ React.createElement("span", { style: { fontSize: 13, color: COLORS.textSub } }, dateLabel)), /* @__PURE__ */ React.createElement("h2", { style: {
    fontFamily: "'Manrope', sans-serif",
    fontSize: 24,
    lineHeight: "32px",
    fontWeight: 600,
    color: "#fff",
    margin: 0
  } }, "\uC774 \uB3D9\uB124 \uBC30\uB2EC \uAC1D\uB2E8\uAC00")), !hasMain ? /* @__PURE__ */ React.createElement("div", { style: { padding: "24px" } }, /* @__PURE__ */ React.createElement("p", { style: { fontSize: 14, color: COLORS.textSub, margin: 0 } }, "\uB370\uC774\uD130 \uBD80\uC871")) : /* @__PURE__ */ React.createElement(React.Fragment, null, /* @__PURE__ */ React.createElement("div", { style: {
    padding: "24px",
    background: "rgba(16,185,129,0.06)"
  } }, /* @__PURE__ */ React.createElement("div", { style: {
    fontSize: 13,
    color: COLORS.textSub,
    marginBottom: 6,
    fontWeight: 500
  } }, searchDongName), /* @__PURE__ */ React.createElement("div", { style: {
    fontSize: 36,
    lineHeight: "44px",
    fontWeight: 700,
    color: COLORS.accent,
    marginBottom: 8,
    letterSpacing: "-0.02em"
  } }, formatWon(searchAvgPrice), /* @__PURE__ */ React.createElement("span", { style: { fontSize: 20, color: COLORS.accent, marginLeft: 4 } }, "\uC6D0")), /* @__PURE__ */ React.createElement("div", { style: {
    fontSize: 12,
    color: COLORS.textMuted,
    display: "flex",
    gap: 12,
    flexWrap: "wrap"
  } }, /* @__PURE__ */ React.createElement("span", null, "\uC6D4\uB9E4\uCD9C ", formatKMan(searchSales)), /* @__PURE__ */ React.createElement("span", { style: { color: COLORS.divider } }, "\xB7"), /* @__PURE__ */ React.createElement("span", null, "\uC6D4 ", searchOrders.toLocaleString(), "\uAC74"))), nearbyDongs.length > 0 && /* @__PURE__ */ React.createElement(SectionWrap, null, /* @__PURE__ */ React.createElement(
    "button",
    {
      type: "button",
      onClick: () => setShowNearby((v) => !v),
      style: {
        background: "transparent",
        border: "none",
        width: "100%",
        padding: 0,
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        cursor: "pointer",
        color: COLORS.text,
        fontFamily: "inherit",
        marginBottom: showNearby ? 12 : 0
      }
    },
    /* @__PURE__ */ React.createElement("span", { style: {
      fontSize: 12,
      fontWeight: 700,
      color: COLORS.textMuted,
      letterSpacing: "0.05em",
      textTransform: "uppercase"
    } }, "\uC8FC\uBCC0 \uB3D9\uB124 \uAC1D\uB2E8\uAC00 (", nearbyDongs.length, "\uACF3)"),
    /* @__PURE__ */ React.createElement("span", { style: {
      fontSize: 12,
      color: COLORS.textMuted,
      display: "inline-flex",
      alignItems: "center",
      gap: 4
    } }, /* @__PURE__ */ React.createElement("span", null, showNearby ? "\uD3BC\uCE68" : "\uC811\uD798"), /* @__PURE__ */ React.createElement("span", { style: {
      display: "inline-block",
      transform: showNearby ? "rotate(90deg)" : "rotate(0deg)",
      transition: "transform 0.2s",
      fontSize: 14
    } }, "\u25B6"))
  ), showNearby && /* @__PURE__ */ React.createElement("div", { style: { display: "flex", flexDirection: "column", gap: 6 } }, nearbyDongs.map((d, i) => /* @__PURE__ */ React.createElement("div", { key: i, style: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    padding: "10px 12px",
    background: COLORS.cardBg,
    border: `1px solid ${COLORS.border}`,
    borderRadius: "0.5rem"
  } }, /* @__PURE__ */ React.createElement("span", { style: {
    fontSize: 14,
    color: COLORS.text,
    fontWeight: 500
  } }, d.name), /* @__PURE__ */ React.createElement("span", { style: {
    fontSize: 14,
    color: "#fff",
    fontWeight: 600,
    fontVariantNumeric: "tabular-nums"
  } }, formatWon(d.avgPrice), /* @__PURE__ */ React.createElement("span", { style: { fontSize: 11, color: COLORS.textMuted, marginLeft: 2 } }, "\uC6D0")))))), deliveryTrend && (deliveryTrend.ordersChange != null || deliveryTrend.salesChange != null) && /* @__PURE__ */ React.createElement(SectionWrap, null, /* @__PURE__ */ React.createElement(SectionTitle, null, "\uBC30\uB2EC \uC2DC\uC7A5 \uCD94\uC138 (\uC804\uC6D4 \uB300\uBE44)"), /* @__PURE__ */ React.createElement("div", { style: { display: "flex", gap: 10 } }, deliveryTrend.ordersChange != null && (() => {
    const v = Number(deliveryTrend.ordersChange);
    const isUp = v > 0;
    const isDown = v < 0;
    const color = isUp ? COLORS.accent : isDown ? "#EF4444" : COLORS.textMuted;
    const arrow = isUp ? "\u25B2" : isDown ? "\u25BC" : "\xB7";
    return /* @__PURE__ */ React.createElement("div", { style: {
      flex: 1,
      background: COLORS.cardBg,
      border: `1px solid ${COLORS.border}`,
      borderRadius: "0.75rem",
      padding: "14px 16px",
      textAlign: "center"
    } }, /* @__PURE__ */ React.createElement("div", { style: { fontSize: 12, color: COLORS.textSub, marginBottom: 6 } }, "\uC8FC\uBB38 \uAC74\uC218"), /* @__PURE__ */ React.createElement("div", { style: {
      fontSize: 24,
      fontWeight: 800,
      color,
      letterSpacing: "-0.02em",
      fontVariantNumeric: "tabular-nums"
    } }, /* @__PURE__ */ React.createElement("span", { style: { fontSize: 16, marginRight: 4 } }, arrow), Math.abs(v).toFixed(1), /* @__PURE__ */ React.createElement("span", { style: { fontSize: 16, marginLeft: 2 } }, "%")));
  })(), deliveryTrend.salesChange != null && (() => {
    const v = Number(deliveryTrend.salesChange);
    const isUp = v > 0;
    const isDown = v < 0;
    const color = isUp ? COLORS.accent : isDown ? "#EF4444" : COLORS.textMuted;
    const arrow = isUp ? "\u25B2" : isDown ? "\u25BC" : "\xB7";
    return /* @__PURE__ */ React.createElement("div", { style: {
      flex: 1,
      background: COLORS.cardBg,
      border: `1px solid ${COLORS.border}`,
      borderRadius: "0.75rem",
      padding: "14px 16px",
      textAlign: "center"
    } }, /* @__PURE__ */ React.createElement("div", { style: { fontSize: 12, color: COLORS.textSub, marginBottom: 6 } }, "\uB9E4\uCD9C\uC561"), /* @__PURE__ */ React.createElement("div", { style: {
      fontSize: 24,
      fontWeight: 800,
      color,
      letterSpacing: "-0.02em",
      fontVariantNumeric: "tabular-nums"
    } }, /* @__PURE__ */ React.createElement("span", { style: { fontSize: 16, marginRight: 4 } }, arrow), Math.abs(v).toFixed(1), /* @__PURE__ */ React.createElement("span", { style: { fontSize: 16, marginLeft: 2 } }, "%")));
  })()), deliveryTrend.period && (() => {
    const trendPeriod = formatPeriod(deliveryTrend.period);
    return trendPeriod ? /* @__PURE__ */ React.createElement("div", { style: {
      fontSize: 11,
      color: COLORS.textMuted,
      textAlign: "right",
      marginTop: 8
    } }, trendPeriod, " \uAE30\uC900") : null;
  })()), cafeRankInDelivery > 0 && /* @__PURE__ */ React.createElement(SectionWrap, null, /* @__PURE__ */ React.createElement(SectionTitle, null, "\uBC30\uB2EC \uC2DC\uC7A5\uC5D0\uC11C \uCE74\uD398 \uC704\uCE58"), /* @__PURE__ */ React.createElement("div", { style: {
    background: COLORS.cardBg,
    border: `1px solid ${COLORS.border}`,
    borderRadius: "0.75rem",
    padding: "18px 20px",
    textAlign: "center"
  } }, /* @__PURE__ */ React.createElement("div", { style: {
    fontSize: 13,
    color: COLORS.textSub,
    marginBottom: 6
  } }, "\uC774 \uB3D9\uB124 \uBC30\uB2EC \uB9E4\uCD9C"), /* @__PURE__ */ React.createElement("div", { style: {
    fontSize: 40,
    lineHeight: "48px",
    fontWeight: 800,
    color: COLORS.accent,
    letterSpacing: "-0.02em",
    marginBottom: 8
  } }, cafeRankInDelivery, "\uC704"), totalDeliveryBiz > 0 && /* @__PURE__ */ React.createElement("div", { style: {
    fontSize: 12,
    color: COLORS.textMuted
  } }, "\uC804\uCCB4 ", totalDeliveryBiz, "\uAC1C \uC5C5\uC885 \uC911"))), weekdaySales.length > 0 && /* @__PURE__ */ React.createElement(SectionWrap, null, /* @__PURE__ */ React.createElement(SectionTitle, null, "\uC694\uC77C\uBCC4 \uBC30\uB2EC \uC8FC\uBB38\uAC74\uC218"), /* @__PURE__ */ React.createElement("div", { style: { display: "flex", gap: 6, alignItems: "flex-end" } }, weekdaySales.map((w, i) => {
    const pct = weekdayMax > 0 ? Math.max(15, Math.round(w.amount / weekdayMax * 100)) : 0;
    const isTop = w.isTop;
    return /* @__PURE__ */ React.createElement("div", { key: i, style: { flex: 1, textAlign: "center" } }, /* @__PURE__ */ React.createElement("div", { style: {
      fontSize: 10,
      color: isTop ? COLORS.accent : COLORS.textSub,
      fontWeight: isTop ? 700 : 500,
      fontVariantNumeric: "tabular-nums",
      marginBottom: 4,
      whiteSpace: "nowrap"
    } }, Math.round(w.amount).toLocaleString()), /* @__PURE__ */ React.createElement("div", { style: { height: 80, display: "flex", alignItems: "flex-end", justifyContent: "center" } }, /* @__PURE__ */ React.createElement("div", { style: {
      width: "70%",
      height: `${pct}%`,
      borderRadius: "4px 4px 0 0",
      background: isTop ? COLORS.accent : "rgba(16,185,129,0.3)",
      transition: "height 0.5s"
    } })), /* @__PURE__ */ React.createElement("div", { style: {
      fontSize: 11,
      color: isTop ? COLORS.accent : COLORS.textMuted,
      fontWeight: isTop ? 700 : 500,
      marginTop: 4
    } }, w.day));
  })), /* @__PURE__ */ React.createElement("div", { style: {
    fontSize: 10,
    color: COLORS.textMuted,
    textAlign: "right",
    marginTop: 6
  } }, "\uB2E8\uC704: \uAC74")), monthlyTrend.length > 0 && /* @__PURE__ */ React.createElement(SectionWrap, null, /* @__PURE__ */ React.createElement(SectionTitle, null, "\uC6D4\uBCC4 \uBC30\uB2EC \uC8FC\uBB38\uAC74\uC218 \uCD94\uC774"), /* @__PURE__ */ React.createElement("div", { style: { display: "flex", gap: 4, alignItems: "flex-end" } }, monthlyTrend.map((m, i) => {
    const pct = monthlyMax > 0 ? Math.max(10, Math.round(m.value / monthlyMax * 100)) : 0;
    const isMax = m.value === monthlyMax && monthlyMax > 0;
    return /* @__PURE__ */ React.createElement("div", { key: i, style: { flex: 1, textAlign: "center" } }, /* @__PURE__ */ React.createElement("div", { style: {
      fontSize: 9,
      color: isMax ? COLORS.accent : COLORS.textSub,
      fontWeight: isMax ? 700 : 500,
      fontVariantNumeric: "tabular-nums",
      marginBottom: 3,
      whiteSpace: "nowrap",
      overflow: "hidden",
      textOverflow: "ellipsis"
    } }, Math.round(m.value).toLocaleString()), /* @__PURE__ */ React.createElement("div", { style: { height: 64, display: "flex", alignItems: "flex-end", justifyContent: "center" } }, /* @__PURE__ */ React.createElement("div", { style: {
      width: "70%",
      height: `${pct}%`,
      borderRadius: "3px 3px 0 0",
      background: isMax ? COLORS.accent : "rgba(16,185,129,0.4)",
      transition: "height 0.5s"
    } })), /* @__PURE__ */ React.createElement("div", { style: {
      fontSize: 9,
      color: isMax ? COLORS.accent : COLORS.textMuted,
      fontWeight: isMax ? 700 : 400,
      marginTop: 4,
      whiteSpace: "nowrap",
      overflow: "hidden",
      textOverflow: "ellipsis"
    } }, m.label));
  })), /* @__PURE__ */ React.createElement("div", { style: {
    fontSize: 10,
    color: COLORS.textMuted,
    textAlign: "right",
    marginTop: 6
  } }, "\uB2E8\uC704: \uAC74")), (genderRatio || newRepeatRatio || customerYrEarn) && /* @__PURE__ */ React.createElement(SectionWrap, null, /* @__PURE__ */ React.createElement(SectionTitle, null, "\uBC30\uB2EC \uC190\uB2D8 \uD2B9\uC131"), genderRatio && (genderRatio.male > 0 || genderRatio.female > 0) && /* @__PURE__ */ React.createElement("div", { style: { marginBottom: 14 } }, /* @__PURE__ */ React.createElement("div", { style: {
    fontSize: 12,
    color: COLORS.textSub,
    marginBottom: 8
  } }, "\uC131\uBCC4 \uBE44\uC911"), /* @__PURE__ */ React.createElement("div", { style: { display: "flex", gap: 12 } }, /* @__PURE__ */ React.createElement("div", { style: { flex: 1 } }, /* @__PURE__ */ React.createElement("div", { style: { display: "flex", justifyContent: "space-between", marginBottom: 4 } }, /* @__PURE__ */ React.createElement("span", { style: { fontSize: 12, color: COLORS.textSub } }, "\uB0A8\uC131"), /* @__PURE__ */ React.createElement("span", { style: { fontSize: 12, fontWeight: 700, color: COLORS.male } }, genderRatio.male, "%")), /* @__PURE__ */ React.createElement("div", { style: { height: 6, borderRadius: 3, background: "rgba(59,130,246,0.15)" } }, /* @__PURE__ */ React.createElement("div", { style: {
    height: "100%",
    width: `${genderRatio.male}%`,
    borderRadius: 3,
    background: COLORS.male
  } }))), /* @__PURE__ */ React.createElement("div", { style: { flex: 1 } }, /* @__PURE__ */ React.createElement("div", { style: { display: "flex", justifyContent: "space-between", marginBottom: 4 } }, /* @__PURE__ */ React.createElement("span", { style: { fontSize: 12, color: COLORS.textSub } }, "\uC5EC\uC131"), /* @__PURE__ */ React.createElement("span", { style: { fontSize: 12, fontWeight: 700, color: COLORS.female } }, genderRatio.female, "%")), /* @__PURE__ */ React.createElement("div", { style: { height: 6, borderRadius: 3, background: "rgba(236,72,153,0.15)" } }, /* @__PURE__ */ React.createElement("div", { style: {
    height: "100%",
    width: `${genderRatio.female}%`,
    borderRadius: 3,
    background: COLORS.female
  } }))))), newRepeatRatio && (newRepeatRatio.repeatPct > 0 || newRepeatRatio.newPct > 0) && /* @__PURE__ */ React.createElement("div", { style: { marginBottom: 14 } }, /* @__PURE__ */ React.createElement("div", { style: {
    fontSize: 12,
    color: COLORS.textSub,
    marginBottom: 8
  } }, "\uB2E8\uACE8 vs \uC2E0\uADDC \uC190\uB2D8"), (() => {
    const repeat = Number(newRepeatRatio.repeatPct) || 0;
    const fresh = Number(newRepeatRatio.newPct) || 0;
    const total = repeat + fresh;
    const repeatBar = total > 0 ? repeat / total * 100 : 0;
    const freshBar = total > 0 ? fresh / total * 100 : 0;
    return /* @__PURE__ */ React.createElement(React.Fragment, null, /* @__PURE__ */ React.createElement("div", { style: {
      display: "flex",
      height: 10,
      borderRadius: 5,
      overflow: "hidden",
      background: COLORS.cardBg,
      marginBottom: 8
    } }, repeat > 0 && /* @__PURE__ */ React.createElement("div", { style: {
      width: `${repeatBar}%`,
      background: COLORS.accent,
      transition: "width 0.5s"
    } }), fresh > 0 && /* @__PURE__ */ React.createElement("div", { style: {
      width: `${freshBar}%`,
      background: COLORS.male,
      transition: "width 0.5s"
    } })), /* @__PURE__ */ React.createElement("div", { style: { display: "flex", gap: 16 } }, repeat > 0 && /* @__PURE__ */ React.createElement("div", { style: { display: "flex", alignItems: "center", gap: 6 } }, /* @__PURE__ */ React.createElement("span", { style: {
      display: "inline-block",
      width: 10,
      height: 10,
      borderRadius: 2,
      background: COLORS.accent
    } }), /* @__PURE__ */ React.createElement("span", { style: { fontSize: 12, color: COLORS.textSub } }, "\uB2E8\uACE8"), /* @__PURE__ */ React.createElement("span", { style: { fontSize: 13, fontWeight: 700, color: COLORS.accent } }, repeat, "%")), fresh > 0 && /* @__PURE__ */ React.createElement("div", { style: { display: "flex", alignItems: "center", gap: 6 } }, /* @__PURE__ */ React.createElement("span", { style: {
      display: "inline-block",
      width: 10,
      height: 10,
      borderRadius: 2,
      background: COLORS.male
    } }), /* @__PURE__ */ React.createElement("span", { style: { fontSize: 12, color: COLORS.textSub } }, "\uC2E0\uADDC"), /* @__PURE__ */ React.createElement("span", { style: { fontSize: 13, fontWeight: 700, color: COLORS.male } }, fresh, "%"))));
  })()), customerYrEarn && (customerYrEarn.male > 0 || customerYrEarn.female > 0) && /* @__PURE__ */ React.createElement("div", null, /* @__PURE__ */ React.createElement("div", { style: {
    fontSize: 12,
    color: COLORS.textSub,
    marginBottom: 8
  } }, "\uBC29\uBB38 \uC190\uB2D8 \uC5F0 \uD3C9\uADE0\uC18C\uB4DD"), /* @__PURE__ */ React.createElement("div", { style: { display: "flex", gap: 12 } }, customerYrEarn.male > 0 && /* @__PURE__ */ React.createElement("div", { style: {
    flex: 1,
    background: COLORS.cardBg,
    border: `1px solid ${COLORS.border}`,
    borderRadius: "0.5rem",
    padding: "10px 12px"
  } }, /* @__PURE__ */ React.createElement("div", { style: { fontSize: 11, color: COLORS.male, marginBottom: 2 } }, "\uB0A8\uC131"), /* @__PURE__ */ React.createElement("div", { style: { fontSize: 16, fontWeight: 700, color: "#fff" } }, Number(customerYrEarn.male).toLocaleString(), "\uB9CC\uC6D0")), customerYrEarn.female > 0 && /* @__PURE__ */ React.createElement("div", { style: {
    flex: 1,
    background: COLORS.cardBg,
    border: `1px solid ${COLORS.border}`,
    borderRadius: "0.5rem",
    padding: "10px 12px"
  } }, /* @__PURE__ */ React.createElement("div", { style: { fontSize: 11, color: COLORS.female, marginBottom: 2 } }, "\uC5EC\uC131"), /* @__PURE__ */ React.createElement("div", { style: { fontSize: 16, fontWeight: 700, color: "#fff" } }, Number(customerYrEarn.female).toLocaleString(), "\uB9CC\uC6D0"))))), ageGenderSales.length > 0 && /* @__PURE__ */ React.createElement(SectionWrap, null, /* @__PURE__ */ React.createElement(SectionTitle, null, "\uC5F0\uB839\uB300\uBCC4 \uBC30\uB2EC \uB9E4\uCD9C"), /* @__PURE__ */ React.createElement("div", { style: { display: "flex", flexDirection: "column", gap: 8 } }, ageGenderSales.map((a, i) => {
    const malePct = ageMaxVal > 0 ? a.male / ageMaxVal * 100 : 0;
    const femalePct = ageMaxVal > 0 ? a.female / ageMaxVal * 100 : 0;
    return /* @__PURE__ */ React.createElement("div", { key: i, style: {
      display: "flex",
      alignItems: "center",
      gap: 10
    } }, /* @__PURE__ */ React.createElement("span", { style: {
      width: 44,
      fontSize: 12,
      color: COLORS.text,
      fontWeight: 600
    } }, a.age), /* @__PURE__ */ React.createElement("div", { style: { flex: 1, display: "flex", flexDirection: "column", gap: 4 } }, a.male > 0 && /* @__PURE__ */ React.createElement("div", { style: { display: "flex", alignItems: "center", gap: 6 } }, /* @__PURE__ */ React.createElement("div", { style: {
      flex: 1,
      height: 6,
      borderRadius: 3,
      background: "rgba(59,130,246,0.12)"
    } }, /* @__PURE__ */ React.createElement("div", { style: {
      width: `${malePct}%`,
      height: "100%",
      borderRadius: 3,
      background: COLORS.male,
      transition: "width 0.5s"
    } })), /* @__PURE__ */ React.createElement("span", { style: {
      fontSize: 11,
      color: COLORS.male,
      width: 70,
      textAlign: "right",
      fontVariantNumeric: "tabular-nums",
      fontWeight: 600
    } }, "\uB0A8 ", a.male.toLocaleString(), "\uB9CC")), a.female > 0 && /* @__PURE__ */ React.createElement("div", { style: { display: "flex", alignItems: "center", gap: 6 } }, /* @__PURE__ */ React.createElement("div", { style: {
      flex: 1,
      height: 6,
      borderRadius: 3,
      background: "rgba(236,72,153,0.12)"
    } }, /* @__PURE__ */ React.createElement("div", { style: {
      width: `${femalePct}%`,
      height: "100%",
      borderRadius: 3,
      background: COLORS.female,
      transition: "width 0.5s"
    } })), /* @__PURE__ */ React.createElement("span", { style: {
      fontSize: 11,
      color: COLORS.female,
      width: 70,
      textAlign: "right",
      fontVariantNumeric: "tabular-nums",
      fontWeight: 600
    } }, "\uC5EC ", a.female.toLocaleString(), "\uB9CC"))));
  }))), (maleLifestyle.length > 0 || femaleLifestyle.length > 0) && /* @__PURE__ */ React.createElement(SectionWrap, null, /* @__PURE__ */ React.createElement(SectionTitle, null, "\uBC30\uB2EC \uC190\uB2D8 \uB77C\uC774\uD504\uC2A4\uD0C0\uC77C"), /* @__PURE__ */ React.createElement("div", { style: { display: "flex", flexDirection: "column", gap: 14 } }, maleLifestyle.length > 0 && /* @__PURE__ */ React.createElement("div", null, /* @__PURE__ */ React.createElement("div", { style: {
    fontSize: 12,
    color: COLORS.male,
    fontWeight: 600,
    marginBottom: 8
  } }, "\uB0A8\uC131 TOP", maleLifestyle.length), /* @__PURE__ */ React.createElement("div", { style: { display: "flex", flexWrap: "wrap", gap: 6 } }, maleLifestyle.map((l, i) => /* @__PURE__ */ React.createElement("span", { key: i, style: {
    padding: "6px 12px",
    borderRadius: 16,
    fontSize: 12,
    background: "rgba(59,130,246,0.12)",
    color: "#fff",
    border: `1px solid rgba(59,130,246,0.3)`
  } }, l.name, " ", /* @__PURE__ */ React.createElement("span", { style: { color: COLORS.male, fontWeight: 700, marginLeft: 4 } }, l.pct, "%"))))), femaleLifestyle.length > 0 && /* @__PURE__ */ React.createElement("div", null, /* @__PURE__ */ React.createElement("div", { style: {
    fontSize: 12,
    color: COLORS.female,
    fontWeight: 600,
    marginBottom: 8
  } }, "\uC5EC\uC131 TOP", femaleLifestyle.length), /* @__PURE__ */ React.createElement("div", { style: { display: "flex", flexWrap: "wrap", gap: 6 } }, femaleLifestyle.map((l, i) => /* @__PURE__ */ React.createElement("span", { key: i, style: {
    padding: "6px 12px",
    borderRadius: 16,
    fontSize: 12,
    background: "rgba(236,72,153,0.12)",
    color: "#fff",
    border: `1px solid rgba(236,72,153,0.3)`
  } }, l.name, " ", /* @__PURE__ */ React.createElement("span", { style: { color: COLORS.female, fontWeight: 700, marginLeft: 4 } }, l.pct, "%")))))))));
};
export default Card9DeliveryAvgPrice;
