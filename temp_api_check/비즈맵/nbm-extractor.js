// 나이스비즈맵 자동 추출 → Firebase 자동 저장 헬퍼 v3
//
// 사용법 (한 번만 콘솔에 붙여넣으면 페이지 새로고침까지 자동):
//   1. m.nicebizmap.co.kr/explorer/summary 로그인 상태 유지
//   2. F12 콘솔 열고 이 파일 내용 전체 붙여넣기 → Enter
//   3. 그 후 어떤 동/업종이든 분석 실행 시 자동으로 19개 데이터 Firebase에 저장
//   4. 콘솔에 "[NBM-AUTO] saved {admiCd}_{upjong3Cd}" 메시지 나오면 성공
//   5. 페이지 새로고침 시 다시 붙여넣어야 함
//
// v3 변경점: DOM scrape 대신 fetch interceptor 기반 (100% 정확)
//   - summary-report 응답 자동 가로채기
//   - 19개 키 다 들어오면 Firebase에 즉시 push
//   - 8자리 + 10자리 admiCd 양쪽 저장

(() => {
  if (window.__nbmAutoSaveInstalled) {
    console.log('%c[NBM-AUTO] 이미 설치됨. 분석 실행 시 자동으로 Firebase에 저장됩니다.', 'color:orange;font-weight:bold');
    return;
  }
  window.__nbmAutoSaveInstalled = true;

  const FIREBASE_BASE = 'https://beancraft-sales-team-default-rtdb.asia-southeast1.firebasedatabase.app';
  const _origFetch = window.fetch;

  async function pushToFirebase(admiCd, upjong3Cd, payload) {
    const keys = [String(admiCd)];
    if (admiCd.length === 8) keys.push(admiCd + '00');
    if (admiCd.length === 10) keys.push(admiCd.slice(0, 8));

    let ok = 0;
    for (const k of keys) {
      try {
        const r = await _origFetch(`${FIREBASE_BASE}/bizmapCache/${k}_${upjong3Cd}.json`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });
        if (r.ok) ok++;
      } catch (e) { /* skip */ }
    }
    return ok;
  }

  function countCoreKeys(data) {
    if (!data) return 0;
    const core = [
      'genderAgeTrendList', 'hourlySalesConcentration', 'weeklySalesConcentration',
      'averageSalesList', 'usageAndPaymentTrendList', 'storeCountTrendList',
      'marketSizeTrendList', 'costAnalysisList', 'popularMenuList',
      'popularUpjongListOrderBySaleRnk', 'popularUpjongListOrderByStoreRnk',
      'storeCountChangeList', 'blockTypeList', 'risingMenuList'
    ];
    return core.filter(k => data[k] != null && (Array.isArray(data[k]) ? data[k].length > 0 : true)).length;
  }

  window.fetch = function (...args) {
    const url = typeof args[0] === 'string' ? args[0] : args[0]?.url || '';
    const opts = args[1] || {};
    const promise = _origFetch.apply(this, args);

    if (url.includes('/api/explorer/summary/summary-report') && opts.method === 'POST') {
      let reqBody = {};
      try { reqBody = JSON.parse(opts.body || '{}'); } catch {}

      promise.then(r => {
        if (!r.ok) return;
        r.clone().json().then(j => {
          const data = j.data || j;
          if (!data || !j.success) return;

          const coreCount = countCoreKeys(data);
          if (coreCount < 5) {
            console.log(`%c[NBM-AUTO] skip (only ${coreCount} core keys, need 5+)`, 'color:gray');
            return;
          }

          const admiCd = String(reqBody.admiCd || data.admiCd || '');
          const upjong3Cd = String(reqBody.upjong3Cd || data.upjong3Cd || 'Q13007');
          const upjong3Nm = String(reqBody.upjong3Nm || data.upjong3Nm || '');
          const admiNm = String(reqBody.region?.admiData?.admiNm || data.admiNm || '');

          if (!admiCd || admiCd.length < 8) {
            console.warn('[NBM-AUTO] admiCd missing or invalid:', admiCd);
            return;
          }

          // 비즈맵 응답 raw + DOM 보강 메타
          const payload = {
            admiCd, admiNm, upjong3Cd, upjong3Nm,
            extractedAt: new Date().toISOString(),
            source: 'nicebizmap_fetch_intercept_v3',
            yyyymm: reqBody.yyyymm || data.yyyymm,
            prevYyyymm: reqBody.prevYyyymm,
            // 19개 raw 데이터 그대로
            blockTypeList: data.blockTypeList,
            publicCnt: data.publicCnt,
            eduCnt: data.eduCnt,
            financeCnt: data.financeCnt,
            busstopCnt: data.busstopCnt,
            subwayInfo: data.subwayInfo,
            popularUpjongListOrderBySaleRnk: data.popularUpjongListOrderBySaleRnk,
            popularUpjongListOrderByStoreRnk: data.popularUpjongListOrderByStoreRnk,
            storeCountChangeList: data.storeCountChangeList,
            storeCountTrendList: data.storeCountTrendList,
            marketSizeTrendList: data.marketSizeTrendList,
            averageSalesList: data.averageSalesList,
            usageAndPaymentTrendList: data.usageAndPaymentTrendList,
            genderAgeTrendList: data.genderAgeTrendList,
            weeklySalesConcentration: data.weeklySalesConcentration,
            hourlySalesConcentration: data.hourlySalesConcentration,
            popularMenuList: data.popularMenuList,
            risingMenuList: data.risingMenuList,
            costAnalysisList: data.costAnalysisList
          };

          pushToFirebase(admiCd, upjong3Cd, payload).then(ok => {
            if (ok > 0) {
              console.log(`%c[NBM-AUTO] ✅ saved ${admiCd}_${upjong3Cd} (${admiNm}, ${coreCount}개 키, ${ok}개 키-경로)`,
                'color:green;font-weight:bold;font-size:13px');
            } else {
              console.error(`[NBM-AUTO] ❌ Firebase push 실패: ${admiCd}_${upjong3Cd}`);
            }
          });
        }).catch(() => {});
      }).catch(() => {});
    }

    return promise;
  };

  console.log('%c[NBM-AUTO] ✅ 자동 저장 활성화. 분석 실행 시 19개 데이터 자동으로 Firebase에 저장됩니다.',
    'color:green;font-weight:bold;font-size:14px');
  console.log('%c    페이지 새로고침 시 이 스크립트를 다시 붙여넣어야 합니다.', 'color:gray;font-size:11px');
})();
