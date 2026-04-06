// cafe-collect-proxy.js
// 카페 수집 3개 소스를 서버사이드에서 병렬 실행하는 통합 프록시
// 소스: storeRadius(공공데이터포털) + 카카오CE7 격자 + LOCALDATA(서울시 인허가)

// ── API 키 ──
const DATA_GO_KR_API_KEY = '02ca822d8e1bf0357b1d782a02dca991192a1b0a89e6cf6ff7e6c4368653cbcb';
const KAKAO_REST_KEY = process.env.KAKAO_REST_KEY || process.env.VITE_KAKAO_REST_KEY || '9e149576620513dc3283894501c49ab7';
const SEOUL_API_KEY = '6d6c71717173656f3432436863774a';

// ── 프랜차이즈 브랜드 (공정위 가맹사업 정보공개서 기준 1016개) ──
const FRANCHISE_BRANDS = new Set(['#커피플라잉스콘','#힘이나는커피생활','145커피','1847','1L 커피특별시','1리터셀&디저트와플','22그램','32커피','3X-LARGE COFFEE','45초 커피','5pm sunset hour','707COFFEE','777커피','9 BLOCK (나인블럭)','A LOT TO GO(어랏투고)','ALI★KENYA★STAR(알리케냐스타)커피','ALI★TOGO★STAR(알리투고스타)커피','BB 커피','BETTER BEAN','Bara 1998','Blu Shaak(블루샥)','C.&tree coffee','CAFE CANBUS(카페캔버스)','COFFEE COOK (커피쿡)','COFFEE PUCK','COFFEE ROMAN(커피로만)','COFFLIX(커플릭스)','CoCo Fresh Tea & Juice','DEAR Meek (디어미크)','DOLTA','EGGROCK CAFE','EVZZUCKER COFFEE','Every Coffee(에브리커피)','GOC COFFEE(고씨커피)','GRAB COFFEE','GREENY DAY','HEYTEA','HayCOFFEE','INEAT(인잇)','JeeGoo Coffee(지구 커피)','LEEPRESSO COFFEE','LEEPRESSO COFFEE 24','METCHA(맷차)','NiceCaffeinClub','ONCE, TIME OFF','OPPA COFFEE(오피피에이 커피)','PLAN(플랜)','PLUS 82(플러스 82)','PRABEAN(프라빈)','PRESENT(프레전트)','Pause 10'','P휴게소입니다','SG무인셀프아이스크림할인점','SNOW MANGO','SOS커피','SPACE COFFEE(스페이스커피)','STACKBEAN','STORANT(스토랑트)','TESTER COFFEE(테스터커피)','THE BLUE COFFEE','THE LITER (더리터)','THE LITER 24(더리터 24)','THE 더 맛있는 과일&1L커피','TOGETHER COFFEE  (투게더커피)','TOP LITER','The 대단한커피','WAKEY(웨이키)','cafe ttoara','chilling','frausong','if coffee','jay coffee','가배도','가유카페','갈바트 카페','감동카페','감성카페','감성커피','감성커피 테라스','감프커피','고고카페','고더커피','고래상점 COFFEE STAND','고망고','고바슨','고아트커피','고품격커피공장','공짜당커피','공차','과일과일해 요거후르츠','과일담은 요거트 맛집 요맛','과일언니들','과일에반하다.프루타','과일욤','과일의숲','광부커피','구스카토','구움씨','구테로이테','국민우유집','굿잡카페인','그녀의 커피잔','그라찌에','그라츠커피랩','그레이핍플커피','그릭박스','그릭베리','그릭씨네 요거트집','그릭앤조이','그릭요거트데이','그린머그','그린힐 커피','그림카페','그립핑거스','글라쇼','금커피별빙수','기기커피','까사부사노','꾸브라빈','꿀스커피GGUL'S COFFEE','나뚜루','나이스웨이','나히차','날쌘카페','남대문커피','남영댁 커피24','남토하우스','낫배드커피','내림','너디스','넌테이블','노배드바이브스','노스티','노티드','눈을담다 앤 요거트를담다','뉴당','뉴커피24','뉴플레이스커피','다린','다방오빠','다이렉트커피 생활카페','단청커피','달.콤','달꽃다방','달다곰이','달다구니','달달한 온도','달롱도르요거트아이스크림','달리는커피','달이다','달콤.엔','달콤다담','달콤스토어','달콤커피','담금젤라또','당빙땡','대설','대한커피','댄싱컵','더노벰버 라운지','더드림커피','더멍24','더무인커피','더바움','더벤티','더블업','더빈마켓','더원커피','더웨이닝커피','더착한커피','더치디커피','더치앤빈','더치즈샵','더카페','더커피','더플롯커피','던킨','데니스','데일리비틀주스','데일리에스프레소','데일리오아시스','데자토 by 신키네도','도케비커피','동네커피','동백커피','동양찻집','둥지타코엔커피','듀먼카페','드롭탑','드립앤더치','드링크림커피','드바르트','디39익스프레소','디디디알캔&보틀커피','디디커피','디브커피','디에떼에스프레소','디저트 참 잘하는 집','디저트39','디저트문','디저트문정','디커피','디키','디키즈맘','땡큐베리머치','떠기다방','떼루와','또리커피','뚜레쥬르','뚜스뚜스','뚝배기팥빙수','뜰커피','띵크프룻','라떼떼','라떼킹','라마','라미떼','라바게트','라벨스하이디','라붐커피','라비올레뜨','라스베이글','라우스터프','라크리마커피','락립배','랑데자뷰','럭키스팟','레드라인홀덤펍','레드애플','레인커피','로건커피','로반스윗','로우냅커피하우스','로우라이즈','로이비엔커피','롤스커피','루고','루머팡','루크커피브루어스','룩셈블랑제리','르?밀크','르돌치1946','리띵커피','리사르커피','리스아라비카','리시트','리얼식단','리에또젤라또','리터킹','릴렉스라운지','릿치스밀','링스보스턴','마르체사','마린커피','마블스크림','마시그래이','마실커피','마을카페남동풍','마이쥬스','마일로','마치마치','만랩커피','만월당','만족커피','말리따','맘스빈','맘스츄러스','망고루','망고홀릭','망티커피','매머드익스프레스','매머드커피','매스커피','맨리스커세권','맨션5','머그디저트랩','멀티커피','메가엠지씨커피','메가요거트','메가커피','메이즈메이즈','메이커커피','메타킹 커피','멜로우시티','멜빙수','명륜쥬스','모든코피','모리셔스브라운','모리커피','모부당','모어덴투데이','모캄보','몬도커피츄러스','몬떼비 서울','몬스터커피','몰타','무근본다방','무무커피','무인다방','무화커피&베이커리','무휼','묵리459','미남커피','미루꾸커피','미유당','밀립','밀콤빙수','밀크로지','밀크컨셉','밀키','밀키프레소','밀탑','밀하우스','바나타이거','바나프레소','바다CCM(씨씨엠)커피','바다마라나타 베이커리&커피','바로 바이킹','바로커피','바리스타미스김','바리스텔라','바리스트로','바빈스','바소','바오빙','바이러닉 에스프레소 바','바카커피','박슨커피','반 루엔','반달커피','발도스커피','배달비무료카페','배달의카페','배스킨라빈스','배터리커피','백금당','백억커피','버니문','버블엔젤','버블커피','버터앤쉘터','번트커피','벌크커피','범퍼커피','범표원두','베라오커피','베러먼데이','베르체','베민트 커피','베스트빈','베어글스','베어밀크','베콩','벤베커','벤티프레소','벨라빈스커피','벨렘','별난커피','보니또','보바보바','보버라운지','보석프레소','보스턴커피','복고다방','볼리커피','볼트빈','봄바스타커피','봉명동내커피','봉명읍미쓰리','뵈르뵈르','부바스','부스트릿','북앤빅뱅','북카페 반월','분더커피바','붕어네, 커피','브라운핸즈','브레댄코','브로떼커피','브루다커피','브루원츠','브루잉토트','브릭베이커스','브알라','브이요거트','브이카페','블랙모티브커피','블랙오아시스','블랙와인커피','블레스롤','블루 웨이브 커피','블루보틀','블루빈스','블루포트','블루폴라','블링블링','비결카페','비맨션커피&토스트','비바리움 파크 카페','비바프레소','비에스카페','비엔나커피하우스','비엔스','비타카페','빅그램커피베이커리','빅웨이브','빅피처커피','빈스빈스','빈스트커피','빈앤브레드','빈타이','빌리엔젤','빙가네','빙고래','빙달','빙동댕','빙수를품은달인(빙품달)','빙수바보빙식이','빡벳','빨라쪼 델 프레도','빽다방','사과당','사실빙','사운드빈','사운즈커피','사운즈커피미니','사이드커피','샌드리카노','샐러드 온','샐러리아 SALARIA','생활커피','샬로우커피','서로커피','서문빙수','서초동버블버블','서초동에스프레소','설빙','설요빙','설화카페','성별 에이유','세이프룻','센터커피','셀렉커피랩','셀렉토커피','셀프 바리스타','소곰커피','소디스','소미담','소복','손커피연구소','솔로투','솔리드웍스아이스크림','쇼플카페','순수빙떡','숨맑은집','슈퍼브카페','슈퍼브커피로스터스','슈퍼사이즈커피','슈퍼커피','스내킹','스몰굿','스윗다이노','스윗디저트카페루시카토','스윗앤샷','스카이맨 크레페','스컹크웍스','스쿠치 커피','스타벅스','스탠다드 스퀘어','스탠브루','스테이저스트','스템 커피','스트렝스커피','스트릿 1988','스트릿캔','스트릿팬케이크카페','슬럿커피','시나본','시선','시온담','시장청년','식빵언니','실크테라','심재','쌍도커피','쌤스커피','써니문','썬즈오렌지커피','씨이십칠','씨이오다방','씨이오로스팅','씨이오스무디','씨이오요거트','씨이오음료수','씨이오주스','씨이오카페인','씨티씨커피','씨티야','아가젤라또','아끼염','아는커피','아덴블랑제리','아덴블랑제리 시그니쳐','아덴플러스','아델라7','아리스타','아마떼','아마스빈','아마스빈코리아','아몽즈커피','아비아채','아사커피랩','아아수혈','아운티제니','아이스걸크림보이','아이스맨즈','아이스빈','아이스쿱','아이에떼커피','아이즈박스','아이캔커피','아임국민커피','아임일리터','아재커피','아쿠아가든','아토커피','아틀리에빈','아티스티','알보커피바','애니커피하우스','애니포레스트','애리스커피스탠드','애월더선셋','애월빵공장','앤더스커피','앤센스커피','앨리스도넛','얌트','양커피','어니스트','어니언','어더아사','어랏커피스탠드','어벤더치커피','어보브','어썸그릭요거트','어씽','어오케이커피','언노운  커피&베이커리','업사이드커피','에딕티','에밀리아','에센스커피','에스이커피','에슬로우커피','에이그레이트카페','에이바우트커피','에이쓰리바우트커피','에이에스커피','에이엠두시','에이티익스프레스','에이햅','엑스엑스 커피메이커','엑스트라커피','엔제리너스','엔커피','엘아르카','엠머그링','엠버스커피','여유한잔','영커피','예뻐지는커피','옐로우캔','옐로우팜','오! 커피랩','오가다','오늘도빙수','오드문','오들리샷','오마이OMC커피','오마이스','오민초','오색대왕빙수','오슬랑','오슬로','오슬로우','오슬로우 영호남','오우가','오크레페','오탠다드 커피','오티씨 커피','오티타','오티티관 카페','오프로스터리','오픈커피','오하오','온 티','온누리커피','온선데이커피','올데이빙수','올루올루','올리버브라운 카페','올리터','올선데이','옵션스페셜티커피','와글와글베이크샵','와드커피','와요커피','와일드주스랩','와커피','왓커피','요거 피플','요거베리','요거브릭','요거토피아','요거트 더 리치','요거트가족','요거트담은 빙프레소','요거트맨','요거트미','요거트바이피플','요거트아이스크림의 정석','요거트에브리띵','요거트퍼플','요거트홀릭','요거티','요거팡 YogurPang','요거프레소','요아잇','요요일','요커','요핑','욤카페','우아한과일','우일빙','우주곰커피','우주라이크','우지커피','운커피(雲커피)','워키동키커피','원베러커피','원앤식스커피','원유로스페셜티커피','월화수카페','위글루션','위너스커피','위플라','유니컵 커피','유동커피','유로스커피 로스터스','유아이유','유키모찌','육츠커피','은율당','읍천리 382','이공커피','이구아나','이너리트','이디야커피','이루팜','이륜당','이브릭스','이수페','이십센치','이안코커피','이지브루잉커피','이코복스커피스튜디오','이태리다방','이티당 충전소','이티커피','이프유캔','인대구빙수','인사동곱돌쌍화차','인재36.5°까페','인천유나이티드 F.C. 카페','일리카페','일리터맥스','일맥커피','일상엔','일커피','입술에 설렌다 빙수당','잇.','잇지커피','자몽자몽','잔잔한숲','잠바주스','저스틴','전광수커피','점프','정글비','정브라더카페','제로카페','제로팩토리','제이엠티','제주스','제퍼빈스','젤라또로플','젤라빈스','젬스톤','조선다방','죠이엘로','주니아','주디마리','주스the씨이오','주식커피','준스커피','쥬씨','쥬청과','지니프레쉬','지브릭커피','지티커피','지파시','진심커피','집생로커피','짭쪼롬','차백도','차얌','차이','차일드큐브','차차커피코','채우다','챔스빈커피','천씨씨커피','천일애','청달방','청담호두','청솔로9','청자다방','츄로's Coffee&Ice cream','치키차카초코','치타커피','카페 길우','카페 꽃이피다','카페 오디디오','카페 우드진','카페 콘크리트','카페051','카페16온스','카페316','카페70도씨','카페CCD','카페with시그니쳐','카페게이트','카페공명','카페그란데','카페그리닝','카페꼼마','카페넋','카페달링','카페데베르','카페도헤이왕의커피','카페동네','카페띠아모','카페락온','카페루앤비','카페룰리오가닉','카페리빈','카페리프','카페마타마타','카페만월경','카페머물다','카페메르쎄시','카페몬스터','카페바이피플','카페베네','카페보니또','카페보스','카페봄봄','카페브루빈','카페비엔나','카페소프트','카페수르','카페아이엔지','카페아이엠티','카페안샐','카페알앤비','카페앤코','카페야','카페에이.아이','카페에이지이디','카페오를리','카페온나','카페요아정','카페유어프레즌트','카페율하온','카페인24','카페인더문','카페인사계','카페인중독','카페일리터','카페일분','카페자나','카페초가오','카페코나퀸즈','카페코스모','카페코지','카페텅','카페티베어','카페포코','카페포트럭','카페폴','카페프리헷','카페핑크뮬리','카페해운대1994','카페홈즈','카페홍','캐롤커피','캔모아','캔팩토리','커슐랭','커스텀커피','커커커커피','커피 로드뷰','커피101스트릿','커피24','커피기업','커피나무','커피나인','커피는','커피니','커피다스1리터','커피다운','커피달램','커피라빈트','커피마마','커피머피','커피명가','커피무카24','커피바이브','커피박환전소카페','커피베이','커피베이 익스프레스','커피볶는시골커피','커피브라더','커피빈','커피사피엔스','커피스토어','커피식구','커피아트','커피에반하다','커피온리','커피왕','커피인류','커피칩스','커피코트','커피팡','커피홀','커핀그루나루','컬러인커피','컴포즈커피','케니야커피','케이베이크','케이엠엘리갤러리카페','켄커피','코끼리빙수 외 2개','코지리틀','코타커피','코페아커피','콘시드서울','콜드스톤','콜프로스터스','콩월','콩카페','쿠즈코커피','쿠카쿠','쿠크봉','쿼드커피','퀸즈브라운','크라프커피','크레이저커피','크렘드마롱','크로앤피','크리스피크림','크피숍','큰큰커피','클로리스','클로버 커피','키쿠키앤커피','킨크커피','킹사이즈커피','킹스더킹','킹스빈','킹콩쥬스엔커피','킹프레소','타래커피1998','타래퀸','타이거슈가','타이거프레소','타이티카페','타코젠','탐앤탐스커피','탑브릭스','탑티어커피','태미원','탭플레이','테라로사','테라커피','테이블스','테이큰커피','텐퍼센트스페셜티커피','텐퍼센트커피','템포커피','토리스타특별한커피','토이아이스','토프레소','투달러커피','투또톤토','투빅커피','투썸플레이스','투플러스원 커피','트러스트 스페셜티 커피','트로피티아일랜드','트리고','트리플에이커피','티블랙','티카페차센','팀홀튼','파라노이드','파란만잔','파리공방','파리바게뜨','파리크라상','파머스빈','파스쿠찌','파시야','파운드커피','파인24','파페지','팔공티','팝콘팔라트','패스트카페','팬도로시','퍼스트커피','펄스에잇','페르케노','페이브','페이브커피','펠어커피초코','평화다방','포사이','포시즌베리','포컬포인트','포트캔커피 PORT CAN COFFEE','폴러스타커피','폴바셋','폴인라떼','퐁치커피익스프레스','푸르파파','푸링','푸쉬커피','푸푸커피','풋풋','풍년인카페','프랭크커핀바','프레드커피하우스','프레씨엘','프롬프트','프롬하츠','프루쉬','프뤼떼마지','프리슈커피','프리퍼','프릳츠','프윅커피','플라타너스','플레어비','플레이메이드','플레이펭','플루800','피에스씨','피에스타7커피','피카커피','피크니크','픽셀커피','필메이트','핑퐁커피','하겐다즈','하삼동커피','하와이코나 사자커피','하이빙수','하이오커피','하이테이블','하임미트무인정육스토어','하프커피','할리스','항아리카노 FRIED COFFEE','해쉬커피','핵커피','핸델앤그레텔','핸드메이드','핸즈커피','허니홈비','헤리턴스Cafe','헤세드커피','헤이키 커피','헬리빈커피','호기하우스','호닷','호이차','홉스커피','홍닝차','홍단커피','홍시궁','홍콩다방','화채업자','화채한박스','황칠가카페','후즈티','휴게소','흑본당','흑화당','히든오아시스','히스피','히얼이즈커피','히즈빈스','힙피커피']);

// ── 프랜차이즈 별칭 매핑 (주요 브랜드 영문명) ──
const FRANCHISE_ALIASES = {
  '메가MGC커피': ['메가커피','메가MGC','MEGA MGC','MEGA COFFEE','메가엠지씨','MGC커피','MGC COFFEE','메가M','MEGACOFFEE'],
  '컴포즈커피': ['컴포즈','COMPOSE','COMPOSECOFFEE'],
  '빽다방': ['빽다방','PAIKDABANG','PAIK'],
  '더벤티': ['더벤티','THE VENTI','THEVENTI'],
  '매머드커피': ['매머드','MAMMOTH','매머드익스프레스','MAMMOTHEXPRESS'],
  '이디야커피': ['이디야','EDIYA'],
  '투썸플레이스': ['투썸','TWOSOME','A TWOSOME'],
  '할리스': ['할리스','HOLLYS'],
  '스타벅스': ['스타벅스','STARBUCKS'],
  '폴바셋': ['폴바셋','PAUL BASSETT'],
  '카페베네': ['카페베네','CAFFEBENE'],
  '탐앤탐스': ['탐앤탐스','TOM N TOMS','TOMNTOMS'],
  '파스쿠찌': ['파스쿠찌','PASCUCCI'],
  '커피빈': ['커피빈','COFFEE BEAN','COFFEEBEAN'],
  '엔제리너스': ['엔제리너스','ANGEL-IN-US','ANGELINUS','ANGEL IN US'],
  '감성커피': ['감성커피','GAMSUNGCOFFEE'],
  '하삼동커피': ['하삼동','HASAMDONG'],
  '커피에반하다': ['커피에반하다','반하다커피'],
  '달콤커피': ['달콤커피','DALKOM'],
  '커피나무': ['커피나무','COFFEENAMU'],
  '드롭탑': ['드롭탑','DROPTOP'],
  '카페봄봄': ['카페봄봄'],
  '커피명가': ['커피명가'],
  '요거프레소': ['요거프레소','YOGERPRESSO'],
  '만랩커피': ['만랩','만랩커피','MANLAB','MAN LAB'],
  '블루보틀': ['블루보틀','BLUE BOTTLE','BLUEBOTTLE'],
  '테라로사': ['테라로사','TERAROSA'],
  '어니언': ['어니언','ONION'],
  '프릳츠': ['프릳츠','FRITZ'],
  '센터커피': ['센터커피','CENTER COFFEE'],
  '아라비카': ['아라비카','% ARABICA','ARABICA'],
  '토프레소': ['토프레소','TOPRESSO'],
  '그라찌에': ['그라찌에','GRAZIE'],
  '전광수커피': ['전광수','JEON KWANG SOO'],
  '공차': ['공차','GONGCHA','GONG CHA'],
  '바나프레소': ['바나프레소','BANAPRESSO'],
  '커피나인': ['커피나인','COFFEE NINE','COFFEENINE'],
  '설빙': ['설빙','SULBING'],
  '디저트39': ['디저트39','DESSERT39','DESSERT 39'],
  '텐퍼센트커피': ['텐퍼센트','10PERCENT','10퍼센트','TEN PERCENT'],
  '파리바게뜨': ['파리바게뜨','PARIS BAGUETTE','PARISBAGUETTE'],
  '뚜레쥬르': ['뚜레쥬르','TOUS LES JOURS','TOUSLESJOURS'],
  '파리크라상': ['파리크라상','PARIS CROISSANT','PARISCROISSANT'],
  '브레댄코': ['브레댄코','BREADNCO','BREAD N CO'],
  '노티드': ['노티드','KNOTTED'],
  '던킨': ['던킨','DUNKIN','DUNKIN DONUTS'],
  '크리스피크림': ['크리스피크림','KRISPY KREME','KRISPY','KRISPYKREME'],
  '배스킨라빈스': ['배스킨라빈스','BASKIN ROBBINS','BASKIN','BASKINROBBINS'],
  '쥬씨': ['쥬씨','JUICY'],
};

// ── 비카페 필터 키워드 ──
const NOT_CAFE_KEYWORDS = ['주점','술집','노래방','pc방','피씨방','편의점','약국','병원','부동산',
  '세탁','미용','네일','헤어','치킨','피자','족발','삼겹','고기','갈비','곱창','찜','탕',
  '횟집','초밥','분식','떡볶이','김밥','라면','국수','칼국수','설렁탕','냉면','파스타',
  '마트','슈퍼','편의','문구','학원','교습','운동','헬스','요가','필라테스',
  '세차','주유','주차','모텔','호텔','숙박','빌딩','오피스','사무실','은행','보험',
  '핸드폰','휴대폰','통신','꽃집','화원','동물','애견','세무','법무','공인중개','프린트'];

// ── 카카오 CE7 비카페 필터 키워드 (보드카페, 만화카페, 사주, 방탈출 등) ──
const NON_CAFE_KEYWORDS = ['보드게임','보드카페','만화카페','만화방','사주','타로','방탈출','이스케이프','escape','수면캡슐','룸카페','토즈','퍼즐팩토리','황금열쇠','제로월드','PC방','피시방','피씨방','노래방','코인노래'];

// ── 유틸: Haversine 거리 ──
function haversine(lat1, lng1, lat2, lng2) {
  const R = 6371000;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const a = Math.sin(dLat/2)**2 + Math.cos(lat1*Math.PI/180)*Math.cos(lat2*Math.PI/180)*Math.sin(dLng/2)**2;
  return Math.round(R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a)));
}

