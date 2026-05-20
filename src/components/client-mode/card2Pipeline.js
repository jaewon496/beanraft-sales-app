/**
 * card2Pipeline.js
 * ─────────────────────────────────────────────────────────────────
 * 카드 2 (고객 분석) 전용 데이터 수집 파이프라인.
 *
 * 목적: 카드 2의 데이터 호출 경로/파라미터/fallback 순서/키 매칭을
 *       명시적으로 하드코딩하여 흔들림 없이 보강한다.
 *
 * 원칙:
 *  - 원천 데이터 값(예: "30대 34%")은 바뀔 수 있다.
 *  - 그러나 호출 경로/파라미터/fallback 순서는 코드에 박는다.
 *  - 절대 가짜 데이터 만들지 않는다. 빈 항목은 빈 그대로 둔다.
 *  - 단 메모리 규칙상 "데이터 없음"은 표시 금지 → 비즈맵 캐시까지 끝까지 시도.
 *
 * 호출:
 *   const supplement = await collectCard2Data({
 *     admiCd, dongInfo, coordinates, address, apis, aiData
 *   });
 *
 *   - admiCd: 행정동 코드 (8자리 또는 10자리)
 *   - dongInfo: { dongCd, dongNm, admdstCdNm, nearbyDongs[] }
 *   - coordinates: { lat, lng }
 *   - address: 도로명 주소 문자열
 *   - apis: 이미 수집된 collectedData.apis (vstCst, vstAgeRnk, deliveryHotplace,
 *           openubSales, bizMapGenderAge 등)
 *   - aiData: 이미 생성된 AI 분석 결과 (consumers.mainTarget 등)
 *
 * 반환:
 *   {
 *     mainAge, secondaryAge, genderRatio, lifestyle,
 *     ageSegments, sourceTrace[]
 *   }
 *
 * 통합:
 *   dataMapper.js 카드 2 영역에서 이 함수를 호출하여 결과를
 *   기존 카드 2 결과 위에 덮어쓰기(merge)만 한다.
 *   기존 카드 2 다른 항목(라이프스타일 텍스트 등)은 손대지 않는다.
 * ─────────────────────────────────────────────────────────────────
 */

// 라이프스타일 항목명 변환 맵 (소상공인365 원본 → UI 표시용)
const LIFESTYLE_LABEL_MAP = {
  '식도락': '외식 활동',
  '여행': '타지 방문',
  '쇼핑': '생활 구매',
  '영화': '문화 여가',
};
const convertLifestyleLabel = (name) => LIFESTYLE_LABEL_MAP[name] || name;

// 소상공인365 연령코드 → 라벨
const SBIZ_AGE_MAP = {
  M10: '10대', M20: '20대', M30: '30대', M40: '40대', M50: '50대', M60: '60대+',
};

// 비즈맵 연령 라벨 정규화
// ageGrp 필드는 "20대"처럼 한국어가 오기도 하고, 1~7 같은 구간 코드가 오기도 한다.
// 코드일 경우 "7대"처럼 잘못된 라벨이 만들어지므로 안전하게 매핑한다.
const BIZMAP_AGE_CODE_MAP = {
  '1': '10대', '2': '20대', '3': '30대', '4': '40대',
  '5': '50대', '6': '60대+', '7': '60대+',
};
export function normalizeBizmapAgeLabel(ageRaw) {
  const raw = String(ageRaw == null ? '' : ageRaw).trim();
  if (!raw) return '';
  // 이미 한국어 연령 라벨이면 숫자대 형태로 정규화 (예: "20대 미만", "20대" → "20대")
  if (/\d/.test(raw) && raw.includes('대')) {
    const n = (raw.match(/\d+/) || [])[0];
    if (n) {
      const num = parseInt(n, 10);
      if (num >= 60) return '60대+';
      if (num >= 10 && num <= 50) return `${num}대`;
    }
  }
  const digits = raw.replace(/[^0-9]/g, '');
  if (!digits) return raw;
  // 두 자리 이상이면 실제 나이대(20,30,...) → 그대로 사용
  if (digits.length >= 2) {
    const num = parseInt(digits.slice(0, 2), 10);
    if (num >= 60) return '60대+';
    if (num >= 10 && num <= 50) return `${num}대`;
    return `${num}대`;
  }
  // 한 자리면 구간 코드로 간주하여 매핑
  return BIZMAP_AGE_CODE_MAP[digits] || `${digits}0대`;
}

