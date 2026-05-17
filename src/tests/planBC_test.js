/**
 * Plan B/C 폴백 로직 유닛 테스트
 * 순수 Node.js assert 사용 (프레임워크 불필요)
 *
 * 실행: node src/tests/planBC_test.js
 */

const assert = require('assert');
const path = require('path');
const fs = require('fs');

// ─── standard_gangnam.json 로드 (Plan C 검증용) ───
const standardGangnamPath = path.resolve(__dirname, '../assets/data/standard_gangnam.json');
const standardGangnam = JSON.parse(fs.readFileSync(standardGangnamPath, 'utf-8'));

// ─── Mock: localStorage ───
function createMockLocalStorage() {
  const store = {};
  return {
    getItem(key) { return store[key] ?? null; },
    setItem(key, value) { store[key] = String(value); },
    removeItem(key) { delete store[key]; },
    get length() { return Object.keys(store).length; },
    key(i) { return Object.keys(store)[i] ?? null; },
    _store: store,
  };
}

// ─── Mock: AbortController ───
class MockAbortController {
  constructor() {
    this.signal = { aborted: false };
  }
  abort() {
    this.signal.aborted = true;
  }
}

// ─── fetchWithFallback 재구현 (원본 로직 동일, import 대신 직접 포팅) ───
// 원본은 ESM import 사용하므로 Node.js CJS에서 직접 실행 불가.
// 로직 동일성 보장을 위해 원본 그대로 복사 + 환경 주입 방식으로 테스트.

const CACHE_PREFIX = 'dsm_cache_';

function createFetchWithFallback({ fetchFn, localStorage, standardData }) {
  return async function fetchWithFallback(url, cacheKey, timeout = 5000, options = {}) {
    const fullCacheKey = CACHE_PREFIX + cacheKey;

    // Plan A: 실시간 API 호출
    try {
      const controller = new MockAbortController();
      const timeoutId = setTimeout(() => controller.abort(), timeout);

      const fetchOptions = {
        ...options,
        signal: controller.signal,
      };

      const response = await fetchFn(url, fetchOptions);
      clearTimeout(timeoutId);

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();

      // 성공 시 캐시 저장
      try {
        localStorage.setItem(fullCacheKey, JSON.stringify({
          data,
          timestamp: Date.now(),
        }));
      } catch (e) {
        // localStorage 용량 초과 등 무시
      }

      return {
        sourceId: cacheKey,
        timestamp: Date.now(),
        data,
        source: 'live',
      };
    } catch (err) {
      // Plan A 실패
      console.warn(`[Plan A 실패] ${cacheKey}: ${err.message}`);
    }

    // Plan B: localStorage 캐시
    try {
      const cached = localStorage.getItem(fullCacheKey);
      if (cached) {
        const parsed = JSON.parse(cached);
        console.warn(`[Plan B 적용] ${cacheKey}: 캐시 사용`);
        return {
          sourceId: cacheKey,
          timestamp: parsed.timestamp,
          data: parsed.data,
          source: 'cache',
        };
      }
    } catch (e) {
      // 캐시 파싱 실패
    }

    // Plan C: 표준 데이터
    console.warn(`[Plan C 적용] ${cacheKey}: 표준 데이터 로드`);
    return {
      sourceId: cacheKey,
      timestamp: Date.now(),
      data: standardData,
      source: 'fallback',
    };
  };
}

// ─── 테스트 헬퍼 ───
let passed = 0;
let failed = 0;

async function runTest(name, fn) {
  try {
    await fn();
    passed++;
    console.log(`  [PASS] ${name}`);
  } catch (err) {
    failed++;
    console.log(`  [FAIL] ${name}`);
    console.log(`         ${err.message}`);
  }
}

// ─── Mock fetch 팩토리 ───
function mockFetchSuccess(data) {
  return async () => ({
    ok: true,
    json: async () => data,
  });
}

function mockFetchFail(errorMsg = 'Network Error') {
  return async () => { throw new Error(errorMsg); };
}

function mockFetchHttpError(status, statusText) {
  return async () => ({
    ok: false,
    status,
    statusText,
  });
}

