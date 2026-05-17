// ═══════════════════════════════════════════════════════════════
// addressNormalizer.js
// 어떤 형식으로 검색해도 같은 장소면 같은 표준 주소·좌표로 귀결시킨다.
// 지원 입력:
//   - 축약형 지번: "충북 청주시 흥덕구 정봉동 182-1"
//   - 풀네임 지번: "충청북도 청주시 흥덕구 정봉동 182-1"
//   - 초축약:      "청주 흥덕 정봉"
//   - POI:         "청주역"
//   - 도로명:      "청주시 흥덕구 정봉로 XX"
// 반환:
// {
//   sido, sigungu, dong,
//   roadAddress, jibunAddress,
//   lat, lng,
//   admiCd, normalizedQuery, sourceApi
// }
// ═══════════════════════════════════════════════════════════════

// 시도 16개(+세종/제주 특별자치) 축약 → 풀네임 매핑
export const SIDO_FULL_NAME = {
  '서울': '서울특별시',
  '부산': '부산광역시',
  '대구': '대구광역시',
  '인천': '인천광역시',
  '광주': '광주광역시',
  '대전': '대전광역시',
  '울산': '울산광역시',
  '세종': '세종특별자치시',
  '경기': '경기도',
  '강원': '강원특별자치도',
  '충북': '충청북도',
  '충남': '충청남도',
  '전북': '전북특별자치도',
  '전남': '전라남도',
  '경북': '경상북도',
  '경남': '경상남도',
  '제주': '제주특별자치도'
};

// 풀네임 → 축약 역매핑 (API 응답 정규화용)
const FULL_TO_SHORT = Object.fromEntries(
  Object.entries(SIDO_FULL_NAME).map(([s, f]) => [f, s])
);

// 추가 변형 표기 → 풀네임 (강원도/전라북도 등 구표기 수용)
const LEGACY_SIDO_ALIASES = {
  '강원도': '강원특별자치도',
  '전라북도': '전북특별자치도',
  '서울시': '서울특별시',
  '부산시': '부산광역시',
  '대구시': '대구광역시',
  '인천시': '인천광역시',
  '광주시': '광주광역시',
  '대전시': '대전광역시',
  '울산시': '울산광역시',
  '세종시': '세종특별자치시',
  '제주도': '제주특별자치도'
};

// 시/군/구 축약 초축약 매핑 (흥덕→흥덕구 등)
// 알려진 비수도권 축약 사례 보강
const SIGUNGU_ABBREV = {
  '흥덕': '흥덕구',
  '서원': '서원구',
  '청원': '청원구',
  '상당': '상당구',
  '유성': '유성구',
  '대덕': '대덕구',
  '달서': '달서구',
  '수성': '수성구',
  '중원': '중원구',
  '완산': '완산구',
  '덕진': '덕진구',
  '남동': '남동구',
  '부평': '부평구',
  '미추홀': '미추홀구',
  '연수': '연수구'
};

// 주요 시군 축약 → 풀네임 시/군 (단독으로 쓰였을 때)
// "청주 흥덕 정봉" 같은 3토큰 초축약 처리에 쓰인다.
const SI_FULL_NAME = {
  '청주': '청주시',
  '전주': '전주시',
  '천안': '천안시',
  '수원': '수원시',
  '성남': '성남시',
  '고양': '고양시',
  '용인': '용인시',
  '부천': '부천시',
  '안양': '안양시',
  '안산': '안산시',
  '화성': '화성시',
  '의정부': '의정부시',
  '포항': '포항시',
  '창원': '창원시',
  '김해': '김해시',
  '춘천': '춘천시',
  '강릉': '강릉시',
  '원주': '원주시',
  '제주': '제주시'
};

