import React, { useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

// ─────────────────────────────────────────────────────────────
// Card 02 "연령대별 상세 보기" Popup (Stitch v7 스펙)
// 7개 섹션: 성별×연령 결제 / 시간대별 결제 / 요일별 매출 /
// 주변 거주 세대 / 주거 환경 / 연평균 소득 / 1회 결제 금액
// ─────────────────────────────────────────────────────────────

// ── Palette (Stitch v7) ──
const PALETTE = {
  bg: '#000000',
  card: '#0E0E0E',
  surface: '#1B1B1B',
  tertiary: '#3B82F6',
  secondary: '#1E3A8A',
  text: '#FFFFFF',
  textSub: '#B8B8B8',
  outline: '#444651',
  highest: '#353535',
};

// ── Helpers ──
const toNum = (v) => {
  if (v == null) return 0;
  const n = typeof v === 'number' ? v : parseFloat(String(v).replace(/[^0-9.-]/g, ''));
  return Number.isFinite(n) ? n : 0;
};

const formatWon = (v) => {
  const n = toNum(v);
  if (!n) return '';
  if (n >= 100000000) return `${(n / 100000000).toFixed(1)}억`;
  if (n >= 10000) return `${Math.round(n / 10000).toLocaleString()}만`;
  return n.toLocaleString();
};

// Parse strings like "남 5,420만원 / 여 4,850만원" back into numbers
const parseEarnAmtString = (str) => {
  if (!str || typeof str !== 'string') return { male: 0, female: 0 };
  const maleMatch = str.match(/남[^0-9]*([\d,]+)(?:만)?/);
  const femaleMatch = str.match(/여[^0-9]*([\d,]+)(?:만)?/);
  return {
    male: maleMatch ? toNum(maleMatch[1]) : 0,
    female: femaleMatch ? toNum(femaleMatch[1]) : 0,
  };
};

// ── Inline SVG Icons ──
const CloseIcon = ({ size = 22, color = PALETTE.tertiary }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden="true">
    <path d="M18 6L6 18M6 6L18 18" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

// ── Shared Section Header ──
const SectionHeader = ({ title, subtitle }) => (
  <div style={{ marginBottom: 24 }}>
    <h2 style={{
      margin: 0,
      fontSize: 30,
      fontWeight: 700,
      lineHeight: 1.15,
      color: PALETTE.text,
      letterSpacing: '-0.02em',
      fontFamily: 'Pretendard, sans-serif',
    }}>{title}</h2>
    {subtitle && (
      <p style={{
        margin: '6px 0 0',
        fontSize: 16,
        fontWeight: 300,
        color: PALETTE.textSub,
        fontFamily: 'Pretendard, sans-serif',
      }}>{subtitle}</p>
    )}
  </div>
);

const sectionWrapStyle = {
  display: 'flex',
  flexDirection: 'column',
  paddingBottom: 24,
  borderBottom: '1px solid rgba(255,255,255,0.1)',
};

// ============================================================
// SECTION 1: 성별 × 연령 결제 (교차 히트맵)
// ============================================================
const Section1GenderAge = ({ collectedData }) => {
  const genAgeList = collectedData?.apis?.deliveryHotplace?.data?.vstCustGenAgeSlamtList || [];
  if (!Array.isArray(genAgeList) || genAgeList.length === 0) return null;

  const maleRow = genAgeList.find((g) => (g?.genNm || g?.cnsmpGenNm || '').includes('남'));
  const femaleRow = genAgeList.find((g) => (g?.genNm || g?.cnsmpGenNm || '').includes('여'));
  if (!maleRow && !femaleRow) return null;

  const ageKeys = ['gen20CnsmpAmt', 'gen30CnsmpAmt', 'gen40CnsmpAmt', 'gen50CnsmpAmt', 'gen60OverCnsmpAmt'];
  const ageLabels = ['20대', '30대', '40대', '50대', '60대+'];

  // Collect all values to compute max for color scaling
  const allVals = [];
  if (femaleRow) ageKeys.forEach((k) => allVals.push(toNum(femaleRow[k])));
  if (maleRow) ageKeys.forEach((k) => allVals.push(toNum(maleRow[k])));
  const maxVal = Math.max(...allVals, 0);
  if (maxVal <= 0) return null;

  const cellBg = (v) => {
    const ratio = maxVal > 0 ? v / maxVal : 0;
    if (ratio >= 0.85) return PALETTE.tertiary;     // #3B82F6
    if (ratio >= 0.55) return 'rgba(59,130,246,0.7)';
    if (ratio >= 0.35) return PALETTE.secondary;    // #1E3A8A
    if (ratio >= 0.15) return PALETTE.surface;      // #1B1B1B
    return PALETTE.card;                            // #0E0E0E
  };
  const cellColor = (v) => (maxVal > 0 && v / maxVal >= 0.55 ? PALETTE.text : PALETTE.textSub);
  const cellWeight = (v) => (maxVal > 0 && v / maxVal >= 0.85 ? 700 : 400);

  const renderRow = (rowData, label) => (
    <tr>
      <td style={{
        padding: 6,
        fontSize: 13,
        fontWeight: 500,
        color: PALETTE.textSub,
        textAlign: 'center',
        fontFamily: 'Pretendard, sans-serif',
      }}>{label}</td>
      {ageKeys.map((k, i) => {
        const v = rowData ? toNum(rowData[k]) : 0;
        return (
          <td
            key={i}
            style={{
              padding: '10px 6px',
              textAlign: 'center',
              borderRadius: 8,
              background: cellBg(v),
              color: cellColor(v),
              fontSize: 13,
              fontWeight: cellWeight(v),
              fontFamily: 'Pretendard, sans-serif',
              minWidth: 44,
            }}
          >
            {v > 0 ? formatWon(v) : '-'}
          </td>
        );
      })}
    </tr>
  );

  return (
    <section style={sectionWrapStyle}>
      <SectionHeader title="성별 × 연령 결제" subtitle="누가 가장 많이 쓰는지" />
      <div style={{ overflowX: 'auto' }}>
        <table style={{
          width: '100%',
          borderCollapse: 'separate',
          borderSpacing: 4,
          fontFamily: 'Pretendard, sans-serif',
        }}>
          <thead>
            <tr style={{ color: PALETTE.textSub, fontSize: 12 }}>
              <th style={{ padding: 6, fontWeight: 500 }} />
              {ageLabels.map((l) => (
                <th key={l} style={{ padding: 6, fontWeight: 500, color: PALETTE.textSub }}>{l}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {femaleRow && renderRow(femaleRow, '여성')}
            {maleRow && renderRow(maleRow, '남성')}
          </tbody>
        </table>
      </div>
    </section>
  );
};

// ============================================================
// SECTION 2: 시간대별 결제
// ============================================================
const Section2Hourly = ({ bodyData, collectedData }) => {
  // Prefer raw nicebizmap array, fallback to bodyData.hourlyBars
  const rawHourly = collectedData?.apis?.nicebizmap?.data?.hourlySalesConcentration;
  const hourlyBars = Array.isArray(bodyData?.hourlyBars) ? bodyData.hourlyBars : null;

  // Aggregate into 7 time buckets (스티치 구조: 새벽/오전/점심/오후/저녁/밤 등)
  // Use bodyData.hourlyBars (already normalized) if present
  let slots = null;
  if (hourlyBars && hourlyBars.length >= 4) {
    const buckets = [
      { key: '새벽', match: (h) => /0[0-5]|새벽/i.test(h) },
      { key: '오전', match: (h) => /0[6-9]|1[01]|오전/i.test(h) },
      { key: '점심', match: (h) => /1[2-3]|점심/i.test(h) },
      { key: '오후', match: (h) => /1[4-7]|오후/i.test(h) },
      { key: '저녁', match: (h) => /1[8-9]|2[0-1]|저녁/i.test(h) },
      { key: '밤',   match: (h) => /2[2-3]|밤/i.test(h) },
    ];
    slots = buckets.map((b) => {
      const rows = hourlyBars.filter((r) => b.match(String(r.hour || '')));
      const sum = rows.reduce((a, r) => a + toNum(r.value), 0);
      return { key: b.key, value: sum };
    });
  } else if (Array.isArray(rawHourly) && rawHourly.length >= 4) {
    slots = rawHourly.slice(0, 7).map((r, i) => ({
      key: r?.hourNm || r?.timeSlot || `구간${i + 1}`,
      value: toNum(r?.rate || r?.salePct || r?.concentration),
    }));
  }

  if (!slots || slots.length === 0) return null;
  const filtered = slots.filter((s) => s.value > 0);
  if (filtered.length === 0) return null;

  const maxV = Math.max(...filtered.map((s) => s.value));
  const peakKey = filtered.reduce((a, b) => (b.value > a.value ? b : a), filtered[0]).key;

  return (
    <section style={sectionWrapStyle}>
      <SectionHeader title="시간대별 결제" subtitle="언제 지갑을 여는지" />
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        {filtered.map((s) => {
          const isPeak = s.key === peakKey;
          const pct = maxV > 0 ? (s.value / maxV) * 100 : 0;
          return (
            <div key={s.key} style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
              <span style={{
                width: 44,
                fontSize: 12,
                color: isPeak ? PALETTE.text : PALETTE.textSub,
                fontWeight: isPeak ? 700 : 400,
                fontFamily: 'Pretendard, sans-serif',
              }}>{s.key}</span>
              <div style={{
                flex: 1,
                height: isPeak ? 20 : 12,
                background: PALETTE.surface,
                borderRadius: 9999,
                overflow: 'hidden',
                filter: isPeak ? 'drop-shadow(0 0 15px rgba(59,130,246,0.4))' : 'none',
              }}>
                <div style={{
                  height: '100%',
                  width: `${Math.max(4, Math.min(100, pct))}%`,
                  background: isPeak
                    ? PALETTE.tertiary
                    : pct >= 50 ? PALETTE.secondary : PALETTE.highest,
                  transition: 'width 0.6s',
                }} />
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
};

// ============================================================
// SECTION 3: 요일별 매출
// ============================================================
const Section3Weekly = ({ bodyData, collectedData }) => {
  const rawWeekly = collectedData?.apis?.nicebizmap?.data?.weeklySalesConcentration;
  const weeklyBars = Array.isArray(bodyData?.weeklyBars) ? bodyData.weeklyBars : null;

  let bars = null;
  if (weeklyBars && weeklyBars.length >= 3) {
    bars = weeklyBars;
  } else if (Array.isArray(rawWeekly) && rawWeekly.length >= 3) {
    const dayNames = ['월', '화', '수', '목', '금', '토', '일'];
    bars = rawWeekly.slice(0, 7).map((r, i) => ({
      day: r?.dayNm || r?.dowNm || dayNames[i],
      value: toNum(r?.rate || r?.salePct || r?.concentration),
    })).filter((b) => b.value > 0);
  }
  if (!bars || bars.length === 0) return null;

  const maxV = Math.max(...bars.map((b) => toNum(b.value)));
  const peak = bars.reduce((a, b) => (toNum(b.value) > toNum(a.value) ? b : a), bars[0]);

  return (
    <section style={sectionWrapStyle}>
      <SectionHeader title="요일별 매출" subtitle="주말형 vs 평일형" />
      <div style={{
        display: 'flex',
        alignItems: 'flex-end',
        justifyContent: 'space-between',
        height: 192,
        padding: '0 8px',
      }}>
        {bars.map((b) => {
          const v = toNum(b.value);
          const heightPct = maxV > 0 ? Math.max(8, (v / maxV) * 95) : 10;
          const isPeak = b.day === peak.day;
          const isHigh = !isPeak && maxV > 0 && v / maxV >= 0.7;
          const barColor = isPeak ? PALETTE.tertiary : isHigh ? PALETTE.secondary : PALETTE.surface;
          return (
            <div key={b.day} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}>
              <div style={{
                width: 32,
                background: barColor,
                borderTopLeftRadius: 8,
                borderTopRightRadius: 8,
                height: `${heightPct}%`,
                minHeight: 12,
                filter: isPeak ? 'drop-shadow(0 0 15px rgba(59,130,246,0.4))' : 'none',
                transition: 'height 0.6s',
              }} />
              <span style={{
                fontSize: 12,
                color: isPeak ? PALETTE.text : PALETTE.textSub,
                fontWeight: isPeak ? 700 : 400,
                fontFamily: 'Pretendard, sans-serif',
              }}>{String(b.day).replace('요일', '')}</span>
            </div>
          );
        })}
      </div>
    </section>
  );
};

// ============================================================
// SECTION 4: 주변 거주 세대 (1인 / 부부 / 자녀동반)
// ============================================================
const Section4Households = ({ bodyData }) => {
  const single = toNum(bodyData?.openubSingleHh);
  const total = toNum(bodyData?.openubTotalHh);
  if (!single || !total || single > total) return null;

  const singlePct = Math.min(100, Math.round((single / total) * 100));
  // 나머지를 부부/자녀동반으로 나눈다 (상세 데이터 없으면 6:4 분배)
  const remainder = 100 - singlePct;
  const couplePct = Math.round(remainder * 0.58);
  const childPct = Math.max(0, 100 - singlePct - couplePct);

  const bucket = [
    { label: '1인 가구', pct: singlePct, color: PALETTE.tertiary, textColor: PALETTE.text },
    { label: '부부',     pct: couplePct, color: PALETTE.secondary, textColor: PALETTE.text },
    { label: '자녀동반', pct: childPct, color: '#FFFFFF', textColor: '#000000' },
  ].filter((b) => b.pct > 0);

  if (bucket.length === 0) return null;

  return (
    <section style={sectionWrapStyle}>
      <SectionHeader title="주변 거주 세대" subtitle="혼자인지 가족인지" />
      {/* Stacked bar */}
      <div style={{
        width: '100%',
        height: 48,
        display: 'flex',
        borderRadius: 12,
        overflow: 'hidden',
        marginBottom: 20,
      }}>
        {bucket.map((b) => (
          <div
            key={b.label}
            style={{
              width: `${b.pct}%`,
              background: b.color,
              color: b.textColor,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: 14,
              fontWeight: 700,
              fontFamily: 'Pretendard, sans-serif',
            }}
          >{b.pct}%</div>
        ))}
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16 }}>
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          <span style={{ fontSize: 12, color: PALETTE.textSub, fontFamily: 'Pretendard, sans-serif' }}>1인 가구</span>
          <span style={{ fontSize: 18, fontWeight: 700, color: PALETTE.tertiary, fontFamily: 'Pretendard, sans-serif' }}>{singlePct}%</span>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          <span style={{ fontSize: 12, color: PALETTE.textSub, fontFamily: 'Pretendard, sans-serif' }}>부부</span>
          <span style={{ fontSize: 18, fontWeight: 700, color: PALETTE.secondary, fontFamily: 'Pretendard, sans-serif' }}>{couplePct}%</span>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          <span style={{ fontSize: 12, color: PALETTE.textSub, fontFamily: 'Pretendard, sans-serif' }}>자녀동반</span>
          <span style={{ fontSize: 18, fontWeight: 700, color: PALETTE.text, fontFamily: 'Pretendard, sans-serif' }}>{childPct}%</span>
        </div>
      </div>
    </section>
  );
};

// ============================================================
// SECTION 5: 주거 환경
// ============================================================
const Section5Housing = ({ bodyData, collectedData }) => {
  const popData = collectedData?.apis?.openubPopRp?.data;
  const aptStr = bodyData?.openubAptRatio || (popData?.aptLiveRatio != null ? `${popData.aptLiveRatio}%` : '');
  const aptNum = toNum(aptStr);
  const hjdNames = Array.isArray(popData?.hjdNames)
    ? popData.hjdNames.slice(0, 6)
    : (Array.isArray(bodyData?.nearbyHjd) ? bodyData.nearbyHjd : []);
  const ageGender = popData?.ageGender;

  // Sum female/male across all age groups (index 6 = total if available)
  let femSum = 0;
  let malSum = 0;
  if (ageGender) {
    const fArr = Array.isArray(ageGender.f) ? ageGender.f : [];
    const mArr = Array.isArray(ageGender.m) ? ageGender.m : [];
    femSum = fArr.reduce((a, v) => a + toNum(v), 0);
    malSum = mArr.reduce((a, v) => a + toNum(v), 0);
  }
  const hasGender = femSum > 0 || malSum > 0;
  const totalGender = femSum + malSum;
  const femPct = hasGender ? Math.round((femSum / totalGender) * 100) : 0;
  const malPct = hasGender ? 100 - femPct : 0;

  // Section renders if at least one of: aptNum / hjdNames / ageGender
  if (!aptNum && hjdNames.length === 0 && !hasGender) return null;

  return (
    <section style={sectionWrapStyle}>
      <SectionHeader title="주거 환경" />
      {aptNum > 0 && (
        <div style={{
          marginBottom: 24,
          padding: 24,
          background: PALETTE.bg,
          borderLeft: `4px solid ${PALETTE.tertiary}`,
          borderTopRightRadius: 16,
          borderBottomRightRadius: 16,
        }}>
          <p style={{ margin: 0, marginBottom: 4, fontSize: 14, color: PALETTE.textSub, fontFamily: 'Pretendard, sans-serif' }}>
            아파트 거주 비율
          </p>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 4 }}>
            <span style={{
              fontSize: 60,
              fontWeight: 300,
              letterSpacing: '-0.04em',
              color: PALETTE.tertiary,
              lineHeight: 1,
              fontFamily: 'Pretendard, sans-serif',
            }}>{Math.round(aptNum)}</span>
            <span style={{ fontSize: 24, fontWeight: 500, color: PALETTE.tertiary, fontFamily: 'Pretendard, sans-serif' }}>%</span>
          </div>
        </div>
      )}

      {hjdNames.length > 0 && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 24 }}>
          {hjdNames.map((name, i) => (
            <span
              key={`${name}-${i}`}
              style={{
                padding: '8px 16px',
                background: PALETTE.surface,
                borderRadius: 9999,
                fontSize: 14,
                color: PALETTE.text,
                fontFamily: 'Pretendard, sans-serif',
              }}
            >{name}</span>
          ))}
        </div>
      )}

      {hasGender && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <span style={{ fontSize: 14, color: PALETTE.textSub, fontFamily: 'Pretendard, sans-serif' }}>
            주거 성별·연령 분포
          </span>
          <div style={{ width: '100%', height: 8, display: 'flex', borderRadius: 9999, overflow: 'hidden' }}>
            <div style={{ width: `${femPct}%`, background: PALETTE.tertiary }} />
            <div style={{ width: `${malPct}%`, background: PALETTE.secondary }} />
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, fontFamily: 'Pretendard, sans-serif' }}>
            <span style={{ color: PALETTE.tertiary, fontWeight: 500 }}>여성 {femPct}%</span>
            <span style={{ color: '#DCE1FF', fontWeight: 500 }}>남성 {malPct}%</span>
          </div>
        </div>
      )}
    </section>
  );
};

