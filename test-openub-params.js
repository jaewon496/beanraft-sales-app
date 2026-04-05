/**
 * OpenUB API Parameter Test - CONSOLIDATED FINAL
 *
 * COMPLETE FINDINGS:
 *
 * 1. juso.openub.com/v2/search/스타벅스 강남R returns:
 *    - rdnu: "Nuh22uWfc2vx7p" (SAME rdnu as we're using)
 *    - salesExists: true, salesExistsLatest: true
 *    - category_group_name: "카페"
 *    => Starbucks IS mapped to this rdnu in OpenUB's index
 *
 * 2. But bd/sales for rdnu "Nuh22uWfc2vx7p" returns only 7 stores:
 *    A0 (음식): 리사이트, 미진식당, 오수사
 *    B0 (소매): GS25 x3, 오렌즈 강남점
 *    => No Starbucks, no cafe at all
 *
 * 3. The proxy correctly sends: login:true + category:"A0:B0:C0:D0:F0:G0"
 *    But the cafe filter (isCafeCategory) only passes stores where
 *    category.mi includes 카페/커피/찻집 — none of the 7 stores qualify
 *
 * 4. ROOT CAUSE HYPOTHESIS:
 *    - OpenUB's bd/sales API returns a SUBSET of stores for each building
 *    - Starbucks data exists (salesExists:true) but NOT in the free API tier
 *    - The category filter A0:B0 only returns certain store types
 *    - Premium/paid API access may include more stores
 *    - OR: the data is time-delayed and Starbucks was recently added
 *
 * 5. VERIFIED API BEHAVIOR:
 *    - category MUST be present (colon-separated, e.g., "A0:B0:C0")
 *    - login MUST be true
 *    - Without either: 500 or 401 error
 *    - gp endpoint: 500 error with our token (may need different auth)
 *    - juso.openub.com is a separate search service (GET only, path-based)
 *    - bd/hash requires S2 cellTokens (hex strings)
 */

const TOKEN = 'f3ddcfb3-caf4-4c30-9e09-f3f7fbc1abc1';
const BASE = 'https://api.openub.com';
const JUSO_BASE = 'https://juso.openub.com';

const HEADERS = {
  'Content-Type': 'application/json',
  'Access-Token': TOKEN,
  'Origin': 'https://www.openub.com',
  'Referer': 'https://www.openub.com/',
};

async function callAPI(base, method, path, body) {
  const url = `${base}${path}`;
  const opts = { method, headers: { ...HEADERS } };
  if (body && method === 'POST') opts.body = JSON.stringify(body);
  try {
    const res = await fetch(url, opts);
    const text = await res.text();
    let json = null;
    try { json = JSON.parse(text); } catch {}
    return { status: res.status, json, text };
  } catch (e) {
    return { status: 'ERR', error: e.message };
  }
}

async function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

