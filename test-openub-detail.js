// test-openub-detail.js - v3
// Findings so far:
// 1. Proxy passthrough with category param returns 0 stores (but proxy unified finds 131)
// 2. login=false returns 401
// 3. Response structure: result.stores (not top-level stores)
// 4. No pagination fields found
// 5. One building has 49 stores in result.stores
//
// This version focuses on:
// - Understanding why passthrough returns 0 stores with category
// - Testing the actual response structure properly
// - Category code investigation via proxy unified mode response inspection

const PROXY_BASE = 'https://beancraft-sales.netlify.app/.netlify/functions/openub-proxy';

async function callProxy(body) {
  const res = await fetch(PROXY_BASE, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`proxy ${res.status}: ${text.substring(0, 500)}`);
  }
  return res.json();
}

async function callOpenUB(endpoint, body) {
  return callProxy({ endpoint, body });
}

function separator(title) {
  console.log('\n' + '='.repeat(70));
  console.log(`  ${title}`);
  console.log('='.repeat(70));
}

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

async function main() {

  // ─── TEST A: Raw response structure from bd/sales ───
  separator('TEST A: Raw bd/sales response structure');

  // We know rdnu=Nuh2Ba--fQVEiO returned result.stores[49] via passthrough with category
  // But it returned 0 via passthrough WITHOUT login. Let's look at what the proxy actually returns.

  // First: passthrough with login:true + category (this returned stores before)
  const rdnu1 = 'Nuh2Ba--fQVEiO'; // Building with 4 cafes per proxy
  console.log(`Testing rdnu=${rdnu1} with login:true + category...`);
  try {
    const r1 = await callOpenUB('bd/sales', { login: true, rdnu: rdnu1, category: 'A0:B0:C0:D0:F0:G0' });
    console.log('Top keys:', Object.keys(r1));
    console.log('r1.result keys:', r1.result ? Object.keys(r1.result) : 'no result');
    const stores = r1.result?.stores || r1.stores || [];
    console.log(`Stores found: ${stores.length}`);

    // Print first 10 stores
    for (const s of stores.slice(0, 10)) {
      const cat = s.category || {};
      console.log(`  "${s.storeNm || s.name}" bg="${cat.bg}" mi="${cat.mi}" sl="${cat.sl}" isNewOpen=${s.isNewOpen}`);
    }
    if (stores.length > 10) console.log(`  ... and ${stores.length - 10} more`);

    // Count cafes in this response
    let cafeCount = 0;
    for (const s of stores) {
      const mi = s.category?.mi || '';
      const sl = s.category?.sl || '';
      if (mi.includes('카페') || mi.includes('커피') || mi.includes('찻집')) cafeCount++;
      else if (mi.includes('제과제빵떡케익') && sl.includes('제과제빵떡케익')) cafeCount++;
    }
    console.log(`Cafe count (by isCafeCategory logic): ${cafeCount}`);
    console.log(`Non-cafe count: ${stores.length - cafeCount}`);

    // Full raw for analysis
    const rawStr = JSON.stringify(r1);
    console.log(`Response size: ${rawStr.length} chars`);
  } catch(e) {
    console.log(`Error: ${e.message}`);
  }

  // ─── TEST B: Compare category effects using passthrough ───
  separator('TEST B: Category effects on individual building');

  const testRdnus = [
    'Nuh2Ba--fQVEiO',  // 4 cafes found by proxy
    'Nuh2Ba--fQHKRK',  // 8 cafes found by proxy (most in one building)
    'Nuh22uWfk1z6-E',  // 7 cafes (강남역 지하상가)
  ];

  for (const rdnu of testRdnus) {
    console.log(`\n--- rdnu=${rdnu} ---`);

    // With default category
    try {
      const r1 = await callOpenUB('bd/sales', { login: true, rdnu, category: 'A0:B0:C0:D0:F0:G0' });
      const s1 = r1.result?.stores || r1.stores || [];
      console.log(`  Default category: ${s1.length} stores`);

      // Show all categories
      const catCounts = {};
      for (const s of s1) {
        const mi = s.category?.mi || 'unknown';
        catCounts[mi] = (catCounts[mi] || 0) + 1;
      }
      console.log(`  Categories: ${JSON.stringify(catCounts)}`);
    } catch(e) { console.log(`  Default: Error - ${e.message.substring(0, 100)}`); }

    await sleep(300);

    // With extended category
    try {
      const r2 = await callOpenUB('bd/sales', { login: true, rdnu, category: 'A0:B0:C0:D0:E0:F0:G0:H0:I0:J0' });
      const s2 = r2.result?.stores || r2.stores || [];
      console.log(`  Extended category: ${s2.length} stores`);

      const catCounts = {};
      for (const s of s2) {
        const mi = s.category?.mi || 'unknown';
        catCounts[mi] = (catCounts[mi] || 0) + 1;
      }
      console.log(`  Categories: ${JSON.stringify(catCounts)}`);
    } catch(e) { console.log(`  Extended: Error - ${e.message.substring(0, 100)}`); }

    await sleep(300);

    // No category
    try {
      const r3 = await callOpenUB('bd/sales', { login: true, rdnu });
      const s3 = r3.result?.stores || r3.stores || [];
      console.log(`  No category: ${s3.length} stores`);

      const catCounts = {};
      for (const s of s3) {
        const mi = s.category?.mi || 'unknown';
        catCounts[mi] = (catCounts[mi] || 0) + 1;
      }
      console.log(`  Categories: ${JSON.stringify(catCounts)}`);
    } catch(e) { console.log(`  No cat: Error - ${e.message.substring(0, 100)}`); }

    await sleep(300);
  }

  // ─── TEST C: Individual category code deep dive ───
  separator('TEST C: Individual category codes A0-J0');

  const bigRdnu = 'Nuh2Ba--fQVEiO'; // Known to have 49 stores
  console.log(`Building: ${bigRdnu}`);

  const codeResults = {};
  const codes = ['A0', 'B0', 'C0', 'D0', 'E0', 'F0', 'G0', 'H0', 'I0', 'J0'];

  for (const code of codes) {
    try {
      const r = await callOpenUB('bd/sales', { login: true, rdnu: bigRdnu, category: code });
      const stores = r.result?.stores || r.stores || [];
      codeResults[code] = stores.length;

      if (stores.length > 0) {
        const cats = {};
        for (const s of stores) {
          const key = `${s.category?.bg || '?'}>${s.category?.mi || '?'}>${s.category?.sl || '?'}`;
          cats[key] = (cats[key] || 0) + 1;
        }
        console.log(`  ${code}: ${stores.length} stores - ${JSON.stringify(cats)}`);
        // Print first 3 store names
        for (const s of stores.slice(0, 3)) {
          console.log(`    "${s.storeNm || s.name}"`);
        }
        if (stores.length > 3) console.log(`    ... +${stores.length - 3} more`);
      } else {
        console.log(`  ${code}: 0 stores`);
      }
    } catch(e) {
      codeResults[code] = 'error';
      console.log(`  ${code}: Error - ${e.message.substring(0, 80)}`);
    }
    await sleep(200);
  }

  // Combined total
  const totalFromCodes = Object.values(codeResults).filter(v => typeof v === 'number').reduce((a, b) => a + b, 0);
  console.log(`\nSum of individual codes: ${totalFromCodes}`);
  console.log(`Default "A0:B0:C0:D0:F0:G0" returned: (see TEST B above)`);

  // ─── TEST D: Response structure deep dive (biggest building) ───
  separator('TEST D: Full response structure for building with most stores');

  try {
    const r = await callOpenUB('bd/sales', { login: true, rdnu: bigRdnu, category: 'A0:B0:C0:D0:F0:G0' });

    console.log('Top-level keys:', Object.keys(r));

    if (r.result) {
      console.log('\nresult keys:', Object.keys(r.result));

      if (r.result.stores) {
        console.log(`\nresult.stores: array[${r.result.stores.length}]`);
        if (r.result.stores[0]) {
          console.log('  Store[0] keys:', Object.keys(r.result.stores[0]));
          console.log('  Store[0] full:', JSON.stringify(r.result.stores[0]).substring(0, 500));
        }
      }

      if (r.result.data) {
        console.log('\nresult.data keys:', Object.keys(r.result.data));
        // Print data structure
        for (const [k, v] of Object.entries(r.result.data)) {
          if (Array.isArray(v)) console.log(`  data.${k}: array[${v.length}]`);
          else if (typeof v === 'object') console.log(`  data.${k}: object{${Object.keys(v).join(',')}}`);
          else console.log(`  data.${k}: ${typeof v} = ${String(v).substring(0, 60)}`);
        }
      }

      if (r.result.monthSales !== undefined) {
        console.log(`\nresult.monthSales:`, JSON.stringify(r.result.monthSales).substring(0, 300));
      }

      if (r.result.cateCnt !== undefined) {
        console.log('\nresult.cateCnt:', JSON.stringify(r.result.cateCnt).substring(0, 300));
      }
    }

    if (r.totalCapacity !== undefined) {
      console.log(`\ntotalCapacity: ${JSON.stringify(r.totalCapacity)}`);
    }

    // Check for stores that look like cafes but might be missed by category
    const stores = r.result?.stores || [];
    console.log('\n--- ALL stores in this building ---');
    for (const s of stores) {
      const cat = s.category || {};
      const name = s.storeNm || s.name || '';

      // Check if cafe
      let isCafe = false;
      const mi = cat.mi || '';
      const sl = cat.sl || '';
      if (mi.includes('카페') || mi.includes('커피') || mi.includes('찻집')) isCafe = true;
      if (mi.includes('제과제빵떡케익') && sl.includes('제과제빵떡케익')) isCafe = true;

      // Check if name looks like cafe
      let nameLooksCafe = false;
      const nl = name.toLowerCase();
      if (nl.includes('카페') || nl.includes('커피') || nl.includes('coffee') || nl.includes('cafe') ||
          nl.includes('라떼') || nl.includes('로스터') || nl.includes('브루') ||
          nl.includes('스타벅스') || nl.includes('이디야') || nl.includes('할리스') ||
          nl.includes('투썸') || nl.includes('빽다방') || nl.includes('메가') ||
          nl.includes('컴포즈') || nl.includes('더벤티') || nl.includes('바나프레소') ||
          nl.includes('베이커') || nl.includes('빵') || nl.includes('디저트') ||
          nl.includes('다방') || nl.includes('티') || nl.includes('tea')) {
        nameLooksCafe = true;
      }

      const tag = isCafe ? 'CAFE  ' : (nameLooksCafe && !isCafe ? 'MISS? ' : '      ');
      console.log(`  [${tag}] "${name}" | bg="${cat.bg||''}" mi="${mi}" sl="${sl}"`);
    }
  } catch(e) {
    console.log(`Error: ${e.message}`);
  }

  // ─── TEST E: login=true vs login=false ───
  separator('TEST E: login=true vs login=false');

  try {
    console.log('login=true:');
    const rTrue = await callOpenUB('bd/sales', { login: true, rdnu: bigRdnu, category: 'A0:B0:C0:D0:F0:G0' });
    const stTrue = rTrue.result?.stores || rTrue.stores || [];
    console.log(`  Stores: ${stTrue.length}`);
    console.log(`  Response keys: ${Object.keys(rTrue)}`);

    await sleep(500);

    console.log('\nlogin=false:');
    const rFalse = await callOpenUB('bd/sales', { login: false, rdnu: bigRdnu, category: 'A0:B0:C0:D0:F0:G0' });
    const stFalse = rFalse.result?.stores || rFalse.stores || [];
    console.log(`  Stores: ${stFalse.length}`);
    console.log(`  Response keys: ${Object.keys(rFalse)}`);

    if (stTrue.length !== stFalse.length) {
      console.log(`\n*** DIFFERENCE: login=true has ${stTrue.length} stores, login=false has ${stFalse.length}`);
    } else {
      console.log('\n  Same store count for both login values');
    }

    // Check if sales data differs
    const trueHasData = !!(rTrue.result?.data);
    const falseHasData = !!(rFalse.result?.data);
    console.log(`  Has sales data: true=${trueHasData}, false=${falseHasData}`);

    if (trueHasData && !falseHasData) {
      console.log('  *** login=false LOSES sales data (times, gender, weekday)!');
    }

  } catch(e) {
    console.log(`Error: ${e.message}`);
  }

  // ─── TEST F: Proxy extractCafesFromBdSales logic check ───
  separator('TEST F: Proxy extraction logic verification');

  console.log('The proxy code looks for stores in two places:');
  console.log('  1. data.stores or data.result.stores');
  console.log('  2. data.bd[rdnu].stores');
  console.log('');

  // Check if proxy response includes bd sub-object
  try {
    const r = await callOpenUB('bd/sales', { login: true, rdnu: bigRdnu, category: 'A0:B0:C0:D0:F0:G0' });

    const hasTopStores = !!(r.stores);
    const hasResultStores = !!(r.result?.stores);
    const hasBdMap = !!(r.bd) || !!(r.result?.bd);

    console.log(`Has top-level stores: ${hasTopStores}`);
    console.log(`Has result.stores: ${hasResultStores}`);
    console.log(`Has bd map: ${hasBdMap}`);

    if (!hasTopStores && hasResultStores) {
      console.log('\n*** CRITICAL FINDING: Stores are at result.stores, NOT top-level stores!');
      console.log('*** The proxy code checks data.stores first (line 215), which would be r.stores');
      console.log('*** But the actual stores are at r.result.stores');
      console.log('*** The proxy ALSO checks data.result?.stores which maps to r.result.stores');
      console.log('*** So the proxy should find them via the second path.');

      // Verify: what does the proxy's extractCafesFromBdSales get?
      // In the proxy, bdSalesResult.data = the full response from callOpenUB
      // So data.stores = r.stores (empty)
      // data.result?.stores = r.result.stores (has stores)
      // So the proxy should work.

      const stores = r.result.stores;
      let cafesFound = 0;
      for (const s of stores) {
        const mi = s.category?.mi || '';
        const sl = s.category?.sl || '';
        const name = s.storeNm || '';

        let isCafe = false;
        if (mi.includes('카페') || mi.includes('커피') || mi.includes('찻집')) isCafe = true;
        if (mi.includes('제과제빵떡케익') && sl.includes('제과제빵떡케익')) isCafe = true;

        // Name exclusion
        const excl = ['에스테틱', '액세서리', '홀릭', '빈대떡', '떡갈비', '냉면', '김밤', '치킨', '고기'];
        for (const kw of excl) { if (name.includes(kw)) isCafe = false; }
        if (sl === '떡/한과 전문점' || sl === '테이크아웃음료/과일 전문점') isCafe = false;

        if (isCafe) cafesFound++;
      }

      console.log(`\nCafes from result.stores: ${cafesFound} out of ${stores.length} total stores`);
    }
  } catch(e) {
    console.log(`Error: ${e.message}`);
  }

  // ─── FINAL SUMMARY ───
  separator('FINAL SUMMARY OF ALL FINDINGS');

  console.log(`
1. RESPONSE STRUCTURE:
   - Stores are at response.result.stores (NOT response.stores)
   - The proxy correctly accesses this via data.result?.stores fallback
   - No pagination: all stores for a building come in one response

2. CATEGORY PARAMETER EFFECT:
   (Results from TEST B and C above show whether category filtering matters)
   - Current code: "A0:B0:C0:D0:F0:G0" (note: E0 is missing!)

3. LOGIN PARAMETER:
   - login=false causes 401 errors when called without auth
   - login=true is required and working

4. DATA COMPLETENESS:
   - bd/hash returns ~3791 buildings (much more than the 485 within radius)
   - Proxy filters to 485 buildings within 500m radius
   - All 485 bd/sales calls succeeded (0 failures this run)
   - 131 cafes found in 89 buildings

5. POTENTIAL DATA LOSS SOURCES:
   a. Category filter "A0:B0:C0:D0:F0:G0" - E0 code is excluded
   b. isCafeCategory filter may be too restrictive
   c. NAME_EXCLUDE_KEYWORDS may false-positive on legitimate cafes
  `);
}

main().catch(e => {
  console.error('FATAL ERROR:', e);
  process.exit(1);
});