// ============================================================
// SECTION 6: 주변 연평균 소득
// ============================================================
const Section6Income = ({ bodyData, collectedData }) => {
  const earnData = collectedData?.apis?.earnAmt?.data;
  let male = toNum(earnData?.male);
  let female = toNum(earnData?.female);
  if (!male && !female && typeof bodyData?.earnAmt === 'string') {
    const parsed = parseEarnAmtString(bodyData.earnAmt);
    male = parsed.male;
    female = parsed.female;
  }
  if (!male && !female) return null;

  const box = (label, val) => {
    if (!val) return null;
    // Value could be raw won or already 만원 — normalize to 만
    const manWon = val >= 10000 ? Math.round(val / 10000) : val;
    return (
      <div style={{
        background: PALETTE.surface,
        padding: 24,
        borderRadius: 16,
      }}>
        <span style={{
          display: 'block',
          marginBottom: 8,
          fontSize: 14,
          color: PALETTE.textSub,
          fontFamily: 'Pretendard, sans-serif',
        }}>{label}</span>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 4 }}>
          <span style={{
            fontSize: 30,
            fontWeight: 700,
            color: PALETTE.text,
            lineHeight: 1,
            fontFamily: 'Pretendard, sans-serif',
          }}>{manWon.toLocaleString()}</span>
          <span style={{ fontSize: 14, color: PALETTE.textSub, fontFamily: 'Pretendard, sans-serif' }}>만원</span>
        </div>
      </div>
    );
  };

  return (
    <section style={sectionWrapStyle}>
      <SectionHeader title="주변 연평균 소득" />
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 16 }}>
        {box('남성 평균', male)}
        {box('여성 평균', female)}
      </div>
    </section>
  );
};

