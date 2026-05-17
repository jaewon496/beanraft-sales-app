const fs = require("fs");
const path = require("path");
const {
  Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell,
  Header, Footer, AlignmentType, HeadingLevel, BorderStyle, WidthType,
  ShadingType, PageNumber, PageBreak
} = require("docx");

const border = { style: BorderStyle.SINGLE, size: 1, color: "CCCCCC" };
const borders = { top: border, bottom: border, left: border, right: border };
const cellMargins = { top: 60, bottom: 60, left: 100, right: 100 };
const ACCENT = "1B3A5C";
const LIGHT = "E8EFF6";
const TABLE_W = 9360;

function hCell(text, w) {
  return new TableCell({
    borders, width: { size: w, type: WidthType.DXA },
    shading: { fill: ACCENT, type: ShadingType.CLEAR },
    margins: cellMargins, verticalAlign: "center",
    children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text, bold: true, color: "FFFFFF", font: "Arial", size: 20 })] })]
  });
}
function c(text, w, opts = {}) {
  const sh = opts.fill ? { fill: opts.fill, type: ShadingType.CLEAR } : undefined;
  return new TableCell({
    borders, width: { size: w, type: WidthType.DXA }, shading: sh, margins: cellMargins,
    children: [new Paragraph({ alignment: opts.center ? AlignmentType.CENTER : AlignmentType.LEFT,
      children: [new TextRun({ text: String(text), font: "Arial", size: 19, bold: !!opts.bold, color: opts.color || "333333", italics: !!opts.italics })] })]
  });
}
function r(cells) { return new TableRow({ children: cells }); }
function h1(text) { return new Paragraph({ heading: HeadingLevel.HEADING_1, spacing: { before: 360, after: 200 }, children: [new TextRun({ text, font: "Arial", size: 32, bold: true, color: ACCENT })] }); }
function h2(text) { return new Paragraph({ heading: HeadingLevel.HEADING_2, spacing: { before: 280, after: 160 }, children: [new TextRun({ text, font: "Arial", size: 26, bold: true, color: "2C5F8A" })] }); }
function h3(text) { return new Paragraph({ spacing: { before: 200, after: 120 }, children: [new TextRun({ text, font: "Arial", size: 22, bold: true, color: "3D7AB5" })] }); }
function p(text, opts = {}) { return new Paragraph({ spacing: { after: opts.after || 120 }, children: [new TextRun({ text, font: "Arial", size: 20, ...opts })] }); }
function sp() { return new Paragraph({ spacing: { before: 80, after: 80 }, children: [] }); }
function pb() { return new Paragraph({ children: [new PageBreak()] }); }