// 시 → 소속 시도 (풀네임)
const SI_TO_SIDO = {
  '청주시': '충청북도',
  '충주시': '충청북도',
  '제천시': '충청북도',
  '천안시': '충청남도',
  '아산시': '충청남도',
  '공주시': '충청남도',
  '전주시': '전북특별자치도',
  '군산시': '전북특별자치도',
  '익산시': '전북특별자치도',
  '수원시': '경기도',
  '성남시': '경기도',
  '고양시': '경기도',
  '용인시': '경기도',
  '부천시': '경기도',
  '안양시': '경기도',
  '안산시': '경기도',
  '화성시': '경기도',
  '의정부시': '경기도',
  '포항시': '경상북도',
  '구미시': '경상북도',
  '경주시': '경상북도',
  '창원시': '경상남도',
  '김해시': '경상남도',
  '양산시': '경상남도',
  '진주시': '경상남도',
  '춘천시': '강원특별자치도',
  '강릉시': '강원특별자치도',
  '원주시': '강원특별자치도',
  '제주시': '제주특별자치도',
  '서귀포시': '제주특별자치도'
};

// ───────────────────────────────────────────────
// Step 1. 축약 → 풀네임 전처리
// ───────────────────────────────────────────────
function expandToFullName(raw) {
  let q = (raw || '').trim();
  if (!q) return q;

  // 레거시 alias 먼저 치환
  for (const [legacy, full] of Object.entries(LEGACY_SIDO_ALIASES)) {
    if (q.startsWith(legacy + ' ') || q === legacy) {
      q = q.replace(legacy, full);
      break;
    }
  }

  // 맨 앞 토큰이 시도 축약인 경우 풀네임으로 교체
  const firstTok = q.split(/\s+/)[0];
  if (SIDO_FULL_NAME[firstTok]) {
    q = SIDO_FULL_NAME[firstTok] + q.slice(firstTok.length);
  }

  // 3토큰 초축약 "청주 흥덕 정봉" → "충청북도 청주시 흥덕구 정봉동"
  const toks = q.split(/\s+/);
  if (toks.length === 3) {
    const [siRaw, guRaw, dongRaw] = toks;
    const siFull = SI_FULL_NAME[siRaw];
    if (siFull) {
      const sido = SI_TO_SIDO[siFull];
      const guFull = SIGUNGU_ABBREV[guRaw] || (guRaw.endsWith('구') ? guRaw : guRaw + '구');
      const dongFull = dongRaw.endsWith('동') || dongRaw.endsWith('읍') || dongRaw.endsWith('면')
        ? dongRaw
        : dongRaw + '동';
      if (sido) return `${sido} ${siFull} ${guFull} ${dongFull}`;
    }
  }

  return q;
}

// ───────────────────────────────────────────────
// Step 2. 카카오 Address Search
// ───────────────────────────────────────────────
async function kakaoAddressSearch(query) {
  try {
    console.log(`[주소정규화] kakao-address 호출: "${query}"`);
    const res = await fetch(`/api/kakao-proxy?type=address&query=${encodeURIComponent(query)}`);
    console.log(`[주소정규화] kakao-address 응답 status: ${res.status}`);
    if (!res.ok) {
      console.warn(`[주소정규화] kakao-address 실패 status=${res.status}`);
      return null;
    }
    const data = await res.json();
    const doc = data?.documents?.[0];
    if (!doc) {
      console.warn(`[주소정규화] kakao-address documents 비어있음 for "${query}"`);
      return null;
    }

    const road = doc.road_address;
    const jibun = doc.address;
    const lat = Number(doc.y);
    const lng = Number(doc.x);
    if (!lat || !lng) return null;

    const sido = road?.region_1depth_name || jibun?.region_1depth_name || '';
    const sigungu = road?.region_2depth_name || jibun?.region_2depth_name || '';
    const dong = road?.region_3depth_name || jibun?.region_3depth_name || '';

    return {
      sido, sigungu, dong,
      roadAddress: road?.address_name || '',
      jibunAddress: jibun?.address_name || '',
      lat, lng,
      sourceApi: 'kakao-address'
    };
  } catch (e) {
    console.error('[주소정규화] 카카오 Address 예외:', e && (e.stack || e.message || e));
    return null;
  }
}

