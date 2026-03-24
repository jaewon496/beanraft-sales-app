// cafe-collect-proxy.js
// 카페 수집 4개 소스를 서버사이드에서 병렬 실행하는 통합 프록시
// 소스: storeRadius(공공데이터포털) + 카카오CE7 격자 + 네이버 지역검색 6워커 + LOCALDATA(서울시 인허가)

// ── API 키 ──
const DATA_GO_KR_API_KEY = '02ca822d8e1bf0357b1d782a02dca991192a1b0a89e6cf6ff7e6c4368653cbcb';
const KAKAO_REST_KEY = process.env.KAKAO_REST_KEY || process.env.VITE_KAKAO_REST_KEY || '9e149576620513dc3283894501c49ab7';
const NAVER_CLIENT_ID = process.env.NAVER_SEARCH_CLIENT_ID;
const NAVER_CLIENT_SECRET = process.env.NAVER_SEARCH_CLIENT_SECRET;
const SEOUL_API_KEY = '6d6c71717173656f3432436863774a';

// ── 프랜차이즈 키워드 ──
const FRANCHISE_KEYWORDS = {
  '스타벅스': ['스타벅스','STARBUCKS'],
  '투썸플레이스': ['투썸','TWOSOME'],
  '이디야': ['이디야','EDIYA'],
  '메가커피': ['메가MGC','메가커피','MEGA COFFEE','MEGACOFFEE'],
  '빽다방': ['빽다방','PAIKDABANG'],
  '컴포즈커피': ['컴포즈','COMPOSE'],
  '더벤티': ['더벤티','THEVENTI'],
  '할리스': ['할리스','HOLLYS'],
  '폴바셋': ['폴바셋','PAULBASSETT'],
  '커피빈': ['커피빈','COFFEEBEAN'],
  '탐앤탐스': ['탐앤탐스','TOMNTOMS'],
  '파스쿠찌': ['파스쿠찌','PASCUCCI'],
  '엔젤리너스': ['엔젤리너스','ANGELINUS'],
  '카페베네': ['카페베네','CAFFEBENE'],
  '드롭탑': ['드롭탑','DROPTOP'],
  '커피에반하다': ['커피에반하다'],
  '요거프레소': ['요거프레소'],
  '달콤커피': ['달콤커피'],
  '공차': ['공차','GONGCHA'],
  '쥬씨': ['쥬씨','JUICY']
};