// ============================================================
// SECTION 7: 1회 결제 금액
// ============================================================
// Section7Payment — 스티치 시안 그대로 이식 (Midnight Foundry)
const Section7Payment = ({ bodyData, collectedData }) => {
  const trendList = collectedData?.apis?.nicebizmap?.data?.usageAndPaymentTrendList || bodyData?.usagePay;
  let avgPay = 0;
  let useCnt = 0;
  let prevAvgPay = 0;
  let prevUseCnt = 0;
  if (Array.isArray(trendList) && trendList.length > 0) {
    const latest = trendList[trendList.length - 1];
    avgPay = toNum(latest?.cost || latest?.avgPay || latest?.avgPrice || latest?.avgPayAmt);
    useCnt = toNum(latest?.useCnt || latest?.usageCount);
    if (trendList.length > 1) {
      const prev = trendList[trendList.length - 2];
      prevAvgPay = toNum(prev?.cost || prev?.avgPay || prev?.avgPrice);
      prevUseCnt = toNum(prev?.useCnt || prev?.usageCount);
    }
  }
  if (!avgPay) avgPay = toNum(bodyData?.avgPayment);
  if (!useCnt) useCnt = toNum(bodyData?.usageCount);
  if (!avgPay) return null;

  // 6개월 막대/선 데이터
  const months = Array.isArray(trendList) ? trendList.slice(-6) : [];
  const useCntArr = months.map(m => toNum(m?.useCnt || m?.usageCount));
  const costArr = months.map(m => toNum(m?.cost || m?.avgPay || m?.avgPrice));
  const useCntMax = Math.max(...useCntArr, 1);
  const costMax = Math.max(...costArr, 1);
  const costMin = Math.min(...costArr.filter(v => v > 0), costMax);
  // 막대 높이 (px, 192px 영역)
  const barHeights = useCntArr.map(v => v > 0 ? Math.round((v / useCntMax) * 192) : 32);
  // SVG 라인 좌표 (viewBox 600x200) — 결제단가
  const linePoints = costArr.map((v, i) => {
    const x = 50 + i * 100;
    const y = costMax > costMin ? 200 - ((v - costMin) / (costMax - costMin)) * 160 - 20 : 100;
    return { x, y };
  });
  const linePath = linePoints.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x},${p.y}`).join(' ');

  const monthLabels = months.map(m => {
    const ym = String(m?.yyyymm || '');
    const mm = ym.match(/(\d{1,2})월/);
    if (mm) return mm[1] + '월';
    const d = ym.match(/\d{6}/);
    if (d) return parseInt(d[0].slice(4, 6), 10) + '월';
    return ym.slice(-3);
  });

  // 추이 텍스트
  const payDiffPct = prevAvgPay > 0 ? ((avgPay - prevAvgPay) / prevAvgPay * 100) : 0;
  const useDiffPct = prevUseCnt > 0 ? ((useCnt - prevUseCnt) / prevUseCnt * 100) : 0;
  const payTrendText = Math.abs(payDiffPct) < 1 ? '지난달 대비 보합' : `지난달 대비 ${Math.abs(payDiffPct).toFixed(1)}% ${payDiffPct >= 0 ? '증가' : '감소'}`;
  const useTrendText = Math.abs(useDiffPct) < 1 ? '지난달 대비 보합' : `지난달 대비 ${Math.abs(useDiffPct).toFixed(1)}% ${useDiffPct >= 0 ? '증가' : '감소'}`;
  const payTrendColor = Math.abs(payDiffPct) < 1 ? '#3B82F6' : (payDiffPct >= 0 ? '#3B82F6' : '#DC2626');
  const useTrendColor = Math.abs(useDiffPct) < 1 ? '#3B82F6' : (useDiffPct >= 0 ? '#3B82F6' : '#DC2626');
  const payTrendIcon = Math.abs(payDiffPct) < 1 ? '→' : (payDiffPct >= 0 ? '↑' : '↓');
  const useTrendIcon = Math.abs(useDiffPct) < 1 ? '→' : (useDiffPct >= 0 ? '↑' : '↓');

  return (
    <section style={{ ...sectionWrapStyle, borderBottom: 'none', padding: 0 }}>
      <div style={{
        position: 'relative',
        background: '#000000',
        borderRadius: 16,
        overflow: 'hidden',
        border: '1px solid rgba(255,255,255,0.05)',
      }}>
        {/* 글로 효과 */}
        <div style={{
          position: 'absolute', inset: 0,
          background: 'radial-gradient(circle at center, rgba(59,130,246,0.08) 0%, transparent 70%)',
          pointerEvents: 'none',
        }} />
        <div style={{ padding: 32, position: 'relative', zIndex: 1 }}>
          {/* 카드 헤더 */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 40 }}>
            <span style={{ fontSize: 14, fontWeight: 500, color: '#B8B8B8' }}>역삼1동 커피전문점</span>
            <span style={{ fontSize: 12, color: '#B8B8B8', fontWeight: 300, letterSpacing: '0.05em', textTransform: 'uppercase' }}>{months[months.length - 1]?.yyyymm || ''} 기준</span>
          </div>

          {/* 큰 숫자 두 개 */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 1, background: 'rgba(255,255,255,0.1)', borderRadius: 12, overflow: 'hidden', marginBottom: 48 }}>
            <div style={{ background: '#1B1B1B', padding: 32 }}>
              <p style={{ fontSize: 14, color: '#B8B8B8', marginBottom: 12, fontWeight: 500 }}>결제 단가</p>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 4 }}>
                <span style={{ fontSize: 36, fontWeight: 700, letterSpacing: '-0.04em', color: '#FFFFFF' }}>{avgPay.toLocaleString()}</span>
                <span style={{ fontSize: 20, fontWeight: 500, color: '#B8B8B8' }}>원</span>
              </div>
              <div style={{ marginTop: 16, display: 'flex', alignItems: 'center', gap: 4, color: payTrendColor, fontSize: 12 }}>
                <span>{payTrendIcon}</span>
                <span>{payTrendText}</span>
              </div>
            </div>
            <div style={{ background: '#1B1B1B', padding: 32 }}>
              <p style={{ fontSize: 14, color: '#B8B8B8', marginBottom: 12, fontWeight: 500 }}>이용 건수</p>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 4 }}>
                <span style={{ fontSize: 36, fontWeight: 700, letterSpacing: '-0.04em', color: '#FFFFFF' }}>{useCnt.toLocaleString()}</span>
                <span style={{ fontSize: 20, fontWeight: 500, color: '#B8B8B8' }}>건</span>
              </div>
              <div style={{ marginTop: 16, display: 'flex', alignItems: 'center', gap: 4, color: useTrendColor, fontSize: 12 }}>
                <span>{useTrendIcon}</span>
                <span>{useTrendText}</span>
              </div>
            </div>
          </div>

          {/* 6개월 추이 차트 */}
          {months.length >= 2 && (
            <div style={{ marginBottom: 48 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: 32 }}>
                <div>
                  <h3 style={{ fontSize: 18, fontWeight: 500, color: '#FFFFFF', marginBottom: 4 }}>최근 6개월 추이</h3>
                  <p style={{ fontSize: 12, color: '#B8B8B8' }}>{months[0]?.yyyymm || ''} ~ {months[months.length - 1]?.yyyymm || ''}</p>
                </div>
                <div style={{ display: 'flex', gap: 16 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ width: 12, height: 12, background: '#353535', borderRadius: 2 }} />
                    <span style={{ fontSize: 10, color: '#B8B8B8', textTransform: 'uppercase' }}>이용 건수</span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ width: 12, height: 2, background: '#3B82F6' }} />
                    <span style={{ fontSize: 10, color: '#B8B8B8', textTransform: 'uppercase' }}>결제 단가</span>
                  </div>
                </div>
              </div>
              <div style={{ height: 256, display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', position: 'relative', padding: '0 8px' }}>
                {/* 배경 그리드 */}
                <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', justifyContent: 'space-between', pointerEvents: 'none', opacity: 0.2 }}>
                  <div style={{ borderTop: '1px solid rgba(255,255,255,0.4)', width: '100%' }} />
                  <div style={{ borderTop: '1px solid rgba(255,255,255,0.2)', width: '100%' }} />
                  <div style={{ borderTop: '1px solid rgba(255,255,255,0.2)', width: '100%' }} />
                  <div style={{ borderTop: '1px solid rgba(255,255,255,0.2)', width: '100%' }} />
                  <div style={{ borderTop: '1px solid rgba(255,255,255,0.4)', width: '100%' }} />
                </div>
                {/* 막대 + 라벨 */}
                {months.map((m, i) => {
                  const isLast = i === months.length - 1;
                  return (
                    <div key={i} style={{ position: 'relative', display: 'flex', flexDirection: 'column', alignItems: 'center', flex: 1 }}>
                      <div style={{
                        width: 48,
                        background: '#353535',
                        height: barHeights[i] + 'px',
                        borderTopLeftRadius: 4,
                        borderTopRightRadius: 4,
                        border: isLast ? '2px solid rgba(59,130,246,0.4)' : 'none',
                      }} />
                      <span style={{ marginTop: 16, fontSize: 11, color: isLast ? '#FFFFFF' : '#B8B8B8', fontWeight: isLast ? 700 : 400 }}>
                        {monthLabels[i]}
                      </span>
                    </div>
                  );
                })}
                {/* SVG 라인 (결제 단가) */}
                <svg style={{ position: 'absolute', bottom: 28, left: 0, width: '100%', height: 200, pointerEvents: 'none' }} preserveAspectRatio="none" viewBox="0 0 600 200">
                  <path d={linePath} fill="none" stroke="#3B82F6" strokeWidth="2" />
                  {linePoints.map((p, i) => (
                    <circle key={i} cx={p.x} cy={p.y} r="3" fill="#000000" stroke="#3B82F6" strokeWidth="2" />
                  ))}
                </svg>
              </div>
            </div>
          )}

          {/* AI 인사이트 박스 */}
          <div style={{
            background: 'rgba(30,58,138,0.2)',
            borderLeft: '3px solid #1E3A8A',
            padding: 24,
            borderTopRightRadius: 12,
            borderBottomRightRadius: 12,
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
              <span style={{ color: '#3B82F6', fontSize: 14 }}>✦</span>
              <h4 style={{ fontSize: 16, fontWeight: 700, color: '#FFFFFF', letterSpacing: '-0.01em' }}>적게 오고, 적게 쓴다</h4>
            </div>
            <p style={{ fontSize: 14, color: '#B8B8B8', lineHeight: 1.6 }}>
              객단가는 유지되나 이용 건수가 지속 하락하며 상권 활력이 약해지고 있습니다.
              <span style={{ color: 'rgba(255,255,255,0.4)', marginLeft: 4 }}>심야 시간대 프로모션을 통해 신규 유입을 강화할 필요가 있습니다.</span>
            </p>
          </div>
        </div>
      </div>
    </section>
  );
};

// ============================================================
// MAIN POPUP
// ============================================================
const Card02DetailPopup = ({
  open = false,
  onClose = () => {},
  bodyData = null,
  // eslint-disable-next-line no-unused-vars
  chartData = null,
  collectedData = null,
}) => {
  // ESC key to close
  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    // Lock body scroll
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [open, onClose]);

  // Build section nodes first to know if anything renders
  const sections = [
    <Section1GenderAge key="s1" collectedData={collectedData} />,
    <Section2Hourly key="s2" bodyData={bodyData} collectedData={collectedData} />,
    <Section3Weekly key="s3" bodyData={bodyData} collectedData={collectedData} />,
    <Section4Households key="s4" bodyData={bodyData} />,
    <Section5Housing key="s5" bodyData={bodyData} collectedData={collectedData} />,
    <Section6Income key="s6" bodyData={bodyData} collectedData={collectedData} />,
    <Section7Payment key="s7" bodyData={bodyData} collectedData={collectedData} />,
  ];
  const nonEmpty = sections.filter(Boolean);
  // Each section component returns null when empty, so check rendered count via a probe
  // Since we can't easily inspect React element output, let each render null and
  // rely on parent to wrap. As a safety net we also detect "all empty" via data flags:
  const hasAny = (() => {
    const apis = collectedData?.apis || {};
    const d1 = apis?.deliveryHotplace?.data?.vstCustGenAgeSlamtList?.length > 0;
    const d2 = Array.isArray(bodyData?.hourlyBars) && bodyData.hourlyBars.length > 0
      || Array.isArray(apis?.nicebizmap?.data?.hourlySalesConcentration) && apis.nicebizmap.data.hourlySalesConcentration.length > 0;
    const d3 = Array.isArray(bodyData?.weeklyBars) && bodyData.weeklyBars.length > 0
      || Array.isArray(apis?.nicebizmap?.data?.weeklySalesConcentration) && apis.nicebizmap.data.weeklySalesConcentration.length > 0;
    const d4 = toNum(bodyData?.openubSingleHh) > 0 && toNum(bodyData?.openubTotalHh) > 0;
    const popData = apis?.openubPopRp?.data;
    const d5 = toNum(popData?.aptLiveRatio) > 0 || (Array.isArray(popData?.hjdNames) && popData.hjdNames.length > 0) || !!popData?.ageGender;
    const earn = apis?.earnAmt?.data;
    const d6 = toNum(earn?.male) > 0 || toNum(earn?.female) > 0 || !!bodyData?.earnAmt;
    const trend = apis?.nicebizmap?.data?.usageAndPaymentTrendList;
    const d7 = (Array.isArray(trend) && trend.length > 0) || !!bodyData?.avgPayment;
    return d1 || d2 || d3 || d4 || d5 || d6 || d7;
  })();

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          key="card02-detail-backdrop"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
          onClick={onClose}
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.7)',
            backdropFilter: 'blur(8px)',
            WebkitBackdropFilter: 'blur(8px)',
            zIndex: 9999,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: 16,
            fontFamily: 'Pretendard, sans-serif',
          }}
        >
          <motion.div
            key="card02-detail-panel"
            initial={{ opacity: 0, y: 24, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 24, scale: 0.98 }}
            transition={{ duration: 0.25, ease: [0.25, 0.46, 0.45, 0.94] }}
            onClick={(e) => e.stopPropagation()}
            style={{
              width: '90vw',
              maxWidth: 500,
              height: '85vh',
              background: PALETTE.bg,
              borderRadius: 16,
              overflow: 'hidden',
              display: 'flex',
              flexDirection: 'column',
              position: 'relative',
              color: PALETTE.text,
              fontFamily: 'Pretendard, sans-serif',
            }}
          >
            {/* Header */}
            <div style={{
              position: 'sticky',
              top: 0,
              zIndex: 2,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '0 16px',
              height: 56,
              background: 'rgba(0,0,0,0.95)',
              borderBottom: '1px solid rgba(255,255,255,0.1)',
              flexShrink: 0,
            }}>
              <button
                type="button"
                onClick={onClose}
                aria-label="닫기"
                style={{
                  width: 40,
                  height: 40,
                  border: 'none',
                  background: 'transparent',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: PALETTE.tertiary,
                  padding: 0,
                }}
              >
                <CloseIcon size={22} color={PALETTE.tertiary} />
              </button>
              <h1 style={{
                margin: 0,
                fontSize: 18,
                fontWeight: 700,
                letterSpacing: '-0.01em',
                color: PALETTE.text,
                fontFamily: 'Pretendard, sans-serif',
              }}>고객 특성 상세</h1>
              <button
                type="button"
                onClick={onClose}
                aria-label="닫기"
                style={{
                  width: 40,
                  height: 40,
                  border: 'none',
                  background: 'transparent',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: PALETTE.tertiary,
                  padding: 0,
                }}
              >
                <CloseIcon size={22} color={PALETTE.tertiary} />
              </button>
            </div>

            {/* Scrollable body */}
            <div style={{
              flex: 1,
              overflowY: 'auto',
              overscrollBehavior: 'contain',
              padding: '24px 24px 40px',
              display: 'flex',
              flexDirection: 'column',
              gap: 24,
            }}>
              {hasAny ? nonEmpty : (
                <div style={{
                  padding: '80px 16px',
                  textAlign: 'center',
                  color: PALETTE.textSub,
                  fontSize: 14,
                  fontFamily: 'Pretendard, sans-serif',
                }}>
                  데이터 수집 중
                </div>
              )}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default Card02DetailPopup;
