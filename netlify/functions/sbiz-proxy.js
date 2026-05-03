// Netlify Functions - 소상공인 API 프록시 (공공데이터포털 + 소상공인365)
// gis/open API 핸들러 추가, WGS84→TM 변환 분리

const https = require('https');
const http = require('http');
const zlib = require('zlib');
const { booleanPointInPolygon } = require('@turf/boolean-point-in-polygon');
const { point: turfPoint, polygon: turfPolygon } = require('@turf/helpers');

// WKT POLYGON 파싱: "POLYGON ((x1 y1, x2 y2, ...))" → GeoJSON ring 배열
// 소상공인365 geom은 TM 좌표(EPSG:5181 변형, x≈200000, y≈450000)이므로 비교 좌표도 TM이어야 함
function parsePolygonWKT(wkt) {
  if (!wkt || typeof wkt !== 'string') return null;
  // POLYGON 또는 MULTIPOLYGON 모두 처리. 우선 첫 번째 ring만 추출(외곽 경계)
  // POLYGON ((x1 y1, x2 y2, ...))
  let match = wkt.match(/POLYGON\s*\(\(([^)]+)\)\)/i);
  if (match) {
    const coords = match[1].split(',').map(p => {
      const parts = p.trim().split(/\s+/).map(Number);
      return [parts[0], parts[1]];
    }).filter(c => isFinite(c[0]) && isFinite(c[1]));
    if (coords.length < 4) return null;
    // 첫/끝점이 동일해야 GeoJSON 폴리곤 유효
    if (coords[0][0] !== coords[coords.length-1][0] || coords[0][1] !== coords[coords.length-1][1]) {
      coords.push([coords[0][0], coords[0][1]]);
    }
    return [coords];
  }
  // MULTIPOLYGON (((...)),((...)))
  match = wkt.match(/MULTIPOLYGON\s*\(\(\(([^)]+)\)\)/i);
  if (match) {
    const coords = match[1].split(',').map(p => {
      const parts = p.trim().split(/\s+/).map(Number);
      return [parts[0], parts[1]];
    }).filter(c => isFinite(c[0]) && isFinite(c[1]));
    if (coords.length < 4) return null;
    if (coords[0][0] !== coords[coords.length-1][0] || coords[0][1] !== coords[coords.length-1][1]) {
      coords.push([coords[0][0], coords[0][1]]);
    }
    return [coords];
  }
  return null;
}

const DATA_GO_KR_API_KEY = '02ca822d8e1bf0357b1d782a02dca991192a1b0a89e6cf6ff7e6c4368653cbcb';

const SBIZ_OPEN_API_KEYS = {
  snsAnaly: 'd46f5d518688912176484b6f894664c5d0b252967d92f4bafc690904381d7ff5',
  simple: 'bb51c6d3d3f93e8172c7888e73eb19afb9120c9f61676c658648ee2853f88e85',
  tour: 'fc2070ca36e0ec845ecfd8c949860cfe4552e56903afcb9bcea07a509f820bcd',
  slsIndex: 'abddbf5dc29670b9209d75e4910c7fd932a8a1a43dcce9d18661585e4040f2fb',
  delivery: '3ba2863eaf4e3b30b3c0237ab9da80ed11f4a7579d4f212d5c318b8e41a3a304',
  startupPublic: '167264f6eef5710d8d79e96b1316e8c2cb85a197d32446d3849008d0376cf098',
  detail: 'b2d9a1ae52aace697124a56c7c2bbed2eeb94fd4996fb5935cb9a25cc4c3c869',
  stcarSttus: '79a86fd460fe7478f52788c4a68a0e6f3406a23ff123c050a21a160a59946fd3',
  storSttus: 'b36c5637768f458919f5179641dac0cd742791750dc016a8591c4e7a6ab649c1',
  weather: '843e44cd955ebc42a684c9c892ada0b122713650e0e85c1f3ebe09c9aeff6319',
  hpReport: 'd269ecf98403fa878587eb925ded6ecf9e02f297da19f5d8ffec5cac7309647a'
};

// TM 박스 좌표 범위 생성 (기본 ±550m: 500m 반경 외접 사각형 + 여유)
// Gemini Pro 권장: 박스를 ±550m로 좁혀도 안전. 빈 응답 시 ±1km/±2km로 fallback
function getCoordRange(centerX, centerY, distance = 550) {
  return {
    minXAxis: centerX - distance,
    maxXAxis: centerX + distance,
    minYAxis: centerY - distance,
    maxYAxis: centerY + distance
  };
}

// TM 박스 자동 확대 폴백 (550 → 1000 → 2000)
// urlBuilder(range): {minXAxis, maxXAxis, minYAxis, maxYAxis} 받아서 호출 URL 반환
// fetcher(url): URL로 데이터 fetch (Promise<응답>)
// isEmpty(data): 응답이 비어있는지 판정
async function fetchWithBoxExpand(centerX, centerY, urlBuilder, fetcher, isEmpty) {
  const expandSizes = [550, 1000, 2000];
  let lastData = null;
  for (const size of expandSizes) {
    const range = getCoordRange(centerX, centerY, size);
    const url = urlBuilder(range);
    const data = await fetcher(url);
    lastData = data;
    if (!isEmpty(data)) {
      return { data, _bboxSizeM: size };
    }
    console.log(`[bbox-expand] size=${size}m → empty, 확대 재시도`);
  }
  return { data: lastData, _bboxSizeM: 2000, empty: true };
}

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
  const x = Math.round(k0 * N * (A + (1-T+C)*A*A*A/6 + (5-18*T+T*T+72*C-58*e2/(1-e2))*A*A*A*A*A/120) + x0);
  const yVal = Math.round(k0 * (M - M0 + N * Math.tan(latRad) * (A*A/2 + (5-T+9*C+4*C*C)*A*A*A*A/24 + (61-58*T+T*T+600*C-330*e2/(1-e2))*A*A*A*A*A*A/720)) + y0);
  return { x, y: yVal };
}

function fetchJsonSimple(url) {
  return new Promise((resolve, reject) => {
    const req = https.get(url, {
      rejectUnauthorized: false,
      headers: { 'Accept': 'application/json', 'Accept-Encoding': 'gzip, deflate', 'User-Agent': 'Mozilla/5.0' },
      timeout: 15000
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
      stream.on('end', () => { try { resolve(JSON.parse(body)); } catch(e) { resolve(null); } });
      stream.on('error', () => resolve(null));
    });
    req.on('error', () => resolve(null));
    req.on('timeout', () => { req.destroy(); resolve(null); });
  });
}

