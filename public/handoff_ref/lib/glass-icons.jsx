/* glass-icons.jsx — inline SVG icons, SF Symbols / Phosphor-flavored monoline
   stroke is `currentColor` so they inherit text color. */

const ICON_PATHS = {
  /* Navigation rail */
  "map":           { v: 24, d: "M9 4 L3 6 V20 L9 18 L15 20 L21 18 V4 L15 6 Z M9 4 V18 M15 6 V20", fill: "none" },
  "users":         { v: 24, d: "M12 14 a4 4 0 1 0 0 -8 a4 4 0 1 0 0 8 Z M4 21 c0 -3 3 -5 8 -5 s8 2 8 5 M18 9 a3 3 0 1 0 0 -6 a3 3 0 1 0 0 6 M22 18 c0 -2 -1.5 -3 -4 -3.5", fill: "none" },
  "target":        { v: 24, d: "M12 21 a9 9 0 1 0 0 -18 a9 9 0 1 0 0 18 Z M12 17 a5 5 0 1 0 0 -10 a5 5 0 1 0 0 10 Z M12 14 a2 2 0 1 0 0 -4 a2 2 0 1 0 0 4 Z", fill: "none" },
  "chart":         { v: 24, d: "M4 4 V20 H20 M8 16 L12 12 L15 14 L20 8", fill: "none" },
  "sparkle":       { v: 24, d: "M12 3 L13.5 9 L19.5 10.5 L13.5 12 L12 18 L10.5 12 L4.5 10.5 L10.5 9 Z M19 18 L19.7 20 L21.5 20.7 L19.7 21.4 L19 23.4 L18.3 21.4 L16.5 20.7 L18.3 20 Z", fill: "currentColor", stroke: "none" },
  "gear":          { v: 24, d: "M12 15 a3 3 0 1 0 0 -6 a3 3 0 1 0 0 6 Z M19.4 13.5 L21 14.5 L19.5 17 L17.7 16.5 A7.5 7.5 0 0 1 16 17.7 L15.5 19.5 L12.5 19.5 L12 17.7 A7.5 7.5 0 0 1 10.3 17 L8.5 17.5 L7 15 L8.3 13.7 A7.5 7.5 0 0 1 8.3 12 L7 10.3 L8.5 7.8 L10.3 8.3 A7.5 7.5 0 0 1 12 7 L12.5 5.2 L15.5 5.2 L16 7 A7.5 7.5 0 0 1 17.7 7.8 L19.5 7.3 L21 9.8 L19.7 11.1 A7.5 7.5 0 0 1 19.7 12.8 Z", fill: "none" },
  "user":          { v: 24, d: "M12 21 a9 9 0 1 0 0 -18 a9 9 0 1 0 0 18 Z M12 13 a3.5 3.5 0 1 0 0 -7 a3.5 3.5 0 1 0 0 7 Z M5.5 19 c1.5 -2.5 4 -4 6.5 -4 s5 1.5 6.5 4", fill: "none" },

  /* Pills and widgets */
  "pin":           { v: 24, d: "M12 22 s7 -8 7 -13 a7 7 0 1 0 -14 0 c0 5 7 13 7 13 Z M12 11.5 a2.5 2.5 0 1 0 0 -5 a2.5 2.5 0 1 0 0 5 Z", fill: "none" },
  "external":      { v: 24, d: "M14 4 H20 V10 M20 4 L11 13 M18 14 V19 a1 1 0 0 1 -1 1 H5 a1 1 0 0 1 -1 -1 V7 a1 1 0 0 1 1 -1 H10", fill: "none" },
  "trophy":        { v: 24, d: "M8 4 H16 V8 a4 4 0 0 1 -8 0 Z M8 6 H4 V8 a3 3 0 0 0 3 3 M16 6 H20 V8 a3 3 0 0 1 -3 3 M10 14 H14 V20 H10 Z M7 20 H17", fill: "none" },
  "sun":           { v: 24, d: "M12 16 a4 4 0 1 0 0 -8 a4 4 0 1 0 0 8 Z M12 3 V5 M12 19 V21 M3 12 H5 M19 12 H21 M5.6 5.6 L7 7 M17 17 L18.4 18.4 M5.6 18.4 L7 17 M17 7 L18.4 5.6", fill: "none" },
  "walk":          { v: 24, d: "M14 4.5 a1.5 1.5 0 1 0 0 -3 a1.5 1.5 0 1 0 0 3 Z M9 21 L11 14 L8 11 V7 L12 6 L15 9 L18 10 M13 12 L15 15 V21", fill: "none" },
  "hash":          { v: 24, d: "M5 9 H21 M3 15 H19 M10 3 L7 21 M17 3 L14 21", fill: "none" },
  "moped":         { v: 24, d: "M6 19 a3 3 0 1 0 0 -6 a3 3 0 1 0 0 6 Z M18 19 a3 3 0 1 0 0 -6 a3 3 0 1 0 0 6 Z M9 16 H15 M15 16 V11 L11 6 H8 V8 H10 L13 12 H6 M16 6 H19 L21 9", fill: "none" },
  "calendar":      { v: 24, d: "M5 6 H19 a1 1 0 0 1 1 1 V20 a1 1 0 0 1 -1 1 H5 a1 1 0 0 1 -1 -1 V7 a1 1 0 0 1 1 -1 Z M4 11 H20 M8 3 V8 M16 3 V8", fill: "none" },
  "funnel":        { v: 24, d: "M3 5 H21 L14 13 V20 L10 22 V13 Z", fill: "none" },
  "search":        { v: 24, d: "M11 18 a7 7 0 1 0 0 -14 a7 7 0 1 0 0 14 Z M16 16 L21 21", fill: "none" },
  "share":         { v: 24, d: "M12 3 V15 M7 8 L12 3 L17 8 M5 12 V20 a1 1 0 0 0 1 1 H18 a1 1 0 0 0 1 -1 V12", fill: "none" },
  "dot":           { v: 24, d: "M12 14 a2 2 0 1 0 0 -4 a2 2 0 1 0 0 4 Z", fill: "currentColor", stroke: "none" },
  "arrow-up":      { v: 24, d: "M12 4 V20 M5 11 L12 4 L19 11", fill: "none" },
  "arrow-down":    { v: 24, d: "M12 4 V20 M5 13 L12 20 L19 13", fill: "none" },
  "store":         { v: 24, d: "M4 9 L5 4 H19 L20 9 M4 9 V20 H20 V9 M4 9 H20 M9 20 V14 H15 V20", fill: "none" },
};

function GlassIcon({ name, size = 18, stroke = 2, style }) {
  const ic = ICON_PATHS[name];
  if (!ic) return null;
  return (
    <svg width={size} height={size} viewBox={`0 0 ${ic.v} ${ic.v}`}
      style={{display:"inline-block", verticalAlign:"-3px", flexShrink:0, ...style}}
      fill={ic.fill === "none" ? "none" : "currentColor"}
      stroke={ic.stroke === "none" ? "none" : "currentColor"}
      strokeWidth={stroke}
      strokeLinecap="round"
      strokeLinejoin="round">
      <path d={ic.d}/>
    </svg>
  );
}

window.GlassIcon = GlassIcon;
