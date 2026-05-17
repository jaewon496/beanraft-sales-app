// Netlify Functions - 소상공인365 상세분석 리포트 프록시
// sang_gwon1~8.sg HTML 페이지를 호출하고 JavaScript 변수를 파싱하여 JSON 반환

const https = require('https');
const zlib = require('zlib');

// ─── WGS84 → TM 좌표 변환 (sbiz-proxy.js에서 복사) ───
function wgs84ToTM(lat, lng) {
  const a = 6378137.0, f = 1 / 298.257222101;
  const lat0 = 38 * Math.PI / 180, lng0 = 127 * Math.PI / 180;
  const k0 = 1.0, x0 = 200000, y0 = 500000;
  const e2 = 2 * f - f * f;
  const latRad = lat * Math.PI / 180, lngRad = lng * Math.PI / 180;
  const N = a / Math.sqrt(1 - e2 * Math.sin(latRad) * Math.sin(latRad));
  const T = Math.tan(latRad) * Math.tan(latRad);
  const C = e2 / (1 - e2) * Math.cos(latRad) * Math.cos(latRad);
  const A = (lngRad - lng0) * Math.cos(latRad);
  const M = a * ((1 - e2/4 - 3*e2*e2/64 - 5*e2*e2*e2/256) * latRad - (3*e2/8 + 3*e2*e2/32 + 45*e2*e2*e2/1024) * Math.sin(2*latRad) + (15*e2*e2/256 + 45*e2*e2*e2/1024) * Math.sin(4*latRad) - (35*e2*e2*e2/3072) * Math.sin(6*latRad));
  const M0 = a * ((1 - e2/4 - 3*e2*e2/64 - 5*e2*e2*e2/256) * lat0 - (3*e2/8 + 3*e2*e2/32 + 45*e2*e2*e2/1024) * Math.sin(2*lat0) + (15*e2*e2/256 + 45*e2*e2*e2/1024) * Math.sin(4*lat0) - (35*e2*e2*e2/3072) * Math.sin(6*lat0));
  const xVal = Math.round(k0 * N * (A + (1-T+C)*A*A*A/6 + (5-18*T+T*T+72*C-58*e2/(1-e2))*A*A*A*A*A/120) + x0);
  const yVal = Math.round(k0 * (M - M0 + N * Math.tan(latRad) * (A*A/2 + (5-T+9*C+4*C*C)*A*A*A*A/24 + (61-58*T+T*T+600*C-330*e2/(1-e2))*A*A*A*A*A*A/720)) + y0);
  return { x: xVal, y: yVal };
}

// ─── HTML 페이지 fetch ───
function fetchHtml(url) {
  return new Promise((resolve, reject) => {
    const req = https.get(url, {
      rejectUnauthorized: false,
      headers: {
        'Accept': 'text/html,application/xhtml+xml',
        'Accept-Encoding': 'gzip, deflate',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      },
      timeout: 8000
    }, (res) => {
      const encoding = (res.headers['content-encoding'] || '').toLowerCase();
      let stream = res;
      if (encoding === 'gzip') {
        stream = res.pipe(zlib.createGunzip());
      } else if (encoding === 'deflate') {
        stream = res.pipe(zlib.createInflate());
      }
      let body = '';
      stream.on('data', chunk => body += chunk);
      stream.on('end', () => resolve(body));
      stream.on('error', (e) => reject(e));
    });
    req.on('error', (e) => reject(e));
    req.on('timeout', () => { req.destroy(); reject(new Error('timeout')); });
  });
}