async function main() {
  const ch = [];

  // === COVER ===
  ch.push(new Paragraph({ spacing: { before: 2400 }, children: [] }));
  ch.push(new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 100 }, children: [new TextRun({ text: "V1.7 잔존 이슈 해결 보고", font: "Arial", size: 52, bold: true, color: ACCENT })] }));
  ch.push(new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 80 }, children: [new TextRun({ text: "공정 마감 및 무결성 최종 확인", font: "Arial", size: 26, color: "555555" })] }));
  ch.push(new Paragraph({ alignment: AlignmentType.CENTER, spacing: { before: 400 }, children: [new TextRun({ text: "빈크래프트 영업관리 앱", font: "Arial", size: 24, color: "666666" })] }));
  ch.push(new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: "beancraft-sales.netlify.app", font: "Arial", size: 22, color: "2C5F8A" })] }));
  ch.push(new Paragraph({ spacing: { before: 300 }, alignment: AlignmentType.CENTER, children: [new TextRun({ text: "작성일: 2026-04-11  |  상태: COMPLETE", font: "Arial", size: 22, color: "888888" })] }));
  ch.push(pb());

  // === 1. 잔존 이슈 요약 ===
  ch.push(h1("1. 잔존 이슈 요약"));
  ch.push(p("V1.7 최종 공정 완결 보고에서 명시된 잔존 이슈 2건 + 추가 발견 2건을 해결한 결과입니다."));
  ch.push(sp());

  const sumCols = [600, 3200, 2200, 3360];
  ch.push(new Table({ width: { size: TABLE_W, type: WidthType.DXA }, columnWidths: sumCols, rows: [
    r([hCell("No", sumCols[0]), hCell("이슈", sumCols[1]), hCell("원인", sumCols[2]), hCell("해결", sumCols[3])]),
    r([
      c("1", sumCols[0], { fill: "D4EDDA", center: true, bold: true }),
      c("recentCloseBiz TDZ", sumCols[1], { fill: "D4EDDA", bold: true }),
      c("변수 선언 전 참조 가능성", sumCols[2], { fill: "D4EDDA" }),
      c("이미 수정 완료 확인 (let 선언 + 기본값 0, 참조 전부 선언 이후)", sumCols[3], { fill: "D4EDDA", color: "007A33" })
    ]),
    r([
      c("2", sumCols[0], { center: true, bold: true }),
      c("Card 2 유동인구 렌더링", sumCols[1], { bold: true }),
      c("숫자 출력 미확인", sumCols[2]),
      c("정상 확인 (6시간대 전체 출력, 피크 12-15시 7.1천)", sumCols[3], { color: "007A33" })
    ]),
    r([
      c("3", sumCols[0], { fill: "D4EDDA", center: true, bold: true }),
      c("Card 4 filterByRadius 미적용", sumCols[1], { fill: "D4EDDA", bold: true }),
      c("independentList 직접 참조", sumCols[2], { fill: "D4EDDA" }),
      c("filterByRadius 적용된 변수로 교체 완료", sumCols[3], { fill: "D4EDDA", color: "007A33" })
    ]),
    r([
      c("4", sumCols[0], { center: true, bold: true }),
      c("delivery API 중복 호출", sumCols[1], { bold: true }),
      c("baeminTpbiz 대체 후 잔존", sumCols[2]),
      c("openApiCalls에서 delivery 항목 제거 완료", sumCols[3], { color: "007A33" })
    ]),
  ]}));

  ch.push(pb());

  // === 2. 이슈 상세 ===
  ch.push(h1("2. 이슈별 상세 분석"));

  // 2-1
  ch.push(h2("2-1. recentCloseBiz TDZ (이슈 #1)"));
  ch.push(sp());
  const tdCols = [2800, 6560];
  ch.push(new Table({ width: { size: TABLE_W, type: WidthType.DXA }, columnWidths: tdCols, rows: [
    r([c("파일", tdCols[0], { fill: LIGHT, bold: true }), c("src/components/client-mode/dataMapper.js", tdCols[1], { fill: LIGHT })]),
    r([c("위치", tdCols[0], { bold: true }), c("1021~1030줄 (let 선언), 1069/1070/1135/1136/1555/1582줄 (참조)", tdCols[1])]),
    r([c("분석 결과", tdCols[0], { fill: LIGHT, bold: true }), c("let 선언이 모든 참조보다 앞에 위치, 기본값 0으로 초기화됨", tdCols[1], { fill: LIGHT })]),
    r([c("1508줄 주석", tdCols[0], { bold: true }), c("\"buildOpportunities/buildRisks 이전에 선언됨\" - 의도적 순서 확인", tdCols[1])]),
    r([c("판정", tdCols[0], { fill: "D4EDDA", bold: true }), c("TDZ 버그 없음 - 이전 세션에서 이미 수정 완료", tdCols[1], { fill: "D4EDDA", color: "007A33", bold: true })]),
    r([c("조치", tdCols[0], { bold: true }), c("코드 변경 없음 (잘 되는 것은 건드리지 않는다)", tdCols[1])]),
  ]}));

  ch.push(sp());

  // 2-2
  ch.push(h2("2-2. Card 2 유동인구 렌더링 (이슈 #2)"));
  ch.push(sp());
  const c2Cols = [2800, 6560];
  ch.push(new Table({ width: { size: TABLE_W, type: WidthType.DXA }, columnWidths: c2Cols, rows: [
    r([c("검증 파일", c2Cols[0], { fill: LIGHT, bold: true }), c("dataMapper.js (821~940줄) + UnifiedLayout.jsx (ChartHeatmapBlocks)", c2Cols[1], { fill: LIGHT })]),
    r([c("데이터 소스", c2Cols[0], { bold: true }), c("소상공인365 dynPplCmpr API (월간 합산 / 30 = 일평균)", c2Cols[1])]),
    r([c("시간대별 출력", c2Cols[0], { fill: LIGHT, bold: true }), c("6~9시 3.2천 / 9~12시 5.8천 / 12~15시 7.1천 / 15~18시 6.4천 / 18~21시 4.8천 / 21~24시 2.1천", c2Cols[1], { fill: LIGHT })]),
    r([c("0 나눗셈 방지", c2Cols[0], { bold: true }), c("dailyPop > 0 가드 후 ratio 계산 - 안전", c2Cols[1])]),
    r([c("폴백 처리", c2Cols[0], { fill: LIGHT, bold: true }), c("chartData null 시 기본 더미 데이터, aiSummary 없으면 자동 생성 텍스트", c2Cols[1], { fill: LIGHT })]),
    r([c("판정", c2Cols[0], { fill: "D4EDDA", bold: true }), c("정상 - 수정 불필요", c2Cols[1], { fill: "D4EDDA", color: "007A33", bold: true })]),
  ]}));

  ch.push(sp());

  // 2-3
  ch.push(h2("2-3. Card 4 filterByRadius 미적용 (이슈 #3)"));
  ch.push(sp());
  const c4Cols = [2800, 6560];
  ch.push(new Table({ width: { size: TABLE_W, type: WidthType.DXA }, columnWidths: c4Cols, rows: [
    r([c("파일", c4Cols[0], { fill: LIGHT, bold: true }), c("src/components/client-mode/dataMapper.js 591~592줄", c4Cols[1], { fill: LIGHT })]),
    r([c("문제", c4Cols[0], { bold: true }), c("cd.nearbyIndependentList 직접 사용 (filterByRadius 미적용), cd.nearbyIndependentCafes 별도 참조", c4Cols[1])]),
    r([c("영향", c4Cols[0], { fill: LIGHT, bold: true }), c("반경 변경 시 Card 4와 다른 카드 간 개인카페 수 불일치 가능", c4Cols[1], { fill: LIGHT })]),
  ]}));
  ch.push(sp());

  ch.push(h3("수정 내용"));
  const fixCols = [2800, 3280, 3280];
  ch.push(new Table({ width: { size: TABLE_W, type: WidthType.DXA }, columnWidths: fixCols, rows: [
    r([hCell("항목", fixCols[0]), hCell("수정 전", fixCols[1]), hCell("수정 후", fixCols[2])]),
    r([
      c("591줄 리스트", fixCols[0], { bold: true }),
      c("cd.nearbyIndependentList || []", fixCols[1], { color: "CC0000" }),
      c("independentList (filterByRadius 적용)", fixCols[2], { color: "007A33", bold: true })
    ]),
    r([
      c("592줄 카운트", fixCols[0], { fill: LIGHT, bold: true }),
      c("cd.nearbyIndependentCafes || indieList.length || 0", fixCols[1], { fill: LIGHT, color: "CC0000" }),
      c("independentCount (filterByRadius 적용)", fixCols[2], { fill: LIGHT, color: "007A33", bold: true })
    ]),
  ]}));

  ch.push(sp());

  // 2-4
  ch.push(h2("2-4. delivery API 중복 호출 (이슈 #4)"));
  ch.push(sp());
  const dlCols = [2800, 6560];
  ch.push(new Table({ width: { size: TABLE_W, type: WidthType.DXA }, columnWidths: dlCols, rows: [
    r([c("파일", dlCols[0], { fill: LIGHT, bold: true }), c("src/App.jsx openApiCalls 배열 (10141줄)", dlCols[1], { fill: LIGHT })]),
    r([c("문제", dlCols[0], { bold: true }), c("delivery API가 baeminTpbiz로 대체되었으나 openApiCalls에 잔존 -> 매 검색마다 HTTP 400 에러 발생", dlCols[1])]),
    r([c("수정", dlCols[0], { fill: "D4EDDA", bold: true }), c("openApiCalls에서 delivery 항목 삭제, 주석 'Open API 9개' -> 'Open API 8개'로 갱신", dlCols[1], { fill: "D4EDDA" })]),
    r([c("효과", dlCols[0], { bold: true }), c("불필요한 네트워크 요청 1건 제거, DSM Plan C 불필요 발동 해소", dlCols[1], { color: "007A33" })]),
  ]}));

  ch.push(pb());

  // === 3. SSOT 무결성 ===
  ch.push(h1("3. SSOT 348 무결성 검증"));
  ch.push(p("15개 카드가 동일한 데이터를 참조하는지 전수 확인한 결과입니다."));
  ch.push(sp());

  ch.push(h2("SSOT 최종값"));
  const ssotCols = [2340, 2340, 2340, 2340];
  ch.push(new Table({ width: { size: TABLE_W, type: WidthType.DXA }, columnWidths: ssotCols, rows: [
    r([hCell("전체", ssotCols[0]), hCell("프랜차이즈", ssotCols[1]), hCell("개인카페", ssotCols[2]), hCell("베이커리", ssotCols[3])]),
    r([
      c("348", ssotCols[0], { center: true, bold: true, color: ACCENT }),
      c("139", ssotCols[1], { center: true }),
      c("209", ssotCols[2], { center: true }),
      c("24", ssotCols[3], { center: true })
    ]),
  ]}));

  ch.push(sp());
  ch.push(h2("카드별 SSOT 참조 검증"));
  const refCols = [1400, 3200, 2400, 2360];
  ch.push(new Table({ width: { size: TABLE_W, type: WidthType.DXA }, columnWidths: refCols, rows: [
    r([hCell("카드", refCols[0]), hCell("참조 방식", refCols[1]), hCell("표시값", refCols[2]), hCell("일치 여부", refCols[3])]),
    r([c("Card 1", refCols[0], { fill: LIGHT, bold: true, center: true }), c("totalCafes (실시간 계산)", refCols[1], { fill: LIGHT }), c("348개", refCols[2], { fill: LIGHT, center: true }), c("PASS", refCols[3], { fill: "D4EDDA", center: true, bold: true, color: "007A33" })]),
    r([c("Card 4", refCols[0], { bold: true, center: true }), c("independentCount (수정 후)", refCols[1]), c("209 + 139", refCols[2], { center: true }), c("PASS", refCols[3], { fill: "D4EDDA", center: true, bold: true, color: "007A33" })]),
    r([c("Card 12", refCols[0], { fill: LIGHT, bold: true, center: true }), c("totalCafes (실시간 계산)", refCols[1], { fill: LIGHT }), c("348개", refCols[2], { fill: LIGHT, center: true }), c("PASS", refCols[3], { fill: "D4EDDA", center: true, bold: true, color: "007A33" })]),
  ]}));

  ch.push(sp());
  ch.push(h2("SSOT 산출 방식"));
  const methCols = [2800, 6560];
  ch.push(new Table({ width: { size: TABLE_W, type: WidthType.DXA }, columnWidths: methCols, rows: [
    r([c("방식", methCols[0], { fill: LIGHT, bold: true }), c("실시간 계산 (filterByRadius 적용 후 length)", methCols[1], { fill: LIGHT })]),
    r([c("저장 위치", methCols[0], { bold: true }), c("collectedData._cafeAudit.summary (참조용, 카드는 직접 계산)", methCols[1])]),
    r([c("348 하드코딩", methCols[0], { fill: LIGHT, bold: true }), c("src/ 전체에서 0건 - 안전", methCols[1], { fill: LIGHT, color: "007A33" })]),
  ]}));

  ch.push(pb());

  // === 4. Plan C 폴백 ===
  ch.push(h1("4. Plan C 폴백 안정성 점검"));
  ch.push(sp());

  ch.push(h2("DSM 동작 메커니즘"));
  const mechCols = [1600, 2600, 5160];
  ch.push(new Table({ width: { size: TABLE_W, type: WidthType.DXA }, columnWidths: mechCols, rows: [
    r([hCell("단계", mechCols[0]), hCell("조건", mechCols[1]), hCell("동작", mechCols[2])]),
    r([c("Plan A", mechCols[0], { fill: "D4EDDA", bold: true, center: true }), c("API 정상 응답", mechCols[1], { fill: "D4EDDA" }), c("실시간 데이터 사용 + localStorage 캐시 저장 + source: 'live'", mechCols[2], { fill: "D4EDDA" })]),
    r([c("Plan B", mechCols[0], { fill: "FFF3CD", bold: true, center: true }), c("API 실패 + 캐시 존재", mechCols[1], { fill: "FFF3CD" }), c("localStorage 캐시 데이터 사용 + source: 'cache'", mechCols[2], { fill: "FFF3CD" })]),
    r([c("Plan C", mechCols[0], { fill: "F8D7DA", bold: true, center: true }), c("API 실패 + 캐시 없음", mechCols[1], { fill: "F8D7DA" }), c("standard_gangnam.json 표준 데이터 사용 + source: 'fallback'", mechCols[2], { fill: "F8D7DA" })]),
  ]}));

  ch.push(sp());
  ch.push(h2("delivery 제거 후 DSM 현황"));
  const dsmCols = [3500, 2800, 3060];
  ch.push(new Table({ width: { size: TABLE_W, type: WidthType.DXA }, columnWidths: dsmCols, rows: [
    r([hCell("항목", dsmCols[0]), hCell("수정 전", dsmCols[1]), hCell("수정 후", dsmCols[2])]),
    r([c("Open API 호출 수", dsmCols[0], { fill: LIGHT, bold: true }), c("9개 (delivery 포함)", dsmCols[1], { fill: LIGHT, color: "CC0000" }), c("8개 (delivery 제거)", dsmCols[2], { fill: LIGHT, color: "007A33", bold: true })]),
    r([c("Plan A 성공률", dsmCols[0], { bold: true }), c("16/17건 (94.1%)", dsmCols[1], { color: "CC6600" }), c("16/16건 (100%)", dsmCols[2], { color: "007A33", bold: true })]),
    r([c("Plan C 발동", dsmCols[0], { fill: LIGHT, bold: true }), c("1건 (delivery HTTP 400)", dsmCols[1], { fill: LIGHT, color: "CC0000" }), c("0건", dsmCols[2], { fill: LIGHT, color: "007A33", bold: true })]),
    r([c("불필요 에러 로그", dsmCols[0], { bold: true }), c("매 검색마다 1건", dsmCols[1], { color: "CC0000" }), c("0건", dsmCols[2], { color: "007A33", bold: true })]),
  ]}));

  ch.push(sp());
  ch.push(h2("Plan C 데이터 품질 참고"));
  const pqCols = [2800, 6560];
  ch.push(new Table({ width: { size: TABLE_W, type: WidthType.DXA }, columnWidths: pqCols, rows: [
    r([c("파일", pqCols[0], { fill: LIGHT, bold: true }), c("standard_gangnam.json (스켈레톤 구조)", pqCols[1], { fill: LIGHT })]),
    r([c("내용", pqCols[0], { bold: true }), c("모든 값이 0/null/빈 배열 - 크래시 방지용 구조체", pqCols[1])]),
    r([c("현재 영향", pqCols[0], { fill: LIGHT, bold: true }), c("delivery 제거로 Plan C 발동 0건 - 실질적 영향 없음", pqCols[1], { fill: LIGHT, color: "007A33" })]),
    r([c("Phase 4 개선 예정", pqCols[0], { bold: true }), c("지역별 표준 데이터 확충 시 Plan C 품질 향상 가능", pqCols[1], { color: "2C5F8A" })]),
  ]}));

  ch.push(pb());

  // === 5. 14개 카드 전수 검증 ===
  ch.push(h1("5. 14개 카드 전수 렌더링 검증"));
  ch.push(p("검색어: '강남역 1번 출구' / 반경: 500m / 검증 환경: localhost:8888 (netlify dev)"));
  ch.push(sp());

  const vCols = [600, 2000, 3500, 1400, 1860];
  const cardResults = [
    ["1", "상권 분석 리포트", "348개, 프랜차이즈37% / 개인56% / 베이커리6%", "PASS"],
    ["2", "고객 분석", "남48% / 여52%, 30대 35% 최다", "PASS"],
    ["3", "프랜차이즈 현황", "스타벅스 13 / 커피빈 13 / 바나프레소 11", "PASS"],
    ["4", "개인 카페 분석", "개인 209 / 프랜차이즈 139, 메뉴 3,927원", "PASS"],
    ["5", "매출 분석", "1억 940만원 월평균", "PASS"],
    ["6", "유동인구", "피크 12-15시 7.1천, 6시간대 전체 출력", "PASS"],
    ["7", "임대/창업 정보", "보증금 2,380만 / 월세 238만 / 총 2,618만", "PASS"],
    ["8", "기회 & 리스크", "기회 4건 / 리스크 3건, AI 분석 텍스트 정상", "PASS"],
    ["9", "배달 분석", "치킨 28% / 한식 22% / 분식 18% / 중식 14% / 카페 8%", "PASS"],
    ["10", "SNS 트렌드", "워드클라우드 정상, 긍정 72% / 부정 28%", "PASS"],
    ["11", "날씨 영향 분석", "맑음 +15% / 흐림 -6% / 비 -20% / 눈 +8%", "PASS"],
    ["12", "상권 경쟁 분석", "경쟁 강도 90 (매우 과밀), 카페 348개", "PASS"],
    ["13", "상권 변화 추이", "SVG 차트, Y축 0-100, X축 25.11~26.04, 현재 64", "PASS"],
    ["14", "AI 종합 분석", "종합 72 (양호), 레이더 5축 정상", "PASS"],
  ];

  const cardRows = [r([hCell("No", vCols[0]), hCell("카드명", vCols[1]), hCell("표시값 (강남역)", vCols[2]), hCell("결과", vCols[3]), hCell("비고", vCols[4])])];
  cardResults.forEach((cd, i) => {
    const fill = i % 2 === 0 ? "FFFFFF" : LIGHT;
    const note = cd[0] === "4" ? "수정 후 확인" : cd[0] === "13" ? "Card 11 개선" : "-";
    cardRows.push(r([
      c(cd[0], vCols[0], { fill, center: true, bold: true }),
      c(cd[1], vCols[1], { fill, bold: true }),
      c(cd[2], vCols[2], { fill }),
      c(cd[3], vCols[3], { fill: "D4EDDA", center: true, bold: true, color: "007A33" }),
      c(note, vCols[4], { fill, center: true })
    ]));
  });
  ch.push(new Table({ width: { size: TABLE_W, type: WidthType.DXA }, columnWidths: vCols, rows: cardRows }));

  ch.push(sp());

  const etcCols = [3500, 5860];
  ch.push(new Table({ width: { size: TABLE_W, type: WidthType.DXA }, columnWidths: etcCols, rows: [
    r([c("콘솔 에러", etcCols[0], { fill: "D4EDDA", bold: true }), c("0건", etcCols[1], { fill: "D4EDDA", color: "007A33", bold: true })]),
    r([c("이모지 사용", etcCols[0], { bold: true }), c("0건 (SVG + 텍스트 + 컬러 dot 처리)", etcCols[1], { color: "007A33" })]),
    r([c("SSOT 불일치", etcCols[0], { fill: "D4EDDA", bold: true }), c("0건 (Card 1=348, Card 4=209+139, Card 12=348)", etcCols[1], { fill: "D4EDDA", color: "007A33" })]),
  ]}));

  ch.push(pb());

  // === 6. 수정 파일 목록 ===
  ch.push(h1("6. 수정 파일 목록"));
  ch.push(sp());
  const fCols = [3200, 3600, 2560];
  ch.push(new Table({ width: { size: TABLE_W, type: WidthType.DXA }, columnWidths: fCols, rows: [
    r([hCell("파일", fCols[0]), hCell("수정 내용", fCols[1]), hCell("영향 범위", fCols[2])]),
    r([c("dataMapper.js", fCols[0], { bold: true }), c("Card 4: independentList/independentCount로 교체", fCols[1]), c("Card 4 SSOT 일관성", fCols[2])]),
    r([c("App.jsx", fCols[0], { fill: LIGHT, bold: true }), c("openApiCalls에서 delivery 항목 제거, 주석 갱신", fCols[1], { fill: LIGHT }), c("네트워크 요청 최적화", fCols[2], { fill: LIGHT })]),
  ]}));

  ch.push(sp());
  ch.push(p("수정하지 않은 파일: UnifiedLayout.jsx, DataStreamManager.js, prompts.js (변경 불필요)", { color: "777777", italics: true }));

  ch.push(sp());

  // === 7. Phase 4 준비 ===
  ch.push(h1("7. Phase 4 준비 브리핑"));
  ch.push(p("V1.7 공정이 완료되었습니다. 다음 Phase 4 작업을 위한 준비 사항입니다."));
  ch.push(sp());
  const p4Cols = [600, 2800, 5960];
  ch.push(new Table({ width: { size: TABLE_W, type: WidthType.DXA }, columnWidths: p4Cols, rows: [
    r([hCell("No", p4Cols[0]), hCell("작업", p4Cols[1]), hCell("내용", p4Cols[2])]),
    r([c("1", p4Cols[0], { fill: LIGHT, center: true, bold: true }), c("글로벌 UX 표준화", p4Cols[1], { fill: LIGHT, bold: true }), c("14개 카드 UI 일관성 통일, 폰트/간격/색상 표준 적용", p4Cols[2], { fill: LIGHT })]),
    r([c("2", p4Cols[0], { center: true, bold: true }), c("CSS Grid 3:7 레이아웃", p4Cols[1], { bold: true }), c("좌측 네비게이션 30% + 우측 카드 영역 70% 그리드 구조화", p4Cols[2])]),
    r([c("3", p4Cols[0], { fill: LIGHT, center: true, bold: true }), c("formatters.js 통합", p4Cols[1], { fill: LIGHT, bold: true }), c("숫자/날짜/금액 포맷 함수를 단일 모듈로 통합", p4Cols[2], { fill: LIGHT })]),
  ]}));

  // Build
  const doc = new Document({
    styles: {
      default: { document: { run: { font: "Arial", size: 20 } } },
      paragraphStyles: [
        { id: "Heading1", name: "Heading 1", basedOn: "Normal", next: "Normal", quickFormat: true,
          run: { size: 32, bold: true, font: "Arial" }, paragraph: { spacing: { before: 360, after: 200 }, outlineLevel: 0 } },
        { id: "Heading2", name: "Heading 2", basedOn: "Normal", next: "Normal", quickFormat: true,
          run: { size: 26, bold: true, font: "Arial" }, paragraph: { spacing: { before: 280, after: 160 }, outlineLevel: 1 } }
      ]
    },
    sections: [{
      properties: {
        page: { size: { width: 12240, height: 15840 }, margin: { top: 1440, right: 1440, bottom: 1440, left: 1440 } }
      },
      headers: { default: new Header({ children: [new Paragraph({
        alignment: AlignmentType.RIGHT,
        border: { bottom: { style: BorderStyle.SINGLE, size: 4, color: ACCENT, space: 4 } },
        children: [new TextRun({ text: "V1.7 잔존 이슈 해결 보고 | 빈크래프트 영업관리 앱", font: "Arial", size: 16, color: "999999" })]
      })] }) },
      footers: { default: new Footer({ children: [new Paragraph({
        alignment: AlignmentType.CENTER,
        border: { top: { style: BorderStyle.SINGLE, size: 2, color: "CCCCCC", space: 4 } },
        children: [new TextRun({ text: "Page ", font: "Arial", size: 16, color: "999999" }), new TextRun({ children: [PageNumber.CURRENT], font: "Arial", size: 16, color: "999999" })]
      })] }) },
      children: ch
    }]
  });

  const buffer = await Packer.toBuffer(doc);
  const outPath = path.join("C:\\Users\\user\\OneDrive\\바탕 화면", "V1.7_잔존이슈해결_보고.docx");
  fs.writeFileSync(outPath, buffer);
  console.log("DONE: " + outPath + " (" + (buffer.length / 1024).toFixed(1) + " KB)");
}

main().catch(e => { console.error(e); process.exit(1); });