// 비즈맵 yyyymm 자동 계산 (현재월-2개월 데이터까지가 보통 가용)
function getCurrentYyyymm() {
  const d = new Date();
  d.setMonth(d.getMonth() - 2);
  return `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}`;
}
function getPrevYyyymm(yyyymm) {
  const y = parseInt(yyyymm.slice(0, 4), 10);
  const m = parseInt(yyyymm.slice(4, 6), 10);
  const prevY = m === 1 ? y - 1 : y;
  const prevM = m === 1 ? 12 : m - 1;
  return `${prevY}${String(prevM).padStart(2, '0')}`;
}

// 안전 숫자 변환
const toNum = (v) => {
  const n = parseFloat(v);
  return isNaN(n) ? 0 : n;
};

// 객체 깊이 키 체크 ('ageRatios.30대' 형식)
function hasDeepKey(obj, path) {
  if (!obj) return false;
  const keys = path.split('.');
  let cur = obj;
  for (const k of keys) {
    if (cur == null || typeof cur !== 'object') return false;
    if (!(k in cur)) return false;
    cur = cur[k];
  }
  return cur != null && cur !== '';
}

// ─────────────────────────────────────────────────────────────────
// SOURCES 배열 - 카드 2가 사용하는 5개 소스 (1순위~5순위)
// 각 소스는 endpoint/params/extract/requiredKeys를 명시적으로 박는다
// ─────────────────────────────────────────────────────────────────
const SOURCES = [
  // ─── 1순위: 소상공인365 소비연령 (vstCst) ───
  {
    name: 'vstCst',
    label: '소상공인365 소비연령 (1순위)',
    apisKey: 'vstCst',  // collectedData.apis 내 키
    endpoint: '/api/sbiz-proxy?api=sbiz&endpoint=/sbiz/api/bizonSttus/VstCst/search.json',
    params: (ctx) => ({
      dongCd: ctx.admiCd,  // 8자리 또는 10자리 행정동 코드
    }),
    extract: (resp) => {
      // resp.data는 [{age:'M30', pipcnt:1234, ageclNm:'30대'}, ...] 형식
      const arr = Array.isArray(resp?.data) ? resp.data : (Array.isArray(resp) ? resp : null);
      if (!arr || arr.length === 0) return null;
      const sorted = [...arr].sort((a, b) => (b.pipcnt || 0) - (a.pipcnt || 0));
      const total = sorted.reduce((s, d) => s + (d.pipcnt || 0), 0);
      if (total === 0) return null;
      const ageRatios = {};
      sorted.forEach(d => {
        const label = SBIZ_AGE_MAP[d.age] || d.ageclNm || d.age || '';
        if (label) ageRatios[label] = Math.round((d.pipcnt / total) * 100);
      });
      const top = sorted[0];
      const second = sorted[1];
      return {
        mainAge: top ? `${SBIZ_AGE_MAP[top.age] || top.ageclNm || top.age} (${Math.round((top.pipcnt / total) * 100)}%)` : null,
        secondaryAge: second ? `${SBIZ_AGE_MAP[second.age] || second.ageclNm || second.age} (${Math.round((second.pipcnt / total) * 100)}%)` : null,
        ageSegments: ageRatios,
        ageRatios,
      };
    },
    requiredKeys: ['ageRatios', 'mainAge'],
  },

  // ─── 2순위: 소상공인365 방문연령 순위 (vstAgeRnk) ───
  {
    name: 'vstAgeRnk',
    label: '소상공인365 방문연령 순위 (2순위)',
    apisKey: 'vstAgeRnk',
    endpoint: '/api/sbiz-proxy?api=sbiz&endpoint=/sbiz/api/bizonSttus/VstAgeRnk/search.json',
    params: (ctx) => ({
      dongCd: ctx.admiCd,
    }),
    extract: (resp) => {
      const arr = Array.isArray(resp?.data) ? resp.data : (Array.isArray(resp) ? resp : null);
      if (!arr || arr.length === 0) return null;
      const sorted = [...arr].sort((a, b) => (b.pipcnt || 0) - (a.pipcnt || 0));
      const total = sorted.reduce((s, d) => s + (d.pipcnt || 0), 0);
      if (total === 0) return null;
      const ageRatios = {};
      sorted.forEach(d => {
        const label = SBIZ_AGE_MAP[d.age] || d.ageclNm || d.age || '';
        if (label) ageRatios[label] = Math.round((d.pipcnt / total) * 100);
      });
      const top = sorted[0];
      const second = sorted[1];
      return {
        mainAge: top ? `${SBIZ_AGE_MAP[top.age] || top.ageclNm || top.age} (${Math.round((top.pipcnt / total) * 100)}%)` : null,
        secondaryAge: second ? `${SBIZ_AGE_MAP[second.age] || second.ageclNm || second.age} (${Math.round((second.pipcnt / total) * 100)}%)` : null,
        ageSegments: ageRatios,
        ageRatios,
      };
    },
    requiredKeys: ['ageRatios', 'mainAge'],
  },

  // ─── 3순위: 비즈맵 성별·연령 (genderAgeTrendList) ───
  // collectedData.apis.bizMapGenderAge로 저장되어 있음
  {
    name: 'bizmapGenderAge',
    label: '비즈맵 성별·연령 (3순위, 보조)',
    apisKey: 'bizMapGenderAge',
    endpoint: '/.netlify/functions/nicebizmap-proxy',
    params: (ctx) => ({
      admiCd: ctx.admiCd,
      upjong3Cd: 'Q13007',
      upjong3Nm: '커피전문점',
      yyyymm: getCurrentYyyymm(),
      prevYyyymm: getPrevYyyymm(getCurrentYyyymm()),
      region: {
        admiCd: ctx.admiCd,
        admiData: {
          megaNm: ctx.dongInfo?.megaNm || '',
          ctyNm: ctx.dongInfo?.ctyNm || '',
          admiNm: ctx.dongInfo?.admdstCdNm || ctx.dongInfo?.dongNm || '',
        },
      },
      address: ctx.address || '',
      xAxis: ctx.coordinates?.lng || null,
      yAxis: ctx.coordinates?.lat || null,
    }),
    extract: (resp) => {
      // resp.data는 genderAgeTrendList 배열 (이미 collectedData.apis.bizMapGenderAge.data로 저장됨)
      const arr = Array.isArray(resp?.data) ? resp.data : (Array.isArray(resp) ? resp : null);
      if (!arr || arr.length === 0) return null;
      // 가장 최신 stdYm 추출 후 그 시점 데이터만 사용
      const latestYm = arr.reduce((mx, r) => {
        const ym = r?.stdYm || r?.stdMon || r?.ym || '';
        return ym > mx ? ym : mx;
      }, '');
      const rows = latestYm ? arr.filter(r => (r?.stdYm || r?.stdMon || r?.ym) === latestYm) : arr;
      let maleSum = 0, femaleSum = 0;
      const ageMap = {};
      rows.forEach(r => {
        const g = String(r?.gender ?? r?.sex ?? r?.sexNm ?? '');
        const ageRaw = String(r?.ageGrp ?? r?.ageNm ?? r?.ageclNm ?? r?.age ?? '');
        const rate = toNum(r?.slamtRate ?? r?.slamtRt ?? r?.rate ?? r?.rt ?? r?.amt ?? 0);
        if (rate <= 0) return;
        if (g.includes('남') || g.toLowerCase().includes('m')) maleSum += rate;
        else if (g.includes('여') || g.toLowerCase().includes('f') || g.toLowerCase().includes('w')) femaleSum += rate;
        const ageLabel = normalizeBizmapAgeLabel(ageRaw);
        if (ageLabel) ageMap[ageLabel] = (ageMap[ageLabel] || 0) + rate;
      });
      const total = maleSum + femaleSum;
      const result = {};
      if (total > 0) {
        const malePct = Math.round((maleSum / total) * 100);
        result.genderRatio = `여 ${100 - malePct}% / 남 ${malePct}%`;
        result.maleRatio = malePct;
        result.femaleRatio = 100 - malePct;
      }
      const ageEntries = Object.entries(ageMap).filter(([, v]) => v > 0);
      const ageTotal = ageEntries.reduce((s, [, v]) => s + v, 0);
      if (ageEntries.length > 0 && ageTotal > 0) {
        const ageRatios = {};
        ageEntries.forEach(([k, v]) => { ageRatios[k] = Math.round((v / ageTotal) * 100); });
        const sortedAges = [...ageEntries].sort((a, b) => b[1] - a[1]);
        result.mainAge = `${sortedAges[0][0]} (${Math.round((sortedAges[0][1] / ageTotal) * 100)}%)`;
        if (sortedAges[1]) {
          result.secondaryAge = `${sortedAges[1][0]} (${Math.round((sortedAges[1][1] / ageTotal) * 100)}%)`;
        }
        result.ageSegments = ageRatios;
        result.ageRatios = ageRatios;
      }
      return Object.keys(result).length > 0 ? result : null;
    },
    requiredKeys: ['genderRatio'],
    // 비즈맵 캐시 fallback (외부 9999 또는 menuData 없음 시)
    fallbackCache: [
      'localStorage:beancraft_bizmap_cache_{admiCd}_Q13007',
      'localStorage:beancraft_bizmap_cache_{admiCd8}_Q13007',
      'firebase:bizmapCache/{admiCd}_Q13007',
      'firebase:bizmapCache/{admiCd8}_Q13007',
    ],
  },

  // ─── 4순위: 오픈업 매출 (openubSales) ───
  {
    name: 'openubSales',
    label: '오픈업 매출 (4순위)',
    apisKey: 'openubSales',
    endpoint: '/.netlify/functions/openub-sales-proxy',
    params: (ctx) => ({
      lat: ctx.coordinates?.lat,
      lng: ctx.coordinates?.lng,
      radius: 500,
    }),
    extract: (resp) => {
      // openubSales.data는 { gender:{male,female}, age:[..], type:{single,married,withChild} }
      const data = resp?.data || resp;
      if (!data) return null;
      const result = {};
      // gender
      const gender = data.gender;
      if (gender && typeof gender === 'object') {
        if (typeof gender.male === 'number' && typeof gender.female === 'number') {
          const total = gender.male + gender.female;
          if (total > 0) {
            const malePct = Math.round((gender.male / total) * 100);
            result.maleRatio = malePct;
            result.femaleRatio = 100 - malePct;
            result.genderRatio = `여 ${100 - malePct}% / 남 ${malePct}%`;
          }
        } else if (Array.isArray(gender) && gender.length >= 2) {
          const total = gender.reduce((s, v) => s + (v || 0), 0);
          if (total > 0) {
            const malePct = Math.round((gender[0] / total) * 100);
            result.maleRatio = malePct;
            result.femaleRatio = 100 - malePct;
            result.genderRatio = `여 ${100 - malePct}% / 남 ${malePct}%`;
          }
        }
      }
      // age
      const age = data.age;
      if (age) {
        const labels = ['20대', '30대', '40대', '50대', '60대+'];
        let entries = [];
        if (Array.isArray(age) && age.length >= 4) {
          const total = age.reduce((s, v) => s + (v || 0), 0);
          if (total > 0) {
            entries = age.slice(0, 5).map((v, i) => [labels[i] || `${(i + 2) * 10}대`, v]);
          }
        } else if (typeof age === 'object' && !Array.isArray(age)) {
          entries = Object.entries(age).filter(([, v]) => typeof v === 'number' && v > 0);
        }
        const total = entries.reduce((s, [, v]) => s + v, 0);
        if (entries.length > 0 && total > 0) {
          const ageRatios = {};
          entries.forEach(([k, v]) => { ageRatios[k] = Math.round((v / total) * 100); });
          const sorted = [...entries].sort((a, b) => b[1] - a[1]);
          result.mainAge = `${sorted[0][0]} (${Math.round((sorted[0][1] / total) * 100)}%)`;
          if (sorted[1]) {
            result.secondaryAge = `${sorted[1][0]} (${Math.round((sorted[1][1] / total) * 100)}%)`;
          }
          result.ageSegments = ageRatios;
          result.ageRatios = ageRatios;
        }
      }
      // type (라이프스타일 - 1인/기혼/자녀)
      const typeData = data.type;
      if (typeData && typeof typeData === 'object' && !Array.isArray(typeData)) {
        const total = Object.values(typeData).reduce((s, v) => s + (typeof v === 'number' ? v : 0), 0);
        if (total > 0) {
          result.lifestyle = Object.entries(typeData)
            .filter(([, v]) => typeof v === 'number' && v > 0)
            .map(([k, v]) => `${k} ${Math.round((v / total) * 100)}%`)
            .join(' / ');
        }
      }
      return Object.keys(result).length > 0 ? result : null;
    },
    requiredKeys: ['mainAge'],
  },

  // ─── 5순위: 소상공인365 배달 핫플레이스 (deliveryHotplace, 보조) ───
  // 좌표 → mjrBzznno 자동 매핑(프록시 내부). 검색 좌표 부근 핫플레이스 영역 데이터 호출.
  {
    name: 'deliveryHotplace',
    label: '소상공인365 배달 (5순위, 보조)',
    apisKey: 'deliveryHotplace',
    endpoint: '/api/sbiz-proxy?api=open&apiName=deliveryHotplace',
    params: (ctx) => {
      return {
        bizonTheme: 'DLVY',
        wgs84_lat: ctx.coordinates?.lat || '',
        wgs84_lng: ctx.coordinates?.lng || '',
      };
    },
    extract: (resp) => {
      const data = resp?.data || resp;
      if (!data) return null;
      const result = {};
      // 성별 비율
      const gList = data.vstCustGenRtList || [];
      const maleG = gList.find(g => (g.genNm || g.keyD || '').includes('남'));
      const femaleG = gList.find(g => (g.genNm || g.keyD || '').includes('여'));
      let maleR = null, femaleR = null;
      if (maleG) maleR = toNum(maleG.genPopnumRt ?? maleG.popnumRate ?? maleG.rtVal ?? maleG.valD);
      if (femaleG) femaleR = toNum(femaleG.genPopnumRt ?? femaleG.popnumRate ?? femaleG.rtVal ?? femaleG.valD);
      if (maleR && femaleR) {
        const total = maleR + femaleR;
        const malePct = Math.round((maleR / total) * 100);
        result.maleRatio = malePct;
        result.femaleRatio = 100 - malePct;
        result.genderRatio = `여 ${100 - malePct}% / 남 ${malePct}%`;
      }
      // 연령대별 매출 (vstCustGenAgeSlamtList)
      const genAgeList = data.vstCustGenAgeSlamtList || [];
      const dlvyMale = genAgeList.find(g => (g.cnsmpGenNm || '').includes('남'));
      const dlvyFemale = genAgeList.find(g => (g.cnsmpGenNm || '').includes('여'));
      if (dlvyMale || dlvyFemale) {
        const ageKeys = ['gen20CnsmpAmt', 'gen30CnsmpAmt', 'gen40CnsmpAmt', 'gen50CnsmpAmt', 'gen60OverCnsmpAmt'];
        const ageLabels = ['20대', '30대', '40대', '50대', '60대+'];
        const combined = ageKeys.map((k, i) => ({
          name: ageLabels[i],
          amt: toNum(dlvyMale?.[k]) + toNum(dlvyFemale?.[k]),
        })).filter(x => x.amt > 0);
        const total = combined.reduce((s, x) => s + x.amt, 0);
        if (total > 0) {
          const sorted = [...combined].sort((a, b) => b.amt - a.amt);
          const ageRatios = {};
          combined.forEach(x => { ageRatios[x.name] = Math.round((x.amt / total) * 100); });
          result.mainAge = `${sorted[0].name} (${Math.round((sorted[0].amt / total) * 100)}%)`;
          if (sorted[1]) {
            result.secondaryAge = `${sorted[1].name} (${Math.round((sorted[1].amt / total) * 100)}%)`;
          }
          result.ageSegments = ageRatios;
          result.ageRatios = ageRatios;
        }
      }
      // 라이프스타일 (남/여 TOP3 합산)
      const mLife = (data.vstMaleCustMjrLifeList || []).slice(0, 3);
      const fLife = (data.vstFemaleCustMjrLifeList || []).slice(0, 3);
      const lifeParts = [];
      mLife.forEach(m => {
        const name = convertLifestyleLabel(m.maleCustHbbNm ?? m.keyD ?? '');
        const pct = toNum(m.maleCustRate ?? m.maleCustRt ?? m.rtVal);
        if (name && pct > 0) lifeParts.push(`남 ${name}(${pct.toFixed(0)}%)`);
      });
      fLife.forEach(f => {
        const name = convertLifestyleLabel(f.femaleCustHbbNm ?? f.keyD ?? '');
        const pct = toNum(f.femaleCustRate ?? f.femaleCustRt ?? f.rtVal);
        if (name && pct > 0) lifeParts.push(`여 ${name}(${pct.toFixed(0)}%)`);
      });
      if (lifeParts.length > 0) result.lifestyle = lifeParts.join(', ');
      return Object.keys(result).length > 0 ? result : null;
    },
    requiredKeys: ['mainAge'],
  },
];

