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
const sep = () => new Paragraph({ spacing: { before: 100 }, border: { bottom: { style: BorderStyle.SINGLE, size: 1, color: "DDDDDD", space: 4 } } });

// ALL 14 cards with ACTUAL output from app
const cards = [
  {
    num: "01", key: "overview", persona: "Rational_Market_Analyst", chars: 197, result: "PASS",
    head: "경쟁 치열한 상권, 차별화 전략으로 기회 창출",
    body: "서울 강남구 역삼동 804 일대에는 262개의 카페가 운영 중이며, 이 중 개인 카페가 168개로 다수를 차지해요. 월평균 매출은 1억 940만원으로 높은 상권임을 보여주지만, 경쟁 강도 역시 상당해요. 월세는 평균 238만원으로 추정되며, 월 매출 738만원 이상을 달성해야 손익분기점을 넘을 수 있어요. 이 지역은 높은 잠재 고객 수를 바탕으로 안정적인 매출을 기대할 수 있음."
  },
  {
    num: "02", key: "consumers", persona: "Consumer_Behavior_Expert", chars: 137, result: "PASS",
    head: "방문 40대, 소비 30대임을 인지한 전략 필요",
    body: "방문객 1위는 40대지만, 실제 소비를 주도하는 연령대는 30대예요. 40대 방문객만 보고 메뉴나 인테리어를 기획하면 실제 매출로 이어지기 어려울 수 있어요. 이 지역의 30대 소비 특성을 정확히 파악하고 그에 맞는 전략을 세워야 함을 의미해요."
  },
  {
    num: "03", key: "franchise", persona: "Franchise_Killer", chars: 404, result: "PASS",
    head: "프랜차이즈 집중 상권, 개인 카페 차별화 필수",
    body: "이 상권에는 총 260개의 카페가 있고, 그중 92개가 프랜차이즈 카페예요. 스타벅스가 7개, 메가MGC커피 7개, 매머드커피 6개, 텐퍼센트커피 6개, 커피빈 6개, 투썸플레이스 5개 등으로 특정 브랜드의 집중도가 높아요. 이런 프랜차이즈들은 본사의 강력한 마케팅과 인지도를 바탕으로 고객을 유인하지만, 가맹비 6,900만원에서 1억 3천만 원, 월 매출의 3~5%에 달하는 로열티, 그리고 본사 지정 식자재 구매로 인한 높은 원가 부담이 있어요. 메뉴 개발의 자유도도 없어서 주변 168개의 개인 카페들과 차별화하기가 어렵죠. 개인 카페는 이런 고정 지출과 본사 정책의 제약 없이 메뉴와 운영을 유연하게 가져갈 수 있다는 강점이 있어요."
  },
  {
    num: "04", key: "indieCafe", persona: "Indie_Space_Architect", chars: 390, result: "PASS",
    head: "개인 카페는 차별화 전략으로 경쟁 우위 확보 가능",
    body: "이 상권은 총 260개의 카페가 있는데, 그중 개인 카페가 168개로 절반 이상을 차지해요. 주시브로스 GFC점, 킷커피, 카페드몽슈슈 GFC점처럼 가까운 곳에 이미 많은 개인 카페들이 경쟁하고 있어요. 여기서 개인 카페의 강점은 메뉴와 가격을 자유롭게 설정해서 독자적인 브랜딩을 할 수 있다는 점이에요. 프랜차이즈와 달리 로열티가 없으니 매출 100%가 본인 수익이 되고, 원재료 선택도 자유로워서 원가 절감도 가능해요. 30대 소비가 가장 높은 이 상권에서 시즌 메뉴나 지역 특화 메뉴를 개발하고, SNS 감성을 자극하는 공간을 만들면 충성 고객 확보 가능."
  },
  {
    num: "05", key: "cafeSales", persona: "Profit_Maximizer", chars: 349, result: "PASS",
    head: "높은 매출과 낮은 임대료 비중으로 안정적 운영 가능성 확인",
    body: "이 상권의 카페 평균 월매출은 8,481만원으로 높게 형성되어 있어요. 본전을 뽑는 월매출 982만원을 훨씬 뛰어넘는 수치죠. 특히, 이 지역의 월세가 매출에서 차지하는 비중은 3% 수준으로 매우 낮아서, 임대료 부담이 적은 편이에요. 또한, 카페 업종은 타 업종 대비 원재료비율이 낮은 편이라 객단가 상승 여지가 크다는 장점이 있습니다. 프랜차이즈와 달리 개인 카페는 시그니처 메뉴 개발이나 프리미엄 전략을 통해 객단가를 더욱 높일 수 있거든요. 이 수치는 통계 평균이에요. 실제로는 입지와 운영 역량에 따라 20% 이상 차이가 나는 점을 고려해야 해요."
  },
  {
    num: "06", key: "rent", persona: "Real_Estate_Strategist", chars: 399, result: "PASS",
    head: "공공데이터 vs 현장 시세 15-20% 괴리 존재",
    body: "이 상권의 월세는 238만원, 보증금은 2,380만원 수준으로 파악돼요. 이건 한국부동산원 기준 서울 평균치인데, 실제 현장에서는 권리금이나 시세가 반영되면 이보다 15~20% 높게 형성될 수 있다는 점을 고려해야 해요. 월세가 매출에서 차지하는 비중은 3%로 양호한 수준이에요. 임대료가 15%를 넘으면 위험 신호인데, 이 지역은 매우 안정적인 편이죠. 투자금 회수 기간은 약 2개월로 계산됐는데, 이건 공공데이터 기준이라 실제 창업 비용(인테리어, 집기 등)을 포함하면 6개월~1년으로 볼 수 있어요. 프랜차이즈는 여기에 가맹비+인테리어 표준화 비용이 추가되지만, 개인 카페는 이 비용을 절약하고 자유로운 컨셉에 투자 가능."
  },
  {
    num: "07", key: "floatingTime", persona: "Flow_Efficiency_Analyst", chars: 422, result: "PASS",
    head: "30대 소비층 고려, 12-15시 피크타임 집중 운영 필요",
    body: "이 상권은 시간대별 유동인구 데이터가 명확하게 나오지 않지만, 소비 1위 연령층이 30대라는 점을 고려해야 해요. 30대 직장인과 젊은 세대의 라이프스타일을 보면, 주로 점심시간인 12시부터 15시 사이에 카페 방문이 집중됨. 이 피크타임에 인력과 기기를 집중 배치하여 회전율을 극대화하고, 비피크 시간대(10-12시, 15-17시)에는 최소 인력으로 운영하여 인건비를 절감하는 전략이 필요해요. 특히, 이 지역의 유동인구는 역삼역과 강남역 사이의 오피스 밀집 지역 특성상 평일 점심시간에 급격히 증가하는 패턴을 보임."
  },
  {
    num: "08", key: "risk", persona: "Global_Anchor_Controller", chars: 341, result: "PASS", anchor: true,
    head: "3대 리스크: 경쟁과밀 / 생존율 / 고정비",
    body: "[1] 경쟁 과밀 - 차별화 없으면 매출 분산. 반경 500m 내 카페 260개, km2당 331개. 평균 이상 매출을 내려면 메뉴/가격/경험 중 최소 2가지에서 차별화 필요.\n[2] 1년 안에 계속 운영될 확률 60% 미만 - 초기 6개월이 고비. 숙박음식점업 1년 운영 확률 58%. 초기 6개월 운영자금(월 고정비 x 6) 반드시 확보.\n[3] 높은 고정비 - 매출 변동 시 리스크. 월 임대료 238만원 + 인건비 350만 + 기타 50만 = 고정비만 월 638만원. 비수기(1~2월, 7~8월) 매출 하락 시 현금흐름 악화."
  },
  {
    num: "09", key: "opportunity", persona: "Opportunity_Hunter", chars: 760, result: "PASS",
    head: "높은 수요와 낮은 임대료 비중으로 기회 존재",
    body: "이 상권은 카페 수가 260개로 매우 많지만, 이건 역설적으로 카페 수요가 높다는 증거예요. 월 238만원의 임대료는 평균 매출 8,481만원 대비 3% 수준으로, 임대료 부담이 상대적으로 낮은 편이에요. 본전을 뽑으려면 월 982만원 이상 벌어야 하는데, 평균 매출이 훨씬 높다는 건 수익 창출 여력이 충분하다는 의미. 특히 이 지역은 30대 소비층이 주력이라 트렌드에 민감하고 소비력이 높은 고객층을 확보할 수 있어요. 개인 카페는 프랜차이즈와 달리 메뉴 개발의 유연성이 있어서, 30대 취향에 맞는 스페셜티 커피나 디저트 페어링으로 차별화 가능. 빵/도넛 60개 업소 월 1.2억 매출 데이터는 디저트 시너지 기회."
  },
  {
    num: "10", key: "snsAnaly", persona: "Trend_Weaponizer", chars: 29, result: "FAIL", anchor: true,
    head: "인기메뉴: 한라봉젤리, 연어샌드위치, 망고아이스크림.",
    body: "인기메뉴: 한라봉젤리, 연어샌드위치, 망고아이스크림."
  },
  {
    num: "11", key: "delivery", persona: "Operational_Tactician", chars: 686, result: "PASS",
    head: "카페 배달은 수익 구조 분석 후 객단가 높이는 전략 필요",
    body: "이 상권은 배달 수요가 높은 편이지만, 카페 배달은 수익 구조를 면밀히 분석해야 해요. 배달 1건당 중개수수료 6.8%와 배달대행비 3,000~4,000원, 포장재 500원까지 합치면 5,000원짜리 음료 한 잔 배달 시 오히려 적자가 발생할 수 있어요. 배달을 통한 실질 순이익을 높이려면 병음료 세트(15,000원)나 디저트+음료 세트(12,000원)처럼 객단가를 높이는 전략이 필수적이에요. 여성 고객 비율이 51.8%로 높고 쇼핑, 식도락에 관심이 많다는 점을 고려해 여성 타겟의 디저트 배달 메뉴 개발도 방법. 개인 카페는 시그니처 메뉴나 독특한 디저트 세트를 자유롭게 구성하여 배달 시장에서 차별점을 만들 수 있음."
  },
  {
    num: "12", key: "weather", persona: "Operational_Tactician", chars: 106, result: "PASS",
    head: "날씨 변동 민감 지역, 우천 대응 필수",
    body: "서울 강남구 역삼동 804 지역은 유동인구 의존도가 높아 날씨 변동에 민감합니다. 비 오는 날 매출이 -20%까지 떨어질 수 있어요. 우천 시 테이크아웃 프로모션이나 배달 강화를 준비하세요."
  },
  {
    num: "13", key: "survival", persona: "Asset_Value_Predictor", chars: 559, result: "PASS",
    head: "카페 5년 생존율 22.8%, 준비가 핵심",
    body: "숙박/음식점업에서 가게가 5년간 계속 운영될 확률은 22.8%. 10개 중 8개가 5년 안에 문 닫는다는 데이터인데, 이 숫자는 준비 없이 들어갔을 때의 현실을 보여줌. 이 상권에 카페가 260개나 있다는 건 수요가 많다는 뜻이기도 하지만, 그만큼 경쟁이 매우 치열함. 임대료는 월 238만원 수준인데 15% 이상 차지하면 운영에 큰 부담. 프랜차이즈는 본사 매뉴얼에 갇혀 상권 변화에 느리게 대응하지만, 개인 카페는 메뉴나 컨셉을 유연하게 바꿀 수 있어서 생존율을 스스로 높일 수 있는 기회가 있음. 빈크래프트는 입지 분석부터 메뉴 개발, 경쟁사 분석, 운영 교육까지 체계적인 준비를 도와 폐업 리스크를 줄이고 생존율을 높이는 데 집중."
  },
  {
    num: "14", key: "finalVerdict", persona: "Chief_Beancraft_Director", chars: 297, result: "PASS",
    head: "최종: 262개 카페 경쟁 속 차별화 전략으로 승부",
    body: "서울 강남구 역삼동 804 일대에는 262개의 카페가 운영 중이며, 이 중 개인 카페가 168개로 다수를 차지해요. 월평균 매출은 1억 940만원으로 높은 상권임을 보여주지만, 경쟁 강도 역시 상당해요. 월세는 평균 238만원으로 추정되며, 월 매출 738만원 이상을 달성해야 손익분기점을 넘을 수 있어요. 이 지역은 높은 잠재 고객 수를 바탕으로 안정적인 매출을 기대할 수 있으나, 치열한 경쟁 속에서 살아남기 위해서는 명확한 차별화 전략과 철저한 준비가 필수."
  },
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
        new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 120 }, children: [new TextRun({ text: "Full Card Output Report", font: "Arial", size: 32, color: "555555" })] }),
        new Paragraph({ spacing: { before: 400 } }),
        new Paragraph({ alignment: AlignmentType.CENTER, border: { top: { style: BorderStyle.SINGLE, size: 2, color: ACCENT, space: 8 } }, spacing: { after: 80 }, children: [new TextRun({ text: "14 Personas | Sequential Anchor | Cold Consultant Tone", font: "Arial", size: 22, color: "666666" })] }),
        new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 80 }, children: [new TextRun({ text: "2026-04-13 | Gangnam Stn Exit 1 (500m) | 13/14 Cards OK", font: "Arial", size: 20, color: "888888" })] }),
        new Paragraph({ alignment: AlignmentType.CENTER, border: { bottom: { style: BorderStyle.SINGLE, size: 2, color: ACCENT, space: 8 } }, children: [new TextRun({ text: "Total: 5,702 chars (29 blocks) | Anchor 4s + Normal 13s = 17s", font: "Arial", size: 18, color: "AAAAAA" })] }),
      ]
    },
    // CONTENT
    { properties: { page: { size: { width: 12240, height: 15840 }, margin: { top: 1440, right: 1440, bottom: 1440, left: 1440 } } },
      headers: { default: new Header({ children: [new Paragraph({ alignment: AlignmentType.RIGHT, children: [new TextRun({ text: "BEANCRAFT v11.6.1 FINAL - 14 Agent Full Output", font: "Arial", size: 16, color: "999999", italics: true })] })] }) },
      footers: { default: new Footer({ children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: "Page ", font: "Arial", size: 16, color: "999999" }), new TextRun({ children: [PageNumber.CURRENT], font: "Arial", size: 16, color: "999999" })] })] }) },
      children: [
        // S1: Architecture + Anchor Log (compact)
        st("1. System & Anchor Log"),
        mt(["Item", "Value"], [
          ["Architecture", "Market_Adaptive_Decentralized_Agents (14 Personas)"],
          ["Anchor", "Card 08 (risk) + Card 10 (snsAnaly) -> 12 cards"],
          ["Anchor Time", "4s (16:43:23 -> 16:43:27)"],
          ["Normal Time", "13s (16:43:27 -> 16:43:40)"],
          ["AI Calls", "14/14 (13 success, 1 skip: insight)"],
          ["Total Output", "5,702 chars / 29 blocks / 150+ blocks: 10"],
          ["Tone", "Cold Consultant (~im/~ham)"],
        ], [2400, 6960]),

        // S2: Quality
        new Paragraph({ children: [new PageBreak()] }),
        st("2. Quality Summary"),
        mt(["Card", "Persona", "Chars", "Result", "Headline"],
          cards.map(c => ["Card " + c.num, c.persona, String(c.chars), c.result, c.head.substring(0,35)]),
          [800, 2200, 700, 700, 4960]),
        new Paragraph({ spacing: { after: 100 } }),
        bt("PASS: 13/14 | FAIL: 1/14 (Card 10 snsAnaly 29ch)"),

        // S3: ALL 14 Card Outputs
        new Paragraph({ children: [new PageBreak()] }),
        st("3. Card-by-Card Actual Output (14/14)"),
        bt("앱 화면에서 직접 추출한 실제 AI 출력 전문입니다."),

        // Generate all 14 cards
        ...cards.flatMap((c, idx) => {
          const color = c.result === "FAIL" ? RED : c.anchor ? GREEN : ACCENT;
          const tag = c.anchor ? " [ANCHOR]" : "";
          const items = [
            sub("Card " + c.num + ": " + c.persona + tag),
            mt(["Metric","Value"], [
              ["Output Length", c.chars + "자"],
              ["Result", c.result],
              ["Headline", c.head],
            ], [2000, 7360]),
            bt("AI Output:", { bold: true }),
          ];
          // Split body by \n for multi-block cards
          c.body.split("\n").forEach(line => {
            items.push(ab(line, color));
          });
          if (c.result === "FAIL") {
            items.push(bt("[FAIL] snsAnaly API 데이터 부족. 키워드 카운트만 제공하여 시그니처 시나리오 생성 실패. Naver Blog/Instagram API 연결 필요.", { color: RED, italics: true }));
          }
          items.push(sep());
          return items;
        }),

        // S4: Gaps
        new Paragraph({ children: [new PageBreak()] }),
        st("4. Remaining Gaps & Gemini Memo"),
        mt(["Item", "Status", "Memo", "Priority"], [
          ["Card 10 SNS 29자", "FAIL", "snsAnaly API 키워드 카운트만 제공. Naver Blog/Instagram API 필요.", "HIGH"],
          ["톤 준수율", "부분", "~해요/~거든요 잔존. Gemini 프롬프트 무시 경우 있음. 후처리 필터 필요.", "HIGH"],
          ["User Settings UI", "미구현", "window.__USER_SETTINGS__ 읽기 완료. UI 저장 로직 미구현.", "HIGH"],
          ["3-Part Format 태그", "미준수", "[핵심 통찰][데이터 근거][실전 액션] 태그 없이 자연어 출력.", "MEDIUM"],
          ["팩트 검증 필터", "미구현", "AI 출력 수치 vs API 원시 데이터 자동 교차검증.", "MEDIUM"],
        ], [1600, 900, 5260, 1000]),

        // S5: Conclusion
        new Paragraph({ children: [new PageBreak()] }),
        st("5. Conclusion"),
        ...[
          "14개 카드 전체 AI 호출: 13/14 출력 정상",
          "Sequential Anchor: risk+snsAnaly 4초 -> 12개 카드 맥락 주입 -> 13초 완료",
          "총 AI 출력: 5,702자 (29블록) - v11.6 대비 36% 증가",
          "14개 전문 페르소나: Rational_Market_Analyst ~ Chief_Beancraft_Director",
          "최대 출력 카드: Card 09 opportunity 760자, Card 11 delivery 686자, Card 13 survival 559자",
          "Card 08 risk ANCHOR 341자: 3대 리스크 수치 경고 정상 작동",
          "Card 10 snsAnaly ANCHOR 29자: FAIL (원천 데이터 부족)",
          "Cold Consultant 톤 부분 준수: ~해요 잔존, 후처리 필터 필요",
        ].map(t => new Paragraph({ numbering: { reference: "bullets", level: 0 }, spacing: { after: 80 }, children: [new TextRun({ text: t, font: "Arial", size: 20, color: "333333" })] })),
        new Paragraph({ spacing: { before: 300 }, border: { top: { style: BorderStyle.SINGLE, size: 2, color: ACCENT, space: 8 } }, children: [new TextRun({ text: "Next: Card 10 SNS 데이터 소스 -> 톤 후처리 필터 -> User Settings UI -> 3-Part Format -> 전체 검수", font: "Arial", size: 20, bold: true, color: NAVY })] }),
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