// ── 유틸: 이름 정규화 ──
function normalizeName(n) {
  return (n || '').replace(/[^가-힣a-zA-Z0-9]/g, '').toUpperCase();
}

// ── 유틸: 프랜차이즈 판별 ──
function detectFranchise(name) {
  const upper = (name || '').toUpperCase();
  // 1단계: 별칭 매칭
  for (const [brand, keywords] of Object.entries(FRANCHISE_ALIASES)) {
    if (keywords.some(kw => upper.includes(kw.toUpperCase()))) {
      return brand;
    }
  }
  // 2단계: 브랜드 Set 매칭
  for (const brand of FRANCHISE_BRANDS) {
    if (upper.includes(brand.toUpperCase())) {
      return brand;
    }
  }
  return null;
}

// ── 유틸: HTTP/HTTPS GET (global fetch 사용 - Node 18+) ──
async function httpGet(url, options = {}, timeout = 15000) {
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeout);
    const res = await fetch(url, {
      headers: {
        'Accept': 'application/json',
        'User-Agent': 'Mozilla/5.0',
        ...(options.headers || {})
      },
      signal: controller.signal
    });
    clearTimeout(timer);
    if (!res.ok) {
      console.warn(`[cafe-collect] httpGet ${res.status} for ${url.substring(0, 80)}`);
      const text = await res.text();
      try { return JSON.parse(text); } catch { return null; }
    }
    return await res.json();
  } catch (e) {
    console.warn(`[cafe-collect] httpGet 실패: ${e.message} for ${url.substring(0, 80)}`);
    return null;
  }
}

