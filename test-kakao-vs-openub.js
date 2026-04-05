// test-kakao-vs-openub.js
// Kakao CE7 vs OpenUB cafe comparison near 강남역 (37.4979, 127.0276) within 500m

const CENTER_LAT = 37.4979;
const CENTER_LNG = 127.0276;
const RADIUS = 500;

const KAKAO_REST_KEY = '9e149576620513dc3283894501c49ab7';
const OPENUB_TOKEN = 'f3ddcfb3-caf4-4c30-9e09-f3f7fbc1abc1';

// ── Kakao CE7 category search ──

async function fetchKakaoCafes() {
  const allDocs = [];
  let totalCount = 0;

  for (let page = 1; page <= 3; page++) {
    const url = `https://dapi.kakao.com/v2/local/search/category.json?category_group_code=CE7&x=${CENTER_LNG}&y=${CENTER_LAT}&radius=${RADIUS}&sort=distance&page=${page}&size=15`;
    const res = await fetch(url, {
      headers: { Authorization: `KakaoAK ${KAKAO_REST_KEY}` }
    });
    if (!res.ok) {
      console.error(`Kakao page ${page} error: ${res.status}`);
      break;
    }
    const data = await res.json();
    if (page === 1) {
      totalCount = data.meta.total_count;
    }
    allDocs.push(...data.documents);
    if (data.meta.is_end) break;
  }

  return { totalCount, cafes: allDocs };
}

// ── OpenUB: S2 cell tokens + bd/hash + bd/sales ──

function latLngToS2Token(lat, lng, level) {
  // Simplified S2 approach: use the openub proxy's integrated mode instead
  // We'll call the deployed Netlify function directly
  return null;
}

async function fetchOpenUBCafes() {
  // Use the deployed openub-proxy integrated mode
  const res = await fetch('https://beancraft-sales.netlify.app/api/openub-proxy', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ lat: CENTER_LAT, lng: CENTER_LNG, radius: RADIUS })
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`OpenUB proxy error ${res.status}: ${text.substring(0, 300)}`);
  }

  return res.json();
}

// ── Name normalization for comparison ──

function normalizeName(name) {
  if (!name) return '';
  return name
    .replace(/\s+/g, '')          // remove spaces
    .replace(/[점호]$/g, '')       // remove trailing 점/호
    .replace(/강남역?점?$/g, '')   // remove branch suffixes like 강남점, 강남역점
    .replace(/\(.+\)/g, '')        // remove parenthesized content
    .toLowerCase()
    .trim();
}

// ── Main comparison ──