// ─────────────────────────────────────────────────────────────────
// 헬퍼: 이미 수집된 apis에서 소스 시도
// ─────────────────────────────────────────────────────────────────
function trySourceFromApis(source, apis) {
  if (!apis || !source.apisKey) return { complete: false, data: null };
  const apiEntry = apis[source.apisKey];
  if (!apiEntry) return { complete: false, data: null };
  try {
    const extracted = source.extract(apiEntry);
    if (!extracted) return { complete: false, data: null };
    // requiredKeys 체크
    const allRequired = (source.requiredKeys || []).every(k => hasDeepKey(extracted, k));
    return { complete: allRequired, data: extracted };
  } catch (e) {
    console.warn(`[카드2 파이프라인] ${source.name} extract 실패:`, e.message);
    return { complete: false, data: null };
  }
}

// ─────────────────────────────────────────────────────────────────
// 헬퍼: 비즈맵 fallback 캐시 시도 (localStorage + Firebase)
// bizmapDomToApiFormat 변환은 App.jsx에서 이미 처리되어 apis.bizMapGenderAge로 들어오지만,
// 누락 시 직접 캐시에서 genderAgeTrendList만 추출
// ─────────────────────────────────────────────────────────────────
async function tryCache(source, ctx) {
  if (!source.fallbackCache) return null;
  const admiCd = String(ctx.admiCd || '');
  const admiCd8 = admiCd.length === 10 ? admiCd.slice(0, 8) : (admiCd.length === 8 ? admiCd : admiCd);
  const candidates = [admiCd, admiCd8].filter((v, i, a) => v && a.indexOf(v) === i);

  // localStorage 시도
  if (typeof window !== 'undefined' && window.localStorage) {
    for (const k of candidates) {
      try {
        const lsKey = `beancraft_bizmap_cache_${k}_Q13007`;
        const v = window.localStorage.getItem(lsKey);
        if (v) {
          try {
            const parsed = JSON.parse(v);
            // 캐시는 DOM payload 형식 - genderAgeTrendList 직접 추출 시도
            const list = parsed?.genderAgeTrendList || parsed?.data?.genderAgeTrendList;
            if (Array.isArray(list) && list.length > 0) {
              const extracted = source.extract({ data: list });
              if (extracted) {
                console.log(`[카드2 파이프라인] ${source.name} → localStorage 캐시 HIT (${lsKey})`);
                return extracted;
              }
            }
          } catch (_) { /* parse fail */ }
        }
      } catch (_) { /* ignore */ }
    }
  }

  // Firebase 시도
  if (typeof window !== 'undefined' && window.database) {
    for (const k of candidates) {
      try {
        const snap = await window.database.ref(`bizmapCache/${k}_Q13007`).once('value');
        const fbCache = snap.val();
        if (fbCache) {
          const list = fbCache?.genderAgeTrendList || fbCache?.data?.genderAgeTrendList;
          if (Array.isArray(list) && list.length > 0) {
            const extracted = source.extract({ data: list });
            if (extracted) {
              console.log(`[카드2 파이프라인] ${source.name} → Firebase 캐시 HIT (bizmapCache/${k}_Q13007)`);
              return extracted;
            }
          }
        }
      } catch (e) { /* ignore */ }
    }
  }

  return null;
}