// POST 방식 JSON fetch (소상공인365 GIS API용)
function fetchJsonPost(url, formData) {
  return new Promise((resolve) => {
    const postBody = typeof formData === 'string' ? formData : new URLSearchParams(formData).toString();
    const urlObj = new URL(url);
    const options = {
      hostname: urlObj.hostname,
      port: 443,
      path: urlObj.pathname + urlObj.search,
      method: 'POST',
      rejectUnauthorized: false,
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
        'Accept': 'application/json, text/javascript, */*; q=0.01',
        'Accept-Encoding': 'gzip, deflate',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'X-Requested-With': 'XMLHttpRequest',
        'Referer': 'https://bigdata.sbiz.or.kr/',
        'Origin': 'https://bigdata.sbiz.or.kr',
        'Content-Length': Buffer.byteLength(postBody)
      },
      timeout: 15000
    };
    const req = https.request(options, (res) => {
      const encoding = (res.headers['content-encoding'] || '').toLowerCase();
      let stream = res;
      if (encoding === 'gzip') { stream = res.pipe(zlib.createGunzip()); }
      else if (encoding === 'deflate') { stream = res.pipe(zlib.createInflate()); }
      let body = '';
      stream.on('data', chunk => body += chunk);
      stream.on('end', () => { try { resolve(JSON.parse(body)); } catch(e) { resolve(null); } });
      stream.on('error', () => resolve(null));
    });
    req.on('error', () => resolve(null));
    req.on('timeout', () => { req.destroy(); resolve(null); });
    req.write(postBody);
    req.end();
  });
}