async function main() {
  console.log('='.repeat(70));
  console.log('Kakao CE7 vs OpenUB - Cafe Comparison');
  console.log(`Center: 강남역 (${CENTER_LAT}, ${CENTER_LNG}), Radius: ${RADIUS}m`);
  console.log('='.repeat(70));

  // 1. Kakao
  console.log('\n--- Fetching Kakao CE7 cafes ---');
  const kakaoResult = await fetchKakaoCafes();
  console.log(`Kakao total_count (meta): ${kakaoResult.totalCount}`);
  console.log(`Kakao returned cafes: ${kakaoResult.cafes.length}`);

  const kakaoNames = kakaoResult.cafes.map(c => ({
    name: c.place_name,
    address: c.road_address_name || c.address_name,
    distance: c.distance,
    normalized: normalizeName(c.place_name)
  }));

  console.log('\nKakao cafes (first 20):');
  kakaoNames.slice(0, 20).forEach((c, i) => {
    console.log(`  ${i + 1}. ${c.name} (${c.distance}m) - ${c.address}`);
  });
  if (kakaoNames.length > 20) {
    console.log(`  ... and ${kakaoNames.length - 20} more`);
  }

  // 2. OpenUB
  console.log('\n--- Fetching OpenUB cafes ---');
  let openubResult;
  try {
    openubResult = await fetchOpenUBCafes();
  } catch (e) {
    console.error(`OpenUB fetch failed: ${e.message}`);
    console.log('\nSkipping OpenUB comparison due to error.');
    return;
  }

  const openubCafes = openubResult.cafes || [];
  console.log(`OpenUB total cafes: ${openubCafes.length}`);
  console.log(`OpenUB meta:`, JSON.stringify(openubResult.meta, null, 2));

  const openubNames = openubCafes.map(c => ({
    name: c.storeNm,
    address: c.address,
    normalized: normalizeName(c.storeNm)
  }));

  console.log('\nOpenUB cafes (first 20):');
  openubNames.slice(0, 20).forEach((c, i) => {
    console.log(`  ${i + 1}. ${c.name} - ${c.address}`);
  });
  if (openubNames.length > 20) {
    console.log(`  ... and ${openubNames.length - 20} more`);
  }

  // 3. Comparison
  console.log('\n' + '='.repeat(70));
  console.log('COMPARISON RESULTS');
  console.log('='.repeat(70));

  console.log(`\nKakao total (meta): ${kakaoResult.totalCount}`);
  console.log(`Kakao returned:     ${kakaoResult.cafes.length}`);
  console.log(`OpenUB total:        ${openubCafes.length}`);

  // Build lookup sets
  const kakaoNormSet = new Set(kakaoNames.map(c => c.normalized));
  const openubNormSet = new Set(openubNames.map(c => c.normalized));

  // Also try fuzzy matching: if normalized name of one contains the other
  function findMatch(name, targetSet, targetList) {
    if (targetSet.has(name)) return { exact: true, match: name };
    for (const t of targetList) {
      if (name.length >= 2 && t.normalized.length >= 2) {
        if (t.normalized.includes(name) || name.includes(t.normalized)) {
          return { exact: false, match: t.normalized, originalName: t.name };
        }
      }
    }
    return null;
  }

  // Kakao-only (not in OpenUB)
  const kakaoOnly = [];
  const matched = [];
  for (const k of kakaoNames) {
    const m = findMatch(k.normalized, openubNormSet, openubNames);
    if (m) {
      matched.push({ kakao: k.name, openub: m.match, exact: m.exact });
    } else {
      kakaoOnly.push(k);
    }
  }

  // OpenUB-only (not in Kakao)
  const openubOnly = [];
  for (const o of openubNames) {
    const m = findMatch(o.normalized, kakaoNormSet, kakaoNames);
    if (!m) {
      openubOnly.push(o);
    }
  }

  console.log(`\nMatched (both): ${matched.length}`);
  console.log(`Kakao-only:     ${kakaoOnly.length}`);
  console.log(`OpenUB-only:    ${openubOnly.length}`);

  console.log('\n--- Matched cafes (first 15) ---');
  matched.slice(0, 15).forEach((m, i) => {
    console.log(`  ${i + 1}. Kakao: "${m.kakao}" = OpenUB: "${m.openub}" ${m.exact ? '(exact)' : '(fuzzy)'}`);
  });

  console.log('\n--- Kakao-only cafes (first 15) ---');
  kakaoOnly.slice(0, 15).forEach((c, i) => {
    console.log(`  ${i + 1}. ${c.name} (${c.distance}m) - ${c.address}`);
  });
  if (kakaoOnly.length > 15) console.log(`  ... and ${kakaoOnly.length - 15} more`);

  console.log('\n--- OpenUB-only cafes (first 15) ---');
  openubOnly.slice(0, 15).forEach((c, i) => {
    console.log(`  ${i + 1}. ${c.name} - ${c.address}`);
  });
  if (openubOnly.length > 15) console.log(`  ... and ${openubOnly.length - 15} more`);

  // Category breakdown for Kakao
  const categoryMap = {};
  for (const c of kakaoResult.cafes) {
    const cat = c.category_name || 'unknown';
    categoryMap[cat] = (categoryMap[cat] || 0) + 1;
  }
  console.log('\n--- Kakao category breakdown ---');
  Object.entries(categoryMap).sort((a, b) => b[1] - a[1]).forEach(([cat, count]) => {
    console.log(`  ${cat}: ${count}`);
  });

  console.log('\n' + '='.repeat(70));
  console.log('SUMMARY');
  console.log('='.repeat(70));
  console.log(`Kakao sees ${kakaoResult.totalCount} cafes total (returned ${kakaoResult.cafes.length})`);
  console.log(`OpenUB sees ${openubCafes.length} cafes`);
  const overlap = matched.length;
  const union = kakaoOnly.length + openubOnly.length + overlap;
  const overlapPct = union > 0 ? ((overlap / union) * 100).toFixed(1) : 0;
  console.log(`Overlap: ${overlap} / ${union} unique = ${overlapPct}% Jaccard similarity`);
  console.log(`Kakao-exclusive: ${kakaoOnly.length} (${kakaoResult.cafes.length > 0 ? ((kakaoOnly.length / kakaoResult.cafes.length) * 100).toFixed(1) : 0}% of Kakao)`);
  console.log(`OpenUB-exclusive: ${openubOnly.length} (${openubCafes.length > 0 ? ((openubOnly.length / openubCafes.length) * 100).toFixed(1) : 0}% of OpenUB)`);
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
