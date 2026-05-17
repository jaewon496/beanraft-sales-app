import React, { useState } from 'react';

/**
 * Card 9 - 배달 객단가 (2026-05-02 전면 재설계)
 *
 * 메인: 검색 동 객단가 1개 고정 표시
 * 주변 동네: 접힘/펼침 토글 (default 접힘), 펼치면 가나다 순
 * + 배달 핫플레이스 풍부 데이터 (요일별/월별/성별/연령별/단골/라이프스타일/업종순위/연소득)
 *
 * 데이터 소스:
 * - 소상공인365 delivery API : 행정동별 객단가 (메인 + 주변 동네)
 * - 소상공인365 deliveryHotplace API : 그 외 모든 배달 인사이트
 */

const COLORS = {
  bg: '#1A1F2C',
  border: '#2D3748',
  text: '#E1E2EC',
  textSub: '#C2C6D6',
  textMuted: '#8B92A7',
  divider: '#4A5568',
  accent: '#10B981',
  male: '#3B82F6',
  female: '#EC4899',
  warning: '#F59E0B',
  cardBg: '#1d2027',
};

const formatWon = (n) => {
  const v = Number(n) || 0;
  return v.toLocaleString();
};

const formatKMan = (won) => {
  const v = Number(won) || 0;
  if (v >= 10000) {
    const man = Math.round(v / 10000);
    return `${man.toLocaleString()}만원`;
  }
  return `${v.toLocaleString()}원`;
};

// 시점 라벨 정규화: "202602", "2026-02", "2026년 02월", "2026년 2월 기준" 등
// → "2026년 2월" 형식으로 통일 (이미 "기준" 포함 시 제거)
const formatPeriod = (raw) => {
  if (!raw) return '';
  let s = String(raw).trim();
  // "기준" 단어 제거
  s = s.replace(/\s*기준\s*$/, '').trim();
  // YYYYMM 형식
  let m = s.match(/^(\d{4})[-./]?(\d{1,2})$/);
  if (m) {
    return `${m[1]}년 ${parseInt(m[2], 10)}월`;
  }
  // "YYYY년 MM월" 형식 (앞자리 0 제거)
  m = s.match(/^(\d{4})년\s*(\d{1,2})월$/);
  if (m) {
    return `${m[1]}년 ${parseInt(m[2], 10)}월`;
  }
  return s;
};

const SectionTitle = ({ children }) => (
  <div style={{
    fontSize: 12,
    fontWeight: 700,
    color: COLORS.textMuted,
    letterSpacing: '0.05em',
    textTransform: 'uppercase',
    marginBottom: 12,
  }}>{children}</div>
);

const SectionWrap = ({ children }) => (
  <div style={{ padding: '20px 24px', borderTop: `1px solid ${COLORS.border}` }}>{children}</div>
);

