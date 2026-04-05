const https = require('https');
const http = require('http');

const API_KEY = '6d6c71717173656f3432436863774a';
const BASE_URL = `http://openapi.seoul.go.kr:8088/${API_KEY}/json/LOCALDATA_072405`;
const FIREBASE_URL = 'https://beancraft-sales-team-default-rtdb.asia-southeast1.firebasedatabase.app';
const BATCH_SIZE = 1000;
const PARALLEL = 5;

function httpGet(url) {
  return new Promise((resolve, reject) => {
    const mod = url.startsWith('https') ? https : http;
    mod.get(url, { timeout: 30000 }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try { resolve(JSON.parse(data)); }
        catch (e) { reject(new Error(`JSON parse error: ${data.slice(0, 200)}`)); }
      });
    }).on('error', reject).on('timeout', function() { this.destroy(); reject(new Error('timeout')); });
  });
}

function firebasePut(path, body) {
  const jsonBody = JSON.stringify(body);
  const url = new URL(`${FIREBASE_URL}${path}.json`);
  return new Promise((resolve, reject) => {
    const req = https.request({
      hostname: url.hostname,
      path: url.pathname + url.search,
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(jsonBody) },
      timeout: 120000,
    }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        if (res.statusCode >= 200 && res.statusCode < 300) resolve(data);
        else reject(new Error(`Firebase ${res.statusCode}: ${data.slice(0, 300)}`));
      });
    });
    req.on('error', reject);
    req.on('timeout', () => { req.destroy(); reject(new Error('Firebase timeout')); });
    req.write(jsonBody);
    req.end();
  });
}

function extractGu(rdnAddr, siteAddr) {
  const addr = rdnAddr || siteAddr || '';
  const m = addr.match(/서울\S*\s+(\S+구)/);
  if (m) return m[1];
  const m2 = addr.match(/(\S+구)\s/);
  if (m2 && m2[1].endsWith('구')) return m2[1];
  return '기타';
}

function extractFields(row) {
  return {
    TRDSTATENM: row.TRDSTATENM || '',
    TRDSTATECD: row.TRDSTATECD || '',
    SITEWHLADDR: row.SITEWHLADDR || '',
    RDNWHLADDR: row.RDNWHLADDR || '',
    BPLCNM: row.BPLCNM || '',
    UPTAENM: row.UPTAENM || '',
    X: row.X || '',
    Y: row.Y || '',
    DCBYMD: row.DCBYMD || '',
    APVPERMYMD: row.APVPERMYMD || '',
  };
}

async function fetchBatch(start, end, retries = 3) {
  const url = `${BASE_URL}/${start}/${end}/`;
  for (let i = 0; i < retries; i++) {
    try {
      const data = await httpGet(url);
      if (data.LOCALDATA_072405 && data.LOCALDATA_072405.row) {
        return data.LOCALDATA_072405.row;
      }
      if (data.RESULT && data.RESULT.CODE === 'INFO-200') return []; // no data
      console.error(`Unexpected response ${start}-${end}:`, JSON.stringify(data).slice(0, 200));
      return [];
    } catch (e) {
      console.error(`Retry ${i+1} for ${start}-${end}: ${e.message}`);
      if (i === retries - 1) return [];
      await new Promise(r => setTimeout(r, 2000 * (i + 1)));
    }
  }
  return [];
}

async function main() {
  const startTime = Date.now();

  // Step 1: Get total count
  console.log('Fetching total count...');
  const probe = await httpGet(`${BASE_URL}/1/1/`);
  const totalCount = probe.LOCALDATA_072405?.list_total_count || 0;
  console.log(`Total records: ${totalCount}`);

  if (!totalCount) { console.error('No data found'); return; }

  // Step 2: Fetch all in batches of 1000, 5 parallel
  const allRecords = [];
  const totalBatches = Math.ceil(totalCount / BATCH_SIZE);
  console.log(`Total batches: ${totalBatches}, fetching ${PARALLEL} at a time...`);

  for (let i = 0; i < totalBatches; i += PARALLEL) {
    const promises = [];
    for (let j = i; j < Math.min(i + PARALLEL, totalBatches); j++) {
      const start = j * BATCH_SIZE + 1;
      const end = Math.min((j + 1) * BATCH_SIZE, totalCount);
      promises.push(fetchBatch(start, end));
    }
    const results = await Promise.all(promises);
    for (const rows of results) {
      allRecords.push(...rows);
    }
    const pct = Math.min(100, Math.round(((i + PARALLEL) / totalBatches) * 100));
    process.stdout.write(`\rFetched: ${allRecords.length} / ${totalCount} (${pct}%)`);
  }
  console.log(`\nTotal fetched: ${allRecords.length}`);

  // Step 3: Extract fields and group by 구
  const guMap = {};
  let skipped = 0;
  for (const row of allRecords) {
    const fields = extractFields(row);
    const gu = extractGu(fields.RDNWHLADDR, fields.SITEWHLADDR);
    if (!guMap[gu]) guMap[gu] = [];
    guMap[gu].push(fields);
  }

  const guNames = Object.keys(guMap).sort();
  console.log(`\nGrouped into ${guNames.length} 구:`);
  let totalSize = 0;
  for (const gu of guNames) {
    const size = Buffer.byteLength(JSON.stringify(guMap[gu]));
    totalSize += size;
    console.log(`  ${gu}: ${guMap[gu].length} records (${(size / 1024).toFixed(1)} KB)`);
  }
  console.log(`Total JSON size: ${(totalSize / 1024 / 1024).toFixed(1)} MB`);

  // Step 4: Upload to Firebase - one 구 at a time
  console.log('\nUploading to Firebase...');
  let uploaded = 0;
  for (const gu of guNames) {
    const path = `/localdata/${encodeURIComponent(gu)}`;
    try {
      await firebasePut(path, guMap[gu]);
      uploaded++;
      console.log(`  [${uploaded}/${guNames.length}] ${gu}: ${guMap[gu].length} records uploaded`);
    } catch (e) {
      console.error(`  FAILED ${gu}: ${e.message}`);
    }
  }

  // Step 5: Save metadata
  const meta = {
    lastUpdated: '2026-03-31',
    totalRecords: allRecords.length,
    source: '서울시 LOCALDATA_072405',
    updateCycle: '매월 2일',
    guCount: guNames.length,
    uploadedAt: new Date().toISOString(),
  };
  try {
    await firebasePut('/localdata/_meta', meta);
    console.log('Metadata saved.');
  } catch (e) {
    console.error(`Metadata save failed: ${e.message}`);
  }

  const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
  console.log(`\nDone! ${uploaded}/${guNames.length} 구 uploaded, ${allRecords.length} records, ${elapsed}s elapsed.`);
}

main().catch(e => { console.error('Fatal:', e); process.exit(1); });
