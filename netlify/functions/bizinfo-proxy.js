// 기업마당 지원사업정보 API 프록시
// 카페 창업 관련 지원 프로그램 필터링

const https = require('https');

const BIZINFO_API_KEY = 'J3EQN5';

// 소상공인 카페 창업자에게 실제 도움되는 키워드 (돈/공간/제도)
const INCLUDE_KEYWORDS = [
  '카페', '커피', '소상공인', '외식', '식품', '음식', '요식',
  '자영업', '베이커리', '디저트', '점포', '상가', '골목상권',
  '소공인', '소규모', '영세', '전통시장',
  // 자금 관련
  '자금지원', '융자', '보증', '대출', '이차보전', '응원금',
  '육성자금', '경영안정', '운전자금',
  // 공간/시설 관련
  '인테리어', '리모델링', '임대료', '점포환경', '시설개선',
  // 재기/전환
  '폐업', '재기', '새출발', '사업정리',
];

// 제외: 카페 소상공인과 무관하거나, 컨설팅 회사와 경쟁되는 것
const EXCLUDE_KEYWORDS = [
  // 컨설팅/교육 (빈크래프트와 경쟁)
  '멘토링', '컨설팅', '코칭', '교육과정', '아카데미', '연수',
  '경영지도', '경영개선컨설팅', '인증심사', '인증신청',
  // 무관한 인증/제도
  '가족친화', '지식재산', '여성기업', '경진대회', '공모전',
  '성평등', '일생활균형',
  // 스타트업/벤처
  '벤처', '스타트업', 'startup', 'IR피칭', '데모데이', '유니콘',
  '액셀러레이', '인큐베이', 'VC', '투자유치', '시리즈',
  // 기술/IT
  'R&D', '특허', 'AI', 'VR', 'AR', 'XR', 'IoT', 'SaaS', '블록체인',
  '바이오', '반도체', '로봇', '드론', '자율주행', '메타버스',
  '빅데이터', '클라우드', '핀테크', '헬스케어', '의료기기',
  '테크', 'TIPS', '팁스', '기술이전', '기술사업화',
  // 해외/수출
  '수출바우처', '해외진출', 'KOTRA', '글로벌', 'K-Startup',
  '국외', '해외전시', '수출',
  // 무관한 업종
  '반려동물', '펫', '농업인', '어업', '임업', '축산', '수산',
  '제조업', '뿌리산업', '소재부품', '국방', '방산', '우주항공',
  '게임', '웹툰', '영화', '공연', '관광', '콘텐츠진흥',
  '환경산업', '에너지', '신재생', '탄소', '농촌융복합',
  '사회적경제', '사회적기업', '협동조합', '마을기업',
  // 규모 안 맞음
  '중견기업', '강소기업', '히든챔피언', '월드클래스',
];

function fetchAPI(url) {
  return new Promise((resolve, reject) => {
    https.get(url, { timeout: 10000 }, (res) => {
      // [버그 수정] 청크를 Buffer로 모은 후 마지막에 UTF-8 디코딩
      // 한글 멀티바이트가 청크 경계에 걸리면 fffd로 깨지는 문제 방지
      const chunks = [];
      res.on('data', chunk => chunks.push(chunk));
      res.on('end', () => {
        try {
          const data = Buffer.concat(chunks).toString('utf-8');
          resolve(JSON.parse(data));
        }
        catch (e) { reject(new Error('JSON parse error')); }
      });
    }).on('error', reject);
  });
}

exports.handler = async (event) => {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Content-Type': 'application/json; charset=utf-8'
  };

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers, body: '' };
  }

  try {
    const params = event.queryStringParameters || {};
    const region = params.region || ''; // 시도명 (서울, 부산 등)
    const count = params.count || '200';

    // 소상공인 카페 필터
    const filterCafe = (items) => items.filter(item => {
      const text = [
        item.pblancNm || '',
        item.bsnsSumryCn || '',
        item.hashtags || '',
        item.trgetNm || '',
        item.pldirSportRealmMlsfcCodeNm || ''
      ].join(' ');
      const target = item.trgetNm || '';
      const tags = item.hashtags || '';

      // 1) 제외 키워드 탈락
      if (EXCLUDE_KEYWORDS.some(kw => text.includes(kw))) return false;

      // 2) 대상이 "소상공인"이면 바로 통과
      if (target.includes('소상공인')) return true;

      // 3) 대상이 "중소기업"이면 태그/본문에 소상공인 관련 있을 때만
      if (target.includes('중소기업')) {
        return tags.includes('소상공인') || text.includes('소상공인') ||
               text.includes('자영업') || text.includes('외식') ||
               text.includes('식품') || text.includes('카페');
      }

      // 4) 그 외: 포함 키워드 체크
      return INCLUDE_KEYWORDS.some(kw => text.includes(kw));
    });

    // 지역 필터: 태그에 해당 지역이 포함된 것만
    const filterRegion = (items, rgn) => {
      if (!rgn) return [];
      return items.filter(item => {
        const tags = item.hashtags || '';
        return tags.includes(rgn);
      });
    };

    // 필드 정리
    const cleanItems = (items) => items.map(item => ({
      title: (item.pblancNm || '').replace(/<[^>]*>/g, '').trim(),
      org: item.jrsdInsttNm || '',
      executor: item.excInsttNm || '',
      period: item.reqstBeginEndDe || '',
      target: item.trgetNm || '',
      summary: (item.bsnsSumryCn || '').replace(/<[^>]*>/g, '').replace(/&nbsp;/g, ' ').trim().slice(0, 200),
      url: item.pblancUrl || '',
      tags: item.hashtags || '',
      category: item.pldirSportRealmLclasCodeNm || '',
      subCategory: item.pldirSportRealmMlsfcCodeNm || ''
    }));

    // 전국 조회 1번만 (지역 필터는 태그로 직접 처리)
    const nationalUrl = `https://www.bizinfo.go.kr/uss/rss/bizinfoApi.do?crtfcKey=${BIZINFO_API_KEY}&dataType=json&hashtags=${encodeURIComponent('창업')}&searchCnt=${count}`;
    const nationalResult = await fetchAPI(nationalUrl);

    const allItems = nationalResult?.jsonArray || [];
    const cafeItems = filterCafe(allItems);
    const nationalCleaned = cleanItems(cafeItems);

    // 지역 필터: 카페 필터 통과한 것 중 태그에 지역 포함된 것
    const regionCleaned = region ? cleanItems(filterRegion(cafeItems, region)) : [];

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        region: region || '',
        total: nationalCleaned.length,
        regionCount: regionCleaned.length,
        items: nationalCleaned,
        regionItems: regionCleaned
      })
    };
  } catch (err) {
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: err.message })
    };
  }
};
