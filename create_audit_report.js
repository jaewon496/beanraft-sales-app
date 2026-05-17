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
  ch.push(new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 100 }, children: [new TextRun({ text: "V1.7 API 연동 및 매핑 누락 전수 감사", font: "Arial", size: 52, bold: true, color: ACCENT })] }));
  ch.push(new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 80 }, children: [new TextRun({ text: "14개 카드 데이터 바인딩 1:1 검증 및 출처 통합", font: "Arial", size: 26, color: "555555" })] }));
  ch.push(new Paragraph({ alignment: AlignmentType.CENTER, spacing: { before: 400 }, children: [new TextRun({ text: "빈크래프트 영업관리 앱", font: "Arial", size: 24, color: "666666" })] }));
  ch.push(new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: "beancraft-sales.netlify.app", font: "Arial", size: 22, color: "2C5F8A" })] }));
  ch.push(new Paragraph({ spacing: { before: 300 }, alignment: AlignmentType.CENTER, children: [new TextRun({ text: "작성일: 2026-04-12  |  상태: COMPLETE", font: "Arial", size: 22, color: "888888" })] }));
  ch.push(pb());

  // === 1. 감사 개요 ===
  ch.push(h1("1. 감사 개요"));
  ch.push(p("전체 API 호출 경로와 14개 카드 데이터 바인딩을 1:1 대조하여, 누락/미연결/중복 수집 현황을 파악하고 출처 표기를 통합 정비했습니다."));
  ch.push(sp());

  const ovCols = [3000, 6360];
  ch.push(new Table({ width: { size: TABLE_W, type: WidthType.DXA }, columnWidths: ovCols, rows: [
    r([c("감사 범위", ovCols[0], { fill: LIGHT, bold: true }), c("App.jsx API 호출 -> dataMapper.js 카드 매핑 -> UnifiedLayout.jsx 렌더링", ovCols[1], { fill: LIGHT })]),
    r([c("대상 파일", ovCols[0], { bold: true }), c("App.jsx, dataMapper.js, UnifiedLayout.jsx, CardTemplate.jsx, sbiz-proxy.js, openub-sales-proxy.js, nicebizmap-proxy.js", ovCols[1])]),
    r([c("검사 항목", ovCols[0], { fill: LIGHT, bold: true }), c("API 호출 유무, 응답 저장 키, dataMapper 참조, 카드 반영 여부, 출처 표기 정합성", ovCols[1], { fill: LIGHT })]),
    r([c("핵심 발견", ovCols[0], { bold: true }), c("치명 누락 5건, 수집 후 미사용 15건+, 출처 표기 불일치 14건", ovCols[1], { color: "CC0000", bold: true })]),
  ]}));

  ch.push(pb());

  // === 2. 치명 누락 5건 ===
  ch.push(h1("2. 치명 누락 5건 (Critical Missing Connections)"));
  ch.push(p("코드에 구현되었으나 실제 카드에 데이터가 반영되지 않는 치명적 누락입니다."));
  ch.push(sp());

  // 2-1
  ch.push(h2("2-1. openubSales (건물 매출 데이터)"));
  ch.push(sp());
  const m1Cols = [2800, 6560];
  ch.push(new Table({ width: { size: TABLE_W, type: WidthType.DXA }, columnWidths: m1Cols, rows: [
    r([c("API", m1Cols[0], { fill: LIGHT, bold: true }), c("openub-sales-proxy -> bd/sales (건물별 업종 매출)", m1Cols[1], { fill: LIGHT })]),
    r([c("저장 키", m1Cols[0], { bold: true }), c("collectedData.openubBuildingSales", m1Cols[1])]),
    r([c("문제", m1Cols[0], { fill: "FFF3CD", bold: true }), c("dataMapper에서 apis.openubSales로 참조 -> collectedData에는 openubBuildingSales로 저장 -> 키 불일치로 항상 undefined", m1Cols[1], { fill: "FFF3CD", color: "856404" })]),
    r([c("영향 카드", m1Cols[0], { bold: true }), c("Card 2 (매출 추정), Card 11 (경쟁 분석) - 건물 매출 데이터 누락", m1Cols[1], { color: "CC0000" })]),
    r([c("심각도", m1Cols[0], { fill: "F8D7DA", bold: true }), c("HIGH - 핵심 매출 데이터가 카드에 표시되지 않음", m1Cols[1], { fill: "F8D7DA", color: "721C24", bold: true })]),
  ]}));
  ch.push(sp());

  // 2-2
  ch.push(h2("2-2. delivery (배달 데이터)"));
  ch.push(sp());
  ch.push(new Table({ width: { size: TABLE_W, type: WidthType.DXA }, columnWidths: m1Cols, rows: [
    r([c("API", m1Cols[0], { fill: LIGHT, bold: true }), c("delivery -> baeminTpbiz 대체 완료", m1Cols[1], { fill: LIGHT })]),
    r([c("문제", m1Cols[0], { bold: true }), c("openApiCalls에서 delivery 제거 완료 (이전 이슈에서 수정), 그러나 Card 9 dataMapper에서 여전히 deliveryData 참조", m1Cols[1])]),
    r([c("영향 카드", m1Cols[0], { fill: "FFF3CD", bold: true }), c("Card 9 (배달/테이크아웃) - deliveryData 항상 빈 객체", m1Cols[1], { fill: "FFF3CD", color: "856404" })]),
    r([c("심각도", m1Cols[0], { bold: true }), c("MEDIUM - baeminTpbiz로 일부 대체되었으나 배달 상세 데이터 손실", m1Cols[1], { color: "CC6600" })]),
  ]}));
  ch.push(sp());

  // 2-3
  ch.push(h2("2-3. naverBlog (네이버 블로그 언급)"));
  ch.push(sp());
  ch.push(new Table({ width: { size: TABLE_W, type: WidthType.DXA }, columnWidths: m1Cols, rows: [
    r([c("참조 위치", m1Cols[0], { fill: LIGHT, bold: true }), c("dataMapper.js Card 10 blogMentions", m1Cols[1], { fill: LIGHT })]),
    r([c("문제", m1Cols[0], { bold: true }), c("네이버 블로그 수집 로직 자체가 존재하지 않음 -> blogMentions 항상 0", m1Cols[1])]),
    r([c("영향 카드", m1Cols[0], { fill: "FFF3CD", bold: true }), c("Card 10 (SNS/온라인 분석) - 블로그 언급 수 항상 0 표시", m1Cols[1], { fill: "FFF3CD", color: "856404" })]),
    r([c("심각도", m1Cols[0], { bold: true }), c("MEDIUM - 수집 로직 신규 구현 필요", m1Cols[1], { color: "CC6600" })]),
  ]}));
  ch.push(sp());

  // 2-4
  ch.push(h2("2-4. earnAmt (수익 금액)"));
  ch.push(sp());
  ch.push(new Table({ width: { size: TABLE_W, type: WidthType.DXA }, columnWidths: m1Cols, rows: [
    r([c("API", m1Cols[0], { fill: LIGHT, bold: true }), c("sbiz-proxy earnAmt 엔드포인트 정의됨", m1Cols[1], { fill: LIGHT })]),
    r([c("문제", m1Cols[0], { bold: true }), c("App.jsx에서 earnAmt API를 호출하지 않음 -> Card 2 수익 데이터 null", m1Cols[1])]),
    r([c("영향 카드", m1Cols[0], { fill: "FFF3CD", bold: true }), c("Card 2 (매출 추정) - earnAmt 항상 null", m1Cols[1], { fill: "FFF3CD", color: "856404" })]),
    r([c("심각도", m1Cols[0], { bold: true }), c("LOW - 소상공인365 다른 매출 데이터로 부분 보완 중", m1Cols[1], { color: "228B22" })]),
  ]}));
  ch.push(sp());

  // 2-5
  ch.push(h2("2-5. cafeTimeData (카페 시간대 데이터)"));
  ch.push(sp());
  ch.push(new Table({ width: { size: TABLE_W, type: WidthType.DXA }, columnWidths: m1Cols, rows: [
    r([c("위치", m1Cols[0], { fill: LIGHT, bold: true }), c("App.jsx - if(false) 조건으로 비활성화", m1Cols[1], { fill: LIGHT })]),
    r([c("문제", m1Cols[0], { bold: true }), c("cafeTimeData 수집이 if(false)로 차단됨 -> Card 2 성별 데이터 소스 상실", m1Cols[1])]),
    r([c("영향 카드", m1Cols[0], { fill: "FFF3CD", bold: true }), c("Card 2 (매출 추정) - 성별 비율 데이터 없음", m1Cols[1], { fill: "FFF3CD", color: "856404" })]),
    r([c("심각도", m1Cols[0], { bold: true }), c("LOW - 의도적 비활성화 여부 확인 필요", m1Cols[1], { color: "228B22" })]),
  ]}));

  ch.push(pb());

  // === 3. 수집 후 미사용 데이터 ===
  ch.push(h1("3. 수집 후 미사용 데이터 (15건+)"));
  ch.push(p("API를 호출하고 응답을 저장하지만, 어떤 카드에도 바인딩되지 않는 데이터입니다."));
  ch.push(sp());

  const uCols = [600, 2600, 2800, 3360];
  ch.push(new Table({ width: { size: TABLE_W, type: WidthType.DXA }, columnWidths: uCols, rows: [
    r([hCell("No", uCols[0]), hCell("데이터", uCols[1]), hCell("API 출처", uCols[2]), hCell("상태", uCols[3])]),
    r([c("1", uCols[0], { center: true }), c("dongMTpctdCmpr", uCols[1], { bold: true }), c("소상공인365", uCols[2]), c("수집 O, 카드 미배치", uCols[3], { color: "CC6600" })]),
    r([c("2", uCols[0], { center: true, fill: LIGHT }), c("startupPublic", uCols[1], { fill: LIGHT, bold: true }), c("Open API", uCols[2], { fill: LIGHT }), c("수집 O, 카드 미배치", uCols[3], { fill: LIGHT, color: "CC6600" })]),
    r([c("3", uCols[0], { center: true }), c("hpReport", uCols[1], { bold: true }), c("Open API", uCols[2]), c("수집 O, 카드 미배치", uCols[3], { color: "CC6600" })]),
    r([c("4", uCols[0], { center: true, fill: LIGHT }), c("tour", uCols[1], { fill: LIGHT, bold: true }), c("Open API", uCols[2], { fill: LIGHT }), c("수집 O, 카드 미배치", uCols[3], { fill: LIGHT, color: "CC6600" })]),
    r([c("5", uCols[0], { center: true }), c("sbizReport", uCols[1], { bold: true }), c("소상공인365", uCols[2]), c("수집 O, 카드 미배치", uCols[3], { color: "CC6600" })]),
    r([c("6", uCols[0], { center: true, fill: LIGHT }), c("youtube", uCols[1], { fill: LIGHT, bold: true }), c("카페 상세수집", uCols[2], { fill: LIGHT }), c("수집 O, 카드 미배치", uCols[3], { fill: LIGHT, color: "CC6600" })]),
    r([c("7", uCols[0], { center: true }), c("deliveryDetail", uCols[1], { bold: true }), c("배달 API", uCols[2]), c("수집 O, 카드 미배치", uCols[3], { color: "CC6600" })]),
    r([c("8", uCols[0], { center: true, fill: LIGHT }), c("salesEstimates", uCols[1], { fill: LIGHT, bold: true }), c("오픈업", uCols[2], { fill: LIGHT }), c("수집 O, 카드 미배치", uCols[3], { fill: LIGHT, color: "CC6600" })]),
    r([c("9", uCols[0], { center: true }), c("pop/rp (유동인구)", uCols[1], { bold: true }), c("오픈업", uCols[2]), c("수집 O, 카드 미배치", uCols[3], { color: "CC6600" })]),
    r([c("10~18", uCols[0], { center: true, fill: LIGHT }), c("Seoul 9개 API", uCols[1], { fill: LIGHT, bold: true }), c("서울 열린데이터", uCols[2], { fill: LIGHT }), c("서울 한정, 비수도권 폴백 없음", uCols[3], { fill: LIGHT, color: "CC6600" })]),
  ]}));

  ch.push(pb());

  // === 4. 14개 카드별 데이터 소스 매핑 ===
  ch.push(h1("4. 14개 카드별 데이터 소스 매핑"));
  ch.push(p("각 카드가 실제로 사용하는 API와 데이터 키를 1:1 매핑한 결과입니다."));
  ch.push(sp());

  const cCols = [600, 2200, 3200, 3360];
  ch.push(new Table({ width: { size: TABLE_W, type: WidthType.DXA }, columnWidths: cCols, rows: [
    r([hCell("카드", cCols[0]), hCell("제목", cCols[1]), hCell("데이터 소스 (API)", cCols[2]), hCell("상태", cCols[3])]),
    r([c("1", cCols[0], { center: true }), c("상권 분석 리포트", cCols[1], { bold: true }), c("카카오 + 오픈업 + storeRadius", cCols[2]), c("정상", cCols[3], { color: "007A33", bold: true })]),
    r([c("2", cCols[0], { center: true, fill: LIGHT }), c("매출 추정", cCols[1], { fill: LIGHT, bold: true }), c("소상공인365 (dynPplCmpr, slsAvg) + 오픈업 sales", cCols[2], { fill: LIGHT }), c("openubSales 키 불일치", cCols[3], { fill: LIGHT, color: "CC0000" })]),
    r([c("3", cCols[0], { center: true }), c("유동인구", cCols[1], { bold: true }), c("소상공인365 (dynPplCmpr)", cCols[2]), c("정상", cCols[3], { color: "007A33", bold: true })]),
    r([c("4", cCols[0], { center: true, fill: LIGHT }), c("경쟁 현황", cCols[1], { fill: LIGHT, bold: true }), c("카카오 + 오픈업 + filterByRadius", cCols[2], { fill: LIGHT }), c("정상 (수정 완료)", cCols[3], { fill: LIGHT, color: "007A33", bold: true })]),
    r([c("5", cCols[0], { center: true }), c("상권 매출 비교", cCols[1], { bold: true }), c("소상공인365 (slsAvg, slsCmpr)", cCols[2]), c("정상", cCols[3], { color: "007A33", bold: true })]),
    r([c("6", cCols[0], { center: true, fill: LIGHT }), c("임대료", cCols[1], { fill: LIGHT, bold: true }), c("한국부동산원 (R-ONE rentData)", cCols[2], { fill: LIGHT }), c("정상", cCols[3], { fill: LIGHT, color: "007A33", bold: true })]),
    r([c("7", cCols[0], { center: true }), c("입지 분석", cCols[1], { bold: true }), c("카카오 (places), 소상공인365 (storeRadius)", cCols[2]), c("정상", cCols[3], { color: "007A33", bold: true })]),
    r([c("8", cCols[0], { center: true, fill: LIGHT }), c("프랜차이즈 분석", cCols[1], { fill: LIGHT, bold: true }), c("공정위 (franchise) + 카카오", cCols[2], { fill: LIGHT }), c("정상", cCols[3], { fill: LIGHT, color: "007A33", bold: true })]),
    r([c("9", cCols[0], { center: true }), c("배달/테이크아웃", cCols[1], { bold: true }), c("baeminTpbiz + delivery (제거됨)", cCols[2]), c("delivery 잔존 참조", cCols[3], { color: "CC6600" })]),
    r([c("10", cCols[0], { center: true, fill: LIGHT }), c("SNS/온라인", cCols[1], { fill: LIGHT, bold: true }), c("나이스비즈맵 (biz_popular_menu) + 네이버 blog (미구현)", cCols[2], { fill: LIGHT }), c("blog 수집 없음", cCols[3], { fill: LIGHT, color: "CC0000" })]),
    r([c("11", cCols[0], { center: true }), c("상권 변화 추이", cCols[1], { bold: true }), c("소상공인365 (storeChng, recentCloseBiz)", cCols[2]), c("정상", cCols[3], { color: "007A33", bold: true })]),
    r([c("12", cCols[0], { center: true, fill: LIGHT }), c("경쟁 밀집도", cCols[1], { fill: LIGHT, bold: true }), c("카카오 + filterByRadius + storeRadius", cCols[2], { fill: LIGHT }), c("정상", cCols[3], { fill: LIGHT, color: "007A33", bold: true })]),
    r([c("13", cCols[0], { center: true }), c("날씨/계절성", cCols[1], { bold: true }), c("기상청 (weather) + 소상공인365 (monthTrend)", cCols[2]), c("정상", cCols[3], { color: "007A33", bold: true })]),
    r([c("14", cCols[0], { center: true, fill: LIGHT }), c("AI 종합 분석", cCols[1], { fill: LIGHT, bold: true }), c("Gemini (전체 데이터 기반 프롬프트)", cCols[2], { fill: LIGHT }), c("정상", cCols[3], { fill: LIGHT, color: "007A33", bold: true })]),
  ]}));

  ch.push(pb());

  // === 5. 출처 표기 통합 정비 ===
  ch.push(h1("5. 출처 표기 통합 정비"));
  ch.push(p("개별 카드 하단의 출처 태그를 제거하고, 전체 보고서 하단에 통합 출처 버튼을 신설했습니다."));
  ch.push(sp());

  ch.push(h2("5-1. 변경 전"));
  ch.push(sp());
  const bfCols = [3000, 6360];
  ch.push(new Table({ width: { size: TABLE_W, type: WidthType.DXA }, columnWidths: bfCols, rows: [
    r([c("형태", bfCols[0], { fill: LIGHT, bold: true }), c("각 카드 하단에 metaInfo 태그 (예: '카페 현황', '고객', '매출')", bfCols[1], { fill: LIGHT })]),
    r([c("위치", bfCols[0], { bold: true }), c("CardTemplate.jsx 307~319줄 (metaInfo 렌더링 블록)", bfCols[1])]),
    r([c("문제점", bfCols[0], { fill: "FFF3CD", bold: true }), c("14개 카드마다 개별 태그가 불규칙하게 표시, API 출처와 불일치", bfCols[1], { fill: "FFF3CD", color: "856404" })]),
  ]}));
  ch.push(sp());

  ch.push(h2("5-2. 변경 후"));
  ch.push(sp());
  ch.push(new Table({ width: { size: TABLE_W, type: WidthType.DXA }, columnWidths: bfCols, rows: [
    r([c("삭제", bfCols[0], { fill: "D4EDDA", bold: true }), c("CardTemplate.jsx metaInfo 렌더링 JSX 전체 삭제", bfCols[1], { fill: "D4EDDA" })]),
    r([c("삭제", bfCols[0], { bold: true }), c("UnifiedLayout.jsx metaInfo={card.metaInfo} prop 전달 삭제", bfCols[1])]),
    r([c("신설", bfCols[0], { fill: "D4EDDA", bold: true }), c("보고서 최하단 '데이터 출처' 버튼 (우측 정렬, 반투명 배경)", bfCols[1], { fill: "D4EDDA" })]),
    r([c("모달", bfCols[0], { bold: true }), c("버튼 클릭 시 다크모드 모달 (#1a1a2e) - 14개 카드별 원천 데이터 리스트 표시", bfCols[1])]),
    r([c("닫기", bfCols[0], { fill: "D4EDDA", bold: true }), c("X 버튼 또는 배경 클릭으로 닫힘", bfCols[1], { fill: "D4EDDA" })]),
  ]}));

  ch.push(pb());

  // === 6. 수정 파일 목록 ===
  ch.push(h1("6. 수정 파일 목록"));
  ch.push(sp());

  const fCols = [4000, 5360];
  ch.push(new Table({ width: { size: TABLE_W, type: WidthType.DXA }, columnWidths: fCols, rows: [
    r([hCell("파일", fCols[0]), hCell("변경 내용", fCols[1])]),
    r([c("src/components/client-mode/CardTemplate.jsx", fCols[0], { bold: true }), c("metaInfo 렌더링 블록 삭제", fCols[1])]),
    r([c("src/components/client-mode/UnifiedLayout.jsx", fCols[0], { fill: LIGHT, bold: true }), c("metaInfo prop 삭제 + 기존 출처 텍스트 -> '데이터 출처' 버튼 + 모달 신설", fCols[1], { fill: LIGHT })]),
    r([c("src/components/client-mode/dataMapper.js", fCols[0], { bold: true }), c("Card 4 filterByRadius 적용 (이전 이슈에서 수정)", fCols[1])]),
    r([c("src/App.jsx", fCols[0], { fill: LIGHT, bold: true }), c("delivery openApiCalls 제거 (이전 이슈에서 수정)", fCols[1], { fill: LIGHT })]),
  ]}));

  ch.push(pb());

  // === 7. 후속 조치 권고 ===
  ch.push(h1("7. 후속 조치 권고"));
  ch.push(p("감사 결과 발견된 이슈에 대한 우선순위별 권고 사항입니다."));
  ch.push(sp());

  const rcCols = [600, 2400, 2200, 4160];
  ch.push(new Table({ width: { size: TABLE_W, type: WidthType.DXA }, columnWidths: rcCols, rows: [
    r([hCell("순위", rcCols[0]), hCell("항목", rcCols[1]), hCell("우선도", rcCols[2]), hCell("권고 조치", rcCols[3])]),
    r([
      c("1", rcCols[0], { center: true, fill: "F8D7DA" }),
      c("openubSales 키 불일치", rcCols[1], { fill: "F8D7DA", bold: true }),
      c("HIGH", rcCols[2], { fill: "F8D7DA", color: "721C24", bold: true }),
      c("collectedData.openubBuildingSales -> apis.openubSales 매핑 수정", rcCols[3], { fill: "F8D7DA" })
    ]),
    r([
      c("2", rcCols[0], { center: true }),
      c("naverBlog 수집 없음", rcCols[1], { bold: true }),
      c("MEDIUM", rcCols[2], { color: "CC6600", bold: true }),
      c("네이버 검색 API로 blogMentions 수집 로직 신규 구현", rcCols[3])
    ]),
    r([
      c("3", rcCols[0], { center: true, fill: LIGHT }),
      c("delivery 잔존 참조", rcCols[1], { fill: LIGHT, bold: true }),
      c("MEDIUM", rcCols[2], { fill: LIGHT, color: "CC6600", bold: true }),
      c("Card 9 dataMapper에서 deliveryData 참조 정리", rcCols[3], { fill: LIGHT })
    ]),
    r([
      c("4", rcCols[0], { center: true }),
      c("미사용 수집 15건+", rcCols[1], { bold: true }),
      c("LOW", rcCols[2], { color: "228B22", bold: true }),
      c("카드 확장 시 활용 또는 수집 비용 절감을 위해 제거", rcCols[3])
    ]),
    r([
      c("5", rcCols[0], { center: true, fill: LIGHT }),
      c("cafeTimeData 비활성화", rcCols[1], { fill: LIGHT, bold: true }),
      c("LOW", rcCols[2], { fill: LIGHT, color: "228B22", bold: true }),
      c("if(false) 의도 확인 후 활성화 또는 완전 제거", rcCols[3], { fill: LIGHT })
    ]),
  ]}));

  // footer
  const doc = new Document({
    sections: [{
      headers: { default: new Header({ children: [new Paragraph({ alignment: AlignmentType.RIGHT, children: [new TextRun({ text: "V1.7 API 전수 감사 보고", font: "Arial", size: 16, color: "999999" })] })] }) },
      footers: { default: new Footer({ children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: "빈크래프트 영업관리 | ", font: "Arial", size: 16, color: "999999" }), new TextRun({ children: [PageNumber.CURRENT], font: "Arial", size: 16, color: "999999" }), new TextRun({ text: " / ", font: "Arial", size: 16, color: "999999" }), new TextRun({ children: [PageNumber.TOTAL_PAGES], font: "Arial", size: 16, color: "999999" })] })] }) },
      children: ch
    }]
  });

  const outPath = path.join("C:", "Users", "user", "OneDrive", "바탕 화면", "V1.7_API전수감사_보고.docx");
  const buf = await Packer.toBuffer(doc);
  fs.writeFileSync(outPath, buf);
  console.log("Report created:", outPath, `(${(buf.length/1024).toFixed(1)}KB)`);
}

main().catch(e => { console.error(e); process.exit(1); });