// ───────────────────────────────────────────────
// Step 2b. 카카오 Keyword Search (POI)
// ───────────────────────────────────────────────
async function kakaoKeywordSearch(query) {
  try {
    const res = await fetch(`/api/kakao-proxy?type=keyword&query=${encodeURIComponent(query)}&size=1`);
    if (!res.ok) return null;
    const data = await res.json();
    const doc = data?.documents?.[0];
    if (!doc) return null;
    const lat = Number(doc.y);
    const lng = Number(doc.x);
    if (!lat || !lng) return null;
    return {
      lat, lng,
      address_name: doc.address_name || '',
      road_address_name: doc.road_address_name || '',
      place_name: doc.place_name || '',
      sourceApi: 'kakao-keyword'
    };
  } catch (e) {
    console.warn('[주소정규화] 카카오 Keyword 실패:', e.message);
    return null;
  }
}

// ───────────────────────────────────────────────
// Step 2c. 네이버 Geocoding 폴백
// ───────────────────────────────────────────────
async function naverGeocode(query) {
  try {
    const res = await fetch(`/api/ncp-geo-proxy?type=geocode&query=${encodeURIComponent(query)}`);
    if (!res.ok) return null;
    const data = await res.json();
    const addr = data?.addresses?.[0];
    if (!addr) return null;
    const lat = Number(addr.y);
    const lng = Number(addr.x);
    if (!lat || !lng) return null;

    // addressElements에서 시도/시군구/법정동 추출
    const els = addr.addressElements || [];
    const pickByType = (t) => {
      const el = els.find(e => (e.types || []).includes(t));
      return el?.longName || el?.shortName || '';
    };
    const sido = pickByType('SIDO');
    const sigungu = pickByType('SIGUGUN');
    const dong = pickByType('DONGMYUN') || pickByType('RI');

    return {
      sido, sigungu, dong,
      roadAddress: addr.roadAddress || '',
      jibunAddress: addr.jibunAddress || '',
      lat, lng,
      sourceApi: 'naver'
    };
  } catch (e) {
    console.warn('[주소정규화] 네이버 Geocoding 실패:', e.message);
    return null;
  }
}

// ───────────────────────────────────────────────
// Step 3. 좌표 → 행정동 코드 (카카오 coord2regioncode)
// ───────────────────────────────────────────────
async function coordToAdmiCd(lat, lng) {
  try {
    const res = await fetch(`/api/kakao-proxy?type=coord2regioncode&x=${lng}&y=${lat}`);
    if (!res.ok) return null;
    const data = await res.json();
    // region_type 'H' = 행정동, 'B' = 법정동
    const h = (data?.documents || []).find(d => d.region_type === 'H');
    if (!h) return null;
    return {
      admiCd: h.code || null,        // 10자리 행정동 코드
      region_1depth: h.region_1depth_name || '',
      region_2depth: h.region_2depth_name || '',
      region_3depth: h.region_3depth_name || ''
    };
  } catch (e) {
    console.warn('[주소정규화] coord2regioncode 실패:', e.message);
    return null;
  }
}

// ───────────────────────────────────────────────
// Helpers
// ───────────────────────────────────────────────
function ensureFullSido(sidoRaw) {
  if (!sidoRaw) return '';
  if (Object.values(SIDO_FULL_NAME).includes(sidoRaw)) return sidoRaw;
  if (SIDO_FULL_NAME[sidoRaw]) return SIDO_FULL_NAME[sidoRaw];
  if (LEGACY_SIDO_ALIASES[sidoRaw]) return LEGACY_SIDO_ALIASES[sidoRaw];
  // '서울' '부산' 등 짧은 표기면 매핑
  const short = FULL_TO_SHORT[sidoRaw];
  if (short) return sidoRaw; // 이미 풀네임
  return sidoRaw;
}

function buildNormalizedQuery(sido, sigungu, dong) {
  return [sido, sigungu, dong].filter(Boolean).join(' ').trim();
}