// ─── 테스트 실행 ───
(async () => {
  console.log('\n=== Plan B/C 폴백 로직 유닛 테스트 ===\n');

  // ─── Test 1: Plan B - API 실패 시 localStorage 캐시 로드 ───
  console.log('[Test 1] Plan B - API 실패 시 localStorage 캐시 로드');
  {
    const mockLS = createMockLocalStorage();
    const cachedData = { cafes: ['캐시된카페A', '캐시된카페B'], region: '강남' };
    const cacheTimestamp = Date.now() - 60000; // 1분 전 캐시

    // localStorage에 테스트 데이터 미리 세팅
    mockLS.setItem(CACHE_PREFIX + 'test_planB', JSON.stringify({
      data: cachedData,
      timestamp: cacheTimestamp,
    }));

    const fetchFn = createFetchWithFallback({
      fetchFn: mockFetchFail('fetch failed: timeout'),
      localStorage: mockLS,
      standardData: standardGangnam,
    });

    const result = await fetchFn('http://invalid-url.test/api', 'test_planB', 1000);

    await runTest('source가 cache여야 한다', () => {
      assert.strictEqual(result.source, 'cache');
    });

    await runTest('캐시된 데이터가 반환되어야 한다', () => {
      assert.deepStrictEqual(result.data, cachedData);
    });

    await runTest('캐시 timestamp가 보존되어야 한다', () => {
      assert.strictEqual(result.timestamp, cacheTimestamp);
    });

    await runTest('sourceId가 cacheKey와 일치해야 한다', () => {
      assert.strictEqual(result.sourceId, 'test_planB');
    });
  }

  console.log('');

  // ─── Test 2: Plan C - 캐시 부재 시 standard_gangnam.json 로드 ───
  console.log('[Test 2] Plan C - 캐시 부재 시 standard_gangnam.json 로드');
  {
    const mockLS = createMockLocalStorage(); // 빈 localStorage

    const fetchFn = createFetchWithFallback({
      fetchFn: mockFetchFail('fetch failed: no network'),
      localStorage: mockLS,
      standardData: standardGangnam,
    });

    const result = await fetchFn('http://invalid-url.test/api', 'test_planC', 1000);

    await runTest('source가 fallback이어야 한다', () => {
      assert.strictEqual(result.source, 'fallback');
    });

    await runTest('standard_gangnam.json 데이터가 반환되어야 한다', () => {
      assert.deepStrictEqual(result.data, standardGangnam);
    });

    await runTest('반환 데이터에 meta.source가 "fallback"이어야 한다', () => {
      assert.strictEqual(result.data.meta.source, 'fallback');
    });

    await runTest('반환 데이터에 location.guName이 "강남구"여야 한다', () => {
      assert.strictEqual(result.data.location.guName, '강남구');
    });

    await runTest('반환 데이터에 cafes 배열이 존재해야 한다', () => {
      assert.ok(Array.isArray(result.data.cafes));
    });

    await runTest('반환 데이터에 storeRadius.items 배열이 존재해야 한다', () => {
      assert.ok(Array.isArray(result.data.storeRadius.items));
    });
  }

  console.log('');

  // ─── Test 3: 정상 호출 시 캐시 저장 ───
  console.log('[Test 3] Plan A - 정상 호출 시 캐시 저장');
  {
    const mockLS = createMockLocalStorage();
    const liveData = { cafes: ['라이브카페X'], count: 1 };

    const fetchFn = createFetchWithFallback({
      fetchFn: mockFetchSuccess(liveData),
      localStorage: mockLS,
      standardData: standardGangnam,
    });

    const result = await fetchFn('http://api.test/ok', 'test_planA', 5000);

    await runTest('source가 live여야 한다', () => {
      assert.strictEqual(result.source, 'live');
    });

    await runTest('라이브 데이터가 반환되어야 한다', () => {
      assert.deepStrictEqual(result.data, liveData);
    });

    await runTest('localStorage에 캐시가 저장되어야 한다', () => {
      const cached = mockLS.getItem(CACHE_PREFIX + 'test_planA');
      assert.ok(cached !== null, 'localStorage에 캐시가 없습니다');
    });

    await runTest('저장된 캐시 데이터가 원본과 일치해야 한다', () => {
      const cached = JSON.parse(mockLS.getItem(CACHE_PREFIX + 'test_planA'));
      assert.deepStrictEqual(cached.data, liveData);
    });

    await runTest('저장된 캐시에 timestamp가 있어야 한다', () => {
      const cached = JSON.parse(mockLS.getItem(CACHE_PREFIX + 'test_planA'));
      assert.ok(typeof cached.timestamp === 'number');
      assert.ok(cached.timestamp > 0);
    });
  }

  console.log('');

  // ─── Test 4: HTTP 에러 시 Plan B 폴백 ───
  console.log('[Test 4] HTTP 500 에러 시 Plan B 폴백');
  {
    const mockLS = createMockLocalStorage();
    const cachedData = { result: 'from_cache' };

    mockLS.setItem(CACHE_PREFIX + 'test_http500', JSON.stringify({
      data: cachedData,
      timestamp: Date.now() - 30000,
    }));

    const fetchFn = createFetchWithFallback({
      fetchFn: mockFetchHttpError(500, 'Internal Server Error'),
      localStorage: mockLS,
      standardData: standardGangnam,
    });

    const result = await fetchFn('http://api.test/fail', 'test_http500', 5000);

    await runTest('HTTP 500에서도 Plan B cache로 폴백해야 한다', () => {
      assert.strictEqual(result.source, 'cache');
      assert.deepStrictEqual(result.data, cachedData);
    });
  }

  console.log('');

  // ─── Test 5: Plan A 성공 후 재호출 실패 -> Plan B ───
  console.log('[Test 5] Plan A 성공 -> 재호출 실패 -> Plan B (캐시 재활용)');
  {
    const mockLS = createMockLocalStorage();
    const liveData = { msg: 'first_call_success' };

    // 첫 번째 호출: 성공
    const fetchFnOk = createFetchWithFallback({
      fetchFn: mockFetchSuccess(liveData),
      localStorage: mockLS,
      standardData: standardGangnam,
    });
    await fetchFnOk('http://api.test/ok', 'test_reuse', 5000);

    // 두 번째 호출: 실패 (같은 localStorage 공유)
    const fetchFnFail = createFetchWithFallback({
      fetchFn: mockFetchFail('second call failed'),
      localStorage: mockLS,
      standardData: standardGangnam,
    });
    const result = await fetchFnFail('http://api.test/fail', 'test_reuse', 5000);

    await runTest('첫 호출 캐시가 두 번째 실패 시 Plan B로 사용되어야 한다', () => {
      assert.strictEqual(result.source, 'cache');
      assert.deepStrictEqual(result.data, liveData);
    });
  }

  console.log('');

  // ─── Test 6: standard_gangnam.json 구조 검증 ───
  console.log('[Test 6] standard_gangnam.json 구조 검증');
  {
    await runTest('meta 필드가 존재해야 한다', () => {
      assert.ok(standardGangnam.meta);
      assert.strictEqual(standardGangnam.meta.source, 'fallback');
    });

    await runTest('location 필드에 lat, lng, address가 있어야 한다', () => {
      assert.ok(standardGangnam.location);
      assert.strictEqual(typeof standardGangnam.location.lat, 'number');
      assert.strictEqual(typeof standardGangnam.location.lng, 'number');
      assert.ok(standardGangnam.location.address);
    });

    await runTest('simpleAnls 필드가 존재해야 한다', () => {
      assert.ok(standardGangnam.simpleAnls);
      assert.ok(standardGangnam.simpleAnls.avgAmt);
      assert.ok(standardGangnam.simpleAnls.population);
    });

    await runTest('storeRadius 필드에 items 배열과 totalCount가 있어야 한다', () => {
      assert.ok(standardGangnam.storeRadius);
      assert.ok(Array.isArray(standardGangnam.storeRadius.items));
      assert.strictEqual(typeof standardGangnam.storeRadius.totalCount, 'number');
    });
  }

  // ─── 결과 요약 ───
  console.log('\n=== 테스트 결과 ===');
  console.log(`  통과: ${passed}`);
  console.log(`  실패: ${failed}`);
  console.log(`  합계: ${passed + failed}`);
  console.log('');

  if (failed > 0) {
    process.exit(1);
  } else {
    console.log('모든 테스트 통과!\n');
    process.exit(0);
  }
})();
