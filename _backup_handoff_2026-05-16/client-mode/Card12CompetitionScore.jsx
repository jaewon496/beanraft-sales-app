import React, { useState } from 'react';

// ─── AI Output Sanitizer (mirrors Card01MarketReport.jsx) ───
const sanitizeAiOutput = (text) => {
  if (!text || typeof text !== 'string') return '';
  return text
    .replace(/\b_[a-zA-Z][a-zA-Z0-9_]*\b/g, '')
    .replace(/\[[^\]]*지시사항[^\]]*\]/g, '')
    .replace(/\[[^\]]*톤 지침[^\]]*\]/g, '')
    .replace(/\[[^\]]*필수 생성 규칙[^\]]*\]/g, '')
    .replace(/\[[^\]]*출력 금지 규칙[^\]]*\]/g, '')
    .replace(/\[[^\]]*현장 보정[^\]]*\]/g, '')
    .replace(/\|[-:]+\|[-:|\s]+/g, '')
    .replace(/^#{2,3}\s+.*$/gm, '')
    .replace(/buildCardPrompt/g, '')
    .replace(/AI_CHARACTER_PROMPT/g, '')
    .replace(/bruFeedback/g, '')
    .replace(/bruSummary/g, '')
    .replace(/\n{3,}/g, '\n\n')
    .replace(/\s{2,}/g, ' ')
    .trim();
};

/**
 * 반원형 게이지 (UnifiedLayout ChartGaugeMeter 인라인 복사)
 * 0~100 점수 → 색 그라디언트 + 바늘 + 중앙 숫자
 */
const ScoreGauge = ({ score = 0, label = '종합 점수' }) => {
  const s = Math.min(Math.max(score, 0), 100);
  const cx = 160, cy = 95, r = 70;
  const startAngle = Math.PI, endAngle = 2 * Math.PI;
  const totalAngle = endAngle - startAngle;
  const describeArc = (sA, eA) => {
    const x1 = cx + r * Math.cos(sA), y1 = cy + r * Math.sin(sA);
    const x2 = cx + r * Math.cos(eA), y2 = cy + r * Math.sin(eA);
    return `M ${x1},${y1} A ${r},${r} 0 ${(eA - sA) > Math.PI ? 1 : 0} 1 ${x2},${y2}`;
  };
  const needleAngle = startAngle + (s / 100) * totalAngle;
  const nx = cx + (r - 10) * Math.cos(needleAngle);
  const ny = cy + (r - 10) * Math.sin(needleAngle);
  // 점수 = 종합 점수 (높을수록 좋음): 80+ 초록, 65-79 파랑, 50-64 주황, 50미만 빨강
  const scoreColor = s >= 80 ? '#10B981' : s >= 65 ? '#3B82F6' : s >= 50 ? '#F59E0B' : '#EF4444';
  return (
    <svg width="100%" height="100%" viewBox="0 0 320 140" preserveAspectRatio="xMidYMid meet" style={{ overflow: 'visible' }}>
      <defs>
        <linearGradient id="card12ScoreGrad" x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stopColor="rgba(239,68,68,0.6)" />
          <stop offset="50%" stopColor="rgba(245,158,11,0.6)" />
          <stop offset="100%" stopColor="rgba(16,185,129,0.6)" />
        </linearGradient>
      </defs>
      <path d={describeArc(startAngle, endAngle)} fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth={14} strokeLinecap="round" />
      <path d={describeArc(startAngle, endAngle)} fill="none" stroke="url(#card12ScoreGrad)" strokeWidth={14} strokeLinecap="round" />
      <text x={cx - r - 5} y={cy + 16} textAnchor="middle" fill="#999" fontSize={10}>0</text>
      <text x={cx} y={cy - r + 2} textAnchor="middle" fill="#999" fontSize={10}>50</text>
      <text x={cx + r + 5} y={cy + 16} textAnchor="middle" fill="#999" fontSize={10}>100</text>
      <line x1={cx} y1={cy} x2={nx} y2={ny} stroke="#fff" strokeWidth={2} strokeLinecap="round" opacity={0.85} />
      <circle cx={cx} cy={cy} r={4} fill="#fff" opacity={0.7} />
      <text x={cx} y={cy + 30} textAnchor="middle" fill={scoreColor} fontSize={28} fontWeight={800} fontFamily="'Pretendard', sans-serif">{s}</text>
    </svg>
  );
};

/**
 * Card 12 - 상권 경쟁 분석 [2026-05-05 빈크래프트 5축 100점 점수 시스템]
 *
 * 5축 점수 (시장 20 + 경쟁 20 + 변화 15 + 생존 30 + 비용 15 = 100)
 * + 가산점 별도 칸
 * + 기준표 버튼 (영업자/고객 점수 이해용)
 *
 * 사장님이 마음에 들어한 게이지+숫자 UI 유지.
 */