// ─────────────────────────────────────────────────────────────────
// 헬퍼: 결과 병합 (이미 채워진 핵심 필드는 덮어쓰지 않음)
// ─────────────────────────────────────────────────────────────────
function mergeIntoResult(result, partial, sourceName) {
  if (!partial) return;
  const filledFields = [];
  ['mainAge', 'secondaryAge', 'genderRatio', 'lifestyle'].forEach(field => {
    if (!result[field] && partial[field]) {
      result[field] = partial[field];
      filledFields.push(field);
    }
  });
  if (!result.ageSegments && partial.ageSegments && Object.keys(partial.ageSegments).length > 0) {
    result.ageSegments = partial.ageSegments;
    filledFields.push('ageSegments');
  }
  // maleRatio/femaleRatio는 항상 보강 (50/50 기본값일 때만)
  if ((result.maleRatio == null || (result.maleRatio === 50 && result.femaleRatio === 50))
    && partial.maleRatio != null) {
    result.maleRatio = partial.maleRatio;
    result.femaleRatio = partial.femaleRatio;
    if (!filledFields.includes('genderRatio')) filledFields.push('maleRatio');
  }
  if (filledFields.length > 0) {
    result.sourceTrace.push({ source: sourceName, filled: filledFields });
  }
}

// ─────────────────────────────────────────────────────────────────
// 메인 함수: collectCard2Data
// ─────────────────────────────────────────────────────────────────
export async function collectCard2Data(context) {
  const ctx = context || {};
  const result = {
    mainAge: null,        // "30대 (34%)"
    secondaryAge: null,   // "50대+ (24%)"
    genderRatio: null,    // "여 52% / 남 48%"
    lifestyle: null,      // 라이프스타일 텍스트
    ageSegments: null,    // {20대:22, 30대:34, 40대:20, 50대:24}
    maleRatio: null,
    femaleRatio: null,
    sourceTrace: [],      // 어느 소스에서 어느 항목 채웠는지 로그
  };

  for (const source of SOURCES) {
    // 1) 이미 수집된 apis에서 먼저 시도
    const fromApis = trySourceFromApis(source, ctx.apis);
    let logMsg = `[카드2 파이프라인] ${source.name} 시도`;
    if (fromApis.data) {
      const filledKeys = (source.requiredKeys || []).filter(k => hasDeepKey(fromApis.data, k));
      logMsg += ` → ${filledKeys.length}/${(source.requiredKeys || []).length} 키 받음`;
      logMsg += fromApis.complete ? ' (성공)' : ' (부분)';
      console.log(logMsg);
      mergeIntoResult(result, fromApis.data, source.name);
      if (fromApis.complete) continue;
    } else {
      logMsg += ' → 0개';
      console.log(logMsg);
    }

    // 2) 캐시 fallback (비즈맵처럼 fallbackCache 정의된 경우)
    if (source.fallbackCache) {
      const fromCache = await tryCache(source, ctx);
      if (fromCache) {
        const filledKeys = Object.keys(fromCache).length;
        console.log(`[카드2 파이프라인] ${source.name} → 캐시 보충 ${filledKeys}개 항목`);
        mergeIntoResult(result, fromCache, source.name + '_cache');
      } else {
        console.log(`[카드2 파이프라인] ${source.name} → 캐시 없음`);
      }
    }
  }

  console.log('[카드2 파이프라인] 소스 추적:', result.sourceTrace);
  console.log('[카드2 파이프라인] 최종 결과:', {
    mainAge: result.mainAge,
    secondaryAge: result.secondaryAge,
    genderRatio: result.genderRatio,
    lifestyle: result.lifestyle,
    ageSegmentsKeys: result.ageSegments ? Object.keys(result.ageSegments).length : 0,
  });

  return result;
}