// ── 비카페 필터 키워드 ──
const NOT_CAFE_KEYWORDS = ['주점','술집','노래방','pc방','피씨방','편의점','약국','병원','부동산',
  '세탁','미용','네일','헤어','치킨','피자','족발','삼겹','고기','갈비','곱창','찜','탕',
  '횟집','초밥','분식','떡볶이','김밥','라면','국수','칼국수','설렁탕','냉면','파스타',
  '빵집','제과','마트','슈퍼','편의','문구','학원','교습','운동','헬스','요가','필라테스',
  '세차','주유','주차','모텔','호텔','숙박','빌딩','오피스','사무실','은행','보험',
  '핸드폰','휴대폰','통신','꽃집','화원','동물','애견','세무','법무','공인중개'];

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
  for (const [brand, keywords] of Object.entries(FRANCHISE_KEYWORDS)) {
    if (keywords.some(kw => upper.includes(kw.toUpperCase()))) {
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
      return null;
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
      return null;
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
    const url = `http://apis.data.go.kr/B553077/api/open/sdsc/storeListInRadius?${params.toString()}`;
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

    // radius 필터 + 변환
    const result = [];
    for (const doc of allResults) {
      const dLat = parseFloat(doc.y);
      const dLng = parseFloat(doc.x);
      if (isNaN(dLat) || isNaN(dLng)) continue;
      const dist = haversine(lat, lng, dLat, dLng);
      if (dist > radius) continue;
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
// 소스 3: 네이버 지역검색 6워커
// ════════════════════════════════════════════════════════════
async function collectNaver(lat, lng, guName, query) {
  if (!NAVER_CLIENT_ID || !NAVER_CLIENT_SECRET) {
    console.error('[cafe-collect] 네이버 API 키 미설정');
    return [];
  }

  try {
    // 네이버 검색 헬퍼
    const naverSearch = async (q, display = 5, start = 1) => {
      try {
        const url = `https://openapi.naver.com/v1/search/local.json?query=${encodeURIComponent(q)}&display=${display}&start=${start}&sort=random`;
        const data = await fetchJson(url, {
          'X-Naver-Client-Id': NAVER_CLIENT_ID,
          'X-Naver-Client-Secret': NAVER_CLIENT_SECRET
        }, 15000);
        return data?.items || [];
      } catch { return []; }
    };

    // 페이징 검색
    const pagedSearch = async (q, maxPages = 3) => {
      const allItems = [];
      for (let page = 0; page < maxPages; page++) {
        const start = page * 5 + 1;
        if (start > 11) break;
        const items = await naverSearch(q, 5, start);
        if (!items || items.length === 0) break;
        allItems.push(...items);
      }
      return allItems;
    };

    // 쿼리 생성: guName + 다양한 카페 키워드
    const queries = new Set();

    // 기본 지역 쿼리
    if (guName) {
      queries.add(`${guName} 카페`);
      queries.add(`${guName} 커피`);
      queries.add(`${guName} 디저트카페`);
    }

    // query에서 지역 정보 추출
    const guMatch = (query || '').match(/([가-힣]+구)\b/);
    const dongMatch = (query || '').match(/([가-힣]+동)\b/);
    const roadMatch = (query || '').match(/([가-힣]+(?:로|길|대로))\s/);

    if (dongMatch) {
      queries.add(`${dongMatch[1]} 카페`);
      queries.add(`${dongMatch[1]} 커피`);
      if (guName) queries.add(`${guName} ${dongMatch[1]} 카페`);
    }
    if (roadMatch) {
      queries.add(`${roadMatch[1]} 카페`);
      queries.add(`${roadMatch[1]} 커피`);
      if (guName) queries.add(`${guName} ${roadMatch[1]} 카페`);
    }
    if (guMatch && guMatch[1] !== guName) {
      queries.add(`${guMatch[1]} 카페`);
      queries.add(`${guMatch[1]} 커피`);
    }

    // 추가 변형
    const regions = new Set();
    if (guName) regions.add(guName);
    if (dongMatch) regions.add(dongMatch[1]);
    if (roadMatch) regions.add(roadMatch[1]);
    const variants = ['카페', '커피', '디저트카페', '커피숍'];
    for (const region of regions) {
      for (const variant of variants) {
        queries.add(`${region} ${variant}`);
      }
    }

    const queryArray = [...queries];
    console.log(`[cafe-collect] 네이버: ${queryArray.length}개 쿼리 생성`);

    // 6워커로 분배
    const WORKER_COUNT = 6;
    const groups = Array.from({ length: WORKER_COUNT }, () => []);
    queryArray.forEach((q, i) => groups[i % WORKER_COUNT].push(q));

    const allItems = [];
    const seenKeys = new Set();

    const processGroup = async (groupQueries) => {
      const groupItems = [];
      for (const q of groupQueries) {
        const items = await pagedSearch(q, 3);
        for (const item of items) {
          const title = (item.title || '').replace(/<[^>]*>/g, '').trim();
          if (title) groupItems.push({ ...item, title });
        }
      }
      return groupItems;
    };

    const workerResults = await Promise.all(groups.map(g => processGroup(g)));

    // TM128 → WGS84 변환 (네이버 mapx/mapy)
    const tm128ToWgs84 = (mapx, mapy) => {
      const x = parseInt(mapx) / 10000000;
      const y = parseInt(mapy) / 10000000;
      return { lat: y, lng: x };
    };

    for (const groupItems of workerResults) {
      for (const item of groupItems) {
        const key = `${item.title.replace(/\s/g, '').toUpperCase()}|${(item.roadAddress || item.address || '').replace(/\s/g, '')}`;
        if (seenKeys.has(key)) continue;
        seenKeys.add(key);

        let itemLat = null, itemLng = null;
        if (item.mapx && item.mapy) {
          const coords = tm128ToWgs84(item.mapx, item.mapy);
          itemLat = coords.lat;
          itemLng = coords.lng;
        }

        const brand = detectFranchise(item.title);
        allItems.push({
          name: item.title,
          lat: itemLat,
          lng: itemLng,
          address: item.roadAddress || item.address || '',
          category: item.category || '카페',
          phone: (item.telephone || '').replace(/<[^>]*>/g, ''),
          dist: (itemLat && itemLng) ? haversine(lat, lng, itemLat, itemLng) : null,
          source: 'naver',
          isFranchise: !!brand,
          brand: brand || null
        });
      }
    }

    return allItems;
  } catch (e) {
    console.error('[cafe-collect] 네이버 실패:', e.message);
    return [];
  }
}

// ════════════════════════════════════════════════════════════
// 소스 4: LOCALDATA_072405 (서울시 커피전문점 인허가)
// ════════════════════════════════════════════════════════════
async function collectLocaldata(lat, lng, guName, radius) {
  if (!guName) return [];

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
    console.error('[cafe-collect] LOCALDATA 실패:', e.message);
    return [];
  }
}

// ════════════════════════════════════════════════════════════
// 결과 병합 (이름+좌표 기반 중복 제거)
// ════════════════════════════════════════════════════════════
function mergeCafes(sources) {
  const merged = [];
  const seenKeys = new Set();

  // 소스 우선순위: kakao > storeRadius > naver > localdata
  const priorityOrder = ['kakao', 'storeRadius', 'naver', 'localdata'];
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
          if (normName.includes(existNorm) || existNorm.includes(normName)) {
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
    const { lat, lng, radius = 550, guName = '', sido = '', query = '' } = body;

    if (!lat || !lng) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: 'lat, lng 필수' })
      };
    }

    console.log(`[cafe-collect] 시작: lat=${lat}, lng=${lng}, radius=${radius}, gu=${guName}`);

    // 서울 여부 판단 (LOCALDATA는 서울만)
    const isSeoul = sido.includes('서울') || (query || '').includes('서울');

    // 4개 소스 병렬 실행 - 각 소스 개별 타임아웃(20초) + Promise.allSettled로 부분 결과 보존
    const withTimeout = (promise, ms, label) =>
      Promise.race([
        promise,
        new Promise((_, reject) => setTimeout(() => reject(new Error(`${label} timeout ${ms}ms`)), ms))
      ]).catch(e => { console.warn(`[cafe-collect] ${label} 실패/타임아웃: ${e.message}`); return []; });

    const SOURCE_TIMEOUT = 20000;
    const settled = await Promise.allSettled([
      withTimeout(collectStoreRadius(lat, lng, radius), SOURCE_TIMEOUT, 'storeRadius'),
      withTimeout(collectKakao(lat, lng, radius), SOURCE_TIMEOUT, 'kakao'),
      withTimeout(collectNaver(lat, lng, guName, query), SOURCE_TIMEOUT, 'naver'),
      isSeoul ? withTimeout(collectLocaldata(lat, lng, guName, radius), SOURCE_TIMEOUT, 'localdata') : Promise.resolve([])
    ]);

    const storeRadiusCafes = settled[0].status === 'fulfilled' ? settled[0].value : [];
    const kakaoCafes = settled[1].status === 'fulfilled' ? settled[1].value : [];
    const naverCafes = settled[2].status === 'fulfilled' ? settled[2].value : [];
    const localdataCafes = settled[3].status === 'fulfilled' ? settled[3].value : [];

    // 병합
    const merged = mergeCafes({
      storeRadius: storeRadiusCafes,
      kakao: kakaoCafes,
      naver: naverCafes,
      localdata: localdataCafes
    });

    const elapsed = Math.round((Date.now() - startTime) / 1000);
    console.log(`[cafe-collect] 완료: SR=${storeRadiusCafes.length}, KK=${kakaoCafes.length}, NV=${naverCafes.length}, LD=${localdataCafes.length} → 병합=${merged.length} (${elapsed}s)`);

    const stats = {
      storeRadius: storeRadiusCafes.length,
      kakao: kakaoCafes.length,
      naver: naverCafes.length,
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
        stats: { storeRadius: 0, kakao: 0, naver: 0, localdata: 0, merged: 0, elapsed: Math.round((Date.now() - startTime) / 1000) }
      })
    };
  }
};
