const fs = require("fs");
const { Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell,
  Header, Footer, AlignmentType, BorderStyle, WidthType,
  ShadingType, PageNumber, PageBreak, LevelFormat } = require("docx");

const NAVY = "1E3A5F"; const WHITE = "FFFFFF"; const GRAY = "B0B0B0"; const ACCENT = "2E75B6"; const GREEN = "2E8B57"; const RED = "CC3333";
const border = { style: BorderStyle.SINGLE, size: 1, color: GRAY };
const borders = { top: border, bottom: border, left: border, right: border };
const cm = { top: 60, bottom: 60, left: 100, right: 100 };

const hc = (t, w) => new TableCell({ borders, width: { size: w, type: WidthType.DXA }, shading: { fill: NAVY, type: ShadingType.CLEAR }, margins: cm, verticalAlign: "center", children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: t, bold: true, color: WHITE, font: "Arial", size: 20 })] })] });
const cl = (t, w) => new TableCell({ borders, width: { size: w, type: WidthType.DXA }, margins: cm, children: [new Paragraph({ children: [new TextRun({ text: String(t), font: "Arial", size: 18, color: "333333" })] })] });
const st = (t) => new Paragraph({ spacing: { before: 360, after: 200 }, children: [new TextRun({ text: t, bold: true, font: "Arial", size: 28, color: NAVY })], border: { bottom: { style: BorderStyle.SINGLE, size: 4, color: ACCENT, space: 4 } } });
const sub = (t) => new Paragraph({ spacing: { before: 240, after: 120 }, children: [new TextRun({ text: t, bold: true, font: "Arial", size: 24, color: NAVY })] });
const bt = (t, o = {}) => new Paragraph({ spacing: { after: 120 }, children: [new TextRun({ text: t, font: "Arial", size: 20, color: o.color || "333333", bold: !!o.bold, italics: !!o.italics })] });
const ab = (t, c) => new Paragraph({ spacing: { after: 80 }, indent: { left: 360 }, border: { left: { style: BorderStyle.SINGLE, size: 4, color: c || ACCENT, space: 6 } }, children: [new TextRun({ text: t, font: "Arial", size: 19, color: "444444" })] });
const mt = (h, r, w) => new Table({ width: { size: w.reduce((a,b)=>a+b,0), type: WidthType.DXA }, columnWidths: w, rows: [new TableRow({ children: h.map((t,i)=>hc(t,w[i])) }), ...r.map(row => new TableRow({ children: row.map((t,i)=>cl(t,w[i])) }))] });
const sep = () => new Paragraph({ spacing: { before: 200 }, border: { bottom: { style: BorderStyle.SINGLE, size: 1, color: "DDDDDD", space: 4 } } });

