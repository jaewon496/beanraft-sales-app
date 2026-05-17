/* HandoffPreview.jsx — 검증용: 14개 카드를 stack으로 나열
   사이드바/배경/광원 없이 카드만 — 시각 검증 목적 */

import React from 'react';

import Card01 from './cards/Card01.jsx';
import Card02 from './cards/Card02.jsx';
import Card03 from './cards/Card03.jsx';
import Card04 from './cards/Card04.jsx';
import Card05 from './cards/Card05.jsx';
import Card06 from './cards/Card06.jsx';
import Card07 from './cards/Card07.jsx';
import Card08 from './cards/Card08.jsx';
import Card09 from './cards/Card09.jsx';
import Card10 from './cards/Card10.jsx';
import Card11 from './cards/Card11.jsx';
import Card12 from './cards/Card12.jsx';
import Card13 from './cards/Card13.jsx';
import Card14 from './cards/Card14.jsx';

const CARDS_IN_BADGE_ORDER = [
  Card01, // badge 01 - 상권 분석
  Card03, // badge 02 - 상권 변화 추이
  Card07, // badge 03 - 유동인구
  Card08, // badge 04 - 임대/창업
  Card02, // badge 05 - 고객 분석
  Card11, // badge 06 - SNS 트렌드
  Card12, // badge 07 - 날씨 영향
  Card04, // badge 08 - 프랜차이즈
  Card06, // badge 09 - 개인 카페
  Card13, // badge 10 - 상권 경쟁
  Card05, // badge 11 - 매출 분석
  Card09, // badge 12 - 카페 기회
  Card10, // badge 13 - 배달 객단가
  Card14, // badge 14 - AI 종합
];

export default function HandoffPreview() {
  return (
    <div style={{
      minHeight: "100vh",
      background: "var(--matte-bg, #0d1014)",
      padding: "32px 24px",
      color: "var(--matte-fg, #fff)",
    }}>
      <div style={{
        maxWidth: 1280,
        margin: "0 auto",
        display: "flex",
        flexDirection: "column",
        gap: 24,
      }}>
        <header style={{
          padding: "20px 24px",
          borderBottom: "1px solid rgba(255,255,255,0.08)",
          marginBottom: 8,
        }}>
          <div style={{ fontSize: 22, fontWeight: 700, letterSpacing: "-0.01em" }}>
            Handoff Preview · 14 cards
          </div>
          <div style={{ fontSize: 13, color: "var(--matte-fg-3, #A3A3A3)", marginTop: 4 }}>
            시각 검증용 — 더미 데이터로 카드만 렌더
          </div>
        </header>

        {CARDS_IN_BADGE_ORDER.map((Card, i) => (
          <Card key={i} />
        ))}
      </div>
    </div>
  );
}