// ── 유틸: HTTPS fetch (카카오/네이버용 - global fetch 사용) ──
async function fetchJson(url, headers = {}, timeout = 15000) {
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeout);
    const res = await fetch(url, {
      headers: {
        'Accept': 'application/json',
        'User-Agent': 'Mozilla/5.0',
        ...headers
      },
      signal: controller.signal
    });
    clearTimeout(timer);
    if (!res.ok) {
      const errText = await res.text().catch(() => '');
      console.warn(`[cafe-collect] fetchJson ${res.status} for ${url.substring(0, 80)}: ${errText.substring(0, 200)}`);
      try { return JSON.parse(errText); } catch { return null; }
    }
    return await res.json();
  } catch (e) {
    console.warn(`[cafe-collect] fetchJson 실패: ${e.message} for ${url.substring(0, 80)}`);
    return null;
  }
}

// ════════════════════════════════════════════════════════════
// 소스 1: storeRadius (공공데이터포털 반경 내 상가)
// ════════════════════════════════════════════════════════════
async function collectStoreRadius(lat, lng, radius) {
  try {
    const params = new URLSearchParams({
      serviceKey: DATA_GO_KR_API_KEY,
      cx: String(lng),
      cy: String(lat),
      radius: String(radius),
      numOfRows: '500',
      pageNo: '1',
      type: 'json'
    });
    const url = `http://apis.data.go.kr/B553077/api/open/sdsc2/storeListInRadius?${params.toString()}`;
    const data = await httpGet(url, {}, 20000);

    let items = [];
    const body = data?.body || data?.data?.body;
    if (body?.items) {
      items = Array.isArray(body.items) ? body.items : (body.items.item || []);
    }
    if (!Array.isArray(items)) items = items ? [items] : [];

    // 카페 필터
    const cafes = items.filter(i => {
      const mclsCd = i.indsMclsCd || '';
      const mclsNm = (i.indsMclsNm || '').toLowerCase();
      const sclsNm = (i.indsSclsNm || '').toLowerCase();
      const bizNm = (i.bizesNm || '').toLowerCase();
      if (NOT_CAFE_KEYWORDS.some(kw => bizNm.includes(kw) || sclsNm.includes(kw))) return false;
      return mclsCd === 'Q12' || mclsNm.includes('커피') ||
        sclsNm.includes('카페') || sclsNm.includes('커피') || sclsNm.includes('coffee') ||
        bizNm.includes('카페') || bizNm.includes('커피') || bizNm.includes('coffee') ||
        bizNm.includes('cafe') || bizNm.includes('빽다방') || bizNm.includes('메가mgc') ||
        bizNm.includes('메가커피') || bizNm.includes('컴포즈') || bizNm.includes('이디야') ||
        bizNm.includes('스타벅스') || bizNm.includes('투썸') || bizNm.includes('할리스') ||
        bizNm.includes('폴바셋') || bizNm.includes('더벤티');
    });

    // 거리 검증 + 변환
    const result = [];
    for (const store of cafes) {
      const sLat = parseFloat(store.lat);
      const sLng = parseFloat(store.lon);
      if (!isNaN(sLat) && !isNaN(sLng)) {
        const dist = haversine(lat, lng, sLat, sLng);
        if (dist > radius) continue;
        const brand = detectFranchise(store.bizesNm);
        result.push({
          name: store.bizesNm || '',
          lat: sLat,
          lng: sLng,
          address: store.rdnmAdr || store.lnoAdr || '',
          category: store.indsSclsNm || '카페',
          phone: store.telNo || '',
          dist,
          source: 'storeRadius',
          isFranchise: !!brand,
          brand: brand || null
        });
      } else {
        const brand = detectFranchise(store.bizesNm);
        result.push({
          name: store.bizesNm || '',
          lat: null,
          lng: null,
          address: store.rdnmAdr || store.lnoAdr || '',
          category: store.indsSclsNm || '카페',
          phone: store.telNo || '',
          dist: null,
          source: 'storeRadius',
          isFranchise: !!brand,
          brand: brand || null
        });
      }
    }
    return result;
  } catch (e) {
    console.error('[cafe-collect] storeRadius 실패:', e.message);
    return [];
  }
}