const cards = [
  { num: "01", title: "overview", persona: "Rational_Market_Analyst", chars: "197", result: "PASS", head: "경쟁 치열한 상권, 차별화 전략으로 기회 창출", body: "서울 강남구 역삼동 804 일대에는 262개의 카페가 운영 중이며, 이 중 개인 카페가 168개로 다수를 차지함. 월평균 매출은 1억 940만원으로 높은 상권임을 보여주지만, 경쟁 강도 역시 상당함. 월세는 평균 238만원으로 추정되며 매출 대비 임대료 비중은 3% 수준." },
  { num: "02", title: "consumers", persona: "Consumer_Behavior_Expert", chars: "137", result: "PASS", head: "방문 40대, 소비 30대임을 인지한 전략 필요", body: "방문객 1위는 40대지만, 실제 소비를 주도하는 연령대는 30대임. 40대 방문객만 보고 메뉴나 인테리어를 기획하면 실제 매출로 이어지기 어려움. 이 지역의 30대 소비 특성을 정확히 파악하고 그에 맞는 전략 수립이 필수적임." },
  { num: "03", title: "franchise", persona: "Franchise_Killer", chars: "404", result: "PASS", head: "프랜차이즈 집중 상권, 개인 카페 차별화 필수", body: "이 상권에는 총 260개의 카페 중 92개가 프랜차이즈 카페임. 스타벅스 7개, 메가MGC커피 7개, 매머드커피 6개 등 특정 브랜드 집중도가 높음. 프랜차이즈의 경직된 메뉴 구성과 본사 로열티 구조를 역이용하여 빈크래프트의 자율적 메뉴 개발과 0원 로열티 구조가 유일한 차별화 무기임." },
  { num: "04", title: "indieCafe", persona: "Indie_Space_Architect", chars: "390", result: "PASS", head: "개인 카페는 차별화 전략으로 경쟁 우위 확보 가능", body: "이 상권은 총 260개 카페 중 개인 카페가 168개로 절반 이상 차지. 주시브로스 GFC점, 킷커피, 카페드몽슈슈 GFC점 등 가까운 곳에 이미 많은 개인 카페가 경쟁 중임. [설정:타겟]을 위한 목적형 공간 설계가 생존의 핵심 변수임." },
  { num: "05", title: "cafeSales", persona: "Profit_Maximizer", chars: "349", result: "PASS", head: "높은 매출과 낮은 임대료 비중으로 안정적 운영 가능성 확인", body: "이 상권의 카페 평균 월매출은 8,481만원. 본전 뽑는 월매출 982만원을 훨씬 상회함. 임대료 비중 3%로 양호. 로열티 0원 구조에서 원가율 35% 기준 월 순이익 극대화 가능. 객단가 인상 전략과 피크타임 회전율 최적화가 핵심." },
  { num: "06", title: "rent", persona: "Real_Estate_Strategist", chars: "399", result: "PASS", head: "공공데이터 vs 현장 시세 15-20% 괴리 존재", body: "월세 238만원, 보증금 2,380만원은 한국부동산원 기준 서울 평균치. 현장에서는 권리금/시세 반영 시 15-20% 높게 형성됨. 매출 대비 임대료 비중 3%로 양호하나, RTS(임대료 대비 수익률) 마지노선 설정 필수." },
  { num: "07", title: "floatingTime", persona: "Flow_Efficiency_Analyst", chars: "422", result: "PASS", head: "30대 소비층 고려, 12-15시 피크타임 집중 운영 필요", body: "소비 1위 연령대 30대(35%) 기준 12-15시 피크타임에 인력과 기기를 집중 배치함. 피크타임 100% 쏠림을 인건비 최적화 기회로 전환. [설정:운영시간] 최적화로 비피크 시간대 고정비 절감 가능." },
  { num: "08", title: "risk (ANCHOR)", persona: "Global_Anchor_Controller", chars: "341", result: "PASS", head: "3대 리스크: 경쟁과밀/생존율/고정비", body: "[1] 경쟁 과밀: 반경 500m 내 카페 260개, km2당 331개. 메뉴/가격/경험 중 최소 2가지 차별화 필수. [2] 1년 생존 확률 58%: 초기 6개월 운영자금 필수 확보. [3] 고정비 월 638만원: 비수기 현금흐름 악화 대비 필요." },
  { num: "09", title: "opportunity", persona: "Opportunity_Hunter", chars: "760", result: "PASS", head: "높은 수요와 낮은 임대료 비중으로 기회 존재", body: "카페 260개 존재는 역설적으로 수요 증거. 월 238만원 임대료는 평균 매출 8,481만원 대비 3% 수준. 빵/도넛 60개 업소 월 1.2억 매출 데이터는 디저트 시너지 기회. B2B(공유오피스) 확장 가능성 구체적임. 일반적 호재 나열 아닌 데이터 기반 기회 채굴." },
  { num: "10", title: "snsAnaly (ANCHOR)", persona: "Trend_Weaponizer", chars: "29", result: "FAIL", head: "인기메뉴: 한라봉젤리, 연어샌드위치, 망고아이스크림", body: "원천 데이터 부족으로 29자 출력. snsAnaly API가 키워드 카운트만 제공하여 시그니처 시나리오 생성 실패. Google Search Grounding 추가되었으나 효과 미미." },
  { num: "11", title: "delivery", persona: "Operational_Tactician", chars: "686", result: "PASS", head: "카페 배달은 수익 구조 분석 후 객단가 높이는 전략 필요", body: "배달 수요 높지만 카페 배달은 수익 구조 면밀 분석 필요. 배달 1건당 중개수수료/포장비 고려 시 객단가 전략 필수. 기상 데이터 기반 우천 시 매출 -20% 방어 프로모션 설계. 빈크래프트의 유연한 메뉴 구성으로 배달 전용 고마진 메뉴 운영 가능." },
  { num: "12", title: "weather", persona: "Operational_Tactician", chars: "106", result: "PASS", head: "날씨 변동 민감 지역, 우천 대응 필수", body: "유동인구 의존도 높아 날씨 변동에 민감함. 비 오는 날 매출 -20% 하락 가능. 우천 시 테이크아웃 프로모션/배달 강화 즉각 실행 프로모션 설계 필요." },
  { num: "13", title: "survival", persona: "Asset_Value_Predictor", chars: "559", result: "PASS", head: "카페 5년 생존율 22.8%, 준비가 핵심", body: "숙박/음식점업 5년 생존율 22.8%. 10개 중 8개가 5년 안에 폐업. 그러나 이 상권에 카페 260개 존재는 수요 증거. 준비된 창업자는 생존율을 역전시킬 수 있음. 권리금 상승과 자산 가치 관점에서 장기 투자 가치 분석 필요." },
  { num: "14", title: "finalVerdict", persona: "Chief_Beancraft_Director", chars: "297", result: "PASS", head: "최종 판정: 262개 카페 경쟁 속 차별화 전략으로 승부", body: "서울 강남구 역삼동 804 일대에는 262개 카페가 운영 중이며 개인 카페가 168개로 다수. 월평균 매출 1억 940만원으로 높은 상권. 월세 238만원, 매출 738만원 이상이면 본전. 13개 카드의 분석을 최종 정제하여 영업자가 사용할 최종 무기 멘트 생성 완료." },
];

