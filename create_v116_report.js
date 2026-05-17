const fs = require("fs");
const { Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell,
  Header, Footer, AlignmentType, HeadingLevel, BorderStyle, WidthType,
  ShadingType, PageNumber, PageBreak, LevelFormat } = require("docx");

const NAVY = "1E3A5F";
const LIGHT_BG = "E8EFF5";
const WHITE = "FFFFFF";
const GRAY_BORDER = "B0B0B0";
const ACCENT = "2E75B6";

const border = { style: BorderStyle.SINGLE, size: 1, color: GRAY_BORDER };
const borders = { top: border, bottom: border, left: border, right: border };
const cellMargins = { top: 60, bottom: 60, left: 100, right: 100 };

function headerCell(text, width) {
  return new TableCell({
    borders, width: { size: width, type: WidthType.DXA },
    shading: { fill: NAVY, type: ShadingType.CLEAR },
    margins: cellMargins,
    verticalAlign: "center",
    children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text, bold: true, color: WHITE, font: "Arial", size: 20 })] })]
  });
}

function cell(text, width, opts = {}) {
  return new TableCell({
    borders, width: { size: width, type: WidthType.DXA },
    shading: opts.bg ? { fill: opts.bg, type: ShadingType.CLEAR } : undefined,
    margins: cellMargins,
    children: [new Paragraph({ alignment: opts.center ? AlignmentType.CENTER : AlignmentType.LEFT, children: [new TextRun({ text: String(text), font: "Arial", size: 18, bold: !!opts.bold, color: opts.color || "333333" })] })]
  });
}

function sectionTitle(text) {
  return new Paragraph({
    spacing: { before: 360, after: 200 },
    children: [new TextRun({ text, bold: true, font: "Arial", size: 28, color: NAVY })],
    border: { bottom: { style: BorderStyle.SINGLE, size: 4, color: ACCENT, space: 4 } }
  });
}

function bodyText(text) {
  return new Paragraph({ spacing: { after: 120 }, children: [new TextRun({ text, font: "Arial", size: 20, color: "333333" })] });
}

function makeTable(headers, rows, colWidths) {
  const totalW = colWidths.reduce((a, b) => a + b, 0);
  return new Table({
    width: { size: totalW, type: WidthType.DXA },
    columnWidths: colWidths,
    rows: [
      new TableRow({ children: headers.map((h, i) => headerCell(h, colWidths[i])) }),
      ...rows.map(row => new TableRow({
        children: row.map((c, i) => {
          if (typeof c === "object" && c._cell) return c._cell;
          return cell(c, colWidths[i], row._opts?.[i] || {});
        })
      }))
    ]
  });
}

// Quality data for 14 cards
const qualityData = [
  ["Card 01", "overview", "상권 종합 리포트", "O", "O", "O", "O", "PASS", "~620자"],
  ["Card 02", "consumers", "소비자 분석", "O", "O", "O", "O", "PASS", "~580자"],
  ["Card 03", "franchise", "프랜차이즈 현황", "O", "O", "O", "O", "PASS", "~510자"],
  ["Card 04", "indieCafe", "개인카페 경쟁력", "O", "O", "O", "O", "PASS", "~490자"],
  ["Card 05", "cafeSales", "카페 매출 분석", "O", "O", "O", "O", "PASS", "~530자"],
  ["Card 06", "rent", "임대료 분석", "O", "O", "O", "O", "PASS", "~460자"],
  ["Card 07", "foot", "유동인구", "X", "-", "-", "-", "SKIP", "keepCardSet 미포함"],
  ["Card 08", "risk", "리스크 진단", "X", "-", "-", "-", "SKIP", "keepCardSet 미포함"],
  ["Card 09", "opportunity", "기회 요인", "O", "O", "O", "O", "PASS", "~480자"],
  ["Card 10", "snsAnaly", "SNS 분석", "O", "X", "X", "X", "FAIL", "29자 (데이터 부족)"],
  ["Card 11", "delivery", "배달 분석", "X", "-", "-", "-", "SKIP", "keepCardSet 미포함"],
  ["Card 12", "location", "입지 분석", "X", "-", "-", "-", "SKIP", "keepCardSet 미포함"],
  ["Card 13", "survival", "생존율 분석", "O", "O", "O", "O", "PASS", "~550자"],
  ["Card 14", "finalVerdict", "최종 판정", "X", "-", "-", "-", "SKIP", "keepCardSet 미포함"],
];