// ─── Java Map toString → JSON 변환 ───
// 입력: "{genNm=남성, popnumRate=48.2, popnum=536498}"
// 출력: {"genNm":"남성", "popnumRate":48.2, "popnum":536498}
function javaMapToJson(str) {
  try {
    // 전체 문자열이 "[{...}, {...}]" 형태인지 확인
    const trimmed = str.trim();
    if (!trimmed.startsWith('[') && !trimmed.startsWith('{')) {
      return str; // Java Map 형태가 아니면 원본 반환
    }

    // 각 {key=value, key=value} 블록을 변환
    const converted = trimmed.replace(/\{([^}]*)\}/g, (match, inner) => {
      const pairs = [];
      // key=value 쌍 분리 (값에 쉼표가 없다고 가정)
      const parts = inner.split(/,\s*/);
      for (const part of parts) {
        const eqIdx = part.indexOf('=');
        if (eqIdx === -1) continue;
        const key = part.substring(0, eqIdx).trim();
        const val = part.substring(eqIdx + 1).trim();
        // 숫자인지 판별
        if (val === '' || val === 'null') {
          pairs.push(`"${key}":null`);
        } else if (!isNaN(val) && val !== '') {
          pairs.push(`"${key}":${val}`);
        } else {
          // 문자열 값 - 내부 따옴표 이스케이프
          pairs.push(`"${key}":"${val.replace(/"/g, '\\"')}"`);
        }
      }
      return '{' + pairs.join(',') + '}';
    });

    return JSON.parse(converted);
  } catch (e) {
    // 파싱 실패 시 원본 문자열 반환
    return str;
  }
}

// ─── HTML에서 JavaScript 변수 추출 ───
function parseAllVars(html) {
  const result = {};

  // 패턴 1: var 변수명 = "문자열"; (Java Map 포함)
  const varStringRegex = /var\s+(\w+)\s*=\s*"([^"]*?)"\s*;/g;
  let match;
  while ((match = varStringRegex.exec(html)) !== null) {
    const [, name, value] = match;
    // Java Map 형태 여부 확인
    if (value.includes('={') || value.match(/\[\{.*=.*\}\]/)) {
      result[name] = javaMapToJson(value);
    } else if (value.startsWith('[{') || value.startsWith('{')) {
      result[name] = javaMapToJson(value);
    } else {
      result[name] = value;
    }
  }

  // 패턴 2: var 변수명 = 숫자;
  const varNumberRegex = /var\s+(\w+)\s*=\s*(-?[\d.]+)\s*;/g;
  while ((match = varNumberRegex.exec(html)) !== null) {
    const [, name, value] = match;
    if (!result[name]) { // 문자열 패턴에서 이미 잡힌 것은 스킵
      result[name] = Number(value);
    }
  }

  // 패턴 3: var 변수명 = []; 후 변수명.push("값") 패턴
  const varArrayInitRegex = /var\s+(\w+)\s*=\s*\[\s*\]\s*;/g;
  const arrayVars = new Set();
  while ((match = varArrayInitRegex.exec(html)) !== null) {
    arrayVars.add(match[1]);
    result[match[1]] = [];
  }

  // push 패턴 수집
  for (const arrName of arrayVars) {
    const pushRegex = new RegExp(arrName + '\\.push\\(([^)]+)\\)', 'g');
    while ((match = pushRegex.exec(html)) !== null) {
      let val = match[1].trim();
      // 따옴표 제거
      if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
        val = val.slice(1, -1);
      }
      // 숫자 변환 시도
      if (!isNaN(val) && val !== '') {
        result[arrName].push(Number(val));
      } else {
        result[arrName].push(val);
      }
    }
  }

  // 패턴 4: var 변수명 = '문자열'; (작은따옴표)
  const varSingleQuoteRegex = /var\s+(\w+)\s*=\s*'([^']*?)'\s*;/g;
  while ((match = varSingleQuoteRegex.exec(html)) !== null) {
    const [, name, value] = match;
    if (!result[name]) {
      result[name] = value;
    }
  }

  // 패턴 5: var 변수명 = [...] 인라인 배열 (push가 아닌 직접 선언)
  const varInlineArrayRegex = /var\s+(\w+)\s*=\s*\[([^\]]*)\]\s*;/g;
  while ((match = varInlineArrayRegex.exec(html)) !== null) {
    const [, name, inner] = match;
    if (!result[name] && inner.trim() !== '') {
      try {
        result[name] = JSON.parse('[' + inner + ']');
      } catch (e) {
        // JSON 파싱 실패 시 쉼표 분리
        result[name] = inner.split(',').map(v => {
          v = v.trim();
          if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) {
            v = v.slice(1, -1);
          }
          return !isNaN(v) && v !== '' ? Number(v) : v;
        });
      }
    }
  }

  return result;
}