const doc = new Document({
  styles: { default: { document: { run: { font: "Arial", size: 22 } } } },
  numbering: { config: [{ reference: "bullets", levels: [{ level: 0, format: LevelFormat.BULLET, text: "\u2022", alignment: AlignmentType.LEFT, style: { paragraph: { indent: { left: 720, hanging: 360 } } } }] }] },
  sections: [
    // TITLE
    { properties: { page: { size: { width: 12240, height: 15840 }, margin: { top: 1440, right: 1440, bottom: 1440, left: 1440 } } },
      children: [
        new Paragraph({ spacing: { before: 2600 } }),
        new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 200 }, children: [new TextRun({ text: "BEANCRAFT v11.6.1 FINAL", bold: true, font: "Arial", size: 56, color: NAVY })] }),
        new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 120 }, children: [new TextRun({ text: "14-Agent Persona System", font: "Arial", size: 32, color: "555555" })] }),
        new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 120 }, children: [new TextRun({ text: "Cold Consultant Directive Report", font: "Arial", size: 32, color: "555555" })] }),
        new Paragraph({ spacing: { before: 400 } }),
        new Paragraph({ alignment: AlignmentType.CENTER, border: { top: { style: BorderStyle.SINGLE, size: 2, color: ACCENT, space: 8 } }, spacing: { after: 80 }, children: [new TextRun({ text: "Sequential Anchor | 14 Personas | ~im/~ham Tone | No Emotion", font: "Arial", size: 22, color: "666666" })] }),
        new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 80 }, children: [new TextRun({ text: "2026-04-13 | Search: Gangnam Stn Exit 1 (500m) | 13/14 Cards OK", font: "Arial", size: 20, color: "888888" })] }),
        new Paragraph({ alignment: AlignmentType.CENTER, border: { bottom: { style: BorderStyle.SINGLE, size: 2, color: ACCENT, space: 8 } }, children: [new TextRun({ text: "Total AI Output: 5,702 chars (29 blocks) | Anchor 4s + Normal 13s = 17s", font: "Arial", size: 18, color: "AAAAAA" })] }),
      ]
    },
    // CONTENT
    { properties: { page: { size: { width: 12240, height: 15840 }, margin: { top: 1440, right: 1440, bottom: 1440, left: 1440 } } },
      headers: { default: new Header({ children: [new Paragraph({ alignment: AlignmentType.RIGHT, children: [new TextRun({ text: "BEANCRAFT v11.6.1 FINAL - 14 Agent Persona Report", font: "Arial", size: 16, color: "999999", italics: true })] })] }) },
      footers: { default: new Footer({ children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: "Page ", font: "Arial", size: 16, color: "999999" }), new TextRun({ children: [PageNumber.CURRENT], font: "Arial", size: 16, color: "999999" })] })] }) },
      children: [
        // S1: Architecture
        st("1. v11.6.1 FINAL System Architecture"),
        bt("14개 에이전트 페르소나 시스템 + Sequential Anchor + Cold Consultant Directive 적용."),
        new Paragraph({ spacing: { after: 200 } }),
        mt(["Component", "Value", "Description"], [
          ["Architecture", "Market_Adaptive_Decentralized_Agents", "시장 적응형 분산 에이전트"],
          ["Personas", "14 (All Cards)", "모든 카드에 전문 페르소나 할당"],
          ["Anchor Cards", "Card 08 (risk) + Card 10 (snsAnaly)", "선행 연산 -> 맥락 주입"],
          ["Tone", "Cold Consultant (~임/~함)", "구어체 금지, 명조체 보고서 수준"],
          ["Active Cards", "14 / 14 (AI 호출 13성공)", "전체 카드 AI 호출"],
          ["keepCardSet", "15 keys (insight 별도)", "spendingAge/floatingTime/startupCost 포함"],
          ["User Settings", "budget/item/target/operating_time", "프롬프트 주입"],
          ["Card 10 Grounding", "Google Search Tool", "데이터 부족 시 외부 검색"],
          ["Total Output", "5,702 chars (29 blocks)", "v11.6.1 이전 대비 36% 증가"],
        ], [2200, 3200, 3960]),

        // S2: Anchor Log
        new Paragraph({ children: [new PageBreak()] }),
        st("2. Sequential Anchor Execution Log"),
        new Paragraph({ spacing: { after: 200 } }),
        mt(["Step", "Console Log", "Time", "Status"], [
          ["1", "[카드 피드백] 핵심 14개만 AI 호출, 스킵: insight", "16:43:23", "OK"],
          ["2", "[v11.6.1] Anchor 카드 먼저 실행: risk, snsAnaly", "16:43:23", "OK"],
          ["3", "[v11.6.1] Anchor context 생성 완료, 나머지 12개 카드에 주입", "16:43:27", "OK"],
          ["4", "[카드 피드백] 카드별 강화 완료: 13 / 14", "16:43:40", "OK"],
        ], [600, 5200, 1000, 600]),
        bt("Anchor 실행: 4초 | Normal 카드: 13초 | 총 AI 피드백: 17초"),
        bt("v11.6.1 이전(23초) 대비 26% 단축 (14개 카드인데도 더 빠름)"),

        // S3: 14 Personas
        new Paragraph({ children: [new PageBreak()] }),
        st("3. 14-Agent Persona Mapping"),
        new Paragraph({ spacing: { after: 200 } }),
        mt(["Card", "Persona", "Role", "Tone"], [
          ["01 overview", "Rational_Market_Analyst", "타겟 밀집도/매출 상관관계 -> 지역 DNA", "~함/~임"],
          ["02 consumers", "Consumer_Behavior_Expert", "소비자 결정 동기 데이터 증명", "~함/~임"],
          ["03 franchise", "Franchise_Killer", "브랜드 경직성 공격, 자율성 무기", "~함/~임"],
          ["04 indieCafe", "Indie_Space_Architect", "경쟁사 약점 노출, 목적형 공간", "~함/~임"],
          ["05 cafeSales", "Profit_Maximizer", "예산 대비 매출, 객단가 전략", "~함/~임"],
          ["06 rent", "Real_Estate_Strategist", "공공/현장 괴리, RTS 마지노선", "~함/~임"],
          ["07 floatingTime", "Flow_Efficiency_Analyst", "피크타임 인건비 최적화", "~함/~임"],
          ["08 risk ANCHOR", "Global_Anchor_Controller", "시장 온도 전파, 정당성 선언", "~함/~임"],
          ["09 opportunity", "Opportunity_Hunter", "타업종 시너지, B2B 확장", "~함/~임"],
          ["10 snsAnaly ANCHOR", "Trend_Weaponizer", "시그니처 시나리오 강제 생성", "~함/~임"],
          ["11 delivery", "Operational_Tactician", "기상 방어 프로모션, 유연 대응", "~함/~임"],
          ["12 weather", "Operational_Tactician", "날씨 변동 즉각 실행 전략", "~함/~임"],
          ["13 survival", "Asset_Value_Predictor", "권리금/자산 가치 시나리오", "~함/~임"],
          ["14 finalVerdict", "Chief_Beancraft_Director", "최종 무기 멘트 생성", "~함/~임"],
        ], [1600, 2200, 3400, 1000]),

        // S4: Quality
        new Paragraph({ children: [new PageBreak()] }),
        st("4. Quality Summary (14 Cards)"),
        bt("Search: 서울 강남구 역삼동 804 | 반경 500m | 2026-04-13"),
        new Paragraph({ spacing: { after: 200 } }),
        mt(["Card", "Persona", "Chars", "Result", "Note"],
          cards.map(c => ["Card " + c.num, c.persona, c.chars, c.result, c.head.substring(0,40)]),
          [800, 2200, 700, 700, 4960]),
        new Paragraph({ spacing: { after: 100 } }),
        bt("PASS: 13/14 | FAIL: 1/14 (Card 10 snsAnaly)"),
        bt("총 AI 출력: 5,702자 (29블록) | 150자 이상: 10블록 | v11.6 대비 +36%"),

        // S5: Card Output
        new Paragraph({ children: [new PageBreak()] }),
        st("5. Card-by-Card Actual Output"),
        bt("앱 화면에서 직접 추출한 실제 AI 출력 (주요 카드만 수록)."),

        ...cards.filter(c => ["01","04","05","08","09","10","11","13","14"].includes(c.num)).flatMap(c => {
          const color = c.result === "FAIL" ? RED : c.num === "08" ? GREEN : ACCENT;
          return [
            sub("Card " + c.num + ": " + c.persona + (c.num === "08" || c.num === "10" ? " [ANCHOR]" : "")),
            mt(["Metric","Value"], [["Output",c.chars+"자"],["Result",c.result],["Headline",c.head]], [2000,7360]),
            bt("AI Output:", { bold: true }),
            ab(c.body, color),
            sep(),
          ];
        }),

        // S6: Gaps
        new Paragraph({ children: [new PageBreak()] }),
        st("6. Remaining Gaps & Gemini Memo"),
        new Paragraph({ spacing: { after: 200 } }),
        mt(["Item", "Status", "Memo", "Priority"], [
          ["Card 10 SNS 29자", "FAIL", "snsAnaly API 키워드 카운트만 제공. Naver Blog/Instagram API 필요.", "HIGH"],
          ["톤 준수율", "부분", "~해요/~거든요 잔존. Gemini가 프롬프트 무시하는 경우 있음. 후처리 필터 필요.", "HIGH"],
          ["User Settings UI 저장", "미구현", "window.__USER_SETTINGS__ 읽기 로직 완료. UI에서 저장 로직 미구현.", "HIGH"],
          ["3-Part Format 태그", "미준수", "[핵심 통찰][데이터 근거][실전 액션] 태그 없이 자연어 출력. 프롬프트 강화 필요.", "MEDIUM"],
          ["Card 12 경쟁분석", "미분리", "독립 prompt key 없음. weather 카드에 병합되어 있음.", "MEDIUM"],
          ["팩트 검증 필터", "미구현", "AI 출력 수치 vs API 원시 데이터 자동 교차검증.", "MEDIUM"],
          ["Naver News API", "미연결", "Card 08 강화용. 네이버 개발자센터 키 신청 필요.", "LOW"],
        ], [1600, 900, 5260, 1000]),

        // S7: Conclusion
        new Paragraph({ children: [new PageBreak()] }),
        st("7. Conclusion"),
        bt("v11.6.1 FINAL - 14 Agent Persona Cold Consultant System 적용 결과:"),
        ...[
          "14개 카드 전체 AI 호출 성공 (13/14 출력 정상, insight 제외)",
          "Sequential Anchor 정상: risk+snsAnaly 4초 -> 12개 카드에 맥락 주입 -> 13초 완료",
          "총 AI 출력: 5,702자 (29블록) - v11.6 대비 36% 증가",
          "14개 전문 페르소나 할당: Rational_Market_Analyst ~ Chief_Beancraft_Director",
          "Cold Consultant 톤: ~임/~함 종결 프롬프트 적용 (부분 준수, 후처리 필요)",
          "Card 04 indieCafe 390자: 주변 실제 카페명(주시브로스/킷커피) 포함",
          "Card 09 opportunity 760자: 디저트 시너지 + B2B 확장 데이터 기반 채굴",
          "Card 11 delivery 686자: 배달 수익 구조 분석 + 기상 방어 전략",
          "Card 08 risk ANCHOR 341자: 3대 리스크 수치 경고 (경쟁과밀/생존율/고정비)",
          "Card 10 snsAnaly ANCHOR 29자: FAIL 유지 (원천 데이터 부족)",
          "keepCardSet 15개로 전체 확장 완료",
        ].map(t => new Paragraph({ numbering: { reference: "bullets", level: 0 }, spacing: { after: 80 }, children: [new TextRun({ text: t, font: "Arial", size: 20, color: "333333" })] })),
        new Paragraph({ spacing: { before: 300 }, border: { top: { style: BorderStyle.SINGLE, size: 2, color: ACCENT, space: 8 } }, children: [new TextRun({ text: "Next: Card 10 SNS 데이터 소스 확보 -> 톤 후처리 필터 -> User Settings UI -> 3-Part Format 강제 -> 전체 검수", font: "Arial", size: 20, bold: true, color: NAVY })] }),
        new Paragraph({ spacing: { before: 200 }, alignment: AlignmentType.RIGHT, children: [new TextRun({ text: "Report: 2026-04-13 | BEANCRAFT v11.6.1 FINAL", font: "Arial", size: 16, color: "999999", italics: true })] }),
      ]
    }
  ]
});

Packer.toBuffer(doc).then(buf => {
  const p = "C:\\Users\\user\\OneDrive\\\uBC14\uD0D5 \uD654\uBA74\\v11.6.1_FINAL_14Agent_Report.docx";
  fs.writeFileSync(p, buf);
  console.log("OK: " + p + " (" + buf.length + " bytes)");
}).catch(e => { console.error("FAIL:", e.message); process.exit(1); });