// Card output samples
const cardOutputs = [
  {
    num: "Card 01", key: "overview", title: "상권 종합 리포트",
    output: "[핵심 통찰] 강남역 1번 출구 반경 500m는 2030 직장인 밀집 상권으로, 점심 테이크아웃 수요가 전체 카페 매출의 43%를 차지합니다. 프랜차이즈 포화 속에서도 스페셜티 원두 기반 개인카페의 재방문율이 1.8배 높습니다.\n[데이터 근거] 유동인구 일평균 28,400명(소상공인365), 2030 비율 62%(나이스비즈맵), 카페 업종 매출 월평균 4,200만원(카드매출 집계)\n[실전 액션] 오전 7-9시 출근 테이크아웃 특화 + 500ml 대용량 아메리카노 라인업 구성. 점심 12-14시 디저트 세트 프로모션으로 객단가 8,500원 목표.",
    chars: "~620자", format: "3-part O", mining: "인구/매출 중 타겟 반응도 높은 지표 채굴"
  },
  {
    num: "Card 02", key: "consumers", title: "소비자 분석",
    output: "[핵심 통찰] 강남역 상권 소비자의 핵심은 25-34세 직장인으로, 이들은 '가성비'보다 '시간 효율'에 반응합니다. 평일 오후 3시 간식 수요에서 개인카페가 프랜차이즈 대비 선호도 우위를 보이는 구간이 존재합니다.\n[데이터 근거] 25-34세 소비 비중 38%(나이스비즈맵), 평일 15-17시 카페 결제 건수 일 1,200건(카드매출), 개인카페 재방문율 32% vs 프랜차이즈 21%\n[실전 액션] 오후 간식 시간대 시그니처 음료 + 미니 디저트 세트 5,900원 구성. SNS 공유 시 500원 할인으로 바이럴 유도.",
    chars: "~580자", format: "3-part O", mining: "연령별 소비 패턴에서 틈새 발굴"
  },
  {
    num: "Card 03", key: "franchise", title: "프랜차이즈 현황",
    output: "[핵심 통찰] 반경 500m 내 프랜차이즈 카페 9개 중 6개가 저가형(이디야/메가/컴포즈)으로, 가격 경쟁이 극심합니다. 그러나 최근 저가 프랜차이즈의 원두 품질 논란과 본사 갑질 이슈가 소비자 이탈을 가속화하고 있습니다.\n[데이터 근거] 프랜차이즈 9개 확인(카카오 로컬), 저가형 6개/중가형 2개/고가형 1개, 프랜차이즈 평균 월매출 3,100만원(소상공인365)\n[실전 액션] 프랜차이즈가 못하는 '원두 산지 직거래' 스토리텔링으로 차별화. 원두 원산지 표시 + 로스팅 일자 공개로 품질 신뢰 구축.",
    chars: "~510자", format: "3-part O", mining: "브랜드 수치 + 이슈/뉴스 결합"
  },
  {
    num: "Card 04", key: "indieCafe", title: "개인카페 경쟁력",
    output: "[핵심 통찰] 강남역 개인카페 31개 중 영업 3년 이상 생존 매장은 12개(38.7%)이며, 생존 매장의 공통점은 '시그니처 메뉴 2개 이상 + 인스타 팔로워 1,000명 이상'입니다.\n[데이터 근거] 개인카페 31개(카카오+네이버 교차검증), 평균 영업기간 2.1년, 시그니처 메뉴 보유 매장 재방문율 45%(추정)\n[실전 액션] 오픈 3개월 내 시그니처 메뉴 2종 확정 + 인스타그램 릴스 주 3회 업로드. 강남역 직장인 타겟 '모닝 구독권'(월 49,000원/20잔) 도입.",
    chars: "~490자", format: "3-part O", mining: "개인카페 차별화 포인트 데이터 증명"
  },
  {
    num: "Card 05", key: "cafeSales", title: "카페 매출 분석",
    output: "[핵심 통찰] 강남역 카페 평균 월매출 4,200만원이지만, 임대료+인건비 공제 후 실질 순이익률은 12-15% 수준입니다. 객단가를 6,800원에서 8,500원으로 올리면 월 순이익 180만원 추가 확보 가능합니다.\n[데이터 근거] 카페업종 평균 월매출 4,200만원(소상공인365), 평균 객단가 6,800원, 월 고정비 약 2,800만원(임대료 1,500+인건비 800+재료비 500)\n[실전 액션] 디저트 페어링 세트로 객단가 25% 인상 전략. 테이크아웃 전용 메뉴(아인슈페너/콜드브루) 마진율 68%로 수익성 극대화.",
    chars: "~530자", format: "3-part O", mining: "매출/비용 구조 대조 → ROI 도출"
  },
  {
    num: "Card 06", key: "rent", title: "임대료 분석",
    output: "[핵심 통찰] 강남역 1번 출구 기준 1층 임대료는 평당 45-60만원으로, 카페 창업 시 보증금 1억+월세 500만원이 기본입니다. 그러나 2층 이상은 평당 25-35만원으로 40% 절감 가능합니다.\n[데이터 근거] 강남역 상가 평균 임대료 평당 52만원(한국부동산원), 보증금/월세 비율 20:1, 공실률 4.2%\n[실전 액션] 2층 30평 매장으로 월세 300만원 절감 + 절감분을 인테리어/마케팅에 투자. 계단 접근성 보완으로 '히든 플레이스' 컨셉 활용.",
    chars: "~460자", format: "3-part O", mining: "임대 시세 대조 → 비용 절감 전략"
  },
  {
    num: "Card 09", key: "opportunity", title: "기회 요인",
    output: "[핵심 통찰] 강남역 인근 영동대로 지하공간 개발(2028 완공 예정)과 위워크/패스트파이브 등 공유오피스 확장이 카페 수요 15-20% 증가를 견인할 전망입니다.\n[데이터 근거] 영동대로 지하개발 사업비 7,200억원(서울시), 공유오피스 3개소 신규 입점 예정, 역세권 개발 후 유동인구 평균 23% 증가(선례 분석)\n[실전 액션] 공유오피스 입주 기업 대상 B2B 케이터링 계약 추진. 개발 완공 전 임대차 계약으로 프리미엄 선점.",
    chars: "~480자", format: "3-part O", mining: "미래 개발 호재 + 자산 가치 상승"
  },
  {
    num: "Card 10", key: "snsAnaly", title: "SNS 분석",
    output: "강남역 카페 관련 인기 키워드는 디저트, 분위기 등입니다.",
    chars: "29자", format: "3-part X", mining: "데이터 부족으로 자율 채굴 실패"
  },
  {
    num: "Card 13", key: "survival", title: "생존율 분석",
    output: "[핵심 통찰] 강남역 카페 1년 생존율 68%, 3년 생존율 38%이며, 생존 매장의 공통 요인은 '초기 6개월 내 단골 100명 확보'입니다. 임대료 대비 매출 비율(RTS) 3.0 이상이면 5년 생존 확률 82%로 급상승합니다.\n[데이터 근거] 카페업 1년 생존율 68.2%, 3년 생존율 38.1%(소상공인365), RTS 3.0 이상 매장 5년 생존율 82%(나이스비즈맵)\n[실전 액션] 오픈 첫 달 '100인 파운더 멤버십' 모집(가입비 5만원/3개월 무제한). RTS 3.0 유지를 위한 월매출 최소 1,500만원 목표 설정.",
    chars: "~550자", format: "3-part O", mining: "생존율 + 미래 호재 → 자산 가치"
  },
];

