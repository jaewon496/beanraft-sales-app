// LOCALDATA 전국 카페/휴게음식점 CSV → Firebase 시군구별 적재
// 입력: /tmp/ld_check/cafe.csv (CP949, 약 63만 건)
// 출력: Firebase localdata/{시군구명} 노드에 배열 저장
// 실행: node scripts/load_localdata_to_firebase.js

const fs = require('fs');
const path = require('path');
const iconv = require('iconv-lite');
const https = require('https');

// Windows: /tmp = C:\Users\<user>\AppData\Local\Temp (MSYS) — Node.js needs Windows path
const CSV_PATH = process.env.LOCALDATA_CSV
  || (process.platform === 'win32'
      ? path.join(process.env.LOCALAPPDATA || (process.env.USERPROFILE + '\\AppData\\Local'), 'Temp', 'ld_check', 'cafe.csv')
      : '/tmp/ld_check/cafe.csv');
const FB_BASE = 'https://beancraft-sales-team-default-rtdb.asia-southeast1.firebasedatabase.app';

// CSV 헤더 (1-based) → 0-based 인덱스
const COL = {
  apvDate: 5,      // 인허가일자 (6번)
  status:  8,      // 영업상태명 (9번)
  closeDate: 11,   // 폐업일자 (12번)
  area:    16,     // 소재지면적 (17번)
  jibunAddr: 18,   // 소재지전체주소 (19번)
  rdnAddr:  19,    // 도로명전체주소 (20번)
  name:    21,     // 사업장명 (22번)
  upTaeNm: 25,     // 업태구분명 (26번)
  x:       26,     // 좌표x (27번)
  y:       27,     // 좌표y (28번)
};

// 카페 키워드
const CAFE_KW = ['커피', '카페', '다방'];

// 간단한 CSV 라인 파서 (큰따옴표 안의 콤마 처리)
function parseCsvLine(line) {
  const out = [];
  let cur = '';
  let inQ = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (inQ && line[i+1] === '"') { cur += '"'; i++; }
      else inQ = !inQ;
    } else if (ch === ',' && !inQ) {
      out.push(cur);
      cur = '';
    } else {
      cur += ch;
    }
  }
  out.push(cur);
  return out;
}

// 시군구 추출 (전체주소에서)
function extractSigungu(addr) {
  if (!addr) return '';
  // "서울특별시 강남구 ..." → "강남구"
  // "경기도 수원시 영통구 ..." → "영통구"
  // "경기도 수원시 ..." → "수원시"  (단일 시)
  // "세종특별자치시 ..." → "세종시"
  const parts = addr.trim().split(/\s+/);
  if (parts.length < 2) return '';

  // 세종 특수 처리
  if (parts[0].includes('세종')) return '세종시';

  // 시도 다음 부분이 시/군/구
  for (let i = 1; i < Math.min(parts.length, 4); i++) {
    const p = parts[i];
    if (/(시|군|구)$/.test(p)) {
      // "수원시 영통구" 같은 경우 더 작은 단위 (구) 채택
      // 다음 부분이 또 "구"로 끝나면 그것을 사용
      if (i + 1 < parts.length && /구$/.test(parts[i+1])) {
        return parts[i+1];
      }
      return p;
    }
  }
  return '';
}

// HTTPS PUT 요청
function fbPut(pathStr, jsonBody) {
  return new Promise((resolve, reject) => {
    const url = new URL(`${FB_BASE}${pathStr}`);
    const body = JSON.stringify(jsonBody);
    const req = https.request({
      hostname: url.hostname,
      path: url.pathname + url.search,
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(body),
      },
      timeout: 60000,
    }, (res) => {
      let data = '';
      res.on('data', (c) => data += c);
      res.on('end', () => {
        if (res.statusCode >= 200 && res.statusCode < 300) resolve({ ok: true, status: res.statusCode });
        else resolve({ ok: false, status: res.statusCode, body: data.slice(0, 200) });
      });
    });
    req.on('error', reject);
    req.on('timeout', () => { req.destroy(); reject(new Error('timeout')); });
    req.write(body);
    req.end();
  });
}