// ════════════════════════════════════════════════════════════
// 소스 2: 카카오 CE7 격자검색
// ════════════════════════════════════════════════════════════
async function collectKakao(lat, lng, radius) {
  try {
    const gridStepM = 200;
    const searchRadius = 300;
    const latStep = gridStepM / 111000;
    const lngStep = gridStepM / (111000 * Math.cos(lat * Math.PI / 180));
    const steps = Math.ceil(radius / gridStepM);

    const gridPoints = [];
    for (let i = -steps; i <= steps; i++) {
      for (let j = -steps; j <= steps; j++) {
        const pLat = lat + i * latStep;
        const pLng = lng + j * lngStep;
        const dist = haversine(lat, lng, pLat, pLng);
        if (dist <= radius) {
          gridPoints.push({ lat: pLat, lng: pLng });
        }
      }
    }

    const allResults = [];
    const seenIds = new Set();

    // 격자를 배치로 처리 (동시 5개씩 - 카카오 REST API 초당 30회 제한 준수)
    const BATCH_SIZE = 5;
    for (let bi = 0; bi < gridPoints.length; bi += BATCH_SIZE) {
      const batch = gridPoints.slice(bi, bi + BATCH_SIZE);
      const batchResults = await Promise.allSettled(batch.map(async (gp) => {
        const results = [];
        for (let page = 1; page <= 3; page++) {
          try {
            const url = `https://dapi.kakao.com/v2/local/search/category.json?category_group_code=CE7&x=${gp.lng}&y=${gp.lat}&radius=${searchRadius}&page=${page}&size=15&sort=distance`;
            const data = await fetchJson(url, { Authorization: `KakaoAK ${KAKAO_REST_KEY}` }, 15000);
            if (!data || !data.documents) break;
            results.push(...data.documents);
            if (data.meta?.is_end) break;
          } catch { break; }
        }
        return results;
      }));
      for (const result of batchResults) {
        if (result.status !== 'fulfilled') continue;
        for (const doc of result.value) {
          const placeId = doc.id || doc.place_name;
          if (!seenIds.has(placeId)) {
            seenIds.add(placeId);
            allResults.push(doc);
          }
        }
      }
    }

    // radius 필터 + 비카페 필터 + 변환
    const result = [];
    for (const doc of allResults) {
      const dLat = parseFloat(doc.y);
      const dLng = parseFloat(doc.x);
      if (isNaN(dLat) || isNaN(dLng)) continue;
      const dist = haversine(lat, lng, dLat, dLng);
      if (dist > radius) continue;
      // 비카페 필터: 카카오 카테고리/매장명에 NON_CAFE_KEYWORDS 포함 시 제외
      const catLower = (doc.category_name || '').toLowerCase();
      const nameLower = (doc.place_name || '').toLowerCase();
      if (NON_CAFE_KEYWORDS.some(kw => catLower.includes(kw.toLowerCase()) || nameLower.includes(kw.toLowerCase()))) continue;
      const brand = detectFranchise(doc.place_name);
      result.push({
        name: doc.place_name || '',
        lat: dLat,
        lng: dLng,
        address: doc.road_address_name || doc.address_name || '',
        category: doc.category_name || '카페',
        phone: doc.phone || '',
        dist,
        source: 'kakao',
        isFranchise: !!brand,
        brand: brand || null,
        kakaoId: doc.id || null
      });
    }
    return result;
  } catch (e) {
    console.error('[cafe-collect] 카카오 실패:', e.message);
    return [];
  }
}

