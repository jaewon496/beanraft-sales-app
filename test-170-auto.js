#!/usr/bin/env node
// test-170-auto.js
// test-170-regions.json의 170개 항목을 순서대로 테스트
// 카카오 지오코딩 → cafe-collect-proxy 호출 → 결과 기록
// Node 18+ (global fetch 사용)

'use strict';

const fs = require('fs');
const path = require('path');

// ── 설정 ──
const KAKAO_REST_KEY = '9e149576620513dc3283894501c49ab7';
const CAFE_COLLECT_URL = 'https://beancraft-sales.netlify.app/.netlify/functions/cafe-collect-proxy';
const KAKAO_KEYWORD_URL = 'https://dapi.kakao.com/v2/local/search/keyword.json';
const KAKAO_ADDRESS_URL = 'https://dapi.kakao.com/v2/local/search/address.json';
const CONCURRENCY = 3;       // 동시 호출 수
const DELAY_MS = 1000;       // 각 항목 사이 딜레이 (ms)
const GEOCODE_TIMEOUT = 10000;
const COLLECT_TIMEOUT = 60000; // cafe-collect-proxy는 최대 60초

const REGIONS_FILE = path.join(__dirname, 'test-170-regions.json');
const RESULTS_FILE = path.join(__dirname, 'test-170-results.json');

// ── 시도명 약칭 → 풀네임 변환 (앱과 동일) ──
const SIDO_FULLNAME = {
  '부산': '부산광역시', '대구': '대구광역시', '인천': '인천광역시',
  '광주': '광주광역시', '대전': '대전광역시', '울산': '울산광역시',
  '세종': '세종특별자치시', '경기': '경기도', '강원': '강원특별자치도',
  '충북': '충청북도', '충남': '충청남도', '전북': '전북특별자치도',
  '전남': '전라남도', '경북': '경상북도', '경남': '경상남도',
  '제주': '제주특별자치도'
};

function normalizeQuery(query) {
  let q = query;
  for (const [abbr, full] of Object.entries(SIDO_FULLNAME)) {
    if (q.startsWith(abbr + ' ') || q.startsWith(abbr + '시 ')) {
      q = q.replace(new RegExp(`^${abbr}(시)?\\s`), `${full} `);
      break;
    }
  }
  if (q.startsWith('서울시 ') || q.startsWith('서울 ')) {
    q = q.replace(/^서울(시)?\s/, '서울특별시 ');
  }
  return q;
}

// ── HTTP GET with timeout ──
async function httpGetJson(url, headers = {}, timeoutMs = GEOCODE_TIMEOUT) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      headers: { Accept: 'application/json', 'User-Agent': 'Mozilla/5.0', ...headers },
      signal: controller.signal
    });
    clearTimeout(timer);
    if (!res.ok) return null;
    return await res.json();
  } catch (e) {
    clearTimeout(timer);
    return null;
  }
}

// ── 카카오 키워드 검색 ──
async function kakaoKeyword(query) {
  const url = `${KAKAO_KEYWORD_URL}?query=${encodeURIComponent(query)}&size=1`;
  const data = await httpGetJson(url, { Authorization: `KakaoAK ${KAKAO_REST_KEY}` });
  const doc = data?.documents?.[0];
  if (!doc) return null;
  return {
    lat: parseFloat(doc.y),
    lng: parseFloat(doc.x),
    label: doc.place_name || query,
    source: 'keyword'
  };
}

// ── 카카오 주소 검색 ──
async function kakaoAddress(query) {
  const url = `${KAKAO_ADDRESS_URL}?query=${encodeURIComponent(query)}`;
  const data = await httpGetJson(url, { Authorization: `KakaoAK ${KAKAO_REST_KEY}` });
  const doc = data?.documents?.[0];
  if (!doc) return null;
  return {
    lat: parseFloat(doc.y),
    lng: parseFloat(doc.x),
    label: doc.address_name || query,
    source: 'address'
  };
}

// ── 지오코딩: 주소/키워드 → 좌표 (앱과 동일: 주소 우선, 키워드 폴백) ──
async function geocode(query) {
  const normalized = normalizeQuery(query);
  const queries = [...new Set([normalized, query])];

  // 주소 검색 + 키워드 검색 동시
  let addrResult = null;
  let kwResult = null;

  for (const q of queries) {
    if (addrResult) break;
    addrResult = await kakaoAddress(q);
  }
  for (const q of queries) {
    if (kwResult) break;
    kwResult = await kakaoKeyword(q);
  }

  // 주소 검색 우선 (앱과 동일 로직)
  if (addrResult) return addrResult;
  if (kwResult) return kwResult;

  // 폴백: 역/건물명이면 "+ 카페" 없이 재시도 (이미 위에서 했으므로 생략)
  return null;
}

// ── cafe-collect-proxy 호출 ──
async function collectCafes(lat, lng, sido = '', query = '') {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), COLLECT_TIMEOUT);
  try {
    const res = await fetch(CAFE_COLLECT_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ lat, lng, radius: 550, guName: '', sido, query }),
      signal: controller.signal
    });
    clearTimeout(timer);
    if (!res.ok) {
      return { error: `HTTP ${res.status}`, cafes: [], stats: {} };
    }
    const data = await res.json();
    const cafes = data.cafes || data.data || [];
    const franchise = cafes.filter(c => c.isFranchise);
    const independent = cafes.filter(c => !c.isFranchise);
    return {
      total: cafes.length,
      franchise: franchise.length,
      independent: independent.length,
      stats: data.stats || {},
      error: null
    };
  } catch (e) {
    clearTimeout(timer);
    return { error: e.message, cafes: [], total: 0, franchise: 0, independent: 0, stats: {} };
  }
}