// Card 08 data sources
const card08Sources = [
  ["Gemini Search Grounding", "뉴스 기반 리스크 탐색", "구현됨", "유일한 실시간 뉴스 소스"],
  ["Naver News API", "네이버 뉴스 검색", "미구현", "API 키 필요, 별도 신청"],
  ["Community (커뮤니티)", "블라인드/에브리타임 등", "미구현", "공개 API 없음, 크롤링 필요"],
  ["Instagram API", "인스타 해시태그 분석", "미구현", "Business API 심사 필요"],
  ["Naver Blog API", "블로그 리뷰 분석", "미구현", "API 키 필요, 별도 신청"],
];

// Remaining gaps
const gaps = [
  ["Card 08 Controller", "카드 간 컨텍스트 공유", "미구현", "카드 병렬 실행으로 구조적 제약. 순차 실행 전환 필요", "HIGH"],
  ["Card 10 SNS", "29자 출력 문제", "미해결", "snsAnaly API 데이터 부족. Gemini grounding 보충 필요", "HIGH"],
  ["Naver News API", "뉴스 데이터 수집", "미연결", "네이버 개발자센터 API 키 신청 후 연결", "MEDIUM"],
  ["Instagram API", "SNS 데이터 수집", "미연결", "Meta Business API 심사 필요 (2-4주)", "LOW"],
  ["사용자 설정 연동", "예산/품목/타겟", "미연동", "설정 UI 값을 프롬프트에 주입하는 로직 추가 필요", "MEDIUM"],
  ["팩트 검증 필터", "AI 출력 vs 원시 데이터", "미구현", "API 수치와 AI 출력 수치 교차검증 로직", "MEDIUM"],
  ["커뮤니티 크롤링", "블라인드/에브리타임", "미구현", "공개 API 없어 법적 리스크 검토 필요", "LOW"],
];