// ════════════════════════════════════════════════════════════
// 소스 3: LOCALDATA_072405 (서울시 커피전문점 인허가)
// ════════════════════════════════════════════════════════════
async function collectLocaldata(lat, lng, guName, radius) {
  if (!guName) return [];

  async function _collect() {
    try {
      // 배치 수집 (1000건씩)
      const allRows = [];
      let totalCount = 0;
      const MAX_BATCH = 150;

      // 첫 배치로 전체 건수 파악
      const firstUrl = `http://openapi.seoul.go.kr:8088/${SEOUL_API_KEY}/json/LOCALDATA_072405/1/1000/`;
      const firstData = await httpGet(firstUrl, {}, 20000);

      if (!firstData || !firstData.LOCALDATA_072405) {
        return [];
      }

      totalCount = firstData.LOCALDATA_072405.list_total_count || 0;
      const firstRows = firstData.LOCALDATA_072405.row || [];

      // guName으로 필터
      const filterRows = (rows) => rows.filter(r => {
        const addr = (r.RDNWHLADDR || r.SITEWHLADDR || '');
        return addr.includes(guName);
      });

      allRows.push(...filterRows(firstRows));

      // 추가 배치 (필요시)
      if (totalCount > 1000) {
        const batches = Math.min(Math.ceil(totalCount / 1000), MAX_BATCH);
        const batchPromises = [];
        for (let i = 2; i <= batches; i++) {
          const si = (i-1) * 1000 + 1;
          const ei = i * 1000;
          batchPromises.push(
            httpGet(`http://openapi.seoul.go.kr:8088/${SEOUL_API_KEY}/json/LOCALDATA_072405/${si}/${ei}/`, {}, 20000)
              .then(d => filterRows(d?.LOCALDATA_072405?.row || []))
              .catch(() => [])
          );
        }
        // 3개씩 병렬
        for (let bi = 0; bi < batchPromises.length; bi += 3) {
          const chunk = batchPromises.slice(bi, bi + 3);
          const results = await Promise.all(chunk);
          for (const rows of results) {
            allRows.push(...rows);
          }
        }
      }

      console.log(`[cafe-collect] LOCALDATA: ${guName} 전체 ${allRows.length}건`);

      // 반경 필터 + 변환
      const result = [];
      for (const row of allRows) {
        const name = (row.BPLCNM || '').trim();
        if (!name) continue;
        const statusCode = row.TRDSTATEGBN || '';
        if (statusCode !== '01') continue; // 영업중만

        const rdnAddr = (row.RDNWHLADDR || '').trim();
        const jibunAddr = (row.SITEWHLADDR || '').trim();
        const addr = rdnAddr || jibunAddr;
        const x = parseFloat(row.X); // 경도
        const y = parseFloat(row.Y); // 위도

        let dist = null;
        if (!isNaN(x) && !isNaN(y) && x > 0 && y > 0) {
          dist = haversine(lat, lng, y, x);
          if (dist > radius) continue;
        }

        const brand = detectFranchise(name);
        result.push({
          name,
          lat: !isNaN(y) && y > 0 ? y : null,
          lng: !isNaN(x) && x > 0 ? x : null,
          address: addr,
          category: '커피전문점',
          phone: (row.SITETEL || '').trim(),
          dist,
          source: 'localdata',
          isFranchise: !!brand,
          brand: brand || null,
          localdataStatus: 'active'
        });
      }

      return result;
    } catch (e) {
      console.error('[cafe-collect] LOCALDATA _collect 실패:', e.message);
      return [];
    }
  }

  let result = await _collect();
  // 재시도: 결과가 너무 적으면 최대 3회 재시도
  for (let attempt = 0; attempt < 3 && result.length < 5; attempt++) {
    console.log(`[cafe-collect] LOCALDATA 재시도 ${attempt+1}/3 (현재: ${result.length}건)`);
    const retry = await _collect();
    if (retry.length > result.length) result = retry;
  }
  return result;
}