// ─────────────────────────────────────────────────────────────────
// 동기 버전: collectCard2DataSync
// dataMapper.js (sync)에서 호출하기 위한 sync 변형.
// Firebase fallback 없이 localStorage + 이미 수집된 apis만 사용.
// ─────────────────────────────────────────────────────────────────
function tryCacheSync(source, ctx) {
  if (!source.fallbackCache) return null;
  const admiCd = String(ctx.admiCd || '');
  const admiCd8 = admiCd.length === 10 ? admiCd.slice(0, 8) : (admiCd.length === 8 ? admiCd : admiCd);
  const candidates = [admiCd, admiCd8].filter((v, i, a) => v && a.indexOf(v) === i);

  if (typeof window === 'undefined' || !window.localStorage) return null;

  for (const k of candidates) {
    try {
      const lsKey = `beancraft_bizmap_cache_${k}_Q13007`;
      const v = window.localStorage.getItem(lsKey);
      if (v) {
        try {
          const parsed = JSON.parse(v);
          const list = parsed?.genderAgeTrendList || parsed?.data?.genderAgeTrendList;
          if (Array.isArray(list) && list.length > 0) {
            const extracted = source.extract({ data: list });
            if (extracted) {
              console.log(`[카드2 파이프라인] ${source.name} → localStorage 캐시 HIT (${lsKey})`);
              return extracted;
            }
          }
        } catch (_) { /* parse fail */ }
      }
    } catch (_) { /* ignore */ }
  }
  return null;
}

