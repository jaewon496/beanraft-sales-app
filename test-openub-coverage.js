// OpenUB S2 Coverage & 5-Split Building Analysis Test
// Run: node test-openub-coverage.js

const CENTER_LAT = 37.4979;
const CENTER_LNG = 127.0276;
const RADIUS = 350;
const S2_LEVEL = 14;
const TOKEN = 'f3ddcfb3-caf4-4c30-9e09-f3f7fbc1abc1';

const API_HEADERS = {
  'Content-Type': 'application/json',
  'Origin': 'https://www.openub.com',
  'Referer': 'https://www.openub.com/',
  'Access-Token': TOKEN
};

// ─── S2 Cell math (reproduced from openub-proxy.js) ───

function computeS2CellMetrics(lat, lng, radiusMeters, level) {
  const earthArea = 4 * Math.PI * 6371000 * 6371000;
  const cellArea = earthArea / (6 * Math.pow(4, level));
  const cellEdge = Math.sqrt(cellArea);
  const gridHalf = Math.ceil(radiusMeters / cellEdge) + 1;
  const mPerDegLat = 111320;
  const mPerDegLng = 111320 * Math.cos(lat * Math.PI / 180);

  // Count how many grid points pass the distance filter
  let tokenCount = 0;
  let maxDist = 0;
  for (let di = -gridHalf; di <= gridHalf; di++) {
    for (let dj = -gridHalf; dj <= gridHalf; dj++) {
      const dx = di * cellEdge;
      const dy = dj * cellEdge;
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist <= radiusMeters + cellEdge * 1.5) {
        tokenCount++;
        if (dist > maxDist) maxDist = dist;
      }
    }
  }

  // Add ~4 neighbor tokens (may overlap)
  const totalWithNeighbors = tokenCount + 4;

  return {
    cellArea,
    cellEdge,
    gridHalf,
    tokenCount,
    totalWithNeighbors,
    maxDistFromCenter: maxDist,
    circleArea: Math.PI * radiusMeters * radiusMeters,
    cellGridArea: tokenCount * cellArea,
    coverageRatio: (tokenCount * cellArea) / (Math.PI * radiusMeters * radiusMeters)
  };
}

// ─── Haversine ───

function haversineDistance(lat1, lng1, lat2, lng2) {
  const R = 6371000;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

// ─── API call helper ───

async function callOpenUB(endpoint, body) {
  const res = await fetch(`https://api.openub.com/v2/${endpoint}`, {
    method: 'POST',
    headers: API_HEADERS,
    body: JSON.stringify(body)
  });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`${endpoint} ${res.status}: ${text.substring(0, 300)}`);
  }
  return res.json();
}

// ─── Use s2-geometry to generate real tokens (same as proxy) ───

let S2;
try {
  S2 = require('s2-geometry').S2;
} catch (e) {
  console.error('s2-geometry not installed. Run: npm install s2-geometry');
  process.exit(1);
}

function latLngToToken(lat, lng, level) {
  const key = S2.latLngToKey(lat, lng, level);
  const id = S2.keyToId(key);
  const hex = BigInt(id).toString(16).padStart(16, '0');
  let end = hex.length;
  while (end > 1 && hex[end - 1] === '0') end--;
  return hex.substring(0, end);
}

function latLngToS2Tokens(lat, lng, radiusMeters, level) {
  const earthArea = 4 * Math.PI * 6371000 * 6371000;
  const cellArea = earthArea / (6 * Math.pow(4, level));
  const cellEdge = Math.sqrt(cellArea);
  const gridHalf = Math.ceil(radiusMeters / cellEdge) + 1;
  const mPerDegLat = 111320;
  const mPerDegLng = 111320 * Math.cos(lat * Math.PI / 180);
  const tokens = new Set();

  for (let di = -gridHalf; di <= gridHalf; di++) {
    for (let dj = -gridHalf; dj <= gridHalf; dj++) {
      const dx = di * cellEdge;
      const dy = dj * cellEdge;
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist <= radiusMeters + cellEdge * 1.5) {
        const ptLat = lat + (di * cellEdge) / mPerDegLat;
        const ptLng = lng + (dj * cellEdge) / mPerDegLng;
        tokens.add(latLngToToken(ptLat, ptLng, level));
      }
    }
  }

  try {
    const neighbors = S2.latLngToNeighborKeys(lat, lng, level);
    for (const nKey of neighbors) {
      const nId = S2.keyToId(nKey);
      const hex = BigInt(nId).toString(16).padStart(16, '0');
      let end = hex.length;
      while (end > 1 && hex[end - 1] === '0') end--;
      tokens.add(hex.substring(0, end));
    }
  } catch (e) { /* ignore */ }

  return Array.from(tokens);
}