// ─── 페이지 URL 생성 ───
function buildUrls(analyNo, analyDate, upjongCd, admiCd, admiNm, tmX, tmY) {
  const base = 'https://bigdata.sbiz.or.kr/gis/bizonAnls/report/sg';

  // sang_gwon1: 좌표 기반 (분석 기본)
  const url1 = `${base}/sang_gwon1.sg?analyNo=${analyNo}&upjongCd=${upjongCd}&xcnts=${tmX}&ydnts=${tmY}&center_x=${tmX}&center_y=${tmY}&analyDate=${analyDate}&a=01&b=01&c=01&apiLogin=&lKey=&xtLoginId=`;

  // sang_gwon2~4, 6~8: admiCd + admiNm 기반
  const commonParams = `analyNo=${analyNo}&analyDate=${analyDate}&upjongCd=${upjongCd}&admiCd=${admiCd}&admiNm=${encodeURIComponent(admiNm)}&xtLoginId=`;

  return {
    sang_gwon1: url1,
    sang_gwon2: `${base}/sang_gwon2.sg?${commonParams}`,
    sang_gwon3: `${base}/sang_gwon3.sg?${commonParams}`,
    sang_gwon4: `${base}/sang_gwon4.sg?${commonParams}`,
    sang_gwon6: `${base}/sang_gwon6.sg?${commonParams}`,
    sang_gwon7: `${base}/sang_gwon7.sg?${commonParams}`,
    sang_gwon8: `${base}/sang_gwon8.sg?${commonParams}`
  };
}

// ─── 메인 핸들러 ───
exports.handler = async (event) => {
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Content-Type': 'application/json; charset=utf-8'
  };

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers: corsHeaders, body: '' };
  }

  const params = event.queryStringParameters || {};
  const { analyNo, analyDate, upjongCd, admiCd, admiNm, lat, lng, pages } = params;

  // 필수 파라미터 검증
  if (!analyNo || !analyDate || !upjongCd) {
    return {
      statusCode: 400,
      headers: corsHeaders,
      body: JSON.stringify({
        error: '필수 파라미터 부족',
        required: 'analyNo, analyDate, upjongCd',
        optional: 'admiCd, admiNm, lat, lng, pages(콤마 구분: 1,2,3,4,6,7,8)'
      })
    };
  }

  const startTime = Date.now();

  try {
    // TM 좌표 변환 (lat/lng 제공 시)
    let tmX = params.xcnts || '0';
    let tmY = params.ydnts || '0';
    if (lat && lng) {
      const tm = wgs84ToTM(parseFloat(lat), parseFloat(lng));
      tmX = String(tm.x);
      tmY = String(tm.y);
    }

    // URL 생성
    const urls = buildUrls(analyNo, analyDate, upjongCd, admiCd || '', admiNm || '', tmX, tmY);

    // 호출할 페이지 결정 (pages 파라미터로 선택 가능)
    let pageKeys = Object.keys(urls);
    if (pages) {
      const requested = pages.split(',').map(p => `sang_gwon${p.trim()}`);
      pageKeys = pageKeys.filter(k => requested.includes(k));
    }

    // 병렬 호출
    const fetchPromises = pageKeys.map(async (key) => {
      try {
        const html = await fetchHtml(urls[key]);
        const vars = parseAllVars(html);
        return { key, vars, ok: true };
      } catch (e) {
        return { key, vars: {}, ok: false, error: e.message };
      }
    });

    const results = await Promise.allSettled(fetchPromises);

    // 결과 조합
    const data = {};
    const errors = [];

    for (const r of results) {
      if (r.status === 'fulfilled') {
        const { key, vars, ok, error } = r.value;
        data[key] = vars;
        if (!ok) errors.push({ page: key, error });
      } else {
        errors.push({ page: 'unknown', error: r.reason?.message || 'failed' });
      }
    }

    const elapsed = Date.now() - startTime;

    return {
      statusCode: 200,
      headers: corsHeaders,
      body: JSON.stringify({
        analyNo,
        analyDate,
        upjongCd,
        admiCd: admiCd || null,
        admiNm: admiNm || null,
        pages: pageKeys,
        data,
        errors: errors.length > 0 ? errors : undefined,
        elapsed: `${elapsed}ms`
      })
    };

  } catch (e) {
    return {
      statusCode: 500,
      headers: corsHeaders,
      body: JSON.stringify({ error: e.message, elapsed: `${Date.now() - startTime}ms` })
    };
  }
};