// ── sleep ──
function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// ── 170개 항목 평탄화 ──
function flattenRegions(json) {
  const items = [];
  for (const [sido, categories] of Object.entries(json)) {
    for (const [type, list] of Object.entries(categories)) {
      for (const address of list) {
        items.push({ sido, type, address });
      }
    }
  }
  return items;
}

// ── 메인 ──
async function main() {
  // regions 파일 읽기
  if (!fs.existsSync(REGIONS_FILE)) {
    console.error(`파일 없음: ${REGIONS_FILE}`);
    process.exit(1);
  }
  const json = JSON.parse(fs.readFileSync(REGIONS_FILE, 'utf-8'));
  const items = flattenRegions(json);
  const total = items.length;
  console.log(`\n총 ${total}개 항목 테스트 시작 (동시 ${CONCURRENCY}개, 딜레이 ${DELAY_MS}ms)\n`);

  const results = [];
  const geoFailList = [];
  const zeroList = [];
  const sidoStats = {};

  // 항목 처리 함수
  async function processItem(item, index) {
    const { sido, type, address } = item;
    const idx = index + 1;
    const prefix = `[${String(idx).padStart(3, ' ')}/${total}]`;

    // 1) 지오코딩
    const coords = await geocode(address);
    if (!coords) {
      const msg = `${prefix} ${address} → FAIL: 좌표 변환 실패`;
      console.log(msg);
      geoFailList.push({ idx, sido, type, address });
      results.push({ idx, sido, type, address, status: 'geo_fail', lat: null, lng: null, total: 0, franchise: 0, independent: 0, stats: {}, error: '좌표 변환 실패' });
      return;
    }

    const { lat, lng } = coords;

    // 2) cafe-collect-proxy 호출
    const collected = await collectCafes(lat, lng, sido, address);

    if (collected.error) {
      const msg = `${prefix} ${address} → ${lat.toFixed(3)}, ${lng.toFixed(3)} → FAIL: ${collected.error}`;
      console.log(msg);
      results.push({ idx, sido, type, address, status: 'collect_fail', lat, lng, total: 0, franchise: 0, independent: 0, stats: {}, error: collected.error });
      return;
    }

    const { total: cafeTotal, franchise, independent, stats } = collected;

    // 콘솔 출력
    const msg = `${prefix} ${address} → ${lat.toFixed(3)}, ${lng.toFixed(3)} → 카페 ${cafeTotal}개 (프랜 ${franchise} + 개인 ${independent})`;
    console.log(msg);

    // 0개 기록
    if (cafeTotal === 0) {
      zeroList.push({ idx, sido, type, address });
    }

    // 시도별 통계
    if (!sidoStats[sido]) sidoStats[sido] = { count: 0, totalCafes: 0 };
    sidoStats[sido].count++;
    sidoStats[sido].totalCafes += cafeTotal;

    results.push({ idx, sido, type, address, status: 'ok', lat, lng, total: cafeTotal, franchise, independent, stats, error: null });
  }

  // concurrency 제한 처리 (배치 방식)
  for (let i = 0; i < items.length; i += CONCURRENCY) {
    const batch = items.slice(i, i + CONCURRENCY);
    const promises = batch.map((item, bIdx) => processItem(item, i + bIdx));
    await Promise.all(promises);
    // 마지막 배치가 아니면 딜레이
    if (i + CONCURRENCY < items.length) {
      await sleep(DELAY_MS);
    }
  }

  // ── 결과 저장 ──
  const successList = results.filter(r => r.status === 'ok');
  const failList = results.filter(r => r.status !== 'ok');

  const summary = {
    generatedAt: new Date().toISOString(),
    totalItems: total,
    success: successList.length,
    fail: failList.length,
    zeroCafes: zeroList.length,
    geoFail: geoFailList.length,
    sidoAverages: Object.fromEntries(
      Object.entries(sidoStats).map(([sido, s]) => [sido, +(s.totalCafes / s.count).toFixed(1)])
    ),
    zeroList,
    geoFailList,
    details: results
  };

  fs.writeFileSync(RESULTS_FILE, JSON.stringify(summary, null, 2), 'utf-8');

  // ── 최종 요약 출력 ──
  console.log('\n' + '='.repeat(60));
  console.log(`최종 결과: 총 ${total}개 중 성공 ${successList.length} / 실패 ${failList.length}`);
  console.log(`  - 지오코딩 실패: ${geoFailList.length}개`);
  console.log(`  - 카페 수집 실패: ${failList.length - geoFailList.length}개`);
  console.log(`  - 카페 0개 지역: ${zeroList.length}개`);

  if (zeroList.length > 0) {
    console.log('\n[카페 0개 지역]');
    zeroList.forEach(z => console.log(`  ${String(z.idx).padStart(3, ' ')}. [${z.sido}] ${z.address}`));
  }

  if (geoFailList.length > 0) {
    console.log('\n[지오코딩 실패]');
    geoFailList.forEach(z => console.log(`  ${String(z.idx).padStart(3, ' ')}. [${z.sido}] ${z.address}`));
  }

  console.log('\n[시도별 평균 카페 수]');
  for (const [sido, avg] of Object.entries(summary.sidoAverages)) {
    const stat = sidoStats[sido];
    console.log(`  ${sido}: 평균 ${avg}개 (${stat.count}개 지역 테스트)`);
  }

  console.log(`\n결과 저장: ${RESULTS_FILE}`);
  console.log('='.repeat(60));
}

main().catch(err => {
  console.error('치명적 오류:', err);
  process.exit(1);
});