// ───────────────────────────────────────────────
// Public: normalizeAddress
// ───────────────────────────────────────────────
export async function normalizeAddress(rawInput) {
  console.log('[주소정규화] 진입:', rawInput);
  const input = (rawInput || '').trim();
  console.log(`[주소정규화] 입력 정리: "${input}"`);

  if (!input) {
    console.warn('[주소정규화] 빈 입력 — null 반환');
    return null;
  }

  // Step 1. 전처리
  const expanded = expandToFullName(input);
  console.log(`[주소정규화] 전처리(풀네임 변환): "${expanded}"`);

  // Step 2. 카카오 Address 우선 — 전처리 결과와 원본 두 번 시도
  let base = await kakaoAddressSearch(expanded);
  if (!base && expanded !== input) {
    base = await kakaoAddressSearch(input);
  }
  if (base) {
    console.log(`[주소정규화] 카카오 Address 성공: ${base.roadAddress || base.jibunAddress}`);
  }

  // Step 2b. 실패 시 POI로 키워드 검색 → 다시 주소화
  if (!base) {
    const poi = await kakaoKeywordSearch(expanded) || await kakaoKeywordSearch(input);
    if (poi) {
      console.log(`[주소정규화] 카카오 Keyword(POI) 성공: ${poi.place_name} → ${poi.address_name}`);
      // POI 주소 문자열로 주소 검색 재시도
      const poiAddr = poi.road_address_name || poi.address_name;
      if (poiAddr) {
        base = await kakaoAddressSearch(poiAddr);
      }
      // 여전히 없으면 좌표 + 간이 주소로 구성
      if (!base) {
        base = {
          sido: '', sigungu: '', dong: '',
          roadAddress: poi.road_address_name || '',
          jibunAddress: poi.address_name || '',
          lat: poi.lat, lng: poi.lng,
          sourceApi: 'kakao-keyword'
        };
      } else {
        base.sourceApi = 'composite:kakao-keyword+address';
      }
    }
  }

  // Step 2c. 그래도 없으면 네이버 폴백
  if (!base) {
    base = await naverGeocode(expanded) || await naverGeocode(input);
    if (base) {
      console.log(`[주소정규화] 네이버 폴백 성공: ${base.roadAddress || base.jibunAddress}`);
    }
  }

  if (!base) {
    console.error('[주소정규화] 모든 API 실패 - 폴백 객체 반환 input=', input, 'expanded=', expanded);
    return {
      error: 'all-apis-failed',
      fallback: true,
      input: rawInput,
      expanded,
      sido: '', sigungu: '', dong: '',
      roadAddress: '', jibunAddress: '',
      lat: null, lng: null,
      admiCd: null,
      normalizedQuery: expanded,
      sourceApi: 'fallback'
    };
  }

  console.log(`[주소정규화] 좌표: ${base.lat}, ${base.lng}`);

  // Step 3. 행정동 코드 조회
  let admiCd = null;
  let admiDong = '';
  try {
    const rc = await coordToAdmiCd(base.lat, base.lng);
    if (rc) {
      admiCd = rc.admiCd;
      admiDong = rc.region_3depth || '';
      console.log(`[주소정규화] 행정동: ${admiCd} (${admiDong})`);
    }
  } catch (e) {
    console.warn('[주소정규화] 행정동 코드 실패:', e.message);
  }

  // 시도 풀네임 보정
  const sido = ensureFullSido(base.sido) || '';
  const sigungu = base.sigungu || '';
  // 법정동 우선, 없으면 행정동
  const dong = base.dong || admiDong || '';

  const normalizedQuery = buildNormalizedQuery(sido, sigungu, dong);
  console.log(`[주소정규화] 표준: "${normalizedQuery}"`);

  const finalObj = {
    sido,
    sigungu,
    dong,
    roadAddress: base.roadAddress || '',
    jibunAddress: base.jibunAddress || '',
    lat: base.lat,
    lng: base.lng,
    admiCd,
    normalizedQuery,
    sourceApi: base.sourceApi || 'composite'
  };
  try { console.log('[주소정규화] 최종 객체:', JSON.stringify(finalObj)); }
  catch(_) { console.log('[주소정규화] 최종 객체:', finalObj); }
  return finalObj;
}

export default normalizeAddress;