async function main() {
  console.log('[loader] CSV 읽기 시작:', CSV_PATH);
  const buf = fs.readFileSync(CSV_PATH);
  console.log('[loader] CSV 바이트:', buf.length);

  console.log('[loader] CP949 → UTF-8 디코딩');
  const text = iconv.decode(buf, 'cp949');
  console.log('[loader] UTF-8 길이:', text.length);

  const lines = text.split(/\r?\n/);
  console.log('[loader] 총 줄 수:', lines.length);

  // 헤더 스킵
  const dataLines = lines.slice(1).filter(l => l.trim().length > 0);
  console.log('[loader] 데이터 줄 수:', dataLines.length);

  const bySigungu = new Map(); // sigungu → array
  let totalCafe = 0;
  let skipNoAddr = 0;
  let skipNoSigungu = 0;
  let skipNotCafe = 0;
  let parseErr = 0;

  for (let i = 0; i < dataLines.length; i++) {
    if (i % 50000 === 0) console.log(`[loader] 처리 ${i}/${dataLines.length}`);
    let cols;
    try {
      cols = parseCsvLine(dataLines[i]);
    } catch (e) {
      parseErr++;
      continue;
    }
    if (cols.length < 28) { parseErr++; continue; }

    const upTae = (cols[COL.upTaeNm] || '').trim();
    const isCafe = CAFE_KW.some(kw => upTae.includes(kw));
    if (!isCafe) { skipNotCafe++; continue; }

    const rdnAddr = (cols[COL.rdnAddr] || '').trim();
    const jibunAddr = (cols[COL.jibunAddr] || '').trim();
    const addr = rdnAddr || jibunAddr;
    if (!addr) { skipNoAddr++; continue; }

    const sigungu = extractSigungu(addr);
    if (!sigungu) { skipNoSigungu++; continue; }

    const name = (cols[COL.name] || '').trim();
    const apvDate = (cols[COL.apvDate] || '').trim();
    const closeDate = (cols[COL.closeDate] || '').trim();
    const status = (cols[COL.status] || '').trim();
    const area = parseFloat(cols[COL.area]) || 0;
    const x = parseFloat(cols[COL.x]) || null;
    const y = parseFloat(cols[COL.y]) || null;

    const item = {
      BPLCNM: name,
      RDNWHLADDR: rdnAddr,
      SITEWHLADDR: jibunAddr,
      APVPERMYMD: apvDate,
      DCBYMD: closeDate,
      TRDSTATENM: status,
      area,
      X: x,
      Y: y,
      UPTAENM: upTae,
    };

    if (!bySigungu.has(sigungu)) bySigungu.set(sigungu, []);
    bySigungu.get(sigungu).push(item);
    totalCafe++;
  }

  console.log('[loader] === 집계 ===');
  console.log('  카페 총:', totalCafe);
  console.log('  주소 없음 스킵:', skipNoAddr);
  console.log('  시군구 추출 실패:', skipNoSigungu);
  console.log('  카페 아님:', skipNotCafe);
  console.log('  파싱 실패:', parseErr);
  console.log('  시군구 수:', bySigungu.size);

  // 강남구 확인
  const gn = bySigungu.get('강남구');
  console.log('  강남구 카페 건수:', gn ? gn.length : 0);

  // Firebase 업로드 (시군구별 PUT)
  console.log('[loader] Firebase 업로드 시작 (시군구별 PUT)');
  const sigunguList = [...bySigungu.keys()].sort();
  let okCnt = 0, failCnt = 0;
  const failed = [];
  for (let i = 0; i < sigunguList.length; i++) {
    const sg = sigunguList[i];
    const items = bySigungu.get(sg);
    const putPath = `/localdata/${encodeURIComponent(sg)}.json`;
    try {
      const res = await fbPut(putPath, items);
      if (res.ok) {
        okCnt++;
        if (i % 20 === 0 || sg === '강남구') console.log(`  [${i+1}/${sigunguList.length}] ${sg}: ${items.length}건 OK`);
      } else {
        failCnt++;
        failed.push({ sg, status: res.status, body: res.body });
        console.log(`  [${i+1}/${sigunguList.length}] ${sg}: ${items.length}건 실패 (${res.status}) ${res.body}`);
      }
    } catch (e) {
      failCnt++;
      failed.push({ sg, error: e.message });
      console.log(`  [${i+1}/${sigunguList.length}] ${sg}: 에러 ${e.message}`);
    }
  }

  console.log('[loader] === 업로드 완료 ===');
  console.log('  성공:', okCnt);
  console.log('  실패:', failCnt);
  if (failed.length > 0) {
    console.log('  실패 목록 (처음 10개):', failed.slice(0, 10));
  }

  // 메타 갱신
  await fbPut('/localdata/_meta.json', {
    updatedAt: new Date().toISOString(),
    totalSigungu: sigunguList.length,
    totalCafes: totalCafe,
    source: 'LOCALDATA 전국 휴게음식점 CSV',
  });

  console.log('[loader] DONE');
}

main().catch(e => { console.error('[loader] FATAL:', e); process.exit(1); });