const SCORE_BAR_COLORS = {
  market: '#3B82F6',    // 파랑 (시장)
  compete: '#F59E0B',   // 주황 (경쟁)
  change: '#10B981',    // 초록 (변화)
  survival: '#8B5CF6',  // 보라 (생존, 가장 큰 가중치)
  cost: '#EF4444',      // 빨강 (비용)
};

const AXIS_INFO = [
  { key: 'market', label: '시장 매력도', max: 20, color: SCORE_BAR_COLORS.market, fields: ['scoreMarket'] },
  { key: 'compete', label: '경쟁 환경', max: 20, color: SCORE_BAR_COLORS.compete, fields: ['scoreCompete'] },
  { key: 'change', label: '시장 변화', max: 15, color: SCORE_BAR_COLORS.change, fields: ['scoreChange'] },
  { key: 'survival', label: '생존 기반', max: 30, color: SCORE_BAR_COLORS.survival, fields: ['scoreSurvival'] },
  { key: 'cost', label: '비용 부담', max: 15, color: SCORE_BAR_COLORS.cost, fields: ['scoreCost'] },
];

const SCORE_GUIDE = [
  { axis: '시장 매력도', max: 20, desc: '잠재 고객, 동 평균 매출, 시장 규모, 객단가' },
  { axis: '경쟁 환경', max: 20, desc: '카페 밀도, 프랜차이즈 비율, 업종 다양성 (낮을수록 좋음)' },
  { axis: '시장 변화', max: 15, desc: '신규/폐업, 점포 추이, 매출 변동' },
  { axis: '생존 기반', max: 30, desc: '5년 이상 매장 비율, 평균 영업, 폐업률' },
  { axis: '비용 부담', max: 15, desc: '임차료 부담률, 영업이익률' },
];

// 점수 비율 → 한 단어 평가 + 색상 (의뢰인이 한 번에 이해)
// [2026-05-12] 점수/max 없으면 null 반환 → 호출자가 라벨 자체를 숨김
const evaluateScore = (score, max) => {
  if (max === 0 || score == null) return null;
  const pct = (score / max) * 100;
  if (pct >= 80) return { label: '매우 좋음', color: '#10B981' };
  if (pct >= 60) return { label: '좋음', color: '#3B82F6' };
  if (pct >= 40) return { label: '보통', color: '#F59E0B' };
  if (pct >= 20) return { label: '주의', color: '#F97316' };
  return { label: '매우 부족', color: '#EF4444' };
};

// 3년 생존 가능성 평가 (전국 평균 39% 기준)
// [2026-05-12] 데이터 없으면 null 반환 → 호출자가 라벨/배지 숨김
const evaluateSurvival = (pct, nationalAvg = 39) => {
  if (pct == null || pct === 0) return null;
  const ratio = pct / nationalAvg;
  if (ratio >= 1.5) return { label: '매우 안정', color: '#10B981' };
  if (ratio >= 1.2) return { label: '안정', color: '#3B82F6' };
  if (ratio >= 0.9) return { label: '평균', color: '#F59E0B' };
  if (ratio >= 0.6) return { label: '주의', color: '#F97316' };
  return { label: '위험', color: '#EF4444' };
};