export function collectCard2DataSync(context) {
  const ctx = context || {};
  const result = {
    mainAge: null,
    secondaryAge: null,
    genderRatio: null,
    lifestyle: null,
    ageSegments: null,
    maleRatio: null,
    femaleRatio: null,
    sourceTrace: [],
  };

  for (const source of SOURCES) {
    const fromApis = trySourceFromApis(source, ctx.apis);
    let logMsg = `[카드2 파이프라인] ${source.name} 시도`;
    if (fromApis.data) {
      const filledKeys = (source.requiredKeys || []).filter(k => hasDeepKey(fromApis.data, k));
      logMsg += ` → ${filledKeys.length}/${(source.requiredKeys || []).length} 키 받음`;
      logMsg += fromApis.complete ? ' (성공)' : ' (부분)';
      console.log(logMsg);
      mergeIntoResult(result, fromApis.data, source.name);
      if (fromApis.complete) continue;
    } else {
      logMsg += ' → 0개';
      console.log(logMsg);
    }

    if (source.fallbackCache) {
      const fromCache = tryCacheSync(source, ctx);
      if (fromCache) {
        const filledKeys = Object.keys(fromCache).length;
        console.log(`[카드2 파이프라인] ${source.name} → 캐시 보충 ${filledKeys}개 항목`);
        mergeIntoResult(result, fromCache, source.name + '_cache');
      }
    }
  }

  console.log('[카드2 파이프라인] 소스 추적:', result.sourceTrace);
  return result;
}

// 테스트/디버그용 export
export const __SOURCES = SOURCES;