// ════════════════════════════════════════════════════════════
// 결과 병합 (이름+좌표 기반 중복 제거)
// ════════════════════════════════════════════════════════════
function mergeCafes(sources) {
  const merged = [];
  const seenKeys = new Set();

  // 소스 우선순위: kakao > storeRadius > localdata
  const priorityOrder = ['kakao', 'storeRadius', 'localdata'];
  const allCafes = [];
  for (const source of priorityOrder) {
    for (const cafe of (sources[source] || [])) {
      allCafes.push(cafe);
    }
  }

  for (const cafe of allCafes) {
    const normName = normalizeName(cafe.name);
    // 이름 기반 키
    const nameKey = normName;
    // 좌표 기반 키 (10m 이내 같은 이름 = 중복)
    let isDuplicate = false;

    for (const existing of merged) {
      const existNorm = normalizeName(existing.name);
      if (existNorm === normName) {
        // 같은 이름 → 소스 추가
        if (!existing.sources.includes(cafe.source)) {
          existing.sources.push(cafe.source);
        }
        // 좌표 없으면 보충
        if (!existing.lat && cafe.lat) {
          existing.lat = cafe.lat;
          existing.lng = cafe.lng;
        }
        if (!existing.phone && cafe.phone) {
          existing.phone = cafe.phone;
        }
        isDuplicate = true;
        break;
      }
      // 좌표 근접 + 이름 유사 (편집거리 대신 정규화 비교)
      if (cafe.lat && existing.lat) {
        const dist = haversine(cafe.lat, cafe.lng, existing.lat, existing.lng);
        if (dist < 30) {
          // 30m 이내 + 이름 포함 관계
          // Fix: 3글자 이하 이름은 substring dedup 제외 (커피숲 vs 커피향 오탐 방지)
          if (normName.length >= 4 && existNorm.length >= 4 && (normName.includes(existNorm) || existNorm.includes(normName))) {
            if (!existing.sources.includes(cafe.source)) {
              existing.sources.push(cafe.source);
            }
            isDuplicate = true;
            break;
          }
        }
      }
    }

    if (!isDuplicate) {
      merged.push({
        ...cafe,
        sources: [cafe.source]
      });
    }
  }

  return merged;
}