exports.handler = async (event, context) => {
  const corsHeaders = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Methods': 'GET, POST, OPTIONS', 'Access-Control-Allow-Headers': 'Content-Type', 'Content-Type': 'application/json; charset=utf-8' };
  if (event.httpMethod === 'OPTIONS') return { statusCode: 200, headers: corsHeaders, body: '' };

  const params = event.queryStringParameters || {};
  const { api, endpoint, apiName, ...queryParams } = params;
  if (!api) return { statusCode: 400, headers: corsHeaders, body: JSON.stringify({ error: 'api 파라미터 필요', available: ['sbiz','coord','store','storeRadius','storeInds','gis','open','simpleAnls','detailAnls','weather','seoul','fftc','bizonRnkTop10'] }) };

  const startTime = Date.now();
  try {
    let targetUrl, useHttp = false;

    // 헬퍼: endpoint 경로 정규화 (슬래시 보장 + /search.json suffix 보장)
    const normalizeEndpoint = (ep) => {
      let path = ep.startsWith('/') ? ep : '/' + ep;
      // 이미 .json으로 끝나면 그대로 사용 (GIS API 등)
      if (path.endsWith('.json')) return path;
      if (!path.endsWith('/search.json')) {
        // /search.json 이 아예 없으면 붙이기
        if (path.endsWith('/')) path += 'search.json';
        else path += '/search.json';
      }
      return path;
    };

    // 1. GIS API
    if (api === 'gis' && endpoint) {
      const gisPath = normalizeEndpoint(endpoint);
      if (queryParams.wgs84_lat && queryParams.wgs84_lng) {
        const tm = wgs84ToTM(parseFloat(queryParams.wgs84_lat), parseFloat(queryParams.wgs84_lng));
        // 기본값 변경: 1000 → 550 (500m 반경 외접 사각형 + 여유)
        // 사용자 명시 margin 있으면 우선, 없으면 550으로 시작 후 빈 응답시 폴백
        const userMargin = parseInt(queryParams.margin);
        const buildUrl = (range) => {
          const urlParams = new URLSearchParams({
            minXAxis: range.minXAxis.toString(),
            maxXAxis: range.maxXAxis.toString(),
            minYAxis: range.minYAxis.toString(),
            maxYAxis: range.maxYAxis.toString(),
            mapLevel: queryParams.mapLevel || '14'
          });
          ['chkedList','indsLclsCd','indsLclsNm','indsMclsCd','indsMclsNm'].forEach(k => { if (queryParams[k]) urlParams.append(k, queryParams[k]); });
          return `https://bigdata.sbiz.or.kr${gisPath}?${urlParams.toString()}`;
        };

        // 사용자 명시 margin 있으면 단일 호출 (폴백 없음)
        if (userMargin && isFinite(userMargin) && userMargin > 0) {
          const range = getCoordRange(tm.x, tm.y, userMargin);
          targetUrl = buildUrl(range);
        } else {
          // 자동 폴백: 550 → 1000 → 2000
          const isEmptyResp = (d) => {
            if (!d) return true;
            if (Array.isArray(d) && d.length === 0) return true;
            if (d.list && Array.isArray(d.list) && d.list.length === 0) return true;
            if (d.data && Array.isArray(d.data) && d.data.length === 0) return true;
            return false;
          };
          const result = await fetchWithBoxExpand(tm.x, tm.y, buildUrl, fetchJsonSimple, isEmptyResp);
          console.log(`[gis] ${gisPath} → bbox=${result._bboxSizeM}m, empty=${result.empty || false}`);
          return {
            statusCode: 200,
            headers: corsHeaders,
            body: JSON.stringify({
              success: true,
              status: 200,
              data: result.data,
              _bboxSizeM: result._bboxSizeM,
              elapsedMs: Date.now() - startTime
            })
          };
        }
      } else {
        const urlParams = new URLSearchParams();
        Object.keys(queryParams).forEach(k => { if (queryParams[k]) urlParams.append(k, queryParams[k]); });
        targetUrl = `https://bigdata.sbiz.or.kr${gisPath}?${urlParams.toString()}`;
      }
    }
    // 2. OpenAPI → /openApi/{name} (certKey 필요, storSttus만 /sbiz/api/bizonSttus/ 경로)
    else if (api === 'open') {
      const name = apiName || endpoint;
      if (!name) return { statusCode: 400, headers: corsHeaders, body: JSON.stringify({ error: 'apiName 또는 endpoint 파라미터 필요' }) };

      // deliveryHotplace → 좌표 기반 동적 mjrBzznno 매핑 후 /gis/hpAnls/report.json 호출
      // (Gemini Pro 권장 알고리즘: Point-in-Polygon 1순위 + 200m 거리 임계값 2순위 + 그 외 매핑 실패)
      if (name === 'deliveryHotplace') {
        const { wgs84_lat, wgs84_lng, mjrBzznno: forcedMjr, anlsNo, anlsDt: anlsDtParam, rptpInfoTpcd, bizonTheme } = queryParams;
        const theme = bizonTheme || 'DLVY';

        // 1) mjrBzznno 결정: 강제값 우선 → 좌표로 자동 매핑
        let mjrBzznno = forcedMjr || null;
        let mjrBizonNm = null;
        let nearestDist = null;
        let matchType = forcedMjr ? 'forced' : null; // 'inside' | 'nearest' | 'none' | 'forced'

        if (!mjrBzznno) {
          if (!wgs84_lat || !wgs84_lng) {
            return { statusCode: 400, headers: corsHeaders, body: JSON.stringify({ error: 'deliveryHotplace: wgs84_lat, wgs84_lng 또는 mjrBzznno 필요' }) };
          }
          const tm = wgs84ToTM(parseFloat(wgs84_lat), parseFloat(wgs84_lng));
          // 폴리곤은 TM 좌표(EPSG:5181 변형). 비교 점도 TM 좌표 사용.
          const targetPt = turfPoint([tm.x, tm.y]);

          // 점진적 박스 확대로 후보 영역 수집 (550m 시작 → 폴백)
          // deliveryHotplace는 영역 매핑이 목적이라 1500m 이상에서도 가능하지만, 일관성 위해 550m부터 시작
          const tryMargins = [550, 1500, 5000, 15000];
          let candidates = [];
          for (const margin of tryMargins) {
            const range = getCoordRange(tm.x, tm.y, margin);
            const shapeUrl = `https://bigdata.sbiz.or.kr/gis/api/searchBizonShpeData.json?minXAxis=${range.minXAxis}&maxXAxis=${range.maxXAxis}&minYAxis=${range.minYAxis}&maxYAxis=${range.maxYAxis}&mapLevel=14&bizonTheme=${theme}`;
            const shapeResp = await fetchJsonSimple(shapeUrl);
            const arr = Array.isArray(shapeResp) ? shapeResp : [];
            if (arr.length > 0) {
              candidates = arr;
              console.log(`[deliveryHotplace] margin=${margin}m → ${arr.length}개 영역 후보`);
              break;
            }
          }

          // 1순위: Point-in-Polygon (좌표가 폴리곤 내부에 있는 영역 즉시 매핑)
          let chosen = null;
          for (const zone of candidates) {
            const ring = parsePolygonWKT(zone.geom);
            if (!ring) continue;
            try {
              const poly = turfPolygon(ring);
              if (booleanPointInPolygon(targetPt, poly)) {
                chosen = { mjr: zone.mjrBzznno, nm: zone.mjrBizonNm, dist: 0 };
                matchType = 'inside';
                break;
              }
            } catch (e) {
              // 폴리곤 파싱 실패는 무시하고 계속
            }
          }

          // 2순위: 폴리곤 외부면 500m 이내 가장 가까운 중심점만 매핑 (검색 반경과 동일)
          if (!chosen) {
            let best = null;
            for (const zone of candidates) {
              const cx = parseFloat(zone.centerXCrdnt);
              const cy = parseFloat(zone.centerYCrdnt);
              if (!isFinite(cx) || !isFinite(cy)) continue;
              const dd = Math.sqrt((tm.x - cx) ** 2 + (tm.y - cy) ** 2);
              if (!best || dd < best.dist) {
                best = { mjr: zone.mjrBzznno, nm: zone.mjrBizonNm, dist: dd };
              }
            }
            if (best && best.dist <= 500) {
              chosen = best;
              matchType = 'nearest';
            } else {
              matchType = 'none';
              const nearestM = best ? Math.round(best.dist) : null;
              console.log(`[deliveryHotplace] 매핑 실패: lat=${wgs84_lat}, lng=${wgs84_lng}, 가장가까운영역=${best?.nm || 'none'} (${nearestM}m)`);
              return {
                statusCode: 200,
                headers: corsHeaders,
                body: JSON.stringify({
                  success: true,
                  matched: false,
                  matchType: 'none',
                  data: {},
                  message: '검색 위치가 핫플레이스 분석영역(mjrBzznno) 500m 이내가 아닙니다.',
                  nearestZoneNm: best?.nm || null,
                  nearestZoneMjr: best?.mjr || null,
                  nearestDistM: nearestM,
                  wgs84_lat, wgs84_lng,
                  theme,
                  elapsedMs: Date.now() - startTime
                })
              };
            }
          }

          mjrBzznno = chosen.mjr;
          mjrBizonNm = chosen.nm;
          nearestDist = Math.round(chosen.dist);
          console.log(`[deliveryHotplace] 좌표 매핑(${matchType}): lat=${wgs84_lat}, lng=${wgs84_lng} → mjrBzznno=${mjrBzznno} (${mjrBizonNm}, ${nearestDist}m)`);
        }

        // 2) /gis/hpAnls/report.json 호출
        const today = new Date();
        const dtStr = anlsDtParam || `${today.getFullYear()}${String(today.getMonth()+1).padStart(2,'0')}${String(today.getDate()).padStart(2,'0')}`;
        const reportParams = new URLSearchParams({
          bizonTheme: theme,
          mjrBzznno,
          anlsNo: anlsNo || '106610748',
          anlsDt: dtStr,
          rptpInfoTpcd: rptpInfoTpcd || 'RT5',
          xtLoginId: ''
        });
        const reportUrl = `https://bigdata.sbiz.or.kr/gis/hpAnls/report.json?${reportParams.toString()}`;
        console.log('[deliveryHotplace] report 호출:', reportUrl);
        const reportData = await fetchJsonSimple(reportUrl);

        return {
          statusCode: 200,
          headers: corsHeaders,
          body: JSON.stringify({
            success: true,
            matched: true,
            matchType,
            data: reportData,
            mjrBzznno,
            mjrBizonNm,
            matchedZoneNm: mjrBizonNm,
            matchedZoneMjr: mjrBzznno,
            matchedDistM: nearestDist,
            nearestDistM: nearestDist,
            elapsedMs: Date.now() - startTime
          })
        };
      }

      // delivery → GIS 내부 API로 분기 (Open API /openApi/delivery 경로 404 대응)
      if (name === 'delivery') {
        const { wgs84_lat, wgs84_lng, tpbizNm, crtrYm } = queryParams;
        if (!wgs84_lat || !wgs84_lng) {
          return { statusCode: 400, headers: corsHeaders, body: JSON.stringify({ error: 'delivery API: wgs84_lat, wgs84_lng 필요' }) };
        }
        const tm = wgs84ToTM(parseFloat(wgs84_lat), parseFloat(wgs84_lng));
        // tpbizNm 정확 매칭 필요: '카페'/'커피' 입력시 0건 반환됨. 실제 카테고리명은 '카페·디저트'
        const normalizedTpbizNm = (() => {
          const raw = (tpbizNm || '').trim();
          if (!raw) return '카페·디저트';
          // 카페/커피/디저트 키워드 입력시 정확 매칭으로 보정
          if (/^(카페|커피|디저트|음료)$/i.test(raw)) return '카페·디저트';
          return raw;
        })();
        // 기준월 자동 보정: 소상공인365 배달 데이터는 3개월 지연 → 3개월 전 기본
        const getYmAgo = (monthsAgo) => {
          const d = new Date();
          d.setMonth(d.getMonth() - monthsAgo);
          return `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}`;
        };

        // 단일 호출 함수 (특정 crtrYm으로 호출)
        const fetchDelivery = (ym) => {
          const dlvParams = new URLSearchParams({
            x: tm.x.toString(),
            y: tm.y.toString(),
            tpbizNm: normalizedTpbizNm,
            crtrYm: ym
          });
          const dlvUrl = `https://bigdata.sbiz.or.kr/gis/delivery/getAdmAnlsByCty.json?${dlvParams.toString()}`;
          console.log('[프록시] delivery GIS:', dlvUrl);
          return new Promise((resolve) => {
            const req = https.get(dlvUrl, {
              rejectUnauthorized: false,
              headers: {
                'Accept': 'application/json',
                'User-Agent': 'Mozilla/5.0',
                'X-Requested-With': 'XMLHttpRequest',
                'Referer': 'https://bigdata.sbiz.or.kr/gis/delivery'
              },
              timeout: 15000
            }, (res) => {
              let body = '';
              res.on('data', chunk => body += chunk);
              res.on('end', () => { try { resolve({ status: res.statusCode, data: JSON.parse(body), usedYm: ym }); } catch(e) { resolve({ status: res.statusCode, data: body, usedYm: ym }); } });
            });
            req.on('error', () => resolve({ status: 500, data: null, usedYm: ym }));
            req.on('timeout', () => { req.destroy(); resolve({ status: 504, data: null, usedYm: ym }); });
          });
        };

        // 사용자가 명시적으로 crtrYm 넘기면 그것 우선 (폴백 없이 단일 호출)
        if (crtrYm) {
          const single = await fetchDelivery(crtrYm);
          return { statusCode: 200, headers: corsHeaders, body: JSON.stringify({ success: true, status: single.status, data: single.data, usedCrtrYm: single.usedYm, elapsedMs: Date.now() - startTime }) };
        }

        // 자동 폴백: 3 → 4 → 5 → 6개월 전까지 시도, 첫 nonZero 응답 채택
        const monthsToTry = [3, 4, 5, 6];
        let finalResp = null;
        for (const m of monthsToTry) {
          const ym = getYmAgo(m);
          const resp = await fetchDelivery(ym);
          const arr = Array.isArray(resp?.data) ? resp.data : (resp?.data?.data || resp?.data?.list || []);
          const nonZero = Array.isArray(arr) ? arr.filter(r => r && r.mmavgSlsAmt && r.mmavgSlsAmt !== '0원').length : 0;
          console.log(`[프록시] delivery 폴백 시도: crtrYm=${ym}, rows=${Array.isArray(arr) ? arr.length : 0}, nonZero=${nonZero}`);
          if (nonZero > 0) {
            finalResp = resp;
            break;
          }
          // 마지막 시도 결과는 보관 (전부 0이면 마지막 응답이라도 반환)
          finalResp = resp;
        }

        return { statusCode: 200, headers: corsHeaders, body: JSON.stringify({ success: true, status: finalResp?.status || 200, data: finalResp?.data || null, usedCrtrYm: finalResp?.usedYm || null, elapsedMs: Date.now() - startTime }) };
      }

      // slsIndex → 실제 API 경로는 slsIdex (오타가 아닌 실제 API 스펙)
      const actualName = name === 'slsIndex' ? 'slsIdex' : name;
      const openPath = `/sbiz/api/bizonSttus/${actualName}/search.json`;
      const urlParams = new URLSearchParams();
      // certKey 추가 (SBIZ_OPEN_API_KEYS에서 해당 API 키 조회)
      // 인증 불필요 API(MaxSlsBiz 등)는 매핑에 없어도 certKey 없이 호출 가능 (curl 검증 완료)
      const certKey = SBIZ_OPEN_API_KEYS[name];
      if (certKey) urlParams.append('certKey', certKey);
      const proxyKeys = ['api', 'apiName', 'endpoint', '_debug'];
      Object.keys(queryParams).forEach(k => { if (queryParams[k] && !proxyKeys.includes(k)) urlParams.append(k, queryParams[k]); });
      targetUrl = `https://bigdata.sbiz.or.kr${openPath}?${urlParams.toString()}`;
    }
    // bizonRnkTop10: 시군구 핫플 TOP10 (6테마: MZ/DINT/NWB/DLVY/BLOCN/RE) - 인증 불필요
    else if (api === 'bizonRnkTop10') {
      const { mtpctdCd, sggCd, dongCd: bDongCd } = queryParams;
      if (!mtpctdCd || !sggCd || !bDongCd) {
        return { statusCode: 400, headers: corsHeaders, body: JSON.stringify({ error: 'bizonRnkTop10: mtpctdCd(2), sggCd(4), dongCd(8) 필요' }) };
      }
      const urlParams = new URLSearchParams({ mtpctdCd, sggCd, dongCd: bDongCd });
      targetUrl = `https://bigdata.sbiz.or.kr/gis/hpAnls/getBizonRnkTop10.json?${urlParams.toString()}`;
    }
    // 3. SBIZ
    else if (api === 'sbiz' && endpoint) {
      const sbizPath = endpoint.startsWith('/') ? endpoint : '/' + endpoint;
      const urlParams = new URLSearchParams();
      Object.keys(queryParams).forEach(k => { if (queryParams[k]) urlParams.append(k, queryParams[k]); });
      targetUrl = `https://bigdata.sbiz.or.kr${sbizPath}?${urlParams.toString()}`;
    }
    // simpleAnls: 간단분석 (GIS 경로 - getAvgAmtInfo → getPopularInfo 체인)
    else if (api === 'simpleAnls') {
      const { admiCd, dongCd, upjongCd, simpleLoc, addr } = queryParams;
      const admCode = admiCd || dongCd;
      if (!admCode) return { statusCode: 400, headers: corsHeaders, body: JSON.stringify({ error: 'admiCd(행정동코드) 필요' }) };
      const loc = simpleLoc || addr || '';
      if (!loc) return { statusCode: 400, headers: corsHeaders, body: JSON.stringify({ error: 'simpleLoc 또는 addr(주소) 필요' }) };

      const certKey = SBIZ_OPEN_API_KEYS.simple;
      const ujCd = upjongCd || 'I21201';

      try {
        // Step 1: getAvgAmtInfo → analyNo 획득 (POST 방식)
        const step1FormData = {
          admiCd: admCode, upjongCd: ujCd, simpleLoc: loc,
          bizonNumber: '', bizonName: '', bzznType: '',
          xtLoginId: certKey
        };
        // POST 시도 → 실패 시 GET fallback
        let avgAmtData = await fetchJsonPost('https://bigdata.sbiz.or.kr/gis/simpleAnls/getAvgAmtInfo.json', step1FormData);
        if (!avgAmtData) {
          const step1Params = new URLSearchParams(step1FormData);
          avgAmtData = await fetchJsonSimple(`https://bigdata.sbiz.or.kr/gis/simpleAnls/getAvgAmtInfo.json?${step1Params.toString()}`);
        }

        const analyNo = avgAmtData?.analyNo || avgAmtData?.body?.analyNo || avgAmtData?.result?.analyNo;
        const mililis = avgAmtData?.mililis || avgAmtData?.body?.mililis || avgAmtData?.result?.mililis || '';
        if (!analyNo) {
          return { statusCode: 200, headers: corsHeaders, body: JSON.stringify({
            success: true,
            avgAmt: avgAmtData,
            population: null,
            note: 'analyNo 없음 - getPopularInfo 생략'
          }) };
        }

        // Step 2: getPopularInfo → 시간대별/요일별 유동인구 (POST 방식)
        const step2FormData = {
          analyNo, admiCd: admCode, upjongCd: ujCd, mililis,
          bizonNumber: '', bizonName: '', bzznType: '',
          xtLoginId: certKey
        };
        let popData = await fetchJsonPost('https://bigdata.sbiz.or.kr/gis/simpleAnls/getPopularInfo.json', step2FormData);
        if (!popData) {
          const step2Params = new URLSearchParams(step2FormData);
          popData = await fetchJsonSimple(`https://bigdata.sbiz.or.kr/gis/simpleAnls/getPopularInfo.json?${step2Params.toString()}`);
        }

        return { statusCode: 200, headers: corsHeaders, body: JSON.stringify({
          success: true,
          avgAmt: avgAmtData,
          population: popData?.population || popData
        }) };
      } catch(e) {
        return { statusCode: 200, headers: corsHeaders, body: JSON.stringify({ success: false, error: e.message }) };
      }
    }
    // detailAnls: 상세분석 (GIS 경로 - getAvgAmtInfo → getPopularInfo 체인)
    else if (api === 'detailAnls') {
      const { admiCd, dongCd, upjongCd, simpleLoc, addr } = queryParams;
      const admCode = admiCd || dongCd;
      if (!admCode) return { statusCode: 400, headers: corsHeaders, body: JSON.stringify({ error: 'admiCd(행정동코드) 필요' }) };
      const loc = simpleLoc || addr || '';
      if (!loc) return { statusCode: 400, headers: corsHeaders, body: JSON.stringify({ error: 'simpleLoc 또는 addr(주소) 필요' }) };

      const certKey = SBIZ_OPEN_API_KEYS.detail;
      const ujCd = upjongCd || 'I21201';

      try {
        // Step 1: getAvgAmtInfo → analyNo 획득 (POST 방식)
        const step1FormData = {
          admiCd: admCode, upjongCd: ujCd, simpleLoc: loc,
          bizonNumber: '', bizonName: '', bzznType: '',
          xtLoginId: certKey
        };
        const avgAmtData = await fetchJsonPost('https://bigdata.sbiz.or.kr/gis/simpleAnls/getAvgAmtInfo.json', step1FormData);

        const analyNo = avgAmtData?.analyNo || avgAmtData?.body?.analyNo || avgAmtData?.result?.analyNo;
        const mililis = avgAmtData?.mililis || avgAmtData?.body?.mililis || avgAmtData?.result?.mililis || '';
        if (!analyNo) {
          return { statusCode: 200, headers: corsHeaders, body: JSON.stringify({
            success: true,
            avgAmt: avgAmtData,
            population: null,
            note: 'analyNo 없음 - getPopularInfo 생략'
          }) };
        }

        // Step 2: getPopularInfo → 시간대별/요일별 유동인구 (POST 방식)
        const step2FormData = {
          analyNo, admiCd: admCode, upjongCd: ujCd, mililis,
          bizonNumber: '', bizonName: '', bzznType: '',
          xtLoginId: certKey
        };
        const popData = await fetchJsonPost('https://bigdata.sbiz.or.kr/gis/simpleAnls/getPopularInfo.json', step2FormData);

        return { statusCode: 200, headers: corsHeaders, body: JSON.stringify({
          success: true,
          avgAmt: avgAmtData,
          population: popData?.population || popData
        }) };
      } catch(e) {
        return { statusCode: 200, headers: corsHeaders, body: JSON.stringify({ success: false, error: e.message }) };
      }
    }
    // weather: 창업기상도
    else if (api === 'weather') {
      const { areaCd, tpbizClscd } = queryParams;
      const ujCd = tpbizClscd || 'I21201';

      try {
        // recent: 최근 6개월 기준년월 목록
        const recentUrl = `https://bigdata.sbiz.or.kr/cstmz/api/indicator/overall/recent?type=NW&tpbizClscd=${ujCd}&count=6`;
        const recentData = await fetchJsonSimple(recentUrl);

        // area: 시도별 종합/경쟁력/생존/전망/관심도 점수
        const crtrYm = recentData?.data?.[recentData.data.length - 1]?.crtrYm || '202601';
        const areaUrl = `https://bigdata.sbiz.or.kr/cstmz/api/indicator/overall/area?type=NW&crtrYm=${crtrYm}&tpbizClscd=${ujCd}`;
        const areaData = await fetchJsonSimple(areaUrl);

        // 시도코드 → 시도명 매핑 (소상공인365 기준)
        const SIDO_NM_MAP = {
          '11': '서울', '26': '부산', '27': '대구', '28': '인천', '29': '광주',
          '30': '대전', '31': '울산', '36': '세종', '41': '경기', '42': '강원',
          '43': '충북', '44': '충남', '45': '전북', '46': '전남', '47': '경북',
          '48': '경남', '50': '제주'
        };
        const rawData = areaData?.data || {};
        const scoresArray = Object.entries(rawData).map(([code, v]) => ({
          areaCd: code,
          areaNm: SIDO_NM_MAP[code] || code,
          overall: v.overall || {},
          competitiveness: v.competitiveness || {},
          survival: v.survival || {},
          prospect: v.prospect || {},
          interest: v.interest || {}
        }));
        return { statusCode: 200, headers: corsHeaders, body: JSON.stringify({
          success: true,
          crtrYm,
          scores: scoresArray
        }) };
      } catch(e) {
        return { statusCode: 200, headers: corsHeaders, body: JSON.stringify({ success: false, error: e.message }) };
      }
    }
    // startupPublic: 상권지도 (rnkType: overall, comp, survival, prospect, engagement)
    else if (api === 'startupPublic') {
      const { minXAxis, maxXAxis, minYAxis, maxYAxis, rnkType, tpbizCode, crtrYm, wgs84_lat, wgs84_lng } = queryParams;
      const rType = rnkType || 'overall';
      const tCode = tpbizCode || 'I21201';
      const ym = crtrYm || '202601';

      try {
        // 좌표 기반 호출 지원: wgs84_lat/lng 들어오면 ±550m 박스로 변환 + 빈 응답시 폴백
        if (wgs84_lat && wgs84_lng && !minXAxis) {
          const tm = wgs84ToTM(parseFloat(wgs84_lat), parseFloat(wgs84_lng));
          const buildUrl = (range) => `https://bigdata.sbiz.or.kr/gis/startUp/publicData/adv?crtrYm=${ym}&minXAxis=${range.minXAxis}&maxXAxis=${range.maxXAxis}&minYAxis=${range.minYAxis}&maxYAxis=${range.maxYAxis}&rnkType=${rType}&tpbizCode=${tCode}`;
          const isEmptyResp = (d) => !d || (Array.isArray(d) && d.length === 0);
          const result = await fetchWithBoxExpand(tm.x, tm.y, buildUrl, fetchJsonSimple, isEmptyResp);
          return { statusCode: 200, headers: corsHeaders, body: JSON.stringify({ success: true, count: Array.isArray(result.data) ? result.data.length : 0, data: result.data, _bboxSizeM: result._bboxSizeM }) };
        }
        // 명시적 박스 좌표 또는 기본 박스(서울 중심 6km)
        const url = `https://bigdata.sbiz.or.kr/gis/startUp/publicData/adv?crtrYm=${ym}&minXAxis=${minXAxis || 200000}&maxXAxis=${maxXAxis || 206000}&minYAxis=${minYAxis || 441000}&maxYAxis=${maxYAxis || 447000}&rnkType=${rType}&tpbizCode=${tCode}`;
        const data = await fetchJsonSimple(url);
        return { statusCode: 200, headers: corsHeaders, body: JSON.stringify({ success: true, count: Array.isArray(data) ? data.length : 0, data }) };
      } catch(e) {
        return { statusCode: 200, headers: corsHeaders, body: JSON.stringify({ success: false, error: e.message }) };
      }
    }
    // 4. coord (반경 자동 확대: 1000 → 2000 → 3000)
    else if (api === 'coord') {
      const { lat, lng } = queryParams;
      if (!lat || !lng) return { statusCode: 400, headers: corsHeaders, body: JSON.stringify({ error: 'lat, lng 필요' }) };
      const tm = wgs84ToTM(parseFloat(lat), parseFloat(lng));
      // 박스 시작값 변경: 1000 → 550 (500m 반경 외접 사각형 + 여유), 빈 응답시 1000/2000/3000으로 확대
      const margins = [550, 1000, 2000, 3000];
      let coordResult = null;
      let usedMargin = null;
      for (const margin of margins) {
        const range = getCoordRange(tm.x, tm.y, margin);
        const coordUrl = `https://bigdata.sbiz.or.kr/gis/api/getCoordToAdmPoint.json?minXAxis=${range.minXAxis}&maxXAxis=${range.maxXAxis}&minYAxis=${range.minYAxis}&maxYAxis=${range.maxYAxis}&mapLevel=14`;
        const coordData = await new Promise((resolve, reject) => {
          const req = https.get(coordUrl, { rejectUnauthorized: false, headers: { 'Accept': 'application/json', 'User-Agent': 'Mozilla/5.0', 'Referer': 'https://bigdata.sbiz.or.kr/' }, timeout: 15000 }, (res) => {
            let body = '';
            res.on('data', chunk => body += chunk);
            res.on('end', () => { try { resolve(JSON.parse(body)); } catch(e) { resolve([]); } });
          });
          req.on('error', () => resolve([]));
          req.on('timeout', () => { req.destroy(); resolve([]); });
        });
        if (Array.isArray(coordData) && coordData.length > 0) {
          coordResult = coordData;
          usedMargin = margin;
          console.log(`[coord] margin=${margin}m → ${coordData.length}개 행정동 찾음`);
          break;
        }
      }
      return {
        statusCode: 200,
        headers: corsHeaders,
        body: JSON.stringify({ success: true, status: 200, data: coordResult || [], _bboxSizeM: usedMargin, elapsedMs: Date.now() - startTime })
      };
    }
    // 5. store (공공데이터포털)
    else if (api === 'store') {
      useHttp = true;
      const { divId, key, indsLclsCd, indsMclsCd, indsSclsCd, numOfRows, pageNo } = queryParams;
      const urlParams = new URLSearchParams({ serviceKey: DATA_GO_KR_API_KEY, divId: divId||'adongCd', key: key||'1168010100', numOfRows: numOfRows||'100', pageNo: pageNo||'1', type: 'json' });
      if (indsLclsCd) urlParams.append('indsLclsCd', indsLclsCd);
      if (indsMclsCd) urlParams.append('indsMclsCd', indsMclsCd);
      if (indsSclsCd) urlParams.append('indsSclsCd', indsSclsCd);
      targetUrl = `http://apis.data.go.kr/B553077/api/open/sdsc/storeListInDong?${urlParams.toString()}`;
    }
    else if (api === 'storeRadius') {
      useHttp = true;
      const { cx, cy, radius, indsLclsCd, indsMclsCd, indsSclsCd, numOfRows, pageNo } = queryParams;
      if (!cx || !cy) return { statusCode: 400, headers: corsHeaders, body: JSON.stringify({ error: 'cx(경도), cy(위도) 필요' }) };
      const urlParams = new URLSearchParams({ serviceKey: DATA_GO_KR_API_KEY, cx, cy, radius: radius||'500', numOfRows: numOfRows||'100', pageNo: pageNo||'1', type: 'json' });
      if (indsLclsCd) urlParams.append('indsLclsCd', indsLclsCd);
      if (indsMclsCd) urlParams.append('indsMclsCd', indsMclsCd);
      if (indsSclsCd) urlParams.append('indsSclsCd', indsSclsCd);
      targetUrl = `http://apis.data.go.kr/B553077/api/open/sdsc/storeListInRadius?${urlParams.toString()}`;
    }
    else if (api === 'storeInds') {
      useHttp = true;
      const { divId, key, indsLclsCd, indsMclsCd, indsSclsCd, numOfRows, pageNo } = queryParams;
      const urlParams = new URLSearchParams({ serviceKey: DATA_GO_KR_API_KEY, divId: divId||'adongCd', key: key||'1168010100', numOfRows: numOfRows||'100', pageNo: pageNo||'1', type: 'json' });
      if (indsLclsCd) urlParams.append('indsLclsCd', indsLclsCd);
      if (indsMclsCd) urlParams.append('indsMclsCd', indsMclsCd);
      if (indsSclsCd) urlParams.append('indsSclsCd', indsSclsCd);
      targetUrl = `http://apis.data.go.kr/B553077/api/open/sdsc/storeListByIndsMclasCd?${urlParams.toString()}`;
    }
    // 6. 서울시 열린데이터 (추정매출, 유동인구 등)
    else if (api === 'seoul') {
      const seoulApiKey = '6d6c71717173656f3432436863774a';
      const { service, startIndex, endIndex, stdrYyquCd, industryCode, filterField, filterValue, maxBatch, ADSTRD_CD } = queryParams;
      const svc = endpoint || service || 'VwsmTrdarSelngQq';
      // 기본 분기코드: 파라미터 없으면 최신 분기(2024년 4분기)
      const defaultQuarter = '20244';
      const quarterCode = stdrYyquCd || defaultQuarter;

      // VwsmAdstrdSelngW 전용: 5번째 path = 분기코드만 인식, 행정동코드는 path 불가 → 응답에서 필터
      // ADSTRD_CD 코드로 행정동 매출 필터링 (분기코드를 path에, ADSTRD_CD는 응답 필터)
      if (ADSTRD_CD) {
        const allRows = [];
        const adstrdCodes = ADSTRD_CD.split(',').map(c => c.trim()).filter(Boolean);
        const adstrdSet = new Set(adstrdCodes);

        // industryCode 및 ADSTRD_CD 필터 함수
        const matchRow = (row) => {
          if (!adstrdSet.has(row.ADSTRD_CD)) return false;
          if (industryCode && row.SVC_INDUTY_CD !== industryCode) return false;
          return true;
        };

        // 분기코드를 path 5번째에 넣어 17,044건으로 축소 후, 순차 배치로 ADSTRD_CD 필터
        const MAX_BATCHES = 5; // 최대 5배치(5,000건)까지만 → 조기 중단
        const PARALLEL_SIZE = 3;
        let totalCount = 0;
        let foundTarget = false;

        const fetchBatch = (si, ei) => new Promise((resolve) => {
          const batchUrl = `http://openapi.seoul.go.kr:8088/${seoulApiKey}/json/${svc}/${si}/${ei}/${quarterCode}`;
          const req = http.get(batchUrl, { timeout: 12000 }, (res) => {
            let body = '';
            res.on('data', chunk => body += chunk);
            res.on('end', () => { try { resolve(JSON.parse(body)); } catch(e) { resolve(null); } });
          });
          req.on('error', () => resolve(null));
          req.on('timeout', () => { req.destroy(); resolve(null); });
        });

        // 첫 배치: 전체 건수 확인 + 필터링
        const firstBatch = await fetchBatch(1, 1000);
        totalCount = firstBatch?.[svc]?.list_total_count || 0;
        const firstRows = firstBatch?.[svc]?.row || [];
        console.log(`[seoul-ADSTRD] ${svc} quarter=${quarterCode}: total=${totalCount}, first batch=${firstRows.length}건`);

        if (firstRows.length > 0) {
          const matched = firstRows.filter(matchRow);
          allRows.push(...matched);
          if (matched.length > 0) foundTarget = true;
        }

        // 나머지 배치: 최대 MAX_BATCHES까지, 조기 중단 로직 포함
        const totalBatches = Math.min(Math.ceil(totalCount / 1000), MAX_BATCHES + 1);
        for (let groupStart = 1001; groupStart <= totalBatches * 1000; groupStart += PARALLEL_SIZE * 1000) {
          // 이미 타겟 동 데이터를 찾았고 이번 배치에서 안 나오면 중단
          if (foundTarget && allRows.length > 0) {
            // 동 데이터는 보통 연속 배치에 몰려있으므로, 한번 찾은 후 다음 배치에서 0건이면 중단
            // → 아래에서 체크
          }

          const batchPromises = [];
          for (let i = 0; i < PARALLEL_SIZE; i++) {
            const si = groupStart + i * 1000;
            if (si > totalBatches * 1000) break;
            batchPromises.push(fetchBatch(si, si + 999));
          }

          const results = await Promise.all(batchPromises);
          let batchMatchCount = 0;
          for (const batch of results) {
            const rows = batch?.[svc]?.row || [];
            if (rows.length === 0) continue;
            const matched = rows.filter(matchRow);
            batchMatchCount += matched.length;
            allRows.push(...matched);
          }

          if (batchMatchCount > 0) foundTarget = true;
          // 조기 중단: 이미 타겟을 찾았는데 이번 그룹에서 0건 → 더 이상 없음
          if (foundTarget && batchMatchCount === 0) {
            console.log(`[seoul-ADSTRD] 조기 중단: 타겟 동 데이터 종료. ${allRows.length}건 수집`);
            break;
          }
        }

        console.log(`[seoul-ADSTRD] ${svc}: codes=${adstrdCodes.join(',')}, quarter=${quarterCode}, industryCode=${industryCode || 'none'}, filtered=${allRows.length}건`);

        return {
          statusCode: 200,
          headers: corsHeaders,
          body: JSON.stringify({
            success: true,
            data: { filteredRows: allRows, totalFiltered: allRows.length, ADSTRD_CD: adstrdCodes, quarter: quarterCode, partial: false },
            elapsedMs: Date.now() - startTime
          })
        };
      }

      // industryCode 또는 filterField가 있으면 전체 데이터를 서버에서 수집 후 필터링
      if (industryCode || filterField) {
        const allRows = [];
        const batchLimit = Math.min(parseInt(maxBatch) || 22, 150);
        const TIME_LIMIT_MS = 22000; // Netlify 26초 타임아웃 전에 반환 (4초 여유)
        const PARALLEL_SIZE = 5; // 동시 요청 수
        const quarter = `/${quarterCode}`;

        const fetchBatch = (si, ei) => new Promise((resolve) => {
          const batchUrl = `http://openapi.seoul.go.kr:8088/${seoulApiKey}/json/${svc}/${si}/${ei}${quarter}`;
          const req = http.get(batchUrl, { timeout: 10000 }, (res) => {
            let body = '';
            res.on('data', chunk => body += chunk);
            res.on('end', () => { try { resolve(JSON.parse(body)); } catch(e) { resolve(null); } });
          });
          req.on('error', () => resolve(null));
          req.on('timeout', () => { req.destroy(); resolve(null); });
        });

        const filterRow = (row) => {
          if (industryCode) return row.SVC_INDUTY_CD === industryCode;
          if (filterField && filterValue) return (row[filterField] || '').includes(filterValue);
          return true;
        };

        // 먼저 첫 배치로 전체 건수 확인
        const firstBatch = await fetchBatch(1, 1000);
        const totalCount = firstBatch?.[svc]?.list_total_count || 0;
        const firstRows = firstBatch?.[svc]?.row || [];
        if (firstRows.length > 0) {
          allRows.push(...firstRows.filter(filterRow));
        }

        // 실제 필요한 배치 수 계산 (전체 건수 기반, batchLimit 제한)
        const totalBatches = Math.min(Math.ceil(totalCount / 1000), batchLimit);
        console.log(`[seoul-filter] ${svc}: total=${totalCount}, quarter=${quarterCode}, batches=${totalBatches}, parallel=${PARALLEL_SIZE}`);

        // 나머지 배치를 병렬 그룹으로 수집 (시간 제한 적용)
        let timedOut = false;
        for (let groupStart = 1001; groupStart <= totalBatches * 1000; groupStart += PARALLEL_SIZE * 1000) {
          if (Date.now() - startTime > TIME_LIMIT_MS) {
            timedOut = true;
            console.log(`[seoul-filter] 시간 제한 도달 (${Date.now() - startTime}ms), 수집 중단. 현재 ${allRows.length}건`);
            break;
          }

          // 병렬 배치 생성
          const batchPromises = [];
          for (let i = 0; i < PARALLEL_SIZE; i++) {
            const si = groupStart + i * 1000;
            if (si > totalBatches * 1000) break;
            batchPromises.push(fetchBatch(si, si + 999));
          }

          const results = await Promise.all(batchPromises);
          let emptyCount = 0;
          for (const batch of results) {
            const rows = batch?.[svc]?.row || [];
            if (rows.length === 0) { emptyCount++; continue; }
            allRows.push(...rows.filter(filterRow));
          }
          // 모든 배치가 비어있으면 더 이상 데이터 없음
          if (emptyCount === results.length) break;
        }

        return {
          statusCode: 200,
          headers: corsHeaders,
          body: JSON.stringify({
            success: true,
            data: { filteredRows: allRows, totalFiltered: allRows.length, industryCode, filterField, filterValue, quarter: quarterCode, partial: timedOut },
            elapsedMs: Date.now() - startTime
          })
        };
      }

      // 일반 호출 (adstrdCd/svcIndutyCd 필터 지원)
      useHttp = true;
      const si = startIndex || '1';
      const ei = endIndex || '1000';
      const { adstrdCd, svcIndutyCd } = queryParams;
      // 서울 열린데이터 형식: /{key}/json/{service}/{start}/{end}/{분기코드}
      // 분기코드는 항상 path에 포함 (기본값 20244)
      targetUrl = `http://openapi.seoul.go.kr:8088/${seoulApiKey}/json/${svc}/${si}/${ei}/${quarterCode}`;

      // adstrdCd 또는 svcIndutyCd 필터가 있으면 다중 배치로 수집 후 필터링
      // (데이터가 1001번째 이후 배치에 있을 수 있으므로 최대 5배치까지 탐색)
      if (adstrdCd || svcIndutyCd) {
        const allFiltered = [];
        const MAX_BATCHES = 5; // 최대 5배치(5,000건)
        const PARALLEL_SIZE = 3; // 3배치씩 병렬 호출

        const fetchBatchLocal = (batchSi, batchEi) => new Promise((resolve) => {
          const batchUrl = `http://openapi.seoul.go.kr:8088/${seoulApiKey}/json/${svc}/${batchSi}/${batchEi}/${quarterCode}`;
          const req = http.get(batchUrl, { timeout: 12000 }, (res) => {
            let body = '';
            res.on('data', chunk => body += chunk);
            res.on('end', () => { try { resolve(JSON.parse(body)); } catch(e) { resolve(null); } });
          });
          req.on('error', () => resolve(null));
          req.on('timeout', () => { req.destroy(); resolve(null); });
        });

        const matchRowLocal = (row) => {
          if (adstrdCd && row.ADSTRD_CD !== adstrdCd) return false;
          if (svcIndutyCd && row.SVC_INDUTY_CD !== svcIndutyCd) return false;
          return true;
        };

        // 첫 배치: 전체 건수 확인 + 필터링
        const firstBatchData = await fetchBatchLocal(1, 1000);
        const totalCountLocal = firstBatchData?.[svc]?.list_total_count || 0;
        const firstRowsLocal = firstBatchData?.[svc]?.row || [];
        let foundTargetLocal = false;

        console.log(`[seoul-multibatch] ${svc} quarter=${quarterCode}: total=${totalCountLocal}, adstrdCd=${adstrdCd}, svcIndutyCd=${svcIndutyCd}`);

        if (firstRowsLocal.length > 0) {
          const matched = firstRowsLocal.filter(matchRowLocal);
          allFiltered.push(...matched);
          if (matched.length > 0) foundTargetLocal = true;
        }

        // 나머지 배치: 3배치씩 병렬, 조기 중단 포함
        const totalBatchesLocal = Math.min(Math.ceil(totalCountLocal / 1000), MAX_BATCHES + 1);
        for (let groupStart = 1001; groupStart <= totalBatchesLocal * 1000; groupStart += PARALLEL_SIZE * 1000) {
          const batchPromises = [];
          for (let i = 0; i < PARALLEL_SIZE; i++) {
            const batchSi = groupStart + i * 1000;
            if (batchSi > totalBatchesLocal * 1000) break;
            batchPromises.push(fetchBatchLocal(batchSi, batchSi + 999));
          }

          const results = await Promise.all(batchPromises);
          let batchMatchCount = 0;
          for (const batch of results) {
            const rows = batch?.[svc]?.row || [];
            if (rows.length === 0) continue;
            const matched = rows.filter(matchRowLocal);
            batchMatchCount += matched.length;
            allFiltered.push(...matched);
          }

          if (batchMatchCount > 0) foundTargetLocal = true;
          // 조기 중단: 타겟을 찾았는데 이번 그룹에서 0건 → 이후 배치에 없음
          if (foundTargetLocal && batchMatchCount === 0) {
            console.log(`[seoul-multibatch] 조기 중단: 타겟 데이터 종료. ${allFiltered.length}건 수집`);
            break;
          }
        }

        const totalSales = allFiltered.reduce((sum, r) => {
          const val = parseFloat(r.THSMON_SELNG_AMT || r.MDWK_SELNG_AMT || r.MON_SELNG_AMT || 0);
          return sum + val;
        }, 0);

        console.log(`[seoul-multibatch] ${svc}: quarter=${quarterCode}, adstrdCd=${adstrdCd}, svcIndutyCd=${svcIndutyCd}, filtered=${allFiltered.length}, totalSales=${totalSales}`);

        return {
          statusCode: 200,
          headers: corsHeaders,
          body: JSON.stringify({
            success: true,
            data: { rows: allFiltered, totalSales, count: allFiltered.length, quarter: quarterCode },
            elapsedMs: Date.now() - startTime
          })
        };
      }
    }
    // 7. 공정위 지역별 업종별 매출 API (fftc)
    else if (api === 'fftc') {
      useHttp = true;
      const { operation, areaCd, indutyLclsCd, indutySclsCd, pageNo, numOfRows } = queryParams;
      if (!operation) return { statusCode: 400, headers: corsHeaders, body: JSON.stringify({ error: 'operation 파라미터 필요 (예: getAreaIndutyAvrOutStats)' }) };
      const urlParams = new URLSearchParams({
        serviceKey: DATA_GO_KR_API_KEY,
        pageNo: pageNo || '1',
        numOfRows: numOfRows || '100',
        type: 'json'
      });
      if (areaCd) urlParams.append('areaCd', areaCd);
      if (indutyLclsCd) urlParams.append('indutyLclsCd', indutyLclsCd);
      if (indutySclsCd) urlParams.append('indutySclsCd', indutySclsCd);
      targetUrl = `http://apis.data.go.kr/1130000/FftcAreaIndutyAvrStatsService/${operation}?${urlParams.toString()}`;
      console.log('[fftc]', operation, 'areaCd=' + areaCd, 'indutyLclsCd=' + indutyLclsCd, 'indutySclsCd=' + indutySclsCd);

      // fftc 전용 타임아웃 (10초)
      const fftcData = await new Promise((resolve, reject) => {
        const req = http.get(targetUrl, { timeout: 10000 }, (res) => {
          let body = '';
          res.on('data', chunk => body += chunk);
          res.on('end', () => { try { resolve({ status: res.statusCode, data: JSON.parse(body) }); } catch(e) { resolve({ status: res.statusCode, data: body }); } });
        });
        req.on('error', () => resolve({ status: 500, data: { items: [] } }));
        req.on('timeout', () => { req.destroy(); resolve({ status: 504, data: { items: [] } }); });
      });

      return {
        statusCode: 200,
        headers: corsHeaders,
        body: JSON.stringify({ success: fftcData.status === 200, status: fftcData.status, data: fftcData.data, elapsedMs: Date.now() - startTime })
      };
    }
    else {
      return { statusCode: 400, headers: corsHeaders, body: JSON.stringify({ error: '지원하지 않는 api 타입', available: ['sbiz','coord','simpleAnls','detailAnls','weather','store','storeRadius','storeInds','gis','open','seoul','fftc','bizonRnkTop10'] }) };
    }

    console.log('[프록시]', api, targetUrl?.substring(0, 200));

    const data = await new Promise((resolve, reject) => {
      const protocol = useHttp ? http : https;
      const req = protocol.get(targetUrl, { rejectUnauthorized: false, headers: { 'Accept': 'application/json', 'User-Agent': 'Mozilla/5.0', 'Referer': 'https://bigdata.sbiz.or.kr/' }, timeout: 30000 }, (res) => {
        let body = '';
        res.on('data', chunk => body += chunk);
        res.on('end', () => { try { resolve({ status: res.statusCode, data: JSON.parse(body) }); } catch(e) { resolve({ status: res.statusCode, data: body }); } });
      });
      req.on('error', reject);
      req.on('timeout', () => { req.destroy(); reject(new Error('timeout')); });
    });

    return { statusCode: 200, headers: corsHeaders, body: JSON.stringify({ success: true, status: data.status, data: data.data, elapsedMs: Date.now() - startTime }) };
  } catch (error) {
    console.error('[프록시 에러]', error.message);
    return { statusCode: 500, headers: corsHeaders, body: JSON.stringify({ success: false, error: error.message }) };
  }
};