const Card12CompetitionScore = ({ card, cardNumber = '12', kosisBoxData = null }) => {
  const [showGuide, setShowGuide] = useState(false);

  if (!card) return null;
  const body = card.bodyData || {};
  const dateLabel = card?.date || '';

  const totalScore = body.score || 0;
  const survival3yr = body.survival3yr || 0;
  const nationalAvg = body.nationalAvg || 39;
  const bonusItems = body.bonusItems || [];
  // [2026-05-06] 동 매출 vs 전국 카페 평균 백분위 점수
  const sp = body.salesPercentile || {};
  const spDongManwon = sp.dongCafeSalesManwon || 0;
  const spNatManwon = sp.nationalAvgManwon || 0;
  const spDiffPct = sp.diffPct || 0;
  const spPctile = sp.percentile || 0;
  const spLabel = sp.label || '';
  const spColor = spPctile >= 80 ? '#10B981' : spPctile >= 60 ? '#3B82F6' : spPctile >= 40 ? '#F59E0B' : spPctile >= 20 ? '#F97316' : '#EF4444';

  // 종합 점수 평가 + 3년 생존 가능성 평가
  const totalEval = evaluateScore(totalScore, 100) || { label: '산정 보류', color: '#666' };
  const survivalEval = evaluateSurvival(survival3yr, nationalAvg);
  const scoreColor = totalEval.color;

  return (
    <div style={{
      background: '#1A1F2C',
      border: '1px solid #2D3748',
      borderRadius: '1rem',
      overflow: 'hidden',
      boxShadow: '0 25px 50px -12px rgba(0,0,0,0.25)',
      color: '#E1E2EC',
      fontFamily: "'Inter', 'Noto Sans KR', sans-serif",
      width: '100%',
      position: 'relative',
    }}>
      {/* 헤더 */}
      <div style={{ padding: '24px', borderBottom: '1px solid #2D3748', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 8, marginBottom: 8 }}>
            <span style={{
              background: 'rgba(245,158,11,0.2)',
              color: '#F59E0B',
              fontSize: 12, fontWeight: 700,
              padding: '2px 8px',
              borderRadius: 4,
              letterSpacing: '0.05em',
            }}>{cardNumber} 상권 경쟁 분석</span>
            {dateLabel && <span style={{ fontSize: 13, color: '#C2C6D6' }}>{dateLabel}</span>}
          </div>
          <h2 style={{
            fontFamily: "'Manrope', sans-serif",
            fontSize: 24, lineHeight: '32px', fontWeight: 600,
            color: '#fff', margin: 0,
          }}>{card.subtitle || '상권 내 경쟁 수준'}</h2>
        </div>
        <button
          onClick={() => setShowGuide(true)}
          style={{
            background: 'rgba(59,130,246,0.15)',
            border: '1px solid rgba(59,130,246,0.4)',
            color: '#3B82F6',
            fontSize: 12, fontWeight: 600,
            padding: '6px 12px',
            borderRadius: 6,
            cursor: 'pointer',
            whiteSpace: 'nowrap',
          }}
        >
          기준표 보기
        </button>
      </div>

      {/* 종합 점수 게이지 + 3년 생존 가능성 */}
      <div style={{ padding: '24px', borderBottom: '1px solid #2D3748', display: 'grid', gridTemplateColumns: '1.4fr 1fr', gap: 16, alignItems: 'center' }}>
        <div style={{ background: '#1d2027', borderRadius: 12, padding: '12px 16px 20px', minHeight: 180, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
          <ScoreGauge score={totalScore} />
          <div style={{ marginTop: 4, fontSize: 12, color: '#999', fontWeight: 500 }}>종합 점수</div>
          <div style={{
            marginTop: 8,
            fontSize: 14, fontWeight: 700, color: '#fff',
            background: totalEval.color,
            padding: '5px 16px', borderRadius: 20,
            letterSpacing: '0.05em',
          }}>{totalEval.label}</div>
        </div>
        <div style={{ background: '#1d2027', borderRadius: 12, padding: 20, textAlign: 'center' }}>
          <div style={{ fontSize: 12, color: '#C2C6D6', marginBottom: 8, fontWeight: 600 }}>3년 생존 가능성</div>
          <div style={{ fontSize: 48, fontWeight: 800, color: survivalEval ? survivalEval.color : '#999', lineHeight: 1 }}>{survival3yr}<span style={{ fontSize: 20, color: '#666', fontWeight: 500 }}>%</span></div>
          <div style={{ fontSize: 11, color: '#999', marginTop: 4 }}>전국 평균 {nationalAvg}%</div>
          {survivalEval && (
            <div style={{
              display: 'inline-block', marginTop: 10,
              fontSize: 12, fontWeight: 700, color: '#fff',
              background: survivalEval.color,
              padding: '3px 12px', borderRadius: 20,
              letterSpacing: '0.05em',
            }}>{survivalEval.label}</div>
          )}
        </div>
      </div>

      {/* [2026-05-06] 매출 박스 - 동 카페 매출 vs 전국 평균 백분위 점수 */}
      {(spDongManwon > 0 || spNatManwon > 0) && (
        <div style={{ padding: '20px 24px', borderBottom: '1px solid #2D3748' }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: '#C2C6D6', marginBottom: 12, letterSpacing: '0.04em' }}>
            매출 점수 (전국 카페 평균 비교)
          </div>
          <div style={{ background: '#1d2027', borderRadius: 12, padding: '18px 20px', display: 'grid', gridTemplateColumns: '1.4fr 1fr', gap: 16, alignItems: 'center' }}>
            <div>
              <div style={{ fontSize: 11, color: '#999', marginBottom: 4, fontWeight: 600 }}>월평균 매출 (이 동 카페)</div>
              {spDongManwon > 0 && (
                <div style={{ fontSize: 30, fontWeight: 800, color: '#fff', lineHeight: 1 }}>
                  {spDongManwon.toLocaleString()}
                  <span style={{ fontSize: 14, color: '#666', fontWeight: 500, marginLeft: 4 }}>만원</span>
                </div>
              )}
              {spNatManwon > 0 && (
                <div style={{ fontSize: 11, color: '#C2C6D6', marginTop: 8, lineHeight: '16px' }}>
                  전국 평균 <span style={{ color: '#fff', fontWeight: 600 }}>{spNatManwon.toLocaleString()}만원</span> 대비
                  <span style={{ color: spDiffPct >= 0 ? '#10B981' : '#EF4444', fontWeight: 700, marginLeft: 4 }}>
                    {spDiffPct >= 0 ? '+' : ''}{spDiffPct}%
                  </span>
                  {spPctile > 0 && (
                    <span style={{ color: '#999', marginLeft: 8 }}>· 상위 {Math.max(1, 100 - spPctile)}%</span>
                  )}
                </div>
              )}
            </div>
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: 11, color: '#999', marginBottom: 6, fontWeight: 600 }}>매출 점수</div>
              <div style={{ fontSize: 36, fontWeight: 800, color: spColor, lineHeight: 1 }}>{spPctile}</div>
              {spLabel && (
                <div style={{
                  display: 'inline-block', marginTop: 8,
                  fontSize: 12, fontWeight: 700, color: '#fff',
                  background: spColor,
                  padding: '3px 12px', borderRadius: 20,
                  letterSpacing: '0.05em',
                }}>{spLabel}</div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* AI 한 줄 */}
      {card?.aiSummary && (
        <div style={{
          padding: '16px 24px',
          background: 'rgba(245,158,11,0.08)',
          borderBottom: '1px solid #2D3748',
        }}>
          <p style={{
            fontSize: 13, lineHeight: '20px',
            color: '#F59E0B', margin: 0,
            fontWeight: 500,
          }}>{card.aiSummary && sanitizeAiOutput(card.aiSummary)}</p>
        </div>
      )}

      {/* 5축 게이지 + 세부 항목 + 실제 수치 */}
      <div style={{ padding: '24px', borderBottom: '1px solid #2D3748' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 14 }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: '#C2C6D6', letterSpacing: '0.04em' }}>5축 분해</div>
          {body.scoreExternal && (
            <span style={{
              fontSize: 11, fontWeight: 600,
              color: '#10B981',
              background: 'rgba(16,185,129,0.12)',
              padding: '3px 10px', borderRadius: 12,
              letterSpacing: '0.02em',
            }}>외부 지표 반영</span>
          )}
        </div>
        {AXIS_INFO.map((axis) => {
          const score = body[axis.fields[0]] || 0;
          const pct = Math.round((score / axis.max) * 100);
          const details = body.scoreDetails?.[axis.key] || {};
          const raw = body._raw || {};
          const ext = body.scoreExternal?.[axis.key] || {};
          const baseScore = body.scoreBase?.[axis.key];

          // 축별 외부 지표 가산 라벨
          let extBadges = [];
          if (axis.key === 'market') {
            if (ext.weather > 0) extBadges.push({ label: '창업기상도', value: `+${ext.weather}` });
            if (ext.marketMap > 0) extBadges.push({ label: '활력+구매력', value: `+${ext.marketMap}` });
            if (ext.salesPercentile > 0) extBadges.push({ label: '매출 백분위', value: `+${ext.salesPercentile}` });
            if (ext.infra > 0) extBadges.push({ label: '잠재 고객 인프라', value: `+${ext.infra}` });
          } else if (axis.key === 'compete') {
            if (ext.operation > 0) extBadges.push({ label: '영업력', value: `+${ext.operation}` });
          } else if (axis.key === 'change') {
            if (ext.growth > 0) extBadges.push({ label: '성장성', value: `+${ext.growth}` });
            if (typeof ext.salesTrend === 'number' && ext.salesTrend !== 0) {
              extBadges.push({ label: '매출지수 추이', value: ext.salesTrend > 0 ? `+${ext.salesTrend}` : `${ext.salesTrend}` });
            }
          } else if (axis.key === 'survival') {
            if (ext.stability > 0) extBadges.push({ label: '안정성', value: `+${ext.stability}` });
          } else if (axis.key === 'cost') {
            if (typeof ext.laborMaterial === 'number' && ext.laborMaterial !== 0) {
              extBadges.push({ label: '인건비+식자재', value: ext.laborMaterial > 0 ? `+${ext.laborMaterial}` : `${ext.laborMaterial}` });
            }
          }

          // 축별 세부 항목 + 실제 수치 매핑
          // [2026-05-12] 0/0%/null/undefined 같은 빈 값은 raw에 '-' 넣어서 아래 .filter()가 제거
          const _hasNum = (v) => v != null && v !== 0 && v !== '0';
          let detailRows = [];
          if (axis.key === 'market') {
            detailRows = [
              { label: '카페당 잠재고객', score: details.potCust, max: 8, raw: _hasNum(raw.potCustPerCafe) ? `${raw.potCustPerCafe}명/카페` : '-' },
              { label: '동 평균 매출', score: details.avgSales, max: 6, raw: _hasNum(raw.bizmapPerStoreAvg) ? `${raw.bizmapPerStoreAvg.toLocaleString()}만원` : '-' },
              { label: '시장 규모', score: details.marketSize, max: 3, raw: _hasNum(raw.marketSizeBilManwon) ? `${raw.marketSizeBilManwon}억원` : '-' },
              { label: '결제단가', score: details.unitPrice, max: 3, raw: _hasNum(raw.bizmapPay) ? `${raw.bizmapPay.toLocaleString()}원` : '-' },
            ];
          } else if (axis.key === 'compete') {
            detailRows = [
              { label: '카페 밀도', score: details.density, max: 8, raw: _hasNum(body.cafePerKm2) ? `${body.cafePerKm2}개/km²` : '-' },
              { label: '프랜차이즈 비율', score: details.fcRatio, max: 7, raw: _hasNum(body.franchiseRatio) ? `${body.franchiseRatio}%` : '-' },
              { label: '업종 다양성', score: details.diversity, max: 5, raw: body.bizmapTopUpjongByStore ? `${body.bizmapTopUpjongByStore.split(',').length}개 업종` : '-' },
            ];
          } else if (axis.key === 'change') {
            // [2026-05-12] dataMapper에서 폴백 보장 - 빈 값 없이 항상 숫자
            const _open = body.recentOpen || 0;
            const _close = body.recentClose || 0;
            detailRows = [
              { label: '신규/폐업 비율', score: details.newClose, max: 5, raw: `신규 ${_open} / 폐업 ${_close}` },
              { label: '점포 6개월 추이', score: details.storeTrend, max: 5, raw: `${raw.storeTrendChangePct > 0 ? '+' : ''}${raw.storeTrendChangePct || 0}%` },
              { label: '매출 변동률', score: details.marketChange, max: 5, raw: _hasNum(raw.bmMarketChange) ? `${raw.bmMarketChange > 0 ? '+' : ''}${raw.bmMarketChange}%` : '-' },
            ];
          } else if (axis.key === 'survival') {
            detailRows = [
              { label: '5년 이상 매장', score: details.fiveYr, max: 12, raw: `${raw.fiveYrPct || 0}%` },
              { label: '평균 영업기간', score: details.avgYears, max: 12, raw: _hasNum(raw.avgYearsCompet) ? `${raw.avgYearsCompet}년` : '-' },
              { label: '동 폐업률', score: details.closure, max: 6, raw: `${raw.ldClosurePct || 0}%` },
              // [2026-05-06 추가 #3] 10년+ 장기 영업 매장 비율 (점수 표시 없음, 보조 정보)
              { label: '10년+ 장기 영업 매장', score: null, max: 0, raw: _hasNum(raw.tenYrPct) ? `${raw.tenYrPct}%` : '-' },
            ];
          } else if (axis.key === 'cost') {
            detailRows = [
              { label: '임차료 부담률', score: details.rent, max: 8, raw: _hasNum(raw.avgRentPct) ? `매출의 ${raw.avgRentPct}%` : '-' },
              { label: '영업이익률', score: details.opIncome, max: 7, raw: _hasNum(raw.bizmapOpIncome) ? `${raw.bizmapOpIncome}%` : '-' },
              // [2026-05-06 추가 #2] 인건비/식자재 비중 (점수는 가산 칩에서 처리)
              { label: '인건비 비중', score: null, max: 0, raw: _hasNum(raw.bizmapLaborPct) ? `${raw.bizmapLaborPct}%` : '-' },
              { label: '식자재 비중', score: null, max: 0, raw: _hasNum(raw.bizmapMaterialPct) ? `${raw.bizmapMaterialPct}%` : '-' },
            ];
          }

          const axisEval = evaluateScore(score, axis.max);
          const showBaseDelta = baseScore != null && score !== baseScore;
          const axisColor = axisEval ? axisEval.color : '#666';
          return (
            <div key={axis.key} style={{ marginBottom: 18 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 6 }}>
                <span style={{ fontSize: 14, color: '#fff', fontWeight: 600 }}>{axis.label}</span>
                <span style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  {axisEval && <span style={{ fontSize: 13, color: axisEval.color, fontWeight: 700 }}>{axisEval.label}</span>}
                  <span style={{ fontSize: 12, color: '#999', fontWeight: 500 }}>
                    {showBaseDelta && (
                      <span style={{ color: '#10B981', marginRight: 6 }}>(기본 {baseScore} {score > baseScore ? '+' : ''}{score - baseScore})</span>
                    )}
                    {score} / {axis.max}
                  </span>
                </span>
              </div>
              <div style={{ height: 6, background: '#1d2027', borderRadius: 3, overflow: 'hidden', marginBottom: 6 }}>
                <div style={{
                  height: '100%',
                  width: `${pct}%`,
                  background: axisColor,
                  borderRadius: 3,
                  transition: 'width 0.6s ease-out',
                }} />
              </div>
              {/* 외부 지표 가산 표시 (해당 축에 가산이 있을 때만) */}
              {extBadges.length > 0 && (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 6, paddingLeft: 2 }}>
                  {extBadges.map((b, bi) => (
                    <span key={bi} style={{
                      display: 'inline-flex', alignItems: 'center', gap: 4,
                      fontSize: 11, fontWeight: 600,
                      color: b.value.startsWith('-') ? '#F97316' : '#10B981',
                      background: b.value.startsWith('-') ? 'rgba(249,115,22,0.10)' : 'rgba(16,185,129,0.10)',
                      border: `1px solid ${b.value.startsWith('-') ? 'rgba(249,115,22,0.3)' : 'rgba(16,185,129,0.3)'}`,
                      padding: '2px 8px', borderRadius: 10,
                    }}>+ {b.label} {b.value}점</span>
                  ))}
                </div>
              )}
              {/* 세부 항목: 실제 수치 + 한 단어 평가 (텍스트 톤)
                  [2026-05-12] 가드 제거 - dataMapper가 빈 값을 안 만들도록 폴백 보장.
                  여기서는 detailRows를 그대로 노출. */}
              <div style={{ paddingLeft: 12, marginTop: 4 }}>
                {detailRows.map((row, idx) => {
                  const rEval = evaluateScore(row.score, row.max);
                  return (
                    <div key={idx} style={{
                      display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                      fontSize: 13,
                      padding: '4px 0',
                    }}>
                      <span style={{ color: '#999' }}>{row.label}</span>
                      <span style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                        <span style={{ color: '#E1E2EC', fontWeight: 500 }}>{row.raw}</span>
                        {rEval && (
                          <span style={{
                            fontSize: 12, fontWeight: 700,
                            color: rEval.color,
                            minWidth: 56, textAlign: 'right',
                          }}>{rEval.label}</span>
                        )}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>

      {/* 외부 지표 원본 박스 (창업기상도/상권지도/매출지수) */}
      {body.externalIndicators && (() => {
        const ei = body.externalIndicators;
        const hasAny = (ei.weatherScore > 0)
          || (Array.isArray(ei.marketMapScores) && ei.marketMapScores.length > 0)
          || (Array.isArray(ei.salesIndexMonthly) && ei.salesIndexMonthly.length > 0);
        if (!hasAny) return null;
        const trendDir = ei.salesTrendDirection || 0;
        const trendLabel = trendDir >= 2 ? '강한 상승' : trendDir === 1 ? '상승' : trendDir === 0 ? '보합' : trendDir === -1 ? '하락' : '강한 하락';
        const trendColor = trendDir > 0 ? '#10B981' : trendDir < 0 ? '#EF4444' : '#999';
        return (
          <div style={{ padding: '20px 24px', borderBottom: '1px solid #2D3748' }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: '#C2C6D6', marginBottom: 12, letterSpacing: '0.04em' }}>
              추가 반영 지표 (외부 데이터)
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10 }}>
              {/* 창업기상도 — 0~100 cap, 등급 라벨 */}
              <div style={{ background: '#1d2027', borderRadius: 12, padding: 14, textAlign: 'center' }}>
                <div style={{ fontSize: 11, color: '#999', marginBottom: 8, fontWeight: 600 }}>창업 기상도</div>
                {(() => {
                  const _ws = Math.min(100, Math.max(0, Math.round(ei.weatherScore || 0)));
                  const _gradeLbl = _ws >= 80 ? '매우 좋음' : _ws >= 60 ? '좋음' : _ws >= 40 ? '보통' : _ws >= 20 ? '주의' : '매우 부족';
                  const _gradeColor = _ws >= 80 ? '#10B981' : _ws >= 60 ? '#3B82F6' : _ws >= 40 ? '#F59E0B' : _ws >= 20 ? '#F97316' : '#EF4444';
                  return _ws > 0 ? (
                    <>
                      <div style={{ fontSize: 22, fontWeight: 800, color: '#fff', lineHeight: 1 }}>
                        {_ws}<span style={{ fontSize: 11, color: '#666', fontWeight: 500 }}>점</span>
                      </div>
                      <div style={{ fontSize: 11, color: '#F59E0B', marginTop: 4, fontWeight: 600 }}>{ei.weatherLabel || '-'}</div>
                      <div style={{ fontSize: 10, color: _gradeColor, marginTop: 2, fontWeight: 600 }}>{_gradeLbl}</div>
                    </>
                  ) : <div style={{ fontSize: 11, color: '#666' }}>정보 없음</div>;
                })()}
              </div>
              {/* 상권지도 5종 — 각 0~100 cap, 컬러 점수 */}
              <div style={{ background: '#1d2027', borderRadius: 12, padding: 14 }}>
                <div style={{ fontSize: 11, color: '#999', marginBottom: 8, fontWeight: 600, textAlign: 'center' }}>상권지도</div>
                {Array.isArray(ei.marketMapScores) && ei.marketMapScores.length > 0 ? (
                  ei.marketMapScores.slice(0, 5).map((s, i) => {
                    const _sc = Math.min(100, Math.max(0, Math.round(s.score || 0)));
                    const _scColor = _sc >= 80 ? '#10B981' : _sc >= 60 ? '#3B82F6' : _sc >= 40 ? '#F59E0B' : _sc >= 20 ? '#F97316' : '#EF4444';
                    return (
                      <div key={i} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, padding: '2px 0', color: '#C2C6D6' }}>
                        <span>{s.name}</span>
                        <span style={{ color: _scColor, fontWeight: 700 }}>{_sc}</span>
                      </div>
                    );
                  })
                ) : <div style={{ fontSize: 11, color: '#666', textAlign: 'center', padding: '14px 0' }}>정보 없음</div>}
              </div>
              {/* 매출지수 — 폴백 출처 표시, 정보 없을 때 사유 안내 */}
              <div style={{ background: '#1d2027', borderRadius: 12, padding: 14, textAlign: 'center' }}>
                <div style={{ fontSize: 11, color: '#999', marginBottom: 8, fontWeight: 600 }}>매출 지수 (6개월)</div>
                {Array.isArray(ei.salesIndexMonthly) && ei.salesIndexMonthly.length > 0 ? (
                  <>
                    <div style={{ fontSize: 22, fontWeight: 800, color: '#8B5CF6', lineHeight: 1 }}>
                      {Math.round(((ei.salesIndexMonthly[ei.salesIndexMonthly.length - 1]?.index) || 0) * 10) / 10}
                    </div>
                    <div style={{ fontSize: 10, color: '#999', marginTop: 4 }}>
                      최근 {ei.salesIndexMonthly.length}개월
                      {ei.salesIndexSource === 'nbmStats' ? ' (비즈맵)'
                        : ei.salesIndexSource === 'firebase' ? ' (자체)'
                        : ei.salesIndexSource === 'slsIndex' ? '' : ''}
                    </div>
                    <div style={{ fontSize: 11, color: trendColor, marginTop: 4, fontWeight: 600 }}>{trendLabel}</div>
                  </>
                ) : (
                  <div>
                    <div style={{ fontSize: 11, color: '#666' }}>정보 없음</div>
                    <div style={{ fontSize: 9, color: '#555', marginTop: 6, lineHeight: '12px', padding: '0 4px' }}>
                      소상공인365 매출지수 응답 지연. 비즈맵·자체 데이터로 보완 중.
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        );
      })()}

      {/* 가산점 별도 칸 */}
      {bonusItems.length > 0 && (
        <div style={{ padding: '24px', borderBottom: '1px solid #2D3748' }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: '#C2C6D6', marginBottom: 14, letterSpacing: '0.04em' }}>
            가산점 (점수 외 참고 정보)
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {bonusItems.map((item, i) => (
              <div key={i} style={{
                display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                background: '#1d2027',
                border: '1px solid #2D3748',
                borderLeft: '3px solid #10B981',
                borderRadius: '0.5rem',
                padding: '10px 14px',
              }}>
                <span style={{ fontSize: 12, color: '#C2C6D6', fontWeight: 500 }}>{item.label}</span>
                <span style={{ fontSize: 13, color: '#fff', fontWeight: 600, textAlign: 'right' }}>{item.value}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 추가 참고 정보 (5축 + 가산점에 없는 항목) */}
      {(body.level || body.dongDensity || body.bizmapTopUpjongByStore || body.avgLifespan || body.recentOpen || body.recentClose) && (
        <div style={{ padding: '20px 24px' }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: '#C2C6D6', marginBottom: 12, letterSpacing: '0.04em' }}>참고 정보</div>
          {[
            { label: '경쟁 수준', value: body.level },
            { label: '동 내 밀집도', value: body.dongDensity },
            { label: '평균 업력', value: body.avgLifespan },
            { label: '안정 매장 비율 (3년+)', value: body.stableStoreRate },
            // [2026-05-12] body.recentOpen/Close는 숫자 - 단위 "개" 추가
            { label: '최근 개업', value: typeof body.recentOpen === 'number' && body.recentOpen > 0 ? `${body.recentOpen}개` : body.recentOpen },
            { label: '최근 폐업', value: typeof body.recentClose === 'number' && body.recentClose > 0 ? `${body.recentClose}개` : body.recentClose },
            { label: '동 매출 비중 TOP 5 업종', value: body.bizmapTopUpjongByStore },
          ].filter(r => r.value && r.value !== '-').map((row, i, arr) => (
            <div key={i} style={{
              display: 'flex', justifyContent: 'space-between',
              padding: '8px 0',
              borderBottom: i < arr.length - 1 ? '1px solid rgba(45,55,72,0.5)' : 'none',
              fontSize: 13,
              gap: 16,
            }}>
              <span style={{ color: '#999', flexShrink: 0 }}>{row.label}</span>
              <span style={{ color: '#fff', fontWeight: 500, textAlign: 'right', wordBreak: 'keep-all' }}>{row.value}</span>
            </div>
          ))}
        </div>
      )}

      {/* 국세청 카페 폐업 신호 박스 */}
      {kosisBoxData?.cafeClosure && (() => {
        const cc = kosisBoxData.cafeClosure;
        const ccNation = kosisBoxData.cafeClosureNation;
        const region = kosisBoxData.sido || cc.region || '전국';
        const periodTxt = cc.period || '';
        const periodLabel = /^\d{4}$/.test(periodTxt) ? `${periodTxt}년` : periodTxt;
        // 비교: 지역값 / 전국값 × 100 (둘 다 있을 때)
        let ratio = null;
        if (ccNation && ccNation.value && cc.value && cc.scope !== ccNation.scope) {
          ratio = Math.round((cc.value / ccNation.value) * 100);
        }
        return (
          <div style={{ padding: '20px 24px', borderTop: '1px solid #2D3748' }}>
            <div style={{
              background: 'rgba(239, 68, 68, 0.06)',
              border: '1px solid rgba(239, 68, 68, 0.4)',
              borderRadius: 12,
              padding: '18px 20px',
              display: 'flex', flexDirection: 'column', gap: 8,
            }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: '#fff', letterSpacing: '-0.01em' }}>
                지난 해 {region} 카페 폐업 신호
              </div>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginTop: 4 }}>
                <span style={{ fontSize: 32, fontWeight: 700, color: '#EF4444', lineHeight: 1.1 }}>
                  {cc.value.toLocaleString('ko-KR')}
                </span>
                <span style={{ fontSize: 14, color: '#C2C6D6' }}>개 카페 폐업</span>
              </div>
              {ratio != null && (
                <div style={{ fontSize: 12, color: '#C2C6D6', marginTop: 2 }}>
                  전국 평균 대비 <span style={{ color: '#fff', fontWeight: 600 }}>{ratio}%</span>
                </div>
              )}
              <div style={{ fontSize: 11, color: '#999', marginTop: 6, textAlign: 'right' }}>
                국세청 100대 생활밀접업종 (커피음료점) · {periodLabel}
              </div>
            </div>
          </div>
        );
      })()}

      {/* 기준표 모달 */}
      {showGuide && (
        <div
          onClick={() => setShowGuide(false)}
          style={{
            position: 'fixed', inset: 0,
            background: 'rgba(0,0,0,0.7)',
            zIndex: 9999,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            padding: 16,
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              background: '#1A1F2C',
              border: '1px solid #2D3748',
              borderRadius: 12,
              maxWidth: 560, width: '100%',
              maxHeight: '85vh', overflow: 'auto',
              padding: 24,
              color: '#E1E2EC',
              fontFamily: "'Inter', 'Noto Sans KR', sans-serif",
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
              <h3 style={{ fontSize: 18, fontWeight: 700, margin: 0, color: '#fff' }}>빈크래프트 점수 기준표</h3>
              <button
                onClick={() => setShowGuide(false)}
                style={{
                  background: 'transparent',
                  border: '1px solid #555',
                  color: '#fff',
                  fontSize: 12, fontWeight: 600,
                  padding: '4px 10px',
                  borderRadius: 6,
                  cursor: 'pointer',
                }}
              >닫기</button>
            </div>
            <div style={{ fontSize: 12, color: '#C2C6D6', marginBottom: 20, lineHeight: 1.5 }}>
              5개 축의 점수를 합산해 100점 만점으로 평가합니다.
            </div>
            {SCORE_GUIDE.map((item) => (
              <div key={item.axis} style={{
                display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start',
                padding: '12px 0',
                borderBottom: '1px solid #2D3748',
              }}>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 14, fontWeight: 700, color: '#fff', marginBottom: 4 }}>{item.axis}</div>
                  <div style={{ fontSize: 12, color: '#999', lineHeight: 1.4 }}>{item.desc}</div>
                </div>
                <div style={{
                  fontSize: 13, fontWeight: 700, color: '#3B82F6',
                  marginLeft: 12, whiteSpace: 'nowrap',
                }}>{item.max}점</div>
              </div>
            ))}
            <div style={{
              marginTop: 20,
              padding: 12,
              background: 'rgba(139,92,246,0.1)',
              border: '1px solid rgba(139,92,246,0.3)',
              borderRadius: 8,
              fontSize: 12,
              color: '#C2C6D6',
              lineHeight: 1.5,
            }}>
              <strong style={{ color: '#8B5CF6' }}>3년 생존 가능성</strong>은 5년 이상 매장 비율, 평균 영업기간, 동 폐업률을 가중 평균해 산출합니다.
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Card12CompetitionScore;