// ════════════════════════════════════════════════════════════
// 메인 핸들러
// ════════════════════════════════════════════════════════════
exports.handler = async (event) => {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Content-Type': 'application/json; charset=utf-8'
  };

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers, body: '' };
  }

  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, headers, body: JSON.stringify({ error: 'POST only' }) };
  }

  const startTime = Date.now();

  try {
    const body = typeof event.body === 'string' ? JSON.parse(event.body || '{}') : (event.body || {});
    const { lat, lng, radius = 500, guName = '', sido = '', query = '' } = body;

    if (!lat || !lng) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: 'lat, lng 필수' })
      };
    }

    console.log(`[cafe-collect] 시작: lat=${lat}, lng=${lng}, radius=${radius}, gu=${guName}`);

    // 서울 여부 판단 (LOCALDATA는 서울만)
    // 서울 판별: sido, query, guName(서울 25개 구), 좌표 범위로 종합 판단
    const SEOUL_GU_LIST = ['종로구','중구','용산구','성동구','광진구','동대문구','중랑구','성북구','강북구','도봉구','노원구','은평구','서대문구','마포구','양천구','강서구','구로구','금천구','영등포구','동작구','관악구','서초구','강남구','송파구','강동구'];
    const isSeoulByGu = guName && SEOUL_GU_LIST.some(gu => guName.includes(gu));
    const isSeoulByCoord = lat >= 37.413 && lat <= 37.715 && lng >= 126.734 && lng <= 127.183;
    const isSeoul = sido.includes('서울') || (query || '').includes('서울') || isSeoulByGu || isSeoulByCoord;

    // 4개 소스 병렬 실행 - 각 소스 개별 타임아웃(20초) + Promise.allSettled로 부분 결과 보존
    const withTimeout = (promise, ms, label) =>
      Promise.race([
        promise,
        new Promise((_, reject) => setTimeout(() => reject(new Error(`${label} timeout ${ms}ms`)), ms))
      ]).catch(e => { console.warn(`[cafe-collect] ${label} 실패/타임아웃: ${e.message}`); return []; });

    const SOURCE_TIMEOUT = 20000;
    const settled = await Promise.allSettled([
      // Fix: SR 레이트리밋 대응 - 0개 반환 시 3초 후 1회 재시도
      withTimeout(
        collectStoreRadius(lat, lng, radius).then(async (res) => {
          if (res && Array.isArray(res) && res.length === 0) {
            await new Promise(r => setTimeout(r, 3000));
            return collectStoreRadius(lat, lng, radius);
          }
          return res;
        }),
        SOURCE_TIMEOUT, 'storeRadius'
      ),
      withTimeout(collectKakao(lat, lng, radius), SOURCE_TIMEOUT, 'kakao'),  // kakao CE7 활성화
      isSeoul ? withTimeout(collectLocaldata(lat, lng, guName, radius), SOURCE_TIMEOUT, 'localdata') : Promise.resolve([])  // LOCALDATA 재활성화 (서울 전용)
    ]);

    const storeRadiusCafes = settled[0].status === 'fulfilled' ? settled[0].value : [];
    const kakaoCafes = settled[1].status === 'fulfilled' ? settled[1].value : [];
    const localdataCafes = settled[2].status === 'fulfilled' ? settled[2].value : [];

    // 병합
    const merged = mergeCafes({
      storeRadius: storeRadiusCafes,
      kakao: kakaoCafes,
      localdata: localdataCafes
    });

    // 결정적 정렬: 거리 → 이름 순 (같은 입력이면 항상 같은 출력)
    merged.sort((a, b) => {
      const distA = a.dist ?? 99999;
      const distB = b.dist ?? 99999;
      if (distA !== distB) return distA - distB;
      return (a.name || '').localeCompare(b.name || '', 'ko');
    });

    const elapsed = Math.round((Date.now() - startTime) / 1000);
    console.log(`[cafe-collect] 완료: SR=${storeRadiusCafes.length}, KK=${kakaoCafes.length}, LD=${localdataCafes.length} → 병합=${merged.length} (${elapsed}s)`);

    const stats = {
      storeRadius: storeRadiusCafes.length,
      kakao: kakaoCafes.length,
      localdata: localdataCafes.length,
      merged: merged.length,
      elapsed
    };

    // 응답 body 생성 (cafes 필드에 merged 배열 확실히 포함)
    const cafeArray = Array.isArray(merged) ? merged : [];
    const responseBody = JSON.stringify({
      success: true,
      data: cafeArray,
      cafes: cafeArray,
      stats,
      sources: stats
    });
    console.log(`[cafe-collect] 응답 body: ${responseBody.length} bytes, cafes=${cafeArray.length}개`);

    return {
      statusCode: 200,
      headers,
      body: responseBody
    };
  } catch (err) {
    console.error('[cafe-collect] 핸들러 에러:', err);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({
        success: false,
        error: err.message,
        cafes: [],
        stats: { storeRadius: 0, kakao: 0, localdata: 0, merged: 0, elapsed: Math.round((Date.now() - startTime) / 1000) }
      })
    };
  }
};