function parseBdHashResponse(hashResult, centerLat, centerLng, radiusMeters) {
  const bd = hashResult?.bd;
  if (!bd || typeof bd !== 'object') return [];
  const buildings = [];
  for (const [rdnu, info] of Object.entries(bd)) {
    if (!info || typeof info !== 'object') continue;
    const center = info.center;
    const bLat = Array.isArray(center) ? center[1] : null;
    const bLng = Array.isArray(center) ? center[0] : null;
    if (bLat && bLng) {
      const dist = haversineDistance(centerLat, centerLng, bLat, bLng);
      if (dist > radiusMeters) continue;
    }
    buildings.push({ rdnu, lat: bLat, lng: bLng, address: info.ROAD_ADDR || info.ADDR || '' });
  }
  return buildings;
}

// ─── Main ───

async function main() {
  console.log('='.repeat(70));
  console.log('OpenUB S2 Coverage & 5-Split Building Analysis');
  console.log('Center: Gangnam Station (37.4979, 127.0276)');
  console.log('='.repeat(70));

  // ════════════════════════════════════════════════════════════════
  // TEST 1: S2 Cell Coverage Analysis
  // ════════════════════════════════════════════════════════════════
  console.log('\n' + '─'.repeat(70));
  console.log('TEST 1: S2 Cell Coverage for radius=350m at Level 14');
  console.log('─'.repeat(70));

  const metrics = computeS2CellMetrics(CENTER_LAT, CENTER_LNG, RADIUS, S2_LEVEL);
  const realTokens = latLngToS2Tokens(CENTER_LAT, CENTER_LNG, RADIUS, S2_LEVEL);

  console.log(`  S2 Level: ${S2_LEVEL}`);
  console.log(`  Cell area: ${metrics.cellArea.toFixed(1)} m^2 (${(metrics.cellArea / 10000).toFixed(3)} hectares)`);
  console.log(`  Cell edge: ${metrics.cellEdge.toFixed(1)} m`);
  console.log(`  Grid half: ${metrics.gridHalf} (grid = ${2 * metrics.gridHalf + 1} x ${2 * metrics.gridHalf + 1})`);
  console.log(`  Grid points passing distance filter: ${metrics.tokenCount}`);
  console.log(`  Real unique S2 tokens generated: ${realTokens.length}`);
  console.log(`  Max distance from center (grid): ${metrics.maxDistFromCenter.toFixed(1)} m`);
  console.log(`  Circle area (350m): ${(metrics.circleArea / 1e6).toFixed(4)} km^2`);
  console.log(`  Cell grid total area: ${(metrics.cellGridArea / 1e6).toFixed(4)} km^2`);
  console.log(`  Coverage ratio (grid area / circle area): ${metrics.coverageRatio.toFixed(2)}x`);
  console.log(`  Distance filter cutoff: radius + 1.5*cellEdge = ${RADIUS} + ${(metrics.cellEdge * 1.5).toFixed(1)} = ${(RADIUS + metrics.cellEdge * 1.5).toFixed(1)} m`);

  const gapCheck = metrics.cellEdge * 1.5 >= metrics.cellEdge;
  console.log(`  Gap possible? Cell edge=${metrics.cellEdge.toFixed(1)}m, margin=${(metrics.cellEdge * 1.5).toFixed(1)}m -> ${gapCheck ? 'NO gaps (margin >= cellEdge)' : 'POSSIBLE gaps'}`);

  // Also compute for 500m radius (what the proxy actually uses by default)
  const metrics500 = computeS2CellMetrics(CENTER_LAT, CENTER_LNG, 500, S2_LEVEL);
  const realTokens500 = latLngToS2Tokens(CENTER_LAT, CENTER_LNG, 500, S2_LEVEL);
  console.log(`\n  For comparison, radius=500m: ${realTokens500.length} tokens, coverage ratio=${metrics500.coverageRatio.toFixed(2)}x`);

  // ════════════════════════════════════════════════════════════════
  // TEST 2: 5-Split Building Count (Center + 4 diagonals)
  // ════════════════════════════════════════════════════════════════
  console.log('\n' + '─'.repeat(70));
  console.log('TEST 2: 5-Split Building Count (center + 4 diagonals at +/-0.0013 deg)');
  console.log('─'.repeat(70));

  const OFFSET = 0.0013; // ~144m lat, ~115m lng at this latitude
  const splitPoints = [
    { name: 'center', lat: CENTER_LAT, lng: CENTER_LNG },
    { name: 'NE', lat: CENTER_LAT + OFFSET, lng: CENTER_LNG + OFFSET },
    { name: 'NW', lat: CENTER_LAT + OFFSET, lng: CENTER_LNG - OFFSET },
    { name: 'SE', lat: CENTER_LAT - OFFSET, lng: CENTER_LNG + OFFSET },
    { name: 'SW', lat: CENTER_LAT - OFFSET, lng: CENTER_LNG - OFFSET },
  ];

  const allBuildingsMap = new Map(); // rdnu -> { sources: Set, lat, lng }
  const splitResults = [];

  for (const pt of splitPoints) {
    const tokens = latLngToS2Tokens(pt.lat, pt.lng, RADIUS, S2_LEVEL);
    console.log(`  ${pt.name} (${pt.lat.toFixed(4)}, ${pt.lng.toFixed(4)}): ${tokens.length} S2 tokens`);

    try {
      const hashResult = await callOpenUB('bd/hash', { cellTokens: tokens });
      const buildings = parseBdHashResponse(hashResult, pt.lat, pt.lng, RADIUS);
      console.log(`    -> ${buildings.length} buildings within ${RADIUS}m of this split point`);
      splitResults.push({ name: pt.name, buildings, tokenCount: tokens.length });

      for (const b of buildings) {
        if (!allBuildingsMap.has(b.rdnu)) {
          allBuildingsMap.set(b.rdnu, { lat: b.lat, lng: b.lng, sources: new Set() });
        }
        allBuildingsMap.get(b.rdnu).sources.add(pt.name);
      }
    } catch (e) {
      console.log(`    -> ERROR: ${e.message}`);
      splitResults.push({ name: pt.name, buildings: [], tokenCount: tokens.length, error: e.message });
    }

    // Small delay to be nice to the API
    await new Promise(r => setTimeout(r, 300));
  }

  const totalUnique = allBuildingsMap.size;
  console.log(`\n  TOTAL UNIQUE buildings (union of 5 splits): ${totalUnique}`);

  // Overlap analysis
  const overlapCounts = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
  for (const [rdnu, info] of allBuildingsMap) {
    overlapCounts[info.sources.size]++;
  }
  console.log('  Overlap analysis (how many splits found each building):');
  for (const [n, count] of Object.entries(overlapCounts)) {
    if (count > 0) {
      console.log(`    Found in exactly ${n} split(s): ${count} buildings (${(count / totalUnique * 100).toFixed(1)}%)`);
    }
  }

  // Buildings only found in 1 split
  const uniqueToSplit = {};
  for (const [rdnu, info] of allBuildingsMap) {
    if (info.sources.size === 1) {
      const src = [...info.sources][0];
      uniqueToSplit[src] = (uniqueToSplit[src] || 0) + 1;
    }
  }
  if (Object.keys(uniqueToSplit).length > 0) {
    console.log('  Buildings unique to only ONE split:');
    for (const [src, count] of Object.entries(uniqueToSplit)) {
      console.log(`    ${src}: ${count} unique buildings`);
    }
  }

  // ════════════════════════════════════════════════════════════════
  // TEST 3: Single Large Radius vs 5-Split
  // ════════════════════════════════════════════════════════════════
  console.log('\n' + '─'.repeat(70));
  console.log('TEST 3: Single call with 500m radius vs 5-split(350m each)');
  console.log('─'.repeat(70));

  const tokens500 = latLngToS2Tokens(CENTER_LAT, CENTER_LNG, 500, S2_LEVEL);
  console.log(`  Single 500m: ${tokens500.length} S2 tokens`);

  try {
    const hashResult500 = await callOpenUB('bd/hash', { cellTokens: tokens500 });
    const buildings500 = parseBdHashResponse(hashResult500, CENTER_LAT, CENTER_LNG, 500);
    console.log(`  Single 500m: ${buildings500.length} buildings within 500m`);

    // Also filter at 350m for fair comparison
    const buildings350single = parseBdHashResponse(hashResult500, CENTER_LAT, CENTER_LNG, 350);
    console.log(`  Single 500m (filtered to 350m): ${buildings350single.length} buildings`);

    // Compare: how many buildings in 5-split union are NOT in single-500m?
    const single500rdnus = new Set(buildings500.map(b => b.rdnu));
    const single350rdnus = new Set(buildings350single.map(b => b.rdnu));

    let inSplitNotInSingle500 = 0;
    let inSplitNotInSingle350 = 0;
    for (const rdnu of allBuildingsMap.keys()) {
      if (!single500rdnus.has(rdnu)) inSplitNotInSingle500++;
      if (!single350rdnus.has(rdnu)) inSplitNotInSingle350++;
    }

    let inSingle500NotInSplit = 0;
    for (const b of buildings500) {
      if (!allBuildingsMap.has(b.rdnu)) inSingle500NotInSplit++;
    }

    console.log(`\n  Comparison:`);
    console.log(`    5-split union (350m each): ${totalUnique} unique buildings`);
    console.log(`    Single 500m call: ${buildings500.length} buildings`);
    console.log(`    Single 500m (filtered 350m): ${buildings350single.length} buildings`);
    console.log(`    In 5-split but NOT in single-500m: ${inSplitNotInSingle500}`);
    console.log(`    In single-500m but NOT in 5-split: ${inSingle500NotInSplit}`);
    console.log(`    In 5-split but NOT in single-350m: ${inSplitNotInSingle350}`);

  } catch (e) {
    console.log(`  ERROR: ${e.message}`);
  }

  // ════════════════════════════════════════════════════════════════
  // TEST 4: Building Density Sanity Check
  // ════════════════════════════════════════════════════════════════
  console.log('\n' + '─'.repeat(70));
  console.log('TEST 4: Building Density Sanity Check');
  console.log('─'.repeat(70));

  const areaKm2_500 = Math.PI * 0.5 * 0.5; // pi * r^2 in km
  const areaKm2_350 = Math.PI * 0.35 * 0.35;

  console.log(`  Circle area (500m radius): ${areaKm2_500.toFixed(4)} km^2`);
  console.log(`  Circle area (350m radius): ${areaKm2_350.toFixed(4)} km^2`);

  // Use the 5-split count as reference
  const density5split = totalUnique / areaKm2_350;
  console.log(`\n  5-split (350m): ${totalUnique} buildings / ${areaKm2_350.toFixed(4)} km^2 = ${density5split.toFixed(0)} buildings/km^2`);

  // Reference: 485 buildings in 500m (from memory context)
  const density485 = 485 / areaKm2_500;
  console.log(`  Reference (485 in 500m): 485 / ${areaKm2_500.toFixed(4)} km^2 = ${density485.toFixed(0)} buildings/km^2`);

  console.log(`\n  Context:`);
  console.log(`    - Seoul average building density: ~4,000-6,000/km^2`);
  console.log(`    - Gangnam commercial core: ~800-1,500/km^2 (many large buildings)`);
  console.log(`    - Dense residential (low-rise): ~3,000-5,000/km^2`);
  console.log(`    - Dense commercial (high-rise): ~500-1,200/km^2`);
  console.log(`    -> 485 buildings in 500m = ${density485.toFixed(0)}/km^2 -> ${density485 > 400 && density485 < 2000 ? 'REASONABLE for dense commercial area' : 'UNUSUAL'}`);

  console.log('\n' + '='.repeat(70));
  console.log('ANALYSIS COMPLETE');
  console.log('='.repeat(70));
}

main().catch(e => {
  console.error('Fatal error:', e);
  process.exit(1);
});