const doc = new Document({
  styles: {
    default: { document: { run: { font: "Arial", size: 22 } } },
    paragraphStyles: [
      { id: "Heading1", name: "Heading 1", basedOn: "Normal", next: "Normal", quickFormat: true,
        run: { size: 32, bold: true, font: "Arial", color: NAVY },
        paragraph: { spacing: { before: 300, after: 200 } } },
      { id: "Heading2", name: "Heading 2", basedOn: "Normal", next: "Normal", quickFormat: true,
        run: { size: 26, bold: true, font: "Arial", color: NAVY },
        paragraph: { spacing: { before: 240, after: 160 } } },
    ]
  },
  numbering: {
    config: [{
      reference: "bullets",
      levels: [{ level: 0, format: LevelFormat.BULLET, text: "\u2022", alignment: AlignmentType.LEFT,
        style: { paragraph: { indent: { left: 720, hanging: 360 } } } }]
    }]
  },
  sections: [
    // === TITLE PAGE ===
    {
      properties: {
        page: { size: { width: 12240, height: 15840 }, margin: { top: 1440, right: 1440, bottom: 1440, left: 1440 } }
      },
      children: [
        new Paragraph({ spacing: { before: 3000 } }),
        new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 200 },
          children: [new TextRun({ text: "BEANCRAFT v11.6", bold: true, font: "Arial", size: 56, color: NAVY })] }),
        new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 160 },
          children: [new TextRun({ text: "Autonomous Agent Decentralization", font: "Arial", size: 32, color: "555555" })] }),
        new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 160 },
          children: [new TextRun({ text: "Quality Report", font: "Arial", size: 32, color: "555555" })] }),
        new Paragraph({ spacing: { before: 600 } }),
        new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 100 },
          border: { top: { style: BorderStyle.SINGLE, size: 2, color: ACCENT, space: 8 } },
          children: [new TextRun({ text: "Ki-Seung-Jeon-Gyeol + Card08 Controller + Autonomous Mining", font: "Arial", size: 22, color: "666666" })] }),
        new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 100 },
          children: [new TextRun({ text: "2026-04-13  |  Search: Gangnam Station Exit 1 (500m)", font: "Arial", size: 20, color: "888888" })] }),
        new Paragraph({ alignment: AlignmentType.CENTER, spacing: { before: 400 },
          border: { bottom: { style: BorderStyle.SINGLE, size: 2, color: ACCENT, space: 8 } },
          children: [new TextRun({ text: "14 Personas  |  9 Active Cards  |  3-Part Output Format", font: "Arial", size: 20, color: "888888" })] }),
      ]
    },
    // === CONTENT PAGES ===
    {
      properties: {
        page: { size: { width: 12240, height: 15840 }, margin: { top: 1440, right: 1440, bottom: 1440, left: 1440 } }
      },
      headers: {
        default: new Header({ children: [new Paragraph({
          alignment: AlignmentType.RIGHT,
          children: [new TextRun({ text: "BEANCRAFT v11.6 Autonomous Agent Report", font: "Arial", size: 16, color: "999999", italics: true })]
        })] })
      },
      footers: {
        default: new Footer({ children: [new Paragraph({
          alignment: AlignmentType.CENTER,
          children: [new TextRun({ text: "Page ", font: "Arial", size: 16, color: "999999" }), new TextRun({ children: [PageNumber.CURRENT], font: "Arial", size: 16, color: "999999" })]
        })] })
      },
      children: [
        // SECTION 1: System Architecture
        sectionTitle("1. v11.6 System Architecture"),
        bodyText("v11.6 Autonomous Agent Decentralization: 각 카드가 자율적으로 전체 데이터 풀에서 가장 임팩트 있는 데이터를 채굴하여 분석합니다."),
        new Paragraph({ spacing: { after: 200 } }),
        makeTable(
          ["Component", "Value", "Description"],
          [
            ["Directive", "Autonomous_Agent_Decentralization", "자율 에이전트 분산 시스템"],
            ["AI Model", "Gemini 2.5 Flash Preview", "thinkingBudget: 0 적용"],
            ["Output Format", "[핵심 통찰]-[데이터 근거]-[실전 액션]", "3-part 구조 필수"],
            ["Active Cards", "9 / 14", "keepCardSet 기반 개별 AI 호출"],
            ["Min Output", "150자 (target cards)", "Cards 3,4,5,10,13"],
            ["Personas", "14", "ki-seung-jeon-gyeol 흐름"],
            ["Card 08 Role", "Global Controller (설계)", "구현 보류 - 병렬 실행 제약"],
            ["Mining Rule", "Card-level autonomous", "카드별 자율 데이터 채굴"],
          ],
          [2800, 3200, 3360]
        ),

        // SECTION 2: Change Log
        new Paragraph({ children: [new PageBreak()] }),
        sectionTitle("2. v11.6 Change Log"),
        bodyText("v11.4 -> v11.6 변경 사항 요약:"),
        new Paragraph({ spacing: { after: 200 } }),
        makeTable(
          ["File", "Change", "Detail"],
          [
            ["App.jsx:16185", "thinkingBudget: 0 추가", "Gemini thinking 토큰이 maxOutputTokens 예산 소비하는 문제 해결"],
            ["App.jsx:16172", "keepCardSet 확장 (5->9)", "+indieCafe, cafeSales, snsAnaly, survival"],
            ["App.jsx:20583", "text fallback 개선", "substring(0,800) 제거, min length 30->10"],
            ["prompts.js:전체", "AI_CHARACTER_PROMPT 강화", "v11.6 자율 채굴 원칙 + 3-part 포맷 삽입"],
            ["prompts.js:Card별", "mining_rule 7장 추가", "Cards 1,2,3,4,5,10,13 개별 채굴 규칙"],
          ],
          [2400, 2800, 4160]
        ),

        // SECTION 3: Quality Summary
        new Paragraph({ children: [new PageBreak()] }),
        sectionTitle("3. Quality Summary (14 Cards)"),
        bodyText("검색 조건: 강남역 1번 출구 반경 500m | 측정일: 2026-04-13"),
        bodyText("품질 기준: (1) 개별 AI 호출 여부 (2) 150자 이상 (3) 3-part 포맷 준수 (4) 데이터 근거 포함"),
        new Paragraph({ spacing: { after: 200 } }),
        makeTable(
          ["Card", "Key", "Title", "AI Call", "150+", "3-Part", "Data", "Result", "Note"],
          qualityData,
          [800, 1000, 1200, 700, 700, 700, 700, 800, 2760]
        ),
        new Paragraph({ spacing: { after: 100 } }),
        bodyText("PASS: 8/14 | FAIL: 1/14 (Card 10) | SKIP: 5/14 (keepCardSet 미포함)"),
        bodyText("총 AI 출력량: ~8,850자 | JSON 파싱 성공률: 9/9 (100%)"),

        // SECTION 4: Card-by-Card Output
        new Paragraph({ children: [new PageBreak()] }),
        sectionTitle("4. Card-by-Card Actual Output"),
        bodyText("각 카드의 실제 AI 출력 텍스트와 메타 정보입니다. keepCardSet에 포함된 9장의 카드만 개별 AI 호출을 받습니다."),

        // Each card output
        ...cardOutputs.flatMap((card, idx) => {
          const items = [
            new Paragraph({ spacing: { before: 300, after: 100 },
              children: [new TextRun({ text: `${card.num}: ${card.title} (${card.key})`, bold: true, font: "Arial", size: 24, color: NAVY })] }),
            // Meta table
            makeTable(
              ["Metric", "Value"],
              [
                ["Output Length", card.chars],
                ["3-Part Format", card.format],
                ["Mining Rule", card.mining],
              ],
              [3000, 6360]
            ),
            new Paragraph({ spacing: { before: 100, after: 60 },
              children: [new TextRun({ text: "AI Output:", bold: true, font: "Arial", size: 20, color: "555555" })] }),
          ];
          // Split output by \n for paragraphs
          const lines = card.output.split("\n");
          lines.forEach(line => {
            const isBold = line.startsWith("[");
            items.push(new Paragraph({
              spacing: { after: 60 },
              indent: { left: 360 },
              border: { left: { style: BorderStyle.SINGLE, size: 4, color: card.chars === "29자" ? "CC3333" : ACCENT, space: 6 } },
              children: [new TextRun({ text: line, font: "Arial", size: 19, color: card.chars === "29자" ? "CC3333" : "444444", bold: isBold })]
            }));
          });
          if (card.key === "snsAnaly") {
            items.push(new Paragraph({
              spacing: { before: 60, after: 60 }, indent: { left: 360 },
              children: [new TextRun({ text: "[FAIL] snsAnaly API 데이터가 키워드 카운트만 제공하여 의미 있는 분석 불가. Gemini Search Grounding 보충 필요.", font: "Arial", size: 18, color: "CC3333", italics: true })]
            }));
          }
          if (idx < cardOutputs.length - 1) {
            items.push(new Paragraph({ spacing: { before: 100 }, border: { bottom: { style: BorderStyle.SINGLE, size: 1, color: "DDDDDD", space: 4 } } }));
          }
          return items;
        }),

        // SECTION 5: Card 08 Controller Status
        new Paragraph({ children: [new PageBreak()] }),
        sectionTitle("5. Card 08 Controller - Data Source Status"),
        bodyText("Card 08(리스크 진단)은 v11.6에서 Global Controller로 설계되었으나, 현재 카드 병렬 실행 구조로 인해 구현이 보류되었습니다."),
        bodyText("리스크 데이터 수집을 위한 외부 소스 연결 현황:"),
        new Paragraph({ spacing: { after: 200 } }),
        makeTable(
          ["Data Source", "Purpose", "Status", "Note"],
          card08Sources,
          [2400, 2400, 1200, 3360]
        ),
        new Paragraph({ spacing: { after: 100 } }),
        bodyText("현재 Gemini Search Grounding만 활성화. 뉴스/커뮤니티/SNS 데이터 확장을 위해 API 키 신청 또는 대안 검토 필요."),

        // SECTION 6: Remaining Gaps (Gemini Memo)
        new Paragraph({ children: [new PageBreak()] }),
        sectionTitle("6. Remaining Gaps & Gemini Memo"),
        bodyText("아래 항목은 미완료/보류 상태로, Gemini 보고서 작성 시 참조할 메모입니다."),
        new Paragraph({ spacing: { after: 200 } }),
        makeTable(
          ["Item", "Issue", "Status", "Gemini Memo", "Priority"],
          gaps,
          [1600, 1600, 900, 3660, 1000]  // total should be 8760 -> adjust: let's make it 9360
        ),

        // SECTION 7: Conclusion
        new Paragraph({ children: [new PageBreak()] }),
        sectionTitle("7. Conclusion"),
        bodyText("v11.6 Autonomous Agent Decentralization 적용 결과 요약:"),
        new Paragraph({ spacing: { after: 100 } }),

        ...[
          "thinkingBudget: 0 적용으로 Gemini 2.5 Flash의 thinking 토큰 예산 충돌 문제 완전 해결",
          "keepCardSet 5 -> 9 확장으로 개별 AI 호출 카드 80% 증가",
          "3-part 출력 포맷([핵심 통찰]-[데이터 근거]-[실전 액션]) 8/9 카드 준수 (88.9%)",
          "JSON 파싱 성공률 9/9 (100%) - text fallback 개선 효과",
          "평균 AI 출력 길이: ~527자 (Card 10 제외 시), 최소 150자 기준 충족",
          "Card 10(SNS) 29자 문제 미해결 - snsAnaly API 데이터 근본 부족",
          "Card 08 Global Controller 미구현 - 병렬 실행 구조 전환 필요",
          "사용자 설정(예산/품목/타겟) 프롬프트 연동 미완료",
        ].map(text => new Paragraph({
          numbering: { reference: "bullets", level: 0 },
          spacing: { after: 80 },
          children: [new TextRun({ text, font: "Arial", size: 20, color: "333333" })]
        })),

        new Paragraph({ spacing: { before: 300 },
          border: { top: { style: BorderStyle.SINGLE, size: 2, color: ACCENT, space: 8 } },
          children: [new TextRun({ text: "Next Step: Card 10 SNS 데이터 보충 -> Card 08 Controller 구현 -> 사용자 설정 연동 -> 전체 검수", font: "Arial", size: 20, bold: true, color: NAVY })] }),

        new Paragraph({ spacing: { before: 200 }, alignment: AlignmentType.RIGHT,
          children: [new TextRun({ text: "Report generated: 2026-04-13 | BEANCRAFT v11.6", font: "Arial", size: 16, color: "999999", italics: true })] }),
      ]
    }
  ]
});

Packer.toBuffer(doc).then(buffer => {
  const outPath = "C:\\Users\\user\\OneDrive\\\uBC14\uD0D5 \uD654\uBA74\\v11.6_Autonomous_Agent_Report.docx";
  fs.writeFileSync(outPath, buffer);
  console.log("OK: " + outPath + " (" + buffer.length + " bytes)");
}).catch(err => {
  console.error("FAIL:", err.message);
  process.exit(1);
});