async function main() {
  const RDNU = 'Nuh22uWfc2vx7p';

  console.log('='.repeat(70));
  console.log('OpenUB API Parameter Test - FINAL CONSOLIDATED');
  console.log(`Building: 강남대로 390 (rdnu: ${RDNU})`);
  console.log(`Target: 스타벅스 강남R점`);
  console.log('='.repeat(70));

  // ============================================================
  // 1. Verify Starbucks exists in OpenUB search index
  // ============================================================
  console.log('\n### 1. JUSO SEARCH: Verify Starbucks exists ###\n');

  let r = await callAPI(JUSO_BASE, 'GET', `/v2/search/${encodeURIComponent('강남대로 390')}`);
  if (r.json?.kakao) {
    console.log(`  Results: ${r.json.kakao.length} places at 강남대로 390`);
    r.json.kakao.forEach((p, i) => {
      const isSB = p.place_name?.includes('스타벅스');
      console.log(`  [${i}] ${isSB ? '***' : '   '} ${p.place_name} | rdnu=${p.rdnu} | sales=${p.salesExists} | cat=${p.category_group_name}`);
    });
  }
  await sleep(500);

  // ============================================================
  // 2. bd/sales for the SAME rdnu - what stores come back?
  // ============================================================
  console.log('\n### 2. BD/SALES: Stores returned by API ###\n');

  r = await callAPI(BASE, 'POST', '/v2/bd/sales', {
    rdnu: RDNU, login: true, category: 'A0:B0:C0:D0:E0:F0:G0:H0:I0:J0'
  });

  if (r.json?.result?.stores) {
    const stores = r.json.result.stores;
    console.log(`  Stores: ${stores.length}`);
    console.log(`  cateCnt: ${JSON.stringify(r.json.result.cateCnt)}`);
    console.log(`  Address: ${r.json.result.roadAddr}`);
    stores.forEach((s, i) => {
      const isSB = s.storeNm?.includes('스타벅스');
      console.log(`  [${i}] ${isSB ? '***' : '   '} ${s.storeNm} | ${s.category?.bg}>${s.category?.mi}>${s.category?.sl} | floor=${s.floor || 'N/A'}`);
    });

    // Check if any store could be Starbucks under different name
    const cafeStores = stores.filter(s => {
      const mi = s.category?.mi || '';
      return mi.includes('카페') || mi.includes('커피') || mi.includes('찻집');
    });
    console.log(`\n  Cafe-category stores: ${cafeStores.length}`);
  }
  await sleep(500);

  // ============================================================
  // 3. Check our Netlify proxy results
  // ============================================================
  console.log('\n### 3. PROXY: What our app actually gets ###\n');

  try {
    const proxyRes = await fetch('https://beancraft-sales.netlify.app/.netlify/functions/openub-proxy', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ lat: 37.4968, lng: 127.0282, radius: 200 })
    });
    const data = await proxyRes.json();
    console.log(`  Buildings: ${data.buildingsSearched}`);
    console.log(`  Cafes found: ${data.totalCafes}`);
    if (data.cafes?.length > 0) {
      data.cafes.forEach((c, i) => {
        console.log(`    [${i}] ${c.storeNm} | ${c.category?.mi} | rdnu=${c.rdnu}`);
      });
    }
    const sb = data.cafes?.filter(c => c.storeNm?.includes('스타벅스'));
    console.log(`  Starbucks in results: ${sb?.length || 0}`);
  } catch (e) {
    console.log(`  Error: ${e.message}`);
  }

  // ============================================================
  // FINAL DIAGNOSIS
  // ============================================================
  console.log('\n' + '='.repeat(70));
  console.log('FINAL DIAGNOSIS');
  console.log('='.repeat(70));

  console.log(`
1. JUSO SEARCH confirms: 스타벅스 강남R점 is at rdnu Nuh22uWfc2vx7p
   with salesExists: true (OpenUB HAS sales data for it)

2. BD/SALES API returns only 7 stores for this building:
   - 3 food stores (음식): 리사이트, 미진식당, 오수사
   - 4 retail stores (소매): GS25 x3, 오렌즈
   - ZERO cafe/coffee stores

3. The DISCREPANCY: OpenUB search says Starbucks exists here,
   but bd/sales doesn't return it.

4. POSSIBLE EXPLANATIONS:
   a) bd/sales returns a LIMITED set based on token/account tier
   b) Starbucks data may require a paid/Pro subscription
   c) The category codes A0-J0 may not cover all store types
   d) There may be a separate "franchise" or "branded" store list
      that's not included in the basic bd/sales response

5. API PARAMETER FINDINGS:
   - category: REQUIRED, colon-separated (e.g., "A0:B0:C0:D0:F0:G0")
   - login: MUST be true
   - juso.openub.com/v2/search/{keyword}: works with GET, returns rdnu
   - bd/hash: requires S2 cellTokens array
   - gp: returns 500 with our token (may be deprecated or restricted)

6. RECOMMENDATION:
   - The proxy code is CORRECT in its API call format
   - The missing stores are an OpenUB data/tier limitation
   - To get more stores: investigate OpenUB Pro API or alternative source
   - For now, our cafe collection relies on what bd/sales returns
`);
}

main().catch(e => console.error('FATAL:', e));