const Card9DeliveryAvgPrice = ({ card }) => {
  const [showNearby, setShowNearby] = useState(false);

  if (!card) return null;
  const body = card?.bodyData || {};
  const searchDongName = body.searchDongName || '';
  const searchAvgPrice = Number(body.searchAvgPrice) || 0;
  const searchSales = Number(body.searchSales) || 0;
  const searchOrders = Number(body.searchOrders) || 0;
  const nearbyDongs = Array.isArray(body.nearbyDongs) ? body.nearbyDongs : [];
  const weekdaySales = Array.isArray(body.weekdaySales) ? body.weekdaySales : [];
  const monthlyTrend = Array.isArray(body.monthlyTrend) ? body.monthlyTrend : [];
  const cafeRankInDelivery = Number(body.cafeRankInDelivery) || 0;
  const totalDeliveryBiz = Number(body.totalDeliveryBiz) || 0;
  const deliveryTrend = body.deliveryTrend || null;
  const kosisDelivery = body.kosisDelivery || null;
  const dateLabel = card?.date || '';

  const hasMain = searchAvgPrice > 0 && searchDongName;

  // [2026-05-12] 검색 동 데이터 없을 때 주변 동 평균을 메인으로 자동 승격
  let displayDongName = searchDongName;
  let displayAvgPrice = searchAvgPrice;
  let displaySales = searchSales;
  let displayOrders = searchOrders;
  let usingNearbyFallback = false;
  if (!hasMain && nearbyDongs.length > 0) {
    const validNearby = nearbyDongs.filter(d => Number(d.avgPrice) > 0);
    if (validNearby.length > 0) {
      const avg = Math.round(validNearby.reduce((s, d) => s + Number(d.avgPrice), 0) / validNearby.length);
      const salesAvg = Math.round(validNearby.reduce((s, d) => s + (Number(d.sales) || 0), 0) / validNearby.length);
      const ordersAvg = Math.round(validNearby.reduce((s, d) => s + (Number(d.orders) || 0), 0) / validNearby.length);
      displayDongName = `인근 ${validNearby.length}개 동 평균`;
      displayAvgPrice = avg;
      displaySales = salesAvg;
      displayOrders = ordersAvg;
      usingNearbyFallback = true;
    }
  }
  const showMain = hasMain || usingNearbyFallback;

  const weekdayMax = weekdaySales.reduce((m, w) => Math.max(m, w.amount || 0), 0);
  const monthlyMax = monthlyTrend.reduce((m, w) => Math.max(m, w.value || 0), 0);

  return (
    <div style={{
      background: COLORS.bg,
      border: `1px solid ${COLORS.border}`,
      borderRadius: '1rem',
      overflow: 'hidden',
      boxShadow: '0 25px 50px -12px rgba(0,0,0,0.25)',
      color: COLORS.text,
      fontFamily: "'Inter', 'Noto Sans KR', sans-serif",
      width: '100%',
    }}>
      {/* 헤더 */}
      <div style={{ padding: '24px', borderBottom: `1px solid ${COLORS.border}` }}>
        <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 8, marginBottom: 8 }}>
          <span style={{
            background: 'rgba(16,185,129,0.2)',
            color: COLORS.accent,
            fontSize: 12, fontWeight: 700,
            padding: '2px 8px',
            borderRadius: 4,
            letterSpacing: '0.05em',
          }}>09 배달 객단가</span>
          {dateLabel && <span style={{ fontSize: 13, color: COLORS.textSub }}>{dateLabel}</span>}
        </div>
        <h2 style={{
          fontFamily: "'Manrope', sans-serif",
          fontSize: 24, lineHeight: '32px', fontWeight: 600,
          color: '#fff', margin: 0,
        }}>이 동네 배달 객단가</h2>
      </div>

      {!showMain ? null : (
        <>
          {/* 메인 블록: 검색 동 객단가 (고정) */}
          <div style={{
            padding: '24px',
            background: 'rgba(16,185,129,0.06)',
          }}>
            <div style={{
              fontSize: 13,
              color: COLORS.textSub,
              marginBottom: 6,
              fontWeight: 500,
            }}>{displayDongName}</div>
            <div style={{
              fontSize: 36,
              lineHeight: '44px',
              fontWeight: 700,
              color: COLORS.accent,
              marginBottom: 8,
              letterSpacing: '-0.02em',
            }}>{formatWon(displayAvgPrice)}<span style={{ fontSize: 20, color: COLORS.accent, marginLeft: 4 }}>원</span></div>
            <div style={{
              fontSize: 12,
              color: COLORS.textMuted,
              display: 'flex',
              gap: 12,
              flexWrap: 'wrap',
            }}>
              {displaySales > 0 && <span>월매출 {formatKMan(displaySales)}</span>}
              {displaySales > 0 && displayOrders > 0 && <span style={{ color: COLORS.divider }}>·</span>}
              {displayOrders > 0 && <span>월 {displayOrders.toLocaleString()}건</span>}
            </div>
            {usingNearbyFallback && (
              <div style={{
                fontSize: 11,
                color: COLORS.textMuted,
                marginTop: 10,
                lineHeight: 1.5,
              }}>이 동은 배달 표본이 적습니다. 인근 동 평균으로 보여드립니다.</div>
            )}
          </div>

          {/* 주변 동네 객단가 (접힘/펼침 토글) */}
          {nearbyDongs.length > 0 && (
            <SectionWrap>
              <button
                type="button"
                onClick={() => setShowNearby(v => !v)}
                style={{
                  background: 'transparent',
                  border: 'none',
                  width: '100%',
                  padding: 0,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  cursor: 'pointer',
                  color: COLORS.text,
                  fontFamily: 'inherit',
                  marginBottom: showNearby ? 12 : 0,
                }}
              >
                <span style={{
                  fontSize: 12,
                  fontWeight: 700,
                  color: COLORS.textMuted,
                  letterSpacing: '0.05em',
                  textTransform: 'uppercase',
                }}>주변 동네 객단가 ({nearbyDongs.length}곳)</span>
                <span style={{
                  fontSize: 12,
                  color: COLORS.textMuted,
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 4,
                }}>
                  <span>{showNearby ? '펼침' : '접힘'}</span>
                  <span style={{
                    display: 'inline-block',
                    transform: showNearby ? 'rotate(90deg)' : 'rotate(0deg)',
                    transition: 'transform 0.2s',
                    fontSize: 14,
                  }}>▶</span>
                </span>
              </button>

              {showNearby && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {nearbyDongs.map((d, i) => (
                    <div key={i} style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      padding: '10px 12px',
                      background: COLORS.cardBg,
                      border: `1px solid ${COLORS.border}`,
                      borderRadius: '0.5rem',
                    }}>
                      <span style={{
                        fontSize: 14,
                        color: COLORS.text,
                        fontWeight: 500,
                      }}>{d.name}</span>
                      <span style={{
                        fontSize: 14,
                        color: '#fff',
                        fontWeight: 600,
                        fontVariantNumeric: 'tabular-nums',
                      }}>{formatWon(d.avgPrice)}<span style={{ fontSize: 11, color: COLORS.textMuted, marginLeft: 2 }}>원</span></span>
                    </div>
                  ))}
                </div>
              )}
            </SectionWrap>
          )}

          {/* [신규] 배달 시장 추세 (전월 대비 주문건수/매출액 증감률) */}
          {deliveryTrend && (deliveryTrend.ordersChange != null || deliveryTrend.salesChange != null) && (
            <SectionWrap>
              <SectionTitle>배달 시장 추세 (전월 대비)</SectionTitle>
              <div style={{ display: 'flex', gap: 10 }}>
                {deliveryTrend.ordersChange != null && (() => {
                  const v = Number(deliveryTrend.ordersChange);
                  const isUp = v > 0;
                  const isDown = v < 0;
                  const color = isUp ? COLORS.accent : isDown ? '#EF4444' : COLORS.textMuted;
                  const arrow = isUp ? '▲' : isDown ? '▼' : '·';
                  return (
                    <div style={{
                      flex: 1,
                      background: COLORS.cardBg,
                      border: `1px solid ${COLORS.border}`,
                      borderRadius: '0.75rem',
                      padding: '14px 16px',
                      textAlign: 'center',
                    }}>
                      <div style={{ fontSize: 12, color: COLORS.textSub, marginBottom: 6 }}>주문 건수</div>
                      <div style={{
                        fontSize: 24,
                        fontWeight: 800,
                        color,
                        letterSpacing: '-0.02em',
                        fontVariantNumeric: 'tabular-nums',
                      }}>
                        <span style={{ fontSize: 16, marginRight: 4 }}>{arrow}</span>
                        {Math.abs(v).toFixed(1)}<span style={{ fontSize: 16, marginLeft: 2 }}>%</span>
                      </div>
                    </div>
                  );
                })()}
                {deliveryTrend.salesChange != null && (() => {
                  const v = Number(deliveryTrend.salesChange);
                  const isUp = v > 0;
                  const isDown = v < 0;
                  const color = isUp ? COLORS.accent : isDown ? '#EF4444' : COLORS.textMuted;
                  const arrow = isUp ? '▲' : isDown ? '▼' : '·';
                  return (
                    <div style={{
                      flex: 1,
                      background: COLORS.cardBg,
                      border: `1px solid ${COLORS.border}`,
                      borderRadius: '0.75rem',
                      padding: '14px 16px',
                      textAlign: 'center',
                    }}>
                      <div style={{ fontSize: 12, color: COLORS.textSub, marginBottom: 6 }}>매출액</div>
                      <div style={{
                        fontSize: 24,
                        fontWeight: 800,
                        color,
                        letterSpacing: '-0.02em',
                        fontVariantNumeric: 'tabular-nums',
                      }}>
                        <span style={{ fontSize: 16, marginRight: 4 }}>{arrow}</span>
                        {Math.abs(v).toFixed(1)}<span style={{ fontSize: 16, marginLeft: 2 }}>%</span>
                      </div>
                    </div>
                  );
                })()}
              </div>
              {deliveryTrend.period && (() => {
                const trendPeriod = formatPeriod(deliveryTrend.period);
                return trendPeriod ? (
                  <div style={{
                    fontSize: 11,
                    color: COLORS.textMuted,
                    textAlign: 'right',
                    marginTop: 8,
                  }}>{trendPeriod} 기준</div>
                ) : null;
              })()}
            </SectionWrap>
          )}

          {/* 배달 시장에서 카페 위치 (카페 창업 의뢰인 관점 단순화) */}
          {cafeRankInDelivery > 0 && (
            <SectionWrap>
              <SectionTitle>배달 시장에서 카페 위치</SectionTitle>
              <div style={{
                background: COLORS.cardBg,
                border: `1px solid ${COLORS.border}`,
                borderRadius: '0.75rem',
                padding: '18px 20px',
                textAlign: 'center',
              }}>
                <div style={{
                  fontSize: 13,
                  color: COLORS.textSub,
                  marginBottom: 6,
                }}>이 동네 배달 매출</div>
                <div style={{
                  fontSize: 40,
                  lineHeight: '48px',
                  fontWeight: 800,
                  color: COLORS.accent,
                  letterSpacing: '-0.02em',
                  marginBottom: 8,
                }}>{cafeRankInDelivery}위</div>
                {totalDeliveryBiz > 0 && (
                  <div style={{
                    fontSize: 12,
                    color: COLORS.textMuted,
                  }}>전체 {totalDeliveryBiz}개 업종 중</div>
                )}
              </div>
            </SectionWrap>
          )}

          {/* 요일별 배달 주문건수 */}
          {weekdaySales.length > 0 && (
            <SectionWrap>
              <SectionTitle>요일별 배달 주문건수</SectionTitle>
              <div style={{ display: 'flex', gap: 6, alignItems: 'flex-end' }}>
                {weekdaySales.map((w, i) => {
                  const pct = weekdayMax > 0 ? Math.max(15, Math.round((w.amount / weekdayMax) * 100)) : 0;
                  const isTop = w.isTop;
                  return (
                    <div key={i} style={{ flex: 1, textAlign: 'center' }}>
                      <div style={{
                        fontSize: 10,
                        color: isTop ? COLORS.accent : COLORS.textSub,
                        fontWeight: isTop ? 700 : 500,
                        fontVariantNumeric: 'tabular-nums',
                        marginBottom: 4,
                        whiteSpace: 'nowrap',
                      }}>{Math.round(w.amount).toLocaleString()}</div>
                      <div style={{ height: 80, display: 'flex', alignItems: 'flex-end', justifyContent: 'center' }}>
                        <div style={{
                          width: '70%',
                          height: `${pct}%`,
                          borderRadius: '4px 4px 0 0',
                          background: isTop ? COLORS.accent : 'rgba(16,185,129,0.3)',
                          transition: 'height 0.5s',
                        }} />
                      </div>
                      <div style={{
                        fontSize: 11,
                        color: isTop ? COLORS.accent : COLORS.textMuted,
                        fontWeight: isTop ? 700 : 500,
                        marginTop: 4,
                      }}>{w.day}</div>
                    </div>
                  );
                })}
              </div>
              <div style={{
                fontSize: 10,
                color: COLORS.textMuted,
                textAlign: 'right',
                marginTop: 6,
              }}>단위: 건</div>
            </SectionWrap>
          )}

          {/* [KOSIS 외식업체경영실태조사] 전국 카페 배달 운영 현실 */}
          {kosisDelivery && (kosisDelivery.app || kosisDelivery.agency) && (() => {
            const noUsePct = Math.round(kosisDelivery.overallNoUsePct || 0);
            const usePct = Math.round(kosisDelivery.overallUsePct || 0);
            const app = kosisDelivery.app || {};
            const agency = kosisDelivery.agency || {};
            const appHigh = (app.distribution || []).find(d => /이상/.test(d.range))?.pct || 0;
            const appMid = (app.distribution || []).find(d => /15만/.test(d.range))?.pct || 0;
            const agencyHigh = (agency.distribution || []).find(d => /이상/.test(d.range))?.pct || 0;
            const both = kosisDelivery.bothMonthlyManwon || 0;
            const salesAvgManwon = kosisDelivery.salesAvg || 0;
            const burdenPct = (both > 0 && salesAvgManwon > 0)
              ? Math.round((both / salesAvgManwon) * 100)
              : 0;
            const yearLabel = kosisDelivery.year ? `${kosisDelivery.year} ` : '';
            return (
              <SectionWrap>
                <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginBottom: 6 }}>
                  <span style={{ fontSize: 13, fontWeight: 700, color: COLORS.warning }}>전국 카페 배달 현실</span>
                  <span style={{ fontSize: 11, color: COLORS.textMuted }}>통계청 외식업체경영실태조사 {yearLabel}</span>
                </div>
                <div style={{ fontSize: 13, color: COLORS.text, marginBottom: 14, lineHeight: 1.5 }}>
                  10곳 중 7곳은 배달 안 함, 하는 3곳도 비용 부담 큼
                </div>

                {/* 사용 안 함 / 사용 함 막대 */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 16 }}>
                  <div style={{ display: 'grid', gridTemplateColumns: '110px 1fr 50px', alignItems: 'center', gap: 10 }}>
                    <span style={{ fontSize: 12, color: COLORS.textSub }}>안 하는 카페</span>
                    <div style={{ height: 22, background: 'rgba(255,255,255,0.05)', borderRadius: 6, overflow: 'hidden' }}>
                      <div style={{ width: `${noUsePct}%`, height: '100%', background: 'rgba(255,255,255,0.25)' }} />
                    </div>
                    <span style={{ fontSize: 13, fontWeight: 700, color: '#fff', textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>{noUsePct}%</span>
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '110px 1fr 50px', alignItems: 'center', gap: 10 }}>
                    <span style={{ fontSize: 12, color: COLORS.warning }}>하는 카페</span>
                    <div style={{ height: 22, background: 'rgba(255,255,255,0.05)', borderRadius: 6, overflow: 'hidden' }}>
                      <div style={{ width: `${usePct}%`, height: '100%', background: 'linear-gradient(90deg, #F59E0B, #FBBF24)' }} />
                    </div>
                    <span style={{ fontSize: 13, fontWeight: 700, color: COLORS.warning, textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>{usePct}%</span>
                  </div>
                </div>

                {/* 구분선 + 소제목 */}
                <div style={{ borderTop: `1px solid ${COLORS.border}`, paddingTop: 14, marginBottom: 12 }}>
                  <div style={{ fontSize: 12, fontWeight: 700, color: COLORS.textMuted, letterSpacing: '0.05em', textTransform: 'uppercase' }}>
                    배달 하기로 했다면, 매달 얼마 들까?
                  </div>
                </div>

                {/* 배달앱 vs 배달대행 박스 */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                  {/* 배달앱 */}
                  <div style={{
                    background: COLORS.cardBg,
                    border: `1px solid ${COLORS.border}`,
                    borderRadius: 10,
                    padding: '14px 14px',
                  }}>
                    <div style={{ fontSize: 12, color: COLORS.textSub, fontWeight: 600, marginBottom: 4 }}>배민·쿠팡이츠</div>
                    <div style={{ fontSize: 10, color: COLORS.textMuted, marginBottom: 10 }}>(앱 입점)</div>
                    <div style={{ fontSize: 11, color: COLORS.textMuted, marginBottom: 2 }}>평균</div>
                    <div style={{ fontSize: 22, fontWeight: 800, color: '#fff', letterSpacing: '-0.02em', marginBottom: 8 }}>
                      {app.avgManwon || 0}<span style={{ fontSize: 12, color: COLORS.textMuted, marginLeft: 2 }}>만원</span>
                    </div>
                    <div style={{ fontSize: 11, color: COLORS.textSub, lineHeight: 1.5, marginBottom: 8 }}>
                      절반은 15~50만원대,<br />
                      <span style={{ color: COLORS.accent, fontWeight: 600 }}>{Math.round(appHigh)}%</span>만 50만 넘음
                    </div>
                    <div style={{
                      fontSize: 11, color: COLORS.accent,
                      padding: '6px 8px', background: 'rgba(16,185,129,0.08)',
                      borderRadius: 6, lineHeight: 1.4,
                    }}>
                      주문 들어온 만큼만 나가는 구조
                    </div>
                  </div>

                  {/* 배달대행 */}
                  <div style={{
                    background: COLORS.cardBg,
                    border: `1px solid ${COLORS.warning}33`,
                    borderRadius: 10,
                    padding: '14px 14px',
                  }}>
                    <div style={{ fontSize: 12, color: COLORS.textSub, fontWeight: 600, marginBottom: 4 }}>바로고·부릉</div>
                    <div style={{ fontSize: 10, color: COLORS.textMuted, marginBottom: 10 }}>(라이더 외주)</div>
                    <div style={{ fontSize: 11, color: COLORS.textMuted, marginBottom: 2 }}>평균</div>
                    <div style={{ fontSize: 22, fontWeight: 800, color: COLORS.warning, letterSpacing: '-0.02em', marginBottom: 8 }}>
                      {agency.avgManwon || 0}<span style={{ fontSize: 12, color: COLORS.textMuted, marginLeft: 2 }}>만원</span>
                      {(app.avgManwon > 0 && agency.avgManwon > 0) && (
                        <span style={{ fontSize: 11, color: COLORS.warning, marginLeft: 6, fontWeight: 600 }}>
                          {(agency.avgManwon / app.avgManwon).toFixed(1)}배
                        </span>
                      )}
                    </div>
                    <div style={{ fontSize: 11, color: COLORS.textSub, lineHeight: 1.5, marginBottom: 8 }}>
                      <span style={{ color: COLORS.warning, fontWeight: 600 }}>{Math.round(agencyHigh)}%</span>가 월 50만+
                    </div>
                    <div style={{
                      fontSize: 11, color: COLORS.warning,
                      padding: '6px 8px', background: 'rgba(245,158,11,0.08)',
                      borderRadius: 6, lineHeight: 1.4,
                    }}>
                      한 건 보낼 때마다<br />수수료가 빠지는 구조
                    </div>
                  </div>
                </div>

                {/* 합계 박스 */}
                {both > 0 && (
                  <div style={{
                    marginTop: 14,
                    padding: '14px 16px',
                    background: 'rgba(245,158,11,0.06)',
                    border: `1px solid ${COLORS.warning}33`,
                    borderRadius: 10,
                  }}>
                    <div style={{ fontSize: 12, color: COLORS.textSub, marginBottom: 4 }}>둘 다 쓰면 매달</div>
                    <div style={{ fontSize: 24, fontWeight: 800, color: '#fff', letterSpacing: '-0.02em' }}>
                      {both.toLocaleString()}<span style={{ fontSize: 13, color: COLORS.textMuted, marginLeft: 4 }}>만원 부담</span>
                    </div>
                    {burdenPct > 0 && salesAvgManwon > 0 && (
                      <div style={{ fontSize: 11, color: COLORS.textMuted, marginTop: 6 }}>
                        전국 카페 평균 매출({salesAvgManwon.toLocaleString()}만원) 기준 매출의 약 <span style={{ color: COLORS.warning, fontWeight: 700 }}>{burdenPct}%</span>
                      </div>
                    )}
                  </div>
                )}
              </SectionWrap>
            );
          })()}

          {/* 월별 배달 주문건수 추이 */}
          {monthlyTrend.length > 0 && (
            <SectionWrap>
              <SectionTitle>월별 배달 주문건수 추이</SectionTitle>
              <div style={{ display: 'flex', gap: 4, alignItems: 'flex-end' }}>
                {monthlyTrend.map((m, i) => {
                  const pct = monthlyMax > 0 ? Math.max(10, Math.round((m.value / monthlyMax) * 100)) : 0;
                  const isMax = m.value === monthlyMax && monthlyMax > 0;
                  return (
                    <div key={i} style={{ flex: 1, textAlign: 'center' }}>
                      <div style={{
                        fontSize: 9,
                        color: isMax ? COLORS.accent : COLORS.textSub,
                        fontWeight: isMax ? 700 : 500,
                        fontVariantNumeric: 'tabular-nums',
                        marginBottom: 3,
                        whiteSpace: 'nowrap',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                      }}>{Math.round(m.value).toLocaleString()}</div>
                      <div style={{ height: 64, display: 'flex', alignItems: 'flex-end', justifyContent: 'center' }}>
                        <div style={{
                          width: '70%',
                          height: `${pct}%`,
                          borderRadius: '3px 3px 0 0',
                          background: isMax ? COLORS.accent : 'rgba(16,185,129,0.4)',
                          transition: 'height 0.5s',
                        }} />
                      </div>
                      <div style={{
                        fontSize: 9,
                        color: isMax ? COLORS.accent : COLORS.textMuted,
                        fontWeight: isMax ? 700 : 400,
                        marginTop: 4,
                        whiteSpace: 'nowrap',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                      }}>{m.label}</div>
                    </div>
                  );
                })}
              </div>
              <div style={{
                fontSize: 10,
                color: COLORS.textMuted,
                textAlign: 'right',
                marginTop: 6,
              }}>단위: 건</div>
            </SectionWrap>
          )}

        </>
      )}
    </div>
  );
};

export default Card9DeliveryAvgPrice;
